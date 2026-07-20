import { app, BrowserWindow, ipcMain, nativeTheme, screen } from 'electron';
import { join } from 'node:path';
import { Store } from './store';
import { startApi } from './api';
import type { KunbanData } from '../shared/types';

let window: BrowserWindow | undefined;
let isQuitting = false;
let resizeAnimation: NodeJS.Timeout | undefined;
const store = new Store(join(app.getPath('userData'), 'kunban.json'));

const dimensions = { compact: { width: 352, height: 352 }, expanded: { width: 910, height: 590 } };

function createWindow() {
  const bounds = screen.getPrimaryDisplay().workArea;
  window = new BrowserWindow({
    width: dimensions.compact.width, height: dimensions.compact.height,
    x: bounds.x + bounds.width - dimensions.compact.width - 28, y: bounds.y + 34,
    frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    show: false, backgroundColor: '#00000000',
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  window.setAlwaysOnTop(true, 'floating');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.loadURL(process.env.VITE_DEV_SERVER_URL ?? `file://${join(__dirname, '../dist/index.html')}`);
  window.once('ready-to-show', () => window?.showInactive());
  window.on('close', (event) => { if (!isQuitting) { event.preventDefault(); window?.hide(); } });
}

function resizeFromRight(expanded: boolean) {
  if (!window) return;
  if (resizeAnimation) clearInterval(resizeAnimation);
  const start = window.getBounds();
  const targetSize = expanded ? dimensions.expanded : dimensions.compact;
  const display = screen.getDisplayMatching(start).workArea;
  const rightEdge = start.x + start.width;
  const target = {
    width: targetSize.width,
    height: targetSize.height,
    x: Math.max(display.x, rightEdge - targetSize.width),
    y: start.y
  };
  const startedAt = Date.now();
  const duration = 360;
  const easeInOutCubic = (progress: number) => progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  resizeAnimation = setInterval(() => {
    if (!window || window.isDestroyed()) return;
    const progress = Math.min(1, (Date.now() - startedAt) / duration);
    const amount = easeInOutCubic(progress);
    window.setBounds({
      x: Math.round(start.x + (target.x - start.x) * amount),
      y: start.y,
      width: Math.round(start.width + (target.width - start.width) * amount),
      height: Math.round(start.height + (target.height - start.height) * amount)
    });
    if (progress === 1 && resizeAnimation) {
      clearInterval(resizeAnimation);
      resizeAnimation = undefined;
    }
  }, 16);
}

app.whenReady().then(async () => {
  const data = await store.load();
  nativeTheme.themeSource = data.settings.theme;
  startApi(store, Number(process.env.KUNBAN_PORT ?? data.settings.apiPort));
  createWindow();
  ipcMain.handle('kunban:load', () => store.snapshot());
  ipcMain.handle('kunban:save', async (_event, next: KunbanData) => {
    nativeTheme.themeSource = next.settings.theme;
    return store.mutate((current) => Object.assign(current, next));
  });
  ipcMain.on('widget:expanded', (_event, expanded: boolean) => {
    resizeFromRight(expanded);
  });
  ipcMain.on('widget:hide', () => window?.hide());
});

app.on('window-all-closed', () => undefined);
app.on('before-quit', () => { isQuitting = true; });

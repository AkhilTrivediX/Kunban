import { app, BrowserWindow, ipcMain, nativeTheme, screen } from 'electron';
import { join } from 'node:path';
import { Store } from './store';
import { startApi } from './api';
import type { KunbanData } from '../shared/types';

let window: BrowserWindow | undefined;
let isQuitting = false;
const store = new Store(join(app.getPath('userData'), 'kunban.json'));

const dimensions = { compact: { width: 352, height: 352 }, expanded: { width: 910, height: 590 } };

function createWindow() {
  const bounds = screen.getPrimaryDisplay().workArea;
  window = new BrowserWindow({
    width: dimensions.compact.width, height: dimensions.compact.height,
    x: bounds.x + bounds.width - dimensions.compact.width - 28, y: bounds.y + 34,
    frame: false, transparent: false, resizable: false, skipTaskbar: true, alwaysOnTop: true,
    show: false, backgroundColor: '#ffffff',
    webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  window.setAlwaysOnTop(true, 'floating');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.loadURL(process.env.VITE_DEV_SERVER_URL ?? `file://${join(__dirname, '../dist/index.html')}`);
  window.once('ready-to-show', () => window?.showInactive());
  window.on('close', (event) => { if (!isQuitting) { event.preventDefault(); window?.hide(); } });
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
    const next = expanded ? dimensions.expanded : dimensions.compact;
    window?.setSize(next.width, next.height);
  });
  ipcMain.on('widget:hide', () => window?.hide());
});

app.on('window-all-closed', () => undefined);
app.on('before-quit', () => { isQuitting = true; });

import { contextBridge, ipcRenderer } from 'electron';
import type { KunbanData } from '../shared/types';

contextBridge.exposeInMainWorld('kunban', {
  load: (): Promise<KunbanData> => ipcRenderer.invoke('kunban:load'),
  save: (data: KunbanData): Promise<KunbanData> => ipcRenderer.invoke('kunban:save', data),
  getSystemAccent: (): Promise<string> => ipcRenderer.invoke('kunban:system-accent'),
  setExpanded: (expanded: boolean): Promise<void> => ipcRenderer.invoke('widget:expanded', expanded),
  hide: () => ipcRenderer.send('widget:hide')
});

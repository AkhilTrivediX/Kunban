import { contextBridge, ipcRenderer } from 'electron';
import type { KunbanData } from '../shared/types';

contextBridge.exposeInMainWorld('kunban', {
  load: (): Promise<KunbanData> => ipcRenderer.invoke('kunban:load'),
  save: (data: KunbanData): Promise<KunbanData> => ipcRenderer.invoke('kunban:save', data),
  setExpanded: (expanded: boolean) => ipcRenderer.send('widget:expanded', expanded),
  hide: () => ipcRenderer.send('widget:hide')
});

/// <reference types="vite/client" />
import type { KunbanData } from '../shared/types';

declare global {
  interface Window {
    kunban: {
      load(): Promise<KunbanData>;
      save(data: KunbanData): Promise<KunbanData>;
      getSystemAccent(): Promise<string>;
      setExpanded(expanded: boolean): Promise<void>;
      hide(): void;
    };
  }
}

export {};

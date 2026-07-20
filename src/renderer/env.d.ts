/// <reference types="vite/client" />
import type { KunbanData } from '../shared/types';

declare global {
  interface Window {
    kunban: {
      load(): Promise<KunbanData>;
      save(data: KunbanData): Promise<KunbanData>;
      setExpanded(expanded: boolean): void;
      hide(): void;
    };
  }
}

export {};

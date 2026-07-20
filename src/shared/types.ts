export type Priority = 'critical' | 'high' | 'normal' | 'low';
export type StackId = 'priority' | 'planned' | 'finished';

export interface Card {
  id: string;
  title: string;
  details?: string;
  priority: Priority;
  stack: StackId;
  dueAt?: string;
  source: 'manual' | 'web' | 'mcp';
  createdAt: string;
}

export interface KunbanData {
  cards: Card[];
  settings: {
    apiPort: number;
    theme: 'system' | 'light' | 'dark';
    expandedOnHover: boolean;
    accent: 'system' | 'moss' | 'iris' | 'coral' | 'sun';
  };
}

export const priorityRank: Record<Priority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

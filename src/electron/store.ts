import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Card, KunbanData } from '../shared/types';

const seedCards: Card[] = [
  { id: 'seed-1', title: 'Review the design brief', details: 'Set the visual direction before the first build.', priority: 'critical', stack: 'priority', dueAt: new Date(Date.now() + 3 * 3_600_000).toISOString(), source: 'manual', createdAt: new Date().toISOString() },
  { id: 'seed-2', title: 'Plan next week’s focus', priority: 'high', stack: 'priority', source: 'manual', createdAt: new Date().toISOString() },
  { id: 'seed-3', title: 'Organise saved references', priority: 'normal', stack: 'planned', source: 'manual', createdAt: new Date().toISOString() },
  { id: 'seed-4', title: 'Clear inbox to zero', priority: 'low', stack: 'finished', source: 'manual', createdAt: new Date().toISOString() }
];

export const makeData = (): KunbanData => ({
  cards: seedCards,
  settings: { apiPort: 7481, theme: 'system', expandedOnHover: true, accent: 'system' }
});

export class Store {
  private data: KunbanData = makeData();

  public constructor(private readonly file: string) {}

  async load() {
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8')) as Partial<KunbanData>;
      this.data = { ...makeData(), ...saved, settings: { ...makeData().settings, ...saved.settings } };
    } catch {
      await this.save();
    }
    return this.data;
  }

  snapshot() { return structuredClone(this.data); }

  async mutate(mutator: (data: KunbanData) => void) {
    mutator(this.data);
    await this.save();
    return this.snapshot();
  }

  async createCard(input: Omit<Card, 'id' | 'createdAt'>) {
    const card: Card = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    await this.mutate((data) => data.cards.push(card));
    return card;
  }

  private async save() {
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.next`;
    await writeFile(temporary, JSON.stringify(this.data, null, 2), 'utf8');
    await rename(temporary, this.file);
  }
}

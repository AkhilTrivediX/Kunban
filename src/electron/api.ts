import { createServer } from 'node:http';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import type { Priority, StackId } from '../shared/types';
import { Store } from './store';

const priority = z.enum(['critical', 'high', 'normal', 'low']);
const stack = z.enum(['priority', 'planned', 'finished']);
const createCard = z.object({
  title: z.string().trim().min(1).max(140),
  details: z.string().trim().max(2_000).optional(),
  priority: priority.default('normal'),
  dueAt: z.string().datetime().optional(),
  stack: stack.default('priority')
});

const isPrivateOrigin = (origin?: string) => !origin || /^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(origin);

export const startApi = (store: Store, port: number) => {
  const app = express();
  const webRequests = new Map<string, { startedAt: number; count: number }>();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.use((req, res, next) => {
    const host = req.hostname;
    if (!['127.0.0.1', '::1', 'localhost'].includes(host)) return res.status(403).json({ error: 'Kunban is local-only.' });
    next();
  });

  app.get('/api/info', (_req, res) => res.json({
    name: 'Kunban Local API', version: 'v1', port, protocol: 'kunban-local/v1',
    capabilities: { webCreate: true, localReadWrite: true, mcp: true },
    docs: 'https://github.com/AkhilTrivediX/Kunban#local-integrations'
  }));

  // This is the only browser-accessible route. It never returns cards and cannot set arbitrary fields.
  app.options('/api/web/cards', (req, res) => allowWebOrigin(req, res).status(204).end());
  app.post('/api/web/cards', (req, res) => {
    const origin = req.get('origin');
    if (!origin || req.get('x-kunban-intent') !== 'create-card') return res.status(403).json({ error: 'A browser origin and create-card intent are required.' });
    const now = Date.now();
    const window = webRequests.get(origin);
    const request = !window || now - window.startedAt > 60_000 ? { startedAt: now, count: 0 } : window;
    if (request.count >= 20) return allowWebOrigin(req, res).status(429).json({ error: 'Too many card requests. Try again in a minute.' });
    request.count += 1;
    webRequests.set(origin, request);
    const parsed = createCard.pick({ title: true, details: true, priority: true, dueAt: true }).safeParse(req.body);
    if (!parsed.success) return allowWebOrigin(req, res).status(422).json({ error: 'Invalid card request.', issues: parsed.error.flatten() });
    void store.createCard({ ...parsed.data, stack: 'priority', source: 'web' }).then((card) =>
      allowWebOrigin(req, res).status(201).json({ accepted: true, id: card.id })
    );
  });

  app.use('/api/local', (req, res, next) => {
    if (!isPrivateOrigin(req.get('origin'))) return res.status(403).json({ error: 'Browser origins cannot use the local API.' });
    next();
  });

  app.get('/api/local/cards', (_req, res) => res.json({ cards: store.snapshot().cards }));
  app.post('/api/local/cards', async (req, res) => {
    const parsed = createCard.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Invalid card.', issues: parsed.error.flatten() });
    res.status(201).json({ card: await store.createCard({ ...parsed.data, source: 'mcp' }) });
  });
  app.patch('/api/local/cards/:id', async (req, res) => {
    const parsed = z.object({ title: z.string().trim().min(1).max(140).optional(), details: z.string().trim().max(2_000).optional(), priority: priority.optional(), stack: stack.optional(), dueAt: z.string().datetime().nullable().optional() }).safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: 'Invalid update.' });
    let found = false;
    const data = await store.mutate((current) => {
      const card = current.cards.find((candidate) => candidate.id === req.params.id);
      if (card) { Object.assign(card, parsed.data); found = true; }
    });
    if (!found) return res.status(404).json({ error: 'Card not found.' });
    res.json({ card: data.cards.find((card) => card.id === req.params.id) });
  });

  const server = createServer(app);
  server.listen(port, '127.0.0.1');
  return server;
};

function allowWebOrigin(req: Request, res: Response) {
  const origin = req.get('origin');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kunban-Intent');
  res.setHeader('Access-Control-Max-Age', '600');
  return res;
}

export type { Priority, StackId };

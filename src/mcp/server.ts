import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const port = Number(process.env.KUNBAN_PORT ?? 7481);
const baseUrl = `http://127.0.0.1:${port}/api/local`;

async function local(path: string, options: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers }
  });
  if (!response.ok) throw new Error(`Kunban returned ${response.status}: ${await response.text()}`);
  return response.json();
}

const server = new McpServer({ name: 'kunban', version: '0.1.0' });

server.registerTool('list_cards', {
  description: 'List personal Kunban cards. This is a local-only MCP capability.',
  inputSchema: { stack: z.enum(['priority', 'planned', 'finished']).optional() }
}, async ({ stack }) => {
  const result = await local('/cards') as { cards: unknown[] };
  const cards = stack ? result.cards.filter((card: any) => card.stack === stack) : result.cards;
  return { content: [{ type: 'text', text: JSON.stringify(cards, null, 2) }] };
});

server.registerTool('create_card', {
  description: 'Create a card in Kunban. Use priority for time-sensitive work and an ISO 8601 dueAt for deadlines.',
  inputSchema: {
    title: z.string().min(1).max(140), details: z.string().max(2000).optional(),
    priority: z.enum(['critical', 'high', 'normal', 'low']).default('normal'),
    stack: z.enum(['priority', 'planned', 'finished']).default('priority'), dueAt: z.string().datetime().optional()
  }
}, async (input) => ({ content: [{ type: 'text', text: JSON.stringify(await local('/cards', { method: 'POST', body: JSON.stringify(input) })) }] }));

server.registerTool('update_card', {
  description: 'Update a Kunban card: change title, details, priority, deadline, or move it to another stack.',
  inputSchema: {
    id: z.string().uuid(), title: z.string().min(1).max(140).optional(), details: z.string().max(2000).optional(),
    priority: z.enum(['critical', 'high', 'normal', 'low']).optional(), stack: z.enum(['priority', 'planned', 'finished']).optional(), dueAt: z.string().datetime().nullable().optional()
  }
}, async ({ id, ...input }) => ({ content: [{ type: 'text', text: JSON.stringify(await local(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(input) })) }] }));

await server.connect(new StdioServerTransport());

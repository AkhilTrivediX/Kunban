# Kunban

> A quiet, desktop-native Kanban board that keeps the next commitment in view.

Kunban is a personal Windows desktop widget, not another browser tab. It stays out of the taskbar, presents a compact priority list by default, and expands into a full board when you need more context. Cards, preferences, and automation stay local to your machine.

## Why Kunban

Most boards make you visit them. Kunban is designed to be glanced at: the default view answers “what needs attention now?” before showing the rest of your work.

- **Priority-first widget** — the compact view sorts important work to the top.
- **Calm progressive disclosure** — hover to reveal Priority, Planned, and Finished stacks.
- **Desktop-native presence** — frameless, always-on-top, taskbar-free window with a lightweight footprint.
- **Fast card handling** — drag cards between stacks, or right-click for edit, move, complete, and delete actions.
- **Personal appearance** — system light/dark theme, system accent support, and selectable accent colours.
- **Local-first automation** — a loopback API and MCP server let local AI tools manage cards without a cloud account or API key.
- **Private by default** — board data is stored as local JSON in the app-data directory; the API never listens on your network.

## Getting started

### Requirements

- Windows 10 or 11
- Node.js 20 or newer (for development)

### Run in development

```bash
npm install
npm run dev
```

The Vite UI starts on `127.0.0.1:5188`; Kunban itself opens as an Electron desktop widget. Its local integration API listens on `127.0.0.1:7400`.

### Build a Windows package

```bash
npm run package:win
```

This creates NSIS installer and portable Windows builds in `release/`.

## Using the board

1. Add a commitment with the **+** button.
2. Keep only immediate work in **Priority**; drag future work to **Planned**.
3. Check a card, or use its right-click menu, to mark it complete.
4. Hover over the compact widget to see the complete board.
5. Open **Preferences** to follow the system theme, use the system accent, or select another accent colour.

## Local integrations

Kunban exposes a small local interface at `http://127.0.0.1:7400`. Set `KUNBAN_PORT` before launch only if you need a different port.

### Integration surfaces

| Surface | Access | Intended use |
| --- | --- | --- |
| `GET /api/info` | Safe public metadata | Check whether Kunban is available and learn its capabilities. |
| `POST /api/web/cards` | Browser CORS, create-only | Let a website request one Priority card without reading private board data. |
| `GET /api/local/cards` | Loopback local process | Read cards from a local app or agent. |
| `POST /api/local/cards` | Loopback local process | Create a card with a stack, priority, details, and deadline. |
| `PATCH /api/local/cards/:id` | Loopback local process | Update card details, priority, deadline, or stack. |
| MCP over stdio | Local AI client | Use standard AI tools to list, create, and update cards. |

The HTTP service is bound to `127.0.0.1` only. Browser access is deliberately limited: websites can create a single card through the web endpoint but cannot read, bulk-write, or edit the board. Full local endpoints reject non-local browser origins.

### Website create request

This is the only route intended for websites. It never returns card data and is limited to 20 requests per origin per minute.

```js
await fetch('http://127.0.0.1:7400/api/web/cards', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Kunban-Intent': 'create-card'
  },
  body: JSON.stringify({
    title: 'Complete the frontend assessment',
    details: 'Role: Product Engineer',
    priority: 'high',
    dueAt: '2026-08-02T17:00:00.000Z'
  })
});
```

Accepted fields are `title`, `details`, `priority`, and `dueAt`. Web-created cards always enter the Priority stack.

### MCP setup

Register this server with any MCP-compatible AI client:

```json
{
  "mcpServers": {
    "kunban": {
      "command": "npx",
      "args": ["tsx", "C:/path/to/Kunban/src/mcp/server.ts"],
      "env": { "KUNBAN_PORT": "7400" }
    }
  }
}
```

Kunban’s MCP server provides `list_cards`, `create_card`, and `update_card`. When creating a card, supply a short `agentName` such as `Codex` or `Gemini`; Kunban shows that name on the card instead of a generic MCP label. It talks only to the local Kunban API and requires no user-managed secret.

### One-line AI context

> Kunban is a local desktop Kanban widget—use its MCP tools or `http://127.0.0.1:7400` API to create, edit, prioritize, move, complete, or delete my task cards.

## Architecture

| Layer | Role |
| --- | --- |
| React + Vite | Widget UI, board interactions, appearance preferences |
| Electron | Transparent always-on-top Windows window, native resize animation, system theme/accent access |
| Express | Loopback-only HTTP API with separate web and local trust levels |
| MCP SDK | Stdio bridge for local AI clients |
| JSON store | Local persistence without a cloud database |

## Development

```bash
npm run check      # Type-check the renderer, Electron process, and MCP server
npm run build      # Build the renderer and Electron process
npm run dev        # Run the widget with live UI updates
npm run package:win
```

## Contributing

Contributions are welcome. Keep changes focused and preserve Kunban’s local-first, calm-by-default product principles.

1. Create a branch from the current mainline using a descriptive prefix such as `feature/`, `fix/`, or `docs/`.
2. Make one cohesive change and keep the interface consistent with the existing design system.
3. Run `npm run check` and `npm run build` before opening a pull request.
4. Use Conventional Commit-style messages, for example `feat(cards): add due-date reminders`.
5. Describe the user-visible change, validation performed, and any follow-up work in the pull request.

For visual work, include before/after evidence only when it contains no personal desktop content or sensitive data.

## Roadmap

- Board profiles and per-project filters
- Optional encrypted local storage
- User-approved website source allowlist
- Taskbar tray control and launch-at-login preference

## License

[MIT](LICENSE)

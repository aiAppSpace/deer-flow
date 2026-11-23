# DeerFlow Frontend

Like the original DeerFlow 1.0, we would love to give the community a minimalistic and easy-to-use web interface with a more modern and flexible architecture.

For complete editable text artifacts, **Edit** focuses the existing code editor
and preserves its document. Later content or settings updates leave focus with
the control the user has selected.
Matching brackets are highlighted from the initial source view, before editing.
Complete text artifacts retain a real content revision on HTTP LAN addresses even
when WebCrypto or the response ETag is unavailable; saving still checks the original
file bytes for concurrent changes. Truncated previews remain read-only.

Composer text is saved after a 300 ms debounce of the last effective draft change
in the current tab. Background query updates and unrelated renders do not postpone
that save; changing conversations or leaving the page flushes the pending draft.

Leaving a conversation retires its pending regeneration preparation. An earlier
request finishing later cannot clear a newer conversation's submitted message or
allow a duplicate submission. Confirming a new conversation keeps its current send.

Notifications participate in ordinary Tab navigation. Alt+T opens a keyboard
visit to notifications; crossing that visit's Tab boundary returns to its invoking
control. Escape collapses the list without moving focus.

Memory import previews follow the most recently selected file. Choosing another
file or leaving settings prevents a slower earlier read from replacing that
preview or showing a stale read error.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with [App Router](https://nextjs.org/docs/app)
- **UI**: [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/), [MagicUI](https://magicui.design/) and [React Bits](https://reactbits.dev/)
- **AI Integration**: [LangGraph SDK](https://www.npmjs.com/package/@langchain/langgraph-sdk) and [Vercel AI Elements](https://vercel.com/ai-sdk/ai-elements)

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10.26.2+

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Development

```bash
# Start development server
pnpm dev

# The app will be available at http://localhost:3200
```

Both `pnpm dev` and `pnpm start` default to port `3200`. Explicit `PORT` or
Next.js `--port` arguments override that default; Docker images set `PORT=3000`
for their private container listener. Root `make dev`, `make start` and
`make dev-dual` pin React to `3200`, with the local Nginx upstream on the same port.

### Build & Test

```bash
# Type check
pnpm typecheck

# Check formatting
pnpm format

# Apply formatting
pnpm format:write

# Lint
pnpm lint

# Run unit tests
pnpm test

# One-time setup: install Playwright Chromium browser
pnpm exec playwright install chromium

# Run E2E tests (builds and starts production server automatically)
pnpm test:e2e

# Build for production
pnpm build

# Start production server
pnpm start
```

The default E2E suite owns its production server on `localhost:3002` and does
not reuse an existing process. Set `E2E_FRONTEND_PORT` to choose another
isolated port. Use `PLAYWRIGHT_SKIP_WEB_SERVER=1` only when intentionally
providing the target server yourself.

## Site Map

```
├── /                    # Landing page
├── /chats               # Chat list
├── /chats/new           # New chat page
└── /chats/[thread_id]   # A specific chat page
```

## Configuration

### Environment Variables

Key environment variables (see `.env.example` for full list):

```bash
# Backend API URL (optional, uses local Next.js/nginx proxy by default)
NEXT_PUBLIC_BACKEND_BASE_URL="http://localhost:8001"
# LangGraph-compatible API URL (optional, uses local Next.js/nginx proxy by default)
NEXT_PUBLIC_LANGGRAPH_BASE_URL="http://localhost:8001/api"
```

## Project Structure

```
tests/
├── e2e/                    # E2E tests (Playwright, Chromium, mocked backend)
└── unit/                   # Unit tests (mirrors src/ layout)
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes
│   ├── showcase/           # Allowlisted public read-only demos
│   ├── workspace/          # Main workspace pages
│   └── mock/               # Mock/demo pages
├── components/             # React components
│   ├── ui/                 # Reusable UI components
│   ├── workspace/          # Workspace-specific components
│   ├── landing/            # Landing page components
│   └── ai-elements/        # AI-related UI elements
├── core/                   # Core business logic
│   ├── api/                # API client & data fetching
│   ├── artifacts/          # Artifact management
│   ├── config/              # App configuration
│   ├── i18n/               # Internationalization
│   ├── mcp/                # MCP integration
│   ├── messages/           # Message handling
│   ├── models/             # Data models & types
│   ├── settings/           # User settings
│   ├── skills/             # Skills system
│   ├── threads/            # Thread management
│   ├── todos/              # Todo system
│   └── utils/              # Utility functions
├── hooks/                  # Custom React hooks
├── lib/                    # Shared libraries & utilities
├── server/                 # Server-side code
│   └── better-auth/        # Authentication setup and session helpers
└── styles/                 # Global styles
```

## Scripts

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `pnpm dev`          | Start development server with Webpack |
| `pnpm build`        | Build for production                  |
| `pnpm start`        | Start production server               |
| `pnpm test`         | Run unit tests with Rstest            |
| `pnpm test:e2e`     | Run E2E tests with Playwright         |
| `pnpm format`       | Check formatting with Prettier        |
| `pnpm format:write` | Apply formatting with Prettier        |
| `pnpm lint`         | Run ESLint                            |
| `pnpm lint:fix`     | Fix ESLint issues                     |
| `pnpm typecheck`    | Run TypeScript type checking          |
| `pnpm check`        | Run both lint and typecheck           |

## Development Notes

- Mermaid diagrams export as SVG, PNG or their original MMD source. SVG/PNG exports preserve HTML line breaks, entities and Unicode labels; PNG keeps the original 5x scale. Changing the diagram or leaving its owner cancels pending downloads.
- Uses pnpm workspaces (see `packageManager` in package.json)
- Webpack is the default development bundler until the upstream Turbopack PostCSS worker leak is fixed in a stable Next.js release (#5132). Set `DEER_FLOW_DEV_BUNDLER=turbo` to opt in to Turbopack for local diagnosis, or `DEER_FLOW_DEV_BUNDLER=webpack` to select Webpack explicitly. Reconsider the default after the stable fix is verified on macOS arm64 and Linux.
- Environment validation can be skipped with `SKIP_ENV_VALIDATION=1` (useful for Docker)
- Backend API URLs are optional; nginx proxy is used by default in development

## License

MIT License. See [LICENSE](../LICENSE) for details.

Artifact preview reads remain bounded to the existing byte limit even when a server
ignores Range. Requesting the full file changes the request budget, not the
completeness check: partial responses or fewer bytes than the declared total
remain truncated and do not receive an editable revision, even with a SHA-256 ETag.

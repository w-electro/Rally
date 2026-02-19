# Rally - Claude Code Project Guide

## What is Rally?

Rally is a Windows desktop application (Electron + React) — a next-generation gaming & social platform combining Discord's community structure, Instagram's visual feeds, Twitter's discovery, and Twitch's streaming/channel points. It has an aggressive esports/neon aesthetic.

## Project Structure

```
Rally/
├── backend/          # Node.js + Express + TypeScript API server
│   ├── prisma/       # Database schema & seed
│   ├── src/
│   │   ├── config/   # App configuration (reads .env)
│   │   ├── lib/      # Prisma client, Redis client
│   │   ├── middleware/# JWT auth middleware
│   │   ├── routes/   # 11 API route files (auth, servers, users, feed, stories, pulse, points, stream, ai, commerce, gaming)
│   │   ├── services/ # Token service
│   │   ├── socket/   # Socket.IO real-time messaging & voice
│   │   ├── webrtc/   # WebRTC signaling for voice/video
│   │   ├── utils/    # Error classes, permission bitfields
│   │   └── index.ts  # Server entry point
├── frontend/         # Electron + React 18 + Vite + Tailwind CSS
│   ├── electron/     # main.cjs (Electron main process), preload.cjs
│   ├── public/       # Static assets (icon.png, rally-logo.webp)
│   ├── src/
│   │   ├── components/
│   │   │   ├── app/      # Shell: AppLayout, ServerList, ChannelSidebar, DmSidebar, MemberList, VoiceBar
│   │   │   ├── chat/     # ChatArea, MessageItem, ChatInput, ThreadView
│   │   │   ├── feed/     # FeedView, FeedPostCard
│   │   │   ├── pulse/    # PulseView, PulsePostCard
│   │   │   ├── stories/  # StoryBar, StoryViewer
│   │   │   ├── stream/   # StreamView, PointsPanel
│   │   │   ├── voice/    # VoiceChannel
│   │   │   ├── ai/       # AiAssistant
│   │   │   ├── commerce/ # CommerceView
│   │   │   ├── gaming/   # GameSessionPanel
│   │   │   ├── settings/ # UserSettings
│   │   │   └── ui/       # Avatar, Badge, Modal, Tooltip, Spinner, ContextMenu, Tabs
│   │   ├── hooks/        # useSocket (Socket.IO hook)
│   │   ├── stores/       # Zustand: authStore, serverStore, messageStore, voiceStore, uiStore
│   │   ├── lib/          # api.ts (API client), types.ts, utils.ts
│   │   ├── pages/        # LandingPage, LoginPage, RegisterPage
│   │   └── styles/       # globals.css (Tailwind + custom neon styles)
├── nginx/            # Reverse proxy config
├── Logo/             # Brand assets (Rally.png, Rally.webp)
├── docker-compose.yml
└── .env.example
```

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, PostgreSQL, Redis (ioredis), Socket.IO, JWT (jsonwebtoken), bcryptjs, zod, Anthropic Claude SDK, Stripe
- **Frontend**: React 18, TypeScript, Vite 6, Tailwind CSS 3, Zustand 5, Socket.IO Client, React Router 7, Lucide React icons, Framer Motion
- **Desktop**: Electron 33
- **Infra**: Docker Compose (PostgreSQL 16, Redis 7, MinIO, nginx)

## Commands

### Backend (run from `backend/`)
```bash
npm install             # Install dependencies
npm run dev             # Start dev server (tsx watch, port 3001)
npm run build           # Compile TypeScript
npm run start           # Run compiled build
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema to database
npm run db:migrate      # Create migration
npm run db:seed         # Seed demo data
```

### Frontend (run from `frontend/`)
```bash
npm install             # Install dependencies
npm run dev             # Start Vite dev server (port 5173)
npm run build           # Build for production
npm run electron:dev    # Run as Electron desktop app
npm run electron:build  # Build Windows installer (.exe)
```

### Infrastructure
```bash
docker-compose up -d postgres redis minio   # Start backing services
docker-compose up -d                         # Start everything
```

## Brand Colors

| Name | Hex | Tailwind Class |
|------|-----|----------------|
| Electric Blue (primary) | `#00D9FF` | `text-rally-blue`, `bg-rally-blue` |
| Toxic Green (secondary) | `#39FF14` | `text-rally-green`, `bg-rally-green` |
| Deep Purple (accent) | `#8B00FF` | `text-rally-purple`, `bg-rally-purple` |
| Hot Magenta (danger) | `#FF006E` | `text-rally-magenta`, `bg-rally-magenta` |
| Neon Cyan | `#00F0FF` | `text-rally-cyan` |
| Pure Black (bg) | `#000000` | `bg-rally-black` |
| Dark Navy (sidebar bg) | `#0A0E27` | `bg-rally-navy` |
| Surface | `#0D1117` | `bg-rally-dark-surface` |

## Design Conventions

- **Fonts**: `font-display` (Rajdhani) for headings, `font-body` (Exo 2) for body text
- **Buttons**: Use `btn-rally`, `btn-rally-primary`, or `btn-rally-danger` classes
- **Inputs**: Use `input-rally` class
- **Cards**: Use `card-rally` class
- **Neon glow**: Use `neon-border`, `neon-text`, `neon-text-green`, `neon-text-magenta` classes
- **Angular shapes**: Use `clip-angular` or `clip-angular-sm` for beveled edges
- **Icons**: Always use `lucide-react`
- **All components use named exports**, not default exports (except route files and api client)

## Architecture Notes

- State management uses **Zustand** (not Redux). Stores are in `frontend/src/stores/`.
- API calls go through `frontend/src/lib/api.ts` — a singleton `ApiClient` class with auto token refresh.
- Real-time events go through Socket.IO via the `useSocket()` hook in `frontend/src/hooks/useSocket.ts`.
- The backend entry point is `backend/src/index.ts` — it creates Express + Socket.IO + WebRTC on a single HTTP server.
- Permissions use a **bitfield system** (BigInt) defined in `backend/src/utils/permissions.ts`.
- Channel points use **Redis as primary store** for sub-ms reads, with PostgreSQL as backup.
- The Prisma schema is in `backend/prisma/schema.prisma` — run `npm run db:generate` after modifying it.
- AI features call the **Anthropic Claude API** via `@anthropic-ai/sdk` in `backend/src/routes/ai.ts`.

## Environment Setup

Copy `.env.example` to `.env` at the project root and fill in:
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — random secure strings
- `ANTHROPIC_API_KEY` — for AI features
- `STRIPE_SECRET_KEY` — for commerce features (optional)

## Common Tasks

**Add a new API route**: Create file in `backend/src/routes/`, use Express Router, import `authenticate` middleware from `../middleware/auth`, register in `backend/src/index.ts`.

**Add a new component**: Create in appropriate `frontend/src/components/` subdirectory. Use named export. Import brand utilities from `@/lib/utils`.

**Modify the database**: Edit `backend/prisma/schema.prisma`, then run `npm run db:generate && npm run db:push` from `backend/`.

**Add a new Socket event**: Add handler in `backend/src/socket/index.ts`, add corresponding emit/listener in `frontend/src/hooks/useSocket.ts`.

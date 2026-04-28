# Gambit — Chess

Vite + React port of a Vercel/Next.js chess app. Lives at `artifacts/gambit-chess/`.

## Stack

- Vite + React + TypeScript
- Routing: `wouter` (with a small Next.js shim in `src/lib/next-compat.ts`)
- Game logic: `chess.js@1.4.0` (note: throws on illegal moves — always wrap `.move()` in try/catch)
- Board UI: `react-chessboard@5.10.0`
- AI engine: Stockfish via CDN web worker (`src/lib/stockfish.ts`)
- Auth + persistence: Supabase (URL hardcoded in `src/integrations/supabase/client.ts`)

## Architecture notes

- **Two engine instances** are kept alive: `getEngine()` for AI move selection and `getEvalEngine()` for the eval bar. Both serialize requests via a per-engine promise chain (`analysisQueue`) so concurrent calls can't crash Stockfish.
- **Difficulty presets** live in `src/pages/Play.tsx`. Max depth was lowered from 18 → 14 for responsiveness.
- **Game-end detection** uses chess.js's `isCheckmate / isStalemate / isThreefoldRepetition / isInsufficientMaterial / isDraw`. The detector is in `detectGameOver()` in `src/pages/Play.tsx`.
- After game over, the board is locked (`allowDragging = false`).
- `EvalBar` updates after every position change via the dedicated eval engine (depth 10 for speed).

## Auth

OAuth Google can fail with `Unsupported provider: missing OAuth secret`. The flow in `src/lib/auth.tsx`:

1. `signInWithOAuth({ provider: "google", options: { skipBrowserRedirect: true } })` — Supabase returns the URL but does NOT navigate.
2. The returned URL is probed with `fetch(url, { redirect: "manual" })`. A 400 response (or a body containing "unsupported provider"/"missing oauth secret") means Google isn't configured.
3. When unconfigured: a friendly message is shown, `oauthDisabled` is set (cached in `sessionStorage["gambit:oauth-disabled"]`), and the AuthGate snaps to email-only mode for the rest of the session.
4. When configured: `window.location.href = url` to start the OAuth flow.

`AuthGate` (`src/components/AuthGate.tsx`) supports both sign-in and sign-up via email, plus a "back" link to switch from email back to provider chooser when OAuth is available.

## Play page modes

`src/pages/Play.tsx` has two modes:

- **`ai`** — Stockfish opponent. If the user is signed in, a row is inserted into `games` and the result is persisted to Supabase on game over. Anonymous users can still play; their results just aren't recorded.
- **`local`** — Two players take turns on the same device. No auth required, no server state. A "Flip board" button is provided in the side panel so each side can see their pieces from the bottom.

The lobby (`/play`) is publicly accessible — auth is only required for AI mode persistence, and the app degrades gracefully when no user is signed in.

## Pages

- `/` — Home
- `/play` — Lobby + in-game UI (see above)
- `/multiplayer` — Lobby for online games
- `/room/:id` — In-progress online game (DO NOT touch `Room.tsx` — multiplayer logic is fragile)
- `/leaderboard`, `/store`, `/profile`, `/analysis/:id`

## Workflows

- `artifacts/gambit-chess: web` — `pnpm --filter @workspace/gambit-chess run dev`

## Pre-existing TS errors (unrelated to current work)

- `src/components/ui/resizable.tsx` references `Group` and `Separator` exports that don't exist in the installed version of `react-resizable-panels`. This is a vendored shadcn component; not blocking.

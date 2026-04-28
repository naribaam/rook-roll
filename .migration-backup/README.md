# Gambit Chess (rook-roll)

Next.js chess app with Supabase auth/database and a Stockfish-powered AI mode.

## Local dev

Install and run:

```bash
npm install
npm run dev
```

Create an env file:

- Copy `.env.example` → `.env.local`
- Fill:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase

- **Client**: configured in `src/integrations/supabase/client.ts`
- **Edge function**: `supabase/functions/finalize-game` (invoked from the app as `finalize-game`)

If you see `401 Not authenticated` from `finalize-game`, ensure you are signed in and the request includes a valid Supabase session token.

## Stockfish

The app runs Stockfish in a Web Worker.

- Primary path: `public/stockfish/stockfish.js` (same-origin, production-friendly)
- Fallback path: jsDelivr CDN (`stockfish.js@10.0.2`)


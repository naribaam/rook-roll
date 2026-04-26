import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/play")({
  head: () => ({
    meta: [
      { title: "Play vs AI — Gambit" },
      { name: "description", content: "Train against Stockfish at 20 difficulty levels." },
    ],
  }),
  component: PlayPage,
});

function PlayPage() {
  return (
    <Layout>
      <AuthGate>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="mb-2 text-2xl font-bold">Play vs AI</h1>
          <p className="text-muted-foreground">
            Stockfish board, difficulty selector and post-game analysis ship in
            the next iteration. The engine, schema and reward pipeline are
            already wired up end-to-end.
          </p>
        </div>
      </AuthGate>
    </Layout>
  );
}

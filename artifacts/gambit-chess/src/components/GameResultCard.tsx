
import Link from "@/lib/next-compat";
import { Button } from "@/components/ui/button";
import { Coins, Trophy, RotateCw, Sparkles } from "lucide-react";

type Props = {
  outcome: "win" | "loss" | "draw";
  reason: string;
  eloDelta: number;
  newElo: number;
  coinsEarned: number;
  newCoins: number;
  moveBonus?: number;
  onRematch?: () => void;
  analyzeHref?: string;
};

const TITLES: Record<Props["outcome"], string> = {
  win: "Victory",
  loss: "Defeat",
  draw: "Draw",
};

const COLORS: Record<Props["outcome"], string> = {
  win: "text-success",
  loss: "text-destructive",
  draw: "text-accent",
};

export function GameResultCard({
  outcome,
  reason,
  eloDelta,
  newElo,
  coinsEarned,
  newCoins,
  moveBonus = 0,
  onRematch,
  analyzeHref,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-elegant)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Game over</p>
          <h3 className={`text-3xl font-bold ${COLORS[outcome]}`}>{TITLES[outcome]}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
        </div>
        <Sparkles className={`h-8 w-8 ${COLORS[outcome]}`} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat
          icon={<Trophy className="h-4 w-4 text-accent" />}
          label="ELO"
          value={`${newElo}`}
          delta={eloDelta}
        />
        <Stat
          icon={<Coins className="h-4 w-4 text-accent" />}
          label="Coins"
          value={`${newCoins}`}
          delta={coinsEarned}
        />
      </div>

      {moveBonus > 0 && (
        <p className="mb-4 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
          +{moveBonus} bonus coins for high-quality moves
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {onRematch && (
          <Button variant="hero" onClick={onRematch}>
            <RotateCw className="h-4 w-4" /> Rematch
          </Button>
        )}
        {analyzeHref && (
          <Link href={analyzeHref}>
            <Button variant="outline">Analyze game</Button>
          </Link>
        )}
        <Link href="/">
          <Button variant="ghost">Home</Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number;
}) {
  const sign = delta > 0 ? "+" : "";
  const tone =
    delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="font-mono text-xl font-bold">{value}</div>
      <div className={`text-xs font-mono ${tone}`}>
        {sign}
        {delta}
      </div>
    </div>
  );
}

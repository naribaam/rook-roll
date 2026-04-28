type Props = {
  scoreCp: number | null; // from White's perspective
  mateIn: number | null;
};

/**
 * Vertical eval bar. White is bottom (advantage shown by more white).
 * Score is centipawns from White's perspective (positive = white better).
 */
export function EvalBar({ scoreCp, mateIn }: Props) {
  let whitePct = 50;
  let label = "0.0";

  if (mateIn !== null) {
    whitePct = mateIn > 0 ? 100 : 0;
    label = `M${Math.abs(mateIn)}`;
  } else if (scoreCp !== null) {
    // logistic map cp -> [0..100]
    const k = 0.004;
    const adv = 100 / (1 + Math.exp(-k * scoreCp));
    whitePct = Math.max(2, Math.min(98, adv));
    label = (scoreCp / 100).toFixed(1);
    if (scoreCp > 0) label = `+${label}`;
  }

  return (
    <div className="flex h-full w-6 flex-col overflow-hidden rounded-md border border-border bg-foreground md:w-7">
      <div
        className="bg-background transition-all duration-300"
        style={{ height: `${100 - whitePct}%` }}
      />
      <div
        className="flex items-end justify-center pb-1 text-[10px] font-mono font-bold text-foreground"
        style={{
          height: `${whitePct}%`,
          background:
            "linear-gradient(180deg, var(--background), color-mix(in oklab, var(--background) 80%, var(--accent)))",
        }}
      >
        {label}
      </div>
    </div>
  );
}
import { ScrollArea } from "@/components/ui/scroll-area";

type MoveItem = {
  san: string;
  quality?: "best" | "great" | "good" | "inaccuracy" | "mistake" | "blunder";
};

const QUALITY_COLOR: Record<NonNullable<MoveItem["quality"]>, string> = {
  best: "text-emerald-600",
  great: "text-emerald-500",
  good: "text-foreground",
  inaccuracy: "text-amber-500",
  mistake: "text-orange-500",
  blunder: "text-destructive",
};

const QUALITY_LABEL: Record<NonNullable<MoveItem["quality"]>, string> = {
  best: "★",
  great: "!",
  good: "",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};

export function MoveHistory({
  moves,
  activeIndex,
  onSelect,
}: {
  moves: MoveItem[];
  activeIndex?: number;
  onSelect?: (index: number) => void;
}) {
  // group into pairs
  const pairs: { num: number; white?: MoveItem; black?: MoveItem; wIdx?: number; bIdx?: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
      wIdx: i,
      bIdx: moves[i + 1] ? i + 1 : undefined,
    });
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">
        Moves
      </div>
      <ScrollArea className="h-72 md:h-[420px]">
        <ol className="divide-y divide-border text-sm font-mono">
          {pairs.length === 0 && (
            <li className="px-4 py-3 text-muted-foreground">No moves yet.</li>
          )}
          {pairs.map((p) => (
            <li key={p.num} className="grid grid-cols-[2.5rem_1fr_1fr] items-center px-3 py-1.5">
              <span className="text-muted-foreground">{p.num}.</span>
              <MoveCell
                move={p.white}
                index={p.wIdx}
                active={activeIndex === p.wIdx}
                onSelect={onSelect}
              />
              <MoveCell
                move={p.black}
                index={p.bIdx}
                active={activeIndex === p.bIdx}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ol>
      </ScrollArea>
    </div>
  );
}

function MoveCell({
  move,
  index,
  active,
  onSelect,
}: {
  move?: MoveItem;
  index?: number;
  active?: boolean;
  onSelect?: (i: number) => void;
}) {
  if (!move) return <span />;
  const color = move.quality ? QUALITY_COLOR[move.quality] : "text-foreground";
  const label = move.quality ? QUALITY_LABEL[move.quality] : "";
  return (
    <button
      type="button"
      onClick={() => index !== undefined && onSelect?.(index)}
      className={`rounded px-2 py-0.5 text-left transition-colors hover:bg-secondary ${
        active ? "bg-secondary font-semibold" : ""
      } ${color}`}
    >
      {move.san}
      {label && <span className="ml-1">{label}</span>}
    </button>
  );
}
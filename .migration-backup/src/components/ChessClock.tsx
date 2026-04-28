import { useEffect, useRef, useState } from "react";

type Props = {
  /** Remaining time in milliseconds */
  initialMs: number;
  /** Whether this clock is currently running */
  active: boolean;
  /** Called when clock reaches zero */
  onTimeout?: () => void;
  /** Show as low-time when under this many ms */
  lowTimeThresholdMs?: number;
};

function formatTime(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function ChessClock({ initialMs, active, onTimeout, lowTimeThresholdMs = 30_000 }: Props) {
  const [displayMs, setDisplayMs] = useState(initialMs);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMsRef = useRef<number>(initialMs);
  const startTimeRef = useRef<number>(Date.now());
  const timedOutRef = useRef(false);

  // Sync when initialMs changes from outside (e.g. after opponent's move)
  useEffect(() => {
    setDisplayMs(initialMs);
    startMsRef.current = initialMs;
    startTimeRef.current = Date.now();
    timedOutRef.current = false;
  }, [initialMs]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!active) return;

    startTimeRef.current = Date.now();
    startMsRef.current = displayMs;

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = startMsRef.current - elapsed;
      if (remaining <= 0) {
        setDisplayMs(0);
        if (!timedOutRef.current) {
          timedOutRef.current = true;
          onTimeout?.();
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        setDisplayMs(remaining);
      }
    }, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  const isLow = displayMs > 0 && displayMs < lowTimeThresholdMs;
  const isEmpty = displayMs <= 0;

  return (
    <div
      className={`flex items-center justify-center rounded-xl border px-4 py-2 font-mono text-2xl font-bold tabular-nums transition-colors ${
        isEmpty
          ? "border-destructive bg-destructive text-destructive-foreground"
          : isLow
            ? "border-warning/60 bg-warning/10 text-warning animate-pulse"
            : active
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground"
      }`}
    >
      {formatTime(displayMs)}
    </div>
  );
}

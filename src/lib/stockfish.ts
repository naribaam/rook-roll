/* Stockfish WASM wrapper (single-threaded, lite).
 * Uses a Web Worker spawned from /stockfish/stockfish.js (in /public).
 */

export type AnalysisResult = {
  bestMove: string | null;
  scoreCp: number | null; // centipawns from current side to move's perspective
  mateIn: number | null;
};

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private listeners: ((line: string) => void)[] = [];

  async init(skillLevel = 10) {
    if (typeof window === "undefined") return;
    if (this.worker) return;
    this.worker = new Worker("/stockfish/stockfish.js");
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";
      for (const l of this.listeners) l(line);
    };
    await this.send("uci", (l) => l === "uciok");
    await this.send(
      `setoption name Skill Level value ${Math.max(0, Math.min(20, skillLevel))}`,
    );
    await this.send("isready", (l) => l === "readyok");
    this.ready = true;
  }

  setSkill(level: number) {
    this.post(
      `setoption name Skill Level value ${Math.max(0, Math.min(20, level))}`,
    );
  }

  isReady() {
    return this.ready;
  }

  private post(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private send(cmd: string, until?: (line: string) => boolean) {
    return new Promise<void>((resolve) => {
      if (!until) {
        this.post(cmd);
        resolve();
        return;
      }
      const handler = (line: string) => {
        if (until(line)) {
          this.listeners = this.listeners.filter((l) => l !== handler);
          resolve();
        }
      };
      this.listeners.push(handler);
      this.post(cmd);
    });
  }

  /** Get best move + evaluation from given fen */
  analyze(fen: string, depth = 12): Promise<AnalysisResult> {
    return new Promise((resolve) => {
      let lastScore: number | null = null;
      let lastMate: number | null = null;
      const handler = (line: string) => {
        if (line.startsWith("info")) {
          const mateMatch = line.match(/score mate (-?\d+)/);
          const cpMatch = line.match(/score cp (-?\d+)/);
          if (mateMatch) {
            lastMate = parseInt(mateMatch[1], 10);
            lastScore = lastMate > 0 ? 100000 : -100000;
          } else if (cpMatch) {
            lastScore = parseInt(cpMatch[1], 10);
            lastMate = null;
          }
        } else if (line.startsWith("bestmove")) {
          const parts = line.split(" ");
          const best = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
          this.listeners = this.listeners.filter((l) => l !== handler);
          resolve({ bestMove: best, scoreCp: lastScore, mateIn: lastMate });
        }
      };
      this.listeners.push(handler);
      this.post("ucinewgame");
      this.post(`position fen ${fen}`);
      this.post(`go depth ${depth}`);
    });
  }

  stop() {
    this.post("stop");
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.listeners = [];
  }
}

let _global: StockfishEngine | null = null;
export function getEngine(): StockfishEngine {
  if (!_global) _global = new StockfishEngine();
  return _global;
}

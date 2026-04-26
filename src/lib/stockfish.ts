/* Stockfish engine via Web Worker from CDN.
 * Uses stockfish.js from jsDelivr CDN — no local WASM files needed.
 * Safe for Vercel deployment (no .wasm bundling issues).
 */

export type AnalysisResult = {
  bestMove: string | null;
  scoreCp: number | null;
  mateIn: number | null;
};

export type StockfishInstance = {
  send: (command: string) => void;
  onMessage: (callback: (line: string) => void) => () => void;
  destroy: () => void;
};

const STOCKFISH_CDN_URL =
  "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

export function createStockfish(): StockfishInstance {
  const worker = new Worker(STOCKFISH_CDN_URL);
  const listeners: ((line: string) => void)[] = [];

  worker.onmessage = (e: MessageEvent) => {
    const line = typeof e.data === "string" ? e.data : "";
    if (line) {
      for (const l of listeners) l(line);
    }
  };

  return {
    send(command: string) {
      worker.postMessage(command);
    },
    onMessage(callback: (line: string) => void) {
      listeners.push(callback);
      return () => {
        const idx = listeners.indexOf(callback);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },
    destroy() {
      worker.terminate();
      listeners.length = 0;
    },
  };
}

export class StockfishEngine {
  private sf: StockfishInstance | null = null;
  private ready = false;
  private listeners: ((line: string) => void)[] = [];

  async init(skillLevel = 10) {
    if (typeof window === "undefined") return;
    if (this.sf) {
      await this.send("isready", (l) => l === "readyok");
      return;
    }

    this.sf = createStockfish();

    this.sf.onMessage((line) => {
      for (const l of this.listeners) l(line);
    });

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
    this.sf?.send(cmd);
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
    this.sf?.destroy();
    this.sf = null;
    this.ready = false;
    this.listeners = [];
  }
}

let _global: StockfishEngine | null = null;
export function getEngine(): StockfishEngine {
  if (!_global) _global = new StockfishEngine();
  return _global;
}

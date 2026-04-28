/* Stockfish engine running entirely from the public CDN.
 *
 * No local /public/stockfish assets, no .wasm files, no WebAssembly.instantiate.
 * We bootstrap a Web Worker from a tiny inline blob that imports the official
 * stockfish.js build from jsDelivr. This works on Vercel (or any static host)
 * without shipping any binary, and avoids the "expected wasm magic word" /
 * 404 issues entirely.
 */

export type AnalysisResult = {
  bestMove: string | null;
  scoreCp: number | null;
  mateIn: number | null;
};

const STOCKFISH_CDN_URL =
  "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

function createWorker(): Worker {
  // The worker code runs in its own scope; importScripts pulls in Stockfish
  // from the CDN and wires its own postMessage to the parent.
  const bootstrap = `
    self.importScripts(${JSON.stringify(STOCKFISH_CDN_URL)});
    // stockfish.js attaches an STOCKFISH() factory or self-postMessage already.
    // Newer builds expose STOCKFISH() returning an engine object with onmessage / postMessage.
    if (typeof STOCKFISH === "function") {
      const engine = STOCKFISH();
      engine.onmessage = function (line) { self.postMessage(line); };
      self.onmessage = function (e) { engine.postMessage(e.data); };
    }
    // Older builds already use self.postMessage / self.onmessage directly,
    // in which case nothing else to do.
  `;
  const blob = new Blob([bootstrap], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private listeners: ((line: string) => void)[] = [];
  private ready = false;

  async init(skillLevel = 10) {
    if (typeof window === "undefined") return;
    if (this.worker) {
      await this.send("isready", (l) => l === "readyok");
      return;
    }

    this.worker = createWorker();
    this.worker.onmessage = (e: MessageEvent) => {
      const line = typeof e.data === "string" ? e.data : "";
      if (!line) return;
      for (const l of this.listeners) l(line);
    };
    this.worker.onerror = (err) => {
      console.error("Stockfish worker error", err);
    };

    await this.send("uci", (l) => l === "uciok");
    this.post(
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

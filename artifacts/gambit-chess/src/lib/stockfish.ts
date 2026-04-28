/* Stockfish engine running entirely from the public CDN.
 *
 * No local /public/stockfish assets, no .wasm files, no WebAssembly.instantiate.
 * We bootstrap a Web Worker from a tiny inline blob that imports the official
 * stockfish.js build from jsDelivr. This works on any static host without
 * shipping a binary, and avoids the "expected wasm magic word" / 404 issues.
 *
 * Two engine instances are exposed:
 *  - getEngine()     — used for the AI opponent's actual moves
 *  - getEvalEngine() — used to power the eval bar / position evaluation
 * They run as separate Web Workers so eval updates never fight with the AI.
 */

export type AnalysisResult = {
  bestMove: string | null;
  scoreCp: number | null;
  mateIn: number | null;
};

const STOCKFISH_CDN_URL =
  "https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js";

function createWorker(): Worker {
  const bootstrap = `
    self.importScripts(${JSON.stringify(STOCKFISH_CDN_URL)});
    if (typeof STOCKFISH === "function") {
      const engine = STOCKFISH();
      engine.onmessage = function (line) { self.postMessage(line); };
      self.onmessage = function (e) { engine.postMessage(e.data); };
    }
  `;
  const blob = new Blob([bootstrap], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

export class StockfishEngine {
  private worker: Worker | null = null;
  private listeners: ((line: string) => void)[] = [];
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private currentSkill = 10;
  // Serializes analyze() calls so we never overlap UCI commands on the worker.
  private analysisQueue: Promise<unknown> = Promise.resolve();

  init(skillLevel = 10): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (this.ready) {
      if (skillLevel !== this.currentSkill) this.setSkill(skillLevel);
      return Promise.resolve();
    }
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      this.worker = createWorker();
      this.worker.onmessage = (e: MessageEvent) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (!line) return;
        // Iterate over a snapshot so handlers can remove themselves safely.
        for (const l of [...this.listeners]) l(line);
      };
      this.worker.onerror = (err) => {
        console.error("Stockfish worker error", err);
      };

      await this.send("uci", (l) => l === "uciok");
      this.currentSkill = Math.max(0, Math.min(20, skillLevel));
      this.post(`setoption name Skill Level value ${this.currentSkill}`);
      await this.send("isready", (l) => l === "readyok");
      this.ready = true;
    })();

    return this.initPromise;
  }

  setSkill(level: number) {
    this.currentSkill = Math.max(0, Math.min(20, level));
    this.post(`setoption name Skill Level value ${this.currentSkill}`);
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

  async analyze(fen: string, depth = 12): Promise<AnalysisResult> {
    // Wait for any in-flight analyze to complete first so we never interleave
    // UCI commands on the same worker.
    const prev = this.analysisQueue;
    let release: () => void = () => {};
    const next = new Promise<void>((r) => {
      release = r;
    });
    this.analysisQueue = next;
    try {
      await prev;
    } catch {
      // ignore upstream errors
    }

    try {
      if (!this.ready) await this.init(this.currentSkill);
      return await this._runAnalysis(fen, depth);
    } finally {
      release();
    }
  }

  private _runAnalysis(fen: string, depth: number): Promise<AnalysisResult> {
    return new Promise((resolve) => {
      let lastScore: number | null = null;
      let lastMate: number | null = null;
      let settled = false;
      const safeDepth = Math.max(1, Math.min(22, Math.floor(depth)));

      const cleanup = () => {
        this.listeners = this.listeners.filter((l) => l !== handler);
      };

      const finish = (best: string | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        clearTimeout(timer);
        resolve({ bestMove: best, scoreCp: lastScore, mateIn: lastMate });
      };

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
          finish(best);
        }
      };

      this.listeners.push(handler);
      this.post("ucinewgame");
      this.post(`position fen ${fen}`);
      this.post(`go depth ${safeDepth}`);

      // Hard timeout safeguard so the UI never freezes if the worker dies.
      const timer = setTimeout(() => {
        if (settled) return;
        this.post("stop");
        // Give Stockfish a tiny window to emit its bestmove after `stop`,
        // otherwise resolve with whatever info we've accumulated.
        setTimeout(() => finish(null), 200);
      }, Math.max(2000, safeDepth * 800));
    });
  }

  stop() {
    this.post("stop");
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
    this.listeners = [];
    this.analysisQueue = Promise.resolve();
  }
}

let _global: StockfishEngine | null = null;
let _eval: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  if (!_global) _global = new StockfishEngine();
  return _global;
}

export function getEvalEngine(): StockfishEngine {
  if (!_eval) _eval = new StockfishEngine();
  return _eval;
}

// Stockfish worker bootstrapper.
// Ensures the .wasm resolves relative to this worker URL ("/stockfish/...").
/* eslint-disable no-restricted-globals */
self.Module = {
  locateFile(path) {
    return new URL(path, self.location.href).toString();
  },
};

importScripts("./stockfish.js");


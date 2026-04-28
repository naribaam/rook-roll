// Standard Elo with K-factor based on rating
export function kFactor(elo: number) {
  if (elo < 1400) return 32;
  if (elo < 2000) return 24;
  return 16;
}

export function expectedScore(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

// score: 1 win, 0.5 draw, 0 loss
export function newElo(player: number, opponent: number, score: number) {
  const k = kFactor(player);
  const exp = expectedScore(player, opponent);
  return Math.round(player + k * (score - exp));
}

export function eloDelta(player: number, opponent: number, score: number) {
  return newElo(player, opponent, score) - player;
}

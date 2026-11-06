// Lobby seating: room.players order = seat order (seat 1 = index 0 = host).
// Players ask each other to swap; the host can swap any two non-host seats directly.

const idx = (r, id) => r.players.findIndex(p => p.id === id);

/** Seat 1 always belongs to the host. */
export function keepHostFirst(r) {
  const i = idx(r, r.hostId);
  if (i > 0) r.players.unshift(...r.players.splice(i, 1));
  r.swaps = (r.swaps || []).filter(s => idx(r, s.from) > 0 && idx(r, s.to) > 0);
  return r;
}

function swap(r, a, b) {
  const i = idx(r, a);
  const j = idx(r, b);
  if (i <= 0 || j <= 0 || i === j) throw new Error('1 号是房主的位置，不能换');
  [r.players[i], r.players[j]] = [r.players[j], r.players[i]];
  r.swaps = (r.swaps || []).filter(s => ![a, b].includes(s.from) && ![a, b].includes(s.to));
}

export function requestSwap(r, from, to) {
  if (r.phase !== 'lobby') throw new Error('游戏开始后不能换位');
  if (idx(r, from) <= 0 || idx(r, to) <= 0) throw new Error('1 号是房主的位置，不能换');
  r.swaps = (r.swaps || []).filter(s => s.from !== from);
  r.swaps.push({ from, to, at: Date.now() });
  // bots say yes straight away
  if (r.players[idx(r, to)].isBot) swap(r, from, to);
  return r;
}

export function answerSwap(r, to, from, accept) {
  const req = (r.swaps || []).find(s => s.from === from && s.to === to);
  if (!req) return r; // already withdrawn / handled
  if (accept) swap(r, from, to);
  else r.swaps = r.swaps.filter(s => s !== req);
  return r;
}

export function cancelSwap(r, from) {
  r.swaps = (r.swaps || []).filter(s => s.from !== from);
  return r;
}

export function hostSwap(r, a, b) {
  swap(r, a, b);
  return r;
}

export const pendingFrom = (room, id) => (room.swaps || []).find(s => s.from === id && room.players.some(p => p.id === s.to));
export const pendingTo = (room, id) => (room.swaps || []).filter(s => s.to === id && room.players.some(p => p.id === s.from));

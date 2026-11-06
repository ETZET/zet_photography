// Browser-side helper for the 升级 Playwright specs (served by the Vite dev server).
// Puts the shared local room into an exact game state so every screen can be
// captured deterministically.
import * as R from '/src/games/shengji/shengjiRules.js';
import { roomStore } from '/src/games/avalon/roomStore.js';

/** Build a 108-card deck so seat i is dealt hands[i] first (rest random), kitty last. */
export function deckFor(hands = [[], [], [], []], kitty = [], voids = {}) {
  const used = new Set([...hands.flat(), ...kitty]);
  const rest = R.shuffle(R.newDeck().filter(c => !used.has(c)));
  const full = [0, 1, 2, 3].map(i => [...(hands[i] || [])]);
  // seats with a void get filled first, from cards outside that suit (jokers / level cards count as trump)
  const order = [0, 1, 2, 3].sort((a, b) => (b in voids) - (a in voids));
  order.forEach(i => {
    const h = full[i];
    while (h.length < 25) {
      const j = rest.findIndex(c => !(i in voids) || (c[0] !== voids[i] && c[0] !== 'X' && c[1] !== '2'));
      h.push(rest.splice(j, 1)[0]);
    }
  });
  const k = [...kitty];
  while (k.length < 8) k.push(rest.pop());
  const deck = [];
  for (let i = 0; i < 25; i++) for (let s = 0; s < 4; s++) deck.push(full[s][i]);
  return [...deck, ...k];
}

/**
 * spec: { hands, kitty, rules, levels, dealer, dealt (freeze the deal at k cards), then (code run with R, g, ids) }
 */
export async function stage({ hands, kitty, voids, rules = {}, levels, dealer = null, hand = 1, dealt = null, timeScale = 0.05, then = '' }) {
  const code = window.__room.code;
  await roomStore.update(code, r => {
    const ids = r.players.map(p => p.id);
    const g = R.newGame(r.players, { rules: { ...R.DEFAULT_RULES, ...rules }, timeScale });
    if (levels) g.levels = [...levels];
    g.dealer = dealer;
    g.hand = hand - 1;
    if (dealt != null) g.timeScale = 1000; // frozen: one card every 280 s
    R.startHand(g, { deck: deckFor(hands, kitty, voids) });
    if (dealt != null) g.dealStart = Date.now() - (dealt - 1) * R.dealMs(g) - 5;
    if (then) new Function('R', 'g', 'ids', then)(R, g, ids);
    r.phase = 'game';
    r.game = g;
    r.round = (r.round || 1) + 1;
    return r;
  });
}

export { R };

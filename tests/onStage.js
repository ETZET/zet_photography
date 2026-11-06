// Browser-side helper for tests/onenight-gallery.spec.ts (served by the Vite dev
// server). Puts the shared local room into an exact 一夜狼 game state so every
// screen can be captured deterministically.
import * as R from '/src/games/onenight/onenightRules.js';
import { roomStore } from '/src/games/avalon/roomStore.js';

/**
 * cards: dealt cards in seat order; center: the 3 center cards; rules: variant overrides;
 * then: JS run with (R, g, ids) to drive the engine; ago: ms the night started before now.
 */
export async function stage({ cards, center, rules = {}, then = '', ago = 0, timeScale = 0.03 }) {
  const code = window.__room.code;
  await roomStore.update(code, r => {
    const ids = r.players.map(p => p.id);
    const deck = [...cards, ...center];
    const g = R.newGame(r.players, { counts: R.countsOf(deck), rules: { ...R.DEFAULT_RULES, ...rules }, timeScale }, Date.now() - ago);
    g.start = Object.fromEntries(ids.map((id, i) => [id, cards[i]]));
    g.center0 = [...center];
    if (then) new Function('R', 'g', 'ids', then)(R, g, ids);
    r.phase = 'game';
    r.game = g;
    r.round = (r.round || 1) + 1; // fresh overlay keys
    return r;
  });
}

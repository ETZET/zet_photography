// Browser-side helper for the 掼蛋 tests (served by the Vite dev server):
// puts the shared local room into an exact game state.
import * as R from '/src/games/guandan/guandanRules.js';
import { roomStore } from '/src/games/avalon/roomStore.js';

// 'S5' 'H10' 'DA' 'LJ'(小王) 'BJ'(大王); 'SK#2' or a repeated token = the second deck's copy
const SUIT = { S: 0, H: 1, C: 2, D: 3 };
const RV = { J: 11, Q: 12, K: 13, A: 14 };
export function cards(str) {
  const used = new Set();
  return str.trim().split(/\s+/).map(tok => {
    const [t, deck] = tok.split('#');
    let c = t === 'LJ' ? 52 : t === 'BJ' ? 53 : SUIT[t[0]] * 13 + ((RV[t.slice(1)] || Number(t.slice(1))) - 2);
    if (deck === '2' || used.has(c)) c += 54;
    used.add(c);
    return c;
  });
}

/**
 * rules: variant overrides; hands: 4 strings (seat order) — the rest of the deck
 * is dealt to fill up to `size` cards each (default: exactly what's given);
 * then: JS run with (R, g, C) after setup; intro: keep the deal animation.
 */
export async function stage({ rules = {}, hands = null, fill = 0, then = '', intro = false, level = null, levels = null }) {
  const code = window.__room.code;
  await roomStore.update(code, r => {
    const g = R.newGame(r.players, { ...R.DEFAULT_RULES, ...rules });
    if (levels) { g.levels = levels; }
    if (level != null) g.level = level;
    if (hands) {
      const given = hands.map(h => (h ? cards(h) : []));
      const usedAll = new Set(given.flat());
      const rest = R.shuffled().filter(c => !usedAll.has(c));
      g.hands = given.map(h => { while (h.length < fill) h.push(rest.pop()); return h; });
    }
    if (then) new Function('R', 'g', 'C', then)(R, g, cards);
    if (!intro) g.dealtAt = 0;
    r.phase = 'game';
    r.game = g;
    r.round = (r.round || 1) + 1;
    return r;
  });
}

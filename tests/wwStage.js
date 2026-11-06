// Browser-side helper for tests/werewolf-gallery.spec.ts (served by the Vite dev
// server). Puts the shared local room into an exact 双身份狼人 game state so
// every screen can be captured deterministically.
import * as R from '/src/games/werewolf/wolfRules.js';
import { roomStore } from '/src/games/avalon/roomStore.js';

/** hands: card pairs in seat order; rules: variant overrides; then(g, ids) drives the engine. */
export async function stage({ hands, rules = {}, lock = true, then = '' }) {
  const code = window.__room.code;
  await roomStore.update(code, r => {
    const ids = r.players.map(p => p.id);
    const fullRules = { ...R.DEFAULT_RULES, ...rules };
    const cfg = R.effectiveConfig(ids.length, { auto: true, rules: fullRules });
    const g = R.newGame(r.players, { ...cfg, rules: { ...fullRules, order: 'choose' }, timeScale: 0.03 });
    g.rules = fullRules;
    g.seats = ids;
    ids.forEach((id, i) => { g.hands[id] = { cards: hands[i], locked: false }; g.dead[id] = 0; });
    g.goodGodsAtStart = R.score(g).gods;
    if (lock) ids.forEach(id => R.lockCards(g, id));
    // eslint-disable-next-line no-new-func
    if (then) new Function('R', 'g', 'ids', then)(R, g, ids);
    r.phase = 'game';
    r.game = g;
    r.round = (r.round || 1) + 1; // fresh overlay keys
    return r;
  });
}

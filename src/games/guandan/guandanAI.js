// Simple, legal 掼蛋 strategy shared by the dev bots and the node fuzz test.
// Lead the cheapest thing that dumps cards, beat with the smallest combo,
// don't beat your partner, bomb only when it matters.
import { findPlays, isBomb, partnerOf, teamOf, tributeTask, tributeChoices, returnChoices, cardLv, play, pass, payTribute, returnTribute } from './guandanRules.js';

/** Decide one action for seat s: { kind: 'play', cards, type } | { kind: 'pass' } | { kind: 'pay'|'back', card } | null. */
export function decide(g, s, rng = Math.random) {
  const task = tributeTask(g, s);
  if (task === 'pay') return { kind: 'pay', card: tributeChoices(g, s)[0] };
  if (task === 'back') {
    const opts = returnChoices(g, s).sort((a, b) => cardLv(a, g.level) - cardLv(b, g.level));
    return { kind: 'back', card: opts[0] };
  }
  if (g.step !== 'play' || g.turn !== s) return null;
  const hand = g.hands[s];
  const top = g.table?.combo || null;
  const plays = findPlays(hand, g.level, top);
  const finisher = plays.find(p => p.cards.length === hand.length);
  if (finisher) return { kind: 'play', cards: finisher.cards, type: finisher.combo.type };

  if (!top) {
    // leading: prefer long combos that shed cards, then the smallest single/pair/triple
    const plain = plays.filter(p => !isBomb(p.combo));
    const pool = plain.length ? plain : plays;
    const scored = pool.map(p => ({ p, v: p.cost - p.cards.length * 6 + rng() * 6 }));
    scored.sort((a, b) => a.v - b.v);
    const pick = scored[0].p;
    return { kind: 'play', cards: pick.cards, type: pick.combo.type };
  }

  const owner = g.table.s;
  if (teamOf(owner) === teamOf(s) && owner !== s) {
    // partner is winning the trick: let it ride (unless partner is out and this is cheap)
    return { kind: 'pass' };
  }
  const plain = plays.filter(p => !isBomb(p.combo));
  if (plain.length && (plain[0].cost < 60 || rng() < 0.5)) {
    if (rng() < 0.9) return { kind: 'play', cards: plain[0].cards, type: plain[0].combo.type };
  }
  const bombs = plays.filter(p => isBomb(p.combo));
  const danger = g.hands[owner].length <= 6 || hand.length <= 8 || g.hands[partnerOf(s)].length === 0;
  if (bombs.length && (danger || rng() < 0.15)) return { kind: 'play', cards: bombs[0].cards, type: bombs[0].combo.type };
  if (plain.length && rng() < 0.3) return { kind: 'play', cards: plain[0].cards, type: plain[0].combo.type };
  return { kind: 'pass' };
}

/** Apply a decision to g (throws on illegal moves, like a human would get). */
export function apply(g, s, d) {
  if (!d) return false;
  if (d.kind === 'pay') payTribute(g, s, d.card);
  else if (d.kind === 'back') returnTribute(g, s, d.card);
  else if (d.kind === 'play') play(g, s, d.cards, d.type);
  else pass(g, s);
  return true;
}

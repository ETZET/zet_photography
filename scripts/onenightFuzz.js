/* global process */
// 一夜狼 fuzz + rough balance check (offline). Plays thousands of random bot
// games through the pure engine and checks invariants; then prints win rate by
// side for every default preset.
//
//   node scripts/onenightFuzz.js            # 20 000 fuzz games + 2 000 per preset
//   node scripts/onenightFuzz.js 5000 500
import * as R from '../src/games/onenight/onenightRules.js';
import { botNightPick, botVote } from '../src/games/onenight/bots.js';

const FUZZ = Number(process.argv[2] || 20000);
const PER = Number(process.argv[3] || 2000);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261106);
Math.random = rnd; // the engine shuffles with Math.random
const pick = a => a[Math.floor(rnd() * a.length)];
const shuffled = a => [...a].sort(() => rnd() - 0.5);

function check(cond, msg, g) { if (!cond) { const e = new Error(msg); e.game = g; throw e; } }

/** Plays one game through the engine and re-checks every rule independently. */
function play(n, cfg, { chaos = false } = {}) {
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
  let now = 1_000_000;
  const g = R.newGame(players, { ...cfg, timeScale: 1 }, now);
  check(g.deck.length === n + 3 && g.center0.length === 3, 'deck size', g);
  for (const id of shuffled(g.seats)) {
    now += Math.floor(rnd() * 5000);
    if (chaos && rnd() < 0.1) {
      // illegal moves must throw and leave the state alone
      const before = JSON.stringify(g);
      let threw = false;
      try { R.nightAct(g, id, { players: [id, id], center: [9] }, now); } catch { threw = true; }
      check(threw && JSON.stringify(g) === before, 'illegal pick accepted', g);
    }
    if (chaos && rnd() < 0.03) continue; // a phone falls asleep: the host forces dawn later
    R.nightAct(g, id, botNightPick(g, id, rnd), now);
  }
  if (!g.final) {
    check(!R.settleNight(g, now + 1e9), 'settled with missing acts', g);
    let threw = false;
    try { R.forceNight(g, g.nightStart + 1000); } catch { threw = true; }
    check(threw, 'forced dawn too early', g);
    now = g.nightStart + R.forceAfterMs(g);
    R.forceNight(g, now);
  } else {
    check(!R.settleNight(g, g.settleAt - 1), 'dawn before settleAt', g);
    check(g.settleAt >= g.nightStart + R.nightMinMs(g), 'night shorter than minimum', g);
    now = g.settleAt;
    check(R.settleNight(g, now), 'dawn did not come', g);
  }
  check(g.step === 'day', 'not day after night', g);
  // card conservation: the multiset of cards never changes
  const all = [...Object.values(g.final.cards), ...g.final.center].sort();
  check(JSON.stringify(all) === JSON.stringify([...g.deck].sort()), 'cards not conserved', g);
  // sequential replay by hand: thief → meddler → drunk
  const cards = { ...g.start };
  const center = [...g.center0];
  const by = r => g.seats.find(id => g.start[id] === r);
  const live = r => by(r) && g.acts[by(r)] && !g.acts[by(r)].skipped;
  if (live('thief')) { const h = by('thief'); const x = g.acts[h].players[0]; [cards[h], cards[x]] = [cards[x], cards[h]]; }
  if (live('meddler')) { const [x, y] = g.acts[by('meddler')].players; [cards[x], cards[y]] = [cards[y], cards[x]]; }
  if (live('drunk')) { const h = by('drunk'); const i = g.acts[h].center[0]; [cards[h], center[i]] = [center[i], cards[h]]; }
  check(JSON.stringify(cards) === JSON.stringify(g.final.cards) && JSON.stringify(center) === JSON.stringify(g.final.center), 'swap order wrong', g);
  for (const id of g.seats) {
    const info = R.nightInfo(g, id, now);
    const owl = info.find(x => x.k === 'owl');
    if (g.start[id] === 'owl' && g.acts[id] && !g.acts[id].skipped) check(owl && owl.card === cards[id], 'owl saw wrong card', g);
    const st = info.find(x => x.k === 'stole');
    if (st) check(st.card === g.start[st.id], 'thief saw wrong card', g);
  }
  if (rnd() < 0.3) R.addTalk(g, 60_000, now);
  R.startVote(g);
  const voters = shuffled(g.seats);
  for (const [i, id] of voters.entries()) {
    if (chaos && i === voters.length - 1 && i > 0 && rnd() < 0.1) { R.closeVote(g); break; }
    R.castVote(g, id, botVote(g, id, { rnd }));
  }
  check(g.step === 'end' && g.result, 'no result', g);
  const r = g.result;
  const fc = id => g.final.cards[id];
  // re-derive who is out
  const counts = {};
  Object.values(g.votes).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  const max = Math.max(0, ...Object.values(counts));
  const top = g.seats.filter(id => counts[id] === max);
  const expOut = max >= 2 && (top.length === 1 || g.rules.tie === 'all') ? [...top] : [];
  for (const h of [...expOut]) if (fc(h) === 'hunter' && g.votes[h] && g.votes[h] !== h && !expOut.includes(g.votes[h])) expOut.push(g.votes[h]);
  check(JSON.stringify([...expOut].sort()) === JSON.stringify([...r.out].sort()), 'out mismatch', g);
  const wolfOut = r.out.some(id => fc(id) === 'wolf');
  const lonerOut = r.out.some(id => fc(id) === 'loner');
  const wolvesIn = g.seats.some(id => fc(id) === 'wolf');
  if (wolvesIn) {
    check(r.winners.includes('village') === wolfOut, 'village win wrong', g);
    check(r.winners.includes('wolf') === (!wolfOut && !lonerOut), 'wolf win wrong', g);
  } else {
    check(r.winners.includes('village') === r.out.every(id => fc(id) === 'minion'), 'no-wolf village win wrong', g);
  }
  check(r.winners.includes('loner') === lonerOut, 'loner win wrong', g);
  check(!(r.winners.includes('wolf') && r.winners.includes('village')), 'both teams won', g);
  R.nightStory(g); // must not throw
  return g;
}

/** A random legal DIY deck of exactly `size` cards. */
function randomCounts(size) {
  const counts = {};
  let have = 0;
  let guard = 0;
  while (have < size && guard++ < 500) {
    const id = pick(R.ROLE_IDS);
    const add = R.ROLES[id].pair ? 2 : 1;
    if ((counts[id] || 0) + add > R.ROLES[id].max || have + add > size) continue;
    counts[id] = (counts[id] || 0) + add;
    have += add;
  }
  return have === size ? counts : null;
}

// ------------------------------------------------------------ fuzz ---
let errors = 0;
let stuck = 0;
let played = 0;
const t0 = Date.now();
while (played < FUZZ) {
  const n = R.MIN_PLAYERS + Math.floor(rnd() * (R.MAX_PLAYERS - R.MIN_PLAYERS + 1));
  const cfg = rnd() < 0.5 ? { board: pick(R.BOARDS).id, rules: {} } : { counts: randomCounts(n + 3), rules: {} };
  if ('counts' in cfg && !cfg.counts) continue;
  for (const v of R.VARIANTS) cfg.rules[v.key] = pick(v.opts)[0];
  played += 1;
  try {
    const g = play(n, cfg, { chaos: true });
    if (g.step !== 'end') stuck += 1;
  } catch (e) {
    errors += 1;
    if (errors <= 5) console.error('ERROR', e.message, e.game ? JSON.stringify(e.game).slice(0, 800) : e.stack);
  }
}
console.log(`fuzz: ${played} random games (3–10 players, random decks + variants, illegal moves, sleeping phones) in ${Date.now() - t0} ms → ${stuck} stuck, ${errors} errors`);

// ------------------------------------------------------------ balance ---
console.log(`\nwin rate by side, default rules, ${PER} games per row`);
console.log('(bots: random night picks; seer votes a wolf it saw; village bots read a real wolf 30% of the time)');
console.log('board          n  village  wolves  loner   none  no-wolf-in-play');
for (const b of R.BOARDS) {
  for (let n = R.MIN_PLAYERS; n <= R.MAX_PLAYERS; n++) {
    const w = { village: 0, wolf: 0, loner: 0, none: 0 };
    let noWolf = 0;
    for (let i = 0; i < PER; i++) {
      const g = play(n, { board: b.id, rules: {} });
      g.result.winners.forEach(x => { w[x] += 1; });
      if (!g.result.winners.length) w.none += 1;
      if (!g.seats.some(id => g.final.cards[id] === 'wolf')) noWolf += 1;
    }
    const p = x => `${((100 * x) / PER).toFixed(0)}%`.padStart(6);
    console.log(`${b.id.padEnd(12)} ${String(n).padStart(2)} ${p(w.village)}  ${p(w.wolf)} ${p(w.loner)} ${p(w.none)}  ${p(noWolf)}`);
  }
}
process.exit(errors || stuck ? 1 : 0);

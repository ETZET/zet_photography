/* global process */
// 掼蛋 engine tests: combo detection edge cases + a bot fuzz.
//   node scripts/guandanTest.js [games=400]
import * as R from '../src/games/guandan/guandanRules.js';
import { decide, apply } from '../src/games/guandan/guandanAI.js';

let fails = 0;
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.error('FAIL', msg); } };

// card builder: 'S5' 'HA' 'C10' 'DK' 'LJ'(小王) 'BJ'(大王); '#2' suffix = second deck
const SUIT = { S: 0, H: 1, C: 2, D: 3 };
const RV = { J: 11, Q: 12, K: 13, A: 14 };
function card(t) {
  const [name, d] = t.split('#');
  const deck = d ? 54 : 0;
  if (name === 'LJ') return 52 + deck;
  if (name === 'BJ') return 53 + deck;
  const s = SUIT[name[0]];
  const rs = name.slice(1);
  const r = RV[rs] || Number(rs);
  return deck + s * 13 + (r - 2);
}
const cs = str => { const seen = {}; return str.split(' ').map(t => { const c = card(t); const k = seen[c] ? `${t}#2` : t; seen[c] = 1; return card(k); }); };
const types = (str, level) => R.combosOf(cs(str), level).map(c => `${c.type}${c.type === 'bomb' ? c.n : ''}:${c.key}`).sort().join(',');
const expect = (str, level, want, msg) => { const got = types(str, level); ok(got === want, `${msg || str} @${level}: got [${got}] want [${want}]`); };

// ---- basics (level 2: ♥2 is wild)
expect('S5', 2, 'single:5');
expect('S2', 2, 'single:15', 'level card single = level slot');
expect('H2', 2, 'single:15', 'wild single = level card');
expect('BJ', 2, 'single:17');
expect('S5 D5', 2, 'pair:5');
expect('S5 H2', 2, 'pair:5', 'wild pairs any card');
expect('H2 H2', 2, 'pair:15', 'two wilds = pair of level cards');
expect('LJ LJ', 2, 'pair:16');
expect('LJ BJ', 2, '', 'small + big joker is no pair');
expect('BJ H2', 2, '', 'wild cannot be a joker');
expect('S7 D7 C7', 2, 'triple:7');
expect('S7 D7 H2', 2, 'triple:7');
expect('S7 D7 C7 S9 D9', 2, 'full:7');
expect('S7 D7 C7 LJ LJ', 2, 'full:7', 'joker pair in 三带二');
expect('S7 D7 H2 S9 H2', 2, 'full:9', 'wilds: best reading 99+9 over 777');
// ---- straights, A low/high
expect('SA D2 C3 S4 D5', 3, 'straight:5', 'A2345 (level 3 card in natural place)');
expect('S10 DJ CQ SK DA', 2, 'straight:14');
expect('SJ DQ CK SA D2', 5, '', 'no wrap-around JQKA2');
expect('S3 D4 C5 S6 H2', 2, 'straight:7', 'wild fills the top');
expect('S3 D4 C5 H2 H2', 2, 'straight:7', 'two wilds: best window 34567');
expect('S3 S4 S5 S6 S7', 2, 'sf:7', 'natural flush is only a 同花顺');
expect('S3 S4 S5 S6 H2', 2, 'sf:7,straight:7', 'wild flush: both readings');
expect('SA S2 S3 S4 S5', 9, 'sf:5', 'A-low straight flush');
expect('S10 SJ SQ SK SA', 9, 'sf:14');
expect('SJ SQ SK SA S2', 9, '', 'no wrap straight flush');
// ---- tubes / plates
expect('SA DA S2 D2 S3 D3', 5, 'tube:3', 'AA2233');
expect('SQ DQ SK DK SA DA', 5, 'tube:14');
expect('SK DK SA DA S2 D2', 5, '', 'KKAA22 is not a tube');
expect('S5 D5 S6 D6 H2 H2', 2, 'plate:6,tube:7', '5566 + 2 wilds: 556677 or 555666');
expect('SA DA CA S2 D2 C2', 7, 'plate:2', 'AAA222');
expect('SK DK CK SA DA CA', 7, 'plate:14');
// ---- bombs
expect('S8 D8 C8 H8', 2, 'bomb4:8');
expect('S8 D8 C8 H2', 2, 'bomb4:8');
expect('S8 D8 C8 H8 S8', 2, 'bomb5:8');
expect('S8 D8 C8 H8 S8 D8 H2 H2', 2, 'bomb8:8');
expect('S8 D8 C8 H8 S8 D8 C8 H8 H2 H2', 2, 'bomb10:8', '10 of a kind with both wilds');
expect('S2 D2 C2 S2', 2, 'bomb4:15', 'level-card bomb ranks above A bomb');
expect('LJ LJ BJ BJ', 2, 'kings:99');
expect('LJ LJ BJ H2', 2, '', 'wild cannot make 天王炸');
const C = (str, lvl) => R.combosOf(cs(str), lvl)[0];
const b4 = C('S8 D8 C8 H8', 2), b5 = C('S3 D3 C3 H3 S3', 2), sf = C('S3 S4 S5 S6 S7', 2), b6 = C('S4 D4 C4 H4 S4 D4', 2), kings = C('LJ LJ BJ BJ', 2);
ok(R.beats(b5, b4) && R.beats(sf, b5) && R.beats(b6, sf) && R.beats(kings, b6), 'bomb ladder 4 < 5 < 同花顺 < 6 < 四王');
ok(!R.beats(b4, sf) && !R.beats(sf, b6), 'reverse bomb ladder');
ok(R.beats(C('SA DA CA HA', 2), b4) && R.beats(C('S2 D2 C2 S2', 2), C('SA DA CA HA', 2)), 'level bomb > A bomb > 8 bomb');
ok(R.beats(C('S4 S5 S6 S7 S8', 2), sf) && !R.beats(sf, C('S4 S5 S6 S7 S8', 2)), 'straight flushes by top card');
ok(R.beats(b4, C('S10 DJ CQ SK DA', 2)), 'bomb beats a straight');
ok(!R.beats(C('S9 D9', 2), C('S8', 2)), 'pair does not beat single');
ok(R.beats(C('S2', 2), C('SA', 2)) && R.beats(C('LJ', 2), C('S2', 2)), 'single: A < level < 小王');
ok(R.beats(C('S3 D4 C5 S6 D7', 3), C('SA D2 C3 S4 D5', 3)), '34567 > A2345');
ok(!R.beats(C('S5 D5 C5 S3 D3', 2), C('S5 D5 C5 S9 D9', 2)), '三带二 only compares the triple');

// ---- tribute
{
  const players = [0, 1, 2, 3].map(i => ({ id: `p${i}` }));
  const g = R.newGame(players);
  g.result = { order: [0, 2, 1, 3], place: 2 };
  g.declarer = 0;
  g.levels = [5, 2];
  R.startHand(g);
  ok(g.step === 'tribute' || g.tribute.kind === 'resist', '双下 → tribute');
  if (g.step === 'tribute') {
    ok(g.tribute.kind === 'double' && g.tribute.payers.join() === '1,3', 'both losers pay');
    for (const s of g.tribute.payers) {
      const ch = R.tributeChoices(g, s);
      ok(ch.every(c => !R.isWild(c, 5)), 'no ♥ level card in tribute');
      R.payTribute(g, s, ch[0]);
    }
    for (const gv of g.tribute.gives) R.returnTribute(g, gv.to, R.returnChoices(g, gv.to)[0]);
    ok(g.step === 'play' && g.hands.every(h => h.length === 27), 'after tribute everyone has 27');
    ok(g.turn === g.tribute.gives[0].from, 'payer to 头游 leads');
  }
  // resist with two big jokers
  const deck = R.shuffled();
  const bj = [53, 107];
  const rest = deck.filter(c => !bj.includes(c));
  const d2 = [...rest.slice(0, 81), ...bj, ...rest.slice(81)];
  g.step = 'hand'; g.result = { order: [0, 1, 2, 3], place: 3 };
  R.startHand(g, Math.random, d2);
  ok(g.tribute?.kind === 'resist' && g.step === 'play' && g.turn === 0, '末游 with both 大王 抗贡, 头游 leads');
}
// ---- 接风
{
  const g = R.newGame([0, 1, 2, 3].map(i => ({ id: `p${i}` })));
  g.hands = [[card('S5')], [card('S3'), card('D3')], [card('S9'), card('D9')], [card('S4'), card('D4')]];
  g.turn = 0;
  R.play(g, 0, [card('S5')]);
  R.pass(g, 1); R.pass(g, 2); R.pass(g, 3);
  ok(g.turn === 2 && g.jiefeng === 2 && g.table == null, '接风: partner leads after the out player wins the trick');
}
// ---- scoring + 打A
{
  const mk = (levels, declarer, order, rules = {}) => {
    const g = R.newGame([0, 1, 2, 3].map(i => ({ id: `p${i}` })), rules);
    g.levels = levels; g.declarer = declarer; g.level = declarer == null ? levels[0] : levels[declarer];
    g.finished = order.slice(0, 3);
    return R.endHand(g, R.teamOf(order[0]));
  };
  ok(mk([2, 2], 0, [0, 2, 1, 3]).levels[0] === 5, '双上 +3');
  ok(mk([2, 2], 0, [0, 1, 2, 3]).levels[0] === 4, '头游+三游 +2');
  ok(mk([2, 2], 0, [0, 1, 3, 2]).levels[0] === 3, '头游+末游 +1');
  ok(mk([2, 2], 0, [0, 2, 1, 3], { up12: '4' }).levels[0] === 6, 'variant 双上 +4');
  ok(mk([12, 2], 0, [0, 2, 1, 3]).levels[0] === 14, 'capped at A');
  ok(mk([14, 5], 0, [0, 1, 2, 3]).winner === 0, 'A: 头游 + 对家三游 wins');
  ok(mk([14, 5], 0, [0, 1, 2, 3], { aWin: 'double' }).winner == null, 'A variant: must be 双上');
  let g = mk([14, 5], 0, [0, 1, 3, 2]);
  ok(g.winner == null && g.aFails[0] === 1 && g.levels[0] === 14, 'A: partner 末游 is a failed attempt');
  g = mk([14, 5], 0, [1, 3, 0, 2]);
  ok(g.aFails[0] === 1 && g.levels[1] === 8 && g.declarer === 1, 'A lost: fail + opponents level up');
  const g3 = mk([14, 5], 0, [1, 0, 3, 2]); g3.aFails[0] = 0;
  const g4 = R.newGame([0, 1, 2, 3].map(i => ({ id: `p${i}` }))); g4.levels = [14, 5]; g4.declarer = 0; g4.level = 14; g4.aFails = [2, 0]; g4.finished = [1, 3];
  R.endHand(g4, 1);
  ok(g4.levels[0] === 2 && g4.aFails[0] === 0, '3rd A failure → back to 2');
  ok(mk([5, 14], 0, [1, 2, 3, 0]).winner == null, 'winning while the other team declares does not pass A');
}

// ---- fuzz: bots play whole games
const games = Number(process.argv[2] || 400);
let hintChecks = 0;
let hands = 0, actions = 0, stuck = 0, errors = 0, won = 0, tributes = 0, resists = 0, jiefeng = 0, bombs = 0, wildPlays = 0;
let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const variants = R.VARIANTS;
for (let gi = 0; gi < games; gi++) {
  const rules = Object.fromEntries(variants.map(v => [v.key, v.opts[Math.floor(rng() * v.opts.length)][0]]));
  if (gi % 3 === 0) rules.start = '14';
  const g = R.newGame([0, 1, 2, 3].map(i => ({ id: `p${i}` })), rules, rng);
  try {
    for (let h = 0; h < 60 && g.step !== 'end'; h++) {
      hands++;
      if (g.tribute?.kind === 'resist') resists++;
      else if (g.tribute) tributes++;
      let n = 0;
      while (g.step === 'play' || g.step === 'tribute') {
        if (++n > 3000) { stuck++; console.error('stuck', JSON.stringify({ step: g.step, turn: g.turn, hands: g.hands.map(x => x.length) })); break; }
        const total = g.hands.reduce((s, x) => s + x.length, 0) + g.log.filter(a => a.cards).reduce((s, a) => s + a.cards.length, 0);
        if (total !== 108) throw new Error(`card count ${total}`);
        const seats = g.step === 'tribute' ? [0, 1, 2, 3].filter(s => R.tributeTask(g, s)) : [g.turn];
        if (!seats.length) { stuck++; break; }
        const s = seats[0];
        if (g.step === 'play' && actions % 7 === 0) {
          // every hint candidate must be a legal play right now
          for (const c of R.findPlays(g.hands[s], g.level, g.table?.combo || null)) {
            hintChecks++;
            const rd = R.playableAs(g, c.cards);
            if (!rd.some(x => x.type === c.combo.type && x.key === c.combo.key)) throw new Error(`bad hint ${c.cards.map(R.cardName)} as ${c.combo.type}`);
          }
        }
        const d = decide(g, s, rng);
        if (!d) { stuck++; console.error('no decision', g.step, s); break; }
        if (d.kind === 'play') {
          const want = R.combosOf(d.cards, g.level);
          if (!want.length) throw new Error(`bot chose a non-combo ${d.cards.map(R.cardName)}`);
          if (d.cards.some(c => R.isWild(c, g.level))) wildPlays++;
        }
        apply(g, s, d);
        if (g.jiefeng != null && g.log.at(-1)?.sys === 'jiefeng') jiefeng++;
        if (d.kind === 'play' && R.isBomb(g.log.filter(a => a.cards).at(-1).combo)) bombs++;
        actions++;
      }
      if (g.step === 'hand') R.nextHand(g, rng);
    }
    if (g.step === 'end') won++;
  } catch (e) {
    errors++;
    if (errors < 5) console.error('error', e.stack);
  }
}
console.log(`unit checks: ${checks - fails}/${checks} passed`);
console.log(`fuzz: ${games} games, ${hands} hands, ${actions} actions, ${won} games reached 过A, tribute ${tributes}, 抗贡 ${resists}, 接风 ${jiefeng}, bombs ${bombs}, plays with wilds ${wildPlays}`);
console.log(`hint candidates verified: ${hintChecks}`);
console.log(`stuck ${stuck}, errors ${errors}`);
if (fails || stuck || errors) process.exit(1);

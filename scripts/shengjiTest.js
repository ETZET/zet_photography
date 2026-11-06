// Engine tests + bot fuzz for 升级 / 拖拉机.   node scripts/shengjiTest.js [hands=3000]
/* global process */
import * as R from '../src/games/shengji/shengjiRules.js';

let fails = 0;
let passes = 0;
function ok(cond, msg) {
  if (cond) passes += 1;
  else { fails += 1; console.error('✗', msg); }
}
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
const throws = (fn, re, msg) => { try { fn(); ok(false, `${msg}: no error`); } catch (e) { ok(re.test(e.message), `${msg}: ${e.message}`); } };

// deterministic rng
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

// ------------------------------------------------------------ ordering
{
  const ctx = { level: '5', trump: 'H', bridge: 'skip' };
  const order = ['XB0', 'XS0', 'H50', 'S50', 'HA0', 'HK0', 'H60', 'H40', 'H20'];
  for (let i = 0; i + 1 < order.length; i++) ok(R.power(order[i], ctx) > R.power(order[i + 1], ctx), `trump order ${order[i]} > ${order[i + 1]}`);
  eq(R.power('S50', ctx), R.power('C50', ctx), 'off-suit level cards are equal');
  ok(R.isTrump('C50', ctx) && R.isTrump('XS1', ctx) && R.isTrump('H20', ctx) && !R.isTrump('SA0', ctx), 'isTrump');
  ok(R.power('S60', ctx) === R.power('S40', ctx) + 1, 'plain suit skips the level rank (4 → 6 adjacent)');
  eq(R.sortHand(['S20', 'H30', 'XB0', 'C50', 'H50', 'SA0', 'D90'], ctx), ['XB0', 'H50', 'C50', 'H30', 'D90', 'SA0', 'S20'], 'sortHand: trumps first, then the suits after trump (♣♦♠)');
  const nt = { level: '5', trump: null, bridge: 'skip' };
  ok(R.power('XB0', nt) > R.power('XS0', nt) && R.power('XS0', nt) > R.power('H50', nt) && R.power('H50', nt) === R.power('S50', nt), '无主 order');
  ok(!R.isTrump('HA0', nt), '无主: suits are plain');
}

// ------------------------------------------------------------ tractors
{
  const sk = { level: '8', trump: 'H', bridge: 'skip' };
  const gap = { ...sk, bridge: 'gap' };
  const none = { ...sk, bridge: 'none' };
  eq(R.formatOf(['S70', 'S71', 'S90', 'S91'], sk).tractors, [2], 'skip: 7799 is a tractor when 8 is level');
  eq(R.formatOf(['S70', 'S71', 'S90', 'S91'], gap).tractors, [], 'gap: 7799 is not a tractor');
  const chain = ['HA0', 'HA1', 'S80', 'S81', 'H80', 'H81', 'XS0', 'XS1', 'XB0', 'XB1'];
  eq(R.formatOf(chain, sk).tractors, [5], 'skip: trump A→off-level→trump-level→small→big jokers = 5-pair tractor');
  eq(R.formatOf(chain, gap), { tractors: [4], pairs: 1, singles: 0, n: 10 }, 'gap: A pair breaks off, 4-pair tractor remains');
  eq(R.formatOf(chain, none), { tractors: [], pairs: 5, singles: 0, n: 10 }, 'none: level / joker pairs never link');
  eq(R.formatOf(['S80', 'S81', 'C80', 'C81'], sk).tractors, [], 'two off-suit level pairs are not consecutive');
  eq(R.formatOf(['HA0', 'HA1', 'S80', 'S81', 'C80', 'C81', 'H80', 'H81'], sk), { tractors: [3], pairs: 1, singles: 0, n: 8 }, 'duplicate level pair left as a pair');
  eq(R.formatOf(['SQ0', 'SQ1', 'SK0', 'SK1', 'SA0', 'SA1'], sk).tractors, [3], '3-pair tractor');
  eq(R.formatOf(['SQ0', 'SQ1', 'SA0', 'SA1'], sk).tractors, [], 'QQAA not consecutive');
  eq(R.formatOf(['XS0', 'XS1', 'XB0', 'XB1'], { level: '8', trump: null, bridge: 'skip' }).tractors, [2], '无主: joker pairs tractor');
}

// ------------------------------------------------------------ following
{
  const ctx = { level: '2', trump: 'S', bridge: 'skip' };
  const hand = ['H30', 'H31', 'H70', 'H90', 'HK0', 'C40', 'D50'];
  ok(R.followError(hand, ['HA0', 'HA1'], ['H30', 'H31'], ctx) === null, 'follow pair with pair');
  ok(/对子/.test(R.followError(hand, ['HA0', 'HA1'], ['H70', 'H90'], ctx)), 'must follow pair when holding one');
  ok(/红桃/.test(R.followError(hand, ['HA0'], ['C40'], ctx)), 'must follow suit');
  ok(R.followError(['H30', 'C40', 'D50'], ['HA0', 'HA1'], ['H30', 'C40'], ctx) === null, 'short suit: play all + any');
  ok(R.followError(['H30', 'C40', 'D50'], ['HA0', 'HA1'], ['C40', 'D50'], ctx) !== null, 'short suit: must include the suit card');
  const th = ['H30', 'H31', 'H40', 'H41', 'H70', 'H71', 'H90'];
  const lead = ['HJ0', 'HJ1', 'HQ0', 'HQ1'];
  ok(R.followError(th, lead, ['H30', 'H31', 'H40', 'H41'], ctx) === null, 'tractor follows tractor');
  ok(/拖拉机/.test(R.followError(th, lead, ['H30', 'H31', 'H70', 'H71'], ctx)), 'must play tractor when holding one');
  ok(/对子/.test(R.followError(['H30', 'H31', 'H70', 'H71', 'H90'], lead, ['H30', 'H31', 'H90', 'H70'], ctx)), 'no tractor → still both pairs');
  ok(R.followError(['H30', 'H31', 'H70', 'H71', 'H90'], lead, ['H30', 'H31', 'H70', 'H71'], ctx) === null, 'two pairs follow a tractor');
  // trumps: level-card pair counts as a trump pair
  ok(/对子/.test(R.followError(['H20', 'H21', 'S30', 'S40'], ['SA0', 'SA1'], ['S30', 'S40'], ctx)), 'off-suit level pair is a trump pair');
  // suggestion is always legal
  for (const [h, l] of [[th, lead], [hand, ['HA0', 'HA1']], [['H20', 'H21', 'S30', 'S40', 'C50'], ['SA0', 'SA1']]]) {
    ok(R.followError(h, l, R.suggestFollow(h, l, ctx), ctx) === null, `suggestFollow legal for ${l}`);
  }
}

// ------------------------------------------------------------ winner
{
  const ctx = { level: '2', trump: 'S', bridge: 'skip' };
  const w = plays => R.winnerIndex(plays.map((cards, seat) => ({ seat, cards })), ctx);
  eq(w([['HK0'], ['HA0'], ['S30'], ['H40']]), 2, 'trump beats suit');
  eq(w([['HK0'], ['HA0'], ['S30'], ['H20']]), 3, 'level card beats small trump');
  eq(w([['HK0'], ['HK1'], ['C30'], ['H40']]), 0, 'equal card: first played wins');
  eq(w([['HK0', 'HK1'], ['HA0', 'H30'], ['S30', 'S31'], ['S40', 'S50']]), 2, 'only a trump pair beats a pair');
  eq(w([['H30', 'H31', 'H40', 'H41'], ['HA0', 'HA1', 'HK0', 'HK1'], ['S30', 'S31', 'S50', 'S51'], ['S60', 'S61', 'S70', 'S71']]), 3, 'tractors: in-suit higher, trump tractor higher still');
  eq(w([['H30', 'H31', 'H40', 'H41'], ['HA0', 'HA1', 'HQ0', 'HQ1'], ['C30', 'C40', 'C50', 'C60'], ['D30', 'D31', 'D40', 'D50']]), 0, 'two loose pairs do not beat a tractor');
}

// ------------------------------------------------------------ throws
function staged(hands, { level = '2', trump = 'S', rules = {}, dealer = 0 } = {}) {
  const g = R.newGame([1, 2, 3, 4].map(i => ({ id: `p${i}` })), { rules });
  g.level = level; g.trump = trump; g.dealer = dealer;
  g.hands = hands.map(h => [...h]);
  g.buried = [];
  g.step = 'play';
  g.trick = { leader: dealer, plays: [] };
  g.trickNo = 1;
  return g;
}
{
  // seat 0 throws ♥A + ♥KK; nobody has a higher heart pair or the other ♥A → succeeds
  const hands = [['HA0', 'HK0', 'HK1', 'C30'], ['H30', 'H40', 'H50', 'C40'], ['H60', 'H70', 'H80', 'C50'], ['H90', 'HQ0', 'D30', 'C60']];
  const g = staged(hands);
  R.play(g, 0, ['HA0', 'HK0', 'HK1']);
  ok(!g.throwFail && g.trick.plays[0].cards.length === 3, '甩牌 succeeds');
  ok(R.followError(g.hands[1], g.trick.plays[0].cards, ['H30', 'H40', 'C40'], R.ctxOf(g)) !== null, 'must follow throw with suit cards');
  R.play(g, 1, ['H30', 'H40', 'H50']); R.play(g, 2, ['H60', 'H70', 'H80']);
  R.play(g, 3, R.suggestFollow(g.hands[3], g.trick.plays[0].cards, R.ctxOf(g)));
  eq(g.lastTrick.winner, 0, 'successful throw wins the trick');
  // trumping a throw needs the same shape
  const g2 = staged([['HA0', 'HK0', 'HK1', 'C30'], ['S30', 'S40', 'S50', 'C40'], ['S60', 'S61', 'S70', 'C50'], ['D20', 'D50', 'D30', 'C60']]);
  R.play(g2, 0, ['HA0', 'HK0', 'HK1']);
  R.play(g2, 1, ['S30', 'S40', 'S50']);
  R.play(g2, 2, ['S60', 'S61', 'S70']);
  R.play(g2, 3, ['D20', 'D50', 'D30']);
  eq(g2.lastTrick.winner, 2, 'trumping a throw needs the same shape (pair + single)');
}
for (const [pen, want] of [['per10', 20], ['flat10', 10], ['none', 0]]) {
  // dealer (seat 0) throws ♥A ♥Q ♥J — seat 1 holds ♥K → fails, forced to play the smallest beatable (♥J)
  const g = staged([['HA0', 'HQ0', 'HJ0', 'C30'], ['HK0', 'H40', 'H50', 'C40'], ['H60', 'H70', 'H80', 'C50'], ['H90', 'D40', 'D30', 'C60']], { rules: { penalty: pen } });
  R.play(g, 0, ['HA0', 'HQ0', 'HJ0']);
  ok(g.throwFail && g.throwFail.forced.join() === 'HJ0', `甩牌 fails → smallest part (${pen})`);
  eq(g.trick.plays[0].cards, ['HJ0'], `forced lead (${pen})`);
  eq(g.points, want, `penalty to defenders (${pen})`);
  ok(g.hands[0].includes('HA0') && g.hands[0].includes('HQ0'), 'withdrawn cards return to hand');
}
{
  // a defender's failed throw costs the defenders
  const g = staged([['C30', 'C40', 'C50', 'C60'], ['HA0', 'HQ0', 'HJ0', 'D30'], ['HK0', 'H70', 'H80', 'C70'], ['H90', 'D40', 'D50', 'C80']], { dealer: 1 });
  g.dealer = 0; g.trick.leader = 1;
  R.play(g, 1, ['HA0', 'HQ0', 'HJ0']);
  eq(g.points, -20, 'defender throw failure deducts from defenders');
  // a pair inside a throw can be beaten only by a bigger pair
  const g3 = staged([['HA0', 'HQ0', 'HQ1', 'C30'], ['HK0', 'H40', 'H50', 'C40'], ['H60', 'H70', 'H80', 'C50'], ['H90', 'D40', 'D30', 'C60']]);
  R.play(g3, 0, ['HA0', 'HQ0', 'HQ1']);
  ok(!g3.throwFail, 'single ♥K cannot beat the ♥QQ pair');
  const g4 = staged([['HA0', 'HQ0', 'HQ1', 'C30'], ['HK0', 'HK1', 'H50', 'C40'], ['H60', 'H70', 'H80', 'C50'], ['H90', 'D40', 'D30', 'C60']]);
  R.play(g4, 0, ['HA0', 'HQ0', 'HQ1']);
  eq(g4.throwFail?.forced, ['HQ0', 'HQ1'], '♥KK beats the ♥QQ pair → forced pair');
  const g5 = staged([['HA0', 'HQ0', 'C30', 'C40'], ['HK0', 'H40', 'H50', 'C40'], ['H60', 'H70', 'H80', 'C50'], ['H90', 'D40', 'D30', 'C60']], { rules: { throw: 'no' } });
  throws(() => R.play(g5, 0, ['HA0', 'HQ0']), /不能甩牌/, 'throw disabled');
  throws(() => R.play(g5, 0, ['HA0', 'C30']), /同一门/, 'mixed suits lead');
}

// ------------------------------------------------------------ scoring
{
  eq(R.levelChange(0), { side: 'dealer', up: 3 }, '0 → dealer +3');
  eq(R.levelChange(35), { side: 'dealer', up: 2 }, '35 → +2');
  eq(R.levelChange(75), { side: 'dealer', up: 1 }, '75 → +1');
  eq(R.levelChange(80), { side: 'defenders', up: 0 }, '80 → take over');
  eq(R.levelChange(155), { side: 'defenders', up: 1 }, '155 → +1');
  eq(R.levelChange(160), { side: 'defenders', up: 2 }, '160 → +2');
  eq(R.levelChange(200), { side: 'defenders', up: 3 }, '200 → +3');
  eq(R.levelChange(280), { side: 'defenders', up: 5 }, '280 → +5');
  eq(R.advance('3', 3, { must: 'none' }), '6', 'advance 3+3');
  eq(R.advance('3', 3, { must: '5tk' }), '5', '5 必打 stops the jump');
  eq(R.advance('9', 2, { must: '5tk' }), 'T', '10 必打');
  eq(R.advance('Q', 3, { must: 'none' }), 'A', 'capped at A');
  eq(R.advance('9', 3, { must: 'ja' }), 'J', 'J 必打');
  const ctx = { level: '2', trump: 'S', bridge: 'skip' };
  eq(R.kittyMultiplier('cards', ['H30'], ctx), 2, 'kitty single ×2');
  eq(R.kittyMultiplier('cards', ['H30', 'H31', 'H40', 'H41'], ctx), 8, 'kitty tractor ×8');
  eq(R.kittyMultiplier('exp', ['H30', 'H31'], ctx), 4, 'exp pair ×4');
  eq(R.kittyMultiplier('exp', ['H30', 'H31', 'H40', 'H41', 'H50', 'H51'], ctx), 16, 'exp 3-tractor ×16');
  eq(R.kittyMultiplier('double', ['H30', 'H31', 'H40', 'H41'], ctx), 2, 'double ×2');
  // end of hand: defenders win the last trick with a pair → kitty ×4
  const g = staged([['H30', 'H31'], ['HA0', 'HA1'], ['C30', 'C40'], ['D30', 'D40']]);
  g.buried = ['SK0', 'S50', 'D60', 'D70', 'D80', 'D90', 'DJ0', 'DQ0'];
  g.points = 50;
  g.levels = ['2', '2'];
  R.play(g, 0, ['H30', 'H31']); R.play(g, 1, ['HA0', 'HA1']); R.play(g, 2, ['C30', 'C40']); R.play(g, 3, ['D30', 'D40']);
  eq(g.result.bonus, 60, '扣底 15 × 4');
  eq(g.result.total, 110, 'total 50 + 60');
  eq([g.result.side, g.result.to, g.result.nextDealer], ['defenders', '2', 1], 'defenders take over at 2, next dealer = seat 1');
  // dealer at A defends → game over
  const g2 = staged([['HA0'], ['H30'], ['H40'], ['H50']]);
  g2.buried = []; g2.levels = ['A', '9']; g2.level = 'A'; g2.trump = 'S';
  R.play(g2, 0, ['HA0']); R.play(g2, 1, ['H30']); R.play(g2, 2, ['H40']); R.play(g2, 3, ['H50']);
  ok(g2.step === 'end' && g2.winner === 0, 'dealer at A defends → wins the game');
}

// ------------------------------------------------------------ bidding
{
  const g = R.newGame([1, 2, 3, 4].map(i => ({ id: `p${i}` })), { rules: {} });
  const deck = R.newDeck();
  // seat 0 gets ♠2, seat 1 gets ♥2 ♥2, seat 2 gets both small jokers
  const want = [['S20', 'C30'], ['H20', 'H21'], ['XS0', 'XS1'], []];
  const rest = deck.filter(c => !want.flat().includes(c));
  const hands = want.map(w => [...w, ...rest.splice(0, 25 - w.length)]);
  const d2 = []; for (let i = 0; i < 25; i++) for (let s = 0; s < 4; s++) d2.push(hands[s][i]);
  R.startHand(g, { now: 0, deck: [...d2, ...rest] });
  g.hand = 1;
  R.declare(g, 0, { suit: 'S', strength: 1 }, 100);
  throws(() => R.declare(g, 3, { suit: 'D', strength: 1 }, 100), /反主|没有/, 'single cannot overturn single');
  R.declare(g, 1, { suit: 'H', strength: 2 }, 200);
  R.declare(g, 2, { suit: null, strength: 3 }, 300);
  R.finishDeal(g);
  eq([g.trump, g.dealer, g.hands[2].length, g.step], [null, 2, 33, 'bury'], 'small-joker pair → 无主, declarer becomes 庄家 with 33 cards');
  R.bury(g, 2, g.hands[2].slice(0, 8));
  eq([g.hands[2].length, g.step, R.turnOf(g)], [25, 'play', 2], 'buried 8, 庄家 leads');
  const g2 = R.newGame([1, 2, 3, 4].map(i => ({ id: `p${i}` })), { rules: { fanzhu: 'no' } });
  R.startHand(g2, { now: 0, deck: [...d2, ...rest] });
  R.declare(g2, 0, { suit: 'S', strength: 1 }, 100);
  throws(() => R.declare(g2, 1, { suit: 'H', strength: 2 }, 200), /反主/, '反主 disabled');
}

// ------------------------------------------------------------ fuzz
const HANDS = Number(process.argv[2] || 3000);
let stuck = 0, errors = 0, hands = 0, tricks = 0, throwsTried = 0, throwFails = 0, games = 0; let defPts = 0, takeovers = 0, ended = 0;
const ruleSpace = Object.fromEntries(R.VARIANTS.map(v => [v.key, v.opts.map(o => o[0])]));
const rnd = rng(12345);
const pickRule = () => Object.fromEntries(Object.entries(ruleSpace).map(([k, opts]) => [k, opts[Math.floor(rnd() * opts.length)]]));
while (hands < HANDS) {
  games += 1;
  const g = R.newGame([1, 2, 3, 4].map(i => ({ id: `p${i}` })), { rules: pickRule() });
  R.startHand(g, { now: 0, deck: R.shuffle(R.newDeck(), rnd) }); g.hand = 1;
  for (let h = 0; h < 40 && g.step !== 'end' && hands < HANDS; h++) {
    try {
      // bidding at random times during the deal
      for (let t = 0; t < 30; t++) {
        const s = Math.floor(rnd() * 4);
        const now = Math.floor(rnd() * R.dealEnd(g));
        const b = R.botBid(g, s, now, rnd);
        if (b) R.declare(g, s, b, now);
      }
      for (let s = 0; s < 4; s++) R.pass(g, s, R.dealEnd(g));
      if (g.step !== 'bury') throw new Error('deal did not finish');
      if (g.hands[g.dealer].length !== 33) throw new Error('dealer should hold 33');
      R.bury(g, g.dealer, R.botBury(g, g.dealer));
      let guard = 0;
      let seenPoints = 0;
      while (g.step === 'play') {
        if (++guard > 500) { stuck += 1; throw new Error('stuck'); }
        const s = R.turnOf(g);
        const leading = !g.trick.plays.length;
        let cards;
        if (leading) {
          cards = R.botLead(g, s, { throws: true, rnd });
          if (R.componentCount(R.formatOf(cards, R.ctxOf(g))) > 1) throwsTried += 1;
        } else {
          const h2 = R.hint(g, s);
          const e2 = R.playError(g, s, h2);
          if (e2) throw new Error(`hint illegal: ${e2} hand=${g.hands[s]} lead=${g.trick.plays[0].cards} hint=${h2}`);
          cards = rnd() < 0.5 ? h2 : R.botFollow(g, s);
        }
        const e = R.playError(g, s, cards);
        if (e) throw new Error(`bot illegal: ${e} seat=${s} cards=${cards}`);
        const before = g.trickNo;
        const fail = g.throwFail;
        R.play(g, s, cards);
        if (leading && g.throwFail && g.throwFail !== fail) throwFails += 1;
        if (g.trickNo !== before || g.step !== 'play') {
          tricks += 1;
          seenPoints += g.lastTrick.points;
          // every trick: 4 plays of equal length
          const L = g.lastTrick.plays[0].cards.length;
          if (!g.lastTrick.plays.every(p => p.cards.length === L)) throw new Error('uneven trick');
        }
      }
      hands += 1; defPts += g.result.total; if (g.result.side === "defenders") takeovers += 1; if (g.step === "end") ended += 1;
      if (seenPoints + R.sumPoints(g.result.buried) !== R.TOTAL_POINTS) throw new Error(`points don't add up: ${seenPoints} + kitty`);
      if (g.hands.some(x => x.length)) throw new Error('cards left in hand');
      if (g.step === 'result') { R.nextHand(g, { now: 0, deck: R.shuffle(R.newDeck(), rnd) }); }
    } catch (e) {
      errors += 1;
      if (errors < 6) console.error('fuzz error:', e.message);
      break;
    }
  }
}
console.log(`fuzz: ${games} games, ${hands} hands, ${tricks} tricks, ${throwsTried} throws (${throwFails} failed) — defenders avg ${(defPts / hands).toFixed(0)} pts, take over ${((100 * takeovers) / hands).toFixed(0)}%, ${ended} games won — stuck ${stuck}, errors ${errors}`);
ok(stuck === 0 && errors === 0, 'fuzz: 0 stuck / 0 errors');

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);

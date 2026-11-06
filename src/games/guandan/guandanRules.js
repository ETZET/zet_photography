// 掼蛋 (Guandan) rules engine — pure JS, no React. Every mutation takes the game
// object `g` (plain JSON, stored in the shared room) and throws a Chinese Error
// when the move is illegal.
//
// Rules follow the common 江苏/竞赛 rules (see docs in the report):
//   - 4 players, partners opposite: seats 0&2 = team 0, seats 1&3 = team 1.
//   - 2 decks + 4 jokers = 108 cards, 27 each.
//   - the level (打几) is the declaring team's level; the ♥ level card is wild
//     (逢人配): it stands in for any card except a joker.
//   - combos: 单张 对子 三张 三带二 顺子(5) 三连对 钢板 炸弹(4–10) 同花顺 天王炸
//   - bombs: 4 < 5 < 同花顺 < 6 < 7 < 8 < 9 < 10 < 四王
//   - 接风: when a player goes out on a lead nobody beats, the partner leads.
//   - finish 头游/二游/三游/末游: winners go up 3 (双上) / 2 / 1.
//   - next hand: 进贡 / 还贡 (双下 = both pay), 抗贡 with both big jokers.
//   - 打A: win the game at A with 头游 and partner not 末游; 3 failures → back to 2.
//
// Card ids: 0..107. id % 54: 0..51 = suit*13 + (rank-2), 52 = 小王, 53 = 大王.
// Suits 0♠ 1♥ 2♣ 3♦. Ranks 2..14 (A = 14), 小王 16, 大王 17; the level rank
// counts as 15 for single/pair/triple/bomb comparisons.

export const SUITS = ['♠', '♥', '♣', '♦'];
export const SJ = 16;
export const BJ = 17;
export const LEVEL_SLOT = 15;

export const rankOf = c => { const k = c % 54; return k === 52 ? SJ : k === 53 ? BJ : (k % 13) + 2; };
export const suitOf = c => { const k = c % 54; return k >= 52 ? 4 : Math.floor(k / 13); };
export const isJoker = c => c % 54 >= 52;
export const isWild = (c, level) => suitOf(c) === 1 && rankOf(c) === level;
export const isRed = c => { const s = suitOf(c); return s === 1 || s === 3 || c % 54 === 53; };
/** Value in level order (singles, pairs, triples, bombs, tribute). */
export const lvOf = (r, level) => (r === level ? LEVEL_SLOT : r);
export const cardLv = (c, level) => lvOf(rankOf(c), level);

export const RANK_NAME = { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 16: '小王', 17: '大王' };
export const rankName = r => RANK_NAME[r === 1 ? 14 : r];
export const cardName = c => (isJoker(c) ? rankName(rankOf(c)) : `${SUITS[suitOf(c)]}${rankName(rankOf(c))}`);

const natRank = v => (v === 1 ? 14 : v); // window position (A low = 1) → rank

// --------------------------------------------------------------- combos ---

export const TYPE_ZH = {
  single: '单张', pair: '对子', triple: '三张', full: '三带二', straight: '顺子', tube: '三连对', plate: '钢板',
  bomb: '炸弹', sf: '同花顺', kings: '天王炸',
};

/** Bomb power: 0 for ordinary combos. 4 < 5 < 同花顺 < 6 < … < 10 < 四王. */
export const power = c => (c.type === 'bomb' ? c.n : c.type === 'sf' ? 5.5 : c.type === 'kings' ? 11 : 0);
export const isBomb = c => power(c) > 0;

function tally(cards, level) {
  let wild = 0;
  const jokers = [];
  const cnt = {};
  const suits = new Set();
  for (const c of cards) {
    if (isWild(c, level)) { wild++; continue; }
    if (isJoker(c)) { jokers.push(rankOf(c)); continue; }
    const r = rankOf(c);
    cnt[r] = (cnt[r] || 0) + 1;
    suits.add(suitOf(c));
  }
  return { wild, jokers, cnt, ranks: Object.keys(cnt).map(Number), suits };
}

/**
 * Every way these cards can be read as a combo (wild cards make several
 * readings possible). One entry per type, with the best (highest) key.
 */
export function combosOf(cards, level) {
  const n = cards.length;
  if (!n || n > 10) return [];
  const { wild, jokers, cnt, ranks, suits } = tally(cards, level);
  const best = {};
  const add = (type, key, extra = {}) => {
    const id = type === 'bomb' ? `bomb${extra.n}` : type;
    if (!best[id] || best[id].key < key) best[id] = { type, key, n, ...extra };
  };

  if (n === 1) {
    add('single', cardLv(cards[0], level));
    return Object.values(best);
  }
  if (jokers.length) {
    const sj = jokers.filter(r => r === SJ).length;
    const bj = jokers.length - sj;
    if (n === 4 && sj === 2 && bj === 2) add('kings', 99);
    // jokers only pair with the same joker; never with a wild
    const jokerPair = jokers.length === 2 && (sj === 2 || bj === 2);
    if (n === 2 && jokerPair) add('pair', jokers[0]);
    if (n === 5 && jokerPair && ranks.length <= 1) {
      const t = ranks[0];
      if (t != null && cnt[t] + wild === 3) add('full', lvOf(t, level));
    }
    return Object.values(best);
  }

  // no jokers from here
  const same = ranks.length <= 1;
  if (same) {
    const key = ranks.length ? lvOf(ranks[0], level) : LEVEL_SLOT; // two wilds = a pair of level cards
    if (n === 2) add('pair', key);
    if (n === 3) add('triple', key);
    if (n >= 4) add('bomb', key, { n });
  }
  const within = allowed => ranks.every(r => allowed.includes(r));
  if (n === 5) {
    // 三带二: triple t + pair p (p ≠ t; a pair of jokers is handled above)
    for (let t = 2; t <= 14; t++) {
      if ((cnt[t] || 0) > 3) continue;
      for (let p = 2; p <= 14; p++) {
        if (p === t || (cnt[p] || 0) > 2 || !within([t, p])) continue;
        if (3 - (cnt[t] || 0) + 2 - (cnt[p] || 0) === wild) add('full', lvOf(t, level));
      }
    }
    // 顺子 / 同花顺: five consecutive natural ranks, A low (A2345) or high (10JQKA)
    for (let low = 1; low <= 10; low++) {
      const seq = [0, 1, 2, 3, 4].map(i => natRank(low + i));
      if (!within(seq) || seq.some(r => (cnt[r] || 0) > 1)) continue;
      add('straight', low + 4);
      if (suits.size <= 1) add('sf', low + 4);
    }
  }
  if (n === 6) {
    for (let low = 1; low <= 12; low++) { // 三连对 AA2233 … QQKKAA
      const seq = [low, low + 1, low + 2].map(natRank);
      if (within(seq) && seq.every(r => (cnt[r] || 0) <= 2)) add('tube', low + 2);
    }
    for (let low = 1; low <= 13; low++) { // 钢板 AAA222 … KKKAAA
      const seq = [low, low + 1].map(natRank);
      if (within(seq) && seq.every(r => (cnt[r] || 0) <= 3)) add('plate', low + 1);
    }
  }
  // a natural flush of five is only a 同花顺, never a plain 顺子
  if (best.sf && best.straight && wild === 0) delete best.straight;
  return Object.values(best);
}

/** Does combo a beat combo b (b = what's on the table, null = leading)? */
export function beats(a, b) {
  if (!b) return true;
  const pa = power(a);
  const pb = power(b);
  if (pa || pb) return pa !== pb ? pa > pb : a.key > b.key;
  return a.type === b.type && a.key > b.key;
}

/** Readings of `cards` that may be played on `top` (all readings when leading). */
export function legalReadings(cards, level, top) {
  return combosOf(cards, level).filter(c => beats(c, top))
    // ordinary readings first, then weakest bomb (don't waste a bigger bomb by default)
    .sort((x, y) => power(x) - power(y) || y.key - x.key);
}

const keyName = (key, level) => (key === LEVEL_SLOT ? rankName(level) : rankName(key));
/** Human label, e.g. 「顺子 3-7」「炸弹 5张8」「对 大王」. */
export function comboLabel(c, level) {
  const k = c.key;
  switch (c.type) {
    case 'single': return `单张 ${keyName(k, level)}`;
    case 'pair': return `对${keyName(k, level)}`;
    case 'triple': return `三个${keyName(k, level)}`;
    case 'full': return `三带二 ${keyName(k, level)}`;
    case 'straight': return `顺子 ${rankName(k - 4)}-${rankName(k)}`;
    case 'sf': return `同花顺 ${rankName(k - 4)}-${rankName(k)}`;
    case 'tube': return `三连对 ${rankName(k - 2)}${rankName(k - 2)}-${rankName(k)}${rankName(k)}`;
    case 'plate': return `钢板 ${rankName(k - 1)}-${rankName(k)}`;
    case 'bomb': return `${c.n}炸 ${keyName(k, level)}`;
    case 'kings': return '天王炸';
    default: return '?';
  }
}

// ------------------------------------------------------- hand searching ---

/**
 * Candidate plays from a hand: [{ cards, combo, cost }], cheapest first.
 * Used by the 提示 button and the bots. `top` = table combo or null.
 */
export function findPlays(hand, level, top) {
  const wilds = hand.filter(c => isWild(c, level));
  const byRank = {};
  const jokers = { [SJ]: [], [BJ]: [] };
  for (const c of hand) {
    if (isWild(c, level)) continue;
    if (isJoker(c)) { jokers[rankOf(c)].push(c); continue; }
    (byRank[rankOf(c)] ||= []).push(c);
  }
  const n = r => byRank[r]?.length || 0;
  const out = [];
  const seen = new Set();
  const push = (cards, combo, cost) => {
    if (!cards || !beats(combo, top)) return;
    // double-check the reading (e.g. a natural flush is a 同花顺, not a 顺子)
    if (!combosOf(cards, level).some(c => c.type === combo.type && c.key === combo.key)) return;
    const id = `${combo.type}:${combo.n}:${combo.key}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ cards, combo, cost });
  };
  // take `need` [[rank, count]] from naturals, fill the gap with wilds
  const take = (need, suit = null) => {
    const cards = [];
    let w = 0;
    for (const [r, k] of need) {
      const pool = (byRank[r] || []).filter(c => suit == null || suitOf(c) === suit);
      const got = pool.slice(0, k);
      cards.push(...got);
      w += k - got.length;
    }
    if (w > wilds.length) return null;
    return { cards: [...cards, ...wilds.slice(0, w)], w };
  };
  const breaks = need => need.reduce((s, [r, k]) => s + (n(r) >= 4 && k < n(r) ? 1 : 0), 0);
  const R = Array.from({ length: 13 }, (_, i) => i + 2);
  const lv = r => lvOf(r, level);
  const cost = (base, t, need) => base + (t ? t.w * 25 : 0) + breaks(need) * 30;

  if (!top || top.type === 'single') {
    for (const r of R) if (n(r)) { const need = [[r, 1]]; push([byRank[r][0]], { type: 'single', key: lv(r), n: 1 }, cost(lv(r) + (n(r) > 1 ? 4 : 0), null, need)); }
    for (const j of [SJ, BJ]) if (jokers[j].length) push([jokers[j][0]], { type: 'single', key: j, n: 1 }, j + 2);
    if (wilds.length) push([wilds[0]], { type: 'single', key: LEVEL_SLOT, n: 1 }, 40);
  }
  if (!top || top.type === 'pair') {
    for (const r of R) {
      const t = take([[r, 2]]);
      if (t && n(r)) push(t.cards, { type: 'pair', key: lv(r), n: 2 }, cost(lv(r) + (n(r) > 2 ? 4 : 0), t, [[r, 2]]));
    }
    for (const j of [SJ, BJ]) if (jokers[j].length >= 2) push(jokers[j].slice(0, 2), { type: 'pair', key: j, n: 2 }, j + 4);
    if (wilds.length === 2) push(wilds, { type: 'pair', key: LEVEL_SLOT, n: 2 }, 60);
  }
  if (!top || top.type === 'triple' || top.type === 'full') {
    for (const r of R) {
      if (!n(r)) continue;
      const t3 = take([[r, 3]]);
      if (!t3) continue;
      if (!top || top.type === 'triple') push(t3.cards, { type: 'triple', key: lv(r), n: 3 }, cost(lv(r), t3, [[r, 3]]));
      if (!top || top.type === 'full') {
        // cheapest pair to go with it
        let bestPair = null;
        for (const p of R) {
          if (p === r || !n(p)) continue;
          const t = take([[r, 3], [p, 2]]);
          if (!t) continue;
          const cst = cost(lv(r) + lv(p) / 4, t, [[r, 3], [p, 2]]);
          if (!bestPair || cst < bestPair.cst) bestPair = { t, cst };
        }
        for (const j of [SJ, BJ]) {
          if (jokers[j].length >= 2 && t3) {
            const cst = cost(lv(r) + 10, t3, [[r, 3]]);
            if (!bestPair || cst < bestPair.cst) bestPair = { t: { cards: [...t3.cards, ...jokers[j].slice(0, 2)], w: t3.w }, cst };
          }
        }
        if (bestPair) push(bestPair.t.cards, { type: 'full', key: lv(r), n: 5 }, bestPair.cst);
      }
    }
  }
  const windows = (len, from, to, k, type) => {
    for (let low = from; low <= to; low++) {
      const need = Array.from({ length: len }, (_, i) => [natRank(low + i), k]);
      const t = take(need);
      if (t && t.w < len * k) push(t.cards, { type, key: low + len - 1, n: len * k }, cost(low + len + 3, t, need));
    }
  };
  if (!top || top.type === 'straight') windows(5, 1, 10, 1, 'straight');
  if (!top || top.type === 'tube') windows(3, 1, 12, 2, 'tube');
  if (!top || top.type === 'plate') windows(2, 1, 13, 3, 'plate');

  // bombs (always allowed unless the table holds a bigger one)
  for (const r of R) {
    const max = n(r) + wilds.length;
    if (!n(r) || max < 4) continue;
    for (let k = 4; k <= Math.min(10, max); k++) {
      const t = take([[r, k]]);
      push(t.cards, { type: 'bomb', key: lv(r), n: k }, 200 + k * 20 + lv(r) + t.w * 10);
    }
  }
  for (let low = 1; low <= 10; low++) {
    for (let s = 0; s < 4; s++) {
      const need = Array.from({ length: 5 }, (_, i) => [natRank(low + i), 1]);
      const t = take(need, s);
      if (t && t.w < 5) push(t.cards, { type: 'sf', key: low + 4, n: 5 }, 300 + low + t.w * 10);
    }
  }
  if (jokers[SJ].length === 2 && jokers[BJ].length === 2) push([...jokers[SJ], ...jokers[BJ]], { type: 'kings', key: 99, n: 4 }, 500);
  return out.sort((a, b) => a.cost - b.cost);
}

// ----------------------------------------------------------------- game ---

export const PLAYERS = 4;
export const teamOf = seat => seat % 2;
export const partnerOf = seat => (seat + 2) % 4;
export const PLACE_ZH = ['头游', '二游', '三游', '末游'];
export const LEVELS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const levelName = l => rankName(l);

export const DEFAULT_RULES = { start: '2', tribute: 'yes', back: 'le10', aWin: 'notLast', aFail: '3', up12: '3', count: 'always' };
// [value, label, explanation]; the first option is the common one (★)
export const VARIANTS = [
  { key: 'start', zh: '从几打起', opts: [['2', '打 2', '标准：两队都从 2 打起。'], ['5', '打 5', '想打快一点就从 5 开始。'], ['10', '打 10', '短局。'], ['14', '打 A', '直接打 A，适合练习过 A。']] },
  { key: 'tribute', zh: '进贡', opts: [['yes', '要进贡', '第二局起末游向头游进贡最大的牌（红心级牌除外），双下两人都贡；两张大王可以抗贡。'], ['no', '不进贡', '每局都直接开打，上局头游先出。']] },
  { key: 'back', zh: '还贡', opts: [['le10', '10 以下', '还一张 10 或以下的牌；手里都比 10 大就还最小的。'], ['any', '随便还', '任意一张都可以还。']] },
  { key: 'aWin', zh: '打 A 过关', opts: [['notLast', '对家非末游', '打 A 时本方头游、对家不是末游就赢。'], ['double', '必须双上', '打 A 必须本方拿头游和二游。']] },
  { key: 'aFail', zh: '打 A 失败', opts: [['3', '3 次回 2', '打 A 三次不过，回到 2 重新打。'], ['2', '2 次回 2', '打 A 两次不过就回 2。'], ['never', '不回落', '一直打 A，直到过关。']] },
  { key: 'up12', zh: '双上升级', opts: [['3', '升 3 级', '头游+二游升 3 级，头游+三游升 2 级，头游+末游升 1 级。'], ['4', '升 4 级', '双上升 4 级（pagat 写法），其余不变。']] },
  { key: 'count', zh: '报牌', opts: [['always', '一直显示', '随时能看到每家剩几张。'], ['le10', '10 张以内', '剩 10 张以内才显示张数（比赛规则：10 张以内要报牌）。']] },
];
export const changedRules = rules => VARIANTS.filter(v => (rules?.[v.key] ?? DEFAULT_RULES[v.key]) !== DEFAULT_RULES[v.key]);

export function shuffled(rng = Math.random) {
  const deck = Array.from({ length: 108 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Sort for display: level order high → low, then suit. */
export const sortHand = (hand, level) => [...hand].sort((a, b) => cardLv(b, level) - cardLv(a, level) || (isWild(a, level) ? -1 : 0) - (isWild(b, level) ? -1 : 0) || suitOf(a) - suitOf(b) || a - b);

export function newGame(players, rules = {}, rng = Math.random) {
  const r = { ...DEFAULT_RULES, ...rules };
  const start = Number(r.start) || 2;
  const g = {
    v: 1,
    rules: r,
    seats: players.map(p => p.id),
    levels: [start, start],
    aFails: [0, 0],
    declarer: null, // team whose level is played; null on the first hand
    handNo: 0,
    winner: null,
    result: null,
    history: [], // short per-hand results
  };
  startHand(g, rng);
  return g;
}

/** Deal a new hand: level, cards, tribute (if any) and the first leader. */
export function startHand(g, rng = Math.random, deck = null) {
  const prev = g.result;
  g.handNo += 1;
  g.level = g.declarer == null ? g.levels[0] : g.levels[g.declarer];
  const d = deck || shuffled(rng);
  g.hands = [0, 1, 2, 3].map(i => d.slice(i * 27, i * 27 + 27));
  g.finished = [];
  g.table = null; // { s, cards, combo }
  g.passed = [];
  g.trick = []; // this trick's actions: { s, cards, combo } | { s, pass: true }
  g.log = [];
  g.jiefeng = null;
  g.result = null;
  g.dealtAt = Date.now();
  g.tribute = null;
  g.step = 'play';
  if (!prev) {
    g.turn = Math.floor(rng() * 4);
    g.log.push({ sys: 'first', s: g.turn });
    return g;
  }
  const first = prev.order[0];
  if (g.rules.tribute !== 'yes') {
    g.turn = first;
    g.log.push({ sys: 'notribute', s: first });
    return g;
  }
  const double = prev.place === 2;
  const payers = double ? [prev.order[2], prev.order[3]] : [prev.order[3]];
  const bigJokers = payers.reduce((s, p) => s + g.hands[p].filter(c => rankOf(c) === BJ).length, 0);
  if (bigJokers >= 2) {
    g.tribute = { kind: 'resist', payers, receivers: double ? [first, prev.order[1]] : [first], paid: {}, gives: [], first };
    g.turn = first;
    g.log.push({ sys: 'resist', s: payers[0], s2: payers[1] ?? null });
    return g;
  }
  g.tribute = { kind: double ? 'double' : 'single', payers, receivers: double ? [first, prev.order[1]] : [first], paid: {}, gives: [], first, phase: 'pay' };
  g.step = 'tribute';
  g.turn = null;
  return g;
}

export const seatOf = (g, id) => g.seats.indexOf(id);
export const isOut = (g, s) => g.finished.includes(s);
export const activeSeats = g => [0, 1, 2, 3].filter(s => !isOut(g, s));
const nextActive = (g, s) => { for (let i = 1; i <= 4; i++) { const t = (s + i) % 4; if (!isOut(g, t)) return t; } return null; };

/** Cards a tribute payer may give: the highest in level order, ♥ level cards excluded. */
export function tributeChoices(g, s) {
  const pool = g.hands[s].filter(c => !isWild(c, g.level));
  const top = Math.max(...pool.map(c => cardLv(c, g.level)));
  return pool.filter(c => cardLv(c, g.level) === top);
}
/** Cards a receiver may hand back. */
export function returnChoices(g, s) {
  const hand = g.hands[s];
  if (g.rules.back === 'any') return [...hand];
  const small = hand.filter(c => !isJoker(c) && rankOf(c) <= 10);
  if (small.length) return small;
  const min = Math.min(...hand.map(c => cardLv(c, g.level)));
  return hand.filter(c => cardLv(c, g.level) === min);
}
/** What seat s still has to do in the tribute: 'pay' | 'back' | null. */
export function tributeTask(g, s) {
  const t = g.tribute;
  if (g.step !== 'tribute' || !t) return null;
  if (t.phase === 'pay') return t.payers.includes(s) && !(s in t.paid) ? 'pay' : null;
  const give = t.gives.find(x => x.to === s);
  return give && give.back == null ? 'back' : null;
}

export function payTribute(g, s, card) {
  const t = g.tribute;
  if (tributeTask(g, s) !== 'pay') throw new Error('现在不用你进贡');
  if (!tributeChoices(g, s).includes(card)) throw new Error('要进贡手里最大的牌（红心级牌除外）');
  t.paid[s] = card;
  if (Object.keys(t.paid).length < t.payers.length) return g;
  // everyone paid: who gives to whom
  const [first, second] = t.receivers;
  if (t.kind === 'single') {
    t.gives = [{ from: t.payers[0], to: first, card }];
  } else {
    const [a, b] = t.payers;
    const va = cardLv(t.paid[a], g.level);
    const vb = cardLv(t.paid[b], g.level);
    // the bigger tribute goes to 头游; equal tribute: 头游's 下家 pays 头游 (贡左还右)
    const toFirst = va > vb ? a : vb > va ? b : (first + 1) % 4;
    const other = toFirst === a ? b : a;
    t.gives = [{ from: toFirst, to: first, card: t.paid[toFirst] }, { from: other, to: second, card: t.paid[other] }];
  }
  for (const gv of t.gives) {
    g.hands[gv.from] = g.hands[gv.from].filter(c => c !== gv.card);
    g.hands[gv.to].push(gv.card);
    gv.back = null;
  }
  t.phase = 'back';
  return g;
}

export function returnTribute(g, s, card) {
  const t = g.tribute;
  if (tributeTask(g, s) !== 'back') throw new Error('现在不用你还贡');
  if (!returnChoices(g, s).includes(card)) throw new Error(g.rules.back === 'any' ? '这张牌不在你手里' : '还贡要还 10 或以下的牌');
  const give = t.gives.find(x => x.to === s);
  give.back = card;
  g.hands[s] = g.hands[s].filter(c => c !== card);
  g.hands[give.from].push(card);
  if (t.gives.every(x => x.back != null)) {
    g.step = 'play';
    g.turn = t.gives[0].from; // whoever paid 头游 leads
    g.log.push({ sys: 'tribute', gives: t.gives.map(x => ({ ...x })) });
  }
  return g;
}

/** The combos `cards` could be played as right now (empty = illegal). */
export function playableAs(g, cards) {
  return legalReadings(cards, g.level, g.table?.combo || null);
}

export function play(g, s, cards, type = null) {
  if (g.step !== 'play') throw new Error('现在不能出牌');
  if (g.turn !== s) throw new Error('还没轮到你');
  if (!cards.length) throw new Error('先选牌');
  const hand = g.hands[s];
  if (new Set(cards).size !== cards.length || cards.some(c => !hand.includes(c))) throw new Error('这些牌不在你手里');
  const readings = combosOf(cards, g.level);
  if (!readings.length) throw new Error('不是有效的牌型');
  const ok = readings.filter(c => beats(c, g.table?.combo || null));
  if (!ok.length) throw new Error(g.table ? `管不上：要比「${comboLabel(g.table.combo, g.level)}」大` : '不是有效的牌型');
  const combo = (type && ok.find(c => c.type === type)) || legalReadings(cards, g.level, g.table?.combo || null)[0];
  g.hands[s] = hand.filter(c => !cards.includes(c));
  g.table = { s, cards: [...cards], combo };
  g.passed = [];
  g.jiefeng = null;
  const act = { s, cards: [...cards], combo };
  g.trick.push(act);
  g.log.push(act);
  if (!g.hands[s].length) {
    g.finished.push(s);
    g.log.push({ sys: 'out', s, place: g.finished.length });
    const t = teamOf(s);
    if (isOut(g, partnerOf(s))) return endHand(g, t);
  }
  g.turn = nextActive(g, s);
  return g;
}

export function pass(g, s) {
  if (g.step !== 'play') throw new Error('现在不能操作');
  if (g.turn !== s) throw new Error('还没轮到你');
  if (!g.table) throw new Error('你是首家，必须出牌');
  g.passed.push(s);
  const act = { s, pass: true };
  g.trick.push(act);
  g.log.push(act);
  const owner = g.table.s;
  const need = activeSeats(g).filter(x => x !== owner);
  if (need.every(x => g.passed.includes(x))) {
    // trick over: the last player leads again; if they're out, the partner 接风
    const lead = isOut(g, owner) ? partnerOf(owner) : owner;
    if (lead !== owner) { g.jiefeng = lead; g.log.push({ sys: 'jiefeng', s: lead }); }
    g.table = null;
    g.passed = [];
    g.trick = [];
    g.turn = lead;
  } else {
    g.turn = nextActive(g, s);
  }
  return g;
}

/** Hand over: one team has both players out. Scores levels and checks 过A. */
export function endHand(g, team) {
  const order = [...g.finished, ...activeSeats(g)];
  const winTeam = teamOf(order[0]);
  const place = order.indexOf(partnerOf(order[0])) + 1; // 2, 3 or 4
  const up = place === 2 ? Number(g.rules.up12 || 3) : place === 3 ? 2 : 1;
  const before = [...g.levels];
  const atA = g.level === 14 && g.declarer != null;
  const failLimit = g.rules.aFail === 'never' ? Infinity : Number(g.rules.aFail || 3);
  const notes = [];
  let gameOver = false;
  const failA = t => {
    g.aFails[t] += 1;
    if (g.aFails[t] >= failLimit) {
      g.levels[t] = 2;
      g.aFails[t] = 0;
      notes.push({ kind: 'drop', team: t });
    } else notes.push({ kind: 'fail', team: t, n: g.aFails[t] });
  };
  if (atA && g.declarer === winTeam) {
    const passA = place <= (g.rules.aWin === 'double' ? 2 : 3);
    if (passA) gameOver = true;
    else failA(winTeam);
  } else {
    if (atA) failA(g.declarer);
    g.levels[winTeam] = Math.min(14, g.levels[winTeam] + up);
  }
  g.result = { order, winTeam, place, up: gameOver || (atA && g.declarer === winTeam) ? 0 : up, before, after: [...g.levels], level: g.level, notes, gameOver, team };
  g.history.push({ hand: g.handNo, level: g.level, declarer: g.declarer, winTeam, place, after: [...g.levels], order });
  if (g.history.length > 30) g.history.shift();
  g.declarer = winTeam;
  g.table = null;
  g.turn = null;
  if (gameOver) { g.winner = winTeam; g.step = 'end'; } else g.step = 'hand';
  return g;
}

export function nextHand(g, rng = Math.random) {
  if (g.step !== 'hand') throw new Error('这局还没结束');
  return startHand(g, rng);
}

/** Opponents see an exact count only when the rules allow it. */
export const showCount = (g, n) => g.rules.count !== 'le10' || n <= 10;

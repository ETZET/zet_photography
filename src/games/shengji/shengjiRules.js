// 升级 / 拖拉机 (Tractor, Shengji) — pure rules engine. No React, no I/O.
//
// Four players, partners sit opposite (seats 0&2 vs 1&3), two decks (108 cards).
// Sources for the standard rules + common variants:
//   https://www.pagat.com/kt5/tractor.html            (rules, level table, variants)
//   https://robertying.com/shengji/rules.html         (online rules: throws, kitty ×2×component)
//   https://civ.whu.edu.cn/…/DE84EEC6B38074CE5C331DC6B4E_37346027_4400.doc (甩错牌 拿回几张扣几十分, 抠底 张数×2)
//   https://ioa.cas.cn/tzgg/202112/P020211214755109286144.doc (甩牌失败按最小的那张出)
//
// Cards are strings `${suit}${rank}${deck}`: suit S H C D, rank 2-9 T J Q K A, deck 0/1.
// Jokers: 'XB0' 'XB1' (大王), 'XS0' 'XS1' (小王). Engine mutations throw Chinese errors.

export const SUITS = ['S', 'H', 'C', 'D'];
export const RANKS = '23456789TJQKA';
export const LEVELS = RANKS.split('');
export const SUIT_SYM = { S: '♠', H: '♥', C: '♣', D: '♦' };
export const SUIT_ZH = { S: '黑桃', H: '红桃', C: '梅花', D: '方块' };
export const RED = { H: true, D: true };
export const rankZh = r => (r === 'T' ? '10' : r);
export const TOTAL_POINTS = 200;
export const HAND_SIZE = 25;
export const KITTY_SIZE = 8;
export const DEAL_MS = 280;       // per round of four cards
export const BID_GRACE_MS = 8000; // last chance to declare after the deal

// ------------------------------------------------------------- variants ---
// The first option of each is the recommended default (★ in the lobby).
export const VARIANTS = [
  { key: 'throw', zh: '能不能甩牌', opts: [
    ['yes', '可以甩', '首家可以把同一门里几手别人都管不上的牌（单张、对子、拖拉机）一起出。'],
    ['no', '不能甩', '每次只能出一手：单张、对子或一条拖拉机。'],
  ] },
  { key: 'penalty', zh: '甩牌失败怎么罚', opts: [
    ['per10', '每张罚 10', '有人管得上就算失败：只出被管住的最小那手，其余收回；收回几张罚几十分（比赛常用）。'],
    ['flat10', '罚 10 分', '甩牌失败只出最小那手，固定罚 10 分。'],
    ['none', '不罚分', '甩牌失败只出被管住的最小那手，不罚分（网上常见）。'],
  ] },
  { key: 'bridge', zh: '拖拉机跨级牌', opts: [
    ['skip', '跳过级牌', '级牌不占位：打 8 时 7799 也是拖拉机；主 A 对 → 副级牌对 → 主级牌对 → 小王对 → 大王对也连。'],
    ['gap', '级牌隔断', '级牌把顺子隔开：打 8 时 7799 不连，主 A 对和级牌对也不连；级牌对 → 王对还连。'],
    ['none', '级牌王不连', '只有普通点数能连；级牌对、王对都不算拖拉机。'],
  ] },
  { key: 'kitty', zh: '扣底翻倍', opts: [
    ['cards', '×2×张数', '闲家最后一轮赢了就扣底：底牌分 × 2 × 最后一手的张数（单张×2，对子×4，拖拉机×8）。'],
    ['exp', '逐级翻倍', '单张扣×2，对子×4，两对拖拉机×8，三对×16……每多一对再翻一倍。'],
    ['double', '一律 ×2', '不管最后一手出几张，底牌分都只 ×2。'],
  ] },
  { key: 'fanzhu', zh: '反主', opts: [
    ['yes', '可以反', '发牌时亮一张级牌定主；别人可以亮一对级牌反主，一对王反成无主（小王对 < 大王对）。'],
    ['no', '不能反', '第一个亮主的人说了算，只能自己加固。'],
  ] },
  { key: 'must', zh: '必打', opts: [
    ['none', '只有 A 必打', '升级可以跳级；只有 A 必须坐庄打过才算赢。'],
    ['5tk', '5、10、K 必打', '升到 5、10、K 必须停下来打，不能跳过；A 也必打。'],
    ['ja', 'J、A 必打', '升到 J 必须停下来打；A 也必打。'],
  ] },
  { key: 'start', zh: '从几打起', opts: [
    ['2', '从 2 打', '两队都从 2 开始，先打过 A 的一队赢。'],
    ['5', '从 5 打', '短一点的局。'],
    ['T', '从 10 打', '快速局：从 10 打到 A。'],
  ] },
];
export const DEFAULT_RULES = Object.fromEntries(VARIANTS.map(v => [v.key, v.opts[0][0]]));
export const PRESETS = [
  { id: 'standard', zh: '标准（比赛常用）', desc: '可以甩牌，甩失败每张罚 10 分；扣底 ×2×张数；可以反主；只有 A 必打。', rules: {} },
  { id: 'casual', zh: '休闲（网上常见）', desc: '甩牌失败不罚分，只出最小那手；扣底一律 ×2，打得轻松。', rules: { penalty: 'none', kitty: 'double' } },
  { id: 'strict', zh: '严格（5、10、K 必打）', desc: '5、10、K、A 都必须打；级牌隔断拖拉机；扣底逐级翻倍，最后一轮很刺激。', rules: { must: '5tk', bridge: 'gap', kitty: 'exp' } },
  { id: 'quick', zh: '快速局（从 10 打）', desc: '标准规则，但两队都从 10 开始，一晚上能打完。', rules: { start: 'T' } },
];
export const presetRules = id => ({ ...DEFAULT_RULES, ...(PRESETS.find(p => p.id === id)?.rules || {}) });
export function presetOf(rules = {}) {
  const full = { ...DEFAULT_RULES, ...rules };
  const hit = PRESETS.find(p => VARIANTS.every(v => presetRules(p.id)[v.key] === full[v.key]));
  return hit ? hit.id : 'custom';
}
export const changedRules = rules => VARIANTS.filter(v => (rules?.[v.key] ?? v.opts[0][0]) !== v.opts[0][0]);
export const optLabel = (key, val) => VARIANTS.find(v => v.key === key)?.opts.find(o => o[0] === val)?.[1] || val;

// ---------------------------------------------------------------- cards ---
export const parse = id => ({ s: id[0], r: id[1], d: id[2] });
export const face = id => id.slice(0, 2);
export const isJoker = id => id[0] === 'X';
export function cardPoints(id) {
  const r = id[1];
  if (id[0] === 'X') return 0;
  return r === '5' ? 5 : r === 'T' || r === 'K' ? 10 : 0;
}
export const sumPoints = ids => ids.reduce((a, c) => a + cardPoints(c), 0);

export function newDeck() {
  const out = [];
  for (let d = 0; d < 2; d++) {
    for (const s of SUITS) for (const r of RANKS) out.push(`${s}${r}${d}`);
    out.push(`XB${d}`, `XS${d}`);
  }
  return out;
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** ctx = { level, trump (suit | null = 无主), bridge } */
export const ctxOf = g => ({ level: g.level, trump: g.trump, bridge: g.rules?.bridge || 'skip' });
export const isTrump = (id, ctx) => id[0] === 'X' || id[1] === ctx.level || id[0] === ctx.trump;
/** effective suit: 'T' for every trump */
export const suitOf = (id, ctx) => (isTrump(id, ctx) ? 'T' : id[0]);

/**
 * Position of a card inside its effective suit. Consecutive slots make tractors.
 * mode 'skip' doubles as the card's power (higher = bigger).
 */
export function slot(id, ctx, mode = ctx.bridge || 'skip') {
  const { level, trump } = ctx;
  const plain = mode === 'skip' ? RANKS.replace(level, '') : RANKS;
  const top = plain.length - 1;
  const hasTrumpLevel = !!trump;
  let off, tl, sj;
  if (mode === 'none') { off = top + 10; tl = top + 20; sj = top + 30; }
  else {
    off = top + (mode === 'gap' ? 2 : 1);
    tl = off + 1;
    sj = hasTrumpLevel ? tl + 1 : off + 1;
  }
  const bj = mode === 'none' ? sj + 10 : sj + 1;
  if (id[0] === 'X') return id[1] === 'B' ? bj : sj;
  if (id[1] === level) return id[0] === trump ? tl : off;
  return plain.indexOf(id[1]);
}
export const power = (id, ctx) => slot(id, ctx, 'skip');

/** Sort for display: trumps first (big → small), then suits alternating colour, big → small. */
export function sortHand(ids, ctx) {
  const order = ctx.trump ? [...SUITS.slice(SUITS.indexOf(ctx.trump) + 1), ...SUITS.slice(0, SUITS.indexOf(ctx.trump))] : SUITS;
  // keep colours alternating after removing the trump suit where possible
  const suitRank = s => (s === 'T' ? -1 : order.indexOf(s));
  return [...ids].sort((a, b) => {
    const sa = suitOf(a, ctx), sb = suitOf(b, ctx);
    if (sa !== sb) return suitRank(sa) - suitRank(sb);
    const pa = power(a, ctx), pb = power(b, ctx);
    if (pa !== pb) return pb - pa;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

// ------------------------------------------------------- combinations ---
/**
 * Split cards of ONE effective suit into tractors / pairs / singles, longest tractors first.
 * Returns { tractors: [[ids]], pairs: [[id,id]], singles: [id] } (each tractor sorted low → high).
 */
export function decompose(ids, ctx) {
  const byFace = {};
  ids.forEach(id => { (byFace[face(id)] = byFace[face(id)] || []).push(id); });
  const pairs = [];
  const singles = [];
  Object.values(byFace).forEach(list => {
    if (list.length >= 2) pairs.push(list.slice(0, 2));
    singles.push(...list.slice(list.length >= 2 ? 2 : 0)); // two decks: at most one pair per face
  });
  let rest = pairs.map(p => ({ p, sl: slot(p[0], ctx) })).sort((a, b) => a.sl - b.sl || power(a.p[0], ctx) - power(b.p[0], ctx));
  const tractors = [];
  const loose = [];
  // repeated greedy passes: equal slots (off-suit level pairs) can't chain with each other
  while (rest.length) {
    const used = new Set();
    const chains = [];
    let cur = [];
    let last = null;
    rest.forEach((x, i) => {
      if (last !== null && x.sl === last) return; // same slot: leave for the next pass
      if (last !== null && x.sl === last + 1) cur.push(i);
      else { if (cur.length) chains.push(cur); cur = [i]; }
      last = x.sl;
    });
    if (cur.length) chains.push(cur);
    chains.forEach(ch => {
      ch.forEach(i => used.add(i));
      if (ch.length >= 2) tractors.push(ch.flatMap(i => rest[i].p));
      else loose.push(rest[ch[0]].p);
    });
    rest = rest.filter((_, i) => !used.has(i));
  }
  tractors.sort((a, b) => b.length - a.length);
  return { tractors, pairs: loose, singles };
}

/** Lead "format": tractor lengths (in pairs, desc), pair count, single count. */
export function formatOf(ids, ctx) {
  const d = decompose(ids, ctx);
  return { tractors: d.tractors.map(t => t.length / 2).sort((a, b) => b - a), pairs: d.pairs.length, singles: d.singles.length, n: ids.length };
}
export const componentCount = f => f.tractors.length + f.pairs + f.singles;
export function leadKind(f) {
  if (componentCount(f) > 1) return 'throw';
  if (f.tractors.length) return 'tractor';
  return f.pairs ? 'pair' : 'single';
}
export const KIND_ZH = { single: '单张', pair: '对子', tractor: '拖拉机', throw: '甩牌' };

/** How well a pool of same-suit cards can match a format: [tractor pairs, extra pairs]. */
export function fillMetric(pool, f, ctx) {
  const d = decompose(pool, ctx);
  const chains = d.tractors.map(t => t.length / 2);
  let loose = d.pairs.length;
  let t = 0;
  let need = f.pairs;
  for (const k of f.tractors) {
    let best = -1;
    chains.forEach((m, i) => { if (m >= k && (best < 0 || m < chains[best])) best = i; });
    if (best >= 0) {
      const left = chains[best] - k;
      chains.splice(best, 1);
      if (left >= 2) chains.push(left); else if (left === 1) loose += 1;
      t += k;
    } else if (chains.length) {
      let li = 0;
      chains.forEach((m, i) => { if (m > chains[li]) li = i; });
      const m = chains[li];
      chains.splice(li, 1);
      t += m;
      need += k - m;
    } else need += k;
  }
  const avail = loose + chains.reduce((a, m) => a + m, 0);
  return [t, Math.min(need, avail)];
}

const handOf = (g, seat) => g.hands[seat];
const has = (hand, ids) => {
  const left = [...hand];
  return ids.every(id => { const i = left.indexOf(id); if (i < 0) return false; left.splice(i, 1); return true; });
};
const without = (hand, ids) => {
  const left = [...hand];
  ids.forEach(id => { const i = left.indexOf(id); if (i >= 0) left.splice(i, 1); });
  return left;
};

/** Follow-suit legality. Returns null if OK, else a Chinese reason. */
export function followError(hand, lead, play, ctx) {
  if (play.length !== lead.length) return `要出 ${lead.length} 张（现在选了 ${play.length} 张）`;
  if (!has(hand, play)) return '手里没有这些牌';
  const X = suitOf(lead[0], ctx);
  const mine = hand.filter(c => suitOf(c, ctx) === X);
  const played = play.filter(c => suitOf(c, ctx) === X);
  const needSuit = Math.min(lead.length, mine.length);
  const sname = X === 'T' ? '主牌' : SUIT_ZH[X];
  if (played.length < needSuit) return `必须先跟${sname}（你还有 ${mine.length} 张）`;
  if (mine.length <= lead.length) return null;
  const f = formatOf(lead, ctx);
  const [ht, hp] = fillMetric(mine, f, ctx);
  const [pt, pp] = fillMetric(played, f, ctx);
  if (pt < ht) return '有拖拉机必须跟拖拉机';
  if (pt + pp < ht + hp) return f.tractors.length ? '拖拉机跟不上也要尽量跟对子' : '有对子必须跟对子';
  return null;
}

/** Build a legal follow; `dump` picks filler cards (default: smallest, keep points). */
export function suggestFollow(hand, lead, ctx, { dump = 'low' } = {}) {
  const n = lead.length;
  const X = suitOf(lead[0], ctx);
  const byLow = list => [...list].sort((a, b) => (dump === 'points' ? cardPoints(b) - cardPoints(a) : cardPoints(a) - cardPoints(b)) || power(a, ctx) - power(b, ctx));
  const mine = hand.filter(c => suitOf(c, ctx) === X);
  if (mine.length <= n) {
    const others = hand.filter(c => suitOf(c, ctx) !== X);
    // fillers: avoid trumps and points unless dumping points to a partner
    const rank = c => (isTrump(c, ctx) ? 100 : 0) + (dump === 'points' ? -cardPoints(c) : cardPoints(c)) + power(c, ctx) / 100;
    return [...mine, ...others.sort((a, b) => rank(a) - rank(b)).slice(0, n - mine.length)];
  }
  const f = formatOf(lead, ctx);
  const d = decompose(mine, ctx);
  const chains = d.tractors.map(t => [...t]); // low → high
  const loose = d.pairs.map(p => [...p]);
  const chosen = [];
  let need = f.pairs;
  for (const k of f.tractors) {
    let best = -1;
    chains.forEach((c, i) => { if (c.length / 2 >= k && (best < 0 || c.length < chains[best].length)) best = i; });
    if (best >= 0) {
      const c = chains.splice(best, 1)[0];
      chosen.push(...c.slice(0, 2 * k));
      const left = c.slice(2 * k);
      if (left.length >= 4) chains.push(left); else if (left.length === 2) loose.push(left);
    } else if (chains.length) {
      let li = 0;
      chains.forEach((c, i) => { if (c.length > chains[li].length) li = i; });
      const c = chains.splice(li, 1)[0];
      chosen.push(...c);
      need += k - c.length / 2;
    } else need += k;
  }
  const pairPool = [...loose, ...chains.flatMap(c => Array.from({ length: c.length / 2 }, (_, i) => c.slice(2 * i, 2 * i + 2)))]
    .sort((a, b) => cardPoints(a[0]) - cardPoints(b[0]) || power(a[0], ctx) - power(b[0], ctx));
  pairPool.slice(0, need).forEach(p => chosen.push(...p));
  const rest = byLow(without(mine, chosen));
  chosen.push(...rest.slice(0, n - chosen.length));
  return chosen;
}

/** Does `ids` (same effective suit) match format f exactly? Returns comparison key or null. */
export function matchKey(ids, f, ctx) {
  if (ids.length !== f.n) return null;
  const need = f.tractors.reduce((a, k) => a + k, 0);
  const [t, p] = fillMetric(ids, f, ctx);
  if (t < need || p < f.pairs) return null;
  if (!f.tractors.length && !f.pairs) return Math.max(...ids.map(c => power(c, ctx)));
  const d = decompose(ids, ctx);
  const pairCards = [...d.tractors.flat(), ...d.pairs.flat()];
  return Math.max(...pairCards.map(c => power(c, ctx)));
}

/** Index (into plays) of the current winner. plays: [{ seat, cards }] */
export function winnerIndex(plays, ctx) {
  const lead = plays[0].cards;
  const X = suitOf(lead[0], ctx);
  const f = formatOf(lead, ctx);
  let best = 0;
  let bestTrump = X === 'T';
  let bestKey = matchKey(lead, f, ctx) ?? -1;
  for (let i = 1; i < plays.length; i++) {
    const cs = plays[i].cards;
    const suits = new Set(cs.map(c => suitOf(c, ctx)));
    if (suits.size !== 1) continue;
    const s = [...suits][0];
    if (s !== X && s !== 'T') continue;
    const key = matchKey(cs, f, ctx);
    if (key == null) continue;
    const trump = s === 'T';
    if ((trump && !bestTrump) || (trump === bestTrump && key > bestKey)) { best = i; bestTrump = trump; bestKey = key; }
  }
  return best;
}

// ----------------------------------------------------------- 甩牌 check ---
/** Components of a lead as playable groups (lowest first). */
export function components(ids, ctx) {
  const d = decompose(ids, ctx);
  const out = [
    ...d.tractors.map(c => ({ kind: 'tractor', cards: c, len: c.length / 2 })),
    ...d.pairs.map(c => ({ kind: 'pair', cards: c })),
    ...d.singles.map(c => ({ kind: 'single', cards: [c] })),
  ];
  out.forEach(c => { c.top = Math.max(...c.cards.map(x => power(x, ctx))); });
  return out;
}

/** Can a hand beat this single component (same effective suit)? */
export function beats(hand, comp, X, ctx) {
  const mine = hand.filter(c => suitOf(c, ctx) === X);
  if (comp.kind === 'single') return mine.some(c => power(c, ctx) > comp.top);
  const d = decompose(mine, ctx);
  if (comp.kind === 'pair') return [...d.pairs, ...d.tractors].some(p => Math.max(...p.map(c => power(c, ctx))) > comp.top);
  return d.tractors.some(t => t.length / 2 >= comp.len && power(t[t.length - 1], ctx) > comp.top);
}

/** Resolve a throw: { ok, forced, beaten: [seats], tried } */
export function resolveThrow(g, seat, ids) {
  const ctx = ctxOf(g);
  const X = suitOf(ids[0], ctx);
  const comps = components(ids, ctx);
  const beatable = [];
  const by = new Set();
  comps.forEach(c => {
    for (let s = 0; s < 4; s++) {
      if (s === seat) continue;
      if (beats(handOf(g, s), c, X, ctx)) { beatable.push(c); by.add(s); break; }
    }
  });
  if (!beatable.length) return { ok: true };
  // the smallest beatable part: lowest top card, then the shortest
  beatable.sort((a, b) => a.top - b.top || a.cards.length - b.cards.length);
  return { ok: false, forced: beatable[0].cards, by: [...by] };
}

export function leadError(g, seat, ids) {
  const ctx = ctxOf(g);
  if (!ids.length) return '先选要出的牌';
  if (!has(handOf(g, seat), ids)) return '手里没有这些牌';
  const suits = new Set(ids.map(c => suitOf(c, ctx)));
  if (suits.size > 1) return '首家一次只能出同一门（或全是主牌）';
  const f = formatOf(ids, ctx);
  if (componentCount(f) > 1 && g.rules.throw === 'no') return '本局不能甩牌：一次只出一手（单张、对子或拖拉机）';
  return null;
}

// --------------------------------------------------------------- game ---
export const teamOf = seat => seat % 2;
export const partnerOf = seat => (seat + 2) % 4;
export const nextSeat = seat => (seat + 1) % 4;

export function newGame(players, { rules = DEFAULT_RULES, timeScale = 1 } = {}) {
  const full = { ...DEFAULT_RULES, ...rules };
  const g = {
    seats: players.map(p => p.id),
    rules: full,
    timeScale,
    levels: [full.start, full.start],
    hand: 0,
    dealer: null,
    history: [],
    winner: null,
  };
  startHand(g);
  return g;
}

/** Deal a new hand (progressively, by the clock). */
export function startHand(g, { now = Date.now(), deck } = {}) {
  const d = deck || shuffle(newDeck());
  g.hand += 1;
  g.step = 'deal';
  g.hands = [[], [], [], []];
  // first hand: whoever declares becomes 庄家, so the level is the shared starting level
  g.level = g.dealer == null ? g.levels[0] : g.levels[teamOf(g.dealer)];
  d.slice(0, 100).forEach((c, i) => g.hands[i % 4].push(c));
  g.kitty = d.slice(100);
  g.trump = null;
  g.bid = null;
  g.bids = [];
  g.passes = [];
  g.dealStart = now;
  g.buried = null;
  g.trick = null;
  g.lastTrick = null;
  g.trickNo = 0;
  g.points = 0;
  g.pointCards = [];
  g.throwFail = null;
  g.penalties = [];
  g.result = null;
  g.kittyFlip = null;
  return g;
}

export const dealMs = g => DEAL_MS * (g.timeScale ?? 1);
export const dealEnd = g => g.dealStart + dealMs(g) * HAND_SIZE;
export const bidDeadline = g => dealEnd(g) + BID_GRACE_MS * (g.timeScale ?? 1);
/** How many cards each player has received so far. */
export function dealtCount(g, now = Date.now()) {
  if (g.step !== 'deal') return HAND_SIZE;
  return Math.max(0, Math.min(HAND_SIZE, Math.floor((now - g.dealStart) / dealMs(g)) + 1));
}
export const visibleHand = (g, seat, now) => g.hands[seat].slice(0, dealtCount(g, now));

// bid strength: 1 single level card · 2 pair of level cards · 3 small-joker pair (无主) · 4 big-joker pair (无主)
export const BID_ZH = { 1: '亮主', 2: '一对', 3: '小王对', 4: '大王对' };
export function bidLabel(b) {
  if (!b) return '';
  if (b.suit == null) return `${b.strength === 4 ? '大王' : '小王'}对 · 无主`;
  return `${SUIT_SYM[b.suit]}${b.strength >= 2 ? SUIT_SYM[b.suit] : ''} ${b.strength >= 2 ? '一对' : '一张'}`;
}

/** Bids this seat could make now with the cards it can see. */
export function bidOptions(g, seat, cards) {
  if (g.step !== 'deal') return [];
  const out = [];
  const cur = g.bid;
  const canBeat = (strength, suit) => {
    if (!cur) return true;
    if (strength <= cur.strength) return false;
    if (g.rules.fanzhu === 'no') return cur.seat === seat && cur.suit === suit; // only reinforce your own
    return true;
  };
  for (const s of SUITS) {
    const lv = cards.filter(c => c[0] === s && c[1] === g.level);
    if (lv.length >= 1 && canBeat(1, s)) out.push({ suit: s, strength: 1, cards: lv.slice(0, 1) });
    if (lv.length >= 2 && canBeat(2, s)) out.push({ suit: s, strength: 2, cards: lv.slice(0, 2) });
  }
  const sj = cards.filter(c => c.startsWith('XS'));
  const bj = cards.filter(c => c.startsWith('XB'));
  if (sj.length >= 2 && canBeat(3, null)) out.push({ suit: null, strength: 3, cards: sj });
  if (bj.length >= 2 && canBeat(4, null)) out.push({ suit: null, strength: 4, cards: bj });
  return out;
}

export function declare(g, seat, { suit, strength }, now = Date.now()) {
  if (g.step !== 'deal') throw new Error('发牌已经结束了');
  if (now > bidDeadline(g)) throw new Error('亮主时间已过');
  // only cards already dealt count (a little slack for clock skew between phones)
  const seen = visibleHand(g, seat, now + 2 * dealMs(g));
  const opt = bidOptions(g, seat, seen).find(o => o.suit === suit && o.strength === strength);
  if (!opt) throw new Error(g.bid ? '要更大的牌才能反主' : '手里没有能亮的牌');
  g.bid = { seat, suit, strength, cards: opt.cards };
  g.bids.push({ ...g.bid });
  g.passes = [];
  return g;
}

export function pass(g, seat, now = Date.now()) {
  if (g.step !== 'deal') return g;
  if (!g.passes.includes(seat)) g.passes.push(seat);
  if (g.passes.length === 4 && now >= dealEnd(g)) finishDeal(g);
  return g;
}

/** End of the bidding: set trump + 庄家, give the 底牌 to the 庄家. */
export function finishDeal(g) {
  if (g.step !== 'deal') return g;
  if (g.bid) {
    g.trump = g.bid.suit;
    if (g.dealer == null) g.dealer = g.bid.seat;
  } else {
    // nobody declared: turn up the 底牌 — first level card sets trump, else the biggest card
    if (g.dealer == null) g.dealer = 0;
    const lv = g.kitty.find(c => c[1] === g.level && c[0] !== 'X');
    let pick = lv;
    if (!pick) {
      const plain = g.kitty.filter(c => c[0] !== 'X');
      pick = plain.reduce((b, c) => (!b || RANKS.indexOf(c[1]) > RANKS.indexOf(b[1]) ? c : b), null);
    }
    g.trump = pick ? pick[0] : null;
    g.kittyFlip = { cards: [...g.kitty], by: pick };
  }
  g.level = g.levels[teamOf(g.dealer)];
  g.hands[g.dealer].push(...g.kitty);
  g.step = 'bury';
  return g;
}

export function bury(g, seat, ids) {
  if (g.step !== 'bury') throw new Error('现在不是扣底的时候');
  if (seat !== g.dealer) throw new Error('只有庄家扣底');
  if (ids.length !== KITTY_SIZE) throw new Error(`要扣 ${KITTY_SIZE} 张（现在选了 ${ids.length} 张）`);
  if (!has(g.hands[seat], ids)) throw new Error('手里没有这些牌');
  g.hands[seat] = without(g.hands[seat], ids);
  g.buried = [...ids];
  g.step = 'play';
  g.trick = { leader: g.dealer, plays: [] };
  g.trickNo = 1;
  return g;
}

export const turnOf = g => (g.step === 'play' && g.trick ? (g.trick.leader + g.trick.plays.length) % 4 : null);
export const isDefender = (g, seat) => teamOf(seat) !== teamOf(g.dealer);

/** Dry-run check of a play; null = legal. */
export function playError(g, seat, ids) {
  if (g.step !== 'play') return '现在不能出牌';
  if (turnOf(g) !== seat) return '还没轮到你';
  if (!g.trick.plays.length) return leadError(g, seat, ids);
  return followError(g.hands[seat], g.trick.plays[0].cards, ids, ctxOf(g));
}

export function play(g, seat, ids, now = Date.now()) {
  const err = playError(g, seat, ids);
  if (err) throw new Error(err);
  const ctx = ctxOf(g);
  let cards = [...ids];
  const entry = { seat };
  if (!g.trick.plays.length) {
    g.throwFail = null;
    if (componentCount(formatOf(cards, ctx)) > 1) {
      const res = resolveThrow(g, seat, cards);
      entry.throw = true;
      if (!res.ok) {
        const back = cards.length - res.forced.length;
        const pen = g.rules.penalty === 'per10' ? 10 * back : g.rules.penalty === 'flat10' ? 10 : 0;
        // the thrower's team pays: defenders lose points, or the 庄家 side hands them over
        if (pen) g.points += isDefender(g, seat) ? -pen : pen;
        g.throwFail = { seat, tried: cards, forced: res.forced, by: res.by, penalty: pen, trick: g.trickNo };
        g.penalties.push({ seat, penalty: pen, trick: g.trickNo });
        entry.tried = cards;
        cards = [...res.forced];
      }
    }
  }
  entry.cards = sortHand(cards, ctx);
  g.hands[seat] = without(g.hands[seat], cards);
  g.trick.plays.push(entry);
  if (g.trick.plays.length === 4) finishTrick(g, now);
  return g;
}

function finishTrick(g, now) {
  const ctx = ctxOf(g);
  const plays = g.trick.plays;
  const w = plays[winnerIndex(plays, ctx)].seat;
  const all = plays.flatMap(p => p.cards);
  const pts = sumPoints(all);
  if (isDefender(g, w)) {
    g.points += pts;
    g.pointCards.push(...all.filter(c => cardPoints(c)));
  }
  g.lastTrick = { ...g.trick, winner: w, points: pts, no: g.trickNo, at: now };
  if (g.hands.every(h => h.length === 0)) { endHand(g); return; }
  g.trickNo += 1;
  g.trick = { leader: w, plays: [] };
}

/** 扣底 multiplier for the last trick's lead. */
export function kittyMultiplier(rule, leadCards, ctx) {
  const n = leadCards.length;
  if (rule === 'double') return 2;
  if (rule === 'exp') {
    const f = formatOf(leadCards, ctx);
    const big = f.tractors.length ? f.tractors[0] : f.pairs ? 1 : 0;
    return 2 ** (big + 1);
  }
  return 2 * n;
}

/** Level-change table (pagat / 中国规则通行): defenders' points → { side, up } */
export function levelChange(pts) {
  if (pts <= 0) return { side: 'dealer', up: 3 };
  if (pts < 40) return { side: 'dealer', up: 2 };
  if (pts < 80) return { side: 'dealer', up: 1 };
  return { side: 'defenders', up: Math.floor((pts - 80) / 40) };
}

export const mustLevels = rules => new Set({ none: ['A'], '5tk': ['5', 'T', 'K', 'A'], ja: ['J', 'A'] }[rules.must] || ['A']);

/** Advance a level by k, stopping at the first 必打 level. */
export function advance(level, k, rules) {
  const i = LEVELS.indexOf(level);
  const target = Math.min(i + k, LEVELS.length - 1);
  const must = mustLevels(rules);
  for (let j = i + 1; j < target; j++) if (must.has(LEVELS[j])) return LEVELS[j];
  return LEVELS[target];
}

export function endHand(g) {
  const ctx = ctxOf(g);
  const last = g.lastTrick;
  const kittyPts = sumPoints(g.buried);
  const dug = isDefender(g, last.winner);
  const mult = dug ? kittyMultiplier(g.rules.kitty, last.plays[0].cards, ctx) : 0;
  const bonus = dug ? kittyPts * mult : 0;
  const total = Math.max(0, g.points + bonus);
  const ch = levelChange(total);
  const dt = teamOf(g.dealer);
  const team = ch.side === 'dealer' ? dt : 1 - dt;
  const from = g.levels[team];
  const won = ch.side === 'dealer' && from === 'A';
  const to = won ? 'A' : advance(from, ch.up, g.rules);
  g.levels[team] = to;
  const nextDealer = ch.side === 'dealer' ? partnerOf(g.dealer) : nextSeat(g.dealer);
  g.result = {
    hand: g.hand, dealer: g.dealer, level: g.level, trump: g.trump,
    trickPoints: g.points, kittyPts, dug, mult, bonus, total,
    side: ch.side, team, up: ch.up, from, to, capped: !won && LEVELS.indexOf(to) < Math.min(LEVELS.indexOf(from) + ch.up, 12),
    nextDealer, won, buried: [...g.buried], levels: [...g.levels],
  };
  g.history.push({ hand: g.hand, dealer: g.dealer, level: g.level, trump: g.trump, total, side: ch.side, team, from, to });
  g.step = 'result';
  if (won) { g.winner = dt; g.step = 'end'; }
}

export function nextHand(g, opts = {}) {
  if (g.step !== 'result') throw new Error('这一局还没结束');
  g.dealer = g.result.nextDealer;
  startHand(g, opts);
  return g;
}

// ----------------------------------------------------------------- bots ---
/** Simple legal bot choice for the seat to act. */
export function botLead(g, seat, { throws = false, rnd = Math.random } = {}) {
  const ctx = ctxOf(g);
  const hand = g.hands[seat];
  const bySuit = {};
  hand.forEach(c => { (bySuit[suitOf(c, ctx)] = bySuit[suitOf(c, ctx)] || []).push(c); });
  const plainSuits = Object.keys(bySuit).filter(s => s !== 'T');
  if (throws && rnd() < 0.3) {
    const s = Object.keys(bySuit)[Math.floor(rnd() * Object.keys(bySuit).length)];
    const comps = components(bySuit[s], ctx);
    if (comps.length >= 2) {
      const k = 2 + Math.floor(rnd() * Math.min(3, comps.length - 1));
      const pick = shuffle(comps, rnd).slice(0, k).flatMap(c => c.cards);
      if (!leadError(g, seat, pick)) return pick;
    }
  }
  const pool = plainSuits.length ? plainSuits : ['T'];
  // prefer a tractor, then a big pair, then the top card if it's an A, else the smallest card of the longest suit
  for (const s of pool) {
    const d = decompose(bySuit[s], ctx);
    if (d.tractors.length) return d.tractors[0];
  }
  for (const s of pool) {
    const d = decompose(bySuit[s], ctx);
    const big = d.pairs.find(p => power(p[0], ctx) >= 9);
    if (big) return big;
  }
  for (const s of pool) {
    const top = bySuit[s].reduce((b, c) => (power(c, ctx) > power(b, ctx) ? c : b));
    if (s !== 'T' && top[1] === 'A') return [top];
  }
  const longest = pool.reduce((a, b) => (bySuit[b].length > bySuit[a].length ? b : a));
  const low = bySuit[longest].reduce((b, c) => (cardPoints(c) < cardPoints(b) || (cardPoints(c) === cardPoints(b) && power(c, ctx) < power(b, ctx)) ? c : b));
  return [low];
}

export function botFollow(g, seat) {
  const ctx = ctxOf(g);
  const plays = g.trick.plays;
  const lead = plays[0].cards;
  const w = plays[winnerIndex(plays, ctx)].seat;
  const friendly = teamOf(w) === teamOf(seat);
  const hand = g.hands[seat];
  let pick = suggestFollow(hand, lead, ctx, { dump: friendly ? 'points' : 'low' });
  // single lead, not winning: try to take it with the smallest card that wins
  if (!friendly && lead.length === 1) {
    const cands = sortHand(hand, ctx).reverse().filter(c => !followError(hand, lead, [c], ctx));
    const win = cands.find(c => winnerIndex([...plays, { seat, cards: [c] }], ctx) === plays.length);
    if (win && (cardPoints(win) === 0 || sumPoints(plays.flatMap(p => p.cards)) >= 10)) pick = [win];
  }
  if (followError(hand, lead, pick, ctx)) pick = suggestFollow(hand, lead, ctx);
  return pick;
}

export function botBury(g, seat) {
  const ctx = ctxOf(g);
  const hand = g.hands[seat];
  const plain = hand.filter(c => !isTrump(c, ctx));
  const counts = {};
  plain.forEach(c => { counts[c[0]] = (counts[c[0]] || 0) + 1; });
  const pairs = new Set(decompose(plain, ctx).pairs.flat().concat(...SUITS.map(s => decompose(plain.filter(c => c[0] === s), ctx).tractors.flat())));
  const score = c => (isTrump(c, ctx) ? 1000 : 0) + (pairs.has(c) ? 200 : 0) + cardPoints(c) * 8 + (c[1] === 'A' ? 100 : 0) + power(c, ctx) * 3 + (counts[c[0]] || 0) * 4;
  return [...hand].sort((a, b) => score(a) - score(b)).slice(0, KITTY_SIZE);
}

/** A bot's declaration (or null): bid the suit it holds most of. */
export function botBid(g, seat, now = Date.now(), rnd = Math.random) {
  const seen = visibleHand(g, seat, now);
  const opts = bidOptions(g, seat, seen);
  if (!opts.length) return null;
  const n = dealtCount(g, now);
  const count = s => seen.filter(c => suitOf(c, { ...ctxOf(g), trump: s }) === 'T').length;
  const ok = opts.filter(o => (o.suit == null ? o.strength === 4 || n >= 20 : count(o.suit) >= Math.max(3, n / 4)));
  if (!ok.length || rnd() < 0.5) return null;
  return ok.sort((a, b) => b.strength - a.strength)[0];
}

/** Hint for the human: legal follow, or a simple lead. */
export function hint(g, seat) {
  if (g.step !== 'play' || turnOf(g) !== seat) return [];
  return g.trick.plays.length ? suggestFollow(g.hands[seat], g.trick.plays[0].cards, ctxOf(g)) : botLead(g, seat);
}

export const levelZh = r => rankZh(r);
export const trumpZh = g => (g.trump ? `${SUIT_SYM[g.trump]} ${SUIT_ZH[g.trump]}` : '无主');

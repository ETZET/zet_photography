// 双身份狼人 (dual-identity Werewolf) rules engine. Pure functions that
// mutate a plain JSON game object; the room store syncs it to every phone.
//
import { BALANCE_TABLE } from './balanceTable.js';

// Rules (the common house variant, see the lobby rule card):
//  - Every player gets TWO cards and puts them in order (top first, bottom
//    second). Two cards = two lives; the top card is your identity until it
//    dies, then the bottom card takes over.
//  - Holding any 狼人 card puts you in the wolf camp. Only a wolf card that
//    is currently face-up (active) wakes at night to kill.
//  - Seer checks see the target's CURRENT card only.
//  - Each kill / poison / exile / shot removes one life (the current card).
//    The card's identity is NOT revealed; everyone only sees life counts.
//  - Good wins when every wolf card is gone. Wolves win by "屠边": all the
//    good camp's villager cards, or all its god cards, are gone.

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

export const ROLES = {
  wolf:     { zh: '狼人',  team: 'wolf', sprite: 'wolf' },
  villager: { zh: '村民',  team: 'good', sprite: 'villager' },
  seer:     { zh: '预言家', team: 'good', sprite: 'seer', god: true },
  witch:    { zh: '女巫',  team: 'good', sprite: 'witch', god: true },
  hunter:   { zh: '猎人',  team: 'good', sprite: 'hunter', god: true },
  guard:    { zh: '守卫',  team: 'good', sprite: 'guard', god: true },
  cupid:    { zh: '丘比特', team: 'good', sprite: 'cupid', god: true },
};
export const GODS = ['seer', 'witch', 'hunter', 'guard'];

// 丘比特模式 (special mode, like Avalon's 湖中仙女): one 丘比特 card joins the deck.
export const CUPID_MIN = 8;
// 村规金宝宝: only meaningful with enough players for 3 wolf cards + several 双民.
export const VILLAGE_MIN = 8;
// 只杀金宝宝: every deal has 1–3 金宝宝 (players holding two 村民 cards).
export const BABY_RANGE = [1, 3];
export const CUPID_BLURB = '加入一张丘比特牌（拿到丘比特的人一定是好人阵营）。第一晚丘比特连两个人做情侣（可以连自己），一人出局另一人殉情，情侣放逐投票时不能投对方。人狼恋的情侣和丘比特变成丘比特阵营：活到只剩自己人才赢；情侣殉情后丘比特也不回好人阵营。';
export const JGL_BLURB = '金刚狼：两张牌都是狼。整局一次，可以一刀砍掉一个人的两条命，守卫和女巫的解药都挡不住。有一张狼牌出局后就不能再用。';

export const ROLE_BLURB = {
  wolf: '这张牌在上面时，每晚和狼队友一起刀掉一个人的一条命。手里只要有一张狼牌，你就是狼人阵营。',
  villager: '没有技能。白天靠发言和投票找出狼人。',
  seer: '每晚查验一人：看到的是他「当前那张牌」是好人还是狼人。',
  witch: '一瓶解药、一瓶毒药，整局各一次；同一晚只能用一瓶，不能自救。',
  hunter: '这张牌被刀或被投出局时，可以开枪带走一人的一条命（被毒不能开枪）。',
  guard: '每晚守护一人不被狼刀，不能连续两晚守同一人。同守同救也会死。',
  cupid: '第一晚连两个人做情侣（可以连自己），不管这张牌在上还是在下都会发动。情侣一人出局，另一人殉情。',
};

// 2 cards per player → 2n cards. Villagers fill whatever is left.
// Fallback only; the live recommendation comes from balanceTable.js (same numbers for standard rules).
export const RECOMMENDED = {
  5: { wolves: 2, gods: GODS },
  6: { wolves: 2, gods: ['seer', 'witch', 'hunter'] },
  7: { wolves: 2, gods: ['seer', 'witch'] },
  8: { wolves: 3, gods: GODS },
  9: { wolves: 2, gods: ['seer', 'witch'] },
  10: { wolves: 3, gods: ['seer', 'witch', 'hunter'] },
};

// --------------------------------------------------------- variants ---
// House rules differ a lot between groups, so the host picks. First option = default.
export const VARIANTS = [
  { key: 'order', zh: '牌的顺序', opts: [['choose', '自己排', '看完两张牌，自己决定哪张先用'], ['random', '随机', '发到手就定了，不能调换']] },
  { key: 'wake', zh: '夜里睁眼的狼', opts: [['top', '只有上面的狼牌', '狼牌压在下面时，第一条命没了才睁眼'], ['all', '所有狼牌', '狼牌在下面也睁眼刀人（隐狼）']] },
  { key: 'seer', zh: '预言家验到', opts: [['card', '当前那张牌', '对方上面那张牌是好是狼'], ['camp', '阵营', '对方手里还有狼牌就显示狼人'], ['campJgl', '阵营（金刚狼验成好人）', '手里有狼牌就显示狼人，但金刚狼验出来是好人', true]] },
  { key: 'doubleWolf', zh: '金刚狼（一人两张狼牌）', opts: [['no', '不会发到', '狼牌分散给不同的人'], ['maybe', '随机', '可能发到；拿到的人有金刚狼技能'], ['force', '必有一个', '保证有一人拿两张狼牌'], ['half', '一半机会', '一半的局有一人拿两张狼牌，大家不知道这局有没有', true]] },
  { key: 'selfSave', zh: '女巫自救', opts: [['never', '不能', ''], ['first', '仅首夜', ''], ['always', '可以', '']] },
  { key: 'guardSave', zh: '同守同救', opts: [['dies', '会死', '守卫和女巫救同一人，奶穿'], ['lives', '不死', '']] },
  { key: 'reveal', zh: '失去一条命时', opts: [['hide', '不亮牌', '只公布少了一条命'], ['show', '亮出那张牌', '所有人看到出局的是什么身份']] },
  { key: 'mute', zh: '夜里失去第一条命', opts: [['no', '照常投票', ''], ['yes', '当天不能投票', '第二天恢复']] },
  { key: 'win', zh: '狼人胜利', opts: [['side', '屠边', '好人的村民牌或神牌全灭'], ['baby', '金宝宝', '两张都是村民的人（金宝宝）全部出局，或好人的神牌全灭'], ['city', '屠城', '好人阵营全部出局'], ['babyOnly', '只杀金宝宝', '金宝宝全部出局狼人才赢；神、民全灭都不算', true]] },
  { key: 'babyMeet', zh: '金宝宝开局', opts: [['yes', '互相认识', '金宝宝看得到其他金宝宝是谁'], ['no', '不互认', '只知道自己是金宝宝']] },
  { key: 'cupid', mode: true, zh: '丘比特模式', opts: [['no', '关闭', ''], ['yes', '开启', CUPID_BLURB]] },
  { key: 'pk', zh: '平票', opts: [['no', '无人出局', ''], ['yes', 'PK 再投', '平票的人再各说一轮，其他人再投一次；再平票无人出局']] },
  { key: 'sheriff', zh: '警长', opts: [['no', '没有警长', '手机决定发言顺序'], ['yes', '第一天竞选', '第一天白天先竞选警长：警长的票算 1.5 票，每天决定从左还是从右开始发言、自己最后发言归票；出局时移交或撕掉警徽']] },
  { key: 'peace', zh: '连续平安夜', opts: [['no', '不算', ''], ['three', '三晚好人胜', '连续三个晚上没有人失去命，好人直接获胜']] },
];
export const DEFAULT_RULES = Object.fromEntries(VARIANTS.map(v => [v.key, v.opts[0][0]]));
export const rulesOf = cfg => ({ ...DEFAULT_RULES, ...(cfg?.rules || {}), ...(cfg?.order ? { order: cfg.order } : {}) });
export const changedRules = rules => VARIANTS.filter(v => rules[v.key] !== v.opts[0][0])
  .map(v => ({ key: v.key, zh: v.zh, val: v.opts.find(o => o[0] === rules[v.key])?.[1] }));

// Common setups the host picks from; DIY lives behind a collapsible editor.
export const PRESETS = [
  { id: 'standard', zh: '标准双身份', desc: '自己排牌，只有翻在上面的狼牌睁眼，屠边。最常见的玩法。', rules: {} },
  { id: 'random', zh: '随机牌序', desc: '发到手顺序就定了，不能调换（开心狼人杀的双身份就是这样）。', rules: { order: 'random' } },
  { id: 'hidden', zh: '隐狼局', desc: '狼牌压在下面也睁眼刀人，狼可以把另一张放上面伪装。', rules: { wake: 'all' } },
  { id: 'jgl', zh: '金刚狼局', desc: '保证有一人拿两张狼牌，整局一次可以一刀砍两条命。', rules: { doubleWolf: 'force' } },
  { id: 'mute', zh: '一死禁票', desc: '夜里失去第一条命的人当天不能投票；出局亮牌。', rules: { mute: 'yes', reveal: 'show' } },
  { id: 'baby', zh: '金宝宝局', desc: '双民玩家是金宝宝，开局互相认识；狼人杀光金宝宝或神就赢，连续三个平安夜好人赢。', rules: { win: 'baby', peace: 'three' } },
  { id: 'village', zh: '村规金宝宝', min: VILLAGE_MIN, desc: '第一天竞选警长；每局 1–3 个金宝宝，互相不认识，狼人杀光金宝宝就赢；一半的局藏着金刚狼（没人知道有没有），预言家验阵营但金刚狼验成好人；连续三个平安夜好人赢。', rules: { win: 'babyOnly', babyMeet: 'no', doubleWolf: 'half', seer: 'campJgl', peace: 'three', sheriff: 'yes' } },
  { id: 'city', zh: '屠城局', desc: '狼人要杀光所有好人才赢，好人更有余地，适合新手多的局。', rules: { win: 'city' } },
];
export const presetRules = id => ({ ...DEFAULT_RULES, ...(PRESETS.find(p => p.id === id)?.rules || {}) });
/** Which preset a room config matches ('custom' if the deck or rules were hand-edited). */
export function presetOf(cfg = {}) {
  if (cfg.preset) return cfg.preset;
  const rules = rulesOf(cfg);
  if (cfg.auto === false) return 'custom';
  const hit = PRESETS.find(p => VARIANTS.every(v => v.mode || presetRules(p.id)[v.key] === rules[v.key]));
  return hit ? hit.id : 'custom';
}

// House rules that shift balance a lot; the recommended deck is pre-tuned for each combination.
export const TUNED_KEYS = ['order', 'wake', 'doubleWolf', 'mute', 'win'];
export const tableKey = rules => TUNED_KEYS.map(k => rules[k]).join('|') + (rules.cupid === 'yes' ? '|cupid' : '')
  + (rules.seer === 'campJgl' ? '|sj' : '') + (rules.babyMeet === 'no' ? '|nb' : '') + (rules.peace === 'three' && rules.win === 'babyOnly' ? '|p3' : '');
export const isBabyWin = rules => rules?.win === 'baby' || rules?.win === 'babyOnly';
/** 金刚狼 can be dealt (one player with two wolf cards). */
export const jglPossible = rules => ['maybe', 'force', 'half'].includes(rules?.doubleWolf);
/** Pre-computed recommendation + simulated good win rate, or null. */
export const balanceFor = (n, rules) => BALANCE_TABLE?.[tableKey(rules)]?.[n] || null;

const clampN = n => Math.min(Math.max(n, MIN_PLAYERS), MAX_PLAYERS);
export const defaultConfig = () => ({ auto: true, rules: { ...DEFAULT_RULES } });
export function effectiveConfig(n, cfg = {}) {
  const rules = rulesOf(cfg);
  const rec = balanceFor(clampN(n), rules) || RECOMMENDED[clampN(n)];
  if (cfg.auto !== false || cfg.wolves == null) return { ...rec, auto: true, rules, order: rules.order };
  return { wolves: cfg.wolves, gods: cfg.gods || [], auto: false, rules, order: rules.order };
}

export function buildDeck(n, cfg) {
  const cupid = cfg.rules?.cupid === 'yes' ? ['cupid'] : [];
  const villagers = 2 * n - cfg.wolves - cfg.gods.length - cupid.length;
  if (cfg.wolves < 1) return { error: '至少要 1 张狼牌' };
  if (cfg.wolves > n - 1) return { error: '狼牌太多了' };
  if (cfg.rules?.cupid === 'yes' && n < CUPID_MIN) return { error: `丘比特模式至少要 ${CUPID_MIN} 人` };
  if (cfg.rules?.win === 'babyOnly' && n < VILLAGE_MIN) return { error: `只杀金宝宝至少要 ${VILLAGE_MIN} 人` };
  if (['force', 'half'].includes(cfg.rules?.doubleWolf) && cfg.wolves < 3) return { error: '金刚狼局至少要 3 张狼牌（金刚狼 + 一个狼队友）' };
  if (cfg.rules?.win === 'babyOnly') {
    // non-村民 cards must cover enough players to leave at most 3 双民 (a 金刚狼 covers one player with two cards)
    const spread = cfg.wolves - (['force', 'half'].includes(cfg.rules.doubleWolf) ? 1 : 0) + cfg.gods.length + cupid.length;
    if (n - spread > BABY_RANGE[1]) return { error: `村民牌太多，金宝宝会超过 ${BABY_RANGE[1]} 个：再加 ${n - spread - BABY_RANGE[1]} 张神牌或狼牌` };
  }
  if (villagers < 1) return { error: '至少要留 1 张村民牌' };
  return { cards: [...Array(cfg.wolves).fill('wolf'), ...cfg.gods, ...cupid, ...Array(villagers).fill('villager')], villagers };
}

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function newGame(players, cfg) {
  const rules = cfg.rules || rulesOf(cfg);
  const seats = players.map(p => p.id); // lobby order = real seating (seat 1 = host)
  const n = seats.length;
  const deck = buildDeck(n, cfg);
  if (deck.error) throw new Error(deck.error);
  let cards;
  const wantDouble = rules.doubleWolf === 'force' || (rules.doubleWolf === 'half' && Math.random() < 0.5);
  // Re-deal until nobody holds two wolf cards (spreads the wolf camp over
  // more players) and at least two players are purely good.
  for (let tries = 0; tries < 5000; tries++) {
    cards = shuffle(deck.cards);
    const wolvesOf = i => (cards[2 * i] === 'wolf') + (cards[2 * i + 1] === 'wolf');
    const goodPlayers = seats.filter((_, i) => wolvesOf(i) === 0);
    const doubles = seats.filter((_, i) => wolvesOf(i) === 2).length;
    const dealOk = rules.doubleWolf === 'maybe' || (wantDouble ? doubles === 1 || deck.cards.filter(c => c === 'wolf').length < 2 : doubles === 0);
    const babyN = seats.filter((_, i) => cards[2 * i] === 'villager' && cards[2 * i + 1] === 'villager').length;
    const babyOk = !isBabyWin(rules) || (rules.win === 'babyOnly' ? babyN >= BABY_RANGE[0] && babyN <= BABY_RANGE[1] : babyN > 0);
    // 丘比特 is always a good-camp card: never dealt next to a wolf card
    const cupidOk = seats.every((_, i) => !(cards[2 * i] === 'cupid' && cards[2 * i + 1] === 'wolf') && !(cards[2 * i] === 'wolf' && cards[2 * i + 1] === 'cupid'));
    if (goodPlayers.length >= 2 && dealOk && babyOk && cupidOk) break;
  }
  const hands = {};
  const dead = {};
  seats.forEach((id, i) => {
    const pair = [cards[2 * i], cards[2 * i + 1]];
    // random order mode: deal as-is; choose mode: wolves default to wolf on top
    hands[id] = { cards: pair, locked: rules.order === 'random' };
    dead[id] = 0;
  });
  const g = {
    seats, hands, dead,
    rules,
    step: 'arrange',
    night: 0,
    day: 0,
    acts: null,
    potions: { save: true, poison: true },
    guardLast: null,
    seerLog: [],
    graveyard: [], // [{ id, card, cause, night|day }]
    log: [],       // public: [{ type: 'night'|'vote'|'shot', ... }]
    votes: {},
    hunter: null,
    winner: null,
    jglUsed: false,
    lovers: null,
    peaceStreak: 0,
    sheriff: null,   // 警长 (sheriff variant): id of the badge holder
    elect: null,     // 警长竞选 in progress (day 1)
    timeScale: cfg.timeScale ?? 1,
  };
  g.goodGodsAtStart = goodCampCards(g).gods;
  if (rules.order === 'random') startNight(g);
  return g;
}

// ---------------------------------------------------------------- views ---
export const lives = (g, id) => 2 - g.dead[id];
export const isAlive = (g, id) => g.dead[id] < 2;
export const activeCard = (g, id) => (isAlive(g, id) ? g.hands[id].cards[g.dead[id]] : null);
export const isWolfCamp = (g, id) => g.hands[id].cards.includes('wolf');
export const alivePlayers = g => g.seats.filter(id => isAlive(g, id));
export const holders = (g, role) => g.seats.filter(id => activeCard(g, id) === role);
const R = g => g.rules || DEFAULT_RULES;
const hasLiveWolf = (g, id) => isAlive(g, id) && g.hands[id].cards.slice(g.dead[id]).includes('wolf');
/** Wolves that wake tonight: face-up wolf cards, or (隐狼 variant) any live wolf card. */
export const isNightWolf = (g, id) => (R(g).wake === 'all' ? hasLiveWolf(g, id) : activeCard(g, id) === 'wolf');
export const activeWolves = g => g.seats.filter(id => isNightWolf(g, id));
/** Players who lost their first life last night and must sit out today's vote (variant). */
export const isMuted = (g, id) => R(g).mute === 'yes' && g.step === 'vote' && (g.muted || []).includes(id);
/** 金刚狼: holds two wolf cards, both still alive, skill unused, awake tonight. */
export const isJgl = (g, id) => g.hands[id].cards.every(c => c === 'wolf');
export const canDouble = (g, id) => isJgl(g, id) && g.dead[id] === 0 && !g.jglUsed && isNightWolf(g, id);
/** 金宝宝: both cards are villagers. They know each other from the start (金宝宝 variant). */
export const isBaby = (g, id) => g.hands[id].cards.every(c => c === 'villager');
export const babies = g => g.seats.filter(id => isBaby(g, id));
/** 丘比特: whoever holds the card links two lovers on night 1, whichever way up the card is. */
export const cupidOf = g => g.seats.find(id => g.hands[id].cards.includes('cupid')) || null;
export const isLover = (g, id) => !!g.lovers?.includes(id);
export const partnerOf = (g, id) => (isLover(g, id) ? g.lovers.find(x => x !== id) : null);
/** 人狼恋: lovers from different camps (+ 丘比特 if not a lover) become a third party. */
export function thirdParty(g) {
  if (!g.lovers) return [];
  const [a, b] = g.lovers;
  if (isWolfCamp(g, a) === isWolfCamp(g, b)) return [];
  const c = cupidOf(g);
  return [...new Set([a, b, ...(c ? [c] : [])])];
}
const loversAlive = g => !!g.lovers && g.lovers.every(id => isAlive(g, id));
export const voters = g => alivePlayers(g).filter(id => !isMuted(g, id) && !(g.pk || []).includes(id));

function goodCampCards(g) {
  let villagers = 0;
  let gods = 0;
  // 人狼恋: the couple and 丘比特 never count for the good camp, even after the couple is gone
  const tp = thirdParty(g);
  for (const id of g.seats) {
    if (isWolfCamp(g, id) || tp.includes(id)) continue;
    g.hands[id].cards.slice(g.dead[id]).forEach(c => { if (c === 'villager') villagers++; else gods++; });
  }
  return { villagers, gods };
}
const wolfCardsLeft = g => g.seats.reduce((n, id) => n + g.hands[id].cards.slice(g.dead[id]).filter(c => c === 'wolf').length, 0);

export function score(g) {
  const { villagers, gods } = goodCampCards(g);
  return { wolves: wolfCardsLeft(g), villagers, gods, babies: babies(g).filter(id => isAlive(g, id)).length };
}

// -------------------------------------------------------------- arrange ---
export function swapCards(g, id) {
  if (g.step !== 'arrange') throw new Error('已经开始了');
  const h = g.hands[id];
  if (h.locked) throw new Error('顺序已锁定');
  h.cards.reverse();
}

export function lockCards(g, id) {
  if (g.step !== 'arrange') return;
  g.hands[id].locked = true;
  if (g.seats.every(s => g.hands[s].locked)) startNight(g);
}

// ---------------------------------------------------------------- night ---
// Nights are clock-driven so their length leaks nothing: the witch phase always
// happens (a silent stand-in when no witch can act) and dawn never comes before
// NIGHT_MIN plus some jitter. The host's phone calls settleNight() when due.
export const NIGHT_MIN_MS = 30_000;
export const FORCE_AFTER_MS = 75_000;
const scale = g => g.timeScale ?? 1;
const jitter = (lo, hi) => lo + Math.random() * (hi - lo);

function startNight(g, now = Date.now()) {
  g.night += 1;
  g.step = 'night';
  g.acts = { guard: null, wolves: {}, seer: null, kill: null, save: false, poison: null, witchDone: false, double: null, doubleKill: false, forced: false };
  g.nightStart = now;
  g.settleAt = null;
  g.votes = {};
  g.pk = null;
  g.dusk = null;
  advanceNight(g, now);
}

/** Who still has to act this night (for the progress counter / waiting screens). */
export function nightPending(g) {
  const a = g.acts;
  if (a.forced) return [];
  const out = [];
  holders(g, 'guard').forEach(id => { if (!a.guard) out.push(id); });
  activeWolves(g).forEach(id => { if (!(id in a.wolves)) out.push(id); });
  holders(g, 'seer').forEach(id => { if (!a.seer) out.push(id); });
  const c = cupidOf(g);
  if (R(g).cupid === 'yes' && g.night === 1 && c && !g.lovers && isAlive(g, c)) out.push(c);
  return out;
}

export function cupidAct(g, id, a, b) {
  must(g.step === 'night' && g.night === 1 && cupidOf(g) === id && !g.lovers, '现在不能连情侣');
  must(a && b && a !== b && isAlive(g, a) && isAlive(g, b), '选两个不同的人');
  g.lovers = [a, b];
  advanceNight(g);
}

export const witchCanAct = g => holders(g, 'witch').length > 0 && (g.potions.save || g.potions.poison);

function advanceNight(g, now = Date.now()) {
  if (g.step !== 'night' || nightPending(g).length) return;
  g.acts.kill = wolfDecision(g);
  // 金刚狼's double strike only fires if the pack ends up on the 金刚狼's own pick
  const d = g.acts.double;
  g.acts.doubleKill = !!(d && g.acts.kill && g.acts.wolves[d] === g.acts.kill && canDouble(g, d));
  g.step = 'witch';
  if (!witchCanAct(g) || g.acts.forced) {
    g.acts.witchDone = true; // nobody to wake: pretend for a plausible while
    g.settleAt = Math.max(g.nightStart + NIGHT_MIN_MS * scale(g), now + jitter(6000, 14000) * scale(g));
  }
}

/** Host's phone: dawn once the witch is done and the minimum night length has passed. */
export function settleNight(g, now = Date.now()) {
  if (g.step !== 'witch' || !g.acts.witchDone || g.settleAt == null || now < g.settleAt) return false;
  resolveNight(g, now);
  return true;
}

/** Host override when someone's phone is asleep: missing actions count as "did nothing". */
export function forceNight(g, now = Date.now()) {
  must(g.step === 'night' || g.step === 'witch', '现在不是夜晚');
  must(now - g.nightStart >= FORCE_AFTER_MS * scale(g), '再等等，夜里还有人在操作');
  g.acts.forced = true;
  if (g.step === 'night') advanceNight(g, now);
  else if (!g.acts.witchDone) { g.acts.witchDone = true; g.settleAt = now; }
  settleNight(g, now);
}

/** Majority of active wolves' picks; ties go to the lowest-seat wolf's pick. */
export function wolfDecision(g) {
  const picks = activeWolves(g).map(id => g.acts.wolves[id]).filter(Boolean);
  if (!picks.length) return null;
  const count = {};
  picks.forEach(t => { count[t] = (count[t] || 0) + 1; });
  const best = Math.max(...Object.values(count));
  return picks.find(t => count[t] === best);
}

const must = (cond, msg) => { if (!cond) throw new Error(msg); };

export function guardAct(g, id, target) {
  must(g.step === 'night' && activeCard(g, id) === 'guard', '现在不能守护');
  must(isAlive(g, target), '他已经出局了');
  must(target !== g.guardLast, '不能连续两晚守同一个人');
  g.acts.guard = target;
  advanceNight(g);
}

export function wolfAct(g, id, target, { double = false } = {}) {
  must(g.step === 'night' && isNightWolf(g, id), '现在不能刀人');
  must(isAlive(g, target), '他已经出局了');
  if (double) must(canDouble(g, id), '现在不能用金刚狼技能');
  g.acts.wolves[id] = target;
  if (double) g.acts.double = id;
  else if (g.acts.double === id) g.acts.double = null;
  advanceNight(g);
}

/** What a seer check on `id` would show right now (true = 狼人). */
export function seerSeesWolf(g, id) {
  const sr = R(g).seer;
  if (sr === 'camp') return hasLiveWolf(g, id);
  if (sr === 'campJgl') return hasLiveWolf(g, id) && !isJgl(g, id); // 村规: 金刚狼 checks as 好人
  return activeCard(g, id) === 'wolf';
}
export const seerByCamp = rules => rules?.seer === 'camp' || rules?.seer === 'campJgl';

export function seerAct(g, id, target) {
  must(g.step === 'night' && activeCard(g, id) === 'seer', '现在不能查验');
  must(target !== id && isAlive(g, target), '选一个还在场的其他人');
  g.acts.seer = target;
  const wolf = seerSeesWolf(g, target);
  g.seerLog.push({ night: g.night, from: id, to: target, wolf });
  advanceNight(g);
}

export function witchAct(g, id, { save = false, poison = null } = {}, now = Date.now()) {
  must(g.step === 'witch' && activeCard(g, id) === 'witch' && !g.acts.witchDone, '现在不能用药');
  must(!(save && poison), '同一晚只能用一瓶药');
  if (save) {
    must(g.potions.save, '解药已经用过了');
    must(g.acts.kill, '今晚没有人被刀');
    must(!g.acts.doubleKill, '金刚狼的一刀救不了');
    if (g.acts.kill === id) must(canSelfSave(g), R(g).selfSave === 'first' ? '女巫只有第一晚能自救' : '女巫不能自救');
  }
  if (poison) {
    must(g.potions.poison, '毒药已经用过了');
    must(isAlive(g, poison), '他已经出局了');
  }
  g.acts.save = !!save;
  g.acts.poison = poison || null;
  g.acts.witchDone = true;
  g.settleAt = Math.max(g.nightStart + NIGHT_MIN_MS * scale(g), now + jitter(1500, 5000) * scale(g));
}

export const canSelfSave = g => R(g).selfSave === 'always' || (R(g).selfSave === 'first' && g.night === 1);

function loseLife(g, id, cause, when) {
  if (!isAlive(g, id)) return null;
  const card = activeCard(g, id);
  g.dead[id] += 1;
  g.graveyard.push({ id, card, cause, ...when });
  g.lostNow = [...(g.lostNow || []), { id, card, cause }];
  // 殉情: when a lover is out for good, the other one goes too
  const mate = !isAlive(g, id) && partnerOf(g, id);
  if (mate && isAlive(g, mate)) while (isAlive(g, mate)) loseLife(g, mate, 'love', when);
  return card;
}

const loveDeaths = g => { const ids = [...new Set((g.lostNow || []).filter(l => l.cause === 'love').map(l => l.id))]; return ids.length ? ids : undefined; };

function resolveNight(g) {
  const a = g.acts;
  const when = { night: g.night };
  const lost = [];
  if (a.kill && a.doubleKill) {
    g.jglUsed = true;
    lost.push({ id: a.kill, card: loseLife(g, a.kill, 'wolf', when) });
    lost.push({ id: a.kill, card: loseLife(g, a.kill, 'wolf', when) });
  } else if (a.kill) {
    const guarded = a.guard === a.kill;
    const dies = guarded && a.save ? R(g).guardSave === 'dies' : !guarded && !a.save; // 同守同救
    if (dies) lost.push({ id: a.kill, card: loseLife(g, a.kill, 'wolf', when) });
  }
  if (a.save) g.potions.save = false;
  if (a.poison) { g.potions.poison = false; lost.push({ id: a.poison, card: loseLife(g, a.poison, 'poison', when) }); }
  (g.lostNow || []).filter(l => l.cause === 'love').forEach(l => lost.push({ id: l.id, card: l.card }));
  g.history = [...(g.history || []), {
    night: g.night, guard: a.guard, wolves: { ...a.wolves }, kill: a.kill, double: a.doubleKill || undefined,
    save: a.save ? a.kill : null, poison: a.poison, seer: g.seerLog.find(l => l.night === g.night) || null, forced: a.forced || undefined,
    lovers: g.night === 1 && g.lovers ? [...g.lovers] : undefined,
  }];
  g.muted = lost.map(l => l.id).filter(id => g.dead[id] === 1);
  if (R(g).reveal !== 'show') lost.forEach(l => { delete l.card; });
  g.guardLast = a.guard || null;
  g.day = g.night;
  g.log.push({ type: 'night', night: g.night, lost, double: a.doubleKill || undefined });
  g.lastNight = { night: g.night, lost };
  g.peaceStreak = lost.length ? 0 : (g.peaceStreak || 0) + 1;
  afterLoss(g, 'day');
}

// -------------------------------------------------------------- confirm ---
// Everyone who just lost a life gets the same private "you lost a life" card;
// a hunter (not poisoned) chooses there whether to shoot. Nobody else can tell
// which of them is the hunter, so under 不亮牌 the hunter can keep the gun hidden.
function afterLoss(g, then) {
  const lost = g.lostNow || [];
  g.lostNow = [];
  if (checkWin(g)) return;
  const ids = [...new Set(lost.map(l => l.id))];
  if (!ids.length) { proceed(g, then); return; }
  const hunter = lost.find(l => l.card === 'hunter' && l.cause !== 'poison' && l.cause !== 'love' && !g.hunterUsed)?.id || null;
  g.confirm = { ids, acked: {}, hunter, then, lost };
  g.step = 'confirm';
}

function proceed(g, then) {
  if (then === 'day' && R(g).sheriff === 'yes' && !g.elected) enterElection(g);
  else if (then === 'day') enterDay(g);
  else if (then === 'dusk') enterDusk(g);
  else enterDay(g);
}

/** shoot: target id / null (hunter only; others just acknowledge). */
export function ackLoss(g, id, { shoot = null } = {}) {
  const c = g.confirm;
  must(g.step === 'confirm' && c.ids.includes(id), '现在不用确认');
  if (id in c.acked) return;
  must(!badgePending(g, id), '先决定警徽交给谁');
  if (shoot) {
    must(c.hunter === id, '你不能开枪');
    must(shoot !== id && isAlive(g, shoot), '选一个还在场的其他人');
  }
  c.acked[id] = shoot || null;
  if (c.hunter === id) {
    g.hunterUsed = true;
    if (shoot) {
      const card = loseLife(g, shoot, 'shot', { day: g.day });
      const show = R(g).reveal === 'show';
      g.log.push({ type: 'shot', day: g.day, from: show ? id : undefined, to: shoot, card: show ? card : undefined, love: loveDeaths(g) });
      if (checkWin(g)) return;
      const extra = (g.lostNow || []).map(l => l.id).filter(x => !c.ids.includes(x));
      c.ids.push(...extra);
      c.lost.push(...(g.lostNow || []));
      g.lostNow = [];
      g.shotToday = [...(g.shotToday || []), shoot];
    } else if (R(g).reveal === 'show') {
      g.log.push({ type: 'shot', day: g.day, from: id, to: null });
    }
  }
  if (c.ids.every(x => x in c.acked)) {
    const then = c.then;
    g.confirm = null;
    proceed(g, then);
  }
}

// ------------------------------------------------------------------ day ---
/**
 * No 警长, so the app plays 法官 for the speaking order: start next to last
 * night's first victim (死左 / 死右, picked at random); after a 平安夜 start
 * from a random seat. Seat numbers run clockwise, so 'up' = next seat number.
 * Players who died for good last night give 遗言 first.
 */
function enterDay(g, now = Date.now()) {
  g.step = 'day';
  const n = g.seats.length;
  const lost = g.lastNight?.night === g.day ? g.lastNight.lost : [];
  const lastWords = [...new Set(lost.map(l => l.id))].filter(id => !isAlive(g, id) && g.day === 1);
  g.shotToday = [];
  if (g.sheriff && isAlive(g, g.sheriff)) {
    // 警长 picks 警左 / 警右, then speaks last (归票)
    g.speak = { order: lastWords, lastWords, at: 0, since: now, dir: null, after: null, pk: false, sheriff: g.sheriff, pick: true };
    return;
  }
  const victim = lost[0]?.id;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const from = victim ? g.seats.indexOf(victim) + dir : Math.floor(Math.random() * n);
  const order = [];
  for (let k = 0; k < n; k++) {
    const id = g.seats[(((from + dir * k) % n) + n) % n];
    if (isAlive(g, id)) order.push(id);
  }
  g.speak = { order: [...lastWords, ...order], lastWords, at: 0, since: now, dir: dir === 1 ? 'up' : 'down', after: victim || null, pk: false };
}

/** 警长 (or the host for a sleeping phone) picks the direction: 'up' = 号码从小到大. */
export function sheriffOrder(g, id, dir, isHost = false, now = Date.now()) {
  const sp = g.speak;
  must(g.step === 'day' && sp?.pick, '现在不用选发言顺序');
  must(isHost || id === g.sheriff, '由警长决定发言顺序');
  must(dir === 'up' || dir === 'down', '选一个方向');
  const n = g.seats.length;
  const d = dir === 'up' ? 1 : -1;
  const at = g.seats.indexOf(g.sheriff);
  const order = [];
  for (let k = 1; k <= n; k++) {
    const pid = g.seats[(((at + d * k) % n) + n) % n];
    if (isAlive(g, pid) && !order.includes(pid)) order.push(pid);
  }
  // the 警长 (seat at + n*d) lands last naturally
  sp.order = [...sp.lastWords, ...order];
  sp.dir = dir;
  sp.pick = false;
  if (sp.at >= sp.lastWords.length) sp.since = now;
}

/** Current speaker (or the host) passes the turn to the next speaker. */
export function nextSpeaker(g, id, isHost = false, now = Date.now()) {
  must(['day', 'dusk', 'elect'].includes(g.step) && (g.speak || g.dusk || g.elect), '现在不是发言时间');
  const sp = g.step === 'dusk' ? g.dusk : g.step === 'elect' ? g.elect : g.speak;
  must(g.step !== 'elect' || sp.phase === 'speak', '现在不是发言时间');
  must(isHost || sp.order[sp.at] === id, '还没轮到你');
  if (sp.at < sp.order.length) { sp.at += 1; sp.since = now; }
}
export function speakerNow(g) {
  if (g.step === 'elect') return g.elect?.phase === 'speak' ? g.elect.order[g.elect.at] || null : null;
  const sp = g.step === 'day' ? g.speak : g.step === 'dusk' ? g.dusk : null;
  return sp ? sp.order[sp.at] || null : null;
}

export function startVote(g) {
  must(g.step === 'day', '现在不能投票');
  must(!g.speak?.pick, '先等警长决定发言顺序');
  g.step = 'vote';
  g.votes = {};
  if (!voters(g).length) { // everyone left is muted / on the PK stand
    g.log.push({ type: 'vote', day: g.day, votes: {}, out: null, tie: false, pk: !!g.pk });
    g.pk = null;
    enterDusk(g);
  }
}

/** Who may be voted for right now (PK round: only the tied players). */
export const candidates = g => (g.pk ? g.pk.filter(id => isAlive(g, id)) : alivePlayers(g));

/** target = player id, or null to abstain. Voting closes when everyone alive has voted. */
export function castVote(g, id, target) {
  must(g.step === 'vote' && isAlive(g, id), '你现在不能投票');
  must(!isMuted(g, id), '你昨晚失去了第一条命，今天不能投票');
  must(!(g.pk || []).includes(id), 'PK 台上的人不投票');
  must(target === null || (isAlive(g, target) && candidates(g).includes(target)), g.pk ? '只能投 PK 台上的人' : '他已经出局了');
  must(target === null || target !== partnerOf(g, id), '情侣不能投对方');
  g.votes[id] = target;
  const vs = voters(g);
  if (!vs.every(v => v in g.votes)) return;

  const tally = {};
  vs.forEach(v => { const t = g.votes[v]; if (t) tally[t] = (tally[t] || 0) + voteWeight(g, v); });
  const best = Math.max(0, ...Object.values(tally));
  const top = g.seats.filter(t => tally[t] === best && best > 0);
  const out = top.length === 1 ? top[0] : null;
  const tie = top.length > 1;
  const card = out ? loseLife(g, out, 'vote', { day: g.day }) : null;
  g.log.push({ type: 'vote', day: g.day, votes: { ...g.votes }, sheriff: g.sheriff && vs.includes(g.sheriff) ? g.sheriff : undefined, out, tie, pk: !!g.pk || undefined, card: R(g).reveal === 'show' ? card : undefined, love: loveDeaths(g) });
  if (tie && R(g).pk === 'yes' && !g.pk) {
    // PK: the tied players speak again, everyone else votes once more
    g.pk = top;
    g.step = 'day';
    g.speak = { order: top, lastWords: [], at: 0, since: Date.now(), dir: 'up', after: null, pk: true };
    return;
  }
  g.pk = null;
  g.voteOut = out;
  afterLoss(g, 'dusk');
}

// -------------------------------------------------------------- sheriff ---
// 警长 variant. Day 1, after dawn: everyone alive says 上警 or not; the
// candidates speak (any of them may 退水 before the vote); everyone who never
// ran votes. A tie gets one PK round (the tied speak again, same voters);
// a second tie, nobody running or nobody left to vote = 警徽流失.
// The 警长's exile vote counts 1.5, they choose 警左 / 警右 each day and speak
// last; when out for good they pass the badge on or tear it up.
export const voteWeight = (g, id) => (g.sheriff === id ? 1.5 : 1);
/** The 警长 is out for good and hasn't handed the badge on yet. */
export const badgePending = (g, id) => g.sheriff === id && !isAlive(g, id);

function enterElection(g, now = Date.now()) {
  g.step = 'elect';
  g.elect = { phase: 'sign', sign: {}, runners: [], quit: [], order: [], at: 0, since: now, votes: {}, pk: null };
}

/** Everyone who stood for 警长 at the start (退水 included) — they don't vote. */
export const electVoters = g => (g.elect ? alivePlayers(g).filter(id => g.elect.sign[id] !== true) : []);
/** Who can still be voted for. */
export const electCandidates = g => (g.elect ? (g.elect.pk || g.elect.runners).filter(id => isAlive(g, id) && !g.elect.quit.includes(id)) : []);

function endElection(g, to, extra = {}) {
  g.sheriff = to || null;
  g.log.push({ type: 'sheriff', day: g.day, to: to || null, ...extra });
  g.elect = null;
  g.elected = true;
  enterDay(g);
}

function electSpeeches(g, ids, now) {
  const e = g.elect;
  const n = ids.length;
  const from = Math.floor(Math.random() * n);
  const dir = Math.random() < 0.5 ? 1 : -1;
  e.order = Array.from({ length: n }, (_, k) => ids[(((from + dir * k) % n) + n) % n]);
  e.at = 0;
  e.since = now;
  e.phase = 'speak';
  e.votes = {};
}

function afterSign(g, now) {
  const e = g.elect;
  e.runners = g.seats.filter(id => e.sign[id] === true);
  if (!e.runners.length) return endElection(g, null, { reason: 'none' });
  if (e.runners.length === 1) return endElection(g, e.runners[0], { reason: 'only' });
  return electSpeeches(g, e.runners, now);
}

/** 上警 (run = true) or not. Once everyone alive has answered, speeches start. */
export function electSign(g, id, run, now = Date.now()) {
  const e = g.elect;
  must(g.step === 'elect' && e.phase === 'sign', '报名已经结束');
  must(isAlive(g, id), '你已出局');
  e.sign[id] = !!run;
  if (alivePlayers(g).every(x => x in e.sign)) afterSign(g, now);
}

/** Host: whoever hasn't answered doesn't run. */
export function electCloseSign(g, isHost, now = Date.now()) {
  must(isHost, '由房主操作');
  const e = g.elect;
  must(g.step === 'elect' && e.phase === 'sign', '报名已经结束');
  alivePlayers(g).forEach(x => { if (!(x in e.sign)) e.sign[x] = false; });
  afterSign(g, now);
}

/** 退水: a candidate drops out before the vote (can't vote either). */
export function electQuit(g, id, now = Date.now()) {
  const e = g.elect;
  must(g.step === 'elect' && e.phase === 'speak' && !e.pk, '现在不能退水');
  must(e.runners.includes(id) && !e.quit.includes(id), '你不在警上');
  e.quit.push(id);
  const idx = e.order.indexOf(id);
  e.order.splice(idx, 1);
  if (idx < e.at) e.at -= 1;
  else if (idx === e.at) e.since = now;
  const left = electCandidates(g);
  if (left.length <= 1) endElection(g, left[0] || null, { reason: left.length ? 'only' : 'none' });
}

/** Host opens the 警长 vote (警下 players vote). */
export function electStartVote(g, isHost) {
  must(isHost, '由房主开启投票');
  const e = g.elect;
  must(g.step === 'elect' && e.phase === 'speak', '现在不能投票');
  if (!electVoters(g).length) return endElection(g, null, { reason: 'novoters' });
  e.phase = 'vote';
  e.votes = {};
}

/** target = candidate id, or null to abstain. */
export function electVote(g, id, target, now = Date.now()) {
  const e = g.elect;
  must(g.step === 'elect' && e.phase === 'vote', '现在不是警长投票');
  must(electVoters(g).includes(id), '警上的人不投票');
  must(target === null || electCandidates(g).includes(target), '只能投警上的人');
  e.votes[id] = target;
  const vs = electVoters(g);
  if (!vs.every(v => v in e.votes)) return;
  const tally = {};
  vs.forEach(v => { const t = e.votes[v]; if (t) tally[t] = (tally[t] || 0) + 1; });
  const best = Math.max(0, ...Object.values(tally));
  const top = g.seats.filter(t => tally[t] === best && best > 0);
  const votes = { ...e.votes };
  if (top.length === 1) return endElection(g, top[0], { votes, pk: !!e.pk || undefined });
  if (top.length > 1 && !e.pk) {
    g.log.push({ type: 'sheriffTie', day: g.day, votes, tie: top });
    e.pk = top;
    return electSpeeches(g, top, now);
  }
  return endElection(g, null, { votes, reason: top.length ? 'tie' : 'abstain', pk: !!e.pk || undefined });
}

/** The fallen 警长 hands the badge to someone alive, or tears it up (to = null). */
export function passBadge(g, id, to) {
  must(g.step === 'confirm' && badgePending(g, id), '现在不能移交警徽');
  must(to === null || (to !== id && isAlive(g, to)), '选一个还在场的人');
  g.sheriff = to;
  g.log.push({ type: 'badge', day: g.day, night: g.confirm?.then === 'day' ? g.night : undefined, from: id, to });
}

// ----------------------------------------------------------------- dusk ---
// Between the vote and nightfall: whoever is now out for good gives 遗言,
// then the host calls 天黑请闭眼. Nobody's night panel shows up early.
function enterDusk(g, now = Date.now()) {
  g.step = 'dusk';
  const gone = [g.voteOut, ...(g.shotToday || [])].filter(id => id && !isAlive(g, id));
  g.dusk = { order: [...new Set(gone)], at: 0, since: now };
  g.voteOut = null;
}

export function nightfall(g, id, isHost, now = Date.now()) {
  must(g.step === 'dusk', '现在不能天黑');
  must(isHost, '由房主宣布天黑');
  startNight(g, now);
}

// ------------------------------------------------------------------ end ---
function checkWin(g) {
  const s = score(g);
  let winner = null;
  let reason = '';
  const win = R(g).win;
  const tp = thirdParty(g);
  const tpAlive = tp.length > 0 && loversAlive(g);
  if (tpAlive && alivePlayers(g).every(id => tp.includes(id))) { winner = 'love'; reason = '丘比特阵营：场上只剩情侣（和丘比特）'; }
  else if (tpAlive) { /* the couple must go before good or wolves can win */ }
  else if (s.wolves === 0) { winner = 'good'; reason = '所有狼牌都出局了'; }
  else if (R(g).peace === 'three' && g.peaceStreak >= 3) { winner = 'good'; reason = '连续三个平安夜'; }
  else if (win === 'city') { if (s.villagers + s.gods === 0) { winner = 'wolf'; reason = '屠城：好人阵营全部出局'; } }
  else if (isBabyWin({ win }) && s.babies === 0) { winner = 'wolf'; reason = '金宝宝全部出局'; }
  else if (win === 'babyOnly') { /* 村规: only the 金宝宝 count */ }
  else if (win !== 'baby' && s.villagers === 0) { winner = 'wolf'; reason = '屠边：好人阵营的村民牌全部出局'; }
  else if (g.goodGodsAtStart > 0 && s.gods === 0) { winner = 'wolf'; reason = win === 'baby' ? '好人阵营的神牌全部出局' : '屠边：好人阵营的神牌全部出局'; }
  if (!winner) return false;
  g.winner = winner;
  g.reason = reason;
  g.step = 'end';
  return true;
}

export const CAUSE_ZH = { wolf: '被狼刀', poison: '被毒', vote: '被投出', shot: '被猎人带走', love: '殉情' };

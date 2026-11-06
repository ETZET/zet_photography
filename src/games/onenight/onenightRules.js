// 一夜狼 (one-night werewolf) rules engine. Pure functions that mutate a plain
// JSON game object; the room store syncs it to every phone. No React here.
//
// The game (generic one-night social deduction, our own role names):
//  - 3–10 players. The deck has players + 3 cards; every player gets one card,
//    the other 3 lie face down in the middle (公共牌).
//  - One night. Roles wake in a fixed order and always act on the card they
//    were DEALT (their original role), even if it was moved earlier:
//      狼人 → 爪牙 → 双子 → 预言家 → 夜贼 → 搅局者 → 醉汉 → 夜猫子
//  - On phones everybody acts at the same time; the engine replays the swaps
//    in wake order, so the outcome equals the sequential narrator version.
//    Every role before 夜贼 only looks, so their info is the dealt cards; 夜贼
//    is the first swap, so he sees the card he took; 夜猫子 needs the final
//    card and only sees it once everyone has acted and the public timeline
//    has reached the 夜猫子 slot.
//  - Day: discussion timer, then a simultaneous secret vote revealed at once.
//    Most votes are out; ties → everyone tied is out; nobody above 1 vote →
//    nobody out. A 猎人 (final card) who is out takes his vote target along.
//  - Teams go by FINAL cards. Village wins if a 狼人 is out (or there is no
//    狼人 among the players and nobody / only the 爪牙 is out). Wolves (+爪牙)
//    win if no 狼人 is out — unless the 厌世者 is out (he wins alone then, and
//    wolves can't win). With no 狼人 among the players the 爪牙 wins if someone
//    else is out.

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
export const CENTER = 3;

// team: village | wolf | loner. sprite: portrait id.
export const ROLES = {
  wolf:    { zh: '狼人',  team: 'wolf',    sprite: 'wolf',      max: 3 },
  minion:  { zh: '爪牙',  team: 'wolf',    sprite: 'on_minion', max: 1 },
  twin:    { zh: '双子',  team: 'village', sprite: 'on_twin',   max: 2, pair: true },
  seer:    { zh: '预言家', team: 'village', sprite: 'seer',      max: 1 },
  thief:   { zh: '夜贼',  team: 'village', sprite: 'on_thief',  max: 1 },
  meddler: { zh: '搅局者', team: 'village', sprite: 'on_meddler', max: 1 },
  drunk:   { zh: '醉汉',  team: 'village', sprite: 'on_drunk',  max: 1 },
  owl:     { zh: '夜猫子', team: 'village', sprite: 'on_owl',    max: 1 },
  villager:{ zh: '村民',  team: 'village', sprite: 'villager',  max: 3 },
  hunter:  { zh: '猎人',  team: 'village', sprite: 'hunter',    max: 1 },
  loner:   { zh: '厌世者', team: 'loner',   sprite: 'on_loner',  max: 1 },
};
export const ROLE_IDS = Object.keys(ROLES);
export const WAKE_ORDER = ['wolf', 'minion', 'twin', 'seer', 'thief', 'meddler', 'drunk', 'owl'];
export const SWAPPERS = ['thief', 'meddler', 'drunk'];

export const ROLE_BLURB = {
  wolf: '夜里睁眼认识狼队友。只有你一匹狼时，可以偷看一张公共牌。白天别让狼被投出去。',
  minion: '狼人阵营，但不是狼。夜里看到谁是狼（狼不知道你）。你被投出去狼人照样赢。',
  twin: '两张一起用。夜里互相确认；只看到自己，说明另一张在公共牌里。',
  seer: '夜里看一个人的牌，或者看两张公共牌。',
  thief: '夜里和一个人换牌，再看你拿到的新牌。你变成新牌的身份和阵营，他变成夜贼（但他不知道）。',
  meddler: '夜里交换另外两个人的牌，你自己不看。',
  drunk: '夜里把你的牌和一张公共牌交换，不能看。你变成那张未知的牌。',
  owl: '最后一个醒：看看自己现在手里是什么牌（有没有被换过）。',
  villager: '夜里不睁眼。白天靠推理找狼。',
  hunter: '夜里不睁眼。如果你（最终手里是猎人）被投出去，你投的那个人也一起出局。',
  loner: '你想被投出去：只要你出局你就赢，而且狼人不能赢。',
};

// Recommended decks (players + 3). Two wolves throughout; swap roles first.
export const PRESETS = {
  3: ['wolf', 'wolf', 'seer', 'thief', 'meddler', 'villager'],
  4: ['wolf', 'wolf', 'seer', 'thief', 'meddler', 'drunk', 'owl'],
  5: ['wolf', 'wolf', 'seer', 'thief', 'meddler', 'drunk', 'owl', 'villager'],
  6: ['wolf', 'wolf', 'seer', 'thief', 'meddler', 'drunk', 'owl', 'hunter', 'villager'],
  7: ['wolf', 'wolf', 'minion', 'seer', 'thief', 'meddler', 'drunk', 'owl', 'hunter', 'loner'],
  8: ['wolf', 'wolf', 'minion', 'twin', 'twin', 'seer', 'thief', 'meddler', 'drunk', 'owl', 'hunter'],
  9: ['wolf', 'wolf', 'minion', 'twin', 'twin', 'seer', 'thief', 'meddler', 'drunk', 'owl', 'hunter', 'loner'],
  10: ['wolf', 'wolf', 'minion', 'twin', 'twin', 'seer', 'thief', 'meddler', 'drunk', 'owl', 'hunter', 'loner', 'villager'],
};
// A beginner board: no card moves, so what you were dealt is what you are.
export const SIMPLE = n => {
  const base = ['wolf', 'wolf', 'seer', 'minion', 'hunter', 'twin', 'twin', 'loner'];
  const d = base.slice(0, Math.min(base.length, n + CENTER));
  if (d.filter(c => c === 'twin').length === 1) d.splice(d.indexOf('twin'), 1);
  while (d.length < n + CENTER) d.push('villager');
  return d;
};
export const BOARDS = [
  { id: 'classic', zh: '经典换牌', desc: '夜贼、搅局者、醉汉都在：天亮后谁都不确定自己是谁。', deck: n => PRESETS[n] },
  { id: 'simple', zh: '新手不换牌', desc: '没有换牌角色，发到什么就是什么，适合第一次玩。', deck: SIMPLE },
];

export const DEFAULT_RULES = { talk: 5, lonePeek: 'yes', selfVote: 'no', tie: 'all' };
// [value, label, explanation]; the first option is the common one
export const VARIANTS = [
  { key: 'talk', zh: '讨论时间', opts: [[5, '5 分钟', '最常见的长度'], [3, '3 分钟', '人少或想快一点'], [7, '7 分钟', ''], [10, '10 分钟', '人多、角色多时']] },
  { key: 'lonePeek', zh: '独狼看公共牌', opts: [['yes', '可以看', '只有一匹狼睁眼时，可以看一张公共牌'], ['no', '不能看', '独狼只知道自己是唯一的狼']] },
  { key: 'selfVote', zh: '能否投自己', opts: [['no', '不能', '只能投别人（标准）'], ['yes', '可以', '想出局的厌世者会更难认']] },
  { key: 'tie', zh: '平票', opts: [['all', '平票都出局', '票数最高的人并列时一起出局'], ['none', '平票无人出局', '最高票并列就算没人出局']] },
];
export function changedRules(rules = {}) {
  return VARIANTS.filter(v => (rules[v.key] ?? DEFAULT_RULES[v.key]) !== DEFAULT_RULES[v.key])
    .map(v => ({ key: v.key, zh: v.zh, val: v.opts.find(o => o[0] === rules[v.key])?.[1] }));
}

export const defaultConfig = () => ({ board: 'classic', counts: null, rules: { ...DEFAULT_RULES } });

const sortDeck = d => [...d].sort((a, b) => ROLE_IDS.indexOf(a) - ROLE_IDS.indexOf(b));
export const countsOf = deck => deck.reduce((m, c) => ({ ...m, [c]: (m[c] || 0) + 1 }), {});
const deckOfCounts = counts => sortDeck(ROLE_IDS.flatMap(id => Array(counts[id] || 0).fill(id)));

/** The deck for n players under a lobby config, plus problems to show. */
export function deckFor(n, cfg = defaultConfig()) {
  const tableN = Math.min(Math.max(n, MIN_PLAYERS), MAX_PLAYERS);
  const board = BOARDS.find(b => b.id === cfg.board);
  const cards = cfg.counts ? deckOfCounts(cfg.counts) : sortDeck(board ? board.deck(tableN) : PRESETS[tableN]);
  const need = tableN + CENTER;
  const c = countsOf(cards);
  const warn = [];
  let error = null;
  if (cards.length !== need) error = `牌数不对：${tableN} 人要 ${need} 张牌（${tableN} 张发给玩家 + 3 张公共牌），现在是 ${cards.length} 张，${cards.length > need ? `多了 ${cards.length - need}` : `少了 ${need - cards.length}`} 张`;
  else if (c.twin === 1) error = '双子要两张一起放';
  if (!c.wolf) warn.push('牌组里没有狼人：大家都是好人，没人出局才算赢');
  else if (c.wolf * 2 > need) warn.push('狼牌太多了，大概率有好几匹狼在场');
  if (c.owl && !SWAPPERS.some(r => c[r])) warn.push('没有换牌角色，夜猫子看到的一定是原来的牌');
  if (c.minion && !c.wolf) warn.push('没有狼人时爪牙很难赢');
  return { cards, error, warn, need, tableN };
}

// -------------------------------------------------------------- timing ---
// The night is clock-driven: a public narrator timeline steps through every
// wake role in the DECK (so center cards aren't given away), and dawn never
// comes before the timeline is done, nor right after the last tap.
export const INTRO_MS = 4000;
export const SLOT_MS = 8000;
export const OUTRO_MS = 4000;
export const FORCE_EXTRA_MS = 60_000;
const scale = g => g.timeScale ?? 1;
const jitter = (lo, hi) => lo + Math.random() * (hi - lo);

export const wakeRoles = deck => WAKE_ORDER.filter(r => deck.includes(r));
export const nightMinMs = g => (INTRO_MS + wakeRoles(g.deck).length * SLOT_MS + OUTRO_MS) * scale(g);
export const forceAfterMs = g => nightMinMs(g) + FORCE_EXTRA_MS * scale(g);

/** Narrator script: [{ role, at }] plus which slot is live at `now` (-1 intro, n = done). */
export function timeline(g, now = Date.now()) {
  const s = scale(g);
  const slots = wakeRoles(g.deck).map((role, i) => ({ role, at: g.nightStart + (INTRO_MS + i * SLOT_MS) * s, end: g.nightStart + (INTRO_MS + (i + 1) * SLOT_MS) * s }));
  let cur = slots.findIndex(x => now < x.end);
  if (now < g.nightStart + INTRO_MS * s) cur = -1;
  else if (cur === -1) cur = slots.length;
  return { slots, cur };
}

// ---------------------------------------------------------------- setup ---
function shuffle(a) {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}
function must(cond, msg) { if (!cond) throw new Error(msg); }

export function newGame(players, cfg = defaultConfig(), now = Date.now()) {
  const seats = players.map(p => p.id);
  must(seats.length >= MIN_PLAYERS && seats.length <= MAX_PLAYERS, `一夜狼要 ${MIN_PLAYERS}–${MAX_PLAYERS} 人`);
  const d = deckFor(seats.length, cfg);
  must(!d.error, d.error);
  const dealt = shuffle(d.cards);
  const start = Object.fromEntries(seats.map((id, i) => [id, dealt[i]]));
  return {
    seats,
    deck: d.cards,
    start,
    center0: dealt.slice(seats.length),
    rules: { ...DEFAULT_RULES, ...(cfg.rules || {}) },
    timeScale: cfg.timeScale ?? 1,
    step: 'night',
    nightStart: now,
    acts: {},
    lastActAt: null,
    settleAt: null,
    final: null,
    forced: false,
    dayStart: null,
    talkEnd: null,
    votes: {},
    result: null,
  };
}

// ---------------------------------------------------------------- night ---
const startWolves = g => g.seats.filter(id => g.start[id] === 'wolf');
export const isLoneWolf = (g, id) => g.start[id] === 'wolf' && startWolves(g).length === 1;

/**
 * What a player picks tonight. kind = role behaviour; players / center = how many
 * seats / center cards to pick; alt = the seer's other option; others = can't pick self.
 * Roles with nothing to do still pick one thing (no effect) so every phone looks the same.
 */
export function nightTask(g, id) {
  const r = g.start[id];
  if (r === 'wolf' && isLoneWolf(g, id) && g.rules.lonePeek === 'yes') return { kind: 'lonePeek', players: 0, center: 1 };
  if (r === 'seer') return { kind: 'seer', players: 1, center: 0, alt: { players: 0, center: 2 }, others: true };
  if (r === 'thief') return { kind: 'thief', players: 1, center: 0, others: true };
  if (r === 'meddler') return { kind: 'meddler', players: 2, center: 0, others: true };
  if (r === 'drunk') return { kind: 'drunk', players: 0, center: 1 };
  return { kind: 'dummy', any: 1 };
}

/** pick = { players: [ids], center: [indices] } */
export function validPick(g, id, pick) {
  const t = nightTask(g, id);
  const ps = pick?.players || [];
  const cs = pick?.center || [];
  if (new Set(ps).size !== ps.length || new Set(cs).size !== cs.length) return false;
  if (!ps.every(p => g.seats.includes(p)) || !cs.every(c => Number.isInteger(c) && c >= 0 && c < CENTER)) return false;
  if (t.kind === 'dummy') return ps.length + cs.length === 1;
  if (t.others && ps.includes(id)) return false;
  const fits = o => ps.length === o.players && cs.length === o.center;
  return fits(t) || (t.alt ? fits(t.alt) : false);
}

export const pendingNight = g => g.seats.filter(id => !(id in g.acts));

export function nightAct(g, id, pick, now = Date.now()) {
  must(g.step === 'night', '现在不是夜晚');
  must(g.seats.includes(id), '你不在这局里');
  must(!(id in g.acts), '今晚你已经行动过了');
  must(validPick(g, id, pick), '选择不对，再看看说明');
  g.acts[id] = { players: [...(pick.players || [])], center: [...(pick.center || [])], at: now };
  g.lastActAt = now;
  if (!pendingNight(g).length) finishNight(g, now);
}

/** Replays every swap in wake order on top of the dealt cards. */
export function resolveSwaps(g) {
  const cards = { ...g.start };
  const center = [...g.center0];
  const holderOf = r => g.seats.find(id => g.start[id] === r);
  const act = r => { const h = holderOf(r); return h && g.acts[h] && !g.acts[h].skipped ? [h, g.acts[h]] : null; };
  const steps = [];
  const th = act('thief');
  if (th) { const [h, a] = th; const x = a.players[0]; [cards[h], cards[x]] = [cards[x], cards[h]]; steps.push({ role: 'thief', id: h, with: x, got: cards[h] }); }
  const md = act('meddler');
  if (md) { const [h, a] = md; const [x, y] = a.players; [cards[x], cards[y]] = [cards[y], cards[x]]; steps.push({ role: 'meddler', id: h, a: x, b: y }); }
  const dr = act('drunk');
  if (dr) { const [h, a] = dr; const i = a.center[0]; [cards[h], center[i]] = [center[i], cards[h]]; steps.push({ role: 'drunk', id: h, center: i, got: cards[h] }); }
  return { cards, center, steps };
}

function finishNight(g, now) {
  const { cards, center } = resolveSwaps(g);
  g.final = { cards, center };
  g.settleAt = Math.max(g.nightStart + nightMinMs(g), now + jitter(3000, 8000) * scale(g));
}

/** The host's phone calls this; dawn once everyone acted and the clock says so. */
export function settleNight(g, now = Date.now()) {
  if (g.step !== 'night' || !g.final || g.settleAt == null || now < g.settleAt) return false;
  g.step = 'day';
  g.dayStart = now;
  g.talkEnd = now + g.rules.talk * 60_000;
  return true;
}

/** Host only, after a long stall (a phone fell asleep): missing players do nothing. */
export function forceNight(g, now = Date.now()) {
  must(g.step === 'night', '现在不是夜晚');
  must(now - g.nightStart >= forceAfterMs(g), '再等等，夜里还有人在操作');
  pendingNight(g).forEach(id => { g.acts[id] = { players: [], center: [], at: now, skipped: true }; });
  g.forced = true;
  if (!g.final) finishNight(g, now);
  g.settleAt = now;
  settleNight(g, now);
}

/**
 * What this player knows from tonight (shown privately on their phone).
 * Returns { lines: [{ k, ... }] } built from the dealt cards; only 夜猫子 needs the final cards.
 */
export function nightInfo(g, id, now = Date.now()) {
  const a = g.acts[id];
  const r = g.start[id];
  const out = [];
  if (r === 'wolf') {
    const mates = startWolves(g).filter(x => x !== id);
    out.push({ k: 'wolves', ids: mates });
    if (a && !a.skipped && nightTask(g, id).kind === 'lonePeek') out.push({ k: 'center', idx: a.center, cards: a.center.map(i => g.center0[i]) });
  } else if (r === 'minion') out.push({ k: 'wolvesForMinion', ids: startWolves(g) });
  else if (r === 'twin') out.push({ k: 'twin', ids: g.seats.filter(x => x !== id && g.start[x] === 'twin') });
  if (!a || a.skipped) return out;
  if (r === 'seer') {
    if (a.players.length) out.push({ k: 'saw', id: a.players[0], card: g.start[a.players[0]] });
    else out.push({ k: 'center', idx: a.center, cards: a.center.map(i => g.center0[i]) });
  } else if (r === 'thief') out.push({ k: 'stole', id: a.players[0], card: g.start[a.players[0]] });
  else if (r === 'meddler') out.push({ k: 'meddled', ids: a.players });
  else if (r === 'drunk') out.push({ k: 'drank', idx: a.center[0] });
  else if (r === 'owl') {
    const tl = timeline(g, now);
    const slot = tl.slots.findIndex(s => s.role === 'owl');
    if (g.final && (tl.cur >= slot || g.step !== 'night')) out.push({ k: 'owl', card: g.final.cards[id] });
    else out.push({ k: 'owlWait' });
  }
  return out;
}

// ------------------------------------------------------------------ day ---
export function addTalk(g, ms = 60_000, now = Date.now()) {
  must(g.step === 'day', '现在不是讨论时间');
  g.talkEnd = Math.max(g.talkEnd, now) + ms;
}

export function startVote(g) {
  must(g.step === 'day', '现在不是讨论时间');
  g.step = 'vote';
  g.votes = {};
}

export const canVoteFor = (g, id, t) => g.seats.includes(t) && (t !== id || g.rules.selfVote === 'yes');

export function castVote(g, id, t) {
  must(g.step === 'vote', '现在不能投票');
  must(g.seats.includes(id), '你不在这局里');
  must(canVoteFor(g, id, t), g.rules.selfVote === 'yes' ? '选一个人' : '不能投自己');
  g.votes[id] = t;
  if (g.seats.every(x => x in g.votes)) resolveVote(g);
}

/** Host only: close the vote; whoever hasn't voted casts no vote. */
export function closeVote(g) {
  must(g.step === 'vote', '现在不能投票');
  must(Object.keys(g.votes).length > 0, '还没有人投票');
  resolveVote(g);
}

export const finalCard = (g, id) => (g.final ? g.final.cards[id] : g.start[id]);
export const teamOf = card => ROLES[card].team;

export function resolveVote(g) {
  const counts = Object.fromEntries(g.seats.map(id => [id, 0]));
  Object.values(g.votes).forEach(t => { if (t in counts) counts[t] += 1; });
  const max = Math.max(...Object.values(counts));
  const top = g.seats.filter(id => counts[id] === max);
  let out = [];
  if (max >= 2) out = top.length === 1 || g.rules.tie === 'all' ? top : [];
  const shots = [];
  // a 猎人 (by final card) who is out takes his vote target with him
  for (let i = 0; i < out.length; i++) {
    const h = out[i];
    const t = g.votes[h];
    if (finalCard(g, h) === 'hunter' && t && t !== h) {
      shots.push({ from: h, to: t });
      if (!out.includes(t)) out.push(t);
    }
  }
  const fc = id => finalCard(g, id);
  const wolvesIn = g.seats.filter(id => fc(id) === 'wolf');
  const minionIn = g.seats.filter(id => fc(id) === 'minion');
  const wolfOut = out.some(id => fc(id) === 'wolf');
  const lonerOut = out.some(id => fc(id) === 'loner');
  let village;
  let wolf;
  let why;
  if (wolvesIn.length) {
    village = wolfOut;
    wolf = !wolfOut && !lonerOut;
    why = wolfOut ? '有狼人被投出局' : lonerOut ? '没有狼人出局，但厌世者如愿出局，狼人也赢不了' : '没有狼人出局';
  } else {
    const othersOut = out.filter(id => fc(id) !== 'minion');
    village = othersOut.length === 0;
    wolf = !village && !lonerOut && minionIn.length > 0;
    why = village ? (out.length ? '狼人都在公共牌里，出局的只有爪牙' : '狼人都在公共牌里，而且没人出局')
      : lonerOut ? '狼人都在公共牌里，厌世者如愿出局'
        : minionIn.length ? '狼人都在公共牌里，好人却投出了自己人，爪牙得逞' : '狼人都在公共牌里，好人却投出了自己人';
  }
  const winners = [village && 'village', wolf && 'wolf', lonerOut && 'loner'].filter(Boolean);
  g.result = { counts, max, out, shots, winners, why, closed: g.seats.some(id => !(id in g.votes)) };
  g.step = 'end';
}

/** Did this player win? (by final card) */
export function isWinner(g, id) {
  if (!g.result) return false;
  const c = finalCard(g, id);
  const out = g.result.out.includes(id);
  if (c === 'loner') return out;
  return g.result.winners.includes(teamOf(c));
}

/** Full reveal: every night action in wake order, in words-ready shape. */
export function nightStory(g) {
  const items = [];
  const holders = r => g.seats.filter(id => g.start[id] === r);
  const swaps = resolveSwaps(g).steps;
  for (const r of WAKE_ORDER) {
    if (!g.deck.includes(r)) continue;
    const hs = holders(r);
    if (!hs.length) { items.push({ role: r, inCenter: true }); continue; }
    for (const h of hs) {
      const a = g.acts[h];
      const base = { role: r, id: h, skipped: !a || a.skipped };
      if (base.skipped) { items.push(base); continue; }
      if (r === 'wolf') items.push({ ...base, mates: holders('wolf').filter(x => x !== h), peek: nightTask(g, h).kind === 'lonePeek' ? a.center.map(i => ({ i, card: g.center0[i] })) : null });
      else if (r === 'minion') items.push({ ...base, wolves: holders('wolf') });
      else if (r === 'twin') items.push({ ...base, mates: holders('twin').filter(x => x !== h) });
      else if (r === 'seer') items.push({ ...base, saw: a.players.length ? { id: a.players[0], card: g.start[a.players[0]] } : null, center: a.center.map(i => ({ i, card: g.center0[i] })) });
      else if (r === 'owl') items.push({ ...base, card: g.final?.cards[h] });
      else items.push({ ...base, swap: swaps.find(s => s.role === r) });
    }
  }
  return items;
}

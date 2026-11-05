// 双身份狼人 (dual-identity Werewolf) rules engine. Pure functions that
// mutate a plain JSON game object; the room store syncs it to every phone.
//
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
};
export const GODS = ['seer', 'witch', 'hunter', 'guard'];

export const ROLE_BLURB = {
  wolf: '这张牌在上面时，每晚和狼队友一起刀掉一个人的一条命。手里只要有一张狼牌，你就是狼人阵营。',
  villager: '没有技能。白天靠发言和投票找出狼人。',
  seer: '每晚查验一人：看到的是他「当前那张牌」是好人还是狼人。',
  witch: '一瓶解药、一瓶毒药，整局各一次；同一晚只能用一瓶，不能自救。',
  hunter: '这张牌被刀或被投出局时，可以开枪带走一人的一条命（被毒不能开枪）。',
  guard: '每晚守护一人不被狼刀，不能连续两晚守同一人。同守同救也会死。',
};

// 2 cards per player → 2n cards. Villagers fill whatever is left.
export const RECOMMENDED = {
  5: { wolves: 2, gods: ['seer', 'witch', 'hunter'] },
  6: { wolves: 2, gods: GODS },
  7: { wolves: 3, gods: GODS },
  8: { wolves: 3, gods: GODS },
  9: { wolves: 4, gods: GODS },
  10: { wolves: 4, gods: GODS },
};

const clampN = n => Math.min(Math.max(n, MIN_PLAYERS), MAX_PLAYERS);
export const defaultConfig = () => ({ auto: true, order: 'choose' });
export function effectiveConfig(n, cfg = {}) {
  const rec = RECOMMENDED[clampN(n)];
  if (cfg.auto !== false || cfg.wolves == null) return { ...rec, auto: true, order: cfg.order || 'choose' };
  return { wolves: cfg.wolves, gods: cfg.gods || [], auto: false, order: cfg.order || 'choose' };
}

export function buildDeck(n, cfg) {
  const villagers = 2 * n - cfg.wolves - cfg.gods.length;
  if (cfg.wolves < 1) return { error: '至少要 1 张狼牌' };
  if (cfg.wolves > n - 1) return { error: '狼牌太多了' };
  if (villagers < 1) return { error: '至少要留 1 张村民牌' };
  return { cards: [...Array(cfg.wolves).fill('wolf'), ...cfg.gods, ...Array(villagers).fill('villager')], villagers };
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
  const seats = shuffle(players.map(p => p.id));
  const n = seats.length;
  const deck = buildDeck(n, cfg);
  if (deck.error) throw new Error(deck.error);
  let cards;
  // Re-deal until nobody holds two wolf cards (spreads the wolf camp over
  // more players) and at least two players are purely good.
  for (let tries = 0; tries < 200; tries++) {
    cards = shuffle(deck.cards);
    const wolvesOf = i => (cards[2 * i] === 'wolf') + (cards[2 * i + 1] === 'wolf');
    const goodPlayers = seats.filter((_, i) => wolvesOf(i) === 0);
    if (goodPlayers.length >= 2 && seats.every((_, i) => wolvesOf(i) < 2)) break;
  }
  const hands = {};
  const dead = {};
  seats.forEach((id, i) => {
    const pair = [cards[2 * i], cards[2 * i + 1]];
    // random order mode: deal as-is; choose mode: wolves default to wolf on top
    hands[id] = { cards: pair, locked: cfg.order === 'random' };
    dead[id] = 0;
  });
  const g = {
    seats, hands, dead,
    order: cfg.order,
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
  };
  g.goodGodsAtStart = goodCampCards(g).gods;
  if (cfg.order === 'random') startNight(g);
  return g;
}

// ---------------------------------------------------------------- views ---
export const lives = (g, id) => 2 - g.dead[id];
export const isAlive = (g, id) => g.dead[id] < 2;
export const activeCard = (g, id) => (isAlive(g, id) ? g.hands[id].cards[g.dead[id]] : null);
export const isWolfCamp = (g, id) => g.hands[id].cards.includes('wolf');
export const alivePlayers = g => g.seats.filter(id => isAlive(g, id));
export const holders = (g, role) => g.seats.filter(id => activeCard(g, id) === role);
export const activeWolves = g => holders(g, 'wolf');

function goodCampCards(g) {
  let villagers = 0;
  let gods = 0;
  for (const id of g.seats) {
    if (isWolfCamp(g, id)) continue;
    g.hands[id].cards.slice(g.dead[id]).forEach(c => { if (c === 'villager') villagers++; else gods++; });
  }
  return { villagers, gods };
}
const wolfCardsLeft = g => g.seats.reduce((n, id) => n + g.hands[id].cards.slice(g.dead[id]).filter(c => c === 'wolf').length, 0);

export function score(g) {
  const { villagers, gods } = goodCampCards(g);
  return { wolves: wolfCardsLeft(g), villagers, gods };
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
function startNight(g) {
  g.night += 1;
  g.step = 'night';
  g.acts = { guard: null, wolves: {}, seer: null, kill: null, save: false, poison: null, witchDone: false };
  g.votes = {};
  advanceNight(g);
}

/** Who still has to act this night (for the progress counter / waiting screens). */
export function nightPending(g) {
  const a = g.acts;
  const out = [];
  holders(g, 'guard').forEach(id => { if (!a.guard) out.push(id); });
  activeWolves(g).forEach(id => { if (!(id in a.wolves)) out.push(id); });
  holders(g, 'seer').forEach(id => { if (!a.seer) out.push(id); });
  return out;
}

const witchCanAct = g => holders(g, 'witch').length > 0 && (g.potions.save || g.potions.poison);

function advanceNight(g) {
  if (g.step !== 'night' || nightPending(g).length) return;
  g.acts.kill = wolfDecision(g);
  if (witchCanAct(g)) g.step = 'witch';
  else resolveNight(g);
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

export function wolfAct(g, id, target) {
  must(g.step === 'night' && activeCard(g, id) === 'wolf', '现在不能刀人');
  must(isAlive(g, target), '他已经出局了');
  g.acts.wolves[id] = target;
  advanceNight(g);
}

export function seerAct(g, id, target) {
  must(g.step === 'night' && activeCard(g, id) === 'seer', '现在不能查验');
  must(target !== id && isAlive(g, target), '选一个还在场的其他人');
  g.acts.seer = target;
  g.seerLog.push({ night: g.night, from: id, to: target, wolf: activeCard(g, target) === 'wolf' });
  advanceNight(g);
}

export function witchAct(g, id, { save = false, poison = null } = {}) {
  must(g.step === 'witch' && activeCard(g, id) === 'witch', '现在不能用药');
  must(!(save && poison), '同一晚只能用一瓶药');
  if (save) {
    must(g.potions.save, '解药已经用过了');
    must(g.acts.kill && g.acts.kill !== id, '女巫不能自救');
  }
  if (poison) {
    must(g.potions.poison, '毒药已经用过了');
    must(isAlive(g, poison), '他已经出局了');
  }
  g.acts.save = !!save;
  g.acts.poison = poison || null;
  g.acts.witchDone = true;
  resolveNight(g);
}

function loseLife(g, id, cause, when) {
  if (!isAlive(g, id)) return null;
  const card = activeCard(g, id);
  g.dead[id] += 1;
  g.graveyard.push({ id, card, cause, ...when });
  if (card === 'hunter' && cause !== 'poison' && !g.hunter) g.hunter = { id, cause };
  return card;
}

function resolveNight(g) {
  const a = g.acts;
  const when = { night: g.night };
  const lost = [];
  if (a.kill) {
    const guarded = a.guard === a.kill;
    const dies = guarded === a.save; // 同守同救 dies; neither → dies
    if (dies) { loseLife(g, a.kill, 'wolf', when); lost.push(a.kill); }
  }
  if (a.save) g.potions.save = false;
  if (a.poison) { g.potions.poison = false; loseLife(g, a.poison, 'poison', when); lost.push(a.poison); }
  g.guardLast = a.guard || null;
  g.day = g.night;
  g.log.push({ type: 'night', night: g.night, lost });
  g.lastNight = { night: g.night, lost };
  if (checkWin(g)) return;
  g.step = g.hunter ? 'hunter' : 'day';
  if (g.hunter) g.hunter.then = 'day';
}

// ------------------------------------------------------------------ day ---
export function hunterShoot(g, id, target) {
  must(g.step === 'hunter' && g.hunter?.id === id, '现在不能开枪');
  if (target) {
    must(target !== id && isAlive(g, target), '选一个还在场的其他人');
    loseLife(g, target, 'shot', { day: g.day });
  }
  g.log.push({ type: 'shot', day: g.day, from: id, to: target || null });
  const then = g.hunter.then;
  g.hunter = null;
  if (checkWin(g)) return;
  if (then === 'night') startNight(g);
  else g.step = 'day';
}

export function startVote(g) {
  must(g.step === 'day', '现在不能投票');
  g.step = 'vote';
  g.votes = {};
}

/** target = player id, or null to abstain. Voting closes when everyone alive has voted. */
export function castVote(g, id, target) {
  must(g.step === 'vote' && isAlive(g, id), '你现在不能投票');
  must(target === null || isAlive(g, target), '他已经出局了');
  g.votes[id] = target;
  const voters = alivePlayers(g);
  if (!voters.every(v => v in g.votes)) return;

  const tally = {};
  voters.forEach(v => { const t = g.votes[v]; if (t) tally[t] = (tally[t] || 0) + 1; });
  const best = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter(t => tally[t] === best);
  const out = best > 0 && top.length === 1 ? top[0] : null;
  if (out) loseLife(g, out, 'vote', { day: g.day });
  g.log.push({ type: 'vote', day: g.day, votes: { ...g.votes }, out, tie: best > 0 && top.length > 1 });
  if (checkWin(g)) return;
  if (g.hunter) { g.hunter.then = 'night'; g.step = 'hunter'; return; }
  startNight(g);
}

// ------------------------------------------------------------------ end ---
function checkWin(g) {
  const s = score(g);
  let winner = null;
  let reason = '';
  if (s.wolves === 0) { winner = 'good'; reason = '所有狼牌都出局了'; }
  else if (s.villagers === 0) { winner = 'wolf'; reason = '屠边：好人阵营的村民牌全部出局'; }
  else if (g.goodGodsAtStart > 0 && s.gods === 0) { winner = 'wolf'; reason = '屠边：好人阵营的神牌全部出局'; }
  if (!winner) return false;
  g.winner = winner;
  g.reason = reason;
  g.step = 'end';
  return true;
}

export const CAUSE_ZH = { wolf: '被狼刀', poison: '被毒', vote: '被投出', shot: '被猎人带走' };

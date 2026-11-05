// Pure Avalon rules: role composition, dealing, and per-player knowledge.
// No React, no storage — easy to unit test and to reuse server-side later.

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

// Number of evil players by table size.
export const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };

// Team size for each of the 5 quests. `fails2` marks quests that need 2 fail cards.
export const QUESTS = {
  5: [2, 3, 2, 3, 3],
  6: [2, 3, 4, 3, 4],
  7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5],
  9: [3, 4, 4, 5, 5],
  10: [3, 4, 4, 5, 5],
};
export const needsTwoFails = (playerCount, questIndex) => playerCount >= 7 && questIndex === 3;

export const ROLES = {
  merlin:   { id: 'merlin',   team: 'good', zh: '梅林',     en: 'Merlin',   sprite: 'merlin' },
  percival: { id: 'percival', team: 'good', zh: '派西维尔', en: 'Percival', sprite: 'percival' },
  servant:  { id: 'servant',  team: 'good', zh: '亚瑟的忠臣', en: 'Loyal Servant', sprite: 'servant' },
  assassin: { id: 'assassin', team: 'evil', zh: '刺客',     en: 'Assassin', sprite: 'assassin' },
  morgana:  { id: 'morgana',  team: 'evil', zh: '莫甘娜',   en: 'Morgana',  sprite: 'morgana' },
  mordred:  { id: 'mordred',  team: 'evil', zh: '莫德雷德', en: 'Mordred',  sprite: 'mordred' },
  oberon:   { id: 'oberon',   team: 'evil', zh: '奥伯伦',   en: 'Oberon',   sprite: 'oberon' },
  minion:   { id: 'minion',   team: 'evil', zh: '莫德雷德的爪牙', en: 'Minion', sprite: 'minion' },
};

export const ROLE_BLURB = {
  merlin: '你知道谁是坏人（莫德雷德除外）。别暴露自己——刺客在找你。',
  percival: '你能看到梅林和莫甘娜，但分不清谁是谁。保护真正的梅林。',
  servant: '你没有额外信息。相信推理，找出坏人。',
  assassin: '游戏结束时如果好人赢了三轮，你有一次机会刺杀梅林翻盘。',
  morgana: '你在派西维尔眼里看起来像梅林。迷惑他们。',
  mordred: '梅林看不到你。好好利用这一点。',
  oberon: '你是坏人，但你和其他坏人互相看不见。',
  minion: '你认识你的邪恶同伴。暗中破坏任务。',
};

// Optional special roles the host can toggle. Merlin/Assassin are on by default.
export const OPTIONAL_ROLES = ['merlin', 'percival', 'assassin', 'morgana', 'mordred', 'oberon'];

/**
 * Commonly used setups per head count (the usual Chinese-community standard).
 * Plain servants / minions fill whatever seats the special roles leave.
 */
export const RECOMMENDED = {
  5: ['merlin', 'percival', 'assassin', 'morgana'],
  6: ['merlin', 'percival', 'assassin', 'morgana'],
  7: ['merlin', 'percival', 'assassin', 'morgana', 'oberon'],
  8: ['merlin', 'percival', 'assassin', 'morgana'],
  9: ['merlin', 'percival', 'assassin', 'morgana', 'mordred'],
  10: ['merlin', 'percival', 'assassin', 'morgana', 'mordred', 'oberon'],
};

export function recommendedConfig(playerCount) {
  const n = Math.min(Math.max(playerCount, MIN_PLAYERS), MAX_PLAYERS);
  return Object.fromEntries(OPTIONAL_ROLES.map(r => [r, RECOMMENDED[n].includes(r)]));
}

/** `auto: true` means the lobby follows RECOMMENDED as people join/leave. */
export const defaultConfig = (playerCount = 5) => ({ ...recommendedConfig(playerCount), auto: true, lady: false });

/** The role switches actually in effect for this head count (`lady` is independent of auto). */
export const effectiveConfig = (playerCount, config) =>
  (config?.auto ? { ...recommendedConfig(playerCount), lady: !!config.lady } : config);

/** Lady of the Lake is used after quests 2, 3 and 4. */
export const LADY_AFTER = [2, 3, 4];
export const LADY_BLURB = '第 2、3、4 个任务结束后，持有者查验一名玩家的阵营（只有自己看得到），然后把湖中仙女交给他。查验过的人不能再被查验。建议 7 人以上使用。';

/** Build the multiset of roles for a table, or return an error string. */
export function buildRoleList(playerCount, config) {
  if (playerCount < MIN_PLAYERS) return { error: `至少需要 ${MIN_PLAYERS} 人` };
  if (playerCount > MAX_PLAYERS) return { error: `最多 ${MAX_PLAYERS} 人` };

  const evilCount = EVIL_COUNT[playerCount];
  const goodCount = playerCount - evilCount;
  const good = ['merlin', 'percival'].filter(r => config[r]);
  const evil = ['assassin', 'morgana', 'mordred', 'oberon'].filter(r => config[r]);

  if (config.assassin && !config.merlin) return { error: '有刺客就必须有梅林' };
  if (good.length > goodCount) return { error: `好人只有 ${goodCount} 个位置` };
  if (evil.length > evilCount) return { error: `坏人只有 ${evilCount} 个位置，特殊坏人太多了` };

  const roles = [
    ...good,
    ...Array(goodCount - good.length).fill('servant'),
    ...evil,
    ...Array(evilCount - evil.length).fill('minion'),
  ];
  return { roles, goodCount, evilCount };
}

function randomInt(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deal roles to players. Returns { assignments: {playerId: roleId}, leaderId } or { error }. */
export function deal(players, config) {
  const built = buildRoleList(players.length, config);
  if (built.error) return built;
  const roles = shuffle(built.roles);
  const assignments = {};
  players.forEach((p, i) => { assignments[p.id] = roles[i]; });
  const leaderId = players[randomInt(players.length)].id;
  return { assignments, leaderId };
}

const EVIL_VISIBLE_TO_MERLIN = r => ROLES[r].team === 'evil' && r !== 'mordred';
const EVIL_VISIBLE_TO_EVIL = r => ROLES[r].team === 'evil' && r !== 'oberon';

/**
 * What a given player knows after the deal.
 * Returns { role, title, seen: [{ playerId, tag }], notes: [string] }.
 */
export function knowledgeFor(myId, assignments) {
  const role = assignments[myId];
  if (!role) return null;
  const others = Object.entries(assignments).filter(([id]) => id !== myId);
  const roleSet = new Set(Object.values(assignments));
  const out = { role, title: '', seen: [], notes: [] };

  if (role === 'merlin') {
    out.title = '你看到的坏人';
    out.seen = others.filter(([, r]) => EVIL_VISIBLE_TO_MERLIN(r)).map(([id]) => ({ playerId: id, tag: 'evil' }));
    if (roleSet.has('mordred')) out.notes.push('莫德雷德在场，但你看不到。');
  } else if (role === 'percival') {
    out.title = '其中一人是梅林，另一人是莫甘娜';
    out.seen = others.filter(([, r]) => r === 'merlin' || r === 'morgana').map(([id]) => ({ playerId: id, tag: 'merlin?' }));
    if (!roleSet.has('morgana')) out.title = '这是梅林';
  } else if (ROLES[role].team === 'evil' && role !== 'oberon') {
    out.title = '你的邪恶同伴';
    out.seen = others.filter(([, r]) => EVIL_VISIBLE_TO_EVIL(r)).map(([id]) => ({ playerId: id, tag: 'evil' }));
    if (roleSet.has('oberon')) out.notes.push('奥伯伦也是坏人，但你们互相看不见。');
  }
  return out;
}

// =====================================================================
// Game flow. All functions mutate a *copy* of `room.game` (the store hands
// mutators a structuredClone) and throw on illegal moves.
//
// steps: reveal → propose → vote → (quest | propose) → … → assassin → end
// =====================================================================

export const isGood = role => ROLES[role]?.team === 'good';
export const questSize = g => QUESTS[g.seats.length][g.quest];
export const leaderOf = g => g.seats[g.leaderIdx];
export const failsNeeded = g => (needsTwoFails(g.seats.length, g.quest) ? 2 : 1);
export const score = g => ({
  good: g.results.filter(r => r.success).length,
  evil: g.results.filter(r => !r.success).length,
});

export function newGame(players, config) {
  const res = deal(players, config);
  if (res.error) throw new Error(res.error);
  const seats = players.map(p => p.id);
  return {
    assignments: res.assignments,
    seats,
    leaderIdx: seats.indexOf(res.leaderId),
    quest: 0,          // 0..4
    attempt: 1,        // proposal attempt within this quest (5th rejection → evil wins)
    step: 'reveal',
    seen: {},
    team: [],
    votes: {},
    cards: {},
    results: [],       // [{ team, fails, success, size }]
    history: [],       // every proposal: { quest, attempt, leaderId, team, votes, approved }
    lastQuest: null,   // { index, fails, cards: [bool, …] shuffled }
    winner: null,
    reason: null,
    assassinTarget: null,
    // Lady of the Lake: starts with the player seated before the first leader.
    lady: config.lady
      ? { holder: seats[(seats.indexOf(res.leaderId) - 1 + seats.length) % seats.length], used: [], log: [] }
      : null,
  };
}

function nextLeader(g) {
  g.leaderIdx = (g.leaderIdx + 1) % g.seats.length;
  g.team = [];
  g.votes = {};
  g.step = 'propose';
}

function end(g, winner, reason) {
  g.step = 'end';
  g.winner = winner;
  g.reason = reason;
}

export function markSeen(g, pid) {
  if (!g.seats.includes(pid)) return g;
  g.seen[pid] = true;
  if (g.step === 'reveal' && g.seats.every(id => g.seen[id])) g.step = 'propose';
  return g;
}

export function forceStart(g) {
  if (g.step === 'reveal') g.step = 'propose';
  return g;
}

export function toggleTeam(g, pid, target) {
  if (g.step !== 'propose') throw new Error('现在不是组队阶段');
  if (leaderOf(g) !== pid) throw new Error('只有队长能选人');
  if (!g.seats.includes(target)) return g;
  if (g.team.includes(target)) g.team = g.team.filter(id => id !== target);
  else if (g.team.length < questSize(g)) g.team = [...g.team, target];
  else throw new Error(`已经选满 ${questSize(g)} 人，先点掉一个`);
  return g;
}

export function submitTeam(g, pid) {
  if (g.step !== 'propose' || leaderOf(g) !== pid) throw new Error('只有队长能提交队伍');
  if (g.team.length !== questSize(g)) throw new Error(`需要选 ${questSize(g)} 人`);
  g.step = 'vote';
  g.votes = {};
  return g;
}

export function castVote(g, pid, approve) {
  if (g.step !== 'vote') throw new Error('现在不是投票阶段');
  if (!g.seats.includes(pid)) return g;
  g.votes[pid] = !!approve;
  if (g.seats.every(id => id in g.votes)) {
    const yes = g.seats.filter(id => g.votes[id]).length;
    const approved = yes > g.seats.length / 2;
    g.history.push({ quest: g.quest, attempt: g.attempt, leaderId: leaderOf(g), team: [...g.team], votes: { ...g.votes }, approved });
    if (approved) {
      g.step = 'quest';
      g.cards = {};
    } else if (g.attempt >= 5) {
      end(g, 'evil', '连续 5 次组队被否决');
    } else {
      g.attempt += 1;
      nextLeader(g);
    }
  }
  return g;
}

export function playCard(g, pid, success) {
  if (g.step !== 'quest') throw new Error('现在不是任务阶段');
  if (!g.team.includes(pid)) throw new Error('你不在这次任务里');
  if (!success && isGood(g.assignments[pid])) throw new Error('好人只能出成功');
  g.cards[pid] = !!success;
  if (g.team.every(id => id in g.cards)) {
    const fails = g.team.filter(id => !g.cards[id]).length;
    const success = fails < failsNeeded(g);
    g.results.push({ team: [...g.team], fails, success, size: g.team.length });
    g.lastQuest = { index: g.quest, fails, success, cards: shuffle(g.team.map(id => g.cards[id])) };
    const s = score(g);
    if (s.good >= 3) {
      if (Object.values(g.assignments).includes('assassin')) g.step = 'assassin';
      else end(g, 'good', '三个任务成功');
    } else if (s.evil >= 3) {
      end(g, 'evil', '三个任务失败');
    } else {
      g.quest += 1;
      g.attempt = 1;
      nextLeader(g);
      if (g.lady && LADY_AFTER.includes(g.results.length)) g.step = 'lady';
    }
    g.cards = {};
  }
  return g;
}

/** Players the Lady holder may examine: not themselves, never previously holders. */
export const ladyTargets = g =>
  (g.lady ? g.seats.filter(id => id !== g.lady.holder && !g.lady.used.includes(id)) : []);

export function ladyExamine(g, pid, target) {
  if (g.step !== 'lady') throw new Error('现在不是湖中仙女阶段');
  if (g.lady.holder !== pid) throw new Error('只有湖中仙女持有者能查验');
  if (!ladyTargets(g).includes(target)) throw new Error('不能查验这名玩家');
  g.lady.log.push({ after: g.results.length, from: pid, to: target, good: isGood(g.assignments[target]) });
  g.lady.used.push(pid);
  g.lady.holder = target;
  g.step = 'propose';
  return g;
}

export function assassinate(g, pid, target) {
  if (g.step !== 'assassin') throw new Error('现在不是刺杀阶段');
  if (g.assignments[pid] !== 'assassin') throw new Error('只有刺客能刺杀');
  // Any other player may be targeted (restricting to good would leak Oberon).
  if (target === pid || !g.seats.includes(target)) throw new Error('选择另一名玩家');
  g.assassinTarget = target;
  if (g.assignments[target] === 'merlin') end(g, 'evil', '刺客找到了梅林');
  else end(g, 'good', '刺客没找到梅林');
  return g;
}

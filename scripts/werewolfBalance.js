// 双身份狼人 balance tuner (offline). Plays many quick games with heuristic AI,
// picks the deck closest to 50/50 for every player count × combination of the
// high-impact house rules, and writes src/games/werewolf/balanceTable.js.
//
//   node scripts/werewolfBalance.js                 # fill in rule combos missing from the table
//   node scripts/werewolfBalance.js --all           # recompute everything
//   node scripts/werewolfBalance.js --redo cupid=yes   # recompute combos with that rule value
//   node scripts/werewolfBalance.js --effects       # per-setting win rates for every preset (effectTable.js)
//   --workers N   run on N processes (default: CPU count - 1)
//
// Low-impact variants (seer sees camp, witch self-save, guard+save, reveal
// card, three quiet nights, PK on ties) moved the good win rate by ≤5 points in testing and are left at their
// defaults while tuning.
//
// AI model ("medium" table):
//  - Good players lead with their skill card; wolves lead with the wolf card
//    (or hide it underneath when hidden wolves wake too).
//  - The real seer claims every check publicly; if nobody claims, a wolf may
//    fake-claim and accuse a good player.
//  - Each day the village settles on one suspect: a claimed wolf if any, else
//    a read that is right with probability READ (0.35); good players vote it.
//  - Wolves vote as a bloc for good players, hunt the claimed seer at night;
//    guard protects the claimed seer; witch saves on night 1 / the seer,
//    poisons a claimed wolf; 金刚狼 double-strikes the seer or from night 2.
import fs from 'fs';
import os from 'os';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import * as R from '../src/games/werewolf/wolfRules.js';

const READ = 0.35;
const FOLLOW = 0.8;
const FAKE_CLAIM = 0.5;

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
const hash = str => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/** Run fn with Math.random replaced by a seeded PRNG (the rules engine shuffles with it). */
function seeded(seed, fn) {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = orig; }
}

const rnd = () => Math.random();
const pick = a => (a.length ? a[Math.floor(rnd() * a.length)] : undefined);

function playOne(n, cfg) {
  const rules = cfg.rules;
  const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
  const g = R.newGame(players, cfg);
  const camp = id => R.isWolfCamp(g, id);
  const liveWolf = id => R.isAlive(g, id) && g.hands[id].cards.slice(g.dead[id]).includes('wolf');
  const claimedWolf = new Set();
  const claimedGood = new Set();
  let seerClaimer = null;
  let suspect = null;

  for (const id of g.seats) {
    if (g.hands[id].locked) continue;
    const [top, bot] = g.hands[id].cards;
    const swap = camp(id)
      ? (rules.wake === 'all' ? top === 'wolf' && bot !== 'wolf' : bot === 'wolf' && top !== 'wolf')
      : top === 'villager' && bot !== 'villager';
    if (swap) R.swapCards(g, id);
    R.lockCards(g, id);
  }

  const learn = () => { if (rules.reveal === 'show') g.graveyard.forEach(e => { if (e.card === 'wolf') claimedWolf.add(e.id); }); };

  for (let guard = 0; g.step !== 'end' && guard < 400; guard++) {
    const alive = R.alivePlayers(g);
    const others = id => alive.filter(x => x !== id);
    switch (g.step) {
      case 'night': {
        const id = R.nightPending(g)[0];
        const c = R.activeCard(g, id);
        if (id === R.cupidOf(g) && !g.lovers && g.night === 1 && rules.cupid === 'yes') {
          const self = rnd() < 0.3;
          const a = self ? id : pick(others(id));
          const b = pick(alive.filter(x => x !== a && (self || x !== id)));
          R.cupidAct(g, id, a, b);
        } else if (c === 'guard' && !g.acts.guard) {
          const opts = alive.filter(x => x !== g.guardLast);
          R.guardAct(g, id, seerClaimer && opts.includes(seerClaimer) && !camp(id) ? seerClaimer : pick(opts));
        } else if (c === 'seer' && !g.acts.seer) {
          const unknown = others(id).filter(x => !claimedGood.has(x) && !claimedWolf.has(x));
          R.seerAct(g, id, pick(unknown.length ? unknown : others(id)));
        } else {
          const prey = alive.filter(x => !camp(x) && x !== R.partnerOf(g, id));
          const mate = R.activeWolves(g).find(w => w !== id && g.acts.wolves[w]);
          const t = mate ? g.acts.wolves[mate] : (seerClaimer && prey.includes(seerClaimer) ? seerClaimer : pick(prey.length ? prey : others(id)));
          R.wolfAct(g, id, t, { double: R.canDouble(g, id) && !rules.noSkill && rules.jglSkill !== 'no' && (t === seerClaimer || g.night >= 2) && rnd() < 0.7 });
        }
        break;
      }
      case 'witch': {
        if (g.acts.witchDone) { R.settleNight(g, Infinity); break; }
        const w = R.holders(g, 'witch')[0];
        const k = g.acts.kill;
        const evil = camp(w);
        const canSave = g.potions.save && k && !g.acts.doubleKill && (k !== w || R.canSelfSave(g));
        const knownWolf = [...claimedWolf].find(x => R.isAlive(g, x) && x !== w);
        if (!evil && canSave && (g.night === 1 || k === seerClaimer)) R.witchAct(g, w, { save: true });
        else if (!evil && g.potions.poison && knownWolf) R.witchAct(g, w, { poison: knownWolf });
        else if (evil && g.potions.poison && seerClaimer && R.isAlive(g, seerClaimer) && seerClaimer !== w) R.witchAct(g, w, { poison: seerClaimer });
        else R.witchAct(g, w, {});
        break;
      }
      case 'elect': {
        // 警长竞选: the seer runs with a check in hand; others run sometimes, wolves a bit more (fake seer)
        const e = g.elect;
        if (e.phase === 'sign') {
          for (const id of alive) {
            if (id in e.sign) continue;
            const seer = R.activeCard(g, id) === 'seer' && !camp(id);
            R.electSign(g, id, seer || rnd() < (camp(id) ? 0.35 : 0.2));
            if (g.step !== 'elect' || g.elect?.phase !== 'sign') break;
          }
        } else if (e.phase === 'speak') {
          R.electStartVote(g, true);
        } else {
          const v = R.electVoters(g).find(x => !(x in e.votes));
          const cand = R.electCandidates(g);
          const seer = cand.find(x => R.activeCard(g, x) === 'seer' && !camp(x));
          let t;
          if (camp(v)) t = cand.find(camp) || pick(cand);
          else t = seer && rnd() < 0.6 ? seer : pick(cand);
          R.electVote(g, v, t || null);
        }
        break;
      }
      case 'day': {
        if (g.speak?.pick) R.sheriffOrder(g, g.sheriff, rnd() < 0.5 ? 'up' : 'down', true);
        for (const l of g.seerLog) {
          if (!R.isAlive(g, l.from) || camp(l.from)) continue;
          seerClaimer = l.from;
          claimedGood.add(l.from);
          (l.wolf ? claimedWolf : claimedGood).add(l.to);
        }
        if (!seerClaimer && rnd() < FAKE_CLAIM) {
          const faker = alive.find(camp);
          const victim = pick(alive.filter(x => !camp(x)));
          if (faker && victim) { seerClaimer = faker; claimedWolf.add(victim); }
        }
        const sus = [...claimedWolf].filter(x => R.isAlive(g, x));
        const pool = alive.filter(x => !claimedGood.has(x));
        const wolves = pool.filter(liveWolf);
        suspect = sus.length && rnd() < FOLLOW ? sus[0] : (wolves.length && rnd() < READ ? pick(wolves) : pick(pool.length ? pool : alive));
        R.startVote(g);
        break;
      }
      case 'confirm': {
        const c = g.confirm;
        const h = c.ids.find(x => !(x in c.acked));
        if (R.badgePending(g, h)) {
          // the fallen 警长 hands the badge to a trusted ally
          const allies = others(h).filter(x => (camp(h) ? camp(x) : !camp(x) && !claimedWolf.has(x)));
          R.passBadge(g, h, pick(allies.filter(x => claimedGood.has(x))) || pick(allies) || null);
          break;
        }
        let shoot = null;
        if (c.hunter === h) {
          const sus = [...claimedWolf].filter(x => R.isAlive(g, x) && x !== h);
          shoot = (camp(h) ? pick(others(h).filter(x => !camp(x))) : sus[0] || pick(others(h))) || null;
        }
        R.ackLoss(g, h, { shoot });
        break;
      }
      case 'dusk': {
        R.nightfall(g, null, true, 0);
        break;
      }
      case 'vote': {
        const v = R.voters(g).find(x => !(x in g.votes));
        const cand = R.candidates(g);
        const others = id => cand.filter(x => x !== id);
        let t;
        if (camp(v)) {
          const good = others(v).filter(x => !camp(x) && x !== R.partnerOf(g, v));
          t = seerClaimer && good.includes(seerClaimer) && rnd() < 0.6 ? seerClaimer : pick(good.length ? good : others(v).filter(x => x !== R.partnerOf(g, v)));
        } else {
          // 金宝宝 know each other and never vote a fellow 金宝宝
          const ok = x => !(R.isBabyWin(rules) && rules.babyMeet !== 'no' && R.isBaby(g, v) && R.isBaby(g, x)) && x !== R.partnerOf(g, v);
          if (suspect && suspect !== v && ok(suspect) && cand.includes(suspect) && rnd() < 0.85) t = suspect;
          else t = pick(others(v).filter(x => !claimedGood.has(x) && ok(x))) || pick(others(v).filter(ok)) || null;
        }
        R.castVote(g, v, t || null);
        break;
      }
      default:
        return null;
    }
    learn();
  }
  return g.step === 'end' ? g : null;
}

/** Fraction of games the good camp wins, plus average length in days. */
export function estimate(n, cfg, games = 600) {
  const key = `${n}|${cfg.wolves}|${cfg.gods.join(',')}|${JSON.stringify(cfg.rules)}`;
  return seeded(hash(key), () => {
    let good = 0;
    let days = 0;
    let done = 0;
    for (let i = 0; i < games; i++) {
      const g = playOne(n, cfg);
      if (!g) continue;
      done++;
      if (g.winner === 'good') good++;
      days += g.day;
    }
    return { good: done ? good / done : 0.5, days: done ? days / done : 0 };
  });
}

// Every subset of gods that keeps seer or witch, indexed by bitmask over R.GODS.
const MASKS = Array.from({ length: 16 }, (_, m) => m);
const godsOf = m => R.GODS.filter((_, i) => m & (1 << i));
const GRID_GAMES = 600;
const CHECK_GAMES = 2000;

/** Simulate every deck (wolves × god subset), keep all numbers, pick the one closest to 50/50. */
function tune(n, rules) {
  const grid = {}; // `${wolves}:${mask}` → good win %
  let best = null;
  // 金刚狼 boards need a second wolf player, or the lone wolf is caught by the first check
  const minWolves = ['force', 'half'].includes(rules.doubleWolf) ? 3 : 1;
  for (let wolves = minWolves; wolves <= Math.ceil(n / 2); wolves++) {
    for (const m of MASKS) {
      const gods = godsOf(m);
      const cfg = { wolves, gods, rules, order: rules.order };
      if (R.buildDeck(n, cfg).error) continue;
      const e = estimate(n, cfg, GRID_GAMES);
      grid[`${wolves}:${m}`] = Math.round(e.good * 100);
      // recommend only "normal" boards: seer + witch always in
      if (!(gods.includes('seer') && gods.includes('witch'))) continue;
      const score = Math.abs(e.good - 0.5) - 0.004 * gods.length - 0.001 * e.days;
      if (!best || score < best.score) best = { wolves, gods, score };
    }
  }
  // re-measure the winner with a fresh seed so the published number isn't the lucky one
  const check = estimate(n, { wolves: best.wolves, gods: best.gods, rules: { ...rules, check: 1 }, order: rules.order }, CHECK_GAMES);
  return { wolves: best.wolves, gods: best.gods, good: Math.round(check.good * 100), days: Math.round(check.days * 10) / 10, grid };
}

const MAIN = process.argv[1]?.endsWith('werewolfBalance.js');
const arg = name => process.argv.includes(name);
const ALL = arg('--all');
const EFFECTS = arg('--effects');
const CHILD = process.argv.includes('--child');
const WORKERS = Number(process.argv[process.argv.indexOf('--workers') + 1]) || Math.max(1, os.cpus().length - 1);
// --redo key=value  recompute only the combos with that rule value
const REDO = process.argv.filter((a, i) => process.argv[i - 1] === '--redo').map(a => a.split('='));
const short = { seer: '预', witch: '女', hunter: '猎', guard: '守' };

// ------------------------------------------------------------- jobs ---
// A job is a plain JSON description so it can be shipped to a worker process.
function runJob(job) {
  if (job.kind === 'tune') {
    const out = {};
    for (let n = job.from; n <= R.MAX_PLAYERS; n++) out[n] = tune(n, job.rules);
    return out;
  }
  // effect: one deck, one rule set → good win %
  const e = estimate(job.n, { wolves: job.wolves, gods: job.gods, rules: job.rules, order: job.rules.order }, EFFECT_GAMES);
  return Math.round(e.good * 1000) / 10;
}
const EFFECT_GAMES = 2000;

/** Run jobs on WORKERS child processes (same script, --child), results in job order. */
function runAll(jobs) {
  if (WORKERS <= 1 || jobs.length <= 1) return Promise.resolve(jobs.map(runJob));
  return new Promise((resolve, reject) => {
    const results = new Array(jobs.length);
    let next = 0;
    let done = 0;
    let live = 0;
    const t0 = Date.now();
    const spawn = () => {
      const child = fork(fileURLToPath(import.meta.url), ['--child'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
      live++;
      const feed = () => {
        if (next >= jobs.length) { child.send({ quit: true }); return; }
        const i = next++;
        child.send({ i, job: jobs[i] });
      };
      child.on('message', ({ i, out }) => {
        results[i] = out;
        done++;
        if (done % Math.max(1, Math.floor(jobs.length / 20)) === 0 || done === jobs.length) {
          process.stdout.write(`  ${done}/${jobs.length} jobs, ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
        }
        feed();
      });
      child.on('exit', code => {
        live--;
        if (code) reject(new Error(`worker exited ${code}`));
        else if (!live) resolve(results);
      });
      feed();
    };
    for (let k = 0; k < Math.min(WORKERS, jobs.length); k++) spawn();
  });
}

if (CHILD) {
  process.on('message', msg => {
    if (msg.quit) { process.exit(0); return; }
    process.send({ i: msg.i, out: runJob(msg.job) });
  });
}

// ----------------------------------------------------------- tuning ---
async function tuneTable() {
  let prev = {};
  try { prev = (await import('../src/games/werewolf/balanceTable.js')).BALANCE_TABLE; } catch { /* first run */ }
  const combos = [{}];
  for (const key of [...R.TUNED_KEYS, 'cupid']) {
    const v = R.VARIANTS.find(x => x.key === key);
    const next = [];
    // options flagged as extras (4th field) only appear in presets, not in the full grid
    for (const c of combos) for (const [val, , , extra] of v.opts) if (!extra) next.push({ ...c, [key]: val });
    combos.splice(0, combos.length, ...next);
  }
  // presets built on extra options (村规金宝宝), with and without 丘比特
  // (and, for a preset that ships with the 警长, also without it, since DIY can switch it off)
  for (const p of R.PRESETS.filter(x => x.min)) {
    for (const cupid of ['no', 'yes']) for (const sheriff of new Set([p.rules.sheriff || 'no', 'no'])) combos.push({ ...p.rules, cupid, sheriff, min: p.min });
  }

  const table = {};
  const jobs = [];
  const keys = [];
  for (const combo of combos) {
    const { min = 0, ...rest } = combo;
    const rules = { ...R.DEFAULT_RULES, ...rest };
    const key = R.tableKey(rules);
    const redo = REDO.some(([k, v]) => rules[k] === v);
    if (!ALL && !redo && prev[key]) { table[key] = prev[key]; continue; } // reuse; --all recomputes
    keys.push(key);
    jobs.push({ kind: 'tune', rules, from: Math.max(min, rules.cupid === 'yes' ? R.CUPID_MIN : R.MIN_PLAYERS) });
  }
  console.log(`tuning ${jobs.length} rule combos on ${WORKERS} workers (${combos.length - jobs.length} reused)`);
  (await runAll(jobs)).forEach((out, i) => { table[keys[i]] = out; });

  const report = Object.entries(table).map(([key, row]) => `| ${key} | ` + Object.entries(row).map(([, r]) => `狼${r.wolves}${r.gods.map(x => short[x]).join('')} ${r.good}%`).join(' | ') + ' |');
  fs.writeFileSync(new URL('../src/games/werewolf/balanceTable.js', import.meta.url), `// Generated by scripts/werewolfBalance.js — do not edit by hand.
// For every combination of ${R.TUNED_KEYS.join(' | ')} and player count:
//   good/days/wolves/gods: recommended deck, good-camp win % (${CHECK_GAMES} games), avg days
//   grid["wolves:godMask"]: good-camp win % for every deck (${GRID_GAMES} games); godMask bits = ${R.GODS.join(', ')}
export const BALANCE_TABLE = ${JSON.stringify(table)};
`);
  fs.writeFileSync(new URL('../docs/werewolf-balance.md', import.meta.url), `# 双身份狼人 平衡模拟

由 \`node scripts/werewolfBalance.js\` 生成。中等水平启发式 AI：预言家公开报验人，村民按共识投票（无信息时 35% 概率投中狼），狼人抱团并优先刀预言家，守卫守预言家，女巫首夜救人、毒被指认的狼，金刚狼刀预言家或第二晚起使用；警长局里预言家上警、好人多半投给预言家，警长的票算 1.5 票。

每格：推荐牌组 + 好人胜率（${CHECK_GAMES} 局复测）。规则键依次为 ${R.TUNED_KEYS.join(' / ')}，后缀：|cupid 丘比特、|sj 预言家验阵营（金刚狼验成好人）、|nb 金宝宝不互认、|p3 三个平安夜、|sh 警长。

| 规则 | ${Array.from({ length: R.MAX_PLAYERS - R.MIN_PLAYERS + 1 }, (_, i) => `${i + R.MIN_PLAYERS} 人`).join(' | ')} |
|---|${'---|'.repeat(R.MAX_PLAYERS - R.MIN_PLAYERS + 1)}
${report.join('\n')}
`);
  console.log('wrote balanceTable.js + docs/werewolf-balance.md');
}

// ---------------------------------------------------------- effects ---
// For every preset × head count: keep that preset's recommended deck and flip
// ONE setting at a time, so the lobby can show whether a setting helps the
// good camp or the wolves.
const optionApplies = (key, rules, n) => (key !== 'babyMeet' || R.isBabyWin(rules)) && (key !== 'jglSkill' || R.jglPossible(rules)) && (key !== 'cupid' || n >= R.CUPID_MIN);

async function effectTable() {
  const jobs = [];
  const where = [];
  for (const p of R.PRESETS) {
    for (let n = Math.max(R.MIN_PLAYERS, p.min || 0); n <= R.MAX_PLAYERS; n++) {
      const base = { ...R.DEFAULT_RULES, ...p.rules, cupid: 'no' };
      const cfg = R.effectiveConfig(n, { auto: true, rules: base });
      if (R.buildDeck(n, cfg).error) continue;
      const deck = { wolves: cfg.wolves, gods: cfg.gods };
      jobs.push({ kind: 'effect', n, ...deck, rules: base });
      where.push([p.id, n, 'base', deck]);
      for (const v of R.VARIANTS) {
        for (const [val] of v.opts) {
          if (val === base[v.key]) continue;
          const rules = { ...base, [v.key]: val };
          if (!optionApplies(v.key, rules, n)) continue;
          if (R.buildDeck(n, { ...deck, rules }).error) { where.push([p.id, n, `${v.key}:${val}`, null]); continue; }
          jobs.push({ kind: 'effect', n, ...deck, rules });
          where.push([p.id, n, `${v.key}:${val}`]);
        }
      }
    }
  }
  console.log(`effects: ${jobs.length} simulations × ${EFFECT_GAMES} games on ${WORKERS} workers`);
  const out = await runAll(jobs);
  const table = {};
  let j = 0;
  for (const [id, n, key, deck] of where) {
    const row = ((table[id] ||= {})[n] ||= { opts: {} });
    if (key === 'base') { row.base = out[j++]; row.wolves = deck.wolves; row.gods = deck.gods; } else row.opts[key] = deck === null ? null : out[j++];
  }
  fs.writeFileSync(new URL('../src/games/werewolf/effectTable.js', import.meta.url), `// Generated by scripts/werewolfBalance.js --effects — do not edit by hand.
// EFFECT_TABLE[preset][players]: the preset's recommended deck (wolves/gods), its good-camp
// win % (base), and opts["key:value"] = good-camp win % with only that one setting changed
// (${EFFECT_GAMES} games each, ±2%); null = that setting can't be played with this deck.
export const EFFECT_GAMES = ${EFFECT_GAMES};
export const EFFECT_TABLE = ${JSON.stringify(table)};
`);
  console.log('wrote effectTable.js');
}

if (MAIN && !CHILD) {
  if (EFFECTS) await effectTable();
  else await tuneTable();
}

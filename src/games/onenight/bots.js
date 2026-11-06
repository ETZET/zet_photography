// Dev-only bots so one person can play through locally (host tab drives them),
// plus the pure bot policy the fuzz script (scripts/onenightFuzz.js) reuses.
import { useEffect } from 'react';
import { MAX_PLAYERS, CENTER, nightTask, nightAct, castVote, finalCard, canVoteFor } from './onenightRules.js';

const IS_DEV = !!import.meta.env?.DEV;
const BOT_NAMES = ['铁匠', '磨坊主', '牧羊人', '面包师', '酒馆老板', '织布工', '樵夫', '渔夫', '裁缝'];
const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
const pickN = (arr, n, rnd = Math.random) => {
  const a = [...arr];
  const out = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rnd() * a.length), 1)[0]);
  return out;
};

export function addBot(r) {
  if (r.players.length >= MAX_PLAYERS) return r;
  const used = new Set(r.players.map(p => p.name));
  const name = BOT_NAMES.find(b => !used.has(b)) || `村民${r.players.length + 1}`;
  r.players.push({ id: `bot-${crypto.randomUUID()}`, name, isBot: true, joinedAt: Date.now() });
  return r;
}

/** A legal random night pick for `id`. */
export function botNightPick(g, id, rnd = Math.random) {
  const t = nightTask(g, id);
  const others = g.seats.filter(x => x !== id);
  const centers = [...Array(CENTER).keys()];
  if (t.kind === 'dummy') return rnd() < 0.5 ? { players: [pick(g.seats, rnd)], center: [] } : { players: [], center: [pick(centers, rnd)] };
  if (t.alt && rnd() < 0.4) return { players: pickN(others, t.alt.players, rnd), center: pickN(centers, t.alt.center, rnd) };
  return { players: pickN(t.others ? others : g.seats, t.players, rnd), center: pickN(centers, t.center, rnd) };
}

/**
 * What a bot believes its own final card is (from its own night only).
 * 夜贼 knows what he took, 夜猫子 knows his final card; everybody else assumes no change.
 */
function believedCard(g, id) {
  const r = g.start[id];
  if (r === 'thief' && g.acts[id]?.players?.length) return g.start[g.acts[id].players[0]];
  if (r === 'owl' && g.final) return g.final.cards[id];
  return r;
}

/**
 * Vote policy. `read` = chance a village bot "figures out" a real wolf in the
 * discussion (stand-in for talking, which bots can't do).
 */
export function botVote(g, id, { read = 0.3, rnd = Math.random } = {}) {
  const me = believedCard(g, id);
  const cands = g.seats.filter(t => canVoteFor(g, id, t));
  const others = cands.filter(t => t !== id);
  const knownWolves = new Set(g.seats.filter(x => g.start[x] === 'wolf'));
  if (me === 'loner') return g.rules.selfVote === 'yes' && rnd() < 0.7 ? id : pick(others, rnd);
  if (me === 'wolf' || me === 'minion') {
    // wolves (by their dealt card) know the pack; vote someone outside it
    const safe = others.filter(t => !knownWolves.has(t));
    return pick(safe.length ? safe : others, rnd);
  }
  // village: hard info first (seer saw a wolf card), then a discussion read
  const seen = [];
  if (g.start[id] === 'seer' && g.acts[id]?.players?.length && g.start[g.acts[id].players[0]] === 'wolf') seen.push(g.acts[id].players[0]);
  if (g.start[id] === 'thief' && g.acts[id]?.players?.length && me === 'wolf') seen.length = 0;
  if (seen.length && rnd() < 0.8) return seen[0];
  const realWolves = others.filter(t => finalCard(g, t) === 'wolf');
  if (realWolves.length && rnd() < read) return pick(realWolves, rnd);
  return pick(others, rnd);
}

/** One bot move on the shared room (host tab). Returns true if something happened. */
export function botStep(room) {
  const g = room.game;
  if (room.phase !== 'game' || !g) return false;
  const bots = room.players.filter(p => p.isBot).map(p => p.id);
  if (g.step === 'night') {
    const b = bots.find(id => g.seats.includes(id) && !(id in g.acts));
    if (!b) return false;
    nightAct(g, b, botNightPick(g, b));
    return true;
  }
  if (g.step === 'vote') {
    const b = bots.find(id => g.seats.includes(id) && !(id in g.votes));
    if (!b) return false;
    castVote(g, b, botVote(g, b));
    return true;
  }
  return false;
}

export function useBots(room, isHost, update) {
  useEffect(() => {
    if (!IS_DEV || !isHost || !room?.players.some(p => p.isBot)) return undefined;
    if (!botStep(structuredClone(room))) return undefined;
    const t = setTimeout(() => update(r => { botStep(r); return r; }), 700);
    return () => clearTimeout(t);
  }, [room, isHost, update]);
}

// Dev-only bots so a single person can play a full game locally.
// The host's tab drives every bot, one action at a time.
import { useEffect } from 'react';
import {
  MAX_PLAYERS, isGood, leaderOf, questSize, markSeen, submitTeam, castVote, playCard, assassinate, ladyTargets, ladyExamine,
} from './avalonRules';

const IS_DEV = import.meta.env.DEV;
const BOT_NAMES = ['兰斯洛特', '高文', '加拉哈德', '崔斯坦', '贝狄威尔', '凯', '加雷斯', '鲍斯', '帕拉米德'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function addBot(r) {
  if (r.players.length >= MAX_PLAYERS) return r;
  const used = new Set(r.players.map(p => p.name));
  const name = BOT_NAMES.find(b => !used.has(b)) || `骑士${r.players.length + 1}`;
  r.players.push({ id: `bot-${crypto.randomUUID()}`, name, isBot: true, joinedAt: Date.now() });
  return r;
}

/** Perform at most one bot action on room.game. Returns true if something happened. */
export function botStep(room) {
  const g = room.game;
  if (room.phase !== 'game' || !g) return false;
  const bots = new Set(room.players.filter(p => p.isBot).map(p => p.id));
  const isBot = id => bots.has(id);

  switch (g.step) {
    case 'reveal': {
      const b = g.seats.find(id => isBot(id) && !g.seen[id]);
      if (!b) return false;
      markSeen(g, b);
      return true;
    }
    case 'propose': {
      const L = leaderOf(g);
      if (!isBot(L)) return false;
      const others = g.seats.filter(id => id !== L).sort(() => Math.random() - 0.5);
      g.team = [L, ...others].slice(0, questSize(g));
      submitTeam(g, L);
      return true;
    }
    case 'vote': {
      const b = g.seats.find(id => isBot(id) && !(id in g.votes));
      if (!b) return false;
      castVote(g, b, Math.random() < 0.7);
      return true;
    }
    case 'quest': {
      const b = g.team.find(id => isBot(id) && !(id in g.cards));
      if (!b) return false;
      playCard(g, b, isGood(g.assignments[b]) || Math.random() < 0.5);
      return true;
    }
    case 'lady': {
      if (!isBot(g.lady.holder)) return false;
      ladyExamine(g, g.lady.holder, pick(ladyTargets(g)));
      return true;
    }
    case 'assassin': {
      const a = g.seats.find(id => g.assignments[id] === 'assassin');
      if (!isBot(a)) return false;
      assassinate(g, a, pick(g.seats.filter(id => isGood(g.assignments[id]))));
      return true;
    }
    default:
      return false;
  }
}

export function useBots(room, isHost, update) {
  useEffect(() => {
    if (!IS_DEV || !isHost || !room?.players.some(p => p.isBot)) return undefined;
    if (!botStep(structuredClone(room))) return undefined;
    const t = setTimeout(() => update(r => { botStep(r); return r; }), 600);
    return () => clearTimeout(t);
  }, [room, isHost, update]);
}

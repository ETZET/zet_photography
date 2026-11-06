// Dev-only bots so one person can play 掼蛋 locally. The host tab drives them.
import { useEffect } from 'react';
import { PLAYERS, tributeTask } from './guandanRules';
import { decide, apply } from './guandanAI';

const IS_DEV = import.meta.env.DEV;
const BOT_NAMES = ['老张', '阿珍', '小李', '王师傅', '大刘', '阿芳'];

export function addBot(r) {
  if (r.players.length >= PLAYERS) return r;
  const used = new Set(r.players.map(p => p.name));
  const name = BOT_NAMES.find(b => !used.has(b)) || `牌友${r.players.length + 1}`;
  r.players.push({ id: `bot-${crypto.randomUUID()}`, name, isBot: true, joinedAt: Date.now() });
  return r;
}

/** Let one bot act. Returns true if something happened. */
export function botStep(room) {
  const g = room.game;
  if (room.phase !== 'game' || !g || (g.step !== 'play' && g.step !== 'tribute')) return false;
  const bots = new Set(room.players.filter(p => p.isBot).map(p => p.id));
  const seats = g.step === 'tribute' ? [0, 1, 2, 3].filter(s => tributeTask(g, s)) : [g.turn];
  const s = seats.find(x => x != null && bots.has(g.seats[x]));
  if (s == null) return false;
  return apply(g, s, decide(g, s));
}

export function useBots(room, isHost, update) {
  useEffect(() => {
    if (!IS_DEV || !isHost || !room?.players.some(p => p.isBot)) return undefined;
    if (!botStep(structuredClone(room))) return undefined;
    const ms = window.__gdBotMs ?? 650;
    const t = setTimeout(() => update(r => { botStep(r); return r; }), ms);
    return () => clearTimeout(t);
  }, [room, isHost, update]);
}

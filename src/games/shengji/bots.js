// Dev-only bots so one person can play 升级 locally. The host tab drives them.
import { useEffect, useState } from 'react';
import { botBid, botBury, botFollow, botLead, bidDeadline, dealEnd, declare, pass, bury, play, turnOf } from './shengjiRules';

const IS_DEV = import.meta.env.DEV;
const BOT_NAMES = ['东风', '南风', '西风', '北风'];
export const MAX_PLAYERS = 4;

export function addBot(r) {
  if (r.players.length >= MAX_PLAYERS) return r;
  const used = new Set(r.players.map(p => p.name));
  const name = BOT_NAMES.find(b => !used.has(b)) || `电脑${r.players.length + 1}`;
  r.players.push({ id: `bot-${crypto.randomUUID()}`, name, isBot: true, joinedAt: Date.now() });
  return r;
}

// seeded so the dry run and the real update make the same decision
function seeded(...xs) {
  let s = xs.reduce((a, x) => (a * 31 + x) >>> 0, 7);
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** One bot action (mutates r.game). Returns false if no bot has anything to do. */
export function botStep(room, now = Date.now()) {
  const g = room.game;
  if (room.phase !== 'game' || !g) return false;
  const isBot = seat => room.players.find(p => p.id === g.seats[seat])?.isBot;
  switch (g.step) {
    case 'deal': {
      if (now > bidDeadline(g)) return false;
      const tick = Math.floor((now - g.dealStart) / 700);
      for (let s = 0; s < 4; s++) {
        if (!isBot(s)) continue;
        const b = botBid(g, s, now, seeded(g.hand, s, tick));
        if (b) { declare(g, s, b, now); return true; }
      }
      if (now >= dealEnd(g)) {
        const s = [0, 1, 2, 3].find(x => isBot(x) && !g.passes.includes(x));
        if (s != null) { pass(g, s, now); return true; }
      }
      return false;
    }
    case 'bury':
      if (!isBot(g.dealer)) return false;
      bury(g, g.dealer, botBury(g, g.dealer));
      return true;
    case 'play': {
      const s = turnOf(g);
      if (!isBot(s)) return false;
      play(g, s, g.trick.plays.length ? botFollow(g, s) : botLead(g, s), now);
      return true;
    }
    default:
      return false;
  }
}

export function useBots(room, isHost, update) {
  const g = room?.game;
  const active = IS_DEV && isHost && room?.players.some(p => p.isBot);
  // during the deal nothing changes in the room, so tick to let bots look at new cards
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active || g?.step !== 'deal') return undefined;
    const t = setInterval(() => setTick(x => x + 1), Math.max(120, 600 * (g.timeScale ?? 1)));
    return () => clearInterval(t);
  }, [active, g?.step, g?.dealStart, g?.timeScale]);
  useEffect(() => {
    if (!active || window.__sjBotsPaused) return undefined;
    if (!botStep(structuredClone(room), Date.now())) return undefined;
    const ts = g.timeScale ?? 1;
    let delay = 650 * ts;
    // leave the finished trick on the table for a moment before a bot leads again
    if (g.step === 'play' && !g.trick.plays.length && g.lastTrick) delay = Math.max(delay, g.lastTrick.at + 1600 * ts - Date.now());
    const t = setTimeout(() => update(r => { botStep(r, Date.now()); return r; }), Math.max(40, delay));
    return () => clearTimeout(t);
  }, [room, active, update, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

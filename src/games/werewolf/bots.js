// Dev-only bots so one person can play through locally. Host tab drives them.
import { useEffect } from 'react';
import {
  MAX_PLAYERS, activeCard, alivePlayers, isWolfCamp, isNightWolf, voters, canSelfSave, swapCards, lockCards, guardAct, wolfAct, seerAct, witchAct,
  ackLoss, castVote, candidates, speakerNow, nextSpeaker,
} from './wolfRules';

const IS_DEV = import.meta.env.DEV;
const BOT_NAMES = ['铁匠', '磨坊主', '牧羊人', '面包师', '酒馆老板', '织布工', '樵夫', '渔夫', '裁缝'];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function addBot(r) {
  if (r.players.length >= MAX_PLAYERS) return r;
  const used = new Set(r.players.map(p => p.name));
  const name = BOT_NAMES.find(b => !used.has(b)) || `村民${r.players.length + 1}`;
  r.players.push({ id: `bot-${crypto.randomUUID()}`, name, isBot: true, joinedAt: Date.now() });
  return r;
}

export function botStep(room) {
  const g = room.game;
  if (room.phase !== 'game' || !g) return false;
  const bots = new Set(room.players.filter(p => p.isBot).map(p => p.id));
  const isBot = id => bots.has(id);
  const others = id => alivePlayers(g).filter(x => x !== id);
  const role = id => activeCard(g, id);

  switch (g.step) {
    case 'arrange': {
      const b = g.seats.find(id => isBot(id) && !g.hands[id].locked);
      if (!b) return false;
      const [top, bottom] = g.hands[b].cards;
      if ((bottom === 'wolf' && top !== 'wolf') || (top === 'villager' && bottom !== 'villager' && Math.random() < 0.5)) swapCards(g, b);
      lockCards(g, b);
      return true;
    }
    case 'night': {
      const b = g.seats.find(id => isBot(id) && (
        (role(id) === 'guard' && !g.acts.guard) || (isNightWolf(g, id) && !(id in g.acts.wolves)) || (role(id) === 'seer' && !g.acts.seer)));
      if (!b) return false;
      if (role(b) === 'guard' && !g.acts.guard) guardAct(g, b, pick(alivePlayers(g).filter(x => x !== g.guardLast)));
      else if (role(b) === 'seer' && !g.acts.seer) seerAct(g, b, pick(others(b)));
      else {
        const prey = alivePlayers(g).filter(x => !isWolfCamp(g, x));
        wolfAct(g, b, pick(prey.length ? prey : others(b)));
      }
      return true;
    }
    case 'witch': {
      const b = g.seats.find(id => isBot(id) && role(id) === 'witch');
      if (!b || g.acts.witchDone) return false;
      if (g.potions.save && g.acts.kill && !g.acts.doubleKill && (g.acts.kill !== b || canSelfSave(g)) && Math.random() < 0.5) witchAct(g, b, { save: true });
      else if (g.potions.poison && Math.random() < 0.2) witchAct(g, b, { poison: pick(others(b)) });
      else witchAct(g, b, {});
      return true;
    }
    case 'confirm': {
      const b = g.confirm.ids.find(id => isBot(id) && !(id in g.confirm.acked));
      if (!b) return false;
      ackLoss(g, b, { shoot: g.confirm.hunter === b && Math.random() < 0.7 ? pick(others(b)) || null : null });
      return true;
    }
    case 'day': case 'dusk': {
      const s = speakerNow(g);
      if (!s || !isBot(s)) return false;
      nextSpeaker(g, s);
      return true;
    }
    case 'vote': {
      const b = voters(g).find(id => isBot(id) && !(id in g.votes) && !(g.pk || []).includes(id));
      if (!b) return false;
      castVote(g, b, Math.random() < 0.1 ? null : pick(candidates(g).filter(x => x !== b)) || null);
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
    const t = setTimeout(() => update(r => { botStep(r); return r; }), 700);
    return () => clearTimeout(t);
  }, [room, isHost, update]);
}

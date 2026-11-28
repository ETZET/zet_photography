// Deal effect shown when a game (or a 掼蛋 hand) starts: the deck shuffles in the
// middle, card backs fly round-robin to every player's name (you at the bottom),
// your pile lands last with a little bounce, and a soft tick plays per card.
// Tap anywhere to skip; it never blocks the game underneath for more than ~3 s.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CardBack } from './PlayingCard';
import { Who } from '../avalon/ui';
import './dealfx.css';

const SHUFFLE_MS = 650;
const HOLD_MS = 900;

/** One short filtered-noise "flick" per card; silent if audio isn't allowed yet. */
export function useFlick() {
  const ctx = useRef(null);
  useEffect(() => () => { ctx.current?.close?.().catch(() => {}); }, []);
  return (at = 0) => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx.current ||= new AC();
      const c = ctx.current;
      if (c.state === 'suspended') c.resume().catch(() => {});
      const t = c.currentTime + at;
      const len = Math.floor(c.sampleRate * 0.05);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.8;
      const g = c.createGain();
      g.gain.value = 0.18;
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t);
    } catch { /* no audio: fine */ }
  };
}

/**
 * seats: player ids in seat order; myId sits at the bottom, the next seat to the
 * right, and so on around the table. title / sub: the caption under the deck.
 */
export default function DealFx({ seats, myId, title, sub, onDone }) {
  // skipped for reduced motion, and in automated browsers unless a test asks for it (window.__dealFx)
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || (navigator.webdriver && !window.__dealFx);
  const n = seats.length;
  const me = Math.max(0, seats.indexOf(myId));
  const spots = useMemo(() => seats.map((id, i) => {
    const k = (i - me + n) % n; // 0 = me (bottom), then counter-clockwise on screen: right, top, left …
    const a = Math.PI / 2 - (k * 2 * Math.PI) / n;
    return { id, k, x: 50 + 40 * Math.cos(a), y: 50 + 36 * Math.sin(a) };
  }), [seats, me, n]);
  const rounds = n <= 4 ? 6 : n <= 8 ? 3 : 2;
  const total = n * rounds;
  const step = Math.min(85, 1500 / total);
  // deal starts with the player after me so my last card is the final one
  const cards = useMemo(() => Array.from({ length: total }, (_, i) => spots[(me + 1 + i) % n]), [spots, total, me, n]);
  const dealMs = SHUFFLE_MS + total * step + 350;
  const [phase, setPhase] = useState('deal'); // deal → mine
  const flick = useFlick();
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone?.(); } };

  useEffect(() => {
    if (reduce) { finish(); return undefined; }
    cards.forEach((_, i) => flick((SHUFFLE_MS + i * step) / 1000));
    const t1 = setTimeout(() => setPhase('mine'), dealMs);
    const t2 = setTimeout(finish, dealMs + HOLD_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (reduce) return null;
  return (
    <div className={`dfx ${phase}`} onPointerDown={finish} data-testid="deal-fx">
      <div className="dfx-deck">
        {[0, 1, 2, 3].map(i => <span key={i} className="dfx-shuf" style={{ '--i': i }}><CardBack w={30} /></span>)}
      </div>
      {cards.map((s, i) => (
        <span key={i} className={`dfx-card ${s.id === myId ? 'mine' : ''}`}
          style={{ '--x': `${s.x}%`, '--y': `${s.y}%`, '--r': `${(i * 37) % 24 - 12}deg`, animationDelay: `${SHUFFLE_MS + i * step}ms` }}>
          <CardBack w={26} />
        </span>
      ))}
      {spots.map(s => (
        <div key={s.id} className={`dfx-name ${s.id === myId ? 'mine' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          {s.id === myId ? <span className="dfx-me">{phase === 'mine' ? '拿牌！' : '你'}</span> : <Who id={s.id} />}
        </div>
      ))}
      <div className="dfx-caption">
        <div className="fs-24 c-gold shadow-px">{title}</div>
        {sub && <div className="fs-12 c-dim mt-1">{sub}</div>}
        <div className="fs-12 c-mute mt-1">轻点跳过</div>
      </div>
    </div>
  );
}

// Shared Avalon UI bits: player name tags, confirm dialog, confetti.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { seatColorHi } from '../pixel/portraits';

// ------------------------------------------------------------------ Who ---
// Every mention of a player is a pixel tag: [seat no.|nickname], tinted with
// the seat's colour, so "3号" and the nickname are always seen together.

const PlayersCtx = createContext({ seatOf: {}, nameOf: {}, myId: null });

export function PlayersProvider({ order, players, myId, children }) {
  const value = useMemo(() => {
    const nameOf = Object.fromEntries(players.map(p => [p.id, p.name]));
    const seatOf = Object.fromEntries(order.map((id, i) => [id, i]));
    return { seatOf, nameOf, myId };
  }, [order, players, myId]);
  return <PlayersCtx.Provider value={value}>{children}</PlayersCtx.Provider>;
}

export function Who({ id, size, tone, className = '' }) {
  const { seatOf, nameOf, myId } = useContext(PlayersCtx);
  const seat = seatOf[id];
  const name = nameOf[id] ?? '?';
  const cls = ['px-who', size, tone, id === myId && 'me', className].filter(Boolean).join(' ');
  return (
    <span className={cls} title={`${seat === undefined ? '?' : seat + 1}号 ${name}${id === myId ? '（你）' : ''}`} data-who={seat === undefined ? '' : seat + 1}>
      <b style={{ background: seat === undefined ? '#9aa3b2' : seatColorHi(seat) }}>{seat === undefined ? '?' : seat + 1}</b>
      <span>{name}</span>
    </span>
  );
}

/** A row of tags; `empty` when there are none. */
export function WhoList({ ids, size, tone, empty = '—' }) {
  if (!ids?.length) return <span className="c-mute">{empty}</span>;
  return <span className="inline-flex flex-wrap items-center gap-y-1">{ids.map(id => <Who key={id} id={id} size={size} tone={tone} />)}</span>;
}

/** Plain-text label for aria / titles. */
export function useWhoText() {
  const { seatOf, nameOf } = useContext(PlayersCtx);
  return useCallback(id => `${(seatOf[id] ?? -1) + 1}号 ${nameOf[id] ?? '?'}`, [seatOf, nameOf]);
}

// -------------------------------------------------------------- Confirm ---
// Guard for irreversible actions: `const ok = await confirm({...})`.

const ConfirmCtx = createContext({ ask: async () => true, req: null, done: () => {} });
export const useConfirm = () => useContext(ConfirmCtx).ask;

/** Holds the pending question; <ConfirmOutlet/> renders it (inside PlayersProvider so tags work). */
export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const resolver = useRef(null);
  const ask = useCallback(opts => new Promise(resolve => {
    resolver.current?.(false);
    resolver.current = resolve;
    setReq(opts);
  }), []);
  const done = useCallback(ok => { resolver.current?.(ok); resolver.current = null; setReq(null); }, []);
  const value = useMemo(() => ({ ask, req, done }), [ask, req, done]);
  return <ConfirmCtx.Provider value={value}>{children}</ConfirmCtx.Provider>;
}

export function ConfirmOutlet() {
  const { req, done } = useContext(ConfirmCtx);
  if (!req) return null;
  return (
    <div className="px-overlay z-[70]" onClick={() => done(false)} data-testid="confirm">
      <div className={`px-frame pad px-pop max-w-[440px] w-full ${req.tone === 'danger' ? 'danger' : 'gold'}`} onClick={e => e.stopPropagation()}>
        <div className="px-title">{req.title}</div>
        <div className="mb-5 leading-relaxed">{req.body}</div>
        <div className="grid grid-cols-2">
          <button className="px-btn dark" onClick={() => done(false)} data-testid="confirm-cancel">{req.cancel || '再想想'}</button>
          <button className={`px-btn ${req.tone === 'danger' ? 'red' : 'gold'}`} onClick={() => done(true)} data-testid="confirm-ok" autoFocus>
            {req.ok || '确认'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Confetti ---
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 20) / 10,
  dur: 2.2 + ((i * 17) % 10) / 10,
  size: 6 + (i % 3) * 3,
}));

export function Confetti({ colors }) {
  return (
    <div className="px-confetti" aria-hidden>
      {CONFETTI.map((c, i) => (
        <span key={i} style={{
          left: `${c.left}%`, width: c.size, height: c.size,
          background: colors[i % colors.length],
          animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`,
        }} />
      ))}
    </div>
  );
}

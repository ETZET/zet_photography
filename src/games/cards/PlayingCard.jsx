// Reusable pixel playing cards for any card game: a card face, a card back,
// a fanned row for the table, and a phone-sized hand picker (columns of
// stacked cards, tap or swipe to select).
//
// A "face" is plain data, so games decide what their cards mean:
//   { id, rank: '10', suit: '♥', red: true, joker: null | 'big' | 'small', tag: null | 'wild' | 'level' }
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './cards.css';

export function CardFace({ face, w = 44, selected = false, dim = false, className = '', style, ...rest }) {
  const h = Math.round(w * 1.4);
  const cls = ['pc', face.red ? 'red' : 'black', face.joker && 'joker', face.tag, selected && 'sel', dim && 'dim', className].filter(Boolean).join(' ');
  const big = Math.max(16, Math.round(w * 0.5));
  return (
    <div className={cls} style={{ width: w, height: h, ...style }} data-cid={face.id} {...rest}>
      <span className="pc-corner">
        {face.joker
          ? <><b>{face.joker === 'big' ? '大' : '小'}</b><b>王</b></>
          : <><b className={face.rank === '10' ? 'ten' : ''}>{face.rank}</b><i>{face.suit}</i></>}
      </span>
      <span className="pc-pip" style={{ fontSize: big }}>{face.joker ? '★' : face.suit}</span>
      {face.tag === 'wild' && <span className="pc-badge">配</span>}
    </div>
  );
}

export function CardBack({ w = 26, count, warn = false, className = '' }) {
  return (
    <div className={`pc-back ${warn ? 'warn' : ''} ${className}`} style={{ width: w, height: Math.round(w * 1.4) }}>
      {count != null && <span>{count}</span>}
    </div>
  );
}

/** Cards side by side with overlap, e.g. the play on the table. */
export function CardRow({ faces, w = 30, maxWidth = 240, className = '' }) {
  const n = faces.length;
  const step = n > 1 ? Math.min(w * 0.62, (maxWidth - w) / (n - 1)) : 0;
  return (
    <div className={`pc-row ${className}`} style={{ width: n ? w + step * (n - 1) : 0, height: Math.round(w * 1.4) }}>
      {faces.map((f, i) => <CardFace key={f.id} face={f} w={w} style={{ position: 'absolute', left: i * step, top: 0 }} />)}
    </div>
  );
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * The hand: `columns` = [[face, …], …] left → right (e.g. one column per rank).
 * Tap a card to toggle it; drag across cards to select / unselect a run.
 * `selectable(id)` limits which cards can be picked (e.g. tribute).
 */
export function HandPicker({ columns, selected, onChange, selectable, maxW = 56, testid = 'hand' }) {
  const box = useRef(null);
  const { w: W, h: H } = useSize(box);
  const drag = useRef(null);
  const cols = columns.length;
  const tallest = Math.max(1, ...columns.map(c => c.length));
  // card width from the box, then the overlap that makes every column fit
  // largest card that still leaves ~26px (rank + suit corner) per stacked card in the tallest column
  const cw = Math.max(34, Math.min(maxW, Math.floor(W / 7.2), Math.floor((H - 8 - (tallest - 1) * 26) / 1.4)));
  const ch = Math.round(cw * 1.4);
  const sx = cols > 1 ? Math.min(cw + 3, (W - cw - 2) / (cols - 1)) : 0;
  const sy = tallest > 1 ? Math.max(10, Math.min(Math.round(cw * 0.6), (H - ch - 4) / (tallest - 1))) : 0;
  const totalW = cols ? cw + sx * (cols - 1) : 0;
  const x0 = Math.max(0, (W - totalW) / 2);
  const can = useCallback(id => !selectable || selectable(id), [selectable]);

  const setOne = (id, on) => {
    if (!can(id)) return;
    const next = new Set(selected);
    if (on) next.add(id); else next.delete(id);
    onChange(next);
  };
  const idAt = (x, y) => {
    const el = document.elementFromPoint(x, y)?.closest?.('[data-cid]');
    return el && box.current?.contains(el) ? Number(el.dataset.cid) : null;
  };
  const down = e => {
    const id = idAt(e.clientX, e.clientY);
    if (id == null || !can(id)) return;
    const on = !selected.has(id);
    drag.current = { on, seen: new Set([id]), sel: new Set(selected) };
    if (on) drag.current.sel.add(id); else drag.current.sel.delete(id);
    onChange(new Set(drag.current.sel));
    box.current?.setPointerCapture?.(e.pointerId);
  };
  const move = e => {
    const d = drag.current;
    if (!d) return;
    const id = idAt(e.clientX, e.clientY);
    if (id == null || d.seen.has(id) || !can(id)) return;
    d.seen.add(id);
    if (d.on) d.sel.add(id); else d.sel.delete(id);
    onChange(new Set(d.sel));
  };
  const up = () => { drag.current = null; };
  useEffect(() => () => { drag.current = null; }, []);

  return (
    <div ref={box} className="pc-hand" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid={testid}>
      {W > 0 && columns.map((col, ci) => col.map((f, ri) => (
        <CardFace key={f.id} face={f} w={cw} selected={selected.has(f.id)} dim={!can(f.id)}
          role="button" tabIndex={0} aria-pressed={selected.has(f.id)} aria-label={f.joker ? `${f.joker === 'big' ? '大' : '小'}王` : `${f.suit}${f.rank}`}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOne(f.id, !selected.has(f.id)); } }}
          style={{ position: 'absolute', left: x0 + ci * sx, top: 4 + ri * sy, zIndex: ri + 1 }} />
      )))}
    </div>
  );
}

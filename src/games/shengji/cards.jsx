// Pixel playing cards for 升级: suit glyphs, a single card, a fanned row, and the
// phone hand (1–3 overlapping rows that always fit the screen width).
import { useLayoutEffect, useRef, useState } from 'react';
import PixelSprite from '../pixel/PixelSprite';
import { RED, isTrump, rankZh } from './shengjiRules';
import './shengji.css';

const GLYPHS = {
  S: ['...#...', '..###..', '.#####.', '#######', '#######', '.#.#.#.', '...#...', '..###..'],
  H: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...', '.......'],
  C: ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..', '.......'],
  D: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...', '.......'],
  X: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#', '.......'],
};
const INK = { red: '#d63c34', black: '#241c30', gold: '#a8701a' };
const glyphPixels = {};
function glyph(s, color) {
  const k = `${s}:${color}`;
  if (!glyphPixels[k]) glyphPixels[k] = GLYPHS[s].map(r => Array.from(r, c => (c === '#' ? color : null)));
  return glyphPixels[k];
}

export function Suit({ s, scale = 2, color }) {
  const c = color || (RED[s] ? INK.red : INK.black);
  return <PixelSprite pixels={glyph(s, c)} scale={scale} className="sj-glyph" />;
}

/** Inline text like "♠A" using pixel glyphs (for logs / banners on dark backgrounds). */
export function CardText({ id, light = true }) {
  if (id[0] === 'X') return <span className={id[1] === 'B' ? 'c-evil' : light ? 'c-ink' : ''}>{id[1] === 'B' ? '大王' : '小王'}</span>;
  const red = RED[id[0]];
  return (
    <span className={`sj-ctext ${red ? 'red' : light ? 'blk-l' : 'blk'}`}>
      <Suit s={id[0]} scale={1.5} color={red ? '#ff8a80' : light ? '#f6ecd2' : INK.black} />{rankZh(id[1])}
    </span>
  );
}

/** One card. size: 'lg' (hand) | 'sm' (table) | 'xs' (logs) */
export function Card({ id, ctx, size = 'lg', sel, dim, style, onClick, testid }) {
  const joker = id[0] === 'X';
  const red = joker ? id[1] === 'B' : RED[id[0]];
  const trump = ctx && isTrump(id, ctx);
  const cls = ['sj-card', size, red ? 'red' : 'blk', trump && 'trump', sel && 'sel', dim && 'dim', onClick && 'tap'].filter(Boolean).join(' ');
  const glyphScale = size === 'lg' ? 1.7 : size === 'sm' ? 1.2 : 1;
  return (
    <div className={cls} style={style} onClick={onClick} data-card={id} data-testid={testid} role={onClick ? 'button' : undefined} aria-pressed={onClick ? !!sel : undefined}>
      <div className="ix">
        {joker
          ? <><span className="jk">{id[1] === 'B' ? '大' : '小'}</span><span className="jk">王</span></>
          : <><span className="rk">{rankZh(id[1])}</span><Suit s={id[0]} scale={glyphScale} /></>}
      </div>
      {size !== 'xs' && (
        <div className="pic">
          {joker ? <Suit s="X" scale={size === 'lg' ? 3 : 2} color={red ? INK.red : INK.black} /> : <Suit s={id[0]} scale={size === 'lg' ? 3 : 2} />}
        </div>
      )}
    </div>
  );
}

/** Cards in a fanned row that fits maxW. */
export function CardRow({ ids, ctx, size = 'sm', maxW = 140, hi = [] }) {
  const cw = size === 'sm' ? 28 : size === 'xs' ? 20 : 44;
  const stride = ids.length > 1 ? Math.min(cw * 0.55, (maxW - cw) / (ids.length - 1)) : 0;
  const w = ids.length ? cw + stride * (ids.length - 1) : 0;
  return (
    <div className="sj-row" style={{ width: w, height: size === 'sm' ? 40 : size === 'xs' ? 28 : 62 }}>
      {ids.map((id, i) => <Card key={id + i} id={id} ctx={ctx} size={size} style={{ left: i * stride }} dim={hi.length > 0 && !hi.includes(id)} />)}
    </div>
  );
}

function useWidth(ref) {
  const [w, setW] = useState(360);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const el = ref.current;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * The player's hand: sorted cards in as few overlapping rows as keep each card's
 * corner readable (stride ≥ minStride). Tap toggles a card.
 */
export function Hand({ ids, ctx, selected = [], onToggle, cw = 44, ch = 62, minStride = 20, maxRows = 3, testid = 'hand' }) {
  const ref = useRef(null);
  const W = useWidth(ref);
  const n = ids.length;
  let rows = 1;
  while (rows < maxRows && n > 1 && (W - cw) / (Math.ceil(n / rows) - 1) < minStride) rows += 1;
  const per = Math.ceil(n / rows) || 1;
  const stride = per > 1 ? Math.min(cw + 6, (W - cw) / (per - 1)) : 0;
  const rowGap = Math.round(ch * 0.62);
  const height = ch + (rows - 1) * rowGap + 14;
  const sel = new Set(selected);
  return (
    <div ref={ref} className="sj-hand" style={{ height }} data-testid={testid} data-count={n}>
      {ids.map((id, i) => {
        const r = Math.floor(i / per);
        const c = i % per;
        const inRow = Math.min(per, n - r * per);
        const offset = (W - (cw + stride * (inRow - 1))) / 2;
        return (
          <Card key={id} id={id} ctx={ctx} size="lg" sel={sel.has(id)} testid="hand-card"
            style={{ left: offset + c * stride, top: 14 + r * rowGap, zIndex: i + 1, width: cw, height: ch }}
            onClick={onToggle ? () => onToggle(id) : undefined} />
        );
      })}
    </div>
  );
}

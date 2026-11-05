import { useMemo } from 'react';
import { PALETTE, SPRITES } from './sprites';
import { PORTRAITS, seatToken } from './portraits';

function toPixels(rows, colors) {
  const pal = { ...PALETTE, ...colors };
  return rows.map(r => Array.from(r, c => (c === '.' ? null : pal[c] ?? null)));
}

/**
 * Renders a pixel grid as crisp SVG.
 * Pass `pixels` (2D colour array), `portrait` (role id), or `name` (legacy char sprite).
 * `fluid` makes it fill its container width.
 */
export default function PixelSprite({ name, portrait, pixels, colors, scale = 4, fluid = false, className = '', title, style }) {
  const grid = useMemo(() => {
    if (pixels) return pixels;
    if (portrait) return PORTRAITS[portrait];
    return toPixels(SPRITES[name], colors);
  }, [pixels, portrait, name, colors]);

  const { rects, w, h } = useMemo(() => {
    const out = [];
    const width = Math.max(...grid.map(r => r.length));
    grid.forEach((row, y) => {
      // merge horizontal runs of the same colour to keep the DOM small
      let x = 0;
      while (x < row.length) {
        const c = row[x];
        let run = 1;
        while (x + run < row.length && row[x + run] === c) run++;
        if (c) out.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={c} />);
        x += run;
      }
    });
    return { rects: out, w: width, h: grid.length };
  }, [grid]);

  return (
    <svg
      className={className}
      style={style}
      width={fluid ? '100%' : w * scale}
      height={fluid ? undefined : h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}

export function Portrait({ role, scale = 4, className, style }) {
  return <PixelSprite portrait={role} scale={scale} className={className} style={style} />;
}

export function SeatToken({ seat, scale = 3 }) {
  const px = useMemo(() => seatToken(seat), [seat]);
  return <PixelSprite pixels={px} scale={scale} />;
}

/** Two-frame flicker torch. */
export function Torch({ scale = 4 }) {
  return (
    <span className="px-torch" style={{ width: 8 * scale, height: 12 * scale }}>
      <PixelSprite name="torchA" scale={scale} className="px-torch-a" />
      <PixelSprite name="torchB" scale={scale} className="px-torch-b" />
    </span>
  );
}

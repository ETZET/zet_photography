import { useEffect, useState } from 'react';
import PixelSprite, { Portrait, SeatToken } from '../pixel/PixelSprite';
import { TABLE } from '../pixel/portraits';
import { Who } from './ui';

function useNarrow() {
  const q = '(max-width: 640px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return undefined;
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

/**
 * Players seated clockwise around the table, seat 1 at the top.
 * seats: [{ id, name, isBot }]   (index = seat number - 1)
 * decorate(id) → { top, badge, cls, role, clickable }
 */
export default function RoundTable({ seats, capacity, myId, decorate = () => ({}), onSeatClick, center, compact = false }) {
  const narrow = useNarrow();
  const total = Math.max(seats.length, capacity || 0);
  const rx = narrow ? 40 : 43;
  const ry = narrow && compact ? 37 : 40;

  return (
    <div className={`px-table ${compact ? 'compact' : ''}`}>
      <div className="px-table-img"><PixelSprite pixels={TABLE} fluid /></div>
      <div className="px-table-center">{center}</div>

      {Array.from({ length: total }, (_, i) => {
        const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
        const left = `${50 + rx * Math.cos(angle)}%`;
        const top = `${50 + ry * Math.sin(angle)}%`;
        const p = seats[i];
        if (!p) {
          return (
            <div key={`empty-${i}`} className="px-seat px-seat-empty" style={{ left, top }}>
              <div className="px-seat-top" />
              <div className="px-seat-ring"><div style={{ width: narrow ? 32 : 48, height: narrow ? 32 : 48 }} className="flex items-center justify-center fs-12 c-mute">空</div></div>
              <div className="px-seat-name c-mute">#{i + 1}</div>
            </div>
          );
        }
        const d = decorate(p.id, i) || {};
        const clickable = !!(onSeatClick && d.clickable);
        const cls = ['px-seat', p.id === myId && 'me', clickable && 'clickable', d.cls].filter(Boolean).join(' ');
        const Tag = clickable ? 'button' : 'div';
        return (
          <Tag
            key={p.id}
            type={clickable ? 'button' : undefined}
            className={cls}
            style={{ left, top }}
            onClick={clickable ? () => onSeatClick(p.id) : undefined}
            data-testid={`seat-${p.name}`}
            aria-label={`${i + 1}号 ${p.name}`}
          >
            <div className="px-seat-top">{d.top}{p.id === myId && <span className="px-tag good">你</span>}</div>
            <div className="px-seat-ring">
              {d.role
                ? <Portrait role={d.role} scale={narrow ? 1 : 1.5} />
                : <SeatToken seat={i} scale={narrow ? 2 : 3} />}
              {d.badge && <div className="px-seat-badge">{d.badge}</div>}
              {d.corner}
            </div>
            <Who id={p.id} />
          </Tag>
        );
      })}
    </div>
  );
}

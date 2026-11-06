import { useMemo } from 'react';
import '@fontsource/fusion-pixel-12px-proportional-sc';
import './games.css';
import PixelSprite, { Portrait, Torch } from './pixel/PixelSprite';
import { SKYLINE } from './pixel/portraits';
import { GAMES as REGISTERED, GAME_BY_ID } from './registry';

export const GAMES = [
  ...REGISTERED.map(g => ({ ...g, ready: true })),
  { id: 'soon', title: '敬请期待', en: 'COMING SOON', desc: '下一个小游戏正在像素化…', ready: false },
];

function Starfield() {
  // deterministic pseudo-random stars so they don't jump on re-render
  const stars = useMemo(() => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 60 }, (_, i) => ({
      key: i, left: `${rnd() * 100}%`, top: `${rnd() * 70}%`,
      delay: `${(rnd() * 3).toFixed(2)}s`, size: rnd() > 0.85 ? 6 : 3,
    }));
  }, []);
  return (
    <div className="px-stars" aria-hidden>
      {stars.map(s => <span key={s.key} className="px-star" style={{ left: s.left, top: s.top, animationDelay: s.delay, width: s.size, height: s.size }} />)}
    </div>
  );
}

export function PixelShell({ children }) {
  return (
    <div className="px-root">
      <Starfield />
      <div className="px-moon" aria-hidden />
      <div className="px-skyline" aria-hidden><PixelSprite pixels={SKYLINE} fluid /></div>
      <div className="px-content">{children}</div>
    </div>
  );
}

export default function GamesPage({ gameId, onSelectGame }) {
  const Game = GAME_BY_ID[gameId]?.Game;
  if (Game) {
    return (
      <PixelShell>
        <Game onExit={() => onSelectGame(null)} />
      </PixelShell>
    );
  }

  return (
    <PixelShell>
      <header className="flex items-end justify-center gap-6 mt-6 mb-12">
        <Torch scale={4} />
        <div className="text-center">
          <h2 className="fs-48 c-gold shadow-px">游戏厅</h2>
          <p className="fs-12 c-dim mt-3 tracking-[0.3em]">GAME ROOM · 和朋友一起玩</p>
        </div>
        <Torch scale={4} />
      </header>

      <div className="grid gap-6 md:grid-cols-2 max-w-[860px] mx-auto">
        {GAMES.map(g => (
          <button key={g.id} className="px-frame px-tile" disabled={!g.ready} onClick={() => g.ready && onSelectGame(g.id)}>
            <div className={`px-portrait-bg ${g.ready ? '' : 'opacity-60'}`}>
              {g.ready ? <Portrait role={g.art} scale={3} className="px-bob" /> : <PixelSprite name="dice" scale={12} />}
            </div>
            <div className="min-w-0">
              <div className="fs-12 c-dim tracking-[0.2em]">{g.en}</div>
              <div className="fs-24 mt-1">{g.title}</div>
              <div className="fs-12 c-dim mt-2">{g.desc}</div>
              {g.ready && <div className="fs-12 c-gold mt-3 px-blink">▶ 点击开始</div>}
            </div>
          </button>
        ))}
      </div>
    </PixelShell>
  );
}

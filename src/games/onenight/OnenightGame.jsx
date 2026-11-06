import './portraits';
import './onenight.css';
import { Portrait } from '../pixel/PixelSprite';
import RoomGame from '../room/RoomGame';
import { narrate } from './narrate';
import { MAX_PLAYERS, defaultConfig } from './onenightRules';
import Lobby from './Lobby';
import Board from './Board';
import { useBots } from './bots';

const SPEC = {
  id: 'onenight',
  title: '一夜狼',
  subtitle: 'ONE NIGHT · WEREWOLF',
  enterTitle: '进入村庄',
  placeholder: '守夜人',
  maxPlayers: MAX_PLAYERS,
  emblem: <Portrait role="on_emblem" scale={4} className="px-bob" />,
  art: ['wolf', 'on_thief', 'seer', 'on_owl'].map(r => <Portrait key={r} role={r} scale={2} />),
  howTo: [
    '起个名字，创建房间，把链接发给朋友（3–10 人）',
    '每人一张身份牌，多出的 3 张是公共牌',
    '只有一夜：手机上同时行动，夜贼、搅局者、醉汉会偷偷换牌',
    '天亮讨论几分钟，然后同时投票：投出一匹狼好人就赢',
  ],
  newRoom: () => ({ config: defaultConfig() }),
  Lobby, Board, useBots,
  narrate,
};

export default function OnenightGame({ onExit }) {
  return <RoomGame spec={SPEC} onExit={onExit} />;
}

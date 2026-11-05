import { Portrait } from '../pixel/PixelSprite';
import RoomGame from '../room/RoomGame';
import { MAX_PLAYERS, defaultConfig } from './wolfRules';
import Lobby from './Lobby';
import Board from './Board';
import { useBots } from './bots';

const SPEC = {
  id: 'werewolf',
  title: '双身份狼人',
  subtitle: 'WEREWOLF · TWO LIVES',
  enterTitle: '进入村庄',
  placeholder: '村长',
  maxPlayers: MAX_PLAYERS,
  emblem: <Portrait role="wolfmoon" scale={4} className="px-bob" />,
  art: ['seer', 'wolf', 'witch', 'hunter'].map(r => <Portrait key={r} role={r} scale={2} />),
  howTo: ['起个名字，创建房间，把链接发给朋友', '人齐 5–10 人，房主发牌，每人 2 张身份牌', '自己排好两张牌的顺序：两张牌就是两条命', '手机当法官：夜里按提示行动，白天讨论投票'],
  newRoom: () => ({ config: defaultConfig() }),
  Lobby, Board, useBots,
};

export default function WerewolfGame({ onExit }) {
  return <RoomGame spec={SPEC} onExit={onExit} />;
}

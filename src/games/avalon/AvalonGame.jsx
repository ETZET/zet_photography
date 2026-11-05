import { Portrait } from '../pixel/PixelSprite';
import RoomGame from '../room/RoomGame';
import { MAX_PLAYERS, defaultConfig } from './avalonRules';
import Lobby from './Lobby';
import Board from './Board';
import { useBots } from './bots';

const SPEC = {
  id: 'avalon',
  title: '阿瓦隆',
  subtitle: 'THE QUEST FOR AVALON',
  enterTitle: '进入城堡',
  placeholder: '亚瑟',
  maxPlayers: MAX_PLAYERS,
  emblem: <Portrait role="emblem" scale={4} className="px-bob" />,
  art: ['percival', 'merlin', 'morgana', 'assassin'].map(r => <Portrait key={r} role={r} scale={2} />),
  howTo: ['起个名字，创建房间', '把邀请链接发给朋友', '人齐 5–10 人，房主开局', '每人用自己的手机看身份、投票、出任务牌'],
  newRoom: () => ({ config: defaultConfig(5) }),
  Lobby, Board, useBots,
};

export default function AvalonGame({ onExit }) {
  return <RoomGame spec={SPEC} onExit={onExit} />;
}

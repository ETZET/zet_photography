import { Portrait } from '../pixel/PixelSprite';
import RoomGame from '../room/RoomGame';
import { PLAYERS, DEFAULT_RULES } from './guandanRules';
import Lobby from './Lobby';
import Board from './Board';
import { useBots } from './bots';

const SPEC = {
  id: 'guandan',
  title: '掼蛋',
  subtitle: 'GUANDAN · 两副牌 · 四人对家',
  enterTitle: '进入牌桌',
  placeholder: '牌友',
  maxPlayers: PLAYERS,
  emblem: <Portrait role="guandan" scale={4} className="px-bob" />,
  art: [<Portrait key="g" role="guandan" scale={2} />],
  howTo: [
    '起个名字创建房间，把链接发给另外 3 位牌友',
    '对家是队友（1·3 号 vs 2·4 号），可以在大厅换位',
    '每人 27 张，红心级牌是「逢人配」；同牌型比大小，炸弹管一切',
    '头游方升级（双上 +3），打过 A 的一队获胜',
  ],
  newRoom: () => ({ rules: { ...DEFAULT_RULES } }),
  Lobby, Board, useBots,
};

export default function GuandanGame({ onExit }) {
  return <RoomGame spec={SPEC} onExit={onExit} />;
}

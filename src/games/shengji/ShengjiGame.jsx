import { Portrait } from '../pixel/PixelSprite';
import RoomGame from '../room/RoomGame';
import { DEFAULT_RULES } from './shengjiRules';
import { MAX_PLAYERS, useBots } from './bots';
import { Card } from './cards';
import Lobby from './Lobby';
import Board from './Board';
import './art';

const fan = ['XB0', 'SA0', 'HK0', 'C50'];
const SPEC = {
  id: 'shengji',
  title: '升级 · 拖拉机',
  subtitle: 'SHENGJI · TRACTOR',
  enterTitle: '进入牌桌',
  placeholder: '牌友',
  maxPlayers: MAX_PLAYERS,
  emblem: <Portrait role="shengji" scale={4} className="px-bob" />,
  art: fan.map(id => <div key={id} className="relative" style={{ width: 44, height: 62 }}><Card id={id} style={{ left: 0, top: 0 }} /></div>),
  howTo: ['起个名字，创建房间，把链接发给另外 3 个朋友', '对面坐的是队友；房主选玩法（能不能甩牌、甩牌失败怎么罚、扣底翻倍…）', '把手机横过来；发牌时有级牌就亮主，庄家扣底', '闲家抓够 80 分上台；先打过 A 的一队赢'],
  newRoom: () => ({ config: { rules: { ...DEFAULT_RULES } } }),
  Lobby, Board, useBots,
};

export default function ShengjiGame({ onExit }) {
  return <RoomGame spec={SPEC} onExit={onExit} />;
}

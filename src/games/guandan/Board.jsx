// 掼蛋 table, designed for a phone held sideways (横屏): own hand along the
// bottom with the action buttons at its right, partner on top, opponents
// left / right, every player's latest play in front of them.
import { useEffect, useMemo, useState } from 'react';
import { Who, useConfirm, Confetti } from '../avalon/ui';
import { navigate } from '../../route';
import { keepHostFirst } from '../room/seats';
import { CardBack, CardRow, HandPicker } from '../cards/PlayingCard';
import {
  SUITS, rankOf, suitOf, isJoker, isWild, isRed, cardLv, rankName, levelName, comboLabel, isBomb, TYPE_ZH,
  seatOf, teamOf, isOut, PLACE_ZH, findPlays, playableAs, combosOf, tributeTask, tributeChoices, returnChoices,
  play, pass, payTribute, returnTribute, nextHand, showCount, cardName,
} from './guandanRules';
import { RuleCard } from './RuleCard';
import { TEAM_ZH } from './Lobby';
import './guandan.css';

export function faceOf(c, level) {
  const r = rankOf(c);
  return {
    id: c,
    rank: rankName(r),
    suit: isJoker(c) ? '' : SUITS[suitOf(c)],
    red: isRed(c),
    joker: isJoker(c) ? (r === 17 ? 'big' : 'small') : null,
    tag: isWild(c, level) ? 'wild' : r === level ? 'level' : null,
  };
}
const facesOf = (cards, level) => cards.map(c => faceOf(c, level));

/** One column per rank in level order (big → small); ♥ level cards sit on top of the level column. */
export function columnsOf(hand, level) {
  const cols = new Map();
  [...hand].sort((a, b) => cardLv(b, level) - cardLv(a, level) || (isWild(b, level) ? 1 : 0) - (isWild(a, level) ? 1 : 0) || suitOf(a) - suitOf(b) || a - b)
    .forEach(c => { const k = cardLv(c, level); if (!cols.has(k)) cols.set(k, []); cols.get(k).push(faceOf(c, level)); });
  return [...cols.values()];
}

function useLandscape() {
  const q = '(orientation: portrait)';
  const [portrait, setPortrait] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return undefined;
    const on = () => setPortrait(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return !portrait;
}

function useNow(active, ms = 250) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

const INTRO_MS = 1600;

export default function Board({ room, myId, update, busy }) {
  const g = room.game;
  const landscape = useLandscape();
  const me = seatOf(g, myId);
  const [sel, setSel] = useState(() => new Set());
  const [hint, setHint] = useState(-1);
  const [choice, setChoice] = useState(null);
  const [panel, setPanel] = useState(null); // 'log' | 'menu'
  const [msg, setMsg] = useState('');
  const now = useNow(Date.now() - (g.dealtAt || 0) < INTRO_MS + 500);
  const intro = now - (g.dealtAt || 0) < INTRO_MS;
  const hand = useMemo(() => (me >= 0 ? g.hands[me] : []), [g.hands, me]);
  const columns = useMemo(() => columnsOf(hand, g.level), [hand, g.level]);

  // drop selected cards that left the hand; reset hints when the table changes
  useEffect(() => { setSel(s => new Set([...s].filter(c => hand.includes(c)))); }, [hand]);
  useEffect(() => { setHint(-1); setChoice(null); setMsg(''); }, [g.table, g.turn, g.step, g.handNo]);
  useEffect(() => { setChoice(null); }, [sel]);

  if (!landscape) return <RotatePrompt />;
  if (me < 0) return <div className="px-frame pad text-center c-dim">你不在这桌</div>;

  const act = fn => update(r => { fn(r.game); return r; });
  const cards = [...sel];
  const top = g.table?.combo || null;
  const myTurn = g.step === 'play' && g.turn === me;
  const task = tributeTask(g, me);
  const readings = g.step === 'play' && cards.length ? playableAs(g, cards) : [];
  const anyReading = cards.length ? combosOf(cards, g.level) : [];
  const reading = readings.find(c => c.type === choice) || readings[0];
  const allowed = task === 'pay' ? new Set(tributeChoices(g, me)) : task === 'back' ? new Set(returnChoices(g, me)) : null;

  const doPlay = () => {
    if (!reading) return;
    const type = reading.type;
    setSel(new Set());
    act(x => play(x, me, cards, type));
  };
  const doPass = () => { setSel(new Set()); act(x => pass(x, me)); };
  const doHint = () => {
    const plays = findPlays(hand, g.level, top);
    if (!plays.length) { setSel(new Set()); setMsg(top ? '没有能管上的牌' : ''); return; }
    const i = (hint + 1) % plays.length;
    setHint(i);
    setSel(new Set(plays[i].cards));
    setMsg('');
  };
  const doTribute = () => {
    if (cards.length !== 1) return;
    setSel(new Set());
    act(x => (task === 'pay' ? payTribute(x, me, cards[0]) : returnTribute(x, me, cards[0])));
  };

  // feedback line for my selection
  let feedback = null;
  if (task) {
    const to = task === 'pay' ? null : g.tribute.gives.find(x => x.to === me)?.from;
    feedback = cards.length === 1
      ? <span className="c-good">{task === 'pay' ? '进贡' : '还给'} {to != null && <Who id={g.seats[to]} />}{cardName(cards[0])} ✓</span>
      : <span className="c-gold">{task === 'pay' ? '进贡：选一张你最大的牌（红心级牌除外）' : <>还贡：选一张{g.rules.back === 'any' ? '' : ' 10 以下的'}牌还给 <Who id={g.seats[to]} /></>}</span>;
  } else if (g.step === 'play' && cards.length) {
    if (!anyReading.length) feedback = <span className="c-evil" data-testid="feedback-bad">✗ 不是有效牌型</span>;
    else if (!readings.length) feedback = <span className="c-evil" data-testid="feedback-bad">✗ 管不上「{comboLabel(top, g.level)}」{!isBomb(top) && anyReading.every(c => c.type !== top.type) ? '（牌型不同）' : ''}</span>;
    else feedback = <span className={myTurn ? 'c-good' : 'c-dim'} data-testid="feedback-ok">✓ {comboLabel(reading, g.level)}{myTurn ? '' : '（还没轮到你）'}</span>;
  } else if (msg) feedback = <span className="c-evil">{msg}</span>;

  const pos = { bottom: me, right: (me + 1) % 4, top: (me + 2) % 4, left: (me + 3) % 4 };
  const myTeam = teamOf(me);

  return (
    <div className="gd-layer" data-testid="gd-board">
      <div className="gd-top">
        <div className="flex items-center gap-1 min-w-0">
          <button className="gd-icon" onClick={() => setPanel('menu')} aria-label="菜单" data-testid="menu">☰</button>
          <Levels g={g} myTeam={myTeam} />
        </div>
        <Seat g={g} s={pos.top} room={room} where="top" />
        <div className="flex items-center gap-1 justify-end">
          <span className="fs-12 c-dim hidden sm:inline">第 {g.handNo} 局</span>
          <button className="gd-icon wide" onClick={() => setPanel('log')} data-testid="open-log">记录</button>
        </div>
      </div>

      <div className="gd-mid">
        <div className="gd-side"><Seat g={g} s={pos.left} room={room} where="left" /><PlaySpot g={g} s={pos.left} /></div>
        <div className="gd-center">
          <PlaySpot g={g} s={pos.top} />
          <Status g={g} me={me} />
          <PlaySpot g={g} s={pos.bottom} />
        </div>
        <div className="gd-side"><Seat g={g} s={pos.right} room={room} where="right" /><PlaySpot g={g} s={pos.right} /></div>
      </div>

      <div className="gd-feedback" data-testid="feedback">
        <span className={`gd-me ${myTurn || task ? 'on' : ''}`}>{isOut(g, me) ? PLACE_ZH[g.finished.indexOf(me)] : myTurn ? '轮到你' : task ? '该你了' : `${hand.length} 张`}</span>
        <span className="truncate">{feedback}</span>
        {readings.length > 1 && (
          <span className="flex gap-1 shrink-0" data-testid="reading-choice">
            {readings.map(c => (
              <button key={c.type + c.n} className={`gd-chip ${reading === c ? 'on' : ''}`} onClick={() => setChoice(c.type)}>{TYPE_ZH[c.type]}</button>
            ))}
          </span>
        )}
      </div>

      <div className="gd-bottom">
        <div className="gd-hand">
          {hand.length
            ? <HandPicker columns={columns} selected={sel} onChange={s => { setSel(s); setHint(-1); setMsg(''); }} selectable={allowed ? id => allowed.has(id) : null} />
            : <div className="h-full flex items-center justify-center c-gold fs-18">{isOut(g, me) ? `你是${PLACE_ZH[g.finished.indexOf(me)]}，等队友…` : ''}</div>}
        </div>
        <div className="gd-actions">
          {task ? (
            <button className="px-btn gold gd-act big" disabled={busy || cards.length !== 1} onClick={doTribute} data-testid="tribute-btn">{task === 'pay' ? '进贡' : '还贡'}</button>
          ) : (
            <>
              <button className="px-btn gold gd-act big" disabled={busy || !myTurn || !reading} onClick={doPlay} data-testid="play">出牌</button>
              <button className="px-btn blue gd-act" disabled={g.step !== 'play' || isOut(g, me)} onClick={doHint} data-testid="hint">提示</button>
              <button className="px-btn dark gd-act" disabled={busy || !myTurn || !g.table} onClick={doPass} data-testid="pass">不出</button>
              <button className="px-btn dark gd-act sm" disabled={!sel.size} onClick={() => { setSel(new Set()); setHint(-1); }} data-testid="clear">重选</button>
            </>
          )}
        </div>
      </div>

      {intro && <DealIntro g={g} myTeam={myTeam} />}
      {g.step === 'hand' && <HandResult g={g} myTeam={myTeam} busy={busy} onNext={() => act(x => nextHand(x))} />}
      {g.step === 'end' && <GameOver g={g} room={room} myId={myId} myTeam={myTeam} update={update} />}
      {panel === 'log' && <LogPanel g={g} onClose={() => setPanel(null)} />}
      {panel === 'menu' && <MenuPanel g={g} room={room} myId={myId} update={update} onClose={() => setPanel(null)} />}
    </div>
  );
}

// ------------------------------------------------------------- pieces ---

function Levels({ g, myTeam }) {
  const lv = t => `${levelName(g.levels[t])}${g.levels[t] === 14 && g.aFails[t] ? `·${g.aFails[t]}败` : ''}`;
  return (
    <div className="gd-levels" data-testid="levels">
      <span className="gd-now">打<b>{levelName(g.level)}</b></span>
      <span className={`gd-lv gd-team${myTeam}`}>我方 {lv(myTeam)}{g.declarer === myTeam ? ' 庄' : ''}</span>
      <span className={`gd-lv gd-team${1 - myTeam}`}>对方 {lv(1 - myTeam)}{g.declarer === 1 - myTeam ? ' 庄' : ''}</span>
    </div>
  );
}

function Seat({ g, s, room, where }) {
  const id = g.seats[s];
  const n = g.hands[s].length;
  const out = isOut(g, s);
  const turn = (g.step === 'play' && g.turn === s) || !!tributeTask(g, s);
  const isBot = room.players.find(p => p.id === id)?.isBot;
  const count = showCount(g, n) ? n : '多';
  return (
    <div className={`gd-seat ${where} ${turn ? 'turn' : ''} ${out ? 'out' : ''}`} data-testid={`seat-${s + 1}`}>
      <Who id={id} />
      <div className="flex items-center gap-1">
        {out
          ? <span className="px-tag gold" data-testid="place">{PLACE_ZH[g.finished.indexOf(s)]}</span>
          : <CardBack w={where === 'top' ? 16 : 22} count={count} warn={n <= 10} />}
        {g.jiefeng === s && <span className="px-tag good">接风</span>}
        {isBot && <span className="fs-12 c-mute">机器人</span>}
      </div>
      {turn && <span className="gd-turn px-blink">{g.step === 'tribute' ? '贡牌中' : '出牌中'}</span>}
    </div>
  );
}

/** Seat s's latest action in this trick, in front of them. */
function PlaySpot({ g, s }) {
  const last = [...g.trick].reverse().find(a => a.s === s);
  if (!last) return <div className="gd-spot" data-testid={`spot-${s + 1}`} />;
  if (last.pass) return <div className="gd-spot" data-testid={`spot-${s + 1}`}><span className="gd-pass">不出</span></div>;
  const lead = g.table?.s === s;
  return (
    <div className={`gd-spot ${lead ? 'lead' : ''} px-pop`} data-testid={`spot-${s + 1}`}>
      <CardRow faces={facesOf(last.cards, g.level)} w={26} maxWidth={170} />
      <span className={`gd-label ${isBomb(last.combo) ? 'bomb' : ''}`}>{comboLabel(last.combo, g.level)}</span>
    </div>
  );
}

function Status({ g, me }) {
  let body = null;
  if (g.step === 'tribute') {
    const t = g.tribute;
    body = t.phase === 'pay'
      ? <>进贡中：{t.payers.map(p => <Who key={p} id={g.seats[p]} />)}{t.payers.length > 1 ? '都要' : '要'}进贡</>
      : <>还贡中：{t.gives.map(x => <span key={x.from}><Who id={g.seats[x.from]} />→<Who id={g.seats[x.to]} /> {cardName(x.card)} </span>)}</>;
  } else if (g.step === 'play') {
    const tribute = g.log.find(a => a.sys === 'tribute' || a.sys === 'resist' || a.sys === 'first' || a.sys === 'notribute');
    const fresh = !g.log.some(a => a.cards);
    if (g.jiefeng != null) body = <span className="c-gold"><Who id={g.seats[g.jiefeng]} /> 接风，随便出</span>;
    else if (fresh && tribute?.sys === 'tribute') body = <span>{tribute.gives.map(x => <span key={x.from} className="block"><Who id={g.seats[x.from]} />贡 {cardName(x.card)}，还 {cardName(x.back)}</span>)}</span>;
    else if (fresh && tribute?.sys === 'resist') body = <span className="c-gold">抗贡！<Who id={g.seats[tribute.s]} />{tribute.s2 != null && <Who id={g.seats[tribute.s2]} />}有两张大王，不用进贡</span>;
    else if (fresh && tribute?.sys === 'first') body = <span>抽到 <Who id={g.seats[g.turn]} /> 先出</span>;
    else if (!g.table) body = <span><Who id={g.seats[g.turn]} /> {g.turn === me ? '（你）' : ''}领出</span>;
    else body = <span className="c-dim">轮到 <Who id={g.seats[g.turn]} /></span>;
  }
  return <div className="gd-status" data-testid="status">{body}</div>;
}

export function RotatePrompt() {
  return (
    <div className="gd-rotate" data-testid="rotate">
      <div className="gd-phone"><span /></div>
      <div className="fs-24 c-gold shadow-px mt-6">请把手机横过来</div>
      <div className="fs-12 c-dim mt-2">掼蛋 27 张牌，横屏才放得下</div>
      <div className="fs-12 c-mute mt-1">（记得关掉手机的竖屏锁定）</div>
    </div>
  );
}

function DealIntro({ g, myTeam }) {
  const mine = g.declarer == null ? null : g.declarer === myTeam;
  return (
    <div className="gd-intro" data-testid="deal-intro">
      <div className="gd-deal">{[0, 1, 2, 3, 4, 5].map(i => <span key={i} style={{ animationDelay: `${i * 0.12}s` }}><CardBack w={30} /></span>)}</div>
      <div className="fs-24 c-gold shadow-px mt-3">第 {g.handNo} 局 · 打 {levelName(g.level)}</div>
      <div className="fs-12 c-dim mt-1">{mine == null ? '发牌中…' : mine ? '我方的级，我方坐庄' : '对方的级，对方坐庄'}</div>
    </div>
  );
}

function HandResult({ g, myTeam, busy, onNext }) {
  const r = g.result;
  const won = r.winTeam === myTeam;
  const kind = r.place === 2 ? '双上' : r.place === 3 ? '头游 + 三游' : '头游 + 末游';
  return (
    <div className="px-overlay gd-over" data-testid="hand-result">
      <div className={`px-frame pad px-pop gd-result ${won ? 'gold' : ''}`}>
        <div className="flex flex-wrap gap-4 items-start">
          <div className="flex-1 min-w-[180px]">
            <div className={`fs-24 ${won ? 'c-gold' : 'c-evil'}`}>{won ? '我方赢了这局！' : '对方赢了这局'}</div>
            <div className="fs-12 c-dim mb-2">{TEAM_ZH[r.winTeam]} {kind}{r.up ? `，升 ${r.up} 级` : ''}</div>
            <ol className="flex flex-col gap-1">
              {r.order.map((s, i) => (
                <li key={s} className="fs-12 flex items-center gap-2" data-testid="finish-row">
                  <span className={`px-tag ${i === 0 ? 'gold' : ''}`}>{r.place === 2 && i >= 2 ? '下游' : PLACE_ZH[i]}</span>
                  <Who id={g.seats[s]} /><span className={`gd-team${teamOf(s)}-text`}>{teamOf(s) === myTeam ? '我方' : '对方'}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex-1 min-w-[160px]">
            {[myTeam, 1 - myTeam].map(t => (
              <div key={t} className="flex items-center gap-2 mb-1" data-testid="level-change">
                <span className={`gd-lv gd-team${t}`}>{t === myTeam ? '我方' : '对方'}</span>
                <span className="fs-18">{levelName(r.before[t])}</span>
                <span className="c-dim">→</span>
                <span className={`fs-24 ${r.after[t] !== r.before[t] ? 'c-gold' : ''}`}>{levelName(r.after[t])}</span>
              </div>
            ))}
            {r.notes.map((n, i) => (
              <div key={i} className="fs-12 c-evil">{n.team === myTeam ? '我方' : '对方'}{n.kind === 'drop' ? '打 A 失败次数用完，回到 2！' : `打 A 没过（第 ${n.n} 次）`}</div>
            ))}
            <div className="fs-12 c-dim mt-2">下一局打 <span className="c-gold">{levelName(r.after[r.winTeam])}</span>{g.rules.tribute === 'yes' ? (r.place === 2 ? '，双下两人进贡' : '，末游进贡') : ''}</div>
            <button className="px-btn gold block mt-3" disabled={busy} onClick={onNext} data-testid="next-hand">下一局</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameOver({ g, room, myId, myTeam, update }) {
  const won = g.winner === myTeam;
  const isHost = room.hostId === myId;
  const names = [0, 1, 2, 3].filter(s => teamOf(s) === g.winner);
  return (
    <div className="px-overlay gd-over" data-testid="game-over">
      <Confetti colors={won ? ['#f5c542', '#fff6dc', '#d63c34', '#4f7df0'] : ['#6d6194', '#3b2f6c', '#a99ccc']} />
      <div className={`px-frame pad px-pop text-center ${won ? 'gold' : ''}`} style={{ maxWidth: 460 }}>
        <div className={`fs-36 ${won ? 'c-gold' : 'c-evil'} shadow-px`}>{won ? '过 A！我方获胜' : '对方过 A 获胜'}</div>
        <div className="mt-2">{names.map(s => <Who key={s} id={g.seats[s]} size="lg" />)}</div>
        <div className="fs-12 c-dim mt-2">共打了 {g.handNo} 局 · {g.history.map(h => levelName(h.level)).join(' → ')}</div>
        {isHost
          ? <button className="px-btn gold block mt-4" onClick={() => update(r => { r.phase = 'lobby'; r.game = null; return r; })} data-testid="back-lobby">回到大厅</button>
          : <div className="fs-12 c-dim mt-4">等房主回到大厅…</div>}
      </div>
    </div>
  );
}

function LogPanel({ g, onClose }) {
  const items = [...g.log].reverse();
  return (
    <div className="px-overlay gd-over" onClick={onClose} data-testid="log">
      <div className="px-frame pad gd-panel" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="px-title !mb-0 flex-1">第 {g.handNo} 局记录</div>
          <button className="px-btn dark sm" onClick={onClose} data-testid="close-log">关闭</button>
        </div>
        <div className="gd-scroll">
          {items.map((a, i) => (
            <div key={i} className="fs-12 flex items-center gap-2 py-1 border-b border-[#2b2150]">
              <Who id={g.seats[a.s]} />
              {a.cards ? <><CardRow faces={facesOf(a.cards, g.level)} w={20} maxWidth={150} /><span className={isBomb(a.combo) ? 'c-evil' : 'c-dim'}>{comboLabel(a.combo, g.level)}</span></>
                : a.pass ? <span className="c-mute">不出</span>
                  : a.sys === 'out' ? <span className="c-gold">出完了：{PLACE_ZH[a.place - 1]}</span>
                    : a.sys === 'jiefeng' ? <span className="c-gold">接风</span>
                      : a.sys === 'resist' ? <span className="c-gold">抗贡</span>
                        : a.sys === 'tribute' ? <span>进贡：{a.gives.map(x => `${cardName(x.card)}↔${cardName(x.back)}`).join('，')}</span>
                          : <span className="c-dim">先出</span>}
            </div>
          ))}
          {g.history.length > 0 && <div className="fs-12 c-dim mt-3">之前：{g.history.map(h => `第${h.hand}局 打${levelName(h.level)} ${TEAM_ZH[h.winTeam]}胜`).join(' · ')}</div>}
        </div>
      </div>
    </div>
  );
}

function MenuPanel({ g, room, myId, update, onClose }) {
  const confirm = useConfirm();
  const leave = async () => {
    const ok = await confirm({ title: '离开房间？', body: '牌局进行中，你离开后这局作废，所有人回到大厅。', ok: '离开并结束这局', tone: 'danger' });
    if (!ok) return;
    await update(r => {
      r.players = r.players.filter(p => p.id !== myId);
      const humans = r.players.filter(p => !p.isBot);
      if (!humans.length) return null;
      if (r.hostId === myId) r.hostId = humans[0].id;
      keepHostFirst(r);
      r.phase = 'lobby';
      r.game = null;
      return r;
    });
    navigate({ page: 'game', game: 'guandan', room: null });
  };
  return (
    <div className="px-overlay gd-over" onClick={onClose} data-testid="menu-panel">
      <div className="px-frame pad gd-panel" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <div className="px-title !mb-0 flex-1">房间 {room.code}</div>
          <button className="px-btn dark sm" onClick={() => navigate({ page: 'game' })}>◀ 游戏厅</button>
          <button className="px-btn red sm" onClick={leave} data-testid="leave-game">离开房间</button>
          <button className="px-btn dark sm" onClick={onClose} data-testid="close-menu">关闭</button>
        </div>
        <div className="gd-scroll"><RuleCard rules={g.rules} /></div>
      </div>
    </div>
  );
}

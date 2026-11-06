// 升级 in-game screen. Landscape-first: a full-screen layer with a slim top bar,
// partner on top, opponents left/right, own played cards + buttons along the
// bottom of the felt, and the hand in one or two rows underneath.
import { useEffect, useMemo, useState } from 'react';
import PixelSprite from '../pixel/PixelSprite';
import { Who, useConfirm, Confetti } from '../avalon/ui';
import { navigate } from '../../route';
import { keepHostFirst } from '../room/seats';
import { CardRow, CardText, Hand, Suit } from './cards';
import { PHONE } from './art';
import {
  SUIT_SYM, SUIT_ZH, VARIANTS, KIND_ZH, BID_ZH, KITTY_SIZE, HAND_SIZE,
  ctxOf, sortHand, teamOf, isDefender, turnOf, playError, formatOf, leadKind, componentCount, hint, suitOf,
  dealtCount, dealEnd, bidDeadline, visibleHand, bidOptions, declare, pass, finishDeal, bury, play, nextHand, rankZh,
  sumPoints, winnerIndex, newGame,
} from './shengjiRules';

const TEAM_ZH = ['甲队', '乙队'];
const TEAM_CLS = ['sj-team0', 'sj-team1'];

function useNow(active, ms = 250) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

function useViewport() {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(get);
  useEffect(() => {
    const on = () => setV(get());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return v;
}

/** Keep phones awake during a game. */
function useWakeLock(on) {
  useEffect(() => {
    if (!on || !navigator.wakeLock) return undefined;
    let lock = null;
    let dead = false;
    const get = () => navigator.wakeLock.request('screen').then(l => { if (dead) l.release(); else lock = l; }).catch(() => {});
    get();
    const vis = () => { if (document.visibilityState === 'visible') get(); };
    document.addEventListener('visibilitychange', vis);
    return () => { dead = true; document.removeEventListener('visibilitychange', vis); lock?.release().catch(() => {}); };
  }, [on]);
}

const SuitTag = ({ trump }) => (trump
  ? <span className="sj-chip gold" data-testid="trump"><span className="sj-suitbox"><Suit s={trump} scale={1.5} /></span>主</span>
  : <span className="sj-chip gold" data-testid="trump">无主</span>);

export default function Board({ room, myId, update, busy }) {
  const confirm = useConfirm();
  const g = room.game;
  const isHost = room.hostId === myId;
  const me = g.seats.indexOf(myId);
  const ctx = ctxOf(g);
  const vp = useViewport();
  const portrait = vp.h > vp.w && vp.w < 700;
  const [allowPortrait, setAllowPortrait] = useState(false);
  const [sel, setSel] = useState([]);
  const [panel, setPanel] = useState(null); // 'last' | 'menu' | 'rules'
  const act = fn => update(r => { fn(r.game, r); return r; });
  const dealing = g.step === 'deal';
  // a finished trick stays on the felt for a moment (bots wait 1.6 s × timeScale before leading)
  const recent = g.lastTrick && Date.now() - g.lastTrick.at < 1800;
  const now = useNow(dealing || recent, dealing ? 200 : 300);
  useWakeLock(g.step !== 'end');

  const turn = turnOf(g);
  const myTurn = turn === me;
  const leadCards = g.trick?.plays[0]?.cards;
  const selKey = `${g.hand}:${g.step}:${g.trickNo}:${g.trick?.plays.length}`;
  useEffect(() => { setSel([]); }, [selKey]);
  // following: if the suit is short, pre-select what you are forced to play
  useEffect(() => {
    if (!myTurn || !leadCards) return;
    const X = suitOf(leadCards[0], ctx);
    const mine = g.hands[me].filter(c => suitOf(c, ctx) === X);
    if (mine.length && mine.length <= leadCards.length) setSel(mine);
  }, [selKey, myTurn]); // eslint-disable-line react-hooks/exhaustive-deps

  // host closes the bidding when time is up
  useEffect(() => {
    if (!isHost || !dealing) return undefined;
    const t = setTimeout(() => act(x => finishDeal(x)), Math.max(0, bidDeadline(g) - Date.now()) + 60);
    return () => clearTimeout(t);
  }, [isHost, dealing, g.dealStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = async () => {
    setPanel(null);
    const ok = await confirm({ title: '离开房间？', body: '游戏进行中，你离开后这一局会作废，所有人回到大厅。', ok: '离开并结束这局', tone: 'danger' });
    if (!ok) return;
    await update(r => {
      r.players = r.players.filter(p => p.id !== myId);
      const humans = r.players.filter(p => !p.isBot);
      if (humans.length === 0) return null;
      if (r.hostId === myId) r.hostId = humans[0].id;
      keepHostFirst(r);
      r.phase = 'lobby'; r.game = null;
      return r;
    });
    navigate({ page: 'game', game: 'shengji' });
  };
  const toLobby = async () => {
    setPanel(null);
    if (g.step !== 'end' && !await confirm({ title: '回到大厅？', body: '这一局会作废，所有人回到大厅重新选规则。', ok: '回大厅', tone: 'danger' })) return;
    update(r => { r.phase = 'lobby'; r.game = null; return r; });
  };

  // ------------------------------------------------------------ my hand
  const dealt = dealtCount(g, now);
  // while bidding, sort as if the standing bid were trump (level cards + jokers first)
  const viewCtx = dealing ? { ...ctx, trump: g.bid?.suit ?? null } : ctx;
  const handIds = useMemo(() => sortHand(dealing ? visibleHand(g, me, now) : g.hands[me], viewCtx),
    [g, me, dealing ? dealt : 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = id => setSel(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));
  const canTap = (g.step === 'bury' && g.dealer === me) || (g.step === 'play');

  // ------------------------------------------------------------ status + actions
  let status = null;
  let actions = null;
  const btn = (label, onClick, { tone = 'gold', disabled = false, id, grow } = {}) => (
    <button key={id} className={`px-btn ${tone} ${grow ? 'grow2' : ''}`} disabled={disabled || busy} onClick={onClick} data-testid={id}>{label}</button>
  );
  if (dealing) {
    const done = now >= dealEnd(g);
    const passed = g.passes.includes(me);
    status = done
      ? <span className="c-dim">{passed ? '已过，等其他人…' : `没人再亮就开始（${Math.max(0, Math.ceil((bidDeadline(g) - now) / 1000))} 秒）`}</span>
      : <span className="c-dim">发牌中 {dealt}/{HAND_SIZE}，有级牌 {rankZh(g.level)} 就能亮主</span>;
    actions = btn(passed ? '已过' : '不亮', () => act(x => pass(x, me, Date.now())), { tone: 'dark', disabled: !done || passed, id: 'pass' });
  } else if (g.step === 'bury') {
    if (g.dealer === me) {
      const pts = sumPoints(sel);
      status = <span>选 <b className={sel.length === KITTY_SIZE ? 'c-gold' : ''}>{sel.length}/{KITTY_SIZE}</b> 张扣底{pts ? <span className="c-evil">（含 {pts} 分）</span> : ''}</span>;
      actions = btn(`扣底 ${sel.length}/${KITTY_SIZE}`, () => act(x => bury(x, me, sel)), { disabled: sel.length !== KITTY_SIZE, id: 'bury', grow: true });
    } else {
      status = <span className="c-dim">等 <Who id={g.seats[g.dealer]} /> 扣底…</span>;
      actions = btn('扣底中…', null, { tone: 'dark', disabled: true, id: 'bury-wait' });
    }
  } else if (g.step === 'play') {
    const err = myTurn && sel.length ? playError(g, me, sel) : null;
    const X = leadCards && suitOf(leadCards[0], ctx);
    const mineX = leadCards ? g.hands[me].filter(c => suitOf(c, ctx) === X) : [];
    const shortSuit = myTurn && leadCards && mineX.length && mineX.length < leadCards.length ? mineX : null;
    const suitName = c => (suitOf(c, ctx) === 'T' ? '主牌' : SUIT_ZH[c[0]]);
    if (!myTurn) status = <span className="c-dim">等 <Who id={g.seats[turn]} /> 出牌</span>;
    else if (!sel.length) status = <span className="c-gold">{leadCards ? `轮到你跟 ${leadCards.length} 张` : '轮到你出牌'}</span>;
    else if (err && shortSuit && sel.length < leadCards.length && shortSuit.every(c => sel.includes(c))) {
      status = <span className="c-gold" data-testid="play-short">{suitName(leadCards[0])}只有 {shortSuit.length} 张，已选上；再任选 {leadCards.length - sel.length} 张</span>;
    } else if (err) status = <span className="c-evil" data-testid="play-error">{err}</span>;
    else if (!leadCards) {
      const f = formatOf(sel, ctx);
      const k = leadKind(f);
      status = <span className="c-good" data-testid="play-ok">{k === 'throw' ? `甩牌 ${componentCount(f)} 手：有人管得上就失败${g.rules.penalty === 'none' ? '' : '并罚分'}` : `出${KIND_ZH[k]}${k === 'tractor' ? `（${f.tractors[0]} 对）` : ''}`}</span>;
    } else status = <span className="c-good" data-testid="play-ok">可以出</span>;
    actions = [
      btn('提示', () => setSel(hint(g, me)), { tone: 'dark', disabled: !myTurn, id: 'hint' }),
      btn('出牌', () => act(x => play(x, me, sel, Date.now())), { disabled: !myTurn || !sel.length || !!err, id: 'play', grow: true }),
    ];
  }

  // ------------------------------------------------------------ table
  const showLast = g.step !== 'deal' && g.trick && !g.trick.plays.length && recent;
  const shown = showLast ? g.lastTrick : g.trick;
  const shownNo = showLast ? g.lastTrick.no : g.trickNo;
  const winIdx = shown?.plays.length ? winnerIndex(shown.plays, ctx) : -1;
  const playOf = seat => shown?.plays.find(p => p.seat === seat);
  const fail = g.throwFail && g.throwFail.trick === shownNo && g.step === 'play' ? g.throwFail : null;
  const leadEntry = shown?.plays[0];
  const throwOk = leadEntry?.throw && !leadEntry.tried;

  const spot = seat => {
    const rel = (seat - me + 4) % 4;
    const p = playOf(seat);
    const bid = dealing && g.bid?.seat === seat ? g.bid : null;
    const isWin = p && shown.plays.indexOf(p) === winIdx;
    const left = dealing ? dealtCount(g, now) : g.hands[seat].length;
    const maxW = rel === 0 || rel === 2 ? 260 : 150;
    return (
      <div key={seat} className={`sj-spot p${rel} ${turn === seat && g.step === 'play' ? 'turn' : ''}`} data-testid={`spot-${rel}`}>
        {rel !== 0 && (
          <div className="tags">
            <Who id={g.seats[seat]} />
            {g.dealer === seat && !dealing && <span className="px-tag gold">庄</span>}
            <span className="px-tag" title="手牌数">{left}</span>
          </div>
        )}
        <div className={`sj-slot ${isWin ? 'win' : ''}`}>
          {p && <CardRow ids={p.cards} ctx={ctx} maxW={maxW} />}
          {bid && <CardRow ids={bid.cards} ctx={ctx} maxW={maxW} />}
          {isWin && shown.plays.length > 1 && <span className="sj-big" title="目前最大">大</span>}
        </div>
      </div>
    );
  };

  const centerInfo = (() => {
    if (dealing) {
      const opts = bidOptions(g, me, visibleHand(g, me, now));
      return (
        <div className="sj-centerbox" data-testid="deal-center">
          <div className="sj-dealbar" aria-hidden><i style={{ width: `${(dealt / HAND_SIZE) * 100}%` }} /></div>
          <div className="fs-12">{g.bid
            ? <><Who id={g.seats[g.bid.seat]} /> {g.bid.suit ? <>亮 <Suit s={g.bid.suit} scale={1.5} color="#f5c542" /> {g.bid.strength >= 2 ? '一对' : ''}</> : `${BID_ZH[g.bid.strength]}：无主`}</>
            : <span className="c-dim">还没人亮主 · 打 {rankZh(g.level)}</span>}</div>
          {opts.length > 0 && (
            <div className="sj-bids" data-testid="bids">
              {opts.map(o => (
                <button key={`${o.suit}${o.strength}`} className="px-btn blue sm" disabled={busy} onClick={() => act(x => declare(x, me, o, Date.now()))}
                  data-testid={`bid-${o.suit || 'NT'}-${o.strength}`}>
                  {o.suit ? <><Suit s={o.suit} scale={1.5} color="#fff" />{o.strength >= 2 && <Suit s={o.suit} scale={1.5} color="#fff" />}{g.bid ? (g.bid.seat === me && g.bid.suit === o.suit ? '加固' : '反主') : '亮主'}</> : `${o.strength === 4 ? '大' : '小'}王对·无主`}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }
    if (g.step === 'bury') {
      return (
        <div className="sj-centerbox fs-12" data-testid="bury-center">
          <div><SuitTag trump={g.trump} /> 打 {rankZh(g.level)}</div>
          {g.kittyFlip && <div className="c-dim mt-1">没人亮主，翻底定主：<CardRow ids={g.kittyFlip.cards} ctx={ctx} size="xs" maxW={150} hi={g.kittyFlip.by ? [g.kittyFlip.by] : []} /></div>}
          <div className="c-gold mt-1">{g.dealer === me ? '你是庄家：底牌 8 张已加进手牌，选 8 张扣回去' : <><Who id={g.seats[g.dealer]} /> 当庄，正在扣底</>}</div>
        </div>
      );
    }
    if (fail) {
      return (
        <div className="sj-banner" data-testid="throw-fail">
          <Who id={g.seats[fail.seat]} /> <b className="c-evil">甩牌失败</b>：{fail.by.map(s => <Who key={s} id={g.seats[s]} />)}管得上
          <div className="flex justify-center my-1"><CardRow ids={fail.tried} ctx={ctx} size="xs" maxW={200} hi={fail.forced} /></div>
          只出 {fail.forced.map(c => <CardText key={c} id={c} />)}{fail.penalty ? <>，罚 <b className="c-gold">{fail.penalty}</b> 分</> : '，不罚分'}
        </div>
      );
    }
    const pts = shown ? sumPoints(shown.plays.flatMap(p => p.cards)) : 0;
    return (
      <div className="sj-centerbox fs-12" data-testid="trick-center">
        <div className="c-dim">第 {shownNo} 轮{leadEntry ? ` · ${KIND_ZH[leadKind(formatOf(leadEntry.cards, ctx))]}` : ''}</div>
        {throwOk && <div className="px-tag good" data-testid="throw-ok">甩牌成功</div>}
        {pts > 0 && <div className="c-gold">本轮 {pts} 分</div>}
        {showLast && <div><Who id={g.seats[g.lastTrick.winner]} /> 拿下{isDefender(g, g.lastTrick.winner) && g.lastTrick.points ? <span className="c-evil"> +{g.lastTrick.points}</span> : ''}</div>}
      </div>
    );
  })();

  const order = [2, 3, 1, 0].map(rel => (me + rel) % 4); // top, left, right, me
  const defTeam = g.dealer == null ? null : 1 - teamOf(g.dealer);

  if (portrait && !allowPortrait) {
    return (
      <div className="sj-fs sj-rotate" data-testid="rotate">
        <div className="sj-phone" aria-hidden><PixelSprite pixels={PHONE} scale={6} /></div>
        <div className="fs-24 c-gold mt-6">请把手机横过来</div>
        <div className="fs-12 c-dim mt-2 text-center px-6">升级要横屏玩：25 张手牌排成一行，四家出的牌都看得见。<br />（记得关掉手机的「竖排方向锁定」）</div>
        <button className="underline fs-12 c-mute mt-6" onClick={() => setAllowPortrait(true)} data-testid="stay-portrait">仍然竖着玩</button>
      </div>
    );
  }

  // card size follows the visible height: SE landscape ≈ 320, Pro Max ≈ 380, tablets / desktop more
  const [cw, ch] = vp.h < 335 ? [44, 62] : vp.h < 430 ? [50, 70] : [58, 82];
  return (
    <div className="sj-fs" data-testid="sj-board" data-step={g.step}>
      <div className="sj-bar" data-testid="topbar">
        <button className="sj-chip" onClick={() => setPanel('menu')} data-testid="menu" aria-label="菜单">☰</button>
        <span className="sj-chip">第 {g.hand} 局</span>
        {!dealing ? <SuitTag trump={g.trump} /> : <span className="sj-chip">亮主中</span>}
        <span className="sj-chip">打 <b className="c-gold">{rankZh(g.level)}</b></span>
        {g.dealer != null && !dealing && <span className="sj-chip">庄 <Who id={g.seats[g.dealer]} /></span>}
        <span className="sj-chip"><span className={TEAM_CLS[0]}>{TEAM_ZH[0]} {rankZh(g.levels[0])}</span>·<span className={TEAM_CLS[1]}>{TEAM_ZH[1]} {rankZh(g.levels[1])}</span></span>
        <span className="flex-1" />
        {g.step === 'play' && (
          <span className={`sj-chip ${defTeam != null ? (defTeam ? 'teal' : 'gold2') : ''}`} data-testid="points">闲家 <b>{g.points}</b> 分</span>
        )}
        {g.lastTrick && <button className="sj-chip" onClick={() => setPanel('last')} data-testid="last-trick">上一轮</button>}
      </div>

      <div className={`sj-table ${g.step}`}>
        <div className="sj-cell top">{spot(order[0])}</div>
        <div className="sj-cell left">{spot(order[1])}</div>
        <div className="sj-cell mid">{centerInfo}</div>
        <div className="sj-cell right">{spot(order[2])}</div>
        <div className="sj-cell status"><div className="sj-status" data-testid="status">{status}</div></div>
        <div className="sj-cell me">{spot(order[3])}</div>
        <div className="sj-cell actions"><div className="sj-actions">{actions}</div></div>
      </div>

      <div className="sj-handwrap">
        <Hand ids={handIds} ctx={viewCtx}
          selected={sel} onToggle={canTap ? toggle : undefined}
          cw={cw} ch={ch} minStride={g.step === 'bury' ? 21 : 18} maxRows={2} />
      </div>

      {panel === 'last' && g.lastTrick && <LastTrick g={g} ctx={ctx} onClose={() => setPanel(null)} />}
      {panel === 'menu' && (
        <div className="px-overlay" onClick={() => setPanel(null)} data-testid="menu-panel">
          <div className="px-frame pad gold max-w-[420px] w-full" onClick={e => e.stopPropagation()}>
            <div className="px-title">菜单 · 房间 {room.code}</div>
            <div className="grid grid-cols-2">
              <button className="px-btn blue" onClick={() => setPanel('rules')} data-testid="show-rules">本局规则</button>
              <button className="px-btn dark" onClick={() => setPanel(null)}>继续</button>
              {isHost && <button className="px-btn dark" onClick={toLobby} data-testid="to-lobby">回大厅</button>}
              <button className="px-btn red" onClick={leave} data-testid="leave-game">离开房间</button>
            </div>
          </div>
        </div>
      )}
      {panel === 'rules' && <RulesPanel g={g} onClose={() => setPanel(null)} />}
      {g.step === 'result' && <Result g={g} ctx={ctx} me={me} onNext={() => act(x => nextHand(x, { now: Date.now() }))} busy={busy} />}
      {g.step === 'end' && <GameOver g={g} ctx={ctx} me={me} isHost={isHost} busy={busy}
        onLobby={toLobby} onAgain={() => update(r => { r.game = newGame(r.players, { rules: g.rules, timeScale: g.timeScale }); r.round = (r.round || 0) + 1; return r; })} />}
    </div>
  );
}


function LastTrick({ g, ctx, onClose }) {
  const t = g.lastTrick;
  return (
    <div className="px-overlay" onClick={onClose} data-testid="last-panel">
      <div className="px-frame pad max-w-[640px] w-full" onClick={e => e.stopPropagation()}>
        <div className="px-title">第 {t.no} 轮 · <Who id={g.seats[t.winner]} /> 拿下{t.points ? `（${t.points} 分）` : ''}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {t.plays.map(p => (
            <div key={p.seat} className="flex items-center gap-2">
              <span className="w-[86px] shrink-0"><Who id={g.seats[p.seat]} /></span>
              <CardRow ids={p.cards} ctx={ctx} maxW={170} />
              {p.seat === t.winner && <span className="px-tag gold">大</span>}
            </div>
          ))}
        </div>
        <div className="fs-12 mt-2">闲家已得 <b className="c-gold">{g.points}</b> 分{g.pointCards.length ? '：' : ''}</div>
        {g.pointCards.length > 0 && <div className="mt-1"><CardRow ids={g.pointCards} ctx={ctx} size="xs" maxW={560} /></div>}
        {g.penalties.length > 0 && <div className="fs-12 c-evil mt-1">甩牌失败罚分：{g.penalties.map((x, i) => <span key={i}><Who id={g.seats[x.seat]} />{x.penalty} 分 </span>)}</div>}
        <button className="px-btn dark sm mt-2" onClick={onClose} data-testid="close-last">关闭</button>
      </div>
    </div>
  );
}

export function RulesText({ rules }) {
  return (
    <div className="fs-12 leading-relaxed flex flex-col gap-1" data-testid="rules-text">
      {VARIANTS.map(v => {
        const o = v.opts.find(x => x[0] === rules[v.key]) || v.opts[0];
        return <p key={v.key}><span className="c-gold">{v.zh}：{o[1]}</span>{o === v.opts[0] ? <span className="c-mute"> ★</span> : ''} <span className="c-dim">{o[2]}</span></p>;
      })}
    </div>
  );
}

function RulesPanel({ g, onClose }) {
  return (
    <div className="px-overlay" onClick={onClose} data-testid="rules-panel">
      <div className="px-frame pad max-w-[680px] w-full" onClick={e => e.stopPropagation()}>
        <div className="px-title">本局规则</div>
        <RulesText rules={g.rules} />
        <button className="px-btn dark sm mt-2" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}

function changeText(r) {
  if (r.won) return '庄家打过 A，赢下整场！';
  const who = TEAM_ZH[r.team];
  if (r.side === 'dealer') return `${who}守庄，升 ${r.up} 级：${rankZh(r.from)} → ${rankZh(r.to)}${r.capped ? '（必打级停下）' : ''}`;
  return r.up ? `${who}上台，升 ${r.up} 级：${rankZh(r.from)} → ${rankZh(r.to)}${r.capped ? '（必打级停下）' : ''}` : `${who}上台，不升级（打 ${rankZh(r.to)}）`;
}

function Result({ g, ctx, me, onNext, busy }) {
  const r = g.result;
  const myTeamWon = teamOf(me) === r.team;
  return (
    <div className="px-overlay" data-testid="result">
      <div className={`px-frame pad ${myTeamWon ? 'gold' : ''} max-w-[720px] w-full px-pop`}>
        <div className="px-title">第 {r.hand} 局结束 · 闲家 {r.total} 分</div>
        <div className="sj-result">
          <div>
            <div className="fs-12 c-dim">底牌（<Who id={g.seats[r.dealer]} /> 扣的，{r.kittyPts} 分）</div>
            <CardRow ids={r.buried} ctx={ctx} maxW={260} />
            <table className="fs-12 mt-2 sj-tbl"><tbody>
              <tr><td>闲家抓分</td><td>{r.trickPoints}</td></tr>
              <tr><td>{r.dug ? <span className="c-evil">扣底 ×{r.mult}</span> : '庄家保住底牌'}</td><td>{r.dug ? `+${r.bonus}` : '+0'}</td></tr>
              <tr className="c-gold"><td>合计</td><td>{r.total}</td></tr>
            </tbody></table>
          </div>
          <div>
            <div className={`fs-18 ${TEAM_CLS[r.team]}`} data-testid="level-change">{changeText(r)}</div>
            <div className="fs-12 c-dim mt-1">0 分庄家升 3 · 5–35 升 2 · 40–75 升 1 · 80 闲家上台 · 之后每 40 分多升 1</div>
            <div className="sj-levels mt-2">
              {[0, 1].map(t => (
                <div key={t} className="sj-chip justify-between"><span className={TEAM_CLS[t]}>{TEAM_ZH[t]}{teamOf(me) === t ? '（你）' : ''}</span><b>{rankZh(r.levels[t])}</b></div>
              ))}
            </div>
            <div className="fs-12 c-dim mt-1">下一局 <Who id={g.seats[r.nextDealer]} /> 坐庄，打 {rankZh(r.levels[teamOf(r.nextDealer)])}</div>
            <button className="px-btn gold block mt-2" disabled={busy} onClick={onNext} data-testid="next-hand">下一局</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GameOver({ g, me, isHost, busy, onLobby, onAgain }) {
  const t = g.winner;
  const mine = teamOf(me) === t;
  return (
    <div className="px-overlay" data-testid="game-over">
      <Confetti colors={t ? ['#7fe0c8', '#2f9c86', '#f5c542', '#fff6dc'] : ['#f5c542', '#ffe88a', '#a8701a', '#fff6dc']} />
      <div className="px-frame pad gold max-w-[640px] w-full px-pop">
        <div className={`fs-36 text-center ${TEAM_CLS[t]}`}>{TEAM_ZH[t]}打过 A，赢了！</div>
        <div className="text-center fs-12 c-dim mt-1">
          <Who id={g.seats[t]} /><Who id={g.seats[t + 2]} /> {mine ? '恭喜你们！' : '下次再来'}
        </div>
        <div className="px-scroll mt-2" style={{ maxHeight: 130 }}>
          <table className="fs-12 w-full sj-tbl"><tbody>
            {g.history.map((h, i) => (
              <tr key={i}>
                <td>第 {h.hand} 局</td>
                <td><Who id={g.seats[h.dealer]} />打 {rankZh(h.level)} {h.trump ? SUIT_SYM[h.trump] : '无主'}</td>
                <td>闲家 {h.total}</td>
                <td className={TEAM_CLS[h.team]}>{TEAM_ZH[h.team]} {rankZh(h.from)}→{rankZh(h.to)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        {isHost ? (
          <div className="grid grid-cols-2 mt-2">
            <button className="px-btn dark" disabled={busy} onClick={onLobby} data-testid="back-lobby">回大厅</button>
            <button className="px-btn gold" disabled={busy} onClick={onAgain} data-testid="play-again">再来一场</button>
          </div>
        ) : <div className="text-center c-dim mt-2">等房主开下一场…</div>}
      </div>
    </div>
  );
}



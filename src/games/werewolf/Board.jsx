import { useEffect, useMemo, useState } from 'react';
import PixelSprite, { Portrait } from '../pixel/PixelSprite';
import RoundTable from '../avalon/RoundTable';
import { Who, WhoList, useConfirm, Confetti } from '../avalon/ui';
import {
  ROLES, activeCard, isAlive, isWolfCamp, lives, alivePlayers, activeWolves, score,
  swapCards, lockCards, guardAct, wolfAct, seerAct, witchAct, hunterShoot, startVote, castVote,
  newGame, effectiveConfig,
} from './wolfRules';

const Title = ({ children }) => <div className="px-title">{children}</div>;
const isNight = step => step === 'night' || step === 'witch';

export default function Board({ room, myId, update, busy }) {
  const confirm = useConfirm();
  const g = room.game;
  const isHost = room.hostId === myId;
  const byId = useMemo(() => Object.fromEntries(room.players.map(p => [p.id, p])), [room.players]);
  const seats = g.seats.map(id => byId[id] || { id, name: '?' });
  const mine = activeCard(g, myId);
  const [target, setTarget] = useState(null);
  const [mode, setMode] = useState(null); // witch: 'poison'
  const act = fn => update(r => { fn(r.game); return r; });
  const roomKey = `${room.code}:${room.round}`;

  useEffect(() => { setTarget(null); setMode(null); }, [g.step, g.night]);

  // which seats can I tap right now?
  const pickable = id => {
    if (!isAlive(g, id)) return false;
    switch (g.step) {
      case 'night':
        if (mine === 'wolf') return true;
        if (mine === 'guard') return !g.acts.guard && id !== g.guardLast;
        if (mine === 'seer') return !g.acts.seer && id !== myId;
        return false;
      case 'witch': return mine === 'witch' && mode === 'poison';
      case 'hunter': return g.hunter?.id === myId && id !== myId;
      case 'vote': return isAlive(g, myId) && id !== myId;
      default: return false;
    }
  };

  const seerSaw = Object.fromEntries(g.seerLog.filter(l => l.from === myId).map(l => [l.to, l.wolf]));
  const wolfView = isNight(g.step) && mine === 'wolf';
  const wolfMates = wolfView ? activeWolves(g) : [];

  const decorate = id => {
    const out = !isAlive(g, id);
    let badge = null;
    if (g.step === 'vote' && isAlive(g, id)) badge = id in g.votes ? <span key="v1" className="px-tag ok px-stamp">已投</span> : <span key="v0" className="px-tag">…</span>;
    else if (g.step === 'arrange') badge = g.hands[id].locked ? <span className="px-tag ok px-stamp">✓</span> : null;
    else if (wolfView) {
      const n = wolfMates.filter(w => g.acts.wolves[w] === id).length;
      if (n) badge = <span key={`k${n}`} className="px-tag evil px-stamp">刀{n > 1 ? `×${n}` : ''}</span>;
    }
    if (!badge && id in seerSaw && g.step !== 'end') badge = <span className={`px-tag ${seerSaw[id] ? 'evil' : 'good'}`}>{seerSaw[id] ? '狼' : '好'}</span>;
    return {
      top: (
        <>
          <Lives n={lives(g, id)} />
          {wolfView && wolfMates.includes(id) && id !== myId && <span className="px-tag evil">狼</span>}
          {g.hunter?.id === id && g.step === 'hunter' && <span className="px-tag gold">枪</span>}
        </>
      ),
      badge,
      cls: [out && 'out', target === id && 'target'].filter(Boolean).join(' '),
      role: g.step === 'end' ? ROLES[g.hands[id].cards[0]].sprite : null,
      clickable: pickable(id),
    };
  };

  const center = (() => {
    const s = score(g);
    switch (g.step) {
      case 'arrange': return <><div className="fs-24 c-gold shadow-px">排牌</div><div className="fs-12 c-dim">{g.seats.filter(id => g.hands[id].locked).length}/{g.seats.length} 人已排好</div></>;
      case 'night': case 'witch': return <><PixelSprite name="moon" scale={2} /><div className="fs-24 c-gold shadow-px">第 {g.night} 夜</div><div className="fs-12 c-dim">天黑请闭眼</div></>;
      case 'day': return <><div className="fs-12 c-dim">第 {g.day} 天</div><div className="fs-24 c-gold shadow-px">天亮了</div><div className="fs-12">{g.lastNight?.lost.length ? `${g.lastNight.lost.length} 条命消失` : '平安夜'}</div></>;
      case 'hunter': return <><div className="fs-24 c-evil shadow-px">猎人开枪</div><div className="fs-12"><Who id={g.hunter.id} /></div></>;
      case 'vote': return <><div className="fs-12 c-dim">第 {g.day} 天</div><div className="fs-24 c-gold shadow-px">放逐投票</div><div className="fs-12">{Object.keys(g.votes).length}/{alivePlayers(g).length} 已投</div></>;
      case 'end': return <><div className={`fs-36 shadow-px ${g.winner === 'good' ? 'c-good' : 'c-evil'}`}>{g.winner === 'good' ? '好人胜利' : '狼人胜利'}</div><div className="fs-12">{g.reason}</div><div className="fs-12 c-dim">剩余 狼牌 {s.wolves} · 村民 {s.villagers} · 神 {s.gods}</div></>;
      default: return null;
    }
  })();

  return (
    <div className={`grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start ${isNight(g.step) ? 'px-is-night' : ''}`}>
      {isNight(g.step) && <div className="px-night" aria-hidden />}
      <div className="px-frame pad relative z-[1]">
        <div className="flex items-center justify-between fs-12 c-dim mb-1">
          <span>{isNight(g.step) ? `🌙 第 ${g.night} 夜` : g.day ? `☀ 第 ${g.day} 天` : '开局'}</span>
          <span>第 {room.round} 局</span>
        </div>
        <RoundTable seats={seats} myId={myId} decorate={decorate} onSeatClick={id => setTarget(id)} center={<div key={`${g.step}${g.night}`} className="px-pop flex flex-col items-center gap-[2px]">{center}</div>} />
      </div>

      <div className="flex flex-col gap-6 relative z-[1]">
        <div className="px-frame parch pad" data-testid="action-panel">
          <div key={`${g.step}-${g.night}-${mode}`} className="px-slide">
            <ActionPanel {...{ g, room, myId, mine, isHost, act, update, busy, target, setTarget, mode, setMode, confirm }} />
          </div>
        </div>
        {g.step !== 'arrange' && <MyHand g={g} myId={myId} />}
        <PublicLog g={g} />
      </div>

      <DawnReveal g={g} roomKey={roomKey} />
      <VoteReveal g={g} roomKey={roomKey} />
      <SeerReveal g={g} myId={myId} roomKey={roomKey} />
      {g.step === 'end' && <Confetti colors={g.winner === 'good' ? ['#4f7df0', '#8fb0ff', '#f5c542', '#fff6dc'] : ['#e04848', '#ff8a80', '#8b52d6', '#170f22']} />}
    </div>
  );
}

function Lives({ n }) {
  return <span className="px-lives" title={`${n} 条命`}>{[0, 1].map(i => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
}

// ------------------------------------------------------------ cards ---
function RoleCard({ role, label, state, size = 3 }) {
  const r = ROLES[role];
  return (
    <div className={`px-rcard ${r.team} ${state || ''}`}>
      <div className="fs-12 c-dim">{label}</div>
      <Portrait role={r.sprite} scale={size} />
      <div className={`fs-18 ${r.team === 'wolf' ? 'c-evil' : r.god ? 'c-gold' : 'c-good'}`}>{r.zh}</div>
      {state === 'dead' && <div className="px-rcard-x" aria-hidden>✕</div>}
    </div>
  );
}

function MyHand({ g, myId }) {
  const [shown, setShown] = useState(() => { try { return sessionStorage.getItem('ww:hand') !== '0'; } catch { return true; } });
  const toggle = () => { setShown(v => { try { sessionStorage.setItem('ww:hand', v ? '0' : '1'); } catch { /* ignore */ } return !v; }); };
  const h = g.hands[myId];
  const d = g.dead[myId];
  return (
    <div className="px-frame pad" data-testid="my-hand">
      <div className="flex items-center justify-between mb-3">
        <div className="px-title !mb-0">我的两张牌</div>
        <button className="px-btn dark sm" onClick={toggle}>{shown ? '遮住' : '查看'}</button>
      </div>
      {shown ? (
        <>
          <div className="flex justify-center gap-4">
            {h.cards.map((c, i) => (
              <RoleCard key={i} role={c} size={2.5} label={i === 0 ? '第一条命' : '第二条命'}
                state={i < d ? 'dead' : i === d ? 'now' : 'wait'} />
            ))}
          </div>
          <div className="fs-12 c-dim mt-3 text-center">
            {isWolfCamp(g, myId) ? <span className="c-evil">你是狼人阵营</span> : <span className="c-good">你是好人阵营</span>}
            {' · '}{d >= 2 ? '你已出局' : `当前身份：${ROLES[h.cards[d]].zh}`}
          </div>
        </>
      ) : <div className="fs-12 c-mute text-center py-6">已遮住（防偷看）</div>}
    </div>
  );
}

// ------------------------------------------------------------ panel ---
function Sleeping({ text = '天黑请闭眼' }) {
  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="px-zzz fs-24 c-dim" aria-hidden><span>Z</span><span>z</span><span>z</span></div>
      <div className="fs-18">{text}</div>
      <div className="fs-12 c-dim">有行动的人正在操作，请不要偷看别人的手机</div>
    </div>
  );
}

function ActionPanel({ g, room, myId, mine, isHost, act, update, busy, target, setTarget, mode, setMode, confirm }) {
  const alive = isAlive(g, myId);
  const h = g.hands[myId];

  switch (g.step) {
    case 'arrange': {
      const hasWolf = h.cards.includes('wolf');
      return <>
        <Title>排好你的两张牌</Title>
        <div className="flex justify-center gap-4 mb-3">
          <RoleCard role={h.cards[0]} label="上 · 先用" state="now" />
          <RoleCard role={h.cards[1]} label="下 · 第二条命" state="wait" />
        </div>
        <p className="fs-12 c-dim mb-3 text-center">
          {hasWolf
            ? <><span className="c-evil">你是狼人阵营。</span>{h.cards[0] === 'wolf' && h.cards[1] === 'wolf' ? '两张都是狼，每晚都能刀人。' : '狼牌放上面才能晚上刀人；放下面可以先装好人。'}</>
            : <><span className="c-good">你是好人阵营。</span>有技能的牌放上面就能先用技能。</>}
        </p>
        {h.locked ? (
          <div className="text-center c-dim">已锁定，等待其他人… ({g.seats.filter(id => g.hands[id].locked).length}/{g.seats.length})</div>
        ) : (
          <div className="grid grid-cols-2">
            <button className="px-btn dark lg" disabled={busy} onClick={() => act(x => swapCards(x, myId))} data-testid="swap">⇅ 交换上下</button>
            <button className="px-btn gold lg" disabled={busy} onClick={() => act(x => lockCards(x, myId))} data-testid="lock">锁定顺序</button>
          </div>
        )}
      </>;
    }

    case 'night': {
      if (!alive) return <Sleeping text="你已出局，安静观战" />;
      if (mine === 'wolf') {
        const mates = activeWolves(g).filter(id => id !== myId);
        const myPick = g.acts.wolves[myId];
        return <>
          <Title>狼人请睁眼</Title>
          <p className="mb-2">今晚的狼队友：{mates.length ? <WhoList ids={mates} tone="evil" /> : <span className="c-dim">只有你{g.seats.some(id => id !== myId && isWolfCamp(g, id)) ? '（其他狼牌还压在下面）' : ''}</span>}</p>
          <p className="fs-12 c-dim mb-3">在圆桌上点一个人，所有在场的狼都选好后结算（意见不同按多数，平票按座位靠前的狼）。</p>
          {myPick && <p className="mb-3">你选了 <Who id={myPick} tone="evil" />，等待队友…</p>}
          <button className="px-btn red lg block" disabled={busy || !target} onClick={() => act(x => wolfAct(x, myId, target))} data-testid="wolf-kill">
            {target ? <>刀 <Who id={target} /></> : '先在圆桌上选人'}
          </button>
        </>;
      }
      if (mine === 'guard') {
        if (g.acts.guard) return <><Title>守卫</Title><p>今晚守护 <Who id={g.acts.guard} tone="good" />。</p><Sleeping text="等待天亮" /></>;
        return <>
          <Title>守卫请睁眼</Title>
          <p className="fs-12 c-dim mb-3">选一个人今晚不被狼刀（可以守自己）。{g.guardLast && <>昨晚守了 <Who id={g.guardLast} />，今晚不能再守。</>}</p>
          <button className="px-btn blue lg block" disabled={busy || !target} onClick={() => act(x => guardAct(x, myId, target))} data-testid="guard-act">
            {target ? <>守护 <Who id={target} /></> : '先在圆桌上选人'}
          </button>
        </>;
      }
      if (mine === 'seer') {
        const last = g.seerLog.find(l => l.night === g.night && l.from === myId);
        if (last) return <><Title>预言家</Title><p><Who id={last.to} /> 当前是 <b className={last.wolf ? 'c-evil' : 'c-good'}>{last.wolf ? '狼人' : '好人'}</b>。</p><Sleeping text="等待天亮" /></>;
        return <>
          <Title>预言家请睁眼</Title>
          <p className="fs-12 c-dim mb-3">选一个人查验他<b>当前那张牌</b>。他下面那张牌你看不到。</p>
          <button className="px-btn gold lg block" disabled={busy || !target} onClick={() => act(x => seerAct(x, myId, target))} data-testid="seer-act">
            {target ? <>查验 <Who id={target} /></> : '先在圆桌上选人'}
          </button>
        </>;
      }
      return <Sleeping />;
    }

    case 'witch': {
      if (mine !== 'witch' || !alive) return <Sleeping />;
      const kill = g.acts.kill;
      const canSave = g.potions.save && kill && kill !== myId;
      if (mode === 'poison') return <>
        <Title>女巫 · 毒药</Title>
        <p className="fs-12 c-dim mb-3">在圆桌上点要毒的人。被毒的猎人不能开枪。</p>
        <div className="grid grid-cols-2">
          <button className="px-btn dark lg" onClick={() => { setMode(null); setTarget(null); }}>返回</button>
          <button className="px-btn red lg" disabled={busy || !target} onClick={() => act(x => witchAct(x, myId, { poison: target }))} data-testid="witch-poison-go">
            {target ? <>毒 <Who id={target} /></> : '选人'}
          </button>
        </div>
      </>;
      return <>
        <Title>女巫请睁眼</Title>
        <p className="mb-3">{kill ? <>今晚 <Who id={kill} size="lg" /> 被狼刀了。</> : '今晚狼人没有刀人。'}</p>
        {kill === myId && g.potions.save && <p className="fs-12 c-evil mb-2">女巫不能自救。</p>}
        <div className="grid grid-cols-2">
          <button className="px-btn blue lg" disabled={busy || !canSave} onClick={() => act(x => witchAct(x, myId, { save: true }))} data-testid="witch-save">
            {g.potions.save ? '用解药救他' : '解药已用'}
          </button>
          <button className="px-btn red lg" disabled={busy || !g.potions.poison} onClick={() => setMode('poison')} data-testid="witch-poison">
            {g.potions.poison ? '用毒药…' : '毒药已用'}
          </button>
        </div>
        <button className="px-btn dark block mt-2" disabled={busy} onClick={() => act(x => witchAct(x, myId, {}))} data-testid="witch-skip">今晚不用药</button>
      </>;
    }

    case 'day': {
      const lost = g.lastNight?.lost || [];
      return <>
        <Title>第 {g.day} 天 · 天亮了</Title>
        <div className="mb-3">{lost.length
          ? <>昨晚 {lost.map((id, i) => <span key={i}><Who id={id} size="lg" /></span>)} 失去一条命。</>
          : '昨晚是平安夜，没有人失去生命。'}</div>
        <p className="fs-12 c-dim mb-4">从房主左手边开始，按座位号依次发言。讨论完由房主开启投票。</p>
        {isHost
          ? <button className="px-btn gold lg block" disabled={busy} onClick={() => act(startVote)} data-testid="start-vote">开始放逐投票</button>
          : <div className="text-center c-dim">等待房主开启投票…</div>}
      </>;
    }

    case 'hunter': {
      if (g.hunter.id !== myId) return <><Title>猎人</Title><p><Who id={g.hunter.id} /> 的猎人牌出局了，正在决定要不要开枪。</p></>;
      return <>
        <Title>你的猎人牌出局了</Title>
        <p className="fs-12 c-dim mb-3">可以开枪带走一个人的一条命，也可以不开。</p>
        <div className="grid grid-cols-2">
          <button className="px-btn dark lg" disabled={busy} onClick={() => act(x => hunterShoot(x, myId, null))} data-testid="hunter-skip">不开枪</button>
          <button className="px-btn red lg" disabled={busy || !target}
            onClick={async () => { if (await confirm({ title: '开枪', body: <>带走 <Who id={target} size="lg" /> 的一条命？</>, ok: '开枪', tone: 'danger' })) act(x => hunterShoot(x, myId, target)); }}
            data-testid="hunter-shoot">{target ? <>射 <Who id={target} /></> : '选人'}</button>
        </div>
      </>;
    }

    case 'vote': {
      if (!alive) return <><Title>放逐投票</Title><p className="c-dim">你已出局，不能投票。</p></>;
      const my = g.votes[myId];
      return <>
        <Title>放逐投票 · 第 {g.day} 天</Title>
        <p className="fs-12 c-dim mb-3">在圆桌上点你要投的人。最高票失去一条命，平票无人出局。所有人投完前可以改票。</p>
        {myId in g.votes && <p className="mb-3">你投了 {my ? <Who id={my} /> : '弃票'}。</p>}
        <div className="grid grid-cols-2">
          <button className="px-btn dark lg" disabled={busy || (myId in g.votes && my === null)} onClick={() => act(x => castVote(x, myId, null))} data-testid="vote-skip">弃票</button>
          <button className="px-btn gold lg" disabled={busy || !target || my === target} onClick={() => act(x => castVote(x, myId, target))} data-testid="vote-go">
            {target ? <>投 <Who id={target} /></> : '选人'}
          </button>
        </div>
      </>;
    }

    case 'end': return <EndPanel g={g} room={room} isHost={isHost} update={update} busy={busy} confirm={confirm} />;
    default: return null;
  }
}

function EndPanel({ g, isHost, update, busy, confirm }) {
  const again = async () => {
    if (!await confirm({ title: '再来一局？', body: '同一批人重新发牌。', ok: '开新一局' })) return;
    update(r => { r.game = newGame(r.players, effectiveConfig(r.players.length, r.config)); r.round += 1; return r; });
  };
  const lobby = () => update(r => { r.phase = 'lobby'; r.game = null; return r; });
  return <>
    <Title>{g.winner === 'good' ? '好人胜利' : '狼人胜利'}</Title>
    <p className="fs-12 c-dim mb-3">{g.reason}</p>
    <div className="flex flex-col gap-2 mb-4" data-testid="reveal-all">
      {g.seats.map(id => (
        <div key={id} className="flex items-center gap-2 flex-wrap">
          <Who id={id} tone={isWolfCamp(g, id) ? 'evil' : 'good'} />
          {g.hands[id].cards.map((c, i) => (
            <span key={i} className={`px-tag ${ROLES[c].team === 'wolf' ? 'evil' : ROLES[c].god ? 'gold' : 'good'} ${i < g.dead[id] ? 'line-through opacity-60' : ''}`}>{ROLES[c].zh}</span>
          ))}
        </div>
      ))}
    </div>
    {isHost ? (
      <div className="grid grid-cols-2">
        <button className="px-btn dark" disabled={busy} onClick={lobby} data-testid="to-lobby">回大厅</button>
        <button className="px-btn gold" disabled={busy} onClick={again} data-testid="play-again">再来一局</button>
      </div>
    ) : <div className="text-center c-dim fs-12">等待房主开新一局…</div>}
  </>;
}

// -------------------------------------------------------------- log ---
function PublicLog({ g }) {
  const items = [...g.log].reverse();
  if (!items.length) return null;
  return (
    <div className="px-frame pad">
      <Title>记录</Title>
      <div className="flex flex-col gap-3 px-scroll fs-12" data-testid="log">
        {items.map((e, i) => {
          if (e.type === 'night') return <div key={i}><span className="c-dim">第 {e.night} 夜：</span>{e.lost.length ? <><WhoList ids={e.lost} /> 失去一条命</> : '平安夜'}</div>;
          if (e.type === 'shot') return <div key={i}><span className="c-dim">第 {e.day} 天：</span>猎人 <Who id={e.from} /> {e.to ? <>带走了 <Who id={e.to} /> 一条命</> : '没有开枪'}</div>;
          if (e.type === 'vote') {
            const by = {};
            Object.entries(e.votes).forEach(([v, t]) => { (by[t || '-'] ||= []).push(v); });
            const rows = Object.entries(by).sort((a, b) => (a[0] === '-') - (b[0] === '-') || b[1].length - a[1].length);
            return (
              <div key={i}>
                <div><span className="c-dim">第 {e.day} 天投票：</span>{e.out ? <><Who id={e.out} tone="evil" /> 被投出一条命</> : e.tie ? '平票，无人出局' : '全员弃票'}</div>
                {rows.map(([t, vs]) => (
                  <div key={t} className="ml-3 c-dim flex flex-wrap items-center gap-x-1">
                    {t === '-' ? <span>弃票</span> : <><Who id={t} /><span>{vs.length} 票</span></>}<span>←</span><WhoList ids={vs} />
                  </div>
                ))}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------- overlays ---
function useDismissed(key) {
  const [, force] = useState(0);
  const isDone = !key || (() => { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } })();
  const done = () => { try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ } force(n => n + 1); };
  return [isDone, done];
}

function DawnReveal({ g, roomKey }) {
  const show = g.step === 'day' || g.step === 'hunter';
  const key = show && g.lastNight ? `ww:dawn:${roomKey}:${g.lastNight.night}` : null;
  const [isDone, done] = useDismissed(key);
  useEffect(() => {
    if (!key || isDone) return undefined;
    const t = setTimeout(done, 6000);
    return () => clearTimeout(t);
  }, [key, isDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!key || isDone) return null;
  const lost = g.lastNight.lost;
  return (
    <div className="px-overlay px-dawn" onClick={done} data-testid="dawn-reveal">
      <div className="px-frame gold pad flex flex-col items-center gap-4 text-center max-w-[480px] w-full px-pop" onClick={e => e.stopPropagation()}>
        <PixelSprite name="sun" scale={4} className="px-rise" />
        <div className="fs-12 c-dim tracking-[0.2em]">第 {g.lastNight.night} 夜过去了</div>
        <div className="fs-36 c-gold shadow-px">天亮了</div>
        {lost.length ? (
          <div className="flex flex-col items-center gap-2">
            {lost.map((id, i) => (
              <div key={i} className="px-stamp flex items-center gap-2" style={{ animationDelay: `${0.5 + i * 0.4}s` }}>
                <Who id={id} size="lg" /><span className="fs-18 c-evil">失去一条命</span>
                <span className="fs-12 c-dim">（剩 {lives(g, id)}）</span>
              </div>
            ))}
          </div>
        ) : <div className="fs-24 c-good px-stamp" style={{ animationDelay: '0.5s' }}>平安夜</div>}
        <button className="px-btn gold" onClick={done} data-testid="close-dawn">继续</button>
      </div>
    </div>
  );
}

function VoteReveal({ g, roomKey }) {
  const votes = g.log.filter(e => e.type === 'vote');
  const e = votes[votes.length - 1];
  const fresh = e && e.day === g.day && g.step !== 'vote';
  const key = fresh ? `ww:vote:${roomKey}:${e.day}` : null;
  const [isDone, done] = useDismissed(key);
  const voters = e ? g.seats.filter(id => id in e.votes) : [];
  useEffect(() => {
    if (!key || isDone) return undefined;
    const t = setTimeout(done, 1200 + voters.length * 220 + 2000);
    return () => clearTimeout(t);
  }, [key, isDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!key || isDone) return null;
  const after = { animationDelay: `${0.3 + voters.length * 0.22}s` };
  return (
    <div className="px-overlay" onClick={done} data-testid="vote-reveal">
      <div className="px-frame gold pad flex flex-col items-center gap-4 text-center max-w-[600px] w-full" onClick={ev => ev.stopPropagation()}>
        <div className="fs-12 c-dim tracking-[0.2em]">第 {e.day} 天 · 放逐投票</div>
        <div className="flex flex-col gap-2 items-start">
          {voters.map((id, i) => (
            <div key={id} className="flex items-center gap-1 px-stamp" style={{ animationDelay: `${0.3 + i * 0.22}s` }}>
              <Who id={id} /><span className="c-dim">→</span>{e.votes[id] ? <Who id={e.votes[id]} /> : <span className="c-mute">弃票</span>}
            </div>
          ))}
        </div>
        <div className="px-pop" style={after}>
          {e.out
            ? <div className="flex items-center gap-2 justify-center"><Who id={e.out} size="lg" tone="evil" /><span className="fs-24 c-evil shadow-px">失去一条命</span></div>
            : <div className="fs-24 c-gold shadow-px">{e.tie ? '平票，无人出局' : '无人出局'}</div>}
        </div>
        <button className="px-btn gold px-pop" style={after} onClick={done} data-testid="close-vote">继续</button>
      </div>
    </div>
  );
}

function SeerReveal({ g, myId, roomKey }) {
  const last = g.seerLog[g.seerLog.length - 1];
  const mineNow = last && last.from === myId && last.night === g.night && isNight(g.step);
  const key = mineNow ? `ww:seer:${roomKey}:${last.night}` : null;
  const [isDone, done] = useDismissed(key);
  if (!key || isDone) return null;
  return (
    <div className="px-overlay" onClick={done} data-testid="seer-reveal">
      <div className={`px-frame pad flex flex-col items-center gap-4 text-center max-w-[420px] w-full px-pop ${last.wolf ? 'danger' : ''}`} onClick={e => e.stopPropagation()}>
        <Portrait role="seer" scale={3} className="px-bob" />
        <div className="fs-12 c-dim">水晶球显示（只有你看得到）</div>
        <Who id={last.to} size="lg" />
        <div className="px-stamp" style={{ animationDelay: '0.5s' }}>
          <div className={`fs-36 shadow-px ${last.wolf ? 'c-evil' : 'c-good'}`}>{last.wolf ? '当前是狼人' : '当前是好人'}</div>
        </div>
        <div className="fs-12 c-dim">提醒：他下面那张牌可能不一样</div>
        <button className="px-btn gold" onClick={done} data-testid="close-seer">知道了</button>
      </div>
    </div>
  );
}


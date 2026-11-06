import { useEffect, useMemo, useState } from 'react';
import PixelSprite, { Portrait } from '../pixel/PixelSprite';
import RoundTable from '../avalon/RoundTable';
import { Who, WhoList, useConfirm, Confetti } from '../avalon/ui';
import {
  ROLES, JGL_BLURB, canDouble, isJgl, activeCard, isAlive, isWolfCamp, lives, activeWolves, score, isNightWolf, isMuted, voters, canSelfSave,
  changedRules, isBaby, babies, nextSpeaker, speakerNow, candidates, FORCE_AFTER_MS,
  swapCards, lockCards, guardAct, wolfAct, seerAct, witchAct, ackLoss, settleNight, forceNight, startVote, castVote, nightfall,
  newGame, effectiveConfig,
} from './wolfRules';

const Title = ({ children }) => <div className="px-title">{children}</div>;
const isNight = step => step === 'night' || step === 'witch';
const SPEAK_HINT_S = 90;

function useNow(active, ms = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

/** Keep phones awake during a game: a sleeping phone stalls the night. */
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
  useWakeLock(g.step !== 'end');

  // the host's phone ends each night once it's due (clock-driven, so night length leaks nothing)
  useEffect(() => {
    if (!isHost || g.step !== 'witch' || g.settleAt == null) return undefined;
    const t = setTimeout(() => act(x => settleNight(x)), Math.max(0, g.settleAt - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [isHost, g.step, g.settleAt, g.night]); // eslint-disable-line react-hooks/exhaustive-deps

  const task = isNight(g.step) && g.step === 'night' ? nightTask(g, myId) : null;
  const iConfirm = g.step === 'confirm' && g.confirm.ids.includes(myId) && !(myId in g.confirm.acked);

  // which seats can I tap right now?
  const pickable = id => {
    if (!isAlive(g, id)) return false;
    switch (g.step) {
      case 'night': {
        if (task === 'guard') return id !== g.guardLast;
        if (task === 'seer') return id !== myId;
        return task === 'wolf' || (isNightWolf(g, myId) && myId in g.acts.wolves);
      }
      case 'witch': return mine === 'witch' && !g.acts.witchDone && mode === 'poison';
      case 'confirm': return iConfirm && g.confirm.hunter === myId && id !== myId;
      case 'vote': return isAlive(g, myId) && voters(g).includes(myId) && id !== myId && candidates(g).includes(id);
      default: return false;
    }
  };
  const onSeat = id => setTarget(id);

  // seer results stay on the seer's own phone, and only while acting at night
  const seerSaw = g.step === 'night' && mine === 'seer'
    ? Object.fromEntries(g.seerLog.filter(l => l.from === myId).map(l => [l.to, l.wolf])) : {};
  const wolfView = g.step === 'night' && isNightWolf(g, myId);
  const wolfMates = wolfView ? activeWolves(g) : [];

  const decorate = id => {
    const out = !isAlive(g, id);
    let badge = null;
    if (g.step === 'vote' && isMuted(g, id)) badge = <span className="px-tag">禁票</span>;
    else if (g.step === 'vote' && (g.pk || []).includes(id)) badge = <span className="px-tag gold">PK</span>;
    else if (g.step === 'vote' && isAlive(g, id)) badge = id in g.votes ? <span key="v1" className="px-tag ok px-stamp">已投</span> : <span key="v0" className="px-tag">…</span>;
    else if (wolfView) {
      const n = wolfMates.filter(w => g.acts.wolves[w] === id).length;
      if (n) badge = <span key={`k${n}`} className="px-tag evil px-stamp">刀{n > 1 ? `×${n}` : ''}</span>;
    }
    if (!badge && speakerNow(g) === id) badge = <span key="spk" className="px-tag gold px-stamp">发言</span>;
    if (!badge && id in seerSaw) badge = <span className={`px-tag ${seerSaw[id] ? 'evil' : 'good'}`}>{seerSaw[id] ? '狼' : '好'}</span>;
    return {
      top: (
        <>
          <Lives n={lives(g, id)} />
          {wolfView && wolfMates.includes(id) && id !== myId && <span className="px-tag evil">狼</span>}
        </>
      ),
      badge,
      cls: [out && 'out', target === id && 'target'].filter(Boolean).join(' '),
      role: g.step === 'end' ? ROLES[g.hands[id].cards[0]].sprite : null,
      clickable: pickable(id),
    };
  };

  const center = (() => {
    switch (g.step) {
      case 'arrange': return <><div className="fs-24 c-gold shadow-px">排牌</div><div className="fs-12 c-dim">{g.seats.filter(id => g.hands[id].locked).length}/{g.seats.length} 人已排好</div></>;
      case 'night': case 'witch': return <><PixelSprite name="moon" scale={2} /><div className="fs-24 c-gold shadow-px">第 {g.night} 夜</div><div className="fs-12 c-dim">天黑请闭眼</div></>;
      case 'confirm': return <><div className="fs-24 c-gold shadow-px">请稍候</div><div className="fs-12 c-dim">失去命的人在确认</div></>;
      case 'day': return g.speak?.pk
        ? <><div className="fs-24 c-gold shadow-px">平票 PK</div><div className="fs-12">再发言一轮</div></>
        : <><div className="fs-24 c-gold shadow-px">天亮了</div><div className="fs-12">{g.lastNight?.lost.length ? `${g.lastNight.lost.length} 条命消失` : g.rules?.peace === 'three' ? `平安夜 ${g.peaceStreak}/3` : '平安夜'}</div></>;
      case 'vote': return <><div className="fs-24 c-gold shadow-px">{g.pk ? 'PK 投票' : '放逐投票'}</div><div className="fs-12">{Object.keys(g.votes).length}/{voters(g).length} 已投</div></>;
      case 'dusk': return <><div className="fs-24 c-gold shadow-px">黄昏</div><div className="fs-12 c-dim">{g.dusk?.order.length ? '遗言' : '准备天黑'}</div></>;
      case 'end': return <><div className={`fs-36 shadow-px ${g.winner === 'good' ? 'c-good' : 'c-evil'}`}>{g.winner === 'good' ? '好人胜利' : '狼人胜利'}</div></>;
      default: return null;
    }
  })();

  const darkPanel = isNight(g.step) || g.step === 'confirm';
  return (
    <div className={`grid gap-3 sm:gap-6 lg:grid-cols-[1.3fr_1fr] items-start ${isNight(g.step) ? 'px-is-night' : ''}`}>
      {isNight(g.step) && <div className="px-night" aria-hidden />}
      <div className="px-frame pad tight relative z-[1] min-w-0">
        <div className="flex items-center justify-between fs-12 c-dim">
          <span>{isNight(g.step) ? `第 ${g.night} 夜` : g.day ? `第 ${g.day} 天` : '开局'}</span>
          <span>第 {room.round} 局</span>
        </div>
        <RoundTable compact seats={seats} myId={myId} decorate={decorate} onSeatClick={onSeat} center={<div key={`${g.step}${g.night}`} className="px-pop flex flex-col items-center gap-[2px]">{center}</div>} />
      </div>

      <div className="flex flex-col gap-3 sm:gap-6 relative z-[1] min-w-0">
        <div className={`px-frame pad tight ${darkPanel ? 'px-nightpanel' : 'parch'}`} data-testid="action-panel">
          <div key={`${g.step}-${g.night}-${mode}`} className="px-slide">
            <ActionPanel {...{ g, room, myId, mine, isHost, act, update, busy, target, setTarget, mode, setMode, confirm, task }} />
          </div>
        </div>
        {isHost && isNight(g.step) && <ForceDawn g={g} act={act} busy={busy} />}
        {g.step !== 'arrange' && <MyHand g={g} myId={myId} />}
        <PublicLog g={g} />
        {changedRules(g.rules || {}).length > 0 && (
          <div className="px-frame pad" data-testid="house-rules">
            <Title>本局规则变体</Title>
            <div className="flex flex-wrap gap-2 fs-12">
              {changedRules(g.rules).map(r => <span key={r.key} className="px-tag gold">{r.zh}：{r.val}</span>)}
            </div>
          </div>
        )}
      </div>

      <DawnReveal g={g} roomKey={roomKey} />
      <VoteReveal g={g} roomKey={roomKey} />
      <SeerReveal g={g} myId={myId} roomKey={roomKey} />
      {g.step === 'end' && <Confetti colors={g.winner === 'good' ? ['#4f7df0', '#8fb0ff', '#f5c542', '#fff6dc'] : ['#e04848', '#ff8a80', '#8b52d6', '#170f22']} />}
    </div>
  );
}

/** Host-only, and only once a night has dragged on: someone's phone probably fell asleep. */
function ForceDawn({ g, act, busy }) {
  const now = useNow(true, 2000);
  if (now - g.nightStart < FORCE_AFTER_MS * (g.timeScale ?? 1)) return null;
  return (
    <div className="px-frame pad tight fs-12 flex items-center justify-between gap-2" data-testid="force-dawn">
      <span className="c-dim">夜里好像有人卡住了（手机锁屏或断网）</span>
      <button className="px-btn dark sm" disabled={busy} onClick={() => act(x => forceNight(x))}>强制天亮</button>
    </div>
  );
}

function CardTag({ card }) {
  const r = ROLES[card];
  return <span className={`px-tag ${r.team === 'wolf' ? 'evil' : r.god ? 'gold' : 'good'} ml-1`}>亮牌·{r.zh}</span>;
}

/** What this player still has to do tonight: their skill first, then the wolf kill. */
function nightTask(g, id) {
  const card = activeCard(g, id);
  if (card === 'guard' && !g.acts.guard) return 'guard';
  if (card === 'seer' && !g.acts.seer) return 'seer';
  if (isNightWolf(g, id) && !(id in g.acts.wolves)) return 'wolf';
  return null;
}

function Lives({ n }) {
  return <span className="px-lives" title={`${n} 条命`}>{[0, 1].map(i => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
}

/** Group lost lives by player: 金刚狼 takes two at once. */
function groupLost(lost) {
  const m = new Map();
  lost.forEach(l => { const e = m.get(l.id) || { id: l.id, n: 0, cards: [] }; e.n += 1; if (l.card) e.cards.push(l.card); m.set(l.id, e); });
  return [...m.values()];
}

// ------------------------------------------------------------ cards ---
function RoleCard({ role, label, state, size = 3 }) {
  const r = ROLES[role];
  return (
    <div className={`px-rcard ${r.team} ${state || ''}`}>
      <div className="px-rcard-label">{label}</div>
      <Portrait role={r.sprite} scale={size} />
      <div className={`fs-18 ${r.team === 'wolf' ? 'c-evil' : r.god ? 'c-gold' : 'c-good'}`}>{r.zh}</div>
      {state === 'dead' && <div className="px-rcard-x" aria-hidden>✕</div>}
    </div>
  );
}

/** Secrets stay covered; press and hold to look (let go and they're hidden again). */
function Peek({ children, label = '按住查看', testId }) {
  const [open, setOpen] = useState(false);
  const on = e => { e.preventDefault(); setOpen(true); };
  const off = () => setOpen(false);
  return (
    <div className="px-peek select-none" data-testid={testId}
      onPointerDown={on} onPointerUp={off} onPointerLeave={off} onPointerCancel={off} onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') setOpen(true); }} onKeyUp={off} tabIndex={0} role="button" aria-pressed={open}>
      {open ? children : (
        <div className="px-peek-cover">
          <div className="flex gap-3" aria-hidden><span className="px-cardback" /><span className="px-cardback" /></div>
          <div className="fs-18">{label}</div>
          <div className="fs-12 c-dim">松手就会盖上，旁边的人看不到</div>
        </div>
      )}
    </div>
  );
}

/** One line that says what you are right now (the tricky part of 双身份). */
function StatusLine({ g, myId }) {
  const h = g.hands[myId];
  const d = g.dead[myId];
  if (d >= 2) return <span className="px-tag">你已出局</span>;
  const now = h.cards[d];
  const camp = isWolfCamp(g, myId);
  return (
    <span className="flex flex-wrap items-center justify-center gap-2">
      <span className={`px-tag solid ${camp ? 'evil' : 'good'}`}>{isJgl(g, myId) ? `金刚狼${g.jglUsed ? '（技能已用）' : ''}` : camp ? '狼人阵营' : '好人阵营'}</span>
      <span>当前身份：<b>{ROLES[now].zh}</b></span>
    </span>
  );
}

/** After the first life: explain what the second card means for you. */
function switchNote(g, id) {
  const h = g.hands[id];
  if (g.dead[id] !== 1) return null;
  const now = h.cards[1];
  const camp = isWolfCamp(g, id);
  const wakes = g.rules?.wake === 'all' ? camp : now === 'wolf';
  const seen = g.rules?.seer === 'camp' ? (camp ? '狼人' : '好人') : (now === 'wolf' ? '狼人' : '好人');
  return `你仍是${camp ? '狼人' : '好人'}阵营。现在是${ROLES[now].zh}：晚上${wakes ? '和狼队友一起睁眼' : '不再跟狼睁眼'}${ROLES[now].god ? `，${ROLES[now].zh}技能照常可用` : ''}；预言家现在验你是${seen}。`;
}

function MyHand({ g, myId }) {
  const h = g.hands[myId];
  const d = g.dead[myId];
  const checks = g.seerLog.filter(l => l.from === myId);
  return (
    <div className="px-frame pad tight" data-testid="my-hand">
      <div className="px-title">我的两张牌</div>
      <Peek testId="hand-peek">
        <div className="flex justify-center gap-4">
          {h.cards.map((c, i) => (
            <RoleCard key={i} role={c} size={2.5} label={i === 0 ? '第一条命' : '第二条命'} state={i < d ? 'dead' : i === d ? 'now' : 'wait'} />
          ))}
        </div>
        <div className="fs-12 mt-3 text-center"><StatusLine g={g} myId={myId} /></div>
        {switchNote(g, myId) && <p className="fs-12 mt-2 text-center">{switchNote(g, myId)}</p>}
        {checks.length > 0 && (
          <div className="fs-12 mt-2 text-center" data-testid="seer-history">
            我的查验：{checks.map(l => <span key={l.night} className="mr-2 whitespace-nowrap">第{l.night}夜 <Who id={l.to} /> {l.wolf ? '狼人' : '好人'}</span>)}
          </div>
        )}
        <BabyMates g={g} myId={myId} />
      </Peek>
    </div>
  );
}

/** 金宝宝 variant: players holding two villager cards know each other from the start. */
function BabyMates({ g, myId }) {
  if (g.rules?.win !== 'baby' || !isBaby(g, myId)) return null;
  const mates = babies(g).filter(id => id !== myId);
  return (
    <p className="fs-12 mt-2 text-center" data-testid="baby-mates">
      <span className="px-tag solid gold">金宝宝（双民）</span>{' '}
      {mates.length ? <>其他金宝宝：<WhoList ids={mates} tone="good" /></> : '场上只有你一个金宝宝。'}
      {' '}金宝宝全部出局狼人就赢。
    </p>
  );
}

// ------------------------------------------------------------ panel ---
/** Every night screen shares this shape (title, one line, one button) so a glance reveals nothing. */
function NightPanel({ title, children, button }) {
  return (
    <div className="px-nightbox flex flex-col" data-testid="night-panel">
      <Title>{title}</Title>
      <div className="flex-1 fs-12 mb-3">{children}</div>
      {button}
    </div>
  );
}
const NightBtn = ({ tone = 'dark', children, ...p }) => <button className={`px-btn ${tone} lg block`} {...p}>{children}</button>;

function ActionPanel({ g, myId, mine, isHost, act, update, busy, target, setTarget, mode, setMode, confirm, task }) {
  const [double, setDouble] = useState(false);
  const alive = isAlive(g, myId);
  const h = g.hands[myId];
  const now = useNow(g.step === 'day' || g.step === 'dusk');

  switch (g.step) {
    case 'arrange': {
      const hasWolf = h.cards.includes('wolf');
      return <>
        <Title>排好你的两张牌</Title>
        <div data-testid="arrange-cards">
          <div className="flex justify-center gap-4 mb-3">
            <RoleCard role={h.cards[0]} label="上 · 先用" state="now" />
            <RoleCard role={h.cards[1]} label="下 · 第二条命" state="wait" />
          </div>
          <p className="fs-12 mb-1 text-center">
            <span className={`px-tag solid ${hasWolf ? 'evil' : 'good'}`}>{hasWolf ? (isJgl(g, myId) ? '金刚狼' : '狼人阵营') : '好人阵营'}</span>{' '}
            {hasWolf
              ? (isJgl(g, myId) ? JGL_BLURB : g.rules?.wake === 'all' ? '本局狼牌在下面也能睁眼刀人，可以把另一张放上面伪装。' : '狼牌放上面才能晚上刀人；放下面可以先装好人。')
              : '有技能的牌放上面就能先用技能。'}
          </p>
          <BabyMates g={g} myId={myId} />
        </div>
        {h.locked ? (
          <div className="text-center c-dim mt-3">已锁定，等其他人排好…</div>
        ) : (
          <div className="grid grid-cols-2 mt-3">
            <button className="px-btn dark lg" disabled={busy} onClick={() => act(x => swapCards(x, myId))} data-testid="swap">⇅ 交换上下</button>
            <button className="px-btn gold lg" disabled={busy} onClick={() => act(x => lockCards(x, myId))} data-testid="lock">锁定顺序</button>
          </div>
        )}
      </>;
    }

    case 'night': case 'witch': {
      if (!alive) return <NightPanel title="你已出局">安静观战，不要出声。</NightPanel>;
      if (task === 'guard') return (
        <NightPanel title="守卫请睁眼" button={<NightBtn tone="blue" disabled={busy || !target} onClick={() => act(x => guardAct(x, myId, target))} data-testid="guard-act">{target ? <>守护 <Who id={target} /></> : '先在圆桌上点人'}</NightBtn>}>
          选一个人今晚不被狼刀（可以守自己）。{g.guardLast && <>昨晚守了 <Who id={g.guardLast} />，今晚不能再守。</>}
        </NightPanel>
      );
      if (task === 'seer') return (
        <NightPanel title="预言家请睁眼" button={<NightBtn tone="gold" disabled={busy || !target} onClick={() => act(x => seerAct(x, myId, target))} data-testid="seer-act">{target ? <>查验 <Who id={target} /></> : '先在圆桌上点人'}</NightBtn>}>
          {g.rules?.seer === 'camp' ? '查验他的阵营（手里还有狼牌就是狼人）。' : '查验他当前那张牌，下面那张看不到。'}
        </NightPanel>
      );
      if (g.step === 'night' && (task === 'wolf' || (isNightWolf(g, myId) && myId in g.acts.wolves))) {
        const mates = activeWolves(g).filter(id => id !== myId);
        const myPick = g.acts.wolves[myId];
        return (
          <NightPanel title="狼人请睁眼" button={myPick
            ? <NightBtn tone="red" disabled>已选 <Who id={myPick} />{g.acts.double === myId ? '（一刀两命）' : ''} · 等队友</NightBtn>
            : <NightBtn tone="red" disabled={busy || !target} onClick={() => act(x => wolfAct(x, myId, target, { double: double && canDouble(x, myId) }))} data-testid="wolf-kill">{target ? <>{double ? '一刀两命 ' : '刀 '}<Who id={target} /></> : '先在圆桌上点人'}</NightBtn>}>
            <div className="mb-1">狼队友：{mates.length ? <WhoList ids={mates} /> : <>只有你{g.seats.some(id => id !== myId && isWolfCamp(g, id)) ? '（其他狼牌还压在下面）' : ''}</>}</div>
            {g.acts.double && g.acts.double !== myId && <div className="mb-1">金刚狼 <Who id={g.acts.double} /> 要对 <Who id={g.acts.wolves[g.acts.double]} /> 用一刀两命。</div>}
            {canDouble(g, myId) && !myPick && (
              <label className="flex items-center gap-2 mb-1" data-testid="jgl-toggle">
                <input type="checkbox" checked={double} onChange={e => setDouble(e.target.checked)} className="px-check evil" />
                <span>金刚狼一刀两命（整局一次，守卫和解药挡不住）</span>
              </label>
            )}
            <div className="c-dim">意见不同按多数，平票以座位靠前的狼为准。</div>
          </NightPanel>
        );
      }
      if (g.step === 'witch' && mine === 'witch' && !g.acts.witchDone) {
        const kill = g.acts.kill;
        const canSave = g.potions.save && kill && !g.acts.doubleKill && (kill !== myId || canSelfSave(g));
        if (mode === 'poison') return (
          <NightPanel title="女巫 · 毒药" button={
            <div className="grid grid-cols-2">
              <button className="px-btn dark lg" onClick={() => { setMode(null); setTarget(null); }}>返回</button>
              <NightBtn tone="red" disabled={busy || !target} onClick={() => act(x => witchAct(x, myId, { poison: target }))} data-testid="witch-poison-go">{target ? <>毒 <Who id={target} /></> : '选人'}</NightBtn>
            </div>}>
            在圆桌上点要毒的人。被毒的猎人不能开枪。
          </NightPanel>
        );
        return (
          <NightPanel title="女巫请睁眼" button={<>
            <div className="grid grid-cols-2">
              <button className="px-btn blue lg" disabled={busy || !canSave} onClick={() => act(x => witchAct(x, myId, { save: true }))} data-testid="witch-save">{g.potions.save ? '救他' : '解药已用'}</button>
              <button className="px-btn red lg" disabled={busy || !g.potions.poison} onClick={() => setMode('poison')} data-testid="witch-poison">{g.potions.poison ? '用毒药…' : '毒药已用'}</button>
            </div>
            <button className="px-btn dark block mt-2" disabled={busy} onClick={() => act(x => witchAct(x, myId, {}))} data-testid="witch-skip">今晚不用药</button>
          </>}>
            {kill ? <>今晚 <Who id={kill} /> 被{g.acts.doubleKill ? '金刚狼一刀砍两条命，解药救不了' : '狼刀了'}。</> : '今晚狼人没有刀人。'}
            {kill === myId && g.potions.save && !canSelfSave(g) && <> {g.rules?.selfSave === 'first' ? '女巫只有第一晚能自救。' : '女巫不能自救。'}</>}
          </NightPanel>
        );
      }
      // everyone else: same-looking screen with a private, meaningless pick
      const doneLine = mine === 'guard' && g.acts.guard ? <>今晚守护 <Who id={g.acts.guard} />。</>
        : mine === 'seer' && g.acts.seer ? (() => { const l = g.seerLog.find(x => x.night === g.night && x.from === myId); return l && <><Who id={l.to} /> {g.rules?.seer === 'camp' ? '是' : '当前是'}{l.wolf ? '狼人' : '好人'}。</>; })()
        : mine === 'witch' && g.acts.witchDone && g.step === 'witch' ? '你已经用完今晚的药。'
        : isNightWolf(g, myId) && g.acts.wolves[myId] ? <>狼队已出刀。</> : null;
      return (
        <NightPanel title="天黑请闭眼">
          {doneLine && <div className="mb-1">{doneLine}</div>}
          等有行动的人操作完就天亮，请不要偷看别人的手机。
        </NightPanel>
      );
    }

    case 'confirm': {
      const c = g.confirm;
      if (!c.ids.includes(myId) || myId in c.acked) {
        return <NightPanel title="请稍候">失去命的人正在手机上确认，马上天亮。</NightPanel>;
      }
      const isHunter = c.hunter === myId;
      const mineLost = c.lost.filter(l => l.id === myId);
      return (
        <NightPanel title="你失去了一条命" button={isHunter
          ? <div className="grid grid-cols-2">
              <button className="px-btn dark lg" disabled={busy} onClick={() => act(x => ackLoss(x, myId))} data-testid="hunter-skip">不开枪</button>
              <button className="px-btn red lg" disabled={busy || !target} data-testid="hunter-shoot"
                onClick={async () => { if (await confirm({ title: '开枪', body: <>带走 <Who id={target} size="lg" /> 的一条命？</>, ok: '开枪', tone: 'danger' })) act(x => ackLoss(x, myId, { shoot: target })); }}>
                {target ? <>开枪 <Who id={target} /></> : '点人开枪'}
              </button>
            </div>
          : <NightBtn disabled={busy} onClick={() => act(x => ackLoss(x, myId))} data-testid="ack-loss">知道了</NightBtn>}>
          <div className="mb-1">失去的是：{mineLost.map((l, i) => <b key={i} className="mr-1">{ROLES[l.card]?.zh}</b>)}{!isAlive(g, myId) && '，你出局了。'}</div>
          {isHunter && <div className="mb-1">你的猎人牌出局了，可以在圆桌上点一个人开枪，也可以不开。别人看不出你有没有枪。</div>}
          {switchNote(g, myId) && <div>{switchNote(g, myId)}</div>}
        </NightPanel>
      );
    }

    case 'day': {
      const sp = g.speak;
      const spk = speakerNow(g);
      const seatNo = id => g.seats.indexOf(id) + 1;
      const allDone = sp && sp.at >= sp.order.length;
      const secs = sp ? Math.max(0, Math.floor((now - (sp.since || now)) / 1000)) : 0;
      const lost = groupLost(g.lastNight?.lost || []);
      return <>
        <Title>{sp?.pk ? `第 ${g.day} 天 · 平票 PK` : `第 ${g.day} 天 · 天亮了`}</Title>
        {/* the action first, so it's on screen without scrolling; details below */}
        {spk === myId ? (
          <>
            <div className="text-center mb-1">轮到你{(sp.lastWords || []).includes(myId) ? '留遗言' : '发言'} · {fmt(secs)}</div>
            <button className="px-btn gold lg block mb-2" disabled={busy} onClick={() => act(x => nextSpeaker(x, myId))} data-testid="speak-done">我说完了</button>
          </>
        ) : spk ? (
          <div className={`text-center mb-2 ${secs > SPEAK_HINT_S ? 'c-evil' : ''}`}>正在发言：<Who id={spk} /> · {fmt(secs)}{secs > SPEAK_HINT_S ? '（超过 90 秒）' : ''}</div>
        ) : allDone && <div className="text-center mb-2">所有人都说完了</div>}
        {isHost && (
          <div className="grid grid-cols-2 mb-2">
            <button className="px-btn dark" disabled={busy || !spk} onClick={() => act(x => nextSpeaker(x, myId, true))} data-testid="speak-skip">下一位</button>
            <button className={`px-btn ${allDone ? 'gold' : 'dark'}`} disabled={busy} onClick={() => act(startVote)} data-testid="start-vote">{sp?.pk ? '开始 PK 投票' : '开始投票'}</button>
          </div>
        )}
        {sp && (
          <div className="flex flex-wrap items-center gap-x-1 gap-y-2 mb-2" data-testid="speak-order">
            {sp.order.map((id, i) => (
              <span key={id} className={`inline-flex items-center ${i < sp.at ? 'opacity-40' : ''}`}>
                <Who id={id} tone={i === sp.at ? 'gold' : undefined} />{(sp.lastWords || []).includes(id) && <span className="fs-12 ml-1">遗言</span>}
                {i < sp.order.length - 1 && <span className="c-dim mx-1">›</span>}
              </span>
            ))}
          </div>
        )}
        {sp?.pk
          ? <div className="fs-12 mb-1">平票的 <WhoList ids={sp.order} /> 再各说一轮，然后其他人在他们之中再投一次。</div>
          : <div className="fs-12 mb-1">{lost.length
            ? <>昨晚 {lost.map(l => <span key={l.id} className="mr-1"><Who id={l.id} />{l.cards.map((c, i) => <CardTag key={i} card={c} />)} {l.n > 1 ? '失去两条命' : '失去一条命'}</span>)}。</>
            : '昨晚是平安夜，没有人失去生命。'}</div>}
        {sp && !sp.pk && (
          <p className="fs-12 c-dim" data-testid="speak-rule">
            {sp.lastWords?.length ? <>首夜出局的 <WhoList ids={sp.lastWords} /> 先留遗言。</> : null}
            {sp.after
              ? <>从 <Who id={sp.after} /> 的{sp.dir === 'up' ? '下一位' : '上一位'}开始（方向随机），号码{sp.dir === 'up' ? '从小到大' : '从大到小'}轮流发言。</>
              : <>平安夜，随机从 {seatNo(sp.order[0])} 号开始，号码{sp.dir === 'up' ? '从小到大' : '从大到小'}轮流发言。</>}
          </p>
        )}
        {!isHost && <div className="text-center c-dim fs-12 mt-2">发言结束后由房主开启投票</div>}
      </>;
    }

    case 'vote': {
      if (!alive) return <><Title>放逐投票</Title><p>你已出局，不能投票。</p></>;
      if (isMuted(g, myId)) return <><Title>放逐投票</Title><p>你昨晚失去了第一条命，今天不能投票（明天恢复）。</p></>;
      if ((g.pk || []).includes(myId)) return <><Title>PK 投票</Title><p>你在 PK 台上，这一轮不投票。</p></>;
      const my = g.votes[myId];
      return <>
        <Title>{g.pk ? 'PK 投票' : `放逐投票 · 第 ${g.day} 天`}</Title>
        <p className="fs-12 mb-3">{g.pk ? <>只能投 <WhoList ids={g.pk} />。再平票就无人出局。</> : '在圆桌上点你要投的人。最高票失去一条命，平票'}{!g.pk && (g.rules?.pk === 'yes' ? '进入 PK。' : '无人出局。')}所有人投完前可以改票。</p>
        {myId in g.votes && <p className="mb-3">你投了 {my ? <Who id={my} /> : '弃票'}。</p>}
        <div className="grid grid-cols-2">
          <button className="px-btn dark lg" disabled={busy || (myId in g.votes && my === null)} onClick={() => act(x => castVote(x, myId, null))} data-testid="vote-skip">弃票</button>
          <button className="px-btn gold lg" disabled={busy || !target || my === target} onClick={() => act(x => castVote(x, myId, target))} data-testid="vote-go">
            {target ? <>投 <Who id={target} /></> : '选人'}
          </button>
        </div>
      </>;
    }

    case 'dusk': {
      const d = g.dusk;
      const spk = speakerNow(g);
      const last = [...g.log].reverse().find(e => e.type === 'vote');
      const secs = Math.max(0, Math.floor((now - (d.since || now)) / 1000));
      return <>
        <Title>第 {g.day} 天 · 黄昏</Title>
        <p className="mb-2">{last?.out ? <><Who id={last.out} /> 被投出一条命{!isAlive(g, last.out) ? '，出局了' : ''}。</> : last?.tie ? '平票，无人出局。' : '无人出局。'}</p>
        {d.order.length > 0 && (
          <p className="mb-3" data-testid="last-words">
            {spk ? <>请 <Who id={spk} tone="gold" /> 留遗言 · {fmt(secs)}</> : '遗言结束。'}
          </p>
        )}
        {spk === myId && <button className="px-btn gold lg block mb-2" disabled={busy} onClick={() => act(x => nextSpeaker(x, myId))} data-testid="last-words-done">遗言说完了</button>}
        {isHost
          ? <button className={`px-btn ${spk ? 'dark' : 'gold'} lg block`} disabled={busy} onClick={() => act(x => nightfall(x, myId, true))} data-testid="nightfall">天黑请闭眼</button>
          : <div className="text-center c-dim fs-12">等房主宣布天黑</div>}
      </>;
    }

    case 'end': return <EndPanel g={g} isHost={isHost} update={update} busy={busy} confirm={confirm} />;
    default: return null;
  }
}

const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function EndPanel({ g, isHost, update, busy, confirm }) {
  const s = score(g);
  const again = async () => {
    if (!await confirm({ title: '再来一局？', body: '同一批人、同样的座位重新发牌。', ok: '开新一局' })) return;
    update(r => { r.game = newGame(r.players, { ...effectiveConfig(r.players.length, r.config), timeScale: r.game?.timeScale }); r.round += 1; return r; });
  };
  const lobby = () => update(r => { r.phase = 'lobby'; r.game = null; return r; });
  return <>
    <Title>{g.winner === 'good' ? '好人胜利' : '狼人胜利'}</Title>
    <p className="mb-1">{g.reason}</p>
    <p className="fs-12 mb-3">剩余 狼牌 {s.wolves} · {g.rules?.win === 'baby' ? `金宝宝 ${s.babies} 人` : `村民 ${s.villagers}`} · 神 {s.gods}</p>
    <div className="flex flex-col gap-2 mb-4" data-testid="reveal-all">
      {g.seats.map(id => (
        <div key={id} className="flex items-center gap-2 flex-wrap">
          <Who id={id} tone={isWolfCamp(g, id) ? 'evil' : 'good'} />
          {g.hands[id].cards.map((c, i) => (
            <span key={i} className={`px-tag ${ROLES[c].team === 'wolf' ? 'evil' : ROLES[c].god ? 'gold' : 'good'} ${i < g.dead[id] ? 'lost' : ''}`}>{ROLES[c].zh}{i < g.dead[id] ? ' ✕' : ''}</span>
          ))}
        </div>
      ))}
    </div>
    <NightTimeline g={g} />
    {isHost ? (
      <div className="grid grid-cols-2">
        <button className="px-btn dark" disabled={busy} onClick={lobby} data-testid="to-lobby">回大厅</button>
        <button className="px-btn gold" disabled={busy} onClick={again} data-testid="play-again">再来一局</button>
      </div>
    ) : <div className="text-center c-dim fs-12">等待房主开新一局…</div>}
  </>;
}

/** 复盘: what really happened each night. */
function NightTimeline({ g }) {
  const hs = g.history || [];
  if (!hs.length) return null;
  return (
    <div className="mb-4" data-testid="timeline">
      <div className="px-title">夜晚复盘</div>
      <div className="flex flex-col gap-2 fs-12">
        {hs.map(h => (
          <div key={h.night}>
            <b>第 {h.night} 夜：</b>
            {h.guard && <>守卫守 <Who id={h.guard} />；</>}
            {h.seer && <>预言家 <Who id={h.seer.from} /> 验 <Who id={h.seer.to} />（{h.seer.wolf ? '狼' : '好'}）；</>}
            {h.kill ? <>狼{h.double ? '（金刚狼一刀两命）' : ''}刀 <Who id={h.kill} />；</> : '狼没有刀人；'}
            {h.save && <>女巫救了 <Who id={h.save} />；</>}
            {h.poison && <>女巫毒了 <Who id={h.poison} />；</>}
            {h.forced && '（房主强制天亮）'}
          </div>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- log ---
function PublicLog({ g }) {
  const items = [...g.log].reverse();
  if (!items.length) return null;
  return (
    <div className="px-frame pad tight">
      <Title>记录</Title>
      <div className="flex flex-col gap-3 px-scroll fs-12" data-testid="log">
        {items.map((e, i) => {
          if (e.type === 'night') return <div key={i}><span className="c-dim">第 {e.night} 夜：</span>{e.lost.length ? groupLost(e.lost).map(l => <span key={l.id} className="mr-1"><Who id={l.id} />{l.cards.map((c, j) => <CardTag key={j} card={c} />)} {l.n > 1 ? '失去两条命' : '失去一条命'}</span>) : '平安夜'}</div>;
          if (e.type === 'shot') return <div key={i}><span className="c-dim">第 {e.day} 天：</span>{e.from ? <>猎人 <Who id={e.from} /> </> : '有人开枪，'}{e.to ? <>带走了 <Who id={e.to} />{e.card && <CardTag card={e.card} />} 一条命</> : '没有开枪'}</div>;
          if (e.type === 'vote') {
            const by = {};
            Object.entries(e.votes).forEach(([v, t]) => { (by[t || '-'] ||= []).push(v); });
            const rows = Object.entries(by).sort((a, b) => (a[0] === '-') - (b[0] === '-') || b[1].length - a[1].length);
            return (
              <div key={i}>
                <div><span className="c-dim">第 {e.day} 天{e.pk ? ' PK' : ''}投票：</span>{e.out ? <><Who id={e.out} tone="evil" />{e.card && <CardTag card={e.card} />} 被投出一条命</> : e.tie ? '平票，无人出局' : '全员弃票'}</div>
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
  const show = (g.step === 'day' && !g.speak?.pk) || g.step === 'confirm';
  const key = show && g.lastNight && g.lastNight.night === g.day ? `ww:dawn:${roomKey}:${g.lastNight.night}` : null;
  const [isDone, done] = useDismissed(key);
  useEffect(() => {
    if (!key || isDone) return undefined;
    const t = setTimeout(done, 6000);
    return () => clearTimeout(t);
  }, [key, isDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!key || isDone) return null;
  const lost = groupLost(g.lastNight.lost);
  return (
    <div className="px-overlay px-dawn" onClick={done} data-testid="dawn-reveal">
      <div className="px-frame gold pad flex flex-col items-center gap-4 text-center max-w-[480px] w-full px-pop" onClick={e => e.stopPropagation()}>
        <PixelSprite name="sun" scale={4} className="px-rise" />
        <div className="fs-12 c-dim tracking-[0.2em]">第 {g.lastNight.night} 夜过去了</div>
        <div className="fs-36 c-gold shadow-px">天亮了</div>
        {lost.length ? (
          <div className="flex flex-col items-center gap-2">
            {lost.map((l, i) => (
              <div key={l.id} className="px-stamp flex items-center gap-2 flex-wrap justify-center" style={{ animationDelay: `${0.5 + i * 0.4}s` }}>
                <Who id={l.id} size="lg" /><span className="fs-18 c-evil">{l.n > 1 ? '失去两条命' : '失去一条命'}</span>
                {l.cards.map((c, j) => <CardTag key={j} card={c} />)}
                <span className="fs-12 c-dim">{lives(g, l.id) ? `（剩 ${lives(g, l.id)} 条）` : '（出局）'}</span>
              </div>
            ))}
            {g.lastNight.lost.length > lost.length && <div className="fs-12 c-evil">金刚狼一刀两命</div>}
          </div>
        ) : <div className="fs-24 c-good px-stamp" style={{ animationDelay: '0.5s' }}>平安夜{g.rules?.peace === 'three' ? ` ${g.peaceStreak}/3` : ''}</div>}
        <button className="px-btn gold" onClick={done} data-testid="close-dawn">继续</button>
      </div>
    </div>
  );
}

function VoteReveal({ g, roomKey }) {
  const votes = g.log.filter(e => e.type === 'vote');
  const e = votes[votes.length - 1];
  const fresh = e && e.day === g.day && g.step !== 'vote' && !isNight(g.step);
  const key = fresh ? `ww:vote:${roomKey}:${e.day}:${votes.length}` : null;
  const [isDone, done] = useDismissed(key);
  const vs = e ? g.seats.filter(id => id in e.votes) : [];
  useEffect(() => {
    if (!key || isDone) return undefined;
    const t = setTimeout(done, 1200 + vs.length * 220 + 2000);
    return () => clearTimeout(t);
  }, [key, isDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!key || isDone) return null;
  const after = { animationDelay: `${0.3 + vs.length * 0.22}s` };
  return (
    <div className="px-overlay" onClick={done} data-testid="vote-reveal">
      <div className="px-frame gold pad flex flex-col items-center gap-4 text-center max-w-[600px] w-full" onClick={ev => ev.stopPropagation()}>
        <div className="fs-12 c-dim tracking-[0.2em]">第 {e.day} 天 · {e.pk ? 'PK 投票' : '放逐投票'}</div>
        <div className="flex flex-col gap-2 items-start">
          {vs.map((id, i) => (
            <div key={id} className="flex items-center gap-1 px-stamp" style={{ animationDelay: `${0.3 + i * 0.22}s` }}>
              <Who id={id} /><span className="c-dim">→</span>{e.votes[id] ? <Who id={e.votes[id]} /> : <span className="c-mute">弃票</span>}
            </div>
          ))}
        </div>
        <div className="px-pop" style={after}>
          {e.out
            ? <div className="flex items-center gap-2 justify-center"><Who id={e.out} size="lg" tone="evil" /><span className="fs-24 c-evil shadow-px">失去一条命</span>{e.card && <CardTag card={e.card} />}</div>
            : <div className="fs-24 c-gold shadow-px">{e.tie ? (g.step === 'day' && g.speak?.pk ? '平票，进入 PK' : '平票，无人出局') : '无人出局'}</div>}
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
          <div className={`fs-36 shadow-px ${last.wolf ? 'c-evil' : 'c-good'}`}>{g.rules?.seer === 'camp' ? '' : '当前是'}{last.wolf ? '狼人' : '好人'}</div>
        </div>
        <div className="fs-12 c-dim">{g.rules?.seer === 'camp' ? '验的是阵营' : '提醒：他下面那张牌可能不一样'}</div>
        <button className="px-btn gold" onClick={done} data-testid="close-seer">知道了</button>
      </div>
    </div>
  );
}

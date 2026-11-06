import { useEffect, useMemo, useState } from 'react';
import PixelSprite from '../pixel/PixelSprite';
import RoundTable from '../avalon/RoundTable';
import { Who, WhoList, useConfirm, Confetti } from '../avalon/ui';
import {
  ROLES, nightTask, nightAct, nightInfo, settleNight, forceNight, forceAfterMs, pendingNight, addTalk, startVote, castVote, closeVote, canVoteFor,
  finalCard, isWinner, nightStory, changedRules, newGame, timeline,
} from './onenightRules';
import { CenterCards, Timeline, narratorLine, InfoLines, Peek, RoleFace, RoleTag, taskText, useNow, teamCls } from './ui';

const Title = ({ children }) => <div className="px-title">{children}</div>;
const WIN = {
  village: { zh: '好人胜利', cls: 'c-good', confetti: ['#4f7df0', '#8fb0ff', '#f5c542', '#fff6dc'] },
  wolf: { zh: '狼人胜利', cls: 'c-evil', confetti: ['#e04848', '#ff8a80', '#8b52d6', '#170f22'] },
  loner: { zh: '厌世者胜利', cls: 'c-loner', confetti: ['#9b86e0', '#c9b8ff', '#757087', '#fff6dc'] },
};
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

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
  const inGame = g.seats.includes(myId);
  const now = useNow(g.step === 'night' || g.step === 'day', 500);
  const act = fn => update(r => { fn(r.game); return r; });
  const roomKey = `${room.code}:${room.round}`;
  const acted = myId in g.acts;
  const task = inGame ? nightTask(g, myId) : null;

  // night picks (private, only on this phone)
  const [sel, setSel] = useState({ players: [], center: [] });
  const [target, setTarget] = useState(null);
  useEffect(() => { setSel({ players: [], center: [] }); setTarget(null); }, [g.step, room.round]);
  useWakeLock(g.step !== 'end');

  // the host's phone brings dawn once it's due (clock-driven, so night length leaks nothing)
  useEffect(() => {
    if (!isHost || g.step !== 'night' || g.settleAt == null) return undefined;
    const t = setTimeout(() => act(x => settleNight(x)), Math.max(0, g.settleAt - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [isHost, g.step, g.settleAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // …and opens the vote when the discussion clock runs out
  useEffect(() => {
    if (!isHost || g.step !== 'day') return undefined;
    const t = setTimeout(() => act(x => { if (x.step === 'day' && Date.now() >= x.talkEnd - 200) startVote(x); }), Math.max(0, g.talkEnd - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [isHost, g.step, g.talkEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxP = task ? (task.kind === 'dummy' ? 1 : task.players || task.alt?.players || 0) : 0;
  const maxC = task ? (task.kind === 'dummy' ? 1 : task.center || task.alt?.center || 0) : 0;
  const picking = g.step === 'night' && inGame && !acted;
  const tapSeat = id => {
    if (g.step === 'vote') { setTarget(id); return; }
    if (!picking || !maxP || (task.others && id === myId)) return;
    setSel(s => {
      if (s.players.includes(id)) return { ...s, players: s.players.filter(x => x !== id) };
      const solo = task.kind === 'dummy' || task.alt;
      return { players: [...s.players, id].slice(-maxP), center: solo ? [] : s.center };
    });
  };
  const tapCenter = i => {
    if (!picking || !maxC) return;
    setSel(s => {
      if (s.center.includes(i)) return { ...s, center: s.center.filter(x => x !== i) };
      const solo = task.kind === 'dummy' || task.alt;
      return { players: solo ? [] : s.players, center: [...s.center, i].slice(-maxC) };
    });
  };
  const seatClickable = id => (picking && maxP > 0 && !(task.others && id === myId))
    || (g.step === 'vote' && inGame && canVoteFor(g, myId, id));

  const ended = g.step === 'end';
  const res = g.result;
  const decorate = id => {
    let badge = null;
    if (g.step === 'vote') badge = id in g.votes ? <span key="v1" className="px-tag ok px-stamp">已投</span> : <span key="v0" className="px-tag">…</span>;
    if (ended && res.out.includes(id)) badge = <span className="px-tag evil px-stamp">出局</span>;
    const picked = g.step === 'vote' ? target === id : sel.players.includes(id);
    return {
      top: ended && isWinner(g, id) ? <PixelSprite name="crown" scale={2} title="赢家" /> : null,
      badge,
      cls: [picked && 'target', ended && res.out.includes(id) && 'out'].filter(Boolean).join(' '),
      role: ended ? ROLES[finalCard(g, id)].sprite : null,
      clickable: seatClickable(id),
    };
  };

  const center = (() => {
    switch (g.step) {
      case 'night': return <>
        <div className="fs-12 c-dim" data-testid="narrator">{narratorLine(g, now)}</div>
        <CenterCards sel={picking ? sel.center : []} onPick={picking && maxC ? tapCenter : null} />
      </>;
      case 'day': return <><div className="fs-24 c-gold shadow-px">天亮了</div><div className="fs-12">讨论 · {fmt(g.talkEnd - now)}</div><CenterCards /></>;
      case 'vote': return <><div className="fs-24 c-gold shadow-px">投票</div><div className="fs-12">{Object.keys(g.votes).length}/{g.seats.length} 已投</div></>;
      case 'end': return <>{res.winners.length ? res.winners.map(w => <div key={w} className={`fs-24 shadow-px ${WIN[w].cls}`}>{WIN[w].zh}</div>) : <div className="fs-24 c-dim shadow-px">没有赢家</div>}<CenterCards faces={g.final.center} /></>;
      default: return null;
    }
  })();

  const night = g.step === 'night';
  return (
    <div className={`grid gap-3 sm:gap-6 lg:grid-cols-[1.3fr_1fr] items-start ${night ? 'px-is-night' : ''}`}>
      {night && <div className="px-night" aria-hidden />}
      <div className="px-frame pad tight relative z-[1] min-w-0">
        <div className="flex items-center justify-between fs-12 c-dim">
          <span>{night ? '夜晚' : g.step === 'day' ? '白天 · 讨论' : g.step === 'vote' ? '白天 · 投票' : '结束'}</span>
          <span>第 {room.round} 局</span>
        </div>
        <RoundTable compact seats={seats} myId={myId} decorate={decorate} onSeatClick={tapSeat}
          center={<div key={g.step} className="px-pop flex flex-col items-center gap-[4px]">{center}</div>} />
      </div>

      <div className="flex flex-col gap-3 sm:gap-6 relative z-[1] min-w-0">
        <div className={`px-frame pad tight ${night ? 'px-nightpanel' : 'parch'}`} data-testid="action-panel">
          <div key={`${g.step}-${acted}`} className="px-slide">
            {!inGame ? <p className="c-dim">你是观众，这局没有你的牌。</p>
              : night ? <NightPanel {...{ g, myId, task, sel, acted, now, busy, act }} />
                : g.step === 'day' ? <DayPanel {...{ g, isHost, now, act, busy }} />
                  : g.step === 'vote' ? <VotePanel {...{ g, myId, isHost, target, act, busy, confirm }} />
                    : <EndPanel {...{ g, myId, isHost, update, busy, confirm }} />}
          </div>
        </div>
        {night && (
          <div className="px-frame pad tight">
            <Title>夜晚时间线</Title>
            <Timeline g={g} now={now} />
            <div className="fs-12 c-dim mt-2">所有手机同时操作；牌组里的角色都会被念到（包括可能在公共牌里的），所以看不出谁在操作。</div>
          </div>
        )}
        {isHost && night && <ForceDawn g={g} now={now} act={act} busy={busy} />}
        {inGame && (g.step === 'day' || g.step === 'vote') && <MyNight g={g} myId={myId} />}
        {changedRules(g.rules).length > 0 && (
          <div className="px-frame pad tight" data-testid="house-rules">
            <Title>本局规则变体</Title>
            <div className="flex flex-wrap gap-2 fs-12">{changedRules(g.rules).map(r => <span key={r.key} className="px-tag gold">{r.zh}：{r.val}</span>)}</div>
          </div>
        )}
      </div>

      <VoteReveal g={g} roomKey={roomKey} />
      {ended && res.winners.length > 0 && <Confetti colors={WIN[res.winners[0]].confetti} />}
    </div>
  );
}

/** Host only, once the night has dragged on (a phone fell asleep). */
function ForceDawn({ g, now, act, busy }) {
  if (now - g.nightStart < forceAfterMs(g)) return null;
  return (
    <div className="px-frame pad tight fs-12 flex items-center justify-between gap-2" data-testid="force-dawn">
      <span className="c-dim">夜里好像有人卡住了（{pendingNight(g).length} 人没确认）。没确认的人当作什么都没做。</span>
      <button className="px-btn dark sm" disabled={busy} onClick={() => act(x => forceNight(x))}>强制天亮</button>
    </div>
  );
}

// ---------------------------------------------------------------- night ---
/** Every phone shows this same box: identity peek, a generic pick line, one button. */
function NightPanel({ g, myId, task, sel, acted, now, busy, act }) {
  const start = g.start[myId];
  const info = nightInfo(g, myId, now);
  const picks = [...sel.players.map(id => <Who key={id} id={id} />), ...sel.center.map(i => <span key={`c${i}`} className="px-tag night mr-1">公共牌 {i + 1}</span>)];
  const ok = (() => {
    const p = sel.players.length;
    const c = sel.center.length;
    if (task.kind === 'dummy') return p + c === 1;
    return (p === task.players && c === task.center) || (task.alt && p === task.alt.players && c === task.alt.center);
  })();
  if (acted) {
    const tl = timeline(g, now);
    return (
      <div className="on-nightbox" data-testid="night-panel">
        <Title>已确认 · 等天亮</Title>
        <Peek label="按住看今晚的结果" testId="result-peek">
          <RoleFace id={start}><div className="fs-12 c-dim">你发到的牌</div></RoleFace>
          <div className="fs-12 mt-2"><InfoLines info={info} start={start} /></div>
        </Peek>
        <div className="flex-1" />
        <div className="fs-12 c-dim mt-2 text-center">{g.final && tl.cur >= tl.slots.length ? '天快亮了，马上睁眼…' : '时间线走完、所有人都确认后天亮。请不要偷看别人的手机。'}</div>
      </div>
    );
  }
  return (
    <div className="on-nightbox" data-testid="night-panel">
      <Title>夜晚 · 你的行动</Title>
      <Peek label="按住看你的牌和任务" testId="identity-peek">
        <RoleFace id={start}><div className="fs-12">{taskText(task, start)}</div></RoleFace>
        {info.length > 0 && <div className="fs-12 mt-2"><InfoLines info={info} start={start} /></div>}
      </Peek>
      <div className="fs-12 mt-2 mb-1 min-h-[30px] flex flex-wrap items-center gap-1" data-testid="night-pick">
        {picks.length ? <>已选：{picks}</> : <span className="c-dim">在圆桌上点人，或点中间的公共牌</span>}
      </div>
      <div className="flex-1" />
      <button className="px-btn night lg block" disabled={busy || !ok} onClick={() => act(x => nightAct(x, myId, sel))} data-testid="night-act">确认</button>
    </div>
  );
}

// ------------------------------------------------------------------ day ---
function DayPanel({ g, isHost, now, act, busy }) {
  const left = g.talkEnd - now;
  return <>
    <Title>天亮了 · 讨论</Title>
    <div className="flex items-center justify-between gap-3 mb-2">
      <div>
        <div className={`on-timer ${left < 30_000 ? 'low' : ''}`} data-testid="talk-timer">{fmt(left)}</div>
        <div className="fs-12 c-dim mt-1">{left > 0 ? '时间到自动开始投票' : '时间到，马上投票'}</div>
      </div>
      {isHost && <button className="px-btn dark sm" disabled={busy} onClick={() => act(x => addTalk(x))} data-testid="add-talk">+1 分钟</button>}
    </div>
    {isHost
      ? <button className="px-btn gold lg block" disabled={busy} onClick={() => act(startVote)} data-testid="start-vote">结束讨论，开始投票</button>
      : <div className="text-center c-dim fs-12 my-2">时间到或房主结束讨论后开始投票</div>}
    <p className="fs-12 mt-2">说说你昨晚看到了什么（也可以说谎）。别给人看手机。{g.deck.some(r => ['thief', 'meddler', 'drunk'].includes(r)) ? '牌可能被换过：你现在不一定还是发到的那张。' : ''}</p>
  </>;
}

/** Day/vote: recall your own card and what you saw (press and hold). */
function MyNight({ g, myId }) {
  const start = g.start[myId];
  return (
    <div className="px-frame pad tight" data-testid="my-night">
      <Title>我的夜晚</Title>
      <Peek label="按住回看你的牌和夜里看到的" testId="my-peek">
        <RoleFace id={start}><div className="fs-12 c-dim">你发到的牌（现在可能已经被换了）</div></RoleFace>
        <div className="fs-12 mt-2"><InfoLines info={nightInfo(g, myId)} start={start} /></div>
      </Peek>
    </div>
  );
}

function VotePanel({ g, myId, isHost, target, act, busy, confirm }) {
  const my = g.votes[myId];
  const missing = g.seats.filter(id => !(id in g.votes));
  const close = async () => {
    if (await confirm({ title: '现在收票？', body: <>还有 <WhoList ids={missing} /> 没投。没投的人算弃票，马上亮票。</>, ok: '收票', tone: 'danger' })) act(closeVote);
  };
  return <>
    <Title>投票 · 同时亮票</Title>
    <p className="fs-12 mb-2">在圆桌上点你要投的人{g.rules.selfVote === 'yes' ? '（可以投自己）' : ''}。大家投完才一起亮票，之前可以改。</p>
    <p className="mb-2 min-h-[27px]" data-testid="my-vote">{my ? <>你投了 <Who id={my} /></> : <span className="c-dim">你还没投</span>}</p>
    <button className="px-btn gold lg block" disabled={busy || !target || my === target} onClick={() => act(x => castVote(x, myId, target))} data-testid="vote-go">
      {target ? <>{my ? '改投' : '投'} <Who id={target} /></> : '先在圆桌上点人'}
    </button>
    {isHost && missing.length > 0 && missing.length < g.seats.length && (
      <button className="px-btn dark sm block mt-2" disabled={busy} onClick={close} data-testid="close-vote">收票（{missing.length} 人没投）</button>
    )}
  </>;
}

// ------------------------------------------------------------------ end ---
function EndPanel({ g, myId, isHost, update, busy, confirm }) {
  const r = g.result;
  const again = async () => {
    if (!await confirm({ title: '再来一局？', body: '同一批人、同样的牌组重新发牌。', ok: '开新一局' })) return;
    update(x => { x.game = newGame(x.players, { ...x.config, timeScale: x.game?.timeScale }); x.round += 1; return x; });
  };
  const lobby = () => update(x => { x.phase = 'lobby'; x.game = null; return x; });
  const me = g.seats.includes(myId);
  return <>
    <Title>{r.winners.length ? r.winners.map(w => WIN[w].zh).join(' + ') : '没有赢家'}</Title>
    <p className="mb-1" data-testid="end-why">{r.why}。</p>
    {me && <p className="fs-12 mb-3">{isWinner(g, myId) ? <span className="px-tag ok">你赢了</span> : <span className="px-tag">你输了</span>} 你最后手里是 <RoleTag id={finalCard(g, myId)} /></p>}

    <div className="mb-3" data-testid="reveal-all">
      <div className="fs-12 c-dim mb-1">发到的牌 → 最后的牌</div>
      {g.seats.map(id => {
        const a = g.start[id];
        const b = finalCard(g, id);
        return (
          <div key={id} className="on-row">
            <span className="flex items-center flex-wrap gap-1 min-w-0">
              <Who id={id} tone={teamCls(b)} />
              <RoleTag id={a} />{a !== b && <><span className="on-arrow">→</span><RoleTag id={b} /></>}
            </span>
            <span className="fs-12 whitespace-nowrap">{r.out.includes(id) && <span className="px-tag evil mr-1">出局</span>}{r.counts[id] > 0 && `${r.counts[id]} 票`}</span>
          </div>
        );
      })}
      <div className="on-row">
        <span className="flex items-center flex-wrap gap-1">
          <span className="fs-12 mr-1">公共牌</span>
          {[0, 1, 2].map(i => (
            <span key={i} className="inline-flex items-center gap-1 mr-2">
              <span className="fs-12 c-dim">{i + 1}</span><RoleTag id={g.center0[i]} />{g.center0[i] !== g.final.center[i] && <><span className="on-arrow">→</span><RoleTag id={g.final.center[i]} /></>}
            </span>
          ))}
        </span>
        <span />
      </div>
    </div>

    <VoteList g={g} />
    <Story g={g} />
    {isHost ? (
      <div className="grid grid-cols-2">
        <button className="px-btn dark" disabled={busy} onClick={lobby} data-testid="to-lobby">回大厅</button>
        <button className="px-btn gold" disabled={busy} onClick={again} data-testid="play-again">再来一局</button>
      </div>
    ) : <div className="text-center c-dim fs-12">等待房主开新一局…</div>}
  </>;
}

function VoteList({ g }) {
  const r = g.result;
  return (
    <div className="mb-3 fs-12" data-testid="vote-list">
      <div className="px-title">投票</div>
      <div className="flex flex-col gap-1">
        {g.seats.map(id => (
          <div key={id} className="flex flex-wrap items-center gap-1"><Who id={id} /><span className="on-arrow">→</span>{g.votes[id] ? <Who id={g.votes[id]} /> : <span className="c-dim">没投</span>}</div>
        ))}
      </div>
      {r.shots.map(s => <div key={s.from} className="mt-1">猎人 <Who id={s.from} /> 出局，带走了他投的 <Who id={s.to} />。</div>)}
      {r.out.length === 0 && <div className="mt-1">{r.max <= 1 ? '没人超过 1 票，没人出局。' : '平票，没人出局。'}</div>}
    </div>
  );
}

/** 复盘: the whole night in wake order. */
function Story({ g }) {
  const items = nightStory(g);
  const line = it => {
    if (it.inCenter) return <span className="c-dim">没人拿到（在公共牌里）</span>;
    if (it.skipped) return <><Who id={it.id} /> 没有行动（强制天亮）</>;
    switch (it.role) {
      case 'wolf': return <><Who id={it.id} /> {it.mates.length ? <>认识了狼队友 <WhoList ids={it.mates} /></> : '是唯一的狼'}{it.peek?.length ? <>，看了公共牌 {it.peek.map(p => <span key={p.i}>{p.i + 1}：<RoleTag id={p.card} /></span>)}</> : ''}</>;
      case 'minion': return <><Who id={it.id} /> 看到狼人 {it.wolves.length ? <WhoList ids={it.wolves} /> : '（没人）'}</>;
      case 'twin': return <><Who id={it.id} /> {it.mates.length ? <>和 <WhoList ids={it.mates} /> 相认</> : '发现另一个双子在公共牌里'}</>;
      case 'seer': return <><Who id={it.id} /> 看了 {it.saw ? <><Who id={it.saw.id} />：<RoleTag id={it.saw.card} /></> : it.center.map(c => <span key={c.i} className="mr-1">公共牌 {c.i + 1}：<RoleTag id={c.card} /></span>)}</>;
      case 'thief': return <><Who id={it.id} /> 和 <Who id={it.swap.with} /> 换牌，拿到 <RoleTag id={it.swap.got} /></>;
      case 'meddler': return <><Who id={it.id} /> 交换了 <Who id={it.swap.a} /> 和 <Who id={it.swap.b} /></>;
      case 'drunk': return <><Who id={it.id} /> 和公共牌 {it.swap.center + 1} 交换，变成 <RoleTag id={it.swap.got} /></>;
      case 'owl': return <><Who id={it.id} /> 醒来看到自己是 <RoleTag id={it.card} /></>;
      default: return null;
    }
  };
  return (
    <div className="mb-4 fs-12" data-testid="story">
      <div className="px-title">夜晚复盘</div>
      <div className="flex flex-col gap-1">
        {items.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1"><span className="c-gold whitespace-nowrap">{i + 1}. {ROLES[it.role].zh}</span>{line(it)}</div>
        ))}
        {!items.length && <div className="c-dim">这副牌夜里没人睁眼。</div>}
        {g.forced && <div className="c-dim">（房主强制天亮）</div>}
      </div>
    </div>
  );
}

// --------------------------------------------------------- overlays ---
function VoteReveal({ g, roomKey }) {
  const key = g.step === 'end' ? `on:vote:${roomKey}` : null;
  const [done, setDone] = useState(() => { try { return key && sessionStorage.getItem(key) === '1'; } catch { return false; } });
  useEffect(() => { try { setDone(!!key && sessionStorage.getItem(key) === '1'); } catch { setDone(false); } }, [key]);
  const close = () => { try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ } setDone(true); };
  if (!key || done) return null;
  const r = g.result;
  const vs = g.seats;
  const after = { animationDelay: `${0.3 + vs.length * 0.18}s` };
  const after2 = { animationDelay: `${0.9 + vs.length * 0.18}s` };
  return (
    <div className="px-overlay" onClick={close} data-testid="vote-reveal">
      <div className="px-frame gold pad flex flex-col items-center gap-3 text-center max-w-[600px] w-full" onClick={e => e.stopPropagation()}>
        <div className="fs-12 c-dim tracking-[0.2em]">一起亮票</div>
        <div className="flex flex-col gap-1 items-start">
          {vs.map((id, i) => (
            <div key={id} className="flex items-center gap-1 px-stamp" style={{ animationDelay: `${0.3 + i * 0.18}s` }}>
              <Who id={id} /><span className="c-dim">→</span>{g.votes[id] ? <Who id={g.votes[id]} /> : <span className="c-mute">没投</span>}
            </div>
          ))}
        </div>
        <div className="px-pop flex flex-col items-center gap-2" style={after}>
          {r.out.length
            ? <div className="flex flex-wrap items-center gap-2 justify-center"><WhoList ids={r.out} size="lg" tone="evil" /><span className="fs-24 c-evil shadow-px">出局</span></div>
            : <div className="fs-24 c-gold shadow-px">{r.max <= 1 ? '没人超过 1 票，无人出局' : '平票，无人出局'}</div>}
          {r.shots.map(s => <div key={s.from} className="fs-12">猎人 <Who id={s.from} /> 带走了 <Who id={s.to} /></div>)}
          {r.out.length > 0 && <div className="flex flex-wrap gap-2 justify-center">{r.out.map(id => <span key={id} className="inline-flex items-center gap-1"><Who id={id} /><RoleTag id={finalCard(g, id)} /></span>)}</div>}
        </div>
        <div className="px-pop" style={after2}>
          {r.winners.length ? r.winners.map(w => <div key={w} className={`fs-36 shadow-px ${WIN[w].cls}`}>{WIN[w].zh}</div>) : <div className="fs-24 c-dim">没有赢家</div>}
        </div>
        <button className="px-btn gold px-pop" style={after2} onClick={close} data-testid="close-reveal">看全部亮牌</button>
      </div>
    </div>
  );
}

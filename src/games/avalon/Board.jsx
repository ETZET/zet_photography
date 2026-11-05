import { useEffect, useMemo, useState } from 'react';
import PixelSprite, { Portrait } from '../pixel/PixelSprite';
import RoundTable from './RoundTable';
import { Who, WhoList, useConfirm, Confetti } from './ui';
import {
  ROLES, ROLE_BLURB, QUESTS, needsTwoFails, knowledgeFor, isGood, leaderOf, questSize, failsNeeded, score,
  markSeen, forceStart, toggleTeam, submitTeam, castVote, playCard, assassinate, newGame, effectiveConfig,
  ladyTargets, ladyExamine,
} from './avalonRules';

const Title = ({ children }) => <div className="px-title">{children}</div>;

const STEP_LABEL = { reveal: '查看身份', propose: '组队', vote: '投票', quest: '执行任务', assassin: '刺杀梅林', lady: '湖中仙女', end: '游戏结束' };

export default function Board({ room, myId, update, busy }) {
  const confirm = useConfirm();
  const g = room.game;
  const isHost = room.hostId === myId;
  const n = g.seats.length;
  const byId = useMemo(() => Object.fromEntries(room.players.map(p => [p.id, p])), [room.players]);
  const seatOf = useMemo(() => Object.fromEntries(g.seats.map((id, i) => [id, i])), [g.seats]);
  const seats = g.seats.map(id => byId[id] || { id, name: '?' });
  const myRole = g.assignments[myId];
  const leader = leaderOf(g);
  const amLeader = leader === myId;
  const amLady = g.lady?.holder === myId;
  const [showRole, setShowRole] = useState(false);
  const [target, setTarget] = useState(null);
  const lastProposal = g.history[g.history.length - 1];
  const showLastVote = g.step !== 'vote' && lastProposal;

  // game actions — each runs on a fresh copy of the room
  const act = fn => update(r => { fn(r.game); return r; });
  const seen = () => !g.seen[myId] && act(x => markSeen(x, myId));

  // auto-open the role card once per round
  useEffect(() => { if (g.step === 'reveal' && !g.seen[myId]) setShowRole(true); }, [room.round]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTarget(null); }, [g.step]);

  const onSeatClick = id => {
    if (g.step === 'propose' && amLeader) act(x => toggleTeam(x, myId, id));
    if (g.step === 'assassin' && myRole === 'assassin' && id !== myId) setTarget(id);
    if (g.step === 'lady' && amLady && ladyTargets(g).includes(id)) setTarget(id);
  };

  const decorate = id => {
    const inTeam = ['propose', 'vote', 'quest'].includes(g.step) && g.team.includes(id);
    let badge = null;
    if (g.step === 'vote') badge = id in g.votes ? <span key="v1" className="px-tag ok px-stamp">已投</span> : <span key="v0" className="px-tag">…</span>;
    else if (g.step === 'quest' && g.team.includes(id)) badge = id in g.cards ? <span key="c1" className="px-tag ok px-stamp">已出</span> : <span key="c0" className="px-tag">…</span>;
    else if (g.step === 'reveal') badge = g.seen[id] ? <span className="px-tag ok px-stamp">✓</span> : null;
    else if (showLastVote && g.step !== 'end') badge = lastProposal.votes[id] ? <span className="px-tag good">赞</span> : <span className="px-tag evil">反</span>;
    return {
      top: (
        <>
          {id === leader && g.step !== 'end' && <span className="px-lead"><PixelSprite name="crown" scale={2} title="队长" /></span>}
          {inTeam && <PixelSprite name="shield" scale={2} title="队员" />}
          {g.lady?.holder === id && g.step !== 'end' && <PixelSprite name="lady" scale={2} title="湖中仙女" />}
        </>
      ),
      badge,
      cls: [inTeam && 'picked', target === id && 'target', g.assassinTarget === id && 'target'].filter(Boolean).join(' '),
      role: g.step === 'end' ? ROLES[g.assignments[id]].sprite : null,
      clickable: (g.step === 'propose' && amLeader) || (g.step === 'assassin' && myRole === 'assassin' && id !== myId)
        || (g.step === 'lady' && amLady && ladyTargets(g).includes(id)),
    };
  };

  const s = score(g);
  const center = (() => {
    switch (g.step) {
      case 'reveal': return <><div className="fs-24 c-gold shadow-px">查看身份</div><div className="fs-12 c-dim">{Object.keys(g.seen).length}/{n} 人已查看</div></>;
      case 'propose': return <>
        <div className="fs-12 c-dim">任务 {g.quest + 1} · 第 {g.attempt} 次组队</div>
        <div className="fs-24 c-gold shadow-px">队长组队</div>
        <div><Who id={leader} /></div>
        <div className="fs-12">需要 {questSize(g)} 人 · 已选 {g.team.length}</div>
        {g.attempt > 1 && <div className="fs-12 c-evil">上一队被否决</div>}
      </>;
      case 'vote': return <><div className="fs-12 c-dim">任务 {g.quest + 1}</div><div className="fs-24 c-gold shadow-px">投票中</div><div className="fs-12">{Object.keys(g.votes).length}/{n} 已投</div></>;
      case 'quest': return <><div className="fs-12 c-dim">任务 {g.quest + 1}</div><div className="fs-24 c-gold shadow-px">任务进行中</div><div className="fs-12">{Object.keys(g.cards).length}/{g.team.length} 已出牌</div></>;
      case 'lady': return <><div className="fs-12 c-dim">任务 {g.results.length} 结束</div><div className="fs-24 c-gold shadow-px">湖中仙女</div><div className="fs-12"><Who id={g.lady.holder} /> 正在查验</div></>;
      case 'assassin': return <><div className="fs-24 c-evil shadow-px">刺客行动</div><div className="fs-12 c-dim">好人 3 胜 · 最后一搏</div></>;
      case 'end': return <><div className={`fs-36 shadow-px ${g.winner === 'good' ? 'c-good' : 'c-evil'}`}>{g.winner === 'good' ? '好人胜利' : '坏人胜利'}</div><div className="fs-12">{g.reason}</div></>;
      default: return null;
    }
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] items-start">
      <div className="px-frame pad">
        <QuestTrack g={g} />
        <RoundTable seats={seats} myId={myId} decorate={decorate} onSeatClick={onSeatClick} center={<div key={g.step} className="px-pop flex flex-col items-center gap-[2px]">{center}</div>} />
        <div className="flex items-center justify-between flex-wrap gap-2 fs-12 c-dim mt-1">
          <span>好人 <span className="c-good">{s.good}</span> : <span className="c-evil">{s.evil}</span> 坏人</span>
          <span>第 {room.round} 局 · {STEP_LABEL[g.step]}</span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="px-frame parch pad" data-testid="action-panel">
          <div key={`${g.step}-${g.quest}-${g.attempt}-${g.results.length}`} className="px-slide">
            <ActionPanel {...{ g, myId, myRole, isHost, amLeader, amLady, leader, act, target, setShowRole, update, busy, confirm }} />
          </div>
        </div>

        <button className="px-frame flex items-center gap-4 p-3 text-left w-[calc(100%-12px)] hover:brightness-110" onClick={() => setShowRole(true)} data-testid="my-role">
          <div className="px-portrait-bg"><Portrait role="emblem" scale={1.5} /></div>
          <div>
            <div className="fs-18">我的身份</div>
            <div className="fs-12 c-dim">点击查看（注意别让别人看到）</div>
          </div>
          <span className="ml-auto c-gold">▶</span>
        </button>

        <LadyLog g={g} myId={myId} />
        <History g={g} seatOf={seatOf} />
      </div>

      {showRole && (
        <RoleModal g={g} myId={myId} onClose={() => setShowRole(false)} onFlip={seen} />
      )}
      <QuestReveal g={g} roomKey={`${room.code}:${room.round}`} />
      <VoteReveal g={g} roomKey={`${room.code}:${room.round}`} />
      <LadyReveal g={g} myId={myId} roomKey={`${room.code}:${room.round}`} />
      {g.step === 'end' && <Confetti colors={g.winner === 'good' ? ['#4f7df0', '#8fb0ff', '#f5c542', '#fff6dc'] : ['#e04848', '#ff8a80', '#8b52d6', '#170f22']} />}
    </div>
  );
}

// ---------------------------------------------------------------------

function QuestTrack({ g }) {
  const n = g.seats.length;
  return (
    <div className="flex flex-col items-center gap-3 mb-2">
      <div className="px-quests">
        {QUESTS[n].map((size, i) => {
          const r = g.results[i];
          const cls = r ? (r.success ? 'success' : 'fail') : i === g.quest && g.step !== 'end' ? 'current' : '';
          return (
            <div key={i} className={`px-quest ${cls}`} title={needsTwoFails(n, i) ? '需要 2 张失败' : undefined}>
              <span className="fs-24 leading-none">{r ? (r.success ? '✓' : '✗') : size}</span>
              <span className="fs-12 leading-none mt-1">{r ? (r.fails ? `${r.fails}张败` : '成功') : `任务${i + 1}`}</span>
              {needsTwoFails(n, i) && !r && <span className="two px-tag evil">2败</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 fs-12 c-dim">
        组队次数
        <div className="px-pips">
          {[1, 2, 3, 4, 5].map(i => <span key={i} className={`px-pip ${i < g.attempt ? 'on' : i === g.attempt && g.step !== 'end' ? 'now' : ''}`} />)}
        </div>
        <span className={g.attempt >= 4 ? 'c-evil' : ''}>{g.attempt >= 5 ? '最后一次！' : '第5次被否 → 坏人胜'}</span>
      </div>
    </div>
  );
}

function ActionPanel({ g, myId, myRole, isHost, amLeader, amLady, leader, act, target, setShowRole, update, busy, confirm }) {
  const size = questSize(g);
  /** Ask first, then act. */
  const guarded = async (opts, fn) => { if (await confirm(opts)) act(fn); };

  switch (g.step) {
    case 'reveal':
      return <>
        <Title>查看身份</Title>
        <p className="mb-4">每个人先偷偷看自己的身份牌。所有人看完后自动进入第一轮组队。</p>
        <button className="px-btn gold lg block" onClick={() => setShowRole(true)}>{g.seen[myId] ? '再看一次身份' : '查看我的身份'}</button>
        {isHost && <button className="px-btn dark sm block mt-3" disabled={busy}
          onClick={() => guarded({ title: '直接开始？', body: '还有人没看身份。确定不等他们了吗？', ok: '直接开始' }, forceStart)}>不等了，直接开始</button>}
      </>;

    case 'propose':
      return amLeader ? <>
        <Title>你是队长</Title>
        <p>在圆桌上点选 <b>{size}</b> 名骑士去执行任务 {g.quest + 1}（可以选自己）。</p>
        <div className="fs-12 c-dim mt-2 mb-4">已选：<WhoList ids={g.team} /></div>
        <button className="px-btn gold lg block" disabled={busy || g.team.length !== size} data-testid="submit-team"
          onClick={() => guarded({ title: `提交任务 ${g.quest + 1} 的队伍`, body: <><div className="mb-2">队员：</div><WhoList ids={g.team} size="lg" /><div className="fs-12 c-dim mt-3">提交后所有人开始投票，不能再换人。</div></>, ok: '提交' }, x => submitTeam(x, myId))}>
          提交队伍 {g.team.length}/{size}
        </button>
      </> : <>
        <Title>等待组队</Title>
        <p>队长 <Who id={leader} /> 正在挑选 {size} 名骑士。</p>
        {g.team.length > 0 && <div className="fs-12 c-dim mt-2">已选：<WhoList ids={g.team} /></div>}
        <p className="fs-12 c-dim mt-2">趁现在讨论：你信任谁？</p>
      </>;

    case 'vote': {
      const mine = g.votes[myId];
      return <>
        <Title>投票 · 任务 {g.quest + 1}</Title>
        <p>队长 <Who id={leader} /> 提议：</p>
        <div className="my-2"><WhoList ids={g.team} size="lg" /></div>
        <p className="fs-12 c-dim mb-4">过半数赞成才能出发。{mine === undefined ? '' : `你投了「${mine ? '赞成' : '反对'}」，大家投完前可以改。`}</p>
        <div className="grid grid-cols-2">
          <button className={`px-btn blue lg ${mine === true ? '' : mine === false ? 'opacity-50' : ''}`} disabled={busy || mine === true} onClick={() => act(x => castVote(x, myId, true))} data-testid="vote-yes">{mine === true ? '✓ 已赞成' : '✓ 赞成'}</button>
          <button className={`px-btn red lg ${mine === false ? '' : mine === true ? 'opacity-50' : ''}`} disabled={busy || mine === false} onClick={() => act(x => castVote(x, myId, false))} data-testid="vote-no">{mine === false ? '✗ 已反对' : '✗ 反对'}</button>
        </div>
      </>;
    }

    case 'quest': {
      const inTeam = g.team.includes(myId);
      const played = myId in g.cards;
      const good = isGood(myRole);
      if (!inTeam) return <>
        <Title>任务进行中</Title>
        <div><WhoList ids={g.team} /> 正在执行任务 {g.quest + 1}。</div>
        <p className="fs-12 c-dim mt-2">需要 {failsNeeded(g)} 张失败牌任务才会失败。</p>
      </>;
      if (played) return <><Title>已出牌</Title><p>等待其他队员…（{Object.keys(g.cards).length}/{g.team.length}）</p></>;
      return <>
        <Title>秘密出牌</Title>
        <p className="mb-4">只有你知道自己出了什么。{good ? '好人只能出「成功」。' : '你是坏人，可以选择破坏。'}</p>
        <div className="grid grid-cols-2">
          <button className="px-btn blue lg" disabled={busy} data-testid="card-success"
            onClick={() => guarded({ title: '出「成功」牌？', body: '出牌后不能更改。', ok: '出成功' }, x => playCard(x, myId, true))}>成功</button>
          <button className="px-btn red lg" disabled={busy || good} data-testid="card-fail"
            onClick={() => guarded({ title: '出「失败」牌？', body: '你要破坏这次任务。出牌后不能更改。', ok: '出失败', tone: 'danger' }, x => playCard(x, myId, false))}>失败</button>
        </div>
      </>;
    }

    case 'lady': {
      if (amLady) return <>
        <Title>湖中仙女</Title>
        <p className="mb-2">你持有湖中仙女。在圆桌上点一名玩家，<b>只有你</b>会看到他的阵营，之后湖中仙女交给他。</p>
        <div className="fs-12 c-dim mb-2">可查验：<WhoList ids={ladyTargets(g)} /></div>
        <div className="mb-4">目标：{target ? <Who id={target} size="lg" /> : <span className="c-mute">在圆桌上点一个人</span>}</div>
        <button className="px-btn blue lg block" disabled={busy || !target} data-testid="lady-examine"
          onClick={() => guarded({ title: '使用湖中仙女', body: <>查验 <Who id={target} size="lg" /> 的阵营？<div className="fs-12 c-dim mt-2">每人只能被查验一次，之后湖中仙女交给他。</div></>, ok: '查验' }, x => ladyExamine(x, myId, target))}>
          查验
        </button>
      </>;
      return <><Title>湖中仙女</Title><p><Who id={g.lady.holder} /> 正在用湖中仙女查验一名玩家的阵营。</p><p className="fs-12 c-dim mt-2">查验结果只有他自己知道，他说的不一定是真话。</p></>;
    }

    case 'assassin': {
      if (myRole === 'assassin') return <>
        <Title>你是刺客</Title>
        <p className="mb-2">好人完成了 3 个任务。在圆桌上点出你认为是 <b>梅林</b> 的人。</p>
        <p className="fs-12 c-dim mb-2">可以先和同伴商量。</p>
        <div className="mb-4">目标：{target ? <Who id={target} size="lg" /> : <span className="c-mute">在圆桌上点一个人</span>}</div>
        <button className="px-btn red lg block" disabled={busy || !target} data-testid="assassinate"
          onClick={() => guarded({ title: '刺杀梅林', body: <>确定刺杀 <Who id={target} size="lg" />？<div className="fs-12 c-dim mt-2">只有一次机会，结果立即公布。</div></>, ok: '刺杀', tone: 'danger' }, x => assassinate(x, myId, target))}>
          刺杀
        </button>
      </>;
      const evil = !isGood(myRole) && myRole !== 'oberon';
      return <><Title>刺客行动</Title><p>{evil ? <>帮刺客 <Who id={g.seats.find(id => g.assignments[id] === 'assassin')} /> 找出梅林！</> : '刺客正在寻找梅林……保持冷静。'}</p></>;
    }

    case 'end': {
      const again = async () => {
        if (!await confirm({ title: '再来一局？', body: '同一批人重新发身份牌。', ok: '开新一局' })) return;
        update(r => { r.game = newGame(r.players, effectiveConfig(r.players.length, r.config)); r.round += 1; return r; });
      };
      const lobby = async () => {
        if (!await confirm({ title: '回到大厅？', body: '可以在大厅调整角色或等人加入。', ok: '回大厅' })) return;
        update(r => { r.phase = 'lobby'; r.game = null; return r; });
      };
      return <>
        <Title>{g.winner === 'good' ? '亚瑟的忠臣胜利' : '莫德雷德的爪牙胜利'}</Title>
        <p className="mb-3">{g.reason}{g.assassinTarget ? <>（刺客选了 <Who id={g.assassinTarget} />）</> : ''}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {g.seats.map(id => {
            const r = ROLES[g.assignments[id]];
            return (
              <div key={id} className="flex items-center gap-2">
                <Portrait role={r.sprite} scale={1} />
                <span className="fs-12 min-w-0"><Who id={id} /><br /><span className={r.team === 'good' ? 'text-[#2a4ab0]' : 'text-[#a8203a]'}>{r.zh}</span></span>
              </div>
            );
          })}
        </div>
        {isHost ? (
          <div className="grid grid-cols-2">
            <button className="px-btn gold" disabled={busy} onClick={again} data-testid="play-again">再来一局</button>
            <button className="px-btn dark" disabled={busy} onClick={lobby} data-testid="to-lobby">回到大厅</button>
          </div>
        ) : <p className="fs-12 c-dim">等待房主开新一局…</p>}
      </>;
    }
    default:
      return null;
  }
}

/** Lady of the Lake log: everyone sees who examined whom; only the examiner sees the result. */
function LadyLog({ g, myId }) {
  if (!g.lady) return null;
  const log = g.lady.log;
  return (
    <div className="px-frame pad" data-testid="lady-log">
      <div className="px-title">湖中仙女</div>
      <div className="flex items-center gap-3 mb-2">
        <PixelSprite portrait="lady" scale={1.5} />
        <span className="fs-12">持有者：<Who id={g.lady.holder} /></span>
      </div>
      {log.length === 0 && <p className="fs-12 c-dim">第 2 个任务结束后第一次使用。</p>}
      {log.map((l, i) => (
        <div key={i} className="fs-12 flex items-center gap-2 flex-wrap">
          <span className="c-dim">任务{l.after}后</span>
          <span><Who id={l.from} />→<Who id={l.to} /></span>
          {l.from === myId && (
            <span className={`px-tag ${l.good ? 'good' : 'evil'} ml-auto`} data-testid="lady-result">{l.good ? '好人' : '坏人'}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function History({ g, seatOf }) {
  if (!g.history.length) return null;
  const items = [...g.history].reverse();
  return (
    <div className="px-frame pad">
      <div className="px-title">记录</div>
      <div className="px-scroll flex flex-col gap-3 pr-1">
        {items.map((h, i) => {
          const result = h.approved ? g.results[h.quest] : null;
          const yes = Object.keys(h.votes).filter(id => h.votes[id]);
          const no = Object.keys(h.votes).filter(id => !h.votes[id]);
          const byseat = ids => [...ids].sort((a, b) => seatOf[a] - seatOf[b]);
          return (
            <div key={i} className="fs-12 pb-3 border-b-[3px] border-[#150f29] last:border-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="c-gold">任务{h.quest + 1}·第{h.attempt}次</span>
                <span className="c-dim">队长</span><Who id={h.leaderId} />
                <span className={`px-tag ml-auto ${h.approved ? 'good' : 'evil'}`}>{h.approved ? '通过' : '否决'} {yes.length}:{no.length}</span>
              </div>
              <div>队伍：<WhoList ids={h.team} /></div>
              <div><span className="c-good">赞成：</span><WhoList ids={byseat(yes)} tone="good" /></div>
              <div><span className="c-evil">反对：</span><WhoList ids={byseat(no)} tone="evil" /></div>
              {result && <div className={result.success ? 'c-good' : 'c-evil'}>→ 任务{result.success ? '成功' : '失败'}（{result.fails} 张失败）</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RoleModal({ g, myId, onClose, onFlip }) {
  const [flipped, setFlipped] = useState(false);
  const info = knowledgeFor(myId, g.assignments);
  if (!info) return null;
  const role = ROLES[info.role];
  const flip = () => { setFlipped(f => !f); if (!flipped) onFlip(); };

  return (
    <div className="px-overlay" onClick={onClose} data-testid="role-modal">
      <div className="flex flex-col md:flex-row items-center gap-6 max-w-[720px] w-full" onClick={e => e.stopPropagation()}>
        <div className="px-card-wrap" onClick={flip} role="button" aria-label={flipped ? '盖上身份牌' : '翻开身份牌'} data-testid="role-card">
          <div className={`px-card ${flipped ? 'flipped' : ''}`}>
            <div className="px-card-face">
              <Portrait role="emblem" scale={5} />
              <div className="fs-18 c-gold">点击翻开</div>
              <div className="fs-12 c-dim">确认没人偷看</div>
            </div>
            <div className={`px-card-face front ${role.team}`}>
              <span className={`px-tag ${role.team}`}>{role.team === 'good' ? '亚瑟的忠臣' : '莫德雷德的爪牙'}</span>
              <div className="px-portrait-bg"><Portrait role={role.sprite} scale={5} /></div>
              <div className="fs-24 shadow-px">{role.zh}</div>
              <div className="fs-12 c-dim tracking-[0.2em]">{role.en.toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div className="px-frame pad flex-1 w-full self-stretch flex flex-col">
          <div className="px-title">你知道的</div>
          {!flipped ? (
            <p className="c-dim">翻开卡牌后显示你的情报。</p>
          ) : (
            <div className="flex flex-col gap-3" data-testid="intel">
              <p>{ROLE_BLURB[info.role]}</p>
              {info.title && (
                <div>
                  <div className="c-gold mb-2">{info.title}：</div>
                  <div className="flex flex-wrap gap-2">
                    {info.seen.length === 0 && <span className="c-dim">（没有人）</span>}
                    {info.seen.map(s => (
                      <Who key={s.playerId} id={s.playerId} size="lg" tone={s.tag === 'evil' ? 'evil' : 'good'} />
                    ))}
                  </div>
                </div>
              )}
              {info.notes.map(t => <p key={t} className="fs-12 c-dim">※ {t}</p>)}
            </div>
          )}
          <button className="px-btn dark block mt-auto" onClick={onClose} data-testid="close-role">盖上并返回</button>
        </div>
      </div>
    </div>
  );
}

function QuestReveal({ g, roomKey }) {
  const lq = g.lastQuest;
  const key = lq ? `avalon:qr:${roomKey}:${lq.index}` : null;
  const [dismissed, setDismissed] = useState(() => new Set());
  const hidden = !lq || dismissed.has(key) || (() => { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } })();
  if (hidden) return null;
  const close = () => {
    try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ }
    setDismissed(d => new Set(d).add(key));
  };
  const delay = i => ({ animationDelay: `${0.3 + i * 0.45}s` });
  const after = { animationDelay: `${0.4 + lq.cards.length * 0.45}s` };
  return (
    <div className="px-overlay" onClick={close} data-testid="quest-reveal">
      <div className="px-frame gold pad flex flex-col items-center gap-5 text-center max-w-[560px] w-full" onClick={e => e.stopPropagation()}>
        <div className="fs-12 c-dim tracking-[0.2em]">任务 {lq.index + 1} 结果</div>
        <div className="flex flex-wrap justify-center gap-3">
          {lq.cards.map((ok, i) => (
            <div key={i} className={`px-mini-card ${ok ? 's' : 'f'}`} style={delay(i)}>
              <PixelSprite name={ok ? 'check' : 'cross'} scale={4} />
              {ok ? '成功' : '失败'}
            </div>
          ))}
        </div>
        <div className="px-pop" style={after}>
          <div className={`fs-36 shadow-px ${lq.success ? 'c-good' : 'c-evil'}`}>{lq.success ? '任务成功' : '任务失败'}</div>
          <div className="fs-12 c-dim mt-2">{lq.fails} 张失败牌</div>
        </div>
        <button className="px-btn gold px-pop" style={after} onClick={close} data-testid="close-reveal">继续</button>
      </div>
    </div>
  );
}

/** Remembers per tab which overlays were dismissed (survives reloads). */
function useDismissed(key) {
  const [, force] = useState(0);
  const isDone = !key || (() => { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } })();
  const done = () => { try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ } force(n => n + 1); };
  return [isDone, done];
}

/** After every vote: everyone's ballot stamps down one by one, then the verdict. */
function VoteReveal({ g, roomKey }) {
  const h = g.history[g.history.length - 1];
  const key = h ? `avalon:vr:${roomKey}:${g.history.length}` : null;
  const [isDone, done] = useDismissed(key);
  const fresh = h && g.step !== 'reveal';
  useEffect(() => {
    if (!fresh || isDone) return undefined;
    const t = setTimeout(done, 1200 + g.seats.length * 220 + 1800);
    return () => clearTimeout(t);
  }, [key, fresh, isDone]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!fresh || isDone) return null;
  const yes = g.seats.filter(id => h.votes[id]).length;
  const after = { animationDelay: `${0.3 + g.seats.length * 0.22}s` };
  return (
    <div className="px-overlay" onClick={done} data-testid="vote-reveal">
      <div className="px-frame gold pad flex flex-col items-center gap-4 text-center max-w-[600px] w-full" onClick={e => e.stopPropagation()}>
        <div className="fs-12 c-dim tracking-[0.2em]">任务 {h.quest + 1} · 第 {h.attempt} 次组队 · 投票结果</div>
        <div><WhoList ids={h.team} /></div>
        <div className="flex flex-wrap justify-center gap-3">
          {g.seats.map((id, i) => (
            <div key={id} className="px-vote-chip">
              <Who id={id} />
              <span className={`px-tag ${h.votes[id] ? 'good' : 'evil'} fs-18 px-stamp`} style={{ animationDelay: `${0.3 + i * 0.22}s` }}>
                {h.votes[id] ? '赞成' : '反对'}
              </span>
            </div>
          ))}
        </div>
        <div className="px-pop" style={after}>
          <div className={`fs-36 shadow-px ${h.approved ? 'c-good' : 'c-evil'}`}>{h.approved ? '队伍通过' : '队伍被否决'}</div>
          <div className="fs-12 c-dim mt-1">{yes} 赞成 : {g.seats.length - yes} 反对</div>
        </div>
        <button className="px-btn gold px-pop" style={after} onClick={done} data-testid="close-vote">继续</button>
      </div>
    </div>
  );
}

/** Private result card for the Lady of the Lake holder who just examined someone. */
function LadyReveal({ g, myId, roomKey }) {
  const log = g.lady?.log || [];
  const last = log[log.length - 1];
  const mine = last && last.from === myId;
  const key = mine ? `avalon:lr:${roomKey}:${log.length}` : null;
  const [isDone, done] = useDismissed(key);
  if (!mine || isDone) return null;
  return (
    <div className="px-overlay" onClick={done} data-testid="lady-reveal">
      <div className={`px-frame pad flex flex-col items-center gap-4 text-center max-w-[420px] w-full px-pop ${last.good ? '' : 'danger'}`} onClick={e => e.stopPropagation()}>
        <PixelSprite portrait="lady" scale={4} className="px-bob" />
        <div className="fs-12 c-dim">湖中仙女告诉你（只有你看得到）</div>
        <Who id={last.to} size="lg" />
        <div className="px-stamp" style={{ animationDelay: '0.5s' }}>
          <div className={`fs-36 shadow-px ${last.good ? 'c-good' : 'c-evil'}`}>{last.good ? '是好人' : '是坏人'}</div>
        </div>
        <button className="px-btn gold" onClick={done} data-testid="close-lady">知道了</button>
      </div>
    </div>
  );
}

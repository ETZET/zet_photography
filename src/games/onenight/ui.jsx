// Small shared pieces for 一夜狼's lobby + board.
import { useEffect, useState } from 'react';
import { Portrait } from '../pixel/PixelSprite';
import { Who, WhoList } from '../avalon/ui';
import { ROLES, ROLE_IDS, countsOf, timeline } from './onenightRules';

export const teamCls = id => ({ wolf: 'evil', loner: 'loner', village: 'good' })[ROLES[id].team];
export const teamText = id => ({ wolf: 'c-evil', loner: 'c-loner', village: 'c-good' })[ROLES[id].team];
export const TEAM_ZH = { village: '好人阵营', wolf: '狼人阵营', loner: '自己一伙' };

export function RoleTag({ id, className = '' }) {
  return <span className={`px-tag ${teamCls(id)} ${className}`}>{ROLES[id].zh}</span>;
}

/** "狼人×2 预言家 …" in team colours. */
export function DeckLine({ deck }) {
  const c = countsOf(deck);
  return ROLE_IDS.filter(id => c[id]).map(id => (
    <span key={id} className={`${teamText(id)} mr-2 whitespace-nowrap`}>{ROLES[id].zh}{c[id] > 1 ? `×${c[id]}` : ''}</span>
  ));
}

export function useNow(active, ms = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}

/** Secrets stay covered; press and hold to look (let go and they're hidden again). */
export function Peek({ children, label = '按住查看', hint = '松手就盖上，旁边的人看不到', testId }) {
  const [open, setOpen] = useState(false);
  const on = e => { e.preventDefault(); setOpen(true); };
  const off = () => setOpen(false);
  return (
    <div className="on-peek" data-testid={testId}
      onPointerDown={on} onPointerUp={off} onPointerLeave={off} onPointerCancel={off} onContextMenu={e => e.preventDefault()}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') setOpen(true); }} onKeyUp={off} tabIndex={0} role="button" aria-pressed={open}>
      {open ? <div data-testid={testId && `${testId}-open`}>{children}</div> : (
        <div className="on-peek-cover">
          <span className="px-cardback" aria-hidden />
          <div className="text-left">
            <div className="fs-18">{label}</div>
            <div className="fs-12 c-dim">{hint}</div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Portrait + name, for inside peeks and reveals. */
export function RoleFace({ id, scale = 1.5, children }) {
  return (
    <div className="flex items-center gap-3">
      <div className="px-portrait-bg shrink-0"><Portrait role={ROLES[id].sprite} scale={scale} /></div>
      <div className="min-w-0 text-left">
        <div className={`fs-18 ${teamText(id)}`}>{ROLES[id].zh} <span className="fs-12 c-dim">{TEAM_ZH[ROLES[id].team]}</span></div>
        {children}
      </div>
    </div>
  );
}

/** The 3 center cards. `faces` = role ids to show face up (end), `sel` = picked indices. */
export function CenterCards({ faces, sel = [], onPick, lg = false, testPrefix = 'center' }) {
  return (
    <div className="on-center">
      {[0, 1, 2].map(i => {
        const face = faces?.[i];
        const Tag = onPick ? 'button' : 'div';
        return (
          <Tag key={i} type={onPick ? 'button' : undefined} className={`on-ccard ${lg ? 'lg' : ''} ${face ? 'face' : ''} ${sel.includes(i) ? 'sel' : ''} ${onPick ? 'clickable' : ''}`}
            onClick={onPick ? () => onPick(i) : undefined} data-testid={`${testPrefix}-${i}`} aria-label={`公共牌 ${i + 1}${face ? ` ${ROLES[face].zh}` : ''}`}>
            <span className="no">{i + 1}</span>
            {face && <Portrait role={ROLES[face].sprite} scale={lg ? 1.4 : 0.9} />}
          </Tag>
        );
      })}
    </div>
  );
}

/** The narrator's wake-up order, the same on every phone; driven by the clock only. */
export function Timeline({ g, now, inline = false }) {
  const { slots, cur } = timeline(g, now);
  if (!slots.length) return <span className="fs-12 c-dim">这副牌里没有夜里睁眼的角色</span>;
  return (
    <div className="on-tl" data-testid={inline ? undefined : 'timeline'}>
      {slots.map((s, i) => (
        <span key={s.role} className="inline-flex items-center gap-[2px]">
          <span className={`r ${i < cur ? 'done' : i === cur ? 'now' : ''}`}>{ROLES[s.role].zh}</span>
          {i < slots.length - 1 && <i>›</i>}
        </span>
      ))}
    </div>
  );
}

/** "现在：夜贼请睁眼" — the live line of the timeline. */
export function narratorLine(g, now) {
  const { slots, cur } = timeline(g, now);
  if (cur < 0) return '天黑请闭眼';
  if (cur >= slots.length) return '天快亮了…';
  const r = slots[cur].role;
  return `${ROLES[r].zh}请睁眼`;
}

const cname = i => `公共牌 ${i + 1}`;

/** What a player learned tonight, from nightInfo(). */
export function InfoLines({ info, start }) {
  const items = info.map((x, i) => {
    switch (x.k) {
      case 'wolves': return <div key={i}>{x.ids.length ? <>狼队友：<WhoList ids={x.ids} tone="evil" /></> : '你是场上唯一的狼（其他狼牌在公共牌里）。'}</div>;
      case 'wolvesForMinion': return <div key={i}>{x.ids.length ? <>狼人是：<WhoList ids={x.ids} tone="evil" />（他们不知道你）</> : '没有玩家拿到狼人，狼牌都在公共牌里。'}</div>;
      case 'twin': return <div key={i}>{x.ids.length ? <>另一个双子：<WhoList ids={x.ids} tone="good" /></> : '另一张双子在公共牌里。'}</div>;
      case 'center': return <div key={i}>{x.idx.map((c, j) => <span key={c} className="mr-2 whitespace-nowrap">{cname(c)} 是 <RoleTag id={x.cards[j]} /></span>)}</div>;
      case 'saw': return <div key={i}><Who id={x.id} /> 的牌是 <RoleTag id={x.card} /></div>;
      case 'stole': return <div key={i}>你和 <Who id={x.id} /> 换了牌：你现在是 <RoleTag id={x.card} />，他拿着夜贼（他不知道）。</div>;
      case 'meddled': return <div key={i}>你交换了 <Who id={x.ids[0]} /> 和 <Who id={x.ids[1]} /> 的牌（你没看）。</div>;
      case 'drank': return <div key={i}>你和{cname(x.idx)}换了牌：你现在是那张没看过的牌。</div>;
      case 'owl': return <div key={i} data-testid="owl-card">你现在的牌是 <RoleTag id={x.card} />{x.card === 'owl' ? '（没被换过）' : '（被换过了！）'}</div>;
      case 'owlWait': return <div key={i} className="c-dim">等所有人行动完、时间线走到夜猫子，就能看到你现在的牌。</div>;
      default: return null;
    }
  }).filter(Boolean);
  if (!items.length) return <div className="c-dim">{['villager', 'hunter', 'loner'].includes(start) ? '你今晚不睁眼。' : '今晚没有新消息。'}</div>;
  return <div className="flex flex-col gap-1">{items}</div>;
}

/** Per-task instruction (inside the identity peek). */
export function taskText(task, start) {
  switch (task.kind) {
    case 'lonePeek': return '你是唯一的狼：点圆桌中间的一张公共牌偷看。';
    case 'seer': return '点一个人看他的牌，或者点两张公共牌。';
    case 'thief': return '点一个人和他换牌，换完看你拿到的新牌。';
    case 'meddler': return '点另外两个人，交换他们的牌（你不看）。';
    case 'drunk': return '点一张公共牌和你的牌交换（你不看）。';
    default: return `${start === 'owl' ? '你最后醒：确认后，夜里结束前会告诉你现在手里的牌。' : start === 'wolf' ? '和狼队友互相确认。' : start === 'minion' ? '看清谁是狼，帮他们藏起来。' : start === 'twin' ? '和另一个双子互相确认。' : '你今晚不睁眼。'}随便点一个人或一张公共牌再确认（没有效果，只是让大家的操作看起来都一样）。`;
  }
}

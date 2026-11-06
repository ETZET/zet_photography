import { useState } from 'react';
import PixelSprite, { Portrait } from '../pixel/PixelSprite';
import RoundTable from '../avalon/RoundTable';
import { roomLink } from '../../route';
import { IS_LOCAL } from '../avalon/roomStore';
import { requestSwap, answerSwap, cancelSwap, hostSwap, pendingFrom, pendingTo } from '../room/seats';
import { Who, useConfirm } from '../avalon/ui';
import {
  ROLES, ROLE_IDS, ROLE_BLURB, MIN_PLAYERS, MAX_PLAYERS, BOARDS, VARIANTS, DEFAULT_RULES, changedRules, deckFor, countsOf, newGame, WAKE_ORDER,
} from './onenightRules';
import { addBot } from './bots';
import { DeckLine, teamText } from './ui';

const IS_DEV = import.meta.env.DEV;

export default function Lobby({ room, myId, update, busy }) {
  const confirm = useConfirm();
  const isHost = room.hostId === myId;
  const n = room.players.length;
  const cfg = { ...room.config, rules: { ...DEFAULT_RULES, ...(room.config?.rules || {}) } };
  const d = deckFor(n, cfg);
  const tableN = d.tableN;
  const missing = Math.max(0, MIN_PLAYERS - n);
  const counts = countsOf(d.cards);
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [diy, setDiy] = useState(!!cfg.counts);

  const copy = async () => {
    try { await navigator.clipboard.writeText(roomLink('onenight', room.code)); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const pickBoard = id => isHost && update(r => { r.config = { ...r.config, board: id, counts: null }; return r; });
  const bump = (id, delta) => isHost && update(r => {
    const cur = countsOf(deckFor(r.players.length, r.config).cards);
    const step = ROLES[id].pair ? 2 : 1;
    cur[id] = Math.max(0, Math.min(ROLES[id].max, (cur[id] || 0) + delta * step));
    r.config = { ...r.config, board: 'custom', counts: cur };
    return r;
  });
  const setRule = (key, val) => isHost && update(r => { r.config = { ...r.config, rules: { ...DEFAULT_RULES, ...(r.config.rules || {}), [key]: val } }; return r; });

  // seat swapping (seat 1 stays the host)
  const [picked, setPicked] = useState(null);
  const outgoing = pendingFrom(room, myId);
  const incoming = pendingTo(room, myId);
  const name = id => room.players.find(p => p.id === id)?.name || '?';
  const seatNo = id => room.players.findIndex(p => p.id === id) + 1;
  const onSeat = async id => {
    if (isHost) {
      if (!picked) { setPicked(id); return; }
      if (picked !== id) update(r => hostSwap(r, picked, id));
      setPicked(null);
      return;
    }
    const ok = await confirm({ title: '请求换位', body: <>想和 <Who id={id} /> 换位吗？你在 {seatNo(myId)} 号，他在 {seatNo(id)} 号。对方同意后生效。</>, ok: '发送请求' });
    if (ok) update(r => requestSwap(r, myId, id));
  };
  const canTapSeat = id => id !== room.hostId && (isHost || (id !== myId && seatNo(myId) > 1));
  const kick = async id => {
    const ok = await confirm({ title: '移出房间', body: <>确定把 <Who id={id} /> 移出房间吗？</>, ok: '移出', tone: 'danger' });
    if (ok) update(r => { r.players = r.players.filter(p => p.id !== id); return r; });
  };
  const start = async () => {
    if (d.warn.length && !await confirm({ title: '这副牌有点怪', body: <ul className="flex flex-col gap-1">{d.warn.map(w => <li key={w}>· {w}</li>)}</ul>, ok: '仍然开局', cancel: '回去调整', tone: 'danger' })) return;
    update(r => {
      const timeScale = window.__onTimeScale ?? (IS_LOCAL ? 0.15 : 1);
      r.game = newGame(r.players, { ...r.config, timeScale });
      r.phase = 'game';
      r.round = (r.round || 0) + 1;
      return r;
    });
  };
  const boardName = BOARDS.find(b => b.id === cfg.board)?.zh || '自定义';

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] items-start">
      <div className="px-frame pad">
        <div className="px-title">村庄 · {n}/{MAX_PLAYERS} 人</div>
        <RoundTable
          seats={room.players}
          capacity={Math.max(MIN_PLAYERS, n)}
          myId={myId}
          onSeatClick={onSeat}
          decorate={id => ({
            top: id === room.hostId ? <PixelSprite name="crown" scale={2} title="房主" /> : null,
            clickable: canTapSeat(id),
            cls: picked === id || outgoing?.to === id ? 'picked' : '',
            corner: isHost && id !== myId
              ? <span className="px-kick" role="button" tabIndex={0} onClick={e => { e.stopPropagation(); kick(id); }} title="移出房间" aria-label="移出房间" data-testid="kick">✕</span>
              : null,
          })}
          center={
            <>
              <div className="fs-24 c-gold shadow-px">{missing > 0 ? `还差 ${missing} 人` : '人齐了！'}</div>
              <div className="fs-12 c-dim">{isHost ? (missing > 0 ? '把邀请链接发给朋友' : `${n} 人 + 3 张公共牌`) : '等待房主开局…'}</div>
            </>
          }
        />
        {incoming.map(s => (
          <div key={s.from} className="px-frame gold pad flex flex-wrap items-center justify-between gap-2 mt-2" data-testid="swap-request">
            <span><Who id={s.from} />（{seatNo(s.from)} 号）想和你换位</span>
            <span className="flex gap-2">
              <button className="px-btn dark sm" disabled={busy} onClick={() => update(r => answerSwap(r, myId, s.from, false))} data-testid="swap-no">拒绝</button>
              <button className="px-btn gold sm" disabled={busy} onClick={() => update(r => answerSwap(r, myId, s.from, true))} data-testid="swap-yes">同意</button>
            </span>
          </div>
        ))}
        <div className="fs-12 c-dim text-center mt-2" data-testid="seat-hint">
          {outgoing
            ? <>已请求和 {name(outgoing.to)} 换位，等对方同意… <button className="underline" onClick={() => update(r => cancelSwap(r, myId))} data-testid="swap-cancel">取消</button></>
            : isHost
              ? (picked ? <>已选 {name(picked)}，再点一个座位和他换（再点他取消）</> : '点两个座位可以给他们换位；1 号固定是房主')
              : '点别人的座位可以请求换位；1 号固定是房主'}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          <button className="px-btn blue" onClick={copy}>{copied ? '已复制 ✓' : '复制邀请链接'}</button>
          {isHost && IS_DEV && n < MAX_PLAYERS && (
            <button className="px-btn dark sm" onClick={() => update(addBot)} data-testid="add-bot">+ 机器人（仅本地）</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="px-frame pad" data-testid="presets">
          <div className="px-title">{isHost ? '选择牌组' : '本局牌组'} · {tableN} 人 {tableN + 3} 张</div>
          {n < MIN_PLAYERS && <div className="fs-12 c-mute mb-2">按 {tableN} 人预览</div>}
          {!isHost && <div className="fs-12 c-dim mb-2">由房主选择</div>}
          <div className="flex flex-col">
            {BOARDS.filter(b => isHost || cfg.board === b.id).map(b => {
              const on = cfg.board === b.id && !cfg.counts;
              return (
                <button key={b.id} className={`px-role row good ${on ? 'on' : ''}`} disabled={!isHost} aria-pressed={on} onClick={() => pickBoard(b.id)} data-testid={`board-${b.id}`}>
                  <span className="flex flex-col gap-1 w-full">
                    <span>{on ? '● ' : '○ '}{b.zh}</span>
                    <span className="fs-12 c-dim">{b.desc}</span>
                    <span className="fs-12 leading-loose"><DeckLine deck={deckFor(tableN, { board: b.id }).cards} /></span>
                  </span>
                </button>
              );
            })}
            {cfg.counts && (
              <div className="px-role row good on" data-testid="board-custom">
                <span className="flex flex-col gap-1">
                  <span>● 自定义</span>
                  <span className="fs-12 c-dim">在下面的「自定义 DIY」里改过的牌组。</span>
                </span>
              </div>
            )}
          </div>
          <div className="fs-12 c-dim mt-3 leading-loose" data-testid="deck">本局 {d.cards.length} 张：<DeckLine deck={d.cards} /></div>
          {(d.error || d.warn.length > 0) && (
            <div className="flex flex-col items-start gap-2 mt-2">
              {d.error && <div className="px-tag evil fs-12 leading-relaxed" data-testid="deck-error"><PixelSprite name="warn" scale={2} className="inline-block align-[-2px] mr-1" />{d.error}</div>}
              {d.warn.map(w => <div key={w} className="px-tag gold fs-12 leading-relaxed" data-testid="deck-warn"><PixelSprite name="warn" scale={2} className="inline-block align-[-2px] mr-1" />{w}</div>)}
            </div>
          )}
          <button className="underline fs-12 c-dim mt-3 block" onClick={() => setShowRules(v => !v)} data-testid="toggle-rules">
            {showRules ? '收起规则' : '查看规则 / 角色说明'}
          </button>
          {showRules && <RuleCard deck={d.cards} rules={cfg.rules} />}
        </div>

        <div className="px-frame pad" data-testid="diy">
          <button className="w-full flex items-center justify-between text-left" onClick={() => setDiy(v => !v)} aria-expanded={diy} data-testid="toggle-diy">
            <span className="px-title !mb-0">{diy ? '▾' : '▸'} 自定义 DIY</span>
            <span className="fs-12 c-mute">{diy ? '收起' : '加减角色牌'}</span>
          </button>
          {diy && <div className="mt-4">
            <div className={`fs-12 mb-2 ${d.cards.length === d.need ? 'c-dim' : 'c-evil'}`} data-testid="deck-count">
              牌数 {d.cards.length} / 需要 {d.need}（{tableN} 人 + 3 张公共牌）
            </div>
            <div className="on-rolegrid">
              {ROLE_IDS.map(id => {
                const c = counts[id] || 0;
                const team = ROLES[id].team;
                return (
                  <div key={id} className={`px-role ${team === 'wolf' ? 'wolf' : team === 'loner' ? 'loner' : 'good'} ${c ? 'on' : ''}`} title={ROLE_BLURB[id]} data-testid={`role-${id}`}>
                    <Portrait role={ROLES[id].sprite} scale={1.25} />
                    <span className={`fs-12 ${c ? teamText(id) : ''}`}>{ROLES[id].zh}{c ? ` ×${c}` : ''}</span>
                    {isHost && (
                      <span className="on-step">
                        <button className="px-btn dark" disabled={!c} onClick={() => bump(id, -1)} aria-label={`减少${ROLES[id].zh}`} data-testid={`minus-${id}`}>－</button>
                        <button className="px-btn dark" disabled={c >= ROLES[id].max} onClick={() => bump(id, 1)} aria-label={`增加${ROLES[id].zh}`} data-testid={`plus-${id}`}>＋</button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-divider" />
            <VariantPanel rules={cfg.rules} isHost={isHost} setRule={setRule} update={update} />
          </div>}
        </div>

        {isHost ? (
          <div className="px-sticky-cta">
            <button className="px-btn gold lg block" disabled={busy || missing > 0 || !!d.error} onClick={start} data-testid="start-game">
              {missing > 0 ? `还差 ${missing} 人` : d.error ? '牌数不对' : `发牌开局 · ${cfg.counts ? '自定义' : boardName}`}
            </button>
          </div>
        ) : (
          <div className="px-frame pad text-center c-dim">等待房主开局…</div>
        )}
      </div>
    </div>
  );
}

function VariantPanel({ rules, isHost, setRule, update }) {
  const changed = changedRules(rules).length;
  return (
    <div data-testid="variants">
      <div className="flex items-center justify-between mb-3">
        <div className="fs-18 c-gold">规则变体</div>
        {changed > 0
          ? isHost && <button className="px-btn dark sm" onClick={() => update(r => { r.config = { ...r.config, rules: { ...DEFAULT_RULES } }; return r; })} data-testid="reset-rules">恢复标准</button>
          : <span className="px-tag">★ 常用规则</span>}
      </div>
      <div className="flex flex-col gap-3">
        {VARIANTS.map(v => {
          const cur = v.opts.find(o => o[0] === rules[v.key]) || v.opts[0];
          return (
            <div key={v.key}>
              <div className="fs-12 mb-1">{v.zh}</div>
              <div className="px-seg" role="radiogroup" aria-label={v.zh}>
                {v.opts.map(([val, label], i) => (
                  <button key={val} role="radio" aria-checked={rules[v.key] === val} disabled={!isHost}
                    className={rules[v.key] === val ? 'on' : ''} onClick={() => setRule(v.key, val)} data-testid={`rule-${v.key}-${val}`}>
                    {label}{i === 0 && <sup className="px-star-rec" title="常用">★</sup>}
                  </button>
                ))}
              </div>
              {cur[2] && <div className="fs-12 c-dim mt-1">{cur[2]}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RuleCard({ deck, rules = DEFAULT_RULES }) {
  const ids = ROLE_IDS.filter(id => deck.includes(id));
  return (
    <div className="fs-12 leading-relaxed mt-3 flex flex-col gap-2" data-testid="rule-card">
      <p><span className="c-gold">只有一夜。</span>每人一张牌，多出的 3 张扣在桌子中间（公共牌）。夜里按顺序睁眼：{WAKE_ORDER.filter(r => deck.includes(r)).map(r => ROLES[r].zh).join(' → ')}。每个人都按<span className="c-gold">发到的那张牌</span>行动，哪怕它已经被换走。</p>
      <p>手机上大家同时操作，结果和一个一个睁眼完全一样。公开时间线会念到牌组里的每个角色（包括可能在公共牌里的），谁也看不出谁在操作。</p>
      <p>天亮后讨论 {rules.talk} 分钟，然后同时投票{rules.selfVote === 'yes' ? '（可以投自己）' : '（不能投自己）'}，一起亮票。最高票出局；{rules.tie === 'all' ? '平票都出局' : '平票无人出局'}；没人超过 1 票就没人出局。猎人出局时，他投的人也出局。</p>
      <p><span className="c-good">好人</span>：投出至少一匹狼（场上没有狼时，没人出局才算赢）。<span className="c-evil">狼人和爪牙</span>：没有狼出局。<span className="c-loner">厌世者</span>：自己出局就赢，而且狼人不能赢。阵营看<span className="c-gold">最后手里</span>的牌。</p>
      <ul className="flex flex-col gap-1 mt-1">
        {ids.map(id => <li key={id}><span className={teamText(id)}>{ROLES[id].zh}</span>：{ROLE_BLURB[id]}</li>)}
      </ul>
    </div>
  );
}

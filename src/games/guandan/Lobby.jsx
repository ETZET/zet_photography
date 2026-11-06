import { useState } from 'react';
import PixelSprite from '../pixel/PixelSprite';
import RoundTable from '../avalon/RoundTable';
import { roomLink } from '../../route';
import { requestSwap, answerSwap, cancelSwap, hostSwap, pendingFrom, pendingTo } from '../room/seats';
import { Who, useConfirm } from '../avalon/ui';
import { PLAYERS, VARIANTS, DEFAULT_RULES, changedRules, newGame } from './guandanRules';
import { addBot } from './bots';
import { RuleCard } from './RuleCard';
import './guandan.css';

const IS_DEV = import.meta.env.DEV;
export const TEAM_ZH = ['红队', '蓝队'];

export default function Lobby({ room, myId, update, busy }) {
  const confirm = useConfirm();
  const isHost = room.hostId === myId;
  const n = room.players.length;
  const missing = PLAYERS - n;
  const rules = { ...DEFAULT_RULES, ...(room.rules || {}) };
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [picked, setPicked] = useState(null);
  const outgoing = pendingFrom(room, myId);
  const incoming = pendingTo(room, myId);
  const name = id => room.players.find(p => p.id === id)?.name || '?';
  const seatNo = id => room.players.findIndex(p => p.id === id) + 1;
  const partnerName = id => { const i = seatNo(id) - 1; return room.players[(i + 2) % 4]?.name; };

  const copy = async () => {
    try { await navigator.clipboard.writeText(roomLink('guandan', room.code)); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const onSeat = async id => {
    if (isHost) {
      if (!picked) { setPicked(id); return; }
      if (picked !== id) update(r => hostSwap(r, picked, id));
      setPicked(null);
      return;
    }
    const ok = await confirm({ title: '请求换位', body: <>想和 <Who id={id} /> 换位吗？换完你的对家（队友）会变。对方同意后生效。</>, ok: '发送请求' });
    if (ok) update(r => requestSwap(r, myId, id));
  };
  const canTapSeat = id => id !== room.hostId && (isHost || (id !== myId && seatNo(myId) > 1));
  const kick = async id => {
    const ok = await confirm({ title: '移出房间', body: <>确定把 <Who id={id} /> 移出房间吗？</>, ok: '移出', tone: 'danger' });
    if (ok) update(r => { r.players = r.players.filter(p => p.id !== id); return r; });
  };
  const start = () => update(r => {
    if (r.players.length !== PLAYERS) throw new Error('掼蛋要正好 4 个人');
    r.game = newGame(r.players, { ...DEFAULT_RULES, ...(r.rules || {}) });
    r.phase = 'game';
    r.round = (r.round || 0) + 1;
    return r;
  });
  const setRule = (key, val) => isHost && update(r => { r.rules = { ...DEFAULT_RULES, ...(r.rules || {}), [key]: val }; return r; });
  const changed = changedRules(rules).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] items-start">
      <div className="px-frame pad">
        <div className="px-title">牌桌 · {n}/{PLAYERS} 人</div>
        <RoundTable
          seats={room.players}
          capacity={PLAYERS}
          myId={myId}
          onSeatClick={onSeat}
          decorate={(id, i) => ({
            top: <>
              {id === room.hostId && <PixelSprite name="crown" scale={2} title="房主" />}
              <span className={`px-tag whitespace-nowrap gd-team${i % 2}`}>{TEAM_ZH[i % 2][0]}</span>
            </>,
            clickable: canTapSeat(id),
            cls: picked === id || outgoing?.to === id ? 'picked' : '',
            corner: isHost && id !== myId
              ? <span className="px-kick" role="button" tabIndex={0} onClick={e => { e.stopPropagation(); kick(id); }} title="移出房间" aria-label="移出房间" data-testid="kick">✕</span>
              : null,
          })}
          center={
            <>
              <div className="fs-24 c-gold shadow-px">{missing > 0 ? `还差 ${missing} 人` : '人齐了！'}</div>
              <div className="fs-12 c-dim">对家是队友</div>
            </>
          }
        />
        <div className="fs-12 text-center mt-8 sm:mt-4" data-testid="teams">
          <span className="gd-team0-text">1·3 号 {TEAM_ZH[0]}</span><span className="c-mute"> vs </span><span className="gd-team1-text">2·4 号 {TEAM_ZH[1]}</span>
          {n === PLAYERS && <div className="c-dim mt-1">你的队友：{partnerName(myId)}</div>}
        </div>
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
              ? (picked ? <>已选 {name(picked)}，再点一个座位和他换（再点他取消）</> : '点两个座位给他们换位，挑队友；1 号固定是房主')
              : '点别人的座位可以请求换位；1 号固定是房主'}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          <button className="px-btn blue" onClick={copy}>{copied ? '已复制 ✓' : '复制邀请链接'}</button>
          {isHost && IS_DEV && n < PLAYERS && (
            <button className="px-btn dark sm" onClick={() => update(addBot)} data-testid="add-bot">+ 机器人（仅本地）</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="px-frame pad" data-testid="variants">
          <div className="flex items-center justify-between mb-3">
            <div className="px-title !mb-0 flex-1">规则</div>
            {changed > 0
              ? isHost && <button className="px-btn dark sm" onClick={() => update(r => { r.rules = { ...DEFAULT_RULES }; return r; })} data-testid="reset-rules">恢复标准</button>
              : <span className="px-tag">★ 标准规则</span>}
          </div>
          <p className="fs-12 c-dim mb-3">各地掼蛋有些不一样，{isHost ? '开局前和大家商量好。' : '由房主设置。'}</p>
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
          <button className="underline fs-12 c-dim mt-3" onClick={() => setShowRules(v => !v)} data-testid="toggle-rules">
            {showRules ? '收起玩法' : '查看玩法说明'}
          </button>
          {showRules && <RuleCard rules={rules} />}
        </div>

        {isHost ? (
          <div className="px-sticky-cta">
            <button className="px-btn gold lg block" disabled={busy || missing !== 0} onClick={start} data-testid="start-game">
              {missing > 0 ? `还差 ${missing} 人` : '发牌开局'}
            </button>
          </div>
        ) : (
          <div className="px-frame pad text-center c-dim">等待房主开局…</div>
        )}
      </div>
    </div>
  );
}

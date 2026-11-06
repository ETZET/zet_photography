import { useState } from 'react';
import PixelSprite from '../pixel/PixelSprite';
import RoundTable from '../avalon/RoundTable';
import { roomLink } from '../../route';
import { requestSwap, answerSwap, cancelSwap, hostSwap, pendingFrom, pendingTo } from '../room/seats';
import { Who, useConfirm } from '../avalon/ui';
import { VARIANTS, DEFAULT_RULES, PRESETS, presetRules, presetOf, changedRules, newGame } from './shengjiRules';
import { addBot, MAX_PLAYERS } from './bots';
import { RulesText } from './Board';
import { CardRow } from './cards';

const IS_DEV = import.meta.env.DEV;
const TEAM = [{ zh: '甲队', cls: 'team0' }, { zh: '乙队', cls: 'team1' }];

export default function Lobby({ room, myId, update, busy }) {
  const confirm = useConfirm();
  const isHost = room.hostId === myId;
  const n = room.players.length;
  const missing = Math.max(0, MAX_PLAYERS - n);
  const rules = { ...DEFAULT_RULES, ...(room.config?.rules || {}) };
  const preset = presetOf(rules);
  const [diy, setDiy] = useState(preset === 'custom');
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const [picked, setPicked] = useState(null);
  const outgoing = pendingFrom(room, myId);
  const incoming = pendingTo(room, myId);
  const name = id => room.players.find(p => p.id === id)?.name || '?';
  const seatNo = id => room.players.findIndex(p => p.id === id) + 1;

  const copy = async () => {
    try { await navigator.clipboard.writeText(roomLink('shengji', room.code)); } catch { /* ignore */ }
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
    const ok = await confirm({ title: '请求换位', body: <>想和 <Who id={id} /> 换位吗？你在 {seatNo(myId)} 号，他在 {seatNo(id)} 号。对方同意后生效。</>, ok: '发送请求' });
    if (ok) update(r => requestSwap(r, myId, id));
  };
  const canTapSeat = id => id !== room.hostId && (isHost || (id !== myId && seatNo(myId) > 1));
  const kick = async id => {
    const ok = await confirm({ title: '移出房间', body: <>确定把 <Who id={id} /> 移出房间吗？</>, ok: '移出', tone: 'danger' });
    if (ok) update(r => { r.players = r.players.filter(p => p.id !== id); return r; });
  };
  const setRule = (key, val) => isHost && update(r => { r.config = { ...(r.config || {}), rules: { ...DEFAULT_RULES, ...(r.config?.rules || {}), [key]: val } }; return r; });
  const pickPreset = id => isHost && update(r => { r.config = { ...(r.config || {}), rules: presetRules(id) }; return r; });
  const start = () => update(r => {
    if (r.players.length !== MAX_PLAYERS) throw new Error('升级要正好 4 个人');
    const timeScale = window.__sjTimeScale ?? 1;
    r.game = newGame(r.players, { rules: { ...DEFAULT_RULES, ...(r.config?.rules || {}) }, timeScale });
    r.phase = 'game';
    r.round = (r.round || 0) + 1;
    return r;
  });
  const teamOfSeat = i => i % 2;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] items-start">
      <div className="px-frame pad">
        <div className="px-title">牌桌 · {n}/{MAX_PLAYERS} 人</div>
        <RoundTable
          seats={room.players}
          capacity={MAX_PLAYERS}
          myId={myId}
          onSeatClick={onSeat}
          decorate={id => {
            const i = room.players.findIndex(p => p.id === id);
            return {
              top: <>{id === room.hostId && <PixelSprite name="crown" scale={2} title="房主" />}<span className={`px-tag ${TEAM[teamOfSeat(i)].cls}`}>{TEAM[teamOfSeat(i)].zh}</span></>,
              clickable: canTapSeat(id),
              cls: picked === id || outgoing?.to === id ? 'picked' : '',
              corner: isHost && id !== myId
                ? <span className="px-kick" role="button" tabIndex={0} onClick={e => { e.stopPropagation(); kick(id); }} title="移出房间" aria-label="移出房间" data-testid="kick">✕</span>
                : null,
            };
          }}
          center={
            <>
              <div className="fs-24 c-gold shadow-px">{missing > 0 ? `还差 ${missing} 人` : '人齐了！'}</div>
              <div className="fs-12 c-dim">对面坐的是队友：<span className="sj-team0">1·3 号甲队</span> <span className="sj-team1">2·4 号乙队</span></div>
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
              ? (picked ? <>已选 {name(picked)}，再点一个座位和他换（再点他取消）</> : '换座位就是换队友：点两个座位给他们换；1 号固定是房主')
              : '想和谁做队友？点他对面的人请求换位；1 号固定是房主'}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          <button className="px-btn blue" onClick={copy}>{copied ? '已复制 ✓' : '复制邀请链接'}</button>
          {isHost && IS_DEV && n < MAX_PLAYERS && (
            <button className="px-btn dark sm" onClick={() => update(addBot)} data-testid="add-bot">+ 机器人（仅本地）</button>
          )}
        </div>
        <div className="fs-12 c-mute text-center mt-2">游戏中请把手机横过来玩</div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="px-frame pad" data-testid="presets">
          <div className="px-title">{isHost ? '选择玩法' : '本局玩法'}</div>
          {!isHost && <div className="fs-12 c-dim mb-2">由房主选择</div>}
          <div className="flex flex-col">
            {PRESETS.filter(p => isHost || preset === p.id).map(p => {
              const on = preset === p.id;
              return (
                <button key={p.id} className={`px-role row good ${on ? 'on' : ''}`} disabled={!isHost} aria-pressed={on} onClick={() => pickPreset(p.id)} data-testid={`preset-${p.id}`}>
                  <span className="flex flex-col gap-1 w-full">
                    <span>{on ? '● ' : '○ '}{p.zh}</span>
                    <span className="fs-12 c-dim">{p.desc}</span>
                  </span>
                </button>
              );
            })}
            {preset === 'custom' && (
              <div className="px-role row good on" data-testid="preset-custom">
                <span className="flex flex-col gap-1">
                  <span>● 自定义</span>
                  <span className="fs-12 c-dim">在下面「自定义 DIY」里改过的规则：{changedRules(rules).map(v => v.zh).join('、')}</span>
                </span>
              </div>
            )}
          </div>
          <button className="underline fs-12 c-dim mt-3" onClick={() => setShowRules(v => !v)} data-testid="toggle-rules">
            {showRules ? '收起规则' : '查看完整规则'}
          </button>
          {showRules && <RuleCard rules={rules} />}
        </div>

        <div className="px-frame pad" data-testid="diy">
          <button className="w-full flex items-center justify-between text-left" onClick={() => setDiy(v => !v)} aria-expanded={diy} data-testid="toggle-diy">
            <span className="px-title !mb-0">{diy ? '▾' : '▸'} 自定义 DIY</span>
            <span className="fs-12 c-mute">{diy ? '收起' : '甩牌、扣底、必打…'}</span>
          </button>
          {diy && <div className="mt-4"><VariantPanel rules={rules} isHost={isHost} update={update} onSet={setRule} /></div>}
        </div>

        {isHost ? (
          <div className="px-sticky-cta">
            <button className="px-btn gold lg block" disabled={busy || n !== MAX_PLAYERS} onClick={start} data-testid="start-game">
              {missing > 0 ? `还差 ${missing} 人` : `发牌开局 · ${PRESETS.find(p => p.id === preset)?.zh || '自定义'}`}
            </button>
          </div>
        ) : (
          <div className="px-frame pad text-center c-dim">等待房主开局…</div>
        )}
      </div>
    </div>
  );
}

function RuleCard({ rules }) {
  return (
    <div className="fs-12 leading-relaxed mt-3 flex flex-col gap-2" data-testid="rule-card">
      <p><span className="c-gold">两副牌 108 张，</span>每人 25 张，留 8 张底牌。对面坐的是队友。两队都从 {rules.start === 'T' ? '10' : rules.start} 开始，庄家这一方打自己的级。</p>
      <p><span className="c-gold">亮主：</span>发牌时谁有级牌就可以亮出来定主花色；第一局谁亮的主谁当庄。庄家拿底牌，再扣 8 张回去。</p>
      <p><span className="c-gold">大小：</span>大王 &gt; 小王 &gt; 主花色级牌 &gt; 其他级牌 &gt; 主花色 A…2；王、级牌都算主。</p>
      <div className="flex items-center gap-2 flex-wrap"><CardRow ids={['XB0', 'XS0', 'S20', 'H20', 'SA0', 'SK0', 'S30']} ctx={{ level: '2', trump: 'S', bridge: 'skip' }} size="sm" maxW={200} /><span className="c-dim">打 2、♠ 主</span></div>
      <p><span className="c-gold">出牌：</span>首家出单张、对子、拖拉机（相连的对子）{rules.throw === 'yes' ? '或甩牌' : ''}；其他人必须跟同门，有对跟对，有拖拉机跟拖拉机；没有这门可以用主牌毙。</p>
      <p><span className="c-gold">分数：</span>5 = 5 分，10 和 K = 10 分，共 200 分。闲家抓到 80 分上台。</p>
      <RulesText rules={rules} />
      <table className="w-full sj-tbl mt-1"><tbody>
        {[['0', '庄家升 3 级'], ['5–35', '庄家升 2 级'], ['40–75', '庄家升 1 级'], ['80–115', '闲家上台'], ['120–155', '闲家上台升 1 级'], ['160–195', '闲家上台升 2 级'], ['200+', '闲家上台升 3 级，每多 40 再升 1']].map(([a, b]) => (
          <tr key={a}><td className="c-gold">闲家 {a} 分</td><td className="c-dim">{b}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}

function VariantPanel({ rules, isHost, update, onSet }) {
  const changed = changedRules(rules).length;
  return (
    <div data-testid="variants">
      <div className="flex items-center justify-between mb-3">
        <div className="fs-18 c-gold">规则变体</div>
        {changed > 0
          ? isHost && <button className="px-btn dark sm" onClick={() => update(r => { r.config = { ...(r.config || {}), rules: { ...DEFAULT_RULES } }; return r; })} data-testid="reset-rules">恢复标准</button>
          : <span className="px-tag">★ 常用规则</span>}
      </div>
      <p className="fs-12 c-dim mb-3">升级各地打法不一样，{isHost ? '开局前和大家商量好再选。★ 是最常见的打法。' : '由房主设置。'}</p>
      <div className="flex flex-col gap-3">
        {VARIANTS.map(v => {
          const cur = v.opts.find(o => o[0] === rules[v.key]) || v.opts[0];
          const off = v.key === 'penalty' && rules.throw === 'no';
          return (
            <div key={v.key} className={off ? 'opacity-50' : ''}>
              <div className="fs-12 mb-1">{v.zh}{off ? '（不能甩牌时用不到）' : ''}</div>
              <div className="px-seg" role="radiogroup" aria-label={v.zh}>
                {v.opts.map(([val, label], i) => (
                  <button key={val} role="radio" aria-checked={rules[v.key] === val} disabled={!isHost}
                    className={rules[v.key] === val ? 'on' : ''} onClick={() => onSet(v.key, val)} data-testid={`rule-${v.key}-${val}`}>
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


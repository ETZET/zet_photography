import { useState } from 'react';
import PixelSprite, { Portrait } from '../pixel/PixelSprite';
import RoundTable from '../avalon/RoundTable';
import { roomLink } from '../../route';
import { IS_LOCAL } from '../avalon/roomStore';
import { requestSwap, answerSwap, cancelSwap, hostSwap, pendingFrom, pendingTo } from '../room/seats';
import { Who, useConfirm } from '../avalon/ui';
import {
  ROLES, ROLE_BLURB, GODS, MIN_PLAYERS, MAX_PLAYERS, RECOMMENDED, buildDeck, effectiveConfig, newGame,
  VARIANTS, DEFAULT_RULES, changedRules, balanceFor, PRESETS, presetRules, presetOf,
} from './wolfRules';
import { addBot } from './bots';

const IS_DEV = import.meta.env.DEV;
const inviteLink = code => roomLink('werewolf', code);

export function DeckLine({ deck }) {
  const counts = deck.reduce((a, c) => ({ ...a, [c]: (a[c] || 0) + 1 }), {});
  return Object.entries(counts).map(([id, c]) => (
    <span key={id} className={`${ROLES[id].team === 'wolf' ? 'c-evil' : ROLES[id].god ? 'c-gold' : 'c-good'} mr-2 whitespace-nowrap`}>
      {ROLES[id].zh}{c > 1 ? `×${c}` : ''}
    </span>
  ));
}

export default function Lobby({ room, myId, update, busy }) {
  const confirm = useConfirm();
  const isHost = room.hostId === myId;
  const n = room.players.length;
  const tableN = Math.min(Math.max(n, MIN_PLAYERS), MAX_PLAYERS);
  const cfg = effectiveConfig(tableN, room.config);
  const deck = buildDeck(tableN, cfg);
  const missing = Math.max(0, MIN_PLAYERS - n);
  const bal = deck.error ? null : balanceOf(tableN, cfg);
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const preset = presetOf(room.config);
  const [diy, setDiy] = useState(preset === 'custom');
  const pickPreset = id => isHost && update(r => { r.config = { preset: id, auto: true, rules: presetRules(id) }; return r; });

  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteLink(room.code)); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const custom = fn => isHost && update(r => {
    const cur = effectiveConfig(tableN, r.config);
    r.config = { ...r.config, preset: 'custom', rules: cur.rules, wolves: cur.wolves, gods: [...cur.gods], auto: false };
    fn(r.config);
    return r;
  });
  const toggleGod = id => custom(c => { c.gods = c.gods.includes(id) ? c.gods.filter(x => x !== id) : GODS.filter(x => x === id || c.gods.includes(x)); });
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
    if (bal?.level === 'extreme' && !await confirm({
      title: '配置非常不平衡',
      body: <>模拟估算好人胜率{bal.good > 50 ? '高达' : '只有'}约 <b>{bal.approx ? '<10' : bal.good}%</b>{bal.good > 50 ? '（好人几乎必胜）' : '（狼人几乎必胜）'}。<div className="fs-12 c-dim mt-2">{bal.rec ? '这套规则在这个人数下很难配平，可以换一个板子。' : '可以选一个常用板子，牌组是调好的。'}确定还是用这个配置开局吗？</div></>,
      ok: '仍然开局', cancel: '回去调整', tone: 'danger',
    })) return;
    doStart();
  };
  const doStart = () => update(r => {
    // local multi-tab testing runs nights fast; real rooms use real-time pacing
    const timeScale = window.__wwTimeScale ?? (IS_LOCAL ? 0.15 : 1);
    r.game = newGame(r.players, { ...effectiveConfig(r.players.length, r.config), timeScale });
    r.phase = 'game';
    r.round = (r.round || 0) + 1;
    return r;
  });

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
              <div className="fs-12 c-dim">{isHost ? (missing > 0 ? '把邀请链接发给朋友' : '配好牌就能开局') : '等待房主开局…'}</div>
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
          <div className="px-title">{isHost ? '选择板子' : '本局板子'} · {tableN} 人</div>
          {n < MIN_PLAYERS && <div className="fs-12 c-mute mb-2">按 {tableN} 人预览</div>}
          {!isHost && <div className="fs-12 c-dim mb-2">由房主选择</div>}
          <div className="flex flex-col">
            {PRESETS.map(p => {
              const pc = effectiveConfig(tableN, { auto: true, rules: presetRules(p.id) });
              return { p, pc, pb: balanceOf(tableN, pc) };
            })
              // balanced boards first; boards that can't be balanced at this size sink to the bottom
              .sort((a, b) => (a.pb?.level !== 'ok') - (b.pb?.level !== 'ok'))
              .filter(({ p }) => isHost || preset === p.id)
              .map(({ p, pc, pb }) => {
              const on = preset === p.id;
              const off = pb && pb.level !== 'ok';
              return (
                <button key={p.id} className={`px-role row good ${on ? 'on' : ''} ${off && !on ? 'opacity-60' : ''}`} disabled={!isHost} aria-pressed={on}
                  onClick={() => pickPreset(p.id)} data-testid={`preset-${p.id}`}>
                  <span className="flex flex-col gap-1 w-full">
                    <span className="flex justify-between gap-2">
                      <span>{on ? '● ' : '○ '}{p.zh}</span>
                      {pb && <span className={`fs-12 ${pb.level === 'ok' ? 'c-dim' : 'c-evil'}`}>好人胜率 ≈{pb.good}%{pb.level !== 'ok' ? ' ⚠' : ''}</span>}
                    </span>
                    <span className="fs-12 c-dim">{p.desc}</span>
                    {off && <span className="fs-12 c-evil">{tableN} 人时{pb.good > 50 ? '偏好人' : '偏狼人'}，换个人数或板子更好</span>}
                    <span className="fs-12 leading-loose"><DeckLine deck={buildDeck(tableN, pc).cards || []} /></span>
                  </span>
                </button>
              );
            })}
            {preset === 'custom' && (
              <div className="px-role row good on" data-testid="preset-custom">
                <span className="flex flex-col gap-1">
                  <span>● 自定义</span>
                  <span className="fs-12 c-dim">在下面的「自定义 DIY」里改过的牌组或规则。</span>
                </span>
              </div>
            )}
          </div>

          {deck.cards && <div className="fs-12 c-dim mt-3 leading-loose" data-testid="deck">本局：<DeckLine deck={deck.cards} /></div>}
          {deck.error && <div className="px-tag evil fs-12 mt-3">{deck.error}</div>}
          <BalanceBar bal={bal} auto={cfg.auto} />
          <button className="underline fs-12 c-dim mt-3" onClick={() => setShowRules(v => !v)} data-testid="toggle-rules">
            {showRules ? '收起规则' : '查看本局规则 / 各人数推荐'}
          </button>
          {showRules && <RuleCard tableN={tableN} rules={cfg.rules} />}
        </div>

        <div className="px-frame pad" data-testid="diy">
          <button className="w-full flex items-center justify-between text-left" onClick={() => setDiy(v => !v)} aria-expanded={diy} data-testid="toggle-diy">
            <span className="px-title !mb-0">{diy ? '▾' : '▸'} 自定义 DIY</span>
            <span className="fs-12 c-mute">{diy ? '收起' : '牌组 + 规则变体'}</span>
          </button>
          {diy && <div className="mt-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="px-portrait-bg"><Portrait role="wolf" scale={1.5} /></div>
              <div className="flex-1">
                <div>狼人牌 <span className="c-evil fs-24 ml-1" data-testid="wolf-count">{cfg.wolves}</span> 张 <span className="fs-12 c-mute">/ 共 {2 * tableN} 张</span></div>
                <div className="fs-12 c-dim">有一张狼牌就是狼人阵营</div>
              </div>
              {isHost && <>
                <button className="px-btn dark sm" disabled={cfg.wolves <= 1} onClick={() => custom(c => { c.wolves -= 1; })} aria-label="减少狼牌" data-testid="wolf-minus">－</button>
                <button className="px-btn dark sm" disabled={cfg.wolves >= tableN - 1} onClick={() => custom(c => { c.wolves += 1; })} aria-label="增加狼牌" data-testid="wolf-plus">＋</button>
              </>}
            </div>
            <div className="grid grid-cols-4 gap-1">
              {GODS.map(id => {
                const on = cfg.gods.includes(id);
                return (
                  <button key={id} className={`px-role good ${on ? 'on' : ''}`} onClick={() => toggleGod(id)} disabled={!isHost} title={ROLE_BLURB[id]} aria-pressed={on} data-testid={`god-${id}`}>
                    <Portrait role={ROLES[id].sprite} scale={1.5} />
                    <span className="fs-12">{ROLES[id].zh}</span>
                    <span className={`fs-12 ${on ? 'c-good' : 'c-mute'}`}>{on ? '●' : '○'}</span>
                  </button>
                );
              })}
            </div>
            <div className="px-divider" />
            <VariantPanel rules={cfg.rules} isHost={isHost} update={update} />
            <BalanceBar bal={bal} auto={cfg.auto} />
          </div>}
        </div>

        {isHost ? (
          <div className="px-sticky-cta">
            <button className="px-btn gold lg block" disabled={busy || missing > 0 || !!deck.error} onClick={start} data-testid="start-game">
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

export function RuleCard({ tableN, rules = DEFAULT_RULES }) {
  const camp = rules.seer === 'camp';
  return (
    <div className="fs-12 leading-relaxed mt-3 flex flex-col gap-2" data-testid="rule-card">
      <p><span className="c-gold">两张牌 = 两条命。</span>上面那张是你当前的身份，它出局后下面那张才生效。{rules.order === 'random' ? '本局顺序随机，不能调换。' : '发牌后自己排顺序。'}</p>
      <p><span className="c-evil">有一张狼牌就是狼人阵营。</span>{rules.wake === 'all' ? '狼牌不管在上面还是下面，晚上都睁眼刀人。' : '只有翻在上面的狼牌晚上能睁眼刀人。'}</p>
      <p>预言家验到的是{camp ? <span className="c-gold">阵营</span> : <span className="c-gold">当前那张牌</span>}。{rules.reveal === 'show' ? '失去一条命时亮出那张牌。' : '出局只公布少了一条命，不亮牌。'}</p>
      <p>好人：所有狼牌出局{rules.peace === 'three' ? '，或连续三个平安夜' : ''}。狼人：{({
        city: '屠城，好人阵营全部出局。',
        baby: '金宝宝（两张都是村民的人，开局互相认识）全部出局，或好人的神牌全灭。',
      })[rules.win] || '屠边，好人阵营的村民牌全灭，或神牌全灭。'}</p>
      <p className="c-dim">
        没有警长，发言顺序由手机决定；{rules.pk === 'yes' ? '平票的人 PK 再投一次' : '平票无人出局'}；女巫{({ never: '不能自救', first: '只有首夜能自救', always: '可以自救' })[rules.selfSave]}、一晚只能用一瓶；
        守卫不能连守，同守同救{rules.guardSave === 'dies' ? '会死' : '不死'}{rules.mute === 'yes' ? '；夜里失去第一条命的人当天不能投票' : ''}。
      </p>
      <table className="w-full border-collapse mt-1">
        <tbody>
          {Object.keys(RECOMMENDED).map(k => {
            const cfg = effectiveConfig(Number(k), { auto: true, rules });
            const d = buildDeck(Number(k), cfg).cards || [];
            const b = balanceOf(Number(k), cfg);
            return (
              <tr key={k} className={Number(k) === tableN ? 'c-gold' : ''}>
                <td className="pr-2 py-1 align-top whitespace-nowrap">{k} 人</td>
                <td className="py-1"><DeckLine deck={d} /></td>
                <td className="py-1 pl-2 text-right whitespace-nowrap c-dim">{b ? `${b.good}%` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VariantPanel({ rules, isHost, update }) {
  const changed = changedRules(rules).length;
  const set = (key, val) => isHost && update(r => { r.config = { ...r.config, preset: 'custom', rules: { ...DEFAULT_RULES, ...(r.config.rules || {}), [key]: val } }; delete r.config.order; return r; });
  return (
    <div data-testid="variants">
      <div className="flex items-center justify-between mb-3">
        <div className="fs-18 c-gold">规则变体</div>
        {changed > 0
          ? isHost && <button className="px-btn dark sm" onClick={() => update(r => { r.config = { preset: 'standard', auto: true, rules: { ...DEFAULT_RULES } }; return r; })} data-testid="reset-rules">恢复标准</button>
          : <span className="px-tag">★ 常用规则</span>}
      </div>
      <p className="fs-12 c-dim mb-3">双身份玩法各地不一样，{isHost ? '开局前和大家商量好再选。' : '由房主设置。'}</p>
      <div className="flex flex-col gap-3">
        {VARIANTS.map(v => {
          const cur = v.opts.find(o => o[0] === rules[v.key]) || v.opts[0];
          return (
            <div key={v.key}>
              <div className="fs-12 mb-1">{v.zh}</div>
              <div className="px-seg" role="radiogroup" aria-label={v.zh}>
                {v.opts.map(([val, label], i) => (
                  <button key={val} role="radio" aria-checked={rules[v.key] === val} disabled={!isHost}
                    className={rules[v.key] === val ? 'on' : ''} onClick={() => set(v.key, val)} data-testid={`rule-${v.key}-${val}`}>
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

/** Good-camp win % for this deck from the pre-computed simulation table (null if not covered). */
export function balanceOf(n, cfg) {
  const b = balanceFor(n, cfg.rules);
  if (!b) return null;
  const mask = GODS.reduce((m, id, i) => (cfg.gods.includes(id) ? m | (1 << i) : m), 0);
  const isRec = cfg.wolves === b.wolves && mask === GODS.reduce((m, id, i) => (b.gods.includes(id) ? m | (1 << i) : m), 0);
  let good = isRec ? b.good : b.grid[`${cfg.wolves}:${mask}`];
  // the simulation only covers up to half the table as wolf cards; beyond that wolves steamroll
  if (good == null && cfg.wolves > Math.ceil(n / 2)) return { good: 5, approx: true, rec: false, level: 'extreme' };
  if (good == null) return null;
  const off = Math.abs(good - 50);
  return { good, days: isRec ? b.days : null, rec: isRec, level: off >= 25 ? 'extreme' : off >= 15 ? 'warn' : 'ok' };
}

function BalanceBar({ bal, auto }) {
  if (!bal) return <div className="fs-12 c-mute mt-3" data-testid="balance">这个牌组没有平衡估算。</div>;
  const { good, level } = bal;
  const side = good > 50 ? '好人' : '狼人';
  const verdict = level === 'ok' ? ['均衡', 'c-gold'] : level === 'warn' ? [`偏${side}`, good > 50 ? 'c-good' : 'c-evil'] : [`严重偏${side}`, good > 50 ? 'c-good' : 'c-evil'];
  return (
    <div className="mt-3" data-testid="balance" data-level={level}>
      <div className="flex justify-between fs-12 mb-1">
        <span>平衡估算 <span className={verdict[1]}>{verdict[0]}</span></span>
        <span className="c-dim">{bal.approx ? '狼牌超过一半人数' : `好人胜率约 ${good}%`}{bal.days ? ` · 平均 ${bal.days} 天` : ''}</span>
      </div>
      <div className="px-balance" aria-hidden><i style={{ width: `${good}%` }} /></div>
      {level !== 'ok' && (
        <div className={`px-tag ${level === 'extreme' ? 'evil' : 'gold'} fs-12 mt-2 block`} data-testid="balance-warning">
          ⚠ {level === 'extreme' ? `这个配置非常不平衡，${side}几乎必胜。` : `这个配置明显偏${side}。`}
          {bal.rec ? '这套规则在这个人数下怎么配牌都很难配平，建议换一个板子。' : '建议选一个上面的常用板子。'}
        </div>
      )}
      <div className="fs-12 c-mute mt-1">
        离线模拟（中等水平 AI）估算，仅供参考。{auto ? '当前是按人数和规则变体调好的推荐牌组。' : ''}
      </div>
    </div>
  );
}

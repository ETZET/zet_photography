import { useState } from 'react';
import PixelSprite, { Portrait } from '../pixel/PixelSprite';
import RoundTable from '../avalon/RoundTable';
import { IS_LOCAL } from '../avalon/roomStore';
import { Who, useConfirm } from '../avalon/ui';
import {
  ROLES, ROLE_BLURB, GODS, MIN_PLAYERS, MAX_PLAYERS, RECOMMENDED, buildDeck, effectiveConfig, newGame,
  VARIANTS, DEFAULT_RULES, changedRules,
} from './wolfRules';
import { addBot } from './bots';

const IS_DEV = import.meta.env.DEV;
const inviteLink = code => `${window.location.origin}${window.location.pathname}?game=werewolf&room=${code}${IS_LOCAL ? '&local=1' : ''}`;

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
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteLink(room.code)); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const custom = fn => isHost && update(r => {
    const cur = effectiveConfig(tableN, r.config);
    r.config = { ...r.config, wolves: cur.wolves, gods: [...cur.gods], auto: false };
    fn(r.config);
    return r;
  });
  const toggleGod = id => custom(c => { c.gods = c.gods.includes(id) ? c.gods.filter(x => x !== id) : GODS.filter(x => x === id || c.gods.includes(x)); });
  const kick = async id => {
    const ok = await confirm({ title: '移出房间', body: <>确定把 <Who id={id} /> 移出房间吗？</>, ok: '移出', tone: 'danger' });
    if (ok) update(r => { r.players = r.players.filter(p => p.id !== id); return r; });
  };
  const start = () => update(r => {
    r.game = newGame(r.players, effectiveConfig(r.players.length, r.config));
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
          decorate={id => ({
            top: id === room.hostId ? <PixelSprite name="crown" scale={2} title="房主" /> : null,
            corner: isHost && id !== myId
              ? <span className="px-kick" role="button" tabIndex={0} onClick={() => kick(id)} title="移出房间" aria-label="移出房间" data-testid="kick">✕</span>
              : null,
          })}
          center={
            <>
              <div className="fs-24 c-gold shadow-px">{missing > 0 ? `还差 ${missing} 人` : '人齐了！'}</div>
              <div className="fs-12 c-dim">{isHost ? (missing > 0 ? '把邀请链接发给朋友' : '配好牌就能开局') : '等待房主开局…'}</div>
            </>
          }
        />
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          <button className="px-btn blue" onClick={copy}>{copied ? '已复制 ✓' : '复制邀请链接'}</button>
          {isHost && IS_DEV && n < MAX_PLAYERS && (
            <button className="px-btn dark sm" onClick={() => update(addBot)} data-testid="add-bot">+ 机器人（仅本地）</button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="px-frame pad">
          <div className="px-title">牌组 · {2 * tableN} 张（每人 2 张）</div>
          <div className="flex flex-wrap items-center gap-2 mb-4 fs-12">
            {n < MIN_PLAYERS && <span className="c-mute">按 {tableN} 人预览</span>}
            <span className="flex-1" />
            {cfg.auto
              ? <span className="px-tag" data-testid="auto-tag">★ {tableN} 人推荐</span>
              : isHost && (
                <button className="px-btn dark sm" data-testid="use-recommended" onClick={() => update(r => { r.config = { rules: r.config.rules, auto: true }; return r; })}>
                  恢复 {tableN} 人推荐
                </button>
              )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="px-portrait-bg"><Portrait role="wolf" scale={1.5} /></div>
            <div className="flex-1">
              <div>狼人牌 <span className="c-evil fs-24 ml-1" data-testid="wolf-count">{cfg.wolves}</span> 张</div>
              <div className="fs-12 c-dim">有一张狼牌就是狼人阵营</div>
            </div>
            {isHost && <>
              <button className="px-btn dark sm" disabled={cfg.wolves <= 1} onClick={() => custom(c => { c.wolves -= 1; })} aria-label="减少狼牌">－</button>
              <button className="px-btn dark sm" disabled={cfg.wolves >= tableN - 1} onClick={() => custom(c => { c.wolves += 1; })} aria-label="增加狼牌">＋</button>
            </>}
          </div>

          <div className="grid grid-cols-4 gap-1">
            {GODS.map(id => {
              const on = cfg.gods.includes(id);
              return (
                <button key={id} className={`px-role good ${on ? 'on' : ''}`} onClick={() => toggleGod(id)} disabled={!isHost} title={ROLE_BLURB[id]} aria-pressed={on}>
                  <Portrait role={ROLES[id].sprite} scale={1.5} />
                  <span className="fs-12">{ROLES[id].zh}</span>
                  <span className={`fs-12 ${on ? 'c-good' : 'c-mute'}`}>{on ? '●' : '○'}</span>
                </button>
              );
            })}
          </div>
          {deck.cards && (
            <div className="fs-12 c-dim mt-4 leading-loose" data-testid="deck">本局：<DeckLine deck={deck.cards} /></div>
          )}
          {deck.error && <div className="px-tag evil fs-12 mt-3">{deck.error}</div>}

          <button className="underline fs-12 c-dim mt-3" onClick={() => setShowRules(v => !v)} data-testid="toggle-rules">
            {showRules ? '收起规则' : '查看双身份规则 / 各人数推荐'}
          </button>
          {showRules && <RuleCard tableN={tableN} rules={cfg.rules} />}
        </div>

        <VariantPanel rules={cfg.rules} isHost={isHost} update={update} />

        {isHost ? (
          <button className="px-btn gold lg block" disabled={busy || missing > 0 || !!deck.error} onClick={start} data-testid="start-game">
            {missing > 0 ? `还差 ${missing} 人` : '发牌开局'}
          </button>
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
      <p>好人：所有狼牌出局。狼人：{rules.win === 'city' ? '屠城，好人阵营全部出局。' : '屠边，好人阵营的村民牌全灭，或神牌全灭。'}</p>
      <p className="c-dim">
        没有警长；平票无人出局；女巫{({ never: '不能自救', first: '只有首夜能自救', always: '可以自救' })[rules.selfSave]}、一晚只能用一瓶；
        守卫不能连守，同守同救{rules.guardSave === 'dies' ? '会死' : '不死'}{rules.mute === 'yes' ? '；夜里失去第一条命的人当天不能投票' : ''}。
      </p>
      <table className="w-full border-collapse mt-1">
        <tbody>
          {Object.entries(RECOMMENDED).map(([k, cfg]) => {
            const d = buildDeck(Number(k), cfg).cards || [];
            return (
              <tr key={k} className={Number(k) === tableN ? 'c-gold' : ''}>
                <td className="pr-2 py-1 align-top whitespace-nowrap">{k} 人</td>
                <td className="py-1"><DeckLine deck={d} /></td>
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
  const set = (key, val) => isHost && update(r => { r.config = { ...r.config, rules: { ...DEFAULT_RULES, ...(r.config.rules || {}), [key]: val } }; delete r.config.order; return r; });
  return (
    <div className="px-frame pad" data-testid="variants">
      <div className="flex items-center justify-between mb-3">
        <div className="px-title !mb-0">规则变体</div>
        {changed > 0
          ? isHost && <button className="px-btn dark sm" onClick={() => update(r => { r.config = { ...r.config, rules: { ...DEFAULT_RULES } }; delete r.config.order; return r; })} data-testid="reset-rules">恢复常用规则</button>
          : <span className="px-tag">★ 常用规则</span>}
      </div>
      <p className="fs-12 c-dim mb-3">双身份玩法各地不一样，{isHost ? '开局前和大家商量好再选。' : '由房主设置。'}</p>
      <div className="flex flex-col gap-3">
        {VARIANTS.map(v => {
          const cur = v.opts.find(o => o[0] === rules[v.key]) || v.opts[0];
          return (
            <div key={v.key}>
              <div className="fs-12 mb-1 flex justify-between gap-2"><span>{v.zh}</span><span className="c-mute text-right">{cur[2]}</span></div>
              <div className="px-seg" role="radiogroup" aria-label={v.zh}>
                {v.opts.map(([val, label], i) => (
                  <button key={val} role="radio" aria-checked={rules[v.key] === val} disabled={!isHost}
                    className={rules[v.key] === val ? 'on' : ''} onClick={() => set(v.key, val)} data-testid={`rule-${v.key}-${val}`}>
                    {label}{i === 0 && <span className="c-mute"> ★</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

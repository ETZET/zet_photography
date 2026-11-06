import { useState } from 'react';
import PixelSprite, { Portrait } from '../pixel/PixelSprite';
import RoundTable from './RoundTable';
import {
  ROLES, ROLE_BLURB, OPTIONAL_ROLES, EVIL_COUNT, MIN_PLAYERS, MAX_PLAYERS, RECOMMENDED, buildRoleList, newGame,
  effectiveConfig, LADY_BLURB,
} from './avalonRules';
import { roomLink } from '../../route';
import { Who, useConfirm } from './ui';
import { addBot } from './bots';

const IS_DEV = import.meta.env.DEV;
const inviteLink = code => roomLink('avalon', code);

export default function Lobby({ room, myId, update, busy }) {
  const confirm = useConfirm();
  const isHost = room.hostId === myId;
  const n = room.players.length;
  const tableN = Math.min(Math.max(n, MIN_PLAYERS), MAX_PLAYERS);
  const cfg = effectiveConfig(tableN, room.config);
  const auto = !!room.config.auto;
  const [showTable, setShowTable] = useState(false);
  const built = buildRoleList(tableN, cfg);
  const missing = Math.max(0, MIN_PLAYERS - n);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(inviteLink(room.code)); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggle = role => isHost && update(r => {
    r.config = { ...effectiveConfig(tableN, r.config), auto: false };
    r.config[role] = !r.config[role];
    if (role === 'merlin' && !r.config.merlin) r.config.assassin = false;
    if (role === 'assassin' && r.config.assassin) r.config.merlin = true;
    return r;
  });
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

  const counts = built.roles?.reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {}) || {};

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] items-start">
      <div className="px-frame pad">
        <div className="px-title">圆桌 · {n}/{MAX_PLAYERS} 人</div>
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
              <div className="fs-12 c-dim">{isHost ? (missing > 0 ? '把邀请链接发给朋友' : '配置好角色就能开局') : '等待房主开局…'}</div>
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
          <div className="px-title">角色配置</div>
          <div className="flex flex-wrap items-center gap-2 mb-4 fs-12">
            <span className="px-tag good">好人 {tableN - EVIL_COUNT[tableN]}</span>
            <span className="px-tag evil">坏人 {EVIL_COUNT[tableN]}</span>
            {n < MIN_PLAYERS && <span className="c-mute">按 {tableN} 人预览</span>}
            <span className="flex-1" />
            {auto
              ? <span className="px-tag" data-testid="auto-tag">★ {tableN} 人推荐</span>
              : isHost && (
                <button className="px-btn dark sm" data-testid="use-recommended" onClick={() => update(r => { r.config = { ...r.config, auto: true }; return r; })}>
                  恢复 {tableN} 人推荐
                </button>
              )}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {OPTIONAL_ROLES.map(id => {
              const r = ROLES[id];
              const on = !!cfg[id];
              return (
                <button key={id} className={`px-role ${r.team} ${on ? 'on' : ''}`} onClick={() => toggle(id)} disabled={!isHost} title={ROLE_BLURB[id]} aria-pressed={on}>
                  <Portrait role={r.sprite} scale={2} />
                  <span className="fs-12">{r.zh}</span>
                  <span className={`fs-12 ${on ? (r.team === 'good' ? 'c-good' : 'c-evil') : 'c-mute'}`}>{on ? '● 启用' : '○ 关闭'}</span>
                </button>
              );
            })}
          </div>
          {built.roles && (
            <div className="fs-12 c-dim mt-4 leading-loose">
              本局：{Object.entries(counts).map(([id, c]) => (
                <span key={id} className={`${ROLES[id].team === 'good' ? 'c-good' : 'c-evil'} mr-2 whitespace-nowrap`}>{ROLES[id].zh}{c > 1 ? `×${c}` : ''}</span>
              ))}
            </div>
          )}
          {built.error && <div className="px-tag evil fs-12 mt-3">{built.error}</div>}
          <div className="fs-12 c-mute mt-3">
            {auto ? '人数变化时自动切换推荐配置；点任一角色可自定义。' : '已自定义，人数变化不会自动调整。'}
            <button className="underline ml-2 c-dim" onClick={() => setShowTable(v => !v)} data-testid="toggle-rec-table">
              {showTable ? '收起推荐表' : '查看各人数推荐'}
            </button>
          </div>
          {showTable && (
            <table className="w-full fs-12 mt-2 border-collapse" data-testid="rec-table">
              <tbody>
                {Object.entries(RECOMMENDED).map(([k, roles]) => {
                  const num = Number(k);
                  const list = buildRoleList(num, Object.fromEntries(roles.map(r => [r, true]))).roles || [];
                  const c = list.reduce((a, id) => ({ ...a, [id]: (a[id] || 0) + 1 }), {});
                  return (
                    <tr key={k} className={num === tableN ? 'c-gold' : ''}>
                      <td className="pr-2 py-1 align-top whitespace-nowrap">{k} 人</td>
                      <td className="py-1 leading-loose">
                        {Object.entries(c).map(([id, cnt]) => (
                          <span key={id} className={`${num === tableN ? '' : ROLES[id].team === 'good' ? 'c-good' : 'c-evil'} mr-2 whitespace-nowrap`}>{ROLES[id].zh}{cnt > 1 ? `×${cnt}` : ''}</span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-frame pad">
          <div className="px-title">扩展规则</div>
          <button className={`px-role row good ${room.config.lady ? 'on' : ''}`}
            onClick={() => isHost && update(r => { r.config = { ...r.config, lady: !r.config.lady }; return r; })}
            disabled={!isHost} aria-pressed={!!room.config.lady} data-testid="toggle-lady">
            <Portrait role="lady" scale={2} />
            <span className="flex flex-col gap-1">
              <span>湖中仙女 <span className={`fs-12 ${room.config.lady ? 'c-good' : 'c-mute'}`}>{room.config.lady ? '● 启用' : '○ 关闭'}</span></span>
              <span className="fs-12 c-dim">{LADY_BLURB}</span>
            </span>
          </button>
        </div>

        {isHost ? (
          <button className="px-btn gold lg block" disabled={busy || missing > 0 || !!built.error} onClick={start} data-testid="start-game">
            {missing > 0 ? `还差 ${missing} 人` : '开始游戏'}
          </button>
        ) : (
          <div className="px-frame pad text-center c-dim">等待房主开局…</div>
        )}
      </div>
    </div>
  );
}

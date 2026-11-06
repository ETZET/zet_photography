// Shared room shell for every party game: create / join by 4-letter code,
// live sync, leave / host hand-over, toasts. Each game plugs in its own
// Lobby + Board + bots and a little branding.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Torch } from '../pixel/PixelSprite';
import { roomStore, getPlayerId } from '../avalon/roomStore';
import { useRoute, navigate } from '../../route';
import { PlayersProvider, ConfirmProvider, ConfirmOutlet, useConfirm } from '../avalon/ui';
import { NAME_MAX_UNITS, clampName, nameUnits, uniqueName } from '../avalon/names';

export const GAME_TITLES = { avalon: '阿瓦隆', werewolf: '双身份狼人' };
const kindOf = room => room?.kind || 'avalon'; // rooms created before `kind` existed are Avalon

// ---------- live room subscription ----------
function useRoom(code) {
  const [state, setState] = useState({ room: null, loaded: !code });
  useEffect(() => {
    if (!code) { setState({ room: null, loaded: true }); return undefined; }
    let alive = true;
    setState(s => ({ ...s, loaded: false }));
    roomStore.get(code)
      .then(room => alive && setState({ room, loaded: true }))
      .catch(e => alive && setState({ room: null, loaded: true, error: e.message || '连接失败' }));
    const unsub = roomStore.subscribe(code, room => alive && setState({ room, loaded: true }));
    return () => { alive = false; unsub(); };
  }, [code]);
  return state;
}

/**
 * spec: { id, title, subtitle, emblem, art, howTo: [..], placeholder, maxPlayers,
 *         newRoom(): extra room fields, Lobby, Board, useBots, order(room) → seat ids }
 */
export default function RoomGame(props) {
  return <ConfirmProvider><RoomInner {...props} /></ConfirmProvider>;
}

function RoomInner({ spec, onExit }) {
  const { Lobby, Board, useBots } = spec;
  const confirm = useConfirm();
  const myId = useMemo(getPlayerId, []);
  const route = useRoute();
  const code = route.game === spec.id ? route.room : null;
  const setCode = c => navigate({ page: 'game', game: spec.id, room: c });
  const { room: rawRoom, loaded, error: loadError } = useRoom(code);
  const wrongGame = rawRoom && kindOf(rawRoom) !== spec.id;
  const room = wrongGame ? null : rawRoom;
  const me = room?.players.find(p => p.id === myId);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  /** Apply a mutation to the shared room; surfaces rule errors as a toast. */
  const [pending, setPending] = useState(0);
  const update = useCallback(async fn => {
    setPending(n => n + 1);
    window.__roomPending = (window.__roomPending || 0) + 1;
    try { await roomStore.update(code, fn); }
    catch (e) { console.warn(`[${spec.id}] update failed:`, e.message); setToast(e.message || '操作失败'); }
    finally { setPending(n => n - 1); window.__roomPending -= 1; }
  }, [code, spec.id]);
  const busy = pending > 0;

  useBots?.(room, room?.hostId === myId, update);
  // Test hook: lets the Playwright self-review read the shared state.
  useEffect(() => { if (import.meta.env.DEV) window.__room = room; }, [room]);

  const exit = () => onExit();

  // Refreshing / closing mid-game is fine (you rejoin by link), but warn anyway.
  const inGame = room?.phase === 'game' && room.game?.step !== 'end';
  useEffect(() => {
    if (!inGame) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [inGame]);

  const leave = async () => {
    const ok = await confirm(inGame
      ? { title: '离开房间？', body: '游戏进行中，你离开后这一局会作废，所有人回到大厅。', ok: '离开并结束这局', tone: 'danger' }
      : { title: '离开房间？', body: '你可以之后用邀请链接重新加入。', ok: '离开' });
    if (!ok) return;
    await update(r => {
      r.players = r.players.filter(p => p.id !== myId);
      const humans = r.players.filter(p => !p.isBot);
      if (humans.length === 0) return null; // last human out closes the room
      if (r.hostId === myId) r.hostId = humans[0].id;
      if (r.phase === 'game') { r.phase = 'lobby'; r.game = null; }
      return r;
    });
    setCode(null);
  };

  const inRoom = room && me;
  const missingMsg = wrongGame
    ? `房间 ${code} 是「${GAME_TITLES[kindOf(rawRoom)] || '其他游戏'}」的房间`
    : !!code && loaded && !room ? `房间 ${code} 不存在或已过期` : '';

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <button className="px-btn dark sm" onClick={exit}>◀ 游戏厅</button>
        {inRoom && (
          <div className="flex items-center gap-2">
            <span className="fs-12 c-dim hidden sm:inline">房间</span>
            <span className="fs-24 c-gold tracking-[0.2em]" data-testid="room-code">{room.code}</span>
            <button className="px-btn dark sm" onClick={leave} data-testid="leave">离开</button>
          </div>
        )}
      </div>

      {code && !loaded ? (
        <div className="px-frame pad text-center c-dim">载入中…</div>
      ) : loadError ? (
        <div className="px-frame pad text-center">
          <p className="c-evil mb-3">连不上服务器：{loadError}</p>
          <button className="px-btn" onClick={() => window.location.reload()}>重试</button>
        </div>
      ) : inRoom ? (
        <PlayersProvider order={room.phase === 'game' && room.game ? room.game.seats : room.players.map(p => p.id)} players={room.players} myId={myId}>
          {room.phase === 'game' && room.game
            ? <Board room={room} myId={myId} update={update} busy={busy} />
            : <Lobby room={room} myId={myId} update={update} busy={busy} />}
          <ConfirmOutlet />
        </PlayersProvider>
      ) : (
        <Entry spec={spec} myId={myId} initialCode={missingMsg ? null : code} missingMsg={missingMsg} onEnter={setCode} />
      )}

      {toast && (
        <div className="fixed left-1/2 bottom-8 -translate-x-1/2 z-[80] px-frame pad fs-18 c-evil px-pop" role="status">{toast}</div>
      )}
    </div>
  );
}

// ---------- create / join ----------
function Entry({ spec, myId, initialCode, missingMsg, onEnter }) {
  const [name, setName] = useState(() => { try { return clampName(localStorage.getItem('avalon:name') || ''); } catch { return ''; } });
  const [joinCode, setJoinCode] = useState(initialCode || '');
  const [error, setError] = useState(missingMsg || '');
  const [busy, setBusy] = useState(false);
  const joining = !!initialCode;

  const saveName = () => { try { localStorage.setItem('avalon:name', name.trim()); } catch { /* ignore */ } };
  const units = nameUnits(name.trim());
  const composing = useRef(false); // don't cut pinyin mid-IME-composition

  const create = async () => {
    if (!clampName(name).trim()) return setError('先起个名字');
    setBusy(true); saveName();
    try {
      const room = await roomStore.create({
        kind: spec.id, hostId: myId, phase: 'lobby', round: 0, game: null, ...spec.newRoom(),
        players: [{ id: myId, name: clampName(name).trim(), joinedAt: Date.now() }],
      });
      onEnter(room.code);
    } catch (e) {
      setError(`创建失败：${e.message || '网络错误'}`);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    const c = joinCode.trim().toUpperCase();
    if (!clampName(name).trim()) return setError('先起个名字');
    if (c.length !== 4) return setError('房间号是 4 个字母');
    setBusy(true); saveName();
    try {
      await roomStore.update(c, room => {
        if (kindOf(room) !== spec.id) throw new Error(`这是「${GAME_TITLES[kindOf(room)] || '其他游戏'}」的房间`);
        if (room.players.some(p => p.id === myId)) return room;
        if (room.phase !== 'lobby') throw new Error('这局已经开始了，等房主回到大厅再加入');
        if (room.players.length >= spec.maxPlayers) throw new Error(`房间满了（最多 ${spec.maxPlayers} 人）`);
        room.players.push({ id: myId, name: uniqueName(clampName(name).trim(), room.players), joinedAt: Date.now() });
        return room;
      });
      onEnter(c);
    } catch (e) {
      setError(e.message === '房间不存在' ? `房间 ${c} 不存在` : e.message || '加入失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-[880px] mx-auto">
      <div className="text-center mb-10">
        <div className="flex items-end justify-center gap-4">
          <Torch scale={4} />
          {spec.emblem}
          <Torch scale={4} />
        </div>
        <h2 className="fs-48 c-gold shadow-px mt-4">{spec.title}</h2>
        <p className="fs-12 c-dim mt-2 tracking-[0.4em]">{spec.subtitle}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 items-stretch">
        <div className="px-frame pad flex flex-col gap-3 md:order-2">
          <div className="px-title">{joining ? `加入房间 ${initialCode}` : spec.enterTitle || '进入房间'}</div>
          <label className="flex flex-col gap-1">
            <span className="fs-12 c-dim flex justify-between">
              <span>你的名字（中文最多 {NAME_MAX_UNITS / 2} 字，英文最多 {NAME_MAX_UNITS} 个字母）</span>
              <span className={units >= NAME_MAX_UNITS ? 'c-gold' : 'c-mute'} data-testid="name-units">{units}/{NAME_MAX_UNITS}</span>
            </span>
            <input className="px-input" value={name} placeholder={spec.placeholder} data-testid="name-input"
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={e => { composing.current = false; setName(clampName(e.currentTarget.value)); }}
              onChange={e => { setName(composing.current ? e.target.value : clampName(e.target.value)); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && (joining ? join() : create())} />
          </label>

          {joining ? (
            <button className="px-btn gold lg block mt-2" disabled={busy} onClick={join}>加入房间</button>
          ) : (
            <>
              <button className="px-btn gold lg block mt-2" disabled={busy} onClick={create}>创建房间</button>
              <div className="flex items-center gap-3 c-mute fs-12 my-1">
                <span className="flex-1 h-[3px] bg-[#3b2f6c]" />或输入房间号<span className="flex-1 h-[3px] bg-[#3b2f6c]" />
              </div>
              <div className="flex items-center">
                <input className="px-input text-center tracking-[0.4em] uppercase" value={joinCode} maxLength={4} placeholder="ABCD"
                  onChange={e => { setJoinCode(e.target.value.replace(/[^a-z]/gi, '').toUpperCase()); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && join()} />
                <button className="px-btn" disabled={busy} onClick={join}>加入</button>
              </div>
            </>
          )}
          {error && <div className="px-tag evil fs-12 self-start mt-1">{error}</div>}
        </div>

        <div className="px-frame pad flex flex-col gap-4 md:order-1">
          <div className="px-title">怎么玩</div>
          <ol className="flex flex-col gap-3">
            {spec.howTo.map((t, i) => <li key={i}><span className="c-gold">{i + 1}.</span> {t}</li>)}
          </ol>
          <div className="flex justify-center gap-3 mt-auto pt-2">{spec.art}</div>
        </div>
      </div>
    </div>
  );
}

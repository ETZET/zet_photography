// Spoken night guide for the round-table games (阿瓦隆 / 双身份狼人 / 一夜狼).
// Any player can tap the speaker button to become the room's narrator (room.voice = their id);
// only that one phone talks, so the table doesn't hear an echo from every phone.
//
// A game opts in with spec.narrate(game, { now, seat }) → cues, an ordered list of
// { key, say, interrupt? } for the current public state. `say` is a string or an
// array of strings and numbers (a number = pause in seconds). Cues are spoken once
// each, in order; scripts only use public information (what the table can see).
import { useEffect, useRef, useState } from 'react';
import PixelSprite from '../pixel/PixelSprite';

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function zhVoice() {
  const vs = window.speechSynthesis.getVoices() || [];
  return vs.find(v => /^zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
}

// Test hook: every spoken line lands here (e2e asserts on it; speech may be silent in CI).
function record(text) {
  try { (window.__narrated ||= []).push(text); } catch { /* ignore */ }
}

/** Speaks lines one after another; cancel() stops the current run. */
function makeSpeaker() {
  let token = 0;
  const say = (text, tk) => new Promise(resolve => {
    if (tk !== token) return resolve();
    record(text);
    const u = new SpeechSynthesisUtterance(text);
    const v = zhVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || 'zh-CN';
    u.rate = 0.95;
    // Some engines never fire onend (no voice installed, tab hidden) — don't stall.
    const fallback = setTimeout(resolve, 1500 + text.length * 320);
    u.onend = u.onerror = () => { clearTimeout(fallback); resolve(); };
    window.speechSynthesis.speak(u);
  });
  const wait = (s, tk) => new Promise(r => (tk === token ? setTimeout(r, s * 1000 * (window.__narratePause ?? 1)) : r()));
  let chain = Promise.resolve();
  return {
    play(parts, interrupt) {
      if (interrupt) this.cancel();
      const tk = token;
      const list = Array.isArray(parts) ? parts : [parts];
      chain = chain.then(async () => {
        for (const p of list) {
          if (tk !== token) return;
          if (typeof p === 'number') await wait(p, tk);
          else if (p) await say(p, tk);
        }
      });
    },
    cancel() {
      token += 1;
      chain = Promise.resolve();
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    },
  };
}

function useTick(on, ms = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return undefined;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [on, ms]);
  return now;
}

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

export default function Narrator({ narrate, room, myId, update }) {
  const g = room.game;
  const on = room.voice === myId;
  const other = room.voice && room.voice !== myId ? room.players.find(p => p.id === room.voice) : null;
  const speaker = useRef(null);
  const spoken = useRef(null); // Set of cue keys already handled (null = just switched on)
  const now = useTick(on && !!g);
  useWakeLock(on);

  useEffect(() => {
    if (!on) { speaker.current?.cancel(); spoken.current = null; }
  }, [on]);
  useEffect(() => () => speaker.current?.cancel(), []);

  useEffect(() => {
    if (!on || !g || !supported()) return;
    const seat = id => `${g.seats.indexOf(id) + 1}号`;
    let cues = [];
    try { cues = narrate(g, { now, seat }) || []; } catch (e) { console.warn('[narrate]', e); }
    const round = room.round || 0;
    const fresh = !spoken.current;
    if (fresh) spoken.current = new Set();
    // Joining mid-game: only say where we are now, not the whole backlog.
    cues.forEach((c, i) => {
      const k = `${round}:${c.key}`;
      if (spoken.current.has(k)) return;
      spoken.current.add(k);
      if (fresh && i < cues.length - 1) return;
      (speaker.current ||= makeSpeaker()).play(c.say, c.interrupt);
    });
  });

  if (!supported()) return null;

  const toggle = () => {
    if (on) {
      update(r => { if (r.voice === myId) r.voice = null; return r; });
      return;
    }
    // Speaking inside the tap unlocks audio on iOS Safari.
    (speaker.current ||= makeSpeaker()).cancel();
    speaker.current.play('语音播报已开启');
    spoken.current = null;
    update(r => { r.voice = myId; return r; });
  };

  return (
    <button
      className={`px-btn dark sm ${on ? 'c-gold' : ''}`}
      onClick={toggle}
      data-testid="voice-guide"
      aria-pressed={on}
      style={on ? { boxShadow: 'inset 0 0 0 2px #f5c542' } : undefined}
      aria-label={on ? '夜晚语音：这台手机在播报' : other ? `夜晚语音：${other.name}在播报` : '夜晚语音'}
      title={on ? '这台手机在播报夜晚语音，点一下关闭' : '用这台手机播报夜晚语音（同一时间只有一台手机说话）'}
    >
      <span className="inline-flex items-center gap-2">
        <PixelSprite name={on ? 'speakerOn' : 'speaker'} scale={2} />
        <span className="hidden min-[400px]:inline">{on ? '播报中' : other ? `${other.name}在播` : '语音'}</span>
      </span>
    </button>
  );
}

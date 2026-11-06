// 预计人数: the host previews the recommended setup for the head count they
// expect before everyone has joined. Stored as room.plan (null = follow the room).
// Games deal for the REAL head count at start; the lobby confirms if it differs.

/** Head count the lobby previews: the plan if set, else the room size, clamped to the game's range. */
export const previewCount = (room, min, max) => Math.min(Math.max(room.plan ?? room.players.length, min), max);

export const setPlan = (update, v) => update(r => { r.plan = v; return r; });

/** Confirm-dialog content for starting with a head count that differs from the plan, or null. */
export function planMismatch(room) {
  const n = room.players.length;
  if (!room.plan || room.plan === n) return null;
  return {
    title: '人数和预计的不一样',
    body: <>预计 {room.plan} 人，现在 {n} 人。开局会按 <b>{n} 人</b>配置。</>,
    ok: `按 ${n} 人开局`,
    cancel: '再等等',
  };
}

export default function PlanPicker({ room, min, max, isHost, update }) {
  const plan = room.plan || null;
  const n = room.players.length;
  const counts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const note = plan
    ? (plan === n ? `人到齐了：${n} 人。` : `预计 ${plan} 人，现在 ${n} 人。下面的推荐按 ${plan} 人显示，开局按实际人数配置。`)
    : n < min ? `现在 ${n} 人，按 ${min} 人预览。` : '跟着房间里的实际人数走。';
  if (!isHost) return plan ? <div className="fs-12 c-dim mb-3" data-testid="plan-note">房主预计 {plan} 人，现在 {n} 人。</div> : null;
  return (
    <div className="mb-3" data-testid="plan">
      <div className="fs-12 mb-1">预计人数</div>
      <div className="px-seg flex-wrap" role="radiogroup" aria-label="预计人数">
        <button role="radio" aria-checked={!plan} className={!plan ? 'on' : ''} onClick={() => setPlan(update, null)} data-testid="plan-auto">自动</button>
        {counts.map(c => (
          <button key={c} role="radio" aria-checked={plan === c} className={plan === c ? 'on' : ''} onClick={() => setPlan(update, c)} data-testid={`plan-${c}`}>{c}</button>
        ))}
      </div>
      <div className="fs-12 c-dim mt-1" data-testid="plan-note">{note}</div>
    </div>
  );
}

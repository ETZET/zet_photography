// Spoken guide for 双身份狼人 (see room/Narrator.jsx). Nights here are played
// silently on phones at the same time, so the voice calls the shared beats —
// 天黑 / 女巫 / 天亮 + who lost a life / speaking order / vote / 遗言 / result —
// all of which every phone already shows publicly.

const uniq = a => [...new Set(a)];

function dawn(g, seat) {
  const n = g.lastNight?.night;
  if (!n || n !== g.day) return null;
  const ids = uniq((g.lastNight.lost || []).map(l => l.id));
  return {
    key: `dawn${n}`,
    say: ['天亮了，所有人请睁眼。', ids.length ? `昨晚，${ids.map(seat).join('、')}失去了一条命。` : '昨晚是平安夜。'],
  };
}

function voteResult(g, seat) {
  const v = [...(g.log || [])].reverse().find(l => l.type === 'vote' && l.day === g.day);
  if (!v) return null;
  const say = v.out ? `${seat(v.out)}被投票出局，失去一条命。` : v.tie ? '平票，没有人出局。' : '没有人被投出局。';
  return { key: `vr${g.day}${v.pk ? 'pk' : ''}${v.tie && !v.pk ? 't' : ''}`, say };
}

export function narrate(g, { seat }) {
  const cues = [];
  switch (g.step) {
    case 'night': {
      const say = [`第 ${g.night} 夜，天黑请闭眼。`];
      if (g.night === 1 && g.rules?.cupid === 'yes') say.push('丘比特请先连两名情侣。');
      say.push('请大家低头看手机，按提示行动。');
      cues.push({ key: `n${g.night}`, say });
      break;
    }
    case 'witch':
      cues.push({ key: `n${g.night}`, say: `第 ${g.night} 夜，天黑请闭眼。` });
      cues.push({ key: `w${g.night}`, say: '女巫请睁眼，决定今晚是否用药。' });
      break;
    case 'confirm': {
      if (g.confirm?.then === 'day') { const d = dawn(g, seat); if (d) cues.push(d); }
      else { const v = voteResult(g, seat); if (v) cues.push(v); }
      cues.push({ key: `cf${g.day}${g.confirm?.then}`, say: '请失去生命的玩家在手机上确认。' });
      const bp = [...(g.log || [])].reverse().find(l => l.type === 'badge' && l.day === g.day);
      if (bp) cues.push({ key: `bp${g.day}${bp.from}`, say: bp.to ? `警长把警徽交给了${seat(bp.to)}。` : '警长撕掉了警徽。' });
      break;
    }
    case 'elect': {
      const e = g.elect;
      if (!e) break;
      if (!e.pk) { const d = dawn(g, seat); if (d) cues.push(d); }
      if (e.phase === 'sign') cues.push({ key: `es${g.day}`, say: '现在竞选警长。想上警的玩家，请在手机上选择上警。' });
      if (e.pk) cues.push({ key: `epk${g.day}`, say: '警长竞选平票，请平票的玩家再发言一次。' });
      if (e.phase === 'speak') {
        const id = e.order[e.at];
        if (id) cues.push({ key: `esp${g.day}${e.pk ? 'pk' : ''}-${e.order.join('')}-${e.at}`, say: `请${seat(id)}竞选发言。` });
      }
      if (e.phase === 'vote') cues.push({ key: `ev${g.day}${e.pk ? 'pk' : ''}`, say: '警上发言结束，请警下的玩家投票选警长。' });
      break;
    }
    case 'day': {
      const sp = g.speak;
      if (!sp) break;
      const el = [...(g.log || [])].reverse().find(l => l.type === 'sheriff' && l.day === g.day);
      if (el && !sp.pk) cues.push({ key: `sh${g.day}`, say: el.to ? `${seat(el.to)}当选警长。` : '本局没有警长。' });
      if (sp.pick) cues.push({ key: `pick${g.day}`, say: `请警长${seat(sp.sheriff)}选择从哪边开始发言。` });
      if (!sp.pk) { const d = dawn(g, seat); if (d) cues.push(d); }
      else { const v = voteResult(g, seat); if (v) cues.push({ ...v, key: `${v.key}-pk` }); cues.push({ key: `pk${g.day}`, say: '平票，请 PK 台上的玩家再发言一次。' }); }
      const id = sp.order[sp.at];
      if (id) {
        const lw = (sp.lastWords || []).includes(id);
        cues.push({ key: `s${g.day}${sp.pk ? 'pk' : ''}-${sp.at}`, say: lw ? `请${seat(id)}发表遗言。` : `请${seat(id)}发言。` });
      }
      break;
    }
    case 'vote':
      cues.push({ key: `v${g.day}${g.pk ? 'pk' : ''}`, say: g.pk ? '请对 PK 台上的玩家重新投票。' : '发言结束，请大家投票。' });
      break;
    case 'dusk': {
      const v = voteResult(g, seat);
      if (v) cues.push(v);
      const id = g.dusk?.order[g.dusk.at];
      if (id) cues.push({ key: `l${g.day}-${g.dusk.at}`, say: `请${seat(id)}发表遗言。` });
      else cues.push({ key: `dk${g.day}`, say: '请房主宣布天黑。' });
      break;
    }
    case 'end': {
      const who = { good: '好人阵营', wolf: '狼人阵营', love: '丘比特阵营' }[g.winner] || '';
      cues.push({ key: 'end', say: `游戏结束，${who}获胜。${g.reason || ''}`, interrupt: true });
      break;
    }
    default:
  }
  return cues;
}

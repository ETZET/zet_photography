// Spoken guide for 一夜狼 (see room/Narrator.jsx), following the public night
// timeline: every role in the deck gets its 睁眼 / 闭眼 line on the clock, even if
// that card sits in the middle, so the voice never tells who is acting.
import { ROLES, timeline } from './onenightRules.js';

const HINT = {
  wolf: '狼人请睁眼，互相确认队友。只有一匹狼的，可以看一张公共牌。',
  minion: '爪牙请睁眼，看看谁是狼人。',
  twin: '双子请睁眼，互相确认。',
  seer: '预言家请睁眼，可以查看一名玩家的牌，或者两张公共牌。',
  thief: '夜贼请睁眼，可以和一名玩家换牌，再看看你的新牌。',
  meddler: '搅局者请睁眼，可以交换另外两名玩家的牌。',
  drunk: '醉汉请睁眼，把你的牌和一张公共牌交换，不能看。',
  owl: '夜猫子请睁眼，看看你现在手里的牌。',
};
const zh = r => ROLES[r]?.zh || r;

export function narrate(g, { now }) {
  const cues = [];
  if (g.step === 'night') {
    const { slots, cur } = timeline(g, now);
    cues.push({ key: 'intro', say: '天黑了，所有人请闭眼。', interrupt: true });
    for (let i = 0; i < Math.min(cur + 1, slots.length); i++) {
      const prev = i > 0 ? `${zh(slots[i - 1].role)}请闭眼。` : '';
      cues.push({ key: `s${i}`, say: [prev, HINT[slots[i].role] || `${zh(slots[i].role)}请睁眼。`], interrupt: true });
    }
    if (cur >= slots.length && slots.length) cues.push({ key: 'outro', say: `${zh(slots[slots.length - 1].role)}请闭眼。`, interrupt: true });
    return cues;
  }
  if (g.step === 'day') {
    cues.push({ key: 'day', say: ['天亮了，所有人请睁眼。', `开始讨论，时间 ${g.rules?.talk || 5} 分钟。`], interrupt: true });
    if (g.talkEnd && g.talkEnd - now <= 60_000 && g.talkEnd - now > 0) cues.push({ key: `left${g.talkEnd}`, say: '还剩一分钟。' });
  } else if (g.step === 'vote') {
    cues.push({ key: 'vote', say: '讨论时间到，请大家投票。', interrupt: true });
  } else if (g.step === 'end') {
    cues.push({ key: 'end', say: '投票结束，请看结果。', interrupt: true });
  }
  return cues;
}

// Spoken night guide for 阿瓦隆 (see room/Narrator.jsx). The classic closed-eyes
// script, built only from the roles in play (the role list is public in the lobby).

export function narrate(g, { seat }) {
  if (g.step === 'reveal') {
    const has = new Set(Object.values(g.assignments));
    const say = ['天黑了，所有人请闭眼，把手握拳放在面前。', 3];
    say.push(`坏人请睁眼，互相确认队友${has.has('oberon') ? '。奥伯伦不要睁眼' : ''}。`, 6, '坏人请闭眼。', 2);
    if (has.has('merlin')) {
      say.push(`坏人请竖起大拇指${has.has('mordred') ? '，莫德雷德不要竖' : ''}。`, 2,
        '梅林请睁眼，记住谁竖着大拇指。', 6, '梅林请闭眼，坏人请放下大拇指。', 2);
    }
    if (has.has('percival')) {
      say.push(`梅林${has.has('morgana') ? '和莫甘娜' : ''}请竖起大拇指。`, 2,
        '派西维尔请睁眼，记住竖着大拇指的人。', 6, '派西维尔请闭眼，大家放下大拇指。', 2);
    }
    say.push('天亮了，所有人请睁眼。', `${seat(g.seats[g.leaderIdx])}是第一任队长。`);
    return [{ key: 'reveal', say }];
  }
  if (g.step === 'end') {
    const who = g.winner === 'good' ? '好人' : '坏人';
    return [{ key: 'end', say: `游戏结束，${who}阵营获胜。`, interrupt: true }];
  }
  if (g.step === 'assassin') return [{ key: 'assassin', say: '好人完成了三个任务。刺客请睁眼，选出你认为的梅林。', interrupt: true }];
  return [];
}

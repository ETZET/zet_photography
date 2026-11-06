import { DEFAULT_RULES } from './guandanRules';

/** Short rules summary, reflecting the host's variants. */
export function RuleCard({ rules = DEFAULT_RULES }) {
  return (
    <div className="fs-12 leading-relaxed mt-3 flex flex-col gap-2" data-testid="rule-card">
      <p><span className="c-gold">两副牌 108 张，每人 27 张，对家是队友。</span>本局打几，几就是级牌：单张、对子、三张里级牌比 A 大，只比王小。</p>
      <p><span className="c-gold">红心级牌 = 逢人配：</span>可以当除大小王以外的任何牌，凑对子、顺子、炸弹都行。</p>
      <p>牌型：单张、对子、三张、三带二、顺子（正好 5 张）、三连对、钢板（两个连着的三张）。顺子类 A 可以当 1 也可以当 A，不能绕（JQKA2 不行）。</p>
      <p><span className="c-evil">炸弹：</span>4 张 &lt; 5 张 &lt; 同花顺 &lt; 6 张 &lt; 7 张 &lt; 8 张… &lt; 四个王（天王炸）。炸弹能管任何普通牌型。</p>
      <p>跟牌要出同牌型、同张数、更大的牌，或者炸；不要可以过。三家都不要，最后出牌的人接着出；他已经出完，由对家<span className="c-gold">接风</span>。</p>
      <p>按出完顺序排头游、二游、三游、末游。头游一队升级：对家二游 +{rules.up12 === '4' ? 4 : 3}，三游 +2，末游 +1。</p>
      <p>{rules.tribute === 'yes'
        ? <>下一局开始前<span className="c-gold">进贡</span>：末游把最大的牌（红心级牌除外）给头游，头游{rules.back === 'any' ? '还任意一张' : '还一张 10 以下的'}；双下两人都贡，大的给头游。进贡方有两张大王可以<span className="c-gold">抗贡</span>。进贡给头游的人先出。</>
        : '本房间不进贡，上局头游先出。'}</p>
      <p>打 A：{rules.aWin === 'double' ? '必须本方双上' : '本方头游、对家不是末游'}才算过 A，赢得整场。{rules.aFail === 'never' ? '打不过就一直打 A。' : `打 A ${rules.aFail} 次没过，回到 2。`}</p>
    </div>
  );
}

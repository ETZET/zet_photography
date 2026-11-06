/**
 * 一夜狼 screen gallery for design review: stages every screen and role (lobby +
 * deck picker, each night role before / after acting, the public timeline, day
 * timer, vote, reveal, every ending) and screenshots each phone, plus
 * viewport-only shots at common phone sizes to check what fits without scrolling.
 *
 *   npx playwright test -c playwright.onenight.config.ts tests/onenight-gallery.spec.ts
 *
 * Output: test-results/onenight-gallery/*.png + manifest.json (section, title, note, who, view).
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const OUT = 'test-results/onenight-gallery';
const NAMES = ['村长', '阿花', '铁柱', '小美', '老王', '二狗', '阿强', '小红'];
const manifest: { file: string; section: string; title: string; note: string; who: string; view?: string }[] = [];
const fit: string[] = [];
let section = '';
let n = 0;

async function shot(page: Page, title: string, note = '', { full = true, view = '' } = {}) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}.png`;
  await page.waitForTimeout(700); // let stepped animations land
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: full });
  const who = await page.evaluate(() => {
    const w = window as any; const id = sessionStorage.getItem('avalon:pid');
    return w.__room?.players?.find((p: any) => p.id === id)?.name || '';
  }).catch(() => '');
  manifest.push({ file, section, title, note, who, view: view || undefined });
}

type Spec = { cards: string[]; center: string[]; rules?: Record<string, unknown>; then?: string; ago?: number; timeScale?: number };
const stage = (host: Page, spec: Spec) => host.evaluate(async s => { const m = await import('/tests/onStage.js'); await m.stage(s); }, spec);
const tap = (p: Page, name: string) => p.getByTestId(`seat-${name}`).click();
const tapC = (p: Page, i: number) => p.getByTestId(`center-${i}`).click();
const hold = (p: Page, id: string) => p.getByTestId(id).dispatchEvent('pointerdown');
const release = (p: Page, id: string) => p.getByTestId(id).dispatchEvent('pointerup');
async function closeReveal(pages: Page[]) {
  for (const p of pages) {
    const b = p.getByTestId('close-reveal');
    if (await b.isVisible().catch(() => false)) await b.click({ timeout: 3000 }).catch(() => {});
  }
}

// seats: 村长 阿花 铁柱 小美 老王 二狗 阿强 小红
// A: every swap role in play; 阿花 is the lone wolf (the other wolf is in the center)
const A = { cards: ['seer', 'wolf', 'thief', 'meddler', 'drunk', 'owl', 'villager', 'hunter'], center: ['wolf', 'loner', 'villager'] };
// B: two wolves + 爪牙 + 双子; 夜贼 / 搅局者 sit in the center but are still called on the timeline
const B = { cards: ['wolf', 'minion', 'twin', 'twin', 'wolf', 'seer', 'loner', 'villager'], center: ['thief', 'meddler', 'hunter'] };
// A's night, played out: seer looks at 阿花, lone wolf peeks center 1, thief robs 阿花,
// meddler swaps 村长 & 二狗, drunk takes center 2, the rest tap something
const NIGHT_A = `
  R.nightAct(g, ids[0], { players: [ids[1]], center: [] });
  R.nightAct(g, ids[1], { players: [], center: [0] });
  R.nightAct(g, ids[2], { players: [ids[1]], center: [] });
  R.nightAct(g, ids[3], { players: [ids[0], ids[5]], center: [] });
  R.nightAct(g, ids[4], { players: [], center: [1] });
  R.nightAct(g, ids[5], { players: [ids[2]], center: [] });
  R.nightAct(g, ids[6], { players: [], center: [2] });
  R.nightAct(g, ids[7], { players: [ids[0]], center: [] });`;
const DAWN = 'g.settleAt = Date.now(); R.settleNight(g);';
// after NIGHT_A: 铁柱 holds the wolf, 阿花 the thief, 村长 the owl, 二狗 the seer, 老王 the loner
const votes = (t: number[]) => `R.startVote(g); ${t.map((x, i) => `R.castVote(g, ids[${i}], ids[${x}]);`).join(' ')}`;

test.use({ actionTimeout: 10_000 });
test('一夜狼 screen gallery', async ({ browser }) => {
  test.setTimeout(600_000);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { (window as any).__onTimeScale = 0.03; });
  const pages: Page[] = [];
  for (let i = 0; i < NAMES.length; i++) pages.push(await ctx.newPage());
  const [host] = pages;
  const P = (name: string) => pages[NAMES.indexOf(name)];

  // ---------------------------------------------------------------- entry
  section = '入口';
  const visitor = await ctx.newPage();
  await visitor.goto('/game?local=1');
  await expect(visitor.getByText('一夜狼')).toBeVisible();
  await shot(visitor, '游戏厅', '一夜狼排在第三个（meta.js 自注册）');
  await visitor.close();
  await host.goto('/game/onenight?local=1');
  await shot(host, '一夜狼入口', '/game/onenight：输名字，创建或加入房间');
  await host.getByTestId('name-input').fill(NAMES[0]);
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();

  // ---------------------------------------------------------------- lobby
  section = '大厅';
  await shot(host, '一个人的房间', '不到 3 人按 3 人预览牌组');
  for (let i = 1; i < pages.length; i++) {
    await pages[i].goto(`/game/onenight/${code}?local=1`);
    await pages[i].getByTestId('name-input').fill(NAMES[i]);
    await pages[i].getByRole('button', { name: '加入房间' }).click();
    await expect(pages[i].getByTestId('room-code')).toHaveText(code);
  }
  await host.waitForTimeout(400);
  await shot(host, '8 人到齐（房主）', '经典换牌 / 新手不换牌两个推荐牌组；开局按钮贴底');
  await shot(P('阿花'), '8 人到齐（非房主）', '只显示本局牌组');
  await host.getByTestId('toggle-rules').click();
  await host.getByTestId('rule-card').scrollIntoViewIfNeeded();
  await shot(host, '规则说明', '包括本局牌组里每个角色的说明');
  await host.getByTestId('toggle-rules').click();
  await host.getByTestId('toggle-diy').click();
  await host.getByTestId('diy').scrollIntoViewIfNeeded();
  await shot(host, '自定义 DIY', '每个角色 ± ；双子两张一起加');
  await host.getByTestId('plus-villager').click();
  await host.waitForTimeout(300);
  await host.getByTestId('deck-error').scrollIntoViewIfNeeded();
  await shot(host, '牌数不对', '多一张：红色提示，开局按钮变灰', { full: false });
  await host.getByTestId('minus-wolf').click();
  await host.getByTestId('minus-wolf').click();
  await host.getByTestId('plus-villager').click();
  await host.waitForTimeout(300);
  await host.getByTestId('deck-warn').first().scrollIntoViewIfNeeded();
  await shot(host, '没有狼的牌组', '牌数对了但没有狼：黄色警告，开局前再确认一次', { full: false });
  await host.getByTestId('start-game').click();
  await expect(host.getByTestId('confirm')).toBeVisible();
  await shot(host, '开局前确认', '', { full: false });
  await host.getByTestId('confirm-cancel').click();
  for (const id of ['rule-talk-3', 'rule-lonePeek-no', 'rule-selfVote-yes', 'rule-tie-none']) await host.getByTestId(id).click();
  await host.getByTestId('variants').scrollIntoViewIfNeeded();
  await shot(host, '规则变体', '讨论时长 / 独狼看公共牌 / 能否投自己 / 平票');
  await host.getByTestId('reset-rules').click();
  await host.getByTestId('board-classic').click();
  await host.waitForTimeout(300);

  // ---------------------------------------------------------------- night A
  section = '夜晚（换牌局）';
  await stage(host, { ...A, timeScale: 1 });
  await shot(P('铁柱'), '夜里的样子（盖着）', '所有人同一个面板：按住看身份，点人/公共牌，一个「确认」按钮');
  await hold(P('村长'), 'identity-peek');
  await tap(P('村长'), '阿花');
  await shot(P('村长'), '预言家', '按住看任务；点一个人，或两张公共牌');
  await release(P('村长'), 'identity-peek');
  await P('村长').getByTestId('night-act').click();
  await hold(P('阿花'), 'identity-peek');
  await tapC(P('阿花'), 0);
  await shot(P('阿花'), '独狼', '只有一匹狼：点一张公共牌偷看（变体可关）');
  await release(P('阿花'), 'identity-peek');
  await P('阿花').getByTestId('night-act').click();
  await hold(P('铁柱'), 'identity-peek');
  await tap(P('铁柱'), '阿花');
  await shot(P('铁柱'), '夜贼', '');
  await release(P('铁柱'), 'identity-peek');
  await P('铁柱').getByTestId('night-act').click();
  await hold(P('小美'), 'identity-peek');
  await tap(P('小美'), '村长');
  await tap(P('小美'), '二狗');
  await shot(P('小美'), '搅局者', '点另外两个人');
  await release(P('小美'), 'identity-peek');
  await P('小美').getByTestId('night-act').click();
  await hold(P('老王'), 'identity-peek');
  await tapC(P('老王'), 1);
  await shot(P('老王'), '醉汉', '点一张公共牌，换了也不看');
  await release(P('老王'), 'identity-peek');
  await P('老王').getByTestId('night-act').click();
  await hold(P('二狗'), 'identity-peek');
  await tap(P('二狗'), '铁柱');
  await shot(P('二狗'), '夜猫子', '随便点一下；夜里结束前看到自己现在的牌');
  await release(P('二狗'), 'identity-peek');
  await P('二狗').getByTestId('night-act').click();
  await hold(P('阿强'), 'identity-peek');
  await tapC(P('阿强'), 2);
  await shot(P('阿强'), '村民（不睁眼）', '也要随便点一下，桌上看不出谁有行动');
  await release(P('阿强'), 'identity-peek');
  await hold(P('小红'), 'identity-peek');
  await shot(P('小红'), '猎人（不睁眼）', '');
  await release(P('小红'), 'identity-peek');

  section = '夜晚结果（只有自己按住才看得到）';
  await shot(P('村长'), '确认后（盖着）', '面板高度和行动前一样');
  for (const [who, title] of [['村长', '预言家看到的'], ['阿花', '独狼偷看的公共牌'], ['铁柱', '夜贼拿到的牌'], ['小美', '搅局者'], ['老王', '醉汉'], ['二狗', '夜猫子等结果']] as const) {
    await hold(P(who), 'result-peek');
    await shot(P(who), title, '', { full: false });
    await release(P(who), 'result-peek');
  }
  // owl's result: stage the same night near its end, timeline on the 夜猫子 slot
  await stage(host, { ...A, timeScale: 1, ago: 50_000, then: NIGHT_A });
  await hold(P('二狗'), 'result-peek');
  await expect(P('二狗').getByTestId('owl-card')).toBeVisible();
  await shot(P('二狗'), '夜猫子看到现在的牌', '时间线走到夜猫子、所有人都确认后才显示（被搅局者换成了预言家）', { full: false });
  await release(P('二狗'), 'result-peek');
  await P('阿强').getByTestId('timeline').scrollIntoViewIfNeeded();
  await shot(P('阿强'), '公开时间线', '每台手机一样：按时间走，当前角色高亮', { full: false });

  section = '夜晚（爪牙 / 双子局）';
  await stage(host, { ...B, timeScale: 1, ago: 6000 });
  for (const [who, title, note] of [['村长', '两匹狼', '看到狼队友；不能看公共牌'], ['阿花', '爪牙', '看到狼人，狼不知道他'], ['铁柱', '双子', '看到另一个双子'], ['阿强', '厌世者', '不睁眼']] as const) {
    await hold(P(who), 'identity-peek');
    await shot(P(who), title, note, { full: false });
    await release(P(who), 'identity-peek');
  }
  await P('老王').getByTestId('timeline').scrollIntoViewIfNeeded();
  await shot(P('老王'), '时间线念到公共牌里的角色', '夜贼、搅局者在公共牌里，照样念到', { full: false });
  await stage(host, { cards: ['wolf', 'minion', 'twin', 'seer', 'villager', 'villager', 'loner', 'hunter'], center: ['wolf', 'twin', 'thief'], timeScale: 1, ago: 6000 });
  await hold(P('铁柱'), 'identity-peek');
  await shot(P('铁柱'), '双子：另一张在公共牌', '', { full: false });
  await release(P('铁柱'), 'identity-peek');
  await stage(host, { ...A, timeScale: 1, ago: 200_000 });
  await host.getByTestId('force-dawn').scrollIntoViewIfNeeded();
  await shot(host, '强制天亮', '夜里太久没结束，只有房主看到；没确认的人当作什么都没做', { full: false });

  // ---------------------------------------------------------------- day
  section = '白天';
  await stage(host, { ...A, then: NIGHT_A + DAWN });
  await shot(host, '讨论（房主）', '倒计时；房主可以加时或提前开始投票');
  await shot(P('铁柱'), '讨论（其他人）', '');
  await hold(P('铁柱'), 'my-peek');
  await P('铁柱').getByTestId('my-night').scrollIntoViewIfNeeded();
  await shot(P('铁柱'), '回看自己的夜晚', '按住看：发到的牌 + 夜里看到的', { full: false });
  await release(P('铁柱'), 'my-peek');
  await stage(host, { ...A, then: `${NIGHT_A} ${DAWN} g.talkEnd = Date.now() + 20000;` });
  await shot(host, '最后 30 秒', '倒计时变红闪烁', { full: false });
  await host.getByTestId('start-vote').click();
  await tap(P('阿花'), '铁柱');
  await shot(P('阿花'), '投票', '点人 → 投；亮票前可以改');
  await P('阿花').getByTestId('vote-go').click();
  await shot(P('阿花'), '已投票', '');
  for (const [v, t] of [['村长', '铁柱'], ['铁柱', '阿花'], ['小美', '铁柱']] as const) { await tap(P(v), t); await P(v).getByTestId('vote-go').click(); }
  await shot(host, '投票进行中（房主）', '只显示谁投了，不显示投给谁；房主可以收票');

  // ---------------------------------------------------------------- endings
  section = '结局';
  // 0 村长→铁柱 1 阿花→铁柱 2 铁柱→阿花 3 小美→铁柱 4 老王→村长 5 二狗→铁柱 6 阿强→阿花 7 小红→铁柱
  await stage(host, { ...A, then: NIGHT_A + DAWN + votes([2, 2, 1, 2, 0, 2, 1, 2]) });
  await expect(host.getByTestId('vote-reveal')).toBeVisible();
  await host.waitForTimeout(2500);
  await shot(host, '一起亮票 → 好人胜利', '铁柱偷来了狼牌被投出', { full: false });
  await closeReveal(pages);
  await shot(host, '好人胜利：全部亮牌', '发到的牌 → 最后的牌、公共牌、票数、夜晚复盘');
  await shot(P('铁柱'), '好人胜利（输家视角）', '');
  // wolves win: a villager goes out
  await stage(host, { ...A, then: NIGHT_A + DAWN + votes([6, 6, 6, 6, 6, 6, 0, 6]) });
  await expect(host.getByTestId('vote-reveal')).toBeVisible();
  await host.waitForTimeout(2500);
  await closeReveal(pages);
  await shot(host, '狼人胜利', '投出了村民');
  // loner: 老王 drank the 厌世者 card and gets voted out
  await stage(host, { ...A, then: NIGHT_A + DAWN + votes([4, 4, 4, 4, 0, 4, 4, 4]) });
  await expect(host.getByTestId('vote-reveal')).toBeVisible();
  await host.waitForTimeout(2500);
  await shot(host, '厌世者胜利（亮票）', '醉汉喝到了厌世者牌，被投出局：只有他赢', { full: false });
  await closeReveal(pages);
  await shot(P('老王'), '厌世者胜利', '');
  // hunter: 小红 (hunter) out on a tie, takes 铁柱 (wolf) → village + 猎人
  await stage(host, { ...A, then: NIGHT_A + DAWN + votes([7, 7, 7, 0, 0, 0, 3, 2]) });
  await expect(host.getByTestId('vote-reveal')).toBeVisible();
  await host.waitForTimeout(2500);
  await shot(host, '平票都出局 + 猎人开枪', '村长和小红平票都出局；小红是猎人，带走她投的铁柱（狼）', { full: false });
  await closeReveal(pages);
  // everyone one vote → nobody out
  await stage(host, { ...A, then: NIGHT_A + DAWN + votes([1, 2, 3, 4, 5, 6, 7, 0]) });
  await expect(host.getByTestId('vote-reveal')).toBeVisible();
  await host.waitForTimeout(2500);
  await shot(host, '每人一票：无人出局', '狼在场，狼人胜利', { full: false });
  await closeReveal(pages);
  // no wolf among players
  const NOWOLF = { cards: ['seer', 'villager', 'thief', 'meddler', 'drunk', 'owl', 'villager', 'hunter'], center: ['wolf', 'wolf', 'loner'] };
  await stage(host, { ...NOWOLF, then: `${NIGHT_A} ${DAWN} ${votes([1, 2, 3, 4, 5, 6, 7, 0])}` });
  await closeReveal(pages);
  await shot(host, '狼都在公共牌里：无人出局 → 好人胜利', '');
  await stage(host, { ...NOWOLF, then: `${NIGHT_A} ${DAWN} ${votes([1, 0, 1, 1, 1, 1, 1, 1])}` });
  await closeReveal(pages);
  await shot(host, '狼都在公共牌里：投出好人 → 没有赢家', '');

  // ---------------------------------------------- one screen, no scrolling
  section = '一屏可见';
  const VIEWS = [['iPhone SE（Safari）', 375, 548], ['iPhone 15（Safari）', 393, 659], ['Android 常见（Chrome）', 360, 690], ['Pro Max（Safari）', 430, 746]] as const;
  const inView = async (p: Page, id: string, label: string, h: number) => {
    const box = await p.getByTestId(id).boundingBox();
    if (!box || box.y + box.height > h) fit.push(`${label}: ${id} bottom=${box ? Math.round(box.y + box.height) : 'none'} > ${h}`);
  };
  for (const [label, w, h] of VIEWS) {
    for (const p of pages) await p.setViewportSize({ width: w, height: h });
    await stage(host, { ...A, timeScale: 1 });
    await tap(P('铁柱'), '阿花');
    await inView(P('铁柱'), 'night-act', `${label} 夜晚`, h);
    await shot(P('铁柱'), `${label} · 夜晚`, `${w}×${h} 可见区域，不滑动`, { full: false, view: `${w}×${h}` });
    await P('铁柱').getByTestId('night-act').click();
    await inView(P('铁柱'), 'result-peek', `${label} 夜晚结果`, h);
    await shot(P('铁柱'), `${label} · 确认后`, '', { full: false, view: `${w}×${h}` });
    await stage(host, { ...A, then: NIGHT_A + DAWN });
    await inView(host, 'start-vote', `${label} 讨论`, h);
    await shot(host, `${label} · 讨论（房主）`, '', { full: false, view: `${w}×${h}` });
    await stage(host, { ...A, then: `${NIGHT_A} ${DAWN} R.startVote(g);` });
    await tap(P('小美'), '老王');
    await inView(P('小美'), 'vote-go', `${label} 投票`, h);
    await shot(P('小美'), `${label} · 投票`, '', { full: false, view: `${w}×${h}` });
  }

  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
  if (fit.length) console.log('NOT ON SCREEN:\n' + fit.join('\n'));
  expect(fit, 'main action visible without scrolling').toEqual([]);
});

/**
 * 双身份狼人 screen gallery for design review: stages every flow (incl. rare
 * ones: 金刚狼, 金宝宝, hunter, PK, 遗言, both endings) and screenshots each phone,
 * plus viewport-only shots at common phone sizes to check what fits without scrolling.
 *
 *   npx playwright test tests/werewolf-gallery.spec.ts
 *
 * Output: test-results/ww-gallery/*.png + manifest.json (section, title, note, who, viewport).
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const OUT = 'test-results/ww-gallery';
const NAMES = ['村长', '阿花', '铁柱', '小美', '老王', '二狗'];  // + 阿强 小红 for 丘比特
const manifest: { file: string; section: string; title: string; note: string; who: string; view?: string }[] = [];
let section = '';
let n = 0;

async function shot(page: Page, title: string, note = '', { full = true, view = '' } = {}) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}.png`;
  await page.waitForTimeout(900); // let stepped animations land
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: full });
  const who = await page.evaluate(() => {
    const w = window as any; const id = sessionStorage.getItem('avalon:pid');
    return w.__room?.players?.find((p: any) => p.id === id)?.name || '';
  }).catch(() => '');
  manifest.push({ file, section, title, note, who, view: view || undefined });
}

type Spec = { hands: string[][]; rules?: Record<string, string>; lock?: boolean; then?: string };
const stage = (host: Page, spec: Spec) => host.evaluate(async s => { const m = await import('/tests/wwStage.js'); await m.stage(s); }, spec);

async function dismissAll(pages: Page[]) {
  for (const p of pages) {
    for (const id of ['close-dawn', 'close-vote', 'close-seer']) {
      const b = p.getByTestId(id);
      if (await b.isVisible().catch(() => false)) await b.click({ timeout: 3000 }).catch(() => {});
    }
  }
}
const tap = (p: Page, name: string) => p.getByTestId(`seat-${name}`).click();
const scrollTo = (p: Page, id: string) => p.getByTestId(id).last().scrollIntoViewIfNeeded();
const hold = (p: Page, id: string) => p.getByTestId(id).dispatchEvent('pointerdown');
const release = (p: Page, id: string) => p.getByTestId(id).dispatchEvent('pointerup');

// seats: 村长 阿花 铁柱 小美 老王 二狗
const MAIN = [['seer', 'villager'], ['wolf', 'villager'], ['villager', 'villager'], ['witch', 'villager'], ['wolf', 'hunter'], ['guard', 'villager']];
// night 1 played out: guard 村长, seer checks 阿花, wolves kill 铁柱, witch passes → dawn
const NIGHT1 = "R.guardAct(g, ids[5], ids[0]); R.seerAct(g, ids[0], ids[1]); R.wolfAct(g, ids[1], ids[2]); R.wolfAct(g, ids[4], ids[2]); R.witchAct(g, ids[3], {}); R.settleNight(g, Infinity);";
const ACK_ALL = "while (g.step === 'confirm') { const c = g.confirm; R.ackLoss(g, c.ids.find(x => !(x in c.acked))); }";

test.use({ actionTimeout: 10_000 });
test('双身份狼人 screen gallery', async ({ browser }) => {
  test.setTimeout(600_000);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { (window as any).__wwTimeScale = 0.03; });
  const pages: Page[] = [];
  for (let i = 0; i < NAMES.length; i++) pages.push(await ctx.newPage());
  const [host] = pages;
  const P = (name: string) => pages[NAMES.indexOf(name)];

  // ---------------------------------------------------------------- entry
  section = '入口';
  const visitor = await ctx.newPage();
  await visitor.goto('/game?local=1');
  await expect(visitor.getByText('游戏厅')).toBeVisible();
  await shot(visitor, '游戏厅', 'zetphoto.com/game；进入游戏后顶栏变暗、变成一行');
  await host.goto('/game/werewolf?local=1');
  await shot(host, '狼人入口', '/game/werewolf：输名字，创建或加入房间');
  await host.getByTestId('name-input').fill(NAMES[0]);
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();
  await visitor.goto(`/game/werewolf/ZZZZ?local=1`);
  await shot(visitor, '房间不存在', '链接里的房间过期或不存在');
  await visitor.close();

  // ---------------------------------------------------------------- lobby
  section = '大厅';
  for (let i = 1; i < pages.length; i++) {
    await pages[i].goto(`/game/werewolf/${code}?local=1`);
    if (i === 1) await shot(pages[1], '朋友打开邀请链接', '房间号已填好');
    await pages[i].getByTestId('name-input').fill(NAMES[i]);
    await pages[i].getByRole('button', { name: '加入房间' }).click();
    await expect(pages[i].getByTestId('room-code')).toHaveText(code);
  }
  await host.waitForTimeout(500);
  await shot(host, '6 人到齐（房主）', '平衡的板子排前面；开局按钮贴在屏幕底部');
  await shot(P('阿花'), '6 人到齐（非房主）', '只显示本局板子，不再像能点');
  // seat swap: 阿花 asks 小美
  await tap(P('阿花'), '小美');
  await shot(P('阿花'), '请求换位', '点别人的座位 → 确认', { full: false });
  await P('阿花').getByTestId('confirm-ok').click();
  await expect(P('小美').getByTestId('swap-request')).toBeVisible();
  await shot(P('小美'), '收到换位请求', '同意 / 拒绝；1 号固定是房主');
  await shot(P('阿花'), '等待对方同意', '可以取消');
  await P('小美').getByTestId('swap-yes').click();
  await host.waitForTimeout(300);
  await shot(host, '换位完成', '阿花和小美互换座位');
  await tap(host, '阿花');
  await shot(host, '房主直接换位', '房主点两个座位就能换');
  await tap(host, '小美');
  await scrollTo(host, 'cupid-mode');
  await shot(host, '丘比特模式（人不够）', '特殊模式卡片；不到 8 人不能开', { full: false });
  await host.getByTestId('toggle-rules').click();
  await scrollTo(host, 'rule-card');
  await shot(host, '规则说明', '包括发言顺序和平票规则');
  await host.getByTestId('toggle-rules').click();
  await host.getByTestId('toggle-diy').click();
  await scrollTo(host, 'diy');
  await shot(host, '自定义 DIY', '选中项实心金色，★ 只是角标；说明在选项下面');
  for (let i = 0; i < 2; i++) await host.getByTestId('wolf-plus').click();
  await host.waitForTimeout(300);
  await scrollTo(host, 'balance-warning');
  await shot(host, '失衡警告', '狼牌太多：红色「非常不平衡」');
  await host.getByTestId('start-game').click();
  await expect(host.getByTestId('confirm')).toBeVisible();
  await shot(host, '开局前确认', '极度失衡时点开局会再确认一次', { full: false });
  await host.getByTestId('confirm-cancel').click();
  await host.getByTestId('preset-standard').click();

  // seats back to the original order for the staged scenes
  await host.evaluate(async () => {
    const { roomStore } = await import('/src/games/avalon/roomStore.js');
    const w = window as any;
    const order = ['村长', '阿花', '铁柱', '小美', '老王', '二狗'];
    await roomStore.update(w.__room.code, (r: any) => { r.players.sort((a: any, b: any) => order.indexOf(a.name) - order.indexOf(b.name)); return r; });
  });

  // -------------------------------------------------------------- arrange
  section = '排牌';
  await stage(host, { hands: MAIN, lock: false });
  await dismissAll(pages);
  await shot(P('阿花'), '狼人排牌', '排牌时直接显示牌面');
  await shot(P('村长'), '好人排牌', '');
  await stage(host, { hands: [['villager', 'seer'], ['wolf', 'wolf'], ['villager', 'villager'], ['witch', 'villager'], ['wolf', 'hunter'], ['guard', 'villager']], rules: { doubleWolf: 'force' }, lock: false });
  await shot(P('阿花'), '金刚狼排牌', '两张狼牌 = 金刚狼；现在至少还有一个狼队友');
  await stage(host, { hands: [['seer', 'villager'], ['wolf', 'villager'], ['villager', 'villager'], ['witch', 'wolf'], ['villager', 'villager'], ['guard', 'villager']], rules: { win: 'baby', peace: 'three' }, lock: false,
    then: 'g.hands[ids[0]].locked = true; g.hands[ids[1]].locked = true; g.hands[ids[3]].locked = true;' });
  await shot(P('铁柱'), '金宝宝排牌', '金宝宝能看到其他金宝宝');
  await shot(P('村长'), '锁定后等待', '桌上不再显示谁已锁定，只显示人数');

  // ---------------------------------------------------------------- night
  section = '第一夜';
  await stage(host, { hands: MAIN });
  await shot(P('铁柱'), '闭眼的人', '夜间面板高度统一');
  await tap(P('二狗'), '村长');
  await shot(P('二狗'), '守卫', '按钮恢复角色颜色：守卫蓝、预言家金、狼红');
  await P('二狗').getByTestId('guard-act').click();
  await tap(P('村长'), '阿花');
  await shot(P('村长'), '预言家', '');
  await P('村长').getByTestId('seer-act').click();
  await expect(P('村长').getByTestId('seer-reveal')).toBeVisible();
  await shot(P('村长'), '预言家结果', '', { full: false });
  await P('村长').getByTestId('close-seer').click();
  await tap(P('阿花'), '铁柱');
  await shot(P('阿花'), '狼人选刀', '');
  await P('阿花').getByTestId('wolf-kill').click();
  await shot(P('老王'), '队友已出刀', '');
  await tap(P('老王'), '铁柱');
  await P('老王').getByTestId('wolf-kill').click();
  await expect(P('小美').getByTestId('witch-save')).toBeVisible();
  await shot(P('小美'), '女巫', '救（蓝）/ 毒（红）/ 不用');
  await P('小美').getByTestId('witch-skip').click();
  await shot(P('二狗'), '守卫等天亮', '每晚至少 30 秒，结束时间带随机延迟，看不出谁还在操作');

  // --------------------------------------------------------------- dawn
  section = '天亮';
  await expect(host.getByTestId('dawn-reveal')).toBeVisible({ timeout: 15_000 });
  await shot(host, '天亮公告', '遮罩几乎不透明', { full: false });
  await dismissAll(pages);
  await shot(P('铁柱'), '失去一条命：确认', '只有自己看得到；说明第二张牌意味着什么');
  await shot(host, '其他人在等确认', '看不出谁是猎人');
  await P('铁柱').getByTestId('ack-loss').click();
  await host.waitForTimeout(400);
  await dismissAll(pages);

  section = '白天';
  const order = await host.evaluate(() => (window as any).__room.game.speak.order as string[]);
  const nameOf = async (id: string) => host.evaluate(i => (window as any).__room.players.find((p: any) => p.id === i).name, id);
  const first = await nameOf(order[0]);
  await shot(P(first), '轮到你发言', '发言顺序：从死者旁边开始，方向随机；带计时');
  await shot(host, '白天（房主）', '房主可以跳到下一位，或随时开投票');
  await P(first).getByTestId('speak-done').click();
  await hold(P('铁柱'), 'hand-peek');
  await scrollTo(P('铁柱'), 'hand-peek');
  await shot(P('铁柱'), '我的牌（按住看）', '失去第一条命后的身份说明');
  await release(P('铁柱'), 'hand-peek');
  await hold(P('村长'), 'hand-peek');
  await scrollTo(P('村长'), 'hand-peek');
  await shot(P('村长'), '预言家的查验记录', '查验结果不再挂在圆桌上，只在按住的手牌里');
  await release(P('村长'), 'hand-peek');
  await host.getByTestId('start-vote').click();
  await tap(P('阿花'), '村长');
  await shot(P('阿花'), '投票', '');
  await P('阿花').getByTestId('vote-go').click();
  for (const [v, t] of [['村长', '阿花'], ['铁柱', '阿花'], ['小美', '阿花']] as const) { await tap(P(v), t); await P(v).getByTestId('vote-go').click(); }
  await shot(host, '投票进行中', '');
  for (const [v, t] of [['老王', '村长'], ['二狗', '阿花']] as const) { await tap(P(v), t); await P(v).getByTestId('vote-go').click(); }
  await expect(host.getByTestId('vote-reveal')).toBeVisible();
  await host.waitForTimeout(2200);
  await shot(host, '投票结果', '', { full: false });
  await dismissAll(pages);
  await P('阿花').getByTestId('ack-loss').click();
  await host.waitForTimeout(300);
  await dismissAll(pages);
  await shot(host, '黄昏', '投票后先停在黄昏，房主点「天黑请闭眼」才入夜');
  await host.getByTestId('log').scrollIntoViewIfNeeded();
  await shot(host, '公开记录', '');

  // -------------------------------------------------------- rare flows
  section = '特殊流程';
  // 遗言: voted out for good
  await stage(host, { hands: MAIN, then: `${NIGHT1} ${ACK_ALL} g.dead[ids[1]] = 1; R.startVote(g); R.voters(g).forEach(v => R.castVote(g, v, v === ids[1] ? ids[0] : ids[1])); ${ACK_ALL}` });
  await dismissAll(pages);
  await shot(P('阿花'), '遗言', '被投出局的人留遗言，说完再天黑');
  // PK
  await stage(host, { hands: MAIN, rules: { pk: 'yes' }, then: `${NIGHT1} ${ACK_ALL} R.startVote(g); const t = { [ids[0]]: ids[1], [ids[1]]: ids[0], [ids[2]]: ids[1], [ids[3]]: ids[0], [ids[4]]: null, [ids[5]]: null }; ids.forEach(v => R.castVote(g, v, t[v]));` });
  await dismissAll(pages);
  await shot(host, '平票 PK', '规则变体：平票的人再发言一轮');
  await host.getByTestId('start-vote').click();
  await shot(P('铁柱'), 'PK 投票', '只能投 PK 台上的人');
  // 金刚狼 double strike (now needs a wolf partner: 老王)
  await stage(host, { hands: [['seer', 'villager'], ['wolf', 'wolf'], ['villager', 'villager'], ['witch', 'villager'], ['wolf', 'hunter'], ['guard', 'villager']], rules: { doubleWolf: 'force' },
    then: 'R.guardAct(g, ids[5], ids[0]); R.seerAct(g, ids[0], ids[2]); R.wolfAct(g, ids[4], ids[0]);' });
  await P('阿花').getByTestId('jgl-toggle').click();
  await tap(P('阿花'), '村长');
  await shot(P('阿花'), '金刚狼一刀两命', '');
  await P('阿花').getByTestId('wolf-kill').click();
  await expect(P('小美').getByTestId('witch-save')).toBeVisible();
  await shot(P('小美'), '女巫面对金刚狼', '解药不可用');
  await P('小美').getByTestId('witch-skip').click();
  await expect(host.getByTestId('dawn-reveal')).toBeVisible({ timeout: 15_000 });
  await shot(P('二狗'), '金刚狼天亮', '合并成「失去两条命（出局）」', { full: false });
  // hunter keeps the gun hidden
  await stage(host, { hands: [['seer', 'villager'], ['wolf', 'villager'], ['villager', 'villager'], ['witch', 'villager'], ['hunter', 'villager'], ['guard', 'wolf']],
    then: 'R.guardAct(g, ids[5], ids[0]); R.seerAct(g, ids[0], ids[2]); R.wolfAct(g, ids[1], ids[4]); R.witchAct(g, ids[3], {}); R.settleNight(g, Infinity);' });
  await dismissAll(pages);
  await tap(P('老王'), '阿花');
  await shot(P('老王'), '猎人开枪', '在同一个「失去一条命」面板里选；别人看不出');
  await P('老王').getByTestId('hunter-shoot').click();
  await P('老王').getByTestId('confirm-ok').click();
  await host.waitForTimeout(400);
  await dismissAll(pages);
  await host.getByTestId('log').scrollIntoViewIfNeeded();
  await shot(host, '开枪记录', '不亮牌时记录写「有人开枪」，不写是谁');
  // mute + reveal
  await stage(host, { hands: MAIN, rules: { mute: 'yes', reveal: 'show' }, then: `${NIGHT1} ${ACK_ALL} R.startVote(g);` });
  await dismissAll(pages);
  await shot(P('铁柱'), '一死禁票', '');
  // peace
  await stage(host, { hands: MAIN, rules: { win: 'baby', peace: 'three' },
    then: 'R.guardAct(g, ids[5], ids[2]); R.seerAct(g, ids[0], ids[1]); R.wolfAct(g, ids[1], ids[2]); R.wolfAct(g, ids[4], ids[2]); R.witchAct(g, ids[3], {}); R.settleNight(g, Infinity);' });
  await expect(host.getByTestId('dawn-reveal')).toBeVisible();
  await shot(host, '平安夜', '', { full: false });
  await dismissAll(pages);
  await shot(host, '平安夜计数', '圆桌中间只写「平安夜 1/3」');
  // force dawn
  await stage(host, { hands: MAIN, then: 'g.nightStart = Date.now() - 120000;' });
  await expect(host.getByTestId('force-dawn')).toBeVisible({ timeout: 8000 });
  await host.getByTestId('force-dawn').scrollIntoViewIfNeeded();
  await shot(host, '强制天亮', '夜里太久没结束时，只有房主看到这个按钮', { full: false });

  // ---------------------------------------------------------------- end
  section = '结局';
  await stage(host, { hands: MAIN, then: `${NIGHT1} ${ACK_ALL} g.dead[ids[4]] = 2; R.startVote(g); R.voters(g).forEach(v => R.castVote(g, v, v === ids[1] ? ids[0] : ids[1]));` });
  await dismissAll(pages);
  await shot(host, '好人胜利（房主）', '全员亮牌 + 夜晚复盘');
  await shot(P('阿花'), '好人胜利（狼人视角）', '');
  await stage(host, { hands: MAIN, rules: { win: 'baby', peace: 'three' },
    then: 'g.dead[ids[2]] = 1; R.guardAct(g, ids[5], ids[0]); R.seerAct(g, ids[0], ids[3]); R.wolfAct(g, ids[1], ids[2]); R.wolfAct(g, ids[4], ids[2]); R.witchAct(g, ids[3], {}); R.settleNight(g, Infinity);' });
  await dismissAll(pages);
  await shot(host, '狼人胜利', '金宝宝局：金宝宝全部出局');

  // ---------------------------------------------- one screen, no scrolling
  section = '一屏可见';
  const VIEWS = [['iPhone SE（Safari）', 375, 548], ['iPhone 15（Safari）', 393, 659], ['Android 常见（Chrome）', 360, 690], ['Pro Max（Safari）', 430, 746]] as const;
  for (const [label, w, h] of VIEWS) {
    for (const p of pages) await p.setViewportSize({ width: w, height: h });
    await stage(host, { hands: MAIN });
    await tap(P('阿花'), '铁柱');
    await shot(P('阿花'), `${label} · 夜晚`, `${w}×${h} 可见区域，不滑动`, { full: false, view: `${w}×${h}` });
    await stage(host, { hands: MAIN, then: `${NIGHT1} ${ACK_ALL}` });
    await dismissAll(pages);
    const o = await host.evaluate(() => (window as any).__room.game.speak.order[0] as string);
    await shot(P(await nameOf(o)), `${label} · 白天发言`, '', { full: false, view: `${w}×${h}` });
    await stage(host, { hands: MAIN, then: `${NIGHT1} ${ACK_ALL} R.startVote(g);` });
    await dismissAll(pages);
    await tap(P('小美'), '老王');
    await shot(P('小美'), `${label} · 投票`, '', { full: false, view: `${w}×${h}` });
  }

  // ------------------------------------------------------------ 丘比特
  section = '丘比特模式';
  for (const p of pages) await p.setViewportSize({ width: 390, height: 844 });
  await host.evaluate(async () => {
    const { roomStore } = await import('/src/games/avalon/roomStore.js');
    const w = window as any;
    await roomStore.update(w.__room.code, (r: any) => { r.phase = 'lobby'; r.game = null; return r; });
  });
  for (const name of ['阿强', '小红']) {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`/game/werewolf/${code}?local=1`);
    await p.getByTestId('name-input').fill(name);
    await p.getByRole('button', { name: '加入房间' }).click();
    await expect(p.getByTestId('room-code')).toHaveText(code);
    pages.push(p);
    NAMES.push(name);
  }
  await host.getByTestId('toggle-cupid').click();
  await host.waitForTimeout(400);
  await scrollTo(host, 'cupid-mode');
  await shot(host, '开启丘比特模式（8 人）', '牌组里多一张丘比特，推荐牌组按模拟调过');
  const C8 = [['seer', 'villager'], ['wolf', 'villager'], ['villager', 'villager'], ['witch', 'villager'], ['wolf', 'hunter'], ['guard', 'villager'], ['cupid', 'villager'], ['wolf', 'villager']];
  await stage(host, { hands: C8, rules: { cupid: 'yes' } });
  await tap(P('阿强'), '铁柱');
  await tap(P('阿强'), '小红');
  await shot(P('阿强'), '丘比特连情侣', '第一晚点两个人（可以点自己）');
  await P('阿强').getByTestId('cupid-act').click();
  await expect(P('铁柱').getByTestId('love-reveal')).toBeVisible();
  await shot(P('铁柱'), '被连成情侣', '只有情侣自己看到；人狼恋会说明变成第三方', { full: false });
  await expect(P('阿强').getByTestId('love-reveal')).toBeVisible();
  await shot(P('阿强'), '丘比特看到结果', '', { full: false });
  await P('铁柱').getByTestId('close-love').click();
  await shot(P('铁柱'), '情侣的圆桌', '情侣和丘比特的圆桌上有爱心');
  // vote out 小红 for good → 铁柱 殉情
  await stage(host, { hands: C8, rules: { cupid: 'yes' }, then: "R.cupidAct(g, ids[6], ids[2], ids[7]); R.guardAct(g, ids[5], ids[0]); R.seerAct(g, ids[0], ids[1]); R.wolfAct(g, ids[1], ids[3]); R.wolfAct(g, ids[4], ids[3]); R.wolfAct(g, ids[7], ids[3]); R.witchAct(g, ids[3], {}); R.settleNight(g, Infinity); " + ACK_ALL + " g.dead[ids[7]] = 1; R.startVote(g); R.voters(g).forEach(v => R.castVote(g, v, v === ids[7] ? ids[0] : ids[7]));" });
  await expect(host.getByTestId('vote-reveal')).toBeVisible();
  await host.waitForTimeout(2600);
  await shot(host, '殉情', '投出一个情侣，另一个跟着出局', { full: false });
  await dismissAll(pages);
  await shot(P('铁柱'), '殉情确认', '');
  // love win
  await stage(host, { hands: C8, rules: { cupid: 'yes' }, then: "R.cupidAct(g, ids[6], ids[2], ids[7]); R.guardAct(g, ids[5], ids[0]); R.seerAct(g, ids[0], ids[1]); R.wolfAct(g, ids[1], ids[3]); R.wolfAct(g, ids[4], ids[3]); R.wolfAct(g, ids[7], ids[3]); R.witchAct(g, ids[3], {}); R.settleNight(g, Infinity); " + ACK_ALL + " [0, 1, 3, 4].forEach(i => { g.dead[ids[i]] = 2; }); g.dead[ids[5]] = 1; R.startVote(g); R.voters(g).forEach(v => R.castVote(g, v, ids[5]));" });
  await dismissAll(pages);
  await shot(P('小红'), '情侣胜利', '人狼恋 + 丘比特活到最后');

  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
});

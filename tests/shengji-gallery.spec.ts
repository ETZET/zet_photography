/**
 * 升级 / 拖拉机 screen gallery for design review: stages every flow and screenshots
 * the relevant phone, plus viewport-only shots at landscape phone sizes ('一屏可见')
 * and the portrait "rotate your phone" prompt.
 *
 *   npx playwright test -c playwright.shengji.config.ts tests/shengji-gallery.spec.ts
 *
 * Output: test-results/shengji-gallery/*.png + manifest.json ({ file, section, title, note, who, view }).
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const STRIP = { x: 8, y: 30 }; // tap a card's visible left strip, like a finger on an overlapped hand

const OUT = 'test-results/shengji-gallery';
const NAMES = ['房主', '阿花', '铁柱', '小美'];
const LAND = { width: 844, height: 390 };
const PORT = { width: 390, height: 844 };
const manifest: { file: string; section: string; title: string; note: string; who: string; view?: string }[] = [];
let section = '';
let n = 0;

async function shot(page: Page, title: string, note = '', { full = false, view = '' } = {}) {
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
const stage = (host: Page, spec: any) => host.evaluate(async s => { const m = await import('/tests/sjStage.js'); await m.stage(s); }, spec);
const engine = (host: Page, code: string) => host.evaluate(async c => {
  const { roomStore } = await import('/src/games/avalon/roomStore.js');
  const R = await import('/src/games/shengji/shengjiRules.js');
  const w = window as any;
  await roomStore.update(w.__room.code, (r: any) => {
    // eslint-disable-next-line no-new-func
    new Function('R', 'g', 'ids', c)(R, r.game, r.players.map((p: any) => p.id));
    return r;
  });
}, code);
const tapCard = (p: Page, id: string) => p.locator(`[data-card="${id}"]`).first().click({ position: STRIP });
const play = async (p: Page, ids: string[]) => { for (const c of ids) await tapCard(p, c); await p.getByTestId('play').click(); };
const hintPlay = async (p: Page) => { await p.getByTestId('hint').click(); await p.getByTestId('play').click(); };

// 房主 = 庄家 (seat 1), ♠ trump, level 2. Fixed cards per seat, the rest random.
const KEEP0 = ['HA0', 'HK0', 'HK1', 'SQ0', 'SQ1', 'SJ0', 'SJ1', 'CQ0', 'CQ1', 'CJ0', 'CJ1', 'DA0', 'DQ0', 'DJ0', 'XB0'];
const HANDS = [KEEP0, ['H50', 'H51', 'H30', 'HJ0', 'CK0', 'CT0'], ['H70', 'H71', 'H80', 'H81', 'DK0', 'DT0'], ['H90', 'HQ0', 'S30', 'S31']];
const PLAYING = `g.bid = { seat: 0, suit: 'S', strength: 1, cards: [] }; R.finishDeal(g); R.bury(g, 0, g.hands[0].filter(c => !${JSON.stringify(KEEP0)}.includes(c)).sort((a, b) => R.cardPoints(a) - R.cardPoints(b)).slice(0, 8));`;
const PLAY_STAGE = { hands: HANDS, dealer: 0, levels: ['2', '2'], hand: 3, voids: { 1: 'C', 3: 'D' }, then: PLAYING };

test.use({ actionTimeout: 10_000 });
test('升级 screen gallery', async ({ browser }) => {
  test.setTimeout(600_000);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: PORT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { (window as any).__sjTimeScale = 0.05; });
  const pages: Page[] = [];
  for (let i = 0; i < NAMES.length; i++) pages.push(await ctx.newPage());
  const [host] = pages;
  const P = (name: string) => pages[NAMES.indexOf(name)];
  const land = async () => { for (const p of pages) await p.setViewportSize(LAND); };

  // ---------------------------------------------------------------- entry
  section = '入口';
  const visitor = await ctx.newPage();
  await visitor.goto('/game?local=1');
  await expect(visitor.getByText('游戏厅')).toBeVisible();
  await visitor.getByText('升级 · 拖拉机').scrollIntoViewIfNeeded();
  await shot(visitor, '游戏厅', '新的「升级 · 拖拉机」卡片（order 50）', { full: true });
  await host.goto('/game/shengji?local=1');
  await shot(host, '升级入口', '/game/shengji：输名字，创建或加入房间', { full: true });
  await host.getByTestId('name-input').fill(NAMES[0]);
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();
  await visitor.goto('/game/shengji/ZZZZ?local=1');
  await shot(visitor, '房间不存在', '');
  await visitor.close();

  // ---------------------------------------------------------------- lobby
  section = '大厅 · 座位 · 玩法';
  await shot(host, '一个人的大厅', '正好 4 人才能开局；本地开发可以加机器人', { full: true });
  for (let i = 1; i < pages.length; i++) {
    await pages[i].goto(`/game/shengji/${code}?local=1`);
    if (i === 1) await shot(pages[1], '朋友打开邀请链接', '房间号已填好');
    await pages[i].getByTestId('name-input').fill(NAMES[i]);
    await pages[i].getByRole('button', { name: '加入房间' }).click();
    await expect(pages[i].getByTestId('room-code')).toHaveText(code);
  }
  await host.waitForTimeout(400);
  await shot(host, '4 人到齐（房主）', '座位上标甲队（1·3）/ 乙队（2·4），对面是队友', { full: true });
  await shot(P('阿花'), '4 人到齐（非房主）', '只显示本局玩法', { full: true });
  await P('阿花').getByTestId('seat-铁柱').click();
  await shot(P('阿花'), '请求换位', '换座位 = 换队友');
  await P('阿花').getByTestId('confirm-ok').click();
  await expect(P('铁柱').getByTestId('swap-request')).toBeVisible();
  await shot(P('铁柱'), '收到换位请求', '同意 / 拒绝');
  await P('铁柱').getByTestId('swap-no').click();
  await host.getByTestId('seat-阿花').click();
  await shot(host, '房主直接换位', '点两个座位就能换；再点取消');
  await host.getByTestId('seat-阿花').click();
  await host.getByTestId('presets').scrollIntoViewIfNeeded();
  await shot(host, '预设玩法', '标准 / 休闲 / 严格（5、10、K 必打）/ 快速局');
  await host.getByTestId('toggle-rules').click();
  await host.getByTestId('rule-card').scrollIntoViewIfNeeded();
  await shot(host, '完整规则', '大小顺序、出牌、分数、升级表', { full: true });
  await host.getByTestId('toggle-rules').click();
  await host.getByTestId('toggle-diy').click();
  await host.getByTestId('diy').scrollIntoViewIfNeeded();
  await shot(host, '自定义 DIY', '能不能甩牌 / 甩牌失败怎么罚 / 拖拉机跨级牌 / 扣底翻倍 / 反主 / 必打 / 从几打起；★ = 最常见');
  await host.getByTestId('rule-throw-no').click();
  await host.getByTestId('rule-must-5tk').click();
  await host.waitForTimeout(300);
  await host.getByTestId('diy').scrollIntoViewIfNeeded();
  await shot(host, '改了规则 → 自定义', '不能甩牌时「甩牌失败怎么罚」变灰', { full: true });
  await P('小美').getByTestId('toggle-diy').click();
  await P('小美').getByTestId('diy').scrollIntoViewIfNeeded();
  await shot(P('小美'), '非房主看到的规则', '实时同步，不能改');
  await host.getByTestId('reset-rules').click();
  await host.getByTestId('start-game').scrollIntoViewIfNeeded();
  await host.getByTestId('start-game').click();
  await expect(host.getByTestId('rotate')).toBeVisible();

  section = '横屏提示';
  await shot(host, '竖屏时提示横过来', '游戏里竖屏只显示这个；可以选「仍然竖着玩」');

  // ---------------------------------------------------------------- deal
  await land();
  section = '发牌 · 亮主 · 反主';
  const DEAL = [['S20', 'SA0', 'S50'], ['H20', 'H21', 'HK0'], ['C40', 'CA0'], ['XS0', 'XS1', 'D50']];
  await stage(host, { hands: DEAL, dealt: 1 });
  await engine(host, 'g.dealStart = Date.now() - R.dealMs(g) * 0.5;');
  await shot(P('铁柱'), '开始发牌', '牌一张一张发到手里（约 7 秒发完）；进度条在牌桌中间');
  await stage(host, { hands: DEAL, dealt: 9 });
  await shot(P('铁柱'), '发牌中，没有级牌', '没有能亮的牌就只能看着；手牌按「王、级牌在前」排好');
  await shot(host, '摸到级牌 ♠2 → 可以亮主', '按钮出现在牌桌中间');
  await host.getByTestId('bid-S-1').click();
  await shot(P('小美'), '房主亮了 ♠', '亮出的牌摆在亮主人面前');
  await shot(P('阿花'), '有一对 ♥2 → 可以反主', '一对级牌才能反；单张反不了');
  await P('阿花').getByTestId('bid-H-2').click();
  await shot(host, '被反主了', '房主没有更大的牌，按钮消失');
  await shot(P('小美'), '一对小王 → 反成无主', '小王对 < 大王对');
  await P('小美').getByTestId('bid-NT-3').click();
  await shot(P('铁柱'), '无主', '');
  await engine(host, 'g.timeScale = 1; g.dealStart = Date.now() - R.DEAL_MS * 25 - 10;');
  await shot(host, '发完了：最后几秒', '还能亮；不亮就点「不亮」，全员不亮或时间到就开始');
  for (const p of pages) await p.getByTestId('pass').click();
  await expect(P('小美').getByTestId('bury')).toBeVisible();

  // ---------------------------------------------------------------- bury
  section = '扣底';
  await shot(P('小美'), '庄家扣底', '33 张一行排开；第一局谁亮的主谁当庄');
  const cards = P('小美').getByTestId('hand-card');
  for (let i = 0; i < 8; i++) await cards.nth(32 - i).click({ position: STRIP });
  await shot(P('小美'), '选好 8 张', '显示扣下去的分');
  await shot(host, '其他人等庄家扣底', '');
  await stage(host, { hands: [[], [], [], []], dealt: 25, then: 'R.finishDeal(g);' });
  await shot(host, '没人亮主：翻底定主', '底牌里第一张级牌定主，没有就看最大的牌');

  // ---------------------------------------------------------------- play
  section = '出牌 · 跟牌';
  await stage(host, PLAY_STAGE);
  await shot(host, '轮到庄家首发', '手牌：主（金底）在前，副牌按花色；按钮固定在右下');
  await tapCard(host, 'HK0'); await tapCard(host, 'HK1');
  await shot(host, '选了一对', '左下随时提示能不能出');
  await host.getByTestId('play').click();
  await tapCard(P('阿花'), 'H30'); await tapCard(P('阿花'), 'HJ0');
  await shot(P('阿花'), '有对子不跟对子', '红字说明为什么不能出，出牌按钮变灰');
  await tapCard(P('阿花'), 'H30'); await tapCard(P('阿花'), 'HJ0');
  await P('阿花').getByTestId('hint').click();
  await shot(P('阿花'), '提示：自动选合法的牌', '');
  await P('阿花').getByTestId('play').click();
  await hintPlay(P('铁柱'));
  await shot(P('小美'), '跟牌：桌上四家', '对家在上，左右是对手；目前最大的一手有金框和「大」');
  await hintPlay(P('小美'));
  await shot(host, '一轮结束', '谁拿下、得了几分，停留片刻再清桌');
  // tractor lead + short suit follow + 毙牌
  await tapCard(host, 'CQ0'); await tapCard(host, 'CQ1'); await tapCard(host, 'CJ0'); await tapCard(host, 'CJ1');
  await shot(host, '拖拉机', '♣QQJJ = 两对拖拉机');
  await host.getByTestId('play').click();
  await expect(P('阿花').getByTestId('play-short')).toBeVisible();
  await shot(P('阿花'), '短门自动选', '♣ 只剩两张：自动选上，再补两张');
  await hintPlay(P('阿花'));
  await hintPlay(P('铁柱'));
  await hintPlay(P('小美'));
  await host.waitForTimeout(300);
  await tapCard(host, 'DJ0');
  await host.getByTestId('play').click();
  await hintPlay(P('阿花'));
  await hintPlay(P('铁柱'));
  await expect(P('小美').getByTestId('hint')).toBeEnabled();
  await P('小美').getByTestId('hint').click();
  // 小美 has no ♦: trump it with the lowest spade instead of the hint's filler
  const spade = await P('小美').evaluate(() => (window as any).__room.game.hands[3].filter((c: string) => c[0] === 'S' && c[1] !== '2').sort()[0]);
  await P('小美').getByTestId('hint').click();
  for (const c of await P('小美').evaluate(() => [...document.querySelectorAll('.sj-card.sel')].map(e => e.getAttribute('data-card')))) await tapCard(P('小美'), c!);
  await tapCard(P('小美'), spade);
  await shot(P('小美'), '没有这门：用主牌毙', '');
  await P('小美').getByTestId('play').click();
  await shot(host, '被毙了', '主牌最大');
  await host.getByTestId('last-trick').click();
  await shot(host, '上一轮', '四家出的牌、谁拿下、闲家已得的分牌');
  await host.getByTestId('close-last').click();
  await P('小美').getByTestId('menu').click();
  await shot(P('小美'), '菜单', '本局规则 / 离开房间（房主还有回大厅）');
  await P('小美').getByTestId('show-rules').click();
  await shot(P('小美'), '本局规则', '');
  await P('小美').locator('[data-testid="rules-panel"]').click({ position: { x: 5, y: 5 } });

  // ---------------------------------------------------------------- throws
  section = '甩牌';
  await stage(host, PLAY_STAGE);
  await tapCard(host, 'HA0'); await tapCard(host, 'HK0'); await tapCard(host, 'HK1');
  await shot(host, '甩牌：♥A + ♥KK', '状态栏提醒：有人管得上就失败');
  await host.getByTestId('play').click();
  await shot(P('阿花'), '甩牌成功', '没人有更大的 ♥ 单张或对子');
  await hintPlay(P('阿花'));
  await shot(P('铁柱'), '跟甩牌', '要跟同样多的 ♥，有对子跟对子');
  await stage(host, PLAY_STAGE);
  await tapCard(host, 'DA0'); await tapCard(host, 'DQ0'); await tapCard(host, 'DJ0');
  await host.getByTestId('play').click();
  await shot(P('阿花'), '甩牌失败（每张罚 10）', '铁柱有 ♦K：只出最小的 ♦J，收回两张，罚 20 分给闲家');
  await shot(host, '甩牌失败（庄家视角）', '闲家分数立刻加上罚分');
  await stage(host, { ...PLAY_STAGE, rules: { penalty: 'none' } });
  await tapCard(host, 'DA0'); await tapCard(host, 'DQ0'); await tapCard(host, 'DJ0');
  await host.getByTestId('play').click();
  await shot(P('铁柱'), '甩牌失败（不罚分）', '规则变体：只出最小那手');
  await stage(host, { ...PLAY_STAGE, rules: { throw: 'no' } });
  await tapCard(host, 'HA0'); await tapCard(host, 'HK0'); await tapCard(host, 'HK1');
  await shot(host, '不能甩牌', '规则变体：一次只能出一手');

  // ---------------------------------------------------------------- results
  section = '结算 · 升级';
  const END = (pts: number, lead: string[], winner: number, buried: string[]) =>
    `${PLAYING} g.points = ${pts}; g.trickNo = 25; g.buried = ${JSON.stringify(buried)}; ` +
    `g.lastTrick = { plays: [0,1,2,3].map(i => ({ seat: (${winner} + i) % 4, cards: i === 0 ? ${JSON.stringify(lead)} : g.hands[(${winner} + i) % 4].slice(0, ${lead.length}) })), winner: ${winner}, no: 25, at: 0 }; ` +
    'g.pointCards = g.hands[1].filter(c => R.cardPoints(c)).slice(0, 6); g.hands = [[], [], [], []]; R.endHand(g);';
  await stage(host, { ...PLAY_STAGE, then: END(70, ['CA0', 'CA1'], 1, ['SK0', 'D50', 'CT1', 'C60', 'C70', 'D80', 'D90', 'H60']) });
  await expect(host.getByTestId('result')).toBeVisible();
  await shot(host, '扣底：闲家上台', '闲家 70 分 + 底牌 25 分 × 4（对子扣底）= 170 → 上台升 2 级');
  await shot(P('阿花'), '扣底（闲家视角）', '赢的一方金框');
  await stage(host, { ...PLAY_STAGE, then: END(25, ['SA0'], 0, ['C60', 'C70', 'C80', 'C90', 'D60', 'D70', 'D80', 'D90']) });
  await shot(host, '庄家守住，升 2 级', '闲家 25 分（5–35）');
  await stage(host, { ...PLAY_STAGE, levels: ['3', '2'], rules: { must: '5tk' }, then: END(0, ['SA0'], 0, ['C60', 'C70', 'C80', 'C90', 'D60', 'D70', 'D80', 'D90']) });
  await shot(host, '必打：停在 5', '0 分本该升 3 级（3 → 6），5 必打所以停在 5');
  await host.getByTestId('next-hand').click();
  await expect(P('阿花').getByTestId('sj-board')).toHaveAttribute('data-step', 'deal');
  await shot(P('铁柱'), '下一局', '庄家方守住 → 对家坐庄；打自己的级');
  await stage(host, { ...PLAY_STAGE, levels: ['A', 'Q'], hand: 14,
    then: `${END(30, ['SA0'], 0, ['C60', 'C70', 'C80', 'C90', 'D60', 'D70', 'D80', 'D90'])} g.history = [${[['2', '2', 0, 'S'], ['5', '2', 1, 'H'], ['3', '5', 2, null], ['K', 'A', 3, 'D']].map(([f, t, d, s]) => `{ hand: ${Number(d) + 1}, dealer: ${d}, level: '${f}', trump: ${s ? `'${s}'` : null}, total: 40, side: 'dealer', team: ${Number(d) % 2}, from: '${f}', to: '${t}' }`).join(',')}, ...g.history];` });
  await expect(host.getByTestId('game-over')).toBeVisible();
  await shot(host, '打过 A：赢了整场', '每一局的记录；房主可以再来一场或回大厅');
  await shot(P('阿花'), '输的一方', '');

  // ---------------------------------------------- one screen, no scrolling
  section = '一屏可见';
  const VIEWS = [['iPhone SE 横屏', 667, 320], ['iPhone 15 横屏', 844, 340], ['Android 横屏', 740, 310], ['Pro Max 横屏', 932, 380]] as const;
  for (const [label, w, h] of VIEWS) {
    for (const p of pages) await p.setViewportSize({ width: w, height: h });
    const view = `${w}×${h}`;
    await stage(host, PLAY_STAGE);
    await play(host, ['CQ0', 'CQ1', 'CJ0', 'CJ1']);
    await hintPlay(P('阿花'));
    await P('铁柱').getByTestId('hint').click();
    await shot(P('铁柱'), `${label} · 跟牌`, `${view} 可见区域，不滑动；按钮和整手牌都在屏幕上`, { view });
    await stage(host, { hands: DEAL, dealt: 16 });
    await host.getByTestId('bid-S-1').click();
    await shot(P('阿花'), `${label} · 发牌反主`, '', { view });
    await stage(host, { ...PLAY_STAGE, then: "g.bid = { seat: 0, suit: 'S', strength: 1, cards: [] }; R.finishDeal(g);" });
    await shot(host, `${label} · 扣底`, '33 张', { view });
  }
  for (const p of pages) await p.setViewportSize({ width: 375, height: 548 });
  await stage(host, PLAY_STAGE);
  await shot(P('阿花'), '竖屏 iPhone SE · 提示横屏', '375×548：游戏中竖屏只显示横屏提示', { view: '375×548' });

  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
});

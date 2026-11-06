/**
 * 掼蛋 screen gallery for design review: lobby (portrait), then every in-game
 * screen on a landscape phone, plus viewport-only shots of what fits without
 * scrolling ('一屏可见') and the portrait rotate prompt.
 *
 *   npx playwright test -c playwright.guandan.config.ts tests/guandan-gallery.spec.ts
 *
 * Output: test-results/guandan-gallery/*.png + manifest.json
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const OUT = 'test-results/guandan-gallery';
const NAMES = ['东家', '南家', '西家', '北家']; // seats 1-4: 东家 & 西家 vs 南家 & 北家
const manifest: { file: string; section: string; title: string; note: string; who: string; view?: string }[] = [];
let section = '';
let n = 0;
const LAND = { width: 844, height: 390 };
const PORTRAIT = { width: 390, height: 844 };

async function shot(page: Page, title: string, note = '', { full = false, view = '', wait = 700 } = {}) {
  n += 1;
  const file = `${String(n).padStart(2, '0')}.png`;
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: full });
  const who = await page.evaluate(() => {
    const w = window as any; const id = sessionStorage.getItem('avalon:pid');
    return w.__room?.players?.find((p: any) => p.id === id)?.name || '';
  }).catch(() => '');
  manifest.push({ file, section, title, note, who, view: view || undefined });
}

type Spec = { rules?: Record<string, string>; hands?: (string | null)[]; fill?: number; then?: string; intro?: boolean };
const stage = (host: Page, spec: Spec) => host.evaluate(async s => { const m = await import('/tests/gdStage.js'); await m.stage(s); }, spec);
const tapCard = (p: Page, sel: string) => p.locator(`[data-testid=hand] [aria-label="${sel}"]`).first().click({ position: { x: 5, y: 5 } });

// host hand with jokers, two wild ♥2, an A bomb, a straight, pairs and triples (level 2)
const H0 = 'BJ LJ H2 H2 S2 SA DA CA HA SK DK S10 SJ SQ D9 C8 S7 D7 C7 S6 H6 S5 C5 D4 S3 D3 C3';
const H1 = 'S9 D9 C9#2 SQ#2 DQ#2 HQ CQ';
const H2 = 'SK#2 HK CK#2 S8#2 D8#2 H8 C8#2';
const H3 = 'H5 D5#2 C5#2 S5#2 HJ DJ CJ';
const HANDS = [H0, H1, H2, H3];
const FOLLOW = 'g.turn = 1; R.play(g, 1, C("S9 D9")); R.pass(g, 2); R.play(g, 3, C("HJ DJ"));';
const BOMBED = `${FOLLOW} R.pass(g, 0); R.play(g, 1, C("SQ#2 DQ#2 HQ CQ")); R.pass(g, 2); R.pass(g, 3);`;
const TRIBUTE2 = 'do { g.result = { order: [1, 3, 0, 2], place: 2 }; g.declarer = 1; g.levels = [2, 5]; R.startHand(g); } while (g.step !== "tribute");';

test.use({ actionTimeout: 10_000 });
test('掼蛋 screen gallery', async ({ browser }) => {
  test.setTimeout(600_000);
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const ctx = await browser.newContext({ viewport: PORTRAIT, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { (window as any).__gdBotMs = 99999; });
  const pages: Page[] = [];
  for (let i = 0; i < NAMES.length; i++) pages.push(await ctx.newPage());
  const [host] = pages;
  const P = (name: string) => pages[NAMES.indexOf(name)];
  const errors: string[] = [];
  pages.forEach(p => p.on('pageerror', e => errors.push(e.message)));

  // ---------------------------------------------------------------- entry
  section = '入口';
  await host.goto('/game?local=1');
  await expect(host.getByText('掼蛋').first()).toBeVisible();
  await host.getByText('掼蛋').first().scrollIntoViewIfNeeded();
  await shot(host, '游戏厅', '掼蛋排在第 4 个（order 40）');
  await host.goto('/game/guandan?local=1');
  await shot(host, '掼蛋入口', '输名字，创建或加入房间', { full: true });
  await host.getByTestId('name-input').fill(NAMES[0]);
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();

  // ---------------------------------------------------------------- lobby
  section = '大厅';
  await shot(host, '只有房主', '还差 3 人；本地可以加机器人', { full: true });
  for (let i = 1; i < 4; i++) {
    await pages[i].goto(`/game/guandan/${code}?local=1`);
    await pages[i].getByTestId('name-input').fill(NAMES[i]);
    await pages[i].getByRole('button', { name: '加入房间' }).click();
    await expect(pages[i].getByTestId('room-code')).toHaveText(code);
  }
  await shot(host, '4 人到齐（房主）', '对家是队友：1·3 号红队，2·4 号蓝队', { full: true });
  await shot(P('南家'), '4 人到齐（非房主）', '规则由房主设置', { full: true });
  await P('南家').getByTestId('seat-北家').click();
  await shot(P('南家'), '请求换位', '换完队友会变');
  await P('南家').getByTestId('confirm-ok').click();
  await expect(P('北家').getByTestId('swap-request')).toBeVisible();
  await shot(P('北家'), '收到换位请求', '');
  await P('北家').getByTestId('swap-no').click();
  await host.getByTestId('seat-南家').click();
  await host.getByTestId('seat-西家').click();
  await host.waitForTimeout(300);
  await shot(host, '房主直接换位', '南家 ↔ 西家：现在东家和南家一队', { full: true });
  await host.getByTestId('seat-南家').click();
  await host.getByTestId('seat-西家').click(); // swap back
  await host.getByTestId('rule-aFail-2').click();
  await host.getByTestId('rule-tribute-no').click();
  await host.getByTestId('variants').scrollIntoViewIfNeeded();
  await shot(host, '规则变体', '改过的选项金色；可以「恢复标准」');
  await host.getByTestId('reset-rules').click();
  await host.getByTestId('toggle-rules').click();
  await host.getByTestId('rule-card').scrollIntoViewIfNeeded();
  await shot(host, '玩法说明', '跟着变体变化');

  // ---------------------------------------------------------------- deal + hand
  for (const p of pages) await p.setViewportSize(LAND);
  section = '发牌';
  await host.getByTestId('start-game').click();
  await expect(host.getByTestId('deal-intro')).toBeVisible();
  await shot(host, '发牌动画', '第 1 局 · 打 2；1.6 秒后消失', { wait: 250 });
  await expect(host.getByTestId('deal-intro')).toBeHidden({ timeout: 4000 });
  await shot(P('西家'), '随机发牌后的手牌', '按级牌顺序从大到小排成一列一列；红心级牌（逢人配）金色带「配」');

  section = '出牌';
  await stage(host, { hands: HANDS, fill: 27, then: 'g.turn = 0;' });
  await shot(host, '轮到我领出', '27 张一屏放下；出牌/提示/不出/重选一直在右下');
  await tapCard(host, '♠3'); await tapCard(host, '♦4'); await tapCard(host, '♠5'); await tapCard(host, '♠6'); await tapCard(host, '♠7');
  await shot(host, '选牌：顺子', '点一下选中（变蓝、上移）；下面一行即时显示「✓ 顺子 3-7」');
  await host.getByTestId('clear').click();
  await tapCard(host, '♠3'); await tapCard(host, '♠5'); await tapCard(host, '♠6'); await tapCard(host, '♠7'); await tapCard(host, '♥2');
  await shot(host, '逢人配：两种读法', '♠3 5 6 7 + 红心 2：可以当顺子或同花顺，点按钮切换');
  await host.getByTestId('clear').click();
  await tapCard(host, '♠3'); await tapCard(host, '♠K');
  await shot(host, '不成牌型', '红色 ✗，出牌按钮变灰');
  await host.getByTestId('clear').click();
  await host.getByTestId('hint').click();
  await shot(host, '提示', '提示按最小的牌选好；再点换下一个');

  await stage(host, { hands: HANDS, fill: 27, then: FOLLOW });
  await shot(host, '跟牌', '每家最近一手摆在他面前，当前最大的一手金色标签');
  await tapCard(host, '♠5'); await tapCard(host, '♣5');
  await shot(host, '管不上', '对 5 比 对 J 小：红色提示，不能出');
  await host.getByTestId('clear').click();
  await host.getByTestId('hint').click();
  await shot(host, '提示能管上的', '对 K（不拆 A 炸弹）');
  await shot(P('南家'), '等别人出牌', '轮到谁，谁的座位金框闪「出牌中」');
  await host.getByTestId('pass').click();
  await host.waitForTimeout(300);
  await shot(P('南家'), '不出', '东家点了「不出」');

  section = '炸弹';
  await stage(host, { hands: HANDS, fill: 27, then: BOMBED });
  await shot(host, '被炸', '南家 4 个 Q 炸：红色标签');
  await host.getByTestId('hint').click();
  await shot(host, '用更大的炸弹', '提示只给能管上的：A 炸（4 张 A）');
  await host.getByTestId('play').click();
  await host.waitForTimeout(300);
  await shot(P('西家'), '炸回去', '');
  await stage(host, { hands: [H0, H1, H2, 'S3#2 S4#2 S5#2 S6#2 S7#2 LJ#2 BJ#2'], fill: 27, then: 'g.turn = 3; R.play(g, 3, C("S3#2 S4#2 S5#2 S6#2 S7#2"));' });
  await shot(host, '同花顺', '同花顺比 5 张炸弹大、比 6 张小');
  await stage(host, { hands: [H0, H1, H2, H3], fill: 27, then: 'g.hands[3] = [...g.hands[3].filter(c => ![52, 53, 106, 107].includes(c)).slice(0, 10), 52, 53, 106, 107]; [0, 1, 2].forEach(s => { g.hands[s] = g.hands[s].filter(c => ![52, 53, 106, 107].includes(c)); }); g.turn = 3; R.play(g, 3, [52, 106, 53, 107]);' });
  await shot(host, '天王炸', '四个王：最大，什么都管');

  section = '接风 / 出完';
  await stage(host, { hands: HANDS, fill: 27, then: 'g.hands[2] = g.hands[2].slice(0, 1); g.turn = 2; R.play(g, 2, [g.hands[2][0]]); R.pass(g, 3);' });
  await shot(host, '队友出完（头游）', '西家出完最后一张：座位上显示「头游」');
  await host.getByTestId('pass').click();
  await host.evaluate(async () => {
    const R = await import('/src/games/guandan/guandanRules.js');
    const { roomStore } = await import('/src/games/avalon/roomStore.js');
    await roomStore.update((window as any).__room.code, (r: any) => { R.pass(r.game, 1); return r; });
  });
  await expect(host.getByTestId('status')).toContainText('接风');
  await shot(host, '接风', '三家都不要，由出完那家的对家（东家）接风，随便出');

  section = '一局结束';
  await stage(host, { hands: [H0, H1, H2, H3], fill: 27, then: 'g.finished = [2]; g.hands[2] = []; g.hands[0] = C("SA DA"); g.turn = 0;' });
  await host.getByTestId('hint').click();
  await shot(host, '最后一手', '');
  await host.getByTestId('play').click();
  await expect(host.getByTestId('hand-result')).toBeVisible();
  await shot(host, '双上：升 3 级', '头游 + 二游；2 → 5，下一局对方双下两人进贡');
  await shot(P('南家'), '输的一方看到的', '');
  await stage(host, { then: 'g.declarer = 0; g.levels = [14, 9]; g.level = 14; g.finished = [0, 1, 3]; g.hands[0] = []; g.hands[1] = []; g.hands[3] = []; R.endHand(g, 1);' });
  await shot(host, '打 A 没过', '头游但对家末游：不算过 A，记一次失败，仍然打 A');
  await stage(host, { then: 'g.declarer = 0; g.levels = [14, 9]; g.aFails = [2, 0]; g.level = 14; g.finished = [1, 3]; g.hands[1] = []; g.hands[3] = []; R.endHand(g, 1);' });
  await shot(host, '打 A 三次不过回 2', '对方双上 9 → Q，我方回到 2');

  section = '进贡 / 还贡';
  await stage(host, { then: TRIBUTE2 });
  await shot(host, '双下：两人进贡', '只能选最大的牌（红心级牌除外），其余变暗');
  await host.locator('[data-testid=hand] [data-cid]:not(.dim)').first().click({ position: { x: 5, y: 5 } });
  await shot(host, '选好贡牌', '');
  await host.getByTestId('tribute-btn').click();
  await shot(P('南家'), '等待进贡', '');
  await P('西家').locator('[data-testid=hand] [data-cid]:not(.dim)').first().click({ position: { x: 5, y: 5 } });
  await P('西家').getByTestId('tribute-btn').click();
  await expect(P('南家').getByTestId('tribute-btn')).toBeVisible();
  await shot(P('南家'), '还贡', '头游拿大的贡牌；还一张 10 以下的');
  for (const name of ['南家', '北家']) {
    const p = P(name);
    await p.locator('[data-testid=hand] [data-cid]:not(.dim)').last().click({ position: { x: 5, y: 5 } });
    await p.getByTestId('tribute-btn').click();
  }
  await expect(host.getByTestId('play')).toBeVisible();
  await shot(host, '进贡完成', '中间显示谁贡了什么、还了什么；进贡给头游的人先出');
  await stage(host, { then: 'const d = R.shuffled().filter(c => c !== 53 && c !== 107); d.splice(81, 0, 53, 107); g.result = { order: [0, 1, 2, 3], place: 3 }; g.declarer = 0; R.startHand(g, Math.random, d);' });
  await shot(host, '抗贡', '末游抓到两张大王：不用进贡，头游先出');

  section = '整场胜利';
  await stage(host, { then: 'g.declarer = 0; g.levels = [14, 9]; g.level = 14; g.history = [{ hand: 1, level: 2 }, { hand: 2, level: 5 }, { hand: 3, level: 9 }, { hand: 4, level: 14 }]; g.handNo = 5; g.finished = [0, 2]; g.hands[0] = []; g.hands[2] = []; R.endHand(g, 0);' });
  await shot(host, '过 A 获胜', '');
  await shot(P('南家'), '对方过 A', '');
  await host.getByTestId('back-lobby').click();
  await expect(host.getByTestId('start-game')).toBeVisible();

  section = '记录 / 菜单';
  await stage(host, { hands: HANDS, fill: 27, then: BOMBED });
  await host.getByTestId('open-log').click();
  await shot(host, '本局记录', '每一手牌，最新的在上面');
  await host.getByTestId('close-log').click();
  await host.getByTestId('menu').click();
  await shot(host, '菜单', '回游戏厅 / 离开房间 / 玩法');
  await host.getByTestId('close-menu').click();

  // ------------------------------------------------------------ fit checks
  section = '一屏可见';
  const VIEWS: [string, number, number][] = [['iPhone SE 横屏', 667, 320], ['iPhone 14 横屏', 844, 340], ['Android 横屏', 740, 310], ['Pro Max 横屏', 932, 380]];
  for (const [label, w, h] of VIEWS) {
    await host.setViewportSize({ width: w, height: h });
    await stage(host, { hands: HANDS, fill: 27, then: FOLLOW });
    await host.getByTestId('hint').click();
    await shot(host, `${label} · 跟牌`, `${w}×${h} 可见区域，不滑动`, { view: `${w}×${h}` });
    const box = await host.getByTestId('play').boundingBox();
    expect(box && box.y + box.height <= h).toBe(true);
    await stage(host, { hands: HANDS, fill: 27, then: 'g.turn = 0;' });
    await shot(host, `${label} · 27 张手牌`, '', { view: `${w}×${h}` });
  }
  await host.setViewportSize({ width: 375, height: 548 });
  await shot(host, '竖屏提示', '游戏中竖着拿手机：请把手机横过来', { view: '375×548' });

  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
  expect(errors).toEqual([]);
});

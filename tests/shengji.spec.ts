/**
 * 升级 / 拖拉机 end-to-end on landscape phones (local transport).
 *
 *  1. Four phones: create/join, seat swap, variants sync, start; 亮主 → 反主 during a
 *     (frozen) deal, everyone passes, the 庄家 buries 8 through the UI, the whole hand
 *     is played with 提示 + 出牌, result → next hand.
 *  2. 甩牌 failure through the UI (penalty applied, forced smallest part).
 *  3. One human + three dev bots play a full hand; then the game-over screen.
 *
 *   npx playwright test -c playwright.shengji.config.ts tests/shengji.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const STRIP = { x: 8, y: 30 }; // tap a card's visible left strip, like a finger on an overlapped hand

const OUT = 'test-results/shengji';
const NAMES = ['房主', '阿花', '铁柱', '小美'];
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

let n = 0;
async function snap(page: Page, label: string) {
  n += 1;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${label}.png` });
}
const game = (p: Page) => p.evaluate(() => (window as any).__room?.game);
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

async function settle(pages: Page[]) {
  await expect.poll(async () => {
    const all = await Promise.all(pages.map(p => p.evaluate(() => {
      const w = window as any;
      return w.__roomPending ? `pending:${Math.random()}` : JSON.stringify(w.__room?.game ?? w.__room?.config);
    })));
    return all.every(x => x === all[0]);
  }, { timeout: 15_000 }).toBe(true);
}

async function openRoom(browser: any, count = 4) {
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript(() => { (window as any).__sjTimeScale = 0.05; });
  const pages: Page[] = [];
  for (let i = 0; i < count; i++) pages.push(await ctx.newPage());
  const host = pages[0];
  await host.goto('/game/shengji?local=1');
  await host.getByTestId('name-input').fill(NAMES[0]);
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();
  for (let i = 1; i < count; i++) {
    await pages[i].goto(`/game/shengji/${code}?local=1`);
    await pages[i].getByTestId('name-input').fill(NAMES[i]);
    await pages[i].getByRole('button', { name: '加入房间' }).click();
    await expect(pages[i].getByTestId('room-code')).toHaveText(code);
  }
  return { ctx, pages, host, code };
}

/** The page whose turn it is plays hint → 出牌. */
async function playTurn(pages: Page[]) {
  const g = await game(pages[0]);
  const turn = (g.trick.leader + g.trick.plays.length) % 4;
  const p = pages[turn];
  await p.getByTestId('hint').click();
  await expect(p.getByTestId('play')).toBeEnabled();
  await p.getByTestId('play').click();
  await expect.poll(async () => { const x = await game(pages[0]); return `${x.step}:${x.trickNo}:${x.trick?.plays.length}`; })
    .not.toBe(`${g.step}:${g.trickNo}:${g.trick.plays.length}`);
}

test.use({ actionTimeout: 10_000 });
test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }); });

test('four phones: lobby, 亮主/反主, bury, a full hand, next hand', async ({ browser }) => {
  test.setTimeout(240_000);
  const { pages, host } = await openRoom(browser);
  await settle(pages);
  await expect(host.getByTestId('start-game')).toBeEnabled();
  await expect(pages[1].getByTestId('start-game')).toHaveCount(0);
  await snap(host, 'lobby');

  // host swaps seats 2 ↔ 3 (changes partners), then back
  await host.getByTestId('seat-阿花').click();
  await host.getByTestId('seat-铁柱').click();
  await settle(pages);
  expect((await host.evaluate(() => (window as any).__room.players.map((p: any) => p.name)))).toEqual(['房主', '铁柱', '阿花', '小美']);
  // a guest asks to swap; the other accepts
  await pages[1].getByTestId('seat-铁柱').click();
  await pages[1].getByTestId('confirm-ok').click();
  await expect(pages[2].getByTestId('swap-request')).toBeVisible();
  await pages[2].getByTestId('swap-yes').click();
  await settle(pages);
  expect((await host.evaluate(() => (window as any).__room.players.map((p: any) => p.name)))).toEqual(NAMES);

  // variants: host edits, everyone sees them
  await host.getByTestId('toggle-diy').click();
  await host.getByTestId('rule-penalty-flat10').click();
  await host.getByTestId('rule-kitty-exp').click();
  await settle(pages);
  await expect(host.getByTestId('preset-custom')).toBeVisible();
  await pages[3].getByTestId('toggle-diy').click();
  await expect(pages[3].getByTestId('rule-kitty-exp')).toHaveAttribute('aria-checked', 'true');
  await snap(host, 'lobby-diy');
  await host.getByTestId('reset-rules').click();
  await settle(pages);
  await expect(host.getByTestId('preset-standard')).toHaveAttribute('aria-pressed', 'true');

  await host.getByTestId('start-game').click();
  await settle(pages);
  await expect(host.getByTestId('sj-board')).toBeVisible();

  // ---- deal (frozen at 12 cards): 房主 shows ♠2, 阿花 overturns with ♥2♥2
  await stage(host, { hands: [['S20', 'S30', 'SA0'], ['H20', 'H21', 'HK0'], ['C40'], ['D50']], dealt: 12 });
  await settle(pages);
  await expect(host.getByTestId('bid-S-1')).toBeVisible();
  await snap(host, 'deal-can-bid');
  await host.getByTestId('bid-S-1').click();
  await expect(pages[1].getByTestId('bid-H-2')).toBeVisible();
  await expect(pages[1].getByTestId('bid-H-1')).toHaveCount(0); // a single can't overturn
  await pages[1].getByTestId('bid-H-2').click();
  await settle(pages);
  expect((await game(host)).bid).toMatchObject({ seat: 1, suit: 'H', strength: 2 });
  await expect(host.getByTestId('bids')).toHaveCount(0); // 房主 has nothing that beats a pair
  await snap(host, 'deal-overturned');
  // finish the deal; everyone passes in the UI
  // finish the deal at normal speed (8 s grace to pass)
  await engine(host, 'g.timeScale = 1; g.dealStart = Date.now() - R.DEAL_MS * 25 - 10;');
  for (const p of pages) { await expect(p.getByTestId('pass')).toBeEnabled(); await p.getByTestId('pass').click(); }
  await settle(pages);
  let g = await game(host);
  expect([g.step, g.trump, g.dealer, g.hands[1].length]).toEqual(['bury', 'H', 1, 33]);

  // ---- bury through the UI (庄家 = 阿花)
  const dealerPage = pages[1];
  await expect(dealerPage.getByTestId('bury')).toBeDisabled();
  await expect(host.getByTestId('bury-wait')).toBeVisible();
  const cards = dealerPage.getByTestId('hand-card');
  await expect(cards).toHaveCount(33);
  for (let i = 0; i < 8; i++) await cards.nth(32 - i).click({ position: STRIP });
  await snap(dealerPage, 'bury');
  await dealerPage.getByTestId('bury').click();
  await settle(pages);
  g = await game(host);
  expect([g.step, g.hands[1].length, g.buried.length]).toEqual(['play', 25, 8]);

  // ---- play the whole hand with 提示 + 出牌
  await expect(dealerPage.getByTestId('play')).toBeDisabled();
  await dealerPage.getByTestId('hand-card').first().click({ position: STRIP });
  await expect(dealerPage.getByTestId('status')).not.toBeEmpty();
  await dealerPage.getByTestId('hand-card').first().click({ position: STRIP });
  let shots = 0;
  for (let i = 0; i < 100; i++) {
    await playTurn(pages);
    if (i === 2 && shots++ === 0) await snap(pages[3], 'following');
    if ((await game(host)).step !== 'play') break;
  }
  g = await game(host);
  expect(['result', 'end']).toContain(g.step);
  await expect(host.getByTestId('result')).toBeVisible();
  await expect(host.getByTestId('level-change')).toBeVisible();
  await snap(host, 'result');
  expect(g.hands.every((h: string[]) => h.length === 0)).toBe(true);
  // last trick review
  await host.getByTestId('next-hand').click();
  await settle(pages);
  g = await game(host);
  expect([g.step, g.hand]).toEqual(['deal', 2]);
  expect(g.dealer).toBe(g.history[0].side === 'dealer' ? 3 : 2);
});

test('甩牌 failure in the UI + last-trick review', async ({ browser }) => {
  test.setTimeout(120_000);
  const { pages, host } = await openRoom(browser);
  await host.getByTestId('start-game').click();
  await settle(pages);
  // 房主 is 庄家 (♠ trump, level 2); 阿花 holds ♥K, so ♥A ♥Q ♥J fails
  await stage(host, {
    hands: [['HA0', 'HQ0', 'HJ0', 'H30'], ['HK0', 'H40'], ['H50'], ['H60']], dealer: 0,
    then: 'g.bid = { seat: 0, suit: "S", strength: 1, cards: [] }; ' +
      'R.finishDeal(g); R.bury(g, 0, g.hands[0].filter(c => !["HA0","HQ0","HJ0","H30"].includes(c)).slice(0, 8));',
  });
  await settle(pages);
  for (const id of ['HA0', 'HQ0', 'HJ0']) await host.locator(`[data-card="${id}"]`).click({ position: STRIP });
  await expect(host.getByTestId('play-ok')).toContainText('甩牌');
  await snap(host, 'throw-try');
  await host.getByTestId('play').click();
  await settle(pages);
  await expect(pages[2].getByTestId('throw-fail')).toBeVisible();
  await expect(pages[2].getByTestId('throw-fail')).toContainText('罚 20 分');
  const g = await game(host);
  expect(g.trick.plays[0].cards).toEqual(['HJ0']);
  expect(g.points).toBe(20);
  await snap(pages[2], 'throw-fail');
  // follow-suit feedback: 阿花 must play a heart
  const spade = await pages[1].evaluate(() => (window as any).__room.game.hands[1].find((c: string) => c[0] === 'C' || c[0] === 'D'));
  await pages[1].locator(`[data-card="${spade}"]`).click({ position: STRIP });
  await expect(pages[1].getByTestId('play-error')).toContainText('红桃');
  await expect(pages[1].getByTestId('play')).toBeDisabled();
  await pages[1].locator(`[data-card="${spade}"]`).click({ position: STRIP });
  for (let i = 0; i < 3; i++) await playTurn(pages);
  await host.getByTestId('last-trick').click();
  await expect(host.getByTestId('last-panel')).toBeVisible();
  await snap(host, 'last-trick');
});

test('one human + three bots: a full hand, then game over', async ({ browser }) => {
  test.setTimeout(180_000);
  const { pages, host } = await openRoom(browser, 1);
  for (let i = 0; i < 3; i++) await host.getByTestId('add-bot').click();
  await expect(host.getByTestId('start-game')).toBeEnabled();
  await host.getByTestId('start-game').click();
  await expect(host.getByTestId('sj-board')).toBeVisible();
  // deal runs by itself (time-scaled); the host may pass, bots bid or pass
  await expect.poll(async () => (await game(host)).step, { timeout: 20_000 }).not.toBe('deal');
  for (let i = 0; i < 200; i++) {
    const g = await game(host);
    if (g.step === 'result' || g.step === 'end') break;
    if (g.step === 'bury' && g.dealer === 0) {
      const cards = host.getByTestId('hand-card');
      for (let k = 0; k < 8; k++) await cards.nth(32 - k).click({ position: STRIP });
      await host.getByTestId('bury').click();
    } else if (g.step === 'play' && (g.trick.leader + g.trick.plays.length) % 4 === 0) {
      await host.getByTestId('hint').click();
      await host.getByTestId('play').click();
    }
    await host.waitForTimeout(150);
  }
  await expect(host.getByTestId('result')).toBeVisible({ timeout: 20_000 });
  // game over: 房主's team at A defends
  await engine(host, 'g.step = "play"; g.dealer = 0; g.levels = ["A", "9"]; g.level = "A"; g.points = 30; g.buried = g.result.buried; ' +
    'g.lastTrick = { plays: [{ seat: 0, cards: ["SA0"] }, { seat: 1, cards: ["S30"] }, { seat: 2, cards: ["S40"] }, { seat: 3, cards: ["S60"] }], winner: 0, no: 25, at: Date.now() }; R.endHand(g);');
  await expect(host.getByTestId('game-over')).toBeVisible();
  await snap(host, 'game-over');
  await host.getByTestId('back-lobby').click();
  await expect(host.getByTestId('start-game')).toBeVisible();
});

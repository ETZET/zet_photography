/**
 * 掼蛋 end-to-end on four landscape phones (local transport, one browser context).
 * Create / join → seat swap → start → play a whole hand through the UI
 * (提示 + 出牌 / 不出) → hand result → next hand with 进贡 / 还贡 through the UI.
 *
 *   npx playwright test -c playwright.guandan.config.ts tests/guandan.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

const NAMES = ['东家', '南家', '西家', '北家'];
type G = { step: string; turn: number | null; seats: string[]; hands: number[][]; finished: number[]; handNo: number; table: any;
  tribute: any; result: any; levels: number[]; level: number };

const game = (p: Page): Promise<G> => p.evaluate(() => (window as any).__room?.game);
const pid = (p: Page) => p.evaluate(() => sessionStorage.getItem('avalon:pid') || localStorage.getItem('avalon:pid'));

test.use({ actionTimeout: 10_000 });
test('掼蛋: four phones play a hand + tribute', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const pages: Page[] = [];
  for (let i = 0; i < 4; i++) pages.push(await ctx.newPage());
  const [host] = pages;
  const errors: string[] = [];
  pages.forEach(p => p.on('pageerror', e => errors.push(e.message)));

  await host.goto('/game?local=1');
  await expect(host.getByText('掼蛋')).toBeVisible();
  await host.goto('/game/guandan?local=1');
  await host.getByTestId('name-input').fill(NAMES[0]);
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();
  for (let i = 1; i < 4; i++) {
    await pages[i].goto(`/game/guandan/${code}?local=1`);
    await pages[i].getByTestId('name-input').fill(NAMES[i]);
    await pages[i].getByRole('button', { name: '加入房间' }).click();
    await expect(pages[i].getByTestId('room-code')).toHaveText(code);
  }
  // a 5th player can't join
  const extra = await ctx.newPage();
  await extra.goto(`/game/guandan/${code}?local=1`);
  await extra.getByTestId('name-input').fill('路人');
  await extra.getByRole('button', { name: '加入房间' }).click();
  await expect(extra.getByText('房间满了')).toBeVisible();
  await extra.close();

  // 南家 asks 西家 to swap (changes partners)
  await pages[1].getByTestId('seat-西家').click();
  await pages[1].getByTestId('confirm-ok').click();
  await pages[2].getByTestId('swap-yes').click();
  await expect.poll(() => host.evaluate(() => (window as any).__room.players.map((p: any) => p.name).join())).toBe('东家,西家,南家,北家');
  await expect(host.getByTestId('teams')).toContainText('你的队友：南家');

  // variant: no change; start
  await host.getByTestId('start-game').click();
  await expect(host.getByTestId('gd-board')).toBeVisible();
  const ids = await Promise.all(pages.map(pid));
  const pageOf = (g: G, seat: number) => pages[ids.indexOf(g.seats[seat])];
  let g = await game(host);
  expect(g.hands.map(h => h.length)).toEqual([27, 27, 27, 27]);
  await expect(host.getByTestId('deal-intro')).toBeHidden({ timeout: 5000 });

  async function playHand() {
    let guard = 0;
    for (;;) {
      g = await game(host);
      if (g.step !== 'play') break;
      if (++guard > 400) throw new Error('hand did not finish');
      const p = pageOf(g, g.turn!);
      const before = JSON.stringify([g.turn, g.table, g.finished]);
      await p.getByTestId('hint').click();
      const play = p.getByTestId('play');
      // follow ~70% of the time when a hint exists, otherwise pass
      if (await play.isEnabled() && (!g.table || Math.random() < 0.7)) await play.click();
      else await p.getByTestId('pass').click();
      await expect.poll(async () => JSON.stringify(await game(host).then(x => [x.turn, x.table, x.finished]))).not.toBe(before);
    }
  }
  await playHand();
  g = await game(host);
  expect(['hand', 'end']).toContain(g.step);
  for (const p of pages) await expect(p.getByTestId('hand-result')).toBeVisible();
  await expect(host.getByTestId('finish-row')).toHaveCount(4);

  // next hand: tribute through the UI
  await host.getByTestId('next-hand').click();
  await expect.poll(async () => (await game(host)).handNo).toBe(2);
  g = await game(host);
  if (g.step === 'tribute') {
    for (const phase of ['pay', 'back']) {
      g = await game(host);
      const who = phase === 'pay' ? g.tribute.payers : g.tribute.gives.map((x: any) => x.to);
      for (const s of who) {
        const p = pageOf(g, s);
        await expect(p.getByTestId('tribute-btn')).toBeVisible();
        await p.locator('[data-testid=hand] [data-cid]:not(.dim)').first().click({ position: { x: 5, y: 5 } });
        await p.getByTestId('tribute-btn').click();
      }
      await expect.poll(async () => (await game(host)).tribute.phase === 'back' || (await game(host)).step === 'play').toBe(true);
    }
    await expect.poll(async () => (await game(host)).step).toBe('play');
  }
  g = await game(host);
  expect(g.hands.map(h => h.length)).toEqual([27, 27, 27, 27]);
  // an illegal selection is flagged and can't be played
  const p = pageOf(g, g.turn!);
  await p.getByTestId('deal-intro').waitFor({ state: 'hidden' });
  const cards = p.locator('[data-testid=hand] [data-cid]');
  await cards.nth(0).click({ position: { x: 5, y: 5 } });
  await cards.nth(26).click({ position: { x: 5, y: 5 } });
  await expect(p.getByTestId('feedback')).toContainText('不是有效牌型');
  await expect(p.getByTestId('play')).toBeDisabled();
  await p.getByTestId('clear').click();
  await playHand();
  // portrait shows the rotate prompt
  await host.setViewportSize({ width: 390, height: 844 });
  await expect(host.getByTestId('rotate')).toBeVisible();
  expect(errors).toEqual([]);
});

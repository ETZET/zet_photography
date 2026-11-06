/**
 * 预计人数 (room/PlanPicker.jsx) in 阿瓦隆 and 一夜狼: the host previews the setup
 * for a planned head count; the start deals for the real count after a confirm.
 *
 *   npx playwright test tests/plan.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

test.use({ actionTimeout: 15_000 });

async function room(page: Page, game: string, bots: number) {
  await page.goto(`/game/${game}?local=1`);
  await page.getByTestId('name-input').fill('房主');
  await page.getByRole('button', { name: '创建房间' }).click();
  for (let i = 0; i < bots; i++) await page.getByTestId('add-bot').click();
}

test('阿瓦隆: plan 8 previews 8-player roles, start deals for 5', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await room(p, 'avalon', 4);
  await expect(p.getByText('坏人 2')).toBeVisible();
  await p.getByTestId('plan-8').click();
  await expect(p.getByText('角色配置 · 8 人')).toBeVisible();
  await expect(p.getByText('坏人 3')).toBeVisible();
  await expect(p.getByTestId('auto-tag')).toHaveText(/8 人推荐/);
  await expect(p.getByTestId('plan-note')).toContainText('预计 8 人，现在 5 人');
  await p.getByTestId('start-game').click();
  await expect(p.getByTestId('confirm')).toContainText('按 5 人开局');
  await p.getByTestId('confirm-ok').click();
  await expect(p.getByTestId('role-modal')).toBeVisible();
  const g = await p.evaluate(() => (window as any).__room.game);
  expect(g.seats.length).toBe(5);
  expect(Object.values(g.assignments).filter((r: any) => ['assassin', 'morgana', 'mordred', 'oberon', 'minion'].includes(r)).length).toBe(2);
  await ctx.close();
});

test('一夜狼: plan 6 previews a 9-card deck; a DIY deck for 6 blocks a 3-player start', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await room(p, 'onenight', 2);
  await expect(p.getByTestId('deck')).toContainText('6 张');
  await p.getByTestId('plan-6').click();
  await expect(p.getByTestId('deck')).toContainText('9 张');
  await expect(p.getByText('6 人 9 张')).toBeVisible();
  // board deck adapts: start with 3 players after confirming
  await p.getByTestId('start-game').click();
  await expect(p.getByTestId('confirm')).toContainText('按 3 人开局');
  await p.getByTestId('confirm-cancel').click();
  // a hand-edited 9-card deck can't be dealt to 3 players
  await p.getByTestId('toggle-diy').click();
  await p.getByTestId('minus-villager').click();
  await p.getByTestId('plus-villager').click();
  await expect(p.getByTestId('real-deck-error')).toContainText('现在 3 人还开不了');
  await expect(p.getByTestId('start-game')).toBeDisabled();
  await ctx.close();
});

/**
 * 双身份狼人 村规金宝宝 preset: locked below 8 players, then an 8-player game where
 * 金宝宝 don't see each other and the rule card explains the 村规.
 *
 *   npx playwright test tests/werewolf-village.spec.ts
 */
import { test, expect } from '@playwright/test';

test.use({ actionTimeout: 15_000 });

test('村规金宝宝: 8+ players, 不互认, 只杀金宝宝, 一半金刚狼', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { (window as any).__wwTimeScale = 0.03; });
  const host = await ctx.newPage();
  await host.goto('/game/werewolf?local=1');
  await host.getByTestId('name-input').fill('房主');
  await host.getByRole('button', { name: '创建房间' }).click();
  for (let i = 0; i < 4; i++) await host.getByTestId('add-bot').click();

  // 5 players: the preset is listed but locked with a clear reason
  await expect(host.getByTestId('preset-min-village')).toHaveText(/至少 8 人/);
  await host.getByTestId('preset-village').click();
  await expect(host.getByText('只杀金宝宝至少要 8 人')).toBeVisible();
  await expect(host.getByTestId('start-game')).toBeDisabled();

  // the host plans for 9: recommendations follow the planned count, start still needs real players
  await host.getByTestId('plan-9').click();
  await expect(host.getByTestId('preset-min-village')).toHaveCount(0);
  await expect(host.getByTestId('plan-note')).toContainText('预计 9 人，现在 5 人');
  await expect(host.getByTestId('presets')).toContainText('9 人');
  await expect(host.getByTestId('real-deck-error')).toContainText('现在 5 人还开不了');
  await expect(host.getByTestId('start-game')).toBeDisabled();
  await host.getByTestId('plan-auto').click();

  for (let i = 0; i < 3; i++) await host.getByTestId('add-bot').click();
  await expect(host.getByTestId('preset-min-village')).toHaveCount(0);
  await expect(host.getByTestId('deck')).toContainText('狼人');
  await host.getByTestId('toggle-rules').click();
  const card = host.getByTestId('rule-card');
  await expect(card).toContainText('金刚狼验出来是好人');
  await expect(card).toContainText('开局不互认');
  await expect(card).toContainText('一半的局有一人拿两张狼牌');

  // play: whoever is a 金宝宝 is told they don't know the others
  for (let round = 0; round < 6; round++) {
    await host.getByTestId('start-game').click();
    const c = host.getByTestId('confirm-ok');
    if (await c.isVisible({ timeout: 1000 }).catch(() => false)) await c.click();
    const g = await host.evaluate(() => (window as any).__room.game);
    expect(g.rules).toMatchObject({ win: 'babyOnly', babyMeet: 'no', doubleWolf: 'half', seer: 'campJgl', peace: 'three' });
    const babyCount = g.seats.filter((id: string) => g.hands[id].cards.every((x: string) => x === 'villager')).length;
    expect(babyCount).toBeGreaterThanOrEqual(1);
    expect(babyCount).toBeLessThanOrEqual(3);
    const me = g.seats[0];
    const baby = g.hands[me].cards.every((x: string) => x === 'villager');
    if (baby) {
      await expect(host.getByTestId('baby-mates')).toContainText('不互认');
      await expect(host.getByTestId('baby-mates')).not.toContainText('其他金宝宝：');
      break;
    }
    // not a 金宝宝 this deal: back to the lobby and deal again
    await host.evaluate(async () => {
      const { roomStore } = await import('/src/games/avalon/roomStore.js');
      await roomStore.update((window as any).__room.code, (r: any) => { r.phase = 'lobby'; r.game = null; return r; });
    });
  }
  await ctx.close();
});

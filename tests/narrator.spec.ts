/**
 * 夜晚语音引导 (room/Narrator.jsx) in 阿瓦隆 / 双身份狼人 / 一夜狼: any player can
 * take the narrator role, only that phone speaks, and the script follows the
 * shared game state. speechSynthesis is replaced by an instant fake; every line
 * spoken lands in window.__narrated.
 *
 *   npx playwright test tests/narrator.spec.ts
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.use({ actionTimeout: 15_000 });

async function phones(browser: any): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    const w = window as any;
    w.__narratePause = 0.02;
    w.__wwTimeScale = 0.03;
    w.__onTimeScale = 0.05;
    class U { text: string; onend: any; onerror: any; lang = ''; rate = 1; voice = null; constructor(t: string) { this.text = t; } }
    w.SpeechSynthesisUtterance = U;
    Object.defineProperty(w, 'speechSynthesis', {
      configurable: true,
      value: { getVoices: () => [], cancel() {}, speak(u: any) { setTimeout(() => u.onend?.(), 5); } },
    });
  });
  return ctx;
}

async function room(ctx: BrowserContext, game: string, bots: number, extraHumans = 0) {
  const host = await ctx.newPage();
  await host.goto(`/game/${game}?local=1`);
  await host.getByTestId('name-input').fill('房主');
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();
  const others: Page[] = [];
  for (let i = 0; i < extraHumans; i++) {
    const p = await ctx.newPage();
    await p.goto(`/game/${game}/${code}?local=1`);
    await p.getByTestId('name-input').fill(`玩家${i + 2}`);
    await p.getByRole('button', { name: '加入房间' }).click();
    await expect(p.getByTestId('room-code')).toHaveText(code);
    others.push(p);
  }
  for (let i = 0; i < bots; i++) await host.getByTestId('add-bot').click();
  return { host, others };
}

const said = (p: Page) => p.evaluate(() => ((window as any).__narrated || []).join('\n'));

test('阿瓦隆: one phone narrates the closed-eyes script', async ({ browser }) => {
  const ctx = await phones(browser);
  const { host, others } = await room(ctx, 'avalon', 3, 1);
  const p2 = others[0];
  // the second human takes the narrator role in the lobby; the host sees who is narrating
  await p2.getByTestId('voice-guide').click();
  await expect(p2.getByTestId('voice-guide')).toHaveAttribute('aria-label', /这台手机在播报/);
  await expect(host.getByTestId('voice-guide')).toHaveAttribute('aria-label', /玩家2在播报/);
  await host.getByTestId('start-game').click();
  await expect.poll(() => said(p2), { timeout: 15_000 }).toContain('天亮了，所有人请睁眼。');
  const text = await said(p2);
  expect(text).toContain('坏人请睁眼');
  expect(text).toContain('梅林请睁眼');
  expect(text).toMatch(/\d+号是第一任队长/);
  expect(await said(host)).toBe(''); // only the narrator's phone talks
  // taking over moves the role; tapping again switches it off
  for (const p of [host, p2]) { await p.getByTestId('role-card').click(); await p.getByTestId('close-role').click(); }
  await host.getByTestId('voice-guide').click();
  await expect(host.getByTestId('voice-guide')).toHaveAttribute('aria-label', /这台手机在播报/);
  await expect(p2.getByTestId('voice-guide')).toHaveAttribute('aria-label', /房主在播报/);
  await host.getByTestId('voice-guide').click();
  await expect(host.getByTestId('voice-guide')).toHaveAttribute('aria-label', '夜晚语音');
  await ctx.close();
});

test('双身份狼人: night → dawn → speaking order', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await phones(browser);
  const { host } = await room(ctx, 'werewolf', 5);
  await host.evaluate(async () => {
    const m = await import('/tests/wwStage.js');
    await m.stage({ hands: [['villager', 'villager'], ['wolf', 'villager'], ['seer', 'villager'], ['witch', 'villager'], ['wolf', 'hunter'], ['guard', 'villager']], lock: true });
  });
  await host.getByTestId('voice-guide').click();
  await expect.poll(() => said(host), { timeout: 10_000 }).toContain('第 1 夜，天黑请闭眼。');
  await expect.poll(() => said(host), { timeout: 60_000 }).toContain('天亮了，所有人请睁眼。');
  await expect.poll(() => said(host), { timeout: 60_000 }).toMatch(/请\d+号(发言|发表遗言)。/);
  const text = await said(host);
  expect(text).toMatch(/昨晚(是平安夜|，[\d号、]+失去了一条命)/);
  await ctx.close();
});

test('一夜狼: every role in the deck is called on the clock, then dawn', async ({ browser }) => {
  test.setTimeout(120_000);
  const ctx = await phones(browser);
  const { host } = await room(ctx, 'onenight', 2);
  const night = () => host.evaluate(async () => {
    const m = await import('/tests/onStage.js');
    await m.stage({ cards: ['villager', 'wolf', 'seer'], center: ['thief', 'villager', 'wolf'], timeScale: 0.3,
      then: "R.nightAct(g, ids[0], { players: [ids[1]], center: [] });" });
  });
  await night();
  await host.getByTestId('voice-guide').click();
  await night(); // a fresh night with the narrator already on: nothing is skipped
  await expect.poll(() => said(host), { timeout: 30_000 }).toContain('天亮了，所有人请睁眼。');
  const text = await said(host);
  // thief is only in the center, but it's still called (no information leak)
  for (const line of ['狼人请睁眼', '预言家请睁眼', '夜贼请睁眼', '夜贼请闭眼。']) expect(text).toContain(line);
  await ctx.close();
});

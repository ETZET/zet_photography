/**
 * 一夜狼 end-to-end on phone-sized screens: five players create / join a room,
 * the host picks the deck + house rules, everyone acts at night through the UI
 * (taps on seats / center cards), dawn comes on the clock, the host ends the
 * discussion, everyone votes, the reveal shows on every phone, and the host
 * deals a second round.
 *
 *   npx playwright test -c playwright.onenight.config.ts tests/onenight.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

const NAMES = ['村长', '阿花', '铁柱', '小美', '老王'];

type G = {
  step: string; seats: string[]; start: Record<string, string>; center0: string[]; deck: string[];
  acts: Record<string, unknown>; votes: Record<string, string>; rules: Record<string, unknown>;
  final: { cards: Record<string, string>; center: string[] } | null;
  result: { out: string[]; winners: string[] } | null;
};
const readGame = (page: Page): Promise<G> => page.evaluate(() => (window as any).__room.game);
const myId = (page: Page) => page.evaluate(() => (sessionStorage.getItem('avalon:pid') || localStorage.getItem('avalon:pid'))!);

async function settle(pages: Page[]) {
  await expect.poll(async () => {
    const all = await Promise.all(pages.map(p => p.evaluate(() => {
      const w = window as any;
      return w.__roomPending ? `pending:${Math.random()}` : JSON.stringify(w.__room?.game);
    })));
    return all.every(x => x === all[0]);
  }, { timeout: 20_000 }).toBe(true);
}

test.use({ actionTimeout: 15_000 });
test('一夜狼 full game on phones', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { (window as any).__onTimeScale = 0.05; });
  const pages: Page[] = [];
  for (let i = 0; i < NAMES.length; i++) pages.push(await ctx.newPage());
  const host = pages[0];

  // the game is listed in the hall (self-registered via meta.js)
  await host.goto('/game?local=1');
  await host.getByText('一夜狼').first().click();
  await expect(host).toHaveURL(/\/game\/onenight/);
  await host.getByTestId('name-input').fill(NAMES[0]);
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();
  expect(new URL(host.url()).pathname).toBe(`/game/onenight/${code}`);
  // only 1 player: start is blocked
  await expect(host.getByTestId('start-game')).toBeDisabled();

  for (let i = 1; i < pages.length; i++) {
    await pages[i].goto(`/game/onenight/${code}?local=1`);
    await pages[i].getByTestId('name-input').fill(NAMES[i]);
    await pages[i].getByRole('button', { name: '加入房间' }).click();
    await expect(pages[i].getByTestId('room-code')).toHaveText(code);
  }
  await settle(pages);
  await expect(host.getByTestId('deck')).toContainText('8 张');
  await expect(host.getByTestId('board-classic')).toHaveAttribute('aria-pressed', 'true');

  // DIY: a wrong-size deck blocks the start; every phone sees the change
  await host.getByTestId('toggle-diy').click();
  await host.getByTestId('role-hunter').click();
  await settle(pages);
  await expect(host.getByTestId('deck-error')).toBeVisible();
  await expect(host.getByTestId('start-game')).toBeDisabled();
  await expect(pages[2].getByTestId('board-custom')).toBeVisible();
  await host.getByTestId('minus-villager').click();
  await settle(pages);
  await expect(host.getByTestId('deck-error')).toHaveCount(0);
  await expect(host.getByTestId('deck')).toContainText('猎人');
  // house rules
  await host.getByTestId('rule-selfVote-yes').click();
  await host.getByTestId('rule-talk-3').click();
  await settle(pages);
  await pages[3].getByTestId('toggle-diy').click();
  await expect(pages[3].getByTestId('rule-selfVote-yes')).toHaveAttribute('aria-checked', 'true');
  await host.getByTestId('start-game').click();
  await settle(pages);

  const ids = await Promise.all(pages.map(myId));
  const pageOf = (id: string) => pages[ids.indexOf(id)];
  const nameOf = (id: string) => NAMES[ids.indexOf(id)];

  for (let round = 1; round <= 2; round++) {
    let g = await readGame(host);
    expect(g.step).toBe('night');
    expect(g.deck.length).toBe(8);
    // every phone shows the same panel shape and the same public timeline
    const heights = await Promise.all(pages.map(p => p.getByTestId('night-panel').evaluate(e => Math.round(e.getBoundingClientRect().height))));
    expect(new Set(heights).size).toBe(1);
    const lines = await Promise.all(pages.map(p => p.getByTestId('timeline').textContent()));
    expect(new Set(lines).size).toBe(1);

    // ---- night: each phone picks something legal for its dealt role
    for (const id of g.seats) {
      const p = pageOf(id);
      const role = g.start[id];
      const others = g.seats.filter(x => x !== id);
      const wolves = g.seats.filter(x => g.start[x] === 'wolf');
      // the identity peek is covered until pressed
      await expect(p.getByTestId('identity-peek-open')).toHaveCount(0);
      await p.getByTestId('identity-peek').dispatchEvent('pointerdown');
      await expect(p.getByTestId('identity-peek-open')).toBeVisible();
      await p.getByTestId('identity-peek').dispatchEvent('pointerup');
      if (role === 'seer') await p.getByTestId(`seat-${nameOf(others[0])}`).click();
      else if (role === 'thief') await p.getByTestId(`seat-${nameOf(others[1])}`).click();
      else if (role === 'meddler') { await p.getByTestId(`seat-${nameOf(others[0])}`).click(); await p.getByTestId(`seat-${nameOf(others[2])}`).click(); }
      else if (role === 'drunk' || (role === 'wolf' && wolves.length === 1)) await p.getByTestId('center-1').click();
      else await p.getByTestId('center-2').click();
      await p.getByTestId('night-act').click();
      await settle(pages);
    }
    g = await readGame(host);
    expect(g.final).toBeTruthy();
    // 夜贼 saw what he took
    const thief = g.seats.find(x => g.start[x] === 'thief');
    if (thief) {
      const p = pageOf(thief);
      await p.getByTestId('result-peek').dispatchEvent('pointerdown');
      const victim = g.seats.filter(x => x !== thief)[1];
      await expect(p.getByTestId('result-peek-open')).toContainText(({ wolf: '狼人', seer: '预言家', meddler: '搅局者', drunk: '醉汉', owl: '夜猫子', villager: '村民', hunter: '猎人', loner: '厌世者', minion: '爪牙', twin: '双子' } as Record<string, string>)[g.start[victim]]);
      await p.getByTestId('result-peek').dispatchEvent('pointerup');
    }

    // ---- dawn is clock-driven (host's phone)
    await expect(host.getByTestId('talk-timer')).toBeVisible({ timeout: 20_000 });
    await settle(pages);
    await expect(pages[1].getByTestId('start-vote')).toHaveCount(0); // only the host ends the talk
    await host.getByTestId('add-talk').click();
    await host.getByTestId('start-vote').click();
    await settle(pages);

    // ---- vote: gang up on a real wolf if there is one; votes stay hidden until all are in
    g = await readGame(host);
    const wolf = g.seats.find(x => g.final!.cards[x] === 'wolf');
    const target = wolf || g.seats[1];
    for (const [i, id] of g.seats.entries()) {
      const p = pageOf(id);
      const t = id === target ? g.seats.find(x => x !== id)! : target;
      await p.getByTestId(`seat-${nameOf(t)}`).click();
      await p.getByTestId('vote-go').click();
      await settle(pages);
      if (i === 0) {
        // the others only see that somebody voted
        await expect(pages[1].getByTestId(`seat-${nameOf(id)}`)).toContainText('已投');
        await expect(pages[1].getByTestId('vote-reveal')).toHaveCount(0);
      }
    }
    g = await readGame(host);
    expect(g.step).toBe('end');
    expect(g.result!.out).toContain(target);
    if (wolf) expect(g.result!.winners).toContain('village');
    for (const p of pages) await expect(p.getByTestId('vote-reveal')).toBeVisible();
    for (const p of pages) await p.getByTestId('close-reveal').click();
    for (const p of pages) {
      await expect(p.getByTestId('reveal-all')).toBeVisible();
      await expect(p.getByTestId('story')).toBeVisible();
    }
    if (round === 1) {
      await host.getByTestId('play-again').click();
      await host.getByTestId('confirm-ok').click();
      await settle(pages);
    }
  }
  await host.getByTestId('to-lobby').click();
  await settle(pages);
  await expect(pages[2].getByTestId('presets')).toBeVisible();
});

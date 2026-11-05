/**
 * Avalon end-to-end + visual self-review loop.
 *
 * Five separate browser contexts (= five devices, each with its own storage)
 * play a full game through the UI against the real AppSync backend in
 * amplify_outputs.json: create/join → roles + Lady of the Lake → reveal →
 * propose → vote (one rejection) → quests (one sabotaged) → Lady → assassin
 * → end. A phone-sized mirror of player 2 is screenshotted along the way.
 * A screenshot of every phase lands in test-results/avalon/ for review.
 *
 *   npx playwright test tests/avalon.spec.ts
 *   AVALON_LOCAL=1 npx playwright test tests/avalon.spec.ts   # offline transport
 */
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';

const OUT = 'test-results/avalon';
const NAMES = ['亚瑟', '桂妮', '高文', '凯伊', '崔斯坦'];
const LOCAL = !!process.env.AVALON_LOCAL;
const Q = LOCAL ? '&local=1' : '';

type Game = {
  step: string; seats: string[]; leaderIdx: number; quest: number; attempt: number;
  team: string[]; votes: Record<string, boolean>; cards: Record<string, boolean>;
  lady: { holder: string; used: string[]; log: unknown[] } | null;
  assignments: Record<string, string>; winner: string | null; results: { success: boolean }[];
};

let shot = 0;
async function snap(page: Page, label: string) {
  shot += 1;
  await page.waitForTimeout(350); // let step animations settle
  await page.screenshot({ path: `${OUT}/${String(shot).padStart(2, '0')}-${label}.png`, fullPage: true });
}

/** Shared state as this page currently sees it (dev-only window hook). */
async function readGame(page: Page): Promise<Game> {
  return page.evaluate(() => (window as unknown as { __avalonRoom: { game: Game } }).__avalonRoom.game);
}

/** Wait until every page has received the same game state. */
async function settle(pages: Page[]) {
  await expect.poll(async () => {
    const all = await Promise.all(pages.map(p => p.evaluate(() => {
      const w = window as any;
      return w.__avalonPending ? `pending:${Math.random()}` : JSON.stringify(w.__avalonRoom?.game);
    })));
    return all.every(x => x === all[0]);
  }, { timeout: 20_000 }).toBe(true);
}

async function myId(page: Page) {
  return page.evaluate(() => (sessionStorage.getItem('avalon:pid') || localStorage.getItem('avalon:pid'))!);
}

/** Close any result overlay (quest cards, vote tally, Lady result) covering this page. */
async function dismissReveal(page: Page) {
  for (const id of ['close-vote', 'close-reveal', 'close-lady']) {
    const btn = page.getByTestId(id);
    if (await btn.isVisible().catch(() => false)) {
      await page.waitForTimeout(id === 'close-lady' ? 300 : 1500);
      await btn.click({ timeout: 3000 }).catch(() => {}); // may have auto-closed
    }
  }
}

/** Click a guarded button, then OK in the confirm dialog. */
async function confirmClick(page: Page, testId: string, shot?: string) {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId('confirm')).toBeVisible();
  if (shot) await snap(page, shot);
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('confirm')).toBeHidden();
}

test('full Avalon game across five tabs', async ({ browser }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(OUT, { recursive: true });
  fs.readdirSync(OUT).forEach(f => fs.unlinkSync(`${OUT}/${f}`));

  const contexts: BrowserContext[] = [];
  const device = async (viewport = { width: 1280, height: 900 }) => {
    const c = LOCAL && contexts[0] ? contexts[0] : await browser.newContext({ viewport });
    if (!contexts.includes(c)) contexts.push(c);
    const p = await c.newPage();
    if (LOCAL) await p.setViewportSize(viewport);
    return p;
  };
  const errors: string[] = [];

  // Host creates the room.
  const host = await device();
  host.on('pageerror', e => errors.push(`host: ${e.message}`));
  await host.goto(LOCAL ? '/?local=1' : '/');
  await host.getByRole('button', { name: 'GAME', exact: true }).click();
  await snap(host, 'hub');
  await host.getByText('阿瓦隆').first().click();
  // Nickname budget: 5 CJK chars or 10 Latin letters.
  const nameInput = host.getByTestId('name-input');
  await nameInput.fill('abcdefghijklmnop');
  await expect(nameInput).toHaveValue('abcdefghij');
  await nameInput.fill('一二三四五六七');
  await expect(nameInput).toHaveValue('一二三四五');
  await expect(host.getByTestId('name-units')).toHaveText('10/10');
  await host.getByPlaceholder('亚瑟').fill(NAMES[0]);
  await snap(host, 'entry');
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z]{4}$/);

  // Four friends join via the invite link, each on their own "device".
  const pages: Page[] = [host];
  for (let i = 1; i < 5; i++) {
    const p = await device();
    p.on('pageerror', e => errors.push(`${NAMES[i]}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'warning') console.log('WARN', NAMES[i], m.text()); });
    await p.goto(`/?game=avalon&room=${code}${Q}`);
    await p.getByPlaceholder('亚瑟').fill(NAMES[i]);
    if (i === 1) await snap(p, 'join-via-link');
    await p.getByRole('button', { name: '加入房间' }).click();
    await expect(p.getByTestId('room-code')).toHaveText(code);
    pages.push(p);
  }

  // Lobby follows the per-head-count recommendation by default
  // (5 人: 梅林 派西维尔 忠臣 / 莫甘娜 刺客).
  await expect(host.getByTestId('auto-tag')).toContainText('5 人推荐');
  await host.getByTestId('toggle-rec-table').click();
  await expect(host.getByTestId('rec-table')).toBeVisible();
  await snap(host, 'lobby-full');
  // Customising drops out of auto; "restore" brings it back.
  await host.getByRole('button', { name: /奥伯伦/ }).click();
  await expect(host.getByTestId('use-recommended')).toBeVisible();
  await host.getByTestId('use-recommended').click();
  await expect(host.getByTestId('auto-tag')).toBeVisible();
  await host.getByTestId('toggle-lady').click();
  await expect(host.getByTestId('toggle-lady')).toHaveAttribute('aria-pressed', 'true');
  await expect(pages[4].getByTestId('toggle-lady')).toHaveAttribute('aria-pressed', 'true');
  await snap(host, 'lobby-lady');
  // Kicking asks first; cancel keeps the player.
  await host.getByTestId('kick').first().click();
  await expect(host.getByTestId('confirm')).toBeVisible();
  await snap(host, 'kick-confirm');
  await host.getByTestId('confirm-cancel').click();
  await expect(host.getByTestId('confirm')).toBeHidden();
  await expect(host.getByText('5/10')).toBeVisible();
  await host.getByTestId('start-game').click();

  // Everyone flips their card.
  for (const [i, p] of pages.entries()) {
    await expect(p.getByTestId('role-modal')).toBeVisible();
    await p.getByTestId('role-card').click();
    await expect(p.getByTestId('intel')).toBeVisible();
    if (i < 2) { await p.waitForTimeout(500); await snap(p, `role-card-${NAMES[i]}`); }
    await p.getByTestId('close-role').click();
  }

  const ids = await Promise.all(pages.map(myId));
  const pageOf = (id: string) => pages[ids.indexOf(id)];
  await settle(pages);
  let g = await readGame(host);
  expect(g.step).toBe('propose');
  expect(g.lady).not.toBeNull();
  const nameOf = (id: string) => NAMES[ids.indexOf(id)];

  // Phone mirror: player 2's seat in a phone-sized tab, for mobile screenshots.
  const mobile = await device({ width: 390, height: 844 });
  await mobile.addInitScript(id => sessionStorage.setItem('avalon:pid', id), ids[1]);
  await mobile.goto(`/?game=avalon&room=${code}${Q}`);
  await mobile.getByTestId('close-role').click({ timeout: 2000 }).catch(() => {});

  const shotsTaken = new Set<string>();
  const once = async (key: string, page: Page, label = key) => {
    if (shotsTaken.has(key)) return;
    shotsTaken.add(key);
    await snap(page, label);
  };

  const all = [...pages, mobile];
  let ladyUses = 0;
  for (let guard = 0; guard < 80 && g.step !== 'end'; guard++) {
    await settle(all);
    for (const p of all) await dismissReveal(p);
    g = await readGame(host);
    const leader = g.seats[g.leaderIdx];

    if (g.step === 'propose') {
      const lp = pageOf(leader);
      const size = [2, 3, 2, 3, 3][g.quest];
      const team = [leader, ...g.seats.filter(id => id !== leader)].slice(0, size);
      for (const id of team) await lp.getByTestId(`seat-${nameOf(id)}`).click();
      await once('propose', lp, 'propose-leader-view');
      await once('propose-mobile', mobile, 'propose-mobile');
      await lp.getByTestId('submit-team').click();
    } else if (g.step === 'vote') {
      // Reject the very first proposal to exercise the rejection path.
      const approve = !(g.quest === 0 && g.attempt === 1);
      for (const [i, p] of pages.entries()) {
        await p.getByTestId(approve ? 'vote-yes' : 'vote-no').click();
        if (i === 2) { await once('vote', p, 'vote-midway'); await once('vote-mobile', mobile, 'vote-mobile'); }
      }
      await expect(host.getByTestId('vote-reveal')).toBeVisible();
      await host.waitForTimeout(2600);
      await once(`vote-reveal-${approve}`, host, approve ? 'vote-reveal-approved' : 'vote-reveal-rejected');
    } else if (g.step === 'quest') {
      for (const id of g.team) {
        const p = pageOf(id);
        const evil = ['assassin', 'morgana', 'mordred', 'minion', 'oberon'].includes(g.assignments[id]);
        await once(`quest-${evil ? 'evil' : 'good'}`, p, `quest-card-${evil ? 'evil' : 'good'}`);
        // sabotage exactly quest 2 so the game reaches the assassin phase
        const fail = evil && g.quest === 1;
        await p.getByTestId(fail ? 'card-fail' : 'card-success').click();
        await expect(p.getByTestId('confirm')).toHaveCount(0);
      }
      await host.waitForTimeout(2600); // card-by-card reveal animation
      await once(`reveal-${g.quest}`, host, `quest-result-${g.quest + 1}`);
      if (g.quest === 0) await once('reveal-mobile', mobile, 'quest-result-mobile');
    } else if (g.step === 'lady') {
      const hp = pageOf(g.lady!.holder);
      const t = g.seats.find(id => id !== g.lady!.holder && !g.lady!.used.includes(id))!;
      await hp.getByTestId(`seat-${nameOf(t)}`).click();
      await once('lady', hp, 'lady-holder-view');
      await confirmClick(hp, 'lady-examine');
      await expect(hp.getByTestId('lady-reveal')).toBeVisible();
      await hp.waitForTimeout(900);
      await once('lady-after', hp, 'lady-result');
      await hp.getByTestId('close-lady').click();
      await expect(hp.getByTestId('lady-result').last()).toBeVisible();
      ladyUses += 1;
    } else if (g.step === 'assassin') {
      const a = g.seats.find(id => g.assignments[id] === 'assassin')!;
      const merlin = g.seats.find(id => g.assignments[id] === 'merlin')!;
      const ap = pageOf(a);
      await ap.getByTestId(`seat-${nameOf(merlin)}`).click();
      await snap(ap, 'assassin-view');
      await confirmClick(ap, 'assassinate', 'assassin-confirm');
    }
    await host.waitForTimeout(300);
    await settle(all);
    g = await readGame(host);
  }

  expect(g.step).toBe('end');
  expect(ladyUses).toBeGreaterThanOrEqual(1);
  for (const p of all) await dismissReveal(p);
  await snap(host, 'end-desktop');
  await mobile.reload();
  await dismissReveal(mobile);
  await mobile.getByTestId('close-role').click({ timeout: 2000 }).catch(() => {});
  await snap(mobile, 'end-mobile');

  // Visual sanity: nothing overflows the phone viewport horizontally.
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
  for (const c of contexts) await c.close();
});

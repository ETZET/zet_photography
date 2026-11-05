/**
 * 双身份狼人 end-to-end + screenshot tour, on phone-sized screens.
 *
 * Six players play a full game through the UI (create/join → arrange cards →
 * nights with guard / wolves / seer / witch → dawn → vote → … → end).
 * Screenshots of every key screen land in test-results/werewolf/.
 *
 *   npx playwright test tests/werewolf.spec.ts                # offline (local transport)
 *   WW_REMOTE=1 npx playwright test tests/werewolf.spec.ts    # real AppSync backend
 */
import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const OUT = 'test-results/werewolf';
const NAMES = ['村长', '阿花', '铁柱', '小美', '老王', '二狗'];
const REMOTE = !!process.env.WW_REMOTE;
const Q = REMOTE ? '' : '&local=1';

type G = {
  step: string; seats: string[]; night: number; day: number;
  hands: Record<string, { cards: string[]; locked: boolean }>; dead: Record<string, number>;
  acts: { guard: string | null; wolves: Record<string, string>; seer: string | null; kill: string | null };
  potions: { save: boolean; poison: boolean }; guardLast: string | null; votes: Record<string, string | null>;
  rules: Record<string, string>; muted?: string[];
  hunter: { id: string } | null; winner: string | null; seerLog: { from: string; night: number }[];
};

let shot = 0;
const taken = new Set<string>();
async function snap(page: Page, label: string, once = true) {
  if (once && taken.has(label)) return;
  taken.add(label);
  shot += 1;
  await page.waitForTimeout(700); // let stepped animations finish
  await page.screenshot({ path: `${OUT}/${String(shot).padStart(2, '0')}-${label}.png`, fullPage: true });
}
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

/** Right after a night resolves, capture the host's dawn announcement. */
async function snapDawn(host: Page) {
  const dawn = host.getByTestId('dawn-reveal');
  if (await dawn.waitFor({ timeout: 2500 }).then(() => true, () => false)) {
    await host.getByTestId('close-vote').click({ timeout: 300 }).catch(() => {});
    await snap(host, 'dawn');
  }
}

async function dismiss(page: Page) {
  for (const id of ['close-dawn', 'close-vote', 'close-seer']) {
    const b = page.getByTestId(id);
    if (await b.isVisible().catch(() => false)) await b.click({ timeout: 3000 }).catch(() => {});
  }
}

const active = (g: G, id: string) => (g.dead[id] < 2 ? g.hands[id].cards[g.dead[id]] : null);
const alive = (g: G) => g.seats.filter(id => g.dead[id] < 2);
const wolfCamp = (g: G, id: string) => g.hands[id].cards.includes('wolf');
const nightWolf = (g: G, id: string) => (g.rules.wake === 'all'
  ? g.dead[id] < 2 && g.hands[id].cards.slice(g.dead[id]).includes('wolf') : active(g, id) === 'wolf');
const voters = (g: G) => alive(g).filter(id => !(g.rules.mute === 'yes' && (g.muted || []).includes(id)));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

test('双身份狼人 full game on phones', async ({ browser }) => {
  test.setTimeout(420_000);
  fs.mkdirSync(OUT, { recursive: true });
  fs.readdirSync(OUT).forEach(f => fs.unlinkSync(`${OUT}/${f}`));

  // Local transport shares localStorage, so all phones live in one context;
  // remote mode gives each phone its own context (= its own device).
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
  const shared = REMOTE ? null : await browser.newContext(phone);
  const pages: Page[] = [];
  for (let i = 0; i < NAMES.length; i++) pages.push(await (shared || await browser.newContext(phone)).newPage());
  const host = pages[0];

  await host.goto(`/?game=werewolf${Q}`);
  await expect(host.getByText('双身份狼人').first()).toBeVisible();
  await snap(host, 'entry');
  await host.getByTestId('name-input').fill(NAMES[0]);
  await host.getByRole('button', { name: '创建房间' }).click();
  const code = (await host.getByTestId('room-code').textContent())!.trim();

  for (let i = 1; i < pages.length; i++) {
    await pages[i].goto(`/?game=werewolf&room=${code}${Q}`);
    await pages[i].getByTestId('name-input').fill(NAMES[i]);
    await pages[i].getByRole('button', { name: '加入房间' }).click();
    await expect(pages[i].getByTestId('room-code')).toHaveText(code);
  }
  await settle(pages);
  await expect(host.getByTestId('deck')).toContainText('狼人×2');
  await snap(host, 'lobby');
  await host.getByTestId('toggle-rules').click();
  await expect(host.getByTestId('rule-card')).toBeVisible();
  await snap(host, 'lobby-rules');
  // host picks a few house-rule variants; every phone must see them
  for (const id of ['rule-wake-all', 'rule-reveal-show', 'rule-mute-yes', 'rule-selfSave-first']) await host.getByTestId(id).click();
  await settle(pages);
  await expect(pages[3].getByTestId('rule-wake-all')).toHaveAttribute('aria-checked', 'true');
  await expect(host.getByTestId('rule-card')).toContainText('晚上都睁眼');
  await host.getByTestId('variants').scrollIntoViewIfNeeded();
  await snap(host, 'lobby-variants');
  await host.getByTestId('start-game').click();
  await settle(pages);

  const ids = await Promise.all(pages.map(myId));
  const pageOf = (id: string) => pages[ids.indexOf(id)];
  const nameOf = (id: string) => NAMES[ids.indexOf(id)];
  const tap = (p: Page, id: string) => p.getByTestId(`seat-${nameOf(id)}`).click();

  // ---- arrange: wolves put the wolf card on top, others as dealt
  let g = await readGame(host);
  const wolfPlayer = g.seats.find(id => wolfCamp(g, id))!;
  const goodPlayer = g.seats.find(id => !wolfCamp(g, id))!;
  await snap(pageOf(wolfPlayer), 'arrange-wolf');
  await snap(pageOf(goodPlayer), 'arrange-good');
  for (const id of g.seats) {
    const p = pageOf(id);
    const [top, bottom] = g.hands[id].cards;
    // wolves lead with the wolf card; good players lead with their skill card
    const flip = (bottom === 'wolf' && top !== 'wolf') || (!wolfCamp(g, id) && top === 'villager' && bottom !== 'villager');
    if (flip) { await p.getByTestId('swap').click(); await settle(pages); }
    await p.getByTestId('lock').click();
  }
  await settle(pages);

  for (let guard = 0; guard < 80; guard++) {
    g = await readGame(host);
    if (g.step === 'end') break;
    if (g.step !== 'day' && g.step !== 'hunter') await Promise.all(pages.map(dismiss));

    if (g.step === 'night') {
      const sleeper = alive(g).find(id => !nightWolf(g, id) && !['guard', 'seer'].includes(active(g, id)!));
      if (sleeper) await snap(pageOf(sleeper), 'night-sleeping');
      const guardId = alive(g).find(id => active(g, id) === 'guard' && !g.acts.guard);
      if (guardId) {
        const p = pageOf(guardId);
        await tap(p, pick(alive(g).filter(x => x !== g.guardLast)));
        await snap(p, 'night-guard');
        await p.getByTestId('guard-act').click();
      }
      const seerId = alive(g).find(id => active(g, id) === 'seer' && !g.acts.seer);
      if (seerId) {
        const p = pageOf(seerId);
        await tap(p, pick(alive(g).filter(x => x !== seerId)));
        await snap(p, 'night-seer');
        await p.getByTestId('seer-act').click();
        await expect(p.getByTestId('seer-reveal')).toBeVisible();
        await snap(p, 'night-seer-result');
        await p.getByTestId('close-seer').click();
      }
      const wolves = alive(g).filter(id => nightWolf(g, id) && !(id in g.acts.wolves));
      const prey = pick(alive(g).filter(id => !wolfCamp(g, id)));
      for (const [i, w] of wolves.entries()) {
        const p = pageOf(w);
        await tap(p, prey);
        if (i === 0) await snap(p, 'night-wolf');
        await p.getByTestId('wolf-kill').click();
      }
      if (!(await readGame(host).then(x => x.step === 'night' || x.step === 'witch'))) await snapDawn(host);
      await settle(pages);
      continue;
    }

    if (g.step === 'witch') {
      const w = alive(g).find(id => active(g, id) === 'witch')!;
      const p = pageOf(w);
      await snap(p, 'night-witch');
      if (g.potions.save && g.acts.kill && g.acts.kill !== w && g.night === 1) await p.getByTestId('witch-save').click();
      else if (g.potions.poison && g.night === 2) {
        await p.getByTestId('witch-poison').click();
        await tap(p, pick(alive(g).filter(id => wolfCamp(g, id))));
        await snap(p, 'night-witch-poison');
        await p.getByTestId('witch-poison-go').click();
      } else await p.getByTestId('witch-skip').click();
      await snapDawn(host);
      await settle(pages);
      continue;
    }

    if (g.step === 'day' || g.step === 'hunter') {
      const viewer = host;
      for (const p of pages) if (p !== viewer) for (const id of ['close-vote', 'close-seer']) await p.getByTestId(id).click({ timeout: 500 }).catch(() => {});
      await viewer.getByTestId('close-vote').click({ timeout: 500 }).catch(() => {});
      const dawn = viewer.getByTestId('dawn-reveal');
      if (await dawn.isVisible().catch(() => false)) {
        await viewer.waitForTimeout(900);
        await snap(viewer, `dawn-${g.night}`);
      }
      await Promise.all(pages.map(dismiss));
      if (g.step === 'hunter') {
        const p = pageOf(g.hunter!.id);
        await tap(p, pick(alive(g).filter(id => id !== g.hunter!.id)));
        await snap(p, 'hunter');
        await p.getByTestId('hunter-shoot').click();
        await p.getByTestId('confirm-ok').click();
        await settle(pages);
        continue;
      }
      await snap(host, 'day');
      await host.getByTestId('start-vote').click();
      await settle(pages);
      continue;
    }

    if (g.step === 'vote') {
      // the village gangs up on someone in the wolf camp so the game moves along
      const suspect = pick(alive(g).filter(id => wolfCamp(g, id)));
      await expect(host.getByTestId('house-rules')).toBeVisible();
      for (const [i, v] of voters(g).entries()) {
        const p = pageOf(v);
        await dismiss(p);
        const t = v === suspect ? pick(alive(g).filter(x => x !== v)) : suspect;
        await tap(p, t);
        if (i === 2) await snap(p, 'vote');
        await p.getByTestId('vote-go').click();
        await settle(pages);
      }
      await expect(host.getByTestId('vote-reveal')).toBeVisible();
      await host.waitForTimeout(2600);
      await snap(host, 'vote-reveal');
      continue;
    }
  }

  g = await readGame(host);
  expect(g.step).toBe('end');
  await Promise.all(pages.map(dismiss));
  await host.waitForTimeout(800);
  await snap(host, 'end');
  // every phone must agree on the result and show the full reveal
  for (const p of pages) await expect(p.getByTestId('reveal-all')).toBeVisible();
});

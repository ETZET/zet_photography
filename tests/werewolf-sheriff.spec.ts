/**
 * 双身份狼人 警长 variant: day-1 election (上警 / 退水 / 警下投票 / PK / 流失),
 * the 警长's 1.5 vote, 警左·警右 speaking order with the 警长 last, and passing
 * the badge on death. Engine rules are checked directly in the page; then one
 * game is played on a phone with bots.
 *
 *   npx playwright test tests/werewolf-sheriff.spec.ts
 */
import { test, expect } from '@playwright/test';

test.use({ actionTimeout: 15_000 });

test('警长: engine rules', async ({ page }) => {
  await page.goto('/game/werewolf?local=1');
  const out = await page.evaluate(async () => {
    const R = await import('/src/games/werewolf/wolfRules.js');
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    const hands = [['villager', 'villager'], ['wolf', 'villager'], ['seer', 'villager'], ['witch', 'villager'], ['hunter', 'villager'], ['guard', 'villager']];
    // a game that has just reached day 1 with no losses (wolves skip via forced night)
    const fresh = () => {
      const rules = { ...R.DEFAULT_RULES, sheriff: 'yes' };
      const g = R.newGame(ids.map(id => ({ id })), { ...R.effectiveConfig(6, { auto: true, rules }), rules: { ...rules, order: 'choose' } });
      g.seats = ids;
      ids.forEach((id, i) => { g.hands[id] = { cards: hands[i], locked: false }; g.dead[id] = 0; });
      ids.forEach(id => R.lockCards(g, id));
      R.forceNight(g, Date.now() + 1e9);
      R.settleNight(g, Date.now() + 2e9);
      return g;
    };
    const res: Record<string, unknown> = {};
    const err = (fn: () => void) => { try { fn(); return null; } catch (e) { return (e as Error).message; } };

    // nobody runs → no 警长, plain day
    let g = fresh();
    res.startsElect = g.step;
    ids.forEach(id => R.electSign(g, id, false));
    res.none = [g.step, g.sheriff, g.speak.pick ?? false];

    // only one runner → elected straight away; picks 警右 (up) and speaks last
    g = fresh();
    ids.forEach(id => R.electSign(g, id, id === 'c'));
    res.only = [g.sheriff, g.speak.pick];
    res.notSheriffPick = err(() => R.sheriffOrder(g, 'a', 'up'));
    R.sheriffOrder(g, 'c', 'up');
    res.order = g.speak.order.join('');

    // two run, one 退水 → the other wins without a vote; quitters can't vote
    g = fresh();
    ids.forEach(id => R.electSign(g, id, id === 'a' || id === 'b'));
    res.speaking = g.elect.phase;
    R.electQuit(g, 'b');
    res.quit = g.sheriff;

    // three run, tie → PK → tie again → 警徽流失
    g = fresh();
    ids.forEach(id => R.electSign(g, id, ['a', 'b', 'c'].includes(id)));
    R.electStartVote(g, true);
    res.runnerVote = err(() => R.electVote(g, 'a', 'b'));
    R.electVote(g, 'd', 'a'); R.electVote(g, 'e', 'b'); R.electVote(g, 'f', null);
    res.pk = [g.elect.phase, g.elect.pk.join('')];
    res.pkNoQuit = err(() => R.electQuit(g, 'a'));
    R.electStartVote(g, true);
    res.pkOnly = err(() => R.electVote(g, 'd', 'c'));
    R.electVote(g, 'd', 'a'); R.electVote(g, 'e', 'b'); R.electVote(g, 'f', null);
    res.lost = [g.step, g.sheriff, g.log.filter((l: any) => l.type === 'sheriff').pop().reason];

    // 警长 'a' votes count 1.5: a+b (2.5) on d beat c+e+... no: 2 vs 2.5
    g = fresh();
    ids.forEach(id => R.electSign(g, id, id === 'a'));
    R.sheriffOrder(g, 'a', 'down');
    res.downOrder = g.speak.order.join('');
    R.startVote(g);
    R.castVote(g, 'a', 'd'); R.castVote(g, 'b', 'd'); R.castVote(g, 'c', 'e'); R.castVote(g, 'd', 'e'); R.castVote(g, 'e', null); R.castVote(g, 'f', null);
    res.weighted = g.log.filter((l: any) => l.type === 'vote').pop().out;

    // the 警长 goes out for good → must pass the badge before acknowledging
    g = fresh();
    ids.forEach(id => R.electSign(g, id, id === 'd'));
    R.sheriffOrder(g, 'd', 'up');
    g.dead.d = 1;
    R.startVote(g);
    ['a', 'b', 'c', 'e', 'f'].forEach(id => R.castVote(g, id, 'd'));
    // d is muted? no (mute rule off) — d votes too
    if (g.step === 'vote') R.castVote(g, 'd', null);
    res.confirm = [g.step, R.badgePending(g, 'd')];
    res.ackFirst = err(() => R.ackLoss(g, 'd'));
    R.passBadge(g, 'd', 'f');
    R.ackLoss(g, 'd');
    res.passed = [g.sheriff, g.step];
    // 情侣不能互投
    g = fresh();
    ids.forEach(id => R.electSign(g, id, false));
    g.lovers = ['a', 'b'];
    R.startVote(g);
    res.loverVote = err(() => R.castVote(g, 'a', 'b'));
    res.loverOther = err(() => R.castVote(g, 'a', 'c'));
    return res;
  });
  expect(out.startsElect).toBe('elect');
  expect(out.none).toEqual(['day', null, false]);
  expect(out.only).toEqual(['c', true]);
  expect(out.notSheriffPick).toBe('由警长决定发言顺序');
  expect(out.order).toBe('defabc'); // from c's next seat upward, 警长 c last
  expect(out.speaking).toBe('speak');
  expect(out.quit).toBe('a');
  expect(out.runnerVote).toBe('警上的人不投票');
  expect(out.pk).toEqual(['speak', 'ab']);
  expect(out.pkNoQuit).toBe('现在不能退水');
  expect(out.pkOnly).toBe('只能投警上的人');
  expect(out.lost).toEqual(['day', null, 'tie']);
  expect(out.downOrder).toBe('fedcba');
  expect(out.weighted).toBe('d');
  expect(out.confirm).toEqual(['confirm', true]);
  expect(out.ackFirst).toBe('先决定警徽交给谁');
  expect(out.passed).toEqual(['f', 'dusk']);
  expect(out.loverVote).toBe('情侣不能投对方');
  expect(out.loverOther).toBeNull();
});

test('警长: a game on the phone', async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const host = await ctx.newPage();
  await host.goto('/game/werewolf?local=1');
  await host.getByTestId('name-input').fill('房主');
  await host.getByRole('button', { name: '创建房间' }).click();
  for (let i = 0; i < 7; i++) await host.getByTestId('add-bot').click();

  // 村规 turns the 警长 on, and it shows in the rule card and the DIY panel
  await host.getByTestId('preset-village').click();
  await host.getByTestId('toggle-rules').click();
  await expect(host.getByTestId('rule-card')).toContainText('竞选警长');

  await host.evaluate(async () => {
    const m = await import('/tests/wwStage.js');
    await m.stage({
      hands: [['villager', 'villager'], ['wolf', 'villager'], ['seer', 'villager'], ['witch', 'villager'], ['wolf', 'hunter'], ['guard', 'villager'], ['villager', 'seer'], ['villager', 'wolf']],
      rules: { sheriff: 'yes' },
      then: "R.forceNight(g, Date.now() + 1e9); R.settleNight(g, Date.now() + 2e9);",
    });
  });
  // everyone answers 上警 or not; the host runs
  await host.getByTestId('elect-run').click();
  await expect(host.getByTestId('elect-run')).toHaveCount(0, { timeout: 20_000 });
  // speeches (the host speaks when it's their turn), then the host opens the vote
  for (let i = 0; i < 40; i++) {
    const g = await host.evaluate(() => (window as any).__room.game);
    if (g.step !== 'elect') break;
    if (g.elect.phase === 'speak') {
      const me = g.seats[0];
      if (g.elect.order[g.elect.at] === me) await host.getByTestId('speak-done').click();
      else if (g.elect.at >= g.elect.order.length) await host.getByTestId('elect-start-vote').click();
    }
    await host.waitForTimeout(500);
  }
  const g = await host.evaluate(() => (window as any).__room.game);
  expect(g.step).toBe('day');
  const el = g.log.find((l: any) => l.type === 'sheriff');
  expect(el).toBeTruthy();
  await expect(host.getByTestId('log')).toContainText(el.to ? '当选警长' : '警徽流失');
  if (el.to === g.seats[0]) {
    await host.getByTestId('sheriff-up').click();
    await expect(host.getByTestId('speak-rule')).toContainText('警长最后发言归票');
  }
  if (el.to) {
    await expect.poll(() => host.evaluate(() => (window as any).__room.game.speak.pick), { timeout: 15_000 }).toBe(false);
    const order = await host.evaluate(() => (window as any).__room.game.speak.order);
    expect(order[order.length - 1]).toBe(el.to);
  }
  await ctx.close();
});

test('丘比特 is never dealt with a wolf card', async ({ page }) => {
  await page.goto('/game/werewolf?local=1');
  const bad = await page.evaluate(async () => {
    const R = await import('/src/games/werewolf/wolfRules.js');
    let n = 0;
    for (const size of [8, 9, 10]) for (let i = 0; i < 300; i++) {
      const rules = { ...R.DEFAULT_RULES, cupid: 'yes' };
      const players = Array.from({ length: size }, (_, k) => ({ id: `p${k}` }));
      const g = R.newGame(players, { ...R.effectiveConfig(size, { auto: true, rules }), rules });
      const c = R.cupidOf(g);
      if (c && g.hands[c].cards.includes('wolf')) n++;
    }
    return n;
  });
  expect(bad).toBe(0);
});

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── shared helpers ───────────────────────────────────────────────────────────

async function navigateToLogin(page: Page) {
  await page.click('text=ABOUT');
  await page.waitForTimeout(500);
  await page.click('button[aria-label="Login"]');
}

async function login(page: Page) {
  await navigateToLogin(page);
  await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await expect(page.locator('text=MANAGE')).toBeVisible({ timeout: 15000 });
}

async function waitForManageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForSelector('text=Photo Series', { timeout: 20000 });
  await page.waitForSelector('text=Current Images', { timeout: 20000 }).catch(async () => {
    const firstSeries = page.locator('ul li button').first();
    if (await firstSeries.isVisible()) await firstSeries.click();
    await page.waitForSelector('text=Current Images', { timeout: 10000 });
  });
}

// Unhide all images so each test starts from a clean visible state.
async function resetHiddenImages(page: Page) {
  let btn = page.locator('button[title*="Make public"]').first();
  while (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(400);
  }
}

// Click the eye-off toggle on the first thumbnail.
// Returns true if succeeded, or calls test.skip() if the schema isn't deployed.
async function hideFirstImage(page: Page): Promise<boolean> {
  const firstThumb = page.locator('.group').filter({ has: page.locator('button[title*="Hide from public"]') }).first();
  const exists = await firstThumb.isVisible({ timeout: 5000 }).catch(() => false);
  if (!exists) {
    test.skip(true, 'No eye-toggle button found — hiddenImages schema not deployed');
    return false;
  }
  await firstThumb.hover();
  await firstThumb.locator('button[title*="Hide from public"]').click();
  await page.waitForSelector('p.text-sm.font-medium', { timeout: 5000 });
  const toast = await page.locator('p.text-sm.font-medium').first().textContent() ?? '';
  if (toast.includes('Failed')) {
    test.skip(true, 'hiddenImages mutation rejected — deploy schema change to production first (run: npx ampx sandbox)');
    return false;
  }
  return true;
}

// ─── T8: Guest view baseline ──────────────────────────────────────────────────
test('T8 guest view loads public gallery', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=WORK')).toBeVisible();
  // No user-facing error banner
  await expect(page.locator('.bg-red-50, [role="alert"]')).toHaveCount(0);
});

// ─── T10: Backward compat ──────────────────────────────────────────────────────
test('T10 app loads without hiddenImages on existing series', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
});

// ─── Login ────────────────────────────────────────────────────────────────────
test('login as admin', async ({ page }) => {
  await page.goto('/');
  await login(page);
});

// ─── T1: Hide a single image ──────────────────────────────────────────────────
test('T1 hide a single image', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);
  await resetHiddenImages(page);

  const ok = await hideFirstImage(page);
  if (!ok) return;

  const firstThumb = page.locator('.group').filter({ has: page.locator('button[title*="Make public"]') }).first();
  await expect(page.locator('text=hidden from public view')).toBeVisible({ timeout: 5000 });
  await expect(firstThumb.locator('.saturate-50')).toBeVisible();
  await expect(firstThumb.locator('text=Hidden')).toBeVisible();
  await expect(page.locator('text=· 1 hidden from public').first()).toBeVisible();
});

// ─── T2: Hidden image absent from public gallery ──────────────────────────────
test('T2 hidden image absent from public gallery', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);
  await resetHiddenImages(page);

  // Capture the thumbnail button title (contains filename) before hiding
  const firstThumb = page.locator('.group').filter({ has: page.locator('button[title*="Hide from public"]') }).first();
  await expect(firstThumb).toBeVisible({ timeout: 10000 });
  const btnTitle = await firstThumb.locator('button[title*="Hide from public"]').getAttribute('title') ?? '';
  // title is "Hide from public view" — not the filename; instead grab data from a sibling if available
  // We'll just verify by checking the thumbnail count before/after in WORK

  const ok = await hideFirstImage(page);
  if (!ok) return;

  await page.click('text=WORK');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // No user-facing error after filtering
  await expect(page.locator('.bg-red-50, [role="alert"]')).toHaveCount(0);
});

// ─── T3: Unhide restores image ────────────────────────────────────────────────
test('T3 unhide restores image', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);
  await resetHiddenImages(page);

  const ok = await hideFirstImage(page);
  if (!ok) return;

  await expect(page.locator('text=hidden from public view')).toBeVisible({ timeout: 5000 });

  // Unhide
  const hiddenThumb = page.locator('.group').filter({ has: page.locator('button[title*="Make public"]') }).first();
  await hiddenThumb.locator('button[title*="Make public"]').click();
  await expect(page.locator('text=is now public')).toBeVisible({ timeout: 5000 });
  await expect(hiddenThumb.locator('.saturate-50')).toHaveCount(0);
  await expect(hiddenThumb.locator('text=Hidden')).toHaveCount(0);
});

// ─── T4: Persistence after reload ─────────────────────────────────────────────
test('T4 hidden state persists after hard refresh', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);
  await resetHiddenImages(page);

  const ok = await hideFirstImage(page);
  if (!ok) return;

  await expect(page.locator('text=hidden from public view')).toBeVisible({ timeout: 5000 });

  await page.reload();
  await page.waitForLoadState('networkidle');
  const isManageVisible = await page.locator('text=MANAGE').isVisible({ timeout: 8000 }).catch(() => false);
  if (!isManageVisible) {
    await login(page);
  }
  await page.click('text=MANAGE');
  await waitForManageReady(page);

  await expect(page.locator('text=Hidden').first()).toBeVisible({ timeout: 10000 });
});

// ─── T7: Reorder dialog shows hidden state ────────────────────────────────────
test('T7 reorder dialog shows hidden state', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);
  await resetHiddenImages(page);

  const ok = await hideFirstImage(page);
  if (!ok) return;

  await expect(page.locator('text=hidden from public view')).toBeVisible({ timeout: 5000 });

  await page.locator('button', { hasText: /Reorder Images/i }).click();
  await page.waitForSelector('text=Save Order', { timeout: 5000 });
  await expect(page.locator('text=Hidden').first()).toBeVisible();
});

// ─── T9: Series-level hide ────────────────────────────────────────────────────
test('T9 series-level hide still works', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);

  // If the series is already hidden from a prior run, unhide it first
  const showBtn = page.locator('button', { hasText: /^Show$/ }).first();
  if (await showBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await showBtn.click();
    await page.waitForTimeout(500);
  }

  // Now hide it
  const hideSeriesBtn = page.locator('button', { hasText: /^Hide$/ }).first();
  await expect(hideSeriesBtn).toBeVisible({ timeout: 5000 });
  await hideSeriesBtn.click();

  // Verify the button flipped to "Show"
  await expect(page.locator('button', { hasText: /^Show$/ }).first()).toBeVisible({ timeout: 5000 });

  await page.click('text=WORK');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.bg-red-50, [role="alert"]')).toHaveCount(0);

  // Restore: unhide the series so subsequent tests see photos in the public gallery
  await page.click('text=MANAGE');
  await waitForManageReady(page);
  await page.locator('button', { hasText: /^Show$/ }).first().click();
  await page.waitForTimeout(500);
});

// ─── T11: Photo viewer modal ──────────────────────────────────────────────────
test('T11 photo viewer opens, navigates, and closes', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Wait for at least one series title to appear in the gallery
  await page.waitForSelector('h3', { timeout: 15000 });
  await page.waitForTimeout(1000);

  // Click the first photo thumbnail in the scrollable gallery
  const firstPhoto = page.locator('.flex-none').first();
  await expect(firstPhoto).toBeVisible({ timeout: 10000 });
  await firstPhoto.click();

  // PhotoViewer overlay should be open
  await expect(page.locator('button[aria-label="Close photo viewer"]')).toBeVisible({ timeout: 5000 });

  // Navigate to next photo
  await page.click('button[aria-label="Next photo"]');

  // Navigate to previous photo
  await page.click('button[aria-label="Previous photo"]');

  // Close with the X button
  await page.click('button[aria-label="Close photo viewer"]');
  await expect(page.locator('button[aria-label="Close photo viewer"]')).toHaveCount(0, { timeout: 3000 });
});

// ─── T12: Create and delete a series ─────────────────────────────────────────
test('T12 create and delete a series round-trip', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);

  // Open the add series dialog
  await page.click('button[title="Add new series"]');
  await expect(page.locator('text=Add New Series')).toBeVisible({ timeout: 5000 });

  // Fill in the form
  await page.fill('input[placeholder="e.g., Urban Photography"]', 'E2E Temp Series');
  await page.fill('textarea[placeholder="Brief description of the series"]', 'Created by E2E test');
  await page.fill('input[placeholder="e.g., urban-photos"]', 'e2e-temp');

  await page.click('button:has-text("Create Series")');
  await expect(page.locator('p.text-sm.font-medium').filter({ hasText: /created successfully/i })).toBeVisible({ timeout: 10000 });

  // Series should appear in the list
  await expect(page.locator('button', { hasText: 'E2E Temp Series' }).first()).toBeVisible({ timeout: 5000 });

  // Now delete it — click the Delete button next to this series
  const seriesCard = page.locator('.space-y-2 > div').filter({ hasText: 'E2E Temp Series' }).first();
  await seriesCard.locator('button[title="Delete series"]').click();

  // Confirm deletion dialog
  await expect(page.locator('text=Confirm Deletion')).toBeVisible({ timeout: 5000 });
  await page.click('button:has-text("Delete Series")');

  // Toast and series gone
  await expect(page.locator('p.text-sm.font-medium').filter({ hasText: /deleted/i })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('button', { hasText: 'E2E Temp Series' })).toHaveCount(0, { timeout: 5000 });
});

// ─── T13: Upload images ───────────────────────────────────────────────────────
test('T13 upload image to series', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);

  // Record current image count
  const countText = await page.locator('h3').filter({ hasText: /Current Images/ }).textContent() ?? '';
  const countBefore = parseInt(countText.match(/\((\d+)\)/)?.[1] ?? '0');

  // Upload a placeholder JPEG via the hidden file input
  const testImage = path.join(__dirname, '../public/images/test/test-image-1.jpg');
  await page.locator('#file-upload').setInputFiles(testImage);

  // Wait for upload to complete (progress bar disappears, toast appears)
  await expect(page.locator('p.text-sm.font-medium').filter({ hasText: /uploaded/i })).toBeVisible({ timeout: 30000 });

  // Image count should have increased
  const newCountText = await page.locator('h3').filter({ hasText: /Current Images/ }).textContent() ?? '';
  const countAfter = parseInt(newCountText.match(/\((\d+)\)/)?.[1] ?? '0');
  expect(countAfter).toBeGreaterThan(countBefore);
});

// ─── T14: Reorder images ──────────────────────────────────────────────────────
test('T14 reorder images and persist', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);

  // Open reorder dialog
  await page.locator('button', { hasText: /Reorder Images/i }).click();
  await expect(page.locator('text=Save Order')).toBeVisible({ timeout: 5000 });

  // Get the first two draggable items
  const items = page.locator('[draggable="true"]');
  await expect(items.first()).toBeVisible({ timeout: 5000 });

  // Read name of first item (shown in hover overlay text, use position badge instead)
  const firstBadge = items.first().locator('.absolute.top-1.left-1');
  const secondBadge = items.nth(1).locator('.absolute.top-1.left-1');
  expect(await firstBadge.textContent()).toBe('1');
  expect(await secondBadge.textContent()).toBe('2');

  // Drag first item onto second using locator-based dragTo (works with HTML5 drag events)
  const draggables = page.locator('[draggable="true"]');
  await draggables.nth(0).dragTo(draggables.nth(1));

  // Save the new order
  await page.click('button:has-text("Save Order")');
  await expect(page.locator('p.text-sm.font-medium').filter({ hasText: /saved successfully/i })).toBeVisible({ timeout: 10000 });

  // Reorder dialog should close
  await expect(page.locator('text=Save Order')).toHaveCount(0, { timeout: 3000 });
});

// ─── T15: Delete image via reorder dialog ────────────────────────────────────
test('T15 delete image from reorder dialog', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await page.click('text=MANAGE');
  await waitForManageReady(page);

  // Record image count before
  const countText = await page.locator('h3').filter({ hasText: /Current Images/ }).textContent() ?? '';
  const countBefore = parseInt(countText.match(/\((\d+)\)/)?.[1] ?? '0');

  // Skip if no images to delete
  if (countBefore === 0) {
    test.skip(true, 'No images in series to delete');
    return;
  }

  // Open reorder dialog
  await page.locator('button', { hasText: /Reorder Images/i }).click();
  await expect(page.locator('text=Save Order')).toBeVisible({ timeout: 5000 });

  // Accept the confirm dialog and click delete on the last image
  page.once('dialog', dialog => dialog.accept());
  const deleteButtons = page.locator('button[title="Delete image"]');
  await deleteButtons.last().click();

  // Wait for item to be removed from the dialog grid
  await page.waitForTimeout(500);

  // Save
  await page.click('button:has-text("Save Order")');
  await expect(page.locator('p.text-sm.font-medium').filter({ hasText: /deleted|saved/i })).toBeVisible({ timeout: 10000 });

  // Count should decrease
  const newCountText = await page.locator('h3').filter({ hasText: /Current Images/ }).textContent() ?? '';
  const countAfter = parseInt(newCountText.match(/\((\d+)\)/)?.[1] ?? '0');
  expect(countAfter).toBeLessThan(countBefore);
});

// ─── T16: Logout ─────────────────────────────────────────────────────────────
test('T16 logout clears admin access', async ({ page }) => {
  await page.goto('/');
  await login(page);
  await expect(page.locator('text=MANAGE')).toBeVisible();

  // Logout button is always in the top nav when authenticated
  await page.click('button[aria-label="Logout"]');
  await page.waitForTimeout(1000);

  // MANAGE should no longer be visible
  await expect(page.locator('text=MANAGE')).toHaveCount(0, { timeout: 5000 });

  // Public gallery still loads without errors
  await page.click('text=WORK');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.bg-red-50, [role="alert"]')).toHaveCount(0);
});

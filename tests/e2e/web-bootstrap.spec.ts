import { test, expect } from '@playwright/test';
import { seed } from '../../lib/client/demo';

test('la Home arriva prima delle sezioni, con riprova se il caricamento fallisce', async ({
  page,
}) => {
  const data = seed();
  let home = 0;
  let full = 0;
  await page.route('**/api/bootstrap**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('home') === '1') {
      home++;
      await route.fulfill({ json: { ...data, messages: [], events: [], reports: [] } });
    } else {
      full++;
      if (full === 1) await route.fulfill({ status: 503, json: { error: 'Riprova la sezione' } });
      else await route.fulfill({ json: data });
    }
  });
  await page.route('**/api/chat/device', (route) => route.fulfill({ json: { ok: true } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Home.' })).toBeVisible();
  expect(home).toBeGreaterThanOrEqual(1);
  expect(full).toBe(0);
  const messages = page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .first();
  await messages.click();
  await expect(page.getByText('Riprova la sezione')).toBeVisible();
  await messages.click();
  await expect(page.getByRole('heading', { name: 'Messaggi.' })).toBeVisible();
  expect(full).toBe(2);
});

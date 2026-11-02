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

test('il salvataggio risponde subito e torna allo stato precedente se fallisce', async ({
  page,
}) => {
  const data = seed();
  await page.route('**/api/bootstrap**', (route) => route.fulfill({ json: data }));
  await page.route('**/api/action**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ status: 503, json: { error: 'Salvataggio non riuscito' } });
  });
  await page.goto('/');
  const save = page.getByRole('button', { name: 'Salva post' }).first();
  await expect(save).toBeVisible();
  await save.click();
  await expect(page.getByRole('button', { name: 'Rimuovi dai salvati' }).first()).toBeVisible({
    timeout: 750,
  });
  await expect(page.getByText('Salvataggio non riuscito')).toBeVisible();
  await expect(save).toBeVisible();
});

test('la pagina precedente non annulla un mi piace inserito durante il caricamento', async ({
  page,
}) => {
  const data = seed();
  data.nextCursor = new Date().toISOString();
  await page.route('**/api/bootstrap**', (route) => route.fulfill({ json: data }));
  await page.route('**/api/posts?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ json: { posts: [], nextCursor: null } });
  });
  await page.route('**/api/action**', (route) => route.fulfill({ json: { ok: true } }));
  await page.goto('/');
  const like = page.getByRole('button', { name: 'Mi piace', exact: true }).first();
  await expect(like).toBeVisible();
  await page.getByRole('button', { name: 'Carica post precedenti' }).click();
  await like.click();
  await expect(page.getByRole('button', { name: 'Togli mi piace' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Caricamento…' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Togli mi piace' }).first()).toBeVisible();
});

import { test, expect } from '@playwright/test';
test('demo: pubblicazione, commento, persistenza e ricerca', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const external: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:3100'))
      external.push(r.url());
  });
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'La tua piazza.' })).toBeVisible();
  await page.getByRole('button', { name: 'Che cosa vuoi raccontare?' }).click();
  await page.getByLabel('Testo del post').fill('Ci vediamo al parco #amici');
  await page.getByRole('button', { name: 'Pubblica', exact: true }).click();
  const post = page.locator('article').filter({ hasText: 'Ci vediamo al parco' });
  await expect(post).toBeVisible();
  await post.getByRole('button', { name: 'Mi piace', exact: true }).click();
  await expect(post.getByRole('button', { name: 'Togli mi piace' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await post.getByRole('button', { name: 'Commenti', exact: true }).click();
  await post.getByLabel('Scrivi un commento').fill('Arrivo alle sei.');
  await post.getByRole('button', { name: 'Invia commento' }).click();
  await expect(post.getByText('Arrivo alle sei.')).toBeVisible();
  await page.reload();
  await expect(page.locator('article').filter({ hasText: 'Ci vediamo al parco' })).toBeVisible();
  await page
    .locator('article')
    .filter({ hasText: 'Ci vediamo al parco' })
    .getByRole('button', { name: '#amici', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Esplora.' })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('storie: dialogo accessibile e chiusura con Escape', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('privacy, esportazione demo e modifica del profilo', async ({ page, isMobile }) => {
  await page.goto('/demo');
  await page
    .getByRole('button', { name: 'Impostazioni', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByLabel('Nome visualizzato').fill('Francesco Test');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByRole('status')).toContainText('Profilo aggiornato');
  await page.reload();
  await page
    .getByRole('button', { name: 'Impostazioni', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByLabel('Nome visualizzato')).toHaveValue('Francesco Test');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Esporta i miei dati' }).click();
  expect((await download).suggestedFilename()).toBe('sn-dati.json');
  if (isMobile)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy e regole della beta' })).toBeVisible();
});
test('messaggi: invio nella demo e nessuna risposta simulata', async ({ page }) => {
  await page.goto('/demo');
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Scrivi un messaggio' })
    .fill('Prova di un messaggio reale nella demo');
  await page.getByRole('button', { name: 'Invia messaggio', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Prova di un messaggio reale nella demo');
  await expect(page.locator('.chat-bubble')).toHaveCount(2);
});
test('API: nessun accesso anonimo, CSRF respinto e federazione chiusa', async ({ request }) => {
  const bootstrap = await request.get('/api/bootstrap');
  expect([401, 503]).toContain(bootstrap.status());
  const action = await request.post('/api/action', {
    data: { type: 'read-notifications' },
    headers: { Origin: 'https://attacker.example' },
  });
  expect(action.status()).toBe(403);
  expect(
    (await request.get('/.well-known/webfinger?resource=acct:fra@example.test')).status(),
  ).toBe(503);
  expect((await request.post('/ap/actors/test/inbox', { data: { type: 'Follow' } })).status()).toBe(
    503,
  );
  const page = await request.get('/demo');
  expect(page.headers()['content-security-policy']).toContain("'strict-dynamic'");
  expect(page.headers()['x-frame-options']).toBe('DENY');
});

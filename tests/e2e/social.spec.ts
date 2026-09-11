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
test('storie: autoplay finito, pausa, avanti e indietro', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Giulia Rossi' }),
  ).toBeVisible();
  await expect(page.locator('.story-stage img')).toBeVisible();
  await page.getByRole('button', { name: 'Metti in pausa la storia' }).click();
  await page.clock.install();
  await page.clock.runFor(5500);
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Giulia Rossi' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Riprendi storia' }).click();
  await page.clock.runFor(5100);
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Marco Bianchi' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Storia precedente' }).press('Enter');
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Giulia Rossi' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Storia successiva' }).press('Enter');
  await page.getByRole('button', { name: 'Storia successiva' }).press('Enter');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Sara Conti' })).toBeVisible();
  await page.getByRole('button', { name: 'Storia successiva' }).press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('storie: tenere premuto sospende il timer senza avanzare al rilascio', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  const zone = page.getByRole('button', { name: 'Storia successiva' });
  const box = await zone.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(page.getByText('In pausa', { exact: true })).toBeVisible();
  await page.clock.install();
  await page.clock.runFor(6000);
  await page.mouse.up();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Giulia Rossi' }),
  ).toBeVisible();
  await expect(page.getByText('In pausa', { exact: true })).not.toBeVisible();
});
test('feed calmo: like senza contatori pubblici e traguardo finale', async ({ page }) => {
  await page.goto('/demo');
  const card = page.locator('article').first();
  await expect(card.getByRole('button', { name: 'Mi piace', exact: true })).toHaveText('Mi piace');
  await expect(card.locator('.author-interactions')).toHaveCount(0);
  await expect(page.getByText('Sei in pari.', { exact: false })).toBeVisible();
});
test('storie: sequenza completa dello stesso autore e segmenti separati', async ({ page }) => {
  await page.goto('/demo');
  const png = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#796097';
      context.fillRect(0, 0, 8, 8);
      return canvas.toDataURL('image/png').split(',')[1];
    }),
    'base64',
  );
  for (const body of ['Prima storia di prova', 'Seconda storia di prova']) {
    await page.getByRole('button', { name: 'La tua storia', exact: true }).click();
    await page.getByLabel('Testo del post').fill(body);
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: png });
    await page.getByLabel('Descrivi il contenuto').fill('Pixel per il test della storia');
    await page.getByRole('button', { name: 'Pubblica', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  await page.getByRole('button', { name: 'Francesco', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Prima storia di prova')).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(2);
  await page.getByRole('button', { name: 'Storia successiva' }).press('Enter');
  await expect(page.getByRole('dialog').getByText('Seconda storia di prova')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Storia 1 di 2' })).toHaveAttribute(
    'value',
    '1',
  );
});
test('storie video: autoplay e passaggio al prossimo autore a fine media', async ({ page }) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'La tua storia', exact: true }).click();
  await page.getByLabel('Testo del post').fill('Video di prova');
  await page.locator('input[type=file]').setInputFiles('tests/fixtures/story.webm');
  await page.getByRole('button', { name: 'Pubblica', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Francesco', exact: true }).click();
  await expect(page.locator('.story-stage video')).toBeVisible();
  await page.getByRole('button', { name: 'Metti in pausa la storia' }).click();
  await expect
    .poll(() => page.locator('.story-stage video').evaluate((v: HTMLVideoElement) => v.paused))
    .toBe(true);
  await page.getByRole('button', { name: 'Riprendi storia' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Giulia Rossi' })).toBeVisible(
    { timeout: 7000 },
  );
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
test('chat: allegato senza testo, scadenza e pulizia locale dopo riapertura', async ({ page }) => {
  await page.goto('/demo');
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await page.getByRole('button', { name: 'Impostazioni della chat', exact: true }).click();
  await page.getByLabel('Scadenza dei messaggi').selectOption('3600');
  await page.getByRole('button', { name: 'Impostazioni della chat', exact: true }).click();
  await page.getByRole('button', { name: 'Chat temporanea disattivata', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Chat temporanea attiva', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    canvas.getContext('2d')!.fillRect(0, 0, 20, 20);
    return canvas.toDataURL().split(',')[1];
  });
  await page
    .getByLabel('Allega alla chat')
    .setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByAltText('Anteprima allegato')).toBeVisible();
  await page.getByRole('button', { name: 'Invia messaggio', exact: true }).click();
  await expect(
    page.getByRole('log').getByRole('img', { name: 'Immagine nella chat' }),
  ).toBeVisible();
  await expect(page.getByRole('log')).toContainText('Scade tra');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('sn-demo', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('state', 'readwrite');
        const store = tx.objectStore('state');
        const get = store.get('snapshot');
        get.onsuccess = () => {
          const s = get.result;
          for (const m of s.messages) if (m.media_path) m.expires_at = '2020-01-01T00:00:00Z';
          store.put(s, 'snapshot');
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await expect(page.getByRole('log').getByRole('img', { name: 'Immagine nella chat' })).toHaveCount(
    0,
  );
  const attachments = await page.evaluate(
    async () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('sn-demo', 1);
        req.onsuccess = () => {
          const db = req.result;
          const get = db.transaction('state').objectStore('state').get('snapshot');
          get.onsuccess = () => {
            resolve(
              get.result.messages.filter((m: { media_path: string | null }) => m.media_path).length,
            );
            db.close();
          };
        };
      }),
  );
  expect(attachments).toBe(0);
});
test('chat: impedisce l’invio a chi non ricambia il follow', async ({ page }) => {
  await page.goto('/demo');
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Sara', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Invia messaggio', exact: true })).toHaveCount(0);
  await expect(
    page.getByText('Potete scrivervi quando vi seguite a vicenda.', { exact: false }),
  ).toBeVisible();
});
test('chat cifrata: testo opaco in IndexedDB, chiave non esportabile e lettura dopo reload', async ({
  page,
}) => {
  await page.goto('/demo');
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Scrivi un messaggio' })
    .fill('Segreto del browser 92831');
  await page.getByRole('button', { name: 'Invia messaggio', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Segreto del browser 92831');
  const stored = await page.evaluate(async () => {
    const read = (database: string, store: string, key: string) =>
      new Promise<{ me: { id: string }; messages: { body: string }[]; privateKey: CryptoKey }>(
        (resolve) => {
          const req = indexedDB.open(database);
          req.onsuccess = () => {
            const db = req.result;
            const get = db.transaction(store).objectStore(store).get(key);
            get.onsuccess = () => {
              resolve(get.result);
              db.close();
            };
          };
        },
      );
    const state = await read('sn-demo', 'state', 'snapshot');
    const device = await read('sn-chat', 'keys', 'demo:' + state.me.id);
    return {
      body: state.messages.at(-1)!.body,
      ciphertext: JSON.stringify(state.messages.at(-1)),
      extractable: device.privateKey.extractable,
    };
  });
  expect(stored.body).toBe('');
  expect(stored.ciphertext).not.toContain('Segreto del browser');
  expect(stored.extractable).toBe(false);
  await page.reload();
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Segreto del browser 92831');
});
test('chat cifrata: cambio chiave blocca nuovi invii finché i codici non sono approvati', async ({
  page,
}) => {
  await page.goto('/demo');
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await page.getByRole('textbox', { name: 'Scrivi un messaggio' }).fill('Prova');
  await expect(page.getByRole('button', { name: 'Invia messaggio', exact: true })).toBeEnabled();
  await page.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('sn-chat', 1);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('keys', 'readwrite');
          tx.objectStore('keys').delete('demo:00000000-0000-4000-8000-000000000002');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await expect(
    page.getByText('I browser autorizzati sono cambiati.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'Scrivi un messaggio' }).fill('Dopo verifica');
  await expect(page.getByRole('button', { name: 'Invia messaggio', exact: true })).toBeDisabled();
  await page.getByText('Browser e codici di sicurezza', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Ho confrontato i codici: autorizza questi browser' })
    .click();
  await expect(page.getByRole('button', { name: 'Invia messaggio', exact: true })).toBeEnabled();
});
test('note della comunità: proposta, revisione motivata e post originale conservato', async ({
  page,
}) => {
  await page.goto('/demo');
  const post = page.locator('.post-card').first();
  await post.getByRole('button', { name: 'Aggiungi contesto e fonti' }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Quale contesto manca?')
    .fill('La fonte aggiunge un dettaglio verificabile alla discussione.');
  await dialog.getByLabel('Fonti HTTPS, una per riga').fill('https://example.org/fonte');
  await dialog.getByRole('button', { name: 'Invia alla revisione' }).click();
  await expect(post.getByText('La tua nota è in revisione')).toBeVisible();
  await expect(post.locator('.context-note')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Impostazioni', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Apri moderazione', exact: true }).click();
  const review = page.getByRole('region', { name: 'Revisione note' });
  await expect(review).toContainText('Ho fatto una playlist');
  await review.getByLabel('Motivo della decisione').fill('La fonte è pertinente e verificabile.');
  await review.getByRole('button', { name: 'Salva decisione' }).click();
  await expect(review).toContainText('Nessuna nota in attesa.');
  await page
    .getByRole('button', { name: 'La tua piazza', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator('.context-note')).toContainText(
    'La fonte aggiunge un dettaglio verificabile',
  );
  await expect(page.locator('.post-card').first()).toContainText('Ho fatto una playlist');
  await expect(page.locator('.context-note a')).toHaveAttribute('rel', 'noopener noreferrer');
  await page.reload();
  await expect(page.locator('.context-note')).toBeVisible();
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

test('salvati: raccolta privata nel profilo, persistenza e rimozione', async ({
  page,
}, testInfo) => {
  await page.goto('/demo');
  const post = page.locator('article').first();
  await post.getByRole('button', { name: 'Salva post', exact: true }).click();
  await expect(post.getByRole('button', { name: 'Rimuovi dai salvati' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Il tuo profilo', exact: true }).click();
  await page.getByRole('button', { name: 'Salvati', exact: true }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(
    page.getByText('Solo tu puoi vedere questa raccolta.', { exact: false }),
  ).toBeVisible();
  await page.screenshot({ path: `artifacts/saved-${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Rimuovi dai salvati' }).click();
  await expect(page.locator('article')).toHaveCount(0);
  await expect(page.getByText('Tieni da parte ciò che vuoi ritrovare.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rimuovi dai salvati' })).toHaveCount(0);
  await page
    .locator('article')
    .first()
    .getByRole('button', { name: /Giulia Rossi/ })
    .click();
  await expect(page.getByRole('button', { name: 'Salvati', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('avviso: testo, media e commenti si aprono solo su richiesta', async ({ page }, testInfo) => {
  await page.goto('/demo');
  await page.getByRole('button', { name: 'Che cosa vuoi raccontare?' }).click();
  await page.getByLabel('Testo del post').fill('Il finale è una sorpresa #finale');
  await page.getByLabel('Avviso di contenuto (facoltativo)').fill('Spoiler sul film');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'scena.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await page.getByLabel('Descrivi il contenuto').fill('La scena finale');
  await page.getByRole('button', { name: 'Pubblica', exact: true }).click();
  const post = page.locator('article').filter({ hasText: 'Spoiler sul film' });
  await expect(post).toBeVisible();
  await expect(post.getByText('Il finale è una sorpresa', { exact: false })).toHaveCount(0);
  await expect(post.locator('img')).toHaveCount(0);
  await expect(post.getByRole('button', { name: 'Commenti', exact: true })).toBeDisabled();
  await page.screenshot({ path: `artifacts/warning-${testInfo.project.name}.png`, fullPage: true });
  await post.getByRole('button', { name: 'Mostra contenuto' }).click();
  await expect(post.getByAltText('La scena finale')).toBeVisible();
  await post.getByRole('button', { name: 'Commenti', exact: true }).click();
  await post.getByLabel('Scrivi un commento').fill('Una risposta con spoiler');
  await post.getByRole('button', { name: 'Invia commento' }).click();
  await post.getByRole('button', { name: 'Nascondi contenuto' }).click();
  await expect(post.getByText('Una risposta con spoiler')).toHaveCount(0);
  await expect(post.locator('img')).toHaveCount(0);
  await page.reload();
  await expect(post.getByRole('button', { name: 'Mostra contenuto' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('avviso delle storie: nessun media o autoplay prima della scelta', async ({ page }) => {
  await page.goto('/demo');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'La tua storia', exact: true }).click();
  await page.getByLabel('Testo del post').fill('Dettaglio da scoprire');
  await page.getByLabel('Avviso di contenuto (facoltativo)').fill('Spoiler nella storia');
  await page.locator('input[type=file]').setInputFiles({
    name: 'storia.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await page.getByLabel('Descrivi il contenuto').fill('Immagine protetta da avviso');
  await page.getByRole('button', { name: 'Pubblica', exact: true }).click();
  await page.getByRole('button', { name: 'Francesco', exact: true }).click();
  await expect(page.getByText('Spoiler nella storia')).toBeVisible();
  await expect(page.getByRole('dialog').locator('img,video')).toHaveCount(0);
  await page.clock.install();
  await page.clock.runFor(6000);
  await expect(page.getByText('Spoiler nella storia')).toBeVisible();
  await page.getByRole('button', { name: 'Mostra storia' }).click();
  await expect(page.getByAltText('Immagine protetta da avviso')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Francesco', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mostra storia' })).toBeVisible();
  await page.getByRole('button', { name: 'Salta questa storia' }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Giulia Rossi' }),
  ).toBeVisible();
  await expect(page.getByText('Spoiler nella storia')).toHaveCount(0);
});

test('chat: messaggi permanenti, modifica e due comandi di eliminazione', async ({ page }) => {
  await page.goto('/demo');
  await page
    .getByRole('button', { name: 'Messaggi', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('button', { name: 'Giulia', exact: true }).click();
  await page.getByRole('textbox', { name: 'Scrivi un messaggio' }).fill('Da correggere');
  await page.getByRole('button', { name: 'Invia messaggio', exact: true }).click();
  const own = page.locator('.chat-bubble.own').last();
  await expect(own).toContainText('Da correggere');
  await expect(own).not.toContainText('Scade tra');
  await expect(own.getByRole('img', { name: 'Inviato', exact: true })).toBeVisible();
  await own.locator('summary').click();
  await own.getByRole('button', { name: 'Modifica messaggio', exact: true }).click();
  await page.getByRole('textbox', { name: 'Scrivi un messaggio' }).fill('Corretto');
  await page.getByRole('button', { name: 'Salva modifica', exact: true }).click();
  await expect(own).toContainText('Corretto');
  await expect(own).toContainText('Modificato');
  await own.getByRole('button', { name: 'Elimina per tutti', exact: true }).click();
  await expect(page.getByRole('log')).not.toContainText('Corretto');
  const incoming = page.locator('.chat-bubble').first();
  await incoming.locator('summary').click();
  await expect(
    incoming.getByRole('button', { name: 'Elimina per tutti', exact: true }),
  ).toHaveCount(0);
  await incoming.getByRole('button', { name: 'Elimina per me', exact: true }).click();
  await expect(page.locator('.chat-bubble')).toHaveCount(0);
});

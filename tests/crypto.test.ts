import { describe, it, expect } from 'vitest';
import {
  newDevice,
  seal,
  unseal,
  openAttachment,
  publicDevice,
  type ChatContext,
} from '../lib/crypto/chat';
const context = (): ChatContext => ({
  id: crypto.randomUUID(),
  sender_id: 'alice',
  recipient_id: 'bob',
  expires_at: new Date(Date.now() + 3600000).toISOString(),
  retention: 'synced',
});
describe('Cifratura E2EE con Web Crypto', () => {
  it('cifra per più dispositivi senza esportare le chiavi private', async () => {
    const alice = await newDevice('alice'),
      bob = await newDevice('bob'),
      second = await newDevice('bob'),
      eve = await newDevice('eve');
    expect(alice.privateKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('jwk', alice.privateKey)).rejects.toThrow();
    const ctx = context();
    const packet = await seal(
      alice,
      [alice, bob, second].map(publicDevice),
      ctx,
      'Un messaggio riservato',
    );
    expect(JSON.stringify(packet)).not.toContain('Un messaggio riservato');
    expect(JSON.stringify(packet)).not.toContain('privateKey');
    for (const device of [alice, bob, second])
      expect((await unseal(device, ctx, packet.sealed)).body).toBe('Un messaggio riservato');
    await expect(unseal(eve, ctx, packet.sealed)).rejects.toThrow();
  });
  it('rifiuta manomissioni di testo, partecipanti, scadenza e conservazione', async () => {
    const a = await newDevice('alice'),
      b = await newDevice('bob'),
      ctx = context();
    const { sealed } = await seal(a, [a, b], ctx, 'Ciao');
    await expect(unseal(b, { ...ctx, retention: 'device' }, sealed)).rejects.toThrow();
    await expect(
      unseal(b, { ...ctx, expires_at: new Date(Date.now() + 7200000).toISOString() }, sealed),
    ).rejects.toThrow();
    const changed = structuredClone(sealed);
    changed.ciphertext = (changed.ciphertext[0] === 'A' ? 'B' : 'A') + changed.ciphertext.slice(1);
    await expect(unseal(b, ctx, changed)).rejects.toThrow();
    await expect(unseal(b, { ...ctx, expires_at: '2020-01-01T00:00:00Z' }, sealed)).rejects.toThrow(
      'scaduto',
    );
  });
  it('supporta messaggi permanenti e autentica il numero di revisione', async () => {
    const a = await newDevice('alice'),
      b = await newDevice('bob');
    const ctx = { ...context(), expires_at: null, revision: 1 };
    const { sealed } = await seal(a, [a, b], ctx, 'Permanente');
    expect((await unseal(b, ctx, sealed)).body).toBe('Permanente');
    await expect(unseal(b, { ...ctx, revision: 2 }, sealed)).rejects.toThrow();
  });
  it('cifra gli allegati con chiavi separate e ne verifica integrità e contesto', async () => {
    const a = await newDevice('alice'),
      b = await newDevice('bob'),
      ctx = context();
    const file = new File(['contenuto foto'], 'foto.webp', { type: 'image/webp' });
    const packet = await seal(a, [a, b], ctx, 'Foto', file);
    expect(await packet.attachment!.text()).not.toBe(await file.text());
    const clear = await unseal(b, ctx, packet.sealed);
    expect(
      await (
        await openAttachment(ctx, clear.media!, await packet.attachment!.arrayBuffer())
      ).text(),
    ).toBe(await file.text());
    const bytes = new Uint8Array(await packet.attachment!.arrayBuffer());
    bytes[0] ^= 1;
    await expect(openAttachment(ctx, clear.media!, bytes.buffer)).rejects.toThrow();
  });
});

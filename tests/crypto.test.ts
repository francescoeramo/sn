import { describe, it, expect } from 'vitest';
import {
  newDevice,
  seal,
  unseal,
  openAttachment,
  publicDevice,
  sealGroup,
  unsealGroup,
  type ChatContext,
  type GroupChatContext,
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
  it('cifra un messaggio di gruppo per tutti i dispositivi e autentica i membri', async () => {
    const alice = await newDevice('alice');
    const bob = await newDevice('bob');
    const bobPhone = await newDevice('bob');
    const carla = await newDevice('carla');
    const eve = await newDevice('eve');
    const group: GroupChatContext = {
      id: crypto.randomUUID(),
      sender_id: 'alice',
      group_id: crypto.randomUUID(),
      recipient_ids: ['alice', 'bob', 'carla'],
      expires_at: null,
      revision: 0,
    };
    const packet = await sealGroup(
      alice,
      [alice, bob, bobPhone, carla].map(publicDevice),
      group,
      'Ci vediamo alle otto',
    );
    for (const device of [alice, bob, bobPhone, carla])
      expect((await unsealGroup(device, group, packet)).body).toBe('Ci vediamo alle otto');
    await expect(unsealGroup(eve, group, packet)).rejects.toThrow();
    await expect(
      unsealGroup(bob, { ...group, recipient_ids: ['alice', 'bob'] }, packet),
    ).rejects.toThrow();
  });

  it('rifiuta gruppi non ordinati, dispositivi estranei e membri senza chiavi', async () => {
    const alice = await newDevice('alice');
    const bob = await newDevice('bob');
    const eve = await newDevice('eve');
    const group: GroupChatContext = {
      id: crypto.randomUUID(),
      sender_id: 'alice',
      group_id: crypto.randomUUID(),
      recipient_ids: ['bob', 'alice'],
      expires_at: null,
    };
    await expect(sealGroup(alice, [alice, bob], group, 'Ciao')).rejects.toThrow();
    group.recipient_ids.sort();
    await expect(sealGroup(alice, [alice], group, 'Ciao')).rejects.toThrow();
    await expect(sealGroup(alice, [alice, bob, eve], group, 'Ciao')).rejects.toThrow();
  });
});

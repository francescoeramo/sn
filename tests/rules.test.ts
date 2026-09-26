import { describe, it, expect } from 'vitest';
import {
  fileKind,
  hashtags,
  isActive,
  postInput,
  messageInput,
  noteInput,
  localMediaInfo,
  passwordResetRequest,
  passwordUpdate,
  mfaAction,
  chatGroupActionInput,
  encryptedGroupMessageInput,
  digestPreferenceInput,
  digestSourceInput,
} from '../lib/core/rules';
import { applyDemo, buildDemoDigest, seed } from '../lib/client/demo';
describe('Regole condivise', () => {
  it('valida le azioni di gestione dei gruppi', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    const create = chatGroupActionInput.parse({ action: 'create', name: '  Fine settimana ' });
    expect(create.action === 'create' && create.name).toBe('Fine settimana');
    expect(
      chatGroupActionInput.safeParse({ action: 'role', groupId: id, userId: id, role: 'owner' })
        .success,
    ).toBe(false);
  });
  it('rifiuta contesti cifrati di gruppo ambigui', () => {
    const alice = '00000000-0000-4000-8000-000000000001';
    const bob = '00000000-0000-4000-8000-000000000002';
    const id = '10000000-0000-4000-8000-000000000001';
    const group = '20000000-0000-4000-8000-000000000001';
    const packet = {
      version: 2,
      context: {
        id,
        sender_id: alice,
        group_id: group,
        recipient_ids: [alice, bob],
        expires_at: null,
      },
      sender: {
        id: '30000000-0000-4000-8000-000000000001',
        user_id: alice,
        label: 'Browser',
        public_key: { kty: 'EC', crv: 'P-256', x: 'a'.repeat(43), y: 'b'.repeat(43) },
      },
      salt: 'a'.repeat(43) + '=',
      iv: 'a'.repeat(15) + '=',
      ciphertext: 'a'.repeat(20),
      keys: {
        '30000000-0000-4000-8000-000000000001': {
          iv: 'a'.repeat(15) + '=',
          ciphertext: 'a'.repeat(63) + '=',
        },
        '30000000-0000-4000-8000-000000000002': {
          iv: 'a'.repeat(15) + '=',
          ciphertext: 'a'.repeat(63) + '=',
        },
      },
    };
    expect(
      encryptedGroupMessageInput.safeParse({ id, group_id: group, encrypted: packet }).success,
    ).toBe(true);
    expect(
      encryptedGroupMessageInput.safeParse({
        id,
        group_id: group,
        encrypted: { ...packet, context: { ...packet.context, recipient_ids: [bob, alice] } },
      }).success,
    ).toBe(false);
    expect(
      encryptedGroupMessageInput.safeParse({ id, group_id: alice, encrypted: packet }).success,
    ).toBe(false);
  });
  it('la demo accetta allegati locali oltre 200 caratteri senza allargare le API', () => {
    const media = 'data:image/webp;base64,' + 'AAAA'.repeat(100);
    const next = applyDemo(seed(), {
      type: 'post',
      body: 'Foto',
      kind: 'story',
      media_path: media,
      alt: 'Prova',
    });
    expect(next.posts[0].media_path).toBe(media);
    expect(
      postInput.safeParse({ body: 'Foto', kind: 'post', media_path: media, alt: '' }).success,
    ).toBe(false);
  });
  it('la demo rifiuta URL remoti e allegati oltre quota', () => {
    expect(() =>
      applyDemo(seed(), {
        type: 'post',
        body: 'Foto',
        kind: 'post',
        media_path: 'https://example.com/photo.jpg',
        alt: '',
      }),
    ).toThrow('3 MB');
    expect(() =>
      applyDemo(seed(), {
        type: 'post',
        body: 'Foto',
        kind: 'post',
        media_path: 'data:image/webp;base64,' + 'AAAA'.repeat(1024 * 1024 + 1),
        alt: '',
      }),
    ).toThrow('3 MB');
  });
  it('richiede un consenso separato per la federazione dei profili pubblici', () => {
    const state = seed();
    expect(state.me.federation_enabled).toBe(false);
    const enabled = applyDemo(state, { type: 'federation', enabled: true });
    expect(enabled.me.federation_enabled).toBe(true);
    const privateProfile = applyDemo(enabled, {
      type: 'profile',
      display_name: enabled.me.display_name,
      bio: enabled.me.bio,
      is_private: true,
    });
    expect(privateProfile.me.federation_enabled).toBe(false);
    expect(() => applyDemo(privateProfile, { type: 'federation', enabled: true })).toThrow(
      'Rendi pubblico',
    );
  });
  it('la demo sospende e ripristina gli account senza toccare i moderatori', () => {
    const state = seed();
    const target = state.moderationAccounts![1];
    const suspended = applyDemo(state, {
      type: 'moderate-account',
      user_id: target.id,
      disabled: true,
      reason: 'Violazione verificata delle regole.',
    });
    expect(suspended.moderationAccounts![1].disabled).toBe(true);
    expect(suspended.moderationAudit![0].action).toBe('account_suspended');
    const restored = applyDemo(suspended, {
      type: 'moderate-account',
      user_id: target.id,
      disabled: false,
      reason: 'Verifica completata, accesso ripristinato.',
    });
    expect(restored.moderationAccounts![1].disabled).toBe(false);
    expect(restored.moderationAudit![0].action).toBe('account_restored');
    expect(() =>
      applyDemo(restored, {
        type: 'moderate-account',
        user_id: restored.me.id,
        disabled: true,
        reason: 'Tentativo non consentito.',
      }),
    ).toThrow('Accesso negato');
  });
  it('accetta le sei durate temporanee e conserva i messaggi ordinari', () => {
    const input = { user_id: seed().profiles[1].id, body: 'Ciao' };
    expect(messageInput.parse(input).ttl).toBe(0);
    for (const ttl of [42, -1, null, 2592001])
      expect(messageInput.safeParse({ ...input, ttl }).success).toBe(false);
  });
  it('valida sondaggi con opzioni distinte e scadenze limitate', () => {
    const base = {
      body: 'Dove andiamo?',
      kind: 'post' as const,
      media_path: null,
      alt: '',
      poll: { options: ['Mare', 'Montagna'], duration: 86400 as const },
    };
    expect(postInput.safeParse(base).success).toBe(true);
    expect(
      postInput.safeParse({ ...base, poll: { options: ['Mare', 'mare'], duration: null } }).success,
    ).toBe(false);
    expect(
      postInput.safeParse({ ...base, poll: { options: ['Una sola'], duration: null } }).success,
    ).toBe(false);
  });
  it('valida recupero e conferma della nuova password', () => {
    expect(passwordResetRequest.safeParse({ email: 'persona@example.test' }).success).toBe(true);
    expect(passwordResetRequest.safeParse({ email: 'non-valida' }).success).toBe(false);
    expect(
      passwordUpdate.safeParse({
        password: 'una-password-lunga',
        confirmation: 'una-password-lunga',
      }).success,
    ).toBe(true);
    expect(
      passwordUpdate.safeParse({
        password: 'una-password-lunga',
        confirmation: 'password-diversa',
      }).success,
    ).toBe(false);
  });
  it('accetta solo azioni MFA e codici TOTP validi', () => {
    const factorId = '00000000-0000-4000-8000-000000000001';
    expect(mfaAction.safeParse({ action: 'enroll' }).success).toBe(true);
    expect(mfaAction.safeParse({ action: 'verify', factorId, code: '123456' }).success).toBe(true);
    expect(mfaAction.safeParse({ action: 'verify', factorId, code: '12345a' }).success).toBe(false);
    expect(mfaAction.safeParse({ action: 'unenroll', factorId: 'non-valido' }).success).toBe(false);
  });
  it('i messaggi demo supportano audio e scadenza senza fidarsi del MIME dichiarato', () => {
    const s = seed();
    const next = applyDemo(s, {
      type: 'message',
      user_id: s.profiles[1].id,
      body: '',
      media_path: 'data:audio/webm;base64,AAAA',
      media_type: 'image/png',
      ttl: 3600,
    });
    const message = next.messages.at(-1)!;
    expect(message.media_type).toBe('audio/webm');
    expect(Date.parse(message.expires_at!) - Date.parse(message.created_at)).toBe(3600000);
    expect(next.usage.bytes).toBe(3);
    expect(() => localMediaInfo('data:audio/webm;base64,AAAA')).toThrow();
  });
  it('rimuove dalla demo i messaggi scaduti con i loro allegati', () => {
    const s = seed();
    s.messages[0].expires_at = '2020-01-01T00:00:00Z';
    const next = applyDemo(s, { type: 'read-notifications' });
    expect(next.messages).toHaveLength(0);
  });
  it('le note richiedono fonti HTTPS e restano nascoste fino alla revisione', () => {
    const state = seed(),
      input = {
        post_id: state.posts[0].id,
        body: 'Questa affermazione richiede più contesto.',
        sources: ['https://example.org/fonte'],
      };
    for (const sources of [
      [],
      ['javascript:alert(1)'],
      ['https://user:pass@example.org'],
      ['http://example.org'],
    ])
      expect(noteInput.safeParse({ ...input, sources }).success).toBe(false);
    const proposed = applyDemo(state, { type: 'propose-note', ...input });
    expect(proposed.notes[0].status).toBe('pending');
    expect(proposed.posts).toEqual(state.posts);
    expect(() =>
      applyDemo(
        { ...proposed, isAdmin: false },
        {
          type: 'review-note',
          note_id: proposed.notes[0].id,
          approve: true,
          reason: 'Fonte verificata e pertinente.',
        },
      ),
    ).toThrow('Accesso negato');
    const approved = applyDemo(proposed, {
      type: 'review-note',
      note_id: proposed.notes[0].id,
      approve: true,
      reason: 'Fonte verificata e pertinente.',
    });
    expect(approved.notes[0].status).toBe('approved');
    expect(approved.posts).toEqual(state.posts);
    expect(() =>
      applyDemo(approved, {
        type: 'review-note',
        note_id: approved.notes[0].id,
        approve: false,
        reason: 'Cambio non ammesso.',
      }),
    ).toThrow('già esaminata');
  });
  it('la demo registra le decisioni del moderatore', () => {
    const state = seed();
    const report = applyDemo(state, {
      type: 'report',
      post_id: state.posts[0].id,
      reason: 'Contenuto da verificare.',
    });
    const reviewed = applyDemo(report, {
      type: 'moderate',
      report_id: report.reports[0].id,
      remove: false,
    });
    expect(reviewed.moderationAudit).toMatchObject([
      { action: 'report_dismissed', target_type: 'report', target_id: report.reports[0].id },
    ]);
  });
  it('estrae hashtag italiani senza duplicati', () =>
    expect(hashtags('Ciao #caffè #Musica #musica')).toEqual(['caffè', 'musica']));
  it('rifiuta SVG e HTML negli upload', () => {
    expect(fileKind('image/svg+xml')).toBeNull();
    expect(fileKind('text/html')).toBeNull();
  });
  it('rende invisibili le storie esattamente alla scadenza', () =>
    expect(
      isActive({ expires_at: '2026-01-01T00:00:00Z' }, Date.parse('2026-01-01T00:00:00Z')),
    ).toBe(false));
  it('rifiuta post vuoti e storie senza allegato', () => {
    expect(
      postInput.safeParse({ body: ' ', kind: 'post', media_path: null, alt: '' }).success,
    ).toBe(false);
    expect(
      postInput.safeParse({ body: 'Ciao', kind: 'story', media_path: null, alt: '' }).success,
    ).toBe(false);
  });
  it('la demo conserva il post originale quando si aggiunge un like', () => {
    const state = seed();
    const next = applyDemo(state, { type: 'like', post_id: state.posts[0].id });
    expect(next.likes).toHaveLength(state.likes.length + 1);
    expect(next.posts).toEqual(state.posts);
    expect(state.likes).toHaveLength(3);
  });
  it('la demo richiede follow reciproco per inviare messaggi', () => {
    const s = seed();
    expect(() =>
      applyDemo(s, { type: 'message', user_id: s.profiles[4].id, body: 'Ciao' }),
    ).toThrow('a vicenda');
  });
  it('il blocco interrompe entrambi i follow', () => {
    const s = seed();
    const next = applyDemo(s, { type: 'block', user_id: s.profiles[1].id });
    expect(
      next.follows.some(
        (f) => f.follower_id === s.profiles[1].id || f.following_id === s.profiles[1].id,
      ),
    ).toBe(false);
  });
});

describe('Salvataggi e avvisi nella demo', () => {
  it('salva senza duplicati o notifiche, rimuove senza toccare il post', () => {
    const state = seed();
    const action = { type: 'bookmark' as const, post_id: state.posts[0].id, saved: true };
    const saved = applyDemo(applyDemo(state, action), action);
    expect(saved.bookmarks).toHaveLength(1);
    expect(saved.notifications).toEqual(state.notifications);
    const removed = applyDemo(saved, { ...action, saved: false });
    expect(removed.bookmarks).toHaveLength(0);
    expect(removed.posts).toEqual(state.posts);
  });
  it('nega salvataggi senza accesso, di storie e di post scaduti', () => {
    const state = seed();
    const action = { type: 'bookmark' as const, post_id: state.posts[0].id, saved: true };
    state.profiles[1].is_private = true;
    state.follows = [];
    expect(() => applyDemo(state, action)).toThrow('non disponibile');
    state.profiles[1].is_private = false;
    state.posts[0].expires_at = new Date(0).toISOString();
    expect(() => applyDemo(state, action)).toThrow('non disponibile');
    expect(() =>
      applyDemo(state, { ...action, post_id: state.posts.find((p) => p.kind === 'story')!.id }),
    ).toThrow('non disponibile');
  });
  it('conserva l’avviso e respinge input troppo lunghi senza perdere la bozza', () => {
    const state = seed();
    const action = {
      type: 'post' as const,
      body: 'Il finale',
      kind: 'post' as const,
      media_path: null,
      alt: '',
      content_warning: ' Spoiler ',
    };
    expect(applyDemo(state, action).posts[0].content_warning).toBe('Spoiler');
    expect(() => applyDemo(state, { ...action, content_warning: 'x'.repeat(161) })).toThrow();
    expect(state.posts).toHaveLength(7);
  });
});
describe('Post collaborativi e album condivisi', () => {
  const giulia = '00000000-0000-4000-8000-000000000002';
  const andrea = '00000000-0000-4000-8000-000000000005';
  it('valida inviti, chiusura dell’album e un solo media per elemento', () => {
    let state = applyDemo(seed(), {
      type: 'post',
      body: 'Collaboriamo',
      kind: 'post',
      media_path: null,
      alt: '',
    });
    const postId = state.posts[0].id;
    expect(() =>
      applyDemo(state, { type: 'invite-collaborator', post_id: postId, user_id: giulia }),
    ).toThrow('Invito non disponibile');
    state = applyDemo(state, { type: 'open-collaboration', post_id: postId });
    expect(() =>
      applyDemo(state, { type: 'invite-collaborator', post_id: postId, user_id: andrea }),
    ).toThrow('Invito non disponibile');
    state = applyDemo(state, { type: 'invite-collaborator', post_id: postId, user_id: giulia });
    const invited = state.collaborators!.filter((item) => item.post_id === postId);
    expect(invited).toHaveLength(1);
    expect(invited[0].status).toBe('invited');
    state = applyDemo(state, {
      type: 'add-album-item',
      post_id: postId,
      media_path: 'data:image/png;base64,AAAA',
      caption: 'Alba',
    });
    expect(state.albumItems!.filter((item) => item.post_id === postId)).toHaveLength(1);
    state = applyDemo(state, { type: 'close-album', post_id: postId });
    expect(
      state.collaborativePosts!.find((item) => item.post_id === postId)!.album_closed_at,
    ).not.toBeNull();
    expect(() =>
      applyDemo(state, {
        type: 'add-album-item',
        post_id: postId,
        media_path: 'data:image/png;base64,BBBB',
        caption: '',
      }),
    ).toThrow('Album non disponibile');
  });
});
describe('Conversazioni più espressive', () => {
  const giulia = '00000000-0000-4000-8000-000000000002';
  it('alterna una sola reazione privata per elemento', () => {
    let state = seed();
    const postId = state.posts[0].id;
    state = applyDemo(state, { type: 'react', target_type: 'post', target_id: postId, emoji: '❤️' });
    expect(state.reactions).toHaveLength(1);
    state = applyDemo(state, { type: 'react', target_type: 'post', target_id: postId, emoji: '👍' });
    expect(state.reactions).toHaveLength(1);
    expect(state.reactions![0].emoji).toBe('👍');
    state = applyDemo(state, { type: 'react', target_type: 'post', target_id: postId, emoji: null });
    expect(state.reactions).toHaveLength(0);
  });
  it('cita il commento di origine e rifiuta risposte fuori contesto', () => {
    let state = seed();
    const postId = state.posts[0].id;
    state = applyDemo(state, { type: 'comment', post_id: postId, body: 'Originale' });
    const parent = state.comments[state.comments.length - 1];
    state = applyDemo(state, {
      type: 'comment',
      post_id: postId,
      body: 'Risposta',
      parent_id: parent.id,
    });
    const reply = state.comments[state.comments.length - 1];
    expect(reply.quote).toBe('Originale');
    expect(reply.parent_id).toBe(parent.id);
    expect(() =>
      applyDemo(state, {
        type: 'comment',
        post_id: state.posts[1].id,
        body: 'Fuori',
        parent_id: parent.id,
      }),
    ).toThrow('Risposta non disponibile');
  });
  it('condivide solo verso destinazioni autorizzate e registra la nota', () => {
    let state = seed();
    const postId = state.posts[0].id;
    expect(() =>
      applyDemo(state, {
        type: 'share',
        target_type: 'post',
        target_id: postId,
        destination_type: 'chat',
        destination_id: '00000000-0000-4000-8000-000000000005',
        note: 'x',
      }),
    ).toThrow('Destinazione non autorizzata');
    state = applyDemo(state, {
      type: 'share',
      target_type: 'post',
      target_id: postId,
      destination_type: 'chat',
      destination_id: giulia,
      note: 'Per te',
    });
    expect(state.shares).toHaveLength(1);
    expect(state.shares![0].note).toBe('Per te');
  });
});
describe('Scoperta intenzionale', () => {
  it('nasconde e riattiva le sezioni spiegate', () => {
    let state = seed();
    state = applyDemo(state, {
      type: 'explore-preference',
      section: 'contacts',
      hidden: true,
    });
    expect(state.explorePreferences).toEqual([
      expect.objectContaining({ section: 'contacts', hidden: true }),
    ]);
    state = applyDemo(state, {
      type: 'explore-preference',
      section: 'contacts',
      hidden: false,
    });
    expect(state.explorePreferences).toHaveLength(1);
    expect(state.explorePreferences![0].hidden).toBe(false);
  });
});
describe('Digest scelto dall’utente', () => {
  const base = {
    enabled: true,
    frequency: 'daily' as const,
    time_slot: 8,
    timezone: 'Europe/Rome' as const,
    channel: 'in_app' as const,
    email_consent: false,
  };
  it('richiede un consenso separato e valori ammessi', () => {
    expect(digestPreferenceInput.safeParse(base).success).toBe(true);
    expect(
      digestPreferenceInput.safeParse({ ...base, channel: 'email', email_consent: false }).success,
    ).toBe(false);
    expect(
      digestPreferenceInput.safeParse({ ...base, channel: 'email', email_consent: true }).success,
    ).toBe(true);
    expect(digestPreferenceInput.safeParse({ ...base, frequency: 'monthly' }).success).toBe(false);
    expect(digestSourceInput.safeParse({ source_type: 'topic', source_id: 'cucina', enabled: true }).success).toBe(true);
    expect(digestSourceInput.safeParse({ source_type: 'topic', source_id: '', enabled: true }).success).toBe(false);
  });
  it('spento di default e ordina cerchie, persone e argomenti con motivo', () => {
    let state = seed();
    expect(buildDemoDigest(state, state.me.id)).toEqual([]);
    state = applyDemo(state, { type: 'digest-preferences', ...base });
    state = applyDemo(state, {
      type: 'digest-source',
      source_type: 'circle',
      source_id: '00000000-0000-4000-8000-000000000501',
      enabled: true,
    });
    state = applyDemo(state, {
      type: 'digest-source',
      source_type: 'topic',
      source_id: 'cucina',
      enabled: true,
    });
    const items = buildDemoDigest(state, state.me.id);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(5);
    expect(items[0].reason).toMatch(/^Cerchia /);
    for (const item of items) expect(item.reason.length).toBeGreaterThan(0);
  });
  it('rigenera lo stesso periodo senza ripetere invii precedenti', () => {
    let state = seed();
    state = applyDemo(state, { type: 'digest-preferences', ...base });
    state = applyDemo(state, {
      type: 'digest-source',
      source_type: 'circle',
      source_id: '00000000-0000-4000-8000-000000000501',
      enabled: true,
    });
    const first = buildDemoDigest(state, state.me.id);
    state = applyDemo(state, { type: 'digest-refresh' });
    const second = applyDemo(state, { type: 'digest-refresh' });
    expect(second.digestDeliveries).toHaveLength(1);
    expect(second.digestDeliveries![0].items).toEqual(first);
  });
});

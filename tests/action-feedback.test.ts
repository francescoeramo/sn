import { describe, expect, it } from 'vitest';
import { actionErrorMessage } from '@/lib/client/action-feedback';
import type { Action } from '@/lib/core/types';

describe('messaggi di errore delle azioni', () => {
  it('sostituisce l’errore generico con una soluzione legata al post', () => {
    const action: Action = {
      type: 'post',
      body: 'Ciao',
      kind: 'post',
      media_path: null,
      alt: '',
    };

    expect(actionErrorMessage(action, new Error('Operazione non riuscita.'))).toBe(
      'Post non pubblicato. Controlla testo, allegato e destinazione.',
    );
  });

  it('conserva un errore già specifico', () => {
    const action: Action = {
      type: 'vote-poll',
      poll_id: crypto.randomUUID(),
      option_id: crypto.randomUUID(),
    };
    expect(actionErrorMessage(action, new Error('Il sondaggio è chiuso.'))).toBe(
      'Il sondaggio è chiuso.',
    );
  });

  it('distingue errori di azioni diverse', () => {
    const follow: Action = { type: 'follow', user_id: crypto.randomUUID() };
    const comment: Action = { type: 'comment', post_id: crypto.randomUUID(), body: 'Ciao' };

    expect(actionErrorMessage(follow, new Error('Failed to fetch'))).toContain('Richiesta');
    expect(actionErrorMessage(comment, new Error('Failed to fetch'))).toContain('Commento');
  });

  it('non mostra i dettagli tecnici di validazione', () => {
    const action: Action = {
      type: 'post',
      body: '',
      kind: 'post',
      media_path: null,
      alt: '',
    };
    const error = Object.assign(new Error('[{"code":"custom"}]'), { name: 'ZodError' });

    expect(actionErrorMessage(action, error)).toBe(
      'Post non pubblicato. Controlla testo, allegato e destinazione.',
    );
  });
});

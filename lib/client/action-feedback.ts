import type { Action } from '@/lib/core/types';

const ACTION_FAILURE: Record<Action['type'], string> = {
  'complete-onboarding': 'Introduzione non chiusa. Riprova.',
  'create-circle': 'Cerchia non creata. Controlla nome e immagine.',
  'invite-circle': 'Invito non inviato. Scegli un contatto reciproco.',
  'respond-circle': 'Risposta non salvata. Riapri l’invito e riprova.',
  'update-circle': 'Cerchia non aggiornata. Controlla nome e immagine.',
  'set-circle-role': 'Ruolo non cambiato. Verifica di essere amministratore.',
  'remove-circle-member': 'Persona non rimossa. Verifica di essere amministratore.',
  'leave-circle': 'Non hai lasciato la cerchia. Assegna prima un altro amministratore.',
  'archive-circle': 'Cerchia non archiviata. Riprova dalla gestione della cerchia.',
  'delete-circle': 'Cerchia non eliminata. Digita la conferma richiesta.',
  'create-event': 'Evento non creato. Controlla titolo, luogo e data.',
  'respond-event': 'Risposta all’evento non salvata. Riprova.',
  'cancel-event': 'Evento non annullato. Verifica di esserne l’organizzatore.',
  'update-event': 'Evento non aggiornato. Controlla luogo e date.',
  'add-event-photo': 'Foto non aggiunta. Scegli un’immagine entro 3 MB.',
  'remove-event-photo': 'Foto non rimossa. Verifica di averne il permesso.',
  'event-update': 'Aggiornamento non pubblicato. Scrivi un testo e riprova.',
  'digest-preferences': 'Preferenze non salvate. Controlla frequenza e orario.',
  'digest-source': 'Fonte del digest non aggiornata. Riprova.',
  'digest-refresh': 'Digest non aggiornato. Riprova tra poco.',
  'open-collaboration': 'Collaborazione non aperta. Riprova dal post.',
  'invite-collaborator': 'Invito non inviato. Scegli un contatto reciproco.',
  'respond-collaboration': 'Risposta non salvata. Riapri l’invito e riprova.',
  'remove-collaborator': 'Collaboratore non rimosso. Verifica di essere l’autore.',
  'set-collaborator-permission': 'Permessi non salvati. Riprova dal collaboratore.',
  'close-album': 'Album non chiuso. Verifica di essere l’autore.',
  'add-album-item': 'Foto non aggiunta all’album. Scegli un’immagine entro 3 MB.',
  'remove-album-item': 'Foto non rimossa dall’album. Verifica di averne il permesso.',
  react: 'Reazione non salvata. Riapri il contenuto e riprova.',
  'mention-preference': 'Preferenza sulle menzioni non salvata. Riprova.',
  'explore-preference': 'Preferenza di Esplora non salvata. Riprova.',
  share: 'Condivisione non inviata. Controlla la destinazione.',
  'chat-settings': 'Impostazioni della chat non salvate. Riapri la chat e riprova.',
  'chat-receipt': 'Stato del messaggio non aggiornato. Riapri la chat.',
  'edit-message': 'Messaggio non modificato. Verifica che sia ancora modificabile.',
  'delete-message': 'Messaggio non eliminato. Riapri la chat e riprova.',
  'propose-note': 'Nota non inviata. Controlla testo e fonti.',
  'review-note': 'Decisione non salvata. Controlla la motivazione.',
  post: 'Post non pubblicato. Controlla testo, allegato e destinazione.',
  'vote-poll': 'Voto non salvato. Riapri il sondaggio e riprova.',
  bookmark: 'Post non salvato. Riaprilo e riprova.',
  like: 'Like non salvato. Riapri il post e riprova.',
  comment: 'Commento non pubblicato. Controlla il testo e riprova.',
  follow: 'Richiesta non inviata. Riapri il profilo e riprova.',
  accept: 'Richiesta non aggiornata. Riapri le notifiche e riprova.',
  message: 'Messaggio non inviato. Riapri la chat e riprova.',
  profile: 'Profilo non aggiornato. Controlla nome e biografia.',
  federation: 'Federazione non aggiornata. Controlla la privacy del profilo.',
  'read-notifications': 'Notifiche non aggiornate. Riapri la sezione.',
  'delete-post': 'Post non eliminato. Riaprilo e riprova.',
  report: 'Segnalazione non inviata. Descrivi il problema e riprova.',
  'report-remote': 'Segnalazione non inviata. Descrivi il problema e riprova.',
  moderate: 'Decisione non salvata. Riapri la segnalazione.',
  'moderate-remote': 'Decisione non salvata. Riapri la segnalazione federata.',
  'moderate-instance': 'Istanza non aggiornata. Controlla indirizzo e motivazione.',
  'moderate-account': 'Account non aggiornato. Controlla la motivazione.',
  block: 'Blocco non aggiornato. Riapri il profilo e riprova.',
};

const GENERIC_ERROR =
  /^(operazione non riuscita|operazione non riconosciuta|caricamento non riuscito|il servizio non risponde|controlla i campi|accesso negato|failed to fetch|load failed|networkerror)/i;

export function actionErrorMessage(action: Action, error: unknown) {
  const message = error instanceof Error ? error.message.trim() : '';
  const technical = error instanceof Error && error.name === 'ZodError';
  return message && !technical && !GENERIC_ERROR.test(message)
    ? message
    : ACTION_FAILURE[action.type];
}

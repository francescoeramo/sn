# SN

Social generalista per Francesco e i suoi amici. Beta su invito, moderazione manuale, nessuna pubblicità attiva. L’app e la demo girano in locale senza servizi a pagamento.

Il prompt aggiornato è in corso di implementazione incrementale. La prima fase aggiunge storie con avanzamento automatico, controlli di pausa e feed senza contatori pubblici di like. La seconda fase aggiunge foto, video, file audio e sei scadenze in chat, con revoca degli allegati scaduti. La terza fase cifra i nuovi messaggi e allegati con Web Crypto, conserva le chiavi private nei browser e offre conservazione sincronizzata o solo sul dispositivo dopo la consegna. Lo storico precedente resta in chiaro. Le Note della comunità permettono di proporre contesto con fonti HTTPS e pubblicarlo dopo una revisione manuale motivata. Le sponsorizzazioni restano da implementare. Limiti e verifiche del protocollo sono in [docs/CRITTOGRAFIA.md](docs/CRITTOGRAFIA.md).

## Provalo adesso

```bash
cd /home/fra/Projects/sn
npm install
npm run dev
```

Apri **http://127.0.0.1:3000/demo**. Non servono chiavi API. Le modifiche della demo si salvano in IndexedDB, solo in quel browser. Per ripartire: Impostazioni → Cancella i dati della demo. La demo non autentica utenti reali e non invia messaggi ad altre persone.

## Cosa c’è

| Funzione            | Implementazione                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Feed e profili      | Post testuali, foto/video, feed cronologico, ricerca utenti/hashtag, profili pubblici nella community o privati                          |
| Interazioni         | Like, commenti, richieste di follow, approvazione/rifiuto, blocchi, notifiche                                                            |
| Storie e reel       | Storie con scadenza nel DB e nell’interfaccia, reel con player nativo, compressione immagini e tentativo di ricodifica video nel browser |
| Messaggi            | 1:1 tra utenti che si seguono a vicenda; polling solo mentre la schermata è aperta; nessuna E2EE                                         |
| Account e controllo | Supabase Auth, inviti monouso legati all’email, esportazione JSON, eliminazione account, segnalazioni e pannello moderazione             |

Le API reali richiedono un progetto Supabase con la migrazione applicata. I test locali verificano le policy SQL; non sostituiscono il collaudo di Auth, Storage e invio email su un progetto completo. Vedi [stato delle verifiche](docs/VERIFICA.md) e [limiti della prima versione](docs/ARCHITETTURA.md).

## Collegamento a Supabase

1. Usa un progetto **Free dedicato a SN**, in regione UE. Non applicare questa migrazione ai database degli altri progetti. Copia `.env.example` in `.env.local` e compila URL, chiave pubblica, chiave segreta server, `APP_ORIGIN`, contatto privacy e segreto manutenzione.
2. Applica `supabase/migrations/20260909094232_initial_social.sql` tramite SQL Editor del nuovo progetto, oppure tramite `supabase db push` dopo il collegamento. La migrazione crea trigger su `auth.users`: chi non ha un invito valido non può registrarsi, neppure chiamando Auth direttamente.
3. Imposta Site URL e Redirect URLs di Auth sull’origine scelta e su `/auth/callback`. Usa password di almeno 12 caratteri, JWT di breve durata, email confirmation attiva e signup anonimo disattivato. Prima degli inviti agli amici configura e prova SMTP: il servizio email predefinito ha restrizioni e non va considerato un servizio di invito pronto per qualsiasi destinatario. Conferma email nello stesso browser della registrazione, per il flusso PKCE.
4. Genera un invito con `node scripts/create-invite.mjs tua@email.it`, esegui la query mostrata nello SQL Editor e usa il codice nella registrazione. Non committare il codice. Dopo il primo account, assegna il moderatore con la query sotto.
5. Collauda due utenti reali seguendo [VERIFICA.md](docs/VERIFICA.md), completa l’informativa e abilita la manutenzione prima di invitare gli amici.

```sql
-- Sostituisci l’UUID con quello del tuo account.
insert into private.admins(user_id) values ('UUID-DEL-TUO-ACCOUNT');
```

Il ruolo moderatore proviene da una tabella privata. Cambiare `user_metadata` non assegna privilegi.

Per un’istanza Supabase locale completa servono Docker funzionante e i comandi `npx supabase start`, `npx supabase db reset`. Il reset distrugge i dati della sola istanza locale: usarlo soltanto per un ambiente di test dedicato. In questa sessione Docker non è accessibile all’utente; i test SQL usano PGlite e non richiedono Docker.

## Quote e costo zero

| Limite della beta      | Valore                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- |
| Account                | 20, inviti monouso con scadenza a 7 giorni                                       |
| Singolo allegato       | 3 MiB, verificato anche in Storage                                               |
| Media per persona      | 40 MiB, prenotazione atomica nel database                                        |
| Media complessivi      | 800 MiB, inclusi upload incompleti in attesa di pulizia                          |
| Video nell’interfaccia | 20 secondi, ricodifica dove supportata; limite byte sempre applicato dal backend |

Le quote sono inferiori allo storage Free indicato da Supabase al 9 settembre 2026. Il traffico e le dimensioni del database restano da monitorare nelle dashboard: i limiti dei file non garantiscono un tetto alla banda consumata dalle visualizzazioni. Non attivare upgrade, componenti a pagamento o addebiti automatici. Font di sistema, illustrazioni locali e nessun servizio AI a consumo.

Nell’account collegato ci sono già due progetti Supabase attivi (`sport-odds-fra`, `fudit`); nessuno è stato modificato. Il piano Free consente due progetti attivi. Per pubblicare occorre rendere disponibile uno slot o scegliere un’altra infrastruttura gratuita.

Fonti consultate: [Supabase Free](https://supabase.com/pricing), [Vercel Hobby](https://vercel.com/docs/plans/hobby). I piani possono cambiare. Vercel Hobby è destinato all’uso personale non commerciale: rivalutare i termini prima di aggiungere donazioni o altre attività economiche.

## Repository e deploy

Il repository [francescoeramo/sn](https://github.com/francescoeramo/sn) è pubblico, come richiesto dal proprietario il 9 settembre 2026, e usa `main`. La licenza del codice non è ancora stata scelta (`UNLICENSED`): repository pubblico e licenza open source sono decisioni distinte. Le dipendenze hanno versioni bloccate e lockfile incluso.

Il workflow `ci.yml` esegue lint, TypeScript, test SQL/unitari, audit npm, build e test browser. Dependabot controlla dipendenze e Actions. Il remote `origin` punta alla repository GitHub.

Per Vercel Hobby: importa quel repository come Next.js, imposta le variabili di `.env.example`, collega `main` e scegli una regione compatibile col database. Non usare chiavi segrete con prefisso `NEXT_PUBLIC_`. Non è stato effettuato un deploy remoto.

La build produce anche output `standalone`; l’app può essere spostata su un host Node.js. Supabase/Postgres e la logica in `lib/core` restano separati dall’interfaccia. Nessuna funzione richiede una libreria UI proprietaria o un piano Pro.

## Manutenzione

`POST /api/maintenance` richiede `Origin` uguale ad `APP_ORIGIN` e `Authorization: Bearer <CRON_SECRET>`. Rimuove storie scadute, reclama fino a 100 file inutilizzati per esecuzione e riprende cancellazioni account interrotte. Le prenotazioni rimangono conteggiate finché la rimozione Storage non riesce. Il job è idempotente; un errore di Storage non libera la quota.

È incluso un workflow GitHub manuale (`maintenance.yml`). Dopo il deploy imposta i segreti `SN_ORIGIN` e `SN_CRON_SECRET` e aggiungi uno schedule giornaliero, oppure usa un timer locale gratuito. Non è attivo alcun job remoto al momento. La scadenza delle storie è applicata ai controlli di lettura anche senza job; la cancellazione fisica richiede il job.

Per fermare gli upload o gli inviti:

```sql
update private.settings set uploads_enabled = false where id = true;
update private.settings set registrations_enabled = false where id = true;
```

## Controlli

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

I test browser usano Chromium di sistema su questa macchina; in CI Playwright installa Chromium. Non sono test contro account personali o altri progetti Supabase. Le istruzioni originali sono in [SN-prompt-progetto.md](SN-prompt-progetto.md), le decisioni in [DECISIONI.md](docs/DECISIONI.md).

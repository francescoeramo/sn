# SN — manuale operativo del progetto

> Guida per chi prende in carico sviluppo e responsabilità operative. Aggiornato al 15 ottobre 2026: stato iOS M0/M0.5, Supabase e passaggio a M1. Il manuale riunisce le informazioni principali in un solo file: aggiornare questo documento quando cambia architettura, sicurezza, roadmap o procedura operativa.

## 1. In breve

SN è un social web generalista in italiano, inizialmente per un gruppo ristretto di amici. Il prodotto privilegia relazioni e controllo personale: beta su invito (limite iniziale 20 account), feed cronologico e finito, niente contatori pubblici di like, niente pubblicità o monetizzazione tramite ads, privacy predefinita e moderazione umana. La demo è locale e utilizzabile senza credenziali o servizi esterni.

Il repository contiene un’app Next.js 16 / React 19, API server-side, dominio TypeScript, client Supabase e migrazioni Postgres con RLS. Non considerare “implementato nel codice” equivalente a “verificato in produzione”: al momento della documentazione il collaudo cloud e il deploy non risultano completati. In particolare, le funzionalità più sensibili richiedono test su un progetto Supabase dedicato.

## 2. Avvio rapido e orientamento

Requisiti: Node compatibile con i pacchetti bloccati in `package-lock.json`; installare le dipendenze con `npm install`. Per lavorare solo sull’interfaccia e sui flussi dimostrativi:

```bash
npm run dev
```

Aprire `http://127.0.0.1:3000/demo`. La demo salva i dati in IndexedDB del browser e non autentica persone reali né spedisce messaggi. Per azzerarla: Impostazioni → Cancella i dati della demo.

La root `/` mostra l’app reale quando è configurata e lo stato di setup quando mancano le chiavi Supabase. Le API reali richiedono un progetto Supabase configurato e le migrazioni applicate. Per i test browser serve Chromium; in locale Playwright usa Chromium di sistema, mentre CI installa il browser.

Comandi disponibili:

| Comando             | Uso                                                 |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Server locale su 127.0.0.1:3000                     |
| `npm run lint`      | ESLint                                              |
| `npm run typecheck` | TypeScript senza emissione                          |
| `npm test`          | Vitest e test SQL/unitari con PGlite                |
| `npm run build`     | Build Next.js                                       |
| `npm run test:e2e`  | Playwright                                          |
| `npm run check`     | lint, typecheck, test e build                       |
| `npm run backup`    | Procedura di backup documentata in `docs/BACKUP.md` |

Leggere `AGENTS.md` prima di intervenire: il repository avverte che questa versione di Next.js ha cambiamenti incompatibili; prima di modificare codice applicativo consultare la documentazione installata in `node_modules/next/dist/docs/`. Non eliminare il blocco agent rule in `AGENTS.md`: viene rigenerato da Next.

## 3. Mappa del repository

| Percorso                | Responsabilità                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `app/`                  | Pagine, layout, callback Auth, route pubbliche ActivityPub e API catch-all                        |
| `components/`           | Interfaccia React: feed, composer, chat, cerchie, eventi, onboarding, moderazione, temi           |
| `lib/core/`             | Tipi, validazioni, limiti, regole pure e primitive HTTP; indipendente da Next e Supabase          |
| `lib/client/`           | Stato locale demo, ciclo di vita chat, sessioni/chiavi client e preparazione media                |
| `lib/crypto/chat.ts`    | Cifratura client dei messaggi                                                                     |
| `lib/server/`           | Accesso Supabase, logica social/chat/cerchie e federazione server-side                            |
| `supabase/migrations/`  | Schema, indici, trigger, funzioni e policy RLS; applicare in ordine cronologico                   |
| `tests/`                | Test unitari, crittografici, HTTP, federazione, SQL/PGlite e Playwright                           |
| `scripts/`              | Inviti, backup, backup Storage e preparazione del bundle standalone                               |
| `docs/`                 | Stato, decisioni, verifica, crittografia, backup e roadmap (questo file ne consolida i contenuti) |
| `PRODUCT.md`            | Direzione e vincoli di prodotto correnti                                                          |
| `SN-prompt-progetto.md` | Brief originale, requisiti estesi e successive fasi                                               |

File di ingresso importanti: `app/page.tsx`, `app/demo/page.tsx`, `components/social-app.tsx`, `app/api/[...path]/route.ts`, `lib/server/supabase.ts`, `lib/server/social.ts`, `lib/server/chat.ts`, `lib/server/groups.ts`.

## 4. Architettura e flussi

### Interfaccia e dati

`components/social-app.tsx` coordina schermate e stato. Le componenti specializzate mantengono rendering e interazioni: `composer.tsx`, `post-card.tsx`, `story-player.tsx`, `chat-conversation.tsx`, `group-chat-*`, `circle-panel.tsx`, `events-panel.tsx`, `community-notes.tsx` e impostazioni. La demo passa al medesimo guscio `SocialApp` con `demo=true`, ma persiste su IndexedDB tramite `lib/client/demo.ts`; la modalità reale chiama le API Next.

L’interfaccia è disponibile in italiano e inglese. La scelta si trova nelle impostazioni, si applica subito e viene salvata in `localStorage` con la chiave `sn-language`; vale anche prima dell’accesso e nella demo. `components/language-provider.tsx` traduce soltanto le stringhe del prodotto definite in `lib/client/i18n.ts` e aggiorna l’attributo `lang` del documento. Nomi e contenuti inseriti dalle persone, compresi post, commenti, messaggi, titoli, descrizioni e didascalie, restano invariati.

Il client non deve poter assegnarsi ruoli, scrivere notifiche o modificare campi privilegiati. In produzione le operazioni ordinarie usano il token dell’utente e sono ristrette da RLS. Le funzioni privilegiate sono isolate nel server e impiegate per rate limit, manutenzione e ciclo di vita account.

### Server e autenticazione

`app/api/[...path]/route.ts` è il punto d’ingresso per le API `/api/*` (runtime Node, route dinamica, corpo JSON limitato a 24 KB per le richieste ordinarie). Le scritture controllano `Origin` confrontandolo con `APP_ORIGIN`, validano input con Zod e rispondono senza cache. I media hanno un flusso dedicato e limiti propri. `lib/server/supabase.ts` crea il client SSR basato su cookie HttpOnly, autentica con `auth.getUser()`, applica il livello AAL2 quando la 2FA è abilitata e rifiuta profili disabilitati. Il client con chiave segreta è separato (`adminDatabase`) e non va usato per aggirare RLS nelle operazioni utente.

Login, signup e recupero hanno rate limit applicativo tramite RPC e chiave HMAC dell’email; signup è subordinato a invito valido e ai controlli del trigger Auth. Le nuove password richiedono 8–128 caratteri, almeno una minuscola, una maiuscola e un numero. Il recupero PKCE va completato nello stesso browser. TOTP è facoltativa; le sessioni possono essere elencate/revocate. L’assegnazione del moderatore è in `private.admins`, mai in `user_metadata`.

### Verifica avvisi Supabase e MFA database (15 ottobre 2026)

I 56 avvisi `authenticated_security_definer_function_executable` identificano RPC
privilegiate intenzionalmente esposte agli utenti autenticati: nessuna risulta
eseguibile da `anon`, tutte fissano `search_path`. Le autorizzazioni applicative
sono controllate dalle funzioni e dai loro helper, non dal solo grant EXECUTE.
Non revocare o convertire in blocco le RPC per nascondere gli avvisi.

La revisione ha riprodotto un bypass della MFA sulle chiamate dirette al database:
la protezione AAL2 era nel server SN, ma `private.member()` non la verificava.
Corretto con `20261015171422_enforce_mfa_database_access.sql`, applicata al cloud:
per account con fattore verificato serve un JWT aal2. Il profilo attivo del solo
chiamante resta leggibile prima della MFA per i challenge web/iOS; le mutazioni
richiedono comunque member(). Policy restrittive aggiungono lo stesso controllo
alle preferenze, menzioni, reazioni, condivisioni e ricevute; anche le RPC sessioni
ora lo verificano. Gli utenti senza fattore verificato continuano con aal1.

I 56 warning restano visibili dopo la correzione perché il linter rileva il grant,
non certifica i controlli nel corpo. La verifica non è un audit indipendente
completo. La protezione Supabase per password compromesse richiede Pro o superiore;
nessun upgrade è stato attivato. La correzione MFA non sostituisce tale protezione.

### Ban degli account (15 ottobre 2026)

Il pannello web Moderazione → Gestione account consente ban di 3 giorni (72 ore),
1 mese, 6 mesi, 1 anno o permanenti. Mesi e anni sono di calendario UTC, con
scadenza mostrata nel fuso del dispositivo. Il motivo resta obbligatorio (10–500
caratteri); moderatori e proprio account non sono bersagli consentiti. Ripristina
revoca anticipatamente qualsiasi ban. Il ban permanente non cancella i contenuti.

`profiles.disabled` conserva i ban permanenti precedenti; `profiles.banned_until`
registra quelli temporanei. RLS, controlli API e visibilità dei contenuti valutano
la scadenza a ogni richiesta, senza cron e senza richiedere un nuovo token.
`set_account_ban` è la nuova RPC; `set_account_disabled` resta compatibile per i
vecchi client. L'audit conserva motivo e scadenza anche dopo il ripristino.
La federazione viene disattivata al ban e non si riattiva automaticamente.
Migrazione `20261015170711_timed_account_bans.sql` applicata a `sndb`; verifica
ruolo moderatore e lettura elenco account eseguita con ruolo `authenticated`.
I comandi restano sul sito web: il client iPhone M0 non ha ancora il pannello.

### API principali

La route catch-all è il catalogo effettivo: leggere il relativo handler prima di cambiare contratti. Sintesi delle route esposte:

| Metodo   | Percorso                                                                   | Scopo                                      |
| -------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| GET      | `/api/bootstrap`                                                           | Snapshot iniziale autenticato              |
| GET      | `/api/posts?before=…`                                                      | Pagina feed, massimo 40                    |
| GET      | `/api/search?q=…`                                                          | Ricerca full-text italiana                 |
| GET      | `/api/saved`                                                               | Pagina dei post salvati                    |
| GET      | `/api/messages?user=…&before=…`                                            | Messaggi 1:1, pagina recente               |
| GET      | `/api/chat/sync`, `/api/chat/devices`                                      | Sincronizzazione e dispositivi chat        |
| GET/POST | `/api/chat/groups`, `/api/chat/groups/message`, `/api/chat/groups/receipt` | Stato, operazioni gruppi, invio e ricevute |
| GET/POST | `/api/auth/mfa`, `/api/auth/sessions`                                      | Fattori TOTP e sessioni                    |
| POST     | `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`                  | Accesso e registrazione                    |
| POST     | `/api/auth/recover`, `/api/auth/password`                                  | Recupero e cambio password                 |
| POST     | `/api/chat/device`, `/api/chat/delivered`                                  | Registrazione dispositivo e ricevute chat  |
| POST     | `/api/action`                                                              | Mutazioni social validate dal dominio      |
| POST     | `/api/upload`                                                              | Upload media con quote e controlli         |
| GET      | `/api/media?path=…`                                                        | Lettura autorizzata da bucket privato      |
| GET      | `/api/export`                                                              | Esportazione JSON personale                |
| POST     | `/api/account/delete`                                                      | Avvio/ripresa cancellazione account        |
| POST     | `/api/maintenance`                                                         | Pulizia e, se abilitata, coda federata     |

I percorsi ActivityPub (`/ap/*`, WebFinger e profili `app/users/[username]`) sono distinti. Discovery è anteprima locale, non interoperabilità pronta alla produzione.

### Database e migrazioni

Il database è Postgres via Supabase. Le migrazioni in `supabase/migrations/` sono append-only e vanno applicate in ordine; non modificare retroattivamente una migrazione già applicata a un ambiente condiviso. Esistono oggetti di profilo e relazioni, post e media, commenti, like, follow/blocchi/notifiche, sondaggi, note comunitarie, salvataggi/avvisi, ciclo di vita messaggi, dispositivi/chiavi e ricevute chat, gruppi, moderazione/audit, oggetti/coda federata, cerchie e incontri.

Le RLS sono parte dell’implementazione, non accessori: proteggono profili privati, follow reciproci, blocchi, messaggi, membership e visibilità. I trigger applicano inviti, quote, campi server-only, notifiche e invarianti atomici. Quando si aggiunge una funzionalità, completare schema + RLS + API + demo locale + export + cancellazione + test prima di considerarla finita.

Ordine delle migrazioni attuale: `20260909094232_initial_social.sql`, `20260909200015_ephemeral_chat.sql`, `20260909201015_encrypted_chat.sql`, `20260910090400_community_notes.sql`, `20260910173013_bookmarks_and_content_warnings.sql`, `20260911085314_chat_lifecycle.sql`, `20260911174749_moderation_audit_log.sql`, `20260911181601_post_full_text_search.sql`, `20260912153500_account_sessions.sql`, `20260912155500_polls.sql`, `20260912162500_profile_onboarding.sql`, `20260912164500_auth_rate_limits.sql`, `20260913171500_group_chat_foundation.sql`, `20260913180500_encrypted_group_messages.sql`, `20260914172524_group_message_notifications.sql`, `20260918085035_federation_opt_in.sql`, `20260918085645_moderator_account_controls.sql`, `20260918090815_moderation_account_reasons.sql`, `20260919133813_federation_actor_keys.sql`, `20260919134357_federation_inbox.sql`, `20260919134959_federation_delivery_queue.sql`, `20260919135337_federation_post_delivery.sql`, `20260919135717_federation_withdrawal_queue.sql`, `20260920101500_federation_reactions.sql`, `20260921124522_federation_remote_objects.sql`, `20260922113000_federation_remote_moderation.sql`, `20260922153000_federation_instance_moderation.sql`, `20260923160225_circles.sql`, `20260924163022_complete_circle_management.sql`, `20260925162757_circle_images.sql`, `20260925163701_simple_events.sql`, `20260925180000_event_details_and_album.sql`, `20260926120000_user_digest.sql`, `20260926130000_collaborative_posts.sql`, `20260926140000_expressiveness.sql`, `20260926150000_intentional_discovery.sql`, `20260927113305_fix_storage_upload_policy.sql`, `20260927114503_restore_post_insert_policy.sql`, `20260927114924_fix_post_returning_read_policy.sql`, `20260927120738_allow_reaction_upsert.sql`, `20261001100000_username_dots.sql`, `20261001113000_profile_connections_and_post_media.sql`, `20261001120000_reliable_shares_and_notifications.sql`, `20261002140006_story_views.sql`, `20261015164952_restrict_rls_auto_enable_execution.sql`, `20261015170711_timed_account_bans.sql`, `20261015171422_enforce_mfa_database_access.sql`.

## 5. Funzionalità: stato reale

“Implementato” in questa tabella descrive il repository/demo/migrazioni; non implica collaudo Auth, email, Storage o RLS sul cloud.

| Area                  | Stato noto e attenzione                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed e profili        | Post di testo/media con carousel fino a dieci elementi e descrizioni individuali, feed cronologico, profili pubblici/privati, visibilità configurabile di follower/seguiti, ricerca utenti e hashtag; query di ricerca testuale italiana. Il bootstrap carica una finestra finita; paginazione post presente. I conteggi visibili possono derivare dai record caricati e vanno rivisti prima di una beta con molto traffico. |
| Interazioni           | Like senza contatori pubblici, commenti, richieste follow, blocchi, notifiche, sondaggi a voto singolo e scadenza facoltativa.                                                                                                                                                                                                                                                                                               |
| Media e storie        | Immagini, video, carousel nei post e audio in chat; storie con descrizione fino a 128 caratteri, scadenza, timer dopo consenso esplicito all’avviso, visualizzazioni private, elenco viewer per l’autore, anello letto e riordino in coda. Il server limita byte e controlla firme/formati, ma non usa antivirus o decodifica isolata per certificare durata.                                                                |
| Chat 1:1              | Solo contatti reciproci; nuovi messaggi/allegati cifrati client-side, scadenza configurabile, ricevute, modifica/cancellazione secondo finestra e conservazione sincronizzata o solo dispositivo. I vecchi messaggi restano in chiaro.                                                                                                                                                                                       |
| Chat di gruppo        | Membership/ruoli/inviti, messaggi E2EE v2, ricevute e UI; demo IndexedDB. Manca collaudo cloud.                                                                                                                                                                                                                                                                                                                              |
| Note della comunità   | Proposte con fonti HTTPS, revisione umana e motivazione.                                                                                                                                                                                                                                                                                                                                                                     |
| Salvataggi e avvisi   | Raccolta privata paginata; visibilità continua a rispettare blocchi/scadenze/eliminazioni. Avviso fino a 160 caratteri; il media delle storie si carica dopo “Mostra storia”.                                                                                                                                                                                                                                                |
| Account e moderazione | Inviti, Auth, recovery, TOTP, sessioni, export/eliminazione, controlli moderatore e audit append-only. Cloud da collaudare.                                                                                                                                                                                                                                                                                                  |
| Federazione           | Trasporto ActivityPub sperimentale: WebFinger, actor, outbox, inbox firmata, Note remote e queue delivery/retry. `FEDERATION_DELIVERY_ENABLED` deve restare false fino ai test reali con Mastodon/Pixelfed.                                                                                                                                                                                                                  |
| Cerchie               | Membership privata, inviti, ruoli, mini-feed, più destinazioni, sondaggi, gestione completa e immagine facoltativa implementati localmente; cloud non collaudato.                                                                                                                                                                                                                                                            |
| Eventi                | Incontri locali per follower approvati o cerchia, luogo testuale, intervallo, capienza, risposte idempotenti, modifica dei dettagli riservata all’organizzatore e album collaborativo disponibile dopo l’inizio. Notifiche singole per variazioni sostanziali; album con quote media e pulizia coerenti. Cloud non collaudato.                                                                                               |
| Digest                | Scelto dall’utente, spento di default, con frequenza, fascia, fuso e canale; massimo cinque elementi con motivo spiegabile e rigenerazione idempotente per periodo. Conserva preferenze e ultimo invio, non le aperture. Il canale email richiede un provider di invio ancora assente.                                                                                                                                       |
| Collaborazioni        | Post collaborativi e album condivisi con inviti tra contatti reciproci, permessi revocabili, chiusura dell’album e blocco dei contributi dopo rimozione o chiusura; media coerenti con le quote e la pulizia esistenti.                                                                                                                                                                                                      |
| Espressività          | Reazioni private, risposte contestuali con citazione dello stesso post, menzioni governate da preferenza e condivisioni interne senza copia pubblica né contatori. Le condivisioni verso una chat sono visibili a entrambi i partecipanti e compaiono nella conversazione.                                                                                                                                                   |
| Scoperta              | Sezioni Esplora esplicite e nascondibili; metriche aggregate senza identificativi, leggibili solo dai moderatori e calcolate dal job di manutenzione. Nessun feed «Per te» o ranking.                                                                                                                                                                                                                                        |

### Limiti/quote beta

| Limite dichiarato nel progetto | Valore                                                                |
| ------------------------------ | --------------------------------------------------------------------- |
| Account                        | 20, accesso tramite inviti monouso con scadenza di 7 giorni           |
| Allegato singolo               | 3 MiB                                                                 |
| Media per persona              | 40 MiB                                                                |
| Media totale                   | 800 MiB, inclusi upload incompleti in attesa di pulizia               |
| Durata video interfaccia       | 20 secondi; la durata non è verificata in modo affidabile dal backend |

Le quote non limitano da sole la banda e non sono un budget di hosting. Tenere monitorati storage, database, traffico, email e limiti dei piani; non attivare upgrade, componenti a pagamento o addebiti automatici senza decisione esplicita.

## 6. Sicurezza, privacy e responsabilità

### Garanzie implementate e confini

- RLS nega accesso anonimo ai dati della community e delimita visibilità, blocchi e membership. I segreti server non devono mai avere prefisso `NEXT_PUBLIC_`.
- Scritture API controllano origine, schema e dimensione. CSP con nonce e `Cache-Control: private, no-store`; i media sono serviti da bucket privato attraverso endpoint autorizzato.
- Il limite upload è protetto da prenotazioni atomiche; gli upload incompleti restano conteggiati fino alla pulizia. Registrazioni limitate da lock/trigger e invito valido.
- PGlite verifica vero motore Postgres per schema, trigger e RLS nei test. Gli stub di Auth/Storage non sono i servizi Supabase GoTrue/Storage reali e non provano SMTP, provider, CDN o concorrenza multi-connessione.
- Non esiste audit indipendente del protocollo E2EE. Non è Signal Double Ratchet e non offre forward secrecy dello storico. Un server che distribuisce JavaScript malevolo può compromettere i dati durante l’uso; chiavi/metadati e perdita dispositivo hanno limiti espliciti. Metadati di partecipanti, orari e dimensioni restano visibili.
- Il backend non certifica durata video con ffprobe né esegue antivirus. Prima di un’apertura non controllata serve pipeline isolata di decodifica/convalida.
- La pagina privacy è bozza operativa. Non dichiarare conformità GDPR/DSA certificata. Prima di utenti reali completare titolare, contatto, finalità/basi, tempi effettivi, procedure di ricorso e documentazione fornitori.
- Regione UE aiuta la residenza dei dati, ma non significa che tutti i fornitori o l’infrastruttura siano europei.

### Federazione: limiti e posture

La preview è attivata da `FEDERATION_DISCOVERY_PREVIEW=true` in sviluppo ed è ignorata in produzione. Senza preview, WebFinger e `/ap/*` rispondono 503. L’anteprima esclude profili privati/disabilitati, storie e post solo media; follower/following non espongono il grafo locale. Le chiavi private actor sono cifrate con AES-256-GCM e `FEDERATION_KEY_SECRET`: la perdita del segreto rende inutilizzabili quelle chiavi. Recupero chiavi/consegne hanno controlli HTTPS, SSRF e redirect; inbox firma e deduplica attività. La coda consegna al massimo quattro attività per esecuzione, con retry; worker spento per default. Non descrivere SN come interoperabile finché i test incrociati non passano.

### Gestione incidente

In caso di abuso o problema operativo, il moderatore può sospendere account, rimuovere contenuti e usare l’audit. Per fermare subito nuovi inviti/upload:

```sql
update private.settings set uploads_enabled = false where id = true;
update private.settings set registrations_enabled = false where id = true;
```

Per un incidente su chiavi o credenziali, ruotare i segreti coinvolti e valutare la revoca sessioni. La rotazione di `FEDERATION_KEY_SECRET` senza una migrazione/ricifratura delle chiavi archiviate rende le vecchie chiavi non decifrabili; preparare e collaudare una procedura prima di ruotarlo. Per cancellazioni, mantenere attiva la manutenzione finché Storage e database hanno concluso il lavoro.

## 7. Configurazione e operatività

Variabili lette dal progetto (`.env.example` è il riferimento):

| Variabile                              | Uso                                                     | Esposizione                       |
| -------------------------------------- | ------------------------------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL progetto                                            | Pubblica                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chiave publishable Supabase                             | Pubblica, protetta da Auth/RLS    |
| `APP_ORIGIN`                           | Origine canonica per callback e controllo Origin        | Server/config                     |
| `SUPABASE_SECRET_KEY`                  | Operazioni amministrative isolate e rate limit          | Solo server, segreta              |
| `FEDERATION_KEY_SECRET`                | Cifratura chiavi private ActivityPub                    | Solo server, segreta, persistente |
| `FEDERATION_DELIVERY_ENABLED`          | Abilita worker consegne federate                        | Server, false finché non validato |
| `FEDERATION_DISCOVERY_PREVIEW`         | Preview discovery locale                                | Solo sviluppo; ignorata prod      |
| `CRON_SECRET`                          | Bearer secret manutenzione, almeno 32 caratteri casuali | Solo server/job, segreta          |
| `PRIVACY_CONTACT_EMAIL`                | Contatto richiesto per registrazione                    | Configurazione pubblicabile       |

Le email Auth di conferma, recupero e avviso di password cambiata hanno template italiani in `supabase/templates/`. Il Supabase locale le mostra in Inbucket; sul progetto cloud occorre copiare i template nella dashboard Auth e configurare Resend come SMTP secondo `docs/EMAIL.md`. `sn.help@proton.me` è il recapito di assistenza, ma non è un mittente utilizzabile con Resend senza controllo DNS del dominio `proton.me`. Il mittente effettivo deve appartenere a un dominio verificato. La modifica ai file locali non configura automaticamente il servizio cloud.

### Collegamento e stato cloud

Non usare progetti Supabase estranei a SN. Il progetto dedicato `sndb` in regione UE è collegato e attivo: 47 migrazioni applicate e controlli Auth/RLS/MFA eseguiti. Il collaudo cloud completo della beta resta aperto. Per configurare un nuovo ambiente: compilare `.env.local`; generare `FEDERATION_KEY_SECRET` con `openssl rand -base64 32` e `CRON_SECRET` robusto; applicare migrazioni in ordine sul progetto dedicato; configurare Site URL/Redirect URL incluse callback; abilitare conferma email e signup anonimo disattivato; password minima 12, JWT 5 minuti e link email 15 minuti; configurare/testare SMTP Resend e template secondo `docs/EMAIL.md` prima di invitare utenti. Assegnare moderatore inserendo l’UUID del primo account in `private.admins`. Non committare credenziali o codici invito.

L’invito si genera con `node scripts/create-invite.mjs email@example.org`; lo script mostra l’SQL da eseguire nel progetto corretto. Verificare destinatario e database prima di eseguire l’SQL.

### Manutenzione, backup e deploy

`POST /api/maintenance` richiede Origin pari ad `APP_ORIGIN` e `Authorization: Bearer <CRON_SECRET>`. Pulisce storie scadute, reclama fino a 100 file inutilizzati per esecuzione e riprende eliminazioni account interrotte. Le quote restano occupate fino a rimozione Storage riuscita. Se la delivery federata viene deliberatamente abilitata, processa fino a quattro attività per esecuzione; quinto errore termina il tentativo. Il workflow GitHub `maintenance.yml` è manuale: dopo deploy impostare `SN_ORIGIN` e `SN_CRON_SECRET` e pianificare un job giornaliero o timer gratuito. Al momento non è attivo un job remoto.

Seguire `docs/BACKUP.md`: export cifrato di database e bucket `media` verso storage fidato e prova di ripristino completa prima della beta, poi almeno trimestrale. Una copia non verificata non è un backup affidabile.

Per output standalone: `node scripts/prepare-standalone.mjs` copia static e `public` prima di avviare `.next/standalone/server.js`. Deploy Vercel è descritto in README ma non risulta effettuato. Il repository usa `main`, remoto GitHub pubblico, licenza `UNLICENSED`; CI dichiarata in README include lint, typecheck, test SQL/unitari, audit npm, build e browser; Dependabot controlla dipendenze e Actions. Verificare i workflow correnti prima di affidarsi a questa descrizione.

## 8. Test e livello di evidenza

La suite locale è in `tests/`: `database.test.ts` prova migrazioni/RLS/trigger tramite PGlite; `rules.test.ts`, `http.test.ts`, `crypto.test.ts`, `federation.test.ts`, `backup.test.ts` coprono logiche rispettive; `e2e/social.spec.ts` copre flussi browser della demo. `docs/TEST-RESULTS.md` riporta risultati storici e va consultato per timestamp e dettagli. Non avviare test se l’incarico non li richiede; prima di una release la checklist cloud resta obbligatoria.

Checklist pre-beta da eseguire su ambiente dedicato con almeno due account reali: migrazioni e advisor RLS; registrazione tramite invito e SMTP; conferma email/recovery nello stesso browser; profili privati, follow/blocco e notifiche; upload, Storage, quote e cancellazione; chat cifrata 1:1 e gruppo con più dispositivi e concorrenza; 2FA/sessioni; ricerca e sondaggi; cerchie e inviti/ruoli; export e cancellazione account completa; endpoint manutenzione e ripristino backup; header/CSP in produzione; federazione con Mastodon e Pixelfed solo su istanze di test. La checklist estesa preesistente è in `docs/VERIFICA.md`.

## 9. Roadmap approvata e ordine di esecuzione

L’ordine qui sotto riflette `docs/ROADMAP.md` e il brief; le priorità possono dipendere da decisioni del proprietario. Prima chiudere le attività di affidabilità della beta e soltanto poi allargare il prodotto.

### A. Cerchie completate in locale

L’immagine facoltativa della cerchia è implementata: upload, sostituzione, rimozione e pulizia sono coerenti con quote, export e cancellazione. Inviti, ruoli, rimozione membri, pubblicazione multi-cerchia e sondaggi sono coperti da test locali. Anche eventi e sezioni F.2–F.5 sono completi nel repository. Resta da collaudare il cloud; non collegare o modificare Supabase cloud senza richiesta del proprietario.

### B. Allineare e collaudare il cloud dedicato

Applicare tutte le migrazioni, eseguire advisor su RLS e funzioni privilegiate e completare la checklist cloud della sezione 8. Includere Auth/SMTP, Storage, concorrenza, CSP e ripristino. Documentare esito per ogni prova e non confondere test PGlite con servizio gestito.

### C. Rendere operativa la manutenzione

Programmare endpoint cleanup e backup cifrato DB + bucket. Eseguire ripristino completo e registrare istruzioni/tempi. Verificare alert sul fallimento e sulle quote. Nessun job è attualmente pianificato.

### D. Validare la federazione prima di attivarla

Su infrastruttura/istanze dedicate, testare Mastodon e Pixelfed: handshake Follow/Accept/Reject/Undo, firme, Create/Update/Delete, allegati e avvisi, retry/idempotenza, ritiro account, revoca privacy, rotazione chiavi, blocco istanze, segnalazioni/moderazione e limiti banda/storage. Worker resta disattivato fino al superamento documentato.

### E. Decisioni per l’apertura

Completare informativa, contatti, conservazione e ricorsi; scegliere licenza repository; definire inviti a gruppi e comunicazione sulla perdita chiavi E2EE. Un backup facoltativo delle chiavi E2EE richiede una scelta esplicita sul modello di rischio. Verificare termini provider prima di qualsiasi monetizzazione (ads esclusi dalla direzione corrente).

### F. Funzionalità prodotto approvate, dopo l’affidabilità

1. **Eventi completi — completati localmente:** modifica dei dettagli riservata all’organizzatore e album collaborativo disponibile dopo l’inizio, con confini follower/cerchie, permessi (organizzatore o «Partecipo»), quote media e cancellazione preservati. Resta il collaudo cloud.
2. **Digest scelto dall’utente — completato localmente:** opt-in separato, spento di default, massimo cinque elementi, ordine spiegabile; niente tracciamento aperture; email solo con consenso separato (provider di invio ancora assente). Resta il collaudo cloud.
3. **Post collaborativi e album condivisi — completati localmente:** inviti accettati, permessi revocabili, visibilità unica e comprensibile, quote correnti, RLS che interrompe contributi dopo rimozione/blocco/scadenza. Resta il collaudo cloud.
4. **Conversazioni più espressive — completate localmente:** reazioni private, risposte contestuali, menzioni solo con consenso e condivisioni interne; senza classifiche, copie pubbliche o contatori di amplificazione. Resta il collaudo cloud.
5. **Scoperta intenzionale — completata localmente:** ogni proposta spiega la ragione ed è nascondibile; niente “Per te”, feed infinito, streak o ranking opaco. Metriche soltanto aggregate, mai profili individuali. Resta il collaudo cloud.

Ogni blocco deve arrivare completo su migrazione, API, demo IndexedDB, RLS, export, cancellazione, test desktop/mobile. Non anticipare schema parziale in produzione.

Altri elementi da roadmap lunga/brief e non parte della beta: dirette (servizio separato, mai nel piccolo endpoint upload), app nativa (adapter Auth bearer mantenendo regole dominio), protocollo E2EE evoluto/recupero dispositivi, ulteriore federazione. Consultare il brief prima di stimare o promettere queste funzioni.

L’**adapter bearer lato server** per l’app nativa M0 è già presente (`native/auth/login|refresh|logout|mfa`, `tokenDatabase`, `identityFrom`), descritto in `docs/ARCHITETTURA.md` e in `docs/PIANO-APP-NATIVA.md`. È usato dal prototipo di sviluppo verificato su iPhone; non equivale a distribuzione pubblica o completamento del client social. Lo sviluppo è richiesto dal proprietario, il rilascio resta separato.

### Ambiente iOS attuale (15 ottobre 2026)

Il client SwiftUI usa SwiftPM e xtool su Linux. Swift 6.4.1, SDK Darwin iPhoneOS 27.0,
target iOS 17 e iPhone con iOS 27.0.1. Build, firma, installazione e runtime verificati.
I flussi M0 (login, verifica sessione, rinnovo, logout/riapertura, recupero offline e MFA)
sono confermati dall'utente. Le conferme non costituiscono esecuzione integrale della
matrice tecnica: runner XCTest sessione/SwiftUI e casi concorrenti runtime restano aperti.

M0.5 è completata: `ios/ChatCrypto` usa CryptoKit su iOS e swift-crypto su Linux;
il codice web esistente verifica il rapporto recuperato via USB dal telefono.
Evidenza: `docs/evidence/ios-crypto-interop-2026-10-15.json`, piattaforma ios-cryptokit,
35 controlli, tre risposte su tre dispositivi e allegato corretto. Due XCTest crypto
Linux e sei test Web Crypto superati; nessun messaggio reale o modifica cloud per M0.5.

Il prossimo incremento è M1: feed, profilo e pubblicazione con immagine. L'interfaccia
attuale resta Login/MFA/Sessione. Solo auth native e bootstrap supportano il bearer:
feed paginato, media e scritture devono ancora essere adattati mantenendo sicurezza
e comportamento web. Un nuovo login MFA su iPhone dopo la correzione SQL non è stato
osservato direttamente: includerlo nella regressione M1 senza riaprire la prova crypto.

`SNApiBaseURL` attuale: `http://192.168.1.9:3000`, con eccezione ATS specifica e
consenso rete locale. L'IP è configurazione di sviluppo da verificare alla nuova rete.
`xtool dev run --usb` installa; aprire l'icona manualmente. Niente VM macOS/Xcode.
Usare `ios/README.md`, `docs/PIANO-APP-NATIVA.md`, `docs/IOS-CRYPTO-INTEROP.md` e
`docs/OPENCODE.md`. L'app non è distribuita pubblicamente.

## 10. Regole pratiche per chi interviene

1. Verificare lo stato Git e gli ambienti prima di cambiare file o dati; distinguere demo, test locale, staging e progetto cloud.
2. Per Next.js leggere la guida locale pertinente prima di cambiare codice e rispettare le istruzioni aggiornate del repository.
3. Per ogni feature seguire tutto il percorso: tipi/regole → demo → UI/API → migrazione/RLS/trigger → export/cancellazione → test → documentazione. Evitare logica duplicata e contratti client-server divergenti.
4. Ogni query server-side deve continuare a rispettare RLS; mai usare la chiave segreta come scorciatoia. Validare lato server anche i dati già validati dal browser.
5. Migrazioni nuove e additive; rivedere policy con casi anonimo, proprietario, follower, non follower, bloccato, moderatore e account disabilitato.
6. Non esporre contenuti privati in cache, log, discovery, export altrui o federazione. Conservare carattere privato delle note e dei metadati di moderazione.
7. Aggiornare questo manuale e la documentazione specialistica quando una funzione passa di stato o viene modificata una procedura.
8. Chiedere una nuova decisione prima di modificare prodotti cloud, attivare spesa, deploy pubblico, attivare delivery federata o cambiare il modello privacy/sicurezza.

## 11. Riferimenti di progetto

Questo manuale è il punto di ingresso, ma i dettagli normativi/operativi restano nei file specialistici:

- Direzione e vincoli: `PRODUCT.md`, `SN-prompt-progetto.md`, `docs/DECISIONI.md`.
- Roadmap dettagliata: `docs/ROADMAP.md`.
- Confini architetturali/federazione: `docs/ARCHITETTURA.md`.
- Protocollo e limiti crittografici: `docs/CRITTOGRAFIA.md`.
- Backup e restore: `docs/BACKUP.md`.
- Email Auth e Resend: `docs/EMAIL.md`.
- Checklist cloud: `docs/VERIFICA.md`.
- Evidenza dei test eseguiti: `docs/TEST-RESULTS.md`.
- Configurazione locale: `.env.example`; non inserire segreti in Git.

## 12. Audit di sicurezza del 19 ottobre 2026

Le correzioni e l’ordine di rilascio sono in `docs/SECURITY-AUDIT-2026-10-19.md`: intenzione di cancellazione separata dai ban, MFA sulle letture di inviti, filtri blocchi nelle connessioni e upload Storage solo tramite server dopo prenotazione RLS dei byte misurati. Le quattro nuove migrazioni sono state applicate a `sndb` e verificate il 19 ottobre 2026; evidenza in `docs/evidence/cloud-security-2026-10-19.json`. I vecchi account disabilitati non vengono interpretati come richieste di cancellazione.

## 13. Client iOS M1 — 23 ottobre 2026

Feed cronologico finito e paginato, proprio profilo e post con una foto sono ora
implementati in SwiftUI. Build Darwin senza avvisi; bearer esteso a posts/media e
scritture ristrette native/post e native/upload con identità verificata, MFA, RLS e
quote del sito. Origin web preservato, nessuna modifica cloud o al protocollo crypto.
Verifica: 29 test server, 8 controlli eseguibili modelli Swift, typecheck/lint mirato.
SNTests e collaudo runtime M1 restano aperti: non dichiarare M1 conclusa.

Sviluppo su hotspot personale **USB**, server vincolato a `172.20.10.3:3000`, indirizzo
osservato nella sessione e da ricontrollare. Nessun uso della LAN universitaria per
collegare app e backend. Installazione USB e verifica completate al 100% (exit 0)
al secondo tentativo; il primo aveva restituito provisioning Apple 409, causa
transitoria non accertata. Nessun cambio account o toolchain. Aprire SN a mano e
collaudare MFA, feed, paginazione, foto, pubblicazione, riapertura e accessibilità.
`ios/README.md` documenta il passaggio e prevale sui riferimenti storici a M1 non
implementata e al vecchio indirizzo Wi-Fi.

Aggiornamento runtime della stessa sessione: UFW bloccava il traffico sull’interfaccia
USB (log kernel confermato). Regola aggiunta esclusivamente da `172.20.10.1` a
`172.20.10.3:3000/tcp` su `enp8s0f3u1c4i2`; procedura e rimozione in `ios/README.md`.
L’utente ha poi confermato accesso, feed e foto nel profilo. Log server: login/MFA,
bootstrap e lettura media con esito 200. Due tentativi MFA precedenti avevano avuto
503. L’utente ha infine confermato pubblicazione e nuova foto visibile nel post; native/post
200 e successivo bootstrap 200 osservati. Il percorso principale M1 è funzionale
sull’iPhone via USB. Paginazione oltre la prima finestra, riapertura dopo invio e
regressione/accessibilità estese restano aperte; non equivalgono al collaudo già fatto.

### Consolidamento iOS — 23 ottobre 2026

Ripreso M1 già installato e confermato dall’utente (accesso, feed, foto e invio).
Corretto logout concorrente: pulizia locale immediata, revoca con token più recente;
restore ignora errori di refresh arrivati dopo il logout. Verifica ripetibile senza
rete: `bash scripts/check-ios-session.sh`, 11 XCTest sulla logica reale con API/store
in memoria e shim Combine. Non verifica Keychain/SwiftUI né il runner Darwin.
Build Darwin con xtool superata; prove runtime estese ancora aperte, stato operativo
in `ios/README.md`. Nessun cambio cloud, schema o crittografia.
Rete: Wi-Fi universitario disconnesso; hotspot USB unica route predefinita e server
vincolato a `172.20.10.3:3000`. Ricontrollare indirizzo e route alla prossima sessione.

### Recupero connessione iOS — 23 ottobre 2026

L’utente conferma caricamento dei post dopo riapertura; paginazione non esercitabile
con pochi post. Segnalati lentezza foto e messaggio offline rimasto dopo il recupero.
Il successo media ora aggiorna la connessione; retry bootstrap solo in primo piano
con backoff 3–30 secondi e ripresa foto fallite. Cache privata solo RAM e download
condiviso per percorso, svuotati al logout. 16 XCTest locali e build Darwin superati.
Primo download ancora da misurare sul telefono: non dichiarare risolta tutta la
lentezza grazie ai soli test di cache. Stato installazione in `ios/README.md`.

### Ripresa iOS — 24 ottobre 2026

Completato e installato l'incremento non committato degli avvisi sui contenuti nel
composer: toggle, testo fino a 160 caratteri UTF-16, conferma scarto e trasporto
nel contratto native/post già esistente. Nessuna modifica cloud, API o crypto.
18 XCTest Linux, 10 controlli modelli, 30 test server mirati e lint superati;
build Darwin e installazione USB con Verifying 100%, exit 0.
L'utente conferma accesso funzionante prima dell'installazione; nuovo flusso con
avviso e prestazioni foto ancora da provare su device. M2 non iniziata.
Wi-Fi esplicitamente autorizzato: computer `192.168.1.9`, backend vincolato a tale
indirizzo, base URL e ATS allineati. Nessuna regola firewall modificata.
Per stato e prossime prove prevale `ios/README.md` sui paragrafi storici USB.

### Consolidamento M1, incremento 1 — 24 ottobre 2026

L'utente conferma invio del post con avviso e, dopo il riavvio del backend,
lettura nuovamente funzionante; media 200 in 497–831 ms. Il server ora gira nel
servizio utente transitorio `sn-ios-dev` per sopravvivere al riavvio dell'agente.
Il composer invalida selezioni foto superate, blocca invio durante preparazione e
permette rimozione anche durante caricamento. Nessuna persistenza della bozza.
22 XCTest Linux e build Darwin superati; installazione del nuovo incremento
ancora da eseguire. Stato e comandi in `ios/README.md`.

### Consolidamento M1, incremento 2 — 24 ottobre 2026

Gestione sessione coerente anche durante upload/pubblicazione: rifiuto definitivo
chiude localmente la sessione, rete assente conserva i token e attiva il recupero,
risposte tardive dopo logout ignorate. Scritture mai ritentate automaticamente;
408/5xx/esito perso restano ambigui. Regressioni riprodotte prima del fix,
26 XCTest Linux e build Darwin superati. Nessun cambio server/cloud o crypto.

### Consolidamento M1, incremento 3 — 24 ottobre 2026

Profilo con archivio paginato proprio, indipendente dal feed. `GET /api/profile/posts`
lega author_id all'identità verificata; bearer/MFA, RLS e no-store preservati.
40 post ordinari non scaduti e senza cerchia per pagina, cursore data/UUID e
lookahead per fine esatta. Nessuna nuova tabella o modifica cloud. Il client
mantiene dati/cursore in errore, li cancella al logout e ricarica dopo pubblicazione,
anche concorrente. 30 XCTest Linux, 13 controlli modelli, 75 test server/regole,
typecheck/lint e build Darwin superati. Installazione finale dei tre incrementi
con Verifying 100%, exit 0. L'utente conferma il nuovo tab Profilo funzionante.
Log del 24 ottobre: refresh/bootstrap/profile/posts/media tutti 200;
profile/posts in 400 ms, media in 575–733 ms. Paginazione device oltre 40 e
accessibilità restano aperte; la conferma non certifica l'intera matrice M1.


## Collaudo automatizzato M1 — 24 ottobre 2026, passaggio finale

Rapporto corrente: [IOS-M1-VERIFICA.md](IOS-M1-VERIFICA.md) (dal README iOS:
`../docs/IOS-M1-VERIFICA.md`). 32 XCTest Linux con APIClient/URLSession reali e
trasporto sintetico, 15 controlli modelli e 77 test server/regole superati;
typecheck/lint e build Darwin superati. Prova interna su iPhone: 18 controlli
superati, incluso Keychain separato e ridimensionamento foto. Prova SwiftUI con
HID: feed e profilo 40 → 80 → 85, pulsanti e fine esplicita verificati. Nessun
post di test inserito nel cloud. Timeout del backend reale: sessione conservata e
recupero senza rilancio, con campione stabile successivo alla transizione.

Trovato e corretto un difetto reale: timestamp uguali al confine della pagina
facevano saltare 45 post su 85 nel feed. Ora bootstrap/posts aggiungono
`nextPostId`, iOS invia `before` + `post_id`, ordinamento e confronto data/UUID;
il contratto web a sola data rimane accettato. Nessuna migrazione o modifica cloud.

Aumentato il contrasto di metadati e contatori usando il colore primario di
sistema, preservando layout e stili tipografici. Build finale installata e
verificata al 100%; composer aperto via HID e ispezionato sul telefono. Restano
aperti: nuovo audit dopo l'ultima correzione del contrasto (i precedenti audit
validi riportano rilievi, alcuni incoerenti con i pixel della schermata), prova
rapida del picker nativo e ascolto VoiceOver completo. Non dichiarare M1
integralmente collaudata o iniziare M2 come se tutti i gate fossero chiusi.

Automazione: `scripts/check-ios-m1-device.py`, modalità solo DEBUG
`SN_M1_UI_FIXTURE=1` e `SN_RUN_M1_CHECKS=1`; dati locali, token in memoria e
preferenze isolate. Il runner controlla il segnale di collaudo prima/dopo audit e
prima di salvare screenshot. Campioni di altre app scartati ed eliminati; nessun
contenuto personale nei rapporti versionati. Durante la sessione usbmuxd è
terminato con SIGABRT/invalid pointer ed è stato riavviato; nessun cambio toolchain.
Rete e backend: servizio utente `sn-ios-dev` attivo a `192.168.1.9:3000`.
A fine prove ripristinati tema scuro, dimensione testo iniziale e avvio normale
senza flag di test; non reinstallare né ripetere crypto M0.5.

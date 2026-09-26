# Risultati delle verifiche

Data: 10 settembre 2026. Ambito: prime tre fasi del prompt aggiornato: feed, storie e chat effimera con allegati.

| Controllo           | Risultato                                        |
| ------------------- | ------------------------------------------------ |
| `npm run lint`      | Superato                                         |
| `npm run typecheck` | Superato                                         |
| `npm test`          | 45 test superati, inclusi schema e RLS su PGlite |
| `npm run build`     | Superato                                         |
| `npm run test:e2e`  | 30 test superati, desktop e mobile               |

I test browser verificano pubblicazione e persistenza nella demo, interazioni, ricerca, profilo, esportazione e messaggi. Per le storie coprono avanzamento automatico, pausa, pressione prolungata, navigazione, sequenze dello stesso autore, video e chiusura alla fine. Verificano inoltre l’assenza di conteggi pubblici dei like, il termine del feed, il rifiuto delle richieste API anonime e CSRF e la federazione chiusa.

La validazione degli allegati demo accetta immagini e video locali entro 3 MiB e respinge URL remoti e file troppo grandi. Il limite dei percorsi media lato server rimane verificato separatamente. Il video usato nei test è un breve filmato sintetico generato localmente.

Controllo visivo locale del lettore di storie completato; nessun errore rilevato dal browser durante la verifica.

Questi risultati non certificano Auth e Storage su Supabase cloud: il collaudo dedicato e il deploy del sito non sono stati eseguiti. Il protocollo E2EE non ha ricevuto un audit indipendente; le successive fasi del prompt sono ancora da implementare. Per i controlli cloud rimanenti, vedere [VERIFICA.md](VERIFICA.md).

La seconda fase aggiunge verifiche SQL sulle sei durate consentite, accesso agli audio, isolamento dai terzi e revoca dopo la scadenza. Le prove browser coprono invio di un allegato senza testo, anteprima, pulizia IndexedDB alla riapertura e blocco dell’invio senza follow reciproco.

La terza fase verifica ECDH/HKDF/AES-GCM con più browser, chiavi private non esportabili, integrità di messaggi e allegati, scadenze autenticate e rifiuto dei nuovi messaggi in chiaro. Le prove browser verificano ciphertext in IndexedDB, decifratura dopo ricaricamento e blocco dell’invio quando cambia una chiave. La funzione di consegna è testata contro chiamate di estranei e revoca l’accesso al blob nella stessa transazione. Controllo visivo della nuova chat completato senza errori browser.

Le Note della comunità sono testate nel database contro letture di estranei, proposte su post privati non accessibili, fonti non HTTPS e approvazioni senza privilegi. Il percorso browser copre proposta, stato in attesa, revisione motivata, pubblicazione della nota e conservazione del post originale dopo ricaricamento.

## 10 settembre 2026 — salvati e avvisi

- Lint e TypeScript: superati.
- Unitari e SQL PGlite: 51 test superati, incluse policy dei salvati, revoca per blocco/scadenza, isolamento dai moderatori e vincoli degli avvisi.
- Build produzione Turbopack: superata fuori sandbox dopo rinnovo della cache che conservava un errore di apertura porta.
- Audit npm: zero vulnerabilità.
- Browser: 34/36 superati al primo giro desktop/mobile. I due test delle storie avevano un'aspettativa errata sulla chiusura dopo «Salta»: corretto il test per il passaggio all'autore successivo, entrambi superati al secondo giro. Nuovi test di salvataggi e avvisi dei post riconfermati (4/4).
- Controllo visivo desktop/mobile effettuato. Il detector segnala due convenzioni preesistenti (font Arial e bordo laterale nelle note); nessun nuovo finding introdotto da queste funzioni.
- Nessuna migrazione cloud o verifica Auth/Storage remota eseguita: applicare tutte le migrazioni sul progetto SN dedicato e completare il collaudo prima degli inviti reali. Le policy seguono la documentazione [RLS di Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 11 settembre 2026 — ciclo di vita della chat

- Lint senza avvisi, TypeScript e build produzione: superati.
- 56 test unitari, crittografici e SQL PGlite superati. Nuove prove: scadenza nulla, impostazioni condivise, revisione autenticata, limite 30 minuti, lettura che impedisce la modifica, ricevute obsolete, eliminazione personale/globale e retry dopo consegna solo dispositivo.
- 38 test Playwright desktop/mobile superati: include chat ordinaria, modifica, due cancellazioni, modalità temporanea, allegati e regressioni dei flussi precedenti.
- Audit dipendenze di produzione: zero vulnerabilità.
- Controllo visivo desktop 1440 px e mobile 412 px: nessun overflow orizzontale. Conversazione più leggibile, impostazioni separate dal composer e stati con etichette accessibili. Screenshot locali in `artifacts/chat-lifecycle-desktop.png` e `artifacts/chat-lifecycle-mobile.png`.
- Detector Impeccable: due rilievi preesistenti (Arial e bordo laterale delle note); nessun nuovo rilievo sulla chat.
- Non eseguiti: migrazione cloud, Auth/Storage remoti, concorrenza su connessioni Postgres separate. Applicare la migrazione `20260911085314_chat_lifecycle.sql` sul progetto SN dedicato prima di usare queste API con utenti reali. I test SQL seriali verificano ordine degli eventi e revisioni obsolete, non sostituiscono il collaudo distribuito.

## 11 settembre 2026 — recupero account

- Lint, TypeScript e build produzione superati.
- 17 test mirati sulle regole superati, inclusa la corrispondenza delle due password.
- Pagina del link assente o scaduto verificata in Playwright su desktop e mobile: 2 test superati.
- La suite completa resta affidata alla CI del commit. Il flusso email, la notifica di cambio password e la revoca tra due browser richiedono il progetto Supabase dedicato con SMTP configurato.

## 11 settembre 2026 — registro di moderazione

- Lint e TypeScript superati; build produzione completata.
- 53 test mirati TypeScript e SQL superati. Le prove verificano scrittura atomica del registro per note e rimozioni, invisibilità ai membri e impossibilità di aggiornare direttamente lo stato delle segnalazioni.
- Il percorso di revisione delle note, incluso il nuovo registro, è passato in Playwright su desktop e mobile.
- Migrazione locale verificata con PGlite; applicazione e collaudo sul progetto cloud ancora necessari.

## 11 settembre 2026 — ricerca full-text

- Lint, TypeScript e build produzione superati.
- 36 test SQL mirati superati. La prova verifica presenza dell’indice GIN, risultato per un follower autorizzato e nessun risultato per un estraneo.
- La query usa `websearch` con dizionario italiano e restituisce una lista vuota per ricerche vuote. Migrazione cloud ancora da applicare.

## 11 settembre 2026 — backup e ripristino

- Lint, TypeScript e build produzione superati.
- Due test mirati verificano la guida del comando e il rifiuto di destinazioni relative o interne al repository.
- Non è stato eseguito un dump remoto: servono la connessione del progetto SN e una chiave GPG dedicata. La prima prova di ripristino e la copia separata degli oggetti Storage restano attività operative.

## 20 settembre 2026 — reazioni federate e blocklist

- Lint e TypeScript superati; 99 test unitari e SQL PGlite superati.
- L’inbox registra `Like`, `Undo` e `Reject` firmati senza creare profili locali né mescolare i like remoti con quelli della community.
- La blocklist delle istanze viene controllata prima e dopo la risoluzione DNS ed è interrogabile soltanto dal service role.
- La build Turbopack non è arrivata alla compilazione: l’host ha negato l’apertura della porta interna usata dal loader CSS. Il tentativo Webpack si è fermato leggendo l’output `tsc --showConfig`; il typecheck diretto passa. Questi due errori di ambiente non sostituiscono una build riuscita in CI.
- Migrazione non applicata al progetto cloud e interoperabilità con Mastodon o Pixelfed non collaudata. Il worker delle consegne resta disattivato.

## 21 settembre 2026 — oggetti e chiavi remote

- Lint e TypeScript superati; 71 test mirati unitari e SQL PGlite superati. La suite completa conta 104 test superati.
- L’inbox accetta Note incorporate con `Create`, ne applica la sostituzione completa con `Update` e cancella il contenuto con `Delete`. I test coprono deduplicazione, attribuzione e origin, destinatario, tombstone e isolamento dal ruolo `authenticated`.
- La cache delle chiavi remote è privata, scade dopo sei ore e consente un solo recupero dopo il fallimento di una firma verificata con una chiave memorizzata.
- Il recupero del documento dell’attore e il worker delle consegne usano l’indirizzo pubblico già verificato per la connessione HTTPS, senza una seconda risoluzione DNS.
- Il limite di 120 attività l’ora per attore remoto e destinatario locale viene applicato nel database dopo la deduplicazione; i retry della stessa attività restano idempotenti.
- Le Note remote sono convertite da HTML a testo inerte, ordinate insieme ai post locali e mostrate con origine e limiti delle interazioni. La demo è stata verificata a 1440 × 1000 e 390 × 844 senza overflow o error overlay. Axe non rileva violazioni WCAG A/AA; restano due controlli di contrasto inconcludenti su glifi decorativi. Il detector Impeccable non segnala problemi nei file modificati.
- Playwright: 47 test su 50 sono passati nel primo giro contro il server di sviluppo. Due test delle notifiche esponevano una corsa nell’apertura di IndexedDB, corretta aspettando il caricamento della piazza. Il test mobile delle Note era coperto dal toolbar di sviluppo di Next; l’invocazione diretta dello stesso pulsante ha confermato il flusso. I percorsi falliti sono poi passati su entrambe le viewport.

## 22 settembre 2026 — moderazione dei contenuti federati

- Lint completo superato; build di produzione con webpack superata; 106 test unitari e SQL PGlite e 52 test Playwright desktop/mobile superati.
- Il test SQL verifica che si possa segnalare soltanto una Nota ricevuta, impedisce i duplicati, limita la decisione ai moderatori e registra chi ha nascosto l’oggetto. Una rimozione locale resta distinta dal `Delete` federato.
- Restano da eseguire il collaudo tra server, l’applicazione della migrazione sul progetto cloud dedicato e la verifica delle consegne del worker. La build Turbopack non può aprire la porta interna del loader CSS su questo host; la build webpack completa compilazione, TypeScript e generazione delle pagine.

## 22 settembre 2026 — backup degli oggetti Storage

- Lint, TypeScript e build webpack superati; la suite unitaria e SQL conta 109 test superati.
- Il backup include il bucket privato `media` nello stesso archivio GPG dei dump, con checksum per file, conteggio e dimensione nel manifesto.
- I test coprono nomi oggetto ostili, codifica degli URL, cartelle, autenticazione delle richieste e scrittura dei file senza credenziali. La prova con un progetto Supabase reale e il primo ripristino trimestrale restano operazioni da eseguire sull’infrastruttura dedicata.

## 22 settembre 2026 — moderazione delle istanze federate

- Lint, TypeScript, 109 test unitari/SQL e build webpack superati. Il flusso browser di federazione e moderazione passa su desktop e mobile senza errori JavaScript.
- Hostname normalizzato, motivazione obbligatoria, blocco e sblocco sono limitati ai moderatori. Ogni decisione entra nel registro; recupero chiavi e consegne continuano a usare la stessa blocklist privata.
- Il detector Impeccable non segnala problemi nei file modificati. Restano il collaudo con server federati reali e la valutazione operativa delle regole di blocco prima dell’apertura.

## 24 settembre 2026 — gestione delle cerchie

- Lint e TypeScript superati; 77 test mirati di regole e database superati.
- Le prove SQL coprono rinomina, promozione e revoca del ruolo admin, rimozione di un membro, sondaggi privati, revoca immediata dell’accesso e cancellazione senza rendere pubblici i post della cerchia.
- Sei test Playwright superati su desktop e mobile: mini-feed separato dalla piazza, gestione dei membri, rinomina persistente e pubblicazione dal composer verso la cerchia scelta.
- L’export personale include cerchie, membership e collegamenti ai post. La cancellazione rimuove inviti e contenuti esclusivi; un post destinato anche ad altre cerchie resta visibile soltanto in quelle cerchie.
- Il detector Impeccable non segnala problemi nei quattro file UI modificati. Il controllo visivo a 1440 × 960 e 390 × 844 non mostra overflow; il composer lungo scorre all’interno del dialogo.
- La migrazione non è stata applicata al progetto Supabase cloud. La build resta bloccata su questo host dai limiti già documentati di Turbopack e dal parsing di `tsc --showConfig` nel percorso Webpack.

## 25 settembre 2026 — immagini delle cerchie

- Le immagini facoltative sono disponibili nella creazione e modifica delle cerchie, con fallback alle iniziali.
- L’accesso Storage segue l’appartenenza alla cerchia; i file in uso sono esclusi dalla pulizia automatica.
- TypeScript, lint, 110 test unitari/SQL e build Webpack superati. Il flusso browser di modifica e persistenza passa su desktop e mobile.
- Il detector Impeccable non segnala problemi nei file UI modificati. Resta da applicare e collaudare la migrazione sul progetto Supabase dedicato.

## 25 settembre 2026 — prima versione degli eventi

- Creazione per follower approvati o cerchia, luogo testuale, intervallo, capienza e risposte idempotenti implementati in demo, API e migrazione locale.
- Commenti, aggiornamenti dell’organizzatore, annullamento e relative notifiche rispettano la visibilità dell’evento.
- I test SQL coprono isolamento, capienza, risposte ripetute, ruoli e notifiche. Il percorso browser passa su desktop e mobile con persistenza IndexedDB.
- Restano modifica dei dettagli, album collaborativo dopo l’inizio e collaudo cloud.

## 25 settembre 2026 — dettagli degli eventi e album collaborativo

- La modifica dei dettagli è riservata all’organizzatore; le variazioni sostanziali di data, fine o luogo generano una sola notifica per chi ha risposto «Partecipo» o «Forse». La capienza non può scendere sotto i partecipanti confermati e non è possibile spostare l’inizio nel passato.
- L’album (`event_photos`) si apre solo dopo l’inizio: possono aggiungere foto l’organizzatore e chi ha confermato la partecipazione; autore e organizzatore possono rimuoverle. I media seguono le stesse quote e la stessa pulizia di post, messaggi e immagini delle cerchie.
- L’export personale include `event_photos`; la cancellazione resta gestita dalle catene esistenti su `events` e `media_assets`.
- TypeScript, lint mirato, 112 test unitari/SQL e build Webpack superati. Il nuovo test SQL verifica permessi, album chiuso prima dell’inizio e dopo la mancata conferma, isolamento tra utenti e pulizia Storage. Il percorso browser passa su desktop e mobile con persistenza IndexedDB.
- La migrazione `20260925180000_event_details_and_album.sql` non è stata applicata al progetto Supabase cloud.

## 26 settembre 2026 — sezioni 6–9 in locale

- **Digest scelto dall’utente** (`digest_preferences`, `digest_sources`, `digest_deliveries`): spento di default, frequenza, fascia, fuso e canale scelti, email con consenso separato, massimo cinque elementi con motivo spiegabile e rigenerazione idempotente per periodo. Le reazioni sono private e non esiste alcuna cronologia delle aperture.
- **Post collaborativi e album condivisi** (`collaborative_posts`, `collaborators`, `album_items`): inviti tra contatti reciproci con accettazione, permessi revocabili dall’autore, chiusura dell’album e contributi bloccati dopo rimozione o chiusura. Le funzioni di disponibilità e pulizia dei media includono ora `album_items`, quindi un file in uso non viene ripulito.
- **Conversazioni più espressive** (`reactions`, `comment_replies` tramite `comments.parent_id/quote`, `mentions`, `mention_preferences`, `shares`): reazioni private come i salvati, risposte con citazione dello stesso post, menzioni con preferenza del destinatario che rispetta blocchi e visibilità, condivisioni interne senza copia pubblica né contatori.
- **Scoperta intenzionale** (`explore_preferences`, `product_metrics_daily`): sezioni Esplora spiegate e nascondibili (contatti seguiti da contatti reciproci, hashtag); metriche aggregate senza `user_id`, leggibili solo dai moderatori e calcolate dal job di manutenzione.
- Verifiche locali: `npm run typecheck` superato, lint mirato pulito sui file toccati, **124 test unitari/SQL** superati (PGlite carica le quattro nuove migrazioni), `npm run build` (Turbopack) superato, `npm audit --omit=dev` senza vulnerabilità. I nuovi percorsi Playwright (digest, collaborazioni, espressioni, esplora) passano su desktop e mobile.
- Difetti preesistenti non introdotti da questo lavoro: i test browser `feed calmo`, `note della comunità`, `salvati` e, su mobile, `federazione` fallivano già su `HEAD` (la Nota federata più recente precede i post locali nel feed). Restano da correggere a parte.
- Le quattro migrazioni (`20260926120000_user_digest.sql`, `20260926130000_collaborative_posts.sql`, `20260926140000_expressiveness.sql`, `20260926150000_intentional_discovery.sql`) non sono state applicate al progetto Supabase cloud. Il canale email del digest resta non operativo: manca un provider di invio, quindi nell’attesa si usa solo `in_app`.


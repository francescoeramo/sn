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

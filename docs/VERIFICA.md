# Verifiche

<!-- sn-ios-context:start -->
> **Stato iOS al 27 ottobre 2026:** M1 chiusa per lo sviluppo; M2.1 lettura e
> player foto installati e accettati come funzionanti dal proprietario. Prossimo
> incremento: M2.2 pubblicazione foto, da iniziare alla ripresa.
> [Stato](STATO-IOS.md) · [Piano M2](PIANO-IOS-M2.md) · [Ripresa](PROSSIMA-SESSIONE.md)
> I verbali sotto restano storici; l’accettazione non aggiunge prove automatiche o ascolti VoiceOver.
<!-- sn-ios-context:end -->

## Eseguibili in locale

Il percorso testato è: interfaccia → salvataggio IndexedDB → ricaricamento → interfaccia. I test browser coprono desktop e mobile, pubblicazione, like, commenti, ricerca, profilo, esportazione e messaggi. Controllano anche assenza di richieste a terzi dalla demo, assenza di errori JavaScript, dimensioni del viewport, rifiuto CSRF e federazione disattivata.

`npm test` verifica le regole TypeScript, i limiti del corpo HTTP e schema/RLS Postgres tramite PGlite. `npm run lint`, `npm run typecheck` e `npm run build` verificano il codice applicativo. Il risultato finale dei comandi è registrato in `docs/TEST-RESULTS.md`.

## Da eseguire sul progetto Supabase dedicato

1. Crea due inviti, verifica invito scaduto, email errata e riuso; registra due utenti e conferma le email. Verifica che Auth diretto senza invito fallisca. Controlla che non appaiano inviti nei JWT/metadati.
2. Pubblica foto, video e testo dal primo account privato. Dal secondo, controlla che post e URL media siano inaccessibili prima dell’approvazione; approva il follow, poi blocca il secondo utente e verifica nuovamente gli stessi URL.
3. Prova messaggi prima e dopo follow reciproco. Con un terzo account verifica che messaggi, notifiche e segnalazioni degli altri siano illeggibili tramite API diretta. Verifica che la chiave pubblica non possa invocare il job di pulizia né assegnare un moderatore.
4. Supera i limiti di file e quota con upload concorrenti. Controlla che Storage usi dimensione e MIME effettivi nei metadati verificati dalla policy. Lascia scadere una storia e controlla sia il record sia l’URL media. Esegui due job di pulizia e verifica l’idempotenza.
5. Esporta dati con più di una pagina; elimina un account, verifica file e messaggi rimossi e token vecchi respinti. Interrompi una rimozione Storage in ambiente di test e verifica che la manutenzione completi la cancellazione senza riaprire l’accesso.
6. Richiedi il recupero con un’email esistente e una inesistente: la risposta deve essere identica. Verifica scadenza del link, cambio password, email di notifica e revoca dei refresh token su due browser. Un access token già emesso può restare valido fino a 5 minuti, limite imposto dal formato JWT di Supabase.

Eseguire anche gli advisor Supabase su RLS e funzioni privilegiate. Aggiornamento
15 ottobre 2026: sul solo progetto SN `sndb` sono applicate 47 migrazioni; verificati
ruolo moderatore, permessi RPC e vincolo MFA SQL aal1/aal2. I ban sono coperti da test
SQL locali e browser; nessun utente reale è stato bannato per il collaudo. Restano
56 warning sulle RPC autenticate intenzionali e la protezione password compromesse
non disponibile nel piano gratuito. Nessun upgrade o deploy pubblico eseguito.
Queste verifiche parziali non segnano come superata l'intera checklist Auth/Storage.

## Client iOS

M0 funzionante confermata e M0.5 completata con CryptoKit. M1 è implementata e
installata; gli XCTest Linux sessione/HTTP e le fixture device non sostituiscono
picker manuale e audit/accessibilità con ascolto VoiceOver. I gate sono elencati
in [STATO-IOS.md](STATO-IOS.md), i verbali in [IOS-M1-VERIFICA.md](IOS-M1-VERIFICA.md).
M2 storie è solo pianificata: [PIANO-IOS-M2.md](PIANO-IOS-M2.md). Nessun esito
M2 può essere attribuito alle suite o ai rapporti M1.

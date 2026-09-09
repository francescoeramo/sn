# Verifiche

## Eseguibili in locale

Il percorso testato è: interfaccia → salvataggio IndexedDB → ricaricamento → interfaccia. I test browser coprono desktop e mobile, pubblicazione, like, commenti, ricerca, profilo, esportazione e messaggi. Controllano anche assenza di richieste a terzi dalla demo, assenza di errori JavaScript, dimensioni del viewport, rifiuto CSRF e federazione disattivata.

`npm test` verifica le regole TypeScript, i limiti del corpo HTTP e schema/RLS Postgres tramite PGlite. `npm run lint`, `npm run typecheck` e `npm run build` verificano il codice applicativo. Il risultato finale dei comandi è registrato in `docs/TEST-RESULTS.md`.

## Da eseguire sul progetto Supabase dedicato

1. Crea due inviti, verifica invito scaduto, email errata e riuso; registra due utenti e conferma le email. Verifica che Auth diretto senza invito fallisca. Controlla che non appaiano inviti nei JWT/metadati.
2. Pubblica foto, video e testo dal primo account privato. Dal secondo, controlla che post e URL media siano inaccessibili prima dell’approvazione; approva il follow, poi blocca il secondo utente e verifica nuovamente gli stessi URL.
3. Prova messaggi prima e dopo follow reciproco. Con un terzo account verifica che messaggi, notifiche e segnalazioni degli altri siano illeggibili tramite API diretta. Verifica che la chiave pubblica non possa invocare il job di pulizia né assegnare un moderatore.
4. Supera i limiti di file e quota con upload concorrenti. Controlla che Storage usi dimensione e MIME effettivi nei metadati verificati dalla policy. Lascia scadere una storia e controlla sia il record sia l’URL media. Esegui due job di pulizia e verifica l’idempotenza.
5. Esporta dati con più di una pagina; elimina un account, verifica file e messaggi rimossi e token vecchi respinti. Interrompi una rimozione Storage in ambiente di test e verifica che la manutenzione completi la cancellazione senza riaprire l’accesso.

Eseguire anche gli advisor Supabase su RLS e funzioni privilegiate. In questa sessione nessuna migrazione è stata applicata ai due progetti esistenti. Il deploy e il collaudo Auth/Storage cloud non sono stati eseguiti.

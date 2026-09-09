# Architettura e lavoro ancora necessario

## Confini

`components/` contiene l’interfaccia React. `lib/core/` contiene tipi, regole e identità indipendenti da Next.js, riutilizzabili in una futura app React Native. `lib/client/` gestisce demo e preparazione media. `lib/server/` gestisce sessioni e query Supabase. Le API usano cookie HttpOnly: un’app nativa richiederà un adapter di autenticazione con bearer token, mantenendo le stesse regole di dominio.

Non serve ancora un monorepo. Non ci sono dipendenze da Vercel KV, Blob, code a pagamento o servizi di rendering immagini a consumo. Auth e Storage sono Supabase; Postgres conserva contenuti, relazioni, quote e policy. Le chiavi privilegiate servono solo a cancellazione account e manutenzione, dopo controlli separati. Le operazioni social usano il token dell’utente e RLS.

## Sicurezza e confini dei test

Le policy SQL negano accesso anonimo alla community. I profili privati richiedono follow approvato. I blocchi interrompono i follow e impediscono nuovi messaggi. Le credenziali di invito sono validate dal trigger di creazione Auth e rimosse dai metadati. Il limite iscritti è protetto da un lock sul record impostazioni; quello degli upload da prenotazioni che contano anche i tentativi incompleti.

Le colonne privilegiate e i timestamp non sono modificabili dal ruolo `authenticated`. I messaggi richiedono follow reciproco. Le notifiche sono generate da trigger e non inseribili dal client. Gli endpoint di scrittura controllano Origin, formato e dimensione effettiva del corpo. CSP usa nonce; i dati autenticati non sono memorizzabili in cache pubbliche. Supabase Auth applica i propri limiti al login; i trigger limitano le scritture social riuscite. Il tempo minimo della risposta di login riduce differenze banali ma non costituisce una garanzia matematica contro ogni analisi temporale di rete.

PGlite esegue il vero motore Postgres e verifica schema, trigger e RLS con ruoli distinti. Gli schemi Auth e Storage nel test sono riproduzioni minime: non verificano GoTrue, API Storage, email, proxy del provider o concorrenza tra connessioni. Prima del deploy servono i test reali descritti in VERIFICA.md.

La durata massima video è controllata nel browser. Il server verifica dimensione e firma del contenitore, ma non esegue ffprobe/antivirus né certifica la durata dei file inviati via API. Per la beta su invito il limite di byte protegge la quota; prima di aprire a sconosciuti va introdotta una pipeline media con decodifica e convalida in isolamento. La ricodifica browser dipende da MediaRecorder/captureStream; se non disponibile, si accettano solo file già entro 3 MiB.

## Federazione: predisposta, non implementata

Gli UUID `actor_key` e `activity_key` permettono URI stabili indipendenti dal nome utente. Sono presenti tabelle private per coda e blocchi delle istanze. `/.well-known/webfinger` e `/ap/*` rispondono **503**: non espongono profili, non accettano attività e non eseguono fetch remoti. Non basta cambiare una variabile per attivare una federazione incompleta.

La libreria candidata è [Fedify](https://fedify.dev/manual/federation), con [licenza MIT](https://github.com/fedify-dev/fedify/blob/main/LICENSE). Gestisce dispatcher, firme e trasporto ActivityPub; l’adapter Postgres evita un servizio Redis separato. Non è stata aggiunta come dipendenza inutilizzata.

Per abilitarla servono:

1. Dominio stabile, chiavi attore e lifecycle di rotazione, endpoint WebFinger/Actor/Note/inbox/outbox collegati a Fedify.
2. Coda persistente con retry, deduplicazione, firma/verifica HTTP e limiti di consegna. Nessuna memoria locale come unica coda su Vercel.
3. Fetch remoto con protezione SSRF, verifica DNS e redirect, blocco reti private, limiti su payload e timeout; niente accesso al database privilegiato da payload federati.
4. Opt-in esplicito per contenuti pubblici, gestione Follow/Accept/Undo/Delete e ritiri da account privati. Le storie e i DM restano locali inizialmente.
5. Test incrociati con Mastodon e Pixelfed, moderazione delle istanze e bilancio di banda/storage prima dell’apertura.

Questa parte del brief resta aperta: non presentare SN come interoperabile con il Fediverse finché questi test non passano.

## Funzioni future e limiti attuali

Live streaming avrà un servizio separato e una tabella sessioni collegata agli attori; non deve passare dal piccolo endpoint di upload. E2EE richiederà un protocollo e librerie verificate, gestione chiavi e recupero dispositivi. Donazioni richiederanno una scelta di sostenibilità e la verifica dei termini dell’hosting.

La prima schermata carica 40 post, 300 commenti recenti, 100 messaggi recenti e 50 notifiche. Sono disponibili API per paginare post e conversazioni; ricerca interroga anche il database. I contatori commenti/like della schermata attuale derivano dai record caricati: prima di una beta con attività intensa vanno sostituiti da aggregazioni RLS sul DB e va completata la navigazione delle conversazioni più vecchie. L’esportazione scorre tutte le pagine, non solo il feed caricato.

La pagina privacy è una bozza operativa. La scelta della regione UE riguarda residenza dei dati, non nazionalità o indipendenza dei fornitori: Vercel e Supabase non rendono l’infrastruttura interamente europea. Nessuna dichiarazione di conformità GDPR/DSA è stata certificata. Contatti, titolare, basi giuridiche, conservazione effettiva, modalità di ricorso e documentazione dei fornitori vanno completati prima di aprire a utenti reali.

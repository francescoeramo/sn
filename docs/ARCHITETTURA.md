# Architettura e lavoro ancora necessario

## Confini

`components/` contiene l’interfaccia React. `lib/core/` contiene tipi, regole e identità indipendenti da Next.js, riutilizzabili in una futura app React Native. `lib/client/` gestisce demo e preparazione media. `lib/server/` gestisce sessioni e query Supabase. Le API usano cookie HttpOnly: un’app nativa richiederà un adapter di autenticazione con bearer token, mantenendo le stesse regole di dominio.

Non serve ancora un monorepo. Non ci sono dipendenze da Vercel KV, Blob, code a pagamento o servizi di rendering immagini a consumo. Auth e Storage sono Supabase; Postgres conserva contenuti, relazioni, quote e policy. Le chiavi privilegiate servono solo a cancellazione account e manutenzione, dopo controlli separati. Le operazioni social usano il token dell’utente e RLS.

## Sicurezza e confini dei test

Le policy SQL negano accesso anonimo alla community. I profili privati richiedono follow approvato. I blocchi interrompono i follow e impediscono nuovi messaggi. Le credenziali di invito sono validate dal trigger di creazione Auth e rimosse dai metadati. Il limite iscritti è protetto da un lock sul record impostazioni; quello degli upload da prenotazioni che contano anche i tentativi incompleti.

Le colonne privilegiate e i timestamp non sono modificabili dal ruolo `authenticated`. I messaggi richiedono follow reciproco. Le notifiche sono generate da trigger e non inseribili dal client. Gli endpoint di scrittura controllano Origin, formato e dimensione effettiva del corpo. CSP usa nonce; i dati autenticati non sono memorizzabili in cache pubbliche. Supabase Auth applica i propri limiti al login; i trigger limitano le scritture social riuscite. Il tempo minimo della risposta di login riduce differenze banali ma non costituisce una garanzia matematica contro ogni analisi temporale di rete.

PGlite esegue il vero motore Postgres e verifica schema, trigger e RLS con ruoli distinti. Gli schemi Auth e Storage nel test sono riproduzioni minime: non verificano GoTrue, API Storage, email, proxy del provider o concorrenza tra connessioni. Prima del deploy servono i test reali descritti in VERIFICA.md.

La durata massima video è controllata nel browser. Il server verifica dimensione e firma del contenitore, ma non esegue ffprobe/antivirus né certifica la durata dei file inviati via API. Per la beta su invito il limite di byte protegge la quota; prima di aprire a sconosciuti va introdotta una pipeline media con decodifica e convalida in isolamento. La ricodifica browser dipende da MediaRecorder/captureStream; se non disponibile, si accettano solo file già entro 3 MiB.

## Federazione: trasporto locale in anteprima

Gli UUID `actor_key` e `activity_key` permettono URI stabili indipendenti dal nome utente. In sviluppo, `FEDERATION_DISCOVERY_PREVIEW=true` abilita WebFinger, Actor, outbox, Note/Create e l’inbox dei profili pubblici e attivi che hanno dato un consenso separato. Rendere privato il profilo revoca il consenso. `/users/:username` è un alias leggibile; l’ID canonico dell’attore resta `/ap/actors/:actor_key`. Note e Create usano l’`activity_key` stabile del post su percorsi distinti. La variabile è ignorata in produzione.

Senza questa anteprima, `/.well-known/webfinger` e `/ap/*` rispondono **503**. L’anteprima non espone storie, account privati, account disabilitati o post che contengono soltanto media. Foto e video allegati ai post testuali passano da `/ap/media/:activity_key`: il server ricontrolla profilo, opt-in e post prima di leggere il file dal bucket privato, senza esporne il percorso. Le collezioni `followers` e `following` restano vuote e non rivelano il grafo sociale locale.

Ogni attore federato ha una coppia RSA. Il database conserva la chiave privata cifrata con AES-256-GCM e `FEDERATION_KEY_SECRET`; l’Actor pubblica solo la chiave pubblica. L’inbox accetta `Follow`, `Like`, `Reject`, `Create`, `Update`, `Delete` e i relativi `Undo` con firma RSA-SHA256, digest, data e destinatario validi. Le Note incorporate devono appartenere allo stesso attore e origin dell’attività ed essere indirizzate all’attore locale, ai suoi follower o al pubblico. Restano in una tabella privata separata dai post locali; `Update` sostituisce la copia e `Delete` conserva soltanto la tombstone. Lo snapshot server legge solo le Note destinate all’utente corrente, converte l’HTML remoto in testo inerte e le marca nel feed come contenuti del Fediverso. Non offre azioni locali che il protocollo non ha ancora collegato. I like remoti sono separati dagli account e dai like locali; i reject registrano la risposta senza confonderla con l’esito HTTP della consegna.

Il recupero della chiave remota e le consegne richiedono HTTPS, applicano la blocklist prima e dopo la connessione, vietano redirect e indirizzi privati o riservati e limitano risposta e tempo di attesa. Le richieste HTTPS usano l’indirizzo già verificato mantenendo hostname e verifica TLS, quindi non eseguono una seconda risoluzione esposta al DNS rebinding. Le chiavi verificate restano in una cache privata per sei ore. Se una firma non corrisponde a una chiave in cache, l’inbox recupera una sola volta il documento dell’attore e riprova, così una rotazione non blocca l’attore fino alla scadenza. Le attività sono deduplicate; dopo il controllo dei duplicati, il database accetta al massimo 120 attività l’ora per la stessa coppia attore remoto–destinatario locale. Rendere privato o sospendere un profilo disattiva la federazione nello stesso aggiornamento e crea un ritiro persistente; la manutenzione accoda la `Delete` dell’attore prima di cancellare i follower remoti.

Gli `Accept`, i `Create` dei nuovi post testuali e i relativi `Delete` entrano in una coda persistente, con una consegna distinta per ogni inbox remota. `POST /api/maintenance` li consegna solo con `FEDERATION_DELIVERY_ENABLED=true`, quattro per esecuzione, con firma HTTP e retry dopo 5 minuti, 30 minuti, 2 ore e 12 ore. Il quinto errore chiude la consegna. La produzione resta disattivata e non è stata provata con server Mastodon o Pixelfed reali.

La libreria candidata è [Fedify](https://fedify.dev/manual/federation), con [licenza MIT](https://github.com/fedify-dev/fedify/blob/main/LICENSE). Gestisce dispatcher, firme e trasporto ActivityPub; l’adapter Postgres evita un servizio Redis separato. Non è stata aggiunta come dipendenza inutilizzata.

Per abilitarla servono:

1. Dominio stabile, rotazione delle chiavi e passaggio controllato dall’anteprima alla produzione.
2. Moderazione, allegati e paginazione degli oggetti remoti già conservati. Storie e DM restano locali.
3. Test incrociati con Mastodon e Pixelfed, moderazione delle istanze e bilancio di banda/storage prima dell’apertura.

Questa parte del brief resta aperta: non presentare SN come interoperabile con il Fediverse finché questi test non passano.

## Funzioni future e limiti attuali

Live streaming avrà un servizio separato e una tabella sessioni collegata agli attori; non deve passare dal piccolo endpoint di upload. E2EE richiederà un protocollo e librerie verificate, gestione chiavi e recupero dispositivi. Donazioni richiederanno una scelta di sostenibilità e la verifica dei termini dell’hosting.

Le cerchie sono implementate localmente con membership privata, inviti accettati, ruoli protetti da RLS, mini-feed, destinazioni multiple, sondaggi, export e cancellazione. Manca l’immagine facoltativa e non è stato eseguito il collaudo cloud.

Le sezioni 5–9 restano domini futuri. Gli eventi dipendono dal perimetro di visibilità delle cerchie e devono separare organizzatore, invitati, risposte e contenuti associati. Il digest e la scoperta intenzionale richiedono query server-side spiegabili, senza profili comportamentali o cronologia delle aperture. Collaborazioni, album, reazioni, risposte, menzioni e condivisioni interne richiedono vincoli idempotenti e devono rispettare blocchi, rimozioni, quote, export e cancellazione account. Ogni dominio va consegnato con migrazione, API, demo offline e test, senza anticipare strutture parziali nello schema di produzione.

La prima schermata carica 40 post, 300 commenti recenti, 100 messaggi recenti e 50 notifiche. Sono disponibili API per paginare post e conversazioni; ricerca interroga anche il database. I contatori commenti/like della schermata attuale derivano dai record caricati: prima di una beta con attività intensa vanno sostituiti da aggregazioni RLS sul DB e va completata la navigazione delle conversazioni più vecchie. L’esportazione scorre tutte le pagine, non solo il feed caricato.

La pagina privacy è una bozza operativa. La scelta della regione UE riguarda residenza dei dati, non nazionalità o indipendenza dei fornitori: Vercel e Supabase non rendono l’infrastruttura interamente europea. Nessuna dichiarazione di conformità GDPR/DSA è stata certificata. Contatti, titolare, basi giuridiche, conservazione effettiva, modalità di ricorso e documentazione dei fornitori vanno completati prima di aprire a utenti reali.

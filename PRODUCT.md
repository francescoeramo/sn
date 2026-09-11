# SN — Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SN è un social generalista in italiano, in stile Instagram, inizialmente per Francesco e i suoi amici. La beta è su invito, limitata a 20 account; l'apertura successiva deve essere graduale, tramite inviti monouso. Le persone lo usano per condividere momenti, pubblicare testo e media e conversare con i propri contatti; non è una community specializzata in fotografia.

## Product Purpose

Creare uno spazio indipendente in cui coltivare relazioni e condividere contenuti senza consumo compulsivo. L'ambizione di lungo periodo è un'alternativa europea, etica e attenta alla privacy alle grandi piattaforme social. Il successo consiste in scambi significativi e controllo da parte delle persone, non nella massimizzazione del tempo trascorso nell'app.

## Positioning

Accesso iniziale su invito, feed cronologico e finito, nessun contatore pubblico di like, nessuna monetizzazione pubblicitaria, privacy predefinita e moderazione umana costituiscono la direzione confermata. E2EE per i messaggi e interoperabilità pianificata con Mastodon/Pixelfed via ActivityPub sono impegni di prodotto: la loro disponibilità va distinta dallo stato di sviluppo. L'indipendenza europea è un obiettivo di prodotto, non una certificazione o una dichiarazione che l'infrastruttura attuale sia interamente europea.

## Operating Context

- Webapp da usare su smartphone e desktop, con interfaccia italiana.
- Percorsi principali: accesso con invito, feed, pubblicazione, storie e video brevi, ricerca di utenti e hashtag, profili e follow, chat tra contatti reciproci, notifiche, impostazioni e moderazione.
- La demo `/demo` funziona localmente, conserva le modifiche in IndexedDB e usa persone e contenuti inventati. Non autentica utenti reali e non invia messaggi ad altre persone.
- Lo stack esistente è Next.js, React e TypeScript, con Supabase per autenticazione, database e storage. Il comando locale è `npm run dev`; l'URL documentato è `http://127.0.0.1:3000/demo`.

## Capabilities and Constraints

- Costo operativo attuale zero: niente upgrade, servizi a pagamento o addebiti automatici. Iscrizioni e upload devono fermarsi ai limiti della beta. La disponibilità dei servizi gratuiti va verificata quando si procede al deploy.
- Beta iniziale: 20 account, profili privati per impostazione predefinita, inviti monouso associati all'email. Quote documentate: 3 MiB per allegato, 40 MiB per persona e 800 MiB complessivi.
- Feed cronologico con caricamento deliberato dei post precedenti e traguardo «Sei in pari». Evitare scorrimento infinito, meccanismi compulsivi e ranking volto a massimizzare il tempo d'uso. I conteggi dei like non sono pubblici nei pulsanti del feed.
- Supporto a testo, foto, video, storie effimere, commenti, follow, blocchi e messaggi tra utenti che si seguono reciprocamente.
- Dal requisito confermato l’11 settembre 2026, i nuovi messaggi ordinari devono restare senza scadenza finché non vengono eliminati. «Chat temporanea», attivabile da un pulsante nella conversazione, applica ai soli nuovi messaggi la durata scelta nelle impostazioni di quella chat: 1 ora, 3 ore, 24 ore, 48 ore, 1 settimana o 30 giorni dall’invio. Il cambio di modalità o durata non modifica lo storico. Questo requisito sostituisce l’autoeliminazione predefinita dopo 24 ore ed è implementato in demo, API e migrazione locale; il collaudo cloud resta da completare.
- Il mittente deve poter modificare un messaggio entro 30 minuti dall’invio originale soltanto se il destinatario non lo ha letto. La modifica non prolunga finestra o scadenza; il server deve verificare atomicamente lettura e modifica, mantenendo E2EE. Mostrare l’etichetta «Modificato».
- Stati richiesti: non inviato (attesa o errore con possibilità di riprovare), inviato (una spunta), consegnato ma non letto (due spunte neutre), letto (due spunte evidenziate). Il riferimento visivo è WhatsApp; ogni stato deve avere un’etichetta accessibile. Download in background e apertura dell’app non equivalgono a lettura.
- Durata e luogo di conservazione restano scelte distinte. La modalità solo dispositivo deve preservare le copie locali non scadute e prevedere consegna delle revisioni e delle ricevute. La revoca dell’accesso e la cancellazione fisica sono operazioni distinte; la pulizia server richiede manutenzione attiva.
- Privacy by design: minimizzazione dei dati, nessun tracker o pixel pubblicitario esterno e nessuna richiesta non necessaria a servizi terzi. Font di sistema o self-hosted, asset locali e architettura portabile.
- Le promesse di sicurezza devono corrispondere a comportamenti verificati. `docs/CRITTOGRAFIA.md` descrive la cifratura dei nuovi messaggi e allegati, chiavi private locali, conservazione sincronizzata o solo dispositivo e storico precedente in chiaro. Il protocollo non ha audit indipendente, non offre forward secrecy dello storico e non nasconde tutti i metadati. Non presentare l'intera piattaforma come zero-knowledge né promettere recupero automatico dello storico su nuovi browser.
- Moderazione manuale, segnalazioni e Note della comunità con fonti e revisione umana motivata. Le note approvate aggiungono contesto senza modificare il post originale. La discussione politica è ammessa; il brief vieta pornografia e contenuti sessualmente espliciti. Le procedure richieste dal brief non vanno dichiarate operative senza verifica.
- Nessuna pubblicità e nessuna monetizzazione via ads. Questo vincolo, confermato il 10 settembre 2026, sostituisce la precedente apertura alle sponsorizzazioni nel brief e nelle decisioni storiche. Eventuali forme di sostenibilità non pubblicitaria restano da decidere; donazioni, federazione, app native e live streaming non sono funzionalità da promettere come disponibili.
- Repository pubblico e componenti open source; la licenza del codice di SN è ancora da scegliere. Pubblicazione del repository non equivale a licenza open source.

## Brand Commitments

Il nome di lavoro è SN. Conservare il linguaggio italiano, il tono sobrio, diretto e accogliente e la centralità delle relazioni. Niente linguaggio da startup SaaS o growth hacking, urgenza artificiale, badge o gamification aggressiva.

Il brief vincola l'identità a un'estetica editoriale europea, calda e accogliente, ispirata alla carta, con contrasti morbidi e testo leggibile. Preferire una palette neutra/calda e gerarchie piatte adatte al feed. Evitare Inter come scelta automatica senza motivazione; valutare carattere nei titoli preservando la leggibilità del corpo. Mantenere uno stile illustrativo proprio e coerente con gli asset in `public/art`.

Anti-riferimenti espliciti: dashboard SaaS generica, gradienti viola-blu, card annidate, riquadri arrotondati con icona sopra ogni titolo; linguaggio visivo dei social pubblicitari, badge di engagement, contatori enfatizzati e notifiche rosse pervasive. Questi sono vincoli forniti dal proprietario, non una nuova definizione di palette, font o componenti.

## Requested Capabilities and Sequencing

Le seguenti richieste guidano la pianificazione futura. Non costituiscono un'attestazione di implementazione né autorizzano a presentarle come già disponibili.

- **Federazione ActivityPub:** pianificare l'impatto su post e follow prima di consolidare la UI attorno a un modello chiuso. Obiettivo: interoperabilità con Mastodon/Pixelfed, attore per ogni profilo pubblico su `/users/:username` con JSON-LD ActivityStreams, WebFinger per `@utente@dominio`, firma HTTP in uscita e verifica in entrata. Tradurre post, like e follow in attività `Create`, `Like`, `Follow`, `Accept` e `Reject` e gestire le attività ricevute. I profili privati non devono essere esposti come attori pubblici federabili.
- **Chat di gruppo:** affrontarla dopo la cifratura 1:1 della fase 3. Prevedere membership con ruoli admin/membro, inviti coerenti con il follow reciproco, rimozione dei membri, abbandono e rinomina. Le regole precise su chi può aggiungere chi restano da definire.
- **2FA e sessioni:** TOTP facoltativa per tutti e consigliata ai moderatori; pagina dispositivi e sessioni attive con revoca singola o di tutte tranne quella corrente. Mostrare la data dell'ultimo accesso; non raccogliere IP solo per questa funzione.
- **Sondaggi:** post con più opzioni, un voto per utente e scadenza opzionale.
- **Salvataggi:** associazione privata utente–post e sezione «Salvati» nel profilo, accessibile solo al proprietario.
- **Avvisi di contenuto / spoiler:** campo opzionale che nasconde corpo e media dietro un'azione esplicita. Prevederlo prima dell'attivazione della federazione.
- **Ricerca dei contenuti:** estendere utenti e hashtag con ricerca full-text nel testo dei post, rispettandone la visibilità, senza servizi esterni a pagamento; indice Postgres come opzione proposta.
- **Recupero account:** verificare reset password, scadenza breve del link email, invalidazione delle sessioni esistenti dopo il reset e notifica dell'operazione all'utente.
- **Anti-abuso:** verificare e completare rate limiting di login e registrazione. Valutare captcha leggero o proof-of-work locale solo se gli inviti diventano meno chiusi; scelta non ancora confermata.
- **Registro di moderazione:** tracciare chi ha rimosso, bannato o approvato cosa e quando, per trasparenza interna e contestazioni anche con più moderatori.

## Experience Requirements

- Onboarding dopo la registrazione: spiegare natura della beta, moderazione manuale, assenza di pubblicità e accesso alle impostazioni privacy prima di lasciare il nuovo invitato davanti a un feed vuoto.
- Stati vuoti di feed, messaggi, storie e ricerca: testo utile e illustrazione o icona coerente, con indicazioni pertinenti al contesto anziché il solo «Nessun contenuto».
- Modalità scura e temi: verificare quanto esiste e costruire gli sviluppi su variabili CSS/token condivisi.
- Caricamento di feed, storie e profili: preferire skeleton coerenti alla struttura del contenuto agli spinner generici.
- Micro-interazioni curate: avanzamento delle storie, feedback del like e transizioni dei reel, senza trasformarli in incentivi compulsivi.
- Spiegare prima del primo invio cifrato cosa succede perdendo browser o dispositivo e quali possibilità di recupero esistono realmente.

## Security and Continuity Requirements

- Verificare CSP e security headers, inclusi X-Frame-Options e Referrer-Policy, nella configurazione effettivamente distribuita. La presenza nel codice non sostituisce il controllo del comportamento.
- Predisporre export periodico dei dati e un piano scritto e verificabile di ripristino, oltre all'export JSON personale. Verificare le capacità correnti del piano infrastrutturale senza assumere disponibilità o durata dei backup automatici.
- Per le chiavi E2EE locali, scegliere esplicitamente tra storico irrecuperabile dopo perdita e backup opzionale cifrato dall'utente. Finché non esiste un recupero verificato, comunicarne l'assenza senza promesse implicite.

## Evidence on Hand

- `SN-prompt-progetto.md`: brief di prodotto e requisiti, inclusi obiettivi non ancora interamente implementati.
- `docs/DECISIONI.md`: decisioni della beta e successive fasi di sviluppo.
- `README.md`: avvio locale, funzioni, quote e prerequisiti operativi. Alcune descrizioni storiche della chat sono precedenti alla fase di cifratura: confrontarle con `docs/CRITTOGRAFIA.md` e con l'implementazione prima di riutilizzarle.
- `docs/CRITTOGRAFIA.md`: protocollo attuale, limiti e verifiche della chat.
- La descrizione «senza E2EE» fornita nell'elenco delle nuove richieste riflette uno stato precedente: la documentazione attuale descrive già il lavoro della fase 3. Conservare l'obiettivo E2EE senza retrocedere lo stato documentato; restano necessari i collaudi indicati.
- `app/ap/[...path]/route.ts` e `app/.well-known/webfinger/route.ts` esistono, ma rispondono con stato 503: sono predisposizioni, non federazione operativa. `proxy.ts` imposta una CSP; `next.config.ts` contiene altri security headers. Le richieste relative a questi punti sono verifiche e completamenti, non prova della loro totale assenza.
- `docs/VERIFICA.md`, `docs/TEST-RESULTS.md` e `docs/ARCHITETTURA.md`: evidenze e limiti tecnici da ricontrollare prima di affermazioni pubbliche.
- Demo e asset locali sono materiale dimostrativo, non testimonianze di clienti o prova di adozione. Non inventare utenti reali, metriche, certificazioni o risultati di audit.
- Il collaudo completo dei servizi cloud e lo stato del deploy richiedono verifica dedicata; questo documento non certifica la disponibilità pubblica della beta.

## Product Principles

1. Favorire relazioni e condivisione intenzionale, rispettando il tempo delle persone.
2. Rendere privacy, visibilità, scadenze e controllo dei dati comprensibili e concreti.
3. Dichiarare solo capacità e garanzie sostenute dall'implementazione e dalle verifiche.
4. Mantenere moderazione umana e trasparenza senza confondere opinioni e affermazioni fattuali.
5. Preservare costo zero nella beta, portabilità e indipendenza dai servizi proprietari non necessari.

## Open Decisions

Non è stato indicato uno standard di accessibilità specifico né ulteriori necessità assistive dei destinatari. Restano aperte la licenza del codice, le decisioni operative per estendere o pubblicare la beta, la sostenibilità non pubblicitaria, le regole dettagliate degli inviti ai gruppi e l'eventuale backup cifrato delle chiavi. L'ordine completo delle nuove funzionalità deve ancora essere pianificato; sono confermate le dipendenze indicate sopra.

La direzione di prodotto e le integrazioni sono state confermate dal proprietario il 10 settembre 2026. I vincoli nuovi prevalgono sui documenti storici in caso di conflitto; le descrizioni di implementazione restano soggette alle evidenze tecniche indicate.

## Decisioni aperte sulla chat

Definire chi può cambiare la modalità condivisa della conversazione e la durata, e l’ambito dell’eliminazione manuale (propria copia o entrambi). I requisiti completi e i casi limite sono nella sezione 4 di `SN-prompt-progetto.md`; non descriverli come funzionalità operative prima del collaudo.

- Nella chat «Elimina per me» nasconde il messaggio sui propri browser sincronizzati; «Elimina per tutti» è disponibile solo per i propri messaggi. Entrambi i partecipanti possono modificare modalità e durata condivise.
- Il recupero account non rivela se un indirizzo è registrato. Il link scade dopo 15 minuti; il cambio password revoca tutti i refresh token e richiede un nuovo accesso. Gli access token già emessi durano al massimo 5 minuti. La notifica di cambio password e la consegna del link dipendono dalla configurazione Auth/SMTP del progetto dedicato.
- Le decisioni dei moderatori su note e segnalazioni producono un registro non modificabile dall’app: moderatore, azione, contenuto interessato e data. Il registro è visibile solo ai moderatori e non conserva una copia dei contenuti rimossi.

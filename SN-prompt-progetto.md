# Prompt di progetto — "SN" (nome temporaneo)

Usa questo come prompt/brief per guidare lo sviluppo (con Claude Code, Astra o un altro coding agent), o come documento di riferimento architetturale del progetto.

---

## Contesto e obiettivo

Costruisci ed evolvi **SN**, una piattaforma social/media (foto, video, storie, messaggi) in stile Instagram, ma pensata fin dal principio come alternativa **europea, indipendente, etica e privacy-first** alle piattaforme Big Tech statunitensi. Il progetto parte su infrastruttura gratuita (free-tier Supabase + Vercel Hobby), con codice pulito, auditabile e privo di lock-in proprietario.

### Principi guida non negoziabili:
1. **Privacy by design & Zero-Knowledge**: raccolta dati minima, nessun tracker o pixel pubblicitario di terze parti, nessuna chiamata verso servizi esterni non necessari (font di sistema o self-hosted).
2. **Sicurezza reale, non dichiarata**: ogni affermazione di sicurezza deve corrispondere a un'implementazione crittografica e architetturale verificabile (nessuna crittografia "finta", chiavi gestite client-side, nessun meccanismo fail-open).
3. **Mindful Engagement (Anti-dipendenza)**: SN rifiuta deliberatamente i meccanismi dopaminergici tossici di TikTok e Instagram (niente slot-machine pull-to-refresh, niente algoritmi oscuri di massimizzazione del tempo speso, niente doomscrolling infinito). L'applicazione deve **attirare e interessare per qualità, bellezza estetica, significato delle relazioni e cura artigianale**, non creando dipendenza compulsiva.
4. **Libertà di espressione con integrità informativa**: libertà di pensiero e di discussione politica garantita, con divieto assoluto per pornografia e contrasto strutturato alle fake news.
5. **Indipendenza e sostenibilità**: architettura sostituibile, portabilità dei dati, predisposizione per monetizzazione etica (sponsorizzazioni interne con approvazione umana, senza tracciamento).

---

## Filosofia di Design e UX: Coinvolgente ma Rispettosa del Tempo

SN è pensato per chi vuole ritrovare il piacere di condividere e conversare senza cadere nella trappola del consumo passivo:

- **Feed Calmo e Finito**: feed rigorosamente **cronologico**. Quando l'utente ha visualizzato tutti i contenuti recenti dei profili seguiti, l'interfaccia mostra un chiaro traguardo visivo (*"Sei in pari. La piazza per ora è tranquilla"*), invitando a chiudere l'app o a esplorare deliberatamente.
- **Metriche non tossiche (Calm UI)**: i contatori pubblici di like e follower sono rimossi o fortemente attenuati nei feed principali. L'autore può visualizzare le interazioni sul proprio contenuto, ma viene eliminata la gara alla popolarità tipica dei social tradizionali.
- **Identità visiva distintiva**:
  - Estetica editoriale europea, accogliente e calda (ispirata alla carta, contrasti morbidi, tipografia pulita e leggibile).
  - Micro-interazioni fluide, transizioni di stato organiche (stati vuoti curati, feedback tattile/visivo discreto, zero layout shift).
  - Design responsive nativo: perfetto sia su desktop sia su smartphone.

---

## Funzionalità del Sistema

### 1. Feed e Profili
- Registrazione/login sicuro (con email e invito protetto a livello database).
- Profili utente con bio, foto/avatar distintivo e **impostazione privata di default** (i post sono visibili solo ai follower approvati).
- Post con formati testo (fino a 2200 caratteri), foto (JPEG, PNG, WebP) o video (MP4, WebM).
- Ricerca istantanea di utenti e hashtag `#tag` estratti nativamente.
- Like, commenti con limiti anti-spam, follow/unfollow, gestione richieste di follow e blocco bidirezionale.

### 2. Storie con Autoplay e Player Avanzato
- Contenuti effimeri con scadenza reale a 24 ore nel database e nell'interfaccia.
- **Autoplay intelligente**:
  - Avanzamento automatico: timer configurato a 5 secondi per immagini, durata effettiva del media per i video (fino a 20s).
  - Barra di progresso segmentata in alto (un segmento per ciascuna storia attiva dell'utente).
  - Controlli gestuali/mouse: tap a destra per andare avanti, tap a sinistra per tornare indietro, pressione prolungata (tap-and-hold) per mettere in pausa.
  - Passaggio fluido alle storie dell'utente successivo al termine della sequenza.

### 3. Reels / Video Brevi
- Player dedicato per video brevi verticali (massimo 20 secondi).
- Compressione e ottimizzazione lato client prima dell'upload per preservare le quote del server.

### 4. Cerchie e spazi condivisi

Le cerchie sono piccoli spazi privati e intenzionali: per esempio «Amici stretti», «Calcetto», «Famiglia» o «Università». Non sono community pubbliche né canali di promozione.

- Ogni persona può creare una cerchia, scegliere nome, immagine facoltativa e descrizione breve, quindi invitare solo contatti con follow reciproco. L’invito richiede accettazione; un membro può uscire in ogni momento.
- Creatore e amministratori possono rinominare la cerchia, invitare, rimuovere membri e archiviare lo spazio. La rimozione revoca l’accesso ai contenuti futuri e a quelli non già esportati; non dichiarare revocabili screenshot o copie locali.
- Nel compositore, oltre a «follower approvati» e «community», l’autore può selezionare una o più cerchie. La visibilità effettiva è l’intersezione tra privacy del profilo, blocchi e membership della cerchia.
- Ogni cerchia offre un mini-feed cronologico, finito e senza ranking, con post, commenti, sondaggi ed eventi pertinenti. Non introdurre contatori pubblici, inviti automatici o suggerimenti invasivi.
- Schema proposto: `circles`, `circle_members`, `circle_posts`; RLS deve rendere leggibili membership e contenuti solo ai membri autorizzati, e impedire al client di assegnarsi ruoli o iscriversi da solo.

### 5. Eventi semplici

Gli eventi servono a trasformare una conversazione in un incontro o in un’attività reale, non a creare una piattaforma di ticketing.

- Un evento ha titolo, descrizione breve, inizio, fine facoltativa, luogo testuale facoltativo, visibilità (cerchia o follower approvati) e limite di partecipanti facoltativo. Non richiedere geolocalizzazione, mappe di terze parti o dati di pagamento.
- Gli invitati rispondono «Partecipo», «Forse» o «Non riesco». L’organizzatore vede l’elenco solo quando la visibilità dell’evento lo consente; i partecipanti non devono poter dedurre la presenza di persone a cui non hanno accesso.
- La pagina evento raccoglie commenti, aggiornamenti dell’organizzatore e un album collaborativo post-evento. Promemoria locali o email sono strettamente opt-in: niente pressione, streak o notifiche ripetute.
- Le modifiche sostanziali a data, luogo o annullamento generano una singola notifica utile agli invitati. Lo storico delle risposte deve registrare il consenso e rispettare blocchi, rimozioni e cancellazione account.
- Schema proposto: `events`, `event_invites`, `event_updates`; API idempotenti per risposte e RLS separata per organizzatore, invitati e contenuti associati.

### 6. Digest scelto dall’utente

Il digest dà un motivo sereno per rientrare senza trasformare il feed in un flusso infinito.

- La persona sceglie se riceverlo, con frequenza giornaliera o settimanale, fascia oraria e canale (in-app; email solo con consenso esplicito). L’impostazione predefinita è disattivata.
- Il digest contiene al massimo cinque elementi recenti: aggiornamenti di persone, cerchie o argomenti selezionati dall’utente e contenuti non ancora visti. Non usa profili comportamentali, punteggi opachi, dati di lettura venduti a terzi o contenuti sponsorizzati.
- L’ordinamento resta spiegabile: prima contenuti delle cerchie scelte, poi persone preferite, quindi altri post cronologici. Ogni elemento indica perché compare e permette di ridurre o interrompere quel tipo di suggerimento.
- La generazione deve avvenire lato server con query che rispettano RLS, privacy, blocchi, scadenze e avvisi di contenuto. Salvare solo preferenze e ultimo invio, non una cronologia di sorveglianza delle aperture.
- Schema proposto: `digest_preferences`, `digest_deliveries`; un job pianificato crea il digest e segna l’invio in modo idempotente. Se il job non è disponibile, l’app resta pienamente utilizzabile.

### 7. Post collaborativi e album condivisi

I post collaborativi permettono di raccontare insieme un viaggio, una serata o un progetto senza duplicare foto e conversazioni.

- L’autore invita collaboratori tra i contatti reciproci prima o dopo la pubblicazione. Un invito deve essere accettato; rifiuto, uscita o rimozione non generano notifiche pubbliche.
- I collaboratori approvati possono aggiungere media, didascalie o aggiornamenti entro i permessi scelti dall’autore. L’autore conserva la possibilità di pubblicare, nascondere elementi, revocare un invito o archiviare l’album.
- Un album ha una visibilità unica e comprensibile: non combinare automaticamente pubblico, privato e cerchie diverse. Se cambia la visibilità, spiegare a collaboratori e autore chi avrà accesso prima di confermare.
- Per gli eventi, l’album è disponibile solo dopo l’inizio dell’evento e può essere chiuso dall’organizzatore. Foto e video rispettano le quote già previste e non richiedono servizi di elaborazione esterni.
- Schema proposto: `collaborative_posts`, `collaborators`, `album_items`; transazioni e RLS devono impedire contributi dopo rimozione, blocco o scadenza della visibilità.

### 8. Conversazioni più espressive

Prendere la chiarezza di Discord e Threads, senza introdurre meccaniche di amplificazione pubblica.

- Reazioni leggere e private a post, commenti e messaggi: un set piccolo, accessibile e senza classifica. L’autore può vedere che una persona ha reagito, ma il feed non espone un punteggio competitivo.
- Risposte a uno specifico commento o passaggio di testo, con citazione breve e collegamento al contesto originale. Le citazioni devono rispettare la visibilità del contenuto: niente testo trasportato in uno spazio a cui il lettore non ha accesso.
- Menzioni con consenso: ogni persona sceglie chi può menzionarla. La notifica è singola, silenziabile e non viene inviata se esiste un blocco reciproco o se il contenuto non è visibile al destinatario.
- Condivisione interna con nota personale: invia un post a una chat o cerchia consentita, senza creare una copia pubblica, un contatore di condivisioni o una cascata di repost.
- Schema proposto: `reactions`, `comment_replies`, `mentions`, `shares`; vincoli univoci per una reazione per persona/tipo/oggetto e trigger per notifiche idempotenti.

### 9. Scoperta intenzionale e salute del prodotto

SN deve aiutare a ritrovare persone e conversazioni, non decidere cosa guardare per massimizzare il tempo trascorso.

- La pagina Esplora propone solo percorsi espliciti: hashtag scelti, persone seguite da contatti già approvati e profili locali o nuovi che l’utente ha scelto di cercare. Ogni sezione dice quale relazione o interesse l’ha prodotta e può essere nascosta.
- Non creare una scheda «Per te» a scorrimento infinito, autoplay generalizzato, classifiche, streak, premi di presenza, badge di engagement o notifiche progettate per richiamare senza novità concreta.
- Misurare la salute della beta con dati aggregati e minimizzati: persone che completano onboarding, seguono almeno cinque contatti, ricevono una risposta, partecipano a una cerchia o a un evento e tornano volontariamente entro 7/28 giorni. Non usare questi dati per profilazione individuale o ranking.
- Prima di ogni rilascio, definire un’ipotesi verificabile e una soglia di successo: ad esempio «una cerchia attiva deve produrre almeno una conversazione reciproca alla settimana, senza aumentare le notifiche non richieste». Raccogliere anche feedback qualitativo da utenti reali.
- Offrire in Impostazioni comandi chiari per silenziare notifiche, interrompere digest, lasciare cerchie e scaricare/eliminare i dati associati.

### 10. Messaggistica diretta: conservazione, Chat temporanea e stati
Le chat sono consentite esclusivamente tra utenti con follow reciproco e devono garantire:

- **Vera Crittografia End-to-End (E2EE)**:
  - Implementata con standard crittografici aperti e verificati (Web Crypto API / SubtleCrypto con X25519 o ECDH P-256 + HKDF + AES-256-GCM, o Signal Double Ratchet).
  - Le chiavi private risiedono **esclusivamente sul dispositivo dell'utente** (memorizzate in IndexedDB come chiavi non esportabili `extractable: false`).
  - Il server Supabase memorizza solo ciphertext e nonce/IV opachi: nessun admin o intermediario di rete ha la capacità tecnica di leggere i messaggi (*Blind Storage*).
- **Media nelle Chat**:
  - Supporto per invio di foto, brevi note audio e video nei messaggi diretti.
  - Gli allegati vengono cifrati simmetricamente lato client con chiave usa-e-getta prima dell'upload nello storage del server.
- **Messaggi conservati per impostazione predefinita**:
  - Con «Chat temporanea» disattivata, i nuovi messaggi non hanno una scadenza automatica: rimangono finché non vengono eliminati.
  - Due comandi: «Elimina per me» nasconde il messaggio dalla propria conversazione; «Elimina per tutti» è disponibile solo per i propri messaggi.
- **Chat temporanea**:
  - Un pulsante nella chat attiva o disattiva la modalità «Chat temporanea» per quella conversazione. Lo stato deve essere riconoscibile anche senza affidarsi al solo colore.
  - La durata dell’autoeliminazione si sceglie nelle **impostazioni della chat**, non accanto a ogni messaggio. Le durate previste sono 1 ora, 3 ore, 24 ore, 48 ore, 1 settimana e 30 giorni.
  - La durata scelta si applica soltanto ai nuovi messaggi inviati quando la modalità è attiva. Il termine decorre dall’invio. Cambiare durata o disattivare la modalità non riscrive le scadenze dei messaggi già inviati.
  - Alla scadenza, revocare l’accesso ai messaggi e agli allegati e rimuoverli con la manutenzione server e la pulizia locale. Non promettere cancellazione delle copie esportate né pulizia di un browser chiuso.
- **Modifica dei messaggi**:
  - Il mittente può modificare il proprio messaggio soltanto se sono trascorsi meno di 30 minuti dall’invio originale e il destinatario non lo ha ancora letto. Le due condizioni devono valere insieme.
  - Un messaggio consegnato ma non letto resta modificabile entro questo intervallo. Alla lettura o al raggiungimento dei 30 minuti, la modifica viene negata anche tramite API dirette.
  - Mostrare «Modificato» dopo una modifica riuscita. La modifica non riavvia i 30 minuti e non prolunga l’eventuale scadenza.
  - Verificare lettura e modifica con un’operazione atomica sul server: una modifica non può sovrascrivere una versione già segnata come letta. Se viene respinta, conservare il testo digitato e spiegare il motivo.
- **Stati dinamici dei messaggi**:
  - **Non inviato**: indicatore di attesa; in caso di errore, icona di errore e comando «Riprova», mantenendo testo e allegato.
  - **Inviato**: una spunta neutra, dopo la conferma di ricezione da parte del server.
  - **Consegnato, non letto**: due spunte neutre, dopo la conferma di ricezione da parte di un dispositivo del destinatario.
  - **Letto**: due spunte evidenziate, quando il messaggio viene mostrato nella conversazione attiva e visibile del destinatario.
  - Usare un meccanismo visivo simile a WhatsApp, con etichette accessibili per ogni stato. L’apertura generica dell’app o il download in background non bastano per dichiarare un messaggio letto. Aggiornare lo stato senza ricaricare la pagina e senza duplicare i messaggi quando si ritenta un invio.

#### Compatibilità con cifratura e conservazione

Le modifiche e le ricevute devono funzionare con E2EE: il server non riceve il testo in chiaro. Ogni revisione deve essere cifrata senza riutilizzare nonce; ricevute e controlli di concorrenza devono riferirsi alla versione corretta del messaggio. Il server deve controllare autore, destinatario, tempo trascorso e stato di lettura.

«Chat temporanea» stabilisce **quando** scade un messaggio. Le opzioni «Sincronizzati sul server» e «Solo sul dispositivo» stabiliscono **dove** viene conservato. Sono scelte distinte. La rimozione del ciphertext dal server dopo la consegna in modalità solo dispositivo non deve eliminare automaticamente la copia locale di un messaggio ordinario. Prima di estendere questa modalità, progettare come recapitare modifiche, ricevute ed eliminazioni dopo la rimozione del ciphertext.

Questi requisiti, aggiornati l’11 settembre 2026, sostituiscono la precedente autoeliminazione predefinita dopo 24 ore. Il codice esistente deve essere adeguato con una migrazione compatibile: non cambiare retroattivamente scadenze o contenuti autenticati dello storico cifrato.

---

## Politica sui Contenuti, Moderazione e Libertà di Espressione

1. **Divieto Assoluto di Pornografia e Contenuti Adulti (NSFW)**:
   - È vietata la pubblicazione di materiale pornografico, sessualmente esplicito o CSAM.
   - Pre-validazione/filtri client-side ove possibile e congelamento immediato dei contenuti segnalati per NSFW in attesa di revisione da parte dei moderatori.
2. **Contenuti Politici Ammessi (Libertà di Espressione Garantita)**:
   - La discussione politica, il dibattito di opinione e la critica sono pienamente garantiti. Nessuna censura algoritmica o ideologica su base di opinioni.
3. **Contrasto alle Fake News e Disinformazione Fattuale**:
   - I fatti non sono opinioni: per i post con affermazioni fattuali contestate o link a notizie è previsto un sistema di **Note della Comunità (Community Notes / Fact-Checking)**.
   - Gli utenti possono proporre note contestuali allegando fonti verificabili.
   - L'approvazione delle note da parte dei moderatori o della comunità rende visibile la nota di contesto sotto il post, **senza cancellare il post originario**, favorendo la trasparenza e il pensiero critico anziché la censura cieca.
4. **Trasparenza delle Azioni di Moderazione**:
   - Ogni rimozione o provvedimento è motivato con riferimento esplicito alle regole violate e notificato all'utente, con procedura di ricorso manuale.

---

## Predisposizione per Pubblicità Etica (Sostenibilità Futura)

Per finanziare i costi di banda e storage al superamento del free-tier, il sistema predispone un modulo di sponsorizzazioni sostenibili ed etiche:

- **Nessun Profiling / Zero Tracking**:
  - Nessun pixel o tracciamento del comportamento utente.
  - Annunci interni basati unicamente sul contesto (hashtag, temi) o distribuiti a intervalli regolari nel feed cronologico (es. ogni 15 post).
- **Previa Approvazione Obbligatoria dell'Admin**:
  - Nessun network pubblicitario programmatico automatizzato di terze parti (no Google Ads, no banner esterni).
  - Chi richiede uno spazio sponsorizzato (progetti indipendenti, aziende locali, creatori) invia la proposta che rimane in stato `pending_review`.
  - L'annuncio va online **esclusivamente previa verifica e approvazione manuale dell'amministratore** dal pannello di moderazione.
  - Segnalazione trasparente: etichetta evidente *"Sponsorizzato · Approvato da SN"*.

---

## Stack Tecnologico e Architettura

- **Webapp**: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript + Tailwind CSS v4.
- **Backend & Database**: Supabase (PostgreSQL 15+, Auth GoTrue, Storage, Row Level Security obbligatoria su tutte le tabelle).
- **Crittografia**: Web Crypto API nativa (`crypto.subtle`) + algoritmi standard verificati (X25519 / AES-GCM / HKDF).
- **Compressione Media Client-side**: HTML5 Canvas (WebP) e `MediaRecorder` per transcodifica/riduzione peso video prima del caricamento.
- **Font e Asset**: Self-hosted o font di sistema, zero chiamate verso Google Fonts o CDN esterne.
- **Testing**: Vitest + PGlite (test unitari ed esecuzione reale di schemi e policy SQL RLS) + Playwright per test E2E (desktop e mobile).
- **Deploy**: Vercel Hobby + Supabase (regione UE, es. Francoforte).
- **CI/CD**: GitHub Actions per lint, type-check, test SQL/unitari, build e Playwright.

---

## Federazione ActivityPub / Fediverse

La compatibilità con Mastodon e Pixelfed è disponibile come anteprima locale, non ancora come interoperabilità di produzione:
- Gli UUID `actor_key` e `activity_key` garantiscono identità stabili e indipendenti dall'username. Solo i profili pubblici, attivi e con consenso federativo separato possono essere esposti.
- Con `FEDERATION_DISCOVERY_PREVIEW=true` in sviluppo, WebFinger, Actor, outbox, Note/Create e allegati dei post testuali sono leggibili. Senza anteprima, e sempre in produzione finché non viene autorizzata l'apertura, `/.well-known/webfinger` e `/ap/*` rispondono HTTP 503.
- L'inbox verifica firme HTTP, digest, data, destinatario e coerenza dell'origin per `Follow`, `Like`, `Reject`, `Create`, `Update`, `Delete` e relativi `Undo`. Le Note remote sono conservate in tabelle private, aggiornate o trasformate in tombstone e mostrate nel feed con origine federata esplicita, senza simulare interazioni locali non supportate.
- Il recupero delle chiavi remote e le consegne applicano blocklist, HTTPS obbligatorio, divieto di redirect, limiti di tempo e dimensione e pinning dell'IP pubblico verificato contro il DNS rebinding. Le chiavi hanno cache privata di sei ore con un solo refresh dopo una firma fallita; le attività sono deduplicate e limitate a 120 l'ora per coppia attore remoto–destinatario locale.
- `private.federation_queue` conserva `Accept`, `Create` e `Delete` in uscita con retry. Il worker di consegna è disattivato per impostazione predefinita e non va abilitato prima del collaudo con server Mastodon/Pixelfed dedicati, moderazione degli oggetti remoti e verifica del consumo di banda e storage.
- Rendere privato o sospendere un profilo revoca l'opt-in e accoda il ritiro dell'attore. Storie e messaggi diretti restano locali. Non presentare SN come interoperabile con il Fediverso finché i test incrociati non sono conclusi.

---

## Sicurezza e Conformità GDPR/DSA

- **Row Level Security (RLS)** totale: nessun accesso anonimo alla community, query dirette controllate tramite token JWT e funzioni `security definer` con `search_path` blindato.
- **Header di Sicurezza**: CSP rigido con `nonce` e `'strict-dynamic'`, `X-Frame-Options: DENY`, `HSTS`, `Permissions-Policy` restrittivo.
- **Quote rigide per il Free Tier**: max 20 utenti registrati, max 3 MiB per singolo file, max 40 MiB per utente, max 800 MiB globali con prenotazione atomica dello spazio.
- **Diritto all'Oblio e Portabilità**: esportazione JSON completa di tutti i propri dati (`GET /api/export`) e cancellazione account sicura (`POST /api/account/delete`) con re-autenticazione password e pulizia a cascata di dati, file di storage e credenziali Auth.
- **Endpoint Manutenzione Protetto**: `/api/maintenance` protetto da token segreto confrontato con `timingSafeEqual` per epurare storie scadute, messaggi effimeri e file orfani.

---

## Istruzioni Operative per lo Sviluppo

1. **Non rompere la suite di test**: dopo ogni modifica, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` devono passare con 0 errori.
2. **Mantenere la modalità Demo**: qualsiasi nuova feature deve continuare a funzionare anche offline in `/demo` tramite IndexedDB o mock client-side.
3. **Approccio Incrementale**:
   - Fase 1: Miglioramenti estetici (Calm UI), autoplay storie con progress bar.
   - Fase 2: Schema DB e logica per messaggi effimeri e media in chat.
   - Fase 3: Architettura E2EE con Web Crypto API e gestione chiavi locali.
   - Fase 4: Schema e moderazione per Community Notes (anti-fake news) e Annunci etici con approvazione admin.
   - Fase 5: Collaudo cloud della beta esistente con account reali, Auth, Storage, SMTP, RLS e test desktop/mobile. Non iniziare le nuove funzioni sociali prima di questa verifica.
   - Fase 6: Cerchie e relativo mini-feed; poi eventi. Consegnare migrazione, API, demo IndexedDB, policy RLS, test SQL e test E2E in un unico blocco per ciascuna funzione.
   - Fase 7: Digest opt-in, album/post collaborativi, reazioni/menzioni/condivisioni interne e scoperta intenzionale. Per ogni rilascio verificare che privacy, blocchi, quote, export, cancellazione account e stati vuoti restino coerenti.

### Decisioni correnti che prevalgono sulle sezioni storiche

- Le funzioni delle sezioni 4–9 sono proposte da implementare, non funzionalità già disponibili.
- La sostenibilità tramite pubblicità o sponsorizzazioni non è autorizzata nella beta corrente. Non implementare annunci, placement nel feed, targeting o moduli commerciali senza una nuova decisione esplicita del proprietario.
- Il feed resta cronologico e finito. Il digest e la scoperta intenzionale non autorizzano ranking opaco né un feed algoritmico.
- Non definire l’intera piattaforma «zero-knowledge»: la cifratura end-to-end riguarda i nuovi messaggi e allegati secondo lo stato e i limiti documentati nel progetto. Ogni promessa di sicurezza va verificata prima di essere pubblicata.

### Decisione confermata: eliminazione in chat

Due comandi distinti: «Elimina per me» per nascondere un messaggio dalla propria conversazione, «Elimina per tutti» solo per i propri messaggi. Le copie locali ricevono la cancellazione al successivo collegamento; file già esportati non possono essere revocati.

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

### 4. Messaggistica Diretta (Chat) Sicura, Multimediale ed Effimera
Le chat sono consentite esclusivamente tra utenti con follow reciproco e devono garantire:

- **Vera Crittografia End-to-End (E2EE)**:
  - Implementata con standard crittografici aperti e verificati (Web Crypto API / SubtleCrypto con X25519 o ECDH P-256 + HKDF + AES-256-GCM, o Signal Double Ratchet).
  - Le chiavi private risiedono **esclusivamente sul dispositivo dell'utente** (memorizzate in IndexedDB come chiavi non esportabili `extractable: false`).
  - Il server Supabase memorizza solo ciphertext e nonce/IV opachi: nessun admin o intermediario di rete ha la capacità tecnica di leggere i messaggi (*Blind Storage*).
- **Media nelle Chat**:
  - Supporto per invio di foto, brevi note audio e video nei messaggi diretti.
  - Gli allegati vengono cifrati simmetricamente lato client con chiave usa-e-getta prima dell'upload nello storage del server.
- **Chat e Messaggi che si Autodistruggono (Effimeri)**:
  - Scadenza selezionabile dall'utente: **1 ora, 3 ore, 24 ore, 48 ore, 1 settimana, 1 mese**.
  - Cancellazione garantita: sia lato client (eliminazione da IndexedDB locale) sia lato server (job di pulizia sul database per revocare ciphertext e storage collegati).
- **Opzioni di Conservazione Flessibile**:
  - *Solo sul dispositivo*: i messaggi cifrati vengono cancellati dal server subito dopo la ricezione/consegna e conservati solo nel database locale dell'utente.
  - *Sincronizzati sul server*: i messaggi restano memorizzati sul server in formato cifrato end-to-end per consentire l'accesso da più dispositivi autorizzati dello stesso utente.

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

## Federazione Futura (ActivityPub / Fediverse)

La compatibilità con Mastodon e Pixelfed rimane un obiettivo architetturale:
- Gli UUID `actor_key` e `activity_key` garantiscono identità stabili e indipendenti dall'username.
- Le tabelle per code di federazione e istanze bloccate sono presenti nello schema (`private.federation_queue`, `private.blocked_instances`).
- Attualmente gli endpoint `/.well-known/webfinger` e `/ap/*` restituiscono HTTP 503 per sicurezza, in attesa di un'integrazione completa con una libreria validata (es. [Fedify](https://fedify.dev/)) con rigorose difese anti-SSRF.

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

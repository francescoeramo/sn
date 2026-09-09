# Prompt di progetto — "SN" (nome temporaneo)

Usa questo come prompt/brief per guidare lo sviluppo (con Claude Code o un altro coding agent), o come documento di riferimento del progetto.

## Contesto e obiettivo

Costruisci **SN**, un social network fotografico/video in stile Instagram, ma pensato come alternativa **europea, indipendente e privacy-first** alle piattaforme Big Tech statunitensi. Il progetto è personale, sviluppato da un solo sviluppatore, partendo da infrastruttura interamente free-tier.

Principi guida non negoziabili:
- **Privacy by design**: raccolta dati minima, nessun tracker pubblicitario di terze parti, nessuna chiamata di rete non necessaria verso servizi esterni (vedi nota sui font più sotto).
- **Sicurezza reale, non dichiarata**: ogni claim di sicurezza deve corrispondere a un'implementazione verificabile (niente crittografia "finta" o meccanismi fail-open).
- **Design distintivo**: l'interfaccia deve avere un'identità visiva propria, non l'aspetto di un template Tailwind/shadcn di default o di un progetto generato senza cura ("vibecoded").
- **Indipendenza**: infrastruttura sostituibile, nessun lock-in permanente su un singolo vendor oltre a quanto strettamente necessario in questa fase (free tier).

## Funzionalità (MVP)

Nucleo minimo per la prima versione web:
- Registrazione/login sicuro, profilo utente, upload e visualizzazione di foto e video
- Feed cronologico/algoritmico dei post seguiti
- Stories (contenuti effimeri, scadenza 24h)
- Messaggi diretti (1:1, valutare crittografia end-to-end in una fase successiva)
- Reels/video brevi con player dedicato
- Like, commenti, follow/unfollow
- Ricerca utenti/hashtag
- Notifiche di base
- Impostazioni privacy account (pubblico/privato) e gestione dati personali (esporta/elimina i miei dati)

Fuori dall'MVP ma da tenere in considerazione nell'architettura: live streaming — va progettato in modo che si possa aggiungere senza riscrivere il core.

Nota infrastrutturale: con Stories/Reels/DM inclusi fin dall'MVP, il volume di media sale rapidamente — monitorare da subito i limiti di storage/banda del piano free di Supabase e prevedere una strategia di compressione/transcodifica lato client per i video prima dell'upload.

## Design e identità visiva

- Sistema di design proprio: palette colori, scala tipografica, spaziature e componenti definiti da zero, non default di libreria.
- Micro-interazioni e dettagli curati (transizioni, stati vuoti, stati di caricamento) che comunichino qualità artigianale.
- Layout responsive nativo: esperienza ottimizzata sia per desktop sia per mobile web, non solo "adattata".
- Evitare pattern visivi riconoscibili come output non curato di un LLM (spaziature generiche, ombre di default, icone incoerenti tra loro).

## Stack tecnico

- **Webapp**: Next.js (App Router) + TypeScript + Tailwind, responsive per PC e mobile.
- **App native future**: React Native, per condividere logica di business, client API e tipi TypeScript con la webapp Next.js (valutare un monorepo, es. Turborepo/pnpm workspaces, per isolare in pacchetti condivisi la logica non legata al rendering).
- **Backend/DB**: Supabase (piano free) — Postgres, Auth, Storage, Realtime, con Row Level Security attiva su ogni tabella fin dal primo schema.
- **Font e asset**: self-hosted, niente chiamate runtime a servizi esterni (Google Fonts incluso) per coerenza con l'approccio privacy-first.
- **Deploy**: Vercel, collegato al branch `main` per il deploy automatico.
- **CI/CD**: GitHub Actions per lint, type-check, test e scansione automatica delle dipendenze (Dependabot o simile) a ogni push.

## Federazione (ActivityPub / Fediverse)

SN deve essere interoperabile con il Fediverse (Mastodon, Pixelfed e simili) tramite il protocollo ActivityPub. Implicazioni architetturali da progettare fin dall'inizio, non da aggiungere dopo:
- Ogni utente/post deve essere modellato come "Attore"/"Attività" ActivityPub, con endpoint pubblici standard: WebFinger (`/.well-known/webfinger`), Actor profile, inbox/outbox.
- Firma e verifica delle richieste tramite HTTP Signatures per l'autenticità dei messaggi federati.
- Consegna delle attività (post, like, follow) ai server remoti in modo asincrono, tramite coda di lavoro (es. Supabase Edge Functions + tabella di coda, o worker esterno se i limiti free-tier lo richiedono) per non bloccare le richieste utente e gestire i retry.
- Compatibilità del formato media/post con Pixelfed (il progetto Fediverse più vicino per funzione) per garantire un buon rendering incrociato.
- Politiche di privacy e blocco/defederazione verso istanze specifiche, coerenti con le impostazioni privacy account già previste nell'MVP.
- Valutare se usare una libreria ActivityPub esistente (es. per Node.js) invece di implementare il protocollo da zero, per ridurre superficie di bug e tempo di sviluppo.

## Sicurezza (priorità massima)

- Autenticazione gestita da Supabase Auth con password hashing sicuro; valutare 2FA opzionale.
- Row Level Security su tutte le tabelle Supabase, nessun accesso diretto ai dati che bypassi le policy.
- Nessun meccanismo "fail-open": ogni controllo di autenticazione/autorizzazione deve negare l'accesso di default in caso di errore.
- Header di sicurezza (CSP, HSTS, X-Frame-Options), protezione CSRF/XSS/SQLi by design (query parametrizzate/ORM, sanitizzazione input/output).
- Rate limiting su endpoint sensibili (login, upload, API pubbliche) e protezione dai timing attack sulle rotte di autenticazione.
- Dipendenze mantenute aggiornate, con scansione automatica delle CVE.
- Se in futuro si introduce crittografia end-to-end (es. per messaggi diretti), implementarla con librerie standard verificate, mai algoritmi custom.

## Privacy e conformità (GDPR/DSA)

- Base giuridica e consenso chiari per ogni trattamento dati; niente dark pattern nei consensi.
- Diritto all'oblio e portabilità dati implementati fin dall'MVP (esporta/elimina account e contenuti).
- Regione dati Supabase in UE (es. Frankfurt) per residenza dati europea.
- Analytics, se presenti, privacy-friendly e self-hosted (es. Plausible) invece di Google Analytics.
- Considerare fin da subito gli obblighi del Digital Services Act (DSA) su moderazione e trasparenza, anche se semplificati per un progetto in fase iniziale.

## Repository GitHub

- Nome repo: `SN` (o nome definitivo quando scelto), branch principale `main`.
- README con setup locale, variabili d'ambiente richieste (`.env.example`, mai committare segreti reali).
- Struttura cartelle chiara (es. `app/`, `components/`, `lib/`, `supabase/` per schema e migrazioni).
- Licenza da definire (privata per ora, se il progetto resta personale).

## Vincoli operativi

- Ambiente di sviluppo: mai usare `sudo` con npm/npx.
- Tutto su piano gratuito per ora (Supabase free, Vercel hobby): tenere sotto controllo i limiti (righe DB, storage, banda, invocazioni Edge Function) e prevedere un percorso di upgrade quando necessario.

## Domande aperte da chiudere prima di iniziare a scrivere codice

1. Approccio alla moderazione dei contenuti (automatica, umana, community, o non prioritaria ora) — rilevante anche per la federazione, dato che i contenuti federati vanno moderati come quelli locali.
2. Pubblico target/nicchia iniziale (utile per definire priorità delle feature).
3. Modello di sostenibilità economica, se previsto (nessuna pubblicità è coerente con "privacy-first", ma va deciso come sostenere i costi oltre il free tier, specialmente considerando banda e storage aggiuntivi richiesti da video e federazione).

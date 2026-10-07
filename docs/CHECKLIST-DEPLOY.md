# Checklist di collegamento — Supabase e Vercel

Regole d'oro: nessun segreto con prefisso `NEXT_PUBLIC_`; nessun upgrade o addebito automatico; federazione spenta finché non collaudata; non usare progetti Supabase condivisi con altri dati; `.env.local` non va mai committato (è già in `.gitignore`).

## Mappa rapida: variabile → dove si trova → dove va

| Variabile | Dove si trova | Dove va |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Connect / Project Settings → API | Vercel Env Production e `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → **publishable** | Vercel Env + `.env.local` |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys → chiave **secret** | Vercel Env **Sensitive** + `.env.local`; mai `NEXT_PUBLIC_` |
| `APP_ORIGIN` | Vercel → Domains (URL di produzione) | Vercel Env + `.env.local` + Supabase Redirect URLs |
| `FEDERATION_KEY_SECRET` | generata da te (`openssl rand -base64 32`) | Vercel Env + `.env.local`; deve restare **stabile** |
| `FEDERATION_DELIVERY_ENABLED` | scelta tua | Vercel Env = `false` |
| `FEDERATION_DISCOVERY_PREVIEW` | scelta tua | assente in produzione (o `false`) |
| `CRON_SECRET` | generata da te (≥32 caratteri) | Vercel Env + `.env.local` + GitHub secret `SN_CRON_SECRET` |
| `PRIVACY_CONTACT_EMAIL` | tua email di contatto | Vercel Env + `.env.local` |
| `SUPABASE_DB_URL` | Supabase → Project Settings → Database → Connection pooling → **Session pooler** | solo per il backup (`docs/BACKUP.md`) |
| `SUPABASE_SERVICE_ROLE_KEY` / `SN_BACKUP_RECIPIENT` | chiave **secret** Supabase / tua chiave GPG | solo per il backup; il nome della variabile è storico |

---

## Parte A — Supabase

### A1. Progetto dedicato
- [ ] Dashboard Supabase → **New project**.
- [ ] Nome: `sn` (o simile); **Region**: UE (es. Frankfurt/EU Central); password DB robusta.
- [ ] Annota la password del database (serve per `supabase link` e per il backup). Non metterla nel repo.
- [ ] Nella schermata **Security**: lascia **Enable Data API** attivo, abilita **Enable automatic RLS** e disabilita **Automatically expose new tables**. SN usa la Data API tramite `supabase-js`; le migrazioni concedono invece in modo esplicito i soli permessi necessari e definiscono le policy RLS per ogni tabella.

### A2. Chiavi API
- [ ] **Project Settings → API Keys**: copia `URL`, chiave **publishable**, chiave **secret**.
- [ ] Incolla URL e publishable in `.env.local` e poi nelle env di Vercel.
- [ ] Tieni la secret solo sul server: `.env.local` e Vercel (Sensitive). Mai in codice o `NEXT_PUBLIC_`.
- [ ] La chiave **secret** (`sb_secret_…`) sostituisce la vecchia chiave JWT `service_role`. L'app usa il nome di variabile `SUPABASE_SECRET_KEY`; non usare né esporre la vecchia chiave salvo una necessità di compatibilità esplicita.

### A3. Reference e connessione
- [ ] **Project Settings → General → Reference ID**: è il `<project-ref>` per la CLI.
- [ ] **Project Settings → Database → Connection pooling → Session pooler**: copia la stringa per `SUPABASE_DB_URL` (solo backup; codifica i caratteri speciali della password).

### A4. Applicare le migrazioni
- [ ] Da locale: `npx supabase login`, poi `npx supabase link --project-ref <project-ref>` (chiede la password DB).
- [ ] `npx supabase db push` → applica **tutte** le migrazioni in ordine (`supabase/migrations/`).
- [ ] Verifica in **Table Editor** che esistano le tabelle nuove (`digest_preferences`, `collaborative_posts`, `collaborators`, `album_items`, `reactions`, `mentions`, `mention_preferences`, `shares`, `explore_preferences`, `product_metrics_daily`).
- [ ] Verifica in **Storage** che il bucket privato `media` esista (lo crea la migrazione iniziale: non crearlo a mano).

### A5. URL di autenticazione
- [ ] **Authentication → URL Configuration**:
  - Site URL = `https://<tuo-dominio>`
  - Redirect URLs di produzione (aggiungile entrambe):
    - `https://<tuo-dominio>/auth/callback`
    - `https://<tuo-dominio>/auth/callback?next=/account/password`
  - Redirect URL locale, se continui a fare prove sul computer: `http://localhost:3000/auth/callback**`
- [ ] Non usare i deploy Preview per registrazione, login, reset password o altre scritture: l'app confronta l'header `Origin` con `APP_ORIGIN` e usa la stessa origine per i callback. Un URL Preview variabile non può quindi essere configurato in sicurezza con le variabili attuali. Usa `/demo` nelle preview e il dominio di produzione per il collaudo cloud con i due account di test.

### A6. Auth: email, provider, token
- [ ] **Authentication → Sign In / Providers**: Email abilitata; **signup anonimo disattivato**; registrazione solo su invito (i trigger lo impongono).
- [ ] In **Authentication → Settings**: conferma email attiva, password minima 12, durata JWT 5 minuti, scadenza OTP/link email 15 minuti e notifica del cambio password attiva. I nomi esatti dei pannelli possono variare, ma i valori devono corrispondere a `supabase/config.toml`.

### A7. SMTP
- [ ] **Project Settings → Auth → SMTP Settings**: configura il provider e **invia una mail di prova**. Senza SMTP il recupero account non funziona.

### A8. Moderatore
- [ ] Recupera l'UUID del primo account in **Authentication → Users** (o `select id from auth.users where email='...'`).
- [ ] **SQL Editor**:
  ```sql
  insert into private.admins(user_id) values ('<uuid-primo-account>') on conflict do nothing;
  ```

### A9. Inviti
- [ ] Da locale: `node scripts/create-invite.mjs email@example.org` → lo script stampa l'SQL.
- [ ] Esegui quell'SQL nel **SQL Editor** del progetto corretto (verifica prima email e progetto).

### A10. Advisor
- [ ] **Database → Advisors** (Security e Performance): sistema le segnalazioni su RLS e funzioni privilegiate. Annota l'esito.

### A11. Collaudo cloud
- [ ] Completa i 6 punti di `docs/VERIFICA.md` §«Da eseguire sul progetto Supabase dedicato» (inviti/email; profili privati, blocchi e URL media; messaggi e API dirette; upload/quote/concorrenza e doppio cleanup; export multi-pagina e cancellazione account; recupero password su due browser).

### A12. Manutenzione e backup
- [ ] `POST /api/maintenance` richiede `Origin` = `APP_ORIGIN` e `Authorization: Bearer <CRON_SECRET>`.
- [ ] Collega il job dopo il deploy (Parte B). Le storie scadono in lettura anche senza job; la cancellazione fisica richiede il job.
- [ ] Backup: vedi `docs/BACKUP.md` (comando `npm run backup -- <cartella>` con `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SN_BACKUP_RECIPIENT`) e prova di ripristino prima della beta.

---

## Parte B — Vercel

### B1. Import del repository
- [ ] vercel.com → **Add New → Project** → Import Git Repository → `francescoeramo/sn`.
- [ ] Framework Preset: **Next.js** (auto-rilevato); Root Directory: radice del repo.

### B2. Build
- [ ] Build Command: default (`next build`); Install Command: `npm install`; Output: automatico.
- [ ] Non servono servizi a pagamento (KV, Blob, image optimization a consumo): non attivarli.

### B3. Environment Variables
- [ ] **Project → Settings → Environment Variables**: aggiungi per **Production**:
  - `NEXT_PUBLIC_SUPABASE_URL` (pubblica)
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (pubblica)
  - `SUPABASE_SECRET_KEY` (Sensitive)
  - `APP_ORIGIN` (l'URL esatto di produzione, es. `https://sn.vercel.app`)
  - `FEDERATION_KEY_SECRET` (Sensitive, stabile)
  - `CRON_SECRET` (Sensitive)
  - `PRIVACY_CONTACT_EMAIL`
  - `FEDERATION_DELIVERY_ENABLED=false`
- [ ] Non impostare `FEDERATION_DISCOVERY_PREVIEW` in produzione.
- [ ] Non copiare queste variabili nell'ambiente **Preview** per provare l'app reale: vedi A5. Le preview possono restare senza configurazione e mostrare il setup oppure usare soltanto `/demo`.

### B4. Regione
- [ ] **Project → Settings → Functions → Function Region**: scegli una regione vicina al database Supabase (es. `fra1`/Francoforte). Su Hobby puoi avere vincoli sul numero di regioni.

### B5. Node.js
- [ ] **Project → Settings → General → Node.js Version**: scegli una LTS compatibile con Next 16 (es. 22.x) e verifica che la build passi.

### B6. Dominio
- [ ] **Project → Settings → Domains**: usa `*.vercel.app` o aggiungi il dominio personalizzato.
- [ ] Copia l'origine esatta (schema + host, senza path) e usala come `APP_ORIGIN`.

### B7. Torna su Supabase
- [ ] Aggiorna **Authentication → URL Configuration** con lo stesso dominio (Site URL e Redirect URLs di A5).

### B8. Redeploy
- [ ] Dopo ogni modifica alle env: **Deployments → Redeploy** (le variabili si applicano al nuovo deploy).

### B9. Branch di produzione
- [ ] **Project → Settings → Git**: Production Branch = `main`.

### B10. Protezione accesso (solo preview)
- [ ] Su Vercel Hobby, Vercel Authentication protegge le preview ma non il dominio di produzione. È utile per il lavoro interno, non come controllo di accesso della beta: per gli utenti beta l'accesso resta governato da inviti, Supabase Auth e RLS.

### B11. Manutenzione su GitHub
- [ ] GitHub → repo `sn` → **Settings → Secrets and variables → Actions**: crea `SN_ORIGIN` = URL di produzione e `SN_CRON_SECRET` = stesso `CRON_SECRET`.
- [ ] Solo dopo un deploy riuscito e il collaudo di `/api/maintenance`, abilita lo schedule giornaliero in `.github/workflows/maintenance.yml`, sotto `on:`:
  ```yaml
  schedule:
    - cron: '17 3 * * *'
  ```
  GitHub esegue gli schedule dal branch di produzione; lascia anche `workflow_dispatch` per le prove manuali. In alternativa usa un timer esterno che invii la stessa richiesta autenticata.

### B12. Controlli post-deploy
- [ ] Apri il sito, verifica che `/demo` funzioni e che la home reale chieda l'invito.
- [ ] Verifica header/CSP in produzione (`docs/VERIFICA.md`), header `Set-Cookie` HttpOnly e assenza di richieste a terzi non previste.

---

## Parte C — Ordine consigliato

1. A1–A4 (progetto + migrazioni + bucket).
2. B1, B3–B6 e B8 (crea il progetto Vercel, configura le variabili di produzione, ottieni il dominio e ridistribuisci).
3. A5–A7 (redirect URL, Auth e SMTP) e poi B12 (controllo del deploy).
4. A8–A11 (moderatore, inviti, advisor e collaudo cloud con due account).
5. B11 e A12 (prima prova manuale della manutenzione, poi pianificazione e backup con prova di ripristino).

## Parte D — Da non fare / attenzioni

- [ ] Mai `NEXT_PUBLIC_` su `SUPABASE_SECRET_KEY`, `CRON_SECRET`, `FEDERATION_KEY_SECRET`.
- [ ] Mai committare `.env.local` o codici invito.
- [ ] Mai attivare upgrade, componenti a pagamento o addebiti automatici senza decisione esplicita.
- [ ] `FEDERATION_DELIVERY_ENABLED` resta `false`; non presentare SN come interoperabile col Fediverso.
- [ ] `FEDERATION_KEY_SECRET` non va cambiato senza una procedura di ricifratura: cambiarlo rende inutilizzabili le chiavi actor archiviate.
- [ ] `APP_ORIGIN` deve combaciare esattamente con l'origine che invia le richieste: un deploy di preview con origine diversa farà fallire i controlli `Origin`.
- [ ] Le chiavi **secret** e **service_role** non sono la stessa chiave: per questa app usa la nuova chiave secret in `SUPABASE_SECRET_KEY`. Lo script di backup conserva per compatibilità il nome `SUPABASE_SERVICE_ROLE_KEY`, ma può ricevere la stessa chiave secret server-side.
- [ ] Il canale **email del digest** non è operativo (manca un provider nel repo): resta solo `in_app` finché non ne colleghi uno.

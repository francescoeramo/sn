# SN — Piano app nativa iOS (SwiftUI)

> Direzione, sequenza a tappe e specifica della tappa M0. Documento di lavoro: le voci
> marcate come "da verificare" o "decisione" NON sono acquisite. Stato: proposta.

## 1. Direzione e vincoli

- App **SwiftUI nativa**, costruita **per tappe**; sito e ambiente web restano disponibili.
- **Server e database attuali invariati**: l'app è un client delle API SN; il backend resta
  Next.js + Supabase/Postgres con RLS e migrazioni.
- Obiettivo finale: **parità completa** con il sito, raggiunta incrementando il contratto dati
  tappa per tappa (non tutto in anticipo).
- Liquid Glass con i **componenti standard SwiftUI**; dipendenze esterne solo su necessità concreta.
- Governance: l'app nativa non va promessa come disponibile finché non autorizzata dal
  proprietario (`docs/MANUALE-PROGETTO.md`, "Roadmap", app nativa fuori beta; `PRODUCT.md`
  vincoli di prodotto; `docs/DECISIONI.md` app native aperte).
- Autenticazione **server-mediated** ("Opzione B"): i controlli su inviti, registrazione e
  tentativi di accesso restano nel server; il server usa Supabase e restituisce i token all'app.
  Riferimento architetturale: `docs/ARCHITETTURA.md` (adapter bearer mantenendo le regole di dominio).

## 2. Sequenza delle tappe

1. **M0** — sessione nativa verificata su iPhone: login, MFA, rinnovo, logout, token su chiamata protetta.
2. **M0.5** — prova tecnica di cifratura (senza schermate): messaggio web ↔ iPhone in entrambe le direzioni.
3. **M1** — prima versione funzionante: feed, profilo, pubblicazione di un post con immagine.
4. **M2+** — storie, chat completa, gruppi, cerchie, eventi, poi parità residua; ogni blocco
   verificato prima del successivo. Registrazione e recupero password in una tappa successiva a M0.

## 3. Regole vincolanti

- **R1** — M0 include login, rinnovo, logout, verifica token sulla chiamata di prova e percorso MFA.
- **R2** — Nessuna fiducia in header tipo `X-SN-Client`. Gli endpoint nativi funzionano senza
  etichette, mantengono i rate limit e non usano i cookie come alternativa implicita.
  App Attest rimandato oltre il prototipo.
- **R3** — Il rinnovo è un endpoint server; l'app usa `URLSession`. **Un solo rinnovo alla volta**,
  nuovi token nel Keychain, rotazione dei refresh token gestita.
- **R4** — Nessun retry automatico cieco. Refresh+retry solo per letture idempotenti; login, MFA e
  pubblicazione non si ripetono automaticamente.
- **R5** — Prima versione minima: si riusa il caricamento dati esistente e lo si misura sul telefono.
  Rimandati bootstrap ridotto, risposte iOS-specifiche, like/commenti. I modelli contengono solo
  ciò che la risposta scelta richiede davvero.
- **R6** — `logout()` invalida l'epoch del coordinatore: una risposta tardiva di rinnovo non deve
  far rientrare nell'account.
- **F1** — MFA/logout/refresh nativi usano **GoTrue REST con il bearer**; niente `setSession`,
  niente rinnovi impliciti. Il client supabase-js serve solo per dati/RLS con `getUser(token)`.
- **F2** — Il logout revoca la sessione sul server **anche con un rinnovo in corso**; non basta
  scartare la risposta tardiva.
- **F3** — Login e refresh non richiedono bearer; MFA, logout e chiamate protette sì.
- **F4** — Per M0 vale il **logout standard**: token locali eliminati subito, sessione revocata sul
  server, access token eventualmente valido fino alla scadenza.
- **F5** — Stato offline: "**sessione conservata, connessione assente**".

## 4. Specifica M0

### 4.1 Obiettivo e perimetro

Su un **iPhone reale** contro l'ambiente di prova: un account esistente accede via server SN,
riceve i token, li conserva, li rinnova, li revoca e li usa per una chiamata autenticata; percorso
MFA incluso.

Dentro: `native/auth/login`, `native/auth/refresh`, `native/auth/logout`, `native/auth/mfa`
(solo verify), bearer su `GET /api/bootstrap` come chiamata di prova, schermate Login/MFA/
Verifica sessione/Logout.

Fuori: signup, recupero password, publish/feed UI, upload, App Attest, bootstrap ridotto,
modelli Post, like/commenti.

### 4.2 Superficie API (contratto)

JSON in **snake_case**, coerente con i record Supabase già esposti dal sito.

- `POST /api/native/auth/login`
  - Body: `{ email (≤254), password (1–128) }` da `loginCredentials` (`lib/core/rules.ts:110-113`).
  - Rate limit `enforceAuthRate(email, 'login')` invariato, 8/900s (`app/api/[...path]/route.ts:69-87`).
  - Risposte: senza MFA `200 { access_token, refresh_token, expires_at, token_type }`;
    con MFA `200 { mfa_required: true, factor_id, access_token (aal1), refresh_token, expires_at }`;
    credenziali errate `401`; rate limit `429`. Nessun `Set-Cookie`.
- `POST /api/native/auth/refresh`
  - Body `{ refresh_token }`; rotazione GoTrue.
  - `200 { access_token, refresh_token, expires_at, token_type }`;
    rifiuto definitivo `401 { error, code: "refresh_invalid" }`.
- `POST /api/native/auth/logout`
  - **Bearer obbligatorio**; senza bearer `401`, nessun fallback cookie.
  - Revoca la sessione corrente; `200 { ok: true }`; idempotente.
- `POST /api/native/auth/mfa` (verify)
  - Bearer = access token aal1; body `{ factor_id, code }` con `code` `/^\d{6}$/`
    (`rules.ts:120-128`).
  - Risposta: `200 { access_token (aal2), refresh_token, expires_at }`.
- `GET /api/bootstrap` (chiamata di prova)
  - Accetta bearer; riusa `snapshot(existingIdentity?)` (`lib/server/social.ts:165`).
  - Se `Authorization` è presente ma invalido → `401`, **nessun** fallback cookie.
    Se assente → percorso cookie (web invariato).

### 4.3 Metodo auth nativo (F1)

- MFA verify: `POST {SUPABASE_URL}/auth/v1/factors/{factor_id}/challenge` e `/verify` con
  `Authorization: Bearer <aal1 access>` + `{ code }`; la risposta contiene la sessione aal2.
- Logout: `POST {SUPABASE_URL}/auth/v1/logout` con `Authorization: Bearer <access>` (access token
  stabile rispetto alle rotazioni).
- Refresh: `POST {SUPABASE_URL}/auth/v1/token?grant_type=refresh_token` con `{ refresh_token }`.
- Dati/RLS: client supabase-js con header `Authorization` + `auth.getUser(token)`.
- **Fallback non-default**: se GoTrue REST non è praticabile, MFA riceve anche il refresh token e si
  usa `setSession`. Da evitare se possibile.
- **Da verificare**: forme REST esatte, esito `challenge/verify`, e se il logout richiede il
  refresh token oltre al bearer.

### 4.4 Sicurezza

- Il percorso (non un header) decide il comportamento: `/native/auth/*` non legge né scrive cookie,
  non richiede `Origin`, **non emette header CORS**. Sicuro perché non usa credenziali ambientali e
  la risposta non è leggibile cross-origin.
- **Allowlist esplicita**, default-deny per tutto il resto:
  `native/auth/login`, `native/auth/refresh`, `native/auth/logout`, `native/auth/mfa`.
  `sameOrigin` resta obbligatorio per i POST web (`route.ts:64-68, 231`).
- Rate limit login preservato (chiave HMAC su email + `SUPABASE_SECRET_KEY`).
- Mai `SUPABASE_SECRET_KEY` nell'app; `adminDatabase()` resta isolato (`lib/server/supabase.ts:61-66`).
- `Cache-Control: private, no-store`; nessun token nei log.
- App Attest documentato come difesa futura.

### 4.5 Ciclo di vita dei token (R3, R6)

- TTL ricavato da `expires_at`; rinnovo proattivo e reattivo su `401`.
- **Single-flight**: una sola `Task` di refresh in volo; i chiamanti in `401` attendono la stessa.
- Ad ogni successo si sostituiscono **entrambi** i token nel Keychain in modo atomico.
- `logout()` incrementa l'epoch, cancella la `Task` in volo, pulisce i token; un refresh che
  completa dopo il logout viene scartato e non riattiva l'utente.
- Keychain proposta: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.

### 4.6 Logout e revoca (F2, F4)

- Modalità M0 = **standard**: token locali eliminati subito, sessione revocata sul server, access
  token eventualmente valido fino alla scadenza.
- Revoca **anche con rinnovo in corso**: `AuthCoordinator` serializza le operazioni auth; il logout
  attende l'esito del refresh per usare i token più recenti, poi revoca la sessione.
- La finestra di riuso del refresh **non** è un periodo di tolleranza dopo il logout.
- I 5 minuti di validità JWT sono una **configurazione prevista da verificare** nell'ambiente di prova.

### 4.7 Politica di errore e retry (R4)

| Operazione | Retry automatico | Note |
|---|---|---|
| `login` | No | esito potenzialmente ignoto |
| `mfa` verify | No | idem |
| `refresh` | nessun retry visibile | distingue rete/timeout (token conservati) da rifiuto definitivo (logout) |
| `logout` | sicuro ripetere | idempotente |
| `GET bootstrap` | refresh + un retry | se il refresh fallisce per rete, **non** si esce |

Regola: si esce dall'account **solo** quando la sessione risulta effettivamente non valida.

### 4.8 Modifiche server

1. `lib/server/supabase.ts`: `tokenDatabase(token)`; `authenticatedFrom/identityFrom/
   activeAccountFrom(request)` (bearer se presente e valido, cookie se assente; bearer invalido → 401).
2. `lib/server/auth.ts` (nuovo): login, verify MFA, refresh, revoca via GoTrue REST; refactor di
   `route.ts:314-388` e `:260-297` senza cambiare il comportamento web.
3. `app/api/[...path]/route.ts`: calcolo `route` prima di `sameOrigin`; allowlist dei quattro
   endpoint; rami `native/auth/*`; `GET bootstrap` con `snapshot(identityFrom(request))`.
4. `code` stabili per gli errori nativi; aggiornare `docs/ARCHITETTURA.md` e il manuale.

### 4.9 Modifiche iOS

- Progetto Xcode (versione/iOS per Liquid Glass da confermare sui doc Apple).
- Moduli: `TokenStore` (Keychain), `AuthCoordinator` (single-flight + epoch), `APIClient`,
  `Models`, `AppConfig`.
- Schermate M0: Login, MFA verify, Verifica sessione (mostra `me`), Logout.
- Decodifica snake_case; `expires_at` epoch secondi; `{error, code}` → stringhe localizzate it/en.
- Nessuna logica di dominio duplicata: l'app chiama il server.

### 4.10 Modelli M0 (R5)

- `LoginRequest`, `TokenResponse`, `MfaRequired`.
- Decodifica parziale del bootstrap: `me { id, username, display_name }` e `user_id`; il resto ignorato.
- Nessun modello Post in M0 (definito in M1 in base a ciò che feed/profilo/publish mostrano).

### 4.11 Matrice di uscita (per endpoint)

| # | Endpoint | Input auth | Esito atteso |
|---|---|---|---|
| 1 | `native/auth/login` (senza MFA) | email+password, nessun bearer | 200 token; nessun Set-Cookie |
| 2 | `native/auth/login` (con MFA) | email+password | 200 `{ mfa_required, factor_id, token aal1 }` |
| 3 | `native/auth/refresh` | `{ refresh_token }`, nessun bearer | 200 nuova coppia |
| 4 | `native/auth/mfa` | bearer aal1 + factor_id + code | senza bearer → 401; codice valido → 200 token aal2 |
| 5 | `native/auth/logout` | bearer | senza bearer → 401; con bearer → 200 |
| 6 | `GET /api/bootstrap` | bearer | senza bearer → 401, nessun fallback cookie |
| 7 | `GET /api/bootstrap` | bearer invalido | 401, nessun fallback cookie |
| 8 | `GET /api/bootstrap` | bearer aal1 | 403 prima del codice MFA; 200 dopo il verify |
| 9 | due 401 paralleli | — | una sola chiamata di refresh |
| 10 | refresh | refresh token definitivamente invalido | 401 refresh_invalid; ambiguo/rete → nessun logout |
| 11 | logout durante refresh in volo | — | app resta signedOut **e** sessione revocata sul server |
| 12 | refresh offline | — | "sessione conservata, connessione assente"; nessun logout |
| 13 | login ripetuto errato | — | 429 (rate limit invariato) |
| 14 | allowlist Origin | i 4 endpoint nativi senza Origin | esenti; altro percorso senza Origin → 403; login web a cookie intatto |

### 4.12 Ordine di esecuzione

1. `lib/server/auth.ts` + `tokenDatabase`/`identityFrom`.
2. Rami `native/auth/*` + bearer su bootstrap + riordino `sameOrigin` (allowlist).
3. Test server (matrice 6–14).
4. iOS: `TokenStore` + `AuthCoordinator` (single-flight + epoch) + `APIClient`.
5. Schermate Login/MFA/Verifica/Logout.
6. Prova su device contro ambiente di prova; compilazione della matrice.
7. Subito dopo: **prova crypto** (M0.5), prima di completare feed e pubblicazione.

## 5. Verifiche e decisioni aperte

Da verificare (non assunte):
- Intervallo di riuso dei refresh token e comportamento del vecchio token.
- Forme REST GoTrue per challenge/verify e logout; necessità del refresh token sul logout.
- TTL reale del JWT nell'ambiente di prova.
- Revoca verificabile (es. `my_sessions` non elenca più la sessione).
- Versione iOS minima per Liquid Glass.

Decisioni:
- Rate limit del refresh: per-IP (nuova RPC) o solo GoTrue.
- Ambito del logout: sessione corrente o tutte le sessioni del dispositivo.
- Introduzione dei `code` errore solo per `native/auth/*` o estesa a tutte le API.

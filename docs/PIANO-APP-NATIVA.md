# SN — Piano app nativa iOS (SwiftUI)

> Direzione, sequenza a tappe e specifica della tappa M0. Documento di lavoro: le voci
> marcate come "da verificare" o "decisione" NON sono acquisite. Stato 15 ottobre 2026:
> M0 funzionale confermata dall'utente; M0.5 verificata su iPhone con CryptoKit.
> Prossimo incremento M1. Matrice tecnica integrale e XCTest sessione restano distinti.

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

- Progetto SwiftPM in `ios/` con `Package.swift` e `xtool.yml`; build e installazione con xtool su Linux. Target attuale iOS 17; nuove API Liquid Glass da verificare sul SDK e sul dispositivo.
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

La tabella seguente è il contratto di verifica, non un verbale di 14 prove hardware
superate. Login, MFA, rinnovo, logout/riapertura, offline e bootstrap sono confermati
dall'utente; i test server coprono i controlli di autenticazione. Il runner XCTest
sessione/SwiftUI e le prove concorrenti runtime non risultano eseguiti. La prova
M0.5 è invece documentata direttamente dal rapporto CryptoKit recuperato dal device.


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
- Forme REST GoTrue per challenge/verify e logout verificate nel codice e nei test; MFA/login/logout confermati dall’utente su iPhone. Logout usa bearer, non refresh token.
- TTL reale del JWT nell'ambiente di prova.
- Revoca verificabile (es. `my_sessions` non elenca più la sessione).
- Versione iOS minima per Liquid Glass.

Decisioni:
- Rate limit del refresh: per-IP (nuova RPC) o solo GoTrue.
- Ambito del logout: sessione corrente o tutte le sessioni del dispositivo.
- Introduzione dei `code` errore solo per `native/auth/*` o estesa a tutte le API.


## 6. Incremento M0.5 implementato (15 ottobre 2026)

Modulo Swift del protocollo 1:1 v1 in `ios/ChatCrypto`, senza nuove schermate.
Vettori generati con il codice web reale e risposte Swift verificate dallo stesso
codice: testo, allegati, impronte, AAD, revisioni, più dispositivi e manomissioni.
Due XCTest del modulo crypto eseguiti su Linux; 35 controlli interni superati e
compatibilità di ritorno verificata. CryptoKit iOS compilato e installato, con
report DEBUG automatico recuperato via USB e verificato dal codice web: tre
risposte, tre dispositivi, allegati e 35 controlli superati su iPhone reale.
**M0.5 completata: è possibile iniziare M1.** Procedura in [IOS-CRYPTO-INTEROP.md](IOS-CRYPTO-INTEROP.md).


## 7. Passaggio di consegne M1

Obiettivo: feed cronologico e finito, proprio profilo e pubblicazione di un post con
una immagine sul backend SN esistente. Riutilizzare AuthCoordinator, refresh
single-flight, epoch logout e modelli limitati ai dati effettivamente mostrati.
Prima ricostruire il contratto delle API: bootstrap è bearer, ma paginazione posts,
lettura media, action e upload usano ancora il percorso web. Aggiungere solo gli
adapter necessari a M1 con bearer verificato e regole RLS, preservando cookie,
Origin, quote, validazioni e limiti per il sito. Nessun bypass generale di Origin.

Compilare con xtool e verificare login MFA, caricamento, refresh del feed, profilo,
selezione/upload immagine, pubblicazione e riapertura su iPhone. Rispettare il target
minimo iOS 17. Gruppi, storie, chat UI e moderazione nativa restano M2+.
I documenti di avvio e OpenCode devono puntare a M1, senza rigenerare i vettori M0.5
né reinstallare toolchain o ripristinare vecchie configurazioni.

## 8. Incremento del 23 ottobre 2026 — M1 implementata e installata

Feed cronologico finito e paginato, proprio profilo e post con una foto sono ora
implementati in SwiftUI. Build Darwin senza avvisi; bearer esteso a posts/media e
scritture ristrette native/post e native/upload con identità verificata, MFA, RLS e
quote del sito. Origin web preservato, nessuna modifica cloud o al protocollo crypto.
Verifica: 29 test server, 8 controlli eseguibili modelli Swift, typecheck/lint mirato.
SNTests e collaudo runtime M1 restano aperti: non dichiarare M1 conclusa.

Sviluppo su hotspot personale **USB**, server vincolato a `172.20.10.3:3000`, indirizzo
osservato nella sessione e da ricontrollare. Nessun uso della LAN universitaria per
collegare app e backend. Installazione USB e verifica completate al 100% (exit 0)
al secondo tentativo; il primo aveva restituito provisioning Apple 409, causa
transitoria non accertata. Nessun cambio account o toolchain. Aprire SN a mano e
collaudare MFA, feed, paginazione, foto, pubblicazione, riapertura e accessibilità.
`ios/README.md` documenta il passaggio e prevale sui riferimenti storici a M1 non
implementata e al vecchio indirizzo Wi-Fi.

Aggiornamento runtime della stessa sessione: UFW bloccava il traffico sull’interfaccia
USB (log kernel confermato). Regola aggiunta esclusivamente da `172.20.10.1` a
`172.20.10.3:3000/tcp` su `enp8s0f3u1c4i2`; procedura e rimozione in `ios/README.md`.
L’utente ha poi confermato accesso, feed e foto nel profilo. Log server: login/MFA,
bootstrap e lettura media con esito 200. Due tentativi MFA precedenti avevano avuto
503. L’utente ha infine confermato pubblicazione e nuova foto visibile nel post; native/post
200 e successivo bootstrap 200 osservati. Il percorso principale M1 è funzionale
sull’iPhone via USB. Paginazione oltre la prima finestra, riapertura dopo invio e
regressione/accessibilità estese restano aperte; non equivalgono al collaudo già fatto.

## 9. Consolidamento del 23 ottobre 2026

AuthCoordinator ora esce localmente prima di attendere il refresh per la revoca,
come previsto da F4; restore ignora anche gli errori tardivi di un’epoch precedente.
11 XCTest di `ios/SNTests` eseguiti su Linux con
`bash scripts/check-ios-session.sh`, usando il codice reale e uno shim Combine
limitato ai valori. Incluse regressioni concorrenti e paginazione/filtro del feed.
Non è esecuzione del runner Darwin, Keychain o SwiftUI. Build xtool superata.
Per installazione e collaudo corrente fa fede `ios/README.md`. M1 runtime esteso
resta aperto; nessun avanzamento a storie/chat senza completarne la verifica.
Wi-Fi universitario disconnesso: unica route predefinita sull’hotspot USB.

## 10. Recupero connessione M1 — 23 ottobre 2026

Riapertura con post caricati confermata dall’utente; pagina successiva non provata
per numero insufficiente di post. Segnalati foto lente e avviso offline persistente.
Corretto lo stato dopo una risposta media riuscita e aggiunto recupero automatico
con letture bootstrap in primo piano (backoff 3–30 secondi); immagini fallite
ritentate al recupero. Download condivisi per percorso e cache solo RAM, svuotata
con la sessione, evitano trasferimenti ripetuti tra feed e profilo. Cancellazioni
HTTP distinte dagli errori di connessione. 16 XCTest Linux e build xtool superati.
Velocità del primo download e regressione del recupero sulla nuova build restano
prove su iPhone da confermare. Nessuna modifica alle API, al cloud o alla crypto.

## 11. Composer con avvisi — 24 ottobre 2026

Riprese e completate le modifiche locali: avviso facoltativo nel post, limite 160
unità UTF-16 e valore inoltrato al contratto server esistente. Conservati R4
(nessun retry di scritture) e la conferma scarto della bozza. 18 XCTest Linux,
10 controlli modelli e 30 test server superati; build Darwin e installazione USB
verificate. Runtime del nuovo avviso ancora da confermare, M1 estesa resta aperta.
Wi-Fi autorizzato: backend e app usano `192.168.1.9:3000`; procedure correnti e
prove residue in `ios/README.md`. Nessun avanzamento a M2, modifica cloud o crypto.

## 12. Consolidamento M1 — 24 ottobre 2026

Composer con revisioni di selezione foto: completamenti tardivi non sostituiscono
la foto corrente o sbloccano Pubblica. R4/R6 applicati anche alle scritture: nessun
retry dopo l'invio, sessione invalida ripulita, esiti dopo logout ignorati,
errori rete conservano token. 408/5xx/esito perso richiedono controllo del feed.
26 XCTest Linux e build Darwin superati; installazione corrente nel README.
Il backend di sviluppo è ora un servizio utente transitorio, separato dall'agente.
Riuscita pubblicazione con avviso e lettura dopo riavvio backend confermate
dall'utente; non equivalgono alla regressione integrale M1 o a completamento M2.

## 13. Archivio del proprio profilo — 24 ottobre 2026

M1 ora ha uno storico indipendente dal bootstrap/feed: lettura autenticata
`GET /api/profile/posts`, autore sempre uguale al chiamante, RLS e MFA preservate,
solo post ordinari non scaduti e senza cerchia. Pagine finite da 40, ordine
data/UUID, cursore composto e lookahead. Nessuna modifica schema/cloud; API web
esistenti invariate. Client con stati propri, retry/refresh, pulizia al logout e
invalidation dopo pubblicazione concorrente. 30 XCTest Linux, 13 controlli modelli,
75 test server/regole e build/installazione superati. Tab Profilo funzionante
confermato dall'utente, con refresh/bootstrap/profile/posts/media 200 nei log.
Runtime esteso M1 aperto (paginazione oltre 40, accessibilità); nessun avanzamento
a M2. Dettagli ed esito utente in `ios/README.md`.


## Collaudo automatizzato M1 — 24 ottobre 2026, passaggio finale

Rapporto corrente: [IOS-M1-VERIFICA.md](IOS-M1-VERIFICA.md) (dal README iOS:
`../docs/IOS-M1-VERIFICA.md`). 32 XCTest Linux con APIClient/URLSession reali e
trasporto sintetico, 15 controlli modelli e 77 test server/regole superati;
typecheck/lint e build Darwin superati. Prova interna su iPhone: 18 controlli
superati, incluso Keychain separato e ridimensionamento foto. Prova SwiftUI con
HID: feed e profilo 40 → 80 → 85, pulsanti e fine esplicita verificati. Nessun
post di test inserito nel cloud. Timeout del backend reale: sessione conservata e
recupero senza rilancio, con campione stabile successivo alla transizione.

Trovato e corretto un difetto reale: timestamp uguali al confine della pagina
facevano saltare 45 post su 85 nel feed. Ora bootstrap/posts aggiungono
`nextPostId`, iOS invia `before` + `post_id`, ordinamento e confronto data/UUID;
il contratto web a sola data rimane accettato. Nessuna migrazione o modifica cloud.

Aumentato il contrasto di metadati e contatori usando il colore primario di
sistema, preservando layout e stili tipografici. Build finale installata e
verificata al 100%; composer aperto via HID e ispezionato sul telefono. Restano
aperti: nuovo audit dopo l'ultima correzione del contrasto (i precedenti audit
validi riportano rilievi, alcuni incoerenti con i pixel della schermata), prova
rapida del picker nativo e ascolto VoiceOver completo. Non dichiarare M1
integralmente collaudata o iniziare M2 come se tutti i gate fossero chiusi.

Automazione: `scripts/check-ios-m1-device.py`, modalità solo DEBUG
`SN_M1_UI_FIXTURE=1` e `SN_RUN_M1_CHECKS=1`; dati locali, token in memoria e
preferenze isolate. Il runner controlla il segnale di collaudo prima/dopo audit e
prima di salvare screenshot. Campioni di altre app scartati ed eliminati; nessun
contenuto personale nei rapporti versionati. Durante la sessione usbmuxd è
terminato con SIGABRT/invalid pointer ed è stato riavviato; nessun cambio toolchain.
Rete e backend: servizio utente `sn-ios-dev` attivo a `192.168.1.9:3000`.
A fine prove ripristinati tema scuro, dimensione testo iniziale e avvio normale
senza flag di test; non reinstallare né ripetere crypto M0.5.

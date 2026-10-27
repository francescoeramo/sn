# M2 — Storie native iOS

Piano del **27 ottobre 2026**. Stato: **pianificato, nessuna implementazione M2**.
La richiesta di creare questo piano non attesta chiusura M1, nuove prove o rilascio.
Riferimenti: [stato](STATO-IOS.md), [contratto nativo](PIANO-APP-NATIVA.md),
[istruzioni di ripresa](PROSSIMA-SESSIONE.md).

## 1. Obiettivo e confine

Permettere sul client SwiftUI di vedere e pubblicare storie foto/video, con avvisi,
scadenza, controlli di riproduzione e visualizzazioni private coerenti con il web.
Procedere per incrementi verificabili sul backend SN esistente, mantenendo M1.

Sono fuori M2: chat UI e persistenza chiavi crypto, gruppi, cerchie/eventi nativi,
reel, carousel del composer, like/commenti ai post, ricerca e modifica profilo,
push, registrazione/recovery, federazione, nuova pipeline media server, deploy.
Queste funzioni restano nel percorso di parità successivo; M2 non è la parità completa.
Nessuna nuova dipendenza o migrazione è presunta necessaria: motivare esigenze
concrete prima di modificare schema, toolchain o protocollo.

## 2. Prerequisito M1

Prima dell'implementazione M2, chiudere le voci aperte di [STATO-IOS.md](STATO-IOS.md):
picker manuale, verifica accessibilità/VoiceOver e verbale sulla build finale.
Lettura del codice e pianificazione M2 possono avvenire prima, senza dichiarare
superato il gate. Se manca una prova manuale, indicare esattamente quale, preservare
M1 e lasciare la ripresa pronta; non sostituirla con una fixture automatica.

## 3. Riuso e lacune osservate

| Area | Esistente | Lavoro M2 previsto |
| --- | --- | --- |
| Sessione e HTTP | AuthCoordinator, APIClient, Keychain, epoch e refresh | Riusare, con cancellazione dei task storie a logout/cambio account |
| Media | Lettura bearer e upload M1, preparazione foto separata dalla UI | Riusare foto; aggiungere preparazione/riproduzione video strettamente necessaria |
| Post e dominio | `postInput` accetta `story`; scadenza e visibilità nel DB | Adapter nativo dedicato, senza ampliare `native/post` indiscriminatamente |
| Feed M1 | Bootstrap ristretto, modelli parziali, filtro post ordinari nel client | Lettura storie indipendente, modello con `expires_at`, nessun caricamento implicito dal feed |
| Web | `components/story-player.tsx`, barra storie in `components/social-app.tsx`, `view-story` in `mutate` | Usare come riferimento di comportamento, verificando i percorsi effettivi |
| Privacy viewer | `story_views`, RLS e vista autore sul web | Leggere stato visto proprio e viewer autorizzati, senza esportare il grafo sociale |
| Prove | Fixture M1, test server e runner Linux/device | Estendere solo ciò che serve; nuovi casi M2 distinti dai risultati M1 |

Il bootstrap M1 omette campi necessari alle storie, incluso `expires_at`:
non basta sbloccare un rendering già esistente per considerare M2 implementata.

## 4. Contratto HTTP proposto, da finalizzare prima del codice

I nomi seguenti sono **proposte**, non endpoint già disponibili. Confermarli con
route, tipi, query RLS e test; se cambiano, aggiornare questo piano prima dell'UI.

| Operazione | Proposta | Vincoli |
| --- | --- | --- |
| Elenco storie | `GET /api/native/stories` | Bearer/MFA obbligatori, solo storie attive visibili, colonne esplicite, cursore data/UUID e fine pagina esplicita |
| Pubblica | `POST /api/native/story` | Corpo validato da dominio esistente, `kind=story` imposto/verificato dal server; scadenza server, quote e media di proprietà |
| Conferma visualizzazione | `POST /api/native/story/view` | UUID storia, viewer derivato dal chiamante, vincolo unico/upsert; nessun retry automatico delle scritture |
| Viewer dell'autore | `GET /api/native/story/viewers` | `story_id` validato, autore verificato e RLS, paginazione; accesso altrui respinto |
| Upload/lettura media | Endpoint M1 esistenti, se compatibili | Verificare scopo del media e controlli attuali; non riusare allegati chat o percorsi di terzi |

Specificare nei test prima dell'UI: JSON minimo, campi nullable, MIME supportati,
scadenza UTC, `viewed` proprio e cursori. Scegliere pagine finite da 40 con lookahead
41 e ordinamento deterministico. Nessuna lettura di chat/notifiche/eventi nel nuovo
snapshot; nessun ampliamento del bootstrap M1. Nessun client amministrativo nelle
query ordinarie. Le query e le RLS decidono la visibilità, non filtri client.

Gli endpoint nativi nuovi entrano in un'allowlist esplicita e richiedono bearer
anche se ci sono cookie. Nessun bypass globale di Origin; conservare i POST web.
Risposte private/no-store, validazione UUID/cursori/corpi e limiti byte effettivi.
Non usare il generico `/api/action` senza adattarne in modo circoscritto il contratto.

## 5. Incrementi e condizioni di uscita

### M2.1 — Lettura e player foto

- Implementare contratto e test della lettura; poi modello, stato indipendente,
  barra storie e player SwiftUI con caricamento, errore, vuoto e fine esplicita.
- Sequenza congelata all'apertura del player per evitare riordini durante refresh;
  scartare/rimuovere una storia scaduta anche mentre il player è aperto.
- Foto: timer di cinque secondi solo dopo media pronto e visibile. Pausa,
  pressione prolungata, app in background e schermata non attiva fermano il tempo.
- Avviso prima di scaricare/riprodurre il media; Mostra/Nascondi reversibile,
  nuova storia nuovamente protetta. Niente prefetch oltre un avviso non accettato.
- Precedente/successiva/chiudi e pausa con pulsanti accessibili; con VoiceOver
  attivo evitare avanzamenti automatici che sottraggono il contenuto al lettore.

Uscita: contratti e timer con clock controllato, test sessione/logout,
build Darwin e prova player con fixture sintetiche sull'iPhone, chiaro/scuro,
Dynamic Type e VoiceOver. Nessuna pubblicazione necessaria a questa fase.

### M2.2 — Pubblicazione foto

- Composer storia con foto, descrizione entro 128 caratteri e avviso entro 160,
  usando le stesse semantiche Unicode del server e della bozza M1.
- Riutilizzare preparazione JPEG, limiti, cancellazione e revisioni selezione M1.
  Metadati originali non inoltrati; conferma scarto bozza e stati invio espliciti.
- Riutilizzare validazione e mutazione dominio senza duplicare scadenza/quote.
  Conservare percorso upload dopo errore di validazione; esito ambiguo richiede
  verifica delle storie prima di un nuovo invio, senza retry automatico.
- Aggiornamento elenco dopo invio senza che una lettura precedente lo sovrascriva.

Uscita: test limiti, selezione tardiva, annullamento, logout/rifiuto auth,
esito perso e visibilità. Installazione verificata e flusso manuale su account
ambiente di prova concordato; non pubblicare contenuti su account reali come fixture.

### M2.3 — Video

- Definire un insieme minimo di MIME/contenitori compatibile con l'upload attuale;
  verificare durata (massimo 20 s), codec e dimensione finale entro 3 MiB nel client.
- Preparazione/cancellazione fuori dall'interfaccia, pulizia file temporanei privati,
  limiti sorgente espliciti e rifiuto comprensibile se la conversione non è possibile.
- Riprodurre dati ottenuti via bearer: niente URL pubblici, token nella query,
  URLSession condivisa con cookie o file persistenti non protetti per AVPlayer.
  Prima scegliere e provare il trasporto compatibile con il target iOS 17.
- Avanzare alla fine del filmato o a 20 s di riproduzione; pausa/background non
  consumano il tempo. Audio controllabile e riproduzione interrotta alla chiusura.
- I controlli byte/formato server esistenti non certificano la durata del file:
  documentare il limite attuale, senza promettere una nuova pipeline di decodifica.

Uscita: contratto media, errori codec/oversize, cancellazione e pulizia temporanei
verificati; fixture video sintetiche su device, nessun accesso automatico alla galleria.

### M2.4 — Visualizzazioni private e chiusura

- Confermare visualizzazione soltanto dopo media effettivamente visibile, con
  avviso accettato e app in primo piano; non al download o al prefetch.
- Viewer derivato dall'identità server, duplicati innocui; lista viewer soltanto
  per l'autore. Reazione a revoca, blocco, eliminazione e scadenza senza dati residui.
- Anello visto/non visto e riordino delle storie viste dopo chiusura del player;
  nessuna graduatoria di engagement o contatori pubblici.
- Finalizzare regressione M1+M2, accessibilità, manuale, evidenze e passaggio di consegne.

Uscita: matrice sotto completata con evidenze per ciascun livello. Non dichiarare
la parità web o il rilascio pubblico in seguito alla sola chiusura M2.

## 6. Matrice di accettazione

| Caso | Prova minima attesa |
| --- | --- |
| Bearer assente/invalido e cookie presente | 401 senza fallback; MFA insufficiente respinta |
| Visibilità, follow, blocchi, scadenza, proprietà viewer | Query/RLS con ruoli distinti e fixture autorizzate; test stub distinti dal cloud |
| Pagine e data uguale | 40 → 80 → 85 senza duplicati/salti, cursore terminale e validazione input |
| Avviso | Nessuna richiesta media/timer prima della rivelazione; Mostra/Nascondi e cambio storia |
| Player | Pronto/errore/pausa/background/chiusura, timer foto e fine video deterministici |
| Scadenza durante visione | Contenuto rimosso, timer fermato, nessuna nuova ricevuta/media |
| Sessione concorrente | Logout/account nuovo durante lettura/upload/player: esiti vecchi scartati, memoria e file privati liberati |
| Pubblicazione | Limiti testo/foto/video, upload interrotto, risposta persa e nessun duplicato da retry |
| Viewer | Upsert senza duplicati, estraneo respinto, nessuna lista globale o profili non autorizzati |
| Accessibilità | Comandi etichettati, target minimi 44 pt, Dynamic Type, chiaro/scuro, VoiceOver ascoltato |
| Compatibilità M1/web | Suite esistenti verdi, Origin/cookie invariati, bootstrap ristretto e profilo indipendente |

## 7. Verifica e registrazione

Per server: test mirati delle nuove route e dominio; test SQL/RLS dove necessario,
poi `npm run check` al completamento del blocco. Per Swift: estendere gli XCTest
Linux effettivamente eseguibili e i contratti modelli, poi build da `ios/` con
`xtool dev build`. Non introdurre ora comandi o runner M2 inesistenti.

La diagnostica su iPhone richiede build/installazione verificata, fixture DEBUG
riconoscibile prima di catture/tocchi, timeout che terminino i processi figli e
ripristino dell'avvio normale. Picker e VoiceOver restano manuali. Nessuna scansione
AX di superfici personali e nessuna pubblicazione cloud automatica.

Durante l'implementazione creare rapporti datati `docs/evidence/ios-m2-*.json`
solo per prove realmente eseguite: build/revisione, ambiente, comandi, risultati,
limiti e stato del ripristino. I nomi qui sono convenzioni future, non rapporti esistenti.
Aggiornare `STATO-IOS.md` e `ios/README.md` dopo ogni incremento.

## 8. Primo passo per la prossima sessione

Leggere [PROSSIMA-SESSIONE.md](PROSSIMA-SESSIONE.md), controllare il diff e i gate M1.
Dopo la chiusura M1, iniziare esclusivamente M2.1 dal contratto dati e dai test
server. Riusare componenti standard SwiftUI e i contratti già presenti; non
implementare contemporaneamente chat, video e nuovi domini.

# SN per iOS: SwiftUI e xtool

Aggiornato al 24 ottobre 2026: M1 installata via USB, backend raggiungibile via Wi-Fi; collaudo runtime esteso aperto.
Il client nativo usa le API SN; backend Next.js e Supabase restano condivisi con il sito.

## Automazione del 26 ottobre 2026

Risposte non leggibili: gli errori di decodifica HTTP ora hanno codice locale
`invalid_response` e un messaggio distinto dalla connessione assente. Sessione,
feed e cursore restano conservati, nessun refresh o retry automatico; un esito
di scrittura non decodificabile resta ambiguo. Due regressioni sul client HTTP
reale hanno riprodotto il problema prima della correzione.
Collaudo dopo la correzione: 34 XCTest Linux, 15 controlli modelli, 77 test server,
5 regressioni rete, typecheck, lint e build Darwin superati. Installazione device
di questo incremento ancora distinta dalla compilazione.

Preparazione automatica ambiente: `python scripts/prepare-ios-dev.py` riusa l'IP
privato configurato se ancora assegnato, altrimenti sceglie l'unico IP privato
sull'interfaccia di default. Aggiorna soltanto base URL ed eccezione ATS, avvia o
riallinea il servizio di questo checkout e verifica bootstrap 401 senza token.
`--check` è diagnostico; `--install` aggiunge build/firma/installazione USB e
richiede Verifying 100%. `--host` risolve reti ambigue con un IP privato assegnato.
Nessuna modifica a firewall, router, rete o cloud. Il servizio resta transitorio:
dopo riavvio del computer eseguire nuovamente il comando. Cinque regressioni
offline coprono cambio DHCP, reti ambigue, IP non assegnati e preservazione ATS;
eseguite anche in CI e nel collaudo unico M1.

Ripristino connessione nella stessa giornata: il servizio transitorio non era
più presente e il DHCP aveva assegnato al computer `192.168.1.251`, mentre l'app
puntava ancora a `192.168.1.9`. Allineati base URL ed eccezione ATS al nuovo IP;
riavviato `sn-ios-dev` vincolato a `192.168.1.251:3000`. Bootstrap locale senza
token: 401 in circa 2 secondi, servizio attivo. Questo controllo prova la risposta
del backend dal computer, non il percorso autenticato dal telefono.
I comandi e indirizzi `.9` sotto sono storici: verificare sempre l'IP corrente.
Build Darwin superata; installazione USB completata con Verifying 100%, exit 0,
dopo conferma dell'utente che il telefono era sbloccato. App avviata via CoreDevice
senza flag di test. Log successivi: refresh 200, bootstrap 200 (2,2 s), media 200
(837 ms); percorso autenticato dal telefono nuovamente raggiungibile.

`python scripts/check-ios-m1.py` dalla root esegue in sequenza XCTest Linux,
contratti Swift, regressioni server M1, typecheck, lint e build Darwin. Ogni fase
ha un limite di 15 minuti; al primo errore termina con codice non zero. Output
breve, log e rapporto JSON in `.impeccable/review/m1-check-*/`, esclusi da Git.
Non installa l'app né scrive nel cloud. Per includere la UI dell'app DEBUG già
installata, usare il Python del venv pymobiledevice3 con
`--device-bundle '<bundle-firmato-SN>'`; richiede iPhone sbloccato e libero.

Esecuzione locale superata: 32 XCTest, 15 controlli modelli, 77 test server,
typecheck, lint completo e build Darwin. Audit ripetuto sull'iPhone senza
reinstallazione: ancora rilievi di contrasto e Dynamic Text, compreso il banner
DEBUG. Alcuni rettangoli/colori segnalati non coincidono con il testo visibile;
non sono stati ignorati né classificati automaticamente come falsi positivi.
[Rapporto sintetico](../docs/evidence/ios-m1-accessibility-2026-10-26.json).
Tema, dimensione testo e avvio normale ripristinati automaticamente. Picker
nativo e ascolto VoiceOver restano aperti; nessun avanzamento a M2.

## Consolidamento M1 del 24 ottobre — incrementi successivi

L'utente ha provato a pubblicare con avviso: invio riuscito; inizialmente foto e
riapertura segnalavano offline. Il riavvio dell'agente aveva spento il backend.
Dopo il riavvio del server l'utente conferma «ora funziona»; letture media 200 in
497–831 ms osservate. Non attribuire quell'errore a Storage o al protocollo native.

Il backend ora è il servizio utente transitorio `sn-ios-dev.service`, indipendente
dalla sessione dell'agente; si ferma al logout/reboot del computer, non è un deploy.
Comandi dalla root (l'indirizzo va ricontrollato):

```bash
systemd-run --user --unit=sn-ios-dev --collect --property=Restart=on-failure --working-directory="$PWD" "$(command -v node)" node_modules/next/dist/bin/next dev --hostname 192.168.1.9 --port 3000
systemctl --user status sn-ios-dev.service
journalctl --user -u sn-ios-dev.service -n 30 --no-pager
systemctl --user stop sn-ios-dev.service
```

**Incremento 1 — composer:** bozza solo RAM, revisione della selezione foto per
ignorare esiti tardivi e impedire invii durante la preparazione della nuova foto.
Sostituire/rimuovere azzera percorso caricato e descrizione; rimozione disponibile
anche durante caricamento/errore. Avvisi normalizzati prima del limite UTF-16,
messaggi di connessione validi sia su Wi-Fi sia su USB. 22 XCTest Linux e build
Darwin superati; nuova build non ancora installata a questo punto del registro.
Detector meccanico sulle due viste modificate: nessun rilievo. Screenshot USB
non disponibile (`screenshotr: Invalid service`); nessuna verifica visiva inventata.

**Incremento 2 — scritture e sessione:** upload/pubblicazione aggiornano offline e
recupero come le letture; un rifiuto definitivo della sessione cancella token e
dati locali, errori arrivati dopo logout vengono scartati. Una sola scrittura per
tentativo: nessun refresh+retry dopo un rifiuto. Timeout HTTP 408, 5xx e risposte
perse conservano il blocco del reinvio a esito incerto; rifiuti espliciti 4xx
(escluso 408) consentono correzione manuale. Casi di regressione riprodotti prima
del fix; **26 XCTest Linux e build Darwin superati**. Installazione finale ancora
da eseguire dopo il prossimo incremento.

**Incremento 3 — storico proprio:** il Profilo ora usa `GET /api/profile/posts`,
con query legata all'utente verificato e RLS. Pagine da 40 post ordinari non scaduti,
esclusi i post delle cerchie, ordine data/UUID e cursore composto per non perdere
post con lo stesso timestamp. Una riga di lookahead distingue la pagina finale.
Letture bearer/MFA senza fallback cookie quando Authorization è presente; il
percorso web a cookie resta disponibile. Nessun cambio schema o cloud.

Il tab ha caricamento, errore con Riprova, refresh, fine esplicita e cursore propri;
non dipende più dalla finestra del feed. Errori conservano l'archivio già letto;
logout elimina l'archivio e scarta risposte tardive. Una pubblicazione durante il
caricamento invalida la risposta vecchia e richiede una nuova lettura.

Verifiche finali: **30 XCTest Linux, 13 controlli modelli Swift, 75 test server e
regole**, typecheck, lint mirato e build Darwin superati. Il test pubblicazione
concorrente ha fallito prima della correzione e superato dopo. Tutti e tre gli
incrementi sono installati: `xtool dev run --usb`, Verifying 100%, exit 0.
L'utente conferma il tab Profilo funzionante sulla nuova build. Log del 24 ottobre:
refresh 200 (547 ms), bootstrap 200 (1689 ms), profile/posts 200 (400 ms) e media
200 (575–733 ms). È conferma del percorso reale su iPhone/Wi-Fi; paginazione
oltre 40 post e accessibilità sul device restano aperte.

## Ripresa del 24 ottobre 2026 — avvisi sui contenuti

Riprese le modifiche non committate del composer: ora è possibile aggiungere un
avviso facoltativo (massimo 160 unità UTF-16), obbligatoriamente non vuoto quando
attivato. Il valore passa a `native/post` tramite il contratto condiviso esistente;
il server lo normalizza e lo valida. Nessuna nuova API o migrazione. Annullare
richiede conferma anche quando la bozza contiene soltanto un avviso; rimuovere la
foto azzera la sua descrizione. Conservato il blocco del reinvio a esito incerto.

L'utente conferma app aperta e accesso funzionante all'inizio della sessione.
`xtool dev build` superato e `xtool dev run --usb` completato con **Verifying 100%,
exit 0** per la nuova build. Aprirla manualmente; pubblicazione con avviso e
rivelazione nel feed non ancora confermate sul telefono.

Verifiche del 24 ottobre: 18 XCTest Linux sul coordinatore reale (shim Combine,
non SwiftUI/Keychain), 10 controlli modelli Swift, 30 test server mirati e lint del
test modificato superati. I nuovi casi coprono trasporto dell'avviso, validazione
server oltre 160 caratteri e mancato retry automatico della pubblicazione.

**Rete corrente:** Wi-Fi autorizzato dall'utente, `wlo1` a `192.168.1.9/24`;
nessuna interfaccia hotspot USB attiva. `SNApiBaseURL` e ATS aggiornati a
`http://192.168.1.9:3000`. Backend avviato con
`npm exec next dev -- --hostname 192.168.1.9 --port 3000`.
UFW consente già 3000/tcp da `192.168.1.0/24`; nessuna regola modificata.
Bootstrap senza token dal computer: 401 in 1,20 secondi (prima richiesta), non
prova della raggiungibilità dal telefono. I paragrafi USB sotto sono storici.

Prossime prove: riaprire SN sulla stessa rete, inviare testo/foto con avviso,
verificare il contenuto nascosto e «Mostra contenuto», misurare primo download e
recupero offline. Paginazione su device, VoiceOver e Dynamic Type restano aperti.
M1 non dichiarata completamente collaudata; M2 non iniziata.

## Stato attuale e prossimo incremento

| Tappa | Stato | Evidenza |
| --- | --- | --- |
| M0 — sessione | Flussi principali funzionanti su iPhone: login, verifica sessione, rinnovo, logout/riapertura, recupero offline, MFA | Conferme dell'utente nella sessione del 15 ottobre; test server in `tests/native-auth.test.ts` |
| M0.5 — crypto 1:1 | Completata su iPhone con CryptoKit, in entrambe le direzioni web ↔ iPhone | [Rapporto](../docs/evidence/ios-crypto-interop-2026-10-15.json): 35 controlli, tre risposte su tre dispositivi, allegato verificato |
| M1 — feed, profilo, post con immagine | Implementato e installato via USB, collaudo runtime aperto | Contratto in [PIANO-APP-NATIVA.md](../docs/PIANO-APP-NATIVA.md) |
| XCTest sessione/bozza | 30 test di logica eseguiti su Linux; runner Darwin/SwiftUI ancora non eseguito | `bash scripts/check-ios-session.sh`; shim di Combine, API/store in memoria |

La versione 0.2 contiene feed cronologico con aggiornamento manuale, paginazione
esplicita, avvisi sui contenuti, lettura autenticata delle immagini, proprio profilo
e composizione di un post con una foto tramite PhotosPicker. Il profilo carica i
propri post ordinari con pagine indipendenti dal feed. Storie,
video, chat UI, interazioni e modifica profilo restano alle tappe successive.

Le scritture non vengono ritentate automaticamente. Una risposta di pubblicazione
persa blocca un secondo invio dal composer e chiede di controllare prima il feed.
Le immagini sono ridimensionate a 1600 pixel e ricodificate JPEG (limite 3 MiB),
senza inoltrare i metadati originali. L’upload conserva il percorso per evitare di
ricaricare la foto se una validazione del post viene rifiutata.

M0.5 resta completata: nessuna modifica ai vettori o al protocollo crypto.

Le conferme funzionali M0 non attestano tutti i casi concorrenti della matrice tecnica.
Login/MFA su iPhone dopo la migrazione database sono stati confermati nella prova M1
del 23 ottobre (vedi sotto). I test concorrenti locali non sostituiscono le prove
runtime su telefono né la verifica della revoca sul server.

## Ambiente e struttura

Swift 6.4.1 su Linux, SDK `darwin` (iPhoneOS 27.0), xtool commit
`f0a1f90efdbb0dc023e276ff529da92618da7a87`. Target minimo iOS 17; iPhone di prova
con iOS 27.0.1. Firma, installazione e runtime sono stati verificati.

- `Package.swift`, `xtool.yml`, `SN/`: app SwiftPM; `project.yml` è il precedente XcodeGen.
- `SN/Auth/`: Keychain token, single-flight refresh, epoch di logout e stato offline.
- `SN/Networking/`, `SN/Models/`, `SN/Views/`: API, modelli e schermate M0.
- `ChatCrypto/`: modulo 1:1 condiviso fra CryptoKit iOS e test Linux.
- `ChatCrypto/Package.resolved` e `Package.resolved`: lockfile da mantenere versionati.
- `SN/Diagnostics/CryptoProbeDiagnostics.swift`: rapporto sintetico DEBUG, senza rete.
- `SNTests/`: test sessione eseguibili su Linux tramite `SessionChecks`; runner Darwin ancora da verificare.

## Build e dispositivo

Dalla root del repository:

```bash
swift --version
swift sdk list
xtool --version
cd ios
xtool dev build
xtool devices --usb --no-wait
xtool dev run --usb
```

Una build alla volta. `xtool dev run --usb` firma e installa; aprire l'icona SN a mano.
`xtool launch` non funziona nell'ambiente verificato con iOS 17+ (debugserver RemoteXPC).
Non usare Xcode, simulatori o VM macOS, né reinstallare SDK/toolchain senza diagnosi.
Controllare firma/provisioning solo se necessario, senza copiare credenziali nei log.

## Server raggiungibile dall'iPhone

Nella sessione del 23 ottobre si usa **solo hotspot personale via USB**; non serve
che telefono e computer siano sul Wi-Fi dell’università. L’interfaccia USB del
computer è `enp8s0f3u1c4i2`, con indirizzo `172.20.10.3/28` osservato nella sessione.
`SNApiBaseURL` in `SN/Info.plist` punta a `http://172.20.10.3:3000`, con eccezione ATS
circoscritta. L’indirizzo può cambiare: verificarlo con `ip -br -4 address` prima
della prossima build. Non usare il vecchio `192.168.1.9` né ascoltare su `0.0.0.0`.

Dopo aver attivato Hotspot personale in modalità USB sul telefono:

```bash
npm exec next dev -- --hostname 172.20.10.3 --port 3000
```

Il server risponde solo sull’indirizzo USB. `localhost` nell’app indica il telefono.
Il test HTTP dal computer ha raggiunto `/api/bootstrap` e ottenuto 401 senza token;
non prova ancora la raggiungibilità dal telefono né un accesso MFA completo.
Il firewall bloccava i SYN dall’iPhone: confermato nei log kernel UFW con
`IN=enp8s0f3u1c4i2 SRC=172.20.10.1 DST=172.20.10.3 DPT=3000`. Aggiunta esclusivamente:

```bash
pkexec ufw allow in on enp8s0f3u1c4i2 proto tcp from 172.20.10.1 to 172.20.10.3 port 3000 comment 'SN sviluppo iPhone solo USB'
```

Per rimuoverla dopo lo sviluppo:

```bash
pkexec ufw delete allow in on enp8s0f3u1c4i2 proto tcp from 172.20.10.1 to 172.20.10.3 port 3000
```

La regola non apre la rete universitaria; le regole preesistenti restano invariate.
Dopo la correzione l’utente ha confermato accesso e feed sull’iPhone via USB.
Per rilascio serve HTTPS.

## Verifica M1 del 23 ottobre 2026

- `xtool dev build`: completata senza avvisi, target iOS 17, SDK Darwin esistente.
- `npm test -- tests/native-social.test.ts tests/native-auth.test.ts tests/security-api.test.ts`:
  29 test superati. Coprono bearer obbligatorio sulle scritture native, nessun
  fallback cookie, MFA, Origin web preservato, letture e limiti upload condivisi.
- `npm run typecheck` e lint mirato di route, social e test: superati.
- Esecuzione Swift dei modelli Foundation su Linux: 8 controlli superati, incluso
  `media_path: null` richiesto per i post testuali. Non è il runner `SNTests`.
- `xtool dev run --usb`: installazione e verifica al 100%, exit 0. Il primo tentativo
  aveva ricevuto provisioning Apple 409 (nessun device iOS corrispondente); il secondo
  è riuscito senza cambio account, registrazioni manuali o aggiornamento toolchain.
  La causa transitoria non è stata accertata. Aprire SN a mano sul telefono.
- Accesso, feed e foto nel profilo via USB confermati dall’utente il 23 ottobre, dopo
  la regola UFW. Log server: login 200, MFA 200, bootstrap 200 e media 200. Due tentativi
  MFA avevano ricevuto 503 prima del successo; nessun retry automatico è stato aggiunto.
- L’utente ha confermato anche il pulsante Nuovo post, pubblicazione riuscita e la
  nuova foto visibile nel post. Nei log osservati: native/post 200 e bootstrap 200;
  l’upload separato non è stato conservato come evidenza di questa prova manuale.
- Paginazione oltre la prima finestra, riapertura dopo pubblicazione, VoiceOver,
  Dynamic Type e aspetto chiaro restano da verificare. Aspetto scuro osservato su iPhone.
  Cattura reale USB del profilo in aspetto scuro acquisita; altre schermate e
  accessibilità non ancora verificate visivamente.

## Controlli del contratto M1 (Linux)

```bash
swiftc -module-cache-path /tmp/sn-swift-model-cache ios/SN/Models/Session.swift ios/SN/Models/Feed.swift ios/ContractChecks/main.swift -o /tmp/sn-ios-model-contract
/tmp/sn-ios-model-contract
```

Sono tredici controlli con dati sintetici dei modelli JSON, non test runtime SwiftUI
né il runner XCTest delle sessioni.

## Prove ripetibili

Dalla root:

```bash
swift test --package-path ios/ChatCrypto
ios/ChatCrypto/.build/debug/SNChatInterop > /tmp/sn-crypto-linux-report.json
node scripts/ios-crypto-interop.mjs verify /tmp/sn-crypto-linux-report.json
node scripts/ios-crypto-interop.mjs verify docs/evidence/ios-crypto-interop-2026-10-15.json
npm test -- tests/crypto.test.ts tests/native-auth.test.ts
```

Risultati registrati: due XCTest crypto Linux, 35 controlli interni, sei test Web Crypto;
rapporto `ios-cryptokit` del telefono verificato dal codice web. Procedura, estrazione
USB e rigenerazione vettori in [IOS-CRYPTO-INTEROP.md](../docs/IOS-CRYPTO-INTEROP.md).
Non rigenerare i vettori per continuare M1: cambierebbe il fixture ID del rapporto.

## Adapter M1 e prossimo passo

`GET /api/posts` e `GET /api/media` accettano ora identità bearer verificata come
bootstrap; senza Authorization il percorso web resta a cookie. Un header invalido
non ripiega mai sui cookie. `POST /api/native/post` e `/api/native/upload` richiedono
bearer e MFA e riusano mutazione social, RLS, quote, prenotazione byte e validazioni
del sito. Nessun bypass generale Origin: action/upload web restano protetti.
Nessuna migrazione o modifica cloud è stata eseguita per M1.

Aprire SN e completare il collaudo runtime sopra. M1 non è ancora dichiarata conclusa.
Per continuare con OpenCode: [OPENCODE.md](../docs/OPENCODE.md).

## Consolidamento sessione e feed — 23 ottobre 2026

Ripresa dal commit `3aeb037`: M1 già funzionante sul telefono, confermati dall’utente
app aperta, accesso e hotspot USB. Nessuna nuova tappa M2 dichiarata conclusa.

Correzioni ad AuthCoordinator:
- Logout: token, dati del feed e stato locale cancellati prima di attendere un rinnovo
  in corso. La revoca server attende ancora il token ruotato (F2/F4).
- Restore: un errore di rinnovo arrivato dopo logout viene ignorato tramite epoch;
  non può più ripristinare lo stato signedIn/offline. Caso riprodotto dal nuovo test
  prima della correzione, poi superato.

`bash scripts/check-ios-session.sh`: **11 XCTest superati** sul coordinatore reale,
modelli e protocolli. Copertura: single-flight, refresh rifiutato/offline, logout
concorrente e token revocato, ripristino, paginazione senza duplicati/fine finestra,
ripresa dopo errore e filtro follow/cerchie. Un test preesistente di logout chiamava
probe senza prima caricare i token: corretto affinché eserciti davvero il rinnovo.
I protocolli TokenStore/APIClient sono separati dalle implementazioni Apple/HTTP
per compilare la stessa logica senza dipendenze Apple. Lo shim Combine memorizza
soltanto valori: **non è verifica SwiftUI o Keychain**. Dettagli in
[SessionChecks](SessionChecks/README.md). Nessuna dipendenza di rete per questi test.

`xtool dev build` superato; `xtool dev run --usb` completato con installazione e
verifica al 100%, exit 0. L’avvio e il collaudo della nuova build non sono ancora
confermati dall’utente. Rete ricontrollata: Wi-Fi universitario disconnesso con
`nmcli device disconnect wlo1`; unica route predefinita via `172.20.10.1` sull’USB.
La rete Wi-Fi resta disconnessa a fine sessione. Backend sempre sull’indirizzo USB.
Paginazione sul telefono, riapertura dopo invio e accessibilità restano prove runtime
aperte finché non arriva una conferma esplicita; i test locali non le sostituiscono.

## Recupero connessione e immagini — 23 ottobre 2026

Conferma dell’utente dopo la riapertura: i post vengono caricati. Nessun pulsante
«Carica i post precedenti» con pochi post, quindi la paginazione oltre la prima
finestra resta non esercitata sul device. Segnalati caricamento foto molto lento e
avviso «No connection» persistente anche quando le immagini erano infine visibili.

Causa riprodotta con XCTest: `image()` completava senza aggiornare offline/errore.
Le foto erano inoltre scaricate di nuovo senza riuso tra feed e profilo. Correzioni:
- Una risposta media riuscita rimuove lo stato e l’avviso di connessione assente.
  Una foto già in cache non conta come prova di connessione ripristinata.
- In primo piano, durante offline, lettura bootstrap con attese 3, 6, 12, 24,
  poi 30 secondi tra i tentativi. Il task termina al recupero, al logout o quando
  l’app passa in background; nessuna scrittura ripetuta automaticamente.
- Le immagini fallite ripartono al recupero della connessione. Una singola richiesta
  per percorso condivisa fra letture contemporanee; cache NSCache solo in memoria,
  limiti richiesti 16 MiB e 24 elementi, svuotata al logout/sessione invalidata.
  Non esiste cache disco dei media. NSCache può espellere immagini prima dei limiti.
- La cancellazione URLSession non viene più tradotta in errore di connessione.

**16 XCTest locali superati**, inclusi i nuovi casi di avviso persistente, richieste
media duplicate, cache che non nasconde offline, pulizia al logout, recupero e
cancellazione. I primi due difetti sono stati riprodotti dai test prima del fix.
Build Darwin superata. Rimane da misurare il primo download sul telefono: la cache
riduce le richieste ripetute, ma non prova di aver risolto l’attesa iniziale della
rete/backend. Nessuna misurazione autenticata dei tempi media disponibile nei log
consultati; non attribuire la lentezza al provider senza evidenza.

Controllo rete locale: `/api/bootstrap` senza token ha risposto 401 in 51 ms dal
computer, vincolando curl all’interfaccia USB. Dimostra backend attivo e risposta
locale rapida, non misura Auth, download Storage o percorso dal telefono.

Installazione della correzione: primo tentativo `xtool dev run --usb` arrivato al
100% di trasferimento ma senza fase Verifying; interrotto con SIGINT dopo attesa,
non considerato riuscito anche se il processo è uscito 0. Secondo tentativo con
build finale anch’esso al 100% del trasferimento, verifica finale in attesa al
momento del salvataggio. Richiesto di tenere iPhone sbloccato sulla Home. Non
attribuire questo stato a un errore di firma senza diagnostica; non equivale a
runtime confermato. L’installer resta in attesa, aggiornare lo stato al suo esito.

Esito finale: dopo la richiesta di tenere il telefono sbloccato, il secondo
installer ha completato **Verifying 100%, exit 0**. La build con recupero automatico
e cache immagini è quindi installata e verificata via USB. La coincidenza con lo
sblocco non dimostra la causa dell’attesa. Aprire SN manualmente: velocità del primo
download e scomparsa automatica dell’avviso sulla nuova build attendono il collaudo
runtime dell’utente. Il push del fix e del grafo è riuscito (`e2e6492`) dopo due
HTTP 408 usando opzioni temporanee HTTP/1.1 e postBuffer; nessuna configurazione Git
persistente modificata e nessun ricorso al Wi-Fi universitario.


## Collaudo automatizzato M1 — 24 ottobre 2026, passaggio finale

Rapporto corrente: [IOS-M1-VERIFICA.md](../docs/IOS-M1-VERIFICA.md) (dal README iOS:
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

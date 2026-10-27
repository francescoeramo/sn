# Stato iOS — punto di riferimento per le sessioni

Aggiornamento: **27 ottobre 2026, sera**. M1 chiusa per la tappa di sviluppo: picker e VoiceOver confermati,
contrasto corretto e Dynamic Type massimo verificato su iPhone. Non è un audit
di accessibilità certificato o un rilascio pubblico.

## Stato acquisito

| Tappa | Stato | Evidenza e limite |
| --- | --- | --- |
| M0 — sessione | Funzionante su iPhone | Login, MFA, rinnovo, logout/riapertura e recupero offline confermati; le singole conferme non certificano tutta la matrice tecnica |
| M0.5 — crypto 1:1 | Completata | Rapporto CryptoKit/Web Crypto del 15 ottobre: 35 controlli, tre dispositivi e allegato; nessuna chat UI o trasferimento storico impliciti |
| M1 — feed, profilo e foto | Chiusa per la tappa di sviluppo | Feed e archivio proprio paginati, pubblicazione con una foto, avvisi e recupero sessione; evidenze di accettazione sotto |
| M2 — storie native | M2.1 in corso: lettura server implementata, player da sviluppare | [Piano M2](PIANO-IOS-M2.md), lettura indipendente e finita; nessuna pubblicazione o player attestati |
| Parità completa e rilascio | Da completare | Interazioni, altri profili/modifica profilo, chat, gruppi, cerchie, eventi, registrazione/recovery e distribuzione hanno lavoro separato |

## Ultime evidenze, senza riesecuzione in questa sessione

Il consolidamento del 27 ottobre in [README iOS](../ios/README.md) riporta:

- `npm run check`: lint, typecheck, **193 test** e build Next.js superati.
- **56 XCTest Linux**, build Darwin e installazione USB verificata.
- **28 controlli interni iPhone**; sei controlli UI Mostra/Nascondi in chiaro/scuro.
- Bootstrap nativo osservato con risposta 200 dopo ripristino dell'avvio normale.

Fonti: [bootstrap M1](evidence/ios-m1-native-feed-2026-10-27.json),
[avvisi](evidence/ios-m1-content-warning-2026-10-27.json),
[salvataggio sessione](evidence/ios-m1-session-storage-2026-10-27.json).
I conteggi appartengono ai rapporti e non sostituiscono una nuova esecuzione.

## Chiusura M1: lavoro immediato

- [x] PhotosPicker: selezione, annullamento, sostituzione e rimozione, confermate dall’utente.
- [x] VoiceOver in Feed e Profilo confermato dall’utente.
- [x] Contrasto del titolo Profilo corretto con colore semantico label. Campioni visibili: minimo 18,82:1 in chiaro e 17,01:1 in scuro.
- [x] Dynamic Type massimo reale (slider 1,0), cattura ispezionata: testo ingrandito e a capo nella lista scorrevole. Preferenze e avvio normale ripristinati.
- [x] Rilievi Apple residui motivati come artefatti strumentali/fixture nel [rapporto finale](evidence/ios-m1-accessibility-resolution-2026-10-27.json), senza convertire i vecchi audit in “passed”.
- [x] M1 accettata per lo sviluppo successivo; nessuna certificazione completa o distribuzione pubblica implicita.

Il setter ora conserva tipo slider e tacche reali del device, tiene aperta la
connessione proprietaria dell’override e verifica applicazione/ripristino.
Tre regressioni Python incluse in CI e nel comando M1, cinque contratti runner
superati. Build Darwin e installazione USB Verifying 100% della correzione colore.

La paginazione sintetica 40 → 80 → 85 sul telefono e i controlli degli avvisi
sono già documentati. Non riaprire indiscriminatamente tutte le verifiche storiche.
Il picker personale non va attraversato con scansioni AX o automazioni: la prova
rimane manuale. I collaudi automatici usano solo fixture interne riconoscibili.

## Contratti già presenti

`native/auth/*`, `GET /api/native/bootstrap`, `GET /api/posts`,
`GET /api/profile/posts`, `GET /api/media`, `POST /api/native/post` e
`POST /api/native/upload` hanno già il supporto necessario a M1.
Il bootstrap M1 è deliberatamente ristretto: non ampliarlo per caricare tutte
le future funzioni. L'archivio proprio usa un cursore composto data/UUID.

Preservare bearer verificato, MFA e RLS, nessun fallback cookie con Authorization
invalido, Origin sulle scritture web, refresh single-flight, epoch della sessione,
Keychain e stato MFA pendente. HTTP effimero senza cookie/cache persistente,
media privati solo in RAM; nessun retry automatico delle scritture ambigue.

## Ambiente e regole di ripresa

Linux, SwiftPM e xtool; build da `ios/` con `xtool dev build`. Il runner Linux
con shim Combine, i test crypto e il runner Darwin/SwiftUI sono prove distinte.
Nessun ricorso al simulatore iOS su Linux o reinstallazione della toolchain.

Backend corrente: servizio utente `sn-ios-dev` su Wi-Fi autorizzato,
`192.168.1.251:3000`; app reinstallata con Verifying 100%. Vedi
[ripristino rete](evidence/ios-network-recovery-2026-10-27.md).
L’indirizzo è un dato della sessione, da ricontrollare, non un IP fisso.
Non cambiare rete, firewall, endpoint o configurazioni cloud per effetto di un piano.
Lo sviluppo iOS non autorizza distribuzione pubblica, spesa o attivazione federata.

## Ordine delle fonti

1. Questo stato per orientamento e prossimo passo.
2. `ios/README.md` e rapporti datati per comandi, ambiente ed evidenze concrete.
3. [Piano nativo](PIANO-APP-NATIVA.md) per invarianti e tappe;
   [piano M2](PIANO-IOS-M2.md) per il nuovo incremento.
4. Sezioni storiche del manuale, roadmap e brief come contesto, non stato corrente.

A ogni nuova sessione leggere [PROSSIMA-SESSIONE.md](PROSSIMA-SESSIONE.md).
Aggiornare questo file quando cambia lo stato, senza duplicare interi verbali
negli altri documenti. Stime verbali di durata non sono scadenze o evidenze.

## Incremento M2.1 — contratto di lettura

`GET /api/native/stories` implementato con bearer/MFA/RLS, solo autori propri o
seguiti accettati, scadenza attiva, pagine 40+1 e cursore data/UUID. Il flag viewed
legge soltanto ricevute del chiamante. Nessuna scrittura o ampliamento bootstrap.
Stato/server e test non significano player implementato o verificato su iPhone.
Prossimo incremento: modelli/stato Swift e player foto secondo PIANO-IOS-M2.md.

---
name: sn-ios-xtool
description: Sviluppa e verifica il client iOS SwiftUI di SN con SwiftPM e xtool su Linux. Usa per modifiche in ios/, errori del compilatore Darwin o prove su iPhone USB.
---

# SN con xtool

Il progetto è in `ios/`: `Package.swift`, `xtool.yml`, sorgenti in `SN/`, test sessione
in `SNTests/` e modulo/test crypto indipendenti in `ChatCrypto/`.
Leggi `ios/README.md` per lo stato e `docs/PIANO-APP-NATIVA.md` per il contratto del flusso.

- Usa il toolchain installato. Prima di scrivere codice verifica Swift, SDK Darwin e xtool.
  Controlla l'autenticazione senza copiare Apple ID, team o token in log condivisi.
- Compila da `ios/` con `xtool dev build`, una build alla volta. Se fallisce, usa la prima
  diagnostica utile e verifica la correzione prima di aggiungere altre funzionalità.
- Quando serve il dispositivo, usa `xtool devices --usb --no-wait` e `xtool dev run --usb`.
  Senza iPhone puoi compilare; registra la prova runtime come non eseguita.
- Usa SwiftUI, URLSession e Codable. Mantieni le regole di dominio sul server SN.
  Token nel Keychain; conserva single-flight del refresh, epoch del logout e stato offline.
- Il server sul computer va raggiunto tramite LAN o HTTPS; `localhost` nell'app è l'iPhone.
- Usa SwiftPM e i file xtool esistenti. Non reinstallare il toolchain, non usare VM macOS,
  xcodebuild, simctl o CocoaPods. Non aggiungere il prefisso di firma XTL al bundle ID.
- Conserva le modifiche preesistenti e `creaInvito.txt`. Non pubblicare, modificare il cloud
  o cambiare il protocollo E2EE come effetto collaterale della migrazione client.

Rispetta le tappe M0 (sessione), M0.5 (crypto web ↔ iPhone), M1 (feed, profilo,
pubblicazione). Stato al 15 ottobre 2026: M0 funzionale confermata dall'utente e
M0.5 verificata con CryptoKit sul device; prossimo incremento M1. Per lo stato corrente
prevale il README, non una vecchia sessione. La prova è descritta in
`docs/IOS-CRYPTO-INTEROP.md`; il rapporto è in `docs/evidence/ios-crypto-interop-2026-10-15.json`.
Non rigenerare i vettori né ripetere tappe concluse senza necessità concreta.

`swift test --package-path ios/ChatCrypto` esegue due XCTest crypto su Linux.
I test in `ios/SNTests` sono distinti: non dichiararli eseguiti perché app o crypto
compilano. Il relativo runner Darwin resta da accertare. Non proporre il simulatore
come ripiego su Linux. Mantieni i lockfile SwiftPM; su iOS il modulo usa CryptoKit,
mentre swift-crypto serve soltanto al backend Linux dei test.

Per M1 controlla prima i contratti server: solo auth native e bootstrap sono già
bearer. Le API di feed paginato, media e scritture richiedono adapter mirati che
mantengano RLS, controlli Origin per il web e assenza di fallback cookie sul nativo.

Fonti del tool: https://github.com/xtool-org/xtool e https://xtool.sh/.

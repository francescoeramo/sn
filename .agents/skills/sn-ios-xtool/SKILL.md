---
name: sn-ios-xtool
description: Sviluppa e verifica il client iOS SwiftUI di SN con SwiftPM e xtool su Linux. Usa per modifiche in ios/, errori del compilatore Darwin o prove su iPhone USB.
---

# SN con xtool

Leggi `docs/STATO-IOS.md` per stato/gate e `ios/README.md` per ambiente, comandi ed
evidenze. Per una ripresa leggi `docs/PROSSIMA-SESSIONE.md`; il contratto è in
`docs/PIANO-APP-NATIVA.md`, il nuovo incremento in `docs/PIANO-IOS-M2.md`.

Al 27 ottobre 2026: M0 funzionante, M0.5 completata su iPhone con CryptoKit,
M1 chiusa per lo sviluppo. M2.1 lettura/player foto installati e accettati come
funzionanti dal proprietario il 27 ottobre sera. Alla ripresa procedere con M2.2
pubblicazione foto. L’accettazione non aggiunge un ascolto VoiceOver attestato.
Non rigenerare vettori o ripetere tappe concluse senza una regressione concreta.

- Progetto SwiftPM in `ios/`; usa toolchain, SDK e lockfile esistenti. Prima di
  codice verifica versioni effettive senza esporre Apple ID, team o token.
- Compila da `ios/` con `xtool dev build`, una build alla volta. Per il device usa
  `xtool devices --usb --no-wait` e `xtool dev run --usb`, distinguendo build,
  installazione verificata e prova runtime. Non inventare test device mancanti.
- SwiftUI, URLSession e Codable; logica di dominio sul server. Token Keychain,
  refresh single-flight, epoch, MFA pendente e recupero salvataggio preservati.
  HTTP effimero, media RAM; nessun retry automatico delle scritture ambigue.
- Le API M1 sono già bearer: non rifarne gli adapter. Per M2 i nuovi endpoint
  del piano sono proposte: implementare solo allowlist mirata, bearer verificato,
  MFA/RLS/no-store, senza fallback cookie e senza rimuovere Origin dal web.
- Il telefono deve raggiungere il backend: localhost nell'app è l'iPhone.
  Ricontrolla rete/servizio prima di cambiare endpoint; non spostare il backend
  tra USB e Wi-Fi automaticamente. Le autorizzazioni di rete restano quelle della sessione.
- Non reinstallare toolchain, usare VM macOS, xcodebuild, simctl o CocoaPods.
  Non aggiungere il prefisso di firma XTL al bundle ID.
- Conserva modifiche preesistenti e `creaInvito.txt`; niente pubblicazione,
  modifiche cloud o protocollo E2EE come effetto collaterale del client.
- `bash scripts/check-ios-session.sh` esegue XCTest sessione/HTTP Linux con shim
  Combine e trasporto sintetico: non prova SwiftUI o Keychain reale.
  `swift test --package-path ios/ChatCrypto` è la suite crypto Linux separata.
  Runner Darwin e prove iPhone vanno attestati distintamente.
- Per automazioni iPhone usa solo fixture interne riconoscibili; niente scansioni
  AX o navigazione automatica della galleria/superfici personali. Picker e ascolto
  VoiceOver sono controlli manuali. Ripristina l'avvio normale dopo le fixture.

Aggiorna stato e verbali solo con prove realmente eseguite. Nel vault Obsidian
conserva il piccolo grafo di documentazione; non riesportare i nodi Graphify.

Fonti del tool: https://github.com/xtool-org/xtool e https://xtool.sh/.

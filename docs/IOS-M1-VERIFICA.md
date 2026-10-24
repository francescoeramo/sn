# Collaudo M1 su iPhone — 24 ottobre 2026

## Perimetro ed evidenze

La verifica usa il client SwiftUI reale, Swift 6.4.1, SDK Darwin e xtool su Linux.
Non è una simulazione in browser, né esecuzione del runner XCTest Darwin.

| Prova | Esito acquisito | Confini |
| --- | --- | --- |
| Feed, 85 post con timestamp uguale | Superata: 40 → 80 → 85, tap HID sui pulsanti, fine esplicita e 85 ID unici | Dati sintetici, nessuna scrittura cloud |
| Archivio proprio, 85 post | Superata: 40 → 80 → 85 e fine esplicita nella UI | Stesso trasporto HTTP sintetico |
| Sessione, rete e media reali | Conferme utente e API 200 già registrate | Non prova tutta la matrice MFA/revoca |
| Backend sospeso e ripreso | Sessione conservata durante timeout, recupero automatico senza rilancio | Lettura bootstrap reale via Wi-Fi; nessuna scrittura social |
| Selezione/rimozione foto, limiti avviso | Superati nella logica reale su iOS e Linux | Il controllo rapido del picker nativo resta distinto |
| Ridimensionamento JPEG | Superato su iPhone: massimo 1600 px e meno di 3 MiB | Immagine sintetica, nessuna foto personale nel rapporto |
| Keychain | Salvataggio, lettura e cancellazione superati | Servizio/account di test separati dai token reali |
| Accessibilità e temi | Audit reali eseguiti; rilievi di contrasto, correzione installata da ricontrollare | Non dichiarare conformità o audit senza rilievi |

Rapporti sintetici, senza token o contenuti reali:
- [18 controlli sul dispositivo](evidence/ios-m1-device-2026-10-24.json).
- [Paginazione SwiftUI con HID](evidence/ios-m1-pagination-2026-10-24.json).
- [Recupero della connessione reale](evidence/ios-m1-network-2026-10-24.json).

## Difetto riprodotto e corretto

Il feed usava soltanto `created_at` come cursore. Con 85 post alla stessa data,
la seconda pagina risultava vuota e 45 post venivano saltati. Il test HTTP sul
client reale ha fallito prima della correzione (40 invece di 80/85), poi superato.

Bootstrap e pagina post ora restituiscono anche `nextPostId`; iOS invia
`before` + `post_id`. Il server valida entrambi e ordina per data e UUID; la
continuazione usa il confronto lessicografico. Il vecchio `before` a sola data
resta accettato per il web. Nessuna migrazione, modifica cloud o cambio E2EE.

## Automazione ripetibile

Dalla root:

```bash
bash scripts/check-ios-session.sh
swiftc -module-cache-path /tmp/sn-swift-model-cache ios/SN/Models/Session.swift ios/SN/Models/Feed.swift ios/ContractChecks/main.swift -o /tmp/sn-ios-model-contract
/tmp/sn-ios-model-contract
npm test -- tests/native-social.test.ts tests/native-auth.test.ts tests/security-api.test.ts tests/rules.test.ts
```

Risultati: **32 XCTest Linux**, **15 controlli modelli** e **77 test server/regole**.
Lo shim Combine verifica valori e logica, non SwiftUI. I nuovi test includono il
vero `APIClient` e URLSession con URLProtocol sintetico: non sono richieste cloud.

Su iPhone con build DEBUG, avvio esplicito tramite CoreDevice:

- `SN_RUN_M1_CHECKS=1`: esegue 18 controlli su un coordinatore separato e salva
  `Documents/m1-device-checks.json`, estraibile via `pymobiledevice3 apps pull`.
- `SN_M1_UI_FIXTURE=1`: apre le stesse viste con 85 post locali; Keychain reale
  non letto, preferenze separate e host riservato `sn-m1.invalid` intercettato.
  Il segnale visibile «Collaudo M1 · dati locali» distingue il test dall'account.

Il controllo UI usa gli strumenti installati, senza Xcode o WebDriverAgent:

```bash
/home/fra/pymobile3-venv/bin/python scripts/check-ios-m1-device.py --bundle '<bundle-firmato-SN>'
```

Serve iPhone sbloccato, in verticale e lasciato libero durante il test. Il runner
usa CoreDevice HID, l'albero AX e OCR locale per premere il pulsante visibile;
controlla presenza del segnale di collaudo e tab selezionato. `--audit-only`
ripete soltanto le verifiche visuali. Le catture rimangono in una cartella locale
ignorata da Git. Una schermata di un'altra app invalida il campione: non attribuirne
i rilievi a SN e non conservarne le catture. Font, tema e account normale vanno
ripristinati al termine. La modalità di collaudo è esclusa dalle build release.

## Limiti ancora aperti

I risultati dei test sintetici non attestano policy cloud, carico o concorrenza
multiutente. La verifica VoiceOver tramite semantica AX non equivale all'ascolto
integrale con lettore di schermo. L'esito finale degli audit e del composer nativo
va registrato prima di dichiarare chiusa la regressione M1.

Ultimo stato: correzione contrasto installata (Verifying 100%). Composer aperto
via HID e ispezionato. Nuovo audit, cambio rapido nel picker e ascolto VoiceOver
completo ancora aperti: M1 non dichiarata interamente collaudata.

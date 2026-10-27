# iOS M0.5 — prova di compatibilità crittografica

<!-- sn-ios-context:start -->
> **Stato iOS al 27 ottobre 2026:** M1 chiusa per lo sviluppo; M2.1 lettura e
> player foto installati e accettati come funzionanti dal proprietario. Prossimo
> incremento: M2.2 pubblicazione foto, da iniziare alla ripresa.
> [Stato](STATO-IOS.md) · [Piano M2](PIANO-IOS-M2.md) · [Ripresa](PROSSIMA-SESSIONE.md)
> I verbali sotto restano storici; l’accettazione non aggiunge prove automatiche o ascolti VoiceOver.
<!-- sn-ios-context:end -->

Il modulo `ios/ChatCrypto` implementa il protocollo chat 1:1 v1 già utilizzato da
`lib/crypto/chat.ts`: P-256 ECDH, HKDF-SHA-256, AES-256-GCM, JWK pubbliche,
impronte SHA-256, chiave distinta per dispositivo e allegato. AAD mantiene l'ordine
esatto dei campi web, il `null` della scadenza e la distinzione fra revisione assente
ed esplicitamente zero. I tag GCM sono concatenati al ciphertext, con nonce separato.
Il limite testo usa unità UTF-16 come JavaScript, non il conteggio dei grafemi Swift.

È una prova tecnica offline, senza schermate di chat, registrazione dispositivi,
accesso a conversazioni reali o modifiche cloud. I vettori usano chiavi sintetiche
pubbliche: non devono essere impiegate per messaggi reali. Nessuna chiave privata
reale viene esportata. La persistenza delle future chiavi del dispositivo nel
Keychain e l'autorizzazione dei dispositivi appartengono all'integrazione chat.

## Struttura

- `ios/ChatCrypto/Sources/SNChatCrypto/ChatCrypto.swift`: codice crittografico comune.
- iOS usa CryptoKit di sistema; Linux usa Apple swift-crypto 4.0.0, solo per la
  piattaforma Linux. Versioni e revisioni transitive sono fissate nei due lockfile
  SwiftPM (`ios/Package.resolved` e `ios/ChatCrypto/Package.resolved`).
- `scripts/ios-crypto-interop.mjs` importa direttamente il codice Web Crypto
  esistente; non ne reimplementa gli algoritmi. Richiede Node con supporto TS nativo
  (Node 26 nell'ambiente verificato).
- `ChatInteropProbe` e i vettori incorporati sono compilati solo in DEBUG.
  `SNChatInterop` produce il report su Linux. La build iPhone lo scrive in
  `Documents/crypto-interop-report.json` all'avvio tramite `CryptoProbeDiagnostics`.
  Una prova fallita produce un report failed e non blocca il login.

## Verifica locale ripetibile

Dalla root del repository:

```bash
swift test --package-path ios/ChatCrypto
# Usa lo stesso codice Swift impiegato dalla build iPhone, con backend Linux.
ios/ChatCrypto/.build/debug/SNChatInterop > /tmp/sn-crypto-linux-report.json
node scripts/ios-crypto-interop.mjs verify /tmp/sn-crypto-linux-report.json
npm test -- tests/crypto.test.ts
```

Due XCTest del modulo crypto sono eseguibili su Linux. Non sono i test di
AuthCoordinator/SwiftUI in `ios/SNTests`, il cui runner Darwin resta distinto.
Il report contiene 35 verifiche Swift e tre risposte cifrate; Web Crypto verifica
ogni risposta su tre dispositivi (mittente incluso), gli allegati e un contesto
manomesso. Copre testo Unicode, scadenza assente, revisioni assente/0/1,
conservazione synced/device, impronte, manomissioni e dispositivo estraneo.

I vettori sono già versionati. Solo per rigenerarli:

```bash
node scripts/ios-crypto-interop.mjs generate
```

Questo cambia il fixture ID: dopo la rigenerazione ricompilare app e test. Il
verificatore rifiuta report provenienti da un insieme di vettori diverso.

## Prova su iPhone

```bash
cd ios
xtool dev build
xtool dev run --usb
```

Aprire manualmente SN sul dispositivo e attendere qualche secondo. Poi estrarre
soltanto il report di test con il bundle ID effettivo della build firmata:

```bash
/home/fra/pymobile3-venv/bin/pymobiledevice3 apps pull \
  '<bundle-ID-firmato>' Documents/crypto-interop-report.json /tmp/sn-crypto-ios-report.json
node scripts/ios-crypto-interop.mjs verify /tmp/sn-crypto-ios-report.json
```

Il risultato deve indicare `platform: ios-cryptokit` e `status: passed`. Un report
Linux non sostituisce questa verifica. Non estrarre Keychain o file di sessione.

## Stato al 15 ottobre 2026

- XCTest crypto Linux: 2 superati; 35 verifiche interne e tre risposte verificate
  dal codice web, con tre dispositivi per risposta e allegato binario.
- Suite Web Crypto esistente: 6 test superati.
- Build CryptoKit iOS: compilata, firmata e installata sull'iPhone collegato.
- Report CryptoKit del dispositivo: recuperato via USB e verificato dal codice web,
  piattaforma `ios-cryptokit`, 35 controlli Swift, tre risposte su tre dispositivi,
  allegati verificati. **M0.5 completata su iPhone reale**.
- Evidenza sintetica archiviata in
  `docs/evidence/ios-crypto-interop-2026-10-15.json`; fixture ID
  `13082b7b-8d80-4fa1-8fcd-f9fb3aa3566c`.

La sola compilazione non dimostra interoperabilità. Il report `ios-cryptokit` è
stato verificato dal codice web: ora si può passare a M1: feed, profilo,
pubblicazione di un post con immagine. Non cambia il modello di sicurezza già
illustrato in `CRITTOGRAFIA.md`: niente promessa di forward secrecy o audit indipendente.

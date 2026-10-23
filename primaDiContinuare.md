# Continuare SN su iOS

Stato aggiornato al 15 ottobre 2026: **M0 funzionale confermata dall'utente,
M0.5 completata sul dispositivo. Prossimo incremento: M1.**

Leggi `AGENTS.md` e [manuale](docs/MANUALE-PROGETTO.md), poi
[ios/README.md](ios/README.md) e [piano nativo](docs/PIANO-APP-NATIVA.md).
La prova web ↔ iPhone è documentata in [IOS-CRYPTO-INTEROP.md](docs/IOS-CRYPTO-INTEROP.md)
con il [rapporto CryptoKit](docs/evidence/ios-crypto-interop-2026-10-15.json):
35 controlli, tre risposte su tre dispositivi e allegato verificato.

Si lavora su Linux con SwiftUI, SwiftPM e xtool. La build è compilata, firmata e
installata; l'app mostra ancora Login/MFA/Sessione. M1 deve aggiungere feed, profilo
e pubblicazione con immagine, adattando prima al bearer le rispettive API.
Non ripartire dalla prima prova di rete o rifare M0.5 senza una regressione concreta.

Restano non eseguiti gli XCTest sessione/SwiftUI e alcuni casi tecnici della matrice
M0; i due XCTest crypto Linux sono invece passati. Un login MFA dopo il rafforzamento
SQL resta una regressione runtime da controllare durante M1. Il collaudo cloud
completo e la distribuzione pubblica sono separati e non risultano conclusi.

Conserva tutte le modifiche esistenti e `creaInvito.txt`. Non usare VM macOS né
reinstallare il toolchain senza diagnosi. Per OpenCode e DeepSeek Flash usa
[docs/OPENCODE.md](docs/OPENCODE.md): il prompt di `sn_ios` è già allineato a M1.

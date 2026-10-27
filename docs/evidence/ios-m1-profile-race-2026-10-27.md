# Profilo: errore tardivo dopo pubblicazione — 27 ottobre 2026

Una lettura dell’archivio iniziata prima di una pubblicazione riuscita poteva
mostrare un errore superato e non ricaricare il nuovo post. Riprodotto con due
risposte tardive, transport e invalidResponse: nove asserzioni fallite prima
della correzione. Il catch di loadProfile ora scarta errori non definitivi di
una generazione superata e accoda una sola rilettura. I rifiuti definitivi
della sessione conservano la priorità e causano il logout.

`bash scripts/check-ios-session.sh`: 58 XCTest Linux superati dopo la correzione,
inclusi due nuovi test (errori tardivi e rifiuto definitivo). Shim Combine,
non runner SwiftUI/Keychain. `xtool dev build` da ios/: riuscita, 6,60 secondi.
La correzione non è ancora installata o verificata runtime in questa evidenza.
Nessuna API, migrazione, scrittura cloud o retry automatico delle scritture.

Nella stessa sessione l’utente ha confermato VoiceOver in Feed/Profilo e tutte
le quattro prove foto (selezione, annullamento, sostituzione, rimozione) sulla
build precedente con endpoint Wi-Fi, installata dopo il commit 068fe14.
La conferma non attesta la risoluzione dei rilievi automatici di contrasto e
Dynamic Type del 26 ottobre: M1 non ancora dichiarata chiusa.

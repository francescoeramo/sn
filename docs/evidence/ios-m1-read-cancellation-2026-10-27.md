# Letture cancellate durante refresh — 27 ottobre 2026

Riprodotto con il coordinatore reale: una richiesta Profilo riceve 401,
attende un refresh condiviso, viene annullata, ma dopo il rinnovo esegue
ugualmente una seconda lettura e applica i dati. Due asserzioni fallite prima
della correzione. `read` verifica ora la cancellazione prima di iniziare il
refresh e dopo averne atteso il risultato. Il rinnovo condiviso resta valido;
il singolo lettore cancellato non invia il retry e non modifica l’archivio.

`bash scripts/check-ios-session.sh`: 59 XCTest Linux superati, shim Combine,
non runner Darwin/SwiftUI. `xtool dev build` da ios/: riuscita, 5,80 secondi.
Nessuna nuova API, migrazione, scrittura cloud o retry di scritture.
Installazione finale da ios/ con xtool dev run --usb: Verifying 100%, exit 0.
28 controlli interni iPhone superati, avvio normale ripristinato: vedi
[ios-m1-final-probe-2026-10-27-evening.json](ios-m1-final-probe-2026-10-27-evening.json).

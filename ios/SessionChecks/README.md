# Controlli sessione su Linux

`bash scripts/check-ios-session.sh` esegue gli XCTest di `ios/SNTests` sul codice
reale di AuthCoordinator, modelli, errori e protocolli, con store/API in memoria.
Non richiede rete, SDK Apple o dipendenze esterne.

Il pacchetto temporaneo usa uno shim minimo di Combine: conserva i valori di
`@Published`, ma non simula notifiche, SwiftUI o scheduling del rendering.
Questi test verificano la logica asincrona della sessione; non verificano Keychain,
URLSession, UI, firma o runtime iPhone. Il runner Darwin resta distinto.

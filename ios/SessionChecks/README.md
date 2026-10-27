# Controlli sessione su Linux

<!-- sn-ios-context:start -->
> **Stato iOS al 27 ottobre 2026:** M1 accettata per lo sviluppo; M2.1 lettura e player foto
> implementati, ascolto VoiceOver del nuovo player ancora aperto.
> [Stato ed evidenze](../../docs/STATO-IOS.md) · [Piano M2](../../docs/PIANO-IOS-M2.md) · [Ripresa sessione](../../docs/PROSSIMA-SESSIONE.md).
> Le sezioni datate conservano il loro valore storico; questa revisione documentale non aggiunge nuove prove.
<!-- sn-ios-context:end -->

`bash scripts/check-ios-session.sh` esegue gli XCTest di `ios/SNTests` sul codice
reale di AuthCoordinator, modelli, errori e protocolli, con store/API in memoria.
Non richiede rete, SDK Apple o dipendenze esterne.

Il pacchetto temporaneo usa uno shim minimo di Combine: conserva i valori di
`@Published`, ma non simula notifiche, SwiftUI o scheduling del rendering.
Questi test verificano logica asincrona, modelli/bozza e percorsi di APIClient con
URLSession reale e trasporto sintetico. Non verificano Keychain reale, rete cloud,
SwiftUI, firma o runtime iPhone. Il runner Darwin resta distinto. Il numero corrente
di test è riportato nei verbali datati, non dedotto dalla riuscita della build.

## Incremento storie del 27 ottobre sera

68 XCTest Linux superati, inclusi nove casi storie: clock controllato, consenso,
pausa/background/VoiceOver, scadenza/frazioni/offset, JSON nullable, pagine, errore,
logout tardivo e trasporto HTTP. Il runner copia ora anche Models/Story.swift.
Le 56 prove UI iPhone separate non sono eseguite da questo shim: usare
scripts/check-ios-m2-player.py con il Python pymobiledevice3 e la build installata.

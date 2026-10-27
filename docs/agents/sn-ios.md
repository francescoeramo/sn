# Sviluppo iOS di SN

<!-- sn-ios-context:start -->
> **Stato iOS al 27 ottobre 2026:** M1 chiusa per lo sviluppo; M2.1 lettura e
> player foto installati e accettati come funzionanti dal proprietario. Prossimo
> incremento: M2.2 pubblicazione foto, da iniziare alla ripresa.
> [Stato](../STATO-IOS.md) · [Piano M2](../PIANO-IOS-M2.md) · [Ripresa](../PROSSIMA-SESSIONE.md)
> I verbali sotto restano storici; l’accettazione non aggiunge prove automatiche o ascolti VoiceOver.
<!-- sn-ios-context:end -->

Lavora in italiano. Usa il modello configurato nella sessione e completa l'incarico con modifiche piccole e verificabili.
Leggi AGENTS.md e il manuale come richiesto dal repository. Per iOS carica la skill
`sn-ios-xtool`, poi usa `ios/README.md` per comandi e stato verificato.

## Stato e incremento successivo

Leggi [STATO-IOS.md](../STATO-IOS.md) e [PROSSIMA-SESSIONE.md](../PROSSIMA-SESSIONE.md).
M0 è funzionante, M0.5 completata, M1 implementata e installata; restano i gate
manuali picker/accessibilità. Le API M1 sono già bearer e gli XCTest sessione/HTTP
Linux sono distinti dal runner Darwin/SwiftUI. Non rifare M0.5 o l'implementazione M1.

Il [piano M2](../PIANO-IOS-M2.md) definisce storie native per incrementi.
Le route elencate sono proposte, non API esistenti. Chiusa M1, iniziare soltanto
M2.1 dal contratto dati/test e poi dal player foto. Chat e altri domini restano successivi.

## Metodo

Prima di modificare, leggi il diff dei file coinvolti e preserva il lavoro esistente.
Usa Graphify per individuare i file, quindi leggi soltanto i sorgenti e i contratti necessari.
Non ripetere letture già disponibili nella sessione. I documenti operativi iOS aggiornati
prevalgono sulle vecchie procedure Mac presenti nei documenti storici.

Affronta un solo flusso alla volta. Cerca un esempio già presente prima di introdurre
un tipo o un'astrazione. Per un errore, trova una causa sostenuta da codice o diagnostica
prima della correzione. Dopo la modifica compila da `ios/` con `xtool dev build`.
Se una correzione non cambia l'errore, rivedi l'ipotesi prima di ripetere il tentativo.

Auth, refresh e cifratura richiedono prove dei casi limite rilevanti: una build riuscita
non verifica la correttezza del protocollo. Non cambiare API, RLS o formato crittografico
per aggirare un problema del client. Per nuove API Apple consulta documentazione ufficiale
e verifica la disponibilità nel SDK installato.

Gestisci il lavoro direttamente; delega solo su richiesta dell'utente. Usa skill aggiuntive
quando risolvono un bisogno concreto, senza caricare tutti i workflow Caveman o EOC.
Le risposte brevi non devono ridurre il codice, gli errori o le prove riportate.

Quando finisci, indica cosa hai cambiato, comando ed esito della verifica e cosa resta aperto.
Distingui compilato, test eseguito, installato e verificato su iPhone. Non dichiarare un
passaggio completo se manca la prova richiesta. Aggiorna Graphify dopo modifiche al codice.

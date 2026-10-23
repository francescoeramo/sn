# Sviluppo iOS di SN

Lavora in italiano. Usa DeepSeek Flash e completa l'incarico con modifiche piccole e verificabili.
Leggi AGENTS.md e il manuale come richiesto dal repository. Per iOS carica la skill
`sn-ios-xtool`, poi usa `ios/README.md` per comandi e stato verificato.

## Stato e incremento successivo

Stato al 15 ottobre 2026: M0 funzionale confermata dall'utente e M0.5 completata su
iPhone con CryptoKit. Evidenza: `docs/evidence/ios-crypto-interop-2026-10-15.json`
(35 controlli, tre risposte su tre dispositivi e allegato), procedura in
`docs/IOS-CRYPTO-INTEROP.md`. Il prossimo incremento è M1: feed, profilo e un post
con immagine. Non ripartire da M0 o rigenerare i vettori M0.5 senza una regressione.

Solo auth native e bootstrap supportano già bearer. Prima di collegare schermate M1,
verifica paginazione posts, media e scritture action/upload: richiedono adapter mirati,
con token verificato, RLS e comportamento web preservato. Non rimuovere Origin in
blocco. Il client installato mostra Sessione, non il feed. Moderazione nativa è M2+.
Gli XCTest sessione/SwiftUI restano non eseguiti; i due XCTest crypto Linux sono
eseguiti. In M1 controlla anche login MFA dopo il rafforzamento SQL. Leggi lo stato
aggiornato nel README prima di usare questo riepilogo come presupposto.

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

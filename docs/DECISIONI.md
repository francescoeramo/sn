# Decisioni del 9 settembre 2026

1. SN è un social generalista, inizialmente per Francesco e alcuni amici. Non è una community specializzata in fotografia.
2. Moderazione manuale. Il modello delle segnalazioni permette in futuro un supporto automatico; nessun servizio AI è necessario oggi.
3. Il costo attuale deve restare zero. Iscrizioni e upload si fermano ai limiti; le donazioni sono una possibilità futura, senza integrazione pagamenti nell’MVP.
4. Componenti open source, niente font o asset richiesti a terzi durante l’uso. Il proprietario ha scelto di mantenere la repository pubblica; la licenza del codice resta da definire.
5. Il feed iniziale è cronologico. Il modello lascia aperti app native, federazione e live streaming, che richiedono verifiche separate.

La beta parte con profili privati per impostazione predefinita, 20 account e file entro 3 MiB. I nomi e i contenuti presenti nella demo sono esempi inventati.

## Prompt aggiornato

L’aggiornamento richiede quattro fasi: feed calmo e storie automatiche; chat effimere e multimediali; E2EE e chiavi locali; Community Notes e sponsorizzazioni approvate manualmente. La federazione è esplicitamente futura. Le sponsorizzazioni sono una predisposizione richiesta, non annunci attivi nella beta.

La prima fase mantiene il feed cronologico con caricamento manuale dei post precedenti e traguardo “Sei in pari”. Il conteggio dei like è consultabile dall’autore, senza numeri nei pulsanti del feed. Le storie immagini avanzano dopo cinque secondi dalla lettura del media, i video al termine o a venti secondi. Pausa, pressione prolungata, cambio scheda e navigazione manuale non consumano il tempo delle immagini in pausa.

## Chat effimera e allegati

I nuovi messaggi scadono dopo 24 ore per impostazione iniziale. Le alternative sono 1 ora, 3 ore, 48 ore, 1 settimana e 30 giorni. Il database calcola la scadenza e respinge durate arbitrarie, anche quando si accede direttamente alle tabelle. Lo storico precedente conserva la sua scadenza originale.

Foto e video usano la preparazione locale già presente; i file audio WebM, Ogg e M4A vengono controllati nel browser (massimo 60 secondi). Il server controlla formato e limite di 3 MiB, ma non certifica la durata dei file ricevuti direttamente via API. Gli allegati chat sono riservati ai partecipanti e non possono essere riutilizzati nei post. Le policy revocano l’accesso alla scadenza; l’endpoint manutenzione elimina record e file. Va programmato prima di aprire la beta.

La demo elimina i contenuti scaduti da IndexedDB all’apertura e durante gli aggiornamenti. Un browser chiuso non può eseguire lavori di pulizia. La chat mostra le scadenze, permette l’invio di soli allegati e conserva la bozza in caso di errore. Questa fase non introduce E2EE né la modalità di conservazione solo sul dispositivo.

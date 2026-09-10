# Risultati delle verifiche

Data: 10 settembre 2026. Ambito: prime tre fasi del prompt aggiornato: feed, storie e chat effimera con allegati.

| Controllo           | Risultato                                        |
| ------------------- | ------------------------------------------------ |
| `npm run lint`      | Superato                                         |
| `npm run typecheck` | Superato                                         |
| `npm test`          | 43 test superati, inclusi schema e RLS su PGlite |
| `npm run build`     | Superato                                         |
| `npm run test:e2e`  | 28 test superati, desktop e mobile               |

I test browser verificano pubblicazione e persistenza nella demo, interazioni, ricerca, profilo, esportazione e messaggi. Per le storie coprono avanzamento automatico, pausa, pressione prolungata, navigazione, sequenze dello stesso autore, video e chiusura alla fine. Verificano inoltre l’assenza di conteggi pubblici dei like, il termine del feed, il rifiuto delle richieste API anonime e CSRF e la federazione chiusa.

La validazione degli allegati demo accetta immagini e video locali entro 3 MiB e respinge URL remoti e file troppo grandi. Il limite dei percorsi media lato server rimane verificato separatamente. Il video usato nei test è un breve filmato sintetico generato localmente.

Controllo visivo locale del lettore di storie completato; nessun errore rilevato dal browser durante la verifica.

Questi risultati non certificano Auth e Storage su Supabase cloud: il collaudo dedicato e il deploy del sito non sono stati eseguiti. Il protocollo E2EE non ha ricevuto un audit indipendente; le successive fasi del prompt sono ancora da implementare. Per i controlli cloud rimanenti, vedere [VERIFICA.md](VERIFICA.md).

La seconda fase aggiunge verifiche SQL sulle sei durate consentite, accesso agli audio, isolamento dai terzi e revoca dopo la scadenza. Le prove browser coprono invio di un allegato senza testo, anteprima, pulizia IndexedDB alla riapertura e blocco dell’invio senza follow reciproco.

La terza fase verifica ECDH/HKDF/AES-GCM con più browser, chiavi private non esportabili, integrità di messaggi e allegati, scadenze autenticate e rifiuto dei nuovi messaggi in chiaro. Le prove browser verificano ciphertext in IndexedDB, decifratura dopo ricaricamento e blocco dell’invio quando cambia una chiave. La funzione di consegna è testata contro chiamate di estranei e revoca l’accesso al blob nella stessa transazione. Controllo visivo della nuova chat completato senza errori browser.

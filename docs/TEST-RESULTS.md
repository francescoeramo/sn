# Risultati delle verifiche

Data: 9 settembre 2026. Ambito: prima fase del prompt aggiornato, feed tranquillo e storie automatiche.

| Controllo           | Risultato                                        |
| ------------------- | ------------------------------------------------ |
| `npm run lint`      | Superato                                         |
| `npm run typecheck` | Superato                                         |
| `npm test`          | 33 test superati, inclusi schema e RLS su PGlite |
| `npm run build`     | Superato                                         |
| `npm run test:e2e`  | 20 test superati, desktop e mobile               |

I test browser verificano pubblicazione e persistenza nella demo, interazioni, ricerca, profilo, esportazione e messaggi. Per le storie coprono avanzamento automatico, pausa, pressione prolungata, navigazione, sequenze dello stesso autore, video e chiusura alla fine. Verificano inoltre l’assenza di conteggi pubblici dei like, il termine del feed, il rifiuto delle richieste API anonime e CSRF e la federazione chiusa.

La validazione degli allegati demo accetta immagini e video locali entro 3 MiB e respinge URL remoti e file troppo grandi. Il limite dei percorsi media lato server rimane verificato separatamente. Il video usato nei test è un breve filmato sintetico generato localmente.

Controllo visivo locale del lettore di storie completato; nessun errore rilevato dal browser durante la verifica.

Questi risultati non certificano Auth e Storage su Supabase cloud: il collaudo dedicato e il deploy del sito non sono stati eseguiti. La chat resta priva di E2EE; le successive fasi del prompt sono ancora da implementare. Per i controlli cloud rimanenti, vedere [VERIFICA.md](VERIFICA.md).

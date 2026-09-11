# SN — lavoro confermato

Aggiornato l’11 settembre 2026. `PRODUCT.md` contiene i vincoli correnti; i documenti precedenti possono descrivere fasi superate. Nessuna monetizzazione pubblicitaria. Il completamento locale non equivale al collaudo o al deploy cloud.

| Area                                             | Stato e passo successivo                                                                                                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed cronologico e like senza contatore pubblico | Implementati; mantenere il caricamento deliberato e il traguardo «Sei in pari».                                                                                                                    |
| E2EE 1:1                                         | Prima implementazione esistente, storico legacy in chiaro. Verificare Auth/Storage reali e comunicazione sulla perdita delle chiavi; non dichiarare audit indipendente o recupero automatico.      |
| Note della comunità                              | Proposta e revisione manuale implementate.                                                                                                                                                         |
| Salvataggi privati                               | Implementati in demo, API e migrazione locale. Da applicare e collaudare sul progetto cloud dedicato.                                                                                              |
| Avvisi di contenuto                              | Implementati per post, reel e storie; media caricati dopo la scelta. Da collaudare anche sul backend cloud.                                                                                        |
| Federazione                                      | Endpoint ActivityPub/WebFinger segnaposto, risposta 503. Pianificare modello dati prima di estendere UI e relazioni federate.                                                                      |
| Chat di gruppo                                   | Da progettare dopo consolidamento E2EE 1:1: membership, ruoli, inviti, abbandono e rimozioni.                                                                                                      |
| 2FA e sessioni                                   | Verificare TOTP facoltativa, revoca sessioni e data ultimo accesso senza raccolta IP aggiuntiva.                                                                                                   |
| Sondaggi                                         | Da implementare: opzioni, voto singolo, scadenza facoltativa.                                                                                                                                      |
| Ricerca                                          | Esistono ricerca utenti/hashtag e query testuale `ilike`; manca un indice full-text dedicato. Verificare paginazione e privacy.                                                                    |
| Recupero e anti-abuso                            | Verificare reset, revoca sessioni, notifiche e protezioni login/registrazione. Esistono throttling applicativo per azioni e protezioni del provider; non considerarli prova di copertura completa. |
| Moderazione                                      | Aggiungere audit log unificato per rimozioni, ban e approvazioni. Le Note conservano già revisore, motivazione e data.                                                                             |
| Onboarding e stati vuoti                         | Introdurre benvenuto post-registrazione, istruzioni privacy e percorsi iniziali; migliorare stati vuoti in modo coerente.                                                                          |
| Temi e caricamento                               | Verificare modalità scura, token e skeleton; mantenere illustrazioni proprie e feedback discreti.                                                                                                  |
| CSP e headers                                    | Presenti nel codice; verificare la risposta effettiva in produzione. Live Impeccable richiede configurazione CSP di sviluppo separata.                                                             |
| Backup e ripristino                              | Predisporre export periodico e piano di ripristino verificato. Decidere separatamente l'eventuale backup cifrato delle chiavi dell'utente.                                                         |

## Implementato localmente: conservazione e stati della chat

Requisiti implementati in demo, API e migrazione SQL, descritti nella sezione 4 di `SN-prompt-progetto.md`:

1. Messaggi ordinari senza scadenza; pulsante «Chat temporanea» e durata nelle impostazioni della conversazione, valida per i nuovi invii.
2. Ricevute dinamiche di invio, consegna e lettura con spunte ed etichette accessibili; nessuna lettura simulata nella demo.
3. Modifica entro 30 minuti solo prima della lettura, verificata atomicamente sul server, con revisione cifrata e indicazione «Modificato».
4. Eliminazione manuale e compatibilità con conservazione solo dispositivo, preservando le scadenze autenticate dello storico.
5. Test SQL e browser per durata disattivata/attiva, cambio modalità, limite dei 30 minuti, concorrenza lettura/modifica, retry senza duplicati e aggiornamenti tra dispositivi.

Eliminazione personale per entrambi, globale solo per il mittente. Entrambi possono cambiare le impostazioni condivise. Ricevute e revisioni sopravvivono alla consegna solo dispositivo. Mancano collaudo cloud e prova di concorrenza su connessioni Postgres reali; i test locali verificano entrambi gli ordini lettura/modifica e ricevute obsolete. Le altre voci della tabella restano aperte.

## Prima della federazione

Definire attori solo per profili pubblici, WebFinger, HTTP Signatures, traduzione delle attività Create/Like/Follow/Accept/Reject e visibilità degli oggetti remoti. Chiarire revoca dei follow, blocchi e limiti della cancellazione su server terzi. Gli avvisi di contenuto devono mantenersi nel passaggio tra piattaforme. Nessun profilo privato diventa automaticamente un attore pubblico.

## Verifica e pubblicazione

Per ogni blocco completo: lint, TypeScript, test unitari e SQL, audit dipendenze, build e test browser desktop/mobile. Applicare migrazioni e collaudare servizi reali solo sull'infrastruttura dedicata a SN. Conservare almeno il 10% della finestra d'uso di cinque ore durante questa sessione.

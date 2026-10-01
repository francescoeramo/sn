# Piano di continuità — profili, carousel, Home e condivisione

Richiesta del 1 ottobre 2026. Questo file conserva requisiti, decisioni e stato del lavoro.

## Obiettivi

- Correggere il selettore «Scegli dove condividere» che resta vuoto.
- Rendere apribili i profili e supportare profili pubblici e privati.
- Aggiungere una preferenza separata per la visibilità di follower e seguiti: tutti, nessuno oppure anteprima pubblica degli ultimi 10 follower con lista dei seguiti nascosta.
- Aggiungere le reazioni pollice in giù e faccia arrabbiata.
- Rimuovere il messaggio «Sei in pari» e sostituire l’eventuale segno di completamento con una spunta.
- Semplificare la Home: rimuovere Seguiti, Tutta la Home e I più recenti; separare storie e post con spazio e una linea; rimuovere il composer rapido perché la creazione passa dal pulsante `+`.
- Migliorare spaziatura e gerarchia dei post, evitando la collisione visiva fra avatar e media.
- Limitare a 128 caratteri la descrizione delle storie.
- Usare «Descrizione» come placeholder nel composer.
- Supportare più foto/video nello stesso post, con visualizzazione carousel e descrizione distinta per ogni elemento.

## Vincoli

- Preservare accessibilità, localizzazione italiano/inglese, demo IndexedDB e modalità reale.
- Implementare schema, RLS/API, dominio, export/cancellazione e test necessari per i nuovi dati.
- Verificare desktop e mobile in un massimo di due passaggi visuali, come richiesto da Impeccable.
- Aggiornare il manuale architetturale e il grafo, se disponibile.

## Stato

- [x] File di continuità creato.
- [x] Analisi architetturale e UX.
- [x] Implementazione dati e interfaccia.
- [x] Test automatici e verifica visiva.
- [x] Documentazione finale.

## Esito

- Condivisione resa esplicita con destinazioni selezionabili e stato vuoto utile.
- Profili pubblici/privati e visibilità di follower/seguiti gestiti separatamente.
- Carousel fino a 10 foto/video con descrizione e testo alternativo per elemento.
- Home semplificata e gerarchia dei post corretta su desktop e mobile.
- TypeScript, ESLint, 132 test unitari/SQL, 74 test browser desktop/mobile e build di produzione superati.
- Detector Impeccable senza rilievi deterministici.

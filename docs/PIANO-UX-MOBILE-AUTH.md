# Piano di continuità — UX mobile, navigazione e registrazione

Richiesta del 1 ottobre 2026. Questo file conserva ambito e stato per poter riprendere il lavoro senza perdere decisioni.

## Obiettivi

- Ridurre le icone nella barra mobile inferiore.
- Barra mobile: Home, Messaggi, pulsante centrale “Crea”, Profilo (e solo le destinazioni davvero necessarie).
- Spostare Notifiche nell'area superiore.
- Integrare Cerchie dentro Messaggi e rinominarle “Canali” se il comportamento è assimilabile ai canali social/chat.
- Raccogliere Canali, Collaborazioni ed Eventi in un unico menu/hub dentro Messaggi, con un'icona coerente con la funzione complessiva.
- Spostare Impostazioni nell'area superiore del Profilo.
- Sostituire “Piazza” con “Home” in tutta la webapp, desktop e mobile.
- Aggiornare il messaggio di benvenuto.
- Portare la password minima a 8 caratteri in UI, dominio, API/database e test pertinenti.
- Mostrare durante la registrazione una checklist password in tempo reale (X/spunta): almeno 8 caratteri, almeno un numero, almeno una maiuscola e ogni altro requisito effettivamente applicato.
- Consentire nel nome utente lettere, numeri, underscore e punto, mantenendo validazioni coerenti tra client, server e database.
- Rimuovere il lucchetto dai contenuti (post, sondaggi e simili), lasciandolo solo nel profilo.

## Vincoli

- Preservare accessibilità, localizzazione italiano/inglese, demo locale e modalità reale.
- Consultare le guide Next.js installate prima delle modifiche applicative.
- Aggiornare test e documentazione architetturale se cambiano regole di sicurezza/validazione.
- Eseguire `graphify update .` dopo le modifiche.

## Stato

- [x] File di continuità creato.
- [x] Analisi della navigazione, delle stringhe e delle validazioni.
- [x] Implementazione.
- [x] Test e verifica visiva desktop/mobile.
- [x] Documentazione aggiornata. `graphify-out/` e il comando `graphify` non sono presenti in questo checkout, quindi non è stato possibile aggiornare il grafo.

## Verifica conclusiva

- TypeScript ed ESLint: superati.
- Vitest: 131 test superati.
- Build Next.js di produzione: superata.
- Browser: demo verificata a 1280×633 e 390×844; Home, barra mobile, Notifiche e hub Messaggi → Attività → Canali renderizzano senza overlay o errori pagina.
- Detector Impeccable: nessun rilievo deterministico sui file UI modificati.

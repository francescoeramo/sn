# Interfaccia nativa iOS — incremento M1

Registrazione del codice al 23 ottobre 2026. Il contratto resta
[PIANO-APP-NATIVA.md](PIANO-APP-NATIVA.md), sezioni 1, 2 e 7; lo stato operativo e
le prove sul telefono sono in [../ios/README.md](../ios/README.md).
Questa estensione conserva l’interfaccia SwiftUI di M0. Non introduce un nuovo
sistema visivo e non modifica `PRODUCT.md`, `DESIGN.md` o `.impeccable/design.json`.

Aggiornamento 24 ottobre: il composer aggiunge avviso facoltativo fino a 160 unità
UTF-16 normalizzate. Bozza protetta anche mentre si prepara una foto; selezioni
superate ignorate, rimozione disponibile durante caricamento/errore. Messaggi di
connessione senza riferimenti obbligatori a USB. Nessun cambiamento al sistema
visivo; validazione/race provate con XCTest, resa del nuovo composer ancora da
verificare sul telefono (screenshotr non disponibile nella sessione).

## Overview

M1 aggiunge feed finito, proprio profilo e composizione con una foto. La struttura
usa componenti standard SwiftUI, come M0: navigazione, liste, form, foglio modale,
progressi e dialoghi di conferma. Il target minimo è iOS 17 (`ios/Package.swift`).
La resa dei controlli dipende dalla versione di iOS: la direzione Liquid Glass del
piano non è una promessa di materiali identici su ogni versione supportata.

## Colors

Il codice non definisce una palette nativa con valori esadecimali. Il testo usa il
colore predefinito e `.secondary` per metadati, aiuti e stati vuoti; errori in
`.red`, avviso offline della sessione in `.orange`. Azioni distruttive hanno
`role: .destructive`. Liste, form, pulsanti e tab mantengono gli sfondi e il tint
di sistema; `SNApp` non imposta un tema o un accent personalizzato.

**Regola dei ruoli di piattaforma.** Descrivere i colori tramite il ruolo effettivo
SwiftUI; non derivare token RGB da una sola schermata scura.

## Typography

La gerarchia osservata usa stili di testo SwiftUI compatibili con Dynamic Type:

| Stile nel codice | Uso |
| --- | --- |
| `.title2.bold()` | Nome nel proprio profilo |
| `.headline` | Autore del post e avviso di contenuto |
| `.subheadline` | Username dell’autore nel feed |
| Testo predefinito | Corpo del post, campi e azioni ordinarie |
| `.footnote` | Aiuto, visibilità, allegati non supportati, errore descrizione foto |
| `.caption` | Data del post e contatori del composer |
| `.caption2` | Identificativo account nella schermata Sessione |

Titoli di navigazione, sezioni e tab restano gestiti dai componenti standard.
Non sono definiti font personalizzati, dimensioni fisse o una scala tipografica
in punti. Il supporto degli stili non certifica assenza di troncamenti alle
dimensioni accessibilità: quella prova resta da eseguire sul dispositivo.

## Layout

`RootView` contiene un `NavigationStack` soltanto per caricamento, login e MFA.
Dopo l’accesso mostra `FeedView`, che possiede un `TabView` con Feed e Profilo e
un `NavigationStack` indipendente per ciascun tab. Non c’è uno stack esterno
aggiuntivo intorno ai tab autenticati.

Il feed usa `List` con `.plain`; le righe hanno inset di 20 punti sui quattro lati.
`PostRow` dispone il contenuto verticalmente con spaziatura di 12 punti e separa
nome e username di 2 punti. Il profilo usa una `List` sezionata con stile automatico
di piattaforma: identità e bio, post nella finestra caricata, accesso alla sessione.
Il composer è un foglio autonomo con `NavigationStack` e `Form`; il titolo
«Nuovo post» usa modalità inline.

**Regola della finestra finita.** Il caricamento ulteriore richiede l’azione
«Carica i post precedenti»; il feed termina con «Sei in pari» quando non c’è un
cursore successivo. Anche il profilo esplicita che mostra la finestra caricata.

## Elevation & Depth

Il codice M1 non applica ombre o materiali personalizzati. Profondità e
separazione derivano da liste, sezioni, barre, foglio modale e dialogo nativi.
Non sono estratti valori di blur o ombra dal rendering di sistema.

## Shapes

Liste, form e controlli mantengono la forma fornita da SwiftUI. Le foto sono
ridimensionate con `scaledToFit`, senza ritaglio o raggio personalizzato.
I simboli sono SF Symbols tramite `Label` o `Image(systemName:)`, accompagnati
da etichette; non sono glifi testuali usati come icone.

## Components

| Componente | Comportamenti presenti nel sorgente |
| --- | --- |
| Feed | Aggiornamento tramite pull-to-refresh, errore con «Riprova», stato vuoto oppure offline, caricamento manuale delle pagine con azione disabilitata durante la richiesta, traguardo finale |
| Post | Autore, username, data, testo selezionabile; avviso di contenuto che nasconde corpo e media fino a «Mostra contenuto»; immagine privata oppure indicazione di allegato non disponibile nell’app |
| Immagine privata | Progresso con altezza minima di 120 punti, azione «Ricarica immagine» in errore, etichetta accessibile dalla descrizione oppure «Foto del post» |
| Profilo | Nome, username, bio se presente, propri post nella finestra caricata, stato vuoto, paginazione e collegamento «Sessione e accesso» |
| Sessione | Stato offline, dati account, errore, ora dell’ultima verifica, verifica con progresso e logout distruttivo |
| Composer | Campo testo verticale di 5–12 righe, contatore UTF-16 su 2200, `PhotosPicker` limitato alle immagini, preparazione, anteprima, descrizione accessibile con contatore UTF-16 su 300 e messaggio esplicito oltre limite, rimozione foto |

La pubblicazione è disabilitata durante preparazione/invio, per contenuto vuoto,
limiti superati o esito incerto. Il form è disabilitato durante invio o esito
incerto. La visibilità segue il profilo ed è spiegata nel composer. L’upload fallito
mostra un errore riprovabile; un esito di invio non confermato invita a chiudere e
aggiornare il feed prima di ripubblicare. Un invio riuscito chiude il foglio e
aggiorna i dati.

**Regola della bozza esplicita.** Una bozza con testo o foto blocca la chiusura
interattiva; «Annulla» richiede conferma distruttiva prima di scartarla. Durante
l’invio anche «Annulla» è disabilitato. Non è presente persistenza della bozza
tra aperture del foglio.

## Do's and Don'ts

- Conservare nomi dei tab, azioni esplicite e semantica dei componenti standard.
- Usare gli stili di testo e i ruoli cromatici osservati, senza fissare valori
  ricavati da uno screenshot.
- Tenere distinti dati caricati, errori, caricamenti ed esiti incerti.
- Non presentare i post del profilo come archivio completo: sono filtrati dalla
  finestra di post regolari caricata.

## Evidenza e limiti della registrazione

Confrontati `RootView.swift`, `FeedView.swift`, `ComposePostView.swift`,
`SessionView.swift`, i precedenti `LoginView.swift` e `MfaView.swift`, `SNApp.swift`
e `Package.swift` con il contratto nativo e `PRODUCT.md`. `DESIGN.md` e
`.impeccable/design.json` risultano assenti e restano tali: l’estensione M1 non
autorizza una nuova identità visiva o token inventati.

La cattura `.impeccable/review/phone.png` disponibile durante questa registrazione
mostra il profilo scuro precedente alla correzione della navigazione, con titolo
«SN» e un’immagine nello stato di ricaricamento. È evidenza storica di quella vista,
non convalida del codice finale: non viene usata per approvare titolo, caricamento
media, feed o composer. Una seconda cattura USB della stessa sessione
(`.impeccable/review/phone-feed.png`, locale ignorata da Git) mostra il feed dopo la correzione, con
azione di composizione nella barra, avviso di contenuto, tab Feed selezionato e
un’immagine ancora in caricamento. Non documenta lo stato finale del profilo,
il composer aperto o il completamento del caricamento media.

La sessione operativa registra conferma dell’utente per accesso/MFA, feed e foto
nel profilo, poi per un nuovo post con foto pubblicato dall’interfaccia. Il server
ha risposto 200 a `native/post` e al successivo bootstrap; al momento di questa
registrazione manca un riscontro separato dell’upload della nuova foto. La conferma
funzionale non equivale a un confronto visivo completo del composer. Paginazione,
riapertura, stati di errore e regressione completa richiedono le prove indicate
nel README.

Non è dichiarato un passaggio visivo finale né una verifica VoiceOver, Dynamic
Type alle dimensioni accessibilità, contrasto nei due temi o comportamento di
tastiera e focus. Il precedente titolo errato non diventa una regola del sistema;
il titolo del profilo corretto richiede una cattura aggiornata. Le diciture tecniche «finestra
caricata» e l’identificativo account in Sessione sono registrati come stato del
prototipo, senza trasformarli in una convenzione per le future superfici.

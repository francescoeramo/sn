# Riprendere SN — istruzioni per sessioni e modelli futuri

Aggiornamento del 27 ottobre 2026. Istruzioni indipendenti dal modello/provider.
Questa sessione ha aggiornato documentazione, piano M2 e copie Obsidian;
non ha implementato M2, chiuso M1 o rieseguito i collaudi dell'app.

## Lettura iniziale

1. `AGENTS.md` e **tutto** `docs/MANUALE-PROGETTO.md`, come richiesto dal repository.
2. [STATO-IOS.md](STATO-IOS.md): riepilogo autorevole di stato e gate aperti.
3. [README iOS](../ios/README.md): comandi, ambiente e rapporti verificati.
4. [Piano nativo](PIANO-APP-NATIVA.md) per invarianti;
   [piano M2](PIANO-IOS-M2.md) soltanto per lo sviluppo della nuova tappa.
5. `git status --short` e diff dei file coinvolti; preservare lavoro preesistente,
   lockfile, evidenze e `creaInvito.txt`. Non copiare segreti in output/documenti.

Non partire da un vecchio prompt “inizia M1” o “solo auth/bootstrap sono bearer”.
M1 è già implementata e installata, inclusi bootstrap dedicato, profilo paginato,
avvisi, gestione Keychain e concorrenza. M0.5 è chiusa: non rigenerare i vettori.

## Primo lavoro ancora necessario

Picker e ascolto VoiceOver confermati dall’utente il 27 ottobre sera.
Restano contrasto e Dynamic Type: il setter del servizio Apple ignora la richiesta
di testo massimo, accertato con readback. Risolvere la verifica senza attestare
come massimo un valore rimasto a 0,2727. Vedi STATO-IOS.md e rapporto serale.
Non attraversare la galleria o altre superfici personali con scansioni AX/HID.
Se il dispositivo o una prova manuale non è disponibile, documentare il limite e
preparare il lavoro indipendente; non dichiarare il gate superato.

Solo dopo la chiusura M1 iniziare M2.1: **lettura storie e player foto**,
prima contratto/test server poi Swift. Le route del piano M2 sono proposte,
non endpoint che esistono già. Non abilitare genericamente `/api/action` al bearer.

## Vincoli da conservare

- SwiftUI, SwiftPM e xtool su Linux; una build alla volta da `ios/` con
  `xtool dev build`. Non reinstallare toolchain o proporre simulatori iOS Linux.
- API server-mediated: bearer verificato, MFA, RLS e no-store; Origin per il web,
  allowlist nativa esplicita, nessun client amministrativo per operazioni utente.
- Refresh single-flight e epoch; token Keychain e recupero dei fallimenti di
  salvataggio; logout immediato e revoca best effort; HTTP effimero, media RAM.
- Nessun retry automatico delle scritture con esito ambiguo; preservare protezioni
  delle foto selezionate e letture concorrenti alla pubblicazione.
- Nessuna modifica cloud, spesa, deploy o attivazione federata implicita.
- Verificare rete/servizio prima di cambiare configurazione: l'ultimo indirizzo USB
  documentato non è un valore fisso. Non spostare automaticamente backend su Wi-Fi.
- Le API Next cambiano: prima di codice Next leggere la guida installata pertinente.
- Usare Graphify per domande sul codice; dopo modifiche al codice eseguire
  `graphify update .`. Una sessione solo Markdown non richiede rebuild AST.

## Comandi e significato delle prove

Dalla root: `python scripts/check-ios-m1.py` esegue il percorso locale; usare
Python/venv specificati nel README per i flag device. `bash scripts/check-ios-session.sh`
usa codice reale con shim Combine: non è il runner Darwin/SwiftUI. I due test crypto
Linux sono una suite separata. Build, installazione e runtime sono tre esiti distinti.
Per i dettagli correnti usare i parser dei comandi e il README, senza inventare flag.

Questa è una guida alla ripresa, non un comando per ripetere tutti i test a ogni
sessione: scegliere verifiche pertinenti al diff. Per una modifica solo documentale,
controllare link, coerenza e `git diff --check`; non attestare nuovi test dell'app.

## Chiusura di ogni sessione

Aggiornare `STATO-IOS.md` quando cambia lo stato e il README operativo quando
cambiano comandi/ambiente. Conservare verbali datati senza riscriverne gli esiti.
Riportare: obiettivo, file cambiati, comandi e risultati realmente eseguiti,
build/installazione/runtime, limiti, prossimo singolo incremento e ripristino device.
Non creare rapporti “passed” per prove pianificate o assimilare test stub a RLS cloud.

## Vault Obsidian

Il vault locale è `/home/fra/Documents/SN Graphify`. L'utente ha chiesto di rimuovere
l'esportazione enorme di Graphify: **non ricreare note per simbolo o `graph.canvas`**.
Il grafo originale del repository è separato e va conservato.

Nel vault tenere guide collegate per argomento e fonti complete in sottocartelle.
Il filtro `tag:#sn/mappa` mostra solo le guide principali; evitare di assegnarlo a
migrazioni, evidenze e ogni copia del sorgente. Sincronizzare le fonti modificate,
aggiornare i checksum nel manifesto e verificare i wikilink senza sovrascrivere
note personali. Il vault è una copia locale, non una sincronizzazione automatica.

## Prompt breve pronto da usare

```text
Riprendi SN iOS. Leggi AGENTS.md, docs/MANUALE-PROGETTO.md,
docs/STATO-IOS.md, ios/README.md e docs/PROSSIMA-SESSIONE.md; controlla il diff.
M0 e M0.5 non vanno rifatti; M1 è implementata ma ha gate manuali residui.
Verifica prima questi gate. Dopo chiusura M1, procedi con M2.1 secondo
docs/PIANO-IOS-M2.md, un incremento alla volta, preservando web/RLS/sessione.
Distingui pianificato, implementato, testato, installato e verificato su iPhone.
```

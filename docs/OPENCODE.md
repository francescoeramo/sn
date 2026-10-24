# OpenCode e DeepSeek Flash per SN

Configurazione aggiornata il 15 ottobre 2026 per OpenCode 2.0.29 e API dirette DeepSeek.
La guida generale per tutti i progetti è `/home/fra/Documents/OpencodeDeepseekFunc.md`.
Gli agenti globali build, quick, lean_plan e review si aggiungono a quelli specifici di SN.
Il profilo attivo è `opencode.json`, locale e ignorato da Git. La copia riproducibile è
`docs/agents/opencode.sn.json`; non contiene chiavi. Le credenziali e l'endpoint del
provider restano nella configurazione utente OpenCode già presente.

## Avvio

```bash
cd /home/fra/Projects/sn
opencode
```

Apri una nuova sessione: quelle precedenti possono conservare agente e modello scelti.
L'agente predefinito è `sn_ios`, sul modello `deepseek/deepseek-flash`.
Per riprendere un incremento scrivi, per esempio:

```text
/sn-ios Inizia M1: feed cronologico, profilo e pubblicazione con una immagine.
M0 funzionale è confermata e M0.5 è verificata con CryptoKit su iPhone.
Leggi ios/README.md e il diff, adatta al bearer solo le API necessarie,
preserva il comportamento web e compila con xtool. Distingui build e prova runtime.
```

`/sn-status` usa `sn_quick` per lo stato del progetto. `sn_plan` produce piani senza
modificare file o avviare shell. `sn_ios` lavora direttamente e non può delegare.
La skill locale `sn-ios-xtool` raccoglie i vincoli specifici della migrazione.
Il prompt dell'agente è in `docs/agents/sn-ios.md`.

## Stato da cui riprendere

Aggiornamento 24 ottobre 2026: M1 implementata e installata, inclusi recupero
connessione, cache media RAM e composer con avvisi. 18 XCTest Linux, 10 controlli
modelli e 30 test server mirati superati. Il collaudo runtime esteso resta aperto;
non ripartire dall'implementazione M1 descritta nelle note storiche sotto.
Wi-Fi ora autorizzato e backend a `192.168.1.9:3000`.
Seguire [ios/README.md](../ios/README.md) per il prossimo passo.

Incrementi successivi della stessa giornata: composer protetto dalle selezioni
foto tardive; gestione sessione/offline anche nelle scritture; archivio proprio
indipendente (`profile/posts`, cursore composto). 30 XCTest Linux, 13 controlli
modelli e 75 test server/regole superati; build finale installata su iPhone.
Backend in servizio utente `sn-ios-dev` per sopravvivere al riavvio dell'agente.
Runtime del nuovo profilo e paginazione oltre 40 ancora da confermare; non iniziare
M2 dichiarando concluso il collaudo M1. Fare riferimento al README corrente.

- M0: login, verifica sessione, rinnovo, logout/riapertura, offline e MFA confermati
  dall'utente. La matrice tecnica completa e gli XCTest sessione/SwiftUI non sono
  dichiarati eseguiti; il login MFA dopo il rafforzamento SQL resta una regressione M1.
- M0.5 completata sul telefono: [rapporto CryptoKit](evidence/ios-crypto-interop-2026-10-15.json),
  35 controlli, tre risposte su tre dispositivi e allegato verificato dal codice web.
  Due XCTest crypto Linux eseguiti; [procedura](IOS-CRYPTO-INTEROP.md).
- M1 da implementare: interfaccia feed/profilo/pubblicazione e adapter bearer delle
  relative API. Solo auth native e bootstrap sono già bearer. Non togliere Origin
  globalmente e non inviare chiavi Supabase privilegiate al telefono.
- Supabase dedicato `sndb`: 47 migrazioni allineate, ban a durata e vincolo MFA SQL.
  Moderazione disponibile sul sito; il client installato resta Login/MFA/Sessione.

Per lo stato corrente prevale [ios/README.md](../ios/README.md). Il prompt
`docs/agents/sn-ios.md`, la skill locale, il comando `/sn-ios`, il template e il
profilo locale attivo sono allineati. Aprire una nuova sessione OpenCode per evitare
contesto storico già caricato; non è necessario cambiare provider o modello.

## Ragionamento e costo

Il profilo usa thinking abilitato e `reasoning_effort: high` per lo sviluppo Swift.
Le varianti sono `low`, `high`, `max`; quick e plan usano `low`. Per un intervento
semplice puoi selezionare low nel client oppure eseguire:

```bash
opencode run --agent sn_ios --model deepseek/deepseek-flash#low "Descrizione dell'intervento"
```

High può produrre più token di ragionamento. Evita max come impostazione abituale con
un budget di 10 euro al mese. Il profilo non impone un tetto monetario: controlla saldo
e consumi nel provider e limita le ricariche; nessun abbonamento o ricarica è stato attivato.

La configurazione dichiara `reasoning_content` come campo di ragionamento e richiede
che venga conservato. DeepSeek lo richiede nelle conversazioni con tool in thinking mode.
Non viene impostata una temperatura: in thinking mode DeepSeek la ignora.
Le skill guidano il lavoro ma non cambiano le capacità del modello.

## Modifiche al workflow

Il vecchio profilo caricava sette file di istruzioni a ogni sessione, compresi workflow
EOC per TDD, sicurezza e verifica. Il profilo corrente usa AGENTS.md e carica la skill
iOS quando serve. Le istruzioni del repository, compresa la lettura iniziale del manuale,
restano valide.

Gli agenti e i comandi EOC sono stati tolti dal profilo attivo; l'installazione rimane
in `.opencode/easy-opencode/`. Il pacchetto globale `opencode-code-review` 1.0.9 è stato disattivato perché incompatibile con OpenCode 2; per revisioni usa `/review-work`. I plugin Rizzo e l’adattatore Herdr ora usano le API V2.
La configurazione precedente di SN è in `.opencode/backups/2026-10-15-deepseek/opencode.json`.
Anche il profilo EOC in `~/.opencode/opencode.json` è stato neutralizzato dopo un backup
in `~/.config/opencode/backups/2026-10-15-global-deepseek/home-eoc-opencode.json`.
Rizzo ora riconosce anche sn_ios; quick, lean_plan, review, sn_quick e sn_plan lo saltano.
Per ripristinarla dalla root:

```bash
cp .opencode/backups/2026-10-15-deepseek/opencode.json opencode.json
```

Per ricreare il profilo SN, dopo avere salvato eventuali modifiche locali:

```bash
cp docs/agents/opencode.sn.json opencode.json
```

Il template usa i campi OpenCode 2 `agents`, `providers`, `commands`, `system` e `body`.
Se cambi prompt, modifica `docs/agents/sn-ios.md`; se cambi configurazione, aggiorna
anche il template. I backup EOC sono locali e non finiscono nel repository pubblico.

## Verifiche e limiti

Il profilo è validato. `opencode debug config` identifica il file di configurazione
attivo e il comando `/sn-ios`; `opencode debug agents` risolve il contenuto del
prompt `sn_ios`, compreso M0.5 completato e M1 successivo. Il 15 ottobre entrambi
i comandi sono riusciti; modello, provider, thinking e permessi sono conservati.
Non vengono effettuate chiamate ai modelli da queste verifiche locali.
Una prova CLI contro un server finto locale ha confermato che il trasporto invia
`thinking: enabled` e `reasoning_effort: high`; una seconda prova conferma che
la variante `low` sostituisce high. Entrambe usano un server locale, senza richieste ai provider.
La skill ha superato il validatore del formato SKILL.md. La build dell'app è documentata
in `ios/README.md` e `docs/TEST-RESULTS.md`.

Non è stato misurato un miglioramento della qualità o del costo su task reali di SN.
Confronta alcuni incrementi simili usando build riuscita, correzioni necessarie e
consumo registrato dal provider. Il prossimo lavoro è M1: feed, profilo e post con
immagine. `SNApiBaseURL` è `http://192.168.1.9:3000`, con ATS specifica; verificare
la LAN prima di cambiarlo. I precedenti blocchi firewall/Supabase in pausa sono
storia della diagnosi, non problemi da presumere ancora presenti.

Fonti:
- [Integrazione DeepSeek con OpenCode](https://api-docs.deepseek.com/quick_start/agent_integrations/opencode/)
- [Thinking e tool DeepSeek](https://api-docs.deepseek.com/guides/thinking_mode/)
- [Schema OpenCode](https://opencode.ai/config.json)
- [Skill OpenCode](https://opencode.ai/docs/skills/)
- [xtool ufficiale](https://github.com/xtool-org/xtool)

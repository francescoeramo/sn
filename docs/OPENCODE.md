# OpenCode e DeepSeek Flash per SN

<!-- sn-ios-context:start -->
> **Stato iOS al 27 ottobre 2026:** M1 chiusa per lo sviluppo; M2.1 lettura e
> player foto installati e accettati come funzionanti dal proprietario. Prossimo
> incremento: M2.2 pubblicazione foto, da iniziare alla ripresa.
> [Stato](STATO-IOS.md) · [Piano M2](PIANO-IOS-M2.md) · [Ripresa](PROSSIMA-SESSIONE.md)
> I verbali sotto restano storici; l’accettazione non aggiunge prove automatiche o ascolti VoiceOver.
<!-- sn-ios-context:end -->

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
/sn-ios Riprendi SN iOS leggendo docs/PROSSIMA-SESSIONE.md e docs/STATO-IOS.md.
M1 è implementata e installata: controlla prima picker/accessibilità ancora aperti.
Dopo chiusura M1 procedi con M2.1 secondo docs/PIANO-IOS-M2.md.
Preserva bearer/MFA/RLS e web; distingui piano, build, installazione e runtime.
```

`/sn-status` usa `sn_quick` per lo stato del progetto. `sn_plan` produce piani senza
modificare file o avviare shell. `sn_ios` lavora direttamente e non può delegare.
La skill locale `sn-ios-xtool` raccoglie i vincoli specifici della migrazione.
Il prompt dell'agente è in `docs/agents/sn-ios.md`.

## Stato da cui riprendere

Al 27 ottobre 2026 M0 è funzionante, M0.5 completata e M1 implementata/installata.
Le ultime evidenze e i gate manuali sono in [STATO-IOS.md](STATO-IOS.md);
comandi e rete corrente in [README iOS](../ios/README.md). Le istruzioni del 15/24
ottobre non vanno usate per ricreare il feed o gli adapter bearer già presenti.

M2 è pianificata in [PIANO-IOS-M2.md](PIANO-IOS-M2.md): storie foto/video e viewer
privati, per incrementi. Prima chiudere M1. Le [istruzioni di ripresa](PROSSIMA-SESSIONE.md)
valgono per ogni modello, mentre provider/versioni riportati in questa guida
descrivono la configurazione documentata, senza una nuova verifica in questa sessione.
Non è necessario cambiare provider o modello per riprendere lo sviluppo.

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


## Collaudo automatizzato M1 — 24 ottobre 2026, passaggio finale

Rapporto corrente: [IOS-M1-VERIFICA.md](IOS-M1-VERIFICA.md) (dal README iOS:
`../docs/IOS-M1-VERIFICA.md`). 32 XCTest Linux con APIClient/URLSession reali e
trasporto sintetico, 15 controlli modelli e 77 test server/regole superati;
typecheck/lint e build Darwin superati. Prova interna su iPhone: 18 controlli
superati, incluso Keychain separato e ridimensionamento foto. Prova SwiftUI con
HID: feed e profilo 40 → 80 → 85, pulsanti e fine esplicita verificati. Nessun
post di test inserito nel cloud. Timeout del backend reale: sessione conservata e
recupero senza rilancio, con campione stabile successivo alla transizione.

Trovato e corretto un difetto reale: timestamp uguali al confine della pagina
facevano saltare 45 post su 85 nel feed. Ora bootstrap/posts aggiungono
`nextPostId`, iOS invia `before` + `post_id`, ordinamento e confronto data/UUID;
il contratto web a sola data rimane accettato. Nessuna migrazione o modifica cloud.

Aumentato il contrasto di metadati e contatori usando il colore primario di
sistema, preservando layout e stili tipografici. Build finale installata e
verificata al 100%; composer aperto via HID e ispezionato sul telefono. Restano
aperti: nuovo audit dopo l'ultima correzione del contrasto (i precedenti audit
validi riportano rilievi, alcuni incoerenti con i pixel della schermata), prova
rapida del picker nativo e ascolto VoiceOver completo. Non dichiarare M1
integralmente collaudata o iniziare M2 come se tutti i gate fossero chiusi.

Automazione: `scripts/check-ios-m1-device.py`, modalità solo DEBUG
`SN_M1_UI_FIXTURE=1` e `SN_RUN_M1_CHECKS=1`; dati locali, token in memoria e
preferenze isolate. Il runner controlla il segnale di collaudo prima/dopo audit e
prima di salvare screenshot. Campioni di altre app scartati ed eliminati; nessun
contenuto personale nei rapporti versionati. Durante la sessione usbmuxd è
terminato con SIGABRT/invalid pointer ed è stato riavviato; nessun cambio toolchain.
Rete e backend: servizio utente `sn-ios-dev` attivo a `192.168.1.9:3000`.
A fine prove ripristinati tema scuro, dimensione testo iniziale e avvio normale
senza flag di test; non reinstallare né ripetere crypto M0.5.

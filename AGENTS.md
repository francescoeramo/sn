<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# Project Instructions

Before starting any task, always read the full architectural context defined in `docs/MANUALE-PROGETTO.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## iOS su Linux

Per la migrazione SwiftUI usa `ios/README.md` (ambiente e stato verificato) e
`docs/PIANO-APP-NATIVA.md` (contratto). Il percorso attuale è SwiftPM + xtool su Linux,
con iPhone USB per il runtime. Le istruzioni Mac/Xcode nei documenti precedenti sono
superate. `primaDiContinuare.md` rimanda ora al README operativo.
Compila da `ios/` con `xtool dev build`; non confondere build riuscita e verifica su device.
Stato al 27 ottobre 2026: M0 funzionante, M0.5 completata con CryptoKit,
M1 chiusa per lo sviluppo; M2.1 lettura/player foto installati e accettati come
funzionanti dal proprietario. Prossimo incremento M2.2 pubblicazione foto.
Le API bearer M1 e la lettura storie M2 sono già adattate:
leggere `docs/STATO-IOS.md`, `docs/PIANO-IOS-M2.md` e `docs/PROSSIMA-SESSIONE.md`.
I test sessione/HTTP sono eseguiti su Linux con shim Combine; non sono il runner
Darwin/SwiftUI. Non rifare tappe concluse o rigenerare i vettori M0.5 senza regressione.
Per OpenCode leggi `docs/OPENCODE.md`; la skill locale è `sn-ios-xtool`.

## Documentazione e passaggio di consegne

Lo stato corrente iOS è centralizzato in `docs/STATO-IOS.md`; comandi/evidenze
in `ios/README.md`. Leggere `docs/PROSSIMA-SESSIONE.md` quando si riprende il lavoro.
Conservare i verbali storici, marcandoli come tali quando sono superati; un piano
non dimostra implementazione, un test locale non dimostra il runtime o il cloud.
Il vault `/home/fra/Documents/SN Graphify` contiene soltanto documentazione collegata:
non ricreare l'esportazione Graphify per simboli o la lavagna rimossa dall'utente.

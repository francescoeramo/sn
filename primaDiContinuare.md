# Continuare SN su iOS

Leggere `AGENTS.md` e tutto [il manuale](docs/MANUALE-PROGETTO.md), poi
[le istruzioni di ripresa](docs/PROSSIMA-SESSIONE.md), [lo stato corrente](docs/STATO-IOS.md)
e [il README operativo](ios/README.md).

Al 27 ottobre 2026 M0 è funzionante, M0.5 è completata e M1 è implementata e
installata. Restano picker manuale e verifica accessibilità/VoiceOver prima di
chiudere M1. Non ripartire da M0/M0.5 o dall'implementazione iniziale del feed.

Il [piano M2](docs/PIANO-IOS-M2.md) definisce le storie native: prima lettura/player
foto, poi pubblicazione foto, video e visualizzazioni private. È un piano, non
codice già presente. Dopo chiusura M1 iniziare dal contratto di M2.1.

Usare SwiftPM + xtool su Linux e iPhone USB, mantenere bearer/MFA/RLS e protezioni
web. Per comandi, verifiche, limiti delle prove e prompt pronto per qualsiasi
modello usare `docs/PROSSIMA-SESSIONE.md`; per OpenCode vedere `docs/OPENCODE.md`.

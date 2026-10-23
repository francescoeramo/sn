# SN

SN è un social per un piccolo gruppo di amici, con interfaccia in italiano e inglese. Ha un feed finito, profili privati per impostazione predefinita, nuovi messaggi cifrati e nessuna pubblicità.

## Prova la demo

```bash
npm install
npm run dev
```

Apri [http://127.0.0.1:3000/demo](http://127.0.0.1:3000/demo). La demo non richiede account o servizi esterni e salva i dati soltanto nel browser.

## Sviluppo

Il progetto usa Next.js 16, React 19, TypeScript, Supabase e Postgres. Prima di modificare il codice leggi [AGENTS.md](AGENTS.md) e il [manuale del progetto](docs/MANUALE-PROGETTO.md).

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Client iOS

Il client SwiftUI usa SwiftPM e xtool su Linux. I flussi M0 sono confermati dall'utente;
M0.5 (cifratura web ↔ iPhone con allegati) è verificata sul telefono con CryptoKit.
La build è firmata e installata. Il prossimo incremento è **M1: feed, profilo e post con
immagine**; l'interfaccia attuale resta il prototipo di sessione, non l'app social completa.
Comandi, evidenze e limiti sono in [ios/README.md](ios/README.md) e nella
[prova di interoperabilità](docs/IOS-CRYPTO-INTEROP.md).
Per lavorare con DeepSeek Flash leggi [docs/OPENCODE.md](docs/OPENCODE.md).

## Produzione

L’app reale richiede un progetto Supabase dedicato, le variabili descritte in [.env.example](.env.example) e tutte le migrazioni in `supabase/migrations/`. Non usare progetti o credenziali personali.

Prima di invitare persone reali completa la [checklist di verifica](docs/VERIFICA.md), configura la [manutenzione e i backup](docs/BACKUP.md) e prova Auth, email, Storage, RLS e ripristino su un ambiente dedicato.

## Documentazione

- [Prodotto e vincoli](PRODUCT.md)
- [Architettura](docs/ARCHITETTURA.md)
- [Crittografia della chat](docs/CRITTOGRAFIA.md)
- [Roadmap](docs/ROADMAP.md)
- [Risultati dei test](docs/TEST-RESULTS.md)

Il repository è pubblico ma non ha ancora una licenza open source: `UNLICENSED`.

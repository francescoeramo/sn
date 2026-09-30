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

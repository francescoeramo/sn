# Audit di sicurezza — 19 ottobre 2026

Revisione source-first con la skill Cloudflare security-audit, verifica indipendente e fixture locali senza rete, account reali o credenziali.

Correzioni:

- La manutenzione elimina solo richieste esplicite registrate dopo la conferma della password. I ban non costituiscono consenso alla cancellazione. Il nuovo registro privato ha RLS e RPC riservate al servizio; disabilitazione e registrazione della richiesta sono atomiche. Nessun backfill dei vecchi account disabilitati: la loro intenzione è ambigua.
- Le letture di cerchie, iscrizioni e collaborazioni richiedono account attivo e MFA quando abilitata. Resta leggibile il proprio profilo attivo per completare il challenge. La migrazione è compatibile anche con lo schema pubblicato senza le modifiche locali ai ban temporanei.
- Entrambe le liste delle connessioni escludono i profili bloccati in qualunque direzione, conservando visibilità e controlli sui ban.
- Gli upload media passano dal server: prenotazione dei byte misurati tramite client utente/RLS, poi inserimento Storage privilegiato del solo corpo validato e immutabile. L’inserimento Storage diretto degli utenti è negato. Questo chiude il disallineamento dimostrato nelle policy senza affidarsi ai metadati generati dal provider durante INSERT.
- Lockfile aggiornato a sharp 0.35.5 e relativi binari/libvips per l’advisory GHSA-2464-fhr4-w9xw. Il decoder Next non usato viene disabilitato globalmente; i componenti già servivano immagini senza ottimizzazione. Nessuna esecuzione remota è stata tentata o dimostrata. Riferimento: https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw

Ordine di rilascio: distribuire prima il server aggiornato per gli upload, quindi applicare le quattro migrazioni `20261019134742`–`20261019140133`; manutenzione e cancellazione richiedono le nuove RPC e falliscono chiuse se assenti. Le quattro migrazioni sono state applicate a `sndb` il 19 ottobre 2026, dopo aver verificato il server aggiornato in produzione. Verificati registro/RLS, grant, tre policy MFA, due filtri blocchi e divieto di upload Storage diretto; evidenza in `docs/evidence/cloud-security-2026-10-19.json`. Non ripristinare un selettore di cancellazione basato sul solo `disabled`.

Test: suite Vitest completa, regressioni API e Postgres su schema corrente/pubblicato, lint e TypeScript. Le fixture Storage non sono il servizio gestito: persistenza nativa, configurazioni effettive, concorrenza cloud e collaudo completo restano verifiche esterne. I pacchetti locali non sono stati reinstallati; la CI installa il lockfile aggiornato. Nessun audit esaustivo degli advisory transitivi o dei segreti nella cronologia.

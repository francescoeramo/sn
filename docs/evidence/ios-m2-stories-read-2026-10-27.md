# M2.1 — lettura server, 27 ottobre 2026

Implementato GET /api/native/stories, separato dal bootstrap M1: bearer/MFA,
client RLS verificato, autori propri/seguiti accettati, scadenza UTC attiva,
colonne esplicite e solo ricevute del chiamante sugli ID della pagina.
Pagine 40+1, ordine data/UUID e cursore composto validato. Non registra viste.
Nessuna nuova migrazione, modifica cloud, pubblicazione o player SwiftUI.

`npm run check`: lint, typecheck, 200 test e build Next.js riusciti.
40 test mirati query/HTTP/sicurezza riusciti prima del gate completo. Le query
sono testate con stub; i test database/RLS del gate usano PGlite e non attestano
il cloud Supabase. Endpoint locale senza bearer: 401.

Contratto e prossimo incremento in PIANO-IOS-M2.md: modelli, stato e player foto.
M2.1 non dichiarata completa per il solo endpoint.

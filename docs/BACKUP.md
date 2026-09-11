# Backup e ripristino

Il piano Free di Supabase richiede un export periodico gestito da SN. Il comando del progetto produce tre dump SQL, aggiunge un manifesto con hash SHA-256 e cifra tutto per una chiave GPG prima di conservarlo.

## Preparazione

1. Crea una chiave GPG dedicata al backup e conserva la chiave privata fuori dal server che esegue gli export.
2. Copia dal pannello Supabase la connessione Session pooler del progetto SN. Codifica i caratteri speciali della password nell’URL.
3. Scegli una cartella assoluta fuori dal repository, su un volume cifrato o sincronizzato verso una destinazione privata.

## Esecuzione

```bash
SUPABASE_DB_URL='postgresql://…' \
SN_BACKUP_RECIPIENT='backup@sn.example' \
npm run backup -- /percorso/backup-sn
```

Programma il comando almeno una volta al giorno durante la beta. Non salvare `SUPABASE_DB_URL` nel repository o nei log. Copia l’archivio cifrato anche su una seconda destinazione e conserva almeno sette versioni giornaliere.

I dump del database contengono i metadati di Storage, ma non i file. Copia separatamente gli oggetti del bucket privato `media`; cifra anche quella copia. Le chiavi E2EE private restano nei browser e non entrano nel backup server.

## Prova di ripristino

Esegui la prova su un progetto Supabase temporaneo senza utenti reali:

1. Decifra l’archivio con `gpg --decrypt` ed estrailo in una cartella temporanea protetta.
2. Confronta gli SHA-256 di `roles.sql`, `schema.sql` e `data.sql` con `manifest.json`.
3. Ripristina con `psql --single-transaction --variable ON_ERROR_STOP=1`, caricando nell’ordine ruoli, schema e dati. Prima dei dati imposta `session_replication_role = replica` come indicato dalla guida Supabase.
4. Riapplica le impostazioni Auth, SMTP, Redirect URLs, segreti e manutenzione: non fanno parte del dump.
5. Verifica accesso, inviti, RLS, allegati e conteggi. Distruggi il progetto di prova e i file SQL in chiaro dopo aver registrato data ed esito.

Una prova trimestrale evita di scoprire durante un incidente che un archivio non è leggibile o che manca la copia degli oggetti Storage.

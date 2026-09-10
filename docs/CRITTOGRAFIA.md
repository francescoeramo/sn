# Chat cifrata, protocollo v1

Ogni browser genera una coppia ECDH P-256 con Web Crypto. La chiave privata viene salvata come CryptoKey non esportabile in IndexedDB; il server riceve soltanto la chiave pubblica. Sono ammessi fino a cinque browser per account, registrati attraverso una sessione autenticata.

Per ciascun messaggio il mittente genera una chiave AES-256-GCM casuale. ECDH e HKDF-SHA-256 producono una chiave di avvolgimento distinta per ciascun browser dei partecipanti. Il payload contiene testo e, quando presente, la chiave casuale separata dell’allegato. Quest’ultimo viene cifrato prima dell’upload e salvato come application/octet-stream. Non vengono installati servizi crittografici o SDK a pagamento.

Gli IV GCM sono casuali da 96 bit. ID del messaggio, partecipanti, scadenza e conservazione sono autenticati come additional authenticated data. Alterarli rende impossibile la decifratura. Il database rifiuta nuovi messaggi in chiaro, verifica il dispositivo mittente, richiede le chiavi di tutti i browser attualmente registrati e limita le scadenze. Lo storico precedente resta etichettato come non cifrato.

## Identità e nuovi browser

Il client memorizza le impronte SHA-256 dei dispositivi. Una modifica dell’elenco blocca nuovi invii finché l’utente non confronta e approva i codici mostrati. Il primo elenco usa trust on first use: il confronto attraverso un canale indipendente resta necessario per verificarne l’identità. Un nuovo browser riceve solo i messaggi futuri, non una copia automatica dello storico.

Questa implementazione usa algoritmi standard, ma il protocollo applicativo non ha ricevuto un audit indipendente. Non implementa Signal Double Ratchet o forward secrecy per lo storico. Un server compromesso che distribuisse JavaScript malevolo potrebbe accedere ai dati durante l’uso: una webapp non elimina questa dipendenza. Le chiavi non esportabili non proteggono da script eseguiti nella stessa origine. Metadati quali partecipanti, orari, dimensioni e scadenze restano visibili al servizio.

## Conservazione

La modalità sincronizzata conserva il ciphertext sul server fino alla scadenza. In modalità solo dispositivo, il destinatario salva messaggio e allegato cifrati in IndexedDB prima di confermare la consegna. Una funzione SQL riservata ai membri elimina soltanto i propri messaggi ricevuti con questa modalità e revoca l’accesso al relativo blob. L’API elimina il file; la manutenzione riprova se Storage non risponde. Il mittente conserva la sua copia cifrata locale.

La scadenza autenticata viene controllata anche dal client. I dati locali scaduti vengono eliminati quando la chat li carica. La pulizia server richiede l’esecuzione dell’endpoint di manutenzione. I browser chiusi non possono eseguire job e le copie scaricate da un destinatario non possono essere cancellate a distanza.

Cancellare IndexedDB può rendere lo storico irrecuperabile. L’esportazione server include i messaggi cifrati e non esporta le chiavi private. Il recupero dello storico su un nuovo dispositivo, la revoca con gestione delle sessioni e il trasferimento verificato delle chiavi richiedono un lavoro dedicato prima di una beta estesa.

## Fonti tecniche

- [Web Crypto: derivazione ECDH e HKDF](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey)
- [Generazione e proprietà delle chiavi](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey)
- [AES-GCM: IV e dati autenticati](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)

Il collaudo locale copre chiavi non esportabili, tre browser autorizzati, estranei, manomissioni, allegati, RLS, persistenza e riapertura della demo. Auth e Storage cloud restano da collaudare sul progetto dedicato.

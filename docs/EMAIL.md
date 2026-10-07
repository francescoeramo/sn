# Email di autenticazione e Resend

SN usa Supabase Auth per generare i link di conferma e recupero e Resend come trasporto SMTP. L'app continua a chiamare `signUp` e `resetPasswordForEmail`: non servono chiavi Resend nel runtime Next.js. I corpi HTML e gli oggetti sono in `supabase/templates/` e `supabase/config.toml` per il Supabase locale. Il progetto Supabase ospitato **non** importa automaticamente queste impostazioni dal repository.

## Mittente

Resend richiede un dominio di invio verificato tramite DNS. `sn.help@proton.me` non può essere usato come indirizzo **Da** tramite Resend: il dominio `proton.me` appartiene a Proton e non è verificabile nel nostro account. Il recapito resta nell'email come contatto per l'assistenza. Per ricevere direttamente le risposte in Proton, configura anche `Reply-To: sn.help@proton.me` se il servizio di invio lo permette; il campo non è disponibile nella configurazione SMTP standard di Supabase Auth, quindi non considerarlo attivo finché non è verificato in una prova reale.

Scegli un dominio di cui controlli i DNS e verifica i record richiesti da Resend (SPF e DKIM; configura anche DMARC). Usa quindi un mittente su quel dominio, per esempio `SN <aiuto@tuodominio.it>`. Non inserire un dominio fittizio nelle impostazioni cloud.

## Configurazione del progetto SN su Supabase

1. In Resend verifica il dominio mittente e crea una API key dedicata all'invio Auth. La chiave è un segreto: non inserirla nel repository o in una variabile `NEXT_PUBLIC_`.
2. In **Supabase → Authentication → SMTP Settings**, abilita Custom SMTP: host `smtp.resend.com`, porta `465`, utente `resend`, password uguale alla API key Resend, sender name `SN` e sender email sul dominio verificato. Puoi anche usare l'integrazione guidata Supabase/Resend; controlla comunque il mittente risultante.
3. In **Authentication → Email Templates**, imposta i seguenti oggetti e incolla il contenuto dei file indicati:

   | Tipo nella dashboard | Oggetto | File |
   | --- | --- | --- |
   | Confirm sign up | `SN — conferma il tuo indirizzo email` | `supabase/templates/confirmation.html` |
   | Reset password | `SN — reimposta la tua password` | `supabase/templates/recovery.html` |
   | Password changed (notifica abilitata) | `SN — la tua password è stata cambiata` | `supabase/templates/password_changed_notification.html` |

4. Conferma che Site URL e redirect URL contengano l'origine di produzione e `/auth/callback`, che la conferma email sia abilitata e che la scadenza OTP/link sia 15 minuti. Disabilita il tracciamento dei clic in Resend: la riscrittura dei link può compromettere i link Auth.
5. Invia una prova a un account di test tramite invito. Apri la conferma nello stesso browser della registrazione. Richiedi poi il recupero password, apri il link nello stesso browser e verifica la notifica dopo il cambio. Controlla **Da**, consegna, cartella spam, soggetti, link, scadenza e log di Resend. Verifica che una richiesta di recupero per email inesistente non riveli l'esistenza dell'account.

In locale, senza SMTP reale, Supabase recapita le email in Inbucket (`http://localhost:54324`); i template locali si attivano riavviando i container. Non usare il dominio di test `resend.dev` per gli inviti della beta.

Il canale email del digest non fa parte di questa integrazione: richiede ancora un invio applicativo con consenso separato.

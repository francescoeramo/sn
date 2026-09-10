import Link from 'next/link';
export default function Privacy() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  return (
    <main className="legal-page">
      <Link href="/">← Torna a SN</Link>
      <h1>Privacy e regole della beta</h1>
      {!contact && (
        <p className="draft-note">
          La beta non è aperta. Prima delle registrazioni saranno indicati il responsabile del
          servizio, un contatto e i fornitori effettivamente utilizzati. Questa pagina descrive la
          versione in preparazione.
        </p>
      )}
      <h2>Che cosa salva SN</h2>
      <p>
        Email, credenziali gestite dal servizio di autenticazione, nome utente, profilo, contenuti
        che pubblichi, follow, blocchi, segnalazioni e messaggi. Questi dati servono a far
        funzionare account, condivisione e moderazione. Il browser conserva un cookie di sessione
        necessario all’accesso.
      </p>
      <p>
        La demo usa profili inventati e salva le modifiche nel browser, in IndexedDB. Non invia post
        o messaggi al database. Puoi cancellare le modifiche dalle impostazioni della demo.
      </p>
      <h2>Chi vede i tuoi contenuti</h2>
      <p>
        Nella beta i contenuti sono accessibili agli account invitati. Con un account privato solo i
        follower approvati vedono i tuoi post; nome e bio restano visibili nella community. Il
        moderatore può consultare i post per gestire le segnalazioni. I nuovi messaggi e allegati
        sono cifrati nel browser prima dell’invio. Il server conserva dati cifrati e le chiavi
        pubbliche dei browser autorizzati. Le chiavi private restano nel browser. Lo storico
        precedente alla cifratura resta segnalato come non cifrato.
      </p>
      <p>
        Il blocco impedisce nuovi follow e messaggi tra i due account. I messaggi già scambiati
        restano nella cronologia fino alla scadenza scelta. La federazione con altri social non è
        attiva.
      </p>
      <h2>Conservazione ed eliminazione</h2>
      <p>
        Le storie non sono più visibili dopo 24 ore. La pulizia programmata rimuove i relativi file
        e gli upload inutilizzati; il tempo di rimozione fisica dipende dall’esecuzione del job. I
        normali post rimangono fino alla cancellazione.
      </p>
      <p>
        Nelle impostazioni trovi l’esportazione JSON e l’eliminazione dell’account. Il JSON contiene
        i dati testuali e i riferimenti ai media; i file si scaricano separatamente. La
        cancellazione rimuove anche messaggi inviati e ricevuti. Copie già scaricate da altre
        persone non possono essere cancellate a distanza.
      </p>
      <p>
        I nuovi messaggi scadono dopo 24 ore, salvo una durata diversa scelta prima dell’invio. Con
        “Solo sul dispositivo”, il server elimina il messaggio quando il destinatario conferma il
        salvataggio locale. La pulizia degli allegati viene ritentata se il servizio Storage non
        risponde. Un browser chiuso riprende la pulizia locale alla riapertura della chat.
      </p>
      <p>
        Cancellare i dati del browser elimina anche le chiavi locali: i vecchi messaggi potrebbero
        non essere più leggibili. Ogni nuovo browser legge i messaggi inviati dopo la sua
        autorizzazione. I codici di sicurezza permettono di controllare i dispositivi; il primo
        scambio richiede fiducia nelle chiavi ricevute finché non le confrontate attraverso un altro
        canale.
      </p>
      <h2>Fornitori e richieste di rete</h2>
      <p>
        La versione locale non contiene tracker pubblicitari o strumenti di analytics. Usa font
        disponibili sul dispositivo e illustrazioni incluse nel progetto. Per la versione online
        sono previsti Supabase e Vercel; la regione del database e le condizioni dei fornitori
        saranno indicate prima dell’apertura. Una regione europea non rende europeo il fornitore.
      </p>
      {contact && (
        <p>
          Per le richieste sui tuoi dati: <a href={`mailto:${contact}`}>{contact}</a>.
        </p>
      )}
      <h2 id="regole">Regole tra amici</h2>
      <p>
        Condividi contenuti tuoi o che hai il diritto di pubblicare. Non pubblicare dati personali
        altrui senza permesso, contenuti illegali, minacce, molestie o spam. La beta è riservata
        agli amici invitati dal gestore; gli inviti non vanno pubblicati.
      </p>
      <p>
        Per segnalare un post apri il menu con i tre puntini e scegli “Segnala post”. La moderazione
        è manuale. Il moderatore può rimuovere il contenuto; per contestare una decisione usa il
        contatto del servizio quando la beta sarà aperta.
      </p>
      <h2>Costi della beta</h2>
      <p>
        Iscrizione e utilizzo sono gratuiti. Le quote limitano persone e upload. Non ci sono
        acquisti o abbonamenti; le donazioni non sono ancora disponibili.
      </p>
      <p className="fine">
        Versione del 9 settembre 2026. Prima dell’apertura al pubblico andranno completati titolare,
        contatti, basi giuridiche, tempi di conservazione operativi e verifica degli obblighi
        applicabili. Riferimento:{' '}
        <a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj">Regolamento UE 2016/679</a>.
      </p>
    </main>
  );
}

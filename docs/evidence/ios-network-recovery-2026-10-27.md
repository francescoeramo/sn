# Ripristino rete iOS — 27 ottobre 2026, sera

Sintomo segnalato: avvio prolungato, poi Connessione assente.
Diagnosi: sn-ios-dev inattivo, nessun listener 3000; indirizzo configurato
172.20.10.3 non assegnato, interfaccia hotspot USB assente. Wi-Fi autorizzato
presente su wlo1, 192.168.1.251.

Eseguito `python scripts/prepare-ios-dev.py --host 192.168.1.251 --install`:
backend riavviato e vincolato al solo indirizzo Wi-Fi, base URL ed eccezione ATS
aggiornati, build/installazione USB completate con Verifying 100%, exit 0.
`GET /api/native/bootstrap` dal computer senza token: 401; servizio attivo.
Nessuna modifica firewall, cloud o dati della sessione.

Avvio automatico tramite CoreDevice non disponibile: servizio
com.apple.coredevice.appservice assente. Occorre aprire l'icona SN e tenere
iPhone e computer sulla stessa rete Wi-Fi. Nessuna risposta autenticata dal
telefono ancora osservata; ripristino runtime da confermare. Picker e VoiceOver
rimangono prove manuali aperte. Il backend è transitorio, non un deploy.

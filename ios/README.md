# SN — app nativa iOS (M0, scaffolding)

Client SwiftUI delle API SN. Server e database restano invariati: l'app consuma gli endpoint
`native/auth/*` e `GET /api/bootstrap` descritti in `docs/PIANO-APP-NATIVA.md` e `docs/ARCHITETTURA.md`.

> Stato: **scaffolding**. I file sono stati scritti e rivisti, ma **non compilati**: questa
> macchina non ha Xcode. Vanno aperti, compilati e iterati su un Mac prima di considerarli validi.

## Cosa è incluso (M0)

| Piano § | File |
|---|---|
| TokenStore (Keychain, `WhenUnlockedThisDeviceOnly`) | `SN/Auth/TokenStore.swift` |
| AuthCoordinator (single-flight R3, epoch R6, offline F5) | `SN/Auth/AuthCoordinator.swift` |
| APIClient (bearer, errori `{error, code}`) | `SN/Networking/APIClient.swift`, `SN/Networking/APIError.swift` |
| Modelli M0 (R5) | `SN/Models/Session.swift` |
| Errori localizzati it/en | `SN/Localization/ErrorMessages.swift` |
| Schermate Login/MFA/Verifica/Logout | `SN/Views/*.swift` |
| Test | `SNTests/*.swift` |

## Setup su macOS

1. Xcode 16 o successivo.
2. Genera il progetto con [XcodeGen](https://github.com/yonaskolb/XcodeGen):
   ```bash
   brew install xcodegen
   cd ios && xcodegen generate && open SN.xcodeproj
   ```
   In alternativa crea a mano un'app iOS "App" con interfaccia SwiftUI, aggiungi i file di `SN/`
   al target e `SNTests/` al target di test.
3. Imposta `SNApiBaseURL` in `ios/SN/Info.plist` con l'indirizzo del server di prova raggiungibile
   **dal telefono** (non `localhost`): es. `http://192.168.1.20:3000`.
4. Avvia il server in modo che ascolti sulla rete locale:
   ```bash
   npm run dev -- --hostname 0.0.0.0
   ```
5. Esegui i test: `xcodebuild test -scheme SN -destination 'platform=iOS Simulator,name=iPhone 16'`.

### App Transport Security

In M0 il server è in HTTP: `Info.plist` abilita `NSAllowsLocalNetworking` e una eccezione per
`localhost`. Per un IP di rete locale aggiungi una voce `NSExceptionDomains`, oppure usa un tunnel
HTTPS. **Prima di una build di rilascio rimuovi le eccezioni ATS.**

### Versione iOS / Liquid Glass

Il target è iOS 17.0 per restare compatibile con SwiftUI standard. La "Liquid Glass" richiede SDK
e versioni più recenti: la versione minima va confermata sui documenti Apple (decisione aperta nel
piano, §5) prima di adottarla.

## Contratto verificato

- Login senza MFA → `200 { access_token, refresh_token, expires_at, token_type }`.
- Login con MFA → `200 { mfa_required, factor_id, access_token, ... }`.
- Refresh → nuova coppia; rifiuto definitivo `401 { code: "refresh_invalid" }`.
- MFA verify (bearer aal1) → coppia aal2.
- Logout (bearer) → `200 { ok: true }`, idempotente.
- `GET /api/bootstrap` con bearer aal1 e MFA attiva → `403 { code: "mfa_required" }`.

I `code` mappati in `ErrorMessages.swift`: `login_invalid`, `refresh_invalid`, `session_invalid`,
`auth_unavailable`, `mfa_required`, `mfa_invalid`, `mfa_unavailable`, `logout_failed`,
`account_unavailable`.

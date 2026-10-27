# Graph Report - sn  (2026-10-27)

## Corpus Check
- 215 files · ~167,082 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .resolved 2, .example 1)

## Summary
- 2083 nodes · 4544 edges · 160 communities (93 shown, 67 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 461 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6f152b46`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- chat-conversation.tsx
- api/[...path]/route.ts
- rules.ts
- ApiError
- 20260909094232_initial_social.sql
- types.ts
- CodingKeys
- crypto/chat.ts
- SN — Piano app nativa iOS (SwiftUI)
- Funzionalità del Sistema
- 20260926130000_collaborative_posts.sql
- events-panel.tsx
- language-provider.tsx
- 20261015170711_timed_account_bans.sql
- social-app.tsx
- package.json
- Interfaccia nativa iOS — incremento M1
- 20260923160225_circles.sql
- 20260926140000_expressiveness.sql
- compilerOptions
- APIClientProtocol
- opencode.sn.json
- 20260925180000_event_details_and_album.sql
- devDependencies
- 20260911085314_chat_lifecycle.sql
- 20260913171500_group_chat_foundation.sql
- 20260925163701_simple_events.sql
- Data
- MockAPI
- 20260913180500_encrypted_group_messages.sql
- public.claim_media_cleanup
- public.refresh_product_metrics
- 20260909201015_encrypted_chat.sql
- ap/[...path]/route.ts
- 20260909200015_ephemeral_chat.sql
- private.circle_image_available
- primitives.tsx
- Parte A — Supabase
- dependencies
- scripts
- 20260912155500_polls.sql
- 20260919135717_federation_withdrawal_queue.sql
- 20260921124522_federation_remote_objects.sql
- 20260920101500_federation_reactions.sql
- 20260926120000_user_digest.sql
- 20261001120000_reliable_shares_and_notifications.sql
- 20260914172524_group_message_notifications.sql
- public.bookmarks
- 20260922113000_federation_remote_moderation.sql
- social.spec.ts
- 20260919134959_federation_delivery_queue.sql
- public.story_views
- 20260910090400_community_notes.sql
- public.enqueue_federated_activity
- 20260911174749_moderation_audit_log.sql
- 20260919134357_federation_inbox.sql
- .prettierrc.json
- 20260918085645_moderator_account_controls.sql
- private.before_signup
- 20260912153500_account_sessions.sql
- eslint.config.mjs
- posts_body_full_text
- 20260912164500_auth_rate_limits.sql
- public.federation_actor_keys
- postcss.config.mjs
- SN — manuale operativo del progetto
- iOS M0.5 — prova di compatibilità crittografica
- Risultati delle verifiche
- Control
- SN — Product
- AuthCoordinator
- security-settings.tsx
- README.md
- Architettura e lavoro ancora necessario
- Decisioni del 9 settembre 2026
- Funzioni sociali successive al collaudo cloud
- Backup e ripristino
- PostDraft
- Piano di continuità — profili, carousel, Home e condivisione
- Piano di continuità — UX mobile, navigazione e registrazione
- 20261015171422_enforce_mfa_database_access.sql
- FeedPost
- Chat cifrata, protocollo v1
- SN
- Email di autenticazione e Resend
- PackageDescription
- SN per iOS: SwiftUI e xtool
- AGENTS.md
- OpenCode e DeepSeek Flash per SN
- backup.mjs
- Foundation
- SKILL.md
- Sviluppo iOS di SN
- State
- 20261019134743_close_metadata_assurance_gaps.sql
- 20261019134742_separate_account_deletion_intent.sql
- SECURITY-AUDIT-2026-10-19.md
- MemoryTokenStore
- APIError
- APIClient
- TokenPair
- database
- prepare-ios-dev.py
- check-ios-session.sh
- digest-panel.tsx
- .normalized
- ComposePostView
- Decodable
- FeedView.swift
- 4. Specifica M0
- SN — lavoro confermato
- View
- Verifiche
- CodingKeys
- Collaudo M1 su iPhone — 24 ottobre 2026
- ChatCryptoTests.swift
- vitest
- SwiftUI
- proxy.ts
- TokenStoreError
- ChatCryptoError
- 4.9 Modifiche iOS
- Language

## God Nodes (most connected - your core abstractions)
1. `AuthCoordinator` - 102 edges
2. `MockAPI` - 94 edges
3. `MemoryTokenStore` - 48 edges
4. `ApiError` - 46 edges
5. `AuthCoordinatorTests` - 45 edges
6. `SocialApp()` - 43 edges
7. `TokenPair` - 39 edges
8. `POST()` - 31 edges
9. `checked()` - 30 edges
10. `Risultati delle verifiche` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Interfaccia e dati` --references--> `SocialApp()`  [INFERRED]
  docs/MANUALE-PROGETTO.md → components/social-app.tsx
- `Server e autenticazione` --references--> `adminDatabase()`  [INFERRED]
  docs/MANUALE-PROGETTO.md → lib/server/supabase.ts
- `Ban degli account (15 ottobre 2026)` --references--> `authenticated()`  [INFERRED]
  docs/MANUALE-PROGETTO.md → lib/server/supabase.ts
- `4.6 Logout e revoca (F2, F4)` --references--> `AuthCoordinator`  [INFERRED]
  docs/PIANO-APP-NATIVA.md → ios/SN/Auth/AuthCoordinator.swift
- `4.10 Modelli M0 (R5)` --references--> `LoginRequest`  [INFERRED]
  docs/PIANO-APP-NATIVA.md → ios/SN/Models/Session.swift

## Import Cycles
- None detected.

## Communities (160 total, 67 thin omitted)

### Community 0 - "chat-conversation.tsx"
Cohesion: 0.14
Nodes (32): ChatConversation(), settingsChange(), GroupChatConversation(), groupRequest(), OpenGroupMessage, openMessages(), chatAction(), syncConversation() (+24 more)

### Community 1 - "api/[...path]/route.ts"
Cohesion: 0.13
Nodes (39): Context, dynamic, errorResponse(), GET(), json(), maxDuration, mfaState(), POST() (+31 more)

### Community 2 - "rules.ts"
Cohesion: 0.06
Nodes (73): clearChatStore(), ago(), applyDemo(), buildDemoDigest(), clearDemo(), demoDigestPeriod(), expireDemoBans(), initializeChat() (+65 more)

### Community 3 - "ApiError"
Cohesion: 0.13
Nodes (31): body(), enforceAuthRate(), nativeAuth(), F. Funzionalità prodotto approvate, dopo l’affidabilità, 4.12 Ordine di esecuzione, authConfig(), gotrue(), isNativeAuthRoute() (+23 more)

### Community 4 - "20260909094232_initial_social.sql"
Cohesion: 0.06
Nodes (60): blocks_target, comments_author, comments_post, federation_due, follows_target, likes_post, media_owner, messages_recipient (+52 more)

### Community 5 - "types.ts"
Cohesion: 0.05
Nodes (40): AlbumItem, Bookmark, ChatGroup, ChatGroupInvite, ChatGroupMessage, ChatGroupReceipt, ChatSettings, CircleMember (+32 more)

### Community 6 - "CodingKeys"
Cohesion: 0.07
Nodes (27): Bootstrap, CodingKeys, accessToken, circlePosts, code, displayName, expiresAt, factorId (+19 more)

### Community 8 - "crypto/chat.ts"
Cohesion: 0.14
Nodes (24): aad(), aes(), AnyChatContext, base64(), ChatContext, ClearMessage, GroupChatContext, newDevice() (+16 more)

### Community 9 - "SN — Piano app nativa iOS (SwiftUI)"
Cohesion: 0.14
Nodes (14): 10. Recupero connessione M1 — 23 ottobre 2026, 11. Composer con avvisi — 24 ottobre 2026, 12. Consolidamento M1 — 24 ottobre 2026, 13. Archivio del proprio profilo — 24 ottobre 2026, 1. Direzione e vincoli, 2. Sequenza delle tappe, 3. Regole vincolanti, 5. Verifiche e decisioni aperte (+6 more)

### Community 10 - "Funzionalità del Sistema"
Cohesion: 0.08
Nodes (23): 10. Messaggistica diretta: conservazione, Chat temporanea e stati, 1. Feed e Profili, 2. Storie con Autoplay e Player Avanzato, 3. Reels / Video Brevi, 4. Cerchie e spazi condivisi, 5. Eventi semplici, 6. Digest scelto dall’utente, 7. Post collaborativi e album condivisi (+15 more)

### Community 11 - "20260926130000_collaborative_posts.sql"
Cohesion: 0.18
Nodes (12): album_items_post_created, collaborators_user, private.album_item_available(), private.can_read_asset(), private.circle_image_available(), private.event_photo_available(), public.album_items, public.claim_media_cleanup() (+4 more)

### Community 12 - "events-panel.tsx"
Cohesion: 0.14
Nodes (20): createCircle(), updateCircle(), uploadCircleImage(), CollaborationPanel(), addItem(), EventRow(), addPhoto(), EventsPanel() (+12 more)

### Community 13 - "language-provider.tsx"
Cohesion: 0.14
Nodes (20): metadata, RootLayout(), LanguageContext, LanguageProvider(), originalAttributes, originalText, renderedAttributes, renderedText (+12 more)

### Community 14 - "20261015170711_timed_account_bans.sql"
Cohesion: 0.14
Nodes (6): private.can_message(), private.can_see_author(), private.member(), public.moderation_accounts(), public.profile_connections(), public.receive_federated_activity()

### Community 15 - "social-app.tsx"
Cohesion: 0.08
Nodes (39): Demo(), Home(), AuthScreen(), useLanguage(), LanguageSettings(), LoadingShell(), RemotePostCard(), auditLabels (+31 more)

### Community 16 - "package.json"
Cohesion: 0.10
Nodes (19): author, description, keywords, license, name, private, type, version (+11 more)

### Community 17 - "Interfaccia nativa iOS — incremento M1"
Cohesion: 0.14
Nodes (11): Colors, Components, Do's and Don'ts, Elevation & Depth, Evidenza e limiti della registrazione, Interfaccia nativa iOS — incremento M1, Overview, Shapes (+3 more)

### Community 19 - "20260923160225_circles.sql"
Cohesion: 0.15
Nodes (10): circle_members_circle_status, circle_members_user_status, circle_posts_circle_created, circle_posts_post, private.admins_circle(), private.can_see_post(), private.in_circle(), public.circle_members (+2 more)

### Community 20 - "20260926140000_expressiveness.sql"
Cohesion: 0.15
Nodes (13): comments_parent, private.can_react(), private.can_share(), private.comment_reply_guard(), public.mention_preferences, public.mentions, public.reactions, public.shares (+5 more)

### Community 21 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "opencode.sn.json"
Cohesion: 0.05
Nodes (43): agents, sn_ios, sn_plan, sn_quick, reasoning_effort, thinking, commands, sn-ios (+35 more)

### Community 24 - "20260925180000_event_details_and_album.sql"
Cohesion: 0.28
Nodes (6): event_photos_event_created, private.can_read_asset(), private.circle_image_available(), private.event_photo_available(), public.claim_media_cleanup(), public.event_photos

### Community 25 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, agent-browser, @electric-sql/pglite, eslint, eslint-config-next, @playwright/test, prettier, supabase (+7 more)

### Community 26 - "20260911085314_chat_lifecycle.sql"
Cohesion: 0.21
Nodes (9): hidden_messages_message, message_states_recipient, message_states_sender, private.message_guard(), public.chat_receipt(), public.chat_settings, public.delete_chat_message(), public.hidden_messages (+1 more)

### Community 27 - "20260913171500_group_chat_foundation.sql"
Cohesion: 0.20
Nodes (8): chat_group_invites_invitee, chat_group_members_user, private.in_chat_group(), public.chat_group_invites, public.chat_group_members, public.chat_groups, public.create_chat_group(), public.remove_chat_group_member()

### Community 28 - "20260925163701_simple_events.sql"
Cohesion: 0.21
Nodes (9): event_responses_user, event_updates_event_created, events_circle_start, events_start, private.can_see_event(), public.create_event(), public.event_responses, public.event_updates (+1 more)

### Community 29 - "Data"
Cohesion: 0.18
Nodes (16): Crypto, CryptoKit, ChatClearMessage, ChatContext, ChatCrypto, ChatDevice, ChatLocalDevice, ChatMedia (+8 more)

### Community 30 - "MockAPI"
Cohesion: 0.13
Nodes (3): FeedPage, UploadedMedia, MockAPI

### Community 31 - "20260913180500_encrypted_group_messages.sql"
Cohesion: 0.23
Nodes (8): chat_group_messages_group, chat_group_receipts_user, private.group_message_guard(), private.shares_chat_group(), public.chat_group_message_receipts, public.chat_group_messages, sn_group_message_guard, sn_group_message_receipts

### Community 33 - "public.refresh_product_metrics"
Cohesion: 0.17
Nodes (3): public.explore_preferences, public.product_metrics_daily, public.refresh_product_metrics()

### Community 34 - "20260909201015_encrypted_chat.sql"
Cohesion: 0.21
Nodes (5): chat_devices_user, private.device_guard(), private.message_guard(), public.chat_devices, sn_device_guard

### Community 35 - "ap/[...path]/route.ts"
Cohesion: 0.06
Nodes (81): activityUrlValue, audienceValue, Context, dynamic, embeddedActivity, GET(), inboundActivity, POST() (+73 more)

### Community 36 - "20260909200015_ephemeral_chat.sql"
Cohesion: 0.31
Nodes (6): messages_expiry, private.can_read_asset(), private.message_guard(), public.claim_media_cleanup(), sn_message_guard, sn_post_exclusive_media

### Community 37 - "private.circle_image_available"
Cohesion: 0.33
Nodes (3): private.circle_image_available(), public.claim_media_cleanup(), public.create_circle()

### Community 38 - "primitives.tsx"
Cohesion: 0.10
Nodes (34): CircleMark(), CirclePanel(), Props, Props, NotesReview(), PostNotes(), ReviewNote(), sourceHost() (+26 more)

### Community 39 - "Parte A — Supabase"
Cohesion: 0.06
Nodes (30): A10. Advisor, A11. Collaudo cloud, A12. Manutenzione e backup, A1. Progetto dedicato, A2. Chiavi API, A3. Reference e connessione, A4. Applicare le migrazioni, A5. URL di autenticazione (+22 more)

### Community 40 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, @fontsource-variable/ibm-plex-sans, lucide-react, next, react, react-dom, server-only, @supabase/ssr (+2 more)

### Community 41 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, backup, build, check, dev, lint, start, test (+2 more)

### Community 42 - "20260912155500_polls.sql"
Cohesion: 0.40
Nodes (6): poll_options_order, poll_votes_option, public.create_poll(), public.poll_options, public.poll_votes, public.polls

### Community 43 - "20260919135717_federation_withdrawal_queue.sql"
Cohesion: 0.33
Nodes (5): private.federation_withdrawals, private.queue_federation_withdrawal(), private.revoke_federation_profile(), sn_queue_federation_withdrawal, sn_revoke_federation_profile

### Community 44 - "20260921124522_federation_remote_objects.sql"
Cohesion: 0.31
Nodes (5): federation_inbox_remote_rate_idx, federation_remote_actor_keys_expiry_idx, federation_remote_objects_local_received_idx, public.federation_remote_actor_keys, public.federation_remote_objects

### Community 45 - "20260920101500_federation_reactions.sql"
Cohesion: 0.29
Nodes (3): public.federation_rejections, public.federation_remote_likes, public.receive_federated_activity()

### Community 46 - "20260926120000_user_digest.sql"
Cohesion: 0.39
Nodes (5): digest_deliveries_user_created, digest_sources_user, public.digest_deliveries, public.digest_preferences, public.digest_sources

### Community 47 - "20261001120000_reliable_shares_and_notifications.sql"
Cohesion: 0.29
Nodes (3): notifications_unique_connection, private.notify(), public.signup_invite_status()

### Community 48 - "20260914172524_group_message_notifications.sql"
Cohesion: 0.33
Nodes (3): notifications_group, private.notify_group_message(), sn_notify_group_message

### Community 49 - "public.bookmarks"
Cohesion: 0.43
Nodes (4): bookmarks_post, bookmarks_saved_order, public.bookmarks, sn_bookmark_limit

### Community 54 - "public.story_views"
Cohesion: 0.47
Nodes (3): public.story_views, story_views_story_time, story_views_viewer_time

### Community 59 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): printWidth, singleQuote, trailingComma

### Community 91 - "SN — manuale operativo del progetto"
Cohesion: 0.05
Nodes (43): 10. Regole pratiche per chi interviene, 11. Riferimenti di progetto, 12. Audit di sicurezza del 19 ottobre 2026, 13. Client iOS M1 — 23 ottobre 2026, 1. In breve, 2. Avvio rapido e orientamento, 3. Mappa del repository, 4. Architettura e flussi (+35 more)

### Community 92 - "iOS M0.5 — prova di compatibilità crittografica"
Cohesion: 0.25
Nodes (6): iOS M0.5 — prova di compatibilità crittografica, Prova su iPhone, Stato al 15 ottobre 2026, Struttura, Verifica locale ripetibile, CryptoProbeDiagnostics

### Community 93 - "Risultati delle verifiche"
Cohesion: 0.07
Nodes (29): 10 settembre 2026 — salvati e avvisi, 11 settembre 2026 — backup e ripristino, 11 settembre 2026 — ciclo di vita della chat, 11 settembre 2026 — recupero account, 11 settembre 2026 — registro di moderazione, 11 settembre 2026 — ricerca full-text, 15 ottobre 2026 — allineamento documentazione e OpenCode, 15 ottobre 2026 — avvisi SECURITY DEFINER e bypass MFA (+21 more)

### Community 94 - "Control"
Cohesion: 0.16
Nodes (4): Control, .malformedResponse, .requests, .validRequests

### Community 95 - "SN — Product"
Cohesion: 0.12
Nodes (15): Brand Commitments, Capabilities and Constraints, Decisioni aperte sulla chat, Evidence on Hand, Experience Requirements, Open Decisions, Operating Context, Platform (+7 more)

### Community 96 - "AuthCoordinator"
Cohesion: 0.09
Nodes (7): AuthCoordinator, .cachedMe, FeedView, .body, .body, SessionView, .body

### Community 97 - "security-settings.tsx"
Cohesion: 0.27
Nodes (8): AccountSession, Enrollment, Factor, mfaRequest(), MfaState, SecuritySettings(), sessionDate(), sessionsRequest()

### Community 99 - "Architettura e lavoro ancora necessario"
Cohesion: 0.29
Nodes (6): App nativa: adapter bearer (M0, lato server), Architettura e lavoro ancora necessario, Client iOS e prova crittografica (15 ottobre 2026), Confini, Funzioni future e limiti attuali, Sicurezza e confini dei test

### Community 100 - "Decisioni del 9 settembre 2026"
Cohesion: 0.20
Nodes (9): 15 ottobre 2026 — stato nativo e moderazione, Aggiornamento del 10 settembre 2026, Aggiornamento del 24 settembre 2026 — sezioni 5–9, Aggiornamento dell’11 settembre 2026 — requisiti chat, Chat effimera e allegati, Decisioni del 9 settembre 2026, Gestione degli account, Note della comunità (+1 more)

### Community 101 - "Funzioni sociali successive al collaudo cloud"
Cohesion: 0.29
Nodes (7): 4. Cerchie e spazi condivisi, 5. Eventi semplici, 6. Digest scelto dall'utente — implementato in locale, 7. Post collaborativi e album condivisi — implementati in locale, 8. Conversazioni più espressive — implementate in locale, 9. Scoperta intenzionale e salute del prodotto — implementata in locale, Funzioni sociali successive al collaudo cloud

### Community 102 - "Backup e ripristino"
Cohesion: 0.40
Nodes (4): Backup e ripristino, Esecuzione, Preparazione, Prova di ripristino

### Community 103 - "PostDraft"
Cohesion: 0.25
Nodes (5): PostDraft, .canPublish, .hasChanges, .warning, PostDraftTests

### Community 104 - "Piano di continuità — profili, carousel, Home e condivisione"
Cohesion: 0.33
Nodes (5): Esito, Obiettivi, Piano di continuità — profili, carousel, Home e condivisione, Stato, Vincoli

### Community 105 - "Piano di continuità — UX mobile, navigazione e registrazione"
Cohesion: 0.33
Nodes (5): Obiettivi, Piano di continuità — UX mobile, navigazione e registrazione, Stato, Verifica conclusiva, Vincoli

### Community 107 - "FeedPost"
Cohesion: 0.16
Nodes (10): .homePosts, .regularPosts, CirclePostLink, FeedFollow, FeedMedia, FeedPost, .attachments, .date (+2 more)

### Community 108 - "Chat cifrata, protocollo v1"
Cohesion: 0.33
Nodes (6): Chat cifrata, protocollo v1, Client iOS M0.5 — 15 ottobre 2026, Conservazione, Estensione del protocollo — 11 settembre 2026, Fonti tecniche, Identità e nuovi browser

### Community 109 - "SN"
Cohesion: 0.33
Nodes (6): Client iOS, Documentazione, Produzione, Prova la demo, SN, Sviluppo

### Community 110 - "Email di autenticazione e Resend"
Cohesion: 0.50
Nodes (3): Configurazione del progetto SN su Supabase, Email di autenticazione e Resend, Mittente

### Community 113 - "SN per iOS: SwiftUI e xtool"
Cohesion: 0.11
Nodes (19): Adapter M1 e prossimo passo, Ambiente e struttura, Automazione del 26 ottobre 2026, Build e dispositivo, Collaudo automatizzato M1 — 24 ottobre 2026, passaggio finale, Consolidamento del 27 ottobre 2026, Consolidamento M1 del 24 ottobre — incrementi successivi, Consolidamento sessione e feed — 23 ottobre 2026 (+11 more)

### Community 115 - "AGENTS.md"
Cohesion: 0.40
Nodes (4): graphify, iOS su Linux, Project Instructions, This is NOT the Next.js you know

### Community 116 - "OpenCode e DeepSeek Flash per SN"
Cohesion: 0.29
Nodes (7): Avvio, Collaudo automatizzato M1 — 24 ottobre 2026, passaggio finale, Modifiche al workflow, OpenCode e DeepSeek Flash per SN, Ragionamento e costo, Stato da cui riprendere, Verifiche e limiti

### Community 117 - "backup.mjs"
Cohesion: 0.13
Nodes (15): @electric-sql/pglite, files, fromProject, outputDir, stamp, downloadStorageObjects(), listStorageObjects(), safeStoragePath() (+7 more)

### Community 118 - "Foundation"
Cohesion: 0.13
Nodes (5): Combine, Foundation, FoundationNetworking, InteropFixtures, APIErrorBody

### Community 120 - "Sviluppo iOS di SN"
Cohesion: 0.50
Nodes (3): Metodo, Stato e incremento successivo, Sviluppo iOS di SN

### Community 121 - "State"
Cohesion: 0.40
Nodes (5): State, loading, mfaRequired, signedIn, signedOut

### Community 129 - "APIError"
Cohesion: 0.14
Nodes (12): ErrorMessages, .language, APIError, .code, invalidResponse, .isConnectivityFailure, .isDefinitiveSessionFailure, .isUnauthorized (+4 more)

### Community 130 - "APIClient"
Cohesion: 0.22
Nodes (3): APIClient, .decoder, .encoder

### Community 131 - "TokenPair"
Cohesion: 0.10
Nodes (8): KeychainTokenStore, .baseQuery, TokenStore, FixtureStore, M1HTTPFixture, TokenPair, .expiryDate, M1HTTPTests

### Community 133 - "database"
Cohesion: 0.43
Nodes (5): metadata, PasswordPage(), GET(), UpdatePassword(), database()

### Community 134 - "prepare-ios-dev.py"
Cohesion: 0.05
Nodes (19): run(), run(), capture(), check(), more(), page(), snapshot(), tap() (+11 more)

### Community 136 - "digest-panel.tsx"
Cohesion: 0.25
Nodes (6): channelLabels, DigestPanel(), frequencyLabels, Props, reasonFor(), DigestItem

### Community 137 - ".normalized"
Cohesion: 0.60
Nodes (3): MfaCode, MfaView, .body

### Community 139 - "Decodable"
Cohesion: 0.16
Nodes (8): ChatInteropProbe, Failure, check, Fixture, Reply, Report, Vector, ChatCryptoTests

### Community 140 - "FeedView.swift"
Cohesion: 0.20
Nodes (7): ImageIO, M1DeviceChecks, PhotoPreparation, .body, PrivatePostImage, .body, UIKit

### Community 141 - "4. Specifica M0"
Cohesion: 0.18
Nodes (11): 4.10 Modelli M0 (R5), 4.11 Matrice di uscita (per endpoint), 4.1 Obiettivo e perimetro, 4.2 Superficie API (contratto), 4.3 Metodo auth nativo (F1), 4.4 Sicurezza, 4.5 Ciclo di vita dei token (R3, R6), 4.6 Logout e revoca (F2, F4) (+3 more)

### Community 142 - "SN — lavoro confermato"
Cohesion: 0.20
Nodes (9): Federazione: trasporto locale in anteprima, Implementato localmente: conservazione e stati della chat, Prima dell’apertura federata, Prossimi passi, in ordine, SN — lavoro confermato, Verifica e pubblicazione, Follow, Requested Capabilities and Sequencing (+1 more)

### Community 143 - "View"
Cohesion: 0.24
Nodes (7): Layout, .body, PostRow, LoginView, .body, RootView, .authenticationContent

### Community 144 - "Verifiche"
Cohesion: 0.50
Nodes (4): Client iOS, Da eseguire sul progetto Supabase dedicato, Eseguibili in locale, Verifiche

### Community 145 - "CodingKeys"
Cohesion: 0.12
Nodes (15): CodingKeys, body, expires_at, id, media, recipient_id, retention, revision (+7 more)

### Community 146 - "Collaudo M1 su iPhone — 24 ottobre 2026"
Cohesion: 0.33
Nodes (6): Automazione ripetibile, Collaudo M1 su iPhone — 24 ottobre 2026, Difetto riprodotto e corretto, Limiti ancora aperti, Perimetro ed evidenze, Ripresa automatizzata del 26 ottobre

### Community 147 - "ChatCryptoTests.swift"
Cohesion: 0.32
Nodes (3): SN, SNChatCrypto, XCTest

### Community 148 - "vitest"
Cohesion: 0.27
Nodes (5): BodyTooLarge, readLimited(), vitest, fixture, upload()

### Community 151 - "TokenStoreError"
Cohesion: 0.40
Nodes (3): TokenStoreError, keychain, Security

### Community 152 - "ChatCryptoError"
Cohesion: 0.40
Nodes (5): ChatCryptoError, expired, invalidAttachment, invalidPacket, missingKey

### Community 154 - "Language"
Cohesion: 0.50
Nodes (3): Language, en, it

## Knowledge Gaps
- **83 isolated node(s):** `.fixtureStateLabel`, `Combine`, `loading`, `signedOut`, `mfaRequired` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 818 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **67 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4.12 Ordine di esecuzione` connect `ApiError` to `AuthCoordinator`, `api/[...path]/route.ts`, `APIClient`, `TokenPair`, `4. Specifica M0`?**
  _High betweenness centrality (0.192) - this node is a cross-community bridge._
- **Are the 47 inferred relationships involving `AuthCoordinator` (e.g. with `4.12 Ordine di esecuzione` and `4.6 Logout e revoca (F2, F4)`) actually correct?**
  _`AuthCoordinator` has 47 INFERRED edges - model-reasoned connections that need verification._
- **What connects `.fixtureStateLabel`, `Combine`, `loading` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `chat-conversation.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1353658536585366 - nodes in this community are weakly interconnected._
- **Why does `AuthCoordinator` connect `AuthCoordinator` to `MemoryTokenStore`, `State`, `ApiError`, `TokenPair`, `CodingKeys`, `.logout`, `.normalized`, `ComposePostView`, `FeedPost`, `FeedView.swift`, `4. Specifica M0`, `View`, `Interfaccia nativa iOS — incremento M1`, `.loadProfile`, `Foundation`, `4.9 Modifiche iOS`, `MockAPI`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **Are the 39 inferred relationships involving `MockAPI` (e.g. with `.testAmbiguousPublicationIsNotAutomaticallyRetried()` and `.testCachedImageDoesNotPretendConnectionRecovered()`) actually correct?**
  _`MockAPI` has 39 INFERRED edges - model-reasoned connections that need verification._
- **Should `api/[...path]/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12624584717607973 - nodes in this community are weakly interconnected._
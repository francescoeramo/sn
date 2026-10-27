# Graph Report - sn  (2026-10-27)

## Corpus Check
- 220 files · ~171,326 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .resolved 2, .example 1)

## Summary
- 2126 nodes · 4723 edges · 159 communities (95 shown, 64 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 526 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `05a13ce6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- APIClient
- api/[...path]/route.ts
- rules.ts
- ErrorMessages
- 20260909094232_initial_social.sql
- types.ts
- CodingKeys
- primitives.tsx
- crypto/chat.ts
- SN — Piano app nativa iOS (SwiftUI)
- Funzionalità del Sistema
- 20260926130000_collaborative_posts.sql
- events-panel.tsx
- language-provider.tsx
- 20261015170711_timed_account_bans.sql
- social-app.tsx
- package.json
- iOS M0.5 — prova di compatibilità crittografica
- .restore
- 20260923160225_circles.sql
- 20260926140000_expressiveness.sql
- compilerOptions
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
- M1HTTPTests.swift
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
- MemoryTokenStore
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
- prepare-ios-dev.py
- 20261019134743_close_metadata_assurance_gaps.sql
- 20261019134742_separate_account_deletion_intent.sql
- SECURITY-AUDIT-2026-10-19.md
- Decodable
- APIError
- chat-conversation.tsx
- CodingKeys
- DevelopmentNetworkTests
- check-ios-m1.py
- check-ios-m1-device.py
- check-ios-session.sh
- APIClientProtocol
- run
- ComposePostView
- M1RunnerTests
- Consolidamento del 27 ottobre 2026
- SN — lavoro confermato
- SNApp
- Verifiche
- FeedView.swift
- 13. Client iOS M1 — 23 ottobre 2026
- Interfaccia nativa iOS — incremento M1
- Error
- AuthCoordinatorTests
- .loadProfile
- 4. Architettura e flussi
- digest-panel.tsx
- 9. Roadmap approvata e ordine di esecuzione
- State
- 6. Sicurezza, privacy e responsabilità
- 7. Configurazione e operatività
- Collaudo M1 su iPhone — 24 ottobre 2026

## God Nodes (most connected - your core abstractions)
1. `AuthCoordinator` - 111 edges
2. `MockAPI` - 102 edges
3. `MemoryTokenStore` - 54 edges
4. `AuthCoordinatorTests` - 50 edges
5. `ApiError` - 46 edges
6. `SocialApp()` - 43 edges
7. `TokenPair` - 40 edges
8. `checked()` - 32 edges
9. `POST()` - 31 edges
10. `APIError` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Modifiche al workflow` --references--> `body()`  [INFERRED]
  docs/OPENCODE.md → app/api/[...path]/route.ts
- `4.8 Modifiche server` --references--> `sameOrigin()`  [INFERRED]
  docs/PIANO-APP-NATIVA.md → app/api/[...path]/route.ts
- `Interfaccia e dati` --references--> `SocialApp()`  [INFERRED]
  docs/MANUALE-PROGETTO.md → components/social-app.tsx
- `4.6 Logout e revoca (F2, F4)` --references--> `AuthCoordinator`  [INFERRED]
  docs/PIANO-APP-NATIVA.md → ios/SN/Auth/AuthCoordinator.swift
- `4.10 Modelli M0 (R5)` --references--> `LoginRequest`  [INFERRED]
  docs/PIANO-APP-NATIVA.md → ios/SN/Models/Session.swift

## Import Cycles
- None detected.

## Communities (159 total, 64 thin omitted)

### Community 0 - "APIClient"
Cohesion: 0.21
Nodes (3): APIClient, .decoder, .encoder

### Community 1 - "api/[...path]/route.ts"
Cohesion: 0.07
Nodes (76): metadata, PasswordPage(), body(), Context, dynamic, enforceAuthRate(), errorResponse(), GET() (+68 more)

### Community 2 - "rules.ts"
Cohesion: 0.05
Nodes (82): clearChatStore(), ago(), applyDemo(), buildDemoDigest(), clearDemo(), demoDigestPeriod(), expireDemoBans(), initializeChat() (+74 more)

### Community 3 - "ErrorMessages"
Cohesion: 0.25
Nodes (5): ErrorMessages, .language, Language, en, it

### Community 4 - "20260909094232_initial_social.sql"
Cohesion: 0.06
Nodes (60): blocks_target, comments_author, comments_post, federation_due, follows_target, likes_post, media_owner, messages_recipient (+52 more)

### Community 5 - "types.ts"
Cohesion: 0.05
Nodes (42): AlbumItem, Bookmark, ChatGroup, ChatGroupInvite, ChatGroupMember, ChatGroupMessage, ChatGroupMessagesState, ChatGroupReceipt (+34 more)

### Community 6 - "CodingKeys"
Cohesion: 0.09
Nodes (28): FeedProfile, Bootstrap, CodingKeys, accessToken, circlePosts, code, displayName, expiresAt (+20 more)

### Community 7 - "primitives.tsx"
Cohesion: 0.10
Nodes (29): Props, NotesReview(), PostNotes(), ReviewNote(), sourceHost(), Sources(), Composer(), PostCard() (+21 more)

### Community 8 - "crypto/chat.ts"
Cohesion: 0.09
Nodes (47): GroupChatConversation(), groupRequest(), OpenGroupMessage, openMessages(), chatRequest(), prepareSession(), readConversation(), activeMessages() (+39 more)

### Community 9 - "SN — Piano app nativa iOS (SwiftUI)"
Cohesion: 0.07
Nodes (27): 10. Recupero connessione M1 — 23 ottobre 2026, 11. Composer con avvisi — 24 ottobre 2026, 12. Consolidamento M1 — 24 ottobre 2026, 13. Archivio del proprio profilo — 24 ottobre 2026, 1. Direzione e vincoli, 2. Sequenza delle tappe, 3. Regole vincolanti, 4.10 Modelli M0 (R5) (+19 more)

### Community 10 - "Funzionalità del Sistema"
Cohesion: 0.08
Nodes (23): 10. Messaggistica diretta: conservazione, Chat temporanea e stati, 1. Feed e Profili, 2. Storie con Autoplay e Player Avanzato, 3. Reels / Video Brevi, 4. Cerchie e spazi condivisi, 5. Eventi semplici, 6. Digest scelto dall’utente, 7. Post collaborativi e album condivisi (+15 more)

### Community 11 - "20260926130000_collaborative_posts.sql"
Cohesion: 0.18
Nodes (12): album_items_post_created, collaborators_user, private.album_item_available(), private.can_read_asset(), private.circle_image_available(), private.event_photo_available(), public.album_items, public.claim_media_cleanup() (+4 more)

### Community 12 - "events-panel.tsx"
Cohesion: 0.10
Nodes (29): CircleMark(), CirclePanel(), createCircle(), updateCircle(), uploadCircleImage(), CollaborationPanel(), addItem(), Props (+21 more)

### Community 13 - "language-provider.tsx"
Cohesion: 0.13
Nodes (22): metadata, RootLayout(), LanguageContext, LanguageProvider(), originalAttributes, originalText, renderedAttributes, renderedText (+14 more)

### Community 14 - "20261015170711_timed_account_bans.sql"
Cohesion: 0.14
Nodes (6): private.can_message(), private.can_see_author(), private.member(), public.moderation_accounts(), public.profile_connections(), public.receive_federated_activity()

### Community 15 - "social-app.tsx"
Cohesion: 0.09
Nodes (31): Demo(), Home(), AuthScreen(), LoadingShell(), auditLabels, auditTargetLabels, ChatConversation, CirclePanel (+23 more)

### Community 16 - "package.json"
Cohesion: 0.10
Nodes (19): author, description, keywords, license, name, private, type, version (+11 more)

### Community 17 - "iOS M0.5 — prova di compatibilità crittografica"
Cohesion: 0.29
Nodes (6): iOS M0.5 — prova di compatibilità crittografica, Prova su iPhone, Stato al 15 ottobre 2026, Struttura, Verifica locale ripetibile, CryptoProbeDiagnostics

### Community 18 - ".restore"
Cohesion: 0.13
Nodes (5): 4.9 Modifiche iOS, KeychainTokenStore, .baseQuery, TokenStore, .body

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
Cohesion: 0.17
Nodes (14): Crypto, CryptoKit, ChatClearMessage, ChatContext, ChatCrypto, ChatDevice, ChatLocalDevice, ChatMedia (+6 more)

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
Cohesion: 0.18
Nodes (11): 10. Regole pratiche per chi interviene, 11. Riferimenti di progetto, 12. Audit di sicurezza del 19 ottobre 2026, 1. In breve, 2. Avvio rapido e orientamento, 3. Mappa del repository, 5. Funzionalità: stato reale, 8. Test e livello di evidenza (+3 more)

### Community 92 - "MemoryTokenStore"
Cohesion: 0.13
Nodes (6): FixtureStore, M1HTTPFixture, TokenPair, .expiryDate, M1HTTPTests, MemoryTokenStore

### Community 93 - "Risultati delle verifiche"
Cohesion: 0.07
Nodes (29): 10 settembre 2026 — salvati e avvisi, 11 settembre 2026 — backup e ripristino, 11 settembre 2026 — ciclo di vita della chat, 11 settembre 2026 — recupero account, 11 settembre 2026 — registro di moderazione, 11 settembre 2026 — ricerca full-text, 15 ottobre 2026 — allineamento documentazione e OpenCode, 15 ottobre 2026 — avvisi SECURITY DEFINER e bypass MFA (+21 more)

### Community 94 - "Control"
Cohesion: 0.15
Nodes (4): Control, .malformedResponse, .requests, .validRequests

### Community 95 - "SN — Product"
Cohesion: 0.12
Nodes (15): Brand Commitments, Capabilities and Constraints, Decisioni aperte sulla chat, Evidence on Hand, Experience Requirements, Open Decisions, Operating Context, Platform (+7 more)

### Community 96 - "AuthCoordinator"
Cohesion: 0.09
Nodes (11): AuthCoordinator, .cachedMe, MfaCode, FeedView, .body, MfaView, .body, SessionStorageNotice (+3 more)

### Community 97 - "security-settings.tsx"
Cohesion: 0.27
Nodes (8): AccountSession, Enrollment, Factor, mfaRequest(), MfaState, SecuritySettings(), sessionDate(), sessionsRequest()

### Community 99 - "Architettura e lavoro ancora necessario"
Cohesion: 0.25
Nodes (7): App nativa: adapter bearer (M0, lato server), Architettura e lavoro ancora necessario, Bootstrap M1 nativo — 27 ottobre 2026, Client iOS e prova crittografica (15 ottobre 2026), Confini, Funzioni future e limiti attuali, Sicurezza e confini dei test

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
Cohesion: 0.11
Nodes (17): .homePosts, .regularPosts, CirclePostLink, CodingKeys, alt, body, content_warning, kind (+9 more)

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
Cohesion: 0.08
Nodes (26): Adapter M1 e prossimo passo, Ambiente e struttura, Arresto completo delle verifiche scadute, Automazione del 26 ottobre 2026, Bootstrap nativo limitato a M1, Build e dispositivo, Collaudo automatizzato M1 — 24 ottobre 2026, passaggio finale, Consolidamento del 27 ottobre 2026 (+18 more)

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
Cohesion: 0.10
Nodes (7): Combine, Foundation, FoundationNetworking, InteropFixtures, AppConfig, APIErrorBody, SNChatCrypto

### Community 120 - "Sviluppo iOS di SN"
Cohesion: 0.50
Nodes (3): Metodo, Stato e incremento successivo, Sviluppo iOS di SN

### Community 121 - "prepare-ios-dev.py"
Cohesion: 0.20
Nodes (6): backend_ready(), command(), main(), NoRedirect, select_host(), update_config()

### Community 128 - "Decodable"
Cohesion: 0.26
Nodes (8): ChatInteropProbe, Failure, check, Fixture, Reply, Report, Vector, ChatCryptoTests

### Community 129 - "APIError"
Cohesion: 0.17
Nodes (10): APIError, .code, invalidResponse, .isConnectivityFailure, .isDefinitiveSessionFailure, .isUnauthorized, .mayHaveCommitted, server (+2 more)

### Community 130 - "chat-conversation.tsx"
Cohesion: 0.26
Nodes (10): ChatConversation(), settingsChange(), ACTION_FAILURE, actionErrorMessage(), chatAction(), syncConversation(), DecryptedMessage, EPHEMERAL_OPTIONS (+2 more)

### Community 131 - "CodingKeys"
Cohesion: 0.22
Nodes (9): CodingKeys, body, expires_at, id, media, recipient_id, retention, revision (+1 more)

### Community 133 - "check-ios-m1.py"
Cohesion: 0.22
Nodes (4): execute(), main(), run(), save()

### Community 137 - "run"
Cohesion: 0.62
Nodes (7): run(), capture(), check(), more(), page(), snapshot(), tap()

### Community 138 - "ComposePostView"
Cohesion: 0.22
Nodes (3): ComposePostView, .body, PhotosUI

### Community 140 - "Consolidamento del 27 ottobre 2026"
Cohesion: 0.18
Nodes (11): Arresto completo delle verifiche scadute, Bootstrap nativo limitato a M1, Consolidamento del 27 ottobre 2026, Errori di salvataggio sessione visibili e recuperabili, MFA: uscita, incolla e collaudo UI senza dati personali, Nuovo accesso durante una lettura precedente, Preparazione foto fuori dall’interfaccia, Pubblicazione e aggiornamento feed concorrenti (+3 more)

### Community 141 - "SN — lavoro confermato"
Cohesion: 0.20
Nodes (9): Federazione: trasporto locale in anteprima, Implementato localmente: conservazione e stati della chat, Prima dell’apertura federata, Prossimi passi, in ordine, SN — lavoro confermato, Verifica e pubblicazione, Follow, Requested Capabilities and Sequencing (+1 more)

### Community 143 - "SNApp"
Cohesion: 0.13
Nodes (9): Colors, SNApp, .body, .fixtureStateLabel, LoginView, .body, RootView, .authenticationContent (+1 more)

### Community 144 - "Verifiche"
Cohesion: 0.50
Nodes (4): Client iOS, Da eseguire sul progetto Supabase dedicato, Eseguibili in locale, Verifiche

### Community 145 - "FeedView.swift"
Cohesion: 0.17
Nodes (9): Layout, ImageIO, M1DeviceChecks, PhotoPreparation, PostRow, .body, PrivatePostImage, .body (+1 more)

### Community 146 - "13. Client iOS M1 — 23 ottobre 2026"
Cohesion: 0.29
Nodes (7): 13. Client iOS M1 — 23 ottobre 2026, Consolidamento iOS — 23 ottobre 2026, Consolidamento M1, incremento 1 — 24 ottobre 2026, Consolidamento M1, incremento 2 — 24 ottobre 2026, Consolidamento M1, incremento 3 — 24 ottobre 2026, Recupero connessione iOS — 23 ottobre 2026, Ripresa iOS — 24 ottobre 2026

### Community 147 - "Interfaccia nativa iOS — incremento M1"
Cohesion: 0.25
Nodes (8): Components, Do's and Don'ts, Elevation & Depth, Evidenza e limiti della registrazione, Interfaccia nativa iOS — incremento M1, Overview, Shapes, Typography

### Community 148 - "Error"
Cohesion: 0.13
Nodes (12): ChatCryptoError, expired, invalidAttachment, invalidPacket, missingKey, TokenStoreError, keychain, StoreError (+4 more)

### Community 151 - "4. Architettura e flussi"
Cohesion: 0.29
Nodes (7): 4. Architettura e flussi, API principali, Ban degli account (15 ottobre 2026), Database e migrazioni, Interfaccia e dati, Server e autenticazione, Verifica avvisi Supabase e MFA database (15 ottobre 2026)

### Community 152 - "digest-panel.tsx"
Cohesion: 0.25
Nodes (6): channelLabels, DigestPanel(), frequencyLabels, Props, reasonFor(), DigestItem

### Community 153 - "9. Roadmap approvata e ordine di esecuzione"
Cohesion: 0.29
Nodes (7): 9. Roadmap approvata e ordine di esecuzione, A. Cerchie completate in locale, Ambiente iOS attuale (15 ottobre 2026), B. Allineare e collaudare il cloud dedicato, C. Rendere operativa la manutenzione, D. Validare la federazione prima di attivarla, E. Decisioni per l’apertura

### Community 154 - "State"
Cohesion: 0.40
Nodes (5): State, loading, mfaRequired, signedIn, signedOut

### Community 155 - "6. Sicurezza, privacy e responsabilità"
Cohesion: 0.50
Nodes (4): 6. Sicurezza, privacy e responsabilità, Federazione: limiti e posture, Garanzie implementate e confini, Gestione incidente

### Community 156 - "7. Configurazione e operatività"
Cohesion: 0.67
Nodes (3): 7. Configurazione e operatività, Collegamento e stato cloud, Manutenzione, backup e deploy

### Community 158 - "Collaudo M1 su iPhone — 24 ottobre 2026"
Cohesion: 0.33
Nodes (6): Automazione ripetibile, Collaudo M1 su iPhone — 24 ottobre 2026, Difetto riprodotto e corretto, Limiti ancora aperti, Perimetro ed evidenze, Ripresa automatizzata del 26 ottobre

## Knowledge Gaps
- **85 isolated node(s):** `CryptoKit`, `Crypto`, `invalidPacket`, `missingKey`, `expired` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 831 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **64 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `4.12 Ordine di esecuzione` connect `api/[...path]/route.ts` to `AuthCoordinator`, `APIClient`, `.restore`, `SN — Piano app nativa iOS (SwiftUI)`?**
  _High betweenness centrality (0.199) - this node is a cross-community bridge._
- **Are the 52 inferred relationships involving `AuthCoordinator` (e.g. with `4.12 Ordine di esecuzione` and `4.6 Logout e revoca (F2, F4)`) actually correct?**
  _`AuthCoordinator` has 52 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CryptoKit`, `Crypto`, `invalidPacket` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api/[...path]/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06600877192982456 - nodes in this community are weakly interconnected._
- **Why does `AuthCoordinator` connect `AuthCoordinator` to `api/[...path]/route.ts`, `CodingKeys`, `APIClientProtocol`, `SN — Piano app nativa iOS (SwiftUI)`, `ComposePostView`, `FeedPost`, `.setRefreshResult`, `SNApp`, `FeedView.swift`, `.restore`, `AuthCoordinatorTests`, `Foundation`, `.loadProfile`, `State`, `MemoryTokenStore`, `Data`, `MockAPI`?**
  _High betweenness centrality (0.197) - this node is a cross-community bridge._
- **Are the 44 inferred relationships involving `MockAPI` (e.g. with `.testAmbiguousPublicationIsNotAutomaticallyRetried()` and `.testCachedImageDoesNotPretendConnectionRecovered()`) actually correct?**
  _`MockAPI` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Should `rules.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05459770114942529 - nodes in this community are weakly interconnected._
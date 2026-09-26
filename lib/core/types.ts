import type { GroupSealed, Sealed } from '@/lib/crypto/chat';
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  is_private: boolean;
  federation_enabled: boolean;
  color: string;
  created_at: string;
  onboarded_at?: string | null;
};
export type Post = {
  content_warning?: string;
  notes?: CommunityNote[];
  poll?: Poll | null;
  id: string;
  author_id: string;
  body: string;
  kind: 'post' | 'story' | 'reel';
  media_path: string | null;
  media_type: string | null;
  alt: string;
  created_at: string;
  expires_at: string | null;
};
export type RemotePost = {
  id: string;
  actor: string;
  username: string;
  display_name: string;
  host: string;
  body: string;
  content_warning: string;
  created_at: string;
  updated_at: string | null;
};
export type RemoteReport = {
  id: string;
  reporter_id: string;
  object_id: string;
  remote_actor: string;
  reason: string;
  status: 'open' | 'dismissed' | 'hidden';
  created_at: string;
};
export type PollOption = { id: string; poll_id: string; position: number; body: string };
export type Poll = { post_id: string; closes_at: string | null; options: PollOption[] };
export type PollResult = { poll_id: string; option_id: string; votes: number; selected: boolean };
export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  parent_id?: string | null;
  quote?: string;
};
export type Reaction = {
  id: string;
  user_id: string;
  target_type: 'post' | 'comment' | 'message';
  target_id: string;
  emoji: string;
  created_at: string;
};
export type MentionPreference = {
  user_id: string;
  mentions_enabled: boolean;
  updated_at: string;
};
export type Mention = {
  id: string;
  author_id: string;
  mentioned_id: string;
  source_type: 'post' | 'comment';
  source_id: string;
  post_id: string;
  created_at: string;
};
export type Share = {
  id: string;
  user_id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  destination_type: 'chat' | 'circle';
  destination_id: string;
  note: string;
  created_at: string;
};
export type ExplorePreference = {
  user_id: string;
  section: 'contacts' | 'hashtags' | 'people';
  hidden: boolean;
  updated_at: string;
};
export type ProductMetric = {
  day: string;
  metric: string;
  bucket: string;
  count: number;
  computed_at: string;
};
export type Follow = { follower_id: string; following_id: string; accepted: boolean };
export type Message = {
  encrypted?: Sealed | null;
  local_media?: string | null;
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  media_path: string | null;
  media_type: string | null;
  created_at: string;
  expires_at: string | null;
};
export type Notice = {
  id: string;
  user_id: string;
  actor_id: string;
  kind: string;
  post_id: string | null;
  event_id?: string | null;
  group_id?: string | null;
  read: boolean;
  created_at: string;
};
export type Report = {
  id: string;
  reporter_id: string;
  post_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};
export type ModerationAudit = {
  id: string;
  moderator_id: string | null;
  action:
    | 'report_dismissed'
    | 'post_removed'
    | 'note_approved'
    | 'note_rejected'
    | 'account_suspended'
    | 'account_restored'
    | 'remote_report_dismissed'
    | 'remote_object_hidden'
    | 'instance_blocked'
    | 'instance_unblocked';
  target_type: 'report' | 'post' | 'community_note' | 'account' | 'remote_report' | 'instance';
  target_id: string;
  reason: string;
  created_at: string;
};
export type ModerationAccount = {
  id: string;
  username: string;
  display_name: string;
  disabled: boolean;
  is_admin: boolean;
  created_at: string;
};
export type FederationBlock = {
  hostname: string;
  reason: string;
  blocked_by: string | null;
  created_at: string;
};
export type CommunityNote = {
  post?: { body: string } | null;
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  sources: string[];
  status: 'pending' | 'approved' | 'rejected';
  review_reason: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};
export type Bookmark = { user_id: string; post_id: string; created_at: string };
export type SavedCursor = { created_at: string; post_id: string };
export type SavedPage = { posts: Post[]; nextCursor: SavedCursor | null };
export type Circle = {
  id: string;
  name: string;
  description: string;
  image_path: string | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
export type CircleMember = {
  circle_id: string;
  user_id: string;
  role: 'admin' | 'member';
  invited_by: string | null;
  status: 'invited' | 'active';
  joined_at: string | null;
  created_at: string;
};
export type CirclePost = {
  circle_id: string;
  post_id: string;
  added_by: string;
  created_at: string;
};
export type Event = {
  id: string;
  organizer_id: string;
  circle_id: string | null;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};
export type EventResponse = {
  event_id: string;
  user_id: string;
  response: 'going' | 'maybe' | 'declined';
  updated_at: string;
};
export type EventUpdate = {
  id: string;
  event_id: string;
  author_id: string;
  kind: 'comment' | 'update';
  body: string;
  created_at: string;
};
export type EventPhoto = {
  id: string;
  event_id: string;
  author_id: string;
  media_path: string;
  caption: string;
  created_at: string;
};
export type CollaborativePost = {
  post_id: string;
  owner_id: string;
  album_closed_at: string | null;
  created_at: string;
};
export type Collaborator = {
  post_id: string;
  user_id: string;
  invited_by: string | null;
  status: 'invited' | 'active';
  can_media: boolean;
  can_caption: boolean;
  can_update: boolean;
  created_at: string;
};
export type AlbumItem = {
  id: string;
  post_id: string;
  media_path: string;
  caption: string;
  added_by: string;
  created_at: string;
};
export type DigestItem = { post_id: string; reason: string; priority: number };
export type DigestPreferences = {
  user_id: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  time_slot: number;
  timezone: 'Europe/Rome' | 'UTC';
  channel: 'in_app' | 'email';
  email_consent: boolean;
  email_consent_at: string | null;
  updated_at: string;
};
export type DigestSource = {
  user_id: string;
  source_type: 'circle' | 'person' | 'topic';
  source_id: string;
  enabled: boolean;
  created_at: string;
};
export type DigestDelivery = {
  id: string;
  user_id: string;
  period_key: string;
  items: DigestItem[];
  status: 'generated' | 'delivered' | 'failed';
  generated_at: string;
  delivered_at: string | null;
};
export type ChatSettings = {
  member_a: string;
  member_b: string;
  temporary: boolean;
  duration: number;
  changed_by: string;
};
export type MessageState = {
  id: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  expires_at: string | null;
  revision: number;
  delivered_at: string | null;
  read_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
};
export type ChatSync = {
  messages: Message[];
  states: MessageState[];
  hidden: { message_id: string }[];
  settings: ChatSettings | null;
};
export type Snapshot = {
  chatSettings?: ChatSettings[];
  messageStates?: MessageState[];
  hiddenMessages?: { user_id: string; message_id: string }[];
  bookmarks: Bookmark[];
  saved: SavedPage;
  circles?: Circle[];
  circleMembers?: CircleMember[];
  circlePosts?: CirclePost[];
  events?: Event[];
  eventResponses?: EventResponse[];
  eventUpdates?: EventUpdate[];
  eventPhotos?: EventPhoto[];
  digestPreferences?: DigestPreferences[];
  digestSources?: DigestSource[];
  digestDeliveries?: DigestDelivery[];
  collaborativePosts?: CollaborativePost[];
  collaborators?: Collaborator[];
  albumItems?: AlbumItem[];
  reactions?: Reaction[];
  mentionPreferences?: MentionPreference[];
  mentions?: Mention[];
  shares?: Share[];
  explorePreferences?: ExplorePreference[];
  productMetrics?: ProductMetric[];
  notes: CommunityNote[];
  pollResults?: PollResult[];
  me: Profile;
  profiles: Profile[];
  posts: Post[];
  remotePosts?: RemotePost[];
  comments: Comment[];
  likes: { user_id: string; post_id: string }[];
  follows: Follow[];
  messages: Message[];
  notifications: Notice[];
  reports: Report[];
  moderationAudit?: ModerationAudit[];
  moderationAccounts?: ModerationAccount[];
  remoteReports?: RemoteReport[];
  federationBlocks?: FederationBlock[];
  blocks: { blocker_id: string; blocked_id: string }[];
  usage: {
    bytes: number;
    total_bytes: number;
    members: number;
    max_members: number;
    uploads_enabled: boolean;
  };
  isAdmin: boolean;
  nextCursor: string | null;
};
export type Action =
  | { type: 'complete-onboarding' }
  | { type: 'create-circle'; name: string; description: string; image_path: string | null }
  | { type: 'invite-circle'; circle_id: string; user_id: string }
  | { type: 'respond-circle'; circle_id: string; accept: boolean }
  | {
      type: 'update-circle';
      circle_id: string;
      name: string;
      description: string;
      image_path: string | null;
    }
  | { type: 'set-circle-role'; circle_id: string; user_id: string; role: 'admin' | 'member' }
  | { type: 'remove-circle-member'; circle_id: string; user_id: string }
  | { type: 'leave-circle'; circle_id: string }
  | { type: 'archive-circle'; circle_id: string }
  | { type: 'delete-circle'; circle_id: string }
  | {
      type: 'create-event';
      circle_id: string | null;
      title: string;
      description: string;
      location: string;
      starts_at: string;
      ends_at: string | null;
      capacity: number | null;
    }
  | { type: 'respond-event'; event_id: string; response: EventResponse['response'] }
  | { type: 'cancel-event'; event_id: string }
  | {
      type: 'update-event';
      event_id: string;
      circle_id: string | null;
      title: string;
      description: string;
      location: string;
      starts_at: string;
      ends_at: string | null;
      capacity: number | null;
    }
  | { type: 'add-event-photo'; event_id: string; media_path: string; caption: string }
  | { type: 'remove-event-photo'; photo_id: string }
  | { type: 'event-update'; event_id: string; kind: EventUpdate['kind']; body: string }
  | {
      type: 'digest-preferences';
      enabled: boolean;
      frequency: DigestPreferences['frequency'];
      time_slot: number;
      timezone: DigestPreferences['timezone'];
      channel: DigestPreferences['channel'];
      email_consent: boolean;
    }
  | { type: 'digest-source'; source_type: DigestSource['source_type']; source_id: string; enabled: boolean }
  | { type: 'digest-refresh' }
  | { type: 'open-collaboration'; post_id: string }
  | { type: 'invite-collaborator'; post_id: string; user_id: string }
  | { type: 'respond-collaboration'; post_id: string; accept: boolean }
  | { type: 'remove-collaborator'; post_id: string; user_id: string }
  | {
      type: 'set-collaborator-permission';
      post_id: string;
      user_id: string;
      can_media: boolean;
      can_caption: boolean;
      can_update: boolean;
    }
  | { type: 'close-album'; post_id: string }
  | { type: 'add-album-item'; post_id: string; media_path: string; caption: string }
  | { type: 'remove-album-item'; item_id: string }
  | {
      type: 'react';
      target_type: Reaction['target_type'];
      target_id: string;
      emoji: string | null;
    }
  | { type: 'mention-preference'; enabled: boolean }
  | { type: 'explore-preference'; section: ExplorePreference['section']; hidden: boolean }
  | {
      type: 'share';
      target_type: Share['target_type'];
      target_id: string;
      destination_type: Share['destination_type'];
      destination_id: string;
      note: string;
    }
  | { type: 'chat-settings'; user_id: string; temporary: boolean; duration: number }
  | { type: 'chat-receipt'; message_id: string; revision: number; read: boolean }
  | { type: 'edit-message'; message_id: string; encrypted: Sealed; media_path: string | null }
  | { type: 'delete-message'; message_id: string; everyone: boolean }
  | { type: 'propose-note'; post_id: string; body: string; sources: string[] }
  | { type: 'review-note'; note_id: string; approve: boolean; reason: string }
  | {
      type: 'post';
      body: string;
      kind: Post['kind'];
      media_path: string | null;
      alt: string;
      content_warning?: string;
      poll?: { options: string[]; duration: number | null };
      circle_ids?: string[];
    }
  | { type: 'vote-poll'; poll_id: string; option_id: string }
  | { type: 'bookmark'; post_id: string; saved: boolean }
  | { type: 'like'; post_id: string }
  | { type: 'comment'; post_id: string; body: string; parent_id?: string | null; quote?: string }
  | { type: 'follow'; user_id: string }
  | { type: 'accept'; user_id: string; accept: boolean }
  | {
      type: 'message';
      id?: string;
      encrypted?: Sealed;
      user_id: string;
      body: string;
      media_path?: string | null;
      media_type?: string | null;
      ttl?: number;
    }
  | { type: 'profile'; display_name: string; bio: string; is_private: boolean }
  | { type: 'federation'; enabled: boolean }
  | { type: 'read-notifications' }
  | { type: 'delete-post'; post_id: string }
  | { type: 'report'; post_id: string; reason: string }
  | { type: 'report-remote'; object_id: string; reason: string }
  | { type: 'moderate'; report_id: string; remove: boolean }
  | { type: 'moderate-remote'; report_id: string; hide: boolean }
  | { type: 'moderate-instance'; hostname: string; blocked: boolean; reason: string }
  | { type: 'moderate-account'; user_id: string; disabled: boolean; reason: string }
  | { type: 'block'; user_id: string };

export type ChatGroup = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type ChatGroupMember = {
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
};
export type ChatGroupInvite = {
  group_id: string;
  invitee_id: string;
  inviter_id: string;
  created_at: string;
  expires_at: string;
};
export type ChatGroupsState = {
  groups: ChatGroup[];
  members: ChatGroupMember[];
  invites: ChatGroupInvite[];
};
export type ChatGroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  encrypted: GroupSealed;
  created_at: string;
};
export type ChatGroupReceipt = {
  message_id: string;
  user_id: string;
  delivered_at: string | null;
  read_at: string | null;
};
export type ChatGroupMessagesState = {
  messages: ChatGroupMessage[];
  receipts: ChatGroupReceipt[];
};

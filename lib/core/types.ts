import type { Sealed } from '@/lib/crypto/chat';
export type Profile = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  is_private: boolean;
  color: string;
  created_at: string;
};
export type Post = {
  content_warning?: string;
  notes?: CommunityNote[];
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
export type Comment = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
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
export type Snapshot = {
  bookmarks: Bookmark[];
  saved: SavedPage;
  notes: CommunityNote[];
  me: Profile;
  profiles: Profile[];
  posts: Post[];
  comments: Comment[];
  likes: { user_id: string; post_id: string }[];
  follows: Follow[];
  messages: Message[];
  notifications: Notice[];
  reports: Report[];
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
  | { type: 'propose-note'; post_id: string; body: string; sources: string[] }
  | { type: 'review-note'; note_id: string; approve: boolean; reason: string }
  | {
      type: 'post';
      body: string;
      kind: Post['kind'];
      media_path: string | null;
      alt: string;
      content_warning?: string;
    }
  | { type: 'bookmark'; post_id: string; saved: boolean }
  | { type: 'like'; post_id: string }
  | { type: 'comment'; post_id: string; body: string }
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
  | { type: 'read-notifications' }
  | { type: 'delete-post'; post_id: string }
  | { type: 'report'; post_id: string; reason: string }
  | { type: 'moderate'; report_id: string; remove: boolean }
  | { type: 'block'; user_id: string };

import type { Action, Snapshot, Profile } from '@/lib/core/types';
import { isActive, LIMITS, postInput } from '@/lib/core/rules';
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();
const people: [string, string, string, string][] = [
  ['fra', 'Francesco', 'Un po’ di tutto. Ci vediamo qui.', 'lilac'],
  ['giulia', 'Giulia Rossi', 'Musica in cuffia, mille cose da raccontare.', 'peach'],
  ['marco', 'Marco Bianchi', 'Cucino, pedalo, cambio idea.', 'green'],
  ['sara', 'Sara Conti', 'Film lunghissimi e passeggiate senza meta.', 'blue'],
  ['andrea', 'Andrea', 'Sto provando questo posto nuovo.', 'yellow'],
];
export function seed(): Snapshot {
  const profiles: Profile[] = people.map(([username, display_name, bio, color], i) => ({
    id: uid(i + 1),
    username,
    display_name,
    bio,
    color,
    is_private: false,
    created_at: ago(1500),
  }));
  return {
    me: profiles[0],
    profiles,
    posts: [
      {
        id: uid(101),
        author_id: uid(2),
        body: 'Ho fatto una playlist per quei giorni in cui esci per mezz’ora e torni dopo tre. Aggiungete la vostra canzone da camminata? 🎧\n\n#musica #piccolecose',
        kind: 'post',
        media_path: '/art/playlist.svg',
        media_type: 'image/svg+xml',
        alt: 'Copertina illustrata: Fuori un attimo, una playlist per prendere la strada lunga.',
        created_at: ago(12),
        expires_at: null,
      },
      {
        id: uid(102),
        author_id: uid(3),
        body: 'Domanda seria: qual è il piatto che vi riesce bene anche quando il frigo è praticamente vuoto? Io voto pasta, limone e un po’ di coraggio. 🍋\n\n#cucina',
        kind: 'post',
        media_path: null,
        media_type: null,
        alt: '',
        created_at: ago(37),
        expires_at: null,
      },
      {
        id: uid(103),
        author_id: uid(4),
        body: 'Stasera film e pizza. Cerco qualcosa che mi tenga sveglia dopo una settimana infinita. Consigli?',
        kind: 'post',
        media_path: '/art/evening.svg',
        media_type: 'image/svg+xml',
        alt: 'Illustrazione di una finestra illuminata di sera, con una luna e un vaso.',
        created_at: ago(82),
        expires_at: null,
      },
      ...[2, 3, 4].map((n, i) => ({
        id: uid(110 + n),
        author_id: uid(n),
        body: ['La strada lunga 🌿', 'Pausa meritata', 'Le cose di oggi'][i],
        kind: 'story' as const,
        media_path: i === 1 ? '/art/evening.svg' : '/art/playlist.svg',
        media_type: 'image/svg+xml',
        alt: 'Illustrazione dimostrativa',
        created_at: ago(15 + n),
        expires_at: new Date(Date.now() + 20 * 3600000).toISOString(),
      })),
    ],
    comments: [
      {
        id: uid(201),
        post_id: uid(101),
        author_id: uid(3),
        body: 'This Must Be the Place, senza pensarci due volte.',
        created_at: ago(8),
      },
    ],
    likes: [
      { user_id: uid(3), post_id: uid(101) },
      { user_id: uid(4), post_id: uid(101) },
      { user_id: uid(2), post_id: uid(102) },
    ],
    follows: [
      { follower_id: uid(1), following_id: uid(2), accepted: true },
      { follower_id: uid(2), following_id: uid(1), accepted: true },
      { follower_id: uid(1), following_id: uid(3), accepted: true },
      { follower_id: uid(3), following_id: uid(1), accepted: true },
      { follower_id: uid(1), following_id: uid(4), accepted: true },
    ],
    messages: [
      {
        id: uid(301),
        sender_id: uid(2),
        recipient_id: uid(1),
        body: 'Eccoci! Mi piace l’idea di un posto solo nostro. ☀️',
        created_at: ago(9),
      },
    ],
    notifications: [
      {
        id: uid(401),
        user_id: uid(1),
        actor_id: uid(2),
        kind: 'follow',
        post_id: null,
        read: false,
        created_at: ago(15),
      },
    ],
    reports: [],
    blocks: [],
    usage: { bytes: 0, total_bytes: 0, members: 5, max_members: 20, uploads_enabled: true },
    isAdmin: true,
    nextCursor: null,
  };
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('sn-demo', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Il browser non consente il salvataggio locale.'));
  });
}
export async function loadDemo(): Promise<Snapshot> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('state').objectStore('state').get('snapshot');
      req.onsuccess = () => resolve(req.result ?? seed());
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
export async function saveDemo(state: Snapshot) {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').put(state, 'snapshot');
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new Error('Spazio del browser esaurito. Esporta i dati prima di cancellarli.'));
    });
  } finally {
    db.close();
  }
}
export async function clearDemo() {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('state', 'readwrite');
      tx.objectStore('state').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export function applyDemo(source: Snapshot, action: Action): Snapshot {
  const s = structuredClone(source);
  const me = s.me.id;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  switch (action.type) {
    case 'post': {
      const p = postInput.parse(action);
      if (p.kind === 'reel' && !p.media_path?.startsWith('data:video/'))
        throw new Error('Per un reel serve un video.');
      s.posts.unshift({
        id,
        author_id: me,
        ...p,
        media_type: p.media_path?.startsWith('data:')
          ? p.media_path.slice(5, p.media_path.indexOf(';'))
          : null,
        created_at: now,
        expires_at: p.kind === 'story' ? new Date(Date.now() + 86400000).toISOString() : null,
      });
      break;
    }
    case 'like': {
      if (s.likes.some((l) => l.user_id === me && l.post_id === action.post_id))
        s.likes = s.likes.filter((l) => !(l.user_id === me && l.post_id === action.post_id));
      else s.likes.push({ user_id: me, post_id: action.post_id });
      break;
    }
    case 'comment':
      if (action.body.trim())
        s.comments.push({
          id,
          author_id: me,
          post_id: action.post_id,
          body: action.body.trim(),
          created_at: now,
        });
      break;
    case 'follow': {
      const exists = s.follows.some(
        (f) => f.follower_id === me && f.following_id === action.user_id,
      );
      s.follows = exists
        ? s.follows.filter((f) => !(f.follower_id === me && f.following_id === action.user_id))
        : [
            ...s.follows,
            {
              follower_id: me,
              following_id: action.user_id,
              accepted: !s.profiles.find((p) => p.id === action.user_id)?.is_private,
            },
          ];
      break;
    }
    case 'accept':
      s.follows = s.follows.filter(
        (f) => action.accept || !(f.follower_id === action.user_id && f.following_id === me),
      );
      s.follows = s.follows.map((f) =>
        f.follower_id === action.user_id && f.following_id === me ? { ...f, accepted: true } : f,
      );
      break;
    case 'message': {
      if (
        !s.follows.some(
          (f) => f.follower_id === me && f.following_id === action.user_id && f.accepted,
        ) ||
        !s.follows.some(
          (f) => f.following_id === me && f.follower_id === action.user_id && f.accepted,
        )
      )
        throw new Error('Potete scrivervi quando vi seguite a vicenda.');
      s.messages.push({
        id,
        sender_id: me,
        recipient_id: action.user_id,
        body: action.body.trim(),
        created_at: now,
      });
      break;
    }
    case 'profile':
      s.me = {
        ...s.me,
        display_name: action.display_name,
        bio: action.bio,
        is_private: action.is_private,
      };
      s.profiles = s.profiles.map((p) => (p.id === me ? s.me : p));
      break;
    case 'read-notifications':
      s.notifications = s.notifications.map((n) => ({ ...n, read: true }));
      break;
    case 'delete-post':
      s.posts = s.posts.filter((p) => p.id !== action.post_id || p.author_id !== me);
      s.comments = s.comments.filter((c) => s.posts.some((p) => p.id === c.post_id));
      s.likes = s.likes.filter((l) => s.posts.some((p) => p.id === l.post_id));
      break;
    case 'report':
      s.reports.push({
        id,
        reporter_id: me,
        post_id: action.post_id,
        reason: action.reason,
        status: 'open',
        created_at: now,
      });
      break;
    case 'moderate': {
      if (!s.isAdmin) throw new Error('Accesso negato.');
      const report = s.reports.find((r) => r.id === action.report_id);
      if (report) {
        report.status = action.remove ? 'removed' : 'dismissed';
        if (action.remove) s.posts = s.posts.filter((p) => p.id !== report.post_id);
      }
      break;
    }
    case 'block': {
      const exists = s.blocks.some((b) => b.blocked_id === action.user_id);
      s.blocks = exists
        ? s.blocks.filter((b) => b.blocked_id !== action.user_id)
        : [...s.blocks, { blocker_id: me, blocked_id: action.user_id }];
      if (!exists)
        s.follows = s.follows.filter(
          (f) => !(f.follower_id === action.user_id || f.following_id === action.user_id),
        );
      break;
    }
  }
  s.posts = s.posts.filter((p) => isActive(p));
  s.usage.bytes = s.posts
    .filter((p) => p.author_id === me)
    .reduce(
      (n, p) => n + (p.media_path?.startsWith('data:') ? Math.ceil(p.media_path.length * 0.75) : 0),
      0,
    );
  s.usage.total_bytes = s.usage.bytes;
  if (s.usage.bytes > LIMITS.user) throw new Error('Spazio disponibile esaurito.');
  return s;
}

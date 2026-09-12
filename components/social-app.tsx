'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Home,
  Search,
  Clapperboard,
  MessageCircle,
  Bell,
  UserRound,
  Settings,
  Plus,
  ArrowUpRight,
  ImagePlus,
  Video,
  Clock3,
  ChevronRight,
  LockKeyhole,
  RefreshCw,
  X,
  ShieldCheck,
  LogOut,
  Download,
  Trash2,
  Users,
  Check,
  Ban,
  Bookmark,
} from 'lucide-react';
import type { Action, Snapshot, Post } from '@/lib/core/types';
import { LIMITS, isActive, hashtags, relativeTime } from '@/lib/core/rules';
import { loadDemo, mutateDemo, clearDemo, seed } from '@/lib/client/demo';
import { Avatar, Empty, Modal } from './primitives';
import { deviceFor, localMessages, clearUserChat } from '@/lib/client/chat-store';
import { chatRequest } from '@/lib/client/chat-session';
import { publicDevice } from '@/lib/crypto/chat';
import { ChatConversation } from './chat-conversation';
import { StoryPlayer } from './story-player';
import { AuthScreen } from './auth-screen';
import { Composer } from './composer';
import { NotesReview } from './community-notes';
import { PostCard } from './post-card';
import { SecuritySettings } from './security-settings';
import { WelcomeOnboarding } from './welcome-onboarding';
import { ThemeSettings } from './theme-settings';

type View =
  | 'home'
  | 'search'
  | 'reels'
  | 'messages'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'moderation';
const navigation = [
  { id: 'home', label: 'La tua piazza', icon: Home },
  { id: 'search', label: 'Esplora', icon: Search },
  { id: 'reels', label: 'Reel', icon: Clapperboard },
  { id: 'messages', label: 'Messaggi', icon: MessageCircle },
  { id: 'notifications', label: 'Notifiche', icon: Bell },
  { id: 'profile', label: 'Il tuo profilo', icon: UserRound },
] as const;
const auditLabels = {
  report_dismissed: 'Segnalazione archiviata',
  post_removed: 'Post rimosso',
  note_approved: 'Nota approvata',
  note_rejected: 'Nota respinta',
} as const;
const auditTargetLabels = {
  report: 'segnalazione',
  post: 'post',
  community_note: 'nota',
} as const;
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function request(path: string, body?: unknown) {
  const response = await fetch(
    `/api/${path}`,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(value.error ?? 'Operazione non riuscita.'), {
      status: response.status,
    });
  return value;
}

export function SocialApp({ demo, configured }: { demo: boolean; configured: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(configured);
  const [view, setView] = useState<View>('home');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<'posts' | 'saved'>('posts');
  const [filter, setFilter] = useState<'following' | 'all'>('following');
  const [query, setQuery] = useState('');
  const [composer, setComposer] = useState<Post['kind'] | null>(null);
  const [story, setStory] = useState<Post | null>(null);
  const [conversation, setConversation] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clock, setClock] = useState(0);
  const locked = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const next = demo ? await loadDemo() : await request('bootstrap');
      if (!demo) {
        const local = await localMessages(next.me.id);
        next.messages = [...new Map([...local, ...next.messages].map((m) => [m.id, m])).values()];
      }
      setState(next);
    } catch (error) {
      if ((error as { status?: number }).status === 401) setState(null);
      else setNotice(error instanceof Error ? error.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    const pending = demo ? loadDemo() : request('bootstrap');
    pending
      .then((next) => {
        if (!cancelled) {
          setState(next);
          setClock(Date.now());
        }
      })
      .catch((error) => {
        if (!cancelled && error.status !== 401) setNotice(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, demo]);
  useEffect(() => {
    const timer = setInterval(() => {
      setClock(Date.now());
      if (
        (demo || view === 'messages') &&
        document.visibilityState === 'visible' &&
        !locked.current
      )
        void refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [view, demo, refresh]);
  useEffect(() => {
    if (demo || view !== 'messages' || !state?.me.id) return;
    deviceFor(state.me.id)
      .then((device) => chatRequest('device', publicDevice(device)))
      .catch((error) => setNotice(error.message));
  }, [demo, view, state?.me.id]);
  useEffect(() => {
    if (demo || view !== 'search') return;
    let cancelled = false;
    const timer = setTimeout(() => {
      request(`search?q=${encodeURIComponent(query.slice(0, 100))}`)
        .then((posts) => {
          if (!cancelled)
            setState((s) =>
              s
                ? {
                    ...s,
                    posts: [...new Map([...s.posts, ...posts].map((p) => [p.id, p])).values()].sort(
                      (a, b) => b.created_at.localeCompare(a.created_at),
                    ),
                  }
                : s,
            );
        })
        .catch((e) => {
          if (!cancelled) setNotice(e.message);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [demo, query, view]);
  async function act(action: Action) {
    if (!state || locked.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      const next = demo ? await mutateDemo(action) : await request('action', action);
      setState(next);
      setNotice(
        action.type === 'bookmark'
          ? action.saved
            ? 'Post salvato. Lo trovi nel tuo profilo, solo per te.'
            : 'Post rimosso dai salvati.'
          : action.type === 'post'
            ? 'Pubblicato.'
            : action.type === 'propose-note'
              ? 'Nota inviata alla revisione.'
              : action.type === 'review-note'
                ? 'Decisione salvata.'
                : action.type === 'report'
                  ? 'Segnalazione inviata.'
                  : action.type === 'profile'
                    ? 'Profilo aggiornato.'
                    : '',
      );
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Operazione non riuscita.');
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function navigate(next: View, id?: string) {
    setView(next);
    setProfileId(id ?? null);
    setProfileTab('posts');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function search(tag: string) {
    setQuery(tag);
    navigate('search');
  }
  if (loading)
    return (
      <main className="loading-screen" aria-busy="true">
        <span className="wordmark">
          sn<span>●</span>
        </span>
        <p>Apriamo la piazza…</p>
        <div className="loading-line" />
      </main>
    );
  if (!state)
    return (
      <>
        <AuthScreen configured={configured} onLogin={refresh} />
        {notice && (
          <div className="toast" role="alert">
            {notice}
            <button onClick={() => setNotice('')} aria-label="Chiudi avviso">
              <X size={17} />
            </button>
          </div>
        )}
      </>
    );
  const me = state.me;
  const profiles = state.profiles.filter((p) => !state.blocks.some((b) => b.blocked_id === p.id));
  const visiblePosts = state.posts.filter(
    (p) => isActive(p, clock) && !state.blocks.some((b) => b.blocked_id === p.author_id),
  );
  const followed = new Set(
    state.follows.filter((f) => f.follower_id === me.id && f.accepted).map((f) => f.following_id),
  );
  const unread = state.notifications.filter((n) => !n.read).length;
  const stories = visiblePosts.filter(
    (p) => p.kind === 'story' && (followed.has(p.author_id) || p.author_id === me.id),
  );
  const focusProfile = profiles.find((p) => p.id === (profileId ?? me.id));
  const terms = query.trim().toLocaleLowerCase('it');
  const showingSaved = view === 'profile' && focusProfile?.id === me.id && profileTab === 'saved';
  const savedIds = new Set(
    state.bookmarks.filter((b) => b.user_id === me.id).map((b) => b.post_id),
  );
  const savedPosts = demo
    ? state.bookmarks
        .filter((b) => b.user_id === me.id)
        .flatMap((b) =>
          visiblePosts.filter((p) => {
            const author = profiles.find((a) => a.id === p.author_id);
            return (
              p.id === b.post_id &&
              author &&
              (!author.is_private || author.id === me.id || followed.has(author.id)) &&
              !state.blocks.some(
                (block) => block.blocker_id === author.id && block.blocked_id === me.id,
              )
            );
          }),
        )
    : state.saved.posts.filter((p) => isActive(p, clock) && savedIds.has(p.id));
  const feed = showingSaved
    ? savedPosts.filter((p) => p.kind !== 'story')
    : visiblePosts.filter(
        (p) =>
          p.kind !== 'story' &&
          (view === 'reels'
            ? p.kind === 'reel'
            : view === 'profile'
              ? p.author_id === focusProfile?.id
              : view === 'search'
                ? p.body.toLocaleLowerCase('it').includes(terms)
                : filter === 'all' || p.author_id === me.id || followed.has(p.author_id)),
      );
  const tags = [
    ...new Set(visiblePosts.filter((p) => !p.content_warning).flatMap((p) => hashtags(p.body))),
  ].slice(0, 4);
  const potentialFriends = profiles
    .filter((p) => p.id !== me.id && !followed.has(p.id))
    .slice(0, 3);
  const title =
    view === 'profile'
      ? (focusProfile?.display_name ?? 'Profilo')
      : view === 'settings'
        ? 'Le tue impostazioni'
        : view === 'moderation'
          ? 'Moderazione'
          : (navigation.find((n) => n.id === view)?.label ?? 'La tua piazza');
  const currentConversation = profiles.find((p) => p.id === conversation);
  return (
    <div className={`app-shell ${demo ? 'is-demo' : ''}`}>
      {demo && (
        <div className="demo-banner">
          <span>
            <strong>Demo</strong> · Profili inventati, modifiche solo in questo browser.
          </span>
          <Link href="/">
            Torna all’ingresso <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      <aside className="sidebar">
        <Link href={demo ? '/demo' : '/'} className="wordmark" aria-label="SN, home">
          sn<span>●</span>
        </Link>
        <span className="sidebar-subtitle">CI TROVIAMO QUI</span>
        <nav aria-label="Navigazione principale">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <item.icon size={23} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.id === 'notifications' && unread > 0 && <span className="badge">{unread}</span>}
            </button>
          ))}
        </nav>
        <button className="primary new-post" onClick={() => setComposer('post')}>
          <Plus size={21} /> Crea un post
        </button>
        <div className="sidebar-bottom">
          <button
            className={view === 'settings' ? 'active utility-link' : 'utility-link'}
            onClick={() => navigate('settings')}
          >
            <Settings size={20} />
            Impostazioni
          </button>
          {state.isAdmin && (
            <button className="utility-link" onClick={() => navigate('moderation')}>
              <ShieldCheck size={19} />
              Moderazione
            </button>
          )}
          <button className="my-account" onClick={() => navigate('profile')}>
            <Avatar person={me} />
            <span>
              <strong>{me.display_name}</strong>
              <small>@{me.username}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-wordmark" aria-hidden="true">
            sn<span>●</span>
          </div>
          <div className="breadcrumb">
            Il tuo spazio <ChevronRight size={13} />
            <span>{title}</span>
          </div>
          <form
            className="top-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate('search');
            }}
          >
            <Search size={17} />
            <input
              aria-label="Cerca su SN"
              placeholder="Persone, parole, hashtag"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <span className="beta-pill">
            <i /> BETA PRIVATA
          </span>
          <button
            className="mobile-settings icon-button"
            aria-label="Il tuo profilo"
            onClick={() => navigate('profile')}
          >
            <UserRound size={21} />
          </button>
          <button
            className="mobile-settings icon-button"
            aria-label="Impostazioni"
            onClick={() => navigate('settings')}
          >
            <Settings size={21} />
          </button>
        </header>
        <div className="content-grid">
          <main id="main-content" className="feed-column">
            <header className="page-heading">
              <div>
                <span className="eyebrow">
                  {view === 'home'
                    ? 'UN POSTO PER RITROVARSI'
                    : view === 'search'
                      ? 'DENTRO LA COMMUNITY'
                      : view === 'messages'
                        ? 'DUE PAROLE, TRA VOI'
                        : 'IL TUO SPAZIO'}
                </span>
                <h1>
                  {title}
                  <span className="heading-dot">.</span>
                </h1>
              </div>
              <button
                className="icon-button refresh"
                aria-label="Aggiorna"
                disabled={busy}
                onClick={refresh}
              >
                <RefreshCw size={18} />
              </button>
            </header>
            {view === 'home' && (
              <>
                <div className="welcome-line">
                  <p>Ciao {me.display_name.split(' ')[0]}, che si dice?</p>
                  <span>
                    <Clock3 size={13} /> In ordine di tempo
                  </span>
                </div>
                <section className="stories" aria-label="Storie">
                  <button className="story-button" onClick={() => setComposer('story')}>
                    <span className="story-add">
                      <Plus size={25} />
                    </span>
                    <span>La tua storia</span>
                  </button>
                  {profiles
                    .filter((p) => stories.some((s) => s.author_id === p.id))
                    .map((p) => (
                      <button
                        className="story-button"
                        key={p.id}
                        onClick={() => setStory(stories.find((s) => s.author_id === p.id)!)}
                      >
                        <span className="story-ring">
                          <Avatar person={p} size="large" />
                        </span>
                        <span>{p.display_name.split(' ')[0]}</span>
                      </button>
                    ))}
                  <div className="story-note">
                    Piccole cose,
                    <br />
                    per 24 ore.<span>↗</span>
                  </div>
                </section>
                <section className="quick-compose">
                  <button className="compose-prompt" onClick={() => setComposer('post')}>
                    <Avatar person={me} />
                    <span>Che cosa vuoi raccontare?</span>
                    <Plus size={20} />
                  </button>
                  <div className="compose-tools">
                    <button onClick={() => setComposer('post')}>
                      <ImagePlus size={17} />
                      <span>Foto</span>
                    </button>
                    <button onClick={() => setComposer('reel')}>
                      <Video size={17} />
                      <span>Video</span>
                    </button>
                    <button onClick={() => setComposer('story')}>
                      <Clock3 size={17} />
                      <span>Storia</span>
                    </button>
                    <span className="compose-privacy">
                      <LockKeyhole size={12} />
                      {me.is_private ? 'Ai tuoi follower' : 'Alla community'}
                    </span>
                  </div>
                </section>
                <div className="feed-tabs">
                  <div>
                    <button
                      className={filter === 'following' ? 'selected' : ''}
                      aria-pressed={filter === 'following'}
                      onClick={() => setFilter('following')}
                    >
                      Seguiti
                    </button>
                    <button
                      className={filter === 'all' ? 'selected' : ''}
                      aria-pressed={filter === 'all'}
                      onClick={() => setFilter('all')}
                    >
                      Tutta la piazza
                    </button>
                  </div>
                  <span>
                    <span className="tiny-dot" /> I più recenti
                  </span>
                </div>
              </>
            )}
            {view === 'search' && (
              <>
                <form className="search-box" onSubmit={(e) => e.preventDefault()}>
                  <Search size={20} />
                  <input
                    autoFocus
                    aria-label="Cerca persone o hashtag"
                    placeholder="Cerca persone, parole o #hashtag"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      className="icon-button"
                      aria-label="Cancella ricerca"
                      onClick={() => setQuery('')}
                    >
                      <X size={18} />
                    </button>
                  )}
                </form>
                <h2 className="section-title">Persone</h2>
                <div className="people-results">
                  {profiles
                    .filter((p) =>
                      `${p.display_name} ${p.username}`
                        .toLowerCase()
                        .includes(terms.replace(/^@/, '')),
                    )
                    .map((p) => (
                      <div className="person-row" key={p.id}>
                        <button className="person-button" onClick={() => navigate('profile', p.id)}>
                          <Avatar person={p} />
                          <span>
                            <strong>{p.display_name}</strong>
                            <small>@{p.username}</small>
                          </span>
                        </button>
                        {p.id !== me.id && (
                          <button
                            className="follow-button"
                            disabled={busy}
                            onClick={() => act({ type: 'follow', user_id: p.id })}
                          >
                            {followLabel(p.id)}
                          </button>
                        )}
                      </div>
                    ))}
                </div>
                <h2 className="section-title">Conversazioni {query && <span>· {query}</span>}</h2>
              </>
            )}
            {view === 'profile' && focusProfile && (
              <section className="profile-card">
                <div className={`profile-cover ${focusProfile.color}`}>
                  <span aria-hidden="true">ciao, sono qui.</span>
                </div>
                <div className="profile-details">
                  <Avatar person={focusProfile} size="large" />
                  <h2>{focusProfile.display_name}</h2>
                  <span className="muted">
                    @{focusProfile.username} {focusProfile.is_private && <LockKeyhole size={13} />}
                  </span>
                  <p>{focusProfile.bio || 'Ancora poche righe. Il resto arriverà nei post.'}</p>
                  {focusProfile.id === me.id ? (
                    <button className="secondary" onClick={() => navigate('settings')}>
                      Modifica profilo
                    </button>
                  ) : (
                    <div className="button-row">
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => act({ type: 'follow', user_id: focusProfile.id })}
                      >
                        {followLabel(focusProfile.id)}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => {
                          setConversation(focusProfile.id);
                          navigate('messages');
                        }}
                      >
                        Messaggio
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Blocca utente"
                        onClick={() => act({ type: 'block', user_id: focusProfile.id })}
                      >
                        <Ban size={19} />
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}
            {view === 'profile' && focusProfile?.id === me.id && (
              <>
                <div className="profile-tabs" aria-label="Contenuti del tuo profilo">
                  <button
                    aria-pressed={profileTab === 'posts'}
                    onClick={() => setProfileTab('posts')}
                  >
                    I tuoi post
                  </button>
                  <button
                    aria-pressed={profileTab === 'saved'}
                    onClick={() => setProfileTab('saved')}
                  >
                    <Bookmark size={17} /> Salvati
                  </button>
                </div>
                {showingSaved && (
                  <p className="saved-help">
                    Solo tu puoi vedere questa raccolta. Un post non sarà più visibile qui se viene
                    eliminato o se perdi l’accesso.
                  </p>
                )}
              </>
            )}
            {['home', 'search', 'profile', 'reels'].includes(view) && (
              <>
                {feed.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    state={state}
                    demo={demo}
                    now={clock}
                    onAction={act}
                    onProfile={(id) => navigate('profile', id)}
                    onTag={search}
                  />
                ))}
                {!feed.length && (
                  <Empty
                    title={
                      showingSaved
                        ? 'Tieni da parte ciò che vuoi ritrovare.'
                        : view === 'reels'
                          ? 'Il primo reel potrebbe essere tuo.'
                          : view === 'search'
                            ? 'Nessun post trovato.'
                            : 'Qui c’è spazio per iniziare.'
                    }
                  >
                    {showingSaved ? (
                      <>Usa «Salva» sotto un post per ritrovarlo qui. La raccolta è privata.</>
                    ) : view === 'reels' ? (
                      <>
                        Condividi un video breve, fino a 20 secondi.
                        <button className="secondary" onClick={() => setComposer('reel')}>
                          Crea un reel <Plus size={16} />
                        </button>
                      </>
                    ) : view === 'search' ? (
                      'Prova un’altra parola o cerca il nome di un amico.'
                    ) : (
                      'I nuovi post compariranno qui. Segui un amico o scrivi qualcosa.'
                    )}
                  </Empty>
                )}
                {showingSaved && !demo && state.saved.nextCursor && (
                  <button
                    className="secondary full"
                    disabled={busy}
                    onClick={async () => {
                      const cursor = state.saved.nextCursor!;
                      setBusy(true);
                      try {
                        const page = await request(
                          `saved?before=${encodeURIComponent(cursor.created_at)}&post_id=${cursor.post_id}`,
                        );
                        setState((s) =>
                          s
                            ? {
                                ...s,
                                saved: {
                                  posts: [
                                    ...new Map(
                                      [...s.saved.posts, ...page.posts].map((p) => [p.id, p]),
                                    ).values(),
                                  ],
                                  nextCursor: page.nextCursor,
                                },
                              }
                            : s,
                        );
                      } catch (error) {
                        setNotice(
                          error instanceof Error
                            ? error.message
                            : 'Caricamento non riuscito. Riprova.',
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? 'Caricamento…' : 'Carica altri salvati'}
                  </button>
                )}
                {!showingSaved && state.nextCursor && (
                  <button
                    className="secondary full"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await request(
                          `posts?before=${encodeURIComponent(state.nextCursor!)}`,
                        );
                        setState({
                          ...state,
                          posts: [...state.posts, ...result.posts],
                          nextCursor: result.nextCursor,
                        });
                      } catch (e) {
                        setNotice(e instanceof Error ? e.message : 'Caricamento non riuscito.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Carica post precedenti
                  </button>
                )}
                {feed.length > 0 && !state.nextCursor && (
                  <div className="feed-end">
                    <span>✳</span>
                    <p>
                      Sei in pari.
                      <small>La piazza per ora è tranquilla. Puoi tornare più tardi.</small>
                    </p>
                  </div>
                )}
              </>
            )}
            {view === 'messages' && (
              <section className="messages-panel">
                <p className="privacy-note">
                  <LockKeyhole size={15} /> I nuovi messaggi e allegati sono cifrati end-to-end. Le
                  chiavi restano nei browser autorizzati.
                </p>
                <div className="conversation-tabs">
                  {profiles
                    .filter(
                      (p) =>
                        p.id !== me.id &&
                        (state.messages.some(
                          (m) => m.sender_id === p.id || m.recipient_id === p.id,
                        ) ||
                          followed.has(p.id)),
                    )
                    .map((p) => (
                      <button
                        key={p.id}
                        className={conversation === p.id ? 'selected' : ''}
                        onClick={async () => {
                          setConversation(p.id);
                          if (!demo) {
                            try {
                              const messages = await request(`messages?user=${p.id}`);
                              setState((s) =>
                                s
                                  ? {
                                      ...s,
                                      messages: [
                                        ...s.messages.filter(
                                          (m) =>
                                            !messages.some((n: { id: string }) => n.id === m.id),
                                        ),
                                        ...messages,
                                      ],
                                    }
                                  : s,
                              );
                            } catch (e) {
                              setNotice(
                                e instanceof Error ? e.message : 'Caricamento non riuscito.',
                              );
                            }
                          }
                        }}
                      >
                        <Avatar person={p} size="small" />
                        {p.display_name.split(' ')[0]}
                      </button>
                    ))}
                </div>
                {currentConversation ? (
                  <ChatConversation
                    key={currentConversation.id}
                    me={me}
                    person={currentConversation}
                    demo={demo}
                    messages={state.messages.filter(
                      (m) =>
                        (m.sender_id === conversation && m.recipient_id === me.id) ||
                        (m.recipient_id === conversation && m.sender_id === me.id),
                    )}
                    allowed={
                      state.follows.some(
                        (f) =>
                          f.follower_id === me.id && f.following_id === conversation && f.accepted,
                      ) &&
                      state.follows.some(
                        (f) =>
                          f.follower_id === conversation && f.following_id === me.id && f.accepted,
                      )
                    }
                    onSend={act}
                  />
                ) : (
                  <Empty title="Scegli una persona.">
                    Le conversazioni iniziano con due parole.
                  </Empty>
                )}
              </section>
            )}
            {view === 'notifications' && (
              <section className="panel">
                <div className="section-top">
                  <h2>Le ultime novità</h2>
                  <button
                    className="text-button"
                    disabled={busy || !unread}
                    onClick={() => act({ type: 'read-notifications' })}
                  >
                    Segna come lette <Check size={15} />
                  </button>
                </div>
                {state.notifications.length === 0 && (
                  <Empty title="Tutto tranquillo.">
                    Richieste di follow, risposte e mi piace compariranno qui.
                  </Empty>
                )}
                {state.notifications.map((n) => {
                  const actor = profiles.find((p) => p.id === n.actor_id);
                  const pending = state.follows.some(
                    (f) => f.follower_id === n.actor_id && f.following_id === me.id && !f.accepted,
                  );
                  return (
                    <div className={`notification ${n.read ? '' : 'unread'}`} key={n.id}>
                      <Avatar person={actor} />
                      <div>
                        <p>
                          <button
                            className="inline-name"
                            onClick={() => navigate('profile', n.actor_id)}
                          >
                            {actor?.display_name ?? 'Utente'}
                          </button>{' '}
                          {n.kind === 'note_approved'
                            ? 'ha approvato la tua nota della comunità.'
                            : n.kind === 'note_rejected'
                              ? 'non ha approvato la tua nota. Il motivo è disponibile sotto il post.'
                              : n.kind === 'likes'
                                ? 'ha messo mi piace al tuo post.'
                                : n.kind === 'comments'
                                  ? 'ha risposto al tuo post.'
                                  : n.kind === 'message'
                                    ? 'ti ha scritto.'
                                    : n.kind === 'request'
                                      ? 'ha chiesto di seguirti.'
                                      : 'ha iniziato a seguirti.'}
                        </p>
                        <small>{relativeTime(n.created_at)}</small>
                        {pending && (
                          <div className="button-row">
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                act({ type: 'accept', user_id: n.actor_id, accept: true })
                              }
                            >
                              Accetta
                            </button>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                act({ type: 'accept', user_id: n.actor_id, accept: false })
                              }
                            >
                              Rifiuta
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}
            {view === 'settings' && (
              <>
                {state.isAdmin && (
                  <section className="panel">
                    <h2>Moderazione</h2>
                    <p className="muted">
                      Leggi le segnalazioni e verifica le note proposte dalla comunità.
                    </p>
                    <button className="secondary" onClick={() => navigate('moderation')}>
                      Apri moderazione
                    </button>
                  </section>
                )}
                <section className="panel">
                  <h2>Come ti presenti</h2>
                  <form
                    key={me.id}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await act({
                        type: 'profile',
                        display_name: String(f.get('display_name')),
                        bio: String(f.get('bio')),
                        is_private: f.get('is_private') === 'on',
                      });
                    }}
                  >
                    <label>
                      Nome visualizzato
                      <input
                        name="display_name"
                        defaultValue={me.display_name}
                        required
                        maxLength={60}
                      />
                    </label>
                    <label>
                      Due righe su di te
                      <textarea name="bio" defaultValue={me.bio} maxLength={300} rows={3} />
                    </label>
                    <label className="toggle-label">
                      <span>
                        <strong>Account privato</strong>
                        <small>
                          Solo i follower che approvi vedono i tuoi post. Nome e bio restano
                          visibili nella community.
                        </small>
                      </span>
                      <input name="is_private" type="checkbox" defaultChecked={me.is_private} />
                    </label>
                    <button className="primary" disabled={busy}>
                      Salva modifiche <Check size={17} />
                    </button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Il tuo spazio</h2>
                  <p>{(state.usage.bytes / 1024 / 1024).toFixed(1)} MB usati su 40 MB</p>
                  <progress max={LIMITS.user} value={state.usage.bytes} />
                  <p className="muted fine">
                    Per restare nel piano gratuito, la beta ospita fino a 20 persone. Gli upload si
                    fermano al limite; nessun acquisto automatico.
                  </p>
                </section>
                <SecuritySettings demo={demo} />
                <ThemeSettings />
                <section className="panel">
                  <h2>I tuoi dati, le tue scelte</h2>
                  <p className="muted">
                    L’esportazione JSON include profilo, post, commenti e messaggi. I file
                    multimediali si scaricano separatamente dai post. I messaggi cifrati restano
                    cifrati nel JSON; le chiavi private rimangono in questo browser.
                  </p>
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        download(
                          demo
                            ? state
                            : {
                                ...(await request('export')),
                                local_messages: await localMessages(me.id),
                              },
                          'sn-dati.json',
                        );
                        setNotice('Esportazione pronta.');
                      } catch (e) {
                        setNotice(e instanceof Error ? e.message : 'Esportazione non riuscita.');
                      }
                    }}
                  >
                    <Download size={18} />
                    Esporta i miei dati
                  </button>
                  <button className="text-button danger-text" onClick={() => setDeleteOpen(true)}>
                    <Trash2 size={17} />
                    {demo ? 'Cancella i dati della demo' : 'Elimina il mio account'}
                  </button>
                  <Link className="subtle-link" href="/privacy">
                    Leggi privacy e regole della beta <ArrowUpRight size={13} />
                  </Link>
                </section>
                {state.blocks.length > 0 && (
                  <section className="panel">
                    <h2>Account bloccati</h2>
                    {state.blocks.map((b) => (
                      <div className="person-row" key={b.blocked_id}>
                        <span>
                          {state.profiles.find((p) => p.id === b.blocked_id)?.display_name ??
                            'Account bloccato'}
                        </span>
                        <button
                          className="text-button"
                          onClick={() => act({ type: 'block', user_id: b.blocked_id })}
                        >
                          Sblocca
                        </button>
                      </div>
                    ))}
                  </section>
                )}
                <button
                  className="secondary"
                  onClick={async () => {
                    if (demo) router.push('/');
                    else
                      try {
                        await request('auth/logout', {});
                        setState(null);
                      } catch (e) {
                        setNotice(e instanceof Error ? e.message : 'Uscita non riuscita.');
                      }
                  }}
                >
                  <LogOut size={18} />
                  {demo ? 'Esci dalla demo' : 'Esci da SN'}
                </button>
              </>
            )}
            {view === 'moderation' && (
              <section className="panel">
                <NotesReview state={state} onAction={act} />
                <h2>Segnalazioni da leggere</h2>
                <p className="muted">
                  La beta usa moderazione manuale. Le decisioni automatiche potranno essere aggiunte
                  in seguito.
                </p>
                {state.reports
                  .filter((r) => r.status === 'open')
                  .map((r) => (
                    <div className="report" key={r.id}>
                      <strong>Segnalazione · {relativeTime(r.created_at)}</strong>
                      <p>{r.reason}</p>
                      <blockquote>
                        {state.posts.find((p) => p.id === r.post_id)?.body ??
                          'Post non presente nel feed caricato.'}
                      </blockquote>
                      <div className="button-row">
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => act({ type: 'moderate', report_id: r.id, remove: true })}
                        >
                          Rimuovi post
                        </button>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => act({ type: 'moderate', report_id: r.id, remove: false })}
                        >
                          Archivia
                        </button>
                      </div>
                    </div>
                  ))}
                {!state.reports.some((r) => r.status === 'open') && (
                  <Empty title="Nessuna segnalazione aperta.">
                    Le segnalazioni dei tuoi amici arriveranno qui.
                  </Empty>
                )}
                <section className="moderation-history" aria-labelledby="moderation-history-title">
                  <h2 id="moderation-history-title">Registro delle decisioni</h2>
                  <p className="muted">
                    Conserva il moderatore, l’azione, il contenuto interessato e la data.
                  </p>
                  {(state.moderationAudit ?? []).length ? (
                    <ol className="audit-list">
                      {(state.moderationAudit ?? []).map((entry) => {
                        const moderator = state.profiles.find((p) => p.id === entry.moderator_id);
                        return (
                          <li key={entry.id}>
                            <span>
                              <strong>{auditLabels[entry.action]}</strong>
                              <small>
                                {auditTargetLabels[entry.target_type]} ·{' '}
                                {entry.target_id.slice(0, 8)}
                              </small>
                            </span>
                            <span>
                              {moderator?.display_name ?? 'Account rimosso'} ·{' '}
                              {relativeTime(entry.created_at)}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="fine muted">Nessuna decisione registrata.</p>
                  )}
                </section>
              </section>
            )}
          </main>
          <aside className="right-rail">
            <section className="community-note">
              <span className="eyebrow">POCHE PERSONE. SPAZIO PER TUTTI.</span>
              <h2>
                Facciamo
                <br />
                come a casa<span>✳</span>
              </h2>
              <p>Un’idea al volo, un giorno storto, qualcosa che ti va di condividere.</p>
              <div className="community-faces">
                {profiles.slice(0, 4).map((p) => (
                  <Avatar key={p.id} person={p} size="small" />
                ))}
                <span>{state.usage.members} persone, per ora.</span>
              </div>
              <button
                onClick={() => {
                  setQuery('');
                  navigate('search');
                }}
              >
                Incontra la community <ArrowUpRight size={17} />
              </button>
            </section>
            <section className="rail-section">
              <div className="section-top">
                <h2>Ci sono anche</h2>
                <Users size={17} />
              </div>
              {potentialFriends.map((p) => (
                <div className="person-row" key={p.id}>
                  <button className="person-button" onClick={() => navigate('profile', p.id)}>
                    <Avatar person={p} />
                    <span>
                      <strong>{p.display_name}</strong>
                      <small>@{p.username}</small>
                    </span>
                  </button>
                  <button
                    className="follow-button"
                    disabled={busy}
                    onClick={() => act({ type: 'follow', user_id: p.id })}
                  >
                    {followLabel(p.id)}
                  </button>
                </div>
              ))}
              {potentialFriends.length === 0 && (
                <p className="muted fine">Conosci già tutti, per ora.</p>
              )}
            </section>
            <section className="rail-section">
              <span className="eyebrow">DI COSA SI PARLA</span>
              {tags.length ? (
                tags.map((tag, i) => (
                  <button className="topic-row" key={tag} onClick={() => search('#' + tag)}>
                    <span className="topic-index">0{i + 1}</span>
                    <span>
                      <strong>#{tag}</strong>
                      <small>
                        {visiblePosts.filter((p) => hashtags(p.body).includes(tag)).length} post
                        nella piazza
                      </small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))
              ) : (
                <p className="muted fine">
                  Aggiungi un #hashtag a un post per iniziare un argomento.
                </p>
              )}
            </section>
            <div className="quiet-note">
              <span>Al tuo ritmo.</span>
              <p>
                I post delle persone che segui,
                <br />
                dal più recente. Tutto qui.
              </p>
            </div>
            <footer className="rail-footer">
              <Link href="/privacy">Privacy</Link>
              <Link href="/privacy#regole">Regole</Link>
              <button onClick={() => navigate('settings')}>I tuoi dati</button>
              <p>SN · Fatto per stare insieme.</p>
            </footer>
          </aside>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Navigazione mobile">
        {navigation
          .filter((n) => n.id !== 'profile')
          .map((n) => (
            <button
              key={n.id}
              className={view === n.id ? 'active' : ''}
              onClick={() => navigate(n.id)}
              aria-label={n.label}
            >
              <n.icon size={22} />
              {n.id === 'notifications' && unread > 0 && <i />}
            </button>
          ))}
        <button
          aria-label="Crea un post"
          className="mobile-create"
          onClick={() => setComposer('post')}
        >
          <Plus size={23} />
        </button>
      </nav>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Chiudi avviso">
            <X size={17} />
          </button>
        </div>
      )}
      {!demo && !me.onboarded_at && (
        <WelcomeOnboarding
          firstName={me.display_name.split(' ')[0]}
          onAction={act}
          onSettings={() => navigate('settings')}
        />
      )}
      {composer && (
        <Composer
          me={me}
          demo={demo}
          initialKind={composer}
          onClose={() => setComposer(null)}
          onPost={act}
        />
      )}
      {story && (
        <StoryPlayer
          stories={stories}
          startId={story.id}
          profiles={profiles}
          demo={demo}
          onClose={() => setStory(null)}
        />
      )}
      {deleteOpen && (
        <Modal
          title={demo ? 'Cancella i dati della demo' : 'Elimina il tuo account'}
          onClose={() => setDeleteOpen(false)}
        >
          <p>
            {demo
              ? 'Verranno cancellate le modifiche fatte in questo browser e ripristinati i dati di esempio.'
              : 'Profilo, post e messaggi saranno eliminati. Questa operazione non si può annullare.'}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                if (demo) {
                  await clearDemo();
                  const next = seed();
                  setState(next);
                  setDeleteOpen(false);
                  navigate('home');
                  setNotice('Dati della demo ripristinati.');
                } else {
                  const f = new FormData(e.currentTarget);
                  await request('account/delete', {
                    password: f.get('password'),
                    confirmation: f.get('confirmation'),
                  });
                  await clearUserChat(me.id);
                  setState(null);
                  setDeleteOpen(false);
                }
              } catch (e) {
                setNotice(e instanceof Error ? e.message : 'Eliminazione non riuscita.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {!demo && (
              <label>
                Password attuale
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
            )}
            <label>
              Scrivi ELIMINA per confermare
              <input name="confirmation" pattern="ELIMINA" required autoComplete="off" />
            </label>
            <button className="danger" disabled={busy}>
              {busy ? 'Eliminazione…' : 'Elimina definitivamente'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
  function followLabel(id: string) {
    const f = state!.follows.find((f) => f.follower_id === state!.me.id && f.following_id === id);
    return f ? (f.accepted ? 'Segui già' : 'Richiesto') : 'Segui';
  }
}

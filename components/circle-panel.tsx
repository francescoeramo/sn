'use client';

import { useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  Check,
  DoorOpen,
  Pencil,
  Plus,
  Shield,
  ShieldOff,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { Action, Circle, Post, Snapshot } from '@/lib/core/types';
import { Avatar, Empty } from './primitives';
import { PostCard } from './post-card';

type Props = {
  state: Snapshot;
  demo: boolean;
  busy: boolean;
  now: number;
  onAction: (action: Action) => Promise<boolean>;
  onProfile: (id: string) => void;
  onTag: (tag: string) => void;
};

export function CirclePanel({ state, demo, busy, now, onAction, onProfile, onTag }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [body, setBody] = useState('');
  const memberships = state.circleMembers ?? [];
  const circles = state.circles ?? [];
  const activeMemberships = memberships.filter(
    (member) => member.user_id === state.me.id && member.status === 'active',
  );
  const invites = memberships.filter(
    (member) => member.user_id === state.me.id && member.status === 'invited',
  );
  const activeIds = new Set(activeMemberships.map((member) => member.circle_id));
  const mine = circles.filter((circle) => activeIds.has(circle.id) && !circle.archived_at);
  const selected = mine.find((circle) => circle.id === selectedId) ?? null;
  const members = selected
    ? memberships.filter((member) => member.circle_id === selected.id && member.status === 'active')
    : [];
  const pendingMembers = selected
    ? memberships.filter(
        (member) => member.circle_id === selected.id && member.status === 'invited',
      )
    : [];
  const myMembership = selected ? members.find((member) => member.user_id === state.me.id) : null;
  const memberIds = new Set(members.map((member) => member.user_id));
  const mutualIds = useMemo(() => {
    const outgoing = new Set(
      state.follows
        .filter((follow) => follow.follower_id === state.me.id && follow.accepted)
        .map((follow) => follow.following_id),
    );
    return new Set(
      state.follows
        .filter(
          (follow) =>
            follow.following_id === state.me.id &&
            follow.accepted &&
            outgoing.has(follow.follower_id),
        )
        .map((follow) => follow.follower_id),
    );
  }, [state.follows, state.me.id]);
  const inviteable = selected
    ? state.profiles.filter((profile) => mutualIds.has(profile.id) && !memberIds.has(profile.id))
    : [];
  const circlePostIds = new Set(
    (state.circlePosts ?? [])
      .filter((link) => link.circle_id === selected?.id)
      .map((link) => link.post_id),
  );
  const posts = state.posts
    .filter((post) => circlePostIds.has(post.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  async function createCircle(event: React.FormEvent) {
    event.preventDefault();
    if (await onAction({ type: 'create-circle', name, description })) {
      setName('');
      setDescription('');
      setCreating(false);
    }
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !body.trim()) return;
    const ok = await onAction({
      type: 'post',
      body,
      kind: 'post',
      media_path: null,
      alt: '',
      circle_ids: [selected.id],
    });
    if (ok) {
      setBody('');
      setPosting(false);
    }
  }

  function openEditor() {
    if (!selected) return;
    setEditName(selected.name);
    setEditDescription(selected.description);
    setEditing(true);
  }

  async function updateCircle(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (
      await onAction({
        type: 'update-circle',
        circle_id: selected.id,
        name: editName,
        description: editDescription,
      })
    )
      setEditing(false);
  }

  async function deleteCircle() {
    if (!selected) return;
    if (await onAction({ type: 'delete-circle', circle_id: selected.id })) {
      setConfirmingDelete(false);
      setEditing(false);
      setSelectedId(null);
    }
  }

  if (selected)
    return (
      <section className="circle-detail" aria-labelledby="circle-title">
        <button className="text-button circle-back" onClick={() => setSelectedId(null)}>
          <ArrowLeft size={17} /> Tutte le cerchie
        </button>
        <header className="circle-hero">
          <div className="circle-mark" aria-hidden="true">
            {selected.name.slice(0, 2).toLocaleUpperCase('it')}
          </div>
          <div>
            <h2 id="circle-title">{selected.name}</h2>
            <p>{selected.description || 'Uno spazio privato tra persone che si conoscono.'}</p>
            <span>
              {members.length} {members.length === 1 ? 'persona' : 'persone'}
            </span>
          </div>
          <div className="circle-actions">
            <button className="primary" onClick={() => setPosting((value) => !value)}>
              <Plus size={17} /> Scrivi qui
            </button>
            {myMembership?.role === 'admin' ? (
              <>
                <button className="icon-button" aria-label="Modifica cerchia" onClick={openEditor}>
                  <Pencil size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Archivia cerchia"
                  disabled={busy}
                  onClick={() => onAction({ type: 'archive-circle', circle_id: selected.id })}
                >
                  <Archive size={18} />
                </button>
              </>
            ) : (
              <button
                className="icon-button"
                aria-label="Lascia cerchia"
                disabled={busy}
                onClick={() => onAction({ type: 'leave-circle', circle_id: selected.id })}
              >
                <DoorOpen size={18} />
              </button>
            )}
          </div>
        </header>
        {editing && (
          <form className="circle-edit" onSubmit={updateCircle}>
            <label>
              Nome
              <input
                autoFocus
                required
                maxLength={60}
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
              />
            </label>
            <label>
              Descrizione <small>facoltativa</small>
              <textarea
                maxLength={240}
                rows={2}
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
              />
            </label>
            <div className="button-row">
              <button className="primary" disabled={busy || !editName.trim()}>
                Salva
              </button>
              <button type="button" className="secondary" onClick={() => setEditing(false)}>
                Annulla
              </button>
            </div>
            <div className="circle-delete">
              {!confirmingDelete ? (
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={16} /> Elimina cerchia
                </button>
              ) : (
                <div role="alert">
                  <p>
                    La cerchia, gli inviti e i post pubblicati soltanto qui verranno eliminati. I
                    post condivisi anche in altre cerchie resteranno disponibili lì.
                  </p>
                  <div className="button-row">
                    <button type="button" className="danger" disabled={busy} onClick={deleteCircle}>
                      Elimina definitivamente
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Torna indietro
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        )}
        {posting && (
          <form className="circle-compose" onSubmit={publish}>
            <Avatar person={state.me} />
            <label>
              <span className="sr-only">Scrivi nella cerchia</span>
              <textarea
                autoFocus
                maxLength={2200}
                rows={3}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={`Scrivi a ${selected.name}`}
              />
            </label>
            <button className="primary" disabled={busy || !body.trim()}>
              Pubblica
            </button>
          </form>
        )}
        <div className="circle-members" aria-label="Persone nella cerchia">
          {members.map((member) => {
            const profile = state.profiles.find((person) => person.id === member.user_id);
            return profile ? (
              <div className="circle-member" key={member.user_id}>
                <button className="circle-member-profile" onClick={() => onProfile(profile.id)}>
                  <Avatar person={profile} />
                  <span>
                    <strong>{profile.display_name}</strong>
                    <small>{member.role === 'admin' ? 'Admin' : `@${profile.username}`}</small>
                  </span>
                </button>
                {myMembership?.role === 'admin' && member.user_id !== state.me.id && (
                  <div className="circle-member-actions">
                    <button
                      className="icon-button"
                      aria-label={
                        member.role === 'admin'
                          ? `Rimuovi ${profile.display_name} dagli admin`
                          : `Nomina ${profile.display_name} admin`
                      }
                      disabled={busy}
                      onClick={() =>
                        onAction({
                          type: 'set-circle-role',
                          circle_id: selected.id,
                          user_id: profile.id,
                          role: member.role === 'admin' ? 'member' : 'admin',
                        })
                      }
                    >
                      {member.role === 'admin' ? <ShieldOff size={17} /> : <Shield size={17} />}
                    </button>
                    <button
                      className="icon-button danger-button"
                      aria-label={`Rimuovi ${profile.display_name} dalla cerchia`}
                      disabled={busy}
                      onClick={() =>
                        onAction({
                          type: 'remove-circle-member',
                          circle_id: selected.id,
                          user_id: profile.id,
                        })
                      }
                    >
                      <UserMinus size={17} />
                    </button>
                  </div>
                )}
              </div>
            ) : null;
          })}
        </div>
        {myMembership?.role === 'admin' && pendingMembers.length > 0 && (
          <div className="circle-pending" aria-label="Inviti in attesa">
            <h3>Inviti in attesa</h3>
            {pendingMembers.map((member) => {
              const profile = state.profiles.find((person) => person.id === member.user_id);
              return profile ? (
                <div className="circle-member" key={member.user_id}>
                  <div className="circle-member-profile">
                    <Avatar person={profile} />
                    <span>
                      <strong>{profile.display_name}</strong>
                      <small>Non ha ancora risposto</small>
                    </span>
                  </div>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      onAction({
                        type: 'remove-circle-member',
                        circle_id: selected.id,
                        user_id: profile.id,
                      })
                    }
                  >
                    Revoca invito
                  </button>
                </div>
              ) : null;
            })}
          </div>
        )}
        {myMembership?.role === 'admin' && inviteable.length > 0 && (
          <details className="circle-invite">
            <summary>
              <UserPlus size={17} /> Invita un contatto
            </summary>
            <div>
              {inviteable.map((profile) => (
                <button
                  key={profile.id}
                  disabled={busy}
                  onClick={() =>
                    onAction({ type: 'invite-circle', circle_id: selected.id, user_id: profile.id })
                  }
                >
                  <Avatar person={profile} />
                  <span>{profile.display_name}</span>
                  <Plus size={16} />
                </button>
              ))}
            </div>
          </details>
        )}
        <div className="circle-feed">
          {posts.map((post: Post, index) => (
            <PostCard
              key={post.id}
              post={post}
              state={state}
              demo={demo}
              priority={index === 0}
              now={now}
              onAction={onAction}
              onProfile={onProfile}
              onTag={onTag}
            />
          ))}
          {!posts.length && (
            <Empty kind="feed" title="Qui non avete ancora scritto.">
              Apri la conversazione con un post visibile solo alle persone di questa cerchia.
            </Empty>
          )}
        </div>
      </section>
    );

  return (
    <section className="circles-overview" aria-label="Le tue cerchie">
      {invites.length > 0 && (
        <div className="circle-invitations">
          <h2>Inviti</h2>
          {invites.map((invite) => {
            const circle = circles.find((item) => item.id === invite.circle_id);
            const inviter = state.profiles.find((person) => person.id === invite.invited_by);
            return circle ? (
              <article key={circle.id}>
                <div className="circle-mark" aria-hidden="true">
                  {circle.name.slice(0, 2).toLocaleUpperCase('it')}
                </div>
                <div>
                  <strong>{circle.name}</strong>
                  <span>
                    {inviter ? `${inviter.display_name} ti ha invitato` : 'Hai ricevuto un invito'}
                  </span>
                </div>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    onAction({ type: 'respond-circle', circle_id: circle.id, accept: true })
                  }
                >
                  <Check size={16} /> Accetta
                </button>
                <button
                  className="icon-button"
                  aria-label={`Rifiuta l’invito a ${circle.name}`}
                  disabled={busy}
                  onClick={() =>
                    onAction({ type: 'respond-circle', circle_id: circle.id, accept: false })
                  }
                >
                  <X size={17} />
                </button>
              </article>
            ) : null;
          })}
        </div>
      )}
      <div className="circles-toolbar">
        <div>
          <h2>Spazi condivisi</h2>
          <p>Post e conversazioni restano tra le persone invitate.</p>
        </div>
        <button className="primary" onClick={() => setCreating((value) => !value)}>
          <Plus size={17} /> Nuova cerchia
        </button>
      </div>
      {creating && (
        <form className="circle-create" onSubmit={createCircle}>
          <label>
            Nome
            <input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Per esempio: Tavolo lungo"
            />
          </label>
          <label>
            Descrizione <small>facoltativa</small>
            <textarea
              maxLength={240}
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Di cosa parlate qui?"
            />
          </label>
          <div className="button-row">
            <button className="primary" disabled={busy || !name.trim()}>
              Crea la cerchia
            </button>
            <button type="button" className="secondary" onClick={() => setCreating(false)}>
              Annulla
            </button>
          </div>
        </form>
      )}
      <div className="circle-list">
        {mine.map((circle: Circle) => {
          const count = memberships.filter(
            (member) => member.circle_id === circle.id && member.status === 'active',
          ).length;
          return (
            <button key={circle.id} onClick={() => setSelectedId(circle.id)}>
              <span className="circle-mark" aria-hidden="true">
                {circle.name.slice(0, 2).toLocaleUpperCase('it')}
              </span>
              <span>
                <strong>{circle.name}</strong>
                <small>{circle.description || 'Uno spazio privato tra voi.'}</small>
              </span>
              <span className="circle-count">
                <Users size={15} /> {count}
              </span>
            </button>
          );
        })}
      </div>
      {!mine.length && !creating && (
        <Empty kind="feed" title="Crea uno spazio per le persone che senti davvero.">
          Le cerchie sono private, su invito e senza suggerimenti automatici.
        </Empty>
      )}
    </section>
  );
}

'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, LogOut, Plus, UserRoundMinus, Users, X } from 'lucide-react';
import type { ChatGroupsState, Profile } from '@/lib/core/types';
import { Avatar, Empty } from './primitives';
import { GroupChatConversation } from './group-chat-conversation';

const demoGroupId = '30000000-0000-4000-8000-000000000001';

function demoGroups(me: Profile, eligible: Profile[]): ChatGroupsState {
  return {
    groups: [
      {
        id: demoGroupId,
        name: 'Fine settimana',
        created_by: me.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    members: [me, ...eligible.slice(0, 2)].map((person, index) => ({
      group_id: demoGroupId,
      user_id: person.id,
      role: index === 0 ? 'admin' : 'member',
      joined_at: new Date().toISOString(),
    })),
    invites: [],
  };
}

async function groupsRequest(body?: unknown): Promise<ChatGroupsState> {
  const response = await fetch(
    '/api/chat/groups',
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Operazione non riuscita.');
  return value;
}

export function GroupChatPanel({
  demo,
  me,
  profiles,
  eligible,
  onNotice,
}: {
  demo: boolean;
  me: Profile;
  profiles: Profile[];
  eligible: Profile[];
  onNotice: (message: string) => void;
}) {
  const [state, setState] = useState<ChatGroupsState | null>(() =>
    demo ? demoGroups(me, eligible) : null,
  );
  const [selected, setSelected] = useState<string | null>(demo ? demoGroupId : null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [rename, setRename] = useState('');
  const [invitee, setInvitee] = useState('');
  const load = useCallback(() => {
    if (demo) return;
    groupsRequest()
      .then((next) => {
        setState(next);
        setSelected((current) => current ?? next.groups[0]?.id ?? null);
      })
      .catch((error) => onNotice(error.message));
  }, [demo, onNotice]);
  useEffect(load, [load]);
  const mutate = async (action: unknown) => {
    setBusy(true);
    try {
      if (demo) {
        const value = action as {
          action: string;
          groupId?: string;
          userId?: string;
          name?: string;
          role?: 'admin' | 'member';
        };
        const current = state ?? demoGroups(me, eligible);
        if (value.action === 'create' && value.name) {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();
          const next = {
            ...current,
            groups: [
              { id, name: value.name.trim(), created_by: me.id, created_at: now, updated_at: now },
              ...current.groups,
            ],
            members: [
              { group_id: id, user_id: me.id, role: 'admin' as const, joined_at: now },
              ...current.members,
            ],
          };
          setState(next);
          setSelected(id);
          return;
        }
        if (value.action === 'leave' && value.groupId) {
          const next = {
            ...current,
            groups: current.groups.filter((item) => item.id !== value.groupId),
            members: current.members.filter((member) => member.group_id !== value.groupId),
          };
          setState(next);
          setSelected(next.groups[0]?.id ?? null);
          return;
        }
        if (value.action === 'rename' && value.groupId && value.name) {
          setState({
            ...current,
            groups: current.groups.map((item) =>
              item.id === value.groupId
                ? { ...item, name: value.name!.trim(), updated_at: new Date().toISOString() }
                : item,
            ),
          });
          return;
        }
        if (value.action === 'invite' && value.groupId && value.userId) {
          setState({
            ...current,
            members: [
              ...current.members,
              {
                group_id: value.groupId,
                user_id: value.userId,
                role: 'member',
                joined_at: new Date().toISOString(),
              },
            ],
          });
          return;
        }
        if (value.action === 'role' && value.groupId && value.userId && value.role) {
          setState({
            ...current,
            members: current.members.map((member) =>
              member.group_id === value.groupId && member.user_id === value.userId
                ? { ...member, role: value.role! }
                : member,
            ),
          });
          return;
        }
        if (value.action === 'remove' && value.groupId && value.userId) {
          setState({
            ...current,
            members: current.members.filter(
              (member) => member.group_id !== value.groupId || member.user_id !== value.userId,
            ),
          });
          return;
        }
      }
      const next = await groupsRequest(action);
      setState(next);
      setSelected((current) =>
        current && next.groups.some((group) => group.id === current)
          ? current
          : (next.groups[0]?.id ?? null),
      );
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };
  const group = state?.groups.find((item) => item.id === selected);
  const members = useMemo(
    () => state?.members.filter((member) => member.group_id === selected) ?? [],
    [state, selected],
  );
  const admin = members.some((member) => member.user_id === me.id && member.role === 'admin');
  const candidates = eligible.filter(
    (person) => !members.some((member) => member.user_id === person.id),
  );
  const pending = state?.invites.filter((invite) => invite.group_id === selected) ?? [];
  if (!state) return <p className="fine">Caricamento dei gruppi…</p>;
  return (
    <div className="group-chat-panel">
      <form
        className="group-create"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void mutate({ action: 'create', name }).then(() => setName(''));
        }}
      >
        <label htmlFor="group-name">Nuovo gruppo</label>
        <div>
          <input
            id="group-name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome del gruppo"
          />
          <button className="secondary" disabled={busy || !name.trim()}>
            <Plus size={15} /> Crea
          </button>
        </div>
      </form>
      {state.invites
        .filter((invite) => invite.invitee_id === me.id)
        .map((invite) => {
          const target = state.groups.find((item) => item.id === invite.group_id);
          const inviter = profiles.find((person) => person.id === invite.inviter_id);
          return (
            <div className="group-invite" key={invite.group_id}>
              <p>
                <strong>Invito a un gruppo</strong>
                <span>
                  {inviter?.display_name ?? 'Una persona che segui'} ti ha invitato
                  {target ? ` in ${target.name}` : ''}.
                </span>
              </p>
              <button
                aria-label="Accetta invito"
                disabled={busy}
                onClick={() =>
                  mutate({ action: 'respond', groupId: invite.group_id, accept: true })
                }
              >
                <Check size={16} />
              </button>
              <button
                aria-label="Rifiuta invito"
                disabled={busy}
                onClick={() =>
                  mutate({ action: 'respond', groupId: invite.group_id, accept: false })
                }
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      <div className="group-tabs" aria-label="I tuoi gruppi">
        {state.groups.map((item) => (
          <button
            key={item.id}
            className={selected === item.id ? 'selected' : ''}
            onClick={() => setSelected(item.id)}
          >
            <Users size={15} />
            {item.name}
          </button>
        ))}
      </div>
      {!group ? (
        <Empty title="Nessun gruppo, per ora." kind="messages">
          Creane uno e invita una persona che segui a vicenda.
        </Empty>
      ) : (
        <section className="group-detail">
          <div className="group-detail-heading">
            <div>
              <span>Gruppo</span>
              <h3>{group.name}</h3>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => mutate({ action: 'leave', groupId: group.id })}
            >
              <LogOut size={15} /> Abbandona
            </button>
          </div>
          {admin && (
            <form
              className="group-rename"
              onSubmit={(event) => {
                event.preventDefault();
                if (!rename.trim()) return;
                void mutate({ action: 'rename', groupId: group.id, name: rename }).then(() =>
                  setRename(''),
                );
              }}
            >
              <label htmlFor="group-rename">Rinomina</label>
              <input
                id="group-rename"
                value={rename}
                maxLength={60}
                placeholder={group.name}
                onChange={(event) => setRename(event.target.value)}
              />
              <button className="text-button" disabled={busy || !rename.trim()}>
                Salva
              </button>
            </form>
          )}
          {admin && candidates.length > 0 && (
            <div className="group-add">
              <label htmlFor="group-invite-person">Invita una persona</label>
              <select
                id="group-invite-person"
                value={invitee}
                onChange={(e) => setInvitee(e.target.value)}
              >
                <option value="">Scegli…</option>
                {candidates.map((person) => (
                  <option value={person.id} key={person.id}>
                    {person.display_name}
                  </option>
                ))}
              </select>
              <button
                className="secondary"
                disabled={busy || !invitee}
                onClick={() =>
                  mutate({ action: 'invite', groupId: group.id, userId: invitee }).then(() =>
                    setInvitee(''),
                  )
                }
              >
                Invita
              </button>
            </div>
          )}
          {admin && pending.length > 0 && (
            <p className="group-pending">
              {pending.length === 1 ? '1 invito in attesa' : `${pending.length} inviti in attesa`}
            </p>
          )}
          <ul className="group-members">
            {members.map((member) => {
              const person = profiles.find((item) => item.id === member.user_id);
              if (!person) return null;
              return (
                <li key={member.user_id}>
                  <Avatar person={person} size="small" />
                  <span>
                    <strong>{person.display_name}</strong>
                    <small>{member.role === 'admin' ? 'Admin' : 'Membro'}</small>
                  </span>
                  {admin && (
                    <select
                      aria-label={`Ruolo di ${person.display_name}`}
                      value={member.role}
                      disabled={busy}
                      onChange={(event) =>
                        mutate({
                          action: 'role',
                          groupId: group.id,
                          userId: member.user_id,
                          role: event.target.value,
                        })
                      }
                    >
                      <option value="member">Membro</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  {admin && member.user_id !== me.id && (
                    <button
                      aria-label={`Rimuovi ${person.display_name}`}
                      disabled={busy}
                      onClick={() =>
                        mutate({ action: 'remove', groupId: group.id, userId: member.user_id })
                      }
                    >
                      <UserRoundMinus size={16} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <GroupChatConversation
            key={group.id}
            demo={demo}
            groupId={group.id}
            me={me}
            members={members}
            profiles={profiles}
            onNotice={onNotice}
          />
        </section>
      )}
    </div>
  );
}

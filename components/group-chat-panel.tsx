'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, LogOut, Plus, UserRoundMinus, Users, X } from 'lucide-react';
import type { ChatGroupsState, Profile } from '@/lib/core/types';
import { Avatar, Empty } from './primitives';

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
  const [state, setState] = useState<ChatGroupsState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
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
  if (demo)
    return (
      <Empty title="I gruppi richiedono un account." kind="messages">
        Gli inviti e i ruoli devono essere verificati dal server.
      </Empty>
    );
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
          <p className="group-coming-soon">
            <Users size={16} /> I messaggi di gruppo saranno attivati insieme alla cifratura
            dedicata.
          </p>
        </section>
      )}
    </div>
  );
}

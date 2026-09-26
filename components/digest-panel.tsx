'use client';

import { useMemo, useState } from 'react';
import { BellRing, Check, Mail, Plus, Undo2, X } from 'lucide-react';
import type { Action, DigestItem, Snapshot } from '@/lib/core/types';

type Props = {
  state: Snapshot;
  busy: boolean;
  onAction: (action: Action) => Promise<boolean>;
};

const frequencyLabels = { daily: 'Ogni giorno', weekly: 'Ogni settimana' } as const;
const channelLabels = { in_app: 'Nell’app', email: 'Con un’email' } as const;

function reasonFor(item: DigestItem, state: Snapshot) {
  const post = state.posts.find((entry) => entry.id === item.post_id);
  return {
    reason: item.reason,
    body: post?.body ?? 'Questo post non è più disponibile nel digest.',
  };
}

export function DigestPanel({ state, busy, onAction }: Props) {
  const prefs = state.digestPreferences?.[0] ?? null;
  const sources = (state.digestSources ?? []).filter((item) => item.user_id === state.me.id);
  const delivery = (state.digestDeliveries ?? [])
    .filter((item) => item.user_id === state.me.id)
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0];
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('');
  const memberships = (state.circleMembers ?? []).filter(
    (member) => member.user_id === state.me.id && member.status === 'active',
  );
  const myCircles = (state.circles ?? []).filter(
    (circle) =>
      !circle.archived_at && memberships.some((member) => member.circle_id === circle.id),
  );
  const mutualPeople = useMemo(() => {
    const outgoing = new Set(
      state.follows
        .filter((follow) => follow.follower_id === state.me.id && follow.accepted)
        .map((follow) => follow.following_id),
    );
    return state.profiles.filter((profile) =>
      state.follows.some(
        (follow) =>
          follow.follower_id === profile.id &&
          follow.following_id === state.me.id &&
          follow.accepted &&
          outgoing.has(profile.id),
      ),
    );
  }, [state.follows, state.profiles, state.me.id]);

  const enabled = prefs?.enabled ?? false;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const channel = String(form.get('channel')) as 'in_app' | 'email';
    const email_consent = form.get('email_consent') === 'on';
    if (channel === 'email' && !email_consent) {
      setStatus('Per ricevere il digest via email serve un consenso separato.');
      return;
    }
    setStatus('');
    const ok = await onAction({
      type: 'digest-preferences',
      enabled: form.get('enabled') === 'on',
      frequency: String(form.get('frequency')) as 'daily' | 'weekly',
      time_slot: Number(form.get('time_slot')),
      timezone: String(form.get('timezone')) as 'Europe/Rome' | 'UTC',
      channel,
      email_consent,
    });
    setStatus(ok ? 'Preferenze del digest salvate.' : '');
  }

  async function toggleSource(
    source_type: 'circle' | 'person' | 'topic',
    source_id: string,
    next: boolean,
  ) {
    setStatus('');
    await onAction({ type: 'digest-source', source_type, source_id, enabled: next });
  }

  return (
    <section className="panel" aria-labelledby="digest-title">
      <h2 id="digest-title">Digest scelto da te</h2>
      <p className="muted">
        Al massimo cinque elementi recenti dalle cerchie, dalle persone e dagli argomenti che scegli.
        Niente sponsorizzazioni, punteggi nascosti o tracciamento delle aperture: conserviamo solo le
        preferenze e l’ultimo invio.
      </p>
      <form
        key={`${prefs?.updated_at ?? 'default'}-${enabled}`}
        onSubmit={save}
        aria-label="Preferenze del digest"
      >
        <label className="toggle-label">
          <span>
            <strong>Attiva il digest</strong>
            <small>Spento per impostazione predefinita. Puoi fermarlo quando vuoi.</small>
          </span>
          <input name="enabled" type="checkbox" defaultChecked={enabled} />
        </label>
        <label>
          Frequenza
          <select name="frequency" defaultValue={prefs?.frequency ?? 'weekly'}>
            {Object.entries(frequencyLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fascia oraria
          <select name="time_slot" defaultValue={String(prefs?.time_slot ?? 8)}>
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <label>
          Fuso orario
          <select name="timezone" defaultValue={prefs?.timezone ?? 'Europe/Rome'}>
            <option value="Europe/Rome">Europe/Rome</option>
            <option value="UTC">UTC</option>
          </select>
        </label>
        <label>
          Canale
          <select name="channel" defaultValue={prefs?.channel ?? 'in_app'}>
            {Object.entries(channelLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle-label">
          <span>
            <strong>Email separata</strong>
            <small>
              L’email è una scelta a parte e resta spenta finché non la consenti. Senza un canale
              configurato il digest arriva soltanto nell’app.
            </small>
          </span>
          <input name="email_consent" type="checkbox" defaultChecked={prefs?.email_consent ?? false} />
        </label>
        <button className="primary" disabled={busy}>
          Salva preferenze <Check size={17} />
        </button>
      </form>

      <h3>Da dove pesca</h3>
      <p className="muted fine">
        L’ordine è spiegabile: prima le cerchie scelte, poi le persone, quindi gli argomenti e,
        infine, gli altri post in ordine cronologico.
      </p>
      <div className="button-row">
        {myCircles.map((circle) => {
          const active = sources.some(
            (item) => item.source_type === 'circle' && item.source_id === circle.id && item.enabled,
          );
          return (
            <button
              key={circle.id}
              className={active ? 'secondary' : 'text-button'}
              disabled={busy}
              onClick={() => void toggleSource('circle', circle.id, !active)}
            >
              {circle.name} {active ? <Undo2 size={15} /> : <Plus size={15} />}
            </button>
          );
        })}
        {mutualPeople.map((person) => {
          const active = sources.some(
            (item) => item.source_type === 'person' && item.source_id === person.id && item.enabled,
          );
          return (
            <button
              key={person.id}
              className={active ? 'secondary' : 'text-button'}
              disabled={busy}
              onClick={() => void toggleSource('person', person.id, !active)}
            >
              @{person.username} {active ? <Undo2 size={15} /> : <Plus size={15} />}
            </button>
          );
        })}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = topic.trim();
          if (!value) return;
          void toggleSource('topic', value.replace(/^#/, ''), true);
          setTopic('');
        }}
      >
        <label>
          Argomento da seguire
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            maxLength={60}
            placeholder="#cucina"
          />
        </label>
        <button className="secondary" disabled={busy}>
          Aggiungi argomento <Plus size={16} />
        </button>
      </form>
      {sources.some((item) => item.source_type === 'topic') && (
        <ul className="group-members">
          {sources
            .filter((item) => item.source_type === 'topic')
            .map((item) => (
              <li key={`${item.source_type}-${item.source_id}`}>
                <span>#{item.source_id}</span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void toggleSource('topic', item.source_id, false)}
                >
                  Interrompi <X size={15} />
                </button>
              </li>
            ))}
        </ul>
      )}

      <h3>Ultimo digest</h3>
      {!delivery || delivery.items.length === 0 ? (
        <p className="muted">
          Ancora niente da mostrare. Attiva il digest e tocca «Aggiorna adesso» per una prova.
        </p>
      ) : (
        <ul className="digest-items">
          {delivery.items.map((item) => {
            const entry = reasonFor(item, state);
            return (
              <li key={item.post_id}>
                <p className="digest-reason">
                  <BellRing size={14} /> {entry.reason}
                </p>
                <p>{entry.body}</p>
              </li>
            );
          })}
        </ul>
      )}
      <button
        className="secondary"
        disabled={busy || !enabled}
        onClick={async () => {
          setStatus('');
          const ok = await onAction({ type: 'digest-refresh' });
          if (ok) setStatus('Digest aggiornato.');
        }}
      >
        <Mail size={16} /> Aggiorna adesso
      </button>
      {status && <p className="fine">{status}</p>}
    </section>
  );
}

'use client';

import { useState } from 'react';
import { Clock3, MapPin, Plus, Users, X } from 'lucide-react';
import type { Action, Event, Snapshot } from '@/lib/core/types';
import { Empty } from './primitives';

type Props = {
  state: Snapshot;
  busy: boolean;
  onAction: (action: Action) => Promise<boolean>;
};

const dateTime = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export function EventsPanel({ state, busy, onAction }: Props) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [capacity, setCapacity] = useState('');
  const [circleId, setCircleId] = useState('');
  const activeCircleIds = new Set(
    (state.circleMembers ?? [])
      .filter((member) => member.user_id === state.me.id && member.status === 'active')
      .map((member) => member.circle_id),
  );
  const circles = (state.circles ?? []).filter(
    (circle) => activeCircleIds.has(circle.id) && !circle.archived_at,
  );
  const events = [...(state.events ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  async function createEvent(event: React.FormEvent) {
    event.preventDefault();
    const ok = await onAction({
      type: 'create-event',
      circle_id: circleId || null,
      title,
      description,
      location,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      capacity: capacity ? Number(capacity) : null,
    });
    if (ok) {
      setCreating(false);
      setTitle('');
      setDescription('');
      setLocation('');
      setStartsAt('');
      setEndsAt('');
      setCapacity('');
      setCircleId('');
    }
  }

  return (
    <section className="events-panel" aria-labelledby="events-title">
      <header className="events-toolbar">
        <div>
          <h2 id="events-title">Prossimi incontri</h2>
          <p>Un posto e un’ora, senza biglietti né mappe esterne.</p>
        </div>
        <button className="primary" onClick={() => setCreating((value) => !value)}>
          {creating ? <X size={17} /> : <Plus size={17} />}
          {creating ? 'Chiudi' : 'Nuovo evento'}
        </button>
      </header>

      {creating && (
        <form className="event-create" onSubmit={createEvent}>
          <label>
            Titolo
            <input
              autoFocus
              required
              maxLength={100}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Pranzo della domenica"
            />
          </label>
          <label className="event-description">
            Dettagli <small>facoltativi</small>
            <textarea
              rows={3}
              maxLength={1200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Che cosa serve sapere?"
            />
          </label>
          <label>
            Inizio
            <input
              required
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <label>
            Fine <small>facoltativa</small>
            <input
              type="datetime-local"
              min={startsAt}
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
          <label>
            Luogo <small>facoltativo</small>
            <input
              maxLength={160}
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Per esempio: casa di Marco"
            />
          </label>
          <label>
            Posti <small>facoltativi</small>
            <input
              type="number"
              min={2}
              max={100}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              placeholder="Nessun limite"
            />
          </label>
          <label className="event-visibility">
            Chi può vederlo
            <select value={circleId} onChange={(event) => setCircleId(event.target.value)}>
              <option value="">I tuoi follower approvati</option>
              {circles.map((circle) => (
                <option key={circle.id} value={circle.id}>
                  Cerchia · {circle.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" disabled={busy || !title.trim() || !startsAt}>
            Crea evento
          </button>
        </form>
      )}

      <div className="event-list">
        {events.map((event) => (
          <EventRow key={event.id} event={event} state={state} busy={busy} onAction={onAction} />
        ))}
      </div>
      {!events.length && !creating && (
        <Empty kind="feed" title="Nessun incontro in programma.">
          Proponi un momento alle persone che segui o a una cerchia.
        </Empty>
      )}
    </section>
  );
}

function EventRow({ event, state, busy, onAction }: Props & { event: Event }) {
  const [message, setMessage] = useState('');
  const responses = (state.eventResponses ?? []).filter((item) => item.event_id === event.id);
  const mine = responses.find((item) => item.user_id === state.me.id)?.response;
  const going = responses.filter((item) => item.response === 'going').length;
  const circle = (state.circles ?? []).find((item) => item.id === event.circle_id);
  const organizer = state.profiles.find((profile) => profile.id === event.organizer_id);
  const updates = (state.eventUpdates ?? []).filter((item) => item.event_id === event.id);
  const isOrganizer = event.organizer_id === state.me.id;
  async function publishUpdate(submit: React.FormEvent) {
    submit.preventDefault();
    if (
      await onAction({
        type: 'event-update',
        event_id: event.id,
        kind: isOrganizer ? 'update' : 'comment',
        body: message,
      })
    )
      setMessage('');
  }
  return (
    <article className={`event-row${event.cancelled_at ? ' cancelled' : ''}`}>
      <time dateTime={event.starts_at}>
        <strong>{new Date(event.starts_at).getDate()}</strong>
        <span>
          {new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(new Date(event.starts_at))}
        </span>
      </time>
      <div className="event-body">
        <div className="event-heading">
          <div>
            <h3>{event.title}</h3>
            <p>
              {circle
                ? `Cerchia · ${circle.name}`
                : `Da ${organizer?.display_name ?? 'un contatto'}`}
            </p>
          </div>
          {event.cancelled_at && <span className="event-cancelled">Annullato</span>}
        </div>
        {event.description && <p className="event-copy">{event.description}</p>}
        <div className="event-facts">
          <span>
            <Clock3 size={15} /> {dateTime.format(new Date(event.starts_at))}
          </span>
          {event.location && (
            <span>
              <MapPin size={15} /> {event.location}
            </span>
          )}
          <span>
            <Users size={15} /> {going}
            {event.capacity ? ` / ${event.capacity}` : ''}{' '}
            {going === 1 ? 'partecipa' : 'partecipano'}
          </span>
        </div>
        {!event.cancelled_at && (
          <div className="event-responses" aria-label={`Rispondi a ${event.title}`}>
            {(
              [
                ['going', 'Partecipo'],
                ['maybe', 'Forse'],
                ['declined', 'Non riesco'],
              ] as const
            ).map(([response, label]) => (
              <button
                key={response}
                className={mine === response ? 'selected' : ''}
                aria-pressed={mine === response}
                disabled={busy}
                onClick={() => onAction({ type: 'respond-event', event_id: event.id, response })}
              >
                {label}
              </button>
            ))}
            {event.organizer_id === state.me.id && (
              <button
                className="text-button danger-text event-cancel"
                disabled={busy}
                onClick={() => onAction({ type: 'cancel-event', event_id: event.id })}
              >
                Annulla evento
              </button>
            )}
          </div>
        )}
        {updates.length > 0 && (
          <div className="event-thread" aria-label={`Conversazione su ${event.title}`}>
            {updates.map((update) => {
              const author = state.profiles.find((profile) => profile.id === update.author_id);
              return (
                <div key={update.id}>
                  <span>
                    <strong>{author?.display_name ?? 'Persona'}</strong>
                    {update.kind === 'update' && <small>Aggiornamento</small>}
                  </span>
                  <p>{update.body}</p>
                </div>
              );
            })}
          </div>
        )}
        {!event.cancelled_at && (
          <form className="event-message" onSubmit={publishUpdate}>
            <label>
              <span className="sr-only">
                {isOrganizer ? 'Aggiornamento per i partecipanti' : 'Commenta l’evento'}
              </span>
              <input
                value={message}
                onChange={(input) => setMessage(input.target.value)}
                maxLength={1200}
                placeholder={
                  isOrganizer ? 'Aggiornamento per i partecipanti' : 'Scrivi un commento'
                }
              />
            </label>
            <button className="secondary" disabled={busy || !message.trim()}>
              {isOrganizer ? 'Pubblica aggiornamento' : 'Invia'}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { KeyRound, MonitorSmartphone, ShieldCheck } from 'lucide-react';

type Factor = { id: string; friendly_name?: string; created_at: string };
type MfaState = { factors: Factor[]; currentLevel: string; nextLevel: string };
type Enrollment = { factorId: string; qrCode: string; secret: string };
type AccountSession = {
  id: string;
  created_at: string;
  last_seen_at: string;
  is_current: boolean;
};

async function mfaRequest(body?: unknown) {
  const response = await fetch(
    '/api/auth/mfa',
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
async function sessionsRequest(body?: unknown): Promise<AccountSession[]> {
  const response = await fetch(
    '/api/auth/sessions',
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
const sessionDate = (value: string) =>
  new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );

export function SecuritySettings({ demo }: { demo: boolean }) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (demo) return;
    Promise.all([mfaRequest(), sessionsRequest()])
      .then(([mfa, active]: [MfaState, AccountSession[]]) => {
        setFactors(mfa.factors);
        setSessions(active);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [demo]);

  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel security-panel">
      <div className="security-heading">
        <ShieldCheck size={20} aria-hidden="true" />
        <div>
          <h2>Verifica in due passaggi</h2>
          <p className="muted">
            Aggiungi un codice temporaneo oltre alla password. È consigliata per i moderatori.
          </p>
        </div>
      </div>
      {demo ? (
        <p className="muted fine">Puoi configurarla dopo aver effettuato l’accesso a un account.</p>
      ) : loading ? (
        <p role="status" className="muted fine">
          Controllo la protezione dell’account…
        </p>
      ) : factors.length > 0 ? (
        <div className="security-status">
          <p>
            <strong>Protezione attiva</strong>
            <span>Il codice sarà richiesto a ogni nuovo accesso.</span>
          </p>
          <button
            className="text-button danger-text"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                const value: MfaState = await mfaRequest({
                  action: 'unenroll',
                  factorId: factors[0].id,
                });
                setFactors(value.factors);
                setMessage('Verifica in due passaggi disattivata.');
              })
            }
          >
            Disattiva
          </button>
        </div>
      ) : enrollment ? (
        <div className="mfa-enrollment">
          <p>Scansiona il codice con la tua app authenticator.</p>
          <Image
            className="mfa-qr"
            src={enrollment.qrCode}
            width={184}
            height={184}
            unoptimized
            alt="Codice QR per configurare la verifica in due passaggi"
          />
          <details>
            <summary>Non riesci a scansionarlo?</summary>
            <p className="muted fine">Inserisci manualmente questa chiave nell’app:</p>
            <code className="mfa-secret">{enrollment.secret}</code>
          </details>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void perform(async () => {
                const value: MfaState = await mfaRequest({
                  action: 'verify',
                  factorId: enrollment.factorId,
                  code: form.get('code'),
                });
                setFactors(value.factors);
                setSessions(await sessionsRequest());
                setEnrollment(null);
                setMessage('Verifica in due passaggi attivata.');
              });
            }}
          >
            <label>
              Codice a sei cifre
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
              />
            </label>
            <div className="inline-actions">
              <button className="primary" disabled={busy}>
                Attiva protezione
              </button>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    await mfaRequest({ action: 'unenroll', factorId: enrollment.factorId });
                    setEnrollment(null);
                  })
                }
              >
                Annulla
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              setEnrollment(await mfaRequest({ action: 'enroll' }));
            })
          }
        >
          <KeyRound size={18} /> Configura l’app authenticator
        </button>
      )}
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
      {!demo && !loading && (
        <div className="account-sessions">
          <div className="session-heading">
            <div>
              <h3>Dispositivi e sessioni</h3>
              <p className="muted fine">Nessun indirizzo IP viene conservato per questa pagina.</p>
            </div>
            {sessions.some((session) => !session.is_current) && (
              <button
                className="text-button danger-text"
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    setSessions(await sessionsRequest({ action: 'revoke-others' }));
                    setMessage('Le altre sessioni sono state chiuse.');
                  })
                }
              >
                Chiudi le altre
              </button>
            )}
          </div>
          <div className="session-list">
            {sessions.map((session) => (
              <div className="session-row" key={session.id}>
                <MonitorSmartphone size={19} aria-hidden="true" />
                <p>
                  <strong>{session.is_current ? 'Questa sessione' : 'Altra sessione'}</strong>
                  <span>Ultimo accesso {sessionDate(session.last_seen_at)}</span>
                  <span>Avviata {sessionDate(session.created_at)}</span>
                </p>
                {!session.is_current && (
                  <button
                    className="text-button danger-text"
                    disabled={busy}
                    aria-label={`Termina la sessione avviata ${sessionDate(session.created_at)}`}
                    onClick={() =>
                      void perform(async () => {
                        setSessions(
                          await sessionsRequest({ action: 'revoke', sessionId: session.id }),
                        );
                        setMessage('Sessione terminata.');
                      })
                    }
                  >
                    Termina
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="muted fine session-note">
            Una sessione terminata non può rinnovarsi; un accesso già emesso può restare valido per
            un massimo di 5 minuti.
          </p>
        </div>
      )}
    </section>
  );
}

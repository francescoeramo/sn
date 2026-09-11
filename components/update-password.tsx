'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';

export function UpdatePassword({ valid }: { valid: boolean }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  if (!valid)
    return (
      <section className="auth-card account-card">
        <span className="eyebrow">RECUPERO ACCOUNT</span>
        <h1>Il link non è più valido.</h1>
        <p>Richiedi un nuovo link dalla schermata di accesso.</p>
        <Link className="primary" href="/">
          Torna all’accesso <ArrowRight size={18} />
        </Link>
      </section>
    );

  if (done)
    return (
      <section className="auth-card account-card">
        <LockKeyhole size={24} aria-hidden="true" />
        <span className="eyebrow">PASSWORD AGGIORNATA</span>
        <h1>Le sessioni sono state chiuse.</h1>
        <p>Accedi di nuovo con la nuova password su questo browser e sugli altri dispositivi.</p>
        <Link className="primary" href="/">
          Accedi <ArrowRight size={18} />
        </Link>
      </section>
    );

  return (
    <section className="auth-card account-card">
      <span className="eyebrow">RECUPERO ACCOUNT</span>
      <h1>Scegli una nuova password.</h1>
      <p>Usa almeno 12 caratteri. Dopo il cambio dovrai accedere di nuovo su ogni dispositivo.</p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage('');
          const form = new FormData(event.currentTarget);
          try {
            const response = await fetch('/api/auth/password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(Object.fromEntries(form)),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error);
            setDone(true);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Password non aggiornata.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nuova password
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Ripeti la password
          <input
            name="confirmation"
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            required
          />
        </label>
        {message && (
          <p className="form-message" role="alert">
            {message}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Aggiornamento…' : 'Cambia password'} <ArrowRight size={18} />
        </button>
      </form>
    </section>
  );
}

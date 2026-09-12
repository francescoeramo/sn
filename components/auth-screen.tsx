'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowRight, LockKeyhole } from 'lucide-react';
export function AuthScreen({
  configured,
  onLogin,
}: {
  configured: boolean;
  onLogin: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'recover' | 'mfa'>('login');
  const [factorId, setFactorId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const signup = mode === 'signup';
  const recover = mode === 'recover';
  const mfa = mode === 'mfa';
  useEffect(() => {
    if (!configured) return;
    fetch('/api/auth/mfa', { cache: 'no-store' })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (value?.mfaRequired && value.factors?.[0]?.id) {
          setFactorId(value.factors[0].id);
          setMode('mfa');
        }
      })
      .catch(() => undefined);
  }, [configured]);
  return (
    <main className="auth-screen">
      <div className="auth-story">
        <Link href="/" className="wordmark">
          sn<span>●</span>
        </Link>
        <span className="eyebrow">CI TROVIAMO QUI</span>
        <h1>
          Le persone.
          <br />
          Le cose da dire.
          <br />
          <em>Il tuo spazio.</em>
        </h1>
        <p>
          Una chiacchierata, un video, una giornata qualunque. SN è un piccolo social da abitare
          insieme.
        </p>
        <div className="auth-art" aria-hidden="true">
          <span>ciao!</span>
          <span>ci sei?</span>
          <span>☀</span>
        </div>
        <div className="auth-caption">
          <LockKeyhole size={16} /> Accesso su invito · Nessuna pubblicità
        </div>
      </div>
      <section className="auth-card">
        {!configured ? (
          <>
            <span className="eyebrow">STIAMO PREPARANDO CASA</span>
            <h2>Un primo giro?</h2>
            <p>
              La beta non è ancora online. Puoi esplorare la demo, scrivere un post e provare le
              funzioni.
            </p>
            <p className="muted">
              I profili sono inventati. Le modifiche rimangono solo in questo browser.
            </p>
            <Link href="/demo" className="primary">
              Esplora la demo <ArrowUpRight size={18} />
            </Link>
          </>
        ) : (
          <>
            <span className="eyebrow">BETA PRIVATA</span>
            <h2>
              {signup
                ? 'C’è posto per te.'
                : recover
                  ? 'Recupera l’accesso.'
                  : mfa
                    ? 'Un ultimo controllo.'
                    : 'Bentornato.'}
            </h2>
            <p>
              {signup
                ? 'Usa il codice che hai ricevuto da chi ti ha invitato.'
                : recover
                  ? 'Inserisci la tua email. Se è associata a un account, riceverai un link.'
                  : mfa
                    ? 'Inserisci il codice a sei cifre mostrato dalla tua app authenticator.'
                    : 'Accedi e ritrova i tuoi amici.'}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMessage('');
                const form = new FormData(e.currentTarget);
                try {
                  const route = mfa ? 'mfa' : recover ? 'recover' : signup ? 'signup' : 'login';
                  const response = await fetch(`/api/auth/${route}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(
                      mfa
                        ? { action: 'verify', factorId, code: form.get('code') }
                        : Object.fromEntries(form),
                    ),
                  });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error);
                  if (mfa) await onLogin();
                  else if (recover)
                    setMessage(
                      'Se l’indirizzo appartiene a un account, riceverai un link valido per 15 minuti.',
                    );
                  else if (result.confirmationRequired)
                    setMessage('Controlla la tua email e conferma l’indirizzo prima di accedere.');
                  else if (result.mfaRequired) {
                    setFactorId(result.factorId);
                    setMode('mfa');
                  } else await onLogin();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Accesso non riuscito.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {!mfa && (
                <label>
                  Email
                  <input name="email" type="email" autoComplete="email" required maxLength={254} />
                </label>
              )}
              {signup && (
                <>
                  <label>
                    Nome utente
                    <input
                      name="username"
                      autoComplete="username"
                      required
                      pattern="[a-z0-9_]{3,24}"
                      minLength={3}
                      maxLength={24}
                      placeholder="es. francesco"
                    />
                  </label>
                  <label>
                    Codice invito
                    <input
                      name="invite"
                      autoComplete="off"
                      required
                      minLength={32}
                      maxLength={128}
                    />
                  </label>
                </>
              )}
              {!recover && !mfa && (
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                  />
                  {signup && <small>Almeno 12 caratteri.</small>}
                </label>
              )}
              {mfa && (
                <label>
                  Codice di verifica
                  <input
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    required
                    autoFocus
                  />
                </label>
              )}
              {signup && (
                <label className="check-label">
                  <input type="checkbox" required /> Ho letto l’
                  <Link href="/privacy" target="_blank">
                    informativa sulla privacy
                  </Link>{' '}
                  e le regole della beta.
                </label>
              )}
              {message && (
                <p role="status" className="form-message">
                  {message}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? 'Un momento…'
                  : signup
                    ? 'Crea account'
                    : recover
                      ? 'Invia il link'
                      : mfa
                        ? 'Verifica'
                        : 'Accedi'}
                <ArrowRight size={18} />
              </button>
            </form>
            {!signup && !recover && !mfa && (
              <button
                className="text-button"
                onClick={() => {
                  setMode('recover');
                  setMessage('');
                }}
              >
                Hai dimenticato la password?
              </button>
            )}
            {mfa ? (
              <button
                className="text-button"
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  setFactorId('');
                  setMode('login');
                  setMessage('');
                }}
              >
                Esci e torna all’accesso
              </button>
            ) : (
              <button
                className="text-button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setMessage('');
                }}
              >
                {signup || recover ? 'Torna all’accesso' : 'Hai un invito? Registrati'}
              </button>
            )}
            <Link href="/demo" className="subtle-link">
              Preferisci dare un’occhiata? Prova la demo
            </Link>
          </>
        )}
        <footer>
          <Link href="/privacy">Privacy e regole</Link>
          <span>SN · Beta 0.1</span>
        </footer>
      </section>
    </main>
  );
}

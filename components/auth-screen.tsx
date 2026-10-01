'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowRight, LockKeyhole, Check, X } from 'lucide-react';
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
  const [password, setPassword] = useState('');
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
        <div className="auth-caption">
          <LockKeyhole size={16} /> Accesso su invito · Nessuna pubblicità
        </div>
      </div>
      <section className="auth-card">
        {!configured ? (
          <>
            <h2>Prova la demo</h2>
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
            <h2>
              {signup
                ? 'Crea il tuo account.'
                : recover
                  ? 'Recupera l’accesso.'
                  : mfa
                    ? 'Verifica l’accesso.'
                    : 'Accedi.'}
            </h2>
            <p>
              {signup
                ? 'Usa il codice che hai ricevuto da chi ti ha invitato.'
                : recover
                  ? 'Inserisci la tua email. Se è associata a un account, riceverai un link.'
                  : mfa
                    ? 'Inserisci il codice a sei cifre mostrato dalla tua app authenticator.'
                    : 'Inserisci email e password.'}
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
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : mfa
                        ? 'Codice non verificato. Controlla le sei cifre e riprova.'
                        : recover
                          ? 'Link non richiesto. Controlla l’indirizzo email e riprova.'
                          : signup
                            ? 'Account non creato. Controlla i campi e il codice invito.'
                            : 'Accesso non riuscito. Controlla email e password e riprova.',
                  );
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
                      pattern="[a-z0-9_.]{3,24}"
                      minLength={3}
                      maxLength={24}
                      placeholder="es. francesco.rossi"
                      aria-describedby="username-help"
                    />
                    <small id="username-help">
                      3–24 caratteri: lettere minuscole, numeri, _ e .
                    </small>
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
                    minLength={signup ? 8 : 1}
                    maxLength={128}
                    autoComplete={signup ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-describedby={signup ? 'password-requirements' : undefined}
                  />
                  {signup && (
                    <ul
                      id="password-requirements"
                      className="password-requirements"
                      aria-live="polite"
                    >
                      {[
                        ['8 o più caratteri', password.length >= 8],
                        ['Almeno una lettera minuscola', /[a-z]/.test(password)],
                        ['Almeno una lettera maiuscola', /[A-Z]/.test(password)],
                        ['Almeno un numero', /[0-9]/.test(password)],
                      ].map(([label, valid]) => (
                        <li className={valid ? 'valid' : ''} key={String(label)}>
                          {valid ? <Check size={15} /> : <X size={15} />}
                          {label}
                        </li>
                      ))}
                    </ul>
                  )}
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

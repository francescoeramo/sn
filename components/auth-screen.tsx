'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, ArrowRight, LockKeyhole } from 'lucide-react';
export function AuthScreen({
  configured,
  onLogin,
}: {
  configured: boolean;
  onLogin: () => Promise<void>;
}) {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
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
            <h2>{signup ? 'C’è posto per te.' : 'Bentornato.'}</h2>
            <p>
              {signup
                ? 'Usa il codice che hai ricevuto da chi ti ha invitato.'
                : 'Accedi e ritrova i tuoi amici.'}
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setMessage('');
                const form = new FormData(e.currentTarget);
                try {
                  const response = await fetch(`/api/auth/${signup ? 'signup' : 'login'}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(form)),
                  });
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.error);
                  if (result.confirmationRequired)
                    setMessage('Controlla la tua email e conferma l’indirizzo prima di accedere.');
                  else await onLogin();
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : 'Accesso non riuscito.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Email
                <input name="email" type="email" autoComplete="email" required maxLength={254} />
              </label>
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
                {busy ? 'Un momento…' : signup ? 'Crea account' : 'Accedi'}
                <ArrowRight size={18} />
              </button>
            </form>
            <button
              className="text-button"
              onClick={() => {
                setSignup(!signup);
                setMessage('');
              }}
            >
              {signup ? 'Hai già un account? Accedi' : 'Hai un invito? Registrati'}
            </button>
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

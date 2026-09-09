'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <h1>La pagina non si è caricata.</h1>
        <p>I tuoi dati salvati restano disponibili.</p>
        <button className="primary" onClick={reset}>
          Riprova
        </button>
      </div>
    </main>
  );
}

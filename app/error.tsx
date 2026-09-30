'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <h1>SN non ha completato il caricamento.</h1>
        <p>I dati già salvati non sono stati cancellati. Riprova a caricare questa pagina.</p>
        <button className="primary" onClick={reset}>
          Riprova
        </button>
      </div>
    </main>
  );
}

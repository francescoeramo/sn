import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth-screen">
      <div className="auth-card">
        <h1>Qui non c’è una pagina.</h1>
        <Link className="primary" href="/">
          Torna su SN
        </Link>
      </div>
    </main>
  );
}

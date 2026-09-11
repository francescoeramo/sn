import type { Metadata } from 'next';
import { UpdatePassword } from '@/components/update-password';
import { database } from '@/lib/server/supabase';

export const metadata: Metadata = { title: 'Nuova password · SN' };

export default async function PasswordPage() {
  let valid = false;
  try {
    const db = await database();
    const result = await db.auth.getUser();
    valid = Boolean(result.data.user && !result.error);
  } catch {
    // The same screen covers missing, expired and unavailable recovery sessions.
  }
  return (
    <main className="account-screen">
      <UpdatePassword valid={valid} />
    </main>
  );
}

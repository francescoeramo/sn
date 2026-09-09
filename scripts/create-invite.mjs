import { randomBytes, createHash } from 'node:crypto';
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  console.error('Uso: node scripts/create-invite.mjs amico@example.com');
  process.exit(1);
}
const token = randomBytes(32).toString('hex');
const hash = createHash('sha256').update(token).digest('hex');
console.log(
  `Codice invito (consegnalo privatamente, non salvarlo nel repository):\n${token}\n\nEsegui questa query nel progetto Supabase SN:\ninsert into private.invites(token_hash, email) values ('${hash}', '${email.replaceAll("'", "''")}');\n\nL’invito scade dopo 7 giorni ed è valido una sola volta per questa email.`,
);

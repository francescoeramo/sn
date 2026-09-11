import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const usage = `Uso:
  SUPABASE_DB_URL='postgresql://…' SN_BACKUP_RECIPIENT='chiave-o-email-gpg' npm run backup -- /percorso/esterno

Il comando crea un archivio cifrato .tar.gz.gpg. La destinazione deve essere assoluta e fuori dal repository.`;

if (process.argv.includes('--help')) {
  console.log(usage);
  process.exit(0);
}

const databaseUrl = process.env.SUPABASE_DB_URL;
const recipient = process.env.SN_BACKUP_RECIPIENT;
const destination = process.argv[2];
if (!databaseUrl || !recipient || !destination) throw new Error(usage);
if (!isAbsolute(destination))
  throw new Error('La cartella di backup deve avere un percorso assoluto.');

const outputDir = resolve(destination);
const fromProject = relative(process.cwd(), outputDir);
if (!fromProject.startsWith('..') || fromProject === '')
  throw new Error('Conserva i backup fuori dal repository SN.');
if (outputDir.split('/').filter(Boolean).length < 3)
  throw new Error('Scegli una cartella dedicata, non una directory di sistema o personale ampia.');

const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const temporary = mkdtempSync(`${tmpdir()}/sn-backup-`);
const archive = `${temporary}/sn-${stamp}.tar.gz`;
const encrypted = `${outputDir}/sn-${stamp}.tar.gz.gpg`;
const files = ['roles.sql', 'schema.sql', 'data.sql'];

function supabaseDump(...args) {
  execFileSync('npx', ['supabase', 'db', 'dump', '--db-url', databaseUrl, ...args], {
    stdio: 'inherit',
  });
}

try {
  execFileSync('gpg', ['--batch', '--list-keys', recipient], { stdio: 'ignore' });
  mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  supabaseDump('--file', `${temporary}/roles.sql`, '--role-only');
  supabaseDump('--file', `${temporary}/schema.sql`);
  supabaseDump(
    '--file',
    `${temporary}/data.sql`,
    '--use-copy',
    '--data-only',
    '--exclude',
    'storage.buckets_vectors',
    '--exclude',
    'storage.vector_indexes',
  );
  const checksums = Object.fromEntries(
    files.map((file) => [
      file,
      createHash('sha256')
        .update(readFileSync(`${temporary}/${file}`))
        .digest('hex'),
    ]),
  );
  writeFileSync(
    `${temporary}/manifest.json`,
    JSON.stringify({ createdAt: new Date().toISOString(), checksums }, null, 2),
    { mode: 0o600 },
  );
  execFileSync('tar', ['-C', temporary, '-czf', archive, ...files, 'manifest.json']);
  execFileSync('gpg', [
    '--batch',
    '--yes',
    '--trust-model',
    'always',
    '--recipient',
    recipient,
    '--output',
    encrypted,
    '--encrypt',
    archive,
  ]);
  chmodSync(encrypted, 0o600);
  console.log(`Backup cifrato creato: ${encrypted}`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

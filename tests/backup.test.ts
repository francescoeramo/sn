import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = 'scripts/backup.mjs';

describe('Backup cifrato', () => {
  it('documenta gli argomenti senza richiedere credenziali', () => {
    const result = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('SN_BACKUP_RECIPIENT');
  });

  it('rifiuta destinazioni relative o interne al repository prima della connessione', () => {
    const env = {
      ...process.env,
      SUPABASE_DB_URL: 'postgresql://example.invalid/database',
      SN_BACKUP_RECIPIENT: 'backup@example.test',
    };
    const relative = spawnSync(process.execPath, [script, 'backup'], { encoding: 'utf8', env });
    expect(relative.status).not.toBe(0);
    expect(relative.stderr).toContain('percorso assoluto');
    const internal = spawnSync(process.execPath, [script, process.cwd()], {
      encoding: 'utf8',
      env,
    });
    expect(internal.status).not.toBe(0);
    expect(internal.stderr).toContain('fuori dal repository');
  });
});

import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  downloadStorageObjects,
  safeStoragePath,
  storageObjectUrl,
} from '../scripts/backup-storage.mjs';

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
      SUPABASE_URL: 'https://example.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
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

  it('rifiuta nomi Storage che possono uscire dalla cartella temporanea', () => {
    for (const name of ['../segreto', 'utente/../../segreto', '/assoluto', 'utente\\file'])
      expect(() => safeStoragePath('/tmp/sn-storage-test', name)).toThrow('non valido');
    expect(safeStoragePath('/tmp/sn-storage-test', 'utente/foto.webp')).toBe(
      '/tmp/sn-storage-test/utente/foto.webp',
    );
  });

  it('codifica ogni segmento dell’URL Storage', () => {
    expect(storageObjectUrl('https://project.example', 'media', 'utente/foto estate.webp')).toBe(
      'https://project.example/storage/v1/object/authenticated/media/utente/foto%20estate.webp',
    );
    expect(() => storageObjectUrl('http://project.example', 'media', 'foto.webp')).toThrow('HTTPS');
  });

  it('scarica cartelle e oggetti Storage senza scrivere le credenziali nei file', async () => {
    const destination = mkdtempSync(join(tmpdir(), 'sn-storage-test-'));
    const requests: { url: string; authorization: string | null }[] = [];
    const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      requests.push({ url, authorization: headers.get('authorization') });
      if (url.includes('/object/list/')) {
        const prefix = JSON.parse(String(init?.body)).prefix;
        return Response.json(
          prefix
            ? [{ id: 'object-1', name: 'foto.webp', metadata: { size: 4 } }]
            : [{ id: null, name: 'utente', metadata: null }],
        );
      }
      return new Response(new Uint8Array([1, 2, 3, 4]));
    };
    try {
      const seen: string[] = [];
      const result = await downloadStorageObjects({
        fetcher,
        projectUrl: 'https://project.example',
        serviceKey: 'service-secret',
        bucket: 'media',
        destination,
        onObject: (name: string) => seen.push(name),
      });
      expect(result).toEqual({ objects: 1, bytes: 4 });
      expect(seen).toEqual(['utente/foto.webp']);
      expect([...readFileSync(join(destination, 'utente/foto.webp'))]).toEqual([1, 2, 3, 4]);
      expect(requests.every((request) => request.authorization === 'Bearer service-secret')).toBe(
        true,
      );
      expect(readFileSync(join(destination, 'utente/foto.webp'), 'utf8')).not.toContain(
        'service-secret',
      );
    } finally {
      rmSync(destination, { recursive: true, force: true });
    }
  });
});

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

const PAGE_SIZE = 1000;
const MAX_OBJECTS = 100000;
const MAX_BYTES = 800 * 1024 * 1024;

function storageOrigin(projectUrl) {
  const origin = new URL(projectUrl);
  if (origin.protocol !== 'https:' && origin.hostname !== '127.0.0.1')
    throw new Error('SUPABASE_URL deve usare HTTPS.');
  return origin;
}

export function safeStoragePath(root, name) {
  if (
    typeof name !== 'string' ||
    !name ||
    name.includes('\\') ||
    name.includes('\0') ||
    name.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error('Nome oggetto Storage non valido.');
  const target = resolve(root, ...name.split('/'));
  const prefix = `${resolve(root)}${sep}`;
  if (!target.startsWith(prefix)) throw new Error('Nome oggetto Storage non valido.');
  return target;
}

export function storageObjectUrl(projectUrl, bucket, name) {
  const origin = storageOrigin(projectUrl);
  const path = [bucket, ...name.split('/')].map(encodeURIComponent).join('/');
  return new URL(`/storage/v1/object/authenticated/${path}`, origin).href;
}

async function storageRequest(fetcher, url, serviceKey, init = {}) {
  const response = await fetcher(url, {
    ...init,
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Storage ha risposto ${response.status}.`);
  return response;
}

export async function listStorageObjects({ fetcher = fetch, projectUrl, serviceKey, bucket }) {
  const origin = storageOrigin(projectUrl);
  const pending = [''];
  const objects = [];
  while (pending.length) {
    const prefix = pending.pop();
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const response = await storageRequest(
        fetcher,
        new URL(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, origin).href,
        serviceKey,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prefix,
            limit: PAGE_SIZE,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          }),
        },
      );
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Risposta Storage non valida.');
      for (const row of rows) {
        if (!row || typeof row.name !== 'string') throw new Error('Risposta Storage non valida.');
        const name = prefix ? `${prefix}/${row.name}` : row.name;
        if (row.id == null && row.metadata == null) pending.push(name);
        else objects.push(name);
        if (objects.length > MAX_OBJECTS) throw new Error('Troppi oggetti Storage nel backup.');
      }
      if (rows.length < PAGE_SIZE) break;
    }
  }
  return objects.sort();
}

export async function downloadStorageObjects({
  fetcher = fetch,
  projectUrl,
  serviceKey,
  bucket,
  destination,
  onObject,
}) {
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  const names = await listStorageObjects({ fetcher, projectUrl, serviceKey, bucket });
  let bytes = 0;
  for (const name of names) {
    const response = await storageRequest(
      fetcher,
      storageObjectUrl(projectUrl, bucket, name),
      serviceKey,
    );
    const body = Buffer.from(await response.arrayBuffer());
    bytes += body.byteLength;
    if (bytes > MAX_BYTES)
      throw new Error('Il bucket supera il limite di backup della beta (800 MiB).');
    const target = safeStoragePath(destination, name);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, body, { mode: 0o600 });
    onObject?.(name, body);
  }
  return { objects: names.length, bytes };
}

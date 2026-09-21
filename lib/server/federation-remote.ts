import 'server-only';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { isPublicFederationAddress } from '@/lib/core/federation-network';
import { adminDatabase, ApiError } from './supabase';

async function requireAllowedInstance(hostname: string) {
  const { data, error } = await adminDatabase().rpc('federation_instance_blocked', {
    candidate: hostname,
  });
  if (error) throw new ApiError('Blocklist federata non disponibile.', 503);
  if (data) throw new ApiError('Istanza federata bloccata.', 403);
}

async function requirePublicHost(url: URL) {
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname)
    throw new ApiError('Indirizzo federato non valido.', 400);
  await requireAllowedInstance(url.hostname);
  const directFamily = isIP(url.hostname);
  const addresses = directFamily
    ? [{ address: url.hostname, family: directFamily }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicFederationAddress(address)))
    throw new ApiError('Indirizzo federato non consentito.', 400);
  await requireAllowedInstance(url.hostname);
  return addresses[0];
}

export async function requirePublicFederationUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError('Indirizzo federato non valido.', 400);
  }
  await requirePublicHost(url);
  return url;
}

export type RemoteActorKey = {
  actor: string;
  inbox: string;
  publicKeyPem: string;
  cached: boolean;
};

async function fetchPinnedActor(url: URL) {
  const pinned = await requirePublicHost(url);
  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/activity+json' },
        signal: AbortSignal.timeout(5000),
        lookup: (_hostname, _options, callback) =>
          callback(null, pinned.address, pinned.family as 4 | 6),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const contentType = response.headers['content-type'] ?? '';
        if (
          status < 200 ||
          status >= 300 ||
          (!contentType.startsWith('application/activity+json') &&
            !contentType.startsWith('application/ld+json'))
        ) {
          response.resume();
          reject(new ApiError('Attore remoto non raggiungibile.', 401));
          return;
        }
        const chunks: Uint8Array[] = [];
        let length = 0;
        response.on('data', (chunk: Buffer) => {
          length += chunk.length;
          if (length > 65536) {
            response.destroy(new ApiError('Documento dell’attore remoto troppo grande.', 401));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      },
    );
    request.on('error', (error) =>
      reject(
        error instanceof ApiError ? error : new ApiError('Attore remoto non raggiungibile.', 401),
      ),
    );
    request.end();
  });
  await requireAllowedInstance(url.hostname);
  return bytes;
}

export async function postPinnedFederationActivity(
  url: URL,
  headers: Record<string, string>,
  body: string,
) {
  const pinned = await requirePublicHost(url);
  const status = await new Promise<number>((resolve, reject) => {
    const request = httpsRequest(
      url,
      {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(10000),
        lookup: (_hostname, _options, callback) =>
          callback(null, pinned.address, pinned.family as 4 | 6),
      },
      (response) => {
        let length = 0;
        response.on('data', (chunk: Buffer) => {
          length += chunk.length;
          if (length > 65536)
            response.destroy(new ApiError('Risposta federata troppo grande.', 502));
        });
        response.on('end', () => resolve(response.statusCode ?? 0));
        response.on('error', reject);
      },
    );
    request.on('error', reject);
    request.end(body);
  });
  await requireAllowedInstance(url.hostname);
  return status;
}

export async function fetchRemoteActorKey(keyId: string, expectedActor: string, refresh = false) {
  const key = await requirePublicFederationUrl(keyId);
  const actor = await requirePublicFederationUrl(expectedActor);
  if (key.origin !== actor.origin)
    throw new ApiError('La chiave non appartiene all’attore remoto.', 401);
  if (!refresh) {
    const { data } = await adminDatabase()
      .from('federation_remote_actor_keys')
      .select('remote_actor,remote_inbox,public_key_pem')
      .eq('key_id', keyId)
      .eq('remote_actor', expectedActor)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (data) {
      await requirePublicFederationUrl(data.remote_inbox);
      return {
        actor: data.remote_actor,
        inbox: data.remote_inbox,
        publicKeyPem: data.public_key_pem,
        cached: true,
      } satisfies RemoteActorKey;
    }
  }
  key.hash = '';
  const bytes = await fetchPinnedActor(key);
  let document: unknown;
  try {
    document = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError('Documento dell’attore remoto non valido.', 401);
  }
  if (!document || typeof document !== 'object')
    throw new ApiError('Documento dell’attore remoto non valido.', 401);
  const value = document as Record<string, unknown>;
  const publicKey = value.publicKey as Record<string, unknown> | undefined;
  if (
    value.id !== expectedActor ||
    typeof value.inbox !== 'string' ||
    !publicKey ||
    publicKey.id !== keyId ||
    publicKey.owner !== expectedActor ||
    typeof publicKey.publicKeyPem !== 'string' ||
    publicKey.publicKeyPem.length > 8192 ||
    !publicKey.publicKeyPem.startsWith('-----BEGIN PUBLIC KEY-----')
  )
    throw new ApiError('Documento dell’attore remoto non valido.', 401);
  const inbox = new URL(value.inbox);
  if (inbox.origin !== actor.origin) throw new ApiError('Inbox remota non valida.', 401);
  await requirePublicHost(inbox);
  const fetchedAt = new Date();
  await adminDatabase()
    .from('federation_remote_actor_keys')
    .upsert({
      key_id: keyId,
      remote_actor: expectedActor,
      remote_inbox: inbox.href,
      username:
        typeof value.preferredUsername === 'string' && value.preferredUsername.length <= 64
          ? value.preferredUsername
          : null,
      display_name: typeof value.name === 'string' && value.name.length <= 120 ? value.name : null,
      public_key_pem: publicKey.publicKeyPem,
      fetched_at: fetchedAt.toISOString(),
      expires_at: new Date(fetchedAt.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    });
  return {
    actor: expectedActor,
    inbox: inbox.href,
    publicKeyPem: publicKey.publicKeyPem,
    cached: false,
  } satisfies RemoteActorKey;
}

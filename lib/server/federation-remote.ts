import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPublicFederationAddress } from '@/lib/core/federation-network';
import { readLimited } from '@/lib/core/http';
import { ApiError } from './supabase';

async function requirePublicHost(url: URL) {
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname)
    throw new ApiError('Indirizzo federato non valido.', 400);
  const directFamily = isIP(url.hostname);
  const addresses = directFamily
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicFederationAddress(address)))
    throw new ApiError('Indirizzo federato non consentito.', 400);
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
};

export async function fetchRemoteActorKey(keyId: string, expectedActor: string) {
  const key = new URL(keyId);
  const actor = new URL(expectedActor);
  if (key.origin !== actor.origin)
    throw new ApiError('La chiave non appartiene all’attore remoto.', 401);
  key.hash = '';
  await requirePublicHost(key);
  const response = await fetch(key, {
    headers: { Accept: 'application/activity+json' },
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new ApiError('Attore remoto non raggiungibile.', 401);
  const bytes = await readLimited(response, 65536);
  await requirePublicHost(key);
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
  return { actor: expectedActor, inbox: inbox.href, publicKeyPem: publicKey.publicKeyPem };
}

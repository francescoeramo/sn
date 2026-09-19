import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSign,
  createVerify,
  generateKeyPairSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export class FederationCryptoError extends Error {}

const encodedPart = /^[A-Za-z0-9+/]+={0,2}$/;
const signatureParameter = /(?:^|,)\s*([a-zA-Z]+)="([^"]*)"\s*(?=,|$)/g;

function encryptionKey(secret: string | undefined) {
  if (!secret)
    throw new FederationCryptoError('Chiave di cifratura della federazione non configurata.');
  const key = Buffer.from(secret, 'base64');
  if (key.length !== 32)
    throw new FederationCryptoError('Chiave di cifratura della federazione non valida.');
  return key;
}

export function generateFederationKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

export function encryptFederationPrivateKey(privateKeyPem: string, secret: string | undefined) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyPem, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptFederationPrivateKey(value: string, secret: string | undefined) {
  const [version, ivValue, tagValue, encryptedValue, extra] = value.split(':');
  if (
    version !== 'v1' ||
    extra !== undefined ||
    !ivValue ||
    !tagValue ||
    !encryptedValue ||
    ![ivValue, tagValue, encryptedValue].every((part) => encodedPart.test(part))
  )
    throw new FederationCryptoError('Chiave federata archiviata in un formato non valido.');
  const iv = Buffer.from(ivValue, 'base64');
  const tag = Buffer.from(tagValue, 'base64');
  if (iv.length !== 12 || tag.length !== 16)
    throw new FederationCryptoError('Chiave federata archiviata in un formato non valido.');
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new FederationCryptoError('Impossibile decifrare la chiave federata.');
  }
}

export function signedFederationHeaders(
  target: string,
  body: string,
  keyId: string,
  privateKeyPem: string,
  now = new Date(),
) {
  const url = new URL(target);
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost')
    throw new FederationCryptoError('La consegna federata richiede HTTPS.');
  const date = now.toUTCString();
  const digest = `SHA-256=${createHash('sha256').update(body).digest('base64')}`;
  const requestTarget = `${url.pathname}${url.search}`;
  const signingString = `(request-target): post ${requestTarget}\nhost: ${url.host}\ndate: ${date}\ndigest: ${digest}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingString);
  signer.end();
  const signature = signer.sign(privateKeyPem, 'base64');
  return {
    Host: url.host,
    Date: date,
    Digest: digest,
    Signature: `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${signature}"`,
    'Content-Type': 'application/activity+json',
  } as const;
}

export function parseLegacySignature(value: string | null) {
  if (!value || value.length > 8192) throw new FederationCryptoError('Firma HTTP mancante.');
  const parameters = new Map<string, string>();
  let matched = '';
  for (const match of value.matchAll(signatureParameter)) {
    matched += match[0];
    const name = match[1].toLowerCase();
    if (parameters.has(name)) throw new FederationCryptoError('Firma HTTP non valida.');
    parameters.set(name, match[2]);
  }
  if (matched.replace(/^,|\s/g, '') !== value.replace(/\s/g, ''))
    throw new FederationCryptoError('Firma HTTP non valida.');
  const keyId = parameters.get('keyid');
  const signature = parameters.get('signature');
  const headers = (parameters.get('headers') ?? 'date').toLowerCase().split(/\s+/);
  const algorithm = parameters.get('algorithm');
  if (
    !keyId ||
    !signature ||
    (algorithm && !['rsa-sha256', 'hs2019'].includes(algorithm.toLowerCase())) ||
    new Set(headers).size !== headers.length ||
    !['(request-target)', 'host', 'date', 'digest'].every((header) => headers.includes(header))
  )
    throw new FederationCryptoError('Firma HTTP non valida.');
  try {
    const url = new URL(keyId);
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new FederationCryptoError('Identità della firma non valida.');
  } catch (error) {
    if (error instanceof FederationCryptoError) throw error;
    throw new FederationCryptoError('Identità della firma non valida.');
  }
  return { keyId, signature, headers };
}

export function verifyLegacyFederationRequest(
  request: { method: string; url: string; headers: Headers },
  body: Uint8Array,
  publicKeyPem: string,
  now = new Date(),
) {
  const parsed = parseLegacySignature(request.headers.get('signature'));
  const date = request.headers.get('date');
  const digest = request.headers.get('digest');
  if (!date || !digest) throw new FederationCryptoError('Firma HTTP incompleta.');
  const signedAt = Date.parse(date);
  if (
    !Number.isFinite(signedAt) ||
    signedAt < now.getTime() - 12 * 60 * 60 * 1000 ||
    signedAt > now.getTime() + 5 * 60 * 1000
  )
    throw new FederationCryptoError('Data della firma HTTP non valida.');
  const expectedDigest = Buffer.from(createHash('sha256').update(body).digest('base64'));
  const digestMatch = /^SHA-256=([A-Za-z0-9+/]+={0,2})$/i.exec(digest);
  if (!digestMatch) throw new FederationCryptoError('Digest HTTP non valido.');
  const suppliedDigest = Buffer.from(digestMatch[1]);
  if (
    suppliedDigest.length !== expectedDigest.length ||
    !timingSafeEqual(suppliedDigest, expectedDigest)
  )
    throw new FederationCryptoError('Digest HTTP non valido.');
  const url = new URL(request.url);
  if (request.headers.get('host') !== url.host)
    throw new FederationCryptoError('Destinazione della firma HTTP non valida.');
  const lines = parsed.headers.map((header) => {
    if (header === '(request-target)')
      return `${header}: ${request.method.toLowerCase()} ${url.pathname}${url.search}`;
    const value = request.headers.get(header);
    if (!value) throw new FederationCryptoError(`Header firmato mancante: ${header}.`);
    return `${header}: ${value}`;
  });
  const verifier = createVerify('RSA-SHA256');
  verifier.update(lines.join('\n'));
  verifier.end();
  let valid = false;
  try {
    valid = verifier.verify(publicKeyPem, parsed.signature, 'base64');
  } catch {
    valid = false;
  }
  if (!valid) throw new FederationCryptoError('Firma HTTP non valida.');
  return parsed.keyId;
}

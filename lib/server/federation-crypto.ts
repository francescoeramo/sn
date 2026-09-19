import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSign,
  generateKeyPairSync,
  randomBytes,
} from 'node:crypto';

export class FederationCryptoError extends Error {}

const encodedPart = /^[A-Za-z0-9+/]+={0,2}$/;

function encryptionKey(secret: string | undefined) {
  if (!secret) throw new FederationCryptoError('Chiave di cifratura della federazione non configurata.');
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

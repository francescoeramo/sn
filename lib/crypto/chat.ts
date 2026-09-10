// Web Crypto only. Private device keys are never exportable.
export type Device = { id: string; user_id: string; public_key: JsonWebKey; label: string };
export type LocalDevice = Device & { privateKey: CryptoKey };
export type ChatContext = {
  id: string;
  sender_id: string;
  recipient_id: string;
  expires_at: string;
  retention: 'synced' | 'device';
};
export type Sealed = {
  context: ChatContext;
  version: 1;
  sender: Device;
  salt: string;
  iv: string;
  ciphertext: string;
  keys: Record<string, { iv: string; ciphertext: string }>;
};
export type ClearMessage = {
  body: string;
  media: { key: string; iv: string; mime: string } | null;
};
const utf8 = new TextEncoder();
export function base64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export function unbase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}
const random = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const aad = (context: ChatContext) =>
  utf8.encode(
    JSON.stringify([
      1,
      context.id,
      context.sender_id,
      context.recipient_id,
      context.expires_at,
      context.retention,
    ]),
  );
export async function newDevice(user_id: string): Promise<LocalDevice> {
  const keys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits',
  ]);
  return {
    id: crypto.randomUUID(),
    user_id,
    label: 'Questo browser',
    public_key: await crypto.subtle.exportKey('jwk', keys.publicKey),
    privateKey: keys.privateKey,
  };
}
export function publicDevice(device: Device): Device {
  return {
    id: device.id,
    user_id: device.user_id,
    label: device.label,
    public_key: device.public_key,
  };
}
export async function fingerprint(device: Device) {
  const key = device.public_key;
  const hash = await crypto.subtle.digest(
    'SHA-256',
    utf8.encode(JSON.stringify([device.user_id, device.id, key.crv, key.x, key.y])),
  );
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function wrappingKey(
  privateKey: CryptoKey,
  other: JsonWebKey,
  salt: Uint8Array<ArrayBuffer>,
  context: ChatContext,
  target: string,
) {
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    other,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: utf8.encode(`SN-chat-v1:${context.id}:${target}`),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
async function aes(raw: Uint8Array<ArrayBuffer>) {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(
  sender: LocalDevice,
  devices: Device[],
  context: ChatContext,
  body: string,
  file?: File | null,
): Promise<{ sealed: Sealed; attachment: File | null }> {
  if (
    sender.user_id !== context.sender_id ||
    !devices.some((d) => d.user_id === context.recipient_id) ||
    !devices.some((d) => d.id === sender.id)
  )
    throw new Error('Mancano le chiavi dei partecipanti.');
  const salt = random(32),
    rawKey = random(32),
    key = await aes(rawKey),
    iv = random(12);
  let media: ClearMessage['media'] = null,
    attachment: File | null = null;
  if (file) {
    const mediaKey = random(32),
      mediaIV = random(12);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: mediaIV, additionalData: aad(context) },
      await aes(mediaKey),
      await file.arrayBuffer(),
    );
    attachment = new File([encrypted], 'allegato.sn', { type: 'application/octet-stream' });
    media = { key: base64(mediaKey), iv: base64(mediaIV), mime: file.type };
    mediaKey.fill(0);
  }
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(context) },
    key,
    utf8.encode(JSON.stringify({ body, media })),
  );
  const keys: Sealed['keys'] = {};
  for (const device of devices) {
    if (![context.sender_id, context.recipient_id].includes(device.user_id))
      throw new Error('Dispositivo estraneo alla conversazione.');
    const wrapping = await wrappingKey(
        sender.privateKey,
        device.public_key,
        salt,
        context,
        device.id,
      ),
      wrapIV = random(12);
    keys[device.id] = {
      iv: base64(wrapIV),
      ciphertext: base64(
        new Uint8Array(
          await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: wrapIV, additionalData: aad(context) },
            wrapping,
            rawKey,
          ),
        ),
      ),
    };
  }
  rawKey.fill(0);
  return {
    sealed: {
      context,
      version: 1,
      sender: publicDevice(sender),
      salt: base64(salt),
      iv: base64(iv),
      ciphertext: base64(new Uint8Array(ciphertext)),
      keys,
    },
    attachment,
  };
}
export async function unseal(
  device: LocalDevice,
  context: ChatContext,
  packet: Sealed,
): Promise<ClearMessage> {
  if (
    packet.version !== 1 ||
    packet.sender.user_id !== context.sender_id ||
    ![context.sender_id, context.recipient_id].includes(device.user_id)
  )
    throw new Error('Messaggio non valido.');
  if (Date.parse(context.expires_at) <= Date.now()) throw new Error('Messaggio scaduto.');
  const entry = packet.keys[device.id];
  if (!entry) throw new Error('Questo messaggio precede l’autorizzazione del browser.');
  const wrapping = await wrappingKey(
    device.privateKey,
    packet.sender.public_key,
    unbase64(packet.salt),
    context,
    device.id,
  );
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unbase64(entry.iv), additionalData: aad(context) },
    wrapping,
    unbase64(entry.ciphertext),
  );
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unbase64(packet.iv), additionalData: aad(context) },
    await aes(new Uint8Array(raw)),
    unbase64(packet.ciphertext),
  );
  new Uint8Array(raw).fill(0);
  const value = JSON.parse(new TextDecoder().decode(clear)) as ClearMessage;
  if (typeof value.body !== 'string' || value.body.length > 2000)
    throw new Error('Messaggio non valido.');
  return value;
}
export async function openAttachment(
  context: ChatContext,
  media: NonNullable<ClearMessage['media']>,
  bytes: ArrayBuffer,
): Promise<Blob> {
  if (Date.parse(context.expires_at) <= Date.now()) throw new Error('Allegato scaduto.');
  if (!/^(image\/(jpeg|png|webp)|video\/(mp4|webm)|audio\/(webm|ogg|mp4))$/.test(media.mime))
    throw new Error('Formato allegato non consentito.');
  return new Blob(
    [
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unbase64(media.iv), additionalData: aad(context) },
        await aes(unbase64(media.key)),
        bytes,
      ),
    ],
    { type: media.mime },
  );
}

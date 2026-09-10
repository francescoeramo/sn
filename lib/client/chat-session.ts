import {
  deviceFor,
  rememberDevices,
  keepMessages,
  localMessages,
  trustedFingerprints,
} from './chat-store';
import {
  fingerprint,
  unbase64,
  publicDevice,
  unseal,
  openAttachment,
  type Device,
  type LocalDevice,
} from '@/lib/crypto/chat';
import type { Message } from '@/lib/core/types';
import { isActive } from '@/lib/core/rules';
import { asDataURL } from './media';
export async function chatRequest(path: string, body?: unknown) {
  const response = await fetch(
    '/api/chat/' + path,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Chat non disponibile.');
  return value;
}
export async function prepareSession(me: string, other: string, demo: boolean) {
  const device = await deviceFor(me, demo);
  let devices: Device[];
  if (demo) devices = [publicDevice(device), publicDevice(await deviceFor(other, true))];
  else {
    await chatRequest('device', publicDevice(device));
    devices = await chatRequest('devices?user=' + other);
  }
  const prints = await Promise.all(devices.map(fingerprint));
  let trusted = true;
  try {
    await rememberDevices(me, other, prints, demo);
  } catch {
    trusted = false;
  }
  return { device, devices, prints, trusted };
}
export type DecryptedMessage = Message & { warning?: string };
export async function readConversation(
  device: LocalDevice,
  other: string,
  rows: Message[],
  demo: boolean,
): Promise<DecryptedMessage[]> {
  const trusted = await trustedFingerprints(device.user_id, other, demo);
  const local = demo ? [] : await localMessages(device.user_id);
  const cached = new Map(local.map((m) => [m.id, m.local_media]));
  const all = [
    ...new Map(
      [...local, ...rows]
        .filter((m) => (m.sender_id === other || m.recipient_id === other) && isActive(m))
        .map((m) => [m.id, m]),
    ).values(),
  ];
  const result: DecryptedMessage[] = [],
    saved: Message[] = [];
  for (const row of all) {
    if (!row.encrypted) {
      result.push(row);
      continue;
    }
    try {
      const context = row.encrypted.context;
      if (
        context.id !== row.id ||
        context.sender_id !== row.sender_id ||
        context.recipient_id !== row.recipient_id
      )
        throw new Error('Identità del messaggio non valida.');
      if (!trusted.includes(await fingerprint(row.encrypted.sender)))
        throw new Error(
          'La chiave del mittente non è autorizzata. Controlla i codici di sicurezza.',
        );
      const clear = await unseal(device, context, row.encrypted);
      let media: string | null = null,
        localMedia = row.local_media ?? cached.get(row.id);
      if (clear.media && !row.media_path && !localMedia)
        throw new Error('Allegato cifrato mancante.');
      if (clear.media && row.media_path) {
        const source =
          localMedia ??
          (demo ? row.media_path : '/api/media?path=' + encodeURIComponent(row.media_path));
        let bytes: ArrayBuffer;
        if (source.startsWith('data:application/octet-stream;base64,'))
          bytes = unbase64(source.slice(source.indexOf(',') + 1)).buffer;
        else {
          const response = await fetch(source);
          if (!response.ok) throw new Error('Allegato non disponibile.');
          bytes = await response.arrayBuffer();
        }
        const blob = await openAttachment(context, clear.media, bytes);
        media = await asDataURL(new File([blob], 'allegato', { type: blob.type }));
        if (context.retention === 'device')
          localMedia = await asDataURL(
            new File([bytes], 'cifrato', { type: 'application/octet-stream' }),
          );
      }
      result.push({
        ...row,
        body: clear.body,
        media_path: media,
        media_type: clear.media?.mime ?? null,
        expires_at: context.expires_at,
      });
      if (!demo && context.retention === 'device')
        saved.push({ ...row, local_media: localMedia, expires_at: context.expires_at });
    } catch (error) {
      result.push({
        ...row,
        body: '',
        media_path: null,
        warning: error instanceof Error ? error.message : 'Impossibile decifrare il messaggio.',
      });
    }
  }
  if (saved.length) {
    await keepMessages(device.user_id, saved);
    const ids = saved.filter((m) => m.recipient_id === device.user_id).map((m) => m.id);
    for (let offset = 0; offset < ids.length; offset += 100)
      await chatRequest('delivered', { ids: ids.slice(offset, offset + 100) });
  }
  return result;
}

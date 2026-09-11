import { newDevice, type LocalDevice } from '@/lib/crypto/chat';
import type { Message } from '@/lib/core/types';
import { isActive } from '@/lib/core/rules';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('sn-chat', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('keys');
      req.result.createObjectStore('messages');
      req.result.createObjectStore('trust');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('Il browser non consente di conservare le chiavi.'));
  });
}
async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(store).objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
async function write(store: string, key: string, value: unknown) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function deviceFor(user: string, demo = false): Promise<LocalDevice> {
  const key = (demo ? 'demo:' : 'live:') + user;
  return navigator.locks.request('sn-device:' + key, async () => {
    const existing = await read<LocalDevice>('keys', key);
    if (existing) return existing;
    const device = await newDevice(user);
    await write('keys', key, device);
    return device;
  });
}
export async function rememberDevices(
  user: string,
  other: string,
  prints: string[],
  demo: boolean,
  accept = false,
) {
  const key = `${demo ? 'demo' : 'live'}:${user}:${other}`;
  const sorted = prints.toSorted();
  const previous = await read<string[]>('trust', key);
  if (previous && JSON.stringify(previous) !== JSON.stringify(sorted) && !accept)
    throw new Error(
      'I dispositivi della conversazione sono cambiati. Confronta i codici prima di autorizzarli.',
    );
  if (!previous || accept) await write('trust', key, sorted);
}
async function activeMessages(user: string) {
  return ((await read<Message[]>('messages', user)) ?? []).filter(
    (m) => isActive(m) && (!m.encrypted || isActive(m.encrypted.context)),
  );
}
export async function localMessages(user: string): Promise<Message[]> {
  return navigator.locks.request('sn-messages:' + user, async () => {
    const rows = await activeMessages(user);
    await write('messages', user, rows);
    return rows;
  });
}
export async function keepMessages(user: string, rows: Message[]) {
  return navigator.locks.request('sn-messages:' + user, async () => {
    const previous = await activeMessages(user);
    const merged = [
      ...new Map(
        [...previous, ...rows]
          .filter((m) => isActive(m) && (!m.encrypted || isActive(m.encrypted.context)))
          .map((m) => [m.id, m]),
      ).values(),
    ];
    await write('messages', user, merged);
    return merged;
  });
}

export async function clearChatStore(demoOnly = false) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['keys', 'messages', 'trust'], 'readwrite');
      for (const name of ['keys', 'messages', 'trust']) {
        const store = tx.objectStore(name);
        if (!demoOnly) store.clear();
        else {
          const req = store.openCursor();
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              if (String(cursor.key).startsWith('demo:')) cursor.delete();
              cursor.continue();
            }
          };
        }
      }
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function clearUserChat(user: string) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['keys', 'messages', 'trust'], 'readwrite');
      tx.objectStore('keys').delete('live:' + user);
      tx.objectStore('messages').delete(user);
      const req = tx.objectStore('trust').openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (String(cursor.key).startsWith('live:' + user + ':')) cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function trustedFingerprints(user: string, other: string, demo: boolean) {
  return (await read<string[]>('trust', `${demo ? 'demo' : 'live'}:${user}:${other}`)) ?? [];
}

export async function forgetMessages(user: string, ids: string[]) {
  if (!ids.length) return;
  return navigator.locks.request('sn-messages:' + user, async () => {
    const remove = new Set(ids);
    await write(
      'messages',
      user,
      (await activeMessages(user)).filter((m) => !remove.has(m.id)),
    );
  });
}

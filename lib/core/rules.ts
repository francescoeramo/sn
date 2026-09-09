import { z } from 'zod';
export const LIMITS = {
  file: 3 * 1024 * 1024,
  user: 40 * 1024 * 1024,
  total: 800 * 1024 * 1024,
  members: 20,
  videoSeconds: 20,
};
export const userId = z.string().uuid();
export const postInput = z
  .object({
    body: z.string().trim().max(2200),
    kind: z.enum(['post', 'story', 'reel']),
    media_path: z.string().max(200).nullable(),
    alt: z.string().trim().max(300),
  })
  .refine((v) => v.body.length > 0 || v.media_path, 'Scrivi qualcosa o allega un file.')
  .refine((v) => v.kind === 'post' || v.media_path, 'Storie e reel richiedono un file.');
export const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(128),
  username: z
    .string()
    .regex(/^[a-z0-9_]{3,24}$/)
    .optional(),
  invite: z.string().min(32).max(128).optional(),
});
export function hashtags(text: string) {
  return [
    ...new Set(
      (text.toLocaleLowerCase('it').match(/#[\p{L}\p{N}_]+/gu) || []).map((t) => t.slice(1)),
    ),
  ];
}
export function fileKind(mime: string) {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(mime)
    ? 'image'
    : ['video/mp4', 'video/webm'].includes(mime)
      ? 'video'
      : null;
}
export function isActive(post: { expires_at: string | null }, now = Date.now()) {
  return !post.expires_at || Date.parse(post.expires_at) > now;
}
export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
export function relativeTime(time: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(time)) / 60000));
  return minutes < 1
    ? 'ora'
    : minutes < 60
      ? `${minutes} min`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} h`
        : `${Math.floor(minutes / 1440)} g`;
}

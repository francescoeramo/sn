/** Stable identity plan; wire format and transports belong in a dedicated Fedify adapter. */
export function actorUrl(origin: string, actorKey: string) {
  return new URL(`/ap/actors/${actorKey}`, origin).href;
}
export function activityUrl(origin: string, activityKey: string) {
  return new URL(`/ap/activities/${activityKey}`, origin).href;
}
export const federationStatus = {
  enabled: false,
  reason: 'La federazione non è attiva nella beta privata.',
} as const;

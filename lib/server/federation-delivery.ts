import 'server-only';
import { actorDeleteDocument, actorUrl, federationDeliveryOutcome } from '@/lib/core/federation';
import { adminDatabase, ApiError, checked } from './supabase';
import { decryptFederationPrivateKey, signedFederationHeaders } from './federation-crypto';
import { postPinnedFederationActivity, requirePublicFederationUrl } from './federation-remote';

type Delivery = {
  queue_id: string;
  activity_id: string;
  actor_id: string;
  target_url: string;
  payload: Record<string, unknown>;
  attempts: number;
};

async function deliver(item: Delivery) {
  const db = adminDatabase();
  const [{ data: profile }, { data: key }] = await Promise.all([
    db
      .from('profiles')
      .select('actor_key')
      .eq('id', item.actor_id)
      .eq('federation_enabled', true)
      .eq('is_private', false)
      .eq('disabled', false)
      .maybeSingle(),
    db
      .from('federation_actor_keys')
      .select('private_key_encrypted')
      .eq('actor_id', item.actor_id)
      .maybeSingle(),
  ]);
  if (!profile || !key) return federationDeliveryOutcome(410, item.attempts);
  const origin = process.env.APP_ORIGIN;
  if (!origin) throw new ApiError('Origine dell’app non configurata.', 503);
  const target = await requirePublicFederationUrl(item.target_url);
  const body = JSON.stringify(item.payload);
  const privateKey = decryptFederationPrivateKey(
    key.private_key_encrypted,
    process.env.FEDERATION_KEY_SECRET,
  );
  const keyId = `${actorUrl(origin, profile.actor_key)}#main-key`;
  let status: number | null = null;
  try {
    status = await postPinnedFederationActivity(
      target,
      signedFederationHeaders(target.href, body, keyId, privateKey),
      body,
    );
  } catch {
    status = null;
  }
  return federationDeliveryOutcome(status, item.attempts);
}

export async function processFederationQueue() {
  const db = adminDatabase();
  const origin = process.env.APP_ORIGIN;
  let withdrawals = 0;
  if (origin) {
    const pending = checked(await db.rpc('claim_federation_withdrawals', { batch_size: 4 })) as {
      actor_id: string;
      event_key: string;
      actor_key: string;
    }[];
    for (const item of pending) {
      const activity = actorDeleteDocument(origin, item.actor_key, item.event_key);
      checked(
        await db.rpc('complete_federation_withdrawal', {
          target_actor: item.actor_id,
          outgoing: activity,
        }),
      );
      withdrawals++;
    }
  }
  if (process.env.FEDERATION_DELIVERY_ENABLED !== 'true')
    return { processed: 0, delivered: 0, retried: 0, failed: 0, withdrawals };
  const items = checked(
    await db.rpc('claim_federation_deliveries', { batch_size: 4 }),
  ) as Delivery[];
  const result = { processed: items.length, delivered: 0, retried: 0, failed: 0, withdrawals };
  for (const item of items) {
    let decision: ReturnType<typeof federationDeliveryOutcome>;
    try {
      decision = await deliver(item);
    } catch {
      decision = federationDeliveryOutcome(null, item.attempts);
    }
    checked(
      await db.rpc('complete_federation_delivery', {
        target_queue: item.queue_id,
        outcome: decision.outcome,
        retry_at: decision.retryAt?.toISOString() ?? null,
      }),
    );
    if (decision.outcome === 'delivered') result.delivered++;
    else if (decision.outcome === 'retry') result.retried++;
    else result.failed++;
  }
  return result;
}

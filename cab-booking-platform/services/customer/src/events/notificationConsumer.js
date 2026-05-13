import { subscribeToEvent, logger } from '@cab/shared';
import { Notification, NOTIFICATION_TYPES } from '../models/Notification.js';

/**
 * The customer service is the source of truth for the user-facing inbox.
 * Other services don't write to the Notification collection directly --
 * instead, they publish `notification.created` events and we consume them
 * here. This keeps the data ownership clean (one writer per collection)
 * which is a key microservices principle.
 *
 * Expected event payload:
 *   {
 *     userId:     "<mongo objectId string>",
 *     type:       "cab_ready" | "discount" | "system",
 *     title:      "Your cab is ready!",
 *     body:       "Driver John is on his way.",
 *     meta:       { ...arbitrary domain data... },
 *     dedupeKey?: "discount:<userId>"   // optional, enforces once-only
 *   }
 *
 * The dedupeKey + partial unique index combo means we can safely accept
 * duplicate events from upstream and the database will reject the second
 * one - covering Task 5's "only once per user" requirement.
 */

async function handleNotificationCreated(payload) {
  // Defensive validation - we don't trust event payloads any more than HTTP bodies.
  if (!payload?.userId || !payload?.type || !payload?.title) {
    logger.warn('notification.created event missing required fields, ignoring');
    return;
  }
  if (!NOTIFICATION_TYPES.includes(payload.type)) {
    logger.warn(`notification.created with unknown type "${payload.type}", ignoring`);
    return;
  }

  try {
    await Notification.create({
      userId:    payload.userId,
      type:      payload.type,
      title:     payload.title,
      body:      payload.body ?? '',
      meta:      payload.meta ?? {},
      dedupeKey: payload.dedupeKey ?? null,
      read:      false,
    });
    logger.info(`Notification stored for user ${payload.userId} (type=${payload.type})`);
  } catch (err) {
    // E11000 = duplicate-key error. For dedup-protected events this is
    // expected behaviour and we should swallow it silently.
    if (err?.code === 11000) {
      logger.info(`Duplicate notification ignored (dedupeKey=${payload.dedupeKey})`);
      return;
    }
    throw err;
  }
}

export async function startNotificationConsumer() {
  await subscribeToEvent(
    'notification.created',         // routing pattern
    'customer.notifications.queue', // durable queue name (stable across restarts)
    handleNotificationCreated
  );
}

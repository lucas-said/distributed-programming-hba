import { logger } from '@cab/shared';

/**
 * Fetch a booking from the Booking service, forwarding the caller's JWT
 * so the Booking service can apply its own user-isolation rules.
 *
 * Why forward the JWT instead of re-signing?
 *   - Same JWT_SECRET across services means the original token is
 *     already valid. Re-signing would force us to introduce a service
 *     account concept which we don't need yet.
 *   - User isolation is enforced once, in the Booking service, instead
 *     of duplicated everywhere.
 *
 * @param {string} bookingId
 * @param {string} bearerToken - the raw "Bearer xyz" header from the user
 * @returns {Promise<object|null>} booking or null if not found
 */
export async function getBooking(bookingId, bearerToken) {
  const baseUrl = process.env.BOOKING_SERVICE_URL;
  if (!baseUrl) throw new Error('BOOKING_SERVICE_URL is not set');

  const url = `${baseUrl}/${encodeURIComponent(bookingId)}`;

  let res;
  try {
    res = await fetch(url, { headers: { Authorization: bearerToken } });
  } catch (err) {
    logger.error(`Booking service unreachable: ${err.message}`);
    const e = new Error('Booking service unreachable');
    e.status = 502;
    throw e;
  }

  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) {
    const e = new Error('Not authorised to view this booking');
    e.status = res.status;
    throw e;
  }
  if (!res.ok) {
    logger.error(`Booking service returned ${res.status}`);
    const e = new Error(`Booking service returned ${res.status}`);
    e.status = 502;
    throw e;
  }

  const body = await res.json();
  return body.booking;
}

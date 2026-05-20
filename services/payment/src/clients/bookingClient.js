import { logger } from '@cab/shared';

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

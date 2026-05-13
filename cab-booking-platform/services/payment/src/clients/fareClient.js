import { logger } from '@cab/shared';

/**
 * Get a fare estimate by calling the Fare service.
 * Forwards the user's JWT.
 *
 * @param {object} params
 * @param {{latitude:number,longitude:number}} params.pickup
 * @param {{latitude:number,longitude:number}} params.dropoff
 * @param {string} bearerToken
 * @returns {Promise<{fare:number, currency:string}>}
 */
export async function getFareEstimate({ pickup, dropoff }, bearerToken) {
  const baseUrl = process.env.FARE_SERVICE_URL;
  if (!baseUrl) throw new Error('FARE_SERVICE_URL is not set');

  const url = `${baseUrl}/estimate`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  bearerToken,
      },
      body: JSON.stringify({ pickup, dropoff }),
    });
  } catch (err) {
    logger.error(`Fare service unreachable: ${err.message}`);
    const e = new Error('Fare service unreachable');
    e.status = 502;
    throw e;
  }

  if (!res.ok) {
    logger.error(`Fare service returned ${res.status}`);
    const e = new Error(`Could not retrieve fare estimate (${res.status})`);
    e.status = 502;
    throw e;
  }

  const body = await res.json();
  return body.estimate;
}

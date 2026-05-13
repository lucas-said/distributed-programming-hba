import { logger } from '@cab/shared';

/**
 * Client for the RapidAPI Taxi Fare Calculator.
 *
 * Upstream contract (https://rapidapi.com/3b-data-3b-data-default/api/taxi-fare-calculator):
 *   GET /
 *     query: dep_lat, dep_lng, arr_lat, arr_lng
 *     headers: X-RapidAPI-Key, X-RapidAPI-Host
 *
 *   200 response shape:
 *     {
 *       journey: { distance: number, duration: number, ... },
 *       fares:   [ { name: string, price_in_cents: number, currency: string } ]
 *     }
 *
 * We isolate all upstream knowledge in this file so:
 *   - Route handlers stay clean and easy to read.
 *   - If the upstream changes shape we only fix one place.
 *   - Tests can mock the *fetch* layer and verify our normalisation,
 *     OR mock this module entirely to cover edge cases.
 */

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Custom error class so the route layer can react to upstream failures
 * with the right HTTP status code.
 */
export class FareApiError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message);
    this.name   = 'FareApiError';
    this.status = status;
    if (cause) this.cause = cause;
  }
}

/**
 * Call the upstream API and return its raw JSON.
 *
 * @param {object} coords - { dep_lat, dep_lng, arr_lat, arr_lng }
 * @returns {Promise<object>} raw upstream JSON
 */
async function callUpstream({ dep_lat, dep_lng, arr_lat, arr_lng }) {
  const baseUrl = process.env.TAXI_FARE_API_URL;
  const apiHost = process.env.TAXI_FARE_API_HOST;
  const apiKey  = process.env.RAPIDAPI_KEY;

  if (!baseUrl || !apiHost || !apiKey) {
    throw new FareApiError(
      'Fare service is not configured (missing TAXI_FARE_API_URL, TAXI_FARE_API_HOST, or RAPIDAPI_KEY)',
      { status: 503 }
    );
  }

  const url = `${baseUrl}/?dep_lat=${dep_lat}&dep_lng=${dep_lng}&arr_lat=${arr_lat}&arr_lng=${arr_lng}`;

  // AbortController gives us a timeout independent of TCP stack defaults.
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key':  apiKey,
        'X-RapidAPI-Host': apiHost,
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new FareApiError('Upstream taxi fare API timed out', { status: 504, cause: err });
    }
    throw new FareApiError('Failed to reach upstream taxi fare API', { status: 502, cause: err });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    // 401/403 from upstream usually means RAPIDAPI_KEY is wrong or the
    // subscription has lapsed. We don't leak that distinction to the user
    // but log it so the developer sees it.
    const text = await res.text().catch(() => '');
    logger.error(`Upstream API error ${res.status}: ${text.slice(0, 200)}`);
    throw new FareApiError(`Upstream taxi fare API returned ${res.status}`, { status: 502 });
  }

  try {
    return await res.json();
  } catch (err) {
    throw new FareApiError('Upstream returned non-JSON response', { status: 502, cause: err });
  }
}

/**
 * Normalise the upstream response into a clean shape that's stable for
 * our internal consumers (the Payment service, the frontend) regardless
 * of upstream changes.
 *
 * Returns:
 *   {
 *     fare:         number,         // base fare in main currency unit (e.g. 12.50)
 *     currency:     string,         // ISO code if upstream provides one
 *     distance_km:  number | null,
 *     duration_min: number | null,
 *     options: [
 *       { name, price, currency, priceInCents }
 *     ]
 *   }
 */
function normalise(raw) {
  const journey = raw?.journey ?? {};
  const fares   = Array.isArray(raw?.fares) ? raw.fares : [];

  if (fares.length === 0) {
    throw new FareApiError('No fare data available for this route', { status: 404 });
  }

  const options = fares.map((f) => {
    const priceInCents = Number(f.price_in_cents) || 0;
    return {
      name:         f.name ?? 'standard',
      price:        priceInCents / 100,
      currency:     f.currency ?? 'USD',
      priceInCents,
    };
  });

  // Pick the "main" fare: prefer one named standard/normal/regular,
  // otherwise the first.
  const preferred = options.find((o) => /standard|normal|regular/i.test(o.name)) ?? options[0];

  return {
    fare:         preferred.price,
    currency:     preferred.currency,
    distance_km:  journey.distance ?? null,
    duration_min: journey.duration ?? null,
    options,
  };
}

/**
 * Public API of this module - get a normalised fare estimate.
 */
export async function getFareEstimate({ pickup, dropoff }) {
  const raw = await callUpstream({
    dep_lat: pickup.latitude,
    dep_lng: pickup.longitude,
    arr_lat: dropoff.latitude,
    arr_lng: dropoff.longitude,
  });

  return { ...normalise(raw), raw };
}

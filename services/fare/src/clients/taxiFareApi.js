import { logger } from '@cab/shared';

const FETCH_TIMEOUT_MS = 10_000;

export class FareApiError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message);
    this.name   = 'FareApiError';
    this.status = status;
    if (cause) this.cause = cause;
  }
}

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

export async function getFareEstimate({ pickup, dropoff }) {
  const raw = await callUpstream({
    dep_lat: pickup.latitude,
    dep_lng: pickup.longitude,
    arr_lat: dropoff.latitude,
    arr_lng: dropoff.longitude,
  });

  return { ...normalise(raw), raw };
}

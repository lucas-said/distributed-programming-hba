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

  const url = `${baseUrl}/search-geo?dep_lat=${dep_lat}&dep_lng=${dep_lng}&arr_lat=${arr_lat}&arr_lng=${arr_lng}`;

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
  const journey = raw?.journey ?? raw ?? {};

  // Fares can appear under different keys depending on the endpoint version:
  // top-level `fares`, nested `journey.fares`, or `estimates`.
  let fares = [];
  if (Array.isArray(raw?.fares))          fares = raw.fares;
  else if (Array.isArray(journey?.fares)) fares = journey.fares;
  else if (Array.isArray(raw?.estimates)) fares = raw.estimates;

  // Some responses return a single fare instead of an array.
  if (fares.length === 0) {
    const single = journey?.fare ?? journey?.estimated_fare ?? raw?.fare ?? raw?.price;
    if (single != null) fares = [{ name: 'standard', amount: single }];
  }

  if (fares.length === 0) {
    throw new FareApiError('No fare data available for this route', { status: 404 });
  }

  const options = fares.map((f) => {
    let price;
    if (f.price_in_cents != null) price = Number(f.price_in_cents) / 100;
    else if (f.amount != null)    price = Number(f.amount);
    else if (f.price != null)     price = Number(f.price);
    else if (f.fare != null)      price = Number(f.fare);
    else                          price = 0;
    if (!Number.isFinite(price)) price = 0;

    return {
      name:         f.name ?? f.type ?? 'standard',
      price,
      currency:     f.currency ?? journey.currency ?? raw?.currency ?? 'USD',
      priceInCents: Math.round(price * 100),
    };
  });

  const preferred = options.find((o) => /standard|normal|regular/i.test(o.name)) ?? options[0];

  return {
    fare:         preferred.price,
    currency:     preferred.currency,
    distance_km:  journey.distance ?? journey.distance_km ?? null,
    duration_min: journey.duration ?? journey.duration_min ?? null,
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

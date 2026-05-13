import { logger } from '@cab/shared';

/**
 * Client for RapidAPI's WeatherAPI.com endpoint.
 *
 * Upstream contract:
 *   GET /forecast.json?q=<lat>,<lon>&days=1
 *     headers: X-RapidAPI-Key, X-RapidAPI-Host
 *
 *   200 response shape (subset we care about):
 *     {
 *       location: { name, country, localtime, ... },
 *       current:  {
 *         temp_c, feelslike_c, wind_kph, humidity,
 *         condition: { text, icon }
 *       },
 *       forecast: { forecastday: [
 *         { date, day: { maxtemp_c, mintemp_c, condition: { text, icon } } }
 *       ] }
 *     }
 *
 * Same isolation pattern as services/fare/src/clients/taxiFareApi.js -
 * upstream knowledge lives here, route handlers stay clean.
 */

const FETCH_TIMEOUT_MS = 10_000;

export class WeatherApiError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message);
    this.name   = 'WeatherApiError';
    this.status = status;
    if (cause) this.cause = cause;
  }
}

async function callUpstream({ latitude, longitude }) {
  const baseUrl = process.env.WEATHER_API_URL;
  const apiHost = process.env.WEATHER_API_HOST;
  const apiKey  = process.env.RAPIDAPI_KEY;

  if (!baseUrl || !apiHost || !apiKey) {
    throw new WeatherApiError(
      'Weather service is not configured (missing WEATHER_API_URL, WEATHER_API_HOST, or RAPIDAPI_KEY)',
      { status: 503 }
    );
  }

  const q   = `${latitude},${longitude}`;
  const url = `${baseUrl}/forecast.json?q=${encodeURIComponent(q)}&days=1`;

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
      throw new WeatherApiError('Upstream weather API timed out', { status: 504, cause: err });
    }
    throw new WeatherApiError('Failed to reach upstream weather API', { status: 502, cause: err });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error(`Upstream weather API ${res.status}: ${text.slice(0, 200)}`);
    // 400 from WeatherAPI usually means the q value couldn't be resolved
    // to a known location.
    if (res.status === 400) {
      throw new WeatherApiError('Could not resolve weather for given coordinates', { status: 404 });
    }
    throw new WeatherApiError(`Upstream weather API returned ${res.status}`, { status: 502 });
  }

  try {
    return await res.json();
  } catch (err) {
    throw new WeatherApiError('Upstream returned non-JSON response', { status: 502, cause: err });
  }
}

/**
 * Fix the icon URL. WeatherAPI returns it as a protocol-relative URL like
 * "//cdn.weatherapi.com/...". We promote it to https so frontends can use
 * it directly without breaking on file:// or http:// origins.
 */
function fixIcon(icon) {
  if (!icon) return null;
  if (icon.startsWith('//')) return `https:${icon}`;
  return icon;
}

/**
 * Normalise the upstream payload into the stable shape our consumers use.
 */
function normalise(raw) {
  const loc  = raw?.location ?? {};
  const cur  = raw?.current  ?? {};
  const days = raw?.forecast?.forecastday ?? [];

  return {
    location: {
      name:      loc.name      ?? null,
      country:   loc.country   ?? null,
      localtime: loc.localtime ?? null,
    },
    current: {
      temp_c:       cur.temp_c       ?? null,
      feels_like_c: cur.feelslike_c  ?? null,
      condition:    cur.condition?.text ?? null,
      icon:         fixIcon(cur.condition?.icon),
      wind_kph:     cur.wind_kph     ?? null,
      humidity:     cur.humidity     ?? null,
    },
    forecast: days.map((d) => ({
      date:       d.date ?? null,
      max_temp_c: d.day?.maxtemp_c  ?? null,
      min_temp_c: d.day?.mintemp_c  ?? null,
      condition:  d.day?.condition?.text ?? null,
      icon:       fixIcon(d.day?.condition?.icon),
    })),
  };
}

export async function getWeather({ latitude, longitude }) {
  const raw = await callUpstream({ latitude, longitude });
  return { ...normalise(raw), raw };
}

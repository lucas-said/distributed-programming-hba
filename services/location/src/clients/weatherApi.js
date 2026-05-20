import { logger } from '@cab/shared';

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

function fixIcon(icon) {
  if (!icon) return null;
  if (icon.startsWith('//')) return `https:${icon}`;
  return icon;
}

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

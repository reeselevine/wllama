import type { ChatCompletionTool } from '@wllama/wllama/esm/index.js';

export const WEATHER_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description:
      'Get current weather and a 7-day daily forecast from Open-Meteo, including temperature, rain probability, and wind.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description:
            'City with the state or country specified by the user, e.g. "Santa Cruz, CA" or "Paris, France". Preserve the location qualifier.',
        },
      },
      required: ['city'],
    },
  },
};

interface Location {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

interface Forecast {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number | null;
    precipitation: number | null;
    wind_speed_10m: number | null;
  };
  daily: {
    time: string[];
    temperature_2m_min: (number | null)[];
    temperature_2m_max: (number | null)[];
    precipitation_probability_max: (number | null)[];
    precipitation_sum: (number | null)[];
    wind_speed_10m_max: (number | null)[];
  };
}

const locationName = (place: Location) =>
  [place.name, place.admin1, place.country].filter(Boolean).join(', ');

async function fetchJson<T>(url: URL, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok)
    throw new Error(`Open-Meteo returned HTTP ${response.status}.`);
  return response.json();
}

export async function getWeather(args: unknown, signal: AbortSignal) {
  if (
    !args ||
    typeof args !== 'object' ||
    !('city' in args) ||
    typeof args.city !== 'string' ||
    !args.city.trim()
  ) {
    return { error: 'Provide a city name with its state or country.' };
  }
  try {
    signal.throwIfAborted();
    const search = new URL('https://geocoding-api.open-meteo.com/v1/search');
    search.search = new URLSearchParams({
      name: args.city.trim(),
      count: '10',
      language: 'en',
      format: 'json',
    }).toString();
    const locationData = await fetchJson<{ results?: Location[] }>(
      search,
      signal
    );
    const places = locationData.results ?? [];
    const cityName = args.city.split(',')[0].trim().toLowerCase();
    const exactMatches = places.filter(
      (place) => place.name.toLowerCase() === cityName
    );
    const matches = exactMatches.length ? exactMatches : places;
    if (matches.length > 1) {
      return {
        error:
          'Multiple locations match. Retry with the state or country from the user request. If unspecified, ask the user to choose.',
        candidates: matches.map(locationName),
      };
    }
    const location = matches[0];
    if (!location)
      return {
        error: `No location found for "${args.city}". Try a nearby city.`,
      };

    const forecast = new URL('https://api.open-meteo.com/v1/forecast');
    forecast.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,precipitation,wind_speed_10m',
      daily:
        'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
      timezone: 'auto',
      forecast_days: '7',
    }).toString();
    const data = await fetchJson<Forecast>(forecast, signal);
    return {
      source: 'https://open-meteo.com/',
      location: locationName(location),
      timezone: data.timezone,
      units: {
        temperature: 'C',
        precipitation: 'mm',
        wind: 'km/h',
        rain_probability: '%',
      },
      current: {
        time: data.current.time,
        temperature: data.current.temperature_2m,
        precipitation: data.current.precipitation,
        wind: data.current.wind_speed_10m,
      },
      forecast: data.daily.time.map((date, i) => ({
        date,
        weekday: new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {
          weekday: 'long',
          timeZone: 'UTC',
        }),
        low: data.daily.temperature_2m_min[i],
        high: data.daily.temperature_2m_max[i],
        rain_probability: data.daily.precipitation_probability_max[i],
        precipitation: data.daily.precipitation_sum[i],
        max_wind: data.daily.wind_speed_10m_max[i],
      })),
    };
  } catch (error) {
    signal.throwIfAborted();
    return { error: `Could not get live weather: ${(error as Error).message}` };
  }
}

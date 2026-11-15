import { vi, type Mock } from 'vitest'

export const london = {
  id: 1,
  name: 'London',
  admin1: 'England',
  country: 'United Kingdom',
  latitude: 51.5,
  longitude: -0.12,
}

export function forecastJson(
  overrides: {
    current?: Record<string, unknown>
    daily?: Record<string, unknown>
  } = {},
) {
  return {
    current: {
      temperature_2m: 14.4,
      apparent_temperature: 12.6,
      relative_humidity_2m: 71,
      weather_code: 61,
      wind_speed_10m: 18.2,
      is_day: 1,
      ...overrides.current,
    },
    daily: {
      time: [
        '2025-11-17',
        '2025-11-18',
        '2025-11-19',
        '2025-11-20',
        '2025-11-21',
      ],
      weather_code: [61, 0, 3, 45, 95],
      temperature_2m_max: [15, 12, 11, 10, 9],
      temperature_2m_min: [8, 5, -0.2, 3, 2],
      precipitation_probability_max: [80, 10, null, 5, 60],
      ...overrides.daily,
    },
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

/** A fetch that never answers but rejects with AbortError when its signal aborts. */
export function hang(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    )
  })
}

export type Handler = (
  url: URL,
  init: RequestInit | undefined,
) => Promise<Response>

export function mockFetch(handler: Handler): Mock<typeof fetch> {
  const mock = vi.fn<typeof fetch>((input, init) =>
    handler(new URL(String(input)), init),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

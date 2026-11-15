import { describe, expect, it, vi } from 'vitest'
import { getForecast, searchPlaces } from './weather'
import {
  forecastJson,
  hang,
  jsonResponse,
  london,
  mockFetch,
} from '../test/helpers'

const signal = () => new AbortController().signal

describe('searchPlaces', () => {
  it('builds the URL with encoded params and returns places', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ results: [london] }))
    const places = await searchPlaces('S\u00E3o Paulo & co', signal())
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.origin + url.pathname).toBe(
      'https://geocoding-api.open-meteo.com/v1/search',
    )
    expect(url.searchParams.get('name')).toBe('S\u00E3o Paulo & co')
    expect(url.searchParams.get('count')).toBe('5')
    expect(places).toEqual([{ ...london }])
  })

  it('treats a missing "results" field as an empty list', async () => {
    mockFetch(async () => jsonResponse({ generationtime_ms: 1 }))
    await expect(searchPlaces('zzzz', signal())).resolves.toEqual([])
  })

  it('rejects malformed places as bad data', async () => {
    mockFetch(async () => jsonResponse({ results: [{ name: 'X' }] }))
    await expect(searchPlaces('x', signal())).rejects.toMatchObject({
      kind: 'bad-data',
    })
  })
})

describe('getForecast', () => {
  it('requests \u00B0C, timezone=auto and 5 days', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(forecastJson()))
    const forecast = await getForecast(51.5, -0.12, signal())
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.searchParams.get('timezone')).toBe('auto')
    expect(url.searchParams.get('forecast_days')).toBe('5')
    expect(url.searchParams.get('temperature_unit')).toBeNull()
    expect(forecast.days).toHaveLength(5)
    expect(forecast.current.isDay).toBe(true)
    expect(forecast.days[2]?.rainChance).toBeNull()
  })

  it.each([
    [429, 'Too many searches. Wait a moment and try again.'],
    [500, 'The weather service had a problem. Try again.'],
    [503, 'The weather service had a problem. Try again.'],
  ])(
    'maps HTTP %i to a friendly message and cancels the body',
    async (status, message) => {
      const response = jsonResponse({ reason: 'x' }, status)
      const body = response.body
      if (body === null) throw new Error('expected a body')
      const cancel = vi.spyOn(body, 'cancel')
      mockFetch(async () => response)
      await expect(getForecast(1, 2, signal())).rejects.toThrow(message)
      expect(cancel).toHaveBeenCalled()
    },
  )

  it('maps a network failure', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(getForecast(1, 2, signal())).rejects.toThrow(
      "Can't reach the weather service. Check your internet.",
    )
  })

  it('times out after 8 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mockFetch((_url, init) => hang(init))
    const result = expect(getForecast(1, 2, signal())).rejects.toThrow(
      'The weather service is taking too long.',
    )
    await vi.advanceTimersByTimeAsync(8000)
    await result
  })

  it('reports a cancelled request as AbortError, not a weather error', async () => {
    mockFetch((_url, init) => hang(init))
    const controller = new AbortController()
    const result = getForecast(1, 2, controller.signal)
    controller.abort()
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('rejects invalid JSON', async () => {
    mockFetch(async () => new Response('<html>', { status: 200 }))
    await expect(getForecast(1, 2, signal())).rejects.toMatchObject({
      kind: 'bad-data',
    })
  })

  it.each([
    ['not an object', 'hello'],
    ['missing current', { daily: forecastJson().daily }],
    ['text temperature', forecastJson({ current: { temperature_2m: 'warm' } })],
    [
      'mismatched daily arrays',
      forecastJson({ daily: { temperature_2m_min: [1, 2, 3] } }),
    ],
    [
      'bad date string',
      forecastJson({ daily: { time: ['x', 'y', 'z', 'w', 'v'] } }),
    ],
  ])('treats %s as bad data', async (_name, body) => {
    mockFetch(async () => jsonResponse(body))
    await expect(getForecast(1, 2, signal())).rejects.toThrow(
      "The weather service sent data we can't read.",
    )
  })
})

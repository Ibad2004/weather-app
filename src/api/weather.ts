export type Place = {
  id: number
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

export type Current = {
  temperature: number
  feelsLike: number
  humidity: number
  windKmh: number
  weatherCode: number
  isDay: boolean
}

export type Day = {
  date: string
  weatherCode: number
  max: number
  min: number
  rainChance: number | null
}

export type Forecast = { current: Current; days: Day[] }

export type ErrorKind =
  'network' | 'timeout' | 'rate-limit' | 'server' | 'bad-data'

const MESSAGES: Record<ErrorKind, string> = {
  network: "Can't reach the weather service. Check your internet.",
  timeout: 'The weather service is taking too long.',
  'rate-limit': 'Too many searches. Wait a moment and try again.',
  server: 'The weather service had a problem. Try again.',
  'bad-data': "The weather service sent data we can't read.",
}

export class WeatherError extends Error {
  kind: ErrorKind
  constructor(kind: ErrorKind) {
    super(MESSAGES[kind])
    this.name = 'WeatherError'
    this.kind = kind
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  )
}

/** Message safe to show the user (never called for aborts). */
export function errorMessage(error: unknown): string {
  return error instanceof WeatherError ? error.message : MESSAGES.server
}

const TIMEOUT_MS = 8000

function abortError(): DOMException {
  return new DOMException('The request was cancelled.', 'AbortError')
}

async function requestJson(
  url: string,
  callerSignal: AbortSignal,
): Promise<unknown> {
  if (callerSignal.aborted) throw abortError()
  const controller = new AbortController()
  let timedOut = false
  const onCallerAbort = () => controller.abort()
  callerSignal.addEventListener('abort', onCallerAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal })
    } catch {
      throw new WeatherError('network')
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new WeatherError(response.status === 429 ? 'rate-limit' : 'server')
    }
    try {
      return await response.json()
    } catch {
      throw new WeatherError('bad-data')
    }
  } catch (error) {
    if (callerSignal.aborted) throw abortError()
    if (timedOut) throw new WeatherError('timeout')
    throw error
  } finally {
    clearTimeout(timer)
    callerSignal.removeEventListener('abort', onCallerAbort)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value)
}

function numberArray(value: unknown): number[] | null {
  return Array.isArray(value) && value.every(isNumber) ? value : null
}

function parsePlace(value: unknown): Place | null {
  if (!isRecord(value)) return null
  const { id, name, admin1, country, latitude, longitude } = value
  if (
    !isNumber(id) ||
    !isString(name) ||
    !isNumber(latitude) ||
    !isNumber(longitude)
  )
    return null
  return {
    id,
    name,
    admin1: isString(admin1) ? admin1 : undefined,
    country: isString(country) ? country : undefined,
    latitude,
    longitude,
  }
}

export async function searchPlaces(
  name: string,
  signal: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({
    name,
    count: '5',
    language: 'en',
    format: 'json',
  })
  const json = await requestJson(
    `https://geocoding-api.open-meteo.com/v1/search?${params}`,
    signal,
  )
  if (!isRecord(json)) throw new WeatherError('bad-data')
  const results = json.results
  if (results === undefined) return []
  if (!Array.isArray(results)) throw new WeatherError('bad-data')
  const places: Place[] = []
  for (const item of results) {
    const place = parsePlace(item)
    if (place === null) throw new WeatherError('bad-data')
    places.push(place)
  }
  return places
}

function parseCurrent(value: unknown): Current {
  if (!isRecord(value)) throw new WeatherError('bad-data')
  const temperature = value.temperature_2m
  const feelsLike = value.apparent_temperature
  const humidity = value.relative_humidity_2m
  const weatherCode = value.weather_code
  const windKmh = value.wind_speed_10m
  const isDay = value.is_day
  if (
    !isNumber(temperature) ||
    !isNumber(feelsLike) ||
    !isNumber(humidity) ||
    !isNumber(weatherCode) ||
    !isNumber(windKmh) ||
    !isNumber(isDay)
  ) {
    throw new WeatherError('bad-data')
  }
  return {
    temperature,
    feelsLike,
    humidity,
    weatherCode,
    windKmh,
    isDay: isDay === 1,
  }
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseDays(value: unknown): Day[] {
  if (!isRecord(value)) throw new WeatherError('bad-data')
  const dates = value.time
  const codes = numberArray(value.weather_code)
  const maxes = numberArray(value.temperature_2m_max)
  const mins = numberArray(value.temperature_2m_min)
  const rain = value.precipitation_probability_max
  if (
    !Array.isArray(dates) ||
    !dates.every((d) => isString(d) && DATE_PATTERN.test(d)) ||
    codes === null ||
    maxes === null ||
    mins === null ||
    !Array.isArray(rain) ||
    !rain.every(isNullableNumber)
  ) {
    throw new WeatherError('bad-data')
  }
  const length = dates.length
  if (
    codes.length !== length ||
    maxes.length !== length ||
    mins.length !== length ||
    rain.length !== length
  ) {
    throw new WeatherError('bad-data')
  }
  const days: Day[] = []
  for (let i = 0; i < length; i++) {
    const date = dates[i]
    const weatherCode = codes[i]
    const max = maxes[i]
    const min = mins[i]
    const rainChance = rain[i]
    if (
      !isString(date) ||
      weatherCode === undefined ||
      max === undefined ||
      min === undefined ||
      !isNullableNumber(rainChance)
    ) {
      throw new WeatherError('bad-data')
    }
    days.push({ date, weatherCode, max, min, rainChance })
  }
  return days
}

export async function getForecast(
  latitude: number,
  longitude: number,
  signal: AbortSignal,
): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current:
      'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '5',
  })
  const json = await requestJson(
    `https://api.open-meteo.com/v1/forecast?${params}`,
    signal,
  )
  if (!isRecord(json)) throw new WeatherError('bad-data')
  return { current: parseCurrent(json.current), days: parseDays(json.daily) }
}

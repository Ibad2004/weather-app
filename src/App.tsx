import { useEffect, useState } from 'react'
import {
  errorMessage,
  getForecast,
  isAbortError,
  searchPlaces,
  type Forecast,
  type Place,
} from './api/weather'
import { ForecastView } from './components/ForecastView'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { placeLabel, type Unit } from './format'
import {
  RECENT_KEY,
  UNIT_KEY,
  addRecent,
  parseRecent,
  parseUnit,
  readStorage,
  writeStorage,
} from './storage'

const MAX_INPUT = 100
const MIN_QUERY = 2
const DEBOUNCE_MS = 400

type Outcome<T> =
  { status: 'error'; message: string } | ({ status: 'success' } & T)

// A result is tagged with the request that produced it, so a stale one is never shown.
type SearchResult = { query: string; attempt: number } & Outcome<{
  places: Place[]
}>
type ForecastResult = { place: Place; attempt: number } & Outcome<{
  forecast: Forecast
}>

export default function App() {
  const [input, setInput] = useState('')
  const [unit, setUnit] = useState<Unit>(() => parseUnit(readStorage(UNIT_KEY)))
  const [recent, setRecent] = useState<Place[]>(() =>
    parseRecent(readStorage(RECENT_KEY)),
  )
  // On a reload, show the most recent city straight away.
  const [place, setPlace] = useState<Place | null>(() => recent[0] ?? null)
  const [search, setSearch] = useState<SearchResult | null>(null)
  const [forecast, setForecast] = useState<ForecastResult | null>(null)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [forecastAttempt, setForecastAttempt] = useState(0)

  const trimmed = input.trim()
  const query = useDebouncedValue(trimmed, DEBOUNCE_MS)
  const tooShort = trimmed.length < MIN_QUERY

  useEffect(() => {
    if (query.length < MIN_QUERY) return
    const controller = new AbortController()
    searchPlaces(query, controller.signal).then(
      (places) => {
        if (controller.signal.aborted) return
        setSearch({ status: 'success', query, attempt: searchAttempt, places })
        setPlace(places.length === 1 ? (places[0] ?? null) : null)
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setSearch({
          status: 'error',
          query,
          attempt: searchAttempt,
          message: errorMessage(error),
        })
      },
    )
    return () => controller.abort()
  }, [query, searchAttempt])

  useEffect(() => {
    writeStorage(RECENT_KEY, JSON.stringify(recent))
  }, [recent])

  function changeUnit(next: Unit) {
    setUnit(next)
    writeStorage(UNIT_KEY, next)
  }

  useEffect(() => {
    if (place === null) return
    const controller = new AbortController()
    getForecast(place.latitude, place.longitude, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return
        setForecast({
          status: 'success',
          place,
          attempt: forecastAttempt,
          forecast: result,
        })
        setRecent((previous) => addRecent(previous, place))
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setForecast({
          status: 'error',
          place,
          attempt: forecastAttempt,
          message: errorMessage(error),
        })
      },
    )
    return () => controller.abort()
  }, [place, forecastAttempt])

  type View<R> = { status: 'idle' } | { status: 'loading' } | R
  const forecastView: View<ForecastResult> =
    place === null
      ? { status: 'idle' }
      : forecast !== null &&
          forecast.place === place &&
          forecast.attempt === forecastAttempt
        ? forecast
        : { status: 'loading' }

  const searchView: View<SearchResult> = tooShort
    ? { status: 'idle' }
    : search !== null &&
        search.query === query &&
        search.attempt === searchAttempt
      ? search
      : { status: 'loading' }
  const searchError = searchView.status === 'error' ? searchView.message : null

  let announcement = ''
  if (forecastView.status === 'success') {
    announcement = `Weather for ${placeLabel(forecastView.place)} loaded`
  } else if (forecastView.status === 'error') {
    announcement = forecastView.message
  } else if (searchError !== null) {
    announcement = searchError
  }

  return (
    <main className="app">
      <header className="top">
        <h1>Weather</h1>
        <div className="unit-toggle" role="group" aria-label="Temperature unit">
          {(['C', 'F'] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => changeUnit(u)}
            >
              {'\u00B0'}
              {u}
            </button>
          ))}
        </div>
      </header>

      <div className="search">
        <label htmlFor="search">Search for a city</label>
        <input
          id="search"
          type="search"
          value={input}
          maxLength={MAX_INPUT}
          autoComplete="off"
          onChange={(event) => setInput(event.target.value.slice(0, MAX_INPUT))}
        />
      </div>

      {tooShort && <p className="hint">Type at least 2 letters</p>}
      {searchView.status === 'loading' && <p>Searching…</p>}
      {searchView.status === 'error' && (
        <div className="error">
          <p>{searchView.message}</p>
          <button type="button" onClick={() => setSearchAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {searchView.status === 'success' && searchView.places.length === 0 && (
        <p>No places found for "{searchView.query}". Check the spelling.</p>
      )}
      {searchView.status === 'success' && searchView.places.length > 1 && (
        <ul className="button-list places" aria-label="Matching places">
          {searchView.places.map((candidate) => (
            <li key={candidate.id}>
              <button type="button" onClick={() => setPlace(candidate)}>
                {placeLabel(candidate)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <section className="recent" aria-labelledby="recent-heading">
          <h2 id="recent-heading">Recent searches</h2>
          <ul className="button-list">
            {recent.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setPlace(item)}>
                  {placeLabel(item)}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="clear" onClick={() => setRecent([])}>
            Clear recent searches
          </button>
        </section>
      )}

      {forecastView.status === 'loading' && <p>Loading weather…</p>}
      {forecastView.status === 'error' && (
        <div className="error">
          <p>{forecastView.message}</p>
          <button
            type="button"
            onClick={() => setForecastAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {forecastView.status === 'success' && (
        <ForecastView
          placeName={placeLabel(forecastView.place)}
          forecast={forecastView.forecast}
          unit={unit}
        />
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <footer>
        <p>
          Weather data by{' '}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open-Meteo.com
          </a>
        </p>
      </footer>
    </main>
  )
}

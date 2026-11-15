import { act, fireEvent, render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import {
  forecastJson,
  hang,
  jsonResponse,
  london,
  mockFetch,
  type Handler,
} from './test/helpers'

// Captured before fake timers replace it.
const realSetTimeout = globalThis.setTimeout

const paris = {
  id: 2,
  name: 'Paris',
  admin1: '\u00CEle-de-France',
  country: 'France',
  latitude: 48.85,
  longitude: 2.35,
}
const tokyo = {
  id: 3,
  name: 'Tokyo',
  country: 'Japan',
  latitude: 35.7,
  longitude: 139.7,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

/** Router: geocoding by name, forecast by latitude. */
function routes(
  places: Record<string, unknown[]>,
  forecasts: Record<string, Handler> = {},
) {
  return mockFetch(async (url, init) => {
    if (url.hostname.startsWith('geocoding')) {
      const found = places[url.searchParams.get('name') ?? '']
      return jsonResponse(found === undefined ? {} : { results: found })
    }
    const handler = forecasts[url.searchParams.get('latitude') ?? '']
    return handler === undefined
      ? jsonResponse(forecastJson())
      : handler(url, init)
  })
}

function type(text: string) {
  fireEvent.change(screen.getByLabelText('Search for a city'), {
    target: { value: text },
  })
}

/** Lets pending promises and React updates settle (fake timers block RTL's findBy*). */
async function tick() {
  await act(async () => {
    await new Promise((resolve) => realSetTimeout(resolve, 0))
  })
}

async function until<T>(read: () => T): Promise<T> {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return read()
    } catch {
      await tick()
    }
  }
  return read()
}

const find = {
  // Visible text only: the live region repeats messages for screen readers.
  text: (text: string) =>
    until(() => screen.getByText(text, { selector: 'p' })),
  role: (...args: Parameters<typeof screen.getByRole>) =>
    until(() => screen.getByRole(...args)),
}

async function search(text: string) {
  type(text)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400)
  })
}

function searchCalls(fetchMock: ReturnType<typeof mockFetch>) {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).includes('geocoding'),
  )
}

function gate() {
  let release: () => void = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release: () => release() }
}

async function expectNoViolations() {
  vi.useRealTimers() // axe schedules its own timers
  const results = await axe.run(document.body)
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}

describe('search input', () => {
  it('has a label and an attribution footer', () => {
    routes({})
    render(<App />)
    expect(screen.getByLabelText('Search for a city')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Open-Meteo.com' }),
    ).toHaveAttribute('href', 'https://open-meteo.com/')
  })

  it('sends one request for six typed letters (debounce)', async () => {
    const fetchMock = routes({ London: [london], Londo: [] })
    render(<App />)
    for (const letters of ['L', 'Lo', 'Lon', 'Lond', 'Londo', 'London']) {
      type(letters)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50)
      })
    }
    expect(fetchMock).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(searchCalls(fetchMock)).toHaveLength(1)
    expect(
      new URL(String(searchCalls(fetchMock)[0]?.[0])).searchParams.get('name'),
    ).toBe('London')
  })

  it('shows a hint and sends nothing for fewer than 2 characters', async () => {
    const fetchMock = routes({})
    render(<App />)
    await search('a')
    expect(screen.getByText('Type at least 2 letters')).toBeInTheDocument()
    await search('  b  ')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('trims the text and limits it to 100 characters', async () => {
    const fetchMock = routes({})
    render(<App />)
    await search('x'.repeat(150))
    const name = new URL(
      String(searchCalls(fetchMock)[0]?.[0]),
    ).searchParams.get('name')
    expect(name).toBe('x'.repeat(100))
  })

  it('works with Urdu and accented names', async () => {
    const fetchMock = routes({
      '\u0644\u0627\u06C1\u0648\u0631': [],
      'S\u00E3o Paulo': [],
    })
    render(<App />)
    await search('\u0644\u0627\u06C1\u0648\u0631')
    await find.text(
      'No places found for "\u0644\u0627\u06C1\u0648\u0631". Check the spelling.',
    )
    await search('S\u00E3o Paulo')
    await find.text('No places found for "S\u00E3o Paulo". Check the spelling.')
    expect(searchCalls(fetchMock)).toHaveLength(2)
  })
})

describe('search results', () => {
  it('says so when no place is found', async () => {
    routes({})
    render(<App />)
    await search('Atlantis')
    expect(
      await find.text('No places found for "Atlantis". Check the spelling.'),
    ).toBeInTheDocument()
  })

  it('picks a single place automatically', async () => {
    routes({ Tokyo: [tokyo] })
    render(<App />)
    await search('Tokyo')
    expect(
      await find.role('heading', { name: 'Tokyo, Japan' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('list', { name: 'Matching places' }),
    ).not.toBeInTheDocument()
  })

  it('lists several places as buttons and loads the picked one', async () => {
    routes({ Lon: [london, paris] })
    render(<App />)
    await search('Lon')
    const button = await find.role('button', {
      name: 'London, England, United Kingdom',
    })
    expect(
      screen.getByRole('button', { name: 'Paris, \u00CEle-de-France, France' }),
    ).toBeInTheDocument()
    fireEvent.click(button)
    expect(
      await find.role('heading', {
        name: 'London, England, United Kingdom',
      }),
    ).toBeInTheDocument()
  })

  it('hides the places list after picking one and shows it again for a new search', async () => {
    routes({ Lon: [london, paris], Par: [paris, london] })
    render(<App />)
    await search('Lon')
    fireEvent.click(await find.role('button', { name: /^London/ }))
    await find.role('heading', { name: /London/ })
    expect(screen.queryByRole('list', { name: 'Matching places' })).toBeNull()
    expect(screen.getByLabelText('Search for a city')).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Weather for London, England, United Kingdom loaded',
    )
    await search('Par')
    await find.role('list', { name: 'Matching places' })
  })
  it('aborts a stale search and ignores its answer', async () => {
    let firstSignal: AbortSignal | null | undefined
    const slow = gate()
    mockFetch(async (url, init) => {
      if (!url.hostname.startsWith('geocoding'))
        return jsonResponse(forecastJson())
      if (url.searchParams.get('name') === 'Lon') {
        firstSignal = init?.signal
        // Answers late, after being aborted, as a slow server might.
        await slow.promise
        return jsonResponse({ results: [london, paris] })
      }
      return jsonResponse({ results: [tokyo] })
    })
    render(<App />)
    await search('Lon')
    expect(firstSignal?.aborted).toBe(false)
    await search('Tokyo')
    expect(firstSignal?.aborted).toBe(true)
    expect(
      await find.role('heading', { name: 'Tokyo, Japan' }),
    ).toBeInTheDocument()
    slow.release()
    await tick()
    await tick()
    expect(
      screen.queryByRole('button', { name: /London/ }),
    ).not.toBeInTheDocument()
  })
})

describe('forecast', () => {
  it('shows current weather and five days with city-based labels', async () => {
    routes({ Tokyo: [tokyo] })
    render(<App />)
    await search('Tokyo')
    await find.role('heading', { name: 'Tokyo, Japan' })
    expect(screen.getByText('14\u00B0')).toBeInTheDocument()
    expect(screen.getByText('Feels like 13\u00B0')).toBeInTheDocument()
    expect(screen.getByText('Humidity 71%')).toBeInTheDocument()
    expect(screen.getByText('Wind 18 km/h')).toBeInTheDocument()
    expect(screen.getAllByText('Rain').length).toBeGreaterThan(0)
    const items = within(
      screen.getByRole('list', { name: '5-day forecast' }),
    ).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items[0]).toHaveTextContent('Today')
    expect(items[1]).toHaveTextContent('Tue 18 Nov')
    expect(items[2]).toHaveTextContent('Rain \u2013')
    expect(items[2]).toHaveTextContent('11\u00B0 / 0\u00B0')
  })

  it('shows -0 as 0\u00B0 and converts to Fahrenheit on screen', async () => {
    routes(
      { Tokyo: [tokyo] },
      {
        '35.7': async () =>
          jsonResponse(forecastJson({ current: { temperature_2m: -0.3 } })),
      },
    )
    render(<App />)
    await search('Tokyo')
    await find.role('heading', { name: 'Tokyo, Japan' })
    expect(screen.queryByText('-0\u00B0')).not.toBeInTheDocument()
    expect(screen.getByText('0\u00B0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '\u00B0F' }))
    expect(screen.getByText('31\u00B0')).toBeInTheDocument()
  })

  it('shows the latest place when switching quickly', async () => {
    const slow = gate()
    routes(
      { Lon: [london, paris] },
      {
        '51.5': async () => {
          await slow.promise
          return jsonResponse(forecastJson({ current: { temperature_2m: 1 } }))
        },
        '48.85': async () =>
          jsonResponse(forecastJson({ current: { temperature_2m: 30 } })),
      },
    )
    // London (slow) loads on mount; Paris is picked from the recent list meanwhile.
    localStorage.setItem('weather:recent', JSON.stringify([london, paris]))
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /^Paris/ }))
    expect(await find.role('heading', { name: /Paris/ })).toBeInTheDocument()
    slow.release()
    await tick()
    await tick()
    expect(screen.getByText('30\u00B0')).toBeInTheDocument()
    expect(screen.queryByText('1\u00B0')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: /London/ }),
    ).not.toBeInTheDocument()
  })

  it('announces success in a live region without moving focus', async () => {
    routes({ Tokyo: [tokyo] })
    render(<App />)
    const input = screen.getByLabelText('Search for a city')
    input.focus()
    await search('Tokyo')
    await find.role('heading', { name: 'Tokyo, Japan' })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Weather for Tokyo, Japan loaded',
    )
    expect(input).toHaveFocus()
  })
})

describe('errors', () => {
  it.each([
    [
      'network',
      () => Promise.reject(new TypeError('offline')),
      "Can't reach the weather service. Check your internet.",
    ],
    [
      '429',
      () => Promise.resolve(jsonResponse({}, 429)),
      'Too many searches. Wait a moment and try again.',
    ],
    [
      '500',
      () => Promise.resolve(jsonResponse({}, 500)),
      'The weather service had a problem. Try again.',
    ],
    [
      'bad data',
      () => Promise.resolve(jsonResponse({ results: 'nope' })),
      "The weather service sent data we can't read.",
    ],
  ])(
    'shows the %s message for a search and retries',
    async (_name, fail, message) => {
      let failing = true
      mockFetch(async () => (failing ? fail() : jsonResponse({ results: [] })))
      render(<App />)
      await search('Tokyo')
      expect(await find.text(message)).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(message)
      failing = false
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(
        await find.text('No places found for "Tokyo". Check the spelling.'),
      ).toBeInTheDocument()
    },
  )

  it('shows the timeout message', async () => {
    mockFetch((_url, init) => hang(init))
    render(<App />)
    await search('Tokyo')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000)
    })
    await tick()
    expect(
      await find.text('The weather service is taking too long.'),
    ).toBeInTheDocument()
  })

  it('retries a failed forecast for the same place', async () => {
    let failing = true
    const fetchMock = routes(
      { Tokyo: [tokyo] },
      {
        '35.7': async () =>
          failing ? jsonResponse({}, 503) : jsonResponse(forecastJson()),
      },
    )
    render(<App />)
    await search('Tokyo')
    expect(
      await find.text('The weather service had a problem. Try again.'),
    ).toBeInTheDocument()
    failing = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await find.role('heading', { name: 'Tokyo, Japan' }),
    ).toBeInTheDocument()
    expect(searchCalls(fetchMock)).toHaveLength(1)
  })

  it('shows an error for mismatched daily arrays', async () => {
    routes(
      { Tokyo: [tokyo] },
      {
        '35.7': async () =>
          jsonResponse(forecastJson({ daily: { weather_code: [1] } })),
      },
    )
    render(<App />)
    await search('Tokyo')
    expect(
      await find.text("The weather service sent data we can't read."),
    ).toBeInTheDocument()
  })

  it('never shows a cancelled request as an error', async () => {
    mockFetch((_url, init) => hang(init))
    const { unmount } = render(<App />)
    await search('Tokyo')
    unmount()
    expect(screen.queryByText(/weather service/)).not.toBeInTheDocument()
  })
})

describe('accessibility (axe)', () => {
  it('idle', async () => {
    routes({})
    render(<App />)
    await expectNoViolations()
  })

  it('list of places', async () => {
    routes({ Lon: [london, paris] })
    render(<App />)
    await search('Lon')
    await find.role('button', { name: /London/ })
    await expectNoViolations()
  })

  it('loading', async () => {
    mockFetch((_url, init) => hang(init))
    render(<App />)
    await search('Lon')
    expect(screen.getByText('Searching\u2026')).toBeInTheDocument()
    await expectNoViolations()
  })

  it('error', async () => {
    mockFetch(async () => jsonResponse({}, 500))
    render(<App />)
    await search('Lon')
    await find.role('button', { name: 'Try again' })
    await expectNoViolations()
  })

  it('success', async () => {
    routes({ Tokyo: [tokyo] })
    render(<App />)
    await search('Tokyo')
    await find.role('heading', { name: 'Tokyo, Japan' })
    await expectNoViolations()
  })
})

describe('unit toggle', () => {
  const pressed = (name: string) =>
    screen.getByRole('button', { name }).getAttribute('aria-pressed')

  it('has two aria-pressed buttons and defaults to Celsius', () => {
    routes({})
    render(<App />)
    expect(pressed('\u00B0C')).toBe('true')
    expect(pressed('\u00B0F')).toBe('false')
  })

  it('remembers the choice after a reload', () => {
    routes({})
    const first = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '\u00B0F' }))
    expect(localStorage.getItem('weather:unit')).toBe('F')
    first.unmount()
    render(<App />)
    expect(pressed('\u00B0F')).toBe('true')
    expect(pressed('\u00B0C')).toBe('false')
  })

  it.each(['banana', '', '"F"', '{"unit":"F"}'])(
    'falls back to Celsius for the saved value %j',
    (saved) => {
      localStorage.setItem('weather:unit', saved)
      routes({})
      render(<App />)
      expect(pressed('\u00B0C')).toBe('true')
    },
  )
})

describe('recent searches', () => {
  const recentButtons = () =>
    within(screen.getByRole('region', { name: 'Recent searches' }))
      .getAllByRole('button')
      .map((b) => b.textContent)

  it('saves searched places newest first', async () => {
    routes({ Tokyo: [tokyo], London: [london] })
    render(<App />)
    await search('Tokyo')
    await find.role('heading', { name: 'Tokyo, Japan' })
    await search('London')
    await find.role('heading', { name: 'London, England, United Kingdom' })
    expect(recentButtons()).toEqual([
      'London, England, United Kingdom',
      'Tokyo, Japan',
      'Clear recent searches',
    ])
    const saved: unknown = JSON.parse(
      localStorage.getItem('weather:recent') ?? '',
    )
    expect(Array.isArray(saved) && saved.length).toBe(2)
  })

  it('shows the most recent city on reload without a geocoding request', async () => {
    localStorage.setItem('weather:recent', JSON.stringify([tokyo, london]))
    const fetchMock = routes({})
    render(<App />)
    await find.role('heading', { name: 'Tokyo, Japan' })
    expect(searchCalls(fetchMock)).toHaveLength(0)
  })

  it('loads a clicked recent place straight away', async () => {
    localStorage.setItem('weather:recent', JSON.stringify([tokyo, london]))
    const fetchMock = routes({})
    render(<App />)
    await find.role('heading', { name: 'Tokyo, Japan' })
    fireEvent.click(
      screen.getByRole('button', { name: 'London, England, United Kingdom' }),
    )
    await find.role('heading', { name: 'London, England, United Kingdom' })
    expect(searchCalls(fetchMock)).toHaveLength(0)
  })

  it('clears the list and the saved value', async () => {
    localStorage.setItem('weather:recent', JSON.stringify([tokyo]))
    routes({})
    render(<App />)
    await find.role('heading', { name: 'Tokyo, Japan' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Clear recent searches' }),
    )
    expect(screen.queryByRole('region', { name: 'Recent searches' })).toBeNull()
    expect(localStorage.getItem('weather:recent')).toBe('[]')
  })

  it('skips broken JSON and bad items without crashing', async () => {
    localStorage.setItem('weather:recent', '{not json')
    routes({})
    const first = render(<App />)
    expect(screen.queryByRole('region', { name: 'Recent searches' })).toBeNull()
    first.unmount()
    localStorage.setItem(
      'weather:recent',
      JSON.stringify([42, null, { name: 'Bad' }, london]),
    )
    render(<App />)
    await find.role('heading', { name: 'London, England, United Kingdom' })
  })

  it('keeps working in memory when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    routes({ Tokyo: [tokyo] })
    render(<App />)
    await search('Tokyo')
    await find.role('heading', { name: 'Tokyo, Japan' })
    expect(recentButtons()).toContain('Tokyo, Japan')
    fireEvent.click(screen.getByRole('button', { name: '\u00B0F' }))
    expect(
      screen
        .getByRole('button', { name: '\u00B0F' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('has no axe violations with recent searches and the unit buttons', async () => {
    localStorage.setItem('weather:recent', JSON.stringify([tokyo, london]))
    routes({})
    render(<App />)
    await find.role('heading', { name: 'Tokyo, Japan' })
    await expectNoViolations()
  })
})

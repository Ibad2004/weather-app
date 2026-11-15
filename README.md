# Weather app

Search for a city and see the current weather and a 5-day forecast. Built with React, TypeScript and Vite for Week 3.

Live demo: https://weather-app-gilt-psi-38.vercel.app/

## Run it

```
npm install
npm run dev       # http://localhost:5173
npm run check     # lint + tests + build
```

Needs Node 20.19 or newer. No API key and no `.env` file.

## Features

- Search with a 400 ms debounce, "Searching..." state, and a list when several places match (Urdu and accented names work).
- Current weather: temperature, feels like, humidity, wind (km/h), description and emoji from the WMO weather code.
- 5-day forecast with the city's own dates, max/min and chance of rain.
- Celsius / Fahrenheit toggle, remembered between visits.
- Recent searches (up to 5), one click to reload a city, "Clear recent searches". The last city shows on reload.
- Error messages with a "Try again" button; a screen-reader live region announces results without moving focus.
- Light and dark theme, 320 to 1440 px wide, keyboard focus ring, reduced-motion respected.

## The API

[Open-Meteo](https://open-meteo.com/) (free, no key). Two calls, geocoding first and then the forecast:

1. `geocoding-api.open-meteo.com/v1/search` turns a name into places (max 5).
2. `api.open-meteo.com/v1/forecast` returns current weather and 5 daily values with `timezone=auto`, so dates are the city's, not the viewer's.

Weather data by Open-Meteo.com (attribution is shown in the footer, as their licence asks).

## Main decisions

- **useEffect + AbortController.** Each search and each forecast aborts the previous one in the effect cleanup, so an old answer can never replace a newer one. A cancelled request is ignored, not shown as an error.
- **Debounce hook.** `useDebouncedValue` uses `setTimeout` and `clearTimeout` in the cleanup, so typing "London" sends one request.
- **One status per request** (`idle | loading | error | success`) instead of several booleans. Results are tagged with the request that made them, so the wrong city's data is never shown.
- **`response.ok` is checked** (fetch does not throw on 404/500); error bodies are cancelled. 8 s timeout combined with the caller's signal.
- **Type guards, no `as`.** The JSON is `unknown`; bad data or mismatched daily arrays become a friendly error.
- **Always fetch in Celsius**, convert on screen (F = C x 9/5 + 32, rounded last, never "-0").
- Only `src/api/weather.ts` calls `fetch`. Colours live only in `src/styles/tokens.css` (a test checks this).

## Edge cases handled

- Fewer than 2 letters: a hint, no request. Input is trimmed and cut at 100 characters.
- No results: "No places found for ...". One result is picked automatically.
- Offline, timeout, 429 and 5xx each have their own message.
- Switching city quickly shows the latest one.
- Broken or blocked localStorage: bad items are skipped and the app keeps working in memory.

## What broke

- **PowerShell `>` redirect.** An `npm pkg set "engines.node=>=20.19"` command was split by PowerShell, which treated `>` as a redirect and created an empty file called `20.19`. It got committed, so I rewrote the local commits to remove it. Lesson: quote arguments that contain `>`.
- **Fake timers + `findBy` hang.** With `vi.useFakeTimers` faking `setTimeout`, Testing Library's `findBy*` and `userEvent.type` wait forever. Fix: a small `tick()` / `find` helper with real `setImmediate`-style ticks, and `fireEvent` for typing.
- **axe + fake timers.** `axe.run` also hangs under fake timers, so those tests switch to real timers first.
- **Stale-search test gave a false pass.** A mock answered with a fake `setTimeout(0)`, which the debounce advance fired early, so the request finished before it was aborted. Fixed with a manual gate promise.
- **PowerShell encoding.** Writing emoji and Urdu through `Set-Content` turned them into `?`, and the tests passed anyway because both sides were broken. The source now uses `\u` escapes.
- **CSS test was empty.** Vitest returns `""` for `?raw` CSS imports, so the "no raw colours" test checked nothing. It now reads the files with `node:fs` and asserts they are not empty.

## Tests

`npm test` runs Vitest with Testing Library, jsdom and axe-core. `fetch` is always mocked, never the real API. Covered: debounce, short input, 0/1/many places, stale search, fast switching, every error message, retry, bad data, WMO codes, day labels, unit conversion, storage edge cases, and axe in every state.

## 1-minute phone demo

1. Open the app on a phone. Point out the light/dark theme and the footer credit.
2. Type "L" and show the hint. Type "London" and show "Searching...", then the list of places.
3. Tap "London, England, United Kingdom". Show the current weather and the 5 day cards wrapping.
4. Tap the F button, then reload the page: it stays in F and London is still shown.
5. Search "Tokyo", then show both cities under Recent searches. Tap London again (no new search).
6. Turn on airplane mode, tap Try again, and show the friendly offline message.
7. Tap "Clear recent searches".

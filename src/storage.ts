import { parsePlace, type Place } from './api/weather'
import type { Unit } from './format'

export const UNIT_KEY = 'weather:unit'
export const RECENT_KEY = 'weather:recent'
export const MAX_RECENT = 5

// Storage can be blocked (privacy mode, iframes) or full: never let it crash the app.
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Keep working in memory.
  }
}

export function parseUnit(raw: string | null): Unit {
  return raw === 'F' ? 'F' : 'C'
}

export function samePlace(a: Place, b: Place): boolean {
  return (
    a.id === b.id || (a.latitude === b.latitude && a.longitude === b.longitude)
  )
}

/** Newest first, no duplicates, at most MAX_RECENT. */
export function addRecent(list: Place[], place: Place): Place[] {
  return [place, ...list.filter((item) => !samePlace(item, place))].slice(
    0,
    MAX_RECENT,
  )
}

/** Reads untrusted storage text: broken JSON or bad items are skipped. */
export function parseRecent(raw: string | null): Place[] {
  if (raw === null) return []
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(json)) return []
  const places: Place[] = []
  for (const item of json) {
    const place = parsePlace(item)
    if (place !== null && !places.some((p) => samePlace(p, place)))
      places.push(place)
  }
  return places.slice(0, MAX_RECENT)
}

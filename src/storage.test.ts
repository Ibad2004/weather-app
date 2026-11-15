import { describe, expect, it } from 'vitest'
import { parseUnit, addRecent, parseRecent, MAX_RECENT } from './storage'
import type { Place } from './api/weather'

const place = (id: number, latitude = id, longitude = id): Place => ({
  id,
  name: `P${id}`,
  latitude,
  longitude,
})

describe('addRecent', () => {
  it('puts the newest first', () => {
    expect(addRecent([place(1)], place(2)).map((p) => p.id)).toEqual([2, 1])
  })
  it('moves a repeated place (same id) to the front without duplicating', () => {
    expect(addRecent([place(1), place(2)], place(2)).map((p) => p.id)).toEqual([
      2, 1,
    ])
  })
  it('treats the same lat/lon as the same place', () => {
    const list = addRecent([place(1, 10, 20)], place(99, 10, 20))
    expect(list.map((p) => p.id)).toEqual([99])
  })
  it('keeps at most 5', () => {
    let list: Place[] = []
    for (let i = 1; i <= 8; i++) list = addRecent(list, place(i))
    expect(list).toHaveLength(MAX_RECENT)
    expect(list.map((p) => p.id)).toEqual([8, 7, 6, 5, 4])
  })
})

describe('parseRecent', () => {
  it('returns [] for null, broken JSON and non-arrays', () => {
    expect(parseRecent(null)).toEqual([])
    expect(parseRecent('{oops')).toEqual([])
    expect(parseRecent('{"a":1}')).toEqual([])
    expect(parseRecent('"text"')).toEqual([])
  })
  it('skips bad items and keeps good ones', () => {
    const raw = JSON.stringify([
      1,
      null,
      'x',
      { id: 'a' },
      { name: 'N' },
      place(3),
    ])
    expect(parseRecent(raw).map((p) => p.id)).toEqual([3])
  })
  it('drops duplicates and caps at 5', () => {
    const raw = JSON.stringify([1, 1, 2, 3, 4, 5, 6, 7].map((i) => place(i)))
    expect(parseRecent(raw).map((p) => p.id)).toEqual([1, 2, 3, 4, 5])
  })
})

describe('parseUnit', () => {
  it('accepts F, and falls back to C for anything else', () => {
    expect(parseUnit('F')).toBe('F')
    expect(parseUnit('C')).toBe('C')
    expect(parseUnit(null)).toBe('C')
    expect(parseUnit('kelvin')).toBe('C')
  })
})

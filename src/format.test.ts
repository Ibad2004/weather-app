import { describe, expect, it } from 'vitest'
import { dayLabel, formatTemp, placeLabel } from './format'
import { describeWeather } from './weatherCodes'

describe('describeWeather', () => {
  it.each([
    [0, true, 'Clear sky', '\u2600\uFE0F'],
    [0, false, 'Clear sky', '\u{1F319}'],
    [2, true, 'Cloudy', '\u26C5'],
    [45, true, 'Fog', '\u{1F32B}\uFE0F'],
    [53, true, 'Drizzle', '\u{1F326}\uFE0F'],
    [65, true, 'Rain', '\u{1F327}\uFE0F'],
    [73, true, 'Snow', '\u2744\uFE0F'],
    [81, true, 'Rain showers', '\u{1F326}\uFE0F'],
    [86, true, 'Snow showers', '\u{1F328}\uFE0F'],
    [96, true, 'Thunderstorm', '\u26C8\uFE0F'],
    [999, true, 'Unknown', '\u2753'],
    [58, true, 'Unknown', '\u2753'],
  ])('code %i (day=%s) ? %s', (code, isDay, description, emoji) => {
    expect(describeWeather(code, isDay)).toEqual({ description, emoji })
  })
})

describe('dayLabel', () => {
  it('says Today for the first day', () =>
    expect(dayLabel('2025-11-17', 0)).toBe('Today'))
  it('builds weekday + date from the string', () =>
    expect(dayLabel('2025-11-18', 1)).toBe('Tue 18 Nov'))
  it('handles the end of a month', () =>
    expect(dayLabel('2025-11-30', 1)).toBe('Sun 30 Nov'))
  it('handles the end of a year and a leap day', () => {
    expect(dayLabel('2025-12-31', 1)).toBe('Wed 31 Dec')
    expect(dayLabel('2026-01-01', 1)).toBe('Thu 1 Jan')
    expect(dayLabel('2028-02-29', 1)).toBe('Tue 29 Feb')
  })
  it('falls back to the raw text for a malformed date', () =>
    expect(dayLabel('nope', 1)).toBe('nope'))
})

describe('formatTemp', () => {
  it('rounds', () => expect(formatTemp(14.6)).toBe('15\u00B0'))
  it('never shows -0\u00B0', () => {
    expect(formatTemp(-0.2)).toBe('0\u00B0')
    expect(formatTemp(-0)).toBe('0\u00B0')
  })
  it('keeps real negatives', () => expect(formatTemp(-3.4)).toBe('-3\u00B0'))
  it('converts to Fahrenheit on screen', () => {
    expect(formatTemp(0, 'F')).toBe('32\u00B0')
    expect(formatTemp(-17.8, 'F')).toBe('0\u00B0')
  })
})

describe('placeLabel', () => {
  it('joins the available parts', () => {
    expect(
      placeLabel({
        name: 'London',
        admin1: 'England',
        country: 'United Kingdom',
      }),
    ).toBe('London, England, United Kingdom')
    expect(placeLabel({ name: 'Monaco' })).toBe('Monaco')
  })
})

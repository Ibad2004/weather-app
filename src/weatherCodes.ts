export type Condition = { description: string; emoji: string }

export function describeWeather(code: number, isDay: boolean): Condition {
  if (code === 0)
    return {
      description: 'Clear sky',
      emoji: isDay ? '\u2600\uFE0F' : '\u{1F319}',
    }
  if (code >= 1 && code <= 3) return { description: 'Cloudy', emoji: '\u26C5' }
  if (code === 45 || code === 48)
    return { description: 'Fog', emoji: '\u{1F32B}\uFE0F' }
  if (code >= 51 && code <= 57)
    return { description: 'Drizzle', emoji: '\u{1F326}\uFE0F' }
  if (code >= 61 && code <= 67)
    return { description: 'Rain', emoji: '\u{1F327}\uFE0F' }
  if (code >= 71 && code <= 77)
    return { description: 'Snow', emoji: '\u2744\uFE0F' }
  if (code >= 80 && code <= 82)
    return { description: 'Rain showers', emoji: '\u{1F326}\uFE0F' }
  if (code === 85 || code === 86)
    return { description: 'Snow showers', emoji: '\u{1F328}\uFE0F' }
  if (code >= 95 && code <= 99)
    return { description: 'Thunderstorm', emoji: '\u26C8\uFE0F' }
  return { description: 'Unknown', emoji: '\u2753' }
}

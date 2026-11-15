export type Condition = { description: string; emoji: string }

export function describeWeather(code: number, isDay: boolean): Condition {
  if (code === 0)
    return { description: 'Clear sky', emoji: isDay ? '??' : '??' }
  if (code >= 1 && code <= 3) return { description: 'Cloudy', emoji: '?' }
  if (code === 45 || code === 48) return { description: 'Fog', emoji: '???' }
  if (code >= 51 && code <= 57) return { description: 'Drizzle', emoji: '???' }
  if (code >= 61 && code <= 67) return { description: 'Rain', emoji: '???' }
  if (code >= 71 && code <= 77) return { description: 'Snow', emoji: '??' }
  if (code >= 80 && code <= 82)
    return { description: 'Rain showers', emoji: '???' }
  if (code === 85 || code === 86)
    return { description: 'Snow showers', emoji: '???' }
  if (code >= 95 && code <= 99)
    return { description: 'Thunderstorm', emoji: '??' }
  return { description: 'Unknown', emoji: '?' }
}

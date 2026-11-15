export type Unit = 'C' | 'F'

/** Rounds for display; never returns "-0\u00B0". */
export function formatTemp(celsius: number, unit: Unit = 'C'): string {
  const value = unit === 'F' ? (celsius * 9) / 5 + 32 : celsius
  const rounded = Math.round(value)
  return `${rounded === 0 ? 0 : rounded}\u00B0`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/** Label for a "YYYY-MM-DD" string, built from its parts (no Date parsing of the string). */
export function dayLabel(date: string, index: number): string {
  if (index === 0) return 'Today'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (match === null) return date
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  const monthName = MONTHS[month - 1]
  if (weekday === undefined || monthName === undefined) return date
  return `${weekday} ${day} ${monthName}`
}

export function placeLabel(place: {
  name: string
  admin1?: string
  country?: string
}): string {
  return [place.name, place.admin1, place.country]
    .filter((part) => part !== undefined && part !== '')
    .join(', ')
}

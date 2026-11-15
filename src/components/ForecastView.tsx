import type { Forecast } from '../api/weather'
import { dayLabel, formatTemp, type Unit } from '../format'
import { describeWeather } from '../weatherCodes'

type Props = {
  placeName: string
  forecast: Forecast
  unit: Unit
  onUnitChange: (unit: Unit) => void
}

export function ForecastView({
  placeName,
  forecast,
  unit,
  onUnitChange,
}: Props) {
  const { current, days } = forecast
  const condition = describeWeather(current.weatherCode, current.isDay)
  return (
    <section aria-labelledby="current-heading" className="forecast">
      <div className="unit-toggle" role="group" aria-label="Temperature unit">
        {(['C', 'F'] as const).map((u) => (
          <button
            key={u}
            type="button"
            aria-pressed={unit === u}
            onClick={() => onUnitChange(u)}
          >
            {'\u00B0'}
            {u}
          </button>
        ))}
      </div>
      <h2 id="current-heading">{placeName}</h2>
      <p className="current-temp">
        <span aria-hidden="true">{condition.emoji}</span>{' '}
        {formatTemp(current.temperature, unit)}
      </p>
      <p>{condition.description}</p>
      <p>Feels like {formatTemp(current.feelsLike, unit)}</p>
      <p>Humidity {Math.round(current.humidity)}%</p>
      <p>Wind {Math.round(current.windKmh)} km/h</p>

      <h3>5-day forecast</h3>
      <ul className="days">
        {days.map((day, index) => {
          const dayCondition = describeWeather(day.weatherCode, true)
          return (
            <li key={day.date}>
              <strong>{dayLabel(day.date, index)}</strong>
              <span aria-hidden="true">{dayCondition.emoji}</span>
              <span>{dayCondition.description}</span>
              <span>
                {formatTemp(day.max, unit)} / {formatTemp(day.min, unit)}
              </span>
              <span>
                Rain{' '}
                {day.rainChance === null
                  ? '\u2013'
                  : `${Math.round(day.rainChance)}%`}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

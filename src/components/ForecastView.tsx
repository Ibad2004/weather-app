import type { Forecast } from '../api/weather'
import { dayLabel, formatTemp, type Unit } from '../format'
import { describeWeather } from '../weatherCodes'

type Props = { placeName: string; forecast: Forecast; unit: Unit }

export function ForecastView({ placeName, forecast, unit }: Props) {
  const { current, days } = forecast
  const condition = describeWeather(current.weatherCode, current.isDay)
  return (
    <section aria-labelledby="current-heading" className="forecast">
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
      <ul className="days" aria-label="5-day forecast">
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
              <span className="muted">
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

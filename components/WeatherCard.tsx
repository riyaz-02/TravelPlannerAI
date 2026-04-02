'use client';

import { DailyWeather, getWeatherIcon } from '@/services/weather';

interface Props {
  weather: DailyWeather[];
  destination: string;
}

export default function WeatherCard({ weather, destination }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">📍 {destination.split(',')[0]} — 7-day forecast</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {weather.slice(0, 7).map((day, i) => (
          <div
            key={i}
            className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center hover:border-brand-500/50 transition-colors"
          >
            <p className="text-xs text-slate-400 mb-1">
              {new Date(day.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <div className="text-3xl my-2">{getWeatherIcon(day.weatherCode)}</div>
            <p className="text-base font-semibold text-white">{Math.round(day.maxTemp)}°</p>
            <p className="text-xs text-slate-400">{Math.round(day.minTemp)}°</p>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-center gap-1 text-xs text-blue-300">
                <span>💧</span>
                <span>{day.precipitationProb}%</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
                <span>💨</span>
                <span>{Math.round(day.windspeed)} km/h</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface DailyWeather {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitationProb: number;
  windspeed: number;
  weatherCode: number;
}

export async function getWeather(lat: number, lon: number, days = 7): Promise<DailyWeather[]> {
  const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}&days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch weather');

  const data = await response.json();
  const daily = data.daily;
  if (!daily) return [];

  return daily.time.map((date: string, i: number) => ({
    date,
    maxTemp: daily.temperature_2m_max[i],
    minTemp: daily.temperature_2m_min[i],
    precipitationProb: daily.precipitation_probability_max[i],
    windspeed: daily.windspeed_10m_max[i],
    weatherCode: daily.weathercode[i],
  }));
}

export function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 49) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

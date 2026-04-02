'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getRoute, RouteResult } from '@/services/openroute';
import { getWeather, DailyWeather } from '@/services/weather';
import { getNews, NewsArticle } from '@/services/news';
import { generateItinerary, Itinerary } from '@/services/gemini';
import WeatherCard from '@/components/WeatherCard';
import ItineraryCard from '@/components/ItineraryCard';
import BudgetCard from '@/components/BudgetCard';
import NewsCard from '@/components/NewsCard';
import {
  MapSkeleton, WeatherSkeleton, ItinerarySkeleton, BudgetSkeleton, NewsSkeleton,
} from '@/components/Skeletons';
import { useSession, signIn } from 'next-auth/react';

// Dynamic import for MapView (client-only)
const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <MapSkeleton /> });

interface TripData {
  from: string;
  to: string;
  fromCoords: { lat: number; lon: number };
  toCoords: { lat: number; lon: number };
  transport: string;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  travelers: number;
  preferences: string[];
}

function SectionCard({ title, icon, children, loading }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="section-card">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">{icon}</span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

type LoadState = 'loading' | 'done' | 'error';

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [tripData, setTripData] = useState<TripData | null>(null);

  const [routeState, setRouteState] = useState<LoadState>('loading');
  const [weatherState, setWeatherState] = useState<LoadState>('loading');
  const [itineraryState, setItineraryState] = useState<LoadState>('loading');
  const [newsState, setNewsState] = useState<LoadState>('loading');

  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [weather, setWeather] = useState<DailyWeather[]>([]);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);

  const [savedTrip, setSavedTrip] = useState(false);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  // Guard against React Strict Mode double-invoking useEffect (which would send 2 Gemini requests)
  const hasFetched = useRef(false);

  const loadData = useCallback(async (trip: TripData) => {
    const from: [number, number] = [trip.fromCoords.lon, trip.fromCoords.lat];
    const to: [number, number] = [trip.toCoords.lon, trip.toCoords.lat];

    // Fan out all API calls in parallel
    const routePromise = getRoute(from, to, trip.transport)
      .then((r) => { setRouteResult(r); setRouteState('done'); return r; })
      .catch(() => { setRouteState('error'); return null; });

    const weatherPromise = getWeather(trip.toCoords.lat, trip.toCoords.lon, 7)
      .then((w) => { setWeather(w); setWeatherState('done'); })
      .catch(() => setWeatherState('error'));

    const newsPromise = getNews(`travel ${trip.to}`)
      .then((n) => { setNews(n); setNewsState('done'); })
      .catch(() => setNewsState('error'));

    // Wait for route first to pass distance/duration to Gemini
    const route = await routePromise;

    const itineraryPromise = generateItinerary({
      ...trip,
      distance: route?.distance,
      duration: route?.duration,
    })
      .then((it) => { setItinerary(it); setItineraryState('done'); })
      .catch((e: Error) => { setItineraryError(e.message); setItineraryState('error'); });

    await Promise.allSettled([weatherPromise, newsPromise, itineraryPromise]);
  }, []);

  useEffect(() => {
    // Prevent React Strict Mode double-invocation from firing 2 Gemini requests
    if (hasFetched.current) return;
    hasFetched.current = true;

    const raw = sessionStorage.getItem('tripData');
    if (!raw) {
      router.replace('/plan-trip');
      return;
    }
    const trip: TripData = JSON.parse(raw);
    setTripData(trip);
    loadData(trip);
  }, [router, loadData]);

  const handleSaveTrip = async () => {
    if (!session) { signIn('google'); return; }
    if (!tripData) return;

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tripData,
          routeData: routeResult,
          weatherData: weather,
          itineraryData: itinerary,
          newsData: news,
        }),
      });
      if (res.ok) setSavedTrip(true);
    } catch (e) {
      console.error(e);
    }
  };

  if (!tripData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const days = tripData.startDate && tripData.endDate
    ? Math.max(1, Math.ceil((new Date(tripData.endDate).getTime() - new Date(tripData.startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Trip Header */}
        <div className="section-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {tripData.from} <span className="text-brand-400">→</span> {tripData.to}
              </h1>
              <div className="flex flex-wrap gap-3 mt-3">
                {days && (
                  <span className="px-3 py-1 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600">
                    📅 {days} day{days > 1 ? 's' : ''}
                  </span>
                )}
                <span className="px-3 py-1 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600">
                  👥 {tripData.travelers} traveler{(tripData.travelers ?? 1) > 1 ? 's' : ''}
                </span>
                <span className="px-3 py-1 rounded-full text-xs bg-slate-700 text-slate-300 border border-slate-600">
                  💰 {tripData.currency} {Number(tripData.budget).toLocaleString()}
                </span>
                {routeResult && (
                  <>
                    <span className="px-3 py-1 rounded-full text-xs bg-brand-500/10 text-brand-300 border border-brand-500/20">
                      📍 {(routeResult.distance / 1000).toFixed(1)} km
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs bg-brand-500/10 text-brand-300 border border-brand-500/20">
                      ⏱️ {Math.round(routeResult.duration / 60)} min
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={() => router.push('/plan-trip')}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-600 text-slate-300 hover:border-slate-400 transition-all"
              >
                ← New Trip
              </button>
              <button
                onClick={handleSaveTrip}
                disabled={savedTrip}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  savedTrip
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-brand-500/20 text-brand-300 border border-brand-500/30 hover:bg-brand-500/30'
                }`}
              >
                {savedTrip ? '✓ Saved' : '☁️ Save Trip'}
              </button>
            </div>
          </div>
        </div>

        {/* Map + Weather row */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <SectionCard title="Route Map" icon="🗺️" loading={routeState === 'loading'}>
              {routeState === 'loading' ? (
                <MapSkeleton />
              ) : routeState === 'error' ? (
                <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
                  <span className="text-4xl">⚠️</span>
                  <p className="text-slate-400 text-sm">Could not load route. Check your OpenRouteService API key.</p>
                  {/* Still show map with just markers */}
                  <MapView
                    fromCoords={tripData.fromCoords}
                    toCoords={tripData.toCoords}
                  />
                </div>
              ) : (
                <MapView
                  fromCoords={tripData.fromCoords}
                  toCoords={tripData.toCoords}
                  geojson={routeResult?.geojson}
                />
              )}
            </SectionCard>
          </div>

          <div className="xl:col-span-2">
            <SectionCard title="Weather Forecast" icon="🌤️">
              {weatherState === 'loading' ? (
                <WeatherSkeleton />
              ) : weatherState === 'error' ? (
                <p className="text-slate-400 text-sm text-center py-8">Weather data unavailable.</p>
              ) : (
                <WeatherCard weather={weather} destination={tripData.to} />
              )}
            </SectionCard>
          </div>
        </div>

        {/* Itinerary + Budget row */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-3">
            <SectionCard title="AI-Generated Itinerary" icon="🤖">
              {itineraryState === 'loading' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Gemini AI is crafting your itinerary...</p>
                  </div>
                  <ItinerarySkeleton />
                </div>
              ) : itineraryState === 'error' ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-2xl">⚠️</p>
                  <p className="text-slate-300 text-sm font-medium">{itineraryError ?? 'Could not generate itinerary.'}</p>
                  <p className="text-slate-500 text-xs">If rate-limited, wait 60 s then click ← New Trip and try again.</p>
                </div>
              ) : itinerary ? (
                <ItineraryCard itinerary={itinerary} currency={tripData.currency} />
              ) : null}
            </SectionCard>
          </div>

          <div className="xl:col-span-2">
            <SectionCard title="Budget Breakdown" icon="💰">
              {itineraryState === 'loading' ? (
                <BudgetSkeleton />
              ) : itinerary?.budgetBreakdown ? (
                <BudgetCard
                  breakdown={itinerary.budgetBreakdown}
                  currency={tripData.currency}
                  travelers={tripData.travelers ?? 1}
                />
              ) : (
                <p className="text-slate-400 text-sm text-center py-8">Budget not available.</p>
              )}
            </SectionCard>
          </div>
        </div>

        {/* News */}
        <SectionCard title="Travel News & Alerts" icon="📰">
          {newsState === 'loading' ? (
            <NewsSkeleton />
          ) : newsState === 'error' ? (
            <p className="text-slate-400 text-sm text-center py-8">News unavailable. Check your GNEWS_API_KEY.</p>
          ) : (
            <NewsCard articles={news} />
          )}
        </SectionCard>

      </div>
    </div>
  );
}

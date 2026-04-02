'use client';

import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import TripForm, { TripFormValues } from '@/components/TripForm';
import { getRoute, RouteResult } from '@/services/openroute';
import { getWeather, DailyWeather } from '@/services/weather';
import { generateItinerary, Itinerary } from '@/services/gemini';
import WeatherCard from '@/components/WeatherCard';
import ItineraryCard from '@/components/ItineraryCard';
import BudgetCard from '@/components/BudgetCard';
import ChatPanel from '@/components/ChatPanel';
import { MapSkeleton, WeatherSkeleton, ItinerarySkeleton, BudgetSkeleton } from '@/components/Skeletons';
import type { MapWaypoint, MapSegment } from '@/components/MapView';

const MapView = dynamic(() => import('@/components/MapView'), { ssr: false, loading: () => <MapSkeleton /> });

type LoadState = 'idle' | 'loading' | 'done' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface TravelAlert { type: string; severity: string; title: string; description: string; icon: string; source?: string; }
interface TravelNews  { alerts: TravelAlert[]; summary: string; bestAdvice: string; }
interface POI         { name: string; address: string; type: string; lat: number; lon: number; }

interface MultiRouteResult {
  optimisedOrder: Array<{ name: string; lat: number; lon: number }>;
  naiveKm:    number;
  optimisedKm: number;
  savedKm:    number;
  savedPercent: number;
  segments: Array<{ from: { name: string }; to: { name: string }; geojson: unknown; distance: number; duration: number }>;
  totalDistance: number;
  totalDuration: number;
}

const SEV: Record<string, { bg: string; border: string; text: string }> = {
  high:   { bg: 'rgba(239,68,68,.1)',  border: 'rgba(239,68,68,.3)',  text: '#fca5a5' },
  medium: { bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.3)', text: '#fcd34d' },
  low:    { bg: 'rgba(34,197,94,.1)',  border: 'rgba(34,197,94,.3)',  text: '#86efac' },
  info:   { bg: 'rgba(59,130,246,.1)', border: 'rgba(59,130,246,.3)', text: '#93c5fd' },
};
const COLORS = ['#3b82f6','#0ea5e9','#06b6d4','#10b981','#8b5cf6','#f59e0b','#ec4899'];

/* ── POI type labels ──────────────────────────────────────────────────────── */
const POI_TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel', hostel: 'Hostel', motel: 'Motel', guest_house: 'Guesthouse',
  attraction: 'Attraction', museum: 'Museum', viewpoint: 'Viewpoint',
  artwork: 'Artwork', theme_park: 'Theme Park', zoo: 'Zoo',
  monument: 'Monument', ruins: 'Ruins', gallery: 'Gallery',
  amphitheatre: 'Theatre', fort: 'Fort',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#111113', border: '1px solid #27272a', borderRadius: 14, padding: 22 }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525b', marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  );
}
function Chip({ label }: { label: string }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, background: '#1c1c1f', border: '1px solid #27272a', fontSize: 11, color: '#a1a1aa' }}>{label}</span>;
}
function Spinner({ color = '#3b82f6', size = 16 }: { color?: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${color}33`, borderTopColor: color, animation: 'spin .7s linear infinite', flexShrink: 0 }} />;
}

/* ── Sign-in required screen ─────────────────────────────────────────────── */
function SignInRequired() {
  const features = [
    { path: 'M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', label: 'AI-generated itineraries', sub: 'Powered by Gemini 2.5 Flash' },
    { path: 'M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9M9 19l3 3m0 0 3-3m-3 3V10', label: 'Trip history saved to cloud', sub: 'Access from anywhere' },
    { path: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z', label: 'Personal analytics dashboard', sub: 'See your travel patterns' },
    { path: 'M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13 6-3m-6 3V7m6 10 4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7', label: 'Multi-stop route optimizer', sub: 'TSP algorithm saves you km' },
  ];
  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, rgba(59,130,246,.2), rgba(139,92,246,.2))', border: '1px solid rgba(59,130,246,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
          </svg>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em', marginBottom: 12 }}>Sign in to plan your trip</h1>
        <p style={{ fontSize: 15, color: '#71717a', lineHeight: 1.7, marginBottom: 32 }}>
          Create a free account to generate AI-powered itineraries, save your trip history, and access your travel analytics dashboard.
        </p>
        <div style={{ background: '#111113', border: '1px solid #27272a', borderRadius: 14, padding: '20px 24px', marginBottom: 28, textAlign: 'left' }}>
          {features.map(({ path, label, sub }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid #1c1c1f' }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>
              </span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 11, color: '#52525b' }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/plan-trip' })}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '14px 24px',
            background: '#fff', border: 'none', borderRadius: 11,
            color: '#18181b', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
        <p style={{ marginTop: 16, fontSize: 12, color: '#3f3f46' }}>Free forever · No credit card required</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
function PlanTripPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const tripId = searchParams.get('tripId');

  const [submitted,      setSubmitted]      = useState(false);
  const [tripData,       setTripData]       = useState<TripFormValues | null>(null);
  const [formLoading,    setFormLoading]    = useState(false);
  const [restoring,      setRestoring]      = useState(false);    // loading saved trip
  const [restoreError,   setRestoreError]   = useState<string | null>(null);

  const [routeState,     setRouteState]     = useState<LoadState>('idle');
  const [weatherState,   setWeatherState]   = useState<LoadState>('idle');
  const [itineraryState, setItineraryState] = useState<LoadState>('idle');
  const [newsState,      setNewsState]      = useState<LoadState>('idle');

  const [routeResult,    setRouteResult]    = useState<RouteResult | null>(null);
  const [multiRoute,     setMultiRoute]     = useState<MultiRouteResult | null>(null);
  const [weather,        setWeather]        = useState<DailyWeather[]>([]);
  const [itinerary,      setItinerary]      = useState<Itinerary | null>(null);
  const [itineraryError, setItineraryError] = useState<string | null>(null);
  const [travelNews,     setTravelNews]     = useState<TravelNews | null>(null);

  const [hotelsState,    setHotelsState]    = useState<LoadState>('idle');
  const [spotsState,     setSpotsState]     = useState<LoadState>('idle');
  const [hotels,         setHotels]         = useState<POI[]>([]);
  const [spots,          setSpots]          = useState<POI[]>([]);

  const [saveState,      setSaveState]      = useState<SaveState>('idle');
  const savedTripId = useRef<string | null>(null);

  const chatSessionId = useRef<string>('');
  const hasFetched    = useRef(false);

  /* ── Restore saved trip from ?tripId= param ───────────────────────────── */
  // Reset the guard whenever tripId changes so every navigation from Plan
  // History triggers a fresh restore (not blocked by a stale ref).
  useEffect(() => {
    if (tripId) {
      hasFetched.current = false;
      setSubmitted(false);
      setRestoreError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  useEffect(() => {
    if (!tripId || hasFetched.current || status !== 'authenticated') return;
    hasFetched.current = true;
    setRestoring(true);
    setRestoreError(null);

    fetch(`/api/trips/${tripId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? 'Failed to load trip');
        return d.trip;
      })
      .then((t) => {
        // Reconstruct TripFormValues from the saved trip document
        const values: TripFormValues = {
          from:        t.from,
          to:          t.to,
          fromCoords:  t.fromCoords  ?? null,
          toCoords:    t.toCoords    ?? null,
          transport:   t.transport   ?? 'driving-car',
          startDate:   t.startDate   ? new Date(t.startDate).toISOString().slice(0, 10) : '',
          endDate:     t.endDate     ? new Date(t.endDate).toISOString().slice(0, 10)   : '',
          budget:      t.budget      ? Number(t.budget) : 0,
          currency:    t.currency    ?? 'INR',
          travelers:   t.travelers   ?? 1,
          preferences: t.preferences ?? [],
          stops:       [],
        };

        chatSessionId.current = crypto.randomUUID();
        savedTripId.current   = t._id ?? tripId;
        setTripData(values);

        // Restore saved API results — skip live re-fetching
        if (t.itineraryData) { setItinerary(t.itineraryData); setItineraryState('done'); }
        else                 { setItineraryState('error'); }

        if (t.routeData) { setRouteResult(t.routeData as RouteResult); setRouteState('done'); }
        else              { setRouteState('idle'); }

        if (t.weatherData && Array.isArray(t.weatherData) && t.weatherData.length > 0) {
          setWeather(t.weatherData as DailyWeather[]);
          setWeatherState('done');
        } else {
          setWeatherState('idle');
        }

        if (t.newsData) { setTravelNews(t.newsData as TravelNews); setNewsState('done'); }
        else             { setNewsState('idle'); }

        setSaveState('saved');   // already in DB — no need to re-save
        setSubmitted(true);
        setRestoring(false);
      })
      .catch((err: Error) => {
        console.error('[restore trip]', err);
        setRestoreError(err.message);
        setRestoring(false);
        hasFetched.current = false;  // allow replanning
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, status]);

  /* ── Server-side POI proxy (avoids browser CORS) ─────────────────────── */
  const fetchPOI = useCallback(async (lat: number, lon: number, mode: 'hotels' | 'spots'): Promise<POI[]> => {
    const res = await fetch('/api/poi', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ lat, lon, mode }),
    });
    if (!res.ok) throw new Error(`POI API error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.pois as POI[];
  }, []);

  /* ── Main data loader ─────────────────────────────────────────────────── */
  const loadData = useCallback(async (trip: TripFormValues) => {
    if (!trip.fromCoords || !trip.toCoords) return;

    const validStops = (trip.stops ?? []).filter((s) => s.coords !== null);
    const isMultiStop = validStops.length > 0 && trip.transport === 'driving-car';

    setRouteState('loading'); setWeatherState('loading');
    setItineraryState('loading'); setNewsState('loading');

    getWeather(trip.toCoords.lat, trip.toCoords.lon, 7)
      .then((w) => { setWeather(w); setWeatherState('done'); })
      .catch(() => setWeatherState('error'));

    fetch('/api/gemini/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: trip.to, from: trip.from, transport: trip.transport }),
    }).then((r) => r.json())
      .then((d) => { setTravelNews(d); setNewsState('done'); })
      .catch(() => setNewsState('error'));

    let routeDistance: number | undefined;
    let routeDuration: number | undefined;

    if (isMultiStop) {
      const allStops = [
        { name: trip.from, lat: trip.fromCoords!.lat, lon: trip.fromCoords!.lon },
        ...validStops.map((s) => ({ name: s.name, lat: s.coords!.lat, lon: s.coords!.lon })),
        { name: trip.to,   lat: trip.toCoords!.lat,  lon: trip.toCoords!.lon },
      ];
      try {
        const res  = await fetch('/api/multi-route', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stops: allStops }),
        });
        const data: MultiRouteResult = await res.json();
        setMultiRoute(data);
        routeDistance = data.totalDistance;
        routeDuration = data.totalDuration;
        setRouteState('done');
      } catch {
        setRouteState('error');
      }
    } else {
      const from: [number, number] = [trip.fromCoords.lon, trip.fromCoords.lat];
      const to:   [number, number] = [trip.toCoords.lon,   trip.toCoords.lat];
      try {
        const r = await getRoute(from, to, trip.transport);
        setRouteResult(r); routeDistance = r.distance; routeDuration = r.duration;
        setRouteState('done');
      } catch {
        setRouteState('error');
      }
    }

    generateItinerary({ ...trip, distance: routeDistance, duration: routeDuration })
      .then((it) => { setItinerary(it); setItineraryState('done'); })
      .catch((e: Error) => { setItineraryError(e.message); setItineraryState('error'); });
  }, []);

  /* ── Auto-save once itinerary is ready ────────────────────────────────── */
  useEffect(() => {
    if (itineraryState !== 'done' || !itinerary || !tripData || saveState !== 'idle') return;
    if (!session?.user) return;

    setSaveState('saving');
    const payload = {
      from:          tripData.from,
      to:            tripData.to,
      fromCoords:    tripData.fromCoords,
      toCoords:      tripData.toCoords,
      transport:     tripData.transport,
      startDate:     tripData.startDate || undefined,
      endDate:       tripData.endDate   || undefined,
      budget:        tripData.budget    ? Number(tripData.budget) : undefined,
      currency:      tripData.currency,
      travelers:     tripData.travelers,
      preferences:   tripData.preferences,
      itineraryData: itinerary,
      routeData:     routeResult,
      weatherData:   weather,
      newsData:      travelNews ?? undefined,
    };

    fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          console.error('[auto-save] Trip save failed:', d.error ?? r.status);
          setSaveState('error');
          return;
        }
        savedTripId.current = d.tripId ?? null;
        setSaveState('saved');
      })
      .catch((err) => {
        console.error('[auto-save] Network error:', err);
        setSaveState('error');
      });
  }, [itineraryState, itinerary, tripData, saveState, session, routeResult, weather]);

  /* ── Auth guards ──────────────────────────────────────────────────────── */
  if (status === 'loading') {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(59,130,246,.2)', borderTopColor: '#3b82f6', animation: 'spin .7s linear infinite' }} />
          <p style={{ fontSize: 13, color: '#52525b' }}>Checking authentication…</p>
        </div>
      </div>
    );
  }
  if (status === 'unauthenticated') return <SignInRequired />;

  /* ── Restoring saved trip ─────────────────────────────────────────────── */
  if (restoring) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(59,130,246,.15)', borderTopColor: '#3b82f6', animation: 'spin .7s linear infinite' }} />
          <p style={{ fontSize: 14, color: '#a1a1aa', fontWeight: 600 }}>Loading your saved trip…</p>
          <p style={{ fontSize: 12, color: '#52525b' }}>Restoring itinerary, route and weather data</p>
        </div>
      </div>
    );
  }

  if (restoreError) {
    return (
      <div style={{ minHeight: 'calc(100vh - 52px)', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fafafa', marginBottom: 10 }}>Could not load trip</h2>
          <p style={{ fontSize: 14, color: '#71717a', marginBottom: 24 }}>{restoreError}</p>
          <button onClick={() => { setRestoreError(null); hasFetched.current = false; }}
            style={{ padding: '10px 24px', background: '#3b82f6', border: 'none', borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >Back to Planner</button>
        </div>
      </div>
    );
  }

  void session;

  const handleSubmit = (values: TripFormValues) => {
    if (!values.fromCoords || !values.toCoords) {
      alert('Please select source and destination from the dropdown suggestions.');
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;
    chatSessionId.current = crypto.randomUUID();
    setFormLoading(true);
    setTripData(values);
    setTimeout(() => { setSubmitted(true); setFormLoading(false); loadData(values); }, 200);
  };

  const resetTrip = () => {
    hasFetched.current = false;
    setSubmitted(false); setTripData(null);
    setRouteResult(null); setMultiRoute(null); setWeather([]);
    setItinerary(null); setTravelNews(null); setHotels([]); setSpots([]);
    setRouteState('idle'); setWeatherState('idle'); setItineraryState('idle');
    setNewsState('idle'); setHotelsState('idle'); setSpotsState('idle');
    setItineraryError(null); setSaveState('idle');
    savedTripId.current = null;
  };

  const days = tripData?.startDate && tripData?.endDate
    ? Math.max(1, Math.ceil((new Date(tripData.endDate).getTime() - new Date(tripData.startDate).getTime()) / 86400000))
    : null;
  const modeLabel = tripData?.transport === 'flight' ? 'Flight' : tripData?.transport === 'train' ? 'Train' : 'Road';

  const mapWaypoints: MapWaypoint[] | undefined = multiRoute
    ? multiRoute.optimisedOrder.map((c, i) => ({ lat: c.lat, lon: c.lon, label: String(i + 1).padStart(2, '0'), name: c.name.split(',')[0] }))
    : undefined;

  const mapSegments: MapSegment[] | undefined = multiRoute
    ? multiRoute.segments.map((s, i) => ({ geojson: s.geojson, color: COLORS[i % COLORS.length] }))
    : undefined;

  /* ── Save status pill ─────────────────────────────────────────────────── */
  const retrySave = () => {
    if (!tripData || !itinerary) return;
    setSaveState('idle');   // triggers the useEffect again
  };

  const SavePill = () => {
    if (saveState === 'idle') return null;
    if (saveState === 'saving') return (
      <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#93c5fd', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid rgba(147,197,253,0.3)', borderTopColor: '#93c5fd', animation: 'spin .6s linear infinite', display: 'inline-block', flexShrink: 0 }} />
        Saving to cloud…
      </span>
    );
    if (saveState === 'saved') return (
      <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', color: '#4ade80', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Saved to Plan History
      </span>
    );
    if (saveState === 'error') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/><circle cx="12" cy="12" r="10"/></svg>
          Save failed
        </span>
        <button onClick={retrySave} style={{ fontSize: 11, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', textAlign: 'left', padding: '2px 0', fontFamily: 'inherit' }}>
          Retry save →
        </button>
        <span style={{ fontSize: 10, color: '#52525b', lineHeight: 1.4 }}>
          If this keeps failing, sign out<br />and sign back in to refresh your session.
        </span>
      </div>
    );
    return null;
  };

  /* ── FORM ─────────────────────────────────────────────────────────────── */
  if (!submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0b' }}>
        <div style={{ background: 'radial-gradient(ellipse 60% 30% at 50% -5%, rgba(59,130,246,0.08), transparent)', padding: '72px 24px 80px' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 99, border: '1px solid #27272a', fontSize: 12, color: '#71717a', marginBottom: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                AI Trip Planner
              </div>
              <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 700, letterSpacing: '-0.02em', color: '#fafafa', marginBottom: 12 }}>
                Plan your perfect journey
              </h1>
              <p style={{ fontSize: 15, color: '#71717a', lineHeight: 1.6 }}>
                Fill in the details and let Gemini AI craft your complete travel plan.
              </p>
            </div>
            <div style={{ background: '#111113', border: '1px solid #27272a', borderRadius: 16, padding: '28px 28px 24px' }}>
              <TripForm onSubmit={handleSubmit} loading={formLoading} />
            </div>
            <p style={{ marginTop: 14, textAlign: 'center', fontSize: 12, color: '#3f3f46' }}>
              Type at least 3 characters to see location suggestions
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── RESULTS ────────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 52px)', overflow: 'hidden', background: '#0a0a0b' }}>

      {/* Sidebar */}
      <aside style={{ width: 280, flexShrink: 0, height: '100%', overflowY: 'auto', background: '#0a0a0b', borderRight: '1px solid #1c1c1f', padding: '20px 16px', animation: 'slideInLeft 0.4s cubic-bezier(0.22,1,0.36,1) forwards' }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525b', marginBottom: 8 }}>Your trip</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', lineHeight: 1.3, marginBottom: 2 }}>{tripData!.from.split(',')[0]}</p>
          <p style={{ fontSize: 11, color: '#3b82f6', marginBottom: 4 }}>→ to</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', lineHeight: 1.3 }}>{tripData!.to.split(',')[0]}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #1c1c1f' }}>
          {days && <Chip label={`${days} day${days > 1 ? 's' : ''}`} />}
          <Chip label={modeLabel} />
          <Chip label={`${tripData!.travelers} traveller${tripData!.travelers > 1 ? 's' : ''}`} />
          {tripData!.budget && <Chip label={`${tripData!.currency} ${Number(tripData!.budget).toLocaleString()}`} />}
          {multiRoute && <Chip label={`${multiRoute.optimisedOrder.length} stops`} />}
        </div>

        {/* Save status */}
        <div style={{ marginBottom: 16 }}>
          <SavePill />
        </div>

        <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #1c1c1f' }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525b', marginBottom: 12 }}>Details</p>
          {[
            { label: 'From',  value: tripData!.from.split(',')[0] },
            { label: 'To',    value: tripData!.to.split(',')[0]   },
            ...(tripData!.startDate ? [{ label: 'Start', value: tripData!.startDate }] : []),
            ...(tripData!.endDate   ? [{ label: 'End',   value: tripData!.endDate   }] : []),
            ...(multiRoute ? [
              { label: 'Optimised', value: `${multiRoute.optimisedKm} km` },
              { label: 'Saved',     value: `${multiRoute.savedKm} km (${multiRoute.savedPercent}%)` },
            ] : routeResult ? [
              { label: 'Distance',  value: `${(routeResult.distance / 1000).toFixed(1)} km` },
              { label: 'Drive time',value: `${Math.round(routeResult.duration / 60)} min` },
            ] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#52525b' }}>{label}</span>
              <span style={{ fontSize: 12, color: '#a1a1aa', maxWidth: 140, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
            </div>
          ))}
        </div>
        {(tripData!.preferences?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #1c1c1f' }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525b', marginBottom: 10 }}>Preferences</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {tripData!.preferences.map((p) => <Chip key={p} label={p} />)}
            </div>
          </div>
        )}
        <button onClick={resetTrip} style={{ width: '100%', padding: '9px 14px', background: 'transparent', border: '1px solid #27272a', borderRadius: 9, fontSize: 13, color: '#71717a', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, color 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3f3f46'; e.currentTarget.style.color = '#a1a1aa'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#71717a'; }}
        >← Plan new trip</button>
      </aside>

      {/* Main panel */}
      <main style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Map */}
          <Card title="Route Map">
            <div style={{ height: 340, borderRadius: 10, overflow: 'hidden', background: '#18181b' }}>
              {routeState === 'loading' ? <MapSkeleton /> : tripData!.fromCoords && tripData!.toCoords ? (
                <MapView
                  fromCoords={tripData!.fromCoords}
                  toCoords={tripData!.toCoords}
                  geojson={multiRoute ? undefined : routeResult?.geojson}
                  waypoints={mapWaypoints}
                  segments={mapSegments}
                />
              ) : <p style={{ color: '#52525b', fontSize: 14, textAlign: 'center', padding: '120px 0' }}>Map unavailable</p>}
            </div>
            {routeState === 'error' && <p style={{ marginTop: 10, fontSize: 12, color: '#f59e0b', textAlign: 'center' }}>Route data unavailable — showing direct line.</p>}
          </Card>

          {/* TSP optimisation */}
          {multiRoute && (
            <Card title="Route Optimisation — TSP Algorithm">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Original order',  val: `${multiRoute.naiveKm} km`,     color: '#71717a' },
                  { label: 'Optimised order',  val: `${multiRoute.optimisedKm} km`, color: '#3b82f6' },
                  { label: 'Distance saved',   val: `${multiRoute.savedKm} km (${multiRoute.savedPercent}%)`, color: '#4ade80' },
                ].map((s) => (
                  <div key={s.label} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, padding: '12px 16px' }}>
                    <p style={{ fontSize: 11, color: '#52525b', marginBottom: 6 }}>{s.label}</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.val}</p>
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 11, color: '#52525b', marginBottom: 10 }}>Optimised visit order (Nearest Neighbour heuristic, O(n²)):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                  {multiRoute.optimisedOrder.map((city, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#18181b', border: `1px solid ${COLORS[i % COLORS.length]}44`, borderRadius: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontSize: 12, color: '#a1a1aa' }}>{city.name.split(',')[0]}</span>
                      </div>
                      {i < multiRoute.optimisedOrder.length - 1 && <span style={{ fontSize: 11, color: '#3f3f46' }}>→</span>}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Weather */}
          <Card title="Weather at Destination">
            {weatherState === 'loading' ? <WeatherSkeleton /> :
             weatherState === 'error'   ? <p style={{ color: '#52525b', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>Weather data unavailable.</p> :
             <WeatherCard weather={weather} destination={tripData!.to} />}
          </Card>

          {/* Itinerary */}
          <Card title="AI-Generated Itinerary">
            {itineraryState === 'loading' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Spinner />
                  <p style={{ fontSize: 13, color: '#71717a' }}>Gemini AI is crafting your itinerary…</p>
                </div>
                <ItinerarySkeleton />
              </div>
            ) : itineraryState === 'error' ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 6, fontWeight: 500 }}>{itineraryError ?? 'Could not generate itinerary.'}</p>
                <p style={{ fontSize: 12, color: '#52525b' }}>If rate-limited, please wait a moment and try again.</p>
              </div>
            ) : itinerary ? <ItineraryCard itinerary={itinerary} currency={tripData!.currency} /> : null}
          </Card>

          {/* Budget */}
          <Card title="Budget Breakdown">
            {itineraryState === 'loading' ? <BudgetSkeleton /> :
             itinerary?.budgetBreakdown ? <BudgetCard breakdown={itinerary.budgetBreakdown} currency={tripData!.currency} travelers={tripData!.travelers ?? 1} /> :
             <p style={{ color: '#52525b', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>Budget data appears after itinerary loads.</p>}
          </Card>

          {/* Travel News */}
          <Card title="Travel News & Alerts">
            {newsState === 'loading' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0' }}>
                <Spinner /><p style={{ fontSize: 13, color: '#71717a' }}>Fetching live travel intelligence…</p>
              </div>
            ) : newsState === 'error' || !travelNews ? (
              <p style={{ color: '#52525b', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>Travel alerts unavailable.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(59,130,246,.07)', border: '1px solid rgba(59,130,246,.2)' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#3b82f6', marginBottom: 6 }}>Current Conditions</p>
                  <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.65 }}>{travelNews.summary}</p>
                </div>
                {travelNews.bestAdvice && (
                  <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 5 }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#f59e0b', marginBottom: 4 }}>Top Recommendation</p>
                      <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.65 }}>{travelNews.bestAdvice}</p>
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {travelNews.alerts?.map((alert, i) => {
                    const s = SEV[alert.severity] ?? SEV.info;
                    return (
                      <div key={i} style={{ padding: '12px 14px', borderRadius: 10, background: s.bg, border: `1px solid ${s.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: s.text }}>{alert.title}</p>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: s.border, color: s.text, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>{alert.severity}</span>
                        </div>
                        <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>{alert.description}</p>
                        {alert.source && <p style={{ fontSize: 10, color: '#52525b', marginTop: 6 }}>Source: {alert.source}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>

          {/* ── Explore Near Destination ─────────────────────────────────── */}
          <Card title="Explore Near Destination">
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
              {([
                { label: 'Hotels',        mode: 'hotels' as const, state: hotelsState, set: setHotelsState, setData: setHotels },
                { label: 'Tourist Spots', mode: 'spots'  as const, state: spotsState,  set: setSpotsState,  setData: setSpots  },
              ]).map(({ label, mode, state, set, setData }) => (
                <button key={label}
                  onClick={async () => {
                    if (!tripData?.toCoords) return;
                    set('loading');
                    try {
                      const results = await fetchPOI(tripData.toCoords.lat, tripData.toCoords.lon, mode);
                      setData(results);
                      set(results.length > 0 ? 'done' : 'error');
                    } catch {
                      set('error');
                    }
                  }}
                  disabled={state === 'loading'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px',
                    borderRadius: 9,
                    background: state === 'done' ? 'rgba(59,130,246,0.1)' : 'transparent',
                    border: state === 'done' ? '1px solid rgba(59,130,246,0.3)' : '1px solid #27272a',
                    color: state === 'done' ? '#93c5fd' : '#a1a1aa',
                    fontSize: 13, cursor: state === 'loading' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                >
                  {state === 'loading' && <Spinner size={13} />}{label}
                </button>
              ))}
              <p style={{ fontSize: 12, color: '#52525b', alignSelf: 'center', marginLeft: 4 }}>
                Click to search within 15 km of {tripData!.to.split(',')[0]}
              </p>
            </div>

            {/* Hotels results */}
            {hotelsState === 'done' && hotels.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 12 }}>
                  Hotels &amp; Accommodation near {tripData!.to.split(',')[0]}{' '}
                  <span style={{ color: '#3f3f46', fontWeight: 400 }}>({hotels.length} found)</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {hotels.map((h, i) => (
                    <a
                      key={i}
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name)}&query_place_id=${h.lat},${h.lon}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        padding: '12px 14px', borderRadius: 10, background: '#18181b',
                        border: '1px solid #27272a', transition: 'border-color 0.15s, background 0.15s',
                        cursor: 'pointer',
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(59,130,246,0.4)'; (e.currentTarget as HTMLDivElement).style.background = '#1c1c1f'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a'; (e.currentTarget as HTMLDivElement).style.background = '#18181b'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', lineHeight: 1.3 }}>{h.name}</p>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)', flexShrink: 0, marginLeft: 8 }}>
                            {POI_TYPE_LABELS[h.type] ?? '🏨 Hotel'}
                          </span>
                        </div>
                        {h.address && <p style={{ fontSize: 11, color: '#52525b', lineHeight: 1.4 }}>{h.address}</p>}
                        <p style={{ fontSize: 10, color: '#3b82f6', marginTop: 6 }}>Open in Maps →</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {hotelsState === 'done' && hotels.length === 0 && (
              <p style={{ fontSize: 13, color: '#52525b', marginBottom: 16 }}>No hotels found in the 15 km radius. Try a more central destination.</p>
            )}
            {hotelsState === 'error' && (
              <p style={{ fontSize: 13, color: '#f59e0b', marginBottom: 16 }}>Could not fetch hotel data. Try again in a moment.</p>
            )}

            {/* Tourist Spots results */}
            {spotsState === 'done' && spots.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 12 }}>
                  Tourist Spots near {tripData!.to.split(',')[0]}{' '}
                  <span style={{ color: '#3f3f46', fontWeight: 400 }}>({spots.length} found)</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                  {spots.map((s, i) => (
                    <a
                      key={i}
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        padding: '12px 14px', borderRadius: 10, background: '#18181b',
                        border: '1px solid #27272a', transition: 'border-color 0.15s, background 0.15s', cursor: 'pointer',
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(139,92,246,0.4)'; (e.currentTarget as HTMLDivElement).style.background = '#1c1c1f'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a'; (e.currentTarget as HTMLDivElement).style.background = '#18181b'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', lineHeight: 1.3 }}>{s.name}</p>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.2)', flexShrink: 0, marginLeft: 8 }}>
                            {POI_TYPE_LABELS[s.type] ?? '🎯 Spot'}
                          </span>
                        </div>
                        {s.address && <p style={{ fontSize: 11, color: '#52525b', lineHeight: 1.4 }}>{s.address}</p>}
                        <p style={{ fontSize: 10, color: '#8b5cf6', marginTop: 6 }}>Open in Maps →</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {spotsState === 'done' && spots.length === 0 && (
              <p style={{ fontSize: 13, color: '#52525b' }}>No tourist spots found nearby. Try a different destination.</p>
            )}
            {spotsState === 'error' && (
              <p style={{ fontSize: 13, color: '#f59e0b' }}>Could not fetch tourist spots. Try again in a moment.</p>
            )}
          </Card>

        </div>
      </main>

      {/* Floating AI chatbot — shown once itinerary is ready */}
      {itinerary && (
        <ChatPanel
          sessionId={chatSessionId.current}
          tripId={savedTripId.current}
          currentItinerary={itinerary}
          tripContext={tripData as unknown as Record<string, unknown>}
          onItineraryUpdate={(updated) => setItinerary(updated)}
        />
      )}
    </div>
  );
}

export default function PlanTripPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: 'calc(100vh - 52px)', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(59,130,246,.2)', borderTopColor: '#3b82f6', animation: 'spin .7s linear infinite' }} />
      </div>
    }>
      <PlanTripPageInner />
    </Suspense>
  );
}

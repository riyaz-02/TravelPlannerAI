'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/* ── Types ─────────────────────────────────────────────────────────────── */
interface SavedTrip {
  _id: string;
  title: string;
  from: string;
  to: string;
  transport: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency: string;
  travelers: number;
  preferences: string[];
  itineraryData?: {
    days?: Array<{
      day: number;
      title: string;
      activities: Array<{ time: string; activity: string; notes?: string }>;
    }>;
    summary?: string;
  };
  routeData?: { distance?: number; duration?: number };
  createdAt: string;
}

/* ── Transport label map (no emojis) ───────────────────────────────────── */
const TRANSPORT_LABELS: Record<string, string> = {
  'driving-car':    'Car',
  'cycling-regular':'Cycling',
  'foot-walking':   'Walking',
  'flight':         'Flight',
  'train':          'Train',
};

/* ── Inline SVG icons ──────────────────────────────────────────────────── */
function IconClock() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconWallet() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8H6a2 2 0 0 1-2-2V4h14a2 2 0 0 1 2 2v6z"/><rect x="2" y="10" width="20" height="12" rx="2"/>
      <circle cx="16" cy="16" r="1" fill="currentColor"/>
    </svg>
  );
}
function IconRoute() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
      <circle cx="18" cy="5" r="3"/>
    </svg>
  );
}
function IconCar() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>
      <path d="M3 12h18"/>
    </svg>
  );
}
function IconPlane() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
    </svg>
  );
}

/* ── Transport badge (no emoji) ────────────────────────────────────────── */
function TransportBadge({ mode }: { mode: string }) {
  const label = TRANSPORT_LABELS[mode] ?? mode.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 99,
      background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)',
      fontSize: 11, color: '#93c5fd',
    }}>
      <IconCar />
      {label}
    </span>
  );
}

/* ── Trip card ─────────────────────────────────────────────────────────── */
function TripCard({ trip, onDelete }: { trip: SavedTrip; onDelete: (id: string) => void }) {
  const router = useRouter();
  const [deleting,   setDeleting]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const days = trip.startDate && trip.endDate
    ? Math.max(1, Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000))
    : trip.itineraryData?.days?.length ?? null;

  const savedOn = trip.createdAt
    ? new Date(trip.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/trips?id=${trip._id}`, { method: 'DELETE' });
      onDelete(trip._id);
    } catch {
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  const handleViewItinerary = () => {
    setNavigating(true);
    router.push(`/plan-trip?tripId=${trip._id}`);
  };

  return (
    <div style={{
      background: '#111113', border: '1px solid #27272a',
      borderRadius: 14, overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3f3f46'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      <div style={{ padding: '18px 20px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {trip.from.split(',')[0]}
              <span style={{ color: '#3b82f6', margin: '0 8px' }}>→</span>
              {trip.to.split(',')[0]}
            </h2>
            <p style={{ fontSize: 11, color: '#52525b' }}>Saved on {savedOn}</p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
            {confirmDel ? (
              <>
                <button onClick={() => setConfirmDel(false)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #27272a', background: 'transparent', color: '#71717a', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {deleting ? 'Deleting…' : 'Confirm'}
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDel(true)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #27272a', background: 'transparent', color: '#52525b', fontSize: 11, cursor: 'pointer', transition: 'color 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fca5a5')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
              >Delete</button>
            )}
          </div>
        </div>

        {/* Meta chips — no emojis */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <TransportBadge mode={trip.transport} />
          {days && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11, color: '#6ee7b7' }}>
              <IconClock /> {days} day{days > 1 ? 's' : ''}
            </span>
          )}
          {trip.travelers > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, background: '#1c1c1f', border: '1px solid #27272a', fontSize: 11, color: '#a1a1aa' }}>
              <IconUsers /> {trip.travelers} traveller{trip.travelers > 1 ? 's' : ''}
            </span>
          )}
          {trip.budget && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, background: '#1c1c1f', border: '1px solid #27272a', fontSize: 11, color: '#a1a1aa' }}>
              <IconWallet /> {trip.currency} {Number(trip.budget).toLocaleString()}
            </span>
          )}
          {trip.routeData?.distance && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, background: '#1c1c1f', border: '1px solid #27272a', fontSize: 11, color: '#a1a1aa' }}>
              <IconRoute /> {(trip.routeData.distance / 1000).toFixed(0)} km
            </span>
          )}
        </div>

        {/* Summary */}
        {trip.itineraryData?.summary && (
          <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.6, marginBottom: 14 }}>
            {trip.itineraryData.summary.slice(0, 180)}{trip.itineraryData.summary.length > 180 ? '…' : ''}
          </p>
        )}

        {/* View Itinerary CTA — navigates to plan-trip page */}
        <button
          onClick={handleViewItinerary}
          disabled={navigating}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 8,
            background: navigating ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.25)',
            color: '#93c5fd', fontSize: 12, fontWeight: 600,
            cursor: navigating ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s', fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => { if (!navigating) { e.currentTarget.style.background = 'rgba(59,130,246,0.14)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)'; } }}
          onMouseLeave={(e) => { if (!navigating) { e.currentTarget.style.background = 'rgba(59,130,246,0.06)'; e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)'; } }}
        >
          {navigating ? (
            <>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(147,197,253,0.3)', borderTopColor: '#93c5fd', animation: 'spin .6s linear infinite', display: 'inline-block' }} />
              Opening…
            </>
          ) : (
            <>
              <IconPlane />
              View Itinerary
              {days && <span style={{ color: '#52525b', fontWeight: 400, fontSize: 11 }}>({days} days)</span>}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12))', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M3.6 9h16.8M3.6 15h16.8"/>
          <path d="M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18"/>
        </svg>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', marginBottom: 10 }}>No saved trips yet</h2>
      <p style={{ fontSize: 15, color: '#71717a', lineHeight: 1.7, marginBottom: 28, maxWidth: 380, margin: '0 auto 28px' }}>
        Your trips are automatically saved when you generate an itinerary. Plan your first trip to get started!
      </p>
      <Link href="/plan-trip" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '12px 28px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        borderRadius: 11, color: '#fff', fontSize: 15, fontWeight: 600,
        textDecoration: 'none', transition: 'opacity 0.15s',
      }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = '0.88')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = '1')}
      >
        Plan a new trip
      </Link>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function PlanHistoryPage() {
  const { data: session, status } = useSession();
  const [trips,   setTrips]   = useState<SavedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/trips?limit=50')
      .then((r) => r.json())
      .then((d) => { setTrips(d.trips ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load trip history.'); setLoading(false); });
  }, [status]);

  /* ── Auth wall ─────────────────────────────────────────────────────── */
  if (status === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fafafa', marginBottom: 10 }}>Plan History</h1>
          <p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6, marginBottom: 24 }}>Sign in to view your saved trips and itineraries.</p>
          <button onClick={() => signIn('google')} style={{ padding: '12px 28px', background: '#3b82f6', border: 'none', borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  /* ── Loading ────────────────────────────────────────────────────────── */
  if (loading || status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(59,130,246,.2)', borderTopColor: '#3b82f6', animation: 'spin .7s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 13, color: '#52525b' }}>Loading your trips…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 14 }}>
        {error}
      </div>
    );
  }

  const handleDelete = (id: string) => {
    setTrips((prev) => prev.filter((t) => t._id !== id));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', padding: '48px 24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 99, border: '1px solid #27272a', fontSize: 11, color: '#71717a', marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
            Auto-saved from Plan Trip
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em', marginBottom: 6 }}>
                Plan History
              </h1>
              <p style={{ fontSize: 14, color: '#71717a' }}>
                Welcome back, {session?.user?.name?.split(' ')[0]} — you have <strong style={{ color: '#a1a1aa' }}>{trips.length}</strong> saved trip{trips.length !== 1 ? 's' : ''}.
              </p>
            </div>
            <Link href="/plan-trip" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1))',
              border: '1px solid rgba(59,130,246,0.25)',
              borderRadius: 10, color: '#93c5fd',
              fontSize: 13, fontWeight: 600, textDecoration: 'none',
              transition: 'all 0.15s',
            }}>
              + Plan new trip
            </Link>
          </div>
        </div>

        {/* Trip list or empty */}
        {trips.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {trips.map((trip) => (
              <TripCard key={trip._id} trip={trip} onDelete={handleDelete} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

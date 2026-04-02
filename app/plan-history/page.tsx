'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
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

/* ── Transport badge ───────────────────────────────────────────────────── */
const TRANSPORT_ICONS: Record<string, string> = {
  'driving-car': '🚗',
  'cycling-regular': '🚴',
  'foot-walking': '🚶',
  'flight': '✈️',
  'train': '🚆',
};

function TransportBadge({ mode }: { mode: string }) {
  const icon  = TRANSPORT_ICONS[mode] ?? '🚗';
  const label = mode.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 99,
      background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)',
      fontSize: 11, color: '#93c5fd',
    }}>{icon} {label}</span>
  );
}

/* ── Trip card ─────────────────────────────────────────────────────────── */
function TripCard({ trip, onDelete }: { trip: SavedTrip; onDelete: (id: string) => void }) {
  const [expanded,  setExpanded]  = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

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

  return (
    <div style={{
      background: '#111113', border: '1px solid #27272a',
      borderRadius: 14, overflow: 'hidden',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3f3f46'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* Card header */}
      <div style={{ padding: '18px 20px' }}>
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
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {confirmDel ? (
              <>
                <button onClick={() => setConfirmDel(false)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #27272a', background: 'transparent', color: '#71717a', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}>
                  {deleting ? 'Deleting…' : 'Confirm'}
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDel(true)} style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #27272a', background: 'transparent', color: '#52525b', fontSize: 11, cursor: 'pointer', transition: 'color 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fca5a5')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
              >Delete</button>
            )}
          </div>
        </div>

        {/* Meta chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <TransportBadge mode={trip.transport} />
          {days && (
            <span style={{ display: 'inline-flex', gap: 4, padding: '3px 9px', borderRadius: 99, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 11, color: '#6ee7b7' }}>
              📅 {days} day{days > 1 ? 's' : ''}
            </span>
          )}
          {trip.travelers > 0 && (
            <span style={{ display: 'inline-flex', gap: 4, padding: '3px 9px', borderRadius: 99, background: '#1c1c1f', border: '1px solid #27272a', fontSize: 11, color: '#a1a1aa' }}>
              👤 {trip.travelers} traveller{trip.travelers > 1 ? 's' : ''}
            </span>
          )}
          {trip.budget && (
            <span style={{ display: 'inline-flex', gap: 4, padding: '3px 9px', borderRadius: 99, background: '#1c1c1f', border: '1px solid #27272a', fontSize: 11, color: '#a1a1aa' }}>
              💰 {trip.currency} {Number(trip.budget).toLocaleString()}
            </span>
          )}
          {trip.routeData?.distance && (
            <span style={{ display: 'inline-flex', gap: 4, padding: '3px 9px', borderRadius: 99, background: '#1c1c1f', border: '1px solid #27272a', fontSize: 11, color: '#a1a1aa' }}>
              📍 {(trip.routeData.distance / 1000).toFixed(0)} km
            </span>
          )}
        </div>

        {/* Summary */}
        {trip.itineraryData?.summary && (
          <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.6, marginBottom: 14 }}>
            {trip.itineraryData.summary.slice(0, 160)}{trip.itineraryData.summary.length > 160 ? '…' : ''}
          </p>
        )}

        {/* Expand toggle */}
        {trip.itineraryData?.days && trip.itineraryData.days.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 8,
              background: 'transparent', border: '1px solid #27272a',
              color: '#71717a', fontSize: 12, cursor: 'pointer',
              transition: 'all 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#93c5fd'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#71717a'; }}
          >
            {expanded ? '▲ Hide itinerary' : '▼ View full itinerary'}
            <span style={{ marginLeft: 4, fontSize: 11, color: '#3f3f46' }}>
              ({trip.itineraryData.days.length} days)
            </span>
          </button>
        )}
      </div>

      {/* Expanded itinerary */}
      {expanded && trip.itineraryData?.days && (
        <div style={{ borderTop: '1px solid #1c1c1f', padding: '0 20px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16 }}>
            {trip.itineraryData.days.map((d) => (
              <div key={d.day} style={{ background: '#0f0f10', borderRadius: 10, border: '1px solid #1c1c1f', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>{d.day}</span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa' }}>{d.title}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 32 }}>
                  {d.activities?.map((act, j) => (
                    <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, flexShrink: 0, minWidth: 44 }}>{act.time}</span>
                      <div>
                        <p style={{ fontSize: 12, color: '#a1a1aa' }}>{act.activity}</p>
                        {act.notes && <p style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{act.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🗺️</div>
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
        ✈️ Plan a new trip
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fafafa', marginBottom: 10 }}>Plan History</h1>
          <p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6, marginBottom: 24 }}>Sign in to view your saved trips and itineraries.</p>
          <button onClick={() => signIn('google')} style={{ padding: '12px 28px', background: '#3b82f6', border: 'none', borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
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

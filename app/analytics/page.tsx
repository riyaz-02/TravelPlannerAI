'use client';

import { useEffect, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

/* ── Types ───────────────────────────────────────────────────────────────── */
interface Stat      { totalTrips: number; totalKm: number; avgBudget: number; totalSpend: number; uniqueDestinations: number; }
interface DestRow   { destination: string; visits: number; avgBudget: number; totalKm: number; }
interface MonthRow  { month: string; trips: number; avgBudget: number; }
interface RecentTrip { from: string; to: string; budget: number; currency: string; startDate?: string; transport: string; routeData?: { distance?: number }; createdAt: string; }
interface BudgetPt  { from: string; to: string; budget: number; currency: string; createdAt: string; }

interface AnalyticsData {
  stats:       Stat;
  destinations: DestRow[];
  monthly:      MonthRow[];
  recentTrips:  RecentTrip[];
  budgetTrend:  BudgetPt[];
}

/* ── Shared styles ───────────────────────────────────────────────────────── */
const CARD: React.CSSProperties = { background: '#111113', border: '1px solid #27272a', borderRadius: 14, padding: 24 };
const H2:   React.CSSProperties = { fontSize: 12, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525b', marginBottom: 20 };

const TOOLTIP_STYLE = {
  contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12, color: '#fafafa' },
  cursor: { fill: 'rgba(59,130,246,.06)' },
};

/* ── Stat card ───────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ ...CARD, textAlign: 'center' }}>
      <p style={{ fontSize: 28, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', marginBottom: sub ? 4 : 0 }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: '#52525b' }}>{sub}</p>}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
      <p style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginBottom: 8 }}>No trip data yet</p>
      <p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6, marginBottom: 24 }}>
        Save a few trips to see your personal travel analytics powered by<br />MongoDB aggregation pipelines.
      </p>
      <a href="/plan-trip" style={{ padding: '10px 24px', background: '#3b82f6', borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
        Plan your first trip
      </a>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') return;
    if (status !== 'authenticated') return;
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load analytics.'); setLoading(false); });
  }, [status]);

  /* ── Auth wall ─────────────────────────────────────────────────────────── */
  if (status === 'unauthenticated') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', marginBottom: 10 }}>Trip Analytics</h1>
          <p style={{ fontSize: 14, color: '#71717a', lineHeight: 1.6, marginBottom: 24 }}>Sign in to see your personal travel statistics, charts, and insights.</p>
          <button onClick={() => signIn('google')} style={{ padding: '11px 28px', background: '#3b82f6', border: 'none', borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  /* ── Loading ───────────────────────────────────────────────────────────── */
  if (loading || status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(59,130,246,.2)', borderTopColor: '#3b82f6', animation: 'spin .7s linear infinite' }} />
      </div>
    );
  }

  if (error) return <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontSize: 14 }}>{error}</div>;

  const s = data?.stats;
  const isEmpty = !s || s.totalTrips === 0;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', padding: '48px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', borderRadius: 99, border: '1px solid #27272a', fontSize: 11, color: '#71717a', marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            MongoDB Aggregation Pipelines
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, color: '#fafafa', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Your Travel Analytics
          </h1>
          <p style={{ fontSize: 14, color: '#71717a' }}>
            Welcome back, {session?.user?.name?.split(' ')[0]} — here&apos;s your personal travel intelligence dashboard.
          </p>
        </div>

        {isEmpty ? <EmptyState /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              <StatCard label="Total Trips"    value={String(s!.totalTrips)} />
              <StatCard label="Total Distance" value={`${s!.totalKm.toLocaleString()} km`} />
              <StatCard label="Destinations"   value={String(s!.uniqueDestinations)} />
              <StatCard label="Avg Budget"     value={`₹${s!.avgBudget.toLocaleString()}`} />
              <StatCard label="Total Spend"    value={`₹${s!.totalSpend.toLocaleString()}`} sub="across all saved trips" />
            </div>

            {/* Monthly frequency + Budget trend */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Bar chart — monthly trips */}
              <div style={CARD}>
                <p style={H2}>Monthly Trip Frequency</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data!.monthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
                    <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [v, 'Trips']} />
                    <Bar dataKey="trips" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line chart — budget trend */}
              <div style={CARD}>
                <p style={H2}>Budget Trend (Last 10 Trips)</p>
                {data!.budgetTrend.length < 2 ? (
                  <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ fontSize: 13, color: '#52525b' }}>Save more trips to see the trend.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data!.budgetTrend.map((t, i) => ({ trip: `T${i + 1}`, budget: t.budget, name: `${t.from.split(',')[0]}→${t.to.split(',')[0]}` }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" />
                      <XAxis dataKey="trip" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v, _, p) => [`₹${Number(v).toLocaleString()}`, (p as { payload: { name: string } }).payload.name]} />
                      <Line type="monotone" dataKey="budget" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Top destinations */}
            {data!.destinations.length > 0 && (
              <div style={CARD}>
                <p style={H2}>Top Destinations</p>
                <ResponsiveContainer width="100%" height={Math.max(180, data!.destinations.length * 44)}>
                  <BarChart layout="vertical" data={data!.destinations} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1f" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="destination" width={100} tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [v, 'Visits']} />
                    <Bar dataKey="visits" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent trips table */}
            {data!.recentTrips.length > 0 && (
              <div style={CARD}>
                <p style={H2}>Recent Saved Trips</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Route', 'Mode', 'Distance', 'Budget', 'Date'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#52525b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #1c1c1f' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data!.recentTrips.map((t, i) => (
                        <tr key={i} style={{ borderBottom: i < data!.recentTrips.length - 1 ? '1px solid #18181b' : 'none' }}>
                          <td style={{ padding: '10px 12px', color: '#fafafa', fontWeight: 500 }}>{t.from.split(',')[0]} → {t.to.split(',')[0]}</td>
                          <td style={{ padding: '10px 12px', color: '#71717a', textTransform: 'capitalize' }}>{t.transport?.replace('-', ' ')}</td>
                          <td style={{ padding: '10px 12px', color: '#71717a' }}>{t.routeData?.distance ? `${(t.routeData.distance / 1000).toFixed(0)} km` : '—'}</td>
                          <td style={{ padding: '10px 12px', color: '#10b981' }}>{t.currency} {t.budget?.toLocaleString()}</td>
                          <td style={{ padding: '10px 12px', color: '#52525b' }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Academic note */}
            <div style={{ background: 'rgba(139,92,246,.06)', border: '1px solid rgba(139,92,246,.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>🎓</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd', marginBottom: 4 }}>Academic Note — MongoDB Aggregation Pipeline</p>
                <p style={{ fontSize: 12, color: '#71717a', lineHeight: 1.65 }}>
                  All statistics on this page are computed server-side using three MongoDB <code style={{ background: '#1c1c1f', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>$aggregate</code> pipelines
                  with <code style={{ background: '#1c1c1f', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>$group</code>, <code style={{ background: '#1c1c1f', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>$match</code>, <code style={{ background: '#1c1c1f', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>$sort</code>, and <code style={{ background: '#1c1c1f', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>$project</code> stages — equivalent to SQL GROUP BY with aggregate functions, computed entirely within the database engine.
                </p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';

const FEATURES = [
  {
    title: 'Smart Route Mapping',
    desc: 'Interactive maps built on MapLibre GL and OpenRouteService show your complete journey — distances, drive times, and waypoints.',
  },
  {
    title: 'AI Itinerary Generator',
    desc: 'Gemini AI creates a detailed day-by-day plan with activities, restaurants, and accommodation at every budget level.',
  },
  {
    title: 'Real-Time Weather',
    desc: '7-day forecasts from Open-Meteo for your destination so you know exactly what to pack and when to go.',
  },
  {
    title: 'Budget Breakdown',
    desc: 'Itemised cost estimates across transport, food, accommodation, and activities — no hidden surprises.',
  },
  {
    title: 'Live Travel Alerts',
    desc: 'Road closures, flight delays, train incidents and weather warnings surfaced before you depart.',
  },
  {
    title: 'Save & Sync',
    desc: 'Sign in with Google to save your trips to the cloud and access full itineraries from any device.',
  },
];

const STEPS = [
  { num: '01', title: 'Enter your trip details', desc: 'Origin, destination, travel mode, dates, budget, and preferences.' },
  { num: '02', title: 'AI builds the plan', desc: 'Gemini creates a full itinerary with activities, food, and accommodation.' },
  { num: '03', title: 'Explore your journey', desc: 'View route on a live map with weather data and travel alerts.' },
];

export default function HomePage() {
  return (
    <div style={{ background: '#0a0a0b', minHeight: '100vh' }}>

      {/* ── Hero ─────────────────────────────────── */}
      <section style={{
        background: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(59,130,246,0.10), transparent)',
        borderBottom: '1px solid #27272a',
        padding: '96px 24px 80px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 99,
            border: '1px solid #27272a', marginBottom: 32,
            fontSize: 12, color: '#71717a',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
            Powered by Google Gemini AI
          </div>

          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 60px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#fafafa',
            marginBottom: 20,
          }}>
            Plan your perfect trip<br />
            <span style={{ color: '#3b82f6' }}>powered by AI</span>
          </h1>

          <p style={{ fontSize: 16, color: '#a1a1aa', lineHeight: 1.7, marginBottom: 36, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            AI-generated itineraries, real-time weather, interactive route maps, budget breakdowns, and travel alerts — all in one place.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/plan-trip" id="hero-plan-btn" className="btn-primary" style={{ padding: '12px 28px', fontSize: 15 }}>
              Plan your trip — free
            </Link>
            <a href="#how-it-works" className="btn-outline" style={{ padding: '12px 28px', fontSize: 15 }}>
              How it works
            </a>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', marginTop: 56, paddingTop: 40, borderTop: '1px solid #1c1c1f' }}>
            {[
              { val: '7+', label: 'APIs integrated' },
              { val: 'Free', label: 'To get started' },
              { val: 'AI', label: 'Powered planning' },
            ].map((s) => (
              <div key={s.val} style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', marginBottom: 4 }}>{s.val}</p>
                <p style={{ fontSize: 12, color: '#71717a' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────── */}
      <section style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.01em', marginBottom: 10 }}>
            Everything you need to travel smart
          </h2>
          <p style={{ color: '#71717a', fontSize: 15 }}>From AI planning to live data — all in one dashboard.</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          background: '#27272a',
          border: '1px solid #27272a',
          borderRadius: 14,
          overflow: 'hidden',
        }} className="feature-grid">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="feature-card" style={{
              background: '#0a0a0b',
              padding: '28px 24px',
              borderBottom: i < 3 ? '1px solid #27272a' : 'none',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#1c1c1f', border: '1px solid #27272a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16, color: '#3b82f6', fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────── */}
      <section id="how-it-works" style={{ borderTop: '1px solid #1c1c1f', padding: '80px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#fafafa', letterSpacing: '-0.01em', marginBottom: 10 }}>How it works</h2>
            <p style={{ color: '#71717a', fontSize: 15 }}>Three steps to your complete itinerary</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, position: 'relative' }}>
            {STEPS.map((step) => (
              <div key={step.num} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10, border: '1px solid #27272a',
                  background: '#111113', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', fontSize: 12, fontWeight: 700, color: '#3b82f6', fontFamily: 'monospace',
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: 52 }}>
            <Link href="/plan-trip" className="btn-primary" style={{ padding: '12px 32px', fontSize: 15 }}>
              Start planning now
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer style={{ borderTop: '1px solid #1c1c1f', padding: '28px 24px' }}>
        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <p style={{ fontSize: 12, color: '#52525b' }}>Built with Next.js · Gemini AI · MapLibre GL · Open-Meteo · OpenRouteService</p>
          <p style={{ fontSize: 12, color: '#3f3f46' }}>© {new Date().getFullYear()} TravelAI</p>
        </div>
      </footer>
    </div>
  );
}

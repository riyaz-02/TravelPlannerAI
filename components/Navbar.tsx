'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

/* ── Icon set (SVG only, no emojis) ────────────────────────────────────── */
function IconHistory() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
    </svg>
  );
}
function IconBarChart() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
    </svg>
  );
}
function IconPlane() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>
    </svg>
  );
}
function IconLogOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

/* ── User dropdown ──────────────────────────────────────────────────────── */
function UserDropdown({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const menuItems = [
    { href: '/plan-history', Icon: IconHistory, label: 'Plan History',  sub: 'View your saved trips' },
    { href: '/analytics',    Icon: IconBarChart, label: 'Analytics',    sub: 'Your travel insights'  },
    { href: '/plan-trip',    Icon: IconPlane,    label: 'Plan New Trip', sub: 'Generate an itinerary' },
  ];

  return (
    <div
      style={{
        position: 'absolute', top: 'calc(100% + 10px)', right: 0,
        width: 240, zIndex: 200,
        background: 'rgba(14,14,16,0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
        overflow: 'hidden',
        animation: 'dropdownIn 0.18s cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      {/* User info */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {session?.user?.image ? (
            <Image
              src={session.user.image} alt={session.user.name ?? ''}
              width={36} height={36}
              style={{ borderRadius: '50%', border: '2px solid rgba(59,130,246,0.3)' }}
            />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {session?.user?.name?.[0] ?? '?'}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session?.user?.name}
            </p>
            <p style={{ fontSize: 11, color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session?.user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Menu items */}
      <div style={{ padding: '6px 0' }}>
        {menuItems.map(({ href, Icon, label, sub }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 16px',
                transition: 'background 0.12s',
                background: pathname === href ? 'rgba(59,130,246,0.08)' : 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = pathname === href ? 'rgba(59,130,246,0.08)' : 'transparent')}
            >
              {/* SVG icon container */}
              <span style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: pathname === href ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                color: pathname === href ? '#93c5fd' : '#71717a',
              }}>
                <Icon />
              </span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: pathname === href ? '#93c5fd' : '#fafafa', marginBottom: 1 }}>{label}</p>
                <p style={{ fontSize: 11, color: '#52525b' }}>{sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Sign out */}
      <div style={{ padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => { signOut(); onClose(); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 11,
            padding: '9px 16px', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
        >
          <span style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(239,68,68,0.08)', color: '#f87171',
          }}>
            <IconLogOut />
          </span>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: '#fca5a5' }}>Sign Out</p>
            <p style={{ fontSize: 11, color: '#52525b' }}>End your session</p>
          </div>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const linkStyle = (href: string) => ({
    padding: '5px 10px',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    color: pathname === href ? '#fafafa' : '#71717a',
    background: pathname === href ? '#18181b' : 'transparent',
    transition: 'color 0.15s, background 0.15s',
  } as React.CSSProperties);

  return (
    <>
      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>

      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 52,
        background: 'rgba(10,10,11,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #1c1c1f',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          maxWidth: 1100, width: '100%', margin: '0 auto', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.01em' }}>TravelAI</span>
          </Link>

          {/* Desktop nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="hidden-mobile">
            <Link href="/"           style={linkStyle('/')}>Home</Link>
            <Link href="/plan-trip"  style={linkStyle('/plan-trip')}>Plan Trip</Link>
            {session && <Link href="/plan-history" style={linkStyle('/plan-history')}>Plan History</Link>}
            {session && <Link href="/analytics"    style={linkStyle('/analytics')}>Analytics</Link>}
          </div>

          {/* Auth area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="hidden-mobile">
            {session ? (
              /* ── User card dropdown ─────────────────────── */
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: dropdownOpen ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.04)',
                    border: dropdownOpen ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 9, padding: '5px 10px 5px 6px',
                    cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    if (!dropdownOpen) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!dropdownOpen) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    }
                  }}
                >
                  {session.user?.image ? (
                    <Image
                      src={session.user.image} alt={session.user.name ?? ''}
                      width={24} height={24}
                      style={{ borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)' }}
                    />
                  ) : (
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                      {session.user?.name?.[0] ?? '?'}
                    </div>
                  )}
                  <span style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 500 }}>
                    {session.user?.name?.split(' ')[0]}
                  </span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="#52525b" strokeWidth="2"
                    style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {dropdownOpen && <UserDropdown onClose={() => setDropdownOpen(false)} />}
              </div>
            ) : (
              <button onClick={() => signIn('google')} id="navbar-signin-btn" className="btn-primary"
                style={{ padding: '7px 16px', fontSize: 13 }}>
                Sign in with Google
              </button>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 6 }}
            className="show-mobile"
            aria-label="Toggle menu"
          >
            {mobileOpen
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/></svg>
            }
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div style={{
            position: 'absolute', top: 52, left: 0, right: 0,
            background: '#0a0a0b', borderBottom: '1px solid #1c1c1f',
            padding: '12px 24px 16px',
          }} className="show-mobile">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Link href="/"            onClick={() => setMobileOpen(false)} style={{ ...linkStyle('/'), display: 'block' }}>Home</Link>
              <Link href="/plan-trip"   onClick={() => setMobileOpen(false)} style={{ ...linkStyle('/plan-trip'), display: 'block' }}>Plan Trip</Link>
              {session && <Link href="/plan-history" onClick={() => setMobileOpen(false)} style={{ ...linkStyle('/plan-history'), display: 'block' }}>Plan History</Link>}
              {session && <Link href="/analytics"   onClick={() => setMobileOpen(false)} style={{ ...linkStyle('/analytics'), display: 'block' }}>Analytics</Link>}
            </div>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1c1c1f', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {session ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {session.user?.image && (
                      <Image src={session.user.image} alt={session.user.name ?? ''} width={22} height={22} style={{ borderRadius: '50%' }} />
                    )}
                    <span style={{ fontSize: 13, color: '#71717a' }}>{session.user?.name}</span>
                  </div>
                  <button onClick={() => signOut()} style={{ background: 'none', border: 'none', fontSize: 13, color: '#52525b', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Sign out</button>
                </>
              ) : (
                <button onClick={() => signIn('google')} className="btn-primary" style={{ width: '100%', padding: '9px 16px', fontSize: 13, fontFamily: 'inherit' }}>Sign in with Google</button>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

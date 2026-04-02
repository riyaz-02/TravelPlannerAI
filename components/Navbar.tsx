'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import Image from 'next/image';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
          <div style={{
            width: 28, height: 28, borderRadius: 7, background: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fafafa', letterSpacing: '-0.01em' }}>TravelAI</span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} className="hidden-mobile">
          <Link href="/" style={linkStyle('/')}>Home</Link>
          <Link href="/plan-trip" style={linkStyle('/plan-trip')}>Plan Trip</Link>
          {session && <Link href="/dashboard" style={linkStyle('/dashboard')}>Dashboard</Link>}
          {session && <Link href="/analytics" style={linkStyle('/analytics')}>Analytics</Link>}
        </div>

        {/* Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="hidden-mobile">
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {session.user?.image && (
                <Image src={session.user.image} alt={session.user.name ?? ''} width={26} height={26}
                  style={{ borderRadius: '50%', border: '1px solid #27272a' }} />
              )}
              <span style={{ fontSize: 13, color: '#71717a' }}>{session.user?.name?.split(' ')[0]}</span>
              <button onClick={() => signOut()} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: '#52525b',
                padding: '4px 8px', borderRadius: 6, transition: 'color 0.15s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#a1a1aa')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#52525b')}
              >Sign out</button>
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
          onClick={() => setOpen(!open)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 6 }}
          className="show-mobile"
          aria-label="Toggle menu"
        >
          {open
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="16" x2="21" y2="16"/></svg>
          }
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{
          position: 'absolute', top: 52, left: 0, right: 0,
          background: '#0a0a0b', borderBottom: '1px solid #1c1c1f',
          padding: '12px 24px 16px',
        }} className="show-mobile">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Link href="/" onClick={() => setOpen(false)} style={{ ...linkStyle('/'), display: 'block' }}>Home</Link>
            <Link href="/plan-trip" onClick={() => setOpen(false)} style={{ ...linkStyle('/plan-trip'), display: 'block' }}>Plan Trip</Link>
            {session && <Link href="/dashboard" onClick={() => setOpen(false)} style={{ ...linkStyle('/dashboard'), display: 'block' }}>Dashboard</Link>}
            {session && <Link href="/analytics" onClick={() => setOpen(false)} style={{ ...linkStyle('/analytics'), display: 'block' }}>Analytics</Link>}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1c1c1f' }}>
            {session
              ? <button onClick={() => signOut()} style={{ background: 'none', border: 'none', fontSize: 13, color: '#71717a', cursor: 'pointer', padding: 0 }}>Sign out</button>
              : <button onClick={() => signIn('google')} className="btn-primary" style={{ width: '100%', padding: '9px 16px', fontSize: 13 }}>Sign in with Google</button>
            }
          </div>
        </div>
      )}
    </nav>
  );
}

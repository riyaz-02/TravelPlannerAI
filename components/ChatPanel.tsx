'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Itinerary } from '@/services/gemini';

interface Message { role: 'user' | 'assistant'; text: string; ts: Date; }

interface Props {
  sessionId:         string;
  currentItinerary:  Itinerary | null;
  tripContext:        Record<string, unknown>;
  onItineraryUpdate: (it: Itinerary) => void;
}

const SUGGESTIONS = [
  'Make Day 1 more adventurous',
  'Add local food experiences each day',
  'Replace hotels with budget stays',
  'What should I pack for this trip?',
  'Add a rest day in between',
];

export default function ChatPanel({ sessionId, currentItinerary, tripContext, onItineraryUpdate }: Props) {
  const { data: session } = useSession();
  const [open, setOpen]     = useState(false);
  const [msgs, setMsgs]     = useState<Message[]>([]);
  const [input, setInput]   = useState('');
  const [busy, setBusy]     = useState(false);
  const [updated, setUpdated] = useState(false);
  const [unread, setUnread]   = useState(0);
  const endRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [msgs, open]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setInput('');
    const userMsg: Message = { role: 'user', text, ts: new Date() };
    setMsgs((p) => [...p, userMsg]);
    setBusy(true);
    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userMessage: text, currentItinerary, tripContext }),
      });
      const data = await res.json();
      const replyText = res.ok ? data.reply : (data.error ?? 'Error occurred.');
      setMsgs((p) => [...p, { role: 'assistant', text: replyText, ts: new Date() }]);
      if (!open) setUnread((n) => n + 1);
      if (res.ok && data.updatedItinerary) {
        onItineraryUpdate(data.updatedItinerary as Itinerary);
        setUpdated(true);
        setTimeout(() => setUpdated(false), 4000);
      }
    } catch {
      setMsgs((p) => [...p, { role: 'assistant', text: 'Network error. Please try again.', ts: new Date() }]);
    } finally {
      setBusy(false);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  /* ── Floating button ─────────────────────────────────────────────── */
  const fab = (
    <button
      onClick={() => setOpen(true)}
      title="Refine with AI"
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
        width: 56, height: 56, borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(59,130,246,0.45), 0 2px 8px rgba(0,0,0,0.4)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        animation: 'fabIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.08)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(59,130,246,0.55), 0 4px 12px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(59,130,246,0.45), 0 2px 8px rgba(0,0,0,0.4)';
      }}
    >
      {/* Robot icon */}
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7v2a2 2 0 0 1-2 2h-1v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-1H5a2 2 0 0 1-2-2v-2a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zm-4 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-4 4c-1.5 0-2.75-.6-3.5-1.5C9 14.88 9 15.44 9 16h6c0-.56 0-1.12-.5-1.5-.75.9-2 1.5-3.5 1.5z"/>
      </svg>
      {/* Unread badge */}
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -2, right: -2,
          width: 18, height: 18, borderRadius: '50%',
          background: '#ef4444', border: '2px solid #0a0a0b',
          fontSize: 9, fontWeight: 700, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{unread}</span>
      )}
    </button>
  );

  /* ── Chat panel overlay ───────────────────────────────────────────── */
  const panel = (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 1001,
      width: 'min(400px, calc(100vw - 32px)',
      height: 580,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(14,14,16,0.96)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(59,130,246,0.2)',
      borderRadius: 20,
      boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
      animation: 'panelSlideUp 0.35s cubic-bezier(0.22,1,0.36,1) both',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))',
        borderBottom: '1px solid rgba(59,130,246,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7v2a2 2 0 0 1-2 2h-1v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-1H5a2 2 0 0 1-2-2v-2a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zm-4 9a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm8 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-4 4c-1.5 0-2.75-.6-3.5-1.5C9 14.88 9 15.44 9 16h6c0-.56 0-1.12-.5-1.5-.75.9-2 1.5-3.5 1.5z"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: 0, lineHeight: 1.2 }}>Refine with AI</p>
            <p style={{ fontSize: 11, color: '#6366f1', margin: 0 }}>
              {busy ? '⚡ Thinking…' : msgs.length > 0 ? `${Math.floor(msgs.length / 2)} exchange${msgs.length > 2 ? 's' : ''}` : 'Gemini-powered chat'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {updated && (
            <span style={{
              fontSize: 11, color: '#4ade80',
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
              padding: '3px 9px', borderRadius: 99, fontWeight: 600,
            }}>✓ Updated</span>
          )}
          <button
            onClick={() => setOpen(false)}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#71717a', transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fafafa'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#71717a'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      {!session ? (
        /* Not signed in */
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🔒</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#fafafa', textAlign: 'center', margin: 0 }}>Sign in to chat</p>
          <p style={{ fontSize: 13, color: '#71717a', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>Use AI chat to refine your itinerary in real-time with Gemini.</p>
          <button
            onClick={() => signIn('google')}
            style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >Sign in with Google</button>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Welcome state */}
            {msgs.length === 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, color: '#93c5fd', fontWeight: 600, marginBottom: 4 }}>👋 Hello!</p>
                  <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                    I&apos;ve read your full itinerary. Ask me anything to refine your trip plan!
                  </p>
                </div>
                <p style={{ fontSize: 11, color: '#4b5563', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Try asking:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} style={{
                      textAlign: 'left', padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 9, color: '#9ca3af',
                      fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1.4,
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#c4b5fd'; e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    >
                      ✦ {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                <div style={{
                  maxWidth: '86%', padding: '9px 13px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                    : 'rgba(255,255,255,0.06)',
                  border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  fontSize: 13, color: '#f1f5f9', lineHeight: 1.65,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{m.text}</div>
                <span style={{ fontSize: 10, color: '#374151', paddingLeft: m.role === 'user' ? 0 : 4, paddingRight: m.role === 'user' ? 4 : 0 }}>{formatTime(m.ts)}</span>
              </div>
            ))}

            {/* Typing indicator */}
            {busy && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      animation: `chatBounce 1.2s ${i * 0.18}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.2)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="e.g. Make Day 2 more adventurous…"
                disabled={busy}
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 11, color: '#f1f5f9',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                style={{
                  width: 40, height: 40, flexShrink: 0,
                  borderRadius: 11,
                  background: busy || !input.trim()
                    ? 'rgba(99,102,241,0.2)'
                    : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  border: 'none', cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s', boxShadow: busy || !input.trim() ? 'none' : '0 4px 12px rgba(59,130,246,0.3)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 10, color: '#374151', marginTop: 8, textAlign: 'center' }}>
              Powered by Gemini · Press Enter to send
            </p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes fabIn { from { transform: scale(0) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes panelSlideUp { from { transform: translateY(32px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes chatBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
      {open ? panel : fab}
    </>
  );
}

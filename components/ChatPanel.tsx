'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Itinerary } from '@/services/gemini';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  ts: Date;
  pendingItinerary?: Itinerary;  // holds proposed update waiting for confirmation
  confirmed?: boolean;            // true once user confirmed the update
}

interface Props {
  sessionId:         string;
  tripId?:           string | null;   // saved trip _id from MongoDB (for DB updates)
  currentItinerary:  Itinerary | null;
  tripContext:        Record<string, unknown>;
  onItineraryUpdate: (it: Itinerary) => void;
}

const SUGGESTIONS = [
  'What should I pack for this trip?',
  'Make Day 1 more adventurous',
  'Add local food experiences each day',
  'Suggest budget-friendly accommodation',
  'Add a rest/leisure day',
  'What are the must-see spots?',
];

// Build a plain-text diff summary between old and proposed itinerary
function buildChangeSummary(oldIt: Itinerary | null, newIt: Itinerary): string[] {
  const lines: string[] = [];
  if (!oldIt) return lines;

  // Budget change
  const oldTotal = oldIt.budgetBreakdown?.total ?? 0;
  const newTotal = newIt.budgetBreakdown?.total ?? 0;
  if (oldTotal !== newTotal) {
    const delta = newTotal - oldTotal;
    const sign  = delta > 0 ? '+' : '';
    lines.push(`💰 Budget: ₹${oldTotal.toLocaleString()} → ₹${newTotal.toLocaleString()} (${sign}₹${Math.abs(delta).toLocaleString()})`);
  }

  // Changed days
  const oldDays = oldIt.days ?? [];
  const newDays = newIt.days ?? [];
  newDays.forEach((nd, i) => {
    const od = oldDays[i];
    if (!od) { lines.push(`📅 Day ${nd.day}: New day added — ${nd.theme}`); return; }
    const changes: string[] = [];
    if (od.theme !== nd.theme) changes.push(`Theme: "${nd.theme}"`);
    if (od.morning?.activity !== nd.morning?.activity) changes.push(`Morning → ${nd.morning?.activity}`);
    if (od.afternoon?.activity !== nd.afternoon?.activity) changes.push(`Afternoon → ${nd.afternoon?.activity}`);
    if (od.evening?.activity !== nd.evening?.activity) changes.push(`Evening → ${nd.evening?.activity}`);
    if (od.accommodation?.name !== nd.accommodation?.name) changes.push(`Stay: ${nd.accommodation?.name}`);
    if (od.accommodation?.cost !== nd.accommodation?.cost) changes.push(`Hotel cost: ₹${nd.accommodation?.cost}`);
    if (changes.length) lines.push(`📅 Day ${nd.day}: ${changes.slice(0, 3).join(' · ')}`);
  });

  // Summary change
  if (oldIt.summary !== newIt.summary) {
    lines.push(`📝 Summary updated`);
  }

  return lines.slice(0, 6); // cap at 6 lines
}

export default function ChatPanel({
  sessionId,
  tripId,
  currentItinerary,
  tripContext,
  onItineraryUpdate,
}: Props) {
  const { data: session } = useSession();
  const [open,   setOpen]   = useState(false);
  const [msgs,   setMsgs]   = useState<Message[]>([]);
  const [input,  setInput]  = useState('');
  const [busy,   setBusy]   = useState(false);
  const [unread, setUnread] = useState(0);
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track conversation history for stateless API
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  // Scroll to bottom + focus input when panel opens
  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  // ── Send message (stateless — passes full history each time) ─────────────
  const send = useCallback(async (text: string) => {
    if (!text.trim() || busy) return;
    setInput('');
    const userMsg: Message = { role: 'user', text, ts: new Date() };
    setMsgs((p) => [...p, userMsg]);
    setBusy(true);

    // Snapshot history BEFORE adding the current turn
    const historySnapshot = [...historyRef.current];

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage:      text,
          currentItinerary,
          tripContext,
          tripId:           tripId ?? null,
          history:          historySnapshot,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMsgs((p) => [...p, {
          role: 'assistant',
          text: data.error ?? 'Sorry, something went wrong. Please try again.',
          ts: new Date(),
        }]);
        return;
      }

      const replyText        = data.reply as string;
      const updatedItinerary = data.updatedItinerary as Itinerary | null;

      // Persist to local history for next turn
      historyRef.current = [
        ...historySnapshot,
        { role: 'user',      text },
        { role: 'assistant', text: replyText },
      ];

      const assistantMsg: Message = {
        role:             'assistant',
        text:             replyText,
        ts:               new Date(),
        pendingItinerary: updatedItinerary ?? undefined,
      };

      setMsgs((p) => [...p, assistantMsg]);
      if (!open) setUnread((n) => n + 1);

    } catch (err) {
      setMsgs((p) => [...p, {
        role: 'assistant',
        text: `Network error: ${err instanceof Error ? err.message : 'Please check your connection.'}`,
        ts: new Date(),
      }]);
    } finally {
      setBusy(false);
    }
  }, [busy, currentItinerary, tripContext, tripId, open]);

  // ── Confirm + apply itinerary update ─────────────────────────────────────
  const confirmUpdate = (msgIndex: number, itinerary: Itinerary) => {
    onItineraryUpdate(itinerary);
    setMsgs((p) =>
      p.map((m, i) =>
        i === msgIndex
          ? { ...m, confirmed: true, pendingItinerary: undefined }
          : m,
      ),
    );
  };

  // ── Dismiss a proposed update ────────────────────────────────────────────
  const dismissUpdate = (msgIndex: number) => {
    setMsgs((p) =>
      p.map((m, i) =>
        i === msgIndex ? { ...m, pendingItinerary: undefined } : m,
      ),
    );
  };

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  /* ── Floating button ───────────────────────────────────────────────────── */
  const fab = (
    <button
      onClick={() => setOpen(true)}
      title="Refine with AI"
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
        width: 58, height: 58, borderRadius: '50%',
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(59,130,246,0.5), 0 2px 8px rgba(0,0,0,0.4)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        animation: 'fabIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(59,130,246,0.65), 0 4px 12px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(59,130,246,0.5), 0 2px 8px rgba(0,0,0,0.4)';
      }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
      </svg>
      {unread > 0 && (
        <span style={{
          position: 'absolute', top: -3, right: -3,
          minWidth: 20, height: 20, borderRadius: 10,
          background: '#ef4444', border: '2px solid #0a0a0b',
          fontSize: 10, fontWeight: 700, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
        }}>{unread}</span>
      )}
    </button>
  );

  /* ── Chat panel ────────────────────────────────────────────────────────── */
  const panel = (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 1001,
      width: 'min(420px, calc(100vw - 24px))',
      height: 600,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(11,11,13,0.97)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: 22,
      boxShadow: '0 32px 90px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
      animation: 'panelSlideUp 0.3s cubic-bezier(0.22,1,0.36,1) both',
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.07))',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fafafa', margin: 0 }}>Refine with AI</p>
            <p style={{ fontSize: 11, color: '#6366f1', margin: 0 }}>
              {busy ? '⚡ Thinking…' : msgs.length > 0 ? `${msgs.filter(m => m.role === 'user').length} message${msgs.filter(m => m.role === 'user').length !== 1 ? 's' : ''} sent` : 'Powered by Gemini AI'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setOpen(false)}
          style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#71717a', transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fafafa'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#71717a'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {!session ? (
        /* Not signed in */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16, textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: 18, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🔒</div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', marginBottom: 8 }}>Sign in to chat</p>
            <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>Chat with Gemini AI to refine your itinerary in real-time.</p>
          </div>
          <button onClick={() => signIn('google')} style={{ padding: '11px 28px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: 11, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Sign in with Google
          </button>
        </div>
      ) : (
        <>
          {/* Messages scrollable area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Welcome / Suggestions */}
            {msgs.length === 0 && (
              <div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', marginBottom: 14 }}>
                  <p style={{ fontSize: 13, color: '#a5b4fc', fontWeight: 600, marginBottom: 4 }}>👋 Hi! I&apos;m your travel AI</p>
                  <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.65, margin: 0 }}>
                    I have your full itinerary loaded. Ask me anything — packing tips, activity changes, budget advice, or local recommendations!
                  </p>
                </div>
                <p style={{ fontSize: 11, color: '#4b5563', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Quick questions:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} style={{
                      textAlign: 'left', padding: '8px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10, color: '#9ca3af',
                      fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; e.currentTarget.style.color = '#c4b5fd'; e.currentTarget.style.background = 'rgba(99,102,241,0.07)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    >✦ {s}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Message list */}
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 4 }}>
                {/* Bubble */}
                <div style={{
                  maxWidth: '88%',
                  padding: '10px 14px',
                  borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                    : m.confirmed
                    ? 'rgba(74,222,128,0.07)'
                    : 'rgba(255,255,255,0.05)',
                  border: m.role === 'assistant'
                    ? m.confirmed
                      ? '1px solid rgba(74,222,128,0.2)'
                      : '1px solid rgba(255,255,255,0.08)'
                    : 'none',
                  fontSize: 13, color: '#f1f5f9', lineHeight: 1.7,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {m.confirmed && (
                    <p style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 6 }}>✓ Itinerary updated in app</p>
                  )}
                  {m.text}
                </div>

                {/* Timestamp */}
                <span style={{ fontSize: 10, color: '#374151', paddingLeft: m.role === 'user' ? 0 : 4, paddingRight: m.role === 'user' ? 4 : 0 }}>
                  {fmtTime(m.ts)}
                </span>

                {/* ── Confirmation card with change summary ──────────── */}
                {m.role === 'assistant' && m.pendingItinerary && !m.confirmed && (() => {
                  const diff = buildChangeSummary(currentItinerary, m.pendingItinerary);
                  return (
                    <div style={{
                      width: '100%', maxWidth: '96%',
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(99,102,241,0.04))',
                      border: '1px solid rgba(99,102,241,0.28)',
                      borderRadius: 14, padding: '14px',
                      marginTop: 6,
                    }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: diff.length > 0 ? 10 : 12 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                        }}>✏️</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#c4b5fd', margin: 0 }}>Proposed itinerary changes</p>
                          <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>
                            {tripId ? 'Will update your trip in Plan History too' : 'Review before applying'}
                          </p>
                        </div>
                      </div>

                      {/* Change diff list */}
                      {diff.length > 0 && (
                        <div style={{
                          background: 'rgba(0,0,0,0.25)', borderRadius: 9,
                          padding: '10px 12px', marginBottom: 12,
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                          {diff.map((line, li) => (
                            <div key={li} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 8,
                              paddingBottom: li < diff.length - 1 ? 6 : 0,
                              marginBottom: li < diff.length - 1 ? 6 : 0,
                              borderBottom: li < diff.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                            }}>
                              <span style={{ fontSize: 11, color: '#818cf8', flexShrink: 0, marginTop: 1 }}>→</span>
                              <span style={{ fontSize: 11, color: '#a1a1aa', lineHeight: 1.5 }}>{line}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Buttons */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => confirmUpdate(i, m.pendingItinerary!)}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                            border: 'none', borderRadius: 9,
                            color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            transition: 'opacity 0.15s', letterSpacing: '0.01em',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >✓ Apply changes</button>
                        <button
                          onClick={() => dismissUpdate(i)}
                          style={{
                            padding: '9px 16px',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 9, color: '#71717a',
                            fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#a1a1aa'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#71717a'; }}
                        >Keep current</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}

            {/* Typing indicator */}
            {busy && (
              <div style={{ display: 'flex', gap: 4, paddingLeft: 4, alignItems: 'center' }}>
                <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 5 }}>
                  {[0, 1, 2].map((j) => (
                    <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', animation: `chatBounce 1.2s ${j * 0.18}s infinite` }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: '#4b5563' }}>AI is thinking…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* ── Input bar ─────────────────────────────────────────────── */}
          <div style={{
            padding: '10px 12px 12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.25)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder="Ask about your trip or request changes…"
                disabled={busy}
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, color: '#f1f5f9',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  transition: 'border-color 0.15s',
                  resize: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                style={{
                  width: 42, height: 42, flexShrink: 0,
                  borderRadius: 12,
                  background: busy || !input.trim()
                    ? 'rgba(99,102,241,0.15)'
                    : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  border: '1px solid',
                  borderColor: busy || !input.trim() ? 'rgba(99,102,241,0.2)' : 'transparent',
                  cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                  boxShadow: busy || !input.trim() ? 'none' : '0 4px 14px rgba(59,130,246,0.35)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 10, color: '#3f3f46', marginTop: 8, textAlign: 'center' }}>
              Powered by Gemini 2.5 Flash · Press Enter to send
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
        @keyframes panelSlideUp { from { transform: translateY(28px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes chatBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      `}</style>
      {open ? panel : fab}
    </>
  );
}

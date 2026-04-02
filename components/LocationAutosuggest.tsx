'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { searchLocations, NominatimResult } from '@/services/nominatim';

interface Props {
  id: string;
  label: string;
  placeholder?: string;
  onSelect: (result: NominatimResult) => void;
  value: string;
  onChange: (val: string) => void;
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '9px 36px 9px 13px',
  background: '#1c1c1f',
  border: '1px solid #27272a',
  borderRadius: 9,
  color: '#fafafa',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  WebkitAppearance: 'none',
};

export default function LocationAutosuggest({ id, label, placeholder, onSelect, value, onChange }: Props) {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef          = useRef<HTMLDivElement>(null);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((val: string) => {
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (val.length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const r = await searchLocations(val);
        setResults(r);
        setOpen(r.length > 0);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [onChange]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (r: NominatimResult) => {
    onChange(r.displayName);
    onSelect(r);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label && (
        <label htmlFor={id} style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525b', marginBottom: 6 }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            ...inputStyle,
            borderColor: focused ? '#3b82f6' : '#27272a',
            boxShadow: focused ? '0 0 0 3px rgba(59,130,246,.14)' : 'none',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
        />

        {/* Right icon */}
        <div style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', lineHeight: 0 }}>
          {loading ? (
            <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(59,130,246,.3)', borderTopColor: '#3b82f6', animation: 'spin .7s linear infinite' }} />
          ) : value ? (
            <button
              type="button"
              onClick={() => { onChange(''); setResults([]); setOpen(false); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', fontSize: 16, padding: 0, lineHeight: 1, display: 'flex' }}
              aria-label="Clear"
            >
              ×
            </button>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul style={{
          position: 'absolute', zIndex: 100, width: '100%', marginTop: 4,
          background: '#111113', border: '1px solid #27272a', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,.6)', overflow: 'hidden', padding: 0, listStyle: 'none',
        }}>
          {results.slice(0, 6).map((r, i) => {
            const [city, ...rest] = r.displayName.split(', ');
            return (
              <li
                key={r.placeId}
                onMouseDown={() => handleSelect(r)}
                style={{
                  padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                  borderBottom: i < Math.min(results.length - 1, 5) ? '1px solid #1c1c1f' : 'none',
                  background: i === 0 ? '#18181b' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#18181b')}
                onMouseLeave={(e) => (e.currentTarget.style.background = i === 0 ? '#18181b' : 'transparent')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city}</p>
                  {rest.length > 0 && (
                    <p style={{ fontSize: 11, color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                      {rest.join(', ')}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

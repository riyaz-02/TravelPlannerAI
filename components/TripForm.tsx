'use client';

import { useForm, Controller } from 'react-hook-form';
import { useState } from 'react';
import LocationAutosuggest from './LocationAutosuggest';
import { NominatimResult } from '@/services/nominatim';

export interface TripStop {
  name:   string;
  coords: { lat: number; lon: number } | null;
}

export interface TripFormValues {
  from:        string;
  to:          string;
  fromCoords:  { lat: number; lon: number } | null;
  toCoords:    { lat: number; lon: number } | null;
  transport:   string;
  startDate:   string;
  endDate:     string;
  budget:      number;
  currency:    string;
  travelers:   number;
  preferences: string[];
  stops:       TripStop[];   // ← multi-stop waypoints (TSP)
}

const PREFERENCES = [
  'Culture & History', 'Adventure', 'Food & Cuisine', 'Nature',
  'Beach', 'Shopping', 'Nightlife', 'Family', 'Budget Travel',
  'Luxury', 'Mountains', 'Spiritual', 'Wildlife', 'Arts',
];
const TRAVEL_MODES = [
  { value: 'driving-car', label: 'Road',   sub: 'Drive / Taxi / Bus' },
  { value: 'train',       label: 'Train',  sub: 'Rail journey' },
  { value: 'flight',      label: 'Flight', sub: 'Air travel' },
];
const BUDGET_RANGES: Record<string, { label: string; value: number }[]> = {
  INR: [
    { label: '₹5k – ₹15k',    value: 10000  },
    { label: '₹15k – ₹30k',   value: 22500  },
    { label: '₹30k – ₹60k',   value: 45000  },
    { label: '₹60k – ₹1L',    value: 80000  },
    { label: '₹1L – ₹2L',     value: 150000 },
    { label: '₹2L – ₹5L',     value: 350000 },
    { label: '₹5L+',          value: 700000 },
  ],
  USD: [
    { label: '$100 – $300',    value: 200  }, { label: '$300 – $600',   value: 450  },
    { label: '$600 – $1.2k',   value: 900  }, { label: '$1.2k – $2.5k', value: 1850 },
    { label: '$2.5k – $5k',    value: 3750 }, { label: '$5k+',          value: 7500 },
  ],
  EUR: [
    { label: '€100 – €300',   value: 200 }, { label: '€300 – €600',   value: 450  },
    { label: '€600 – €1.2k',  value: 900 }, { label: '€1.2k – €2.5k', value: 1850 },
    { label: '€2.5k+',        value: 3750 },
  ],
  GBP: [
    { label: '£100 – £300', value: 200 }, { label: '£300 – £600', value: 450 },
    { label: '£600 – £1.2k', value: 900 }, { label: '£1.2k+', value: 1850 },
  ],
};

interface Props { onSubmit: (v: TripFormValues) => void; loading?: boolean; }

const IS: React.CSSProperties = {
  display: 'block', width: '100%', padding: '9px 13px',
  background: '#1c1c1f', border: '1px solid #27272a', borderRadius: 9,
  color: '#fafafa', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  WebkitAppearance: 'none', appearance: 'none', boxSizing: 'border-box',
};
const LBL: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  letterSpacing: '0.07em', textTransform: 'uppercase', color: '#52525b', marginBottom: 6,
};

export default function TripForm({ onSubmit, loading }: Props) {
  const { register, handleSubmit, control, setValue, watch, formState: { errors } } =
    useForm<TripFormValues>({
      defaultValues: {
        transport: 'driving-car', currency: 'INR', travelers: 1,
        preferences: [], fromCoords: null, toCoords: null, stops: [],
      },
    });

  const [fromValue,    setFromValue]    = useState('');
  const [toValue,      setToValue]      = useState('');
  const [focused,      setFocused]      = useState<string | null>(null);
  const [stops,        setStops]        = useState<TripStop[]>([]);
  const [stopVals,     setStopVals]     = useState<string[]>([]);

  const prefs     = watch('preferences') ?? [];
  const currency  = watch('currency') ?? 'INR';
  const transport = watch('transport');
  const ranges    = BUDGET_RANGES[currency] ?? BUDGET_RANGES.INR;

  const fs = (name: string): React.CSSProperties => ({
    ...IS,
    borderColor: focused === name ? '#3b82f6' : '#27272a',
    boxShadow:   focused === name ? '0 0 0 3px rgba(59,130,246,.14)' : 'none',
    transition:  'border-color 0.15s, box-shadow 0.15s',
  });

  const togglePref = (p: string) =>
    setValue('preferences', prefs.includes(p) ? prefs.filter((x) => x !== p) : [...prefs, p]);

  const addStop = () => { if (stops.length < 5) { setStops([...stops, { name: '', coords: null }]); setStopVals([...stopVals, '']); } };
  const rmStop  = (i: number) => { setStops(stops.filter((_, j) => j !== i)); setStopVals(stopVals.filter((_, j) => j !== i)); };
  const upStop  = (i: number, name: string, coords: { lat: number; lon: number } | null) => {
    const s = [...stops]; s[i] = { name, coords }; setStops(s);
  };
  const upStopVal = (i: number, v: string) => { const a = [...stopVals]; a[i] = v; setStopVals(a); };

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit({ ...values, stops }))}
      style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Origin & Destination */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Controller name="from" control={control} rules={{ required: 'Origin is required' }}
          render={() => (
            <div>
              <label style={LBL}>Origin</label>
              <LocationAutosuggest id="trip-from" label="" placeholder="e.g. Mumbai, India"
                value={fromValue}
                onChange={(v) => { setFromValue(v); setValue('from', v); }}
                onSelect={(r: NominatimResult) => { setFromValue(r.displayName); setValue('from', r.displayName); setValue('fromCoords', { lat: r.lat, lon: r.lon }); }}
              />
              {errors.from && <p style={{ marginTop: 4, fontSize: 11, color: '#f87171' }}>{errors.from.message}</p>}
            </div>
          )}
        />
        <Controller name="to" control={control} rules={{ required: 'Destination is required' }}
          render={() => (
            <div>
              <label style={LBL}>Destination</label>
              <LocationAutosuggest id="trip-to" label="" placeholder="e.g. Goa, India"
                value={toValue}
                onChange={(v) => { setToValue(v); setValue('to', v); }}
                onSelect={(r: NominatimResult) => { setToValue(r.displayName); setValue('to', r.displayName); setValue('toCoords', { lat: r.lat, lon: r.lon }); }}
              />
              {errors.to && <p style={{ marginTop: 4, fontSize: 11, color: '#f87171' }}>{errors.to.message}</p>}
            </div>
          )}
        />
      </div>

      {/* Waypoints — road mode only */}
      {transport === 'driving-car' && (
        <div>
          <p style={LBL}>
            Waypoints{' '}
            <span style={{ textTransform: 'none', fontWeight: 400, color: '#3f3f46', letterSpacing: 0 }}>
              — optional · stops are TSP-optimised automatically
            </span>
          </p>
          {stops.map((_, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <LocationAutosuggest id={`stop-${i}`} label="" placeholder={`Stop ${i + 1} — e.g. Pune`}
                value={stopVals[i] ?? ''}
                onChange={(v) => { upStopVal(i, v); upStop(i, v, null); }}
                onSelect={(r: NominatimResult) => { upStopVal(i, r.displayName); upStop(i, r.displayName, { lat: r.lat, lon: r.lon }); }}
              />
              <button type="button" onClick={() => rmStop(i)}
                style={{ padding: '9px 12px', background: 'transparent', border: '1px solid #27272a', borderRadius: 9, color: '#71717a', cursor: 'pointer', fontSize: 13, transition: 'all 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#f87171'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#71717a'; }}
              >✕</button>
            </div>
          ))}
          {stops.length < 5 && (
            <button type="button" onClick={addStop}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'transparent', border: '1px dashed #27272a', borderRadius: 9, color: '#52525b', cursor: 'pointer', fontSize: 12, transition: 'all 0.15s', fontFamily: 'inherit' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.color = '#52525b'; }}
            >+ Add waypoint</button>
          )}
        </div>
      )}

      {/* Travel mode */}
      <div>
        <p style={LBL}>Travel mode</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {TRAVEL_MODES.map((m) => {
            const active = transport === m.value;
            return (
              <button key={m.value} type="button"
                onClick={() => { setValue('transport', m.value); if (m.value !== 'driving-car') { setStops([]); setStopVals([]); } }}
                style={{ padding: '10px 12px', borderRadius: 9, border: `1px solid ${active ? '#3b82f6' : '#27272a'}`, background: active ? 'rgba(59,130,246,.1)' : '#18181b', color: active ? '#93c5fd' : '#71717a', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                <p style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</p>
                <p style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{m.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={LBL}>Start date</label>
          <input type="date" style={fs('startDate')} {...register('startDate')} />
        </div>
        <div>
          <label style={LBL}>End date</label>
          <input type="date" style={fs('endDate')} {...register('endDate')} />
        </div>
      </div>

      {/* Budget & Travelers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14, alignItems: 'end' }}>
        <div>
          <label style={LBL}>Currency</label>
          <select style={fs('currency')} {...register('currency')}>
            <option value="INR">₹ INR</option><option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option><option value="GBP">£ GBP</option>
          </select>
        </div>
        <div>
          <label style={LBL}>Budget</label>
          <select style={fs('budget')}
            {...register('budget', { required: 'Select a budget', min: 1, valueAsNumber: true })}>
            <option value="">Select range</option>
            {ranges.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {errors.budget && <p style={{ marginTop: 4, fontSize: 11, color: '#f87171' }}>{errors.budget.message}</p>}
        </div>
        <div>
          <label style={LBL}>Travelers</label>
          <input type="number" min="1" max="20" style={fs('travelers')}
            {...register('travelers', { min: 1, valueAsNumber: true })} />
        </div>
      </div>

      {/* Preferences */}
      <div>
        <p style={LBL}>Preferences <span style={{ textTransform: 'none', fontWeight: 400, color: '#3f3f46', letterSpacing: 0 }}>— optional</span></p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {PREFERENCES.map((p) => {
            const active = prefs.includes(p);
            return (
              <button key={p} type="button" onClick={() => togglePref(p)}
                style={{ padding: '5px 12px', borderRadius: 99, fontSize: 12, border: `1px solid ${active ? '#3b82f6' : '#27272a'}`, background: active ? 'rgba(59,130,246,.12)' : 'transparent', color: active ? '#93c5fd' : '#52525b', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}
              >{p}</button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <button type="submit" id="plan-trip-submit" disabled={loading}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 24px', background: loading ? 'rgba(59,130,246,.5)' : '#3b82f6', border: 'none', borderRadius: 9, color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
      >
        {loading ? (
          <><div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }} />Generating itinerary…</>
        ) : 'Generate trip plan'}
      </button>
    </form>
  );
}

'use client';

import { BudgetBreakdown } from '@/services/gemini';

interface Props {
  breakdown: BudgetBreakdown;
  currency: string;
  travelers: number;
}

const CATEGORIES = [
  { key: 'transport',     label: 'Transport',     icon: '🚗', color: '#0ea5e9', bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-300' },
  { key: 'accommodation', label: 'Accommodation', icon: '🏨', color: '#8b5cf6', bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-300' },
  { key: 'food',          label: 'Food & Dining', icon: '🍽️', color: '#f97316', bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-300' },
  { key: 'activities',    label: 'Activities',    icon: '🎯', color: '#22c55e', bg: 'bg-green-500/10',   border: 'border-green-500/30',   text: 'text-green-300' },
  { key: 'shopping',      label: 'Shopping',      icon: '🛍️', color: '#ec4899', bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    text: 'text-pink-300' },
  { key: 'miscellaneous', label: 'Miscellaneous', icon: '📦', color: '#6b7280', bg: 'bg-slate-500/10',   border: 'border-slate-500/30',   text: 'text-slate-400' },
] as const;

export default function BudgetCard({ breakdown, currency, travelers }: Props) {
  const total = breakdown.total || 1;
  const nonZero = CATEGORIES.filter(({ key }) => (breakdown[key] ?? 0) > 0);

  return (
    <div className="space-y-6">

      {/* ── Total banner ── */}
      <div className="relative text-center p-6 rounded-2xl bg-gradient-to-br from-brand-500/15 to-accent-500/10 border border-brand-500/25 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-transparent to-brand-500/5" />
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 relative z-10">Total Estimated Budget</p>
        <p className="text-5xl font-bold text-white mt-2 relative z-10">
          <span className="text-2xl text-slate-400 font-normal mr-1">{currency}</span>
          {breakdown.total.toLocaleString()}
        </p>
        {travelers > 1 && (
          <p className="text-sm text-slate-400 mt-2 relative z-10">
            <span className="text-brand-300 font-semibold">{currency} {Math.round(breakdown.total / travelers).toLocaleString()}</span>
            {' '}per person
          </p>
        )}
      </div>

      {/* ── Category grid cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CATEGORIES.map(({ key, label, icon, color, bg, border, text }) => {
          const amount = breakdown[key] ?? 0;
          const pct = Math.round((amount / total) * 100);
          return (
            <div key={key} className={`p-3 rounded-xl ${bg} border ${border}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <span className={`text-xs font-semibold ${text}`}>{label}</span>
              </div>
              <p className="text-lg font-bold text-white">
                <span className="text-xs text-slate-400 font-normal">{currency} </span>
                {amount.toLocaleString()}
              </p>
              <p className={`text-xs mt-0.5 ${text} opacity-70`}>{pct}% of total</p>
            </div>
          );
        })}
      </div>

      {/* ── Stacked bar chart ── */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Spend Distribution</p>
        <div className="flex h-4 rounded-full overflow-hidden gap-px">
          {nonZero.map(({ key, color }) => {
            const pct = Math.round(((breakdown[key] ?? 0) / total) * 100);
            if (pct === 0) return null;
            return (
              <div
                key={key}
                title={`${key}: ${pct}%`}
                className="h-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {nonZero.map(({ key, label, icon, color }) => {
            const pct = Math.round(((breakdown[key] ?? 0) / total) * 100);
            return (
              <div key={key} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                {icon} {label} ({pct}%)
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Progress bars (detailed) ── */}
      <div className="space-y-3">
        {CATEGORIES.map(({ key, label, icon, color }) => {
          const amount = breakdown[key] ?? 0;
          const pct = Math.round((amount / total) * 100);
          if (amount === 0) return null;
          return (
            <div key={key}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-300 flex items-center gap-1.5">
                  <span>{icon}</span> {label}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-500">{pct}%</span>
                  <span className="text-xs font-semibold text-white">{currency} {amount.toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

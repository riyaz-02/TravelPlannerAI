'use client';

import { useState } from 'react';
import { Itinerary } from '@/services/gemini';

interface Props {
  itinerary: Itinerary;
  currency: string;
}

const TIME_SLOTS = [
  { key: 'morning',   icon: '🌅', label: 'Morning',   color: 'from-amber-500/20 to-orange-500/10', border: 'border-amber-500/30', badge: 'bg-amber-500/10 text-amber-300' },
  { key: 'afternoon', icon: '☀️', label: 'Afternoon', color: 'from-sky-500/20 to-blue-500/10',    border: 'border-sky-500/30',   badge: 'bg-sky-500/10 text-sky-300' },
  { key: 'evening',   icon: '🌙', label: 'Evening',   color: 'from-violet-500/20 to-purple-500/10', border: 'border-violet-500/30', badge: 'bg-violet-500/10 text-violet-300' },
] as const;

const MEAL_ICONS: Record<string, string> = { Breakfast: '🍳', Lunch: '🍱', Dinner: '🍽️' };

export default function ItineraryCard({ itinerary, currency }: Props) {
  const [openDay, setOpenDay] = useState<number | null>(0);

  return (
    <div className="space-y-5">

      {/* ── Summary banner ── */}
      <div className="relative p-5 rounded-2xl bg-gradient-to-br from-brand-500/15 via-accent-500/10 to-transparent border border-brand-500/25 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <p className="text-sm text-slate-300 leading-relaxed relative z-10">{itinerary.summary}</p>
        {itinerary.bestTimeToVisit && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 relative z-10">
            <span>🗓️</span>
            <span>{itinerary.bestTimeToVisit}</span>
          </div>
        )}
      </div>

      {/* ── Day selector tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {itinerary.days.map((day, idx) => (
          <button
            key={day.day}
            onClick={() => setOpenDay(openDay === idx ? null : idx)}
            className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              openDay === idx
                ? 'bg-brand-500/20 border-brand-500/60 text-brand-300 shadow-lg shadow-brand-500/10'
                : 'bg-slate-800/40 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-xs opacity-70">Day</span>
            <span className="text-lg font-bold leading-none">{day.day}</span>
          </button>
        ))}
      </div>

      {/* ── Day detail panel ── */}
      {openDay !== null && itinerary.days[openDay] && (() => {
        const day = itinerary.days[openDay];
        return (
          <div className="space-y-4 animate-fade-down">

            {/* Day header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{day.theme}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{day.date}</p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs bg-brand-500/15 border border-brand-500/30 text-brand-300 font-medium">
                Day {day.day}
              </span>
            </div>

            {/* Activity timeline */}
            <div className="space-y-3">
              {TIME_SLOTS.map(({ key, icon, label, color, border, badge }) => {
                const slot = day[key];
                if (!slot) return null;
                return (
                  <div key={key} className={`p-4 rounded-xl bg-gradient-to-r ${color} border ${border}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5 flex-shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${badge}`}>
                            {label}
                          </span>
                          {slot.duration && (
                            <span className="text-[10px] text-slate-400">⏱ {slot.duration}</span>
                          )}
                          <span className="ml-auto text-xs font-semibold text-green-300 flex-shrink-0">
                            {currency} {(slot.estimatedCost ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white">{slot.activity}</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{slot.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Food & Dining */}
            {day.food?.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🍽️</span> Food & Dining
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {day.food.map((f) => (
                    <div key={f.meal} className="p-3 rounded-lg bg-slate-700/50 border border-slate-600 text-center">
                      <p className="text-lg mb-1">{MEAL_ICONS[f.meal] ?? '🥘'}</p>
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{f.meal}</p>
                      <p className="text-xs text-white font-medium mt-1 leading-snug line-clamp-2">{f.suggestion}</p>
                      <p className="text-xs text-accent-400 font-semibold mt-1.5">{currency} {(f.cost ?? 0).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accommodation */}
            {day.accommodation && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-xl flex-shrink-0">
                    🏨
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{day.accommodation.name}</p>
                    <p className="text-xs text-purple-300 capitalize">{day.accommodation.type}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">Per night</p>
                  <p className="text-sm font-bold text-purple-300">{currency} {(day.accommodation.cost ?? 0).toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Tips */}
            {day.tips?.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <p className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                  <span>💡</span> Local Tips
                </p>
                <ul className="space-y-1.5">
                  {day.tips.map((tip, ti) => (
                    <li key={ti} className="flex gap-2 text-xs text-slate-300">
                      <span className="text-amber-400 flex-shrink-0 mt-0.5">›</span>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Packing List ── */}
      {itinerary.packingList?.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700">
          <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span>🎒</span> Packing List
          </p>
          <div className="flex flex-wrap gap-2">
            {itinerary.packingList.map((item, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-xs bg-slate-700/60 text-slate-300 border border-slate-600 hover:border-brand-500/50 hover:text-brand-300 transition-colors"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Local Tips (global) ── */}
      {itinerary.localTips?.length > 0 && (
        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-sm font-semibold text-emerald-300 mb-3 flex items-center gap-2">
            <span>🌟</span> Insider Tips
          </p>
          <ul className="space-y-2">
            {itinerary.localTips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-300">
                <span className="text-emerald-400 flex-shrink-0 mt-0.5">✓</span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

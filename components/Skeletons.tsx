export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl bg-slate-800/60 border border-slate-700 overflow-hidden animate-pulse ${className}`}>
      <div className="h-full w-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[size:200%_100%] animate-shimmer" />
    </div>
  );
}

export function WeatherSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl bg-slate-800 animate-pulse border border-slate-700" />
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="w-full rounded-xl bg-slate-800 animate-pulse flex items-center justify-center" style={{ minHeight: '400px' }}>
      <div className="text-slate-600 text-4xl">🗺️</div>
    </div>
  );
}

export function ItinerarySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-slate-800 animate-pulse border border-slate-700" />
      ))}
    </div>
  );
}

export function BudgetSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-24 rounded-xl bg-slate-800 animate-pulse" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-4 rounded-full bg-slate-800 animate-pulse" />
      ))}
    </div>
  );
}

export function NewsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-48 rounded-xl bg-slate-800 animate-pulse border border-slate-700" />
      ))}
    </div>
  );
}

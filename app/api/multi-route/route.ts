/**
 * POST /api/multi-route
 *
 * Multi-stop route optimizer API.
 *
 * 1. Accepts an array of stops (name, lat, lon).
 * 2. Runs the Nearest Neighbour TSP heuristic (O(n²)) to find the optimal
 *    visit order — origin is always kept as the first city.
 * 3. Fetches OpenRouteService GeoJSON for each consecutive segment in the
 *    optimised order (in parallel for speed).
 * 4. Returns the optimised order, km saved vs. naive order, and per-segment
 *    GeoJSON for rendering on the map.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nearestNeighbourTSP, naiveOrderKm, type City } from '@/lib/algorithms/tsp';

const ORS_BASE = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';

export interface RouteSegment {
  from: { name: string; lat: number; lon: number };
  to:   { name: string; lat: number; lon: number };
  geojson:  unknown;
  distance: number; // metres
  duration: number; // seconds
}

interface Stop {
  name: string;
  lat:  number;
  lon:  number;
}

async function fetchSegment(
  from: Stop,
  to: Stop,
  apiKey: string,
): Promise<RouteSegment | null> {
  try {
    const res = await fetch(ORS_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        coordinates: [
          [from.lon, from.lat],
          [to.lon, to.lat],
        ],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const feature = data.features?.[0];
    const summary = feature?.properties?.summary;

    return {
      from,
      to,
      geojson:  data,
      distance: summary?.distance ?? 0,
      duration: summary?.duration ?? 0,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { stops }: { stops: Stop[] } = await req.json();

    if (!stops || stops.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 stops are required.' },
        { status: 400 },
      );
    }
    if (stops.length > 12) {
      return NextResponse.json(
        { error: 'Maximum 12 stops supported.' },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTE_API_KEY!;

    // ── Run TSP algorithm ─────────────────────────────────────────────────────
    const cities: City[] = stops.map((s) => ({ name: s.name, lat: s.lat, lon: s.lon }));
    const { order: optimisedCities, orderIndices, totalKm: optimisedKm } =
      nearestNeighbourTSP(cities);
    const naiveKm   = naiveOrderKm(cities);
    const savedKm   = Math.max(0, naiveKm - optimisedKm);
    const savedPct  = naiveKm > 0 ? (savedKm / naiveKm) * 100 : 0;

    // ── Fetch ORS segments in parallel ────────────────────────────────────────
    const optimisedStops = optimisedCities as Stop[];
    const segmentPromises = optimisedStops
      .slice(0, -1)
      .map((s, i) => fetchSegment(s, optimisedStops[i + 1], apiKey));

    const settled   = await Promise.all(segmentPromises);
    const segments  = settled.filter(Boolean) as RouteSegment[];

    const totalDistance = segments.reduce((sum, s) => sum + s.distance, 0);
    const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);

    return NextResponse.json({
      optimisedOrder: optimisedCities,
      orderIndices,
      naiveKm:      Math.round(naiveKm      * 10) / 10,
      optimisedKm:  Math.round(optimisedKm  * 10) / 10,
      savedKm:      Math.round(savedKm       * 10) / 10,
      savedPercent: Math.round(savedPct      * 10) / 10,
      segments,
      totalDistance,
      totalDuration,
    });
  } catch (err) {
    console.error('multi-route error:', err);
    return NextResponse.json(
      { error: 'Failed to compute optimised route.' },
      { status: 500 },
    );
  }
}

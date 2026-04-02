/**
 * POST /api/poi
 *
 * Server-side proxy for the Overpass API (OpenStreetMap).
 * The browser cannot call Overpass directly due to CORS restrictions,
 * so we proxy through this Next.js API route.
 *
 * Body: { lat: number; lon: number; mode: 'hotels' | 'spots' }
 * Response: { pois: POI[] }
 */

import { NextRequest, NextResponse } from 'next/server';

export interface POI {
  name: string;
  address: string;
  type: string;
  lat: number;
  lon: number;
}

const RADIUS = 15000; // 15 km

function buildOverpassQuery(lat: number, lon: number, mode: 'hotels' | 'spots'): string {
  const r = RADIUS;

  // Hotel/accommodation query
  const hotelFilters = [
    `node["tourism"="hotel"](around:${r},${lat},${lon})`,
    `node["tourism"="hostel"](around:${r},${lat},${lon})`,
    `node["tourism"="motel"](around:${r},${lat},${lon})`,
    `node["tourism"="guest_house"](around:${r},${lat},${lon})`,
    `way["tourism"="hotel"](around:${r},${lat},${lon})`,
    `way["tourism"="hostel"](around:${r},${lat},${lon})`,
  ];

  // Tourist attraction query
  const spotFilters = [
    `node["tourism"="attraction"](around:${r},${lat},${lon})`,
    `node["tourism"="museum"](around:${r},${lat},${lon})`,
    `node["tourism"="viewpoint"](around:${r},${lat},${lon})`,
    `node["tourism"="artwork"](around:${r},${lat},${lon})`,
    `node["tourism"="theme_park"](around:${r},${lat},${lon})`,
    `node["tourism"="zoo"](around:${r},${lat},${lon})`,
    `node["historic"="monument"](around:${r},${lat},${lon})`,
    `node["historic"="ruins"](around:${r},${lat},${lon})`,
    `node["historic"="fort"](around:${r},${lat},${lon})`,
    `node["historic"="castle"](around:${r},${lat},${lon})`,
    `node["historic"="temple"](around:${r},${lat},${lon})`,
    `node["amenity"="place_of_worship"](around:${r},${lat},${lon})`,
  ];

  const filters = mode === 'hotels' ? hotelFilters : spotFilters;
  return `[out:json][timeout:25];(${filters.join(';')};);out body center 15;`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseElement(el: any): POI | null {
  const tags = el.tags ?? {};
  if (!tags.name) return null;   // skip unnamed places

  const typeKey = tags['tourism'] || tags['historic'] || tags['amenity'] || 'place';
  const address = [
    tags['addr:street'],
    tags['addr:city'] || tags['addr:county'] || tags['addr:state'],
  ].filter(Boolean).join(', ') || tags['description']?.slice(0, 80) || '';

  // For ways, use the center point; for nodes use el.lat/lon directly
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!lat || !lon) return null;

  return { name: tags.name, address, type: typeKey, lat, lon };
}

export async function POST(req: NextRequest) {
  try {
    const { lat, lon, mode } = await req.json() as { lat: number; lon: number; mode: 'hotels' | 'spots' };

    if (!lat || !lon || !mode) {
      return NextResponse.json({ error: 'lat, lon, and mode are required.' }, { status: 400 });
    }

    const query = buildOverpassQuery(lat, lon, mode);

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `data=${encodeURIComponent(query)}`,
    });

    if (!overpassRes.ok) {
      const text = await overpassRes.text();
      console.error('[POI API] Overpass error:', overpassRes.status, text.slice(0, 200));
      return NextResponse.json({ error: 'Overpass API error', pois: [] }, { status: 502 });
    }

    const data = await overpassRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pois = (data.elements as any[])
      .map(parseElement)
      .filter((p): p is POI => p !== null)
      .slice(0, 12); // cap at 12 results

    return NextResponse.json({ pois });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/poi] error:', msg);
    return NextResponse.json({ error: msg, pois: [] }, { status: 500 });
  }
}

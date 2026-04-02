import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { from, to, transport = 'driving-car' } = await req.json();

    const profileMap: Record<string, string> = {
      'driving-car': 'driving-car',
      'cycling-regular': 'cycling-regular',
      'foot-walking': 'foot-walking',
    };

    const profile = profileMap[transport] || 'driving-car';
    const apiKey = process.env.OPENROUTE_API_KEY;

    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // New ORS JWT-style API keys require "Bearer " prefix
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          coordinates: [from, to], // [[lng,lat], [lng,lat]]
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    const data = await response.json();
    const feature = data.features?.[0];
    const summary = feature?.properties?.summary;

    return NextResponse.json({
      geojson: data,
      distance: summary?.distance, // meters
      duration: summary?.duration, // seconds
    });
  } catch (error) {
    console.error('Route API error:', error);
    return NextResponse.json({ error: 'Failed to fetch route' }, { status: 500 });
  }
}

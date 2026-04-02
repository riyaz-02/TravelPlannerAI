export interface RouteResult {
  geojson: object;
  distance: number; // meters
  duration: number; // seconds
}

export async function getRoute(
  from: [number, number],
  to: [number, number],
  transport: string = 'driving-car'
): Promise<RouteResult> {
  const response = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, transport }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || 'Failed to fetch route');
  }

  return response.json();
}

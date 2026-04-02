export interface NominatimResult {
  displayName: string;
  lat: number;
  lon: number;
  placeId: number;
}

export async function searchLocations(query: string): Promise<NominatimResult[]> {
  if (!query || query.length < 2) return [];

  const headers = { 'Accept-Language': 'en', 'User-Agent': 'TravelPlannerAI/1.0' };

  // First pass: India-biased results
  const indiaUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0&countrycodes=in`;
  const globalUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`;

  const [indiaRes, globalRes] = await Promise.all([
    fetch(indiaUrl, { headers }),
    fetch(globalUrl, { headers }),
  ]);

  const [indiaData, globalData] = await Promise.all([
    indiaRes.ok ? indiaRes.json() : [],
    globalRes.ok ? globalRes.json() : [],
  ]);

  const parse = (items: { display_name: string; lat: string; lon: string; place_id: number }[]): NominatimResult[] =>
    items.map((item) => ({
      displayName: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      placeId: item.place_id,
    }));

  const indiaResults = parse(indiaData);
  const globalResults = parse(globalData);

  // Merge: India first, then global (deduplicated by placeId)
  const seen = new Set<number>();
  const merged: NominatimResult[] = [];
  for (const r of [...indiaResults, ...globalResults]) {
    if (!seen.has(r.placeId)) {
      seen.add(r.placeId);
      merged.push(r);
    }
  }

  return merged.slice(0, 6);
}

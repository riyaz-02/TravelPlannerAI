'use client';

import { useEffect, useRef } from 'react';
import type { Map, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapWaypoint {
  lat:   number;
  lon:   number;
  label: string; // "01", "02" etc.
  name:  string;
}
export interface MapSegment {
  geojson: unknown;
  color?:  string;
}

interface Props {
  fromCoords: { lat: number; lon: number };
  toCoords:   { lat: number; lon: number };
  geojson?:   object;
  // multi-stop mode
  waypoints?: MapWaypoint[];
  segments?:  MapSegment[];
}

const COLORS = ['#3b82f6','#0ea5e9','#06b6d4','#10b981','#8b5cf6','#f59e0b','#ec4899','#22c55e'];

export default function MapView({ fromCoords, toCoords, geojson, waypoints, segments }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<Map | null>(null);
  const markersRef   = useRef<Marker[]>([]);

  useEffect(() => {
    async function init() {
      const mgl = (await import('maplibre-gl')).default as unknown as typeof import('maplibre-gl');
      if (!containerRef.current || mapRef.current) return;

      const isMulti    = waypoints && waypoints.length > 0;
      const centerLng  = (fromCoords.lon + toCoords.lon) / 2;
      const centerLat  = (fromCoords.lat + toCoords.lat) / 2;

      const map = new mgl.Map({
        container: containerRef.current,
        style:     'https://tiles.openfreemap.org/styles/liberty',
        center:    [centerLng, centerLat],
        zoom:      5,
      });
      mapRef.current = map;

      map.on('load', () => {
        /* ── Multi-stop mode ──────────────────────────────────────── */
        if (isMulti && segments && segments.length > 0) {
          segments.forEach((seg, i) => {
            const color    = seg.color ?? COLORS[i % COLORS.length];
            const sourceId = `seg-${i}`;
            map.addSource(sourceId, { type: 'geojson', data: seg.geojson as GeoJSON.FeatureCollection });
            map.addLayer({ id: `line-${i}`, type: 'line', source: sourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint:  { 'line-color': color, 'line-width': 4, 'line-opacity': 0.9 },
            });
          });
        } else if (geojson) {
          /* ── Single-route mode ─────────────────────────────────── */
          map.addSource('route', { type: 'geojson', data: geojson as GeoJSON.FeatureCollection });
          map.addLayer({ id: 'route-line', type: 'line', source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint:  { 'line-color': '#0ea5e9', 'line-width': 4, 'line-opacity': 0.9 },
          });
        }

        /* ── Markers ─────────────────────────────────────────────── */
        if (isMulti && waypoints) {
          waypoints.forEach((wp) => {
            const el = document.createElement('div');
            el.style.cssText = [
              'width:28px;height:28px;border-radius:50%',
              'background:#1d4ed8;border:2px solid #fff',
              'display:flex;align-items:center;justify-content:center',
              'font-size:11px;font-weight:700;color:#fff;font-family:monospace',
              'box-shadow:0 2px 8px rgba(0,0,0,.5);cursor:pointer',
            ].join(';');
            el.textContent = wp.label;
            const m = new mgl.Marker({ element: el })
              .setLngLat([wp.lon, wp.lat])
              .setPopup(new mgl.Popup({ offset: 16 }).setText(wp.name))
              .addTo(map);
            markersRef.current.push(m);
          });

          const lngs = waypoints.map((w) => w.lon);
          const lats = waypoints.map((w) => w.lat);
          map.fitBounds(
            new mgl.LngLatBounds([Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]),
            { padding: 60, maxZoom: 11 },
          );
        } else {
          // Single-route emoji markers
          const makeMarker = (emoji: string, label: string, coords: { lon: number; lat: number }) => {
            const el = document.createElement('div');
            el.innerHTML = emoji; el.style.fontSize = '24px';
            const m = new mgl.Marker({ element: el })
              .setLngLat([coords.lon, coords.lat])
              .setPopup(new mgl.Popup().setText(label))
              .addTo(map);
            markersRef.current.push(m);
          };
          makeMarker('🟢', 'Start',       fromCoords);
          makeMarker('🔴', 'Destination', toCoords);
          map.fitBounds(
            new mgl.LngLatBounds(
              [Math.min(fromCoords.lon, toCoords.lon), Math.min(fromCoords.lat, toCoords.lat)],
              [Math.max(fromCoords.lon, toCoords.lon), Math.max(fromCoords.lat, toCoords.lat)],
            ),
            { padding: 60, maxZoom: 12 },
          );
        }
      });
    }

    init();
    return () => { markersRef.current.forEach((m) => m.remove()); mapRef.current?.remove(); mapRef.current = null; };
  }, [fromCoords, toCoords, geojson, waypoints, segments]);

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" style={{ minHeight: 400 }} />;
}

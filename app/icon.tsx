import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/* ── Clean, hand-crafted plane icon — no AI imagery ────────────────────── */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #4f46e5 100%)',
          borderRadius: 8,
        }}
      >
        {/* Plane path as a simple polygon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="white"
        >
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

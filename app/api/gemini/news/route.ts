import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL = 'gemini-2.5-flash';
// v1beta endpoint works with standard API keys (free & paid)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(req: NextRequest) {
  try {
    const { destination, from, transport } = await req.json();

    const transportAlerts = transport === 'flight'
      ? 'Include: flight delays at departure/arrival airports, airport construction, airline strikes, weather-related disruptions.'
      : transport === 'train'
      ? 'Include: train delays on this route, track maintenance, station congestion, cancellations.'
      : 'Include: highway conditions, road closures, construction/diversions, toll updates, fuel availability.';

    const prompt = `You are a real-time travel intelligence system for India. Generate current, realistic travel alerts for a trip from "${from}" to "${destination}".

${transportAlerts}
Also include: weather warnings, local events/festivals causing crowds, health advisories, safety tips, cultural norms.

Output ONLY raw JSON, no markdown:
{"alerts":[{"type":"road_closure|flight_delay|train_incident|weather|event|safety|health|tip","severity":"high|medium|low|info","title":"Specific alert title","description":"Detailed description with actionable info (20-30 words)","icon":"relevant emoji","source":"Estimated source e.g. NHAI/AAI/IndianRailways"}],"summary":"2-sentence current travel conditions overview for this route","bestAdvice":"Single most important actionable tip right now"}

Rules: Generate exactly 6 alerts. Be specific to ${destination} and current season (March/April 2026). Prioritize high/medium severity first. No generic filler content.`;

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API ${res.status}`);
    }

    const data = await res.json();
    // gemini-2.5-flash returns multiple parts including thought tokens — skip those
    const parts: Array<{ text?: string; thought?: boolean }> =
      data?.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.filter((p) => !p.thought && typeof p.text === 'string').pop();
    const text: string = textPart?.text ?? '';

    // Robust JSON extraction
    let cleaned = text
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/\s*```\s*$/im, '')
      .trim();

    if (!cleaned.startsWith('{')) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) cleaned = match[0];
    }

    const newsData = JSON.parse(cleaned);
    return NextResponse.json(newsData);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Gemini news error:', msg);
    return NextResponse.json({ error: 'Failed to fetch travel news', detail: msg }, { status: 500 });
  }
}

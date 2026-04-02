import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL = 'gemini-2.5-flash';
// v1beta endpoint works with standard API keys (free & paid)
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// Retry helper — exponential backoff for 429 / quota errors
// ---------------------------------------------------------------------------
async function generateWithRetry(prompt: string, maxTokens = 4096, maxRetries = 3): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
            thinkingConfig: { thinkingBudget: 0 }, // disable thinking — saves tokens
          },
        }),
      });

      if (res.status === 429) {
        const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        console.warn(`Gemini 429 (attempt ${attempt + 1}). Retrying in ${delay}ms…`);
        lastError = new Error(`429 Too Many Requests`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      }

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini API ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      // gemini-2.5-flash returns multiple parts: thought parts (ignored) + the actual answer
      const parts: Array<{ text?: string; thought?: boolean }> =
        data?.candidates?.[0]?.content?.parts ?? [];
      const textPart = parts.filter((p) => !p.thought && typeof p.text === 'string').pop();
      const text: string = textPart?.text ?? '';
      return text.trim();
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        msg.includes('429') ||
        msg.toLowerCase().includes('quota') ||
        msg.toLowerCase().includes('too many') ||
        msg.toLowerCase().includes('resource_exhausted');

      if (isRateLimit && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.warn(`Gemini rate limit (attempt ${attempt + 1}). Retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// POST /api/gemini
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      prompt: rawPrompt,
      from,
      to,
      startDate,
      endDate,
      budget,
      currency = 'INR',
      travelers = 1,
      preferences = [],
      transport = 'driving-car',
      distance,
      duration,
    } = body;

    // Compute days outside if/else so it's available for token budget
    const days =
      startDate && endDate
        ? Math.max(
            1,
            Math.ceil(
              (new Date(endDate).getTime() - new Date(startDate).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 3;

    let prompt: string;

    if (rawPrompt) {
      prompt = rawPrompt;
    } else {
      const preference_str =
        preferences.length > 0 ? preferences.join(', ') : 'general sightseeing';

      // Transport-aware, cost-accurate, mixed-mode-informed prompt
      const transportContext = transport === 'flight'
        ? `FLIGHT TRIP: Day 1 morning = airport departure (include airport name, terminal, check-in time). Activities = city sightseeing near destination airport. No road driving distances. Include cab/auto costs from airport.`
        : transport === 'train'
        ? `TRAIN TRIP: Day 1 = board train at source station, arrive destination station. Include train journey in Day 1 theme/activities. Note if direct train exists or need connecting routes.`
        : `ROAD TRIP: Include driving segments, rest stops, scenic routes, highway dhaba meals where relevant.`;

      const mixedModeNote = `IMPORTANT: Some Indian regions have NO railway (Meghalaya, Andaman, Lakshadweep, remote NE states). If destination lacks railway, use road/flight only. If certain roads are seasonal (Ladakh, Spiti), note alternatives. Always use realistically available transport for the region.`;

      const costNote = `CRITICAL: Every estimatedCost and cost field MUST be a realistic non-zero number in ${currency}. Use Indian market rates: budget hotel ₹800-2000/night, mid-range ₹2000-5000, luxury ₹5000+. Meals: breakfast ₹100-300, lunch ₹200-500, dinner ₹300-800. Auto/cab: ₹100-500. Entry fees: ₹50-500. Never output 0 for any cost unless the activity is genuinely free (e.g. beach walk) — then write 0 only for that item. All costs per person unless noted.`;

      prompt = `You are an expert Indian travel planner. Generate a detailed, realistic travel itinerary. Output ONLY raw JSON, no markdown, no explanation.

TRIP DETAILS:
From: ${from}
To: ${to}
Transport Mode: ${transport.replace(/-/g,' ')}
Days: ${days} | Budget: ${budget} ${currency} total | Travelers: ${travelers}
Start Date: ${startDate || 'flexible'} | End Date: ${endDate || 'flexible'}
Distance: ${distance ? (distance/1000).toFixed(0)+'km' : 'unknown'} | Travel Time: ${duration ? Math.round(duration/60)+'min' : 'unknown'}
Preferences: ${preference_str}

${transportContext}
${mixedModeNote}
${costNote}

OUTPUT SCHEMA (exactly this structure, ${days} day entries):
{"summary":"2-sentence trip overview","bestTimeToVisit":"best season and why","days":[{"day":1,"date":"YYYY-MM-DD","theme":"Day theme title","morning":{"activity":"specific place/activity name","description":"what to do, see, experience (25 words)","estimatedCost":500,"duration":"2 hrs"},"afternoon":{"activity":"str","description":"str","estimatedCost":300,"duration":"str"},"evening":{"activity":"str","description":"str","estimatedCost":200,"duration":"str"},"food":[{"meal":"Breakfast","suggestion":"specific restaurant or food type","cost":200},{"meal":"Lunch","suggestion":"str","cost":350},{"meal":"Dinner","suggestion":"str","cost":500}],"accommodation":{"name":"specific hotel/guesthouse name or type","type":"budget|mid-range|luxury","cost":1500},"tips":["practical tip 1","practical tip 2"]}],"budgetBreakdown":{"transport":5000,"accommodation":10000,"food":6000,"activities":3000,"shopping":2000,"miscellaneous":1500,"total":27500},"packingList":["item1","item2"],"localTips":["insider tip 1","insider tip 2"]}

Generate exactly ${days} days. All monetary values in ${currency}. Make activities specific to real places in ${to}. Ensure budgetBreakdown.total = sum of all categories.`;

    }

    // Dynamic token budget: ~800 tokens/day for rich detailed itineraries, min 3000, max 8192
    const tokenBudget = rawPrompt ? 2048 : Math.min(8192, Math.max(3000, days * 800));
    const text = await generateWithRetry(prompt, tokenBudget);

    // Raw prompt → return plain text
    if (rawPrompt) {
      return NextResponse.json({ result: text });
    }

    // Strip markdown fences and extract first JSON object (robust for gemini-2.5)
    let cleaned = text
      .replace(/^```json\s*/im, '')
      .replace(/^```\s*/im, '')
      .replace(/\s*```\s*$/im, '')
      .trim();

    // Fallback: extract the first {...} block if the above didn't fully clean it
    if (!cleaned.startsWith('{')) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) cleaned = match[0];
    }

    let itinerary;
    try {
      itinerary = JSON.parse(cleaned);
    } catch {
      console.error('Gemini non-JSON response (first 500 chars):', cleaned.slice(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse AI response', hint: 'Model returned non-JSON', raw: cleaned.slice(0, 300) },
        { status: 500 }
      );
    }

    return NextResponse.json({ itinerary });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Gemini API error:', msg);

    const isRateLimit =
      msg.includes('429') ||
      msg.toLowerCase().includes('quota') ||
      msg.toLowerCase().includes('too many') ||
      msg.toLowerCase().includes('resource_exhausted');

    if (isRateLimit) {
      return NextResponse.json(
        { error: 'Gemini rate limit reached after retries. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate itinerary', detail: msg },
      { status: 500 }
    );
  }
}

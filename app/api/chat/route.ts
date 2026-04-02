/**
 * POST /api/chat
 *
 * Stateless multi-turn conversational AI for itinerary refinement.
 *
 * Uses the same model + config as /api/gemini (gemini-2.5-flash with thinkingBudget:0)
 * which is proven to work. Conversation history is passed from the client on every
 * request — no MongoDB ChatSession dependency, so no DB auth failures.
 *
 * When tripId is provided and the AI produces an itinerary update, the saved
 * Trip document in MongoDB is also updated (best-effort, non-blocking).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/authOptions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
// Use the SAME model+endpoint that works for itinerary generation
const MODEL      = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/* ── System prompt (injected as first user turn) ─────────────────────────── */
const SYSTEM_PROMPT = `You are TravelAI — a warm, expert travel planner helping a user refine their AI-generated trip itinerary.

STRICT RULES:
1. Be enthusiastic, friendly, and specific. Use 1-2 emojis per response.
2. For ITINERARY CHANGE requests ("make day 1 adventurous", "change hotel", "add food stop"):
   - Write a brief explanation (2-3 sentences) of what you changed.
   - Then output the COMPLETE updated itinerary as a JSON code block (schema below).
   - Include ALL days — never omit or truncate any day.
   - Keep costs realistic in the trip's currency.
3. For GENERAL QUESTIONS (packing, restaurants, weather, tips, what to see):
   - Answer conversationally with specific, practical information. No JSON needed.
   - Give real recommendations for the specific destination.
4. NEVER refuse or say "I cannot". Always give your best answer.
5. For packing questions: give a detailed, categorised packing list tailored to the destination and season.

ITINERARY JSON SCHEMA (when updating):
\`\`\`json
{
  "summary": "string",
  "days": [{ "day": 1, "date": "YYYY-MM-DD", "theme": "string",
    "morning":   { "activity": "string", "description": "string", "estimatedCost": 0, "duration": "string" },
    "afternoon": { "activity": "string", "description": "string", "estimatedCost": 0, "duration": "string" },
    "evening":   { "activity": "string", "description": "string", "estimatedCost": 0, "duration": "string" },
    "food": [{ "meal": "string", "suggestion": "string", "cost": 0 }],
    "accommodation": { "name": "string", "type": "string", "cost": 0 },
    "tips": ["string"] }],
  "budgetBreakdown": { "transport": 0, "accommodation": 0, "food": 0, "activities": 0, "shopping": 0, "miscellaneous": 0, "total": 0 },
  "packingList": ["string"],
  "localTips": ["string"],
  "bestTimeToVisit": "string"
}
\`\`\``;

/* ── Call Gemini (same config as /api/gemini route) ──────────────────────── */
async function callGemini(
  contents: { role: string; parts: { text: string }[] }[],
): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature:     0.6,
        maxOutputTokens: 8192,
        thinkingConfig:  { thinkingBudget: 0 },  // same as working itinerary route
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts: Array<{ text?: string; thought?: boolean }> =
    data?.candidates?.[0]?.content?.parts ?? [];

  const text = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text!)
    .join('');

  if (!text.trim()) {
    const reason = data?.candidates?.[0]?.finishReason ?? 'unknown';
    throw new Error(`Empty Gemini response (finishReason: ${reason})`);
  }

  return text;
}

/* ── Route handler ───────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  // Auth guard
  const authSession = await getServerSession(authOptions);
  if (!authSession?.user) {
    return NextResponse.json(
      { error: 'Please sign in to use the AI chat feature.' },
      { status: 401 },
    );
  }

  try {
    const {
      userMessage,
      currentItinerary,
      tripContext,
      history = [],     // array of { role, text } from client
      tripId,
    } = await req.json() as {
      userMessage:      string;
      currentItinerary: unknown;
      tripContext:      Record<string, unknown>;
      history:          Array<{ role: 'user' | 'assistant'; text: string }>;
      tripId?:          string | null;
    };

    if (!userMessage?.trim()) {
      return NextResponse.json({ error: 'userMessage is required.' }, { status: 400 });
    }

    // ── Build Gemini contents array ──────────────────────────────────────
    // First turn: system primer + itinerary context
    const systemInit = `${SYSTEM_PROMPT}

═══════════════════════════════════════
TRIP DETAILS
═══════════════════════════════════════
From:        ${tripContext?.from ?? 'Unknown'}
To:          ${tripContext?.to   ?? 'Unknown'}
Transport:   ${tripContext?.transport ?? 'Unknown'}
Budget:      ${tripContext?.budget ?? 'Not specified'} ${tripContext?.currency ?? 'INR'}
Travelers:   ${tripContext?.travelers ?? 1} person(s)
Dates:       ${tripContext?.startDate ?? 'flexible'} → ${tripContext?.endDate ?? 'flexible'}
Preferences: ${(tripContext?.preferences as string[] ?? []).join(', ') || 'general sightseeing'}

═══════════════════════════════════════
CURRENT ITINERARY (JSON)
═══════════════════════════════════════
${JSON.stringify(currentItinerary, null, 2)}`;

    const welcomeReply = `Hi! 👋 I've loaded your full itinerary for **${tripContext?.from ?? ''}** → **${tripContext?.to ?? ''}**. I can see all your plans, budget, and preferences. How can I help you refine this trip?`;

    // Build the full conversation: system context + prior history + current message
    const contents: { role: string; parts: { text: string }[] }[] = [
      { role: 'user',  parts: [{ text: systemInit }] },
      { role: 'model', parts: [{ text: welcomeReply }] },
      // Prior conversation turns
      ...history.map((m) => ({
        role:  m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      })),
      // Current user message
      { role: 'user', parts: [{ text: userMessage.trim() }] },
    ];

    // ── Call Gemini ──────────────────────────────────────────────────────
    const rawText = await callGemini(contents);

    // ── Extract updated itinerary from ```json block ─────────────────────
    let updatedItinerary: unknown = null;
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        updatedItinerary = JSON.parse(jsonMatch[1]);
      } catch {
        console.warn('[Chat] Could not parse JSON from AI response');
      }
    }

    // Strip JSON block from the display reply
    const displayReply = rawText
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .trim() || "I've updated your itinerary — take a look! ✨";

    // ── Best-effort: update the saved Trip document when itinerary changed ─
    if (updatedItinerary && tripId) {
      try {
        const { default: dbConnect } = await import('@/lib/mongodb');
        const { default: Trip }      = await import('@/lib/models/Trip');
        await dbConnect();
        const userId = (authSession.user as { userId?: string }).userId;
        if (userId) {
          await Trip.findOneAndUpdate(
            { _id: tripId, userId },
            { $set: { itineraryData: updatedItinerary } },
          );
        }
      } catch (dbErr) {
        // Non-fatal — log and continue
        console.warn('[Chat] DB update skipped:', dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }

    return NextResponse.json({
      reply:            displayReply,
      updatedItinerary: updatedItinerary ?? null,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/chat] error:', msg);
    return NextResponse.json({ error: `AI chat failed: ${msg}` }, { status: 500 });
  }
}

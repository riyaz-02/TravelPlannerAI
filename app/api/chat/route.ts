/**
 * POST /api/chat
 *
 * Multi-turn conversational AI for itinerary refinement.
 *
 * Architecture:
 * - Requires authentication (sign-in enforced server-side).
 * - On first call, creates a ChatSession in MongoDB seeded with a system
 *   primer containing the full trip context + current itinerary JSON.
 * - On every subsequent call, the full message history is replayed in the
 *   Gemini `contents` array so the model has complete conversational memory.
 * - If the AI response contains a ```json block, the updated itinerary is
 *   parsed and returned separately so the UI can hot-swap the ItineraryCard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }          from 'next-auth';
import { authOptions }               from '@/lib/authOptions';
import dbConnect                     from '@/lib/mongodb';
import ChatSession                   from '@/lib/models/ChatSession';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const MODEL          = 'gemini-2.5-flash';
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── System primer injected as the very first exchange ─────────────────────────
const SYSTEM_PROMPT = `You are an expert AI travel planner helping a user refine their trip itinerary through conversation.

RULES:
1. When the user requests itinerary changes, ALWAYS respond with:
   a) A brief friendly explanation (1-2 sentences describing what you changed).
   b) The COMPLETE updated itinerary as a JSON code block using the EXACT same schema.
2. If the user asks a general question (best restaurants, packing tips, etc.), answer conversationally — no JSON needed.
3. Keep ALL monetary values realistic and in the trip's currency.
4. Preserve every day that is NOT modified.
5. Never truncate the itinerary JSON — include all days.
6. ALWAYS wrap JSON in a \`\`\`json ... \`\`\` block.`;

// ── Helpers ───────────────────────────────────────────────────────────────────
interface GeminiPart { text?: string; thought?: boolean }

async function callGemini(
  contents: { role: string; parts: { text: string }[] }[],
): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature:     0.4,
        maxOutputTokens: 8192,
        thinkingConfig:  { thinkingBudget: 0 },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err}`);
  }

  const data  = await res.json();
  const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text!)
    .join('');
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth guard — chat requires sign-in
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Please sign in to use the AI chat feature.' },
      { status: 401 },
    );
  }
  const userId = (session.user as { userId?: string }).userId ?? null;

  try {
    const { sessionId, userMessage, currentItinerary, tripContext } =
      await req.json();

    if (!sessionId || !userMessage?.trim()) {
      return NextResponse.json(
        { error: 'sessionId and userMessage are required.' },
        { status: 400 },
      );
    }

    await dbConnect();

    // ── Load or create ChatSession ────────────────────────────────────────────
    let chatSession = await ChatSession.findOne({ sessionId });

    if (!chatSession) {
      // Build a rich system context for the first exchange
      const systemInit = `${SYSTEM_PROMPT}

═══ TRIP DETAILS ═══
From:        ${tripContext?.from ?? 'Unknown'}
To:          ${tripContext?.to  ?? 'Unknown'}
Transport:   ${tripContext?.transport ?? 'Unknown'}
Budget:      ${tripContext?.budget ?? 'Unknown'} ${tripContext?.currency ?? 'INR'}
Travelers:   ${tripContext?.travelers ?? 1}
Dates:       ${tripContext?.startDate ?? 'flexible'} → ${tripContext?.endDate ?? 'flexible'}
Preferences: ${(tripContext?.preferences ?? []).join(', ') || 'general sightseeing'}

═══ CURRENT ITINERARY (JSON) ═══
${JSON.stringify(currentItinerary, null, 2)}

I've loaded the full trip context and itinerary. I'm ready to help you refine the plan — what would you like to change?`;

      // Seed session with the primer exchange (counts as first turn)
      chatSession = await ChatSession.create({
        sessionId,
        userId,
        currentItinerary,
        tripContext,
        messages: [
          { role: 'user',  parts: [{ text: systemInit }] },
          { role: 'model', parts: [{ text: "I've loaded the full trip context and itinerary. I'm ready to help you refine the plan — what would you like to change?" }] },
        ],
      });
    }

    // ── Append user message ───────────────────────────────────────────────────
    chatSession.messages.push({
      role:      'user',
      parts:     [{ text: userMessage.trim() }],
      timestamp: new Date(),
    });

    // ── Build Gemini contents from full history ───────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents = chatSession.messages.map((m: any) => ({
      role:  m.role,
      parts: m.parts,
    }));

    // ── Call Gemini ───────────────────────────────────────────────────────────
    const rawText = await callGemini(contents);

    // ── Try to extract updated itinerary from JSON code block ─────────────────
    let updatedItinerary: unknown = undefined;
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        updatedItinerary = JSON.parse(jsonMatch[1]);
        chatSession.currentItinerary = updatedItinerary;
      } catch {
        // Model produced malformed JSON — ignore, show text only
      }
    }

    // Strip JSON block from the display reply
    const displayReply = rawText
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .trim() || "I've updated your itinerary — check it above!";

    // ── Persist AI response ───────────────────────────────────────────────────
    chatSession.messages.push({
      role:      'model',
      parts:     [{ text: rawText }],
      timestamp: new Date(),
    });
    await chatSession.save();

    return NextResponse.json({
      reply:            displayReply,
      updatedItinerary: updatedItinerary ?? null,
      messageCount:     chatSession.messages.length,
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json(
      { error: 'Failed to process message. Please try again.' },
      { status: 500 },
    );
  }
}

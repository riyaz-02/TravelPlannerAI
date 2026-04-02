import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import dbConnect from '@/lib/mongodb';
import Trip from '@/lib/models/Trip';

/* ── GET /api/trips — fetch user's saved trips ──────────────────────────── */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { userId?: string }).userId;
  if (!userId) return NextResponse.json({ trips: [] });

  await dbConnect();
  const url    = new URL(req.url);
  const limit  = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const trips  = await Trip.find({ userId }).sort({ createdAt: -1 }).limit(limit);
  return NextResponse.json({ trips });
}

/* ── POST /api/trips — create (or upsert) a trip ────────────────────────── */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { userId?: string }).userId;
  if (!userId) return NextResponse.json({ error: 'User ID not found' }, { status: 400 });

  try {
    const body = await req.json();

    // Auto-generate a human-readable title if not provided
    const title = body.title || `${String(body.from ?? '').split(',')[0]} → ${String(body.to ?? '').split(',')[0]}`;

    await dbConnect();
    const trip = await Trip.create({ ...body, userId, title });
    return NextResponse.json({ tripId: trip._id.toString(), trip }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/trips] error:', err);
    return NextResponse.json({ error: 'Failed to save trip' }, { status: 500 });
  }
}

/* ── DELETE /api/trips?id=:id — delete a trip ───────────────────────────── */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { userId?: string }).userId;
  const url    = new URL(req.url);
  const id     = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Trip id required' }, { status: 400 });

  await dbConnect();
  const result = await Trip.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

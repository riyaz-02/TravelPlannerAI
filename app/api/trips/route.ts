import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/authOptions';
import dbConnect            from '@/lib/mongodb';
import Trip                 from '@/lib/models/Trip';

/* helper: get userId OR email from session as a stable identifier */
function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user) return null;
  const u = session.user as { userId?: string; email?: string };
  return u.userId ?? u.email ?? null;
}

/* ── GET /api/trips ─────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = getUserId(session);

  if (!session?.user || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const url   = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);
    const trips = await Trip.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
    return NextResponse.json({ trips });
  } catch (err) {
    console.error('[GET /api/trips]', err);
    return NextResponse.json({ error: 'Failed to fetch trips', trips: [] }, { status: 500 });
  }
}

/* ── POST /api/trips ────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = getUserId(session);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found — please sign out and sign back in.' }, { status: 400 });
  }

  try {
    const body = await req.json();

    if (!body.from || !body.to) {
      return NextResponse.json({ error: 'from and to are required fields.' }, { status: 400 });
    }

    const title =
      body.title ||
      `${String(body.from).split(',')[0].trim()} → ${String(body.to).split(',')[0].trim()}`;

    await dbConnect();

    const trip = await Trip.create({
      userId,
      title,
      from:          body.from,
      to:            body.to,
      fromCoords:    body.fromCoords  ?? undefined,
      toCoords:      body.toCoords    ?? undefined,
      transport:     body.transport   ?? 'driving-car',
      startDate:     body.startDate   ? new Date(body.startDate) : undefined,
      endDate:       body.endDate     ? new Date(body.endDate)   : undefined,
      budget:        body.budget      ? Number(body.budget)      : undefined,
      currency:      body.currency    ?? 'INR',
      travelers:     body.travelers   ?? 1,
      preferences:   body.preferences ?? [],
      itineraryData: body.itineraryData ?? undefined,
      routeData:     body.routeData     ?? undefined,
      weatherData:   body.weatherData   ?? undefined,
      newsData:      body.newsData      ?? undefined,
    });

    return NextResponse.json(
      { tripId: trip._id.toString(), message: 'Trip saved successfully.' },
      { status: 201 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[POST /api/trips]', msg);
    return NextResponse.json({ error: `Failed to save trip: ${msg}` }, { status: 500 });
  }
}

/* ── DELETE /api/trips?id=:id ───────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = getUserId(session);

  if (!session?.user || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Trip id required.' }, { status: 400 });

  try {
    await dbConnect();
    const result = await Trip.deleteOne({ _id: id, userId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Trip not found or not yours.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/trips]', err);
    return NextResponse.json({ error: 'Failed to delete trip.' }, { status: 500 });
  }
}

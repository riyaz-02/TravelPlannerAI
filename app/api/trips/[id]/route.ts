import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions }      from '@/lib/authOptions';
import dbConnect            from '@/lib/mongodb';
import Trip                 from '@/lib/models/Trip';

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user) return null;
  const u = session.user as { userId?: string; email?: string };
  return u.userId ?? u.email ?? null;
}

/* ── GET /api/trips/[id] ─────────────────────────────────────────────────── */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  const userId  = getUserId(session);

  if (!session?.user || !userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await dbConnect();
    const trip = await Trip.findOne({ _id: params.id, userId }).lean();
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
    }
    return NextResponse.json({ trip });
  } catch (err) {
    console.error('[GET /api/trips/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch trip.' }, { status: 500 });
  }
}

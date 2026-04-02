/**
 * GET /api/analytics
 *
 * Returns aggregated travel statistics for the authenticated user.
 *
 * Uses three MongoDB aggregation pipelines:
 *   1. Destination breakdown — visit counts, avg budget, total km per city.
 *   2. Monthly frequency    — trips per calendar month (Jan–Dec).
 *   3. Aggregate stats      — totals for the stat cards row.
 *
 * Also returns recent trips (table) and budget trend (line chart).
 *
 * Academic note: MongoDB aggregation pipelines are server-side data
 * processing constructs equivalent to SQL GROUP BY + aggregate functions,
 * computed entirely within the database engine for maximum efficiency.
 */

import { NextResponse }      from 'next/server';
import { getServerSession }  from 'next-auth';
import { authOptions }       from '@/lib/authOptions';
import dbConnect             from '@/lib/mongodb';
import Trip                  from '@/lib/models/Trip';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { userId?: string }).userId;
  if (!userId) {
    return NextResponse.json({ error: 'User not found' }, { status: 400 });
  }

  await dbConnect();

  // ── Pipeline 1: Top destinations ─────────────────────────────────────────────
  // Groups all trips by destination, counts visits, sums/averages budget and km.
  const destinations = await Trip.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id:       '$to',
        visits:    { $sum: 1 },
        avgBudget: { $avg: '$budget' },
        totalKmRaw:{ $sum: { $ifNull: ['$routeData.distance', 0] } },
      },
    },
    { $sort: { visits: -1 } },
    { $limit: 8 },
    {
      $project: {
        _id: 0,
        // Extract city name before first comma (e.g. "Goa, India" → "Goa")
        destination: {
          $trim: {
            input: { $arrayElemAt: [{ $split: ['$_id', ','] }, 0] },
          },
        },
        visits:    1,
        avgBudget: { $round: ['$avgBudget', 0] },
        totalKm:   { $round: [{ $divide: ['$totalKmRaw', 1000] }, 1] },
      },
    },
  ]);

  // ── Pipeline 2: Monthly trip frequency ───────────────────────────────────────
  // Groups trips by calendar month using $month operator on startDate.
  const monthlyRaw = await Trip.aggregate([
    { $match: { userId, startDate: { $exists: true, $ne: null } } },
    {
      $group: {
        _id:       { $month: '$startDate' },
        count:     { $sum: 1 },
        avgBudget: { $avg: '$budget' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Merge into a full 12-month array (months with no trips → 0)
  const monthly = MONTHS.map((month, i) => {
    const found = monthlyRaw.find((r: { _id: number }) => r._id === i + 1);
    return {
      month,
      trips:     found?.count     ?? 0,
      avgBudget: found?.avgBudget ? Math.round(found.avgBudget) : 0,
    };
  });

  // ── Pipeline 3: Aggregate stats (for stat cards) ──────────────────────────────
  const statsRaw = await Trip.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id:              null,
        totalTrips:       { $sum: 1 },
        totalKmRaw:       { $sum: { $ifNull: ['$routeData.distance', 0] } },
        avgBudget:        { $avg: '$budget' },
        totalSpend:       { $sum: '$budget' },
        uniqueDests:      { $addToSet: '$to' },
      },
    },
    {
      $project: {
        _id:               0,
        totalTrips:        1,
        totalKm:           { $round: [{ $divide: ['$totalKmRaw', 1000] }, 0] },
        avgBudget:         { $round: ['$avgBudget', 0] },
        totalSpend:        { $round: ['$totalSpend', 0] },
        uniqueDestinations:{ $size: '$uniqueDests' },
      },
    },
  ]);

  const stats = statsRaw[0] ?? {
    totalTrips: 0, totalKm: 0, avgBudget: 0,
    totalSpend: 0, uniqueDestinations: 0,
  };

  // ── Recent trips table ────────────────────────────────────────────────────────
  const recentTrips = await Trip.find({ userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('from to budget currency startDate endDate transport routeData createdAt')
    .lean();

  // ── Budget trend line chart (last 10 trips chronological) ────────────────────
  const budgetTrend = (
    await Trip.find({ userId, budget: { $exists: true, $gt: 0 } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('from to budget currency createdAt')
      .lean()
  ).reverse();

  return NextResponse.json({ stats, destinations, monthly, recentTrips, budgetTrend });
}

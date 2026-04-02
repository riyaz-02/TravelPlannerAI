import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') ?? 'travel';

    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ articles: [] });
    }

    // GNews free tier: lang, max, q, token — keep it simple
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=6&token=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      console.error('GNews error:', response.status, errText);
      // Return empty array gracefully — news is non-critical
      return NextResponse.json({ articles: [] });
    }

    const data = await response.json();
    return NextResponse.json({ articles: data.articles ?? [] });
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({ articles: [] });
  }
}

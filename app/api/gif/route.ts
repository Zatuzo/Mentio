import { NextResponse } from 'next/server';

export interface GifResult {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  w: number;
  h: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const limit = Math.min(Number(searchParams.get('limit') ?? '24'), 50);

  if (!q.trim()) return NextResponse.json({ results: [] });

  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GIPHY_API_KEY not configured' }, { status: 503 });
  }

  const url = new URL('https://api.giphy.com/v1/gifs/search');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('rating', 'pg-13');
  url.searchParams.set('lang', 'id');

  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) return NextResponse.json({ error: 'Giphy API error' }, { status: 502 });

  const data = await res.json();

  const MAX_W = 320;
  const results: GifResult[] = (data.data ?? []).flatMap((item: any) => {
    const orig = item.images?.original;
    const preview = item.images?.fixed_width_small ?? item.images?.fixed_width ?? orig;
    if (!orig?.url) return [];

    const origW = Number(orig.width) || 320;
    const origH = Number(orig.height) || 240;
    const displayW = Math.min(origW, MAX_W);
    const displayH = Math.round((origH / origW) * displayW);

    return [{
      id: item.id,
      title: item.title || item.id,
      url: orig.url,
      previewUrl: preview?.url ?? orig.url,
      w: displayW,
      h: displayH,
    }];
  });

  return NextResponse.json({ results });
}

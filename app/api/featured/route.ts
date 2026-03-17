import { NextResponse } from 'next/server';
import { listFamousTombs } from '../../../lib/data';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') ?? '18');
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(60, Math.floor(limitParam))) : 18;
  const tombs = await listFamousTombs({ limit });
  const payload = tombs
    .map((tomb) => ({
      id: tomb.id,
      name: tomb.name,
      person: tomb.person,
      era: tomb.era,
      level: tomb.level,
      coverUrl: tomb.image_urls?.find(Boolean) ?? null
    }))
    .filter((tomb) => Boolean(tomb.coverUrl));

  return NextResponse.json(
    { tombs: payload },
    {
      headers: {
        // Allow fast reloads while still refreshing periodically.
        'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
      }
    }
  );
}

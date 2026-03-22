import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const cache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24小时

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return new NextResponse(cached.buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  try {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
    }

    const buffer = await response.arrayBuffer();
    const metadata = await sharp(buffer).metadata();

    const croppedBuffer = await sharp(buffer)
      .extract({
        left: 0,
        top: 0,
        width: metadata.width!,
        height: Math.floor(metadata.height! * 0.85)
      })
      .toBuffer();

    cache.set(url, { buffer: croppedBuffer, timestamp: Date.now() });

    return new NextResponse(croppedBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}

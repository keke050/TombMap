import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(url);
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

    return new NextResponse(croppedBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}

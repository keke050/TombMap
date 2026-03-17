'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TombDetail } from '../lib/types';

type AutoImageProps = {
  images?: TombDetail['images'];
  alt: string;
  className?: string;
};

export default function AutoImage({ images, alt, className }: AutoImageProps) {
  const [index, setIndex] = useState(0);
  const list = useMemo(
    () => (images ?? []).filter((item): item is { url: string; source: string } => Boolean(item?.url)),
    [images]
  );
  const listKey = list.map((item) => item.url).join('|');

  useEffect(() => {
    setIndex(0);
  }, [listKey, alt]);

  const image = index < list.length ? list[index] : null;
  if (!image) return null;

  return (
    <div className={className}>
      <img
        src={image.url}
        alt={alt}
        style={{ width: '100%', height: 'auto' }}
        onError={() => setIndex((prev) => (prev + 1 < list.length ? prev + 1 : list.length))}
      />
    </div>
  );
}

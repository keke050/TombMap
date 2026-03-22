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
  const hasMultiple = list.length > 1;

  const handlePrev = () => {
    setIndex((prev) => (prev - 1 + list.length) % list.length);
  };

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % list.length);
  };

  const proxyUrl = (url: string) => {
    const filename = url.split('/').pop();
    return `https://tombimage-1412507290.cos.ap-shanghai.myqcloud.com/${filename}`;
  };

  return (
    <div className={`${className ?? ''} auto-image`.trim()}>
      <div className="auto-image-stage">
        <img
          src={proxyUrl(image.url)}
          alt={`${alt}${hasMultiple ? `（${index + 1}/${list.length}）` : ''}`}
          style={{ width: '100%', height: 'auto' }}
          onError={() => setIndex((prev) => (prev + 1 < list.length ? prev + 1 : list.length))}
        />
        {hasMultiple ? (
          <>
            <button className="auto-image-nav auto-image-nav--prev" type="button" onClick={handlePrev} aria-label="上一张">
              ‹
            </button>
            <button className="auto-image-nav auto-image-nav--next" type="button" onClick={handleNext} aria-label="下一张">
              ›
            </button>
            <div className="auto-image-counter">
              {index + 1} / {list.length}
            </div>
          </>
        ) : null}
      </div>

      {hasMultiple ? (
        <div className="auto-image-thumbs" role="tablist" aria-label={`${alt} 图片列表`}>
          {list.map((item, itemIndex) => (
            <button
              key={`${item.url}-${itemIndex}`}
              type="button"
              className={`auto-image-thumb${itemIndex === index ? ' active' : ''}`}
              onClick={() => setIndex(itemIndex)}
              aria-label={`查看第 ${itemIndex + 1} 张图片`}
              aria-pressed={itemIndex === index}
            >
              <img src={proxyUrl(item.url)} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

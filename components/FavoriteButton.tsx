'use client';

import { useCallback, useEffect, useState } from 'react';

export default function FavoriteButton({ tombId }: { tombId: string }) {
  const [favorited, setFavorited] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/tombs/${tombId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setFavorited(Boolean(data?.tomb?.favorited));
          setLoaded(true);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tombId]);

  const handleToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tombs/${tombId}/favorite`, { method: 'POST' });
      if (!res.ok) return;
      const data = await res.json();
      setFavorited(Boolean(data?.favorited));
    } finally {
      setBusy(false);
    }
  }, [busy, tombId]);

  const label = favorited ? '已收藏' : '收藏';
  return (
    <button className="ghost-button" onClick={handleToggle} disabled={!loaded || busy}>
      {busy ? '处理中…' : label}
    </button>
  );
}


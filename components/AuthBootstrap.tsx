'use client';

import { useEffect } from 'react';

export default function AuthBootstrap() {
  useEffect(() => {
    fetch('/api/auth/guest', { method: 'POST' }).catch(() => null);
  }, []);

  return null;
}


'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '../lib/types';
import { clearGuestCache, ensureGuestUser } from '../lib/clientSession';
import UserMenu from './UserMenu';

export default function UserMenuGate() {
  const [user, setUser] = useState<UserProfile | null>(null);

  const loadUser = useCallback(async () => {
    const next = await ensureGuestUser();
    if (next) setUser(next);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
    clearGuestCache();
    await loadUser();
  }, [loadUser]);

  return <UserMenu user={user} onLogout={handleLogout} />;
}

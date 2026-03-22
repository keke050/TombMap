'use client';

import type { UserProfile } from './types';

let guestPromise: Promise<UserProfile | null> | null = null;
let cachedUser: UserProfile | null = null;

export const clearGuestCache = () => {
  guestPromise = null;
  cachedUser = null;
};

export const ensureGuestUser = async (): Promise<UserProfile | null> => {
  if (cachedUser) return cachedUser;
  if (!guestPromise) {
    guestPromise = fetch('/api/auth/guest', { method: 'POST' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => (data?.user ? (data.user as UserProfile) : null))
      .catch(() => null);
  }
  cachedUser = await guestPromise;
  return cachedUser;
};


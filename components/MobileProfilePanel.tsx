'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserProfile } from '../lib/types';
import { clearGuestCache, ensureGuestUser } from '../lib/clientSession';

type MobileProfilePanelProps = {
  /** Called when the user logs out to refresh the gate in MapShell */
  onUserChange?: () => void;
};

export default function MobileProfilePanel({ onUserChange }: MobileProfilePanelProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setLoading(true);
    const next = await ensureGuestUser();
    setUser(next ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const avatar = useMemo(() => {
    const url = user?.avatarUrl?.trim();
    if (url) return { type: 'img' as const, url };
    return { type: 'placeholder' as const };
  }, [user?.avatarUrl, user?.label]);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
    clearGuestCache();
    await loadUser();
    onUserChange?.();
  }, [loadUser, onUserChange]);

  return (
    <div className="mobile-profile">
      <section className="panel mobile-profile-card" aria-label="个人信息">
        <div className="mobile-profile-header">
          <div className="mobile-profile-avatar">
            {avatar.type === 'img' ? (
              <Image src={avatar.url} alt={user?.label ?? '头像'} width={56} height={56} />
            ) : (
              <div className="mobile-profile-avatar-placeholder">
                <svg viewBox="0 0 24 24" width="28" height="28" focusable="false" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 12.2a4.3 4.3 0 1 0-4.3-4.3A4.3 4.3 0 0 0 12 12.2Zm0 1.8c-4.4 0-8 2.2-8 4.9 0 .7.6 1.1 1.3 1.1h13.4c.7 0 1.3-.4 1.3-1.1 0-2.7-3.6-4.9-8-4.9Z"
                  />
                </svg>
              </div>
            )}
          </div>
          <div className="mobile-profile-info">
            {loading ? (
              <div className="mobile-profile-name mobile-profile-skeleton" />
            ) : (
              <div className="mobile-profile-name">{user?.label ?? '游客'}</div>
            )}
            {loading ? (
              <div className="mobile-profile-badge mobile-profile-skeleton" />
            ) : (
              <div className="mobile-profile-badge">{user?.isGuest ? '游客' : (user?.email ?? '邮箱用户')}</div>
            )}
          </div>
        </div>

        {user?.isGuest ? (
          <div className="mobile-profile-guest">
            <Link className="primary-button primary-button--jade" href="/login" style={{ textAlign: 'center' }}>
              登录 / 注册
            </Link>
            <Link className="ghost-button" href="/invite" style={{ textAlign: 'center' }}>
              邀请码登录
            </Link>
          </div>
        ) : (
          <button className="ghost-button mobile-profile-logout" onClick={handleLogout}>
            退出登录
          </button>
        )}
      </section>

      <nav className="mobile-profile-nav" aria-label="个人功能">
        <Link className="mobile-profile-nav-item" href="/me?tab=profile">
          <span className="mobile-profile-nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </span>
          <span className="mobile-profile-nav-label">个人信息</span>
          <span className="mobile-profile-nav-arrow">›</span>
        </Link>
        <Link className="mobile-profile-nav-item" href="/me?tab=favorites">
          <span className="mobile-profile-nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </span>
          <span className="mobile-profile-nav-label">我的收藏</span>
          <span className="mobile-profile-nav-arrow">›</span>
        </Link>
        <Link className="mobile-profile-nav-item" href="/me?tab=likes">
          <span className="mobile-profile-nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </span>
          <span className="mobile-profile-nav-label">我的点赞</span>
          <span className="mobile-profile-nav-arrow">›</span>
        </Link>
        <Link className="mobile-profile-nav-item" href="/me?tab=checkins">
          <span className="mobile-profile-nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <span className="mobile-profile-nav-label">我的打卡</span>
          <span className="mobile-profile-nav-arrow">›</span>
        </Link>
        <Link className="mobile-profile-nav-item" href="/me?tab=comments">
          <span className="mobile-profile-nav-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span className="mobile-profile-nav-label">我的评论</span>
          <span className="mobile-profile-nav-arrow">›</span>
        </Link>
      </nav>

      <div className="mobile-profile-footer-note footer-note">
        寻迹 · 探寻山河遗迹，守望千年记忆
      </div>
    </div>
  );
}

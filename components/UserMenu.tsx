'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../lib/types';

export default function UserMenu({ user, onLogout }: { user: UserProfile | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      if (event.target instanceof Node && el.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [open]);

  const avatar = useMemo(() => {
    const url = user?.avatarUrl?.trim();
    if (url) return { type: 'img' as const, url };
    return { type: 'placeholder' as const };
  }, [user?.avatarUrl, user?.label]);

  return (
    <div className="user-menu" ref={containerRef}>
      <button className="user-avatar" onClick={() => setOpen((v) => !v)} aria-label="用户菜单">
        {avatar.type === 'img' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar.url} alt={user?.label ?? '用户头像'} />
        ) : (
          <span className="user-avatar-placeholder" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 12.2a4.3 4.3 0 1 0-4.3-4.3A4.3 4.3 0 0 0 12 12.2Zm0 1.8c-4.4 0-8 2.2-8 4.9 0 .7.6 1.1 1.3 1.1h13.4c.7 0 1.3-.4 1.3-1.1 0-2.7-3.6-4.9-8-4.9Z"
              />
            </svg>
          </span>
        )}
      </button>
      {open && (
        <div className="user-dropdown" role="menu" aria-label="用户功能">
          <div className="user-dropdown-header">
            <div className="user-dropdown-name">{user?.label ?? '加载中…'}</div>
            <div className="user-dropdown-meta">{user?.isGuest ? '游客' : (user?.email ?? '邮箱用户')}</div>
          </div>
          <div className="user-dropdown-links">
            <Link className="user-dropdown-link" href="/me?tab=profile" onClick={() => setOpen(false)}>个人信息</Link>
            <Link className="user-dropdown-link" href="/me?tab=likes" onClick={() => setOpen(false)}>我的点赞</Link>
            <Link className="user-dropdown-link" href="/me?tab=checkins" onClick={() => setOpen(false)}>我的打卡</Link>
            <Link className="user-dropdown-link" href="/me?tab=comments" onClick={() => setOpen(false)}>我的评论</Link>
            <Link className="user-dropdown-link" href="/me?tab=favorites" onClick={() => setOpen(false)}>我的收藏</Link>
          </div>
          <div className="user-dropdown-actions">
            {user?.isGuest ? (
              <>
                <Link className="primary-button primary-button--jade" href="/login" onClick={() => setOpen(false)}>
                  登录/注册
                </Link>
                <Link className="ghost-button" href="/invite" onClick={() => setOpen(false)}>
                  邀请码登录
                </Link>
              </>
            ) : (
              <button
                className="ghost-button"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                退出登录
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

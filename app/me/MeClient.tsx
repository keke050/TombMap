'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import UserMenuGate from '../../components/UserMenuGate';
import { ensureGuestUser } from '../../lib/clientSession';
import type { Tomb, UserProfile } from '../../lib/types';

type Counts = { likes: number; checkins: number; comments: number; favorites: number };

type CheckinItem = { tombId: string; createdAt: string; tomb: Tomb | null };
type CommentItem = { tombId: string; createdAt: string; content: string; tomb: Tomb | null };

const tabs = [
  { key: 'profile', label: '个人信息' },
  { key: 'likes', label: '我的点赞' },
  { key: 'checkins', label: '我的打卡' },
  { key: 'comments', label: '我的评论' },
  { key: 'favorites', label: '我的收藏' }
] as const;

type TabKey = (typeof tabs)[number]['key'];

const normalizeTab = (value: string | null): TabKey => {
  const key = (value ?? '').trim();
  return (tabs.some((t) => t.key === key) ? key : 'profile') as TabKey;
};

export default function MeClient() {
  const searchParams = useSearchParams();
  const tab = normalizeTab(searchParams.get('tab'));

  const [user, setUser] = useState<UserProfile | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const [likes, setLikes] = useState<Tomb[]>([]);
  const [favorites, setFavorites] = useState<Tomb[]>([]);
  const [checkins, setCheckins] = useState<CheckinItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);

  const [label, setLabel] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [gender, setGender] = useState<'unknown' | 'male' | 'female' | ''>('');
  const [age, setAge] = useState<string>('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const loadMe = useCallback(async () => {
    let res = await fetch('/api/me', { cache: 'no-store' });
    if (res.status === 401) {
      await ensureGuestUser();
      res = await fetch('/api/me', { cache: 'no-store' });
    }
    if (!res.ok) {
      setUser(null);
      return;
    }
    const data = await res.json();
    setUser(data.user ?? null);
    setCounts(data.counts ?? null);
    const next = data.user as UserProfile | undefined;
    if (next) {
      setLabel(next.label ?? '');
      setAvatarUrl(next.avatarUrl ?? '');
      setGender((next.gender ?? '') as any);
      setAge(next.age != null ? String(next.age) : '');
    }
  }, []);

  const loadTab = useCallback(async (active: TabKey) => {
    if (active === 'likes') {
      const res = await fetch('/api/me/likes', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setLikes(Array.isArray(data?.tombs) ? data.tombs : []);
      return;
    }
    if (active === 'favorites') {
      const res = await fetch('/api/me/favorites', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setFavorites(Array.isArray(data?.tombs) ? data.tombs : []);
      return;
    }
    if (active === 'checkins') {
      const res = await fetch('/api/me/checkins', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setCheckins(Array.isArray(data?.items) ? data.items : []);
      return;
    }
    if (active === 'comments') {
      const res = await fetch('/api/me/comments', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setComments(Array.isArray(data?.items) ? data.items : []);
      return;
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setStatus('');
    const payload: any = {};
    if (label.trim()) payload.label = label.trim();
    if (avatarUrl.trim()) payload.avatarUrl = avatarUrl.trim();
    if (gender) payload.gender = gender;
    if (age.trim()) payload.age = Number(age);

    const res = await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setStatus(data?.error || '保存失败');
      return;
    }
    setUser(data.user ?? null);
    setStatus('已保存');
    loadMe();
  }, [age, avatarUrl, gender, label, loadMe, saving]);

  const headerMeta = useMemo(() => {
    if (!user) return '加载中…';
    const items: string[] = [];
    items.push(user.isGuest ? '游客' : '邮箱用户');
    if (counts) {
      items.push(`点赞 ${counts.likes}`);
      items.push(`打卡 ${counts.checkins}`);
      items.push(`评论 ${counts.comments}`);
      items.push(`收藏 ${counts.favorites}`);
    }
    return items.join(' · ');
  }, [user, counts]);

  return (
    <div className="detail-page">
      <div className="detail-page-card">
        <div className="detail-page-header">
          <div>
            <h1>用户主页</h1>
            <div className="detail-page-meta">{headerMeta}</div>
          </div>
          <div className="inline-actions">
            <Link className="ghost-button" href="/">
              返回地图
            </Link>
            <UserMenuGate />
          </div>
        </div>

        <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
          {tabs.map((item) => (
            <Link
              key={item.key}
              className={`ghost-button ${tab === item.key ? 'ghost-button--active' : ''}`}
              href={`/me?tab=${item.key}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {tab === 'profile' && (
          <section className="detail-page-section">
            <h3>个人信息</h3>
            <div className="field">
              <label>昵称</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="请输入昵称（1-20 字）" />
            </div>
            <div className="field">
              <label>头像 URL</label>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
              {avatarUrl.trim() && (
                <div className="footer-note" style={{ marginTop: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarUrl.trim()} alt="头像预览" className="profile-avatar-preview" />
                </div>
              )}
            </div>
            <div className="field">
              <label>性别</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as any)}>
                <option value="">不设置</option>
                <option value="unknown">保密</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div className="field">
              <label>年龄</label>
              <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="如：28" />
            </div>
            <div className="inline-actions">
              <button className="primary-button primary-button--jade" onClick={handleSave} disabled={saving}>
                {saving ? '保存中…' : '保存'}
              </button>
              {status && <span className="footer-note">{status}</span>}
            </div>

            {!user?.isGuest && (
              <div style={{ marginTop: 18 }}>
                <h3>密码</h3>
                <div className="footer-note" style={{ marginBottom: 10 }}>
                  你可以在这里设置/修改账号密码。若之前仅用“邀请码登录”，可能尚未设置密码。
                </div>
                <div className="field">
                  <label>原密码（若首次设置可留空）</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="如已设置过密码，请填写"
                  />
                </div>
                <div className="field">
                  <label>新密码（至少 8 位）</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少 8 位"
                  />
                </div>
                <div className="field">
                  <label>确认新密码</label>
                  <input type="password" value={newPassword2} onChange={(e) => setNewPassword2(e.target.value)} />
                </div>
                <div className="inline-actions">
                  <button
                    className="primary-button primary-button--jade"
                    disabled={passwordSaving}
                    onClick={async () => {
                      if (passwordSaving) return;
                      setPasswordStatus('');
                      if (newPassword.length < 8) {
                        setPasswordStatus('新密码至少 8 位');
                        return;
                      }
                      if (newPassword !== newPassword2) {
                        setPasswordStatus('两次输入的新密码不一致');
                        return;
                      }
                      setPasswordSaving(true);
                      const payload: any = { password: newPassword };
                      if (oldPassword.trim()) payload.oldPassword = oldPassword;
                      const res = await fetch('/api/me/password', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      }).catch(() => null);
                      const data = res ? await res.json().catch(() => null) : null;
                      setPasswordSaving(false);
                      if (!res || !('ok' in res) || !(res as Response).ok) {
                        setPasswordStatus(data?.error || '保存失败');
                        return;
                      }
                      setOldPassword('');
                      setNewPassword('');
                      setNewPassword2('');
                      setPasswordStatus('已保存');
                    }}
                  >
                    {passwordSaving ? '保存中…' : '保存密码'}
                  </button>
                  {passwordStatus && <span className="footer-note">{passwordStatus}</span>}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === 'likes' && (
          <section className="detail-page-section">
            <h3>我的点赞</h3>
            {likes.length === 0 && <div className="footer-note">暂无点赞记录。</div>}
            {likes.length > 0 && (
              <div className="province-list">
                {likes.map((tomb) => (
                  <Link key={tomb.id} className="result-item province-item" href={`/tombs/${tomb.id}`}>
                    <div className="result-title">{tomb.name}</div>
                    <div className="result-meta">
                      {[tomb.person, tomb.era, tomb.province, tomb.city].filter(Boolean).join(' · ')}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'favorites' && (
          <section className="detail-page-section">
            <h3>我的收藏</h3>
            {favorites.length === 0 && <div className="footer-note">暂无收藏。</div>}
            {favorites.length > 0 && (
              <div className="province-list">
                {favorites.map((tomb) => (
                  <Link key={tomb.id} className="result-item province-item" href={`/tombs/${tomb.id}`}>
                    <div className="result-title">{tomb.name}</div>
                    <div className="result-meta">
                      {[tomb.person, tomb.era, tomb.province, tomb.city].filter(Boolean).join(' · ')}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'checkins' && (
          <section className="detail-page-section">
            <h3>我的打卡</h3>
            {checkins.length === 0 && <div className="footer-note">暂无打卡记录。</div>}
            {checkins.length > 0 && (
              <div className="province-list">
                {checkins.map((item, idx) => (
                  <Link key={`${item.tombId}-${idx}`} className="result-item province-item" href={`/tombs/${item.tombId}`}>
                    <div className="result-title">{item.tomb?.name ?? item.tombId}</div>
                    <div className="result-meta">
                      {new Date(item.createdAt).toLocaleString()} ·{' '}
                      {[item.tomb?.person, item.tomb?.province, item.tomb?.city].filter(Boolean).join(' · ')}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'comments' && (
          <section className="detail-page-section">
            <h3>我的评论</h3>
            {comments.length === 0 && <div className="footer-note">暂无评论。</div>}
            {comments.length > 0 && (
              <div className="province-list">
                {comments.map((item, idx) => (
                  <Link key={`${item.tombId}-${idx}`} className="result-item province-item" href={`/tombs/${item.tombId}`}>
                    <div className="result-title">{item.tomb?.name ?? item.tombId}</div>
                    <div className="result-meta">{new Date(item.createdAt).toLocaleString()}</div>
                    <div className="footer-note" style={{ marginTop: 6 }}>
                      {item.content}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}


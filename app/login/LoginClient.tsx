'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import UserMenuGate from '../../components/UserMenuGate';
import { clearGuestCache } from '../../lib/clientSession';

type Mode = 'login' | 'register';

const normalizeMode = (value: string | null): Mode => {
  const raw = (value ?? '').trim();
  return raw === 'register' ? 'register' : 'login';
};

export default function LoginClient() {
  const searchParams = useSearchParams();
  const mode = normalizeMode(searchParams.get('mode'));
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const title = useMemo(() => (mode === 'register' ? '注册' : '登录'), [mode]);

  const submit = useCallback(async () => {
    if (loading) return;
    setStatus('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setStatus('请填写邮箱与密码');
      return;
    }

    if (mode === 'register') {
      if (password.length < 8) {
        setStatus('密码至少 8 位');
        return;
      }
      if (password !== password2) {
        setStatus('两次输入的密码不一致');
        return;
      }
    }

    setLoading(true);
    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password })
    }).catch(() => null);

    const data = res ? await res.json().catch(() => null) : null;
    setLoading(false);

    if (!res || !('ok' in res) || !(res as Response).ok) {
      setStatus(data?.error || '操作失败，请稍后重试');
      return;
    }

    setStatus(mode === 'register' ? '注册成功，正在进入…' : '登录成功，正在进入…');
    setTimeout(() => {
      clearGuestCache();
      router.push('/');
      router.refresh();
    }, 400);
  }, [email, loading, mode, password, password2, router]);

  return (
    <div className="detail-page">
      <div className="detail-page-card">
        <div className="detail-page-header">
          <div>
            <h1>{title}</h1>
            <div className="detail-page-meta">账号密码登录/注册（邮箱作为账号）</div>
          </div>
          <div className="inline-actions">
            <UserMenuGate />
            <Link className="ghost-button" href="/">
              返回地图
            </Link>
          </div>
        </div>

        <div className="inline-actions" style={{ flexWrap: 'wrap' }}>
          <Link
            className={`ghost-button ${mode === 'login' ? 'ghost-button--active' : ''}`}
            href="/login?mode=login"
          >
            登录
          </Link>
          <Link
            className={`ghost-button ${mode === 'register' ? 'ghost-button--active' : ''}`}
            href="/login?mode=register"
          >
            注册
          </Link>
          <Link className="ghost-button" href="/invite">
            邀请码登录
          </Link>
        </div>

        <div className="field">
          <label>邮箱（账号）</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
        </div>
        <div className="field">
          <label>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? '至少 8 位' : '请输入密码'}
          />
        </div>

        {mode === 'register' && (
          <div className="field">
            <label>确认密码</label>
            <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
          </div>
        )}

        <div className="inline-actions">
          <button className="primary-button primary-button--jade" onClick={submit} disabled={loading}>
            {loading ? '处理中…' : title}
          </button>
          {status && <span className="footer-note">{status}</span>}
        </div>

        <div className="footer-note">
          提示：如果你是游客已产生点赞/收藏/评论，建议先“注册”，系统会尽量保留当前游客数据。
          <br />
          如果你之前是“邀请码登录”用户但未设置密码，请先用邀请码登录，然后到“用户主页 → 个人信息 → 密码”设置密码。
        </div>
      </div>
    </div>
  );
}


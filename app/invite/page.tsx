'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import UserMenuGate from '../../components/UserMenuGate';

export default function InvitePage() {
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!email || !inviteCode) {
      setStatus('请填写邮箱与邀请码');
      return;
    }
    setLoading(true);
    setStatus('');
    const res = await fetch('/api/auth/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, inviteCode })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setStatus(data.error || '邀请失败');
      return;
    }
    setStatus('邀请成功，已升级为邮箱用户');
    setTimeout(() => router.push('/'), 800);
  };

  return (
    <div className="detail-page">
      <div className="detail-page-card">
        <div className="detail-page-header">
          <div>
            <h1>邀请登录</h1>
            <div className="detail-page-meta">使用邀请邮箱和邀请码升级身份</div>
          </div>
          <div className="inline-actions">
            <UserMenuGate />
            <Link className="ghost-button" href="/">返回地图</Link>
          </div>
        </div>

        <div className="field">
          <label>邮箱</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" />
        </div>
        <div className="field">
          <label>邀请码</label>
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="CM-XXXXXX" />
        </div>
        <div className="inline-actions">
          <button className="primary-button" onClick={handleSubmit} disabled={loading}>
            {loading ? '提交中…' : '提交邀请'}
          </button>
        </div>
        {status && <p className="footer-note">{status}</p>}
      </div>
    </div>
  );
}

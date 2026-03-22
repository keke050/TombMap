import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="detail-page">
          <div className="detail-page-card">
            <div className="footer-note">加载中…</div>
          </div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}


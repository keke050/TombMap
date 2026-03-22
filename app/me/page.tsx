import { Suspense } from 'react';
import MeClient from './MeClient';

export default function MePage() {
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
      <MeClient />
    </Suspense>
  );
}


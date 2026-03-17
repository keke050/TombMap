import type { Metadata } from 'next';
import { Noto_Serif_SC, ZCOOL_XiaoWei } from 'next/font/google';
import AuthBootstrap from '../components/AuthBootstrap';
import './globals.css';

const displayFont = ZCOOL_XiaoWei({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-display'
});

const bodyFont = Noto_Serif_SC({
  weight: ['400', '600'],
  subsets: ['latin'],
  variable: '--font-body'
});

export const metadata: Metadata = {
  title: '寻迹',
  description: '以权威文保名单为底的名人古墓分布与探索平台。'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <AuthBootstrap />
        <div className="app-shell">
          {children}
        </div>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Noto_Sans_KR } from 'next/font/google';

import { SITE } from '@/lib/site';

import './globals.css';

/**
 * 루트 레이아웃. 국내 사용자용 한국어 앱이라 로케일 분기가 없다(`<html lang="ko">`).
 * 다크모드 기본(`class="dark"`)은 나우 패밀리(공원나우 등)와 통일. 폰트는 한글 본문에 맞는 Noto Sans KR.
 */
const notoSansKr = Noto_Sans_KR({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: '업추비나우 — 우리 동네 업무추진비 랭킹',
  description:
    '전국 243개 지자체 업무추진비 결산을 시도별·전국 랭킹으로. 합계·기관운영·시책추진·주민 1인당·세출 대비 비율·전년 대비 증감·절감률. 2009년부터 연도별 추이. 행정안전부 지방재정365.',
  keywords: ['업무추진비', '지자체 업무추진비', '업추비', '지방재정365', '시책추진비', '기관운영비', '우리 동네 예산'],
  applicationName: '업추비나우',
  appleWebApp: { title: '업추비나우' },
  alternates: { canonical: SITE },
  openGraph: {
    title: '업추비나우 — 우리 동네 업무추진비 랭킹',
    description: '전국 243개 지자체 업무추진비 결산 랭킹. 합계 · 1인당 · 세출 대비 · 전년비 · 절감률.',
    url: SITE,
    siteName: '업추비나우',
    locale: 'ko_KR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0f19',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`dark ${notoSansKr.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground">{children}</body>
    </html>
  );
}

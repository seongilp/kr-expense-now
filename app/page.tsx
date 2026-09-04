import { Coins } from 'lucide-react';

import { loadCentroids, loadSnapshot } from '@/lib/snapshot';
import { ExpenseBrowser } from '@/components/expense-browser';
import { FooterNotes } from '@/components/footer-notes';

/**
 * 첫 화면(서버 컴포넌트). 스냅샷을 읽어 클라이언트 브라우저에 통째로 넘긴다(≈800KB, gzip ≈150KB).
 * 정적 생성되므로 요청마다 파일을 읽지 않는다. 헤더 문장은 크롤러가 읽을 색인 근거.
 */
export default function Home() {
  const snap = loadSnapshot();
  const centroids = loadCentroids();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <Coins className="size-3.5 text-primary" />
          행정안전부 지방재정365 · 전국 {snap.entities.length}개 지자체 · {snap.latestYear}년 결산
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">우리 동네 업무추진비, 얼마나 쓰나</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          시도를 고르면 시군구 랭킹이 뜹니다. 합계 · 기관운영 · 시책추진 · 주민 1인당 · 세출 대비 · 전년 대비 · 절감률로
          정렬하고, 전국 랭킹은 같은 유형(시 / 군 / 자치구 / 광역)끼리만 비교합니다.
        </p>
      </header>
      <ExpenseBrowser
        entities={snap.entities}
        centroids={centroids}
        latestYear={snap.latestYear}
        latestSplitYear={snap.latestSplitYear}
      />
      <FooterNotes
        sources={snap.sources}
        latestYear={snap.latestYear}
        latestSplitYear={snap.latestSplitYear}
        collectedAt={snap.collectedAt}
      />
    </main>
  );
}

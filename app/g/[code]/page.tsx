import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { formatWon } from '@/lib/format';
import { SITE } from '@/lib/site';
import { loadSnapshot } from '@/lib/snapshot';
import { TYPE_LABEL, sidoOf } from '@/lib/sido';
import { EntityDetail } from '@/components/entity-detail';
import { FooterNotes } from '@/components/footer-notes';

/** 지자체 상세. 243곳 전부 빌드 시 정적 생성 — 코드가 URL 이라 검색 유입도 이쪽으로 온다. */
type Params = { code: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return loadSnapshot().entities.map((e) => ({ code: e.code }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { code } = await params;
  const snap = loadSnapshot();
  const e = snap.entities.find((x) => x.code === code);
  if (!e) return {};
  const latest = [...e.years].reverse().find((y) => y.total !== null);
  const where = e.type === 'metro' ? TYPE_LABEL.metro : `${sidoOf(e.sido)?.full ?? ''} ${TYPE_LABEL[e.type]}`;
  const title = `${e.name} 업무추진비 — 업추비나우`;
  const description = latest
    ? `${e.name}(${where}) ${latest.year}년 업무추진비 결산 ${formatWon(latest.total)}. 전국·시도 순위, 주민 1인당, 세출 대비 비율, 연도별 추이.`
    : `${e.name} 업무추진비 결산과 순위.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/g/${code}` },
    openGraph: { title, description, url: `${SITE}/g/${code}`, siteName: '업추비나우', locale: 'ko_KR', type: 'article' },
  };
}

export default async function EntityPage({ params }: { params: Promise<Params> }) {
  const { code } = await params;
  const snap = loadSnapshot();
  const entity = snap.entities.find((e) => e.code === code);
  if (!entity) notFound();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <EntityDetail entity={entity} entities={snap.entities} latestSplitYear={snap.latestSplitYear} />
      <FooterNotes sources={snap.sources} latestYear={snap.latestYear} latestSplitYear={snap.latestSplitYear} collectedAt={snap.collectedAt} />
    </main>
  );
}

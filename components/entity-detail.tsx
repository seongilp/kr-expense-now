import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { standings, trendBars, typeMedianByYear, type MetricStanding } from '@/lib/detail';
import { formatPeople, formatPct, formatWon } from '@/lib/format';
import { formatMetric } from '@/lib/metric-format';
import { METRICS } from '@/lib/rank';
import { TYPE_LABEL, sidoOf } from '@/lib/sido';
import type { Entity } from '@/lib/types';
import { cn } from '@/lib/utils';
import { deltaTone, savingTone } from '@/components/ranking-table';
import { TrendChart } from '@/components/trend-chart';

/**
 * 지자체 상세(서버 컴포넌트, 정적 생성). 최신 결산 연도의 지표별 값 + 전국(같은 유형)·시도 순위 + 같은 유형 중앙값,
 * 연도별 추이 차트, 연도별 표. 분리값(기관운영/시책추진)은 한 해 늦으므로 그 해 기준으로 따로 보여준다.
 */
export function EntityDetail({ entity, entities, latestSplitYear }: { entity: Entity; entities: Entity[]; latestSplitYear: number }) {
  const latest = [...entity.years].reverse().find((y) => y.total !== null)?.year ?? entity.years.at(-1)?.year ?? 0;
  const splitYear = Math.min(latest, latestSplitYear);
  const now = standings(entities, entity.code, latest);
  const split = splitYear === latest ? now : standings(entities, entity.code, splitYear);
  const bars = trendBars(entity);
  const med = typeMedianByYear(entities, entity.type, bars.map((b) => b.year));
  const sido = sidoOf(entity.sido);
  const rec = entity.years.find((y) => y.year === latest);

  const byKey = (list: MetricStanding[], key: MetricStanding['metric']) => list.find((s) => s.metric === key)!;
  const cards: { s: MetricStanding; year: number }[] = METRICS.map((m) => {
    const isSplit = m.key === 'org' || m.key === 'policy' || m.key === 'savingRate';
    return { s: byKey(isSplit ? split : now, m.key), year: isSplit ? splitYear : latest };
  });

  return (
    <article className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> 랭킹으로
      </Link>
      <header>
        <p className="text-xs text-muted-foreground">
          {entity.type === 'metro' ? TYPE_LABEL.metro : `${sido?.full ?? ''} · ${TYPE_LABEL[entity.type]}`} · 코드 {entity.code}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{entity.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {latest}년 결산 업무추진비 <b className="text-foreground">{formatWon(rec?.total)}</b>
          {rec?.population ? ` · 인구 ${formatPeople(rec.population)}` : ''}
          {rec?.outlay ? ` · 세출결산 ${formatWon(rec.outlay)}` : ''}
        </p>
      </header>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="지표별 순위">
        {cards.map(({ s, year }) => (
          <StandingCard key={s.metric} s={s} year={year} isMetro={entity.type === 'metro'} typeLabel={TYPE_LABEL[entity.type]} />
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">연도별 추이</h2>
        <TrendChart bars={bars} median={med} />
      </section>

      <section>
        <h2 className="mb-2 text-base font-semibold">연도별 값</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-card text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left font-medium">연도</th>
                <th className="px-2 py-2 text-right font-medium">합계(결산)</th>
                <th className="px-2 py-2 text-right font-medium">기관운영</th>
                <th className="px-2 py-2 text-right font-medium">시책추진</th>
                <th className="px-2 py-2 text-right font-medium">절감률</th>
                <th className="px-2 py-2 text-right font-medium">세출결산</th>
                <th className="px-2 py-2 text-right font-medium">인구</th>
                <th className="px-2 py-2 text-right font-medium">편성(기관+시책)</th>
              </tr>
            </thead>
            <tbody>
              {[...entity.years].reverse().map((y) => (
                <tr key={y.year} className="border-t border-border/60">
                  <td className="px-2 py-1.5 tabular-nums">{y.year}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatWon(y.total)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatWon(y.org)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatWon(y.policy)}</td>
                  <td className={cn('px-2 py-1.5 text-right tabular-nums', savingTone(y.savingRate))}>{formatPct(y.savingRate, 1)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatWon(y.outlay)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{y.population === null ? '—' : formatPeople(y.population)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {y.orgBudget === null && y.policyBudget === null ? '—' : formatWon((y.orgBudget ?? 0) + (y.policyBudget ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          편성 = 당초예산 편성액(2020년~, 결산과 다른 데이터셋). 결산이 아직 없는 최근 연도는 편성만 있다.
        </p>
      </section>
    </article>
  );
}

function StandingCard({ s, year, isMetro, typeLabel }: { s: MetricStanding; year: number; isMetro: boolean; typeLabel: string }) {
  const def = METRICS.find((m) => m.key === s.metric)!;
  const tone = s.metric === 'delta' ? deltaTone(s.value) : s.metric === 'savingRate' ? savingTone(s.value) : '';
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">
        {def.label} <span className="opacity-70">{year}</span>
      </p>
      <p className={cn('mt-0.5 text-xl font-semibold tabular-nums', tone)}>{formatMetric(s.metric, s.value)}</p>
      <dl className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <dt>전국 {typeLabel} 중</dt>
          <dd className="tabular-nums">{s.national ? `${s.national.rank}위 / ${s.national.of}` : '—'}</dd>
        </div>
        {!isMetro && (
          <div className="flex justify-between">
            <dt>시도 안</dt>
            <dd className="tabular-nums">{s.sido ? `${s.sido.rank}위 / ${s.sido.of}` : '—'}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>{typeLabel} 중앙값</dt>
          <dd className="tabular-nums">{formatMetric(s.metric, s.typeMedian)}</dd>
        </div>
      </dl>
      {!def.moreIsSpending && <p className="mt-1 text-[10px] text-muted-foreground">절감률은 높을수록 덜 쓴 것(1위 = 가장 아낌).</p>}
    </div>
  );
}

import { computeRow, median, type Metric, type Row } from './rank';
import type { Entity } from './types';

/**
 * 연도 타임라인(components/year-picker.tsx) 의 막대 값. 지금 보이는 집합(선택 시도의 시군구 / 전국 유형) 을
 * 연도마다 하나의 수로 접는다 — 금액 지표(합계·기관운영·시책추진) 는 **합계**, 비율·1인당·증감·절감률은 **중앙값**
 * (비율을 더하면 의미가 없고, 평균은 대도시에 끌려간다). 데이터가 하나도 없는 해는 null(막대 없음).
 */
export interface YearPoint {
  year: number;
  value: number | null;
}

/** 합계로 접는 지표. 나머지는 중앙값. */
export const SUM_METRICS: ReadonlySet<Metric> = new Set<Metric>(['total', 'org', 'policy']);

export function aggregateOf(metric: Metric): 'sum' | 'median' {
  return SUM_METRICS.has(metric) ? 'sum' : 'median';
}

function sumOf(rows: readonly Row[], metric: Metric): number | null {
  const vals = rows.map((r) => r[metric]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

/**
 * codes 에 든 지자체만, years 순서대로. 226곳 × 16년 computeRow ≈ 3,600회라 1ms 대 — 매 드래그마다 돌려도 되지만
 * 호출자는 (집합, 지표) 가 바뀔 때만 다시 계산하면 된다.
 */
export function yearlySeries(entities: readonly Entity[], codes: ReadonlySet<string>, years: readonly number[], metric: Metric): YearPoint[] {
  const picked = entities.filter((e) => codes.has(e.code));
  const agg = aggregateOf(metric);
  return years.map((year) => {
    const rows = picked.map((e) => computeRow(e, year));
    return { year, value: agg === 'sum' ? sumOf(rows, metric) : median(rows, metric) };
  });
}

/** 슬라이더 스텝 → 연도. 범위 밖이면 가장 가까운 끝으로. years 는 비어 있으면 안 된다. */
export function clampYear(year: number, years: readonly number[]): number {
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return Math.min(hi, Math.max(lo, year));
}

import { METRICS, average, computeRow, median, rankBy, type Metric, type Row } from './rank';
import type { Entity } from './types';

/**
 * 상세 화면용 통계(순수). 테스트 lib/__tests__/detail.test.ts.
 *
 * "전국 N위" 는 **같은 유형(광역/시/군/구) 안에서**, "시도 N위" 는 **같은 시도의 기초 지자체 안에서** 매긴다.
 * 광역(본청)은 시도 순위가 없다(비교 대상이 자기 자신뿐).
 */

export interface RankPos {
  rank: number;
  of: number;
}

export interface MetricStanding {
  metric: Metric;
  value: number | null;
  national: RankPos | null;
  sido: RankPos | null;
  /** 같은 유형 전국 중앙값·평균. */
  typeMedian: number | null;
  typeAverage: number | null;
}

/** 순위표에서 한 곳의 위치. 값이 없으면 null. */
export function positionOf(rows: readonly Row[], code: string, metric: Metric): RankPos | null {
  const { rank, of } = rankBy(rows, metric);
  const r = rank.get(code);
  return r === undefined ? null : { rank: r, of };
}

/** 한 지자체·한 해의 지표별 순위·중앙값 모음. */
export function standings(entities: readonly Entity[], code: string, year: number): MetricStanding[] {
  const me = entities.find((e) => e.code === code);
  if (!me) return [];
  const rows = entities.map((e) => computeRow(e, year));
  const sameType = rows.filter((r) => r.type === me.type);
  const sameSido = me.type === 'metro' ? [] : rows.filter((r) => r.sido === me.sido && r.type !== 'metro');
  const mine = rows.find((r) => r.code === code)!;
  return METRICS.map(({ key }) => ({
    metric: key,
    value: mine[key],
    national: positionOf(sameType, code, key),
    sido: sameSido.length ? positionOf(sameSido, code, key) : null,
    typeMedian: median(sameType, key),
    typeAverage: average(sameType, key),
  }));
}

/** 연도별 추이 막대(결산 합계 + 분리값). 결산 총액이 있는 해만. */
export interface TrendBar {
  year: number;
  total: number;
  org: number | null;
  policy: number | null;
}

export function trendBars(e: Entity): TrendBar[] {
  return e.years
    .filter((y) => y.total !== null)
    .map((y) => ({ year: y.year, total: y.total as number, org: y.org, policy: y.policy }));
}

/** 같은 유형의 연도별 중앙값 추이(상세 차트의 비교선). */
export function typeMedianByYear(entities: readonly Entity[], type: Entity['type'], years: readonly number[]): Map<number, number | null> {
  const same = entities.filter((e) => e.type === type);
  return new Map(years.map((y) => [y, median(same.map((e) => computeRow(e, y)), 'total')]));
}

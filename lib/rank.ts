import type { Entity, EntityType, YearRecord } from './types';

/**
 * 랭킹·증감·1인당·비율 계산(순수, 브라우저에서 돈다). 테스트 lib/__tests__/rank.test.ts.
 *
 * 원칙:
 * - null 은 "데이터 없음". 정렬에서 맨 뒤로 보내고 순위·평균에서 뺀다. 0 으로 취급하지 않는다.
 * - 순위는 **같은 유형(광역/시/군/구) 또는 같은 시도 안**에서만 의미가 있다. 여기서는 받은 rows 안에서만 매기고,
 *   어떤 집합을 넘길지는 호출자(화면)가 정한다.
 * - "1위" 는 값이 가장 큰 곳이다(가장 많이 쓴 곳). 절감률만 큰 값 = 덜 쓴 곳이라 화면에서 라벨로 구분한다.
 */

export type Metric = 'total' | 'org' | 'policy' | 'perCapita' | 'ratio' | 'delta' | 'savingRate';

export interface MetricDef {
  key: Metric;
  label: string;
  /** 짧은 표 헤더. */
  short: string;
  /** 큰 값이 "많이 씀" 인가(true) / "덜 씀" 인가(false, 절감률). */
  moreIsSpending: boolean;
}

export const METRICS: readonly MetricDef[] = [
  { key: 'total', label: '업무추진비 합계', short: '합계', moreIsSpending: true },
  { key: 'org', label: '기관운영', short: '기관운영', moreIsSpending: true },
  { key: 'policy', label: '시책추진', short: '시책추진', moreIsSpending: true },
  { key: 'perCapita', label: '주민 1인당', short: '1인당', moreIsSpending: true },
  { key: 'ratio', label: '세출 대비 비율', short: '세출대비', moreIsSpending: true },
  { key: 'delta', label: '전년 대비 증감', short: '전년비', moreIsSpending: true },
  { key: 'savingRate', label: '절감률', short: '절감률', moreIsSpending: false },
];

/** 한 지자체·한 해의 계산된 값 한 줄. 표·지도·상세가 전부 이걸 본다. */
export interface Row {
  code: string;
  name: string;
  fullName: string;
  sido: string;
  type: EntityType;
  year: number;
  total: number | null;
  org: number | null;
  policy: number | null;
  perCapita: number | null;
  ratio: number | null;
  delta: number | null;
  savingRate: number | null;
  population: number | null;
  outlay: number | null;
}

export function yearRecord(e: Entity, year: number): YearRecord | undefined {
  return e.years.find((y) => y.year === year);
}

/** 1인당(원). 인구 0/없음이면 null. */
export function perCapita(total: number | null, population: number | null): number | null {
  if (total === null || population === null || population <= 0) return null;
  return total / population;
}

/** 세출결산 대비 비율(%). 분모 0/없음이면 null. */
export function ratioPct(total: number | null, outlay: number | null): number | null {
  if (total === null || outlay === null || outlay <= 0) return null;
  return (total / outlay) * 100;
}

/** 전년 대비 증감률(%). 전년 값 0/없음이면 null. */
export function yoyPct(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** 지자체 + 연도 → Row. 그 해 레코드가 없으면 전부 null(랭킹에서 자연스럽게 빠진다). */
export function computeRow(e: Entity, year: number): Row {
  const y = yearRecord(e, year);
  const prev = yearRecord(e, year - 1);
  return {
    code: e.code,
    name: e.name,
    fullName: e.fullName,
    sido: e.sido,
    type: e.type,
    year,
    total: y?.total ?? null,
    org: y?.org ?? null,
    policy: y?.policy ?? null,
    perCapita: perCapita(y?.total ?? null, y?.population ?? null),
    ratio: ratioPct(y?.total ?? null, y?.outlay ?? null),
    delta: yoyPct(y?.total ?? null, prev?.total ?? null),
    savingRate: y?.savingRate ?? null,
    population: y?.population ?? null,
    outlay: y?.outlay ?? null,
  };
}

export type SortDir = 'desc' | 'asc';

/**
 * metric 기준 정렬(새 배열). null 은 방향과 무관하게 맨 뒤. 동률은 이름순으로 안정화.
 */
export function sortRows(rows: readonly Row[], metric: Metric, dir: SortDir = 'desc'): Row[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[metric];
    const bv = b[metric];
    if (av === null && bv === null) return a.name.localeCompare(b.name, 'ko');
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av !== bv) return sign * (av - bv);
    return a.name.localeCompare(b.name, 'ko');
  });
}

/**
 * 순위표. 값 큰 순(desc) 1위. 동률은 같은 순위(1,1,3 방식). null 은 순위 없음(undefined).
 * 반환 Map: code → rank. `of` 는 값이 있는 곳의 수.
 */
export function rankBy(rows: readonly Row[], metric: Metric): { rank: Map<string, number>; of: number } {
  const sorted = sortRows(rows, metric, 'desc').filter((r) => r[metric] !== null);
  const rank = new Map<string, number>();
  let current = 0;
  let lastValue: number | null = null;
  sorted.forEach((r, i) => {
    const v = r[metric] as number;
    if (lastValue === null || v !== lastValue) current = i + 1;
    rank.set(r.code, current);
    lastValue = v;
  });
  return { rank, of: sorted.length };
}

/** 평균(null 제외). 하나도 없으면 null. */
export function average(rows: readonly Row[], metric: Metric): number | null {
  const vals = rows.map((r) => r[metric]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** 중앙값(null 제외). 평균이 광역·대도시에 끌려가므로 "보통 수준" 표시엔 이쪽이 정직하다. */
export function median(rows: readonly Row[], metric: Metric): number | null {
  const vals = rows
    .map((r) => r[metric])
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (vals.length === 0) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

/** 같은 유형만. */
export function ofType(rows: readonly Row[], type: EntityType): Row[] {
  return rows.filter((r) => r.type === type);
}

/** 같은 시도의 기초 지자체만(본청 제외). 시도 안 랭킹은 광역을 빼야 비교가 된다. */
export function basicOfSido(rows: readonly Row[], sido: string): Row[] {
  return rows.filter((r) => r.sido === sido && r.type !== 'metro');
}

/** 결산 총액이 있는 연도 목록(내림차순). 연도 선택기. */
export function availableYears(entities: readonly Entity[]): number[] {
  const set = new Set<number>();
  for (const e of entities) for (const y of e.years) if (y.total !== null) set.add(y.year);
  return [...set].sort((a, b) => b - a);
}

/**
 * 지자체명 검색. 짧은 이름·원문·시도 정식명 어디에 들어가도 매칭. 공백 무시. 최대 limit.
 * 정렬: 앞에서 시작하는 것 우선, 그다음 이름순.
 */
export function searchEntities(entities: readonly Entity[], query: string, limit = 12): Entity[] {
  const q = query.replace(/\s+/g, '');
  if (!q) return [];
  const hits = entities.filter((e) => e.name.includes(q) || e.fullName.includes(q));
  return hits
    .sort((a, b) => {
      const as = a.name.startsWith(q) ? 0 : 1;
      const bs = b.name.startsWith(q) ? 0 : 1;
      return as - bs || a.name.localeCompare(b.name, 'ko');
    })
    .slice(0, limit);
}

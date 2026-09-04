import { sidoOf, sidoPrefixOf } from './sido';
import type { Entity, EntityType, YearRecord } from './types';

/**
 * 지방재정365 원본 행 → Entity 정규화(순수). scripts/collect-expense.ts 가 쓴다.
 *
 * 다섯 데이터셋(결산 총액·결산 분리/절감률·인구·기관운영 편성·시책추진 편성)을 **자치단체코드 + 회계연도**
 * 로 조인한다. 코드는 연도별로 안정적이지만(실측 252종/243 현존) 개편된 곳은 아래 CODE_ALIASES 로 잇는다.
 */

/** 공통 원본 행. 데이터셋마다 값 컬럼이 다르므로 필요한 것만 optional 로 둔다. */
export interface RawRow {
  fyr: string;
  lafCd: string;
  lafHgNm: string;
  waLafHgNm?: string;
  // 업무추진비비율(84474…)
  boe?: number;
  aneStlAmt?: number;
  // 업무추진비 절감률(PQNF…)
  rate?: number;
  boeAmt1?: number;
  boeAmt2?: number;
  boeAmt3?: number;
  // 주민1인당세출예산액(E8CL…)
  pptnNum?: number;
  // 기관운영/시책추진 (2020년 이후) 편성액
  smyCnttAmt?: number;
  smyCnttAmt2?: number;
}

export interface RawBundle {
  ratio: RawRow[];
  saving: RawRow[];
  population: RawRow[];
  orgBudget: RawRow[];
  policyBudget: RawRow[];
}

/**
 * 행정구역 개편으로 코드가 바뀐 곳. 옛 코드 → 현재 코드. 조인 전에 적용해 한 지자체의 시계열을 잇는다.
 * - 군위군: 2023-07 경북 → 대구 편입(4771000 → 2772000). 실측: 2023까지 경북군위군, 2024 대구군위군.
 * 청원군(→청주 통합)·연기군(→세종)·마산/진해(→창원) 은 승계 주체가 다른 단체라 잇지 않는다(2014 이전 데이터만 있음).
 */
export const CODE_ALIASES: Readonly<Record<string, string>> = {
  '4771000': '2772000',
};

export function canonicalCode(code: string): string {
  return CODE_ALIASES[code] ?? code;
}

/** 유형 판정: 본청 = 광역, 그 외 이름 끝 글자(시/군/구). 실측 2024: 17/75/82/69. */
export function classify(fullName: string): EntityType {
  if (fullName.endsWith('본청')) return 'metro';
  const last = fullName.at(-1);
  if (last === '시') return 'si';
  if (last === '군') return 'gun';
  if (last === '구') return 'gu';
  throw new Error(`유형을 알 수 없는 자치단체명: ${fullName}`);
}

/**
 * 화면용 짧은 이름. 원문은 시도 약칭(2글자) + 시군구명(예: 경기고양시 → 고양시).
 * 광역(본청)은 시도 정식명. 약칭 접두어가 아닌 경우(없음, 방어)엔 원문 그대로.
 */
export function shortName(fullName: string, code: string): string {
  const sido = sidoOf(sidoPrefixOf(code));
  if (fullName.endsWith('본청')) return sido?.full ?? fullName;
  const prefix = sido?.short ?? '';
  return prefix && fullName.startsWith(prefix) ? fullName.slice(prefix.length) : fullName;
}

/** 숫자 아니면 null. 0 은 유효값(실측엔 0 행이 없지만 방어). */
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function emptyYear(year: number): YearRecord {
  return {
    year,
    total: null,
    outlay: null,
    org: null,
    policy: null,
    standard: null,
    savingRate: null,
    population: null,
    orgBudget: null,
    policyBudget: null,
  };
}

/** 절감률(%) = (1 − (기관운영+시책추진)/기준액) × 100. 기준액 0/없음이면 null. */
export function savingRateOf(org: number | null, policy: number | null, standard: number | null): number | null {
  if (org === null || policy === null || standard === null || standard <= 0) return null;
  return Math.round((1 - (org + policy) / standard) * 10000) / 100;
}

/** 업무추진비 계열 값이 하나라도 있는가(인구만 있는 행 제외용). */
export function hasExpenseValue(y: YearRecord): boolean {
  return y.total !== null || y.org !== null || y.orgBudget !== null || y.policyBudget !== null;
}

type Key = string; // `${code}:${year}`
const keyOf = (code: string, year: number): Key => `${code}:${year}`;

/**
 * 조인 본체. 반환은 코드 순 정렬, 각 entity.years 는 연도 오름차순.
 * `activeYear` 에 결산 총액 행이 있는 지자체만 남긴다(폐지·통합된 옛 단체 제외 — 랭킹에 유령이 섞이지 않게).
 * 이름은 activeYear 행의 것을 쓴다(인천남구 → 미추홀구 같은 개명 흡수).
 */
export function buildEntities(raw: RawBundle, activeYear: number): Entity[] {
  const years = new Map<Key, YearRecord>();
  const touch = (code: string, year: number): YearRecord => {
    const k = keyOf(code, year);
    const found = years.get(k);
    if (found) return found;
    const fresh = emptyYear(year);
    years.set(k, fresh);
    return fresh;
  };
  const apply = (rows: RawRow[], fill: (r: RawRow, y: YearRecord) => Partial<YearRecord>) => {
    for (const r of rows) {
      const code = canonicalCode(r.lafCd);
      const year = Number(r.fyr);
      if (!Number.isInteger(year)) continue;
      const cur = touch(code, year);
      years.set(keyOf(code, year), { ...cur, ...fill(r, cur) });
    }
  };

  apply(raw.ratio, (r) => ({ total: num(r.boe), outlay: num(r.aneStlAmt) }));
  // 절감률은 원본 `rate` 를 쓰지 않고 직접 계산한다. 실측: 2015~2016 의 rate 는 (결산/기준)×100 (집행률) 이고
  // 2017~ 는 (1−결산/기준)×100 (절감률) 로 정의가 뒤집혀 있다. 같은 식으로 다시 계산하면 전 연도가 2017~ 원본과 0.2%p 안에서 일치.
  apply(raw.saving, (r) => {
    const org = num(r.boeAmt1);
    const policy = num(r.boeAmt2);
    const standard = num(r.boeAmt3);
    return { org, policy, standard, savingRate: savingRateOf(org, policy, standard) };
  });
  apply(raw.population, (r) => ({ population: num(r.pptnNum) }));
  // 편성액: 기관운영은 smyCnttAmt(편성액 B=C+D+E), 시책추진은 smyCnttAmt2(편성액 B). 컬럼 위치가 다르다(실측).
  apply(raw.orgBudget, (r) => ({ orgBudget: num(r.smyCnttAmt) }));
  apply(raw.policyBudget, (r) => ({ policyBudget: num(r.smyCnttAmt2) }));

  const active = new Map<string, RawRow>();
  for (const r of raw.ratio) {
    if (Number(r.fyr) === activeYear) active.set(canonicalCode(r.lafCd), r);
  }

  const entities: Entity[] = [];
  for (const [code, row] of active) {
    // 인구만 있는 해(2001~2008) 는 버린다 — 업무추진비 값이 하나도 없는 행은 화면에 쓸 데가 없다.
    const recs = [...years.entries()]
      .filter(([k]) => k.startsWith(`${code}:`))
      .map(([, v]) => v)
      .filter(hasExpenseValue)
      .sort((a, b) => a.year - b.year);
    entities.push({
      code,
      fullName: row.lafHgNm,
      name: shortName(row.lafHgNm, code),
      sido: sidoPrefixOf(code),
      type: classify(row.lafHgNm),
      years: recs,
    });
  }
  return entities.sort((a, b) => a.code.localeCompare(b.code));
}

/** 채움률 리포트(수집 스크립트 출력용). 필드별 non-null 비율을 연도별로. */
export function fillReport(entities: Entity[]): Record<number, Record<string, number>> {
  const fields: (keyof YearRecord)[] = [
    'total',
    'outlay',
    'org',
    'policy',
    'savingRate',
    'population',
    'orgBudget',
    'policyBudget',
  ];
  const byYear: Record<number, Record<string, number>> = {};
  const counts: Record<number, number> = {};
  for (const e of entities) {
    for (const y of e.years) {
      counts[y.year] = (counts[y.year] ?? 0) + 1;
      byYear[y.year] ??= {};
      for (const f of fields) {
        if (y[f] !== null) byYear[y.year][f] = (byYear[y.year][f] ?? 0) + 1;
      }
    }
  }
  const out: Record<number, Record<string, number>> = {};
  for (const [yr, n] of Object.entries(counts)) {
    const year = Number(yr);
    out[year] = { rows: n };
    for (const f of fields) out[year][f] = Math.round(((byYear[year][f] ?? 0) / n) * 1000) / 10;
  }
  return out;
}

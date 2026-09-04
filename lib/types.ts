/**
 * 업추비나우 도메인 타입.
 *
 * 금액 단위는 전부 **원**(정수). 화면 표기(억·만) 는 lib/format.ts 가 맡는다.
 * `null` 은 "그 해에 그 데이터셋이 없다"는 뜻이지 0 이 아니다 — 랭킹·평균에서 빼야 한다.
 */

/** 지자체 유형. 랭킹은 같은 유형끼리만 비교한다(광역과 군을 섞으면 거짓 랭킹). */
export type EntityType = 'metro' | 'si' | 'gun' | 'gu';

export interface YearRecord {
  year: number;
  /** 업무추진비 결산액(일반회계). 출처: 업무추진비비율(84474…). 2009~ */
  total: number | null;
  /** 세출결산액(일반회계). 같은 출처. 예산대비 비율의 분모. */
  outlay: number | null;
  /** 기관운영 업무추진비 결산액(일반회계+기타특별회계). 출처: 업무추진비 절감률(PQNF…). 2015~ */
  org: number | null;
  /** 시책추진 업무추진비 결산액. 같은 출처. */
  policy: number | null;
  /** 업무추진비 기준액 소계(기관운영+시책추진). 절감률의 분모. */
  standard: number | null;
  /** 절감률(%) = (1 − 결산액/기준액) × 100. 출처 지표값 그대로. 음수 = 기준액 초과 집행. */
  savingRate: number | null;
  /** 주민등록 인구수. 출처: 주민1인당세출예산액(E8CL…). 1인당 계산의 분모. */
  population: number | null;
  /** 기관운영 업무추진비 당초예산 편성액(2020~). 출처: 기관운영업무추진비(2020년 이후)(0NBR…). */
  orgBudget: number | null;
  /** 시책추진 업무추진비 당초예산 편성액(2020~). 출처: 시책추진 업무추진비(2020년 이후)(Y0Q9…). */
  policyBudget: number | null;
}

export interface Entity {
  /** 지방재정365 자치단체코드 7자리(예: 1111000 서울종로구). 앱의 유일키·URL. */
  code: string;
  /** 원문 자치단체명(예: 서울종로구, 경기본청). */
  fullName: string;
  /** 화면용 짧은 이름(예: 종로구). 광역은 시도 정식명(서울특별시). */
  name: string;
  /** 시도 접두어 2자리(코드 앞 두 자리, 예: '11'). lib/sido.ts 로 이름 변환. */
  sido: string;
  type: EntityType;
  /** 연도 오름차순. 빈 해는 넣지 않는다. */
  years: YearRecord[];
}

export interface SourceInfo {
  /** 지방재정365 데이터셋 ID(pdtaId). */
  pdtaId: string;
  /** 공공데이터포털 목록번호(있으면). */
  dataGoKr?: string;
  name: string;
  /** 실측 보유연도 범위. */
  years: [number, number];
  rows: number;
}

export interface ExpenseSnapshot {
  collectedAt: string;
  /** 결산 업무추진비(total) 가 있는 최신 연도 — 첫 화면 기본 연도. */
  latestYear: number;
  /** 기관운영/시책추진 분리(org/policy) 가 있는 최신 연도. total 보다 1년 늦다(실측). */
  latestSplitYear: number;
  sources: SourceInfo[];
  entities: Entity[];
}

/** 지자체 중심좌표(카카오맵 마커). data/centroids.json. */
export interface Centroid {
  lat: number;
  lng: number;
}

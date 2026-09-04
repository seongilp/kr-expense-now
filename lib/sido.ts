import type { EntityType } from './types';

/**
 * 시도 테이블. key 는 지방재정365 자치단체코드 앞 두 자리(실측 2024: 17종).
 * 강원·전북은 2023~2024 특별자치도로 개명됐다 — 정식명은 현재 명칭을 쓴다.
 */
export interface Sido {
  prefix: string;
  /** 약칭(원문 지역명과 같다). */
  short: string;
  /** 정식 명칭. 광역 지자체 카드 제목·검색어. */
  full: string;
}

export const SIDOS: readonly Sido[] = [
  { prefix: '11', short: '서울', full: '서울특별시' },
  { prefix: '26', short: '부산', full: '부산광역시' },
  { prefix: '27', short: '대구', full: '대구광역시' },
  { prefix: '28', short: '인천', full: '인천광역시' },
  { prefix: '29', short: '광주', full: '광주광역시' },
  { prefix: '30', short: '대전', full: '대전광역시' },
  { prefix: '31', short: '울산', full: '울산광역시' },
  { prefix: '32', short: '세종', full: '세종특별자치시' },
  { prefix: '41', short: '경기', full: '경기도' },
  { prefix: '42', short: '강원', full: '강원특별자치도' },
  { prefix: '43', short: '충북', full: '충청북도' },
  { prefix: '44', short: '충남', full: '충청남도' },
  { prefix: '45', short: '전북', full: '전북특별자치도' },
  { prefix: '46', short: '전남', full: '전라남도' },
  { prefix: '47', short: '경북', full: '경상북도' },
  { prefix: '48', short: '경남', full: '경상남도' },
  { prefix: '49', short: '제주', full: '제주특별자치도' },
];

const BY_PREFIX = new Map(SIDOS.map((s) => [s.prefix, s]));

export function sidoOf(prefix: string): Sido | undefined {
  return BY_PREFIX.get(prefix);
}

/** 코드 → 시도 접두어. 7자리 코드의 앞 두 자리. */
export function sidoPrefixOf(code: string): string {
  return code.slice(0, 2);
}

/** 유형 라벨(랭킹 그룹 이름). */
export const TYPE_LABEL: Record<EntityType, string> = {
  metro: '광역(시도)',
  si: '시',
  gun: '군',
  gu: '자치구',
};

/** 기초 지자체 3유형. 전국 랭킹의 기본 그룹 순서. */
export const TYPE_ORDER: readonly EntityType[] = ['si', 'gun', 'gu', 'metro'];

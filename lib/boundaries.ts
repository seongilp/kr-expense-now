/**
 * 지자체 경계 폴리곤(카카오맵 hover 하이라이트) 의 **매핑 규칙**. 순수 함수 — 스크립트(scripts/build-boundaries.ts) 와 테스트가 같이 쓴다.
 *
 * 출처: southkorea/southkorea-maps `kostat/2018/json/skorea-municipalities-2018-topo-simple.json` (250 피처).
 * 그쪽 코드는 통계청 5자리(시도 2자리 + 시군구 3자리), 우리 코드는 지방재정365 7자리라 **코드로 못 잇는다** —
 * 시도 접두어 표(PREFIX_2018) + 이름으로 잇고, 이름·시도가 둘 다 맞아야 매칭으로 친다.
 *
 * 함정:
 * - 2018 경계에는 **일반구**(수원시장안구, 창원시마산합포구 …) 가 따로 있다. 우리 단위는 시라서 `OO시XX구` 를 `OO시` 로 합친다(병합은 스크립트에서 topojson merge).
 * - 인천 미추홀구는 2018-07 개명이라 데이터엔 `남구`, 대구 군위군은 2023 편입이라 경북(37) 아래에 있다 → SPECIAL.
 * - 세종(29010) 은 광역이고 지도엔 광역 마커가 없어 매핑 대상이 아니다(스크립트가 "미사용 피처" 로 보고).
 */
import type { Entity } from './types';

/** 지방재정365 접두어 → 2018 KOSTAT 접두어(2013 과 같다). */
export const PREFIX_2018: Readonly<Record<string, string>> = {
  '11': '11',
  '26': '21',
  '27': '22',
  '28': '23',
  '29': '24',
  '30': '25',
  '31': '26',
  '32': '29',
  '41': '31',
  '42': '32',
  '43': '33',
  '44': '34',
  '45': '35',
  '46': '36',
  '47': '37',
  '48': '38',
  '49': '39',
};

/** 2018 경계와 이름·소속이 다른 곳. 우리 code → 경계 키(`<2018 접두어>_<이름>`). */
export const SPECIAL_KEYS: Readonly<Record<string, string>> = {
  '2813000': '23_남구', // 인천 미추홀구(2018-07 개명, 경계 데이터는 개명 전 이름)
  '2772000': '37_군위군', // 대구 군위군(2023-07 편입, 경계는 경북 아래)
};

export interface BoundaryFeatureRef {
  /** 통계청 5자리. */
  code: string;
  name: string;
}

/** 경계 피처 → 조인 키. `<접두어>_<이름>`. 일반구(`OO시XX구`) 는 `OO시` 로 접는다. */
export function featureKey(f: BoundaryFeatureRef): string {
  const prefix = f.code.slice(0, 2);
  const m = /^(.+?시)(.+구)$/.exec(f.name);
  return `${prefix}_${m ? m[1] : f.name}`;
}

/** 우리 지자체 → 조인 키. 광역은 대상이 아니라 null. */
export function entityKey(e: Pick<Entity, 'code' | 'name' | 'sido' | 'type'>): string | null {
  if (e.type === 'metro') return null;
  const special = SPECIAL_KEYS[e.code];
  if (special) return special;
  const prefix = PREFIX_2018[e.sido];
  return prefix ? `${prefix}_${e.name}` : null;
}

export interface BoundaryMatch {
  /** 우리 code → 그 지자체를 이루는 경계 피처 코드들(일반구가 있으면 여러 개). */
  matched: ReadonlyMap<string, readonly string[]>;
  /** 조인 키를 만들지 못했거나 피처가 없는 우리 지자체(`code fullName (key)`). */
  missing: readonly string[];
  /** 어느 지자체에도 붙지 않은 피처(`code name`). 세종 등. */
  unused: readonly string[];
}

/** 이름+시도 교차 매칭. 결과는 새 객체(입력 불변). */
export function matchBoundaries(entities: readonly Entity[], features: readonly BoundaryFeatureRef[]): BoundaryMatch {
  const byKey = new Map<string, string[]>();
  for (const f of features) {
    const k = featureKey(f);
    byKey.set(k, [...(byKey.get(k) ?? []), f.code]);
  }
  const matched = new Map<string, readonly string[]>();
  const missing: string[] = [];
  const usedKeys = new Set<string>();
  for (const e of entities) {
    if (e.type === 'metro') continue;
    const key = entityKey(e);
    const codes = key ? byKey.get(key) : undefined;
    if (!key || !codes) {
      missing.push(`${e.code} ${e.fullName} (${key ?? 'no-key'})`);
      continue;
    }
    matched.set(e.code, codes);
    usedKeys.add(key);
  }
  const unused = features.filter((f) => !usedKeys.has(featureKey(f))).map((f) => `${f.code} ${f.name}`);
  return { matched, missing, unused };
}

/** 위경도 → 소수 4자리(≈11m). 파일 크기 절반 이하로. */
export function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

/** 링 좌표 반올림 + 연속 중복점 제거(반올림으로 겹친 점). 새 배열. */
export function compactRing(ring: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  for (const [x, y] of ring) {
    const p: [number, number] = [round4(x), round4(y)];
    const last = out.at(-1);
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    out.push(p);
  }
  return out;
}

/**
 * public/boundaries.json 형식: code → 링 배열. 각 링은 `[lng, lat]` 배열(GeoJSON 순서).
 * MultiPolygon 의 모든 링(외곽·홀) 을 평평하게 담는다 — 카카오 Polygon 은 `LatLng[][]` 를 받고 겹치는 영역을 홀로 처리한다.
 */
export type BoundaryRings = [number, number][][];
export type BoundaryFile = Record<string, BoundaryRings>;

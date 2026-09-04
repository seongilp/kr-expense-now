import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { positionOf, standings, trendBars, typeMedianByYear } from '../detail';
import { computeRow } from '../rank';
import type { Entity, YearRecord } from '../types';

const yr = (year: number, total: number | null, extra: Partial<YearRecord> = {}): YearRecord => ({
  year,
  total,
  outlay: null,
  org: null,
  policy: null,
  standard: null,
  savingRate: null,
  population: null,
  orgBudget: null,
  policyBudget: null,
  ...extra,
});
const ent = (code: string, name: string, type: Entity['type'], years: YearRecord[]): Entity => ({
  code,
  fullName: name,
  name,
  sido: code.slice(0, 2),
  type,
  years,
});

const entities = [
  ent('1100000', '서울특별시', 'metro', [yr(2024, 9000)]),
  ent('1111000', '종로구', 'gu', [yr(2023, 500, { org: 100, policy: 300 }), yr(2024, 1000)]),
  ent('1112000', '중구', 'gu', [yr(2024, 700)]),
  ent('2611000', '부산중구', 'gu', [yr(2024, 1200)]),
  ent('4111000', '수원시', 'si', [yr(2024, 300)]),
];

describe('상세 순위', () => {
  it('positionOf: 값 없으면 null', () => {
    const rows = entities.map((e) => computeRow(e, 2024));
    assert.deepEqual(positionOf(rows, '1111000', 'total'), { rank: 3, of: 5 });
    assert.equal(positionOf(rows, '1112000', 'delta'), null);
  });
  it('전국은 같은 유형 안, 시도는 같은 시도 기초 안', () => {
    const s = standings(entities, '1111000', 2024);
    const total = s.find((x) => x.metric === 'total')!;
    assert.equal(total.value, 1000);
    assert.deepEqual(total.national, { rank: 2, of: 3 }); // 자치구 3곳 중
    assert.deepEqual(total.sido, { rank: 1, of: 2 }); // 서울 기초 2곳 중(본청 제외)
    assert.equal(total.typeMedian, 1000);
    const delta = s.find((x) => x.metric === 'delta')!;
    assert.equal(delta.value, 100);
    assert.deepEqual(delta.national, { rank: 1, of: 1 });
  });
  it('광역은 시도 순위 없음, 모르는 코드는 빈 배열', () => {
    const s = standings(entities, '1100000', 2024);
    assert.equal(s[0].sido, null);
    assert.deepEqual(s[0].national, { rank: 1, of: 1 });
    assert.deepEqual(standings(entities, '9999999', 2024), []);
  });
});

describe('추이', () => {
  it('총액 있는 해만 막대', () => {
    assert.deepEqual(trendBars(entities[1]), [
      { year: 2023, total: 500, org: 100, policy: 300 },
      { year: 2024, total: 1000, org: null, policy: null },
    ]);
  });
  it('같은 유형 연도별 중앙값', () => {
    const m = typeMedianByYear(entities, 'gu', [2023, 2024]);
    assert.equal(m.get(2023), 500);
    assert.equal(m.get(2024), 1000);
  });
});

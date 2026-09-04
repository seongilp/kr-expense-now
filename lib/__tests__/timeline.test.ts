import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { aggregateOf, clampYear, yearlySeries } from '../timeline';
import type { Entity, YearRecord } from '../types';

const yr = (year: number, p: Partial<YearRecord>): YearRecord => ({
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
  ...p,
});
const ent = (code: string, years: YearRecord[]): Entity => ({ code, fullName: code, name: code, sido: code.slice(0, 2), type: 'si', years });

const A = ent('4111000', [yr(2022, { total: 100, population: 10 }), yr(2023, { total: 200, population: 10 })]);
const B = ent('4112000', [yr(2022, { total: 50, population: 50 }), yr(2023, { total: 60, population: 50 })]);
const C = ent('4113000', [yr(2023, { total: 1000, population: 1 })]);
const all = [A, B, C];
const codes = new Set(['4111000', '4112000', '4113000']);

describe('yearlySeries', () => {
  it('금액 지표는 합계, null 만 있는 해는 null', () => {
    assert.equal(aggregateOf('total'), 'sum');
    assert.deepEqual(yearlySeries(all, codes, [2021, 2022, 2023], 'total'), [
      { year: 2021, value: null },
      { year: 2022, value: 150 },
      { year: 2023, value: 1260 },
    ]);
  });
  it('비율 지표는 중앙값(대도시에 안 끌려감)', () => {
    assert.equal(aggregateOf('perCapita'), 'median');
    // 2023 1인당: A 20, B 1.2, C 1000 → 중앙값 20
    assert.deepEqual(yearlySeries(all, codes, [2023], 'perCapita'), [{ year: 2023, value: 20 }]);
  });
  it('집합 밖 지자체는 세지 않고, 연도 순서를 그대로 지킨다', () => {
    const s = yearlySeries(all, new Set(['4111000']), [2023, 2022], 'total');
    assert.deepEqual(
      s.map((p) => p.year),
      [2023, 2022],
    );
    assert.deepEqual(
      s.map((p) => p.value),
      [200, 100],
    );
  });
  it('입력을 바꾸지 않는다', () => {
    const snapshot = JSON.stringify(all);
    yearlySeries(all, codes, [2022, 2023], 'delta');
    assert.equal(JSON.stringify(all), snapshot);
  });
});

describe('clampYear', () => {
  it('범위 안은 그대로, 밖은 끝으로', () => {
    const years = [2024, 2023, 2022];
    assert.equal(clampYear(2023, years), 2023);
    assert.equal(clampYear(1999, years), 2022);
    assert.equal(clampYear(2030, years), 2024);
  });
});

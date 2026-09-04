import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  availableYears,
  average,
  basicOfSido,
  computeRow,
  median,
  ofType,
  perCapita,
  rankBy,
  ratioPct,
  searchEntities,
  sortRows,
  yoyPct,
  type Row,
} from '../rank';
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

const ent = (code: string, name: string, type: Entity['type'], years: YearRecord[]): Entity => ({
  code,
  fullName: name,
  name,
  sido: code.slice(0, 2),
  type,
  years,
});

const A = ent('1111000', '종로구', 'gu', [
  yr(2023, { total: 800, outlay: 80_000, population: 100 }),
  yr(2024, { total: 1000, outlay: 100_000, population: 200, savingRate: 30 }),
]);
const B = ent('1112000', '중구', 'gu', [yr(2024, { total: 1000, outlay: 50_000, population: 0 })]);
const C = ent('1100000', '서울특별시', 'metro', [yr(2024, { total: 5000, outlay: 1_000_000, population: 1000 })]);
const D = ent('4111000', '수원시', 'si', [yr(2024, { total: 300, outlay: 10_000, population: 100 })]);
const rows = [A, B, C, D].map((e) => computeRow(e, 2024));

describe('기초 계산', () => {
  it('1인당: 인구 0/없음이면 null', () => {
    assert.equal(perCapita(1000, 200), 5);
    assert.equal(perCapita(1000, 0), null);
    assert.equal(perCapita(null, 200), null);
  });
  it('세출 대비 비율(%)', () => {
    assert.equal(ratioPct(1000, 100_000), 1);
    assert.equal(ratioPct(1000, null), null);
  });
  it('전년 대비 증감(%)', () => {
    assert.equal(yoyPct(1000, 800), 25);
    assert.equal(yoyPct(800, 1000), -20);
    assert.equal(yoyPct(1000, 0), null);
    assert.equal(yoyPct(1000, null), null);
  });
  it('computeRow: 전년 있으면 delta, 없으면 null. 없는 해는 전부 null', () => {
    const a = computeRow(A, 2024);
    assert.equal(a.delta, 25);
    assert.equal(a.perCapita, 5);
    assert.equal(a.ratio, 1);
    assert.equal(computeRow(B, 2024).delta, null);
    assert.equal(computeRow(B, 2024).perCapita, null);
    assert.equal(computeRow(A, 2019).total, null);
  });
});

describe('정렬·순위', () => {
  it('desc 정렬, null 은 항상 맨 뒤, 동률은 이름순', () => {
    const s = sortRows(rows, 'total');
    assert.deepEqual(
      s.map((r) => r.name),
      ['서울특별시', '종로구', '중구', '수원시'],
    );
    const pc = sortRows(rows, 'perCapita', 'asc');
    assert.equal(pc.at(-1)!.name, '중구'); // 인구 0 → null → 맨 뒤
    assert.equal(pc[0].name, '수원시'); // 300/100 = 3
  });
  it('동률은 같은 순위(1,1,3)', () => {
    const { rank, of } = rankBy(rows.filter((r) => r.type === 'gu'), 'total');
    assert.equal(rank.get('1111000'), 1);
    assert.equal(rank.get('1112000'), 1);
    assert.equal(of, 2);
    const three = rankBy(rows, 'total');
    assert.equal(three.rank.get('4111000'), 4);
  });
  it('null 은 순위 없음', () => {
    const { rank, of } = rankBy(rows, 'delta');
    assert.equal(rank.get('1111000'), 1);
    assert.equal(rank.has('1112000'), false);
    assert.equal(of, 1);
  });
  it('평균·중앙값은 null 제외', () => {
    assert.equal(average(rows, 'perCapita'), (5 + 5 + 3) / 3);
    assert.equal(median(rows, 'perCapita'), 5);
    assert.equal(average(rows, 'savingRate'), 30);
    assert.equal(median([] as Row[], 'total'), null);
  });
  it('유형·시도 필터', () => {
    assert.deepEqual(ofType(rows, 'gu').map((r) => r.name), ['종로구', '중구']);
    assert.deepEqual(basicOfSido(rows, '11').map((r) => r.name), ['종로구', '중구']); // 본청 제외
  });
});

describe('연도·검색', () => {
  it('결산 총액이 있는 연도만, 내림차순', () => {
    assert.deepEqual(availableYears([A, B]), [2024, 2023]);
  });
  it('이름 검색: 앞글자 일치 우선, 공백 무시, limit', () => {
    const ents = [A, B, C, D, ent('4113000', '성남시 분당구', 'gu', [])];
    assert.deepEqual(searchEntities(ents, '구').map((e) => e.name), ['성남시 분당구', '종로구', '중구']);
    assert.deepEqual(searchEntities(ents, '서울 특별').map((e) => e.name), ['서울특별시']);
    assert.equal(searchEntities(ents, '').length, 0);
    assert.equal(searchEntities(ents, '구', 1).length, 1);
  });
});

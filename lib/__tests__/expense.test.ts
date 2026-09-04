import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildEntities,
  canonicalCode,
  classify,
  fillReport,
  hasExpenseValue,
  savingRateOf,
  shortName,
  type RawBundle,
} from '../expense';

describe('유형·이름 정규화', () => {
  it('본청 = 광역, 끝 글자로 시/군/구', () => {
    assert.equal(classify('서울본청'), 'metro');
    assert.equal(classify('경기고양시'), 'si');
    assert.equal(classify('경북군위군'), 'gun');
    assert.equal(classify('부산부산진구'), 'gu');
    assert.throws(() => classify('이상한이름'));
  });
  it('짧은 이름: 시도 약칭 제거, 광역은 정식명', () => {
    assert.equal(shortName('서울종로구', '1111000'), '종로구');
    assert.equal(shortName('부산부산진구', '2623000'), '부산진구');
    assert.equal(shortName('강원본청', '4200000'), '강원특별자치도');
    assert.equal(shortName('세종본청', '3200000'), '세종특별자치시');
  });
  it('군위군 코드 별칭', () => {
    assert.equal(canonicalCode('4771000'), '2772000');
    assert.equal(canonicalCode('1111000'), '1111000');
  });
});

const bundle: RawBundle = {
  ratio: [
    { fyr: '2024', lafCd: '1111000', lafHgNm: '서울종로구', boe: 1000, aneStlAmt: 100000 },
    { fyr: '2023', lafCd: '1111000', lafHgNm: '서울종로구', boe: 800, aneStlAmt: 90000 },
    { fyr: '2024', lafCd: '2772000', lafHgNm: '대구군위군', boe: 500, aneStlAmt: 50000 },
    { fyr: '2023', lafCd: '4771000', lafHgNm: '경북군위군', boe: 450, aneStlAmt: 45000 },
    { fyr: '2013', lafCd: '4371000', lafHgNm: '충북청원군', boe: 1, aneStlAmt: 1 },
  ],
  saving: [
    { fyr: '2023', lafCd: '1111000', lafHgNm: '서울종로구', rate: 37.8, boeAmt1: 300, boeAmt2: 550, boeAmt3: 1367 },
  ],
  population: [
    { fyr: '2024', lafCd: '1111000', lafHgNm: '서울종로구', pptnNum: 140000 },
    { fyr: '2005', lafCd: '1111000', lafHgNm: '서울종로구', pptnNum: 150000 },
  ],
  orgBudget: [{ fyr: '2026', lafCd: '1111000', lafHgNm: '서울종로구', smyCnttAmt: 700, smyCnttAmt2: 1 }],
  policyBudget: [{ fyr: '2026', lafCd: '1111000', lafHgNm: '서울종로구', smyCnttAmt: 1, smyCnttAmt2: 900 }],
};

describe('절감률 재계산', () => {
  it('(1 − 결산/기준) × 100, 소수 2자리', () => {
    assert.equal(savingRateOf(300, 550, 1367), 37.82);
    assert.equal(savingRateOf(600, 500, 1000), -10);
    assert.equal(savingRateOf(1, 1, 0), null);
    assert.equal(savingRateOf(null, 1, 100), null);
  });
});

describe('buildEntities 조인', () => {
  const entities = buildEntities(bundle, 2024);
  it('최신 연도에 있는 지자체만, 코드순', () => {
    assert.deepEqual(
      entities.map((e) => e.code),
      ['1111000', '2772000'],
    );
  });
  it('연도별 값이 데이터셋별 컬럼에서 제자리에 들어간다', () => {
    const jongno = entities[0];
    assert.equal(jongno.name, '종로구');
    assert.equal(jongno.type, 'gu');
    const y24 = jongno.years.find((y) => y.year === 2024)!;
    assert.equal(y24.total, 1000);
    assert.equal(y24.outlay, 100000);
    assert.equal(y24.population, 140000);
    assert.equal(y24.org, null);
    const y23 = jongno.years.find((y) => y.year === 2023)!;
    assert.equal(y23.org, 300);
    assert.equal(y23.policy, 550);
    assert.equal(y23.standard, 1367);
    assert.equal(y23.savingRate, 37.82); // 원본 rate(37.8) 가 아니라 (1 − 850/1367) 로 재계산
    const y26 = jongno.years.find((y) => y.year === 2026)!;
    assert.equal(y26.orgBudget, 700);
    assert.equal(y26.policyBudget, 900);
    assert.equal(y26.total, null);
  });
  it('인구만 있는 해는 버린다', () => {
    assert.ok(!entities[0].years.some((y) => y.year === 2005));
    assert.equal(hasExpenseValue({ ...entities[0].years[0], total: null, org: null, orgBudget: null, policyBudget: null }), false);
  });
  it('군위군: 옛 코드의 2023 이 새 코드 시계열에 붙고 이름은 최신', () => {
    const gunwi = entities[1];
    assert.equal(gunwi.fullName, '대구군위군');
    assert.equal(gunwi.sido, '27');
    assert.deepEqual(
      gunwi.years.map((y) => [y.year, y.total]),
      [
        [2023, 450],
        [2024, 500],
      ],
    );
  });
  it('채움률 리포트', () => {
    const rep = fillReport(entities);
    assert.equal(rep[2024].rows, 2);
    assert.equal(rep[2024].total, 100);
    assert.equal(rep[2024].population, 50);
    assert.equal(rep[2023].org, 50);
  });
});

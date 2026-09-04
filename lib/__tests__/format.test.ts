import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDelta, formatPct, formatPeople, formatWon, formatWonExact } from '../format';

describe('금액 표기', () => {
  it('억 단위: 100억 미만은 소수 1자리, 이상은 정수', () => {
    assert.equal(formatWon(6_235_703_000), '62.4억');
    assert.equal(formatWon(12_345_678_900), '123억');
    assert.equal(formatWon(100_000_000), '1.0억');
  });
  it('만 단위·원 단위', () => {
    assert.equal(formatWon(45_639_390), '4,564만');
    assert.equal(formatWon(9_999), '9,999원');
    assert.equal(formatWon(0), '0원');
  });
  it('음수는 부호 유지, null 은 대시', () => {
    assert.equal(formatWon(-250_000_000), '-2.5억');
    assert.equal(formatWon(null), '—');
    assert.equal(formatWon(NaN), '—');
  });
  it('1인당은 원 그대로', () => {
    assert.equal(formatWonExact(1234.6), '1,235원');
    assert.equal(formatWonExact(undefined), '—');
  });
});

describe('비율 표기', () => {
  it('퍼센트 자릿수', () => {
    assert.equal(formatPct(0.0186), '0.02%');
    assert.equal(formatPct(29.654, 1), '29.7%');
    assert.equal(formatPct(null), '—');
  });
  it('증감은 항상 부호', () => {
    assert.equal(formatDelta(3.21), '+3.2%');
    assert.equal(formatDelta(-1.04), '-1.0%');
    assert.equal(formatDelta(0), '0.0%');
    assert.equal(formatDelta(null), '—');
  });
  it('인구', () => {
    assert.equal(formatPeople(9_299_548), '9,299,548명');
  });
});

describe('지표별 표기', () => {
  it('지표 키에 따라 억/원/% 를 고른다', async () => {
    const { formatMetric } = await import('../metric-format');
    assert.equal(formatMetric('total', 640_000_000), '6.4억');
    assert.equal(formatMetric('perCapita', 1930.6), '1,931원');
    assert.equal(formatMetric('ratio', 0.0648), '0.06%');
    assert.equal(formatMetric('delta', 0.6), '+0.6%');
    assert.equal(formatMetric('savingRate', 13.31), '13.3%');
    assert.equal(formatMetric('org', null), '—');
  });
});

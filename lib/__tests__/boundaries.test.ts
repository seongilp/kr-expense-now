import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compactRing, entityKey, featureKey, matchBoundaries, round4 } from '../boundaries';
import type { Entity } from '../types';

const ent = (code: string, name: string, type: Entity['type'], fullName = name): Entity => ({
  code,
  fullName,
  name,
  sido: code.slice(0, 2),
  type,
  years: [],
});

describe('경계 조인 키', () => {
  it('피처: 접두어_이름, 일반구는 시로 접는다', () => {
    assert.equal(featureKey({ code: '11010', name: '종로구' }), '11_종로구');
    assert.equal(featureKey({ code: '31011', name: '수원시장안구' }), '31_수원시');
    assert.equal(featureKey({ code: '38113', name: '창원시마산합포구' }), '38_창원시');
    assert.equal(featureKey({ code: '37011', name: '포항시남구' }), '37_포항시');
    // 시가 아닌 구·군·세종시는 그대로
    assert.equal(featureKey({ code: '21050', name: '부산진구' }), '21_부산진구');
    assert.equal(featureKey({ code: '29010', name: '세종시' }), '29_세종시');
  });
  it('지자체: 시도 접두어 변환 + 특례, 광역은 null', () => {
    assert.equal(entityKey(ent('2615000', '부산진구', 'gu')), '21_부산진구');
    assert.equal(entityKey(ent('4111000', '수원시', 'si')), '31_수원시');
    assert.equal(entityKey(ent('2813000', '미추홀구', 'gu')), '23_남구');
    assert.equal(entityKey(ent('2772000', '군위군', 'gun')), '37_군위군');
    assert.equal(entityKey(ent('1100000', '서울특별시', 'metro')), null);
  });
});

describe('matchBoundaries', () => {
  const features = [
    { code: '11010', name: '종로구' },
    { code: '21020', name: '서구' },
    { code: '23030', name: '남구' },
    { code: '29010', name: '세종시' },
    { code: '31011', name: '수원시장안구' },
    { code: '31012', name: '수원시권선구' },
    { code: '37310', name: '군위군' },
  ];
  it('이름+시도 둘 다 맞아야 붙고, 같은 이름 다른 시도는 섞이지 않는다', () => {
    const r = matchBoundaries(
      [ent('1111000', '종로구', 'gu'), ent('2612000', '서구', 'gu'), ent('2818000', '서구', 'gu', '인천서구'), ent('1100000', '서울특별시', 'metro')],
      features,
    );
    assert.deepEqual(r.matched.get('1111000'), ['11010']);
    assert.deepEqual(r.matched.get('2612000'), ['21020']);
    assert.equal(r.matched.has('2818000'), false);
    assert.deepEqual(r.missing, ['2818000 인천서구 (23_서구)']);
    assert.equal(r.matched.has('1100000'), false);
  });
  it('일반구는 시 하나로 여러 피처가 모이고, 특례(미추홀·군위) 가 붙는다', () => {
    const r = matchBoundaries([ent('4111000', '수원시', 'si'), ent('2813000', '미추홀구', 'gu'), ent('2772000', '군위군', 'gun')], features);
    assert.deepEqual(r.matched.get('4111000'), ['31011', '31012']);
    assert.deepEqual(r.matched.get('2813000'), ['23030']);
    assert.deepEqual(r.matched.get('2772000'), ['37310']);
    assert.deepEqual(r.missing, []);
    assert.deepEqual(r.unused, ['11010 종로구', '21020 서구', '29010 세종시']);
  });
});

describe('좌표 축약', () => {
  it('소수 4자리', () => {
    assert.equal(round4(126.97812345), 126.9781);
    assert.equal(round4(37.56655), 37.5666);
  });
  it('반올림으로 겹친 연속점 제거, 입력 불변', () => {
    const ring: [number, number][] = [
      [126.00001, 37.00001],
      [126.00002, 37.00002],
      [126.5, 37.5],
      [126.00001, 37.00001],
    ];
    const snapshot = JSON.stringify(ring);
    assert.deepEqual(compactRing(ring), [
      [126, 37],
      [126.5, 37.5],
      [126, 37],
    ]);
    assert.equal(JSON.stringify(ring), snapshot);
  });
});

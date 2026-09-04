/**
 * 지자체 중심좌표 → data/centroids.json (카카오맵 마커용).
 *
 * 출처: 형제앱 ipyang 이 번들한 southkorea-maps 2013 KOSTAT 시군구 경계(`public/sgg.geojson`, 230 폴리곤).
 * 폴리곤 꼭짓점 평균으로 중심을 잡는다(정밀 무게중심이 아니어도 마커 위치엔 충분). 광역 17곳은 시도청 좌표 하드코딩.
 *
 * 실행: `npm run centroids -- [geojson 경로]` (기본 ../ipyang/public/sgg.geojson). data/expense.json 이 먼저 있어야 한다.
 * 조인 키 = `<2013 시도코드 2자리>_<시군구명>`. 지방재정365 코드 접두어(11,26,27…)와 2013 코드(11,21,22…)가 달라 표로 잇는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Centroid, ExpenseSnapshot } from '../lib/types';

/** 지방재정365 접두어 → 2013 KOSTAT 접두어. */
const PREFIX_2013: Record<string, string> = {
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

/** 2013 경계와 이름/소속이 다른 곳. code → geojson 키. */
const SPECIAL: Record<string, string> = {
  '2813000': '23_남구', // 인천 미추홀구(2018 개명)
  '2772000': '37_군위군', // 대구 군위군(2023 편입, 경계는 경북에 있음)
};

/** 시도청 소재지(근사). 광역 마커는 도청 위치에 찍는다 — 폴리곤 중심은 바다·산에 떨어져 무의미. */
const METRO_SEAT: Record<string, Centroid> = {
  '11': { lat: 37.5665, lng: 126.978 },
  '26': { lat: 35.1796, lng: 129.0756 },
  '27': { lat: 35.8714, lng: 128.6014 },
  '28': { lat: 37.4563, lng: 126.7052 },
  '29': { lat: 35.1601, lng: 126.8514 },
  '30': { lat: 36.3504, lng: 127.3845 },
  '31': { lat: 35.5384, lng: 129.3114 },
  '32': { lat: 36.48, lng: 127.289 },
  '41': { lat: 37.289, lng: 127.0533 },
  '42': { lat: 37.8813, lng: 127.7298 },
  '43': { lat: 36.6357, lng: 127.4913 },
  '44': { lat: 36.6588, lng: 126.6728 },
  '45': { lat: 35.8203, lng: 127.1088 },
  '46': { lat: 34.8161, lng: 126.4629 },
  '47': { lat: 36.576, lng: 128.5056 },
  '48': { lat: 35.2383, lng: 128.6924 },
  '49': { lat: 33.489, lng: 126.4983 },
};

type Ring = [number, number][];
interface Feature {
  properties: { code: string };
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Ring[] | Ring[][] };
}

function centroidOf(f: Feature): Centroid {
  const rings: Ring[] =
    f.geometry.type === 'Polygon'
      ? (f.geometry.coordinates as Ring[])
      : (f.geometry.coordinates as Ring[][]).flat();
  // 외곽 링(각 폴리곤의 첫 링)만. 가장 큰 링 하나로 잡으면 다도해 군의 마커가 본섬에 온다.
  const outer = rings.reduce((best, r) => (r.length > best.length ? r : best), rings[0]);
  const n = outer.length;
  const [sx, sy] = outer.reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
  return { lat: Math.round((sy / n) * 1e4) / 1e4, lng: Math.round((sx / n) * 1e4) / 1e4 };
}

function main() {
  const geoPath = process.argv[2] ?? join(process.cwd(), '..', 'ipyang', 'public', 'sgg.geojson');
  const geo = JSON.parse(readFileSync(geoPath, 'utf8')) as { features: Feature[] };
  const byKey = new Map(geo.features.map((f) => [f.properties.code, centroidOf(f)]));

  const snap = JSON.parse(readFileSync(join(process.cwd(), 'data', 'expense.json'), 'utf8')) as ExpenseSnapshot;
  const out: Record<string, Centroid> = {};
  const missing: string[] = [];
  for (const e of snap.entities) {
    if (e.type === 'metro') {
      out[e.code] = METRO_SEAT[e.sido];
      continue;
    }
    const key = SPECIAL[e.code] ?? `${PREFIX_2013[e.sido]}_${e.name}`;
    const c = byKey.get(key);
    if (c) out[e.code] = c;
    else missing.push(`${e.code} ${e.fullName} (${key})`);
  }
  writeFileSync(join(process.cwd(), 'data', 'centroids.json'), JSON.stringify(out));
  console.log(`centroids: ${Object.keys(out).length}/${snap.entities.length}`);
  if (missing.length) {
    console.log('미매칭:');
    for (const m of missing) console.log('  ' + m);
    process.exit(1);
  }
}

main();

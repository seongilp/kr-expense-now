/**
 * 지자체 경계 폴리곤 → public/boundaries.json (카카오맵 마커 hover 하이라이트용).
 *
 * 출처: GitHub southkorea/southkorea-maps `kostat/2018/json/skorea-municipalities-2018-topo-simple.json` (TopoJSON, 250 피처, 540KB).
 * 매핑 규칙은 lib/boundaries.ts(테스트 있음). 일반구가 있는 시(수원·성남·안양·안산·고양·용인·청주·천안·전주·포항·창원) 는
 * topojson `merge` 로 공유 호를 지워 하나의 외곽선으로 합친다(그냥 링을 이어 붙이면 구 경계선이 안에 남는다).
 * 좌표는 소수 4자리로 줄인다(≈11m, 파일 ≈1MB → Vercel 정적 gzip).
 *
 * 실행: `npm run boundaries -- [topojson 경로|URL]`. data/expense.json 이 먼저 있어야 한다. 매핑 실패가 있으면 exit 1 (파일은 그래도 쓴다).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { merge } from 'topojson-client';
import type { GeometryCollection, MultiPolygon, Polygon, Topology } from 'topojson-specification';

import { compactRing, matchBoundaries, type BoundaryFeatureRef, type BoundaryFile, type BoundaryRings } from '../lib/boundaries';
import type { ExpenseSnapshot } from '../lib/types';

const DEFAULT_SRC =
  'https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo-simple.json';

interface Props {
  code: string;
  name: string;
}

async function loadTopology(src: string): Promise<Topology<{ [k: string]: GeometryCollection<Props> }>> {
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`경계 다운로드 실패 ${res.status} ${src}`);
    return (await res.json()) as Topology<{ [k: string]: GeometryCollection<Props> }>;
  }
  return JSON.parse(readFileSync(src, 'utf8')) as Topology<{ [k: string]: GeometryCollection<Props> }>;
}

/** 병합된 MultiPolygon 의 모든 링(외곽·홀) 을 축약해 평평하게. 점 3개 미만 링은 버린다. */
function ringsOf(multi: GeoJSON.MultiPolygon): BoundaryRings {
  return multi.coordinates
    .flat()
    .map((ring) => compactRing(ring as [number, number][]))
    .filter((ring) => ring.length >= 3);
}

async function main() {
  const src = process.argv[2] ?? DEFAULT_SRC;
  const topo = await loadTopology(src);
  const objectName = Object.keys(topo.objects)[0];
  const collection = topo.objects[objectName];
  if (!collection || collection.type !== 'GeometryCollection') throw new Error('TopoJSON GeometryCollection 이 아닙니다');
  const geometries = collection.geometries.filter(
    (g): g is Polygon<Props> | MultiPolygon<Props> => (g.type === 'Polygon' || g.type === 'MultiPolygon') && !!g.properties?.code && !!g.properties.name,
  );
  const refs: BoundaryFeatureRef[] = geometries.map((g) => ({ code: g.properties!.code, name: g.properties!.name }));

  const snap = JSON.parse(readFileSync(join(process.cwd(), 'data', 'expense.json'), 'utf8')) as ExpenseSnapshot;
  const { matched, missing, unused } = matchBoundaries(snap.entities, refs);

  const byCode = new Map(geometries.map((g) => [g.properties!.code, g]));
  const out: BoundaryFile = {};
  for (const [code, featureCodes] of matched) {
    const parts = featureCodes.map((c) => byCode.get(c)!);
    out[code] = ringsOf(merge(topo, parts));
  }
  const dest = join(process.cwd(), 'public', 'boundaries.json');
  const json = JSON.stringify(out);
  writeFileSync(dest, json);

  const basic = snap.entities.filter((e) => e.type !== 'metro').length;
  const points = Object.values(out).reduce((n, rings) => n + rings.reduce((m, r) => m + r.length, 0), 0);
  console.log(`boundaries: ${Object.keys(out).length}/${basic} 지자체, 피처 ${refs.length}개, 점 ${points.toLocaleString()}개, ${(json.length / 1024).toFixed(0)}KB → ${dest}`);
  if (unused.length) console.log(`미사용 피처(${unused.length}): ${unused.join(', ')}`);
  if (missing.length) {
    console.log(`매핑 실패(${missing.length}):`);
    for (const m of missing) console.log('  ' + m);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

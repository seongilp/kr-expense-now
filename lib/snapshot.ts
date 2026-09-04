/**
 * 서버 전용: data/expense.json · data/centroids.json(정적 스냅샷) 로더. 프로세스당 한 번 읽어 모듈 캐시에 둔다.
 * 런타임에 지방재정365/data.go.kr 을 부르지 않는다 — 갱신은 `npm run collect` + `npm run centroids` + 커밋(README).
 *
 * 파일 경로를 process.cwd() 기준 리터럴로 쓰는 이유: Vercel 의 output file tracing 이 이 패턴을 추적한다.
 * 페이지가 전부 빌드 시점에 정적 생성되므로(SSG) 런타임에 파일이 없어도 되지만, 혹시 동적 렌더로 바뀌어도
 * 죽지 않게 next.config 의 outputFileTracingIncludes 로 한 번 더 못 박아 둔다.
 */
import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Centroid, ExpenseSnapshot } from './types';

let cachedSnapshot: ExpenseSnapshot | null = null;
let cachedCentroids: Record<string, Centroid> | null = null;

export function loadSnapshot(): ExpenseSnapshot {
  if (cachedSnapshot) return cachedSnapshot;
  const raw = readFileSync(join(process.cwd(), 'data', 'expense.json'), 'utf8');
  const parsed = JSON.parse(raw) as ExpenseSnapshot;
  if (!Array.isArray(parsed.entities) || typeof parsed.latestYear !== 'number') {
    throw new Error('data/expense.json 형식이 다릅니다 — npm run collect 로 다시 생성하세요.');
  }
  cachedSnapshot = parsed;
  return parsed;
}

export function loadCentroids(): Record<string, Centroid> {
  if (cachedCentroids) return cachedCentroids;
  const raw = readFileSync(join(process.cwd(), 'data', 'centroids.json'), 'utf8');
  const parsed = JSON.parse(raw) as Record<string, Centroid>;
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('data/centroids.json 형식이 다릅니다 — npm run centroids 로 다시 생성하세요.');
  }
  cachedCentroids = parsed;
  return parsed;
}

/**
 * 지방재정365 데이터셋 5종 → data/expense.json 정적 스냅샷.
 *
 * 키·세션 없이 된다(data.go.kr 의 해당 pk 들은 LINK 유형이고, 지방재정365 다운로드 엔드포인트는 공개).
 * 실행: `npm run collect`. 결과 파일을 커밋하면 그게 배포다 — 앱 런타임은 외부 호출 0.
 *
 * 엔드포인트·컬럼·함정은 README "데이터" 절 참고. 여기서는 실측 리포트(연도별 채움률·이상치)도 같이 찍는다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildEntities, fillReport, type RawBundle, type RawRow } from '../lib/expense';
import type { ExpenseSnapshot, SourceInfo } from '../lib/types';

const ENDPOINT = 'https://www.lofin365.go.kr/lf/pfinDtaOpen/dtst/dtstSvi/retvDtstDtsExcelDown.do';

/** 데이터셋 정의. pdtaId 는 지방재정365 카탈로그(README) 에서 실측. */
const DATASETS: { key: keyof RawBundle; pdtaId: string; dataGoKr?: string; name: string }[] = [
  { key: 'ratio', pdtaId: '84474KEKQQDWO3LE7DGZ411505', dataGoKr: '15058050', name: '업무추진비비율' },
  { key: 'saving', pdtaId: 'PQNF58GR2UDN2RVS6SA11311409', dataGoKr: '15138863', name: '업무추진비 절감률' },
  { key: 'population', pdtaId: 'E8CLIL7H1FHQ3F38ON5W225441', name: '주민1인당세출예산액(인구수)' },
  { key: 'orgBudget', pdtaId: '0NBRILVNY8XNMW3IU42B1481891', name: '기관운영업무추진비(2020년 이후)' },
  {
    key: 'policyBudget',
    pdtaId: 'Y0Q9M38Z79Y0FE98RONI1495583',
    dataGoKr: '15138706',
    name: '시책추진 업무추진비(2020년 이후)',
  },
];

/** 한 데이터셋 전량. pageSize 를 크게 주면 한 번에 온다(실측 최대 6,370행). 응답 형식이 다르면 즉시 실패. */
async function fetchDataset(pdtaId: string): Promise<RawRow[]> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'User-Agent': 'Mozilla/5.0 (kr-expense-now collector)',
    },
    body: JSON.stringify({ pdtaId, pdtaSvTyCntt: 'S', curPage: 1, pageSize: 20000, ext: 'json' }),
  });
  if (!res.ok) throw new Error(`${pdtaId}: HTTP ${res.status}`);
  const json = (await res.json()) as { resultList?: unknown };
  if (!Array.isArray(json.resultList)) throw new Error(`${pdtaId}: resultList 가 배열이 아님`);
  const rows = json.resultList as RawRow[];
  for (const r of rows.slice(0, 3)) {
    if (typeof r.fyr !== 'string' || typeof r.lafCd !== 'string' || typeof r.lafHgNm !== 'string') {
      throw new Error(`${pdtaId}: 행 형식이 다름 ${JSON.stringify(r)}`);
    }
  }
  return rows;
}

function yearRange(rows: RawRow[]): [number, number] {
  const ys = rows.map((r) => Number(r.fyr)).filter(Number.isInteger);
  return [Math.min(...ys), Math.max(...ys)];
}

async function main() {
  const raw = {} as RawBundle;
  const sources: SourceInfo[] = [];
  for (const d of DATASETS) {
    const rows = await fetchDataset(d.pdtaId);
    raw[d.key] = rows;
    const years = yearRange(rows);
    sources.push({ pdtaId: d.pdtaId, dataGoKr: d.dataGoKr, name: d.name, years, rows: rows.length });
    console.log(`${d.name}: ${rows.length}행 ${years[0]}~${years[1]}`);
  }

  const latestYear = yearRange(raw.ratio)[1];
  const latestSplitYear = yearRange(raw.saving)[1];
  const entities = buildEntities(raw, latestYear);

  const snapshot: ExpenseSnapshot = {
    collectedAt: new Date().toISOString(),
    latestYear,
    latestSplitYear,
    sources,
    entities,
  };
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  const out = join(process.cwd(), 'data', 'expense.json');
  writeFileSync(out, JSON.stringify(snapshot));
  console.log(`\n→ ${out}: 지자체 ${entities.length}곳, 최신 결산 ${latestYear}, 분리 ${latestSplitYear}`);

  // 리포트: 유형 분포·연도별 채움률·이상치(전년 대비 2배↑/절반↓).
  const byType: Record<string, number> = {};
  for (const e of entities) byType[e.type] = (byType[e.type] ?? 0) + 1;
  console.log('유형:', byType);
  console.log('연도별 채움률(%):');
  console.table(fillReport(entities));

  const outliers: string[] = [];
  for (const e of entities) {
    for (let i = 1; i < e.years.length; i++) {
      const a = e.years[i - 1].total;
      const b = e.years[i].total;
      if (a && b && (b / a > 2 || b / a < 0.5)) {
        outliers.push(`${e.fullName} ${e.years[i - 1].year}→${e.years[i].year}: ${a} → ${b}`);
      }
    }
  }
  console.log(`이상치(전년 대비 2배↑/절반↓) ${outliers.length}건:`);
  for (const o of outliers) console.log('  ' + o);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

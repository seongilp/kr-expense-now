'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { ArrowDownUp, Landmark, ListOrdered, Map as MapIcon } from 'lucide-react';

import { formatMetric } from '@/lib/metric-format';
import { METRICS, availableYears, basicOfSido, computeRow, median, ofType, rankBy, sortRows, type Metric, type SortDir } from '@/lib/rank';
import { SIDOS, TYPE_LABEL, TYPE_ORDER, sidoOf } from '@/lib/sido';
import type { Centroid, Entity, EntityType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ExpenseMap } from '@/components/expense-map';
import { RankingTable } from '@/components/ranking-table';
import { SearchBox } from '@/components/search-box';
import { SidoPicker } from '@/components/sido-picker';

/**
 * 앱 본체(클라이언트). 서버가 스냅샷 전체(243곳 × 연도) 를 props 로 넘기고, 연도·지표·정렬·탭 전환은
 * 전부 브라우저 메모리에서 돈다(243행 계산 ≈ 1ms). 서버 왕복 0.
 *
 * 탭: 시도 랭킹(기본) · 전국 랭킹(같은 유형끼리) · 지도(카카오, 키 없으면 안내).
 * 시도 선택은 localStorage 에 기억한다(다음 방문에 우리 동네가 바로 뜨게). 위치 권한은 쓰지 않는다.
 */
type Tab = 'sido' | 'national' | 'map';

const SIDO_STORAGE_KEY = 'kr-expense-now:sido';
const DEFAULT_SIDO = '11';

function readStoredSido(): string {
  try {
    const v = localStorage.getItem(SIDO_STORAGE_KEY);
    return v && sidoOf(v) ? v : DEFAULT_SIDO;
  } catch {
    return DEFAULT_SIDO;
  }
}
/* localStorage 를 외부 스토어로 구독. 서버/하이드레이션 스냅샷은 기본값이라 마크업 불일치가 없다. */
const noopSubscribe = () => () => {};
const serverSido = () => DEFAULT_SIDO;

interface Props {
  entities: Entity[];
  centroids: Record<string, Centroid>;
  latestYear: number;
  latestSplitYear: number;
}

export function ExpenseBrowser({ entities, centroids, latestYear, latestSplitYear }: Props) {
  const [tab, setTab] = useState<Tab>('sido');
  const storedSido = useSyncExternalStore(noopSubscribe, readStoredSido, serverSido);
  const [sidoPick, setSidoPick] = useState<string | null>(null);
  const sido = sidoPick ?? storedSido;
  const [year, setYear] = useState(latestYear);
  const [metric, setMetric] = useState<Metric>('total');
  const [dir, setDir] = useState<SortDir>('desc');
  const [type, setType] = useState<EntityType>('si');

  const pickSido = (p: string) => {
    setSidoPick(p);
    try {
      localStorage.setItem(SIDO_STORAGE_KEY, p);
    } catch {
      /* 프라이빗 모드 등 — 기억 못 해도 동작엔 지장 없음 */
    }
  };

  const years = useMemo(() => availableYears(entities), [entities]);
  const rows = useMemo(() => entities.map((e) => computeRow(e, year)), [entities, year]);

  const sidoRows = useMemo(() => basicOfSido(rows, sido), [rows, sido]);
  const basicRows = useMemo(() => rows.filter((r) => r.type !== 'metro'), [rows]);
  const focusCodes = useMemo(() => new Set(sidoRows.map((r) => r.code)), [sidoRows]);
  const nationalRows = useMemo(() => ofType(rows, type), [rows, type]);
  const shown = tab === 'national' ? nationalRows : sidoRows;
  const sorted = useMemo(() => sortRows(shown, metric, dir), [shown, metric, dir]);
  const { rank } = useMemo(() => rankBy(shown, metric), [shown, metric]);

  const onSort = (m: Metric) => {
    if (m === metric) setDir(dir === 'desc' ? 'asc' : 'desc');
    else {
      setMetric(m);
      setDir('desc');
    }
  };

  const sidoName = sidoOf(sido)?.full ?? '';
  const metroRow = rows.find((r) => r.sido === sido && r.type === 'metro');
  const splitMissing = year > latestSplitYear;
  const splitMetric = metric === 'org' || metric === 'policy' || metric === 'savingRate';

  return (
    <div className="space-y-5">
      <SearchBox entities={entities} />

      {/* 탭 */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1" role="tablist">
        <TabButton active={tab === 'sido'} onClick={() => setTab('sido')} icon={<Landmark className="size-4" />}>
          시도 랭킹
        </TabButton>
        <TabButton active={tab === 'national'} onClick={() => setTab('national')} icon={<ListOrdered className="size-4" />}>
          전국 랭킹
        </TabButton>
        <TabButton active={tab === 'map'} onClick={() => setTab('map')} icon={<MapIcon className="size-4" />}>
          지도
        </TabButton>
      </div>

      {tab !== 'national' && <SidoPicker value={sido} onChange={pickSido} />}
      {tab === 'national' && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="지자체 유형">
          {TYPE_ORDER.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)}>
              {TYPE_LABEL[t]} {ofType(rows, t).length}
            </Chip>
          ))}
        </div>
      )}

      {/* 연도 · 지표 · 방향 */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">연도</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-border bg-card px-2 py-1 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="정렬 지표">
          {METRICS.map((m) => (
            <Chip key={m.key} active={metric === m.key} onClick={() => onSort(m.key)}>
              {m.short}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowDownUp className="size-3" />
          {dir === 'desc' ? '많은 순' : '적은 순'}
        </button>
      </div>

      {splitMissing && (
        <p
          className={cn(
            'rounded-md border px-3 py-2 text-xs',
            splitMetric ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-border bg-card/50 text-muted-foreground',
          )}
        >
          기관운영·시책추진·절감률은 {latestSplitYear}년 결산까지만 공개됐습니다(분리 데이터셋이 1년 늦음). {year}년은 합계·1인당·세출대비·전년비만
          있습니다{splitMetric ? ` — 이 지표로 보려면 연도를 ${latestSplitYear}로 바꾸세요.` : '.'}
        </p>
      )}

      {tab === 'map' ? (
        <ExpenseMap rows={basicRows} focusCodes={focusCodes} centroids={centroids} metric={metric} />
      ) : (
        <>
          <Summary
            title={tab === 'national' ? `전국 ${TYPE_LABEL[type]} ${year}년` : `${sidoName} 시군구 ${year}년`}
            count={shown.length}
            metric={metric}
            median={median(shown, metric)}
            metroLine={
              tab === 'sido' && metroRow
                ? `${sidoName} 본청 ${METRICS.find((m) => m.key === metric)?.short}: ${formatMetric(metric, metroRow[metric])}`
                : null
            }
            metroHref={tab === 'sido' && metroRow ? `/g/${metroRow.code}` : null}
          />
          <RankingTable rows={sorted} rank={rank} metric={metric} dir={dir} onSort={onSort} showSido={tab === 'national'} />
        </>
      )}

      {tab === 'sido' && sidoRows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {sidoName}은 기초 지자체가 없습니다. 본청은 전국 랭킹의 &ldquo;광역(시도)&rdquo; 에서 비교하세요.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        시도 {SIDOS.length}곳 · 지자체 {entities.length}곳 · 결산 {years.at(-1)}~{years[0]}
      </p>
    </div>
  );
}

function Summary({
  title,
  count,
  metric,
  median: med,
  metroLine,
  metroHref,
}: {
  title: string;
  count: number;
  metric: Metric;
  median: number | null;
  metroLine: string | null;
  metroHref: string | null;
}) {
  const label = METRICS.find((m) => m.key === metric)?.short ?? metric;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-base font-semibold">
        {title} <span className="text-sm font-normal text-muted-foreground">{count}곳</span>
      </h2>
      <p className="text-xs text-muted-foreground">
        {label} 중앙값 {formatMetric(metric, med)}
        {metroLine && (
          <>
            {' · '}
            <a href={metroHref ?? '#'} className="hover:text-primary hover:underline">
              {metroLine}
            </a>
          </>
        )}
      </p>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

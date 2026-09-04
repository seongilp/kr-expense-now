import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';

import { formatDelta, formatPct, formatWon, formatWonExact } from '@/lib/format';
import { METRICS, type Metric, type Row, type SortDir } from '@/lib/rank';
import { sidoOf } from '@/lib/sido';
import { cn } from '@/lib/utils';

/**
 * 랭킹 표. rows 는 이미 정렬된 상태로 받는다(정렬·순위는 lib/rank.ts, 이 컴포넌트는 그리기만).
 * 컬럼 헤더 클릭 = 그 지표로 정렬, 같은 헤더 재클릭 = 방향 토글. 모바일은 가로 스크롤(컬럼을 숨기면 비교가 안 된다).
 */
interface Props {
  rows: readonly Row[];
  /** code → 순위(같은 집합 안). */
  rank: ReadonlyMap<string, number>;
  metric: Metric;
  dir: SortDir;
  onSort: (metric: Metric) => void;
  /** 전국 탭에서 시도 컬럼 표시. */
  showSido?: boolean;
  /** 강조할 코드(상세에서 돌아왔을 때 등). */
  highlight?: string | null;
}

export function RankingTable({ rows, rank, metric, dir, onSort, showSido = false, highlight = null }: Props) {
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">이 조건에 해당하는 지자체가 없습니다.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-card text-xs text-muted-foreground">
          <tr>
            <th className="w-10 px-2 py-2 text-right font-medium">#</th>
            <th className="px-2 py-2 text-left font-medium">지자체</th>
            {METRICS.map((m) => (
              <th key={m.key} className="px-1 py-1 text-right font-medium">
                <button
                  type="button"
                  onClick={() => onSort(m.key)}
                  aria-sort={metric === m.key ? (dir === 'desc' ? 'descending' : 'ascending') : undefined}
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded px-1 py-1 hover:text-foreground',
                    metric === m.key && 'text-primary',
                  )}
                >
                  {m.short}
                  {metric === m.key &&
                    (dir === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.code}
              className={cn(
                'border-t border-border/60 hover:bg-card/70',
                highlight === r.code && 'bg-primary/10',
                r[metric] === null && 'text-muted-foreground',
              )}
            >
              <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{rank.get(r.code) ?? '—'}</td>
              <td className="px-2 py-1.5">
                <Link href={`/g/${r.code}`} className="font-medium hover:text-primary hover:underline">
                  {r.name}
                </Link>
                {showSido && r.type !== 'metro' && (
                  <span className="ml-1 text-xs text-muted-foreground">{sidoOf(r.sido)?.short}</span>
                )}
              </td>
              <Cell active={metric === 'total'}>{formatWon(r.total)}</Cell>
              <Cell active={metric === 'org'}>{formatWon(r.org)}</Cell>
              <Cell active={metric === 'policy'}>{formatWon(r.policy)}</Cell>
              <Cell active={metric === 'perCapita'}>{formatWonExact(r.perCapita)}</Cell>
              <Cell active={metric === 'ratio'}>{formatPct(r.ratio)}</Cell>
              <Cell active={metric === 'delta'} tone={deltaTone(r.delta)}>
                {formatDelta(r.delta)}
              </Cell>
              <Cell active={metric === 'savingRate'} tone={savingTone(r.savingRate)}>
                {formatPct(r.savingRate, 1)}
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ active, tone, children }: { active: boolean; tone?: string; children: React.ReactNode }) {
  return <td className={cn('px-2 py-1.5 text-right tabular-nums', active && 'font-semibold', tone)}>{children}</td>;
}

/** 증감: 늘면 빨강, 줄면 초록(돈을 덜 쓴 쪽이 좋은 소식). */
export function deltaTone(v: number | null): string {
  if (v === null) return '';
  if (v > 0) return 'text-rose-400';
  if (v < 0) return 'text-emerald-400';
  return '';
}

/** 절감률: 음수 = 기준액 초과 집행. */
export function savingTone(v: number | null): string {
  if (v === null) return '';
  return v < 0 ? 'text-rose-400' : '';
}

import { formatWon } from '@/lib/format';
import type { TrendBar } from '@/lib/detail';

/**
 * 연도별 업무추진비 추이 — 차트 라이브러리 없이 SVG 막대. 서버 컴포넌트에서도 그려진다(훅 없음).
 * 막대 = 결산 합계. 분리값이 있는 해는 막대를 기관운영(아래)/시책추진(위) 로 쌓고, 없는 해는 단색.
 * 비교선 = 같은 유형의 연도별 중앙값(점선).
 */
interface Props {
  bars: readonly TrendBar[];
  /** year → 같은 유형 중앙값. */
  median: ReadonlyMap<number, number | null>;
}

const W = 640;
const H = 220;
const PAD = { top: 16, right: 8, bottom: 28, left: 52 };

export function TrendChart({ bars, median }: Props) {
  if (bars.length === 0) return <p className="text-sm text-muted-foreground">추이를 그릴 결산 데이터가 없습니다.</p>;
  const maxVal = Math.max(...bars.map((b) => b.total), ...bars.map((b) => median.get(b.year) ?? 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / bars.length;
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;
  const x = (i: number) => PAD.left + slot * i + slot / 2;

  // 눈금 4단.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * maxVal);
  const medianPoints = bars
    .map((b, i) => {
      const m = median.get(b.year);
      return m === null || m === undefined ? null : `${x(i)},${y(m)}`;
    })
    .filter((p): p is string => p !== null);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="연도별 업무추진비 추이">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>
              {formatWon(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = x(i) - barW / 2;
          const split = b.org !== null && b.policy !== null;
          return (
            <g key={b.year}>
              <title>
                {b.year}년 합계 {formatWon(b.total)}
                {split ? ` (기관운영 ${formatWon(b.org)} · 시책추진 ${formatWon(b.policy)})` : ''}
              </title>
              {split ? (
                <>
                  <rect x={cx} y={y(b.org as number)} width={barW} height={innerH + PAD.top - y(b.org as number)} className="fill-sky-700" />
                  <rect x={cx} y={y(b.total)} width={barW} height={y(b.org as number) - y(b.total)} className="fill-primary" />
                </>
              ) : (
                <rect x={cx} y={y(b.total)} width={barW} height={innerH + PAD.top - y(b.total)} className="fill-primary/70" />
              )}
              <text x={x(i)} y={H - 10} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
                {bars.length > 12 && i % 2 ? '' : String(b.year).slice(2)}
              </text>
            </g>
          );
        })}
        {medianPoints.length > 1 && (
          <polyline points={medianPoints.join(' ')} fill="none" className="stroke-amber-400" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-sky-700" />기관운영</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-primary" />시책추진</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block size-2.5 rounded-sm bg-primary/70" />합계(분리값 없는 해)</span>
        <span className="inline-flex items-center gap-1"><i className="inline-block h-0 w-4 border-t-2 border-dashed border-amber-400" />같은 유형 중앙값</span>
      </figcaption>
    </figure>
  );
}

'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { clampYear, type YearPoint } from '@/lib/timeline';
import { cn } from '@/lib/utils';

/**
 * 연도 타임라인 슬라이더. 연도축 위에 지금 보이는 집합의 연도별 값(합계/중앙값) 을 막대로 깔고, 그 위를 드래그해 연도를 고른다.
 * 드래그 중 매 스텝마다 onChange → 표·지도가 실시간으로 따라온다(계산이 ms 단위라 throttle 없음).
 *
 * 입력 처리는 투명한 `<input type=range>` 를 SVG 위에 겹쳐서 맡긴다 — 마우스 드래그·터치·키보드(←/→·Home/End)·스크린리더를
 * 브라우저가 공짜로 해 준다. SVG 는 그림만 그린다(라이브러리 없음). 양옆 ◀ ▶ 는 한 해씩 이동, 끝에서 비활성.
 */
interface Props {
  /** 선택 가능한 연도(정렬 무관). 최소~최대 사이의 빈 해는 슬라이더에서 값 없는 막대로 보인다. */
  years: readonly number[];
  year: number;
  onChange: (year: number) => void;
  /** 오름차순 연도별 값. years 와 같은 범위여야 한다. */
  series: readonly YearPoint[];
  /** 막대 값 표기(예: formatMetric). 핸들 라벨에 쓴다. */
  format: (v: number | null) => string;
  /** 막대가 뭔지 한 줄(예: "서울특별시 시군구 합계"). aria-label 과 캡션. */
  caption: string;
}

const HEIGHT = 64;
/** 핸들 라벨 영역(위) 과 연도 눈금 영역(아래) 높이. */
const TOP = 18;
const BOTTOM = 14;
const BAR_GAP_RATIO = 0.25;

export function YearPicker({ years, year, onChange, series, format, caption }: Props) {
  const min = Math.min(...years);
  const max = Math.max(...years);
  const n = max - min + 1;
  const slot = 100 / n;
  const barW = slot * (1 - BAR_GAP_RATIO);
  const values = series.map((p) => p.value).filter((v): v is number => v !== null);
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = hi - lo || 1;
  const plotH = HEIGHT - TOP - BOTTOM;
  const yOf = (v: number) => TOP + ((hi - v) / span) * plotH;
  const zeroY = yOf(0);
  const current = series.find((p) => p.year === year);
  const centerPct = (year - min + 0.5) * slot;
  const anchor = centerPct < 14 ? 'start' : centerPct > 86 ? 'end' : 'middle';
  const labelX = anchor === 'start' ? Math.max(0, centerPct - 4) : anchor === 'end' ? Math.min(100, centerPct + 4) : centerPct;
  const step = (d: number) => onChange(clampYear(year + d, years));
  /* 연도 눈금은 폭이 좁으면 겹치니 양끝 + 5년 단위만. 5년 눈금이 양끝에 붙으면(2009·2010) 모바일에서 겹쳐 뺀다. */
  const ticks = series.filter((p) => p.year === min || p.year === max || (p.year % 5 === 0 && p.year - min >= 2 && max - p.year >= 2));

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <StepButton onClick={() => step(-1)} disabled={year <= min} label="이전 연도">
          <ChevronLeft className="size-4" />
        </StepButton>
        <div className="relative min-w-0 flex-1 touch-none rounded-md focus-within:ring-2 focus-within:ring-primary/50" style={{ height: HEIGHT }}>
          <svg width="100%" height={HEIGHT} className="block select-none" aria-hidden="true">
            {series.map((p) => {
              if (p.value === null) return null;
              const x = (p.year - min) * slot + (slot - barW) / 2;
              const y = Math.min(yOf(p.value), zeroY);
              const h = Math.max(1, Math.abs(yOf(p.value) - zeroY));
              return (
                <rect
                  key={p.year}
                  x={`${x}%`}
                  width={`${barW}%`}
                  y={y}
                  height={h}
                  rx={1.5}
                  className={cn('transition-colors', p.year === year ? 'fill-primary' : 'fill-muted-foreground/30')}
                />
              );
            })}
            {lo < 0 && <line x1="0" x2="100%" y1={zeroY} y2={zeroY} className="stroke-border" strokeWidth={1} />}
            {ticks.map((p) => (
              <text
                key={p.year}
                x={`${(p.year - min + 0.5) * slot}%`}
                y={HEIGHT - 3}
                textAnchor="middle"
                className="fill-muted-foreground text-[9px]"
              >
                {p.year}
              </text>
            ))}
            <line x1={`${centerPct}%`} x2={`${centerPct}%`} y1={TOP - 4} y2={HEIGHT - BOTTOM + 2} className="stroke-primary" strokeWidth={1.5} />
            <text x={`${labelX}%`} y={TOP - 6} textAnchor={anchor} className="fill-foreground text-[11px] font-semibold">
              {year}
              <tspan className="fill-muted-foreground font-normal"> {current ? format(current.value) : '—'}</tspan>
            </text>
          </svg>
          <input
            type="range"
            min={min}
            max={max}
            step={1}
            value={year}
            onChange={(e) => onChange(clampYear(Number(e.target.value), years))}
            aria-label={`연도 선택 — ${caption}`}
            aria-valuetext={`${year}년 ${current ? format(current.value) : ''}`}
            className="absolute inset-0 m-0 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
        <StepButton onClick={() => step(1)} disabled={year >= max} label="다음 연도">
          <ChevronRight className="size-4" />
        </StepButton>
      </div>
      <p className="text-[11px] text-muted-foreground">
        막대 = {caption} · 끌거나 ←/→ 로 연도를 바꾸면 표·지도가 바로 따라옵니다
      </p>
    </div>
  );
}

function StepButton({ onClick, disabled, label, children }: { onClick: () => void; disabled: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

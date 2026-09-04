import { formatDelta, formatPct, formatWon, formatWonExact } from './format';
import type { Metric } from './rank';

/** 지표 키에 맞는 표기. 표·지도·상세가 같은 함수를 쓴다. */
export function formatMetric(metric: Metric, v: number | null | undefined): string {
  switch (metric) {
    case 'perCapita':
      return formatWonExact(v);
    case 'ratio':
      return formatPct(v);
    case 'delta':
      return formatDelta(v);
    case 'savingRate':
      return formatPct(v, 1);
    default:
      return formatWon(v);
  }
}

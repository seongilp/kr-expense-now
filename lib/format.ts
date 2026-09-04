/**
 * 금액·비율 표기(순수). 원 단위 정수를 한국식 억/만 단위로.
 *
 * 규칙: ≥1억 → "12.3억", ≥1만 → "4,560만", 그 미만 → "1,234원". 음수는 부호를 앞에.
 * 1인당은 원 단위가 대부분 수백~수천 원이라 "원" 그대로.
 */
const EOK = 100_000_000;
const MAN = 10_000;

export function formatWon(won: number | null | undefined): string {
  if (won === null || won === undefined || !Number.isFinite(won)) return '—';
  const sign = won < 0 ? '-' : '';
  const abs = Math.abs(won);
  if (abs >= EOK) {
    const v = abs / EOK;
    return `${sign}${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1)}억`;
  }
  if (abs >= MAN) return `${sign}${Math.round(abs / MAN).toLocaleString('ko-KR')}만`;
  return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`;
}

/** 원 단위 그대로(1인당 등 작은 수). */
export function formatWonExact(won: number | null | undefined): string {
  if (won === null || won === undefined || !Number.isFinite(won)) return '—';
  return `${Math.round(won).toLocaleString('ko-KR')}원`;
}

/** 퍼센트. digits 기본 2. null → "—". */
export function formatPct(pct: number | null | undefined, digits = 2): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  return `${pct.toFixed(digits)}%`;
}

/** 전년 대비 증감률. 부호를 항상 붙인다(+3.2% / -1.0%). */
export function formatDelta(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/** 인구. 12,345명. */
export function formatPeople(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('ko-KR')}명`;
}

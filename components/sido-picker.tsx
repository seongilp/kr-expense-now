import { SIDOS } from '@/lib/sido';
import { cn } from '@/lib/utils';

/** 첫 화면의 시도 17개 칩. 위치는 사용자가 직접 고른다(지오코딩 없음 — 브라우저 위치로 시도를 맞추는 건 별도 API 가 필요). */
export function SidoPicker({ value, onChange }: { value: string; onChange: (prefix: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="시도 선택">
      {SIDOS.map((s) => (
        <button
          key={s.prefix}
          type="button"
          role="radio"
          aria-checked={value === s.prefix}
          onClick={() => onChange(s.prefix)}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            value === s.prefix
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          {s.short}
        </button>
      ))}
    </div>
  );
}

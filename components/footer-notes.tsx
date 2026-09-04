import type { SourceInfo } from '@/lib/types';

/**
 * 페이지 하단 정의·출처. 숫자를 보는 사람이 "이게 뭘 잰 거지" 를 여기서 확인할 수 있어야 한다.
 * 정의는 README "데이터" 절과 같은 말로 유지한다.
 */
export function FooterNotes({
  sources,
  latestYear,
  latestSplitYear,
  collectedAt,
}: {
  sources: readonly SourceInfo[];
  latestYear: number;
  latestSplitYear: number;
  collectedAt: string;
}) {
  return (
    <footer className="mt-10 space-y-3 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
        <dt className="font-medium text-foreground">업무추진비</dt>
        <dd>
          기관운영 업무추진비 + 시책추진 업무추진비. <b>결산(집행) 기준</b>, 일반회계. 편성(예산)액이 아니라 실제로 쓴 돈이다.
          합계는 {latestYear}년까지, 기관운영·시책추진 분리값은 {latestSplitYear}년까지 있다(분리 데이터셋이 1년 늦게
          공개됨). 분리값은 일반회계+기타특별회계 기준이라 합계와 1~2% 차이가 날 수 있다.
        </dd>
        <dt className="font-medium text-foreground">주민 1인당</dt>
        <dd>업무추진비 합계 ÷ 주민등록 인구(같은 해, 지방재정365 「주민1인당 세출예산액」 의 인구수).</dd>
        <dt className="font-medium text-foreground">세출 대비</dt>
        <dd>업무추진비 합계 ÷ 세출결산액(일반회계) × 100. 살림 규모 대비 얼마나 쓰는지.</dd>
        <dt className="font-medium text-foreground">전년 대비</dt>
        <dd>합계의 전년 대비 증감률. 행정구역 개편(통합·편입) 해에는 튀는 값이 나올 수 있다.</dd>
        <dt className="font-medium text-foreground">절감률</dt>
        <dd>
          (1 − 결산액 ÷ 기준액) × 100. 기준액은 행안부 「지방자치단체 세출예산 집행기준」 상한. 음수는 기준액을 넘겨 집행했다는
          뜻. 클수록 덜 쓴 것 — 다른 지표와 방향이 반대다.
        </dd>
        <dt className="font-medium text-foreground">순위</dt>
        <dd>
          같은 유형(광역 / 시 / 군 / 자치구)끼리만 비교한다. 시도 랭킹은 그 시도의 기초 지자체만(본청 제외). 값이 없는 곳은
          순위에서 뺀다. 동률은 같은 순위.
        </dd>
      </dl>
      <p>
        출처: 행정안전부 지방재정365(lofin365.go.kr) 공개 데이터셋 —{' '}
        {sources.map((s, i) => (
          <span key={s.pdtaId}>
            {i > 0 && ' · '}
            {s.name}({s.years[0]}~{s.years[1]})
          </span>
        ))}
        . 스냅샷 {collectedAt.slice(0, 10)} 기준, 실시간이 아니다. 지자체 코드는 지방재정365 자치단체코드.
      </p>
    </footer>
  );
}

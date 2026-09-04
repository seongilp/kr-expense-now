# 업추비나우 (kr-expense-now)

전국 243개 지자체 업무추진비(기관운영·시책추진) 랭킹 + 카카오지도. "OO나우" 패밀리.

- 타이틀: `업추비나우 — 우리 동네 업무추진비 랭킹`
- 배포 목표: https://kr-expense-now.vercel.app (Vercel scope `seongilp`, 프로젝트 `kr-expense-now`, region icn1)
- GitHub 목표: `seongilp/kr-expense-now`

## 데이터 (행안부 지방재정365, data.go.kr)

| pk | 내용 |
|---|---|
| 15138696 | 기관운영 업무추진비 |
| 15138705 | 시책추진 업무추진비 |
| 15058050 | 업무추진비 비율 |
| 15138863 | 업무추진비 절감률 |

- 키: `~/.env` 의 `DATA_GO_KR_KEY`(=`HORSE`, **인코딩 키 — verbatim 사용, 재인코딩 금지**). 활용신청은 curl(`saveDevAcountRequest.do`, `testStepAtmcConfmAt=Y`)로 자동승인.
- 런타임 data.go.kr 호출 0. `npm run collect` → `data/*.json` 커밋 → 재배포 (공원나우와 동일 정적 스냅샷 패턴).
- 지도: 카카오 JS SDK (`NEXT_PUBLIC_KAKAO_MAP_KEY`). 키 없거나 SDK 실패 시 안내 문구로 graceful.
  - `~/.env` `KAKAO_MAP` 앱(ooing)은 현재 **"disabled OPEN_MAP_AND_LOCAL service"** → developers.kakao.com 에서 카카오맵 서비스 활성화 + Web 플랫폼 도메인 등록(`https://kr-expense-now.vercel.app`, `http://localhost:3000`) 필요.
- 지자체 좌표: `npm run centroids` → `data/centroids.json` (시군구 중심점).

## 진행 상태 (2026-09-04)

- [x] Next 16 + shadcn + Tailwind 4 스캐폴드, `lib/sido.ts` `lib/types.ts`
- [ ] 4개 API 활용신청·swagger 조사 (`scripts/` 비어 있음)
- [ ] `scripts/collect-expense.ts` 전 연도 × 243 지자체 수집
- [ ] `scripts/build-centroids.ts`
- [ ] 랭킹 페이지 (연도/시도 필터, 1인당·총액·비율·절감률 정렬)
- [ ] 카카오지도 탭
- [ ] 테스트 `npm test`, `npm run build`
- [ ] git init → GitHub → Vercel env `NEXT_PUBLIC_KAKAO_MAP_KEY` → `vercel deploy --prod`

## 이어서 작업하기 (usage 한도 후 재개용)

1. 위 체크리스트에서 첫 미완 항목부터. 각 단계 끝나면 이 파일 체크박스 갱신.
2. 수집은 `set -a; . ~/.env; set +a; npm run collect`.
3. 커밋·배포·Vercel 설정은 사람이 직접(에이전트 금지).

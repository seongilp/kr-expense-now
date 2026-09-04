# 업추비나우 (kr-expense-now)

전국 243개 지자체 업무추진비(기관운영·시책추진) 랭킹 + 카카오지도. "OO나우" 패밀리.

- 타이틀: `업추비나우 — 우리 동네 업무추진비 랭킹`
- 배포 목표: https://kr-expense-now.vercel.app (Vercel scope `seongilp`, 프로젝트 `kr-expense-now`, region icn1)
- GitHub 목표: `seongilp/kr-expense-now`

## 데이터 (행안부 지방재정365 — data.go.kr 은 LINK 유형, 키 불필요)

**핵심 발견(2026-09-04 실측):** data.go.kr 5개 pk 는 전부 `API 유형 LINK` 다. swagger 가 비어 있고
`/tcs/dss/selectApiLinkUrl.do?publicDataPk=<pk>` 가 `https://www.lofin365.go.kr/portal/LF5110000.do?pdtaId=…` 로
넘긴다. **활용신청·서비스키가 필요 없다** — 지방재정365 의 데이터셋 다운로드 엔드포인트가 세션·키 없이 JSON 을 준다.

### 엔드포인트(실측)

```
POST https://www.lofin365.go.kr/lf/pfinDtaOpen/dtst/dtstSvi/retvDtstDtsExcelDown.do
Content-Type: application/json
{"pdtaId":"<pdtaId>","pdtaSvTyCntt":"S","curPage":1,"pageSize":10000,"ext":"json"}
→ {"resultList":[{fyr, lafCd, waLafHgNm, lafHgNm, ...}], "headList":[...]}
```
- 컬럼명은 camelCase(`smy_cntt_amt` → `smyCnttAmt`). 헤더 정의는 `retvDtstDtsSheet.do`(form `pdtaId=`) HTML 의 `var headList`.
- 카탈로그 전체(146종): `POST /lf/pfinDtaOpen/dtst/dtstSvi/retvLstDtstExcelDown.do {"curPage":1,"pageSize":500}`.
- `pageSize` 를 크게 주면 한 번에 다 온다(최대 6,370행 실측). 페이지네이션 불필요.

### 쓰는 데이터셋

| pdtaId | data.go.kr | 이름 | 연도 | 행 | 기준 | 용도 |
|---|---|---|---|---|---|---|
| `84474KEKQQDWO3LE7DGZ411505` | 15058050 | 업무추진비비율 | 2009~2024 | 3,892 | **결산**, 일반회계 | 합계(total)·세출결산액(outlay) — 랭킹 축 |
| `PQNF58GR2UDN2RVS6SA11311409` | 15138863 | 업무추진비 절감률 | 2015~2023 | 2,187 | 결산, 일반+기타특별 | 기관운영(org)/시책추진(policy) 분리·기준액·절감률 |
| `E8CLIL7H1FHQ3F38ON5W225441` | — | 주민1인당세출예산액 | 2001~2026 | 6,370 | 인구수 컬럼 `pptnNum` | 1인당 분모 |
| `0NBRILVNY8XNMW3IU42B1481891` | — | 기관운영업무추진비(2020년 이후) | 2020~2026 | 1,701 | 당초예산 편성 | orgBudget |
| `Y0Q9M38Z79Y0FE98RONI1495583` | 15138706 | 시책추진 업무추진비(2020년 이후) | 2020~2026 | 1,701 | 당초예산 편성 | policyBudget |

안 쓰는 것: 15138696 기관운영(2016~2019, 970행)·15138705 시책추진(2016~2019, 972행) — **당초예산 편성액**이고
기관운영은 단체장+부단체장만이라 2020 이후 시리즈(실국장 포함)와 범위가 다르다. 그 연도의 결산은 위 두 결산 데이터셋이 덮는다.

### 정의(화면 하단에도 명시)
- 합계 = 업무추진비 **결산액**(일반회계) = 업무추진비비율 데이터셋의 `boe`.
- 기관운영/시책추진 분리는 재정분석(절감률) 데이터셋 — 일반회계+기타특별회계라 합계와 소폭 다르고(서울 2022: 68.0억 vs 57.7억) **1년 늦다**(2023까지).
- 절감률 = (1 − (기관운영+시책추진)/기준액)×100 직접 계산(원본 `rate` 는 아래 함정). 음수 = 기준액 초과(실측 최소 −14.4 서울강남구 2020).
- 예산대비 비율 = total/outlay (원본 `boeRt` 는 소수 2자리라 직접 계산).
- 1인당 = total / 인구수(같은 해).

### 함정(실측)
- `lafCd` 앞 두 자리 = 시도(11 서울 … 32 세종, 41 경기, 42 강원, 45 전북, 49 제주 — 행안부 행정코드와 다르다).
- 군위군 2023-07 대구 편입으로 코드 변경(4771000 → 2772000). `lib/expense.ts` `CODE_ALIASES` 로 잇는다.
- 코드 하나에 이름 둘: 인천남구→미추홀구, 강원도본청→강원본청, 제주도본청→제주본청. 최신 연도 이름을 쓴다.
- 폐지 단체(청원군·연기군·마산·진해·여주군·당진군·창원시(통합)) 는 2014 이전에만 있다 — 최신 연도에 없는 코드는 버린다.
- 기관운영(2020~) 편성액 컬럼은 `smyCnttAmt`(B=C+D+E), 시책추진은 `smyCnttAmt2`(B). 위치가 다르다.
- **함정: 절감률 원본 `rate` 는 2015~2016 이 (결산/기준)×100 = 집행률, 2017~ 가 (1−결산/기준)×100 = 절감률** 로 정의가 뒤집혀 있다(243곳 전부 확인). 그래서 `rate` 를 버리고 `boeAmt1+boeAmt2` 와 `boeAmt3` 로 직접 계산한다(`lib/expense.ts savingRateOf`).
- 이상치: 부산기장군 결산 총액이 유독 작다(2021 4,560만원 → 2022 9,860만원 → 2024 1.7억). 세종본청 2013 2배 급증.

- 지도: 카카오 JS SDK (`NEXT_PUBLIC_KAKAO_MAP_KEY`). 키 없거나 SDK 실패 시 안내 문구로 graceful.
  - 키는 `~/.env` `KAKAO_MAP`(JS 키, 앱 ooing). 카카오맵 서비스 활성화 + Web 도메인(`https://kr-expense-now.vercel.app`, `http://localhost:3000`) 등록 완료(2026-09-04).
- 지자체 좌표: `npm run centroids` → `data/centroids.json` (시군구 중심점, 출처 `../ipyang/public/sgg.geojson` 2013 KOSTAT + 시도청 좌표 하드코딩).
- 지자체 경계(마커 hover 하이라이트): `npm run boundaries` → `public/boundaries.json` (1.4MB, gzip 370KB, 좌표 소수 4자리).
  - 출처: GitHub `southkorea/southkorea-maps` `kostat/2018/json/skorea-municipalities-2018-topo-simple.json` (TopoJSON 250 피처, 기본은 URL 에서 받고 인자로 로컬 경로도 됨).
  - 매핑: 그쪽 코드는 통계청 5자리(접두어 11,21,22…39 = 2013 과 동일), 우리는 지방재정365 7자리라 **코드로 못 잇는다** → 시도 접두어 표 + 이름으로 잇는다(`lib/boundaries.ts`, 테스트 있음). 결과 **226/226 기초 지자체 매핑, 실패 0**.
  - 일반구가 있는 시 11곳(수원·성남·안양·안산·고양·용인·청주·천안·전주·포항·창원) 은 `OO시XX구` 피처를 topojson `merge` 로 합쳐 하나의 외곽선(공유 호 제거). 링을 그냥 이어 붙이면 구 경계선이 안에 남는다.
  - 특례: 인천 미추홀구 → `23_남구`(2018-07 개명 전 이름), 대구 군위군 → `37_군위군`(2023 편입 전 경북 소속). 강원·전북 특별자치도는 접두어(32·35) 가 같아 이름으로 그냥 붙는다.
  - 미사용 피처 3: `29010 세종시`(광역, 지도에 광역 마커 없음), `39010 제주시`·`39020 서귀포시`(행정시 — 지방재정365 에 기초 단체로 없음).
  - 파일은 `public/` 정적이라 Vercel 이 자동 gzip/brotli. 지도 탭에서 SDK 준비 후에만 `fetch('/boundaries.json')` — 홈 번들·랭킹 탭엔 안 실린다. 실패하면 하이라이트만 빠지고 마커는 그대로.

## 진행 상태 (2026-09-04)

- [x] Next 16 + shadcn + Tailwind 4 스캐폴드, `lib/sido.ts` `lib/types.ts`
- [x] API 조사 — LINK 유형, 지방재정365 직접 다운로드(위 표). 활용신청 불필요
- [x] `scripts/collect-expense.ts` — 243곳 × 2009~2026(결산 2009~2024, 분리 2015~2023, 편성 2020~2026), `data/expense.json` 794KB
- [x] `scripts/build-centroids.ts` — 243/243 매칭(`data/centroids.json`), 미추홀구=23_남구·군위군=37_군위군 특례
- [x] 랭킹 페이지 — `/` 시도 랭킹(기본 서울, localStorage 기억) · 전국 랭킹(시/군/자치구/광역 분리) · 7개 지표 정렬 · 연도 선택 · 검색, `/g/[code]` 상세 243개 SSG(SVG 추이 차트, 전국·시도 순위, 같은 유형 중앙값)
- [x] 카카오지도 탭 — `NEXT_PUBLIC_KAKAO_MAP_KEY` 없음/SDK 로드 실패/10초 타임아웃 → 안내 문구. 마커는 centroids CustomOverlay
- [x] 테스트 `npm test`(33개) · `npm run lint` · `npm run build`(정적 249 페이지) 통과. gstack browse 로 홈/전국/지도 폴백/상세 렌더 확인
- [x] 지도 마커 hover → 시군구 경계 폴리곤 하이라이트(`kakao.maps.Polygon`, #3182f6 테두리 2px + 채움 .18). 터치는 pointerdown 으로 1.5초. `scripts/build-boundaries.ts` + `lib/boundaries.ts`(테스트 11개). 실제 카카오 지도에서 부산 해운대구·경남 창원시(5구 병합) 하이라이트 스크린샷 확인
- [x] 연도 `<select>` → 타임라인 슬라이더(`components/year-picker.tsx`, SVG + 투명 `<input type=range>`): 보이는 집합의 연도별 합계(금액 지표)/중앙값(비율 지표) 막대 위를 드래그하면 표·지도가 실시간 갱신. ◀ ▶ 스테퍼, ←/→ 키보드. 집계는 `lib/timeline.ts`(테스트). 총 44 테스트
- [ ] (사람) git commit → GitHub → Vercel env `NEXT_PUBLIC_KAKAO_MAP_KEY` → `vercel deploy --prod`. 카카오 콘솔에서 앱의 "카카오맵" 서비스 활성화 + Web 플랫폼에 배포 도메인 등록

## 앱 구조

- `app/page.tsx` 서버에서 스냅샷 전체를 `ExpenseBrowser`(클라이언트) 에 props 로 넘김(HTML ≈ 960KB, gzip ≈ 150KB). 런타임 외부 호출 0.
- `lib/rank.ts` 순수 계산(1인당·세출대비·전년비·정렬·순위(1,1,3 동률)·중앙값), `lib/detail.ts` 상세 순위, `lib/format.ts`·`lib/metric-format.ts` 표기. 전부 `lib/__tests__` 에 테스트.
- `components/expense-browser.tsx` 탭·필터, `year-picker.tsx`(연도 타임라인 슬라이더), `ranking-table.tsx`, `expense-map.tsx`(카카오 + 경계 hover), `trend-chart.tsx`(SVG, 훅 없음), `entity-detail.tsx`, `footer-notes.tsx`(정의·출처).
- `lib/timeline.ts` 연도별 집계(합계/중앙값), `lib/boundaries.ts` 경계 매핑 규칙. `public/boundaries.json` 은 `npm run boundaries` 산출물(커밋 대상).
- 함정: React 19 lint `react-hooks/set-state-in-effect` — effect 안 동기 setState 금지. localStorage 는 `useSyncExternalStore`, 카카오 지도 생성은 SDK 로드 콜백 안에서.
- 함정: lucide-react 에 `MapOff` 없음 → `MapPinOff`.
- 함정: 카카오 SDK 는 등록 도메인(`localhost:3000`) 의 Referer 만 받는다. 3000 이 다른 dev 서버(IPv6 `[::1]:3000` 만 점유하는 Nuxt 등) 에 잡혀 있으면 Next 는 `*:3000` 으로 같이 뜨고 `127.0.0.1:3000` 으로 닿는다 — 단 `next dev` 는 Referer 가 host 와 다르면 청크를 403 으로 막으니(allowedDevOrigins) 브라우저 검증은 `next build && next start` 로. gstack browse 는 `header Referer:http://localhost:3000/` 로 우회.
- 함정: 카카오 CustomOverlay 는 화면 밖 마커를 DOM 에 안 둔다(226개 중 보이는 17개만). hover 는 컨테이너 이벤트 위임이라 상관없지만 DOM 을 세어 검증하면 헷갈린다.
- 함정: 최신 결산(2024)엔 기관운영/시책추진/절감률이 없다(분리 데이터셋 2023까지). 화면은 "—" + 안내 문구, 상세 카드는 분리 지표만 2023 기준으로 표시.

## 이어서 작업하기 (usage 한도 후 재개용)

1. 위 체크리스트에서 첫 미완 항목부터. 각 단계 끝나면 이 파일 체크박스 갱신.
2. 수집은 `npm run collect` (키 불필요). 좌표 `npm run centroids`, 경계 `npm run boundaries`(GitHub 에서 받음).
3. 커밋·배포·Vercel 설정은 사람이 직접(에이전트 금지).

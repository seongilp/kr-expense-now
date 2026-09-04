'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';

import { formatMetric } from '@/lib/metric-format';
import { METRICS, sortRows, type Metric, type Row } from '@/lib/rank';
import type { BoundaryFile } from '@/lib/boundaries';
import type { Centroid } from '@/lib/types';

/**
 * 카카오지도 탭. SDK 는 이 탭이 처음 열릴 때만 로드한다(랭킹만 보는 사람에게 외부 스크립트를 얹지 않는다).
 *
 * graceful 원칙: 키가 없거나(NEXT_PUBLIC_KAKAO_MAP_KEY 미설정) 스크립트 로드가 실패하거나(도메인 미등록·네트워크)
 * 일정 시간 안에 SDK 가 준비되지 않으면 **안내 문구** 를 보여주고 끝. 앱의 나머지는 영향 없음.
 *
 * 마커는 지자체 중심점(data/centroids.json) 에 CustomOverlay 로 찍는다. 색·크기 = 보이는 집합 안의 상대 순위.
 * 지도가 필요한 이유는 "어디가 많이 쓰나" 를 공간적으로 보는 것 하나라, 폴리곤 대신 점으로 충분하다.
 *
 * 경계 하이라이트: 마커에 마우스를 올리면 그 시군구 경계(public/boundaries.json, ≈1.4MB/gzip 370KB) 를 Polygon 으로 그린다.
 * 파일은 지도가 준비된 뒤에만 lazy fetch — 홈 번들·랭킹 탭엔 얹지 않는다. 실패해도 마커는 그대로(하이라이트만 없음).
 * 마커 hover 감지는 지도 컨테이너에 mouseover/mouseout 위임(CustomOverlay content 는 일반 DOM). 터치는 pointerdown 으로 잠깐 보여준다.
 */

/* SDK 타입 최소 선언. 공식 d.ts 가 없어 쓰는 것만 적는다. */
interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
  isEmpty(): boolean;
}
interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
  setBounds(bounds: KakaoLatLngBounds, paddingTop?: number, paddingRight?: number, paddingBottom?: number, paddingLeft?: number): void;
}
interface KakaoOverlay {
  setMap(map: KakaoMap | null): void;
}
interface KakaoPolygonOptions {
  path: KakaoLatLng[] | KakaoLatLng[][];
  strokeWeight?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  fillColor?: string;
  fillOpacity?: number;
  zIndex?: number;
}
interface KakaoMaps {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => KakaoMap;
  CustomOverlay: new (opts: { position: KakaoLatLng; content: string; yAnchor?: number; zIndex?: number }) => KakaoOverlay;
  Polygon: new (opts: KakaoPolygonOptions) => KakaoOverlay;
}
declare global {
  interface Window {
    kakao?: { maps?: KakaoMaps };
  }
}

type SdkState = 'nokey' | 'loading' | 'ready' | 'failed';

const KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
const SDK_TIMEOUT_MS = 10_000;
/** 전국이 한 화면에 들어오는 중심·레벨. */
const KOREA_CENTER = { lat: 36.2, lng: 127.8 };
const KOREA_LEVEL = 13;
/** setBounds 여백(px). 마커 라벨이 가장자리에서 잘리지 않을 만큼. */
const FIT_PADDING = 48;
/** 경계 파일(public/). 지도 탭에서만 lazy fetch. */
const BOUNDARIES_URL = '/boundaries.json';
/** hover 폴리곤 스타일 — 카카오맵 행정구역 강조 느낌(토스 블루 테두리 + 옅은 채움). */
const HIGHLIGHT_STYLE = { strokeWeight: 2, strokeColor: '#3182f6', strokeOpacity: 0.9, fillColor: '#3182f6', fillOpacity: 0.18 } as const;
/** 터치로 마커를 눌렀을 때 폴리곤을 보여주는 시간(ms). */
const TOUCH_HIGHLIGHT_MS = 1500;

/** 경계 파일 → 카카오 Polygon 경로. 링별 [lng, lat] → LatLng. 빈 결과면 null. */
function polygonPath(maps: KakaoMaps, rings: BoundaryFile[string] | undefined): KakaoLatLng[][] | null {
  if (!rings || rings.length === 0) return null;
  return rings.map((ring) => ring.map(([lng, lat]) => new maps.LatLng(lat, lng)));
}

/** 이벤트 대상에서 마커 앵커(data-code) 를 찾는다. 마커 바깥이면 null. */
function markerCodeOf(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>('a[data-code]')?.dataset.code ?? null;
}

function loadSdk(onDone: (ok: boolean) => void): () => void {
  if (window.kakao?.maps) {
    onDone(true);
    return () => {};
  }
  let settled = false;
  const finish = (ok: boolean) => {
    if (settled) return;
    settled = true;
    onDone(ok);
  };
  const script = document.createElement('script');
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY ?? '')}&autoload=false`;
  script.async = true;
  script.onload = () => {
    // 도메인 미등록이면 스크립트는 200 이지만 maps 객체가 없거나 load 가 콜백을 안 부른다 → 타임아웃으로 잡는다.
    try {
      window.kakao?.maps?.load(() => finish(true));
    } catch {
      finish(false);
    }
  };
  script.onerror = () => finish(false);
  document.head.appendChild(script);
  const timer = setTimeout(() => finish(false), SDK_TIMEOUT_MS);
  return () => clearTimeout(timer);
}

interface Props {
  /** 지도에 찍을 전체 집합(전국 기초 지자체). 색·크기는 이 집합 안의 상대 순위. */
  rows: readonly Row[];
  /** 강조·자동 줌 대상(선택한 시도). 나머지는 흐리게. */
  focusCodes: ReadonlySet<string>;
  centroids: Readonly<Record<string, Centroid>>;
  metric: Metric;
}

export function ExpenseMap({ rows, focusCodes, centroids, metric }: Props) {
  const [sdk, setSdk] = useState<SdkState>(KEY ? 'loading' : 'nokey');
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const boundariesRef = useRef<BoundaryFile | null>(null);
  const highlightRef = useRef<{ code: string; polygon: KakaoOverlay } | null>(null);

  // SDK 로드 → 지도 생성(한 번). 실패 지점이 어디든 'failed' 하나로 수렴.
  useEffect(() => {
    if (!KEY) return;
    return loadSdk((ok) => {
      const maps = window.kakao?.maps;
      if (!ok || !maps || !boxRef.current) {
        setSdk('failed');
        return;
      }
      try {
        mapRef.current = new maps.Map(boxRef.current, {
          center: new maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng),
          level: KOREA_LEVEL,
        });
        setSdk('ready');
      } catch {
        setSdk('failed');
      }
    });
  }, []);

  // 마커 갱신(rows/metric 바뀔 때).
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (sdk !== 'ready' || !maps || !map) return;
    for (const o of overlaysRef.current) o.setMap(null);
    // 마커가 통째로 바뀌면 hover 중이던 마커도 사라진다(mouseout 이 안 온다) → 하이라이트도 같이 정리.
    highlightRef.current?.polygon.setMap(null);
    highlightRef.current = null;
    const sorted = sortRows(rows, metric, 'desc').filter((r) => r[metric] !== null);
    const n = sorted.length;
    const next = sorted.flatMap((r, i) => {
      const c = centroids[r.code];
      if (!c) return [];
      const focused = focusCodes.has(r.code);
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(c.lat, c.lng),
        content: markerHtml(r, metric, i / Math.max(1, n - 1), focused),
        yAnchor: 0.5,
        zIndex: (focused ? n : 0) + n - i,
      });
      overlay.setMap(map);
      return [overlay];
    });
    overlaysRef.current = next;
  }, [sdk, rows, focusCodes, centroids, metric]);

  // 경계 파일 lazy fetch(지도가 준비된 뒤 한 번). 실패는 조용히 — 하이라이트만 빠진다.
  useEffect(() => {
    if (sdk !== 'ready' || boundariesRef.current) return;
    const ac = new AbortController();
    fetch(BOUNDARIES_URL, { signal: ac.signal })
      .then((res) => (res.ok ? (res.json() as Promise<BoundaryFile>) : Promise.reject(new Error(`boundaries ${res.status}`))))
      .then((data) => {
        if (data && typeof data === 'object') boundariesRef.current = data;
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) console.warn('경계 데이터를 불러오지 못했습니다', err);
      });
    return () => ac.abort();
  }, [sdk]);

  // 마커 hover → 경계 폴리곤. 컨테이너에 위임하므로 마커가 다시 그려져도 리스너는 그대로.
  useEffect(() => {
    const box = boxRef.current;
    const maps = window.kakao?.maps;
    if (sdk !== 'ready' || !box || !maps) return;
    let touchTimer: ReturnType<typeof setTimeout> | undefined;

    const clear = () => {
      highlightRef.current?.polygon.setMap(null);
      highlightRef.current = null;
    };
    const show = (code: string) => {
      const map = mapRef.current;
      if (!map || highlightRef.current?.code === code) return;
      const path = polygonPath(maps, boundariesRef.current?.[code]);
      clear();
      if (!path) return;
      const polygon = new maps.Polygon({ path, ...HIGHLIGHT_STYLE, zIndex: 1 });
      polygon.setMap(map);
      highlightRef.current = { code, polygon };
    };
    const onOver = (e: MouseEvent) => {
      const code = markerCodeOf(e.target);
      if (code) show(code);
    };
    const onOut = (e: MouseEvent) => {
      const code = markerCodeOf(e.target);
      // 마커 안의 자식 사이 이동은 무시(relatedTarget 이 같은 마커).
      if (code && markerCodeOf(e.relatedTarget) !== code) clear();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const code = markerCodeOf(e.target);
      if (!code) return;
      show(code);
      clearTimeout(touchTimer);
      touchTimer = setTimeout(clear, TOUCH_HIGHLIGHT_MS);
    };
    box.addEventListener('mouseover', onOver);
    box.addEventListener('mouseout', onOut);
    box.addEventListener('pointerdown', onPointerDown);
    return () => {
      box.removeEventListener('mouseover', onOver);
      box.removeEventListener('mouseout', onOut);
      box.removeEventListener('pointerdown', onPointerDown);
      clearTimeout(touchTimer);
      clear();
    };
  }, [sdk]);

  // 선택한 시도가 바뀔 때 그 시도가 화면에 꽉 차게 줌. 지표만 바뀔 땐 시점을 건드리지 않는다.
  const codesKey = [...focusCodes].sort().join(',');
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (sdk !== 'ready' || !maps || !map) return;
    const bounds = new maps.LatLngBounds();
    for (const code of codesKey.split(',')) {
      const c = centroids[code];
      if (c) bounds.extend(new maps.LatLng(c.lat, c.lng));
    }
    if (bounds.isEmpty()) return;
    map.setBounds(bounds, FIT_PADDING, FIT_PADDING, FIT_PADDING, FIT_PADDING);
  }, [sdk, codesKey, centroids]);

  const label = METRICS.find((m) => m.key === metric)?.label ?? metric;

  if (sdk === 'nokey' || sdk === 'failed') {
    return (
      <Notice
        title={sdk === 'nokey' ? '지도를 표시할 수 없습니다' : '카카오지도를 불러오지 못했습니다'}
        body={
          sdk === 'nokey'
            ? '카카오지도 앱 키(NEXT_PUBLIC_KAKAO_MAP_KEY)가 설정되지 않았습니다. 랭킹은 "시도 랭킹" · "전국 랭킹" 탭에서 그대로 볼 수 있습니다.'
            : '네트워크 문제이거나, 이 도메인이 카카오 개발자 콘솔에 등록되지 않았을 수 있습니다. 랭킹 탭은 정상 동작합니다.'
        }
      />
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {label} 기준 · 전국 기초 지자체 중 상위일수록 크고 붉은 점. 선택한 시도는 이름표가 붙고, 점에 마우스를 올리면 경계가, 누르면 상세로 갑니다.
      </p>
      <div ref={boxRef} className="h-[70vh] min-h-[420px] w-full rounded-lg border border-border bg-card">
        {sdk === 'loading' && (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">지도 불러오는 중…</p>
        )}
      </div>
    </div>
  );
}

/** 상위 20% 붉게, 다음 30% 호박색, 나머지 파랑. t = 0(1위) ~ 1(꼴찌). */
function markerHtml(r: Row, metric: Metric, t: number, focused: boolean): string {
  const color = t <= 0.2 ? '#fb7185' : t <= 0.5 ? '#fbbf24' : '#3182f6';
  const size = Math.round(26 - t * 12);
  const value = formatMetric(metric, r[metric]);
  const label = focused
    ? `<span style="background:rgba(11,15,25,.85);padding:2px 4px;border-radius:4px;white-space:nowrap">${escapeHtml(r.name)} ${escapeHtml(value)}</span>`
    : '';
  return (
    `<a href="/g/${r.code}" data-code="${r.code}" title="${escapeHtml(r.name)} ${escapeHtml(value)}" ` +
    `style="display:flex;align-items:center;gap:3px;text-decoration:none;color:#e5e7eb;font:11px/1 sans-serif">` +
    `<span style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};opacity:.85;border:1.5px solid #0b0f19"></span>` +
    label +
    `</a>`
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card/50 px-4 py-12 text-center">
      <MapPinOff className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

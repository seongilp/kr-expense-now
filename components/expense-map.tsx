'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPinOff } from 'lucide-react';

import { formatMetric } from '@/lib/metric-format';
import { METRICS, sortRows, type Metric, type Row } from '@/lib/rank';
import type { Centroid } from '@/lib/types';

/**
 * 카카오지도 탭. SDK 는 이 탭이 처음 열릴 때만 로드한다(랭킹만 보는 사람에게 외부 스크립트를 얹지 않는다).
 *
 * graceful 원칙: 키가 없거나(NEXT_PUBLIC_KAKAO_MAP_KEY 미설정) 스크립트 로드가 실패하거나(도메인 미등록·네트워크)
 * 일정 시간 안에 SDK 가 준비되지 않으면 **안내 문구** 를 보여주고 끝. 앱의 나머지는 영향 없음.
 *
 * 마커는 지자체 중심점(data/centroids.json) 에 CustomOverlay 로 찍는다. 색·크기 = 보이는 집합 안의 상대 순위.
 * 지도가 필요한 이유는 "어디가 많이 쓰나" 를 공간적으로 보는 것 하나라, 폴리곤 대신 점으로 충분하다.
 */

/* SDK 타입 최소 선언. 공식 d.ts 가 없어 쓰는 것만 적는다. */
interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
}
interface KakaoOverlay {
  setMap(map: KakaoMap | null): void;
}
interface KakaoMaps {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (el: HTMLElement, opts: { center: KakaoLatLng; level: number }) => KakaoMap;
  CustomOverlay: new (opts: { position: KakaoLatLng; content: string; yAnchor?: number; zIndex?: number }) => KakaoOverlay;
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
  rows: readonly Row[];
  centroids: Readonly<Record<string, Centroid>>;
  metric: Metric;
}

export function ExpenseMap({ rows, centroids, metric }: Props) {
  const [sdk, setSdk] = useState<SdkState>(KEY ? 'loading' : 'nokey');
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);

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
    const sorted = sortRows(rows, metric, 'desc').filter((r) => r[metric] !== null);
    const n = sorted.length;
    const next = sorted.flatMap((r, i) => {
      const c = centroids[r.code];
      if (!c) return [];
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(c.lat, c.lng),
        content: markerHtml(r, metric, i / Math.max(1, n - 1)),
        yAnchor: 0.5,
        zIndex: n - i,
      });
      overlay.setMap(map);
      return [overlay];
    });
    overlaysRef.current = next;
  }, [sdk, rows, centroids, metric]);

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
        {label} 기준 · 점이 클수록(붉을수록) 보이는 지자체 중 상위. 점을 누르면 상세로 갑니다.
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
function markerHtml(r: Row, metric: Metric, t: number): string {
  const color = t <= 0.2 ? '#fb7185' : t <= 0.5 ? '#fbbf24' : '#3182f6';
  const size = Math.round(26 - t * 12);
  const value = formatMetric(metric, r[metric]);
  return (
    `<a href="/g/${r.code}" title="${escapeHtml(r.name)} ${escapeHtml(value)}" ` +
    `style="display:flex;align-items:center;gap:3px;text-decoration:none;color:#e5e7eb;font:11px/1 sans-serif">` +
    `<span style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};opacity:.85;border:1.5px solid #0b0f19"></span>` +
    `<span style="background:rgba(11,15,25,.85);padding:2px 4px;border-radius:4px;white-space:nowrap">${escapeHtml(r.name)} ${escapeHtml(value)}</span></a>`
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

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * 상위 디렉토리(~/)에 pnpm-workspace.yaml 이 있어서 Turbopack 이 루트를 그쪽으로 잡으려다
   * 경고를 뱉는다. 이 앱은 독립 프로젝트이므로 루트를 자기 자신으로 못 박는다.
   */
  turbopack: { root: import.meta.dirname },
  /*
   * 정적 스냅샷(data/*.json)을 서버리스 번들에 반드시 포함. 모든 페이지가 빌드 시 정적 생성되므로 보통은
   * 필요 없지만, lib/snapshot.ts 가 readFileSync 로 읽는 이상 트레이싱이 놓치면 배포에서만 ENOENT 가 난다.
   */
  outputFileTracingIncludes: {
    '/': ['./data/expense.json', './data/centroids.json'],
    '/g/[code]': ['./data/expense.json'],
    '/sitemap.xml': ['./data/expense.json'],
  },
};

export default nextConfig;

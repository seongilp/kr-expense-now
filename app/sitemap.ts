import type { MetadataRoute } from 'next';

import { SITE } from '@/lib/site';
import { loadSnapshot } from '@/lib/snapshot';

/** 첫 화면 + 지자체 상세 243개. 데이터는 연 1회 갱신이라 monthly 로 충분. */
export default function sitemap(): MetadataRoute.Sitemap {
  const { entities } = loadSnapshot();
  return [
    { url: SITE, changeFrequency: 'monthly', priority: 1 },
    ...entities.map((e) => ({
      url: `${SITE}/g/${e.code}`,
      changeFrequency: 'monthly' as const,
      priority: e.type === 'metro' ? 0.8 : 0.6,
    })),
  ];
}

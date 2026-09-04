import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '업추비나우',
    short_name: '업추비나우',
    description: '우리 동네 업무추진비 랭킹',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0f19',
    theme_color: '#0b0f19',
    lang: 'ko',
  };
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Frontier - Video Generator',
    short_name: 'Frontier',
    description: 'Automated short video generation pipeline',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0a1d',
    theme_color: '#7c3aed',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// 단어정원 — 설계: 2_설계.md 2절
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer', // 서비스 워커 등록이 첫 화면을 막지 않게
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '단어정원',
        short_name: '단어정원',
        description: '매일 조금씩, 영어 단어가 자라는 정원',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        background_color: '#F1F5EC',
        theme_color: '#2F6B47',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // 음성 파일: 주소에 ?v=버전 이 붙으므로 한 번 받으면 오래 보관
            urlPattern: ({ url }) => url.pathname.startsWith('/storage/v1/object/public/audio/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              expiration: { maxEntries: 1200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 주니어 그림 (Twemoji): 버전이 고정된 주소라 오래 보관
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net' && url.pathname.includes('/twemoji@'),
            handler: 'CacheFirst',
            options: { cacheName: 'twemoji', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 30 } },
          },
        ],
      },
    }),
  ],
})

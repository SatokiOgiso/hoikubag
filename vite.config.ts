import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// デプロイ識別用バージョン: Vercel のコミットSHA(短縮) + ビルド日時(JST)
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7);
const buildDate = new Date().toLocaleString('sv-SE', {
  timeZone: 'Asia/Tokyo',
}).slice(5, 16); // 例: 05-31 09:42
const appVersion = `${commit} · ${buildDate}`;

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon.svg',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'hoikubag - 保育園準備',
        short_name: 'hoikubag',
        description: '保育園の持ち物を天気に合わせてサッと準備できるアプリ',
        lang: 'ja',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF5EA',
        theme_color: '#FAF5EA',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // 天気API・同期APIはキャッシュせず常にネットワークへ
        navigateFallbackDenylist: [/^\/api\//],
        // Web Push のハンドラを生成SWに合流させる
        importScripts: ['push-sw.js'],
        runtimeCaching: [
          {
            // Google Fonts のスタイルシート
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            // Google Fonts のフォント本体
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});

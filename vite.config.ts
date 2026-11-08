import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// بناء الأندرويد (--mode android) بدون PWA: الملفات مدمجة داخل الـAPK ولا نحتاج Service Worker
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'android' ? [] : [VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'SING & PLAY',
        short_name: 'SING & PLAY',
        description: 'لعبة غناء جماعية أونلاين',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#101412',
        background_color: '#101412',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })])
  ]
}));

import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'AlcoTrack',
        short_name: 'AlcoTrack',
        description: 'Personal alcohol tracking',
        theme_color: '#0d0d14',
        background_color: '#0d0d14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/android/192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/android/512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/android/512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 31536000 }
            }
          }
        ]
      }
    })
  ]
})

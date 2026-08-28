import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative asset URLs so the build works both at a custom domain root
  // (capa.briam.cloud) and at the GitHub Pages project path
  // (bryant-anjos.github.io/cover-studio/). Safe here because the app has no
  // client-side routing.
  base: './',
  plugins: [
    react(),
    // Installable PWA. Personal use only (no store / commercial intent) — this
    // just lets the app be added to the home screen and opened without typing
    // the URL. Service worker auto-updates on each deploy.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // The whole app is a static client bundle; precache it all for offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Cover Studio',
        short_name: 'Cover Studio',
        description:
          'Editor local de imagens de capa: colagem diagonal + recorte de logo redonda.',
        lang: 'pt-BR',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0e0b10',
        theme_color: '#0e0b10',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  server: { port: 5180, open: true },
})

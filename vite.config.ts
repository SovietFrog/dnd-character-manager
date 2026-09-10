import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/dnd-character-manager/'

export default defineConfig({
  base,

  plugins: [
    vue(),

    VitePWA({
      registerType: 'autoUpdate',

      manifest: {
        name: 'D&D Character Manager',
        short_name: 'D&D Manager',
        description: 'D&D Character Manager',

        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',

        display: 'standalone',

        start_url: base,
        scope: base,

        icons: [
          {
            src: `${base}pwa-192x192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${base}pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${base}pwa-512x512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },

      workbox: {
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2}',
        ],
      },
    }),
  ],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          recharts: ['recharts'],
          gsap: ['gsap', '@gsap/react'],
          supabase: ['@supabase/supabase-js'],
          analytics: ['posthog-js'],
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
})

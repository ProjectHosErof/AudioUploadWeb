import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // A named chunk, loaded only when someone signs in (src/lib/supabaseClient.ts).
        manualChunks: { supabase: ['@supabase/supabase-js'] },
      },
    },
  },
})

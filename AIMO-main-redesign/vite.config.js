import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: '/' — Vercel/Netlify 루트 배포용
// GitHub Pages에 올릴 경우 base를 '/레포이름/'으로 바꾸세요.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Supabase 클라이언트를 별도 청크로 분리.
          // 메인 번들은 초기 로딩에 포함되지 않으며,
          // AuthProvider 가 처음 로드될 때 fetch 됨.
          // 측정값: gzip 52KB 감소 (Day 6 착수 전 실측).
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    // Supabase 청크가 500KB를 넘을 수 있으나 warning 은 표시 유지 (의식하기 위함)
    chunkSizeWarningLimit: 600,
  },
})

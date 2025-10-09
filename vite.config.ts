import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    port: 5173,
    host: true,
    strictPort: true,
    // Only allow the production domain, not localhost
    allowedHosts: [
      'mockupai.supover.com',
      'ai.supover.com'
    ]
  },
})
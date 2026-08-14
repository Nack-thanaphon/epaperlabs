import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Keep asset URLs absolute-rooted for normal Vercel hosting.
  // The MCP server rewrites them to full https:// URLs when returning the UI template.
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
})

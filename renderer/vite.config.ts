import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const { version } = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')) as { version: string }

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    outDir: "dist",
  }
})
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'next/image': fileURLToPath(new URL('./src/test/NextImage.tsx', import.meta.url)),
      'next/link': fileURLToPath(new URL('./src/test/NextLink.tsx', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium' },
        { browser: 'webkit' },
      ],
    },
  },
})

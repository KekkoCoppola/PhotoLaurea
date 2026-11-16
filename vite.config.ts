/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/PhotoLaurea/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'apps-script/test/**/*.test.js'],
    passWithNoTests: true,
  },
})

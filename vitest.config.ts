import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@sprout/lang': path.resolve('./packages/lang/src/index.ts'),
      '@sprout/blocks': path.resolve('./packages/blocks/src/index.ts'),
      '@sprout/parser': path.resolve('./packages/parser/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/tests/**/*.{test,spec}.{ts,tsx}', 'apps/*/tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
    },
  },
})

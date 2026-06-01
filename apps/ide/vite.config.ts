import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@sprout/lang': path.resolve('../../packages/lang/src/index.ts'),
      '@sprout/blocks': path.resolve('../../packages/blocks/src/index.ts'),
    },
  },
});

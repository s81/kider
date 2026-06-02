import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'blockly/node': fileURLToPath(new URL('../../packages/blocks/node_modules/blockly/browser.js', import.meta.url)),
      'blockly': fileURLToPath(new URL('../../packages/blocks/node_modules/blockly/browser.js', import.meta.url)),
      '@sprout/blocks': fileURLToPath(new URL('../../packages/blocks/src/index.ts', import.meta.url)),
      '@sprout/lang': fileURLToPath(new URL('../../packages/lang/src/index.ts', import.meta.url)),
      '@sprout/parser': fileURLToPath(new URL('../../packages/parser/src/index.ts', import.meta.url)),
    },
  },
});

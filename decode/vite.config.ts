import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

function excludeWasmFromDistPlugin(): Plugin {
  return {
    name: 'exclude-wasm-from-dist',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName.endsWith('.wasm')) {
          delete bundle[fileName];
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    excludeWasmFromDistPlugin(),
  ],
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        markdown: './markdown.html',
        cleantext: './clean-text.html',
        ocr: './thaiocr.html',
      },
    },
  },
});
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

function copyOrtWasmPlugin() {
  return {
    name: 'copy-ort-wasm',
    buildStart() {
      const srcDir = resolve(rootDir, 'node_modules/onnxruntime-web/dist')
      const destDir = resolve(rootDir, 'public/ort')
      if (!fs.existsSync(srcDir)) return

      fs.mkdirSync(destDir, { recursive: true })
      for (const file of fs.readdirSync(srcDir)) {
        if (file.startsWith('ort-wasm') && (file.endsWith('.wasm') || file.endsWith('.mjs'))) {
          fs.copyFileSync(resolve(srcDir, file), resolve(destDir, file))
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    copyOrtWasmPlugin(),
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
})
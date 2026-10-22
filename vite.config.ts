import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { mermaidPlugin } from './build/mermaid.ts'
import { searchIndexPlugin } from './build/search-index.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), mermaidPlugin(), searchIndexPlugin()],
})

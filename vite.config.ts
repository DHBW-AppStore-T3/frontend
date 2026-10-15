import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },

  build: {
    rollupOptions: {
      // The app, and the callback page of the silent token renew (bundled,
      // so it loads no script from elsewhere).
      input: {
        main: path.resolve(__dirname, 'index.html'),
        silentRefresh: path.resolve(__dirname, 'silent-refresh.html'),
      },
    },
  },
})
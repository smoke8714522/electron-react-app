import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'lib/main/main.ts'),
        },
        external: ['sharp'],
      },
    },
    resolve: {
      alias: {
        '@/app': resolve(__dirname, 'app'),
        '@/lib': resolve(__dirname, 'lib'),
        '@/resources': resolve(__dirname, 'resources'),
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'lib/preload/preload.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@/app': resolve(__dirname, 'app'),
        '@/lib': resolve(__dirname, 'lib'),
        '@/resources': resolve(__dirname, 'resources'),
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: './app',
    publicDir: resolve(__dirname, 'public'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'app/index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@/app': resolve(__dirname, 'app'),
        '@/lib': resolve(__dirname, 'lib'),
        '@/resources': resolve(__dirname, 'resources'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
})

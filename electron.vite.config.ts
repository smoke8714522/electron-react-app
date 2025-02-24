import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

console.log(resolve(__dirname, 'app/index.html'))
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'lib/main/main.ts'),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@/resources': resolve('resources'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'lib/preload/preload.ts'),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: './app',
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
      },
    },
    plugins: [react()],
  },
})

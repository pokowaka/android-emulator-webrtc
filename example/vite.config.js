import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /.*\.[jt]sx?$/,
    exclude: [],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /src\/proto/],
    },
  },
  server: {
    fs: {
      allow: [
        // Allow serving files from the project root
        path.resolve(__dirname, '..'),
      ],
    },
  },
});

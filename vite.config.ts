import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1400,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vendor-firebase', test: /node_modules[\\/](firebase|@firebase)/ },
              { name: 'vendor-pdfjs', test: /node_modules[\\/]pdfjs-dist/ },
              { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)/ },
              { name: 'vendor-ui', test: /node_modules[\\/](lucide-react|motion|framer-motion)/ },
              { name: 'data-curriculum', test: /src[\\/]data[\\/]pceCurriculumData/ },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

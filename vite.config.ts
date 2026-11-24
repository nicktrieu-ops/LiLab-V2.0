import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// `--mode preview` builds a self-contained clickable demo: Firestore and Auth are replaced by
// in-browser stand-ins with sample data (see preview/), and asset paths become relative so the
// build can be hosted from any folder.
function relativeAssetPaths(): Plugin {
  return {
    name: 'lilab-preview-relative-assets',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]src[\\/].*\.(tsx?|jsx?)$/.test(id)) return null;
      return code
        .replace(/(['"`])\/api\/media\//g, '$1./assets/media/')
        .replace(/(['"`])\/assets\//g, '$1./assets/');
    },
  };
}

export default defineConfig(({ mode }) => {
  const isPreview = mode === 'preview';
  return {
    base: isPreview ? './' : '/',
    plugins: [react(), tailwindcss(), ...(isPreview ? [relativeAssetPaths()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
        ...(isPreview
          ? {
              'firebase/firestore': path.resolve(rootDir, 'preview/mockFirestore.ts'),
              'firebase/auth': path.resolve(rootDir, 'preview/mockAuth.ts'),
            }
          : {}),
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

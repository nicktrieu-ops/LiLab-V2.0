// Refuses to start the production server without a built site.
// Without dist/, server.ts falls back to the Vite dev server: far more memory and slow cold starts.
import fs from 'node:fs';
if (!fs.existsSync(new URL('../dist/index.html', import.meta.url))) {
  console.error('dist/index.html is missing. Run "npm run build" before "npm start".');
  process.exit(1);
}

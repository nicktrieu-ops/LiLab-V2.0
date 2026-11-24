import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

async function boot() {
  const root = createRoot(document.getElementById('root')!);

  if (import.meta.env.MODE === 'preview') {
    // Clickable preview build: sample academy data in memory, no Firebase project needed.
    const [{ seedPreviewAcademy }, { PreviewBar }] = await Promise.all([
      import('../preview/previewSeed'),
      import('../preview/PreviewBar'),
    ]);
    await seedPreviewAcademy();
    root.render(
      <ErrorBoundary>
        <App />
        <PreviewBar />
      </ErrorBoundary>
    );
    return;
  }

  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

void boot();

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { BookOpen, ChevronLeft, ChevronRight, Lock, ShieldCheck, X, ZoomIn, ZoomOut } from 'lucide-react';
import { biText } from '../i18n';
import { fetchReadOnlyMaterial, type ReadOnlyMaterialPayload } from '../services/aiClient';
import type { GeminiNote, LangCode } from '../types';

export interface ReadOnlyMaterialViewerProps {
  lang: LangCode;
  noteId: string;
  note?: GeminiNote | null;
  fallbackTitle?: string;
  viewerLabel?: string;
  onClose: () => void;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.split(',')[1] : b64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export const ReadOnlyMaterialViewer: React.FC<ReadOnlyMaterialViewerProps> = ({
  lang,
  noteId,
  note,
  fallbackTitle,
  viewerLabel,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReadOnlyMaterialPayload | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.15);
  const [renderingPage, setRenderingPage] = useState(false);

  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load protected material JSON stream via X-LiLab-Read-Only header
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNumPages(0);
    setCurrentPage(1);

    (async () => {
      try {
        const res = await fetchReadOnlyMaterial(noteId);
        if (cancelled) return;
        setPayload(res);

        const isPdf =
          Boolean(res.dataBase64) &&
          (res.mimeType?.toLowerCase().includes('pdf') || res.dataBase64.startsWith('JVBERi'));

        if (isPdf) {
          const [pdfjsLib, workerMod] = await Promise.all([
            import('pdfjs-dist'),
            import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
          ]);
          if (cancelled) return;
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerMod.default;
          const bytes = base64ToUint8Array(res.dataBase64);
          const loadingTask = pdfjsLib.getDocument({
            data: bytes,
            disableAutoFetch: true,
            disableStream: true,
          });
          loadingTaskRef.current = loadingTask;
          const pdfDoc = await loadingTask.promise;
          if (cancelled) {
            await loadingTask.destroy().catch(() => {});
            return;
          }
          pdfDocRef.current = pdfDoc;
          setNumPages(pdfDoc.numPages);
          setCurrentPage(1);
        } else {
          pdfDocRef.current = null;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to open read-only material.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.cleanup().catch(() => {});
        pdfDocRef.current = null;
      }
      if (loadingTaskRef.current) {
        loadingTaskRef.current.destroy().catch(() => {});
        loadingTaskRef.current = null;
      }
    };
  }, [noteId]);

  // Render active PDF page onto canvas (no native PDF toolbar / no download / no text copy layer)
  useEffect(() => {
    const docProxy = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!docProxy || !canvas || numPages === 0) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;
    setRenderingPage(true);

    (async () => {
      try {
        const page = await docProxy.getPage(currentPage);
        if (cancelled) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: zoom });
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        });
        await renderTask.promise;
      } catch (err) {
        if (!cancelled && (err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.warn('PDF page render warning:', err);
        }
      } finally {
        if (!cancelled) setRenderingPage(false);
      }
    })();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [currentPage, numPages, zoom, loading]);

  // Block Save / Print / Copy / View-Source keyboard shortcuts while read-only viewer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c', 'u', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.key === 'ArrowRight' && numPages > 0) {
        setCurrentPage((p) => Math.min(numPages, p + 1));
      } else if (e.key === 'ArrowLeft' && numPages > 0) {
        setCurrentPage((p) => Math.max(1, p - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose, numPages]);

  const title =
    note?.title ||
    payload?.fileName ||
    fallbackTitle ||
    biText(lang, 'Gemini Notebook · Protected Material', 'Sổ tay Gemini · Tài liệu Chỉ đọc');

  const watermarkText = `© LiLab Academy · Read-Only · Do Not Download${viewerLabel ? ` · ${viewerLabel}` : ''}`;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] bg-[#172154]/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 select-none no-print"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-[#FDF9EE] border border-[#2D3E99]/25 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top Bar */}
        <div className="bg-[#2D3E99] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-[#FFD41D]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E61E64] text-white flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {biText(lang, 'Read-Only · Copyright Protected', 'Chỉ đọc · Bảo vệ Bản quyền')}
                </span>
                {note?.weekNumber && (
                  <span className="text-xs text-[#FFD41D] font-semibold">
                    Week {note.weekNumber} · {note.programTitle}
                  </span>
                )}
              </div>
              <h3 className="font-display text-base sm:text-lg font-bold truncate mt-0.5">{title}</h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer shrink-0"
            aria-label={biText(lang, 'Close viewer', 'Đóng trình xem')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Copyright Banner */}
        <div className="bg-[#FFD41D]/25 border-b border-[#2D3E99]/15 px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#172154]">
          <span className="font-semibold flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#E61E64]" />
            {biText(
              lang,
              'Copyright Notice: Gemini Notebook materials are read-only inside this portal and cannot be downloaded, copied, or printed by anyone.',
              'Thông báo Bản quyền: Tài liệu Sổ tay Gemini chỉ được phép xem trực tiếp (chỉ đọc) và không thể tải xuống, sao chép hoặc in bởi bất kỳ ai.'
            )}
          </span>

          {numPages > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
                className="p-1.5 rounded-md bg-white border border-[#2D3E99]/20 text-[#2D3E99] hover:bg-[#FDF9EE] cursor-pointer"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono-num text-xs font-bold w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.15).toFixed(2))))}
                className="p-1.5 rounded-md bg-white border border-[#2D3E99]/20 text-[#2D3E99] hover:bg-[#FDF9EE] cursor-pointer"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-[#2D3E99]/20 mx-1" />
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md bg-white border border-[#2D3E99]/20 text-[#2D3E99] disabled:opacity-40 cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono-num text-xs font-bold px-1">
                {currentPage} / {numPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                className="p-1.5 rounded-md bg-white border border-[#2D3E99]/20 text-[#2D3E99] disabled:opacity-40 cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Protected Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {note && (
            <div className="bg-white border border-[#2D3E99]/15 rounded-xl p-5 space-y-3 relative overflow-hidden">
              <div className="text-xs font-bold text-[#2D3E99] uppercase tracking-wide">
                {biText(lang, 'Gemini Notebook · Bilingual Study Guide (Read-Only)', 'Sổ tay Gemini · Tóm tắt Song ngữ (Chỉ đọc)')}
              </div>
              <p className="text-sm text-[#172154]/90 leading-relaxed">
                {lang === 'vi'
                  ? note.summaryVi
                  : lang === 'en'
                    ? note.summaryEn
                    : `${note.summaryVi}\n\n${note.summaryEn}`}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#172154]/80 pt-3 border-t border-[#2D3E99]/10">
                {note.keyVocabulary && note.keyVocabulary.length > 0 && (
                  <div>
                    <strong className="text-[#2D3E99]">Key English:</strong> {note.keyVocabulary.join(', ')}
                  </div>
                )}
                {note.phonicsFocus && (
                  <div>
                    <strong className="text-[#E61E64]">Phonics:</strong> {note.phonicsFocus}
                  </div>
                )}
                {note.grammarFocus && (
                  <div>
                    <strong className="text-[#0D9488]">Grammar:</strong> {note.grammarFocus}
                  </div>
                )}
                {(note.activitiesVi || note.activitiesEn) && (
                  <div className="md:col-span-2">
                    <strong className="text-[#2D3E99]">{biText(lang, 'Activities:', 'Hoạt động:')}</strong>{' '}
                    {lang === 'vi' ? note.activitiesVi : note.activitiesEn}
                  </div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-12 text-center text-sm font-medium text-[#2D3E99]">
              {biText(lang, 'Loading protected read-only material...', 'Đang tải tài liệu chỉ đọc...')}
            </div>
          ) : error ? (
            <div className="bg-white border border-[#E61E64]/25 rounded-xl p-6 text-center text-sm text-[#E61E64]">
              {error}
            </div>
          ) : numPages > 0 ? (
            <div className="relative bg-[#172154]/5 border border-[#2D3E99]/15 rounded-xl p-4 flex flex-col items-center overflow-x-auto">
              <div className="relative inline-block shadow-lg bg-white rounded-lg overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="block pointer-events-none"
                />
                {/* Repeating Diagonal Copyright Watermark Overlay + Interaction Blocker */}
                <div
                  className="absolute inset-0 pointer-events-auto flex flex-col justify-around items-center overflow-hidden"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                >
                  {[0, 1, 2, 3].map((row) => (
                    <div
                      key={row}
                      className="text-[11px] sm:text-xs font-bold tracking-wider text-[#2D3E99]/18 -rotate-18 whitespace-nowrap px-4"
                    >
                      {watermarkText}
                    </div>
                  ))}
                </div>
                {renderingPage && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded bg-[#2D3E99]/80 text-white text-[11px] font-semibold">
                    {biText(lang, 'Rendering...', 'Đang hiển thị...')}
                  </div>
                )}
              </div>
            </div>
          ) : payload?.rawText ? (
            <div className="relative bg-white border border-[#2D3E99]/15 rounded-xl p-6 overflow-hidden">
              <div className="text-xs font-bold text-[#E61E64] mb-3">
                {biText(lang, 'Original Source Material (Read-Only)', 'Nội dung Tài liệu Gốc (Chỉ đọc)')}
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm text-[#172154]/90 leading-relaxed">
                {payload.rawText}
              </pre>
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-around items-center overflow-hidden">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="text-xs font-bold tracking-wider text-[#2D3E99]/10 -rotate-12 whitespace-nowrap"
                  >
                    {watermarkText}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#2D3E99]/12 rounded-xl p-6 text-center text-xs text-[#172154]/70">
              {biText(
                lang,
                'This Gemini Notebook entry displays its structured bilingual study guide above in read-only mode.',
                'Mục Sổ tay Gemini này hiển thị tóm tắt học tập song ngữ ở trên ở chế độ chỉ đọc.'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

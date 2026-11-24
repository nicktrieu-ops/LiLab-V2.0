import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Crop, Loader2, Move, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { biText } from '../i18n';
import type { LangCode } from '../types';

const MAX_DATA_URL_LENGTH = 110000;
const CROP_FRAME_SIZE = 280;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3.5;

export interface CropTransform {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

function clampCropOffset(
  offsetX: number,
  offsetY: number,
  naturalWidth: number,
  naturalHeight: number,
  zoom: number
): { offsetX: number; offsetY: number } {
  if (!naturalWidth || !naturalHeight) return { offsetX: 0, offsetY: 0 };
  const baseScale = Math.max(CROP_FRAME_SIZE / naturalWidth, CROP_FRAME_SIZE / naturalHeight);
  const displayScale = baseScale * zoom;
  const imgW = naturalWidth * displayScale;
  const imgH = naturalHeight * displayScale;
  const maxOffsetX = Math.max(0, (imgW - CROP_FRAME_SIZE) / 2);
  const maxOffsetY = Math.max(0, (imgH - CROP_FRAME_SIZE) / 2);

  return {
    offsetX: Math.min(maxOffsetX, Math.max(-maxOffsetX, offsetX)),
    offsetY: Math.min(maxOffsetY, Math.max(-maxOffsetY, offsetY)),
  };
}

export async function exportCroppedProfileImage(
  img: HTMLImageElement,
  transform: CropTransform
): Promise<string> {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh) {
    throw new Error('Invalid image dimensions.');
  }

  const baseScale = Math.max(CROP_FRAME_SIZE / sw, CROP_FRAME_SIZE / sh);
  const displayScale = baseScale * transform.zoom;
  const imgW = sw * displayScale;
  const imgH = sh * displayScale;
  const clamped = clampCropOffset(transform.offsetX, transform.offsetY, sw, sh, transform.zoom);
  const drawX = (CROP_FRAME_SIZE - imgW) / 2 + clamped.offsetX;
  const drawY = (CROP_FRAME_SIZE - imgH) / 2 + clamped.offsetY;

  const attempts: Array<{ dim: number; quality: number }> = [
    { dim: 240, quality: 0.84 },
    { dim: 240, quality: 0.68 },
    { dim: 180, quality: 0.72 },
    { dim: 140, quality: 0.62 },
  ];

  for (const attempt of attempts) {
    const canvas = document.createElement('canvas');
    canvas.width = attempt.dim;
    canvas.height = attempt.dim;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas image processing is not supported in this browser.');
    }
    const ratio = attempt.dim / CROP_FRAME_SIZE;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, attempt.dim, attempt.dim);
    ctx.drawImage(img, drawX * ratio, drawY * ratio, imgW * ratio, imgH * ratio);

    const dataUrl = canvas.toDataURL('image/jpeg', attempt.quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return dataUrl;
    }
  }

  throw new Error('Compressed image is still too large. Please pick a smaller image.');
}

export async function compressProfileImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (PNG, JPG, WebP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unable to load selected image.'));
      el.src = objectUrl;
    });

    return await exportCroppedProfileImage(img, { zoom: 1, offsetX: 0, offsetY: 0 });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getInitials(name?: string): string {
  const clean = (name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

export interface ProfileAvatarProps {
  src?: string | null;
  name?: string;
  fallbackSrc?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<ProfileAvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-24 h-24 text-2xl',
  '2xl': 'w-28 h-28 sm:w-32 sm:h-32 text-3xl border-[3px]',
  '3xl': 'w-32 h-32 sm:w-36 sm:h-36 text-4xl border-4',
};

function preferOptimizedAvatarSrc(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url === '/assets/lila_boy.png') return '/assets/media/lila_boy.webp';
  if (url === '/assets/lila_girl.png') return '/assets/media/lila_girl.webp';
  return url;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  src,
  name,
  fallbackSrc,
  size = 'md',
  className = '',
}) => {
  const [srcFailed, setSrcFailed] = useState(false);
  const [webpFailed, setWebpFailed] = useState(false);

  useEffect(() => {
    setSrcFailed(false);
    setWebpFailed(false);
  }, [src, fallbackSrc]);

  const optimizedFallback = webpFailed ? fallbackSrc : preferOptimizedAvatarSrc(fallbackSrc);
  const effectiveSrc = !srcFailed && src ? src : optimizedFallback;
  const sizeCls = SIZE_CLASSES[size];

  if (effectiveSrc) {
    return (
      <div
        className={`${sizeCls} aspect-square rounded-full overflow-hidden shrink-0 border border-[#172154]/12 bg-[#F2F4F8] flex items-center justify-center ${className}`}
      >
        <img
          src={effectiveSrc}
          alt={name || 'Profile avatar'}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (src && !srcFailed) {
              setSrcFailed(true);
            } else if (!webpFailed && optimizedFallback !== fallbackSrc) {
              setWebpFailed(true);
            }
          }}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      aria-label={name || 'Profile avatar'}
      className={`${sizeCls} aspect-square rounded-full shrink-0 border border-[#172154]/12 bg-[#F2F4F8] text-[#2D3E99] font-display font-bold flex items-center justify-center select-none ${className}`}
    >
      {getInitials(name)}
    </div>
  );
};

interface FaceCropModalProps {
  sourceUrl: string;
  name?: string;
  lang: LangCode;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}

const FaceCropModal: React.FC<FaceCropModalProps> = ({
  sourceUrl,
  name,
  lang,
  onCancel,
  onApply,
}) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originOffsetX: number;
    originOffsetY: number;
  } | null>(null);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setNaturalSize(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setLoadError(null);
  }, [sourceUrl]);

  const updateZoom = useCallback(
    (nextZoomRaw: number) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoomRaw.toFixed(2))));
      setZoom(nextZoom);
      if (naturalSize) {
        setOffset((prev) => {
          const clamped = clampCropOffset(prev.x, prev.y, naturalSize.w, naturalSize.h, nextZoom);
          return { x: clamped.offsetX, y: clamped.offsetY };
        });
      }
    },
    [naturalSize]
  );

  useEffect(() => {
    const el = frameRef.current;
    if (!el || !naturalSize) return;
    const onNativeWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const delta = ev.deltaY < 0 ? 0.12 : -0.12;
      setZoom((prevZoom) => {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((prevZoom + delta).toFixed(2))));
        setOffset((prevOffset) => {
          const clamped = clampCropOffset(
            prevOffset.x,
            prevOffset.y,
            naturalSize.w,
            naturalSize.h,
            nextZoom
          );
          return { x: clamped.offsetX, y: clamped.offsetY };
        });
        return nextZoom;
      });
    };
    el.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', onNativeWheel);
  }, [naturalSize]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    imgRef.current = el;
    const w = el.naturalWidth || el.width;
    const h = el.naturalHeight || el.height;
    if (!w || !h) {
      setLoadError(biText(lang, 'Could not read image size.', 'Không thể đọc kích thước ảnh.'));
      return;
    }
    setNaturalSize({ w, h });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originOffsetX: offset.x,
      originOffsetY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !naturalSize) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const clamped = clampCropOffset(
      drag.originOffsetX + dx,
      drag.originOffsetY + dy,
      naturalSize.w,
      naturalSize.h,
      zoom
    );
    setOffset({ x: clamped.offsetX, y: clamped.offsetY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture already released
      }
    }
  };

  const handleConfirm = async () => {
    if (!imgRef.current || !naturalSize) return;
    setSaving(true);
    setLoadError(null);
    try {
      const result = await exportCroppedProfileImage(imgRef.current, {
        zoom,
        offsetX: offset.x,
        offsetY: offset.y,
      });
      onApply(result);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : biText(lang, 'Could not crop photo.', 'Không thể cắt ảnh.')
      );
    } finally {
      setSaving(false);
    }
  };

  const baseScale = naturalSize
    ? Math.max(CROP_FRAME_SIZE / naturalSize.w, CROP_FRAME_SIZE / naturalSize.h)
    : 1;
  const displayScale = baseScale * zoom;
  const imgW = naturalSize ? naturalSize.w * displayScale : CROP_FRAME_SIZE;
  const imgH = naturalSize ? naturalSize.h * displayScale : CROP_FRAME_SIZE;
  const drawX = (CROP_FRAME_SIZE - imgW) / 2 + offset.x;
  const drawY = (CROP_FRAME_SIZE - imgH) / 2 + offset.y;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 bg-[#172154]/65 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={biText(lang, 'Adjust photo to face', 'Căn chỉnh ảnh khuôn mặt')}
    >
      <div className="bg-white border border-[#2D3E99]/20 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2D3E99]/12 flex items-center justify-between gap-3 bg-[#FDF9EE]">
          <div>
            <h4 className="font-display text-base font-bold text-[#2D3E99]">
              {biText(lang, 'Move & Resize to Face', 'Di chuyển & Thu phóng Khuôn mặt')}
            </h4>
            {name && (
              <p className="text-xs text-[#172154]/70 truncate">{name}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-[#172154]/70 hover:bg-[#2D3E99]/10 hover:text-[#2D3E99] cursor-pointer"
            aria-label={biText(lang, 'Close', 'Đóng')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center gap-2.5">
            <div
              ref={frameRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              style={{ width: CROP_FRAME_SIZE, height: CROP_FRAME_SIZE }}
              className="relative rounded-2xl overflow-hidden bg-[#172154]/10 border-2 border-[#2D3E99]/25 touch-none select-none cursor-grab active:cursor-grabbing"
            >
              <img
                src={sourceUrl}
                alt={name || 'Face crop preview'}
                draggable={false}
                onLoad={handleImageLoad}
                onError={() =>
                  setLoadError(
                    biText(lang, 'Unable to load image for cropping.', 'Không thể tải ảnh để cắt.')
                  )
                }
                style={
                  naturalSize
                    ? {
                        position: 'absolute',
                        left: `${drawX}px`,
                        top: `${drawY}px`,
                        width: `${imgW}px`,
                        height: `${imgH}px`,
                        maxWidth: 'none',
                        maxHeight: 'none',
                      }
                    : {
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }
                }
              />

              {/* Circular avatar framing guide with soft dimmed corners */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div
                  className="w-[244px] h-[244px] rounded-full border-2 border-white/95 shadow-[0_0_0_9999px_rgba(23,33,84,0.48)] relative"
                >
                  <div className="absolute inset-x-6 top-1/2 border-t border-dashed border-white/35" />
                  <div className="absolute inset-y-6 left-1/2 border-l border-dashed border-white/35" />
                </div>
              </div>
            </div>

            <div className="text-[11px] font-medium text-[#172154]/70 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-[#E61E64]" />
              <span>
                {biText(
                  lang,
                  'Drag image to center face · Scroll or use slider to zoom',
                  'Kéo ảnh để căn giữa khuôn mặt · Cuộn hoặc kéo thanh trượt để phóng to'
                )}
              </span>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="bg-[#FDF9EE] border border-[#2D3E99]/12 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#2D3E99]">
              <span>{biText(lang, 'Face Zoom', 'Thu phóng')}</span>
              <span className="font-mono-num text-[#E61E64]">{zoom.toFixed(2)}x</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => updateZoom(zoom - 0.15)}
                disabled={zoom <= MIN_ZOOM}
                className="p-1.5 rounded-lg border border-[#2D3E99]/20 bg-white text-[#2D3E99] hover:bg-[#2D3E99] hover:text-white disabled:opacity-40 cursor-pointer"
                aria-label={biText(lang, 'Zoom out', 'Thu nhỏ')}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.05}
                value={zoom}
                onChange={(e) => updateZoom(Number(e.target.value))}
                className="flex-1 accent-[#E61E64] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => updateZoom(zoom + 0.15)}
                disabled={zoom >= MAX_ZOOM}
                className="p-1.5 rounded-lg border border-[#2D3E99]/20 bg-white text-[#2D3E99] hover:bg-[#2D3E99] hover:text-white disabled:opacity-40 cursor-pointer"
                aria-label={biText(lang, 'Zoom in', 'Phóng to')}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                title={biText(lang, 'Reset position & zoom', 'Đặt lại vị trí')}
                className="p-1.5 rounded-lg border border-[#2D3E99]/20 bg-white text-[#172154]/75 hover:bg-[#56BEB8]/20 cursor-pointer"
                aria-label={biText(lang, 'Reset', 'Đặt lại')}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loadError && (
            <p className="text-xs font-medium text-[#E61E64] bg-[#E61E64]/10 rounded-lg px-3 py-2">
              {loadError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-[#2D3E99]/20 bg-white text-xs font-semibold text-[#172154] hover:bg-slate-50 cursor-pointer"
            >
              {biText(lang, 'Cancel', 'Hủy')}
            </button>
            <button
              type="button"
              disabled={!naturalSize || saving}
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg bg-[#E61E64] text-white text-xs font-bold hover:bg-[#c51754] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {biText(lang, 'Apply Photo', 'Dùng ảnh này')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export interface ProfilePhotoUploaderProps {
  photoUrl: string;
  onChange: (nextUrl: string) => void;
  name?: string;
  fallbackSrc?: string;
  lang: LangCode;
  compact?: boolean;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  photoUrl,
  onChange,
  name,
  fallbackSrc,
  lang,
  compact = false,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rawObjectUrl, setRawObjectUrl] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<{ url: string; isPendingUpload: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (rawObjectUrl) URL.revokeObjectURL(rawObjectUrl);
    };
  }, [rawObjectUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg(
        biText(
          lang,
          'Please choose a valid image file (PNG, JPG, WebP).',
          'Vui lòng chọn tệp ảnh hợp lệ (PNG, JPG, WebP).'
        )
      );
      return;
    }

    setErrorMsg(null);
    const nextRawUrl = URL.createObjectURL(file);
    setCropTarget({ url: nextRawUrl, isPendingUpload: true });
  };

  const handleCancelCrop = () => {
    if (cropTarget?.isPendingUpload && cropTarget.url !== rawObjectUrl) {
      URL.revokeObjectURL(cropTarget.url);
    }
    setCropTarget(null);
  };

  const handleApplyCrop = (dataUrl: string) => {
    if (cropTarget?.isPendingUpload) {
      setRawObjectUrl((prev) => {
        if (prev && prev !== cropTarget.url) URL.revokeObjectURL(prev);
        return cropTarget.url;
      });
    }
    setCropTarget(null);
    setErrorMsg(null);
    onChange(dataUrl);
  };

  const handleOpenAdjust = () => {
    const srcToCrop = rawObjectUrl || photoUrl;
    if (!srcToCrop) return;
    setErrorMsg(null);
    setCropTarget({ url: srcToCrop, isPendingUpload: false });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <ProfileAvatar
          src={photoUrl || undefined}
          fallbackSrc={fallbackSrc}
          name={name}
          size={compact ? 'md' : 'lg'}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-[#2D3E99]/25 bg-[#FDF9EE] hover:bg-[#2D3E99] hover:text-white text-[#2D3E99] text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            {photoUrl
              ? biText(lang, 'Change Photo', 'Đổi ảnh')
              : biText(lang, 'Upload Photo', 'Tải ảnh lên')}
          </button>

          {photoUrl && (
            <button
              type="button"
              onClick={handleOpenAdjust}
              className="px-2.5 py-1.5 rounded-lg border border-[#56BEB8]/40 bg-[#56BEB8]/15 hover:bg-[#56BEB8] text-[#172154] text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Crop className="w-3.5 h-3.5" />
              {biText(lang, 'Adjust', 'Căn chỉnh')}
            </button>
          )}

          {photoUrl && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setRawObjectUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
                onChange('');
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#E61E64]/25 bg-white hover:bg-[#E61E64]/10 text-[#E61E64] text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              {biText(lang, 'Remove', 'Xóa ảnh')}
            </button>
          )}
        </div>
      </div>
      {errorMsg && <p className="text-[11px] text-[#E61E64] font-medium">{errorMsg}</p>}

      {cropTarget && (
        <FaceCropModal
          sourceUrl={cropTarget.url}
          name={name}
          lang={lang}
          onCancel={handleCancelCrop}
          onApply={handleApplyCrop}
        />
      )}
    </div>
  );
};

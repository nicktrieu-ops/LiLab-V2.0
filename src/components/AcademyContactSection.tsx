import React, { useState } from 'react';
import { Check, Copy, ExternalLink, MapPin, MessageCircle, Phone } from 'lucide-react';
import { biText } from '../i18n';
import type { LangCode } from '../types';

export const LILAB_CONTACT = {
  hotlineDisplay: '0707 547 187',
  hotlineTel: '0707547187',
  zaloUrl: 'https://zalo.me/0707547187',
  address: 'C002 Chung cư ParcSpring, 537 Nguyễn Duy Trinh, phường Bình Trưng, TP.HCM.',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Chung+cu+ParcSpring+537+Nguyen+Duy+Trinh+phuong+Binh+Trung+TPHCM',
};

interface AcademyContactSectionProps {
  lang: LangCode;
  variant?: 'card' | 'footer';
}

export const AcademyContactSection: React.FC<AcademyContactSectionProps> = ({
  lang,
  variant = 'card',
}) => {
  const [copiedField, setCopiedField] = useState<'phone' | 'address' | null>(null);

  const handleCopy = async (value: string, field: 'phone' | 'address') => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      }
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard fallback ignored safely
    }
  };

  if (variant === 'footer') {
    return (
      <footer className="w-full bg-white border-t border-[#2D3E99]/12 mt-10 no-print">
        <div className="max-w-[1360px] mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          <div className="md:col-span-4 space-y-1.5">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#E61E64]">
              {biText(lang, 'Admissions & Consultation', 'Tuyển Sinh & Tư Vấn')}
            </div>
            <div className="font-display text-base font-extrabold text-[#2D3E99]">
              LiLab Creative Talent Academy
            </div>
            <p className="text-xs text-[#172154]/65">
              Be Whole · English &amp; Character Values · © 2026
            </p>
          </div>

          <div className="md:col-span-4 flex flex-col gap-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#2D3E99]/70">
              {biText(lang, 'Hotline / Zalo', 'Hotline / Zalo')}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`tel:${LILAB_CONTACT.hotlineTel}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/15 text-sm font-mono font-extrabold text-[#2D3E99] hover:border-[#E61E64] hover:text-[#E61E64] transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#E61E64]" />
                <span>{LILAB_CONTACT.hotlineDisplay}</span>
              </a>
              <a
                href={LILAB_CONTACT.zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0068FF] hover:bg-[#0056d6] text-white text-xs font-bold transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{biText(lang, 'Chat Zalo', 'Nhắn Zalo')}</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
              <button
                type="button"
                onClick={() => void handleCopy(LILAB_CONTACT.hotlineDisplay, 'phone')}
                className="p-1.5 rounded-lg border border-[#2D3E99]/15 text-[#2D3E99] hover:bg-[#FDF9EE] cursor-pointer"
                title={biText(lang, 'Copy hotline', 'Chép số điện thoại')}
              >
                {copiedField === 'phone' ? (
                  <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="md:col-span-4 flex flex-col gap-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#2D3E99]/70">
              {biText(lang, 'Location', 'Địa chỉ')}
            </div>
            <div className="flex items-start gap-2 text-xs text-[#172154]/85 leading-relaxed">
              <MapPin className="w-4 h-4 text-[#E61E64] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <a
                  href={LILAB_CONTACT.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-[#2D3E99] hover:underline"
                >
                  {LILAB_CONTACT.address}
                </a>
                <div className="flex items-center gap-3">
                  <a
                    href={LILAB_CONTACT.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2D3E99] hover:text-[#E61E64]"
                  >
                    <span>{biText(lang, 'Open Map', 'Xem Bản đồ')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopy(LILAB_CONTACT.address, 'address')}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#172154]/65 hover:text-[#2D3E99] cursor-pointer"
                  >
                    {copiedField === 'address' ? (
                      <>
                        <Check className="w-3 h-3 text-[#0D9488]" />
                        <span className="text-[#0D9488]">{biText(lang, 'Copied', 'Đã chép')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{biText(lang, 'Copy Address', 'Chép địa chỉ')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <section
      aria-label={biText(lang, 'Admissions & Consultation', 'Tuyển Sinh & Tư Vấn')}
      className="bg-white border border-[#2D3E99]/15 rounded-2xl p-6 sm:p-7 shadow-sm"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#E61E64]/10 text-[#E61E64] text-[11px] font-extrabold uppercase tracking-wider">
            <Phone className="w-3.5 h-3.5" />
            <span>{biText(lang, 'Admissions & Consultation', 'Tuyển Sinh & Tư Vấn')}</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#2D3E99]">
            {biText(
              lang,
              'Contact LiLab Creative Talent Academy',
              'Liên Hệ Tuyển Sinh & Tư Vấn LiLab'
            )}
          </h2>
          <p className="text-xs sm:text-sm text-[#172154]/75 leading-relaxed">
            {biText(
              lang,
              'Book a free English & CEFR placement assessment, tour our ParcSpring campus, or connect directly with our Admissions team on Zalo.',
              'Đặt lịch kiểm tra năng lực Tiếng Anh chuẩn CEFR miễn phí, tham quan cơ sở ParcSpring hoặc trao đổi trực tiếp với bộ phận Tuyển sinh qua Zalo.'
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 max-w-2xl">
          {/* Hotline / Zalo Box */}
          <div className="rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/15 p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#E61E64]">
                {biText(lang, 'Hotline / Zalo', 'Hotline / Zalo')}
              </div>
              <a
                href={`tel:${LILAB_CONTACT.hotlineTel}`}
                className="font-mono text-xl font-extrabold text-[#2D3E99] hover:text-[#E61E64] transition-colors inline-flex items-center gap-2"
              >
                <Phone className="w-4 h-4 text-[#E61E64]" />
                <span>{LILAB_CONTACT.hotlineDisplay}</span>
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={LILAB_CONTACT.zaloUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0068FF] hover:bg-[#0056d6] text-white text-xs font-bold transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{biText(lang, 'Chat on Zalo', 'Tư Vấn Zalo Ngay')}</span>
                <ExternalLink className="w-3 h-3 opacity-85" />
              </a>
              <button
                type="button"
                onClick={() => void handleCopy(LILAB_CONTACT.hotlineDisplay, 'phone')}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white border border-[#2D3E99]/15 text-xs font-semibold text-[#2D3E99] hover:bg-[#2D3E99]/5 cursor-pointer"
              >
                {copiedField === 'phone' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span className="text-[#0D9488]">{biText(lang, 'Copied', 'Đã chép')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{biText(lang, 'Copy', 'Chép')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Campus Location Box */}
          <div className="rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/15 p-4 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#2D3E99]">
                {biText(lang, 'Location', 'Địa chỉ')}
              </div>
              <div className="flex items-start gap-2 text-xs sm:text-sm font-semibold text-[#172154] leading-snug">
                <MapPin className="w-4 h-4 text-[#E61E64] shrink-0 mt-0.5" />
                <span>{LILAB_CONTACT.address}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={LILAB_CONTACT.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2D3E99] hover:bg-[#1f2c73] text-white text-xs font-bold transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{biText(lang, 'View on Maps', 'Xem Bản Đồ')}</span>
                <ExternalLink className="w-3 h-3 opacity-85" />
              </a>
              <button
                type="button"
                onClick={() => void handleCopy(LILAB_CONTACT.address, 'address')}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg bg-white border border-[#2D3E99]/15 text-xs font-semibold text-[#2D3E99] hover:bg-[#2D3E99]/5 cursor-pointer"
              >
                {copiedField === 'address' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span className="text-[#0D9488]">{biText(lang, 'Copied', 'Đã chép')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{biText(lang, 'Copy', 'Chép')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

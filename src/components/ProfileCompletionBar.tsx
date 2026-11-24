import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { biText } from '../i18n';
import type { LangCode } from '../types';

export interface ProfileCompletionField {
  key: string;
  labelEn: string;
  labelVi: string;
  filled: boolean;
}

export interface ProfileCompletionBarProps {
  lang: LangCode;
  fields: ProfileCompletionField[];
}

export function computeProfileCompletion(fields: ProfileCompletionField[]) {
  const total = fields.length || 1;
  const completed = fields.filter((f) => f.filled).length;
  const percent = Math.round((completed / total) * 100);
  const missing = fields.filter((f) => !f.filled);
  return { completed, total, percent, missing };
}

export const ProfileCompletionBar: React.FC<ProfileCompletionBarProps> = ({ lang, fields }) => {
  const { completed, total, percent, missing } = computeProfileCompletion(fields);

  const barColor =
    percent === 100 ? '#0D9488' : percent >= 65 ? '#D97706' : '#E61E64';
  const statusTextClass =
    percent === 100 ? 'text-[#0F766E]' : percent >= 65 ? 'text-[#B45309]' : 'text-[#E61E64]';

  return (
    <div className="p-3 rounded-lg bg-white border border-[#2D3E99]/15 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-[#172154]">
          {percent === 100 ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0D9488]" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-[#D97706]" />
          )}
          <span>{biText(lang, 'Profile Completion', 'Mức độ Hoàn thiện Hồ sơ')}</span>
        </div>

        <span className={`font-mono-num font-bold tabular-nums ${statusTextClass}`}>
          {completed}/{total} · {percent}%
        </span>
      </div>

      <div
        className="h-2 w-full rounded-full bg-[#2D3E99]/10 overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={biText(lang, 'Profile Completion Progress', 'Tiến độ hoàn thiện hồ sơ')}
      >
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${percent}%`, backgroundColor: barColor }}
        />
      </div>

      {missing.length > 0 ? (
        <div className="text-[11px] text-[#172154]/80 leading-relaxed">
          <span className="font-semibold text-[#B45309]">
            {biText(lang, 'Missing details:', 'Còn thiếu:')}{' '}
          </span>
          {missing.map((m, idx) => (
            <span key={m.key}>
              {idx > 0 && ', '}
              <span className="font-medium text-[#172154]">
                {lang === 'vi' ? m.labelVi : m.labelEn}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-[11px] font-medium text-[#0F766E]">
          {biText(lang, 'All profile details including photo & phone are complete.', 'Đã hoàn thiện đầy đủ ảnh đại diện, số điện thoại và thông tin.')}
        </div>
      )}
    </div>
  );
};

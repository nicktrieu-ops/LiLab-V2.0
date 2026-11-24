import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Inbox } from 'lucide-react';

export interface PanelCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_MAP: Record<NonNullable<PanelCardProps['padding']>, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

/** Single-elevation crisp white card with subtle 1px hairline border */
export const PanelCard: React.FC<PanelCardProps> = ({
  children,
  className = '',
  padding = 'md',
}) => (
  <div
    className={`bg-white border border-ink/10 rounded-[20px] ${PADDING_MAP[padding]} ${className}`}
  >
    {children}
  </div>
);

export interface SectionHeaderProps {
  title: string;
  meta?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Disciplined section heading: quiet metadata line, balanced title, single action slot */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  meta,
  subtitle,
  action,
  className = '',
}) => (
  <div className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
    <div className="space-y-1 max-w-2xl">
      {meta && (
        <div className="text-xs font-semibold text-[#525E80] tracking-tight">
          {meta}
        </div>
      )}
      <h2 className="font-display text-xl sm:text-2xl font-bold text-[#172154] tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-[#525E80] leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
  </div>
);

export interface PortalLoaderProps {
  label?: string;
  compact?: boolean;
}

/** Clean skeleton-style loading placeholder for Suspense & async modules */
export const PortalLoader: React.FC<PortalLoaderProps> = ({
  label = 'Loading...',
  compact = false,
}) => (
  <div
    role="status"
    aria-live="polite"
    className={`bg-white border border-[#172154]/10 rounded-2xl ${
      compact ? 'p-6' : 'p-8 sm:p-10'
    } space-y-4`}
  >
    <div className="flex items-center gap-3">
      <div className="w-5 h-5 rounded-full border-2 border-[#172154]/15 border-t-lantern animate-spin shrink-0" />
      <span className="text-xs font-semibold text-[#525E80]">{label}</span>
    </div>
    {!compact && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        <div className="h-20 rounded-xl bg-[#F2F4F8] animate-pulse" />
        <div className="h-20 rounded-xl bg-[#F2F4F8] animate-pulse" />
        <div className="h-20 rounded-xl bg-[#F2F4F8] animate-pulse" />
      </div>
    )}
  </div>
);

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

/** Restrained empty state with clear guidance and optional primary CTA */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
}) => (
  <div className="bg-white border border-[#172154]/10 rounded-2xl p-8 sm:p-10 text-center space-y-3">
    <div className="w-10 h-10 rounded-xl bg-[#F2F4F8] text-[#525E80] flex items-center justify-center mx-auto">
      {icon || <Inbox className="w-5 h-5" />}
    </div>
    <div className="space-y-1 max-w-md mx-auto">
      <h3 className="font-display text-base font-bold text-[#172154]">{title}</h3>
      <p className="text-sm text-[#525E80] leading-relaxed">{description}</p>
    </div>
    {action && <div className="pt-2 flex justify-center">{action}</div>}
  </div>
);

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusTextProps {
  tone: StatusTone;
  label: string;
}

/** Zero-pill semantic status indicator with icon + explicit text label */
export const StatusText: React.FC<StatusTextProps> = ({ tone, label }) => {
  const styles: Record<StatusTone, { cls: string; icon: React.ReactNode }> = {
    success: {
      cls: 'text-[#0F766E]',
      icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
    },
    warning: {
      cls: 'text-[#B45309]',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
    },
    danger: {
      cls: 'text-[#BE123C]',
      icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
    },
    neutral: {
      cls: 'text-[#525E80]',
      icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
    },
  };
  const cfg = styles[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${cfg.cls}`}>
      {cfg.icon}
      <span>{label}</span>
    </span>
  );
};

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Clean interactive segmented tab/filter control */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={`inline-flex flex-wrap items-center gap-1 p-1 bg-chalk rounded-xl ${className}`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              active
                ? 'bg-white text-ink shadow-[0_1px_0_rgba(26,36,98,0.12),0_0_0_1px_rgba(26,36,98,0.08)]'
                : 'text-muted hover:text-ink hover:bg-white/60'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export type LangSwitchCode = 'vi' | 'en' | 'bi';

export interface LangSwitchProps {
  value: LangSwitchCode;
  onChange: (code: LangSwitchCode) => void;
  tone?: 'light' | 'dark';
  className?: string;
}

const LANG_LABELS: Record<LangSwitchCode, { short: string; long: string }> = {
  vi: { short: 'VI', long: 'Tiếng Việt' },
  en: { short: 'EN', long: 'English' },
  bi: { short: 'EN+VI', long: 'English and Vietnamese' },
};

/** Language switch used in every top bar. Sun yellow marks the active language. */
export const LangSwitch: React.FC<LangSwitchProps> = ({ value, onChange, tone = 'light', className = '' }) => (
  <div
    role="radiogroup"
    aria-label="Language / Ngôn ngữ"
    className={`inline-flex items-center p-0.5 rounded-lg ${
      tone === 'dark' ? 'bg-white/10' : 'bg-chalk'
    } ${className}`}
  >
    {(Object.keys(LANG_LABELS) as LangSwitchCode[]).map((code) => {
      const active = value === code;
      return (
        <button
          key={code}
          type="button"
          role="radio"
          aria-checked={active}
          aria-label={LANG_LABELS[code].long}
          onClick={() => onChange(code)}
          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
            active
              ? 'bg-sun text-ink'
              : tone === 'dark'
                ? 'text-white/70 hover:text-white'
                : 'text-muted hover:text-ink'
          }`}
        >
          {LANG_LABELS[code].short}
        </button>
      );
    })}
  </div>
);

export interface OfferStripProps {
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
  className?: string;
}

/** Quiet enrolment strip: lotus edge marker, plain sentence-case copy, one action. */
export const OfferStrip: React.FC<OfferStripProps> = ({ title, detail, actionLabel, onAction, className = '' }) => (
  <div
    className={`bg-white border border-ink/10 rounded-2xl pl-5 pr-3 py-3 flex flex-wrap items-center justify-between gap-3 relative overflow-hidden ${className}`}
  >
    <span aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-1.5 bg-lotus" />
    <div className="min-w-0 space-y-0.5">
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="text-xs text-muted">{detail}</p>
    </div>
    <button
      type="button"
      onClick={onAction}
      className="px-4 py-2 rounded-lg bg-lotus/10 hover:bg-lotus/15 text-lotus text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
    >
      {actionLabel}
    </button>
  </div>
);

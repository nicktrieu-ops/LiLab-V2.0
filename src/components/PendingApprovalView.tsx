import React from 'react';
import { Clock, LogOut, MessageCircle, ShieldX } from 'lucide-react';
import { biText } from '../i18n';
import type { LangCode, UserProfile } from '../types';
import { LILAB_CONTACT } from './AcademyContactSection';
import { LangSwitch } from './ui/Primitives';

interface PendingApprovalViewProps {
  lang: LangCode;
  onToggleLang: (lang: LangCode) => void;
  profile: UserProfile;
  onSignOut: () => void;
}

/** Shown to people who registered themselves until an admin approves (or declines) the account. */
export const PendingApprovalView: React.FC<PendingApprovalViewProps> = ({ lang, onToggleLang, profile, onSignOut }) => {
  const declined = profile.status === 'declined';
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="bg-white border-b border-ink/10">
        <div className="max-w-[1100px] mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <img src="/assets/lilab_logo.png" alt="LiLab Creative Talent Academy" className="h-9 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <LangSwitch value={lang} onChange={onToggleLang} />
            <button
              type="button"
              onClick={onSignOut}
              className="px-3 py-2 rounded-lg text-muted hover:text-ink hover:bg-chalk text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {biText(lang, 'Sign out', 'Đăng xuất')}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-5">
        <section className="w-full max-w-lg bg-white border border-ink/10 rounded-[22px] p-7 sm:p-9 space-y-5" aria-live="polite">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${declined ? 'bg-lotus/10 text-lotus' : 'bg-sun/30 text-ink'}`}
          >
            {declined ? <ShieldX className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-[-0.02em]">
              {declined
                ? biText(lang, 'This account wasn’t approved', 'Tài khoản chưa được duyệt')
                : biText(lang, 'Thanks for signing up. LiLab will review your account.', 'Cảm ơn bạn đã đăng ký. LiLab sẽ duyệt tài khoản của bạn.')}
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              {declined
                ? biText(
                    lang,
                    'If you think this is a mistake, contact the LiLab office and we’ll look at it again.',
                    'Nếu bạn nghĩ đây là nhầm lẫn, hãy liên hệ văn phòng LiLab để được xem xét lại.'
                  )
                : biText(
                    lang,
                    'An admin checks every new account before it can see class schedules, reports and invoices. This page opens your portal automatically once you’re approved, usually within one working day.',
                    'Quản trị viên kiểm tra mỗi tài khoản mới trước khi có thể xem lịch học, báo cáo và học phí. Trang này sẽ tự mở cổng thông tin khi bạn được duyệt, thường trong một ngày làm việc.'
                  )}
            </p>
          </div>
          <dl className="bg-paper rounded-xl px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{biText(lang, 'Account', 'Tài khoản')}</dt>
              <dd className="font-semibold truncate">{profile.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">{biText(lang, 'Status', 'Trạng thái')}</dt>
              <dd className={`font-bold ${declined ? 'text-lotus' : 'text-ink'}`}>
                {declined ? biText(lang, 'Not approved', 'Chưa được duyệt') : biText(lang, 'Waiting for approval', 'Đang chờ duyệt')}
              </dd>
            </div>
          </dl>
          <a
            href={LILAB_CONTACT.zaloUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-ink hover:bg-ink-soft text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {biText(lang, `Message LiLab on Zalo · ${LILAB_CONTACT.hotlineDisplay}`, `Nhắn LiLab qua Zalo · ${LILAB_CONTACT.hotlineDisplay}`)}
          </a>
        </section>
      </main>
    </div>
  );
};

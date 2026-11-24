import React, { lazy, Suspense, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { BookOpen, Languages, LogIn, MessageSquare, ShieldCheck, UserPlus } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { biText, TRANSLATIONS } from '../i18n';
import type { LangCode } from '../types';
import { AcademyContactSection, LILAB_CONTACT } from './AcademyContactSection';
import { ErrorBoundary } from './ErrorBoundary';
import { LangSwitch, OfferStrip, PortalLoader } from './ui/Primitives';

const FiveYearTimeline = lazy(() =>
  import('./FiveYearTimeline').then((m) => ({ default: m.FiveYearTimeline }))
);
const ReadOnlyMaterialViewer = lazy(() =>
  import('./ReadOnlyMaterialViewer').then((m) => ({ default: m.ReadOnlyMaterialViewer }))
);

interface LoginViewProps {
  lang: LangCode;
  onToggleLang: (lang: LangCode) => void;
  onOpenAi: (initialTab?: 'chat' | 'translate') => void;
  onOpenPromo: () => void;
  pendingVerificationEmail?: string | null;
  onRefreshVerification?: () => Promise<void>;
  onSignOutPending?: () => Promise<void>;
}

export const LoginView: React.FC<LoginViewProps> = ({
  lang,
  onToggleLang,
  onOpenAi,
  onOpenPromo,
  pendingVerificationEmail,
  onRefreshVerification,
  onSignOutPending,
}) => {
  const t = TRANSLATIONS[lang];
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [regRole, setRegRole] = useState<'parent' | 'student'>('parent');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [mascotHatsImgOk, setMascotHatsImgOk] = useState(true);
  const [logoImgOk, setLogoImgOk] = useState(true);
  const [week01ViewerOpen, setWeek01ViewerOpen] = useState(false);

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (fullName.trim()) {
          await updateProfile(cred.user, { displayName: fullName.trim() });
        }
        sessionStorage.setItem('lilab_pending_role', regRole);
        sessionStorage.setItem('lilab_pending_name', fullName.trim());
        await sendEmailVerification(cred.user);
        setInfoMsg(
          biText(
            lang,
            'Account created. Check your inbox and verify your email address before entering the portal.',
            'Tài khoản đã được tạo. Vui lòng kiểm tra hộp thư để xác minh email trước khi vào cổng thông tin.'
          )
        );
      }
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/operation-not-allowed')) {
        setErrorMsg(
          biText(
            lang,
            'Email/Password sign-in is not yet enabled in Firebase Console. Sign in immediately with Google instead.',
            'Đăng nhập Email/Mật khẩu chưa được bật trong Firebase Console. Bạn có thể đăng nhập ngay bằng Google.'
          )
        );
      } else if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password')) {
        setErrorMsg(
          biText(
            lang,
            'Invalid email or password. Please check your credentials and try again.',
            'Email hoặc mật khẩu không chính xác. Vui lòng thử lại.'
          )
        );
      } else if (raw.includes('auth/email-already-in-use')) {
        setErrorMsg(
          biText(
            lang,
            'This email is already registered. Please switch to Sign In.',
            'Email này đã được đăng ký. Vui lòng chuyển sang Đăng nhập.'
          )
        );
      } else {
        setErrorMsg(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl border border-ink/15 bg-paper text-sm text-ink placeholder:text-muted/60 focus:bg-white focus:border-ink/40 transition-colors';

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <header className="bg-white/90 backdrop-blur border-b border-ink/10 sticky top-0 z-20">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-6">
          {logoImgOk ? (
            <img
              src="/assets/lilab_logo.png"
              alt="LiLab Creative Talent Academy"
              referrerPolicy="no-referrer"
              onError={() => setLogoImgOk(false)}
              className="h-9 w-auto object-contain shrink-0"
            />
          ) : (
            <span className="text-xl font-extrabold text-ink whitespace-nowrap shrink-0">LiLab</span>
          )}

          <nav aria-label={biText(lang, 'Try before you sign in', 'Dùng thử trước khi đăng nhập')} className="hidden md:flex items-center gap-1 text-sm font-semibold text-muted">
            <button
              type="button"
              onClick={() => onOpenAi('chat')}
              className="px-3 py-2 rounded-lg hover:text-ink hover:bg-chalk transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              {t.aiChatTab}
            </button>
            <button
              type="button"
              onClick={() => onOpenAi('translate')}
              className="px-3 py-2 rounded-lg hover:text-ink hover:bg-chalk transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
            >
              <Languages className="w-4 h-4" />
              {t.translatorTab}
            </button>
            <button
              type="button"
              onClick={() => setWeek01ViewerOpen(true)}
              className="px-3 py-2 rounded-lg hover:text-ink hover:bg-chalk transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              {biText(lang, 'Read Week 01', 'Đọc thử Tuần 01')}
            </button>
          </nav>

          <LangSwitch value={lang} onChange={onToggleLang} />
        </div>
      </header>

      <main className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-10 flex-1 space-y-5">
        {/* Storybook cover: the one bold moment on the page */}
        <section className="lilab-cover rounded-[28px] text-white overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-10 lg:p-12">
          <div className="lg:col-span-7 flex flex-col gap-8">
            <div className="space-y-5 max-w-[34rem]">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-sun">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-sun" />
                {t.beWholeTagline}
              </p>
              <h1 className="text-[2.35rem] leading-[1.08] sm:text-[3.4rem] sm:leading-[1.04] font-extrabold tracking-[-0.03em]">
                {biText(
                  lang,
                  'English that grows a whole child.',
                  'Học tiếng Anh, lớn lên trọn vẹn.'
                )}
              </h1>
              <p className="text-base sm:text-lg text-white/75 leading-relaxed">
                {biText(
                  lang,
                  'Schedules, Cambridge CEFR reports, class notes and tuition for every LiLab family, teacher and student, in English and Vietnamese.',
                  'Lịch học, báo cáo Cambridge CEFR, ghi chú lớp và học phí cho phụ huynh, giáo viên và học viên LiLab, bằng tiếng Việt và tiếng Anh.'
                )}
              </p>
            </div>

            <figure className="hidden sm:flex items-end gap-5 mt-auto">
              <div className="w-40 sm:w-56 shrink-0 rounded-2xl overflow-hidden bg-white -rotate-2 shadow-[0_18px_40px_-18px_rgba(10,14,40,0.6)]">
                {mascotHatsImgOk ? (
                  <img
                    src="/assets/media/login_mascot_hats.webp"
                    alt={biText(lang, 'Lila and Li, the LiLab mascots', 'Lila và Li, hai linh vật của LiLab')}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setMascotHatsImgOk(false)}
                    className="w-full aspect-[4/3] object-cover"
                  />
                ) : (
                  <div className="w-full aspect-[4/3] flex items-center justify-center text-xs font-semibold text-muted">LiLab</div>
                )}
              </div>
              <figcaption className="pb-1 space-y-1.5 max-w-xs lg:pl-8">
                <blockquote className="text-lg sm:text-xl font-bold leading-snug">
                  {biText(lang, '“Kind hands help. Kind words heal.”', '“Đôi tay tử tế giúp đỡ. Lời nói tử tế chữa lành.”')}
                </blockquote>
                <p className="text-xs text-white/60">
                  {biText(lang, 'Be Whole, week 1: Kindness', 'Be Whole, tuần 1: Lòng tốt')}
                </p>
              </figcaption>
            </figure>
          </div>

          {/* Sign-in card */}
          <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="bg-white text-ink rounded-[22px] p-5 sm:p-8 space-y-6 shadow-[0_24px_60px_-20px_rgba(10,14,40,0.55)]">
            {pendingVerificationEmail ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-lagoon shrink-0" />
                  <h2 className="text-xl font-bold">
                    {biText(lang, 'Check your inbox', 'Kiểm tra hộp thư')}
                  </h2>
                </div>
                <p className="text-sm text-muted leading-relaxed">
                  {biText(
                    lang,
                    `We sent a verification link to ${pendingVerificationEmail}. Open it, then come back and continue.`,
                    `Chúng tôi đã gửi liên kết xác minh tới ${pendingVerificationEmail}. Mở liên kết rồi quay lại để tiếp tục.`
                  )}
                </p>
                <div className="flex flex-col gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onRefreshVerification}
                    className="w-full py-3 px-4 rounded-xl bg-lantern hover:bg-lantern-deep text-white text-sm font-bold transition-colors cursor-pointer"
                  >
                    {biText(lang, 'I’ve verified, continue', 'Tôi đã xác minh, tiếp tục')}
                  </button>
                  <button
                    type="button"
                    onClick={() => auth.currentUser && sendEmailVerification(auth.currentUser)}
                    className="w-full py-3 px-4 rounded-xl border border-ink/15 text-ink text-sm font-semibold hover:bg-chalk transition-colors cursor-pointer"
                  >
                    {biText(lang, 'Resend link', 'Gửi lại liên kết')}
                  </button>
                  <button
                    type="button"
                    onClick={onSignOutPending}
                    className="w-full py-2 px-4 text-xs font-semibold text-muted hover:text-ink cursor-pointer"
                  >
                    {biText(lang, 'Use a different account', 'Dùng tài khoản khác')}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-bold">{t.loginTitle}</h2>
                  <p className="text-sm text-muted leading-relaxed">{t.loginSubtitle}</p>
                </div>

                {/* Segmented Mode Switch */}
                <div className="grid grid-cols-2 p-1 bg-chalk rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signin');
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'signin'
                        ? 'bg-white text-ink shadow-[0_0_0_1px_rgba(26,36,98,0.08)]'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <LogIn className="w-4 h-4" />
                    {t.signInTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setErrorMsg(null);
                    }}
                    className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                      mode === 'register'
                        ? 'bg-white text-ink shadow-[0_0_0_1px_rgba(26,36,98,0.08)]'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    {t.registerTab}
                  </button>
                </div>

                {/* Primary Google Sign-In CTA */}
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-ink text-white font-bold text-sm hover:bg-ink-soft transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  {t.continueWithGoogle}
                </button>

                <div className="flex items-center gap-3 text-xs text-muted">
                  <div className="h-px flex-1 bg-ink/10" />
                  <span>{t.orUseEmail}</span>
                  <div className="h-px flex-1 bg-ink/10" />
                </div>

                {/* Email / Password Form */}
                <form onSubmit={handleEmailAuth} className="space-y-4">
                  {mode === 'register' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-ink mb-1.5">
                          {t.fullNameLabel}
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder={lang === 'vi' ? 'Nguyễn Minh Anh' : 'Minh Anh Nguyen'}
                          className={inputCls}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-ink mb-1.5">
                          {t.registerAsLabel}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setRegRole('parent')}
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              regRole === 'parent'
                                ? 'bg-sun/25 border-ink text-ink'
                                : 'border-ink/15 text-muted hover:bg-chalk'
                            }`}
                          >
                            {t.roleParent}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRegRole('student')}
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              regRole === 'student'
                                ? 'bg-sun/25 border-ink text-ink'
                                : 'border-ink/15 text-muted hover:bg-chalk'
                            }`}
                          >
                            {t.roleStudent}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      {t.emailLabel}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-ink mb-1.5">
                      {t.passwordLabel}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputCls}
                    />
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECDD3] text-xs text-[#BE123C] leading-relaxed">
                      {errorMsg}
                    </div>
                  )}

                  {infoMsg && (
                    <div className="p-3 rounded-xl bg-[#F0FDFA] border border-[#99F6E4] text-xs text-[#0F766E] leading-relaxed">
                      {infoMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-lantern hover:bg-lantern-deep text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {mode === 'signin' ? t.signInButton : t.registerButton}
                  </button>
                </form>

                <div className="pt-4 border-t border-ink/8 text-xs text-muted">
                  {biText(
                    lang,
                    'Teachers & Admins sign in with their invited academy email.',
                    'Giáo viên & Quản trị đăng nhập bằng email được cấp quyền.'
                  )}
                </div>
              </>
            )}
          </div>
          </div>
        </section>

        <OfferStrip
          title={biText(lang, 'Big Skills, Big Heart: new classes for ages 7–12', 'Big Skills, Big Heart: khai giảng lớp mới cho bé 7–12 tuổi')}
          detail={biText(
            lang,
            'Small groups with international teachers. Register on Zalo 0707 547 187.',
            'Lớp nhỏ cùng giáo viên nước ngoài. Đăng ký qua Zalo 0707 547 187.'
          )}
          actionLabel={biText(lang, 'See courses and fees', 'Xem khoá học và học phí')}
          onAction={onOpenPromo}
        />
      </main>

      {/* Lazy-loaded 5-Year Learning & Development Roadmap */}
      <section className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 pb-8">
        <ErrorBoundary variant="section" sectionLabel="5-Year Learning Roadmap">
          <Suspense
            fallback={
              <PortalLoader
                label={biText(lang, 'Loading 5-Year Curriculum Roadmap...', 'Đang tải Lộ trình 5 Năm...')}
              />
            }
          >
            <FiveYearTimeline lang={lang} variant="template" />
          </Suspense>
        </ErrorBoundary>
      </section>

      {/* Admissions & Consultation Contact Info */}
      <section className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 pb-10">
        <AcademyContactSection lang={lang} variant="card" />
      </section>

      {/* Clean High-Contrast Footer */}
      <footer className="bg-ink text-white/70 mt-auto">
        <div className="max-w-[1280px] mx-auto px-5 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs">
          <span>
            © 2026 LiLab Creative Talent Academy. Hotline / Zalo {LILAB_CONTACT.hotlineDisplay}
          </span>
          <span>{LILAB_CONTACT.address}</span>
        </div>
      </footer>

      {week01ViewerOpen && (
        <Suspense fallback={null}>
          <ReadOnlyMaterialViewer
            lang={lang}
            noteId="note_be_whole_week_01"
            fallbackTitle={biText(lang, 'Week 01 · Kindness (Be Whole)', 'Tuần 01 · Lòng Tốt (Be Whole)')}
            onClose={() => setWeek01ViewerOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};

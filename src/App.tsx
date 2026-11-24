import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { ChevronDown, LogOut, Mic } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { biText, TRANSLATIONS } from './i18n';
import {
  getParentNavTabs,
  getStudentNavTabs,
  getTeacherNavTabs,
  PORTAL_ACCENTS,
  type AdminTab,
  type ParentTab,
  type PortalKey,
  type StudentTab,
  type TeacherTab,
} from './config/portalNavigation';
import { isSuperAdminEmail } from './services/seedData';
import { invalidateCatalogue } from './services/catalogueReads';
import type { LangCode, UserProfile, UserRole } from './types';
import { AcademyContactSection } from './components/AcademyContactSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { PendingApprovalView } from './components/PendingApprovalView';
import { ProfileAvatar } from './components/ProfileAvatar';
import { LangSwitch, OfferStrip, PortalLoader, SegmentedControl } from './components/ui/Primitives';

const BigSkillsPromoModal = lazy(() =>
  import('./components/BigSkillsPromoModal').then((m) => ({ default: m.BigSkillsPromoModal }))
);
const AiAssistantDrawer = lazy(() =>
  import('./components/AiAssistantDrawer').then((m) => ({ default: m.AiAssistantDrawer }))
);
const AdminConsole = lazy(() =>
  import('./components/AdminConsole').then((m) => ({ default: m.AdminConsole }))
);
const TeacherDashboard = lazy(() =>
  import('./components/TeacherDashboard').then((m) => ({ default: m.TeacherDashboard }))
);
const ParentStudentPortal = lazy(() =>
  import('./components/ParentStudentPortal').then((m) => ({ default: m.ParentStudentPortal }))
);
const StudentPortal = lazy(() =>
  import('./components/StudentPortal').then((m) => ({ default: m.StudentPortal }))
);

const PROMO_DISMISS_DATE_KEY = 'lilab_big_skills_promo_dismiss_date';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [lang, setLang] = useState<LangCode>('vi');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTab, setAiTab] = useState<'chat' | 'translate'>('chat');
  const [adminPreviewRole, setAdminPreviewRole] = useState<'admin' | 'teacher' | 'parent' | 'student'>('admin');
  const [promoHighlightProgramId, setPromoHighlightProgramId] = useState<string | null>(null);
  const [parentFocusProgramId, setParentFocusProgramId] = useState<string | null>(null);

  // Unified Top-Header Controlled Tab States per Portal
  const [adminTab, setAdminTab] = useState<AdminTab>('classes');
  const [teacherTab, setTeacherTab] = useState<TeacherTab>('schedule');
  const [parentTab, setParentTab] = useState<ParentTab>('dashboard');
  const [studentTab, setStudentTab] = useState<StudentTab>('studio');

  // V2: the offer no longer covers the sign-in form. It opens once a day for parents after sign-in.
  const [promoOpen, setPromoOpen] = useState<boolean>(false);
  const promoAutoShownRef = useRef(false);


  const handleClosePromo = (dontShowToday = false) => {
    setPromoOpen(false);
    setPromoHighlightProgramId(null);
    try {
      if (dontShowToday) {
        localStorage.setItem(PROMO_DISMISS_DATE_KEY, new Date().toISOString().slice(0, 10));
      }
    } catch {
      // Non-blocking
    }
  };

  const handleOpenPromo = (highlightProgramId?: string) => {
    setPromoHighlightProgramId(highlightProgramId || null);
    setPromoOpen(true);
  };

  // V2 cost control: remember the resolved profile for this browser tab session so reloads
  // don't repeat the profile, admin and student-match lookups (up to 4 reads per visit).
  const PROFILE_CACHE_PREFIX = 'lilab_profile_v2_';
  const rememberProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    // Only approved profiles are cached, so an approval takes effect on the next load.
    if (profile.status !== 'active') return;
    try {
      sessionStorage.setItem(PROFILE_CACHE_PREFIX + profile.uid, JSON.stringify(profile));
    } catch {
      // storage unavailable
    }
  };

  const syncUserProfile = async (user: User) => {
    if (!user.emailVerified) {
      setUserProfile(null);
      return;
    }
    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_PREFIX + user.uid);
      if (cached) {
        const parsed = JSON.parse(cached) as UserProfile;
        if (parsed.status !== 'active') throw new Error('stale');
        setUserProfile(parsed);
        if (parsed.preferredLang) setLang(parsed.preferredLang);
        return;
      }
    } catch {
      // ignore a corrupt cache entry and load normally
    }

    setProfileLoading(true);
    setProfileError(null);
    const email = (user.email || '').toLowerCase();

    try {
      const userRef = doc(db, 'users', user.uid);
      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (userSnap.exists()) {
        let loaded = userSnap.data() as UserProfile;
        if (isSuperAdminEmail(email)) {
          const adminRef = doc(db, 'admins', user.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, {
              uid: user.uid,
              email,
              displayName: user.displayName || loaded.displayName || email.split('@')[0],
              level: 'super_admin',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else if (adminSnap.data().level !== 'super_admin') {
            await updateDoc(adminRef, {
              level: 'super_admin',
              updatedAt: serverTimestamp(),
            });
          }
          if (loaded.role !== 'super_admin') {
            await updateDoc(userRef, {
              role: 'super_admin',
              updatedAt: serverTimestamp(),
            });
            loaded = { ...loaded, role: 'super_admin' };
          }
        } else if (loaded.role === 'super_admin') {
          try {
            const adminSnap = await getDoc(doc(db, 'admins', user.uid));
            const fallbackRole: UserRole =
              adminSnap.exists() && adminSnap.data().level === 'admin' ? 'admin' : 'parent';
            loaded = { ...loaded, role: fallbackRole };
          } catch {
            loaded = { ...loaded, role: 'parent' };
          }
        } else if (loaded.role === 'parent') {
          try {
            const stuQ = query(collection(db, 'students'), where('studentEmail', '==', email));
            const stuSnap = await getDocs(stuQ);
            if (!stuSnap.empty) {
              const matchedStu = stuSnap.docs[0].data();
              if ((matchedStu.parentEmail || '').toLowerCase() !== email) {
                loaded = { ...loaded, role: 'student' };
              }
            }
          } catch {
            // ignore student lookup error
          }
        }
        rememberProfile(loaded);
        if (loaded.preferredLang) setLang(loaded.preferredLang);
        return;
      }

      if (isSuperAdminEmail(email)) {
        const newSuperAdmin: UserProfile = {
          uid: user.uid,
          email,
          displayName: user.displayName || `${email.split('@')[0]} (Super Admin)`,
          role: 'super_admin',
          preferredLang: lang,
          status: 'active',
        };
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email,
          displayName: newSuperAdmin.displayName,
          level: 'super_admin',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await setDoc(userRef, {
          ...newSuperAdmin,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        rememberProfile(newSuperAdmin);
        return;
      }

      let assignedRole: UserRole =
        (sessionStorage.getItem('lilab_pending_role') as 'parent' | 'student') || 'parent';
      let claimedInviteId: string | undefined;
      let displayName =
        user.displayName || sessionStorage.getItem('lilab_pending_name') || email.split('@')[0];

      try {
        const invQ = query(collection(db, 'user_invites'), where('email', '==', email));
        const invSnap = await getDocs(invQ);
        const pendingDocs = invSnap.docs.filter((d) => d.data().status === 'pending');
        if (pendingDocs.length > 0) {
          const invDoc = pendingDocs[0];
          const invData = invDoc.data();
          claimedInviteId = invDoc.id;
          assignedRole = invData.role as UserRole;
          if (invData.displayName) displayName = invData.displayName;
        } else {
          const stuQ = query(collection(db, 'students'), where('studentEmail', '==', email));
          const stuSnap = await getDocs(stuQ);
          if (!stuSnap.empty) {
            const stuData = stuSnap.docs[0].data();
            if ((stuData.parentEmail || '').toLowerCase() !== email) {
              assignedRole = 'student';
              if (stuData.fullName) displayName = stuData.fullName;
            }
          }
        }
      } catch (err) {
        console.warn('Invite lookup skipped:', err);
      }

      if (assignedRole === 'admin' && claimedInviteId) {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email,
          displayName,
          level: 'admin',
          claimedInviteId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // V2: people who register themselves wait for an admin to approve them.
      // Anyone who claimed an admin invite is approved already.
      const initialStatus: UserProfile['status'] = claimedInviteId ? 'active' : 'pending';

      const profilePayload: Record<string, unknown> = {
        uid: user.uid,
        email,
        displayName,
        role: assignedRole,
        preferredLang: lang,
        status: initialStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (claimedInviteId) {
        profilePayload.claimedInviteId = claimedInviteId;
      }

      await setDoc(userRef, profilePayload);

      if (claimedInviteId) {
        await updateDoc(doc(db, 'user_invites', claimedInviteId), {
          status: 'claimed',
          updatedAt: serverTimestamp(),
        });
      }

      sessionStorage.removeItem('lilab_pending_role');
      sessionStorage.removeItem('lilab_pending_name');

      const builtProfile: UserProfile = {
        uid: user.uid,
        email,
        displayName,
        role: assignedRole,
        preferredLang: lang,
        status: initialStatus,
        ...(claimedInviteId ? { claimedInviteId } : {}),
      };
      rememberProfile(builtProfile);
    } catch (err) {
      console.error('Profile sync error:', err);
      setProfileError(err instanceof Error ? err.message : 'Unable to load account profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user) {
        await syncUserProfile(user);
      } else {
        setUserProfile(null);
      }
    });
    return () => unsub();
  }, []);

  const handleToggleLang = async (next: LangCode) => {
    setLang(next);
    if (firebaseUser && userProfile && firebaseUser.emailVerified) {
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          preferredLang: next,
          updatedAt: serverTimestamp(),
        });
        const updatedProfile = { ...userProfile, preferredLang: next };
        rememberProfile(updatedProfile);
      } catch {
        // Non-blocking preference save
      }
    }
  };

  const handleRefreshVerification = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const updated = auth.currentUser;
    setFirebaseUser(updated);
    if (updated.emailVerified) {
      await syncUserProfile(updated);
    }
  };

  const openAiDrawer = (tab: 'chat' | 'translate' = 'chat') => {
    setAiTab(tab);
    setAiOpen(true);
  };

  useEffect(() => {
    if (import.meta.env.MODE === 'preview') return; // keep the clickable preview unobstructed
    if (promoAutoShownRef.current || userProfile?.role !== 'parent') return;
    promoAutoShownRef.current = true;
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(PROMO_DISMISS_DATE_KEY) !== todayKey) setPromoOpen(true);
    } catch {
      // storage unavailable: skip the auto-open
    }
  }, [userProfile?.role]);

  // While an account waits for approval, watch it so the portal opens the moment an admin approves.
  const awaitingReview = userProfile?.status === 'pending' || userProfile?.status === 'declined';
  useEffect(() => {
    if (!awaitingReview || !firebaseUser) return;
    return onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      if (!snap.exists()) return;
      const next = snap.data() as UserProfile;
      if (next.status !== userProfile?.status || next.role !== userProfile?.role) rememberProfile(next);
    });
  }, [awaitingReview, firebaseUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = TRANSLATIONS[lang];

  if (!authReady || profileLoading) {
    return (
      <>
        <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4 text-ink p-6">
          <img
            src="/assets/lilab_logo.png"
            alt="LiLab Creative Talent Academy"
            referrerPolicy="no-referrer"
            className="h-12 w-auto object-contain"
          />
          <div className="flex items-center gap-2.5 text-sm font-medium text-muted">
            <div className="w-4 h-4 rounded-full border-2 border-ink/15 border-t-lantern animate-spin" />
            <span>{biText(lang, 'Loading LiLab Academy Portal...', 'Đang tải cổng thông tin LiLab...')}</span>
          </div>
        </div>
        {promoOpen && (
          <Suspense fallback={null}>
            <BigSkillsPromoModal isOpen={promoOpen} lang={lang} onClose={handleClosePromo} />
          </Suspense>
        )}
      </>
    );
  }

  if (!firebaseUser || !firebaseUser.emailVerified) {
    return (
      <>
        <LoginView
          lang={lang}
          onToggleLang={handleToggleLang}
          onOpenAi={openAiDrawer}
          onOpenPromo={() => setPromoOpen(true)}
          pendingVerificationEmail={firebaseUser && !firebaseUser.emailVerified ? firebaseUser.email : null}
          onRefreshVerification={handleRefreshVerification}
          onSignOutPending={() => signOut(auth)}
        />
        {aiOpen && (
          <Suspense fallback={null}>
            <AiAssistantDrawer
              isOpen={aiOpen}
              initialTab={aiTab}
              onClose={() => setAiOpen(false)}
              lang={lang}
              role="visitor"
            />
          </Suspense>
        )}
        {promoOpen && (
          <Suspense fallback={null}>
            <BigSkillsPromoModal isOpen={promoOpen} lang={lang} onClose={handleClosePromo} />
          </Suspense>
        )}
      </>
    );
  }

  if (userProfile && awaitingReview && !isSuperAdminEmail(userProfile.email)) {
    return (
      <PendingApprovalView
        lang={lang}
        onToggleLang={handleToggleLang}
        profile={userProfile}
        onSignOut={() => void signOut(auth)}
      />
    );
  }

  const effectiveRole: UserRole = userProfile?.role || 'parent';
  const showRole: UserRole =
    effectiveRole === 'super_admin' || effectiveRole === 'admin'
      ? adminPreviewRole === 'teacher'
        ? 'teacher'
        : adminPreviewRole === 'parent'
          ? 'parent'
          : adminPreviewRole === 'student'
            ? 'student'
            : effectiveRole
      : effectiveRole;

  const activePortalKey: PortalKey =
    showRole === 'super_admin' || showRole === 'admin'
      ? 'admin'
      : showRole === 'teacher'
        ? 'teacher'
        : showRole === 'student'
          ? 'student'
          : 'parent';

  const portalAccent = PORTAL_ACCENTS[activePortalKey];

  const teacherNavTabs = getTeacherNavTabs(lang);
  const parentNavTabs = getParentNavTabs(lang);
  const studentNavTabs = getStudentNavTabs(lang);

  const roleTitle =
    showRole === 'super_admin' || showRole === 'admin'
      ? biText(lang, 'Academy admin', 'Quản trị học viện')
      : showRole === 'teacher'
        ? biText(lang, 'Teacher studio', 'Phòng giáo viên')
        : showRole === 'student'
          ? biText(lang, 'My learning space', 'Góc học tập của em')
          : biText(lang, 'Family dashboard', 'Trang phụ huynh');

  const roleNavTabs: Array<{ id: string; label: string }> =
    activePortalKey === 'teacher'
      ? teacherNavTabs
      : activePortalKey === 'parent'
        ? parentNavTabs
        : activePortalKey === 'student'
          ? studentNavTabs
          : [];
  const activeRoleTab =
    activePortalKey === 'teacher' ? teacherTab : activePortalKey === 'parent' ? parentTab : studentTab;
  const selectRoleTab = (id: string) => {
    if (activePortalKey === 'teacher') setTeacherTab(id as TeacherTab);
    else if (activePortalKey === 'parent') setParentTab(id as ParentTab);
    else setStudentTab(id as StudentTab);
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* V2 app bar: ink navy, one row of role tabs, sun-yellow marker on the active tab */}
      <header className="bg-ink text-white sticky top-0 z-30 no-print">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-4 sm:gap-6">
          <span className="bg-white rounded-xl px-2.5 py-1.5 shrink-0 inline-flex">
            <img
              src="/assets/lilab_logo.png"
              alt="LiLab Creative Talent Academy"
              referrerPolicy="no-referrer"
              className="h-6 sm:h-7 w-auto object-contain"
            />
          </span>

          <span className={`${roleNavTabs.length > 6 ? "hidden 2xl:inline" : "hidden lg:inline"} text-sm font-bold text-white whitespace-nowrap`}>{roleTitle}</span>

          <nav
            aria-label={biText(lang, 'Portal sections', 'Các mục trong cổng')}
            className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0 h-full"
          >
            {roleNavTabs.map((tab) => {
              const isActive = activeRoleTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => selectRoleTab(tab.id)}
                  className="lilab-tab px-3 py-2 text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5"
                >
                  {tab.id === 'speaking' && <Mic className="w-3.5 h-3.5 shrink-0" />}
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <LangSwitch value={lang} onChange={handleToggleLang} tone="dark" className="hidden sm:inline-flex" />
            <button
              type="button"
              onClick={() => {
                try {
                  Object.keys(sessionStorage)
                    .filter((k) => k.startsWith(PROFILE_CACHE_PREFIX))
                    .forEach((k) => sessionStorage.removeItem(k));
                } catch {
                  // storage unavailable
                }
                invalidateCatalogue();
                void signOut(auth);
              }}
              className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.signOut}</span>
            </button>
          </div>
        </div>
      </header>

      {activePortalKey === 'parent' && (
        <div className="w-full max-w-[1380px] mx-auto px-4 sm:px-6 pt-4 no-print">
          <OfferStrip
            title={biText(lang, 'Big Skills, Big Heart: new classes for ages 7–12', 'Big Skills, Big Heart: khai giảng lớp mới cho bé 7–12 tuổi')}
            detail={biText(
              lang,
              'Small groups with international teachers. Register on Zalo 0707 547 187.',
              'Lớp nhỏ cùng giáo viên nước ngoài. Đăng ký qua Zalo 0707 547 187.'
            )}
            actionLabel={biText(lang, 'See courses and fees', 'Xem khoá học và học phí')}
            onAction={() => setPromoOpen(true)}
          />
        </div>
      )}

      <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 no-print">
          <div className="flex items-center gap-4">
            <ProfileAvatar
              src={userProfile?.photoUrl || firebaseUser.photoURL}
              name={userProfile?.displayName || firebaseUser.email || undefined}
              size="md"
            />
            <div>
              <p className="text-sm text-muted">
                {biText(lang, 'Hello,', 'Xin chào,')} {userProfile?.displayName || firebaseUser.email}
              </p>
              <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-ink tracking-[-0.025em] mt-0.5">
                {roleTitle}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <LangSwitch value={lang} onChange={handleToggleLang} className="sm:hidden" />

            {(effectiveRole === 'super_admin' || effectiveRole === 'admin') && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">{biText(lang, 'View as', 'Xem với vai trò')}</span>
                <SegmentedControl
                  value={adminPreviewRole}
                  onChange={(next) => {
                    invalidateCatalogue(); // admins may have just edited programs or notes
                    setAdminPreviewRole(next);
                  }}
                  options={[
                    { id: 'admin', label: biText(lang, 'Admin', 'Quản trị') },
                    { id: 'teacher', label: biText(lang, 'Teacher', 'Giáo viên') },
                    { id: 'parent', label: biText(lang, 'Parent', 'Phụ huynh') },
                    { id: 'student', label: biText(lang, 'Student', 'Học viên') },
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        {profileError && (
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECDD3] text-sm text-[#BE123C]">
            {profileError}
          </div>
        )}

        <ErrorBoundary key={showRole} variant="section" sectionLabel={`${showRole} portal`}>
          <Suspense
            fallback={
              <PortalLoader
                label={biText(lang, 'Loading portal workspace...', 'Đang tải không gian làm việc...')}
              />
            }
          >
            {userProfile && (showRole === 'super_admin' || showRole === 'admin') && (
              <AdminConsole
                lang={lang}
                currentUser={userProfile}
                activeTab={adminTab}
                onTabChange={setAdminTab}
                onOpenPromoPopup={handleOpenPromo}
              />
            )}
            {userProfile && showRole === 'teacher' && (
              <TeacherDashboard
                lang={lang}
                currentUser={userProfile}
                activeTab={teacherTab}
                onTabChange={setTeacherTab}
              />
            )}
            {userProfile && showRole === 'parent' && (
              <ParentStudentPortal
                lang={lang}
                currentUser={userProfile}
                viewRole="parent"
                activeTab={parentTab}
                onTabChange={setParentTab}
                focusEnrollProgramId={parentFocusProgramId}
                onClearFocusProgram={() => setParentFocusProgramId(null)}
              />
            )}
            {userProfile && showRole === 'student' && (
              <StudentPortal
                lang={lang}
                currentUser={userProfile}
                activeTab={studentTab}
                onTabChange={setStudentTab}
              />
            )}
          </Suspense>
        </ErrorBoundary>
      </main>

      <AcademyContactSection lang={lang} variant="footer" />

      {promoOpen && (
        <Suspense fallback={null}>
          <BigSkillsPromoModal
            isOpen={promoOpen}
            lang={lang}
            onClose={handleClosePromo}
            highlightedProgramId={promoHighlightProgramId}
            canEnrollInPortal={Boolean(
              userProfile &&
                (showRole === 'parent' || effectiveRole === 'super_admin' || effectiveRole === 'admin')
            )}
            onEnrollFromPopup={(programId) => {
              setPromoOpen(false);
              setPromoHighlightProgramId(null);
              if (effectiveRole === 'super_admin' || effectiveRole === 'admin') {
                setAdminPreviewRole('parent');
              }
              setParentTab('enroll');
              setParentFocusProgramId(programId);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}


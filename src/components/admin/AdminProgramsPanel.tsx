import React, { useEffect, useRef, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Globe,
  GraduationCap,
  Layers,
  MapPin,
  Megaphone,
  Mic,
  Music,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { biText, formatVnd } from '../../i18n';
import { assistAdminDraft } from '../../services/aiClient';
import {
  ensureSpecialtyProgramsSeeded,
  PROGRAM_DETAIL_HIGHLIGHTS,
  SIGNATURE_POPUP_PROGRAMS,
  SPECIALTY_TALENT_PROGRAMS,
} from '../../services/seedData';
import { deleteRecordFromSql, syncRecordToSql } from '../../services/sqlSyncClient';
import { EmptyState, PanelCard, SectionHeader } from '../ui/Primitives';
import { PCE_KIDS_CURRICULUM, type PceLevelCourse } from '../../data/pceCurriculumData';
import type { LangCode, ProgramCourse, TeacherProfile } from '../../types';

const makeProgramId = () =>
  `prog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export interface AdminProgramsPanelProps {
  lang: LangCode;
  programs: ProgramCourse[];
  teachers: TeacherProfile[];
  onFlash: (msg: string) => void;
  onOpenPromoPopup?: (highlightProgramId?: string) => void;
}

export const AdminProgramsPanel: React.FC<AdminProgramsPanelProps> = ({
  lang,
  programs,
  teachers,
  onFlash,
  onOpenPromoPopup,
}) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [progCode, setProgCode] = useState('');
  const [progTitleEn, setProgTitleEn] = useState('');
  const [progTitleVi, setProgTitleVi] = useState('');
  const [progDescEn, setProgDescEn] = useState('');
  const [progDescVi, setProgDescVi] = useState('');
  const [progCefr, setProgCefr] = useState('Pre-A1 Starters to A1 Movers');
  const [progTuition, setProgTuition] = useState(4800000);
  const [progTeacherId, setProgTeacherId] = useState('');
  const [progTeacherName, setProgTeacherName] = useState('');
  const [progEnrollmentDate, setProgEnrollmentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [progStartDate, setProgStartDate] = useState('');
  const [progMaxClassSize, setProgMaxClassSize] = useState(10);
  const [progAgeRange, setProgAgeRange] = useState('7 - 12 years');
  const [progWeeksCount, setProgWeeksCount] = useState(12);
  const [progScheduleSummary, setProgScheduleSummary] = useState('Sat & Sun 09:00–10:30');
  const [progLocation, setProgLocation] = useState('C002 ParcSpring, 537 Nguyễn Duy Trinh');
  const [progPromoBadgeEn, setProgPromoBadgeEn] = useState('NEW COURSE · NOW ENROLLING');
  const [progPromoBadgeVi, setProgPromoBadgeVi] = useState('KHÓA MỚI · ĐANG TUYỂN SINH');
  const [progShowInPopup, setProgShowInPopup] = useState(true);
  const [progIsActive, setProgIsActive] = useState(true);
  const [progSearch, setProgSearch] = useState('');
  const [confirmDeleteProgId, setConfirmDeleteProgId] = useState<string | null>(null);
  const [aiDraftTopic, setAiDraftTopic] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<
    'all' | 'early_years' | 'primary' | 'teen'
  >('all');
  const [expandedPceCode, setExpandedPceCode] = useState<string | null>(null);
  const [pceSearch, setPceSearch] = useState('');
  const autoSeedAttemptedRef = useRef(false);
  const programFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (autoSeedAttemptedRef.current) return;
    const missingSpecialty = SPECIALTY_TALENT_PROGRAMS.some(
      (sp) => !programs.some((p) => p.id === sp.id || p.code === sp.code)
    );
    if (!missingSpecialty) return;
    autoSeedAttemptedRef.current = true;
    void ensureSpecialtyProgramsSeeded().then((added) => {
      if (added > 0) {
        onFlash(
          biText(
            lang,
            `Synced ${added} Creative Talent Specialty program(s) (Music & Poetry, Cultural Exploration, Junior MC Skills) into Active Catalog & Parent Portal.`,
            `Đã tự động đồng bộ ${added} khóa Tài năng Sáng tạo (Âm Nhạc & Thơ Ca, Khám Phá Văn Hoá, MC Nhí) vào Danh mục & Cổng Phụ huynh.`
          )
        );
      }
    });
  }, [programs, lang, onFlash]);

  const handlePublishPceCourseToBranch = async (lvl: PceLevelCourse) => {
    const existing = programs.find((p) => p.code === lvl.code);
    if (existing) {
      onFlash(
        biText(
          lang,
          `${lvl.code} is already in branch catalog. You can edit its schedule & teacher below.`,
          `Khóa học ${lvl.code} đã có trong danh mục. Bạn có thể sửa lịch & giáo viên ở bảng bên dưới.`
        )
      );
      return;
    }
    setBusyAction(`publish_${lvl.code}`);
    try {
      const progId = `prog_${lvl.code.toLowerCase().replace('-', '_')}`;
      const payload = {
        code: lvl.code,
        titleEn: lvl.titleEn.slice(0, 160),
        titleVi: lvl.titleVi.slice(0, 160),
        descriptionEn: lvl.summaryEn.slice(0, 1200),
        descriptionVi: lvl.summaryVi.slice(0, 1200),
        cefrTarget: `${lvl.cefrBand} (${lvl.cambridgeMilestoneEn})`.slice(0, 60),
        ageRange: lvl.ageRangeEn.slice(0, 40),
        weeksCount: lvl.durationWeeks,
        tuitionVnd: lvl.tuitionVnd,
        maxClassSize: 12,
        scheduleSummary: `${lvl.sessionsPerWeek} sessions/week × ${lvl.hoursPerSession}h`.slice(0, 160),
        location: 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức',
        promoBadgeEn: `PCE-KIDS LEVEL ${lvl.levelNumber} · NOW ENROLLING`.slice(0, 80),
        promoBadgeVi: `PCE-KIDS CẤP ĐỘ ${lvl.levelNumber} · ĐANG TUYỂN SINH`.slice(0, 80),
        showInPromoPopup: true,
        isActive: true,
      };
      await setDoc(doc(db, 'programs', progId), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('programs', progId, payload as unknown as Record<string, unknown>);
      onFlash(
        biText(
          lang,
          `Published ${lvl.code} (${lvl.titleEn}) to active Branch Catalog and Promo Popup!`,
          `Đã xuất bản ${lvl.code} (${lvl.titleVi}) vào danh mục chi nhánh & Popup tuyển sinh!`
        )
      );
      if (onOpenPromoPopup) {
        onOpenPromoPopup(progId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'programs');
    } finally {
      setBusyAction(null);
    }
  };

  const handleAiAssistProgram = async () => {
    if (!aiDraftTopic.trim() && !progTitleEn.trim()) return;
    setBusyAction('ai_prog');
    try {
      const res = await assistAdminDraft({
        topic: aiDraftTopic || progTitleEn,
        draftText:
          progDescEn ||
          'Create bilingual English & character program description for LiLab Creative Talent Academy.',
      });
      setProgTitleEn(res.titleEn || progTitleEn);
      setProgTitleVi(res.titleVi || progTitleVi);
      setProgDescEn(res.descriptionEn || progDescEn);
      setProgDescVi(res.descriptionVi || progDescVi);
      onFlash(
        lang === 'vi'
          ? 'AI đã hoàn thiện nội dung song ngữ!'
          : 'AI populated bilingual program fields.'
      );
    } catch (err) {
      onFlash(err instanceof Error ? err.message : 'AI assist failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleResetProgramForm = () => {
    setEditingProgramId(null);
    setProgCode('');
    setProgTitleEn('');
    setProgTitleVi('');
    setProgDescEn('');
    setProgDescVi('');
    setProgCefr('Pre-A1 Starters to A1 Movers');
    setProgTuition(4800000);
    setProgTeacherId('');
    setProgTeacherName('');
    setProgEnrollmentDate(new Date().toISOString().slice(0, 10));
    setProgStartDate('');
    setProgMaxClassSize(10);
    setProgAgeRange('7 - 12 years');
    setProgWeeksCount(12);
    setProgScheduleSummary('Sat & Sun 09:00–10:30');
    setProgLocation('C002 ParcSpring, 537 Nguyễn Duy Trinh');
    setProgPromoBadgeEn('NEW COURSE · NOW ENROLLING');
    setProgPromoBadgeVi('KHÓA MỚI · ĐANG TUYỂN SINH');
    setProgShowInPopup(true);
    setProgIsActive(true);
    setAiDraftTopic('');
  };

  const handlePublishPopupSignatureCourses = async () => {
    setBusyAction('publish_popup_courses');
    try {
      for (const pc of SIGNATURE_POPUP_PROGRAMS) {
        const { id, ...rest } = pc;
        await setDoc(doc(db, 'programs', id), {
          ...rest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await syncRecordToSql('programs', id, rest);
      }
      onFlash(
        biText(
          lang,
          'Successfully published the 3 signature popup courses to Active Branch Catalog & Popup!',
          'Đã xuất bản thành công 3 khóa học nổi bật từ popup vào Danh mục Chi nhánh & Cửa sổ Popup!'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'programs');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePublishSpecialtyTalentPrograms = async () => {
    setBusyAction('publish_specialty_courses');
    try {
      for (const sp of SPECIALTY_TALENT_PROGRAMS) {
        const { id, ...rest } = sp;
        await setDoc(doc(db, 'programs', id), {
          ...rest,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await syncRecordToSql('programs', id, rest);
      }
      onFlash(
        biText(
          lang,
          'Published Music & Poetry (2.4M), Cultural Exploration (2.6M), and Junior MC Skills (3.2M) to Active Catalog & Promo Popup!',
          'Đã xuất bản Âm Nhạc & Thơ Ca (2,4tr), Khám Phá Văn Hoá (2,6tr) và Kỹ Năng MC Nhí (3,2tr) vào Danh mục & Popup!'
        )
      );
      if (onOpenPromoPopup) {
        onOpenPromoPopup('prog_mc_skills');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'programs');
    } finally {
      setBusyAction(null);
    }
  };

  const handleEditProgram = (prog: ProgramCourse) => {
    setEditingProgramId(prog.id);
    setProgCode(prog.code || '');
    setProgTitleEn(prog.titleEn || '');
    setProgTitleVi(prog.titleVi || '');
    setProgDescEn(prog.descriptionEn || '');
    setProgDescVi(prog.descriptionVi || '');
    setProgCefr(prog.cefrTarget || 'A1 Movers');
    setProgTuition(prog.tuitionVnd ?? 4800000);
    setProgTeacherId(prog.teacherId || '');
    setProgTeacherName(prog.teacherName || '');
    setProgEnrollmentDate(prog.enrollmentDate || new Date().toISOString().slice(0, 10));
    setProgStartDate(prog.startDate || '');
    setProgMaxClassSize(prog.maxClassSize ?? 10);
    setProgAgeRange(prog.ageRange || '7 - 12 years');
    setProgWeeksCount(prog.weeksCount ?? 12);
    setProgScheduleSummary(prog.scheduleSummary || '');
    setProgLocation(prog.location || '');
    setProgPromoBadgeEn(prog.promoBadgeEn || 'NEW COURSE · NOW ENROLLING');
    setProgPromoBadgeVi(prog.promoBadgeVi || 'KHÓA MỚI · ĐANG TUYỂN SINH');
    setProgShowInPopup(prog.showInPromoPopup === true);
    setProgIsActive(prog.isActive !== false);
  };

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progTitleEn.trim()) return;
    setBusyAction('prog');
    try {
      const isEditing = Boolean(editingProgramId);
      const id = editingProgramId || makeProgramId();
      const selectedTeacher = teachers.find((tc) => tc.id === progTeacherId);
      const resolvedTeacherName = (
        progTeacherName.trim() ||
        selectedTeacher?.fullName ||
        ''
      ).slice(0, 120);
      const safeWeeks = Math.min(104, Math.max(1, Math.round(Number(progWeeksCount) || 12)));
      const safeClassSize = Math.min(100, Math.max(1, Math.round(Number(progMaxClassSize) || 10)));
      const safeTuition = Math.min(500000000, Math.max(0, Math.round(Number(progTuition) || 0)));

      const payload: Record<string, unknown> = {
        code: (progCode.trim() || `LL-${String(programs.length + 1).padStart(2, '0')}`)
          .toUpperCase()
          .slice(0, 40),
        titleEn: progTitleEn.trim().slice(0, 160),
        titleVi: (progTitleVi.trim() || progTitleEn.trim()).slice(0, 160),
        descriptionEn: progDescEn.trim().slice(0, 1200),
        descriptionVi: (progDescVi.trim() || progDescEn.trim()).slice(0, 1200),
        cefrTarget: (progCefr.trim() || 'All Levels').slice(0, 60),
        ageRange: (progAgeRange.trim() || '6 - 14 years').slice(0, 40),
        weeksCount: safeWeeks,
        tuitionVnd: safeTuition,
        scheduleSummary: (progScheduleSummary.trim() || 'Flexible Weekday / Weekend').slice(0, 160),
        maxClassSize: safeClassSize,
        showInPromoPopup: progShowInPopup,
        isActive: progIsActive,
      };
      if (resolvedTeacherName) payload.teacherName = resolvedTeacherName;
      if (selectedTeacher?.id) payload.teacherId = selectedTeacher.id.slice(0, 128);
      if (progEnrollmentDate.trim()) payload.enrollmentDate = progEnrollmentDate.trim().slice(0, 30);
      if (progStartDate.trim()) payload.startDate = progStartDate.trim().slice(0, 30);
      if (progLocation.trim()) payload.location = progLocation.trim().slice(0, 160);
      if (progPromoBadgeEn.trim()) payload.promoBadgeEn = progPromoBadgeEn.trim().slice(0, 80);
      if (progPromoBadgeVi.trim()) payload.promoBadgeVi = progPromoBadgeVi.trim().slice(0, 80);

      if (isEditing) {
        const existingProg = programs.find((p) => p.id === id);
        await setDoc(doc(db, 'programs', id), {
          ...payload,
          createdAt: existingProg?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'programs', id), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await syncRecordToSql('programs', id, payload);

      const shouldOpenPopup = !isEditing && progShowInPopup && progIsActive;
      handleResetProgramForm();
      onFlash(
        isEditing
          ? biText(
              lang,
              'Program updated across Popup & Parent Enrollment.',
              'Đã cập nhật khóa học trên Popup & Cổng Phụ huynh.'
            )
          : biText(
              lang,
              'Program added! Now live in the Promo Popup and Parent Enroll Courses.',
              'Đã thêm khóa học! Khóa học đã hiển thị trên Popup Khai Giảng & mục Đăng Ký của Phụ huynh.'
            )
      );
      if (shouldOpenPopup && onOpenPromoPopup) {
        onOpenPromoPopup(id);
      }
    } catch (err) {
      handleFirestoreError(
        err,
        editingProgramId ? OperationType.UPDATE : OperationType.CREATE,
        'programs'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleProgramFlag = async (
    prog: ProgramCourse,
    field: 'isActive' | 'showInPromoPopup'
  ) => {
    setBusyAction(`prog_toggle_${prog.id}`);
    try {
      const nextValue =
        field === 'isActive' ? !(prog.isActive !== false) : !(prog.showInPromoPopup === true);
      await updateDoc(doc(db, 'programs', prog.id), {
        [field]: nextValue,
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('programs', prog.id, { ...prog, [field]: nextValue });
      onFlash(
        field === 'showInPromoPopup'
          ? nextValue
            ? biText(lang, `${prog.titleEn} added to Promo Popup.`, `Đã đưa "${prog.titleVi}" lên cửa sổ Popup.`)
            : biText(lang, `${prog.titleEn} removed from Promo Popup.`, `Đã ẩn "${prog.titleVi}" khỏi cửa sổ Popup.`)
          : nextValue
            ? biText(lang, `${prog.titleEn} is now open for Parent enrollment.`, `Đã mở đăng ký "${prog.titleVi}" cho Phụ huynh.`)
            : biText(lang, `${prog.titleEn} paused from Parent enrollment.`, `Đã tạm ẩn "${prog.titleVi}" khỏi mục đăng ký.`)
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `programs/${prog.id}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteProgram = async (progId: string) => {
    setBusyAction(`prog_del_${progId}`);
    try {
      await deleteDoc(doc(db, 'programs', progId));
      await deleteRecordFromSql('programs', progId);
      if (editingProgramId === progId) handleResetProgramForm();
      setConfirmDeleteProgId(null);
      onFlash(biText(lang, 'Program removed from LiLab catalog.', 'Đã xóa khóa học khỏi danh mục LiLab.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `programs/${progId}`);
    } finally {
      setBusyAction(null);
    }
  };

  const activeCount = programs.filter((p) => p.isActive !== false).length;
  const popupCount = programs.filter((p) => p.isActive !== false && p.showInPromoPopup === true).length;

  const filteredPrograms = programs
    .filter((p) => {
      const q = progSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        (p.titleEn || '').toLowerCase().includes(q) ||
        (p.titleVi || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q) ||
        (p.teacherName || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
      const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
      return tb - ta;
    });

  const filteredPceCurriculum = (PCE_KIDS_CURRICULUM || []).filter((lvl) => {
    if (selectedDivision !== 'all' && lvl.divisionId !== selectedDivision) {
      return false;
    }
    const q = pceSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      lvl.titleEn.toLowerCase().includes(q) ||
      lvl.titleVi.toLowerCase().includes(q) ||
      lvl.code.toLowerCase().includes(q) ||
      lvl.cefrBand.toLowerCase().includes(q) ||
      lvl.ageRangeEn.toLowerCase().includes(q) ||
      lvl.textbooks.some((tb) => tb.title.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* CREATIVE TALENT SPECIALTY PROGRAMS (MUSIC & POETRY · CULTURAL EXPLORATION · MC SKILLS) */}
      <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#172154]/8 pb-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
              {biText(
                lang,
                'LILAB CREATIVE TALENT SPECIALTY PROGRAMS · LIVE IN CATALOG & PARENT PORTAL',
                'CHƯƠNG TRÌNH TÀI NĂNG SÁNG TẠO LILAB · ĐANG HIỂN THỊ TRÊN CỔNG PHỤ HUYNH'
              )}
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#172154]">
              {biText(
                lang,
                'Music & Poetry · Cultural Exploration · Junior MC Skills',
                'Âm Nhạc & Thơ Ca · Khám Phá Văn Hoá · Kỹ Năng MC Nhí'
              )}
            </h3>
            <p className="text-xs text-[#525E80]">
              {biText(
                lang,
                'Boutique 8–10 week English creative talent tracks synced with Promo Popup, Class Scheduler, and Parent Portal.',
                'Các khoá tài năng sáng tạo tiếng Anh 8–10 tuần đồng bộ trực tiếp với Cửa sổ Popup, Lịch Học và Cổng Phụ huynh.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busyAction === 'publish_specialty_courses'}
              onClick={handlePublishSpecialtyTalentPrograms}
              className="px-3.5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Megaphone className="w-3.5 h-3.5 text-[#FFD41D]" />
              <span>
                {busyAction === 'publish_specialty_courses'
                  ? biText(lang, 'Syncing...', 'Đang đồng bộ...')
                  : biText(lang, 'Sync / Reset All 3 Specialty Courses', 'Đồng Bộ 3 Khoá Tài Năng')}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SPECIALTY_TALENT_PROGRAMS.map((sp) => {
            const liveDoc = programs.find((p) => p.id === sp.id || p.code === sp.code);
            const activeData: ProgramCourse = liveDoc || {
              ...sp,
              isActive: true,
              showInPromoPopup: true,
            };
            const detailMeta = PROGRAM_DETAIL_HIGHLIGHTS[sp.id];
            const isMusic = sp.id === 'prog_music_poetry';
            const isCulture = sp.id === 'prog_cultural_exploration';

            const iconBg = isMusic
              ? 'bg-[#FFF5EE] text-[#FF6B00] border-[#FF6B00]/20'
              : isCulture
                ? 'bg-[#F0FDFA] text-[#0D9488] border-[#0D9488]/20'
                : 'bg-[#FDF2F8] text-[#E61E64] border-[#E61E64]/20';

            const IconComponent = isMusic ? Music : isCulture ? Globe : Mic;

            return (
              <div
                key={sp.id}
                className="rounded-xl border border-[#172154]/12 bg-[#FAFBFD] p-4 flex flex-col justify-between space-y-4 hover:border-[#172154]/25 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconBg}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[11px] font-mono font-bold text-[#172154]">
                          {activeData.code} · {activeData.cefrTarget}
                        </div>
                        <div className="text-[11px] text-[#525E80]">
                          {activeData.ageRange} · {activeData.weeksCount} {biText(lang, 'weeks', 'tuần')}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${
                        liveDoc
                          ? activeData.isActive !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {liveDoc
                        ? activeData.isActive !== false
                          ? biText(lang, 'Live in Catalog', 'Đang mở lớp')
                          : biText(lang, 'Paused', 'Tạm ẩn')
                        : biText(lang, 'Syncing…', 'Đang đồng bộ…')}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-display text-base font-extrabold text-[#172154] leading-snug">
                      {lang === 'vi' ? activeData.titleVi || activeData.titleEn : activeData.titleEn}
                    </h4>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="font-display text-lg font-extrabold text-[#E61E64] tabular-nums">
                        {formatVnd(activeData.tuitionVnd)}
                      </span>
                      <span className="text-[11px] text-[#525E80]">
                        / {activeData.weeksCount} {biText(lang, 'sessions', 'buổi')}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#525E80] leading-relaxed line-clamp-3">
                    {lang === 'vi'
                      ? activeData.descriptionVi || activeData.descriptionEn
                      : activeData.descriptionEn}
                  </p>

                  <div className="p-2.5 rounded-lg bg-white border border-[#172154]/8 space-y-1 text-[11px] text-[#172154]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#525E80] shrink-0" />
                      <span className="truncate">{activeData.scheduleSummary}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#525E80] shrink-0" />
                      <span>
                        {biText(
                          lang,
                          `Max ${activeData.maxClassSize || 10} students`,
                          `Tối đa ${activeData.maxClassSize || 10} học viên`
                        )}
                      </span>
                    </div>
                    {detailMeta && (
                      <div className="text-[11px] text-[#0F766E] font-medium pt-0.5 line-clamp-1">
                        {biText(lang, 'Showcase:', 'Cuối khoá:')}{' '}
                        {biText(lang, detailMeta.showcaseEn, detailMeta.showcaseVi)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#172154]/8">
                  <button
                    type="button"
                    onClick={() => {
                      handleEditProgram(activeData);
                      programFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex-1 py-2 px-3 rounded-lg bg-[#172154] hover:bg-[#233275] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{biText(lang, 'Edit Pricing & Schedule', 'Sửa Giá & Lịch')}</span>
                  </button>
                  {onOpenPromoPopup && (
                    <button
                      type="button"
                      onClick={() => onOpenPromoPopup(activeData.id)}
                      className="p-2 rounded-lg border border-[#172154]/15 bg-white hover:bg-[#F2F4F8] text-[#172154] cursor-pointer transition-colors shrink-0"
                      title={biText(lang, 'Preview in Promo Popup', 'Xem trên Cửa sổ Popup')}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* THE PCE-KIDS FRAMEWORK · 13-LEVEL CONTINUOUS PATHWAY (AGES 3–16) */}
      <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#172154]/8 pb-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-[#E61E64] uppercase tracking-wider">
              {biText(
                lang,
                'THE PCE-KIDS FRAMEWORK · 13-LEVEL CONTINUOUS PATHWAY (AGES 3–16)',
                'KHUNG CHƯƠNG TRÌNH PCE-KIDS · LỘ TRÌNH 13 CẤP ĐỘ XUYÊN SUỐT (3–16 TUỔI)'
              )}
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[#172154]">
              {biText(
                lang,
                'Enroll in Next-Level PCE-Kids Courses (Little Explorers · Young Discoverers · Future Leaders)',
                'Đăng Ký Khóa Học Lên Cấp PCE-Kids (Mầm Non · Tiểu Học · Thiếu Niên)'
              )}
            </h3>
            <p className="text-xs text-[#525E80]">
              {biText(
                lang,
                'All 13 official PCE-Kids courses with Cambridge milestones, textbooks, character artwork, and one-click publishing to Active Branch Catalog.',
                'Đầy đủ 13 cấp độ chuẩn quốc tế với giáo trình bản quyền, linh vật LiLab, cột mốc Cambridge và mở lớp nhanh chỉ với 1 cú nhấp.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busyAction === 'publish_specialty_courses'}
              onClick={handlePublishSpecialtyTalentPrograms}
              className="px-3.5 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Megaphone className="w-3.5 h-3.5 text-[#FFD41D]" />
              <span>
                {busyAction === 'publish_specialty_courses'
                  ? biText(lang, 'Publishing...', 'Đang xuất bản...')
                  : biText(
                      lang,
                      'Publish Music, Culture & MC (3)',
                      'Xuất Bản Âm Nhạc, Văn Hoá & MC (3)'
                    )}
              </span>
            </button>
            <button
              type="button"
              disabled={busyAction === 'publish_popup_courses'}
              onClick={handlePublishPopupSignatureCourses}
              className="px-3.5 py-2 rounded-xl bg-[#6B21A8] hover:bg-[#581C87] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFD41D]" />
              <span>
                {busyAction === 'publish_popup_courses'
                  ? biText(lang, 'Publishing...', 'Đang xuất bản...')
                  : biText(lang, 'Publish 3 Popup Signature Courses', 'Đưa 3 Khóa Từ Popup Vào Danh Mục')}
              </span>
            </button>
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[#525E80] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={pceSearch}
                onChange={(e) => setPceSearch(e.target.value)}
                placeholder={biText(lang, 'Filter PCE levels, codes, textbooks...', 'Tìm kiếm cấp độ, giáo trình...')}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-[#172154]/15 bg-[#F8F9FB] focus:bg-white text-[#172154] focus:outline-none focus:border-[#6B21A8]"
              />
            </div>
          </div>
        </div>

        {/* Division Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#F2F4F8] border border-[#172154]/8">
          {[
            { id: 'all' as const, label: biText(lang, 'All 13 Levels (Ages 3–16)', 'Tất Cả 13 Cấp Độ (3–16 Tuổi)') },
            {
              id: 'early_years' as const,
              label: biText(lang, 'Division 1 · Little Explorers (Ages 3–6)', 'Khối 1 · Mầm Non: Little Explorers (3–6 Tuổi)'),
            },
            {
              id: 'primary' as const,
              label: biText(lang, 'Division 2 · Young Discoverers (Ages 6–11)', 'Khối 2 · Tiểu Học: Young Discoverers (6–11 Tuổi)'),
            },
            {
              id: 'teen' as const,
              label: biText(lang, 'Division 3 · Future Leaders (Ages 11–16)', 'Khối 3 · Thiếu Niên: Future Leaders (11–16 Tuổi)'),
            },
          ].map((divOpt) => (
            <button
              key={divOpt.id}
              type="button"
              onClick={() => setSelectedDivision(divOpt.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                selectedDivision === divOpt.id
                  ? 'bg-[#6B21A8] text-white shadow-sm'
                  : 'text-[#525E80] hover:text-[#172154]'
              }`}
            >
              {divOpt.label}
            </button>
          ))}
        </div>

        {/* 13-Level Cards Grid Matching Parent Portal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPceCurriculum.map((lvl) => {
            const isPublishedInBranch = programs.some((p) => p.code === lvl.code);
            const isExpanded = expandedPceCode === lvl.code;
            return (
              <div
                key={lvl.code}
                className="bg-white border border-[#172154]/10 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-[#6B21A8]/40 transition-all shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={lvl.lilabCharacterImg}
                      alt={lvl.titleEn}
                      loading="lazy"
                      decoding="async"
                      className="w-14 h-14 aspect-square rounded-xl bg-[#F8F9FB] p-1.5 border border-[#172154]/10 object-contain shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono-num font-bold text-[#6B21A8] tabular-nums">
                        Lv.{lvl.levelNumber}/13 · {lvl.code} · {lvl.cefrBand}
                      </div>
                      <h4 className="font-display text-base font-bold text-[#172154] leading-snug line-clamp-1">
                        {biText(lang, lvl.titleEn, lvl.titleVi)}
                      </h4>
                      <div className="text-[11px] text-[#525E80]">
                        {biText(lang, lvl.ageRangeEn, lvl.ageRangeVi)} · {lvl.durationWeeks}w ({lvl.hoursPerLevel}h · {lvl.cumulativeHours}h)
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#525E80] leading-relaxed line-clamp-2">
                    {biText(lang, lvl.summaryEn, lvl.summaryVi)}
                  </p>

                  <div className="text-[11px] text-[#0D9488] font-semibold flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="truncate">
                      {biText(lang, 'Textbooks:', 'Giáo trình:')}{' '}
                      {lvl.textbooks.map((t) => t.title).join(' + ')}
                    </span>
                  </div>

                  {/* Expandable Syllabus Detail */}
                  {isExpanded && (
                    <div className="mt-3 p-3.5 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 space-y-2 text-xs text-[#172154]">
                      <div className="font-bold text-[#6B21A8] flex items-center justify-between">
                        <span>{biText(lang, 'Modules & Learning Units', 'Học Phần & Mục Tiêu')}</span>
                        <span className="text-[10px] font-mono-num">{lvl.sessionsPerWeek} sessions/wk</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        {lvl.syllabus.map((mod, mIdx: number) => (
                          <div key={mIdx} className="p-2 rounded bg-white border border-[#172154]/6">
                            <span className="font-semibold text-[#172154]">{mod.unitCode}: {biText(lang, mod.titleEn, mod.titleVi)}</span>
                            <span className="text-[#525E80] block text-[10px] mt-0.5">{biText(lang, mod.languageFocusEn, mod.languageFocusVi)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="p-2 rounded bg-[#FAF5FF] border border-[#6B21A8]/20 text-[11px]">
                        <span className="font-bold text-[#6B21A8]">{biText(lang, 'Capstone:', 'Dự án tốt nghiệp:')} </span>
                        <span>{biText(lang, lvl.syllabus[0]?.activitiesAndProjectsEn || 'Portfolio Showcase', lvl.syllabus[0]?.activitiesAndProjectsVi || 'Triển lãm Portfolio')}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#172154]/10 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#525E80] font-medium text-[11px] truncate max-w-[160px]">
                      {biText(lang, lvl.cambridgeMilestoneEn, lvl.cambridgeMilestoneVi)}
                    </span>
                    <span className="font-mono-num font-bold text-[#172154] tabular-nums">
                      {formatVnd(lvl.tuitionVnd)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPublishedInBranch ? (
                      <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{biText(lang, 'Live in Catalog', 'Đang Tuyển Sinh')}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busyAction === `publish_${lvl.code}`}
                        onClick={() => void handlePublishPceCourseToBranch(lvl)}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#6B21A8] hover:bg-[#581C87] text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-60"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {busyAction === `publish_${lvl.code}`
                            ? biText(lang, 'Publishing...', 'Đang mở...')
                            : biText(lang, 'Publish to Catalog', 'Mở Khóa Học Này')}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedPceCode(isExpanded ? null : lvl.code)}
                      className="p-2 rounded-xl border border-[#172154]/12 text-[#172154] hover:bg-[#F2F4F8] transition-colors cursor-pointer shrink-0"
                      title={biText(lang, 'View syllabus & modules', 'Xem học phần')}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Branch Programs & Course Publisher Studio */}
      <PanelCard padding="lg">
        <SectionHeader
          meta={biText(
            lang,
            'Branch Course Offerings & Custom Course Studio',
            'Khóa Học Chi Nhánh & Quản Lý Lớp'
          )}
          title={biText(lang, 'Active Branch Offerings & Promo Publisher', 'Khóa Học Đang Mở & Cửa Sổ Tuyển Sinh')}
          subtitle={biText(
            lang,
            'Manage published courses with assigned faculty, tuition pricing, and Promo Popup broadcast settings.',
            'Quản lý các khóa học đang tuyển sinh với giáo viên phụ trách, học phí và cấu hình hiển thị trên Popup.'
          )}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-3.5 py-2 rounded-lg bg-[#F8F9FB] border border-[#172154]/10 text-xs whitespace-nowrap">
                <span className="text-[#172154]/60">{biText(lang, 'Active:', 'Đang mở:')} </span>
                <strong className="font-mono-num text-[#172154] tabular-nums">{activeCount}</strong>
                <span className="mx-2 text-[#172154]/25">·</span>
                <span className="text-[#172154]/60">{biText(lang, 'In Popup:', 'Trên Popup:')} </span>
                <strong className="font-mono-num text-[#6B21A8] tabular-nums">{popupCount}</strong>
              </div>
              {onOpenPromoPopup && (
                <button
                  type="button"
                  onClick={() => onOpenPromoPopup()}
                  className="px-4 py-2 rounded-lg bg-[#6B21A8] hover:bg-[#581C87] text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors shadow-sm"
                >
                  <Megaphone className="w-3.5 h-3.5" />
                  {biText(lang, 'Preview Popup Window', 'Xem Cửa Sổ Popup')}
                </button>
              )}
            </div>
          }
        />
      </PanelCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Create / Edit Program Form */}
        <form
          ref={programFormRef}
          onSubmit={(e) => void handleAddProgram(e)}
          className="lg:col-span-5 bg-white border border-[#172154]/10 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-[#172154] flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#FF6B00]" />
              {editingProgramId
                ? biText(lang, 'Edit Program / Course', 'Chỉnh sửa Chương trình / Khóa học')
                : biText(lang, 'Add New Program / Course', 'Thêm Chương trình / Khóa học Mới')}
            </h3>
            {editingProgramId && (
              <button
                type="button"
                onClick={handleResetProgramForm}
                className="text-xs font-semibold text-[#E61E64] hover:underline cursor-pointer"
              >
                {biText(lang, 'Cancel Edit', 'Hủy sửa')}
              </button>
            )}
          </div>

          {/* AI Bilingual Draft Helper */}
          <div className="p-3 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 space-y-2">
            <div className="text-xs font-semibold text-[#172154] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
              {biText(lang, 'AI Bilingual Course Writer', 'AI hỗ trợ viết tên & mô tả song ngữ')}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiDraftTopic}
                onChange={(e) => setAiDraftTopic(e.target.value)}
                placeholder={biText(
                  lang,
                  'e.g. Summer Public Speaking & Drama',
                  'VD: Hùng biện & Kịch nghệ Mùa hè'
                )}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#172154]/15 bg-white text-xs"
              />
              <button
                type="button"
                onClick={() => void handleAiAssistProgram()}
                disabled={busyAction === 'ai_prog'}
                className="px-3 py-1.5 rounded-lg bg-[#172154] hover:bg-[#23306d] text-white text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
              >
                {busyAction === 'ai_prog' ? '…' : 'AI Draft'}
              </button>
            </div>
          </div>

          {/* Program Name (EN & VI) */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Program Name (English) *', 'Tên Chương trình / Khóa học (Tiếng Anh) *')}
              </label>
              <input
                type="text"
                required
                value={progTitleEn}
                onChange={(e) => setProgTitleEn(e.target.value)}
                placeholder="e.g. Creative Storytelling & Cambridge Movers"
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Program Name (Vietnamese)', 'Tên Chương trình / Khóa học (Tiếng Việt)')}
              </label>
              <input
                type="text"
                value={progTitleVi}
                onChange={(e) => setProgTitleVi(e.target.value)}
                placeholder="VD: Kể chuyện Sáng tạo & Luyện thi Cambridge Movers"
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
          </div>

          {/* Code + Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Course Code', 'Mã khóa học')}
              </label>
              <input
                type="text"
                value={progCode}
                onChange={(e) => setProgCode(e.target.value)}
                placeholder={`LL-${String(programs.length + 1).padStart(2, '0')}`}
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm font-mono uppercase"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Price / Tuition (VND) *', 'Học phí (VNĐ) *')}
                <span className="ml-1.5 font-mono-num text-[#FF6B00] tabular-nums">
                  ({formatVnd(Number(progTuition) || 0)})
                </span>
              </label>
              <input
                type="number"
                min={0}
                step={50000}
                required
                value={progTuition}
                onChange={(e) => setProgTuition(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm font-mono-num tabular-nums"
              />
            </div>
          </div>

          {/* Teacher Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Select Teacher', 'Chọn Giáo viên')}
              </label>
              <select
                value={progTeacherId}
                onChange={(e) => {
                  const tid = e.target.value;
                  setProgTeacherId(tid);
                  const found = teachers.find((tc) => tc.id === tid);
                  if (found) setProgTeacherName(found.fullName);
                }}
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm bg-white"
              >
                <option value="">
                  {biText(lang, '-- Pick from faculty or type --', '-- Chọn giáo viên hoặc tự nhập --')}
                </option>
                {teachers.map((tc) => (
                  <option key={tc.id} value={tc.id}>
                    {tc.fullName} ({tc.specialty})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Teacher Display Name', 'Tên Giáo viên hiển thị')}
              </label>
              <input
                type="text"
                value={progTeacherName}
                onChange={(e) => setProgTeacherName(e.target.value)}
                placeholder={biText(
                  lang,
                  'e.g. Ms. Sarah / 100% Foreign Teachers',
                  'VD: Cô Sarah · 100% GV nước ngoài'
                )}
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
          </div>

          {/* Enrollment Date, Start Date & Class Size */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Enrollment Date *', 'Ngày tuyển sinh *')}
              </label>
              <input
                type="date"
                required
                value={progEnrollmentDate}
                onChange={(e) => setProgEnrollmentDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-[#172154]/15 text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Class Start Date', 'Ngày khai giảng')}
              </label>
              <input
                type="date"
                value={progStartDate}
                onChange={(e) => setProgStartDate(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-[#172154]/15 text-sm font-mono-num"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Class Size (Max)', 'Sĩ số tối đa')}
              </label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={progMaxClassSize}
                onChange={(e) => setProgMaxClassSize(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm font-mono-num tabular-nums"
              />
            </div>
          </div>

          {/* Age Range, Weeks & CEFR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Age Range', 'Độ tuổi')}
              </label>
              <input
                type="text"
                value={progAgeRange}
                onChange={(e) => setProgAgeRange(e.target.value)}
                placeholder="7 - 12 years"
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Weeks', 'Số tuần')}
              </label>
              <input
                type="number"
                min={1}
                max={104}
                value={progWeeksCount}
                onChange={(e) => setProgWeeksCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm font-mono-num tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'CEFR Target', 'Mục tiêu CEFR')}
              </label>
              <input
                type="text"
                value={progCefr}
                onChange={(e) => setProgCefr(e.target.value)}
                placeholder="A1 Movers"
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
          </div>

          {/* Schedule & Campus Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Schedule Summary', 'Lịch học dự kiến')}
              </label>
              <input
                type="text"
                value={progScheduleSummary}
                onChange={(e) => setProgScheduleSummary(e.target.value)}
                placeholder="Sat & Sun 09:00–10:30"
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Campus / Room', 'Cơ sở / Phòng học')}
              </label>
              <input
                type="text"
                value={progLocation}
                onChange={(e) => setProgLocation(e.target.value)}
                placeholder="C002 ParcSpring Campus"
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
          </div>

          {/* Descriptions */}
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Description (English)', 'Mô tả khóa học (Tiếng Anh)')}
              </label>
              <textarea
                rows={3}
                value={progDescEn}
                onChange={(e) => setProgDescEn(e.target.value)}
                placeholder="Describe learning outcomes, activities, and what makes this LiLab course special…"
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172154] mb-1">
                {biText(lang, 'Description (Vietnamese)', 'Mô tả khóa học (Tiếng Việt)')}
              </label>
              <textarea
                rows={3}
                value={progDescVi}
                onChange={(e) => setProgDescVi(e.target.value)}
                placeholder="Mô tả mục tiêu học tập, hoạt động trải nghiệm và điểm nổi bật của khóa học…"
                className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-sm"
              />
            </div>
          </div>

          {/* Publishing Controls */}
          <div className="p-3.5 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={progShowInPopup}
                onChange={(e) => setProgShowInPopup(e.target.checked)}
                className="mt-0.5 rounded border-[#172154]/30 accent-[#FF6B00]"
              />
              <span>
                <strong className="text-[#172154]">
                  {biText(lang, 'Feature in Promo Popup Window', 'Hiển thị ngay trên Cửa Sổ Popup Khai Giảng')}
                </strong>
                <span className="block text-[#172154]/60">
                  {biText(
                    lang,
                    'Once saved, this program appears automatically in the announcement popup window.',
                    'Ngay sau khi lưu, khóa học sẽ hiển thị nổi bật trên cửa sổ Popup.'
                  )}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={progIsActive}
                onChange={(e) => setProgIsActive(e.target.checked)}
                className="mt-0.5 rounded border-[#172154]/30 accent-[#FF6B00]"
              />
              <span>
                <strong className="text-[#172154]">
                  {biText(
                    lang,
                    'Open in Parent "Enroll in Courses"',
                    'Mở đăng ký trong mục "Đăng Ký Khóa Học" của Phụ huynh'
                  )}
                </strong>
                <span className="block text-[#172154]/60">
                  {biText(
                    lang,
                    'Allows parents to view full details and select this course to enroll their child.',
                    'Cho phép phụ huynh xem chi tiết và chọn khóa học này để đăng ký cho bé.'
                  )}
                </span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={busyAction === 'prog'}
            className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {busyAction === 'prog'
              ? biText(lang, 'Saving…', 'Đang lưu…')
              : editingProgramId
                ? biText(lang, 'Update Program & Publish', 'Cập nhật Khóa học')
                : biText(lang, 'Add Program & Publish to Popup', 'Thêm Khóa học & Đăng lên Popup')}
          </button>
        </form>

        {/* Right: Live Published Programs & Courses Directory */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#172154]/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#172154]/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={progSearch}
                onChange={(e) => setProgSearch(e.target.value)}
                placeholder={biText(
                  lang,
                  'Search by program name, code, or teacher…',
                  'Tìm theo tên khóa học, mã lớp, giáo viên…'
                )}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#172154]/12 text-sm bg-[#F8F9FB]"
              />
            </div>
            <span className="text-xs font-medium text-[#172154]/60 tabular-nums">
              {filteredPrograms.length} / {programs.length} {biText(lang, 'programs', 'chương trình')}
            </span>
          </div>

          {filteredPrograms.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="w-5 h-5" />}
              title={biText(lang, 'No LiLab Programs Found', 'Chưa có Chương trình / Khóa học phù hợp')}
              description={biText(
                lang,
                'Use the form on the left to add a LiLab course. It will immediately appear in the Promo Popup and Parent Enroll Courses view.',
                'Sử dụng biểu mẫu bên trái để tạo khóa học mới. Khóa học sẽ tự động hiển thị trên cửa sổ Popup và Cổng Phụ huynh.'
              )}
            />
          ) : (
            <div className="space-y-4">
              {filteredPrograms.map((prog) => {
                const isPopupOn = prog.showInPromoPopup === true;
                const isActiveOn = prog.isActive !== false;
                return (
                  <div
                    key={prog.id}
                    className={`bg-white rounded-xl p-5 border transition-colors space-y-3.5 ${
                      editingProgramId === prog.id
                        ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/15'
                        : 'border-[#172154]/10 hover:border-[#172154]/22'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 flex-1 min-w-[220px]">
                        <div className="text-[11px] font-medium text-[#172154]/65 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-mono font-bold text-[#172154]">{prog.code}</span>
                          <span>·</span>
                          <span>{prog.cefrTarget}</span>
                          <span>·</span>
                          <span className={isActiveOn ? 'text-[#0F766E] font-semibold' : 'text-[#172154]/50'}>
                            {isActiveOn
                              ? biText(lang, 'Open in Parent Enroll', 'Mở cho Phụ huynh')
                              : biText(lang, 'Paused', 'Tạm ẩn')}
                          </span>
                          {isPopupOn && isActiveOn && (
                            <>
                              <span>·</span>
                              <span className="text-[#FF6B00] font-semibold inline-flex items-center gap-1">
                                <Megaphone className="w-3 h-3" />
                                {biText(lang, 'Featured in Popup', 'Đang trên Popup')}
                              </span>
                            </>
                          )}
                        </div>
                        <h4 className="font-display text-lg font-bold text-[#172154]">
                          {lang === 'vi'
                            ? prog.titleVi || prog.titleEn
                            : lang === 'en'
                              ? prog.titleEn
                              : `${prog.titleVi || prog.titleEn} / ${prog.titleEn}`}
                        </h4>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-display text-lg font-bold text-[#172154] tabular-nums">
                          {formatVnd(prog.tuitionVnd)}
                        </div>
                        <div className="text-[11px] text-[#172154]/55">
                          {prog.weeksCount} {biText(lang, 'weeks', 'tuần')} · {prog.ageRange}
                        </div>
                      </div>
                    </div>

                    {(prog.descriptionEn || prog.descriptionVi) && (
                      <p className="text-xs sm:text-sm text-[#172154]/75 leading-relaxed line-clamp-2">
                        {lang === 'vi'
                          ? prog.descriptionVi || prog.descriptionEn
                          : prog.descriptionEn || prog.descriptionVi}
                      </p>
                    )}

                    {/* Structured Course Metadata */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 p-3 rounded-lg bg-[#F8F9FB] border border-[#172154]/8 text-xs">
                      <div className="flex items-center gap-1.5 text-[#172154]">
                        <GraduationCap className="w-3.5 h-3.5 text-[#172154]/55 shrink-0" />
                        <span className="truncate">
                          <strong>{biText(lang, 'Teacher:', 'GV:')}</strong>{' '}
                          {prog.teacherName || biText(lang, 'TBA', 'Đang cập nhật')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#172154]">
                        <Calendar className="w-3.5 h-3.5 text-[#172154]/55 shrink-0" />
                        <span>
                          <strong>{biText(lang, 'Enroll:', 'Tuyển sinh:')}</strong>{' '}
                          {prog.enrollmentDate || biText(lang, 'Open now', 'Đang mở')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[#172154]">
                        <Users className="w-3.5 h-3.5 text-[#172154]/55 shrink-0" />
                        <span>
                          <strong>{biText(lang, 'Class Size:', 'Sĩ số:')}</strong>{' '}
                          {prog.maxClassSize ? `${prog.maxClassSize} ${biText(lang, 'students', 'HV')}` : '10 HV'}
                        </span>
                      </div>
                      {prog.scheduleSummary && (
                        <div className="flex items-center gap-1.5 text-[#172154]/75 sm:col-span-2">
                          <Clock className="w-3.5 h-3.5 text-[#172154]/50 shrink-0" />
                          <span>{prog.scheduleSummary}</span>
                        </div>
                      )}
                      {prog.location && (
                        <div className="flex items-center gap-1.5 text-[#172154]/70">
                          <MapPin className="w-3.5 h-3.5 text-[#172154]/50 shrink-0" />
                          <span className="truncate">{prog.location}</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#172154]/8">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busyAction === `prog_toggle_${prog.id}`}
                          onClick={() => void handleToggleProgramFlag(prog, 'showInPromoPopup')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                            isPopupOn
                              ? 'bg-[#FF6B00] text-white hover:bg-[#E05A00]'
                              : 'bg-[#F8F9FB] border border-[#172154]/12 text-[#172154] hover:border-[#FF6B00]/50'
                          }`}
                        >
                          <Megaphone className="w-3.5 h-3.5" />
                          {isPopupOn
                            ? biText(lang, 'In Popup (Hide)', 'Đang trên Popup (Ẩn)')
                            : biText(lang, 'Put in Popup', 'Đưa lên Popup')}
                        </button>

                        <button
                          type="button"
                          disabled={busyAction === `prog_toggle_${prog.id}`}
                          onClick={() => void handleToggleProgramFlag(prog, 'isActive')}
                          className="px-3 py-1.5 rounded-lg border border-[#172154]/12 bg-white hover:bg-[#F8F9FB] text-[#172154] text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors"
                        >
                          {isActiveOn
                            ? biText(lang, 'Pause Enrollment', 'Tạm đóng')
                            : biText(lang, 'Re-open Enrollment', 'Mở lại')}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onOpenPromoPopup && isPopupOn && isActiveOn && (
                          <button
                            type="button"
                            onClick={() => onOpenPromoPopup(prog.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#172154]/12 text-[#172154] hover:bg-[#F8F9FB] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {biText(lang, 'Popup', 'Popup')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEditProgram(prog)}
                          className="px-2.5 py-1.5 rounded-lg border border-[#172154]/12 text-[#172154] hover:bg-[#F8F9FB] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          {biText(lang, 'Edit', 'Sửa')}
                        </button>
                        {confirmDeleteProgId === prog.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busyAction === `prog_del_${prog.id}`}
                              onClick={() => void handleDeleteProgram(prog.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#E61E64] text-white text-xs font-semibold cursor-pointer"
                            >
                              {biText(lang, 'Confirm', 'Xóa')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteProgId(null)}
                              className="px-2 py-1.5 rounded-lg bg-[#F2F4F8] text-[#172154] text-xs font-semibold cursor-pointer"
                            >
                              {biText(lang, 'Cancel', 'Hủy')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteProgId(prog.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#E61E64]/20 text-[#E61E64] hover:bg-[#E61E64]/8 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {biText(lang, 'Delete', 'Xóa')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

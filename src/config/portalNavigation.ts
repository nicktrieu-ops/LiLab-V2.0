import type { LangCode } from '../types';
import { biText } from '../i18n';

export type AdminTab =
  | 'classes'
  | 'overview'
  | 'reports'
  | 'users'
  | 'programs'
  | 'finance'
  | 'gemini_notes'
  | 'certificates'
  | 'operations';

export type TeacherTab = 'schedule' | 'assess' | 'classes' | 'curriculum' | 'profile';

export type ParentTab =
  | 'dashboard'
  | 'calendar'
  | 'resources'
  | 'certificates'
  | 'activities'
  | 'enroll'
  | 'billing';

export type StudentTab =
  | 'studio'
  | 'speaking'
  | 'vibe'
  | 'mindmap'
  | 'notes'
  | 'calendar'
  | 'resources'
  | 'reports'
  | 'certificates';

export type PortalKey = 'admin' | 'teacher' | 'parent' | 'student';

export interface PortalAccentTheme {
  key: PortalKey;
  primaryHex: string;
  hoverHex: string;
  tintHex: string;
  activeTabClass: string;
  primaryBtnClass: string;
  subtleBadgeClass: string;
  ringClass: string;
  accentTextClass: string;
}

export const PORTAL_ACCENTS: Record<PortalKey, PortalAccentTheme> = {
  student: {
    key: 'student',
    primaryHex: '#FF6B00',
    hoverHex: '#E05A00',
    tintHex: '#FFF5EE',
    activeTabClass: 'bg-[#FF6B00] text-white',
    primaryBtnClass: 'bg-[#FF6B00] hover:bg-[#E05A00] text-white',
    subtleBadgeClass: 'bg-[#FFF5EE] text-[#C2410C] border border-[#FF6B00]/25',
    ringClass: 'focus:border-[#FF6B00] focus:ring-[#FF6B00]/20',
    accentTextClass: 'text-[#FF6B00]',
  },
  parent: {
    key: 'parent',
    primaryHex: '#0D9488',
    hoverHex: '#0F766E',
    tintHex: '#F0FDFA',
    activeTabClass: 'bg-[#0D9488] text-white',
    primaryBtnClass: 'bg-[#0D9488] hover:bg-[#0F766E] text-white',
    subtleBadgeClass: 'bg-[#F0FDFA] text-[#0F766E] border border-[#0D9488]/25',
    ringClass: 'focus:border-[#0D9488] focus:ring-[#0D9488]/20',
    accentTextClass: 'text-[#0D9488]',
  },
  teacher: {
    key: 'teacher',
    primaryHex: '#2563EB',
    hoverHex: '#1D4ED8',
    tintHex: '#EFF6FF',
    activeTabClass: 'bg-[#2563EB] text-white',
    primaryBtnClass: 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white',
    subtleBadgeClass: 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#2563EB]/25',
    ringClass: 'focus:border-[#2563EB] focus:ring-[#2563EB]/20',
    accentTextClass: 'text-[#2563EB]',
  },
  admin: {
    key: 'admin',
    primaryHex: '#6B21A8',
    hoverHex: '#581C87',
    tintHex: '#FAF5FF',
    activeTabClass: 'bg-[#6B21A8] text-white',
    primaryBtnClass: 'bg-[#6B21A8] hover:bg-[#581C87] text-white',
    subtleBadgeClass: 'bg-[#FAF5FF] text-[#6B21A8] border border-[#6B21A8]/25',
    ringClass: 'focus:border-[#6B21A8] focus:ring-[#6B21A8]/20',
    accentTextClass: 'text-[#6B21A8]',
  },
};

export interface NavTabItem<T extends string = string> {
  id: T;
  label: string;
  group?: 'primary' | 'more';
}

export function getAdminNavTabs(lang: LangCode): NavTabItem<AdminTab>[] {
  return [
    { id: 'classes', label: biText(lang, 'Classes & Schedule', 'Lớp & Lịch Học') },
    { id: 'overview', label: biText(lang, 'Overview', 'Tổng quan') },
    { id: 'reports', label: biText(lang, 'Reports', 'Báo cáo') },
    { id: 'users', label: biText(lang, 'Users & Roster', 'Học viên & NS') },
    { id: 'programs', label: biText(lang, 'Programs', 'Chương trình') },
    { id: 'finance', label: biText(lang, 'Accounts & Banking', 'Tài chính') },
    { id: 'gemini_notes', label: biText(lang, 'Resource Library', 'Thư viện Học liệu') },
    { id: 'certificates', label: biText(lang, 'Certificates', 'Cấp Chứng nhận') },
    { id: 'operations', label: biText(lang, 'Operations', 'Vận hành') },
  ];
}

export function getTeacherNavTabs(lang: LangCode): NavTabItem<TeacherTab>[] {
  return [
    { id: 'schedule', label: biText(lang, 'Schedule', 'Lịch Dạy') },
    { id: 'assess', label: biText(lang, 'Assessments', 'Đánh giá CEFR') },
    { id: 'classes', label: biText(lang, 'Classes', 'Lớp & Học viên') },
    { id: 'curriculum', label: biText(lang, 'Library', 'Học liệu') },
    { id: 'profile', label: biText(lang, 'Profile & Pay', 'Hồ sơ & Lương') },
  ];
}

export function getParentNavTabs(lang: LangCode): NavTabItem<ParentTab>[] {
  return [
    { id: 'dashboard', label: biText(lang, 'Overview', 'Tổng quan') },
    { id: 'calendar', label: biText(lang, 'Schedule', 'Lịch Học') },
    { id: 'resources', label: biText(lang, 'Library', 'Học liệu') },
    { id: 'certificates', label: biText(lang, 'Certificates', 'Chứng nhận') },
    { id: 'enroll', label: biText(lang, 'Programs', 'Ghi danh') },
    { id: 'billing', label: biText(lang, 'Billing', 'Học phí') },
  ];
}

export function getStudentNavTabs(lang: LangCode): NavTabItem<StudentTab>[] {
  return [
    { id: 'studio', label: biText(lang, 'Animation Studio', 'Xưởng Hoạt Hình') },
    { id: 'speaking', label: biText(lang, 'Speaking Lab', 'Phòng Luyện Nói') },
    { id: 'vibe', label: biText(lang, 'Vibe Coding', 'Lập Trình Vibe') },
    { id: 'mindmap', label: biText(lang, 'Mind Map', 'Sơ đồ Tư duy') },
    { id: 'notes', label: biText(lang, 'Study Notes', 'Sổ Tay') },
    { id: 'calendar', label: biText(lang, 'Schedule', 'Lịch Học') },
    { id: 'resources', label: biText(lang, 'Library', 'Học liệu') },
    { id: 'reports', label: biText(lang, 'Reports', 'Báo cáo') },
    { id: 'certificates', label: biText(lang, 'Certificates', 'Chứng nhận') },
  ];
}

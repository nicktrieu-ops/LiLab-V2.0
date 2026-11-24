import type { LangCode } from './types';

export function biText(lang: LangCode, en: string, vi: string): string {
  if (lang === 'vi') return vi;
  if (lang === 'en') return en;
  return `${vi} / ${en}`;
}

export const TRANSLATIONS: Record<
  LangCode,
  {
    academyName: string;
    academySub: string;
    beWholeTagline: string;
    loginTitle: string;
    loginSubtitle: string;
    signInTab: string;
    registerTab: string;
    continueWithGoogle: string;
    orUseEmail: string;
    emailLabel: string;
    passwordLabel: string;
    fullNameLabel: string;
    registerAsLabel: string;
    roleParent: string;
    roleStudent: string;
    signInButton: string;
    registerButton: string;
    signOut: string;
    aiHelperTitle: string;
    aiChatTab: string;
    translatorTab: string;
    askPlaceholder: string;
    translateBtn: string;
    sendBtn: string;
    overview: string;
    usersAndRoles: string;
    classesAndSchedules: string;
    geminiNotes: string;
    accountsPayable: string;
    assessments: string;
    mySchedule: string;
    myProfilePay: string;
    studentDashboard: string;
    activitiesCurriculum: string;
    courseEnrollment: string;
    invoicesBilling: string;
    cefrFramework: string;
    speaking: string;
    reading: string;
    writing: string;
    vocabulary: string;
    comprehension: string;
    social: string;
    emotional: string;
    mental: string;
    printReport: string;
    emailReport: string;
    directWithdraw: string;
    creditCard: string;
    qrPayment: string;
  }
> = {
  en: {
    academyName: 'LiLab Creative Talent Academy',
    academySub: 'Bilingual English & Character Values Academy',
    beWholeTagline: 'Be Whole · The 13-Week Values Curriculum for Children (Age 6+)',
    loginTitle: 'Welcome to LiLab Academy',
    loginSubtitle: 'Sign in or create your family, teacher, or administrator account to access classes, Cambridge CEFR reports, and Gemini Notes.',
    signInTab: 'Sign In',
    registerTab: 'Create Account',
    continueWithGoogle: 'Continue with Google',
    orUseEmail: 'or continue with email',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    fullNameLabel: 'Full Name',
    registerAsLabel: 'Account Type',
    roleParent: 'Parent / Guardian',
    roleStudent: 'Student',
    signInButton: 'Sign In to Portal',
    registerButton: 'Create Academy Account',
    signOut: 'Sign Out',
    aiHelperTitle: 'LiLab AI & Translator',
    aiChatTab: 'AI Chatbox',
    translatorTab: 'EN ↔ VI Translator',
    askPlaceholder: 'Ask about classes, CEFR levels, Week 01 Kindness, or reports...',
    translateBtn: 'Translate',
    sendBtn: 'Send',
    overview: 'Overview & Reports',
    usersAndRoles: 'Users & Profiles',
    classesAndSchedules: 'Classes & Schedules',
    geminiNotes: 'Resource Library',
    accountsPayable: 'Accounts & Banking',
    assessments: 'Student Ratings',
    mySchedule: 'My Schedule',
    myProfilePay: 'Profile & Pay',
    studentDashboard: 'Progress Dashboard',
    activitiesCurriculum: 'Resource Library',
    courseEnrollment: 'Enroll in Courses',
    invoicesBilling: 'Invoices & Payments',
    cefrFramework: 'Cambridge English CEFR',
    speaking: 'Speaking',
    reading: 'Reading',
    writing: 'Writing',
    vocabulary: 'Vocabulary',
    comprehension: 'Comprehension/Listening',
    social: 'Social',
    emotional: 'Emotional',
    mental: 'Mental',
    printReport: 'Print Report',
    emailReport: 'Send to Email',
    directWithdraw: 'Direct Bank Withdrawal',
    creditCard: 'Credit Card',
    qrPayment: 'VietQR Transfer',
  },
  vi: {
    academyName: 'Học viện Tài năng Sáng tạo LiLab',
    academySub: 'Học viện Tiếng Anh Song ngữ & Giá trị Sống',
    beWholeTagline: 'Be Whole · Giáo trình 13 Tuần Giá trị Sống cho Trẻ (6+ tuổi)',
    loginTitle: 'Chào mừng đến với LiLab',
    loginSubtitle: 'Đăng nhập hoặc đăng ký tài khoản Phụ huynh, Học viên, Giáo viên hoặc Quản trị để xem lịch học, báo cáo Cambridge CEFR và Thư viện Học liệu.',
    signInTab: 'Đăng nhập',
    registerTab: 'Đăng ký tài khoản',
    continueWithGoogle: 'Tiếp tục với Google',
    orUseEmail: 'hoặc sử dụng email',
    emailLabel: 'Địa chỉ Email',
    passwordLabel: 'Mật khẩu',
    fullNameLabel: 'Họ và Tên',
    registerAsLabel: 'Loại tài khoản',
    roleParent: 'Phụ huynh',
    roleStudent: 'Học viên',
    signInButton: 'Đăng nhập vào Cổng thông tin',
    registerButton: 'Tạo tài khoản Học viện',
    signOut: 'Đăng xuất',
    aiHelperTitle: 'Trợ lý AI & Dịch thuật LiLab',
    aiChatTab: 'Hộp thoại AI',
    translatorTab: 'Dịch Anh ↔ Việt',
    askPlaceholder: 'Hỏi về lớp học, cấp độ CEFR, Tuần 01 Lòng Tốt, hoặc báo cáo...',
    translateBtn: 'Dịch ngay',
    sendBtn: 'Gửi',
    overview: 'Tổng quan & Báo cáo',
    usersAndRoles: 'Người dùng & Hồ sơ',
    classesAndSchedules: 'Lớp học & Lịch giảng',
    geminiNotes: 'Thư viện Học liệu',
    accountsPayable: 'Tài chính & Ngân hàng',
    assessments: 'Đánh giá Học viên',
    mySchedule: 'Lịch dạy của tôi',
    myProfilePay: 'Hồ sơ & Thu nhập',
    studentDashboard: 'Bảng tiến độ học tập',
    activitiesCurriculum: 'Thư viện Học liệu',
    courseEnrollment: 'Đăng ký khóa học',
    invoicesBilling: 'Hóa đơn & Thanh toán',
    cefrFramework: 'Khung Cambridge CEFR',
    speaking: 'Nói (Speaking)',
    reading: 'Đọc (Reading)',
    writing: 'Viết (Writing)',
    vocabulary: 'Từ vựng (Vocabulary)',
    comprehension: 'Nghe hiểu (Comprehension/Listening)',
    social: 'Xã hội (Social)',
    emotional: 'Cảm xúc (Emotional)',
    mental: 'Tinh thần (Mental)',
    printReport: 'In báo cáo',
    emailReport: 'Gửi qua Email',
    directWithdraw: 'Trích nợ Ngân hàng',
    creditCard: 'Thẻ Tín dụng',
    qrPayment: 'Chuyển khoản VietQR',
  },
  bi: {
    academyName: 'Học viện LiLab · LiLab Academy',
    academySub: 'Tiếng Anh Song ngữ & Giá trị Sống · Bilingual English & Values',
    beWholeTagline: 'Be Whole · Giáo trình 13 Tuần Giá trị Sống / 13-Week Values Curriculum',
    loginTitle: 'Chào mừng đến LiLab · Welcome to LiLab',
    loginSubtitle: 'Đăng nhập hoặc tạo tài khoản để xem lớp học, báo cáo CEFR & Thư viện Học liệu / Sign in or register for classes, CEFR reports & Resource Library.',
    signInTab: 'Đăng nhập / Sign In',
    registerTab: 'Đăng ký / Register',
    continueWithGoogle: 'Tiếp tục với Google · Continue with Google',
    orUseEmail: 'hoặc dùng email / or email',
    emailLabel: 'Email / Địa chỉ Email',
    passwordLabel: 'Mật khẩu / Password',
    fullNameLabel: 'Họ và Tên / Full Name',
    registerAsLabel: 'Loại tài khoản / Account Type',
    roleParent: 'Phụ huynh / Parent',
    roleStudent: 'Học viên / Student',
    signInButton: 'Đăng nhập · Sign In',
    registerButton: 'Tạo tài khoản · Create Account',
    signOut: 'Đăng xuất · Sign Out',
    aiHelperTitle: 'Trợ lý AI & Dịch thuật · LiLab AI',
    aiChatTab: 'Hộp thoại AI · Chatbox',
    translatorTab: 'Dịch EN ↔ VI · Translator',
    askPlaceholder: 'Hỏi hoặc tìm kiếm (Tiếng Việt / English)...',
    translateBtn: 'Dịch / Translate',
    sendBtn: 'Gửi / Send',
    overview: 'Tổng quan & Báo cáo / Overview',
    usersAndRoles: 'Người dùng / Users',
    classesAndSchedules: 'Lớp & Lịch / Classes',
    geminiNotes: 'Thư viện Học liệu / Resource Library',
    accountsPayable: 'Tài chính / Finance',
    assessments: 'Đánh giá / Ratings',
    mySchedule: 'Lịch dạy / Schedule',
    myProfilePay: 'Hồ sơ & Lương / Profile & Pay',
    studentDashboard: 'Tiến độ / Dashboard',
    activitiesCurriculum: 'Thư viện Học liệu / Resource Library',
    courseEnrollment: 'Đăng ký khóa / Enroll',
    invoicesBilling: 'Hóa đơn / Billing',
    cefrFramework: 'Cambridge CEFR',
    speaking: 'Nói · Speaking',
    reading: 'Đọc · Reading',
    writing: 'Viết · Writing',
    vocabulary: 'Từ vựng · Vocabulary',
    comprehension: 'Nghe hiểu · Comprehension/Listening',
    social: 'Xã hội · Social',
    emotional: 'Cảm xúc · Emotional',
    mental: 'Tinh thần · Mental',
    printReport: 'In PDF · Print Report',
    emailReport: 'Gửi Email · Email Report',
    directWithdraw: 'Trích nợ · Direct Debit',
    creditCard: 'Thẻ · Credit Card',
    qrPayment: 'VietQR',
  },
};

export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(amount))} ₫`;
}

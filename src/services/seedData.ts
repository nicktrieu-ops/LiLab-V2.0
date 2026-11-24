import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { syncRecordToSql } from './sqlSyncClient';
import { buildLilabMasterSchedules } from '../data/lilabMasterSchedule';

export const SUPER_ADMIN_EMAILS = [
  'nickmyriam@gmail.com',
  'nicktrieu@gmail.com',
  'lilabvietnam@gmail.com',
] as const;

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (SUPER_ADMIN_EMAILS as readonly string[]).includes(email.trim().toLowerCase());
}

export const SPECIALTY_TALENT_PROGRAMS = [
  {
    id: 'prog_music_poetry',
    code: 'MP-01',
    titleEn: 'Music & Poetry – English Rhythm & Songwriting',
    titleVi: 'Âm Nhạc & Thơ Ca – Tiếng Anh Qua Giai Điệu & Thơ',
    descriptionEn:
      'Absorb natural English pronunciation, vocal rhythm, and expressive fluency through choral songs, children’s poetry recitals, songwriting workshops, and a mini showcase.',
    descriptionVi:
      'Cảm thụ phát âm, ngữ điệu và nhịp điệu tiếng Anh tự nhiên qua ca hát, đọc thơ thiếu nhi, sáng tác lời bài hát và biểu diễn mini cuối khoá.',
    cefrTarget: 'Pre-A1 to A2 Flyers',
    ageRange: '6 - 12 years',
    weeksCount: 8,
    tuitionVnd: 2400000,
    maxClassSize: 10,
    scheduleSummary: '8 sessions × 1.5h · Sat 10:00–11:30 or Thu 17:30–19:00',
    location: 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức',
    promoBadgeEn: 'CREATIVE TALENT · MUSIC & POETRY',
    promoBadgeVi: 'TÀI NĂNG SÁNG TẠO · ÂM NHẠC & THƠ CA',
    showInPromoPopup: true,
    isActive: true,
  },
  {
    id: 'prog_cultural_exploration',
    code: 'CE-01',
    titleEn: 'Cultural Exploration – Global Traditions & Storytelling',
    titleVi: 'Khám Phá Văn Hoá – Hành Trình Vòng Quanh Thế Giới',
    descriptionEn:
      'Travel across 8 world cultures in English! Students explore global festivals, folklore, international etiquette, hands-on crafts, and present their World Passport Expo.',
    descriptionVi:
      'Du hành qua 8 nền văn hoá thế giới bằng tiếng Anh! Trẻ khám phá lễ hội, truyện dân gian, nghi thức giao tiếp quốc tế, thủ công truyền thống và dự án Hộ Chiếu Văn Hoá.',
    cefrTarget: 'A1 Movers to A2 Key',
    ageRange: '7 - 13 years',
    weeksCount: 8,
    tuitionVnd: 2600000,
    maxClassSize: 10,
    scheduleSummary: '8 sessions × 1.5h · Sun 09:30–11:00 or Fri 17:30–19:00',
    location: 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức',
    promoBadgeEn: 'GLOBAL CITIZEN · CULTURAL LAB',
    promoBadgeVi: 'CÔNG DÂN TOÀN CẦU · KHÁM PHÁ VĂN HOÁ',
    showInPromoPopup: true,
    isActive: true,
  },
  {
    id: 'prog_mc_skills',
    code: 'MC-01',
    titleEn: 'Junior MC Skills – Bilingual Hosting & Public Speaking',
    titleVi: 'Kỹ Năng MC Nhí – Dẫn Chương Trình Song Ngữ & Thuyết Trình',
    descriptionEn:
      'Build confident stage presence, voice projection, bilingual EN-VI event hosting, live interview skills, and camera poise—culminating in a filmed LiLab Junior MC Gala.',
    descriptionVi:
      'Rèn luyện phong thái sân khấu tự tin, kỹ thuật làm chủ giọng nói, dẫn kịch bản song ngữ Anh-Việt, phỏng vấn trực tiếp và ghi hình Gala MC Nhí cuối khoá.',
    cefrTarget: 'A1 Movers to B1 Preliminary',
    ageRange: '7 - 14 years',
    weeksCount: 10,
    tuitionVnd: 3200000,
    maxClassSize: 8,
    scheduleSummary: '10 sessions × 1.5h · Sat or Sun 14:00–15:30',
    location: 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức',
    promoBadgeEn: 'STAGE CONFIDENCE · JUNIOR MC',
    promoBadgeVi: 'TỰ TIN SÂN KHẤU · MC NHÍ SONG NGỮ',
    showInPromoPopup: true,
    isActive: true,
  },
] as const;

export const SIGNATURE_POPUP_PROGRAMS = [
  {
    id: 'prog_bs_intro',
    code: 'BS-INTRO',
    titleEn: 'INTRODUCTION – Starter Course',
    titleVi: 'INTRODUCTION – LỚP NHẬP MÔN',
    descriptionEn:
      '4 themed sessions × 1 hour + Bonus: 2 complimentary etiquette & life-manners sessions. Ages 7–12. Small interactive group led by international educators.',
    descriptionVi:
      '4 buổi chuyên đề × 1 giờ + Tặng 2 buổi trải nghiệm lễ giáo và kỹ năng ứng xử. Dành cho bé 7–12 tuổi trong lớp học tương tác sĩ số nhỏ.',
    cefrTarget: 'Pre-A1 Starters',
    ageRange: '7 - 12 years',
    weeksCount: 4,
    tuitionVnd: 900000,
    maxClassSize: 10,
    scheduleSummary: '4 sessions × 1h + 2 Bonus Etiquette Sessions',
    location: 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức',
    promoBadgeEn: 'BIG SKILLS · STARTER COURSE',
    promoBadgeVi: 'NHẬP MÔN · KỸ NĂNG LỚN',
    showInPromoPopup: true,
    isActive: true,
  },
  {
    id: 'prog_bs_foundation',
    code: 'BS-FOUND',
    titleEn: 'FOUNDATION – Level 1, 2, or 3',
    titleVi: 'FOUNDATION – LEVEL 1, 2, 3',
    descriptionEn:
      '8 sessions × 1.5 hours per level with 100% foreign teachers and a dedicated co-facilitator. Builds confident English speaking, storytelling, and emotional intelligence.',
    descriptionVi:
      'Mỗi cấp độ 8 buổi × 1,5 giờ cùng 100% giáo viên nước ngoài + chuyên gia đồng hành. Phát triển giao tiếp tiếng Anh, kể chuyện và trí tuệ cảm xúc.',
    cefrTarget: 'Pre-A1 to A1 Movers',
    ageRange: '7 - 12 years',
    weeksCount: 8,
    tuitionVnd: 2000000,
    maxClassSize: 10,
    scheduleSummary: '8 sessions × 1.5h · Sat/Sun or Weekday Evenings',
    location: 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức',
    promoBadgeEn: 'BIG SKILLS · FOUNDATION',
    promoBadgeVi: 'NỀN TẢNG · KỸ NĂNG LỚN',
    showInPromoPopup: true,
    isActive: true,
  },
  {
    id: 'prog_bs_bundle',
    code: 'BS-BUNDLE',
    titleEn: 'COMPLETE 3-LEVEL BUNDLE (L1 + L2 + L3)',
    titleVi: 'TRỌN BỘ 3 CẤP ĐỘ (LEVEL 1, 2 & 3)',
    descriptionEn:
      'Full 3-level journey (24 sessions × 1.5 hours). Priority placement in small classes (max 10 students). Save 600,000 VND (10% off full tuition).',
    descriptionVi:
      'Trọn hành trình 3 cấp độ (24 buổi × 1,5 giờ). Ưu tiên xếp lớp sĩ số nhỏ tối đa 10 học sinh. Tiết kiệm 600.000 VNĐ (ưu đãi 10%).',
    cefrTarget: 'Pre-A1 to A1 Movers',
    ageRange: '7 - 12 years',
    weeksCount: 24,
    tuitionVnd: 5400000,
    maxClassSize: 10,
    scheduleSummary: '24 sessions × 1.5h · Flexible Intensive or Regular',
    location: 'C002 ParcSpring, 537 Nguyễn Duy Trinh, TP Thủ Đức',
    promoBadgeEn: 'FULL 3-LEVEL BUNDLE (-10%)',
    promoBadgeVi: 'ƯU ĐÃI TRỌN BỘ (-10%)',
    showInPromoPopup: true,
    isActive: true,
  },
] as const;

export interface ProgramDetailMeta {
  category: 'specialty' | 'signature' | 'core';
  categoryLabelEn: string;
  categoryLabelVi: string;
  highlightsEn: string[];
  highlightsVi: string[];
  showcaseEn: string;
  showcaseVi: string;
}

export const PROGRAM_DETAIL_HIGHLIGHTS: Record<string, ProgramDetailMeta> = {
  prog_music_poetry: {
    category: 'specialty',
    categoryLabelEn: 'CREATIVE TALENT · MUSIC & POETRY',
    categoryLabelVi: 'TÀI NĂNG SÁNG TẠO · ÂM NHẠC & THƠ CA',
    highlightsEn: [
      'Natural English pronunciation, word stress, and vocal intonation trained through curated melodies and choral songs',
      'Expressive children’s poetry recitation building memory, vocabulary richness, and stage confidence',
      'Guided songwriting & rhyming workshops where students write original English verses',
      'Small creative ensemble (max 10 students) with individualized voice & articulation coaching',
    ],
    highlightsVi: [
      'Luyện phát âm, trọng âm và ngữ điệu tiếng Anh tự nhiên thông qua giai điệu và hợp xướng thiếu nhi',
      'Đọc diễn cảm thơ ca giúp mở rộng vốn từ, rèn trí nhớ và sự tự tin khi đứng trước tập thể',
      'Workshop sáng tác vần thơ & lời bài hát tiếng Anh theo chủ đề yêu thích của trẻ',
      'Lớp nghệ thuật sĩ số nhỏ (tối đa 10 bé), được chỉnh phát âm và cảm thụ nhịp điệu sát sao',
    ],
    showcaseEn:
      'Mini Music & Poetry Recital for parents + digital audio/video keepsake of your child’s performance.',
    showcaseVi:
      'Buổi biểu diễn Mini Recital Âm Nhạc & Thơ Ca dành cho phụ huynh + bản ghi âm/video lưu niệm.',
  },
  prog_cultural_exploration: {
    category: 'specialty',
    categoryLabelEn: 'CREATIVE TALENT · CULTURAL EXPLORATION',
    categoryLabelVi: 'TÀI NĂNG SÁNG TẠO · KHÁM PHÁ VĂN HOÁ',
    highlightsEn: [
      'Immersive English journey across 8 countries — festivals, traditional folklore, food culture, and greetings',
      'International etiquette & cross-cultural communication practice for global citizenship',
      'Hands-on cultural craft labs each week (all art & craft materials included in tuition)',
      'Structured speaking practice presenting cultural discoveries in full English sentences',
    ],
    highlightsVi: [
      'Hành trình tiếng Anh sống động qua 8 quốc gia: lễ hội, truyện dân gian, ẩm thực và lời chào quốc tế',
      'Thực hành nghi thức giao tiếp và phép lịch sự đa văn hoá theo tinh thần công dân toàn cầu',
      'Hoạt động thủ công văn hoá mỗi buổi (đã bao gồm toàn bộ học liệu & vật liệu sáng tạo)',
      'Rèn kỹ năng thuyết trình tiếng Anh tự tin qua dự án giới thiệu đất nước yêu thích',
    ],
    showcaseEn:
      'LiLab World Passport Expo — each student stamps their custom passport and presents a country booth in English.',
    showcaseVi:
      'Triển lãm Hộ Chiếu Văn Hoá Thế Giới — bé hoàn thành cuốn hộ chiếu riêng và thuyết trình gian hàng quốc gia bằng tiếng Anh.',
  },
  prog_mc_skills: {
    category: 'specialty',
    categoryLabelEn: 'CREATIVE TALENT · JUNIOR MC & STAGE',
    categoryLabelVi: 'TÀI NĂNG SÁNG TẠO · MC NHÍ & SÂN KHẤU',
    highlightsEn: [
      'Stage presence, confident posture, eye contact, microphone technique, and breath-supported voice projection',
      'Bilingual English–Vietnamese hosting scripts for school events, talent shows, and announcements',
      'Live mini-interview skills, active listening, and quick-thinking improvisation on stage',
      'Ultra-small studio cohort (max 8 students) ensuring generous on-mic spotlight time every session',
    ],
    highlightsVi: [
      'Rèn phong thái sân khấu, dáng đứng, ánh mắt giao tiếp, kỹ thuật cầm micro và làm chủ cột hơi giọng nói',
      'Thực hành kịch bản dẫn chương trình song ngữ Anh–Việt cho lễ hội, sân khấu trường và sự kiện thiếu nhi',
      'Kỹ năng phỏng vấn trực tiếp, lắng nghe chủ động và xử lý tình huống sân khấu linh hoạt',
      'Lớp tinh hoa siêu nhỏ (tối đa 8 học viên) giúp mỗi bé đều có thời lượng thực hành dẫn trực tiếp mỗi buổi',
    ],
    showcaseEn:
      'Filmed LiLab Junior MC Gala — every graduate hosts a live segment on stage and receives a professionally edited highlight reel.',
    showcaseVi:
      'Gala MC Nhí LiLab ghi hình trực tiếp — mỗi bé tự tin dẫn một phân đoạn sân khấu và nhận video clip kỷ niệm chuyên nghiệp.',
  },
  prog_bs_intro: {
    category: 'signature',
    categoryLabelEn: 'BIG SKILLS, BIG HEART · STARTER',
    categoryLabelVi: 'BIG SKILLS, BIG HEART · NHẬP MÔN',
    highlightsEn: [
      '4 engaging themed English sessions × 1 hour designed to spark joy and overcome shyness',
      'Bonus: 2 complimentary etiquette & life-manners workshops included at no extra cost',
      'Warm small-group environment (max 10 students) guided by dedicated international teachers',
      'Ideal first step before joining the Big Skills Foundation 3-Level Pathway',
    ],
    highlightsVi: [
      '4 buổi chuyên đề tiếng Anh sinh động × 1 giờ giúp bé hào hứng và vượt qua rụt rè',
      'Quà tặng kèm: 2 buổi trải nghiệm lễ giáo và kỹ năng ứng xử hoàn toàn miễn phí',
      'Môi trường lớp học nhỏ ấm áp (tối đa 10 bé) cùng đội ngũ giáo viên quốc tế tận tâm',
      'Bước khởi đầu lý tưởng trước khi bước vào lộ trình 3 cấp độ Big Skills Foundation',
    ],
    showcaseEn:
      'Welcome Mini-Showcase & teacher readiness profile recommending your child’s best next level.',
    showcaseVi:
      'Buổi chia sẻ cuối khoá cùng đánh giá năng lực giúp phụ huynh chọn cấp độ tiếp theo phù hợp nhất.',
  },
  prog_bs_foundation: {
    category: 'signature',
    categoryLabelEn: 'BIG SKILLS, BIG HEART · FOUNDATION',
    categoryLabelVi: 'BIG SKILLS, BIG HEART · NỀN TẢNG',
    highlightsEn: [
      '8 structured sessions × 1.5 hours per level combining communicative English and real-world life skills',
      '100% foreign lead teachers paired with a caring bilingual co-facilitator',
      'Interactive reading comprehension, storytelling, role-play, and team creativity challenges',
      'Tracks growth across all 9 LiLab Character Pillars inside the Parent Portal',
    ],
    highlightsVi: [
      '8 buổi học bài bản × 1,5 giờ mỗi cấp độ kết hợp giao tiếp tiếng Anh và kỹ năng sống thực tế',
      '100% giáo viên nước ngoài đứng lớp cùng chuyên gia đồng hành song ngữ sát sao',
      'Đọc hiểu tương tác, kể chuyện, đóng vai và thử thách sáng tạo làm việc nhóm',
      'Theo dõi sát tiến bộ qua Biểu đồ 9 Phẩm chất Tích cực ngay trên Cổng Phụ huynh LiLab',
    ],
    showcaseEn:
      'End-of-Level Storytelling & Life Skills Showcase with full CEFR & 9-Pillar progress report.',
    showcaseVi:
      'Buổi trình diễn Kể chuyện & Kỹ năng cuối cấp độ kèm báo cáo tiến bộ CEFR & 9 Phẩm chất.',
  },
  prog_bs_bundle: {
    category: 'signature',
    categoryLabelEn: 'BIG SKILLS, BIG HEART · 3-LEVEL BUNDLE (-10%)',
    categoryLabelVi: 'BIG SKILLS, BIG HEART · TRỌN BỘ 3 CẤP ĐỘ (-10%)',
    highlightsEn: [
      'Complete 3-Level progression (24 sessions × 1.5 hours) from starter fluency to confident expression',
      'Save 600,000 VND (10% tuition savings compared to enrolling level-by-level)',
      'Priority class placement in small groups (max 10 students) with consistent international faculty',
      'Covers Reading, Storytelling, Music & Poetry, Cultural Exploration, and Creative Life Skills',
    ],
    highlightsVi: [
      'Trọn vẹn lộ trình 3 cấp độ liên tiếp (24 buổi × 1,5 giờ) phát triển giao tiếp tự tin và toàn diện',
      'Tiết kiệm ngay 600.000 VNĐ (giảm 10% học phí so với đăng ký từng cấp độ lẻ)',
      'Ưu tiên xếp lớp sĩ số nhỏ tối đa 10 học viên với đội ngũ giáo viên quốc tế ổn định',
      'Tích hợp Đọc hiểu, Kể chuyện, Âm nhạc & Thơ ca, Khám phá Văn hoá và Kỹ năng Sống Sáng tạo',
    ],
    showcaseEn:
      'Full 3-Level Graduation Portfolio, Certificate of Completion, and Parent Celebration Showcase.',
    showcaseVi:
      'Hồ sơ trưởng thành trọn 3 cấp độ, Chứng nhận hoàn thành và Lễ tổng kết cùng Phụ huynh.',
  },
  prog_be_whole_01: {
    category: 'core',
    categoryLabelEn: 'FLAGSHIP VALUES & ENGLISH',
    categoryLabelVi: 'CHƯƠNG TRÌNH GIÁ TRỊ SỐNG & TIẾNG ANH',
    highlightsEn: [
      '13-week holistic curriculum pairing Cambridge Pre-A1/A1 English with 13 core character values',
      'Story-based learning starting with Kindness ("The Lion and the Mouse") and Sentence House speaking drills',
      'Weekly songs, phonics mastery, collaborative games, and take-home parent value activities',
      'Complete bilingual weekly Gemini study notes accessible in the Parent Portal',
    ],
    highlightsVi: [
      'Giáo trình 13 tuần toàn diện kết hợp tiếng Anh Cambridge Pre-A1/A1 và 13 giá trị sống cốt lõi',
      'Học qua câu chuyện ngụ ngôn kinh điển, mở đầu với Tuần 01 Lòng Tốt & luyện câu Ngôi nhà Câu',
      'Âm nhạc, luyện âm phonics, trò chơi tập thể và hoạt động gắn kết gia đình mỗi tuần',
      'Cung cấp đầy đủ tài liệu ôn tập song ngữ hàng tuần ngay trên Cổng Phụ huynh LiLab',
    ],
    showcaseEn: 'Be Whole Character & Storytelling Celebration with personalized 9-Pillar Certificate.',
    showcaseVi: 'Ngày hội Kể chuyện & Giá trị sống Be Whole kèm Chứng nhận 9 Phẩm chất cá nhân hóa.',
  },
  prog_cambridge_movers: {
    category: 'core',
    categoryLabelEn: 'CAMBRIDGE PATHWAY · A1 MOVERS',
    categoryLabelVi: 'LỘ TRÌNH CAMBRIDGE · A1 MOVERS',
    highlightsEn: [
      '16-week structured mastery aligned directly to Cambridge English A1 Movers (- / standard / +)',
      'Builds fluent speaking, phonics accuracy, reading comprehension, and structured sentence construction',
      'Storytelling Studio workshops turning grammar into expressive real-life conversations',
      'Includes mock Cambridge Listening, Reading & Writing, and Speaking checkpoints',
    ],
    highlightsVi: [
      'Lộ trình 16 tuần bám sát chuẩn quốc tế Cambridge English A1 Movers',
      'Phát triển nói trôi chảy, phát âm chuẩn, đọc hiểu sâu và xây dựng câu hoàn chỉnh',
      'Xưởng Kể chuyện giúp chuyển hóa ngữ pháp thành giao tiếp tự nhiên trong đời sống',
      'Tích hợp bài kiểm tra thử 4 kỹ năng Nghe – Nói – Đọc – Viết chuẩn Cambridge',
    ],
    showcaseEn: 'A1 Movers Readiness Report & Student Storytelling Presentation.',
    showcaseVi: 'Báo cáo sẵn sàng thi Cambridge A1 Movers & Phần trình bày Kể chuyện của học viên.',
  },
  prog_cambridge_flyers: {
    category: 'core',
    categoryLabelEn: 'CAMBRIDGE PATHWAY · A2 FLYERS',
    categoryLabelVi: 'LỘ TRÌNH CAMBRIDGE · A2 FLYERS',
    highlightsEn: [
      '16-week bilingual leadership program targeting Cambridge A2 Flyers to A2 Key+',
      'Advances multi-paragraph writing, expressive debate, critical thinking, and emotional resilience',
      'Project-based teamwork preparing upper-primary & lower-secondary students for international environments',
      'Detailed skill radar & CEFR progression analytics shared with parents each assessment cycle',
    ],
    highlightsVi: [
      'Chương trình 16 tuần hướng tới chuẩn Cambridge A2 Flyers đến A2 Key+',
      'Nâng cao kỹ năng viết đoạn văn mạch lạc, tranh biện, tư duy phản biện và bản lĩnh cảm xúc',
      'Học qua dự án nhóm giúp học sinh tự tin hội nhập môi trường học tập quốc tế',
      'Báo cáo biểu đồ Radar năng lực & lộ trình CEFR chi tiết gửi phụ huynh định kỳ',
    ],
    showcaseEn: 'Creative Leadership Debate Showcase & Cambridge A2 Flyers Readiness Certificate.',
    showcaseVi: 'Sân khấu Tranh biện Lãnh đạo Sáng tạo & Chứng nhận sẵn sàng Cambridge A2 Flyers.',
  },
};

export async function ensureSpecialtyProgramsSeeded(): Promise<number> {
  let added = 0;
  for (const prog of SPECIALTY_TALENT_PROGRAMS) {
    const { id, ...rest } = prog;
    const ref = doc(db, 'programs', id);
    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) continue;
      await setDoc(ref, {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('programs', id, rest);
      added++;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `programs/${id}`);
    }
  }
  return added;
}

export async function ensureSignatureProgramsSeeded(): Promise<number> {
  let added = 0;
  for (const prog of SIGNATURE_POPUP_PROGRAMS) {
    const { id, ...rest } = prog;
    const ref = doc(db, 'programs', id);
    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) continue;
      await setDoc(ref, {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('programs', id, rest);
      added++;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `programs/${id}`);
    }
  }
  return added;
}

export async function seedAcademyBaseline(adminUid: string, adminEmail: string): Promise<void> {
  await ensureSpecialtyProgramsSeeded();
  await ensureSignatureProgramsSeeded();

  const checkRef = doc(db, 'programs', 'prog_be_whole_01');
  try {
    const snap = await getDoc(checkRef);
    if (snap.exists()) return;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'programs/prog_be_whole_01');
  }

  const adminUids = [adminUid];

  const programs = [
    {
      id: 'prog_be_whole_01',
      code: 'BW-01',
      titleEn: 'Be Whole: 13-Week Values & English Curriculum',
      titleVi: 'Be Whole: Giáo trình Tiếng Anh & 13 Giá trị Sống',
      descriptionEn:
        'Flagship holistic English program for ages 6+ weaving Cambridge Pre-A1/A1 communication with 13 core character values starting with Week 01: Kindness ("The Lion and the Mouse").',
      descriptionVi:
        'Chương trình Tiếng Anh toàn diện dành cho trẻ 6+ kết hợp giao tiếp Cambridge Pre-A1/A1 và 13 giá trị sống cốt lõi, khởi đầu Tuần 01: Lòng Tốt ("Sư tử và Chuột nhắt").',
      cefrTarget: 'Pre-A1 Starters to A1 Movers',
      ageRange: '6 - 10 years',
      weeksCount: 13,
      tuitionVnd: 4800000,
      scheduleSummary: 'Tue & Thu 17:30–19:00 · or Sat 09:00–11:00',
      isActive: true,
    },
    {
      id: 'prog_cambridge_movers',
      code: 'CM-A1',
      titleEn: 'Cambridge A1 Movers & Storytelling Studio',
      titleVi: 'Xưởng Kể chuyện & Tiếng Anh Cambridge A1 Movers',
      descriptionEn:
        'Builds confident speaking, phonics fluency, reading comprehension, and structured sentence building aligned to Cambridge English A1 Movers.',
      descriptionVi:
        'Phát triển tự tin giao tiếp, phát âm chuẩn, đọc hiểu và ghép câu vững chắc theo khung Cambridge English A1 Movers.',
      cefrTarget: 'A1 Movers (- / standard / +)',
      ageRange: '8 - 11 years',
      weeksCount: 16,
      tuitionVnd: 5600000,
      scheduleSummary: 'Mon & Wed 18:00–19:30',
      isActive: true,
    },
    {
      id: 'prog_cambridge_flyers',
      code: 'CF-A2',
      titleEn: 'Cambridge A2 Flyers & Creative Leadership',
      titleVi: 'Cambridge A2 Flyers & Kỹ năng Lãnh đạo Sáng tạo',
      descriptionEn:
        'Intermediate bilingual leadership track advancing writing paragraphs, expressive debate, and emotional resilience.',
      descriptionVi:
        'Lộ trình trung cấp giúp học viên viết đoạn văn mạch lạc, thuyết trình tự tin và rèn luyện trí tuệ cảm xúc.',
      cefrTarget: 'A2 Flyers to A2 Key+',
      ageRange: '10 - 13 years',
      weeksCount: 16,
      tuitionVnd: 6200000,
      scheduleSummary: 'Sat & Sun 14:00–15:30',
      isActive: true,
    },
  ];

  for (const prog of programs) {
    const { id, ...rest } = prog;
    try {
      await setDoc(doc(db, 'programs', id), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('programs', id, rest);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `programs/${id}`);
    }
  }

  // Seed Week 01 Gemini Note directly from the attached Be Whole Week 01 Kindness workbook
  const week01Note = {
    title: 'Week 01: Kindness — The Lion and the Mouse',
    weekNumber: 1,
    programTitle: 'Be Whole: 13-Week Values & English Curriculum',
    sourceFileName: 'GIA_O_TRI_NH_TIE_NG_ANH_BE_WHOLE_WEEK_01.pdf',
    summaryEn:
      'Week 01 teaches Kindness through Heart (Kind Words, Kind Feelings, Kind Actions) and Aesop\'s fable "The Lion and the Mouse". Moral: "Kind hands help. Kind words heal." Students sing "Kind Hands, Kind Words" to the tune of Twinkle, Twinkle, Little Star and build 12 English sentence bricks in the Sentence House.',
    summaryVi:
      'Tuần 01 dạy về Lòng Tốt (Kindness) qua Trái tim 3 mảnh ghép: Lời nói tử tế (Kind Words), Cảm xúc ấm áp (Kind Feelings), và Hành động giúp đỡ (Kind Actions) cùng truyện ngụ ngôn "Sư tử và Chuột nhắt". Thông điệp: "Đôi tay tử tế giúp đỡ. Lời nói tử tế chữa lành." Học viên hát bài "Kind Hands, Kind Words" và ghép 12 câu giao tiếp trong Ngôi nhà Câu.',
    keyVocabulary: [
      'kind',
      'kindness',
      'help',
      'share',
      'please',
      'thank you',
      'care',
      'friend',
      'smile',
      'happy',
      'gentle',
      'listen',
      'are you okay?',
      'hug',
    ],
    phonicsFocus: '/k/ sound: kind, care, can · /h/ sound: help, hands, happy · /sh/ sound: share, shiny',
    grammarFocus: '"I can ___" → I can help. · "Please ___" → Please share. · "Thank you for ___" → Thank you for helping.',
    activitiesEn:
      'Games: 01. Kindness Detective, 02. Pass the Heart, 03. Kindness Relay. Additional: Kindness Handprint Wall, Kindness Token Jar, Kindness Bracelet. Homework: Act out Lion & Mouse, learn the value song, remember key phrases.',
    activitiesVi:
      'Trò chơi: 01. Thám tử Lòng tốt, 02. Chuyền Trái tim, 03. Tiếp sức Tử tế. Hoạt động thêm: Bức tường Dấu tay, Hũ Xu Lòng tốt, Vòng tay Nhắc nhớ. Bài tập về nhà: Đóng vai Sư tử & Chuột nhắt, thuộc bài hát và từ khóa.',
    uploadedByUid: adminUid,
    uploadedByEmail: adminEmail,
  };

  try {
    await setDoc(doc(db, 'gemini_notes', 'note_be_whole_week_01'), {
      ...week01Note,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await syncRecordToSql('gemini_notes', 'note_be_whole_week_01', week01Note);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'gemini_notes/note_be_whole_week_01');
  }

  // Seed Academy Bank Configuration in payables
  const bankConfig = {
    recordType: 'academy_bank_config',
    recipientName: 'LiLab Creative Talent Academy',
    recipientEmail: adminEmail,
    bankName: 'Vietcombank (VCB) · Ho Chi Minh Branch',
    bankAccountNumber: '1028869900123',
    bankAccountHolder: 'CONG TY TNHH HOC VIEN LILAB',
    amountVnd: 0,
    dueDate: 'Ongoing',
    status: 'active',
    notes: 'Primary tuition collection & VietQR settlement account.',
    adminUids,
  };

  try {
    await setDoc(doc(db, 'payables', 'bank_lilab_primary'), {
      ...bankConfig,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await syncRecordToSql('payables', 'bank_lilab_primary', bankConfig);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'payables/bank_lilab_primary');
  }

  // Seed official 13-class (26 weekly sessions) LiLab Master Schedule
  await seedLilabMasterSchedule(adminUid, adminEmail, false);
}

/**
 * Seeds all 13 classes (26 weekly sessions across Phòng 1–3) from the official
 * LiLab Master Group Schedule into Firestore `schedules` and Cloud SQL.
 */
export async function seedLilabMasterSchedule(
  adminUid: string,
  adminEmail: string,
  forceOverwrite = false
): Promise<{ created: number; skipped: number }> {
  const masterItems = buildLilabMasterSchedules(adminUid, adminEmail);
  let created = 0;
  let skipped = 0;

  for (const item of masterItems) {
    const { id, ...rest } = item;
    try {
      if (!forceOverwrite) {
        const existingSnap = await getDoc(doc(db, 'schedules', id));
        if (existingSnap.exists()) {
          skipped += 1;
          continue;
        }
      }
      await setDoc(doc(db, 'schedules', id), {
        ...rest,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('schedules', id, rest);
      created += 1;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schedules/${id}`);
    }
  }

  return { created, skipped };
}

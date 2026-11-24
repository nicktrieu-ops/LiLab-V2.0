import { PCE_KIDS_CURRICULUM, resolveStudentPceLevel, type PceLevelCourse } from '../data/pceCurriculumData';
import {
  formatCefrLabel,
  type CefrLevel,
  type CefrModifier,
  type IssuedCertificate,
  type LangCode,
  type StudentAssessment,
  type StudentProfile,
} from '../types';

export type CertificateThemeId = 'royal_gold' | 'rose_celebration' | 'heritage_teal';

export interface CertificateThemePalette {
  id: CertificateThemeId;
  nameEn: string;
  nameVi: string;
  bgCanvas: string;
  innerBg: string;
  primary: string;
  secondary: string;
  accent: string;
  sealBg: string;
  sealRing: string;
  ink: string;
  muted: string;
}

export const CERTIFICATE_THEMES: Record<CertificateThemeId, CertificateThemePalette> = {
  royal_gold: {
    id: 'royal_gold',
    nameEn: 'Royal Blue & Gold',
    nameVi: 'Xanh Hoàng Gia & Vàng Kim',
    bgCanvas: '#FDF9EE',
    innerBg: '#FFFFFF',
    primary: '#2D3E99',
    secondary: '#D97706',
    accent: '#E61E64',
    sealBg: '#2D3E99',
    sealRing: '#FFD41D',
    ink: '#172154',
    muted: '#475569',
  },
  rose_celebration: {
    id: 'rose_celebration',
    nameEn: 'LiLab Rose Celebration',
    nameVi: 'Hồng LiLab Rực Rỡ',
    bgCanvas: '#FFF5F7',
    innerBg: '#FFFFFF',
    primary: '#E61E64',
    secondary: '#2D3E99',
    accent: '#F59E0B',
    sealBg: '#E61E64',
    sealRing: '#FFD41D',
    ink: '#172154',
    muted: '#475569',
  },
  heritage_teal: {
    id: 'heritage_teal',
    nameEn: 'Heritage Teal & Ivory',
    nameVi: 'Ngọc Lam & Ngà Cổ Điển',
    bgCanvas: '#F0FDFA',
    innerBg: '#FFFFFF',
    primary: '#0F766E',
    secondary: '#2D3E99',
    accent: '#D97706',
    sealBg: '#0F766E',
    sealRing: '#FFD41D',
    ink: '#134E4A',
    muted: '#475569',
  },
};

export interface HonorTier {
  key: 'distinction' | 'merit' | 'commended' | 'growth';
  labelEn: string;
  labelVi: string;
  shortSealEn: string;
  shortSealVi: string;
  color: string;
}

export interface CertificateMetrics {
  cefrLevel: CefrLevel;
  cefrModifier: CefrModifier;
  cefrDisplay: string;
  pceCourse: PceLevelCourse;
  hasScores: boolean;
  speaking: number;
  reading: number;
  writing: number;
  vocabulary: number;
  comprehension: number;
  social: number;
  emotional: number;
  mental: number;
  englishAvg: number;
  wholeChildAvg: number;
  compositeScore: number;
  honorTier: HonorTier;
  serialId: string;
}

export interface CertificateRenderPayload {
  studentName: string;
  studentAge?: number;
  studentGender?: 'girl' | 'boy';
  studentPhotoUrl?: string;
  className: string;
  termLabel: string;
  teacherName: string;
  directorName: string;
  directorTitleEn: string;
  directorTitleVi: string;
  awardTitleEn: string;
  awardTitleVi: string;
  citationEn: string;
  citationVi: string;
  issueDate: string;
  lang: LangCode;
  theme: CertificateThemeId;
  showScores: boolean;
  showStudentPhoto: boolean;
  metrics: CertificateMetrics;
}

export function extractAssessmentDateIso(assessment?: StudentAssessment | null): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!assessment) return today;
  const raw = assessment.createdAt as
    | { toDate?: () => Date; seconds?: number }
    | string
    | number
    | undefined;
  if (!raw) return today;
  try {
    let dt: Date | null = null;
    if (typeof raw === 'object' && typeof raw.toDate === 'function') {
      dt = raw.toDate();
    } else if (typeof raw === 'object' && typeof raw.seconds === 'number') {
      dt = new Date(raw.seconds * 1000);
    } else if (typeof raw === 'string' || typeof raw === 'number') {
      dt = new Date(raw);
    }
    if (dt && !Number.isNaN(dt.getTime())) {
      return dt.toISOString().slice(0, 10);
    }
  } catch {
    return today;
  }
  return today;
}

export function formatCompletionDate(isoDate: string, lang: LangCode): string {
  const parts = (isoDate || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return isoDate || new Date().toISOString().slice(0, 10);
  }
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  const en = dt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const vi = `${String(d).padStart(2, '0')} Tháng ${String(m).padStart(2, '0')}, ${y}`;
  if (lang === 'vi') return vi;
  if (lang === 'bi') return `${en} · ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  return en;
}

export function computeCertificateMetrics(
  student: StudentProfile,
  assessment: StudentAssessment | null
): CertificateMetrics {
  const cefrLevel = assessment?.cefrLevel || student.cefrLevel || 'Pre-A1 Starters';
  const cefrModifier = assessment?.cefrModifier || student.cefrModifier || 'standard';
  const cefrDisplay = formatCefrLabel(cefrLevel, cefrModifier);
  const pceCourse = resolveStudentPceLevel(student.age, cefrLevel, cefrModifier);

  const speaking = assessment?.speakingScore ?? 0;
  const reading = assessment?.readingScore ?? 0;
  const writing = assessment?.writingScore ?? 0;
  const vocabulary = assessment?.vocabularyScore ?? 0;
  const comprehension = assessment?.comprehensionScore ?? 0;
  const social = assessment?.socialScore ?? 0;
  const emotional = assessment?.emotionalScore ?? 0;
  const mental = assessment?.mentalScore ?? 0;

  const hasScores = Boolean(
    assessment &&
      speaking + reading + writing + vocabulary + comprehension + social + emotional + mental > 0
  );

  const englishAvg = hasScores
    ? Math.round((speaking + reading + writing + vocabulary + comprehension) / 5)
    : 0;
  const wholeChildAvg = hasScores
    ? Math.round((social + emotional + mental) / 3)
    : 0;
  const compositeScore = hasScores ? Math.round((englishAvg + wholeChildAvg) / 2) : 0;

  let honorTier: HonorTier;
  if (hasScores && compositeScore >= 90) {
    honorTier = {
      key: 'distinction',
      labelEn: 'Distinction with Honors',
      labelVi: 'Xuất Sắc Tiêu Biểu',
      shortSealEn: 'HONORS',
      shortSealVi: 'XUẤT SẮC',
      color: '#D97706',
    };
  } else if (hasScores && compositeScore >= 80) {
    honorTier = {
      key: 'merit',
      labelEn: 'High Merit Achievement',
      labelVi: 'Thành Tích Ưu Tú',
      shortSealEn: 'HIGH MERIT',
      shortSealVi: 'ƯU TÚ',
      color: '#2D3E99',
    };
  } else if (hasScores && compositeScore >= 70) {
    honorTier = {
      key: 'commended',
      labelEn: 'Commended Progress',
      labelVi: 'Tiến Bộ Vượt Trội',
      shortSealEn: 'COMMENDED',
      shortSealVi: 'TIẾN BỘ',
      color: '#0F766E',
    };
  } else {
    honorTier = {
      key: 'growth',
      labelEn: 'Certificate of Progress & Growth',
      labelVi: 'Chứng Nhận Nỗ Lực & Trưởng Thành',
      shortSealEn: 'ACHIEVER',
      shortSealVi: 'TRƯỞNG THÀNH',
      color: '#E61E64',
    };
  }

  // Deterministic verifiable serial number
  const seedStr = `${student.id}|${assessment?.id || 'milestone'}|${cefrDisplay}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  const code4 = String(1000 + (hash % 9000));
  const cefrCode = cefrLevel
    .split(/\s+/)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 3);
  const year = new Date().getFullYear();
  const serialId = `LILAB-${year}-${cefrCode || 'PCE'}-${code4}`;

  return {
    cefrLevel,
    cefrModifier,
    cefrDisplay,
    pceCourse,
    hasScores,
    speaking,
    reading,
    writing,
    vocabulary,
    comprehension,
    social,
    emotional,
    mental,
    englishAvg,
    wholeChildAvg,
    compositeScore,
    honorTier,
    serialId,
  };
}

export function getHonorTierByKey(key: HonorTier['key']): HonorTier {
  switch (key) {
    case 'distinction':
      return {
        key: 'distinction',
        labelEn: 'Distinction with Honors',
        labelVi: 'Xuất Sắc Tiêu Biểu',
        shortSealEn: 'HONORS',
        shortSealVi: 'XUẤT SẮC',
        color: '#D97706',
      };
    case 'merit':
      return {
        key: 'merit',
        labelEn: 'High Merit Achievement',
        labelVi: 'Thành Tích Ưu Tú',
        shortSealEn: 'HIGH MERIT',
        shortSealVi: 'ƯU TÚ',
        color: '#2D3E99',
      };
    case 'commended':
      return {
        key: 'commended',
        labelEn: 'Commended Progress',
        labelVi: 'Tiến Bộ Vượt Trội',
        shortSealEn: 'COMMENDED',
        shortSealVi: 'TIẾN BỘ',
        color: '#0F766E',
      };
    default:
      return {
        key: 'growth',
        labelEn: 'Certificate of Progress & Growth',
        labelVi: 'Chứng Nhận Nỗ Lực & Trưởng Thành',
        shortSealEn: 'ACHIEVER',
        shortSealVi: 'TRƯỞNG THÀNH',
        color: '#E61E64',
      };
  }
}

export function buildPayloadFromIssuedCertificate(
  cert: IssuedCertificate
): CertificateRenderPayload {
  const pceCourse =
    PCE_KIDS_CURRICULUM.find((c) => c.levelNumber === cert.pceLevelNumber) ||
    resolveStudentPceLevel(cert.studentAge, cert.cefrLevel, cert.cefrModifier);

  const metrics: CertificateMetrics = {
    cefrLevel: cert.cefrLevel,
    cefrModifier: cert.cefrModifier,
    cefrDisplay: cert.cefrDisplay || formatCefrLabel(cert.cefrLevel, cert.cefrModifier),
    pceCourse,
    hasScores: Boolean(cert.hasScores),
    speaking: cert.speakingScore ?? 0,
    reading: cert.readingScore ?? 0,
    writing: cert.writingScore ?? 0,
    vocabulary: cert.vocabularyScore ?? 0,
    comprehension: cert.comprehensionScore ?? 0,
    social: cert.socialScore ?? 0,
    emotional: cert.emotionalScore ?? 0,
    mental: cert.mentalScore ?? 0,
    englishAvg: cert.englishAvg ?? 0,
    wholeChildAvg: cert.wholeChildAvg ?? 0,
    compositeScore: cert.compositeScore ?? 0,
    honorTier: getHonorTierByKey(cert.honorTierKey),
    serialId: cert.serialId,
  };

  return {
    studentName: cert.studentName,
    studentAge: cert.studentAge,
    studentGender: cert.studentGender,
    studentPhotoUrl: cert.studentPhotoUrl,
    className: cert.className,
    termLabel: cert.termLabel,
    teacherName: cert.teacherName,
    directorName: cert.directorName,
    directorTitleEn: cert.directorTitleEn,
    directorTitleVi: cert.directorTitleVi,
    awardTitleEn: cert.awardTitleEn,
    awardTitleVi: cert.awardTitleVi,
    citationEn: cert.citationEn,
    citationVi: cert.citationVi,
    issueDate: cert.issueDate,
    lang: cert.certLang,
    theme: cert.theme,
    showScores: Boolean(cert.showScores),
    showStudentPhoto: Boolean(cert.showStudentPhoto),
    metrics,
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  if (!text || !text.trim()) return [];
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        const remaining = [current, ...words.slice(i + 1)].join(' ');
        let clipped = remaining;
        while (ctx.measureText(`${clipped}…`).width > maxWidth && clipped.length > 6) {
          clipped = clipped.slice(0, -2);
        }
        lines.push(clipped === remaining ? clipped : `${clipped}…`);
        return lines;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawStarburstSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
  fillColor: string,
  ringColor: string,
  topText: string,
  centerText: string,
  bottomText: string
) {
  // Trailing ribbons
  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(cx - 42, cy + innerR - 20);
  ctx.lineTo(cx - 64, cy + outerR + 74);
  ctx.lineTo(cx - 32, cy + outerR + 50);
  ctx.lineTo(cx - 6, cy + outerR + 78);
  ctx.lineTo(cx - 8, cy + innerR - 10);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx + 42, cy + innerR - 20);
  ctx.lineTo(cx + 64, cy + outerR + 74);
  ctx.lineTo(cx + 32, cy + outerR + 50);
  ctx.lineTo(cx + 6, cy + outerR + 78);
  ctx.lineTo(cx + 8, cy + innerR - 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Outer scalloped star
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = ringColor;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = fillColor;
  ctx.stroke();

  // Inner circle
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 12, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 22, 0, Math.PI * 2);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = 'center';
  ctx.fillStyle = ringColor;
  ctx.font = '800 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(topText, cx, cy - 30);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px "JetBrains Mono", "Bricolage Grotesque", sans-serif';
  ctx.fillText(centerText, cx, cy + 12);

  ctx.fillStyle = '#FDF9EE';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(bottomText, cx, cy + 40);
  ctx.textAlign = 'left';
}

function drawCornerFiligree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  dirX: 1 | -1,
  dirY: 1 | -1,
  primary: string,
  secondary: string
) {
  ctx.save();
  ctx.strokeStyle = primary;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y + dirY * 84);
  ctx.lineTo(x, y);
  ctx.lineTo(x + dirX * 84, y);
  ctx.stroke();

  ctx.strokeStyle = secondary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + dirX * 16, y + dirY * 64);
  ctx.lineTo(x + dirX * 16, y + dirY * 16);
  ctx.lineTo(x + dirX * 64, y + dirY * 16);
  ctx.stroke();

  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.arc(x + dirX * 26, y + dirY * 26, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function renderCertificateToCanvas(
  payload: CertificateRenderPayload
): Promise<HTMLCanvasElement> {
  // Landscape A4 @ 200 DPI
  const W = 2339;
  const H = 1654;
  const palette = CERTIFICATE_THEMES[payload.theme] || CERTIFICATE_THEMES.royal_gold;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  const fallbackAvatar =
    payload.studentGender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png';

  const [logoImg, studentPhotoImg, fallbackImg, mascotImg] = await Promise.all([
    loadImage('/assets/lilab_logo.png'),
    payload.showStudentPhoto && payload.studentPhotoUrl
      ? loadImage(payload.studentPhotoUrl)
      : Promise.resolve(null),
    payload.showStudentPhoto ? loadImage(fallbackAvatar) : Promise.resolve(null),
    loadImage(payload.metrics.pceCourse.lilabCharacterImg),
  ]);

  const avatarImg = studentPhotoImg || fallbackImg;

  // 1. Outer cream/tinted background
  ctx.fillStyle = palette.bgCanvas;
  ctx.fillRect(0, 0, W, H);

  // Subtle decorative bands top & bottom
  ctx.fillStyle = palette.primary;
  ctx.fillRect(0, 0, W * 0.65, 22);
  ctx.fillStyle = '#FFD41D';
  ctx.fillRect(W * 0.65, 0, W * 0.17, 22);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(W * 0.82, 0, W * 0.18, 22);

  ctx.fillStyle = palette.primary;
  ctx.fillRect(0, H - 22, W * 0.65, 22);
  ctx.fillStyle = '#FFD41D';
  ctx.fillRect(W * 0.65, H - 22, W * 0.17, 22);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(W * 0.82, H - 22, W * 0.18, 22);

  // 2. Inner crisp certificate sheet + double border
  const padOuter = 68;
  drawRoundedRect(ctx, padOuter, padOuter, W - padOuter * 2, H - padOuter * 2, 26);
  ctx.fillStyle = palette.innerBg;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = palette.primary;
  ctx.stroke();

  const padInner = 92;
  drawRoundedRect(ctx, padInner, padInner, W - padInner * 2, H - padInner * 2, 18);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = palette.secondary;
  ctx.stroke();

  // Corner filigrees
  drawCornerFiligree(ctx, 114, 114, 1, 1, palette.primary, palette.secondary);
  drawCornerFiligree(ctx, W - 114, 114, -1, 1, palette.primary, palette.secondary);
  drawCornerFiligree(ctx, 114, H - 114, 1, -1, palette.primary, palette.secondary);
  drawCornerFiligree(ctx, W - 114, H - 114, -1, -1, palette.primary, palette.secondary);

  // Soft watermark ring in center
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 - 40, 320, 0, Math.PI * 2);
  ctx.lineWidth = 24;
  ctx.strokeStyle = palette.primary;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 - 40, 260, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = palette.secondary;
  ctx.stroke();
  ctx.restore();

  // 3. Header: Logo centered + Academy title
  if (logoImg) {
    const logoH = 88;
    const logoW = (logoImg.width / Math.max(1, logoImg.height)) * logoH;
    ctx.drawImage(logoImg, (W - logoW) / 2, 134, logoW, logoH);
  } else {
    ctx.textAlign = 'center';
    ctx.fillStyle = palette.primary;
    ctx.font = '800 44px "Bricolage Grotesque", sans-serif';
    ctx.fillText('LILAB CREATIVE TALENT ACADEMY', W / 2, 195);
  }

  // Serial ID top-right & Pathway code top-left
  ctx.fillStyle = palette.muted;
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`PCE-KIDS LEVEL ${payload.metrics.pceCourse.levelNumber} OF 13`, 162, 166);
  ctx.textAlign = 'right';
  ctx.fillText(`CERT ID: ${payload.metrics.serialId}`, W - 162, 166);

  // 4. Certificate Main Heading
  ctx.textAlign = 'center';
  const showEn = payload.lang !== 'vi';
  const showVi = payload.lang !== 'en';

  const headingPrimary =
    payload.lang === 'vi'
      ? payload.awardTitleVi.toUpperCase()
      : payload.awardTitleEn.toUpperCase();

  ctx.fillStyle = palette.primary;
  ctx.font = '800 54px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(headingPrimary, W / 2, 294);

  if (payload.lang === 'bi') {
    ctx.fillStyle = palette.accent;
    ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(payload.awardTitleVi.toUpperCase(), W / 2, 336);
  } else {
    ctx.fillStyle = palette.secondary;
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      payload.lang === 'vi'
        ? 'LILAB CREATIVE TALENT ACADEMY · KHUNG CHUẨN CAMBRIDGE CEFR & BE WHOLE'
        : 'LILAB CREATIVE TALENT ACADEMY · CAMBRIDGE CEFR & BE WHOLE VALUES FRAMEWORK',
      W / 2,
      336
    );
  }

  // Ornamental divider line
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 340, 362);
  ctx.lineTo(W / 2 + 340, 362);
  ctx.stroke();

  // "This certificate is proudly presented to"
  ctx.fillStyle = palette.muted;
  ctx.font = '600 25px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    payload.lang === 'vi'
      ? 'Trân trọng chứng nhận và vinh danh học viên'
      : payload.lang === 'bi'
        ? 'This certificate is proudly presented to  •  Trân trọng vinh danh học viên'
        : 'This certificate is proudly presented to',
    W / 2,
    414
  );

  // 5. Optional Circular Student Photo (left of center) & LiLab Character Mascot (right of center)
  if (payload.showStudentPhoto && avatarImg) {
    const avR = 78;
    const avCx = 285;
    const avCy = 525;
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR + 7, 0, Math.PI * 2);
    ctx.fillStyle = palette.secondary;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const sScale = Math.max((avR * 2) / avatarImg.width, (avR * 2) / avatarImg.height);
    const dw = avatarImg.width * sScale;
    const dh = avatarImg.height * sScale;
    ctx.drawImage(avatarImg, avCx - dw / 2, avCy - dh / 2, dw, dh);
    ctx.restore();
  }

  if (mascotImg) {
    const mH = 195;
    const mW = (mascotImg.width / Math.max(1, mascotImg.height)) * mH;
    ctx.save();
    ctx.drawImage(mascotImg, W - 210 - mW / 2, 425, mW, mH);
    ctx.restore();
  }

  // 6. Student Name (Grand Display Centerpiece)
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.ink;
  ctx.font = '800 84px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
  let displayName = payload.studentName || 'LiLab Student';
  while (ctx.measureText(displayName).width > 1280 && displayName.length > 8) {
    displayName = displayName.slice(0, -2) + '…';
  }
  ctx.fillText(displayName, W / 2, 514);

  // Gold underline flourish beneath name
  const nameLineW = Math.min(920, Math.max(460, ctx.measureText(displayName).width + 90));
  ctx.strokeStyle = '#FFD41D';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(W / 2 - nameLineW / 2, 540);
  ctx.lineTo(W / 2 + nameLineW / 2, 540);
  ctx.stroke();

  // 7. CEFR Level Achieved & Date of Completion Credential Ribbon
  const ribbonW = 1480;
  const ribbonH = 104;
  const ribbonX = (W - ribbonW) / 2;
  const ribbonY = 572;
  const formattedCompletionDate = formatCompletionDate(payload.issueDate, payload.lang);

  drawRoundedRect(ctx, ribbonX, ribbonY, ribbonW, ribbonH, 20);
  ctx.fillStyle = palette.primary;
  ctx.fill();

  // Divider inside ribbon splitting CEFR Level Achieved (left) & Date of Completion (right)
  const splitX = ribbonX + Math.round(ribbonW * 0.64);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(splitX, ribbonY + 18);
  ctx.lineTo(splitX, ribbonY + ribbonH - 18);
  ctx.stroke();

  // Left side: CEFR Level Achieved
  const leftMidX = ribbonX + (splitX - ribbonX) / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD41D';
  ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    payload.lang === 'vi'
      ? 'TRÌNH ĐỘ CAMBRIDGE CEFR ĐẠT ĐƯỢC'
      : payload.lang === 'bi'
        ? 'CEFR LEVEL ACHIEVED  •  TRÌNH ĐỘ CEFR ĐẠT ĐƯỢC'
        : 'CAMBRIDGE CEFR LEVEL ACHIEVED',
    leftMidX,
    ribbonY + 34
  );
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 26px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${payload.metrics.cefrDisplay}  ·  ${payload.lang === 'vi' ? payload.metrics.pceCourse.titleVi : payload.metrics.pceCourse.titleEn}`,
    leftMidX,
    ribbonY + 74
  );

  // Right side: Date of Completion
  const rightMidX = splitX + (ribbonX + ribbonW - splitX) / 2;
  ctx.fillStyle = '#FFD41D';
  ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    payload.lang === 'vi'
      ? 'NGÀY HOÀN THÀNH'
      : payload.lang === 'bi'
        ? 'DATE OF COMPLETION  •  NGÀY HOÀN THÀNH'
        : 'DATE OF COMPLETION',
    rightMidX,
    ribbonY + 34
  );
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(formattedCompletionDate, rightMidX, ribbonY + 74);

  // Subtitle line beneath ribbon: Class · Term · Honor Tier
  ctx.fillStyle = palette.accent;
  ctx.font = '700 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${payload.className}  •  ${payload.termLabel}  •  ${
      payload.lang === 'vi'
        ? payload.metrics.honorTier.labelVi
        : payload.lang === 'bi'
          ? `${payload.metrics.honorTier.labelEn} / ${payload.metrics.honorTier.labelVi}`
          : payload.metrics.honorTier.labelEn
    }`,
    W / 2,
    ribbonY + ribbonH + 34
  );

  // 8. Citation / Achievement Narrative
  const citationText =
    payload.lang === 'vi'
      ? payload.citationVi || payload.citationEn
      : payload.lang === 'bi'
        ? [payload.citationEn, payload.citationVi].filter(Boolean).join(' — ')
        : payload.citationEn || payload.citationVi;

  ctx.fillStyle = palette.ink;
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  const citationLines = wrapTextLines(ctx, citationText, 1520, 3);
  let cyText = 748;
  for (const line of citationLines) {
    ctx.fillText(line, W / 2, cyText);
    cyText += 35;
  }

  // 9. 8-Skill Assessment Scorecard Strip (if enabled & scores exist)
  if (payload.showScores && payload.metrics.hasScores) {
    const stripW = 1620;
    const stripX = (W - stripW) / 2;
    const stripY = 858;
    const stripH = 228;

    drawRoundedRect(ctx, stripX, stripY, stripW, stripH, 22);
    ctx.fillStyle = palette.bgCanvas;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `${palette.primary}33`;
    ctx.stroke();

    // Summary KPIs row inside strip
    ctx.textAlign = 'left';
    ctx.fillStyle = palette.primary;
    ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
    ctx.fillText(
      payload.lang === 'vi'
        ? 'TỔNG HỢP ĐIỂM ĐÁNH GIÁ CAMBRIDGE CEFR & BE WHOLE (THANG 100)'
        : 'CAMBRIDGE CEFR & BE WHOLE ASSESSMENT SUMMARY (0–100)',
      stripX + 34,
      stripY + 42
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = palette.accent;
    ctx.font = '800 22px "JetBrains Mono", monospace';
    ctx.fillText(
      `ENGLISH ${payload.metrics.englishAvg}/100  •  WHOLE-CHILD ${payload.metrics.wholeChildAvg}/100  •  OVERALL ${payload.metrics.compositeScore}/100`,
      stripX + stripW - 34,
      stripY + 42
    );

    const skills = [
      { label: showEn ? 'Speaking' : 'Nói', val: payload.metrics.speaking, col: palette.primary },
      { label: showEn ? 'Reading' : 'Đọc', val: payload.metrics.reading, col: palette.primary },
      { label: showEn ? 'Writing' : 'Viết', val: payload.metrics.writing, col: palette.primary },
      { label: showEn ? 'Vocab' : 'Từ vựng', val: payload.metrics.vocabulary, col: palette.primary },
      { label: showEn ? 'Listening' : 'Nghe', val: payload.metrics.comprehension, col: palette.primary },
      { label: showEn ? 'Social' : 'Xã hội', val: payload.metrics.social, col: '#0F766E' },
      { label: showEn ? 'Emotional' : 'Cảm xúc', val: payload.metrics.emotional, col: '#0F766E' },
      { label: showEn ? 'Mental' : 'Tư duy', val: payload.metrics.mental, col: '#0F766E' },
    ];

    const cardGap = 16;
    const cardW = (stripW - 68 - cardGap * 7) / 8;
    const cardY = stripY + 68;
    const cardH = 132;

    skills.forEach((sk, idx) => {
      const sx = stripX + 34 + idx * (cardW + cardGap);
      drawRoundedRect(ctx, sx, cardY, cardW, cardH, 14);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#E2E8F0';
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = palette.muted;
      ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(sk.label, sx + cardW / 2, cardY + 34);

      ctx.fillStyle = sk.col;
      ctx.font = '800 38px "JetBrains Mono", monospace';
      ctx.fillText(String(sk.val), sx + cardW / 2, cardY + 86);

      // Mini progress bar
      const barW = cardW - 30;
      const barX = sx + 15;
      const barY = cardY + 104;
      drawRoundedRect(ctx, barX, barY, barW, 10, 5);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();

      drawRoundedRect(ctx, barX, barY, Math.max(8, (Math.min(100, sk.val) / 100) * barW), 10, 5);
      ctx.fillStyle = sk.col;
      ctx.fill();
    });
  } else {
    // Milestone highlight banner when scores are hidden or not yet published
    const boxW = 1380;
    const boxX = (W - boxW) / 2;
    const boxY = 890;
    drawRoundedRect(ctx, boxX, boxY, boxW, 145, 22);
    ctx.fillStyle = palette.bgCanvas;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `${palette.secondary}66`;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = palette.primary;
    ctx.font = '800 28px "Bricolage Grotesque", sans-serif';
    ctx.fillText(
      payload.lang === 'vi'
        ? `Lộ trình PCE-Kids: ${payload.metrics.pceCourse.titleVi} (${payload.metrics.pceCourse.cefrBand})`
        : `PCE-Kids Pathway: ${payload.metrics.pceCourse.titleEn} (${payload.metrics.pceCourse.cefrBand})`,
      W / 2,
      boxY + 58
    );
    ctx.fillStyle = palette.muted;
    ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(
      payload.lang === 'vi'
        ? 'A place to read deeply, think freely and create beautifully.'
        : 'A place to read deeply, think freely and create beautifully.',
      W / 2,
      boxY + 104
    );
  }

  // 10. Signature Block + Center Starburst Achievement Seal
  const footerY = 1338;
  const sigLineW = 460;

  // Left Signature: Lead Teacher
  const leftSigCx = 460;
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.primary;
  ctx.font = 'italic 700 38px "Georgia", serif';
  ctx.fillText(payload.teacherName || 'LiLab Faculty', leftSigCx, footerY - 22);

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(leftSigCx - sigLineW / 2, footerY);
  ctx.lineTo(leftSigCx + sigLineW / 2, footerY);
  ctx.stroke();

  ctx.fillStyle = palette.ink;
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(payload.teacherName || 'LiLab Faculty', leftSigCx, footerY + 34);
  ctx.fillStyle = palette.muted;
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    payload.lang === 'vi' ? 'Giáo viên Phụ trách Cambridge CEFR' : 'Lead Cambridge CEFR Teacher',
    leftSigCx,
    footerY + 62
  );

  // Center Embossed Achievement Seal
  drawStarburstSeal(
    ctx,
    W / 2,
    footerY - 38,
    118,
    98,
    22,
    palette.sealBg,
    palette.sealRing,
    showVi && !showEn ? payload.metrics.honorTier.shortSealVi : payload.metrics.honorTier.shortSealEn,
    payload.metrics.hasScores ? `${payload.metrics.compositeScore}%` : payload.metrics.cefrLevel.split(' ')[0],
    'LILAB SEAL'
  );

  // Right Signature: Academic Director
  const rightSigCx = W - 460;
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.primary;
  ctx.font = 'italic 700 38px "Georgia", serif';
  ctx.fillText(payload.directorName || 'LiLab Academic Board', rightSigCx, footerY - 22);

  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(rightSigCx - sigLineW / 2, footerY);
  ctx.lineTo(rightSigCx + sigLineW / 2, footerY);
  ctx.stroke();

  ctx.fillStyle = palette.ink;
  ctx.font = '800 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(payload.directorName || 'LiLab Academic Board', rightSigCx, footerY + 34);
  ctx.fillStyle = palette.muted;
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    payload.lang === 'vi' ? payload.directorTitleVi : payload.directorTitleEn,
    rightSigCx,
    footerY + 62
  );

  // Bottom verification bar
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.muted;
  ctx.font = '600 19px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${payload.lang === 'vi' ? 'Ngày hoàn thành' : 'Completed on'}: ${formattedCompletionDate}   •   LiLab Creative Talent Academy · ParcSpring, TP.HCM   •   ${payload.metrics.serialId}`,
    W / 2,
    H - 122
  );
  ctx.textAlign = 'left';

  return canvas;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildLandscapeA4PdfFromJpeg(
  jpegBytes: Uint8Array,
  widthPx: number,
  heightPx: number
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  const pushStr = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    currentOffset += bytes.length;
  };
  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };
  const startObj = (id: number) => {
    offsets[id] = currentOffset;
    pushStr(`${id} 0 obj\n`);
  };
  const endObj = () => pushStr(`\nendobj\n`);

  // Landscape A4 in points (841.89 x 595.28)
  const pageWidthPt = 841.89;
  const pageHeightPt = 595.28;

  pushStr(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  startObj(2);
  pushStr(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  endObj();

  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`
  );
  endObj();

  const contentStream = `q\n${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  startObj(4);
  pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr(`\nendstream`);
  endObj();

  startObj(5);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr(`\nendstream`);
  endObj();

  const xrefOffset = currentOffset;
  pushStr(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const merged = new Uint8Array(currentOffset);
  let pos = 0;
  for (const chunk of chunks) {
    merged.set(chunk, pos);
    pos += chunk.length;
  }
  return new Blob([merged], { type: 'application/pdf' });
}

function makeSlug(value: string): string {
  return (value || 'Student')
    .replace(/[^a-zA-Z0-9\u00C0-\u1EF9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function downloadCertificatePdf(payload: CertificateRenderPayload): Promise<void> {
  const canvas = await renderCertificateToCanvas(payload);
  const jpegBytes = dataUrlToUint8Array(canvas.toDataURL('image/jpeg', 0.95));
  const blob = buildLandscapeA4PdfFromJpeg(jpegBytes, canvas.width, canvas.height);
  const filename = `LiLab_Certificate_${makeSlug(payload.studentName)}_${makeSlug(payload.metrics.cefrDisplay)}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function downloadCertificatePng(payload: CertificateRenderPayload): Promise<void> {
  const canvas = await renderCertificateToCanvas(payload);
  const dataUrl = canvas.toDataURL('image/png');
  const filename = `LiLab_Certificate_${makeSlug(payload.studentName)}_${makeSlug(payload.metrics.cefrDisplay)}.png`;

  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

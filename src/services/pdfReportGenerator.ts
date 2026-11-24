import {
  formatCefrLabel,
  type CefrLevel,
  type CefrModifier,
  type LangCode,
  type StudentAssessment,
  type StudentProfile,
} from '../types';

export interface PrintableReportData {
  studentName: string;
  studentAge?: number;
  studentGender?: 'girl' | 'boy';
  studentPhotoUrl?: string;
  parentName?: string;
  parentEmail?: string;
  className: string;
  termLabel: string;
  teacherName: string;
  cefrLevel?: CefrLevel;
  cefrModifier?: CefrModifier;
  cefrDisplay: string;
  speakingScore: number;
  readingScore: number;
  writingScore: number;
  vocabularyScore: number;
  comprehensionScore: number;
  socialScore: number;
  emotionalScore: number;
  mentalScore: number;
  teacherCommentEn?: string;
  teacherCommentVi?: string;
  aiInsightEn?: string;
  aiInsightVi?: string;
  activitiesCompleted?: string[];
  lang: LangCode;
  comparisonBaseline?: {
    label: string;
    cefrDisplay: string;
    speaking: number;
    reading: number;
    writing: number;
    vocabulary: number;
    comprehension: number;
    social: number;
    emotional: number;
    mental: number;
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
  maxWidth: number
): string[] {
  if (!text || !text.trim()) return [];
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const words = trimmed.split(/\s+/);
    let currentLine = words[0] || '';
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = `${currentLine} ${word}`;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }
  return lines;
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

function buildMultiPageJpegPdf(
  pages: Array<{ jpegBytes: Uint8Array; widthPx: number; heightPx: number }>
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

  const endObj = () => {
    pushStr(`\nendobj\n`);
  };

  // PDF Header
  pushStr(`%PDF-1.4\n%\xFF\xFF\xFF\xFF\n`);

  // Object 1: Catalog
  startObj(1);
  pushStr(`<< /Type /Catalog /Pages 2 0 R >>`);
  endObj();

  // Each page uses 3 objects: Page (3 + i*3), Content (4 + i*3), Image XObject (5 + i*3)
  const pageObjIds = pages.map((_, idx) => 3 + idx * 3);

  // Object 2: Pages
  startObj(2);
  pushStr(
    `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  );
  endObj();

  const pageWidthPt = 595.28;
  const pageHeightPt = 841.89;

  pages.forEach((p, idx) => {
    const pageObjId = 3 + idx * 3;
    const contentObjId = 4 + idx * 3;
    const imgObjId = 5 + idx * 3;
    const imgName = `/Im${idx}`;

    // Page Object
    startObj(pageObjId);
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << ${imgName} ${imgObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`
    );
    endObj();

    // Content Stream Object
    const contentStream = `q\n${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm\n${imgName} Do\nQ\n`;
    const contentBytes = encoder.encode(contentStream);
    startObj(contentObjId);
    pushStr(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushStr(`\nendstream`);
    endObj();

    // Image XObject
    startObj(imgObjId);
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(p.jpegBytes);
    pushStr(`\nendstream`);
    endObj();
  });

  const totalObjects = 2 + pages.length * 3;
  const xrefOffset = currentOffset;

  pushStr(`xref\n0 ${totalObjects + 1}\n`);
  pushStr(`0000000000 65535 f \n`);
  for (let i = 1; i <= totalObjects; i++) {
    const off = String(offsets[i] || 0).padStart(10, '0');
    pushStr(`${off} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const merged = new Uint8Array(currentOffset);
  let pos = 0;
  for (const chunk of chunks) {
    merged.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([merged], { type: 'application/pdf' });
}

export async function exportStudentReportPdf(
  data: PrintableReportData,
  options: { alsoTriggerBrowserPrint?: boolean } = { alsoTriggerBrowserPrint: false }
): Promise<void> {
  const PAGE_W = 1654; // A4 @ 200 DPI
  const PAGE_H = 2339;
  const MARGIN = 72;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  const createPageCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    return { canvas, ctx };
  };

  // Load avatar & logo
  const fallbackAvatar =
    data.studentGender === 'boy' ? '/assets/lila_boy.png' : '/assets/lila_girl.png';
  const [avatarImg, fallbackImg, logoImg] = await Promise.all([
    data.studentPhotoUrl ? loadImage(data.studentPhotoUrl) : Promise.resolve(null),
    loadImage(fallbackAvatar),
    loadImage('/assets/lilab_logo.png'),
  ]);
  const studentImg = avatarImg || fallbackImg;

  const { canvas: page1, ctx } = createPageCanvas();

  // Top decorative bar
  ctx.fillStyle = '#2D3E99';
  ctx.fillRect(0, 0, PAGE_W, 20);
  ctx.fillStyle = '#FFD41D';
  ctx.fillRect(PAGE_W * 0.6, 0, PAGE_W * 0.2, 20);
  ctx.fillStyle = '#E61E64';
  ctx.fillRect(PAGE_W * 0.8, 0, PAGE_W * 0.2, 20);

  let y = 52;

  // Academy Header Row
  if (logoImg) {
    const logoH = 58;
    const logoW = (logoImg.width / Math.max(1, logoImg.height)) * logoH;
    ctx.drawImage(logoImg, MARGIN, y, logoW, logoH);
  } else {
    ctx.fillStyle = '#2D3E99';
    ctx.font = '800 34px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
    ctx.fillText('LiLab Creative Talent Academy', MARGIN, y + 40);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#E61E64';
  ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    data.lang === 'vi'
      ? 'BÁO CÁO ĐÁNH GIÁ HỌC VIÊN CAMBRIDGE CEFR & BE WHOLE'
      : 'OFFICIAL CAMBRIDGE CEFR & BE WHOLE PROGRESS REPORT',
    PAGE_W - MARGIN,
    y + 24
  );
  ctx.fillStyle = '#475569';
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `${data.className}  •  ${data.termLabel}  •  Teacher: ${data.teacherName}`,
    PAGE_W - MARGIN,
    y + 52
  );
  ctx.textAlign = 'left';

  y += 82;

  // Student Hero Banner Card (Extra-large circular student photo + Extra-large student name)
  const heroH = 250;
  drawRoundedRect(ctx, MARGIN, y, CONTENT_W, heroH, 28);
  ctx.fillStyle = '#FDF9EE';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2D3E99';
  ctx.stroke();

  // Large Circular Student Photo (diameter 196px)
  const avatarR = 98;
  const avatarCx = MARGIN + 36 + avatarR;
  const avatarCy = y + heroH / 2;

  // Outer decorative ring
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR + 6, 0, Math.PI * 2);
  ctx.fillStyle = '#2D3E99';
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarCx, avatarCy, avatarR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);

  if (studentImg) {
    const imgW = studentImg.width || 200;
    const imgH = studentImg.height || 200;
    const scale = Math.max((avatarR * 2) / imgW, (avatarR * 2) / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    ctx.drawImage(studentImg, avatarCx - drawW / 2, avatarCy - drawH / 2, drawW, drawH);
  } else {
    ctx.fillStyle = '#2D3E99';
    ctx.fillRect(avatarCx - avatarR, avatarCy - avatarR, avatarR * 2, avatarR * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 68px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = (data.studentName || 'L')
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    ctx.fillText(initials, avatarCx, avatarCy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // Student Name & Details (Much bigger font as requested)
  const textStartX = avatarCx + avatarR + 38;
  ctx.fillStyle = '#E61E64';
  ctx.font = '800 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    data.lang === 'vi'
      ? 'HỒ SƠ HỌC VIÊN LILAB ACADEMY'
      : 'LILAB CREATIVE TALENT ACADEMY STUDENT',
    textStartX,
    y + 56
  );

  // Student Name in very large 54px extra-bold font
  ctx.fillStyle = '#2D3E99';
  ctx.font = '800 54px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
  const maxNameWidth = CONTENT_W - (textStartX - MARGIN) - 340;
  let displayStudentName = data.studentName || 'LiLab Student';
  while (
    ctx.measureText(displayStudentName).width > maxNameWidth &&
    displayStudentName.length > 8
  ) {
    displayStudentName = displayStudentName.slice(0, -2) + '…';
  }
  ctx.fillText(displayStudentName, textStartX, y + 122);

  // Subtitle details
  ctx.fillStyle = '#172154';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  const metaParts: string[] = [];
  if (data.studentAge) metaParts.push(`${data.studentAge} yrs old`);
  if (data.parentName) metaParts.push(`Parent: ${data.parentName}`);
  metaParts.push(`${data.className} (${data.termLabel})`);
  ctx.fillText(metaParts.join('  •  '), textStartX, y + 168);

  const engAvg = Math.round(
    (data.speakingScore +
      data.readingScore +
      data.writingScore +
      data.vocabularyScore +
      data.comprehensionScore) /
      5
  );
  const wholeAvg = Math.round(
    (data.socialScore + data.emotionalScore + data.mentalScore) / 3
  );

  ctx.fillStyle = '#0F766E';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    `English Avg: ${engAvg}/100   •   Whole-Child Avg: ${wholeAvg}/100   •   Composite: ${Math.round(
      (engAvg + wholeAvg) / 2
    )}/100`,
    textStartX,
    y + 208
  );

  // Right-side Cambridge CEFR Badge inside Hero Card
  const badgeW = 300;
  const badgeH = 140;
  const badgeX = MARGIN + CONTENT_W - badgeW - 32;
  const badgeY = y + (heroH - badgeH) / 2;
  drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 22);
  ctx.fillStyle = '#2D3E99';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD41D';
  ctx.font = '700 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('CAMBRIDGE CEFR LEVEL', badgeX + badgeW / 2, badgeY + 42);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 34px "JetBrains Mono", "Plus Jakarta Sans", sans-serif';
  ctx.fillText(data.cefrDisplay || 'Pre-A1', badgeX + badgeW / 2, badgeY + 95);
  ctx.textAlign = 'left';

  y += heroH + 34;

  // ============================================================================
  // VISUAL ANALYTICS ROW: 1. Radial Spider Map | 2. Quadrant Matrix | 3. Bar Graph
  // ============================================================================
  const chartBoxH = 510;
  const chartGap = 24;
  const chartW = (CONTENT_W - chartGap * 2) / 3;

  // --- CHART 1: 8-AXIS RADIAL SPIDER MAP ---
  const c1X = MARGIN;
  drawRoundedRect(ctx, c1X, y, chartW, chartBoxH, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#CBD5E1';
  ctx.stroke();

  ctx.fillStyle = '#2D3E99';
  ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
  ctx.fillText('1. 8-Axis Radial Map', c1X + 24, y + 40);
  ctx.fillStyle = '#64748B';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Cambridge English & Be Whole', c1X + 24, y + 66);

  const radarCx = c1X + chartW / 2;
  const radarCy = y + 290;
  const radarR = 138;
  const axes = [
    { label: 'Speaking', score: data.speakingScore },
    { label: 'Reading', score: data.readingScore },
    { label: 'Writing', score: data.writingScore },
    { label: 'Vocab', score: data.vocabularyScore },
    { label: 'Listening', score: data.comprehensionScore },
    { label: 'Social', score: data.socialScore },
    { label: 'Emotional', score: data.emotionalScore },
    { label: 'Mental', score: data.mentalScore },
  ];

  // Concentric octagons
  [0.25, 0.5, 0.75, 1].forEach((ring) => {
    ctx.beginPath();
    axes.forEach((_, idx) => {
      const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length;
      const px = radarCx + Math.cos(angle) * radarR * ring;
      const py = radarCy + Math.sin(angle) * radarR * ring;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.strokeStyle = ring === 1 ? '#94A3B8' : '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Axis spokes & labels
  axes.forEach((ax, idx) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length;
    const ox = radarCx + Math.cos(angle) * radarR;
    const oy = radarCy + Math.sin(angle) * radarR;
    ctx.beginPath();
    ctx.moveTo(radarCx, radarCy);
    ctx.lineTo(ox, oy);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const lx = radarCx + Math.cos(angle) * (radarR + 34);
    const ly = radarCy + Math.sin(angle) * (radarR + 28);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#172154';
    ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${ax.label}`, lx, ly - 4);
    ctx.fillStyle = '#E61E64';
    ctx.font = '800 15px "JetBrains Mono", sans-serif';
    ctx.fillText(`${ax.score}`, lx, ly + 14);
  });
  ctx.textAlign = 'left';

  // Data polygon
  ctx.beginPath();
  axes.forEach((ax, idx) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length;
    const norm = Math.max(0.05, Math.min(1, ax.score / 100));
    const px = radarCx + Math.cos(angle) * radarR * norm;
    const py = radarCy + Math.sin(angle) * radarR * norm;
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(230, 30, 100, 0.20)';
  ctx.fill();
  ctx.strokeStyle = '#E61E64';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  axes.forEach((ax, idx) => {
    const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length;
    const norm = Math.max(0.05, Math.min(1, ax.score / 100));
    const px = radarCx + Math.cos(angle) * radarR * norm;
    const py = radarCy + Math.sin(angle) * radarR * norm;
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2D3E99';
    ctx.fill();
  });

  // --- CHART 2: WHOLE-CHILD 4-QUADRANT MATRIX ---
  const c2X = MARGIN + chartW + chartGap;
  drawRoundedRect(ctx, c2X, y, chartW, chartBoxH, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#CBD5E1';
  ctx.stroke();

  ctx.fillStyle = '#2D3E99';
  ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
  ctx.fillText('2. Whole-Child Quadrant', c2X + 24, y + 40);
  ctx.fillStyle = '#64748B';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`X: English (${engAvg}%) · Y: Wellbeing (${wholeAvg}%)`, c2X + 24, y + 66);

  const qPad = 48;
  const qSize = chartW - qPad * 2;
  const qX = c2X + qPad;
  const qY = y + 96;

  // 4 Quadrant backgrounds
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(qX, qY, qSize / 2, qSize / 2);
  ctx.fillStyle = '#F0FDFA';
  ctx.fillRect(qX + qSize / 2, qY, qSize / 2, qSize / 2);
  ctx.fillStyle = '#FFFBEB';
  ctx.fillRect(qX, qY + qSize / 2, qSize / 2, qSize / 2);
  ctx.fillStyle = '#FDF2F8';
  ctx.fillRect(qX + qSize / 2, qY + qSize / 2, qSize / 2, qSize / 2);

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 2;
  ctx.strokeRect(qX, qY, qSize, qSize);

  // Midlines
  ctx.beginPath();
  ctx.setLineDash([6, 6]);
  ctx.moveTo(qX + qSize / 2, qY);
  ctx.lineTo(qX + qSize / 2, qY + qSize);
  ctx.moveTo(qX, qY + qSize / 2);
  ctx.lineTo(qX + qSize, qY + qSize / 2);
  ctx.strokeStyle = '#64748B';
  ctx.stroke();
  ctx.setLineDash([]);

  // Quadrant titles
  ctx.font = '700 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#0F766E';
  ctx.fillText('Wholehearted Leader', qX + qSize / 2 + 12, qY + 26);
  ctx.fillStyle = '#475569';
  ctx.fillText('Caring Heart', qX + 12, qY + 26);
  ctx.fillStyle = '#B45309';
  ctx.fillText('Emerging Explorer', qX + 12, qY + qSize - 14);
  ctx.fillStyle = '#BE185D';
  ctx.fillText('Fluent Scholar', qX + qSize / 2 + 12, qY + qSize - 14);

  // Plot student dot
  const dotX = qX + (Math.max(0, Math.min(100, engAvg)) / 100) * qSize;
  const dotY = qY + ((100 - Math.max(0, Math.min(100, wholeAvg))) / 100) * qSize;

  ctx.beginPath();
  ctx.arc(dotX, dotY, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(230, 30, 100, 0.22)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#E61E64';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#172154';
  ctx.font = '800 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`(${engAvg}, ${wholeAvg})`, dotX, dotY - 22);
  ctx.textAlign = 'left';

  // --- CHART 3: 8-SKILL HORIZONTAL BAR GRAPH ---
  const c3X = MARGIN + (chartW + chartGap) * 2;
  drawRoundedRect(ctx, c3X, y, chartW, chartBoxH, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#CBD5E1';
  ctx.stroke();

  ctx.fillStyle = '#2D3E99';
  ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
  ctx.fillText('3. Skill & Value Scores', c3X + 24, y + 40);
  ctx.fillStyle = '#64748B';
  ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Cambridge CEFR & Wellbeing (0–100)', c3X + 24, y + 66);

  const barStartY = y + 100;
  const barRowH = 48;
  const barTrackX = c3X + 140;
  const barTrackW = chartW - 215;

  axes.forEach((ax, idx) => {
    const rowY = barStartY + idx * barRowH;
    const isWellbeing = idx >= 5;
    ctx.fillStyle = '#172154';
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(ax.label, c3X + 24, rowY + 20);

    // Track
    drawRoundedRect(ctx, barTrackX, rowY + 4, barTrackW, 22, 11);
    ctx.fillStyle = '#F1F5F9';
    ctx.fill();

    // Fill
    const fillW = Math.max(12, (Math.max(0, Math.min(100, ax.score)) / 100) * barTrackW);
    drawRoundedRect(ctx, barTrackX, rowY + 4, fillW, 22, 11);
    ctx.fillStyle = isWellbeing ? '#0D9488' : idx % 2 === 0 ? '#2D3E99' : '#E61E64';
    ctx.fill();

    // Score text
    ctx.textAlign = 'right';
    ctx.fillStyle = '#172154';
    ctx.font = '800 16px "JetBrains Mono", sans-serif';
    ctx.fillText(`${ax.score}`, c3X + chartW - 20, rowY + 21);
    ctx.textAlign = 'left';
  });

  y += chartBoxH + 36;

  // ============================================================================
  // TEACHER'S NARRATIVE & AI HOLISTIC INSIGHT (MUCH BIGGER FONTS FOR READING)
  // ============================================================================
  const pagesList: HTMLCanvasElement[] = [page1];
  let activeCtx = ctx;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > PAGE_H - 90) {
      const next = createPageCanvas();
      // Top mini-header on continuation page
      next.ctx.fillStyle = '#2D3E99';
      next.ctx.fillRect(0, 0, PAGE_W, 16);
      next.ctx.fillStyle = '#2D3E99';
      next.ctx.font = '800 26px "Bricolage Grotesque", sans-serif';
      next.ctx.fillText(
        `${data.studentName} — ${data.className} (${data.termLabel})`,
        MARGIN,
        64
      );
      next.ctx.fillStyle = '#E61E64';
      next.ctx.textAlign = 'right';
      next.ctx.font = '700 22px "JetBrains Mono", sans-serif';
      next.ctx.fillText(data.cefrDisplay, PAGE_W - MARGIN, 64);
      next.ctx.textAlign = 'left';
      pagesList.push(next.canvas);
      activeCtx = next.ctx;
      y = 96;
    }
  };

  const renderNarrativeBlock = (
    title: string,
    paragraphs: string[],
    bgColor: string,
    borderColor: string,
    titleColor: string
  ) => {
    const cleanParas = paragraphs.map((p) => (p || '').trim()).filter(Boolean);
    if (cleanParas.length === 0) return;

    const padX = 38;
    const padY = 34;
    const textMaxW = CONTENT_W - padX * 2;
    const bodyFont = '500 26px "Plus Jakarta Sans", sans-serif';
    const lineHeight = 39;

    activeCtx.font = bodyFont;
    const allLines: string[] = [];
    cleanParas.forEach((p, idx) => {
      const wrapped = wrapTextLines(activeCtx, p, textMaxW);
      allLines.push(...wrapped);
      if (idx < cleanParas.length - 1) {
        allLines.push('');
      }
    });

    const boxH = padY * 2 + 48 + allLines.length * lineHeight;
    ensureSpace(boxH);

    drawRoundedRect(activeCtx, MARGIN, y, CONTENT_W, boxH, 24);
    activeCtx.fillStyle = bgColor;
    activeCtx.fill();
    activeCtx.lineWidth = 3;
    activeCtx.strokeStyle = borderColor;
    activeCtx.stroke();

    activeCtx.fillStyle = titleColor;
    activeCtx.font = '800 30px "Bricolage Grotesque", "Plus Jakarta Sans", sans-serif';
    activeCtx.fillText(title, MARGIN + padX, y + padY + 26);

    activeCtx.fillStyle = '#172154';
    activeCtx.font = bodyFont;
    let textY = y + padY + 76;
    for (const line of allLines) {
      if (line) {
        activeCtx.fillText(line, MARGIN + padX, textY);
      }
      textY += lineHeight;
    }

    y += boxH + 28;
  };

  const teacherParas = [
    data.teacherCommentEn || '',
    data.teacherCommentVi || '',
  ].filter(Boolean);

  if (teacherParas.length === 0) {
    teacherParas.push(
      data.lang === 'vi'
        ? `Học viên ${data.studentName} tham gia tích cực vào các hoạt động tiếng Anh Cambridge CEFR (${data.cefrDisplay}) và chương trình Giá trị Sống Be Whole.`
        : `${data.studentName} demonstrates steady engagement across Cambridge CEFR (${data.cefrDisplay}) language skills and Be Whole character values.`
    );
  }

  renderNarrativeBlock(
    `Teacher Narrative · Nhận xét Giáo viên (${data.teacherName})`,
    teacherParas,
    '#FDF9EE',
    '#2D3E99',
    '#2D3E99'
  );

  const aiParas = [data.aiInsightEn || '', data.aiInsightVi || ''].filter(Boolean);
  if (data.activitiesCompleted && data.activitiesCompleted.length > 0) {
    aiParas.push(`Completed Activities: ${data.activitiesCompleted.join(' • ')}`);
  }

  if (aiParas.length > 0) {
    renderNarrativeBlock(
      'AI Holistic Insight · Phân tích Toàn diện AI',
      aiParas,
      '#F0FDFA',
      '#0D9488',
      '#172154'
    );
  }

  // Footer on each page
  pagesList.forEach((canvasPage, idx) => {
    const pCtx = canvasPage.getContext('2d')!;
    pCtx.fillStyle = '#64748B';
    pCtx.font = '600 17px "Plus Jakarta Sans", sans-serif';
    pCtx.fillText(
      `© ${new Date().getFullYear()} LiLab Creative Talent Academy · Official Cambridge CEFR & Be Whole Student Report`,
      MARGIN,
      PAGE_H - 34
    );
    pCtx.textAlign = 'right';
    pCtx.fillText(
      `Page ${idx + 1} of ${pagesList.length}`,
      PAGE_W - MARGIN,
      PAGE_H - 34
    );
    pCtx.textAlign = 'left';
  });

  // Pack pages into valid PDF blob and trigger download
  const encodedPages = pagesList.map((c) => ({
    jpegBytes: dataUrlToUint8Array(c.toDataURL('image/jpeg', 0.94)),
    widthPx: c.width,
    heightPx: c.height,
  }));

  const pdfBlob = buildMultiPageJpegPdf(encodedPages);
  const safeStudentSlug = (data.studentName || 'Student')
    .replace(/[^a-zA-Z0-9\u00C0-\u1EF9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const filename = `LiLab_Report_${safeStudentSlug || 'Student'}.pdf`;

  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  if (options.alsoTriggerBrowserPrint) {
    try {
      window.print();
    } catch {
      // Ignored in sandboxed iframe environments
    }
  }
}

export function buildPrintableReportFromAssessment(
  assessment: StudentAssessment,
  student: StudentProfile | null | undefined,
  lang: LangCode
): PrintableReportData {
  return {
    studentName: assessment.studentName || student?.fullName || 'LiLab Student',
    studentAge: student?.age,
    studentGender: student?.gender,
    studentPhotoUrl: student?.photoUrl,
    parentName: student?.parentName,
    parentEmail: assessment.parentEmail || student?.parentEmail,
    className: assessment.className || 'Be Whole Class',
    termLabel: assessment.termLabel || 'Current Term',
    teacherName: assessment.teacherName || 'LiLab Faculty',
    cefrLevel: assessment.cefrLevel,
    cefrModifier: assessment.cefrModifier,
    cefrDisplay: formatCefrLabel(assessment.cefrLevel, assessment.cefrModifier),
    speakingScore: assessment.speakingScore ?? 0,
    readingScore: assessment.readingScore ?? 0,
    writingScore: assessment.writingScore ?? 0,
    vocabularyScore: assessment.vocabularyScore ?? 0,
    comprehensionScore: assessment.comprehensionScore ?? 0,
    socialScore: assessment.socialScore ?? 0,
    emotionalScore: assessment.emotionalScore ?? 0,
    mentalScore: assessment.mentalScore ?? 0,
    teacherCommentEn: assessment.teacherCommentEn,
    teacherCommentVi: assessment.teacherCommentVi,
    aiInsightEn: assessment.aiInsightEn,
    aiInsightVi: assessment.aiInsightVi,
    activitiesCompleted: assessment.activitiesCompleted,
    lang,
  };
}

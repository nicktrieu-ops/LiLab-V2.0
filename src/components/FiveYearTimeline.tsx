import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Award, BookOpen, CheckCircle2, Flag, Play, Sparkles } from 'lucide-react';
import { biText } from '../i18n';
import {
  formatCefrLabel,
  type CefrLevel,
  type LangCode,
  type ProgramCourse,
  type StudentAssessment,
  type StudentProfile,
} from '../types';

export interface ProposedCourseItem {
  code: string;
  titleEn: string;
  titleVi: string;
  weeksLabel: string;
  focusEn: string;
  focusVi: string;
}

export interface TimelineYearMilestone {
  yearIndex: 1 | 2 | 3 | 4 | 5;
  yearLabelEn: string;
  yearLabelVi: string;
  stageTitleEn: string;
  stageTitleVi: string;
  targetCefr: CefrLevel;
  targetCefrLabel: string;
  ageRangeVi: string;
  ageRangeEn: string;
  badgeBgClass: string;
  englishPercent: number;
  wholeChildPercent: number;
  milestonesVi: string[];
  milestonesEn: string[];
  outcomeEn: string;
  outcomeVi: string;
  courses: ProposedCourseItem[];
  accentColor: string;
}

// 5 Custom Multi-Layered Cute Animated SVG Illustrations strictly centered in viewBox="0 0 220 220" (cx=110, cy=110, r=98)
const LEVEL_ILLUSTRATIONS_SVG: string[] = [
  // Năm 1: Pre-A1 (Starters) - ABC blocks upper-left, little schoolhouse upper-right, happy waving student & 1-2-3 pill centered below
  `<svg viewBox="0 0 220 220" class="w-[220px] h-[220px] mx-auto drop-shadow-sm overflow-visible">
    <defs>
      <linearGradient id="y1Bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFF3CD"/>
        <stop offset="100%" stop-color="#FCE4EC"/>
      </linearGradient>
    </defs>
    <circle cx="110" cy="110" r="98" fill="url(#y1Bg)" stroke="#FBCFE8" stroke-width="1.5"/>
    <g class="svg-float">
      <rect x="48" y="34" width="22" height="22" rx="6" fill="#FFC107"/>
      <text x="59" y="49" text-anchor="middle" fill="#1E255E" font-weight="900" font-size="12">A</text>
      <rect x="36" y="58" width="22" height="22" rx="6" fill="#1E255E"/>
      <text x="47" y="73" text-anchor="middle" fill="#FFC107" font-weight="900" font-size="12">B</text>
      <rect x="60" y="58" width="22" height="22" rx="6" fill="#E91E63"/>
      <text x="71" y="73" text-anchor="middle" fill="#FFFFFF" font-weight="900" font-size="12">C</text>
    </g>
    <g class="svg-float-alt">
      <polygon points="154,34 130,52 178,52" fill="#E91E63"/>
      <rect x="135" y="52" width="38" height="28" rx="4" fill="#FFFFFF" stroke="#1E255E" stroke-width="2"/>
      <rect x="149" y="63" width="10" height="17" rx="2" fill="#FFC107"/>
      <circle cx="154" cy="45" r="3" fill="#FFC107"/>
    </g>
    <polygon class="svg-sparkle" points="110,20 112,26 118,26 113,29 115,35 110,31 105,35 107,29 102,26 108,26" fill="#FFC107"/>
    <g>
      <rect x="88" y="138" width="44" height="34" rx="14" fill="#E91E63"/>
      <path d="M99 138 L110 149 L121 138 Z" fill="#FFFFFF"/>
      <path d="M89 144 Q73 135 76 121" stroke="#FFE0BD" stroke-width="8" stroke-linecap="round" fill="none"/>
      <circle cx="76" cy="119" r="5.5" fill="#FFE0BD"/>
      <path d="M131 144 Q142 152 140 162" stroke="#FFE0BD" stroke-width="8" stroke-linecap="round" fill="none"/>
      <circle cx="87" cy="105" r="8" fill="#1E255E"/>
      <circle cx="133" cy="105" r="8" fill="#1E255E"/>
      <circle cx="110" cy="114" r="22" fill="#FFE0BD"/>
      <path d="M88 112 C88 92, 132 92, 132 112 C126 100, 94 100, 88 112 Z" fill="#1E255E"/>
      <circle cx="103" cy="114" r="2.4" fill="#1E255E"/>
      <circle cx="117" cy="114" r="2.4" fill="#1E255E"/>
      <circle cx="103.8" cy="113.2" r="0.9" fill="#FFFFFF"/>
      <circle cx="117.8" cy="113.2" r="0.9" fill="#FFFFFF"/>
      <ellipse cx="98" cy="119" rx="3.5" ry="2" fill="#FF8A9E" opacity="0.75"/>
      <ellipse cx="122" cy="119" rx="3.5" ry="2" fill="#FF8A9E" opacity="0.75"/>
      <path d="M105 121 Q110 126 115 121" stroke="#E91E63" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </g>
    <g>
      <rect x="78" y="176" width="64" height="20" rx="10" fill="#FFFFFF" stroke="#1E255E" stroke-width="2"/>
      <text x="110" y="189.5" text-anchor="middle" fill="#1E255E" font-weight="900" font-size="10.5">1 · 2 · 3</text>
    </g>
  </svg>`,

  // Năm 2: A1 (Movers) - A2 (Flyers) - Analog clock upper-left, pink "S-V-O" speech bubble upper-right, cute orange cat with glasses reading open book center-bottom
  `<svg viewBox="0 0 220 220" class="w-[220px] h-[220px] mx-auto drop-shadow-sm overflow-visible">
    <circle cx="110" cy="110" r="98" fill="#E8EAF6" stroke="#C7D2FE" stroke-width="1.5"/>
    <g class="svg-float-alt">
      <circle cx="62" cy="54" r="18" fill="#FFFFFF" stroke="#1E255E" stroke-width="2.8"/>
      <circle cx="62" cy="54" r="13.5" fill="#FFF8E1"/>
      <path d="M62 54 L62 45 M62 54 L69 54" stroke="#E91E63" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="62" cy="54" r="2" fill="#1E255E"/>
    </g>
    <g class="svg-float">
      <rect x="116" y="40" width="66" height="25" rx="12.5" fill="#E91E63"/>
      <polygon points="134,65 143,65 132,73" fill="#E91E63"/>
      <text x="149" y="56" text-anchor="middle" fill="#FFFFFF" font-weight="900" font-size="10.5">S - V - O</text>
    </g>
    <g>
      <path d="M86 98 L81 78 L100 88 Z" fill="#FFB300"/>
      <path d="M134 98 L139 78 L120 88 Z" fill="#FFB300"/>
      <path d="M88 95 L85 83 L97 90 Z" fill="#FF8A9E"/>
      <path d="M132 95 L135 83 L123 90 Z" fill="#FF8A9E"/>
      <rect x="88" y="122" width="44" height="38" rx="18" fill="#FFC107"/>
      <ellipse cx="110" cy="142" rx="12" ry="14" fill="#FFF8E1"/>
      <circle cx="110" cy="105" r="22" fill="#FFC107"/>
      <circle cx="101.5" cy="104" r="7" fill="#FFFFFF" fill-opacity="0.45" stroke="#1E255E" stroke-width="2"/>
      <circle cx="118.5" cy="104" r="7" fill="#FFFFFF" fill-opacity="0.45" stroke="#1E255E" stroke-width="2"/>
      <line x1="108.5" y1="104" x2="111.5" y2="104" stroke="#1E255E" stroke-width="2"/>
      <circle cx="101.5" cy="104" r="2.3" fill="#1E255E"/>
      <circle cx="118.5" cy="104" r="2.3" fill="#1E255E"/>
      <circle cx="102.3" cy="103.2" r="0.8" fill="#FFFFFF"/>
      <circle cx="119.3" cy="103.2" r="0.8" fill="#FFFFFF"/>
      <polygon points="107.5,110 112.5,110 110,113" fill="#E91E63"/>
      <path d="M105 115 Q110 118 110 113 Q110 118 115 115" stroke="#1E255E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <line x1="82" y1="106" x2="92" y2="108" stroke="#1E255E" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="128" y1="108" x2="138" y2="106" stroke="#1E255E" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M72 152 Q100 144 110 155 Q120 144 148 152 L148 186 Q120 178 110 189 Q100 178 72 186 Z" fill="#FFFFFF" stroke="#1E255E" stroke-width="2.5"/>
      <line x1="110" y1="155" x2="110" y2="189" stroke="#E91E63" stroke-width="2.5"/>
      <line x1="81" y1="162" x2="102" y2="160" stroke="#FFC107" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="81" y1="171" x2="102" y2="169" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      <line x1="118" y1="160" x2="139" y2="162" stroke="#E91E63" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="118" y1="169" x2="139" y2="171" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
    </g>
  </svg>`,

  // Năm 3: B1 (PET) - B2 (FCE) - Smiling blue Earth globe + mini open book upper-left, glowing lightbulb upper-right, young speaker at B2 podium centered at bottom
  `<svg viewBox="0 0 220 220" class="w-[220px] h-[220px] mx-auto drop-shadow-sm overflow-visible">
    <circle cx="110" cy="110" r="98" fill="#FCE4EC" stroke="#FBCFE8" stroke-width="1.5"/>
    <g class="svg-float">
      <circle cx="64" cy="58" r="21" fill="#38BDF8" stroke="#1E255E" stroke-width="2.4"/>
      <path d="M53 47 Q61 43 65 51 T56 64 Q49 58 53 47 Z" fill="#4ADE80"/>
      <path d="M71 55 Q79 54 78 65 Q70 70 68 61 Z" fill="#4ADE80"/>
      <circle cx="59" cy="56" r="1.8" fill="#1E255E"/>
      <circle cx="70" cy="56" r="1.8" fill="#1E255E"/>
      <path d="M62 61 Q64.5 64 67 61" stroke="#1E255E" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M46 82 Q60 77 64 83 Q68 77 82 82 L82 94 Q68 89 64 95 Q60 89 46 94 Z" fill="#FFFFFF" stroke="#1E255E" stroke-width="1.8"/>
    </g>
    <g class="svg-float-alt">
      <circle cx="154" cy="56" r="20" fill="#FFC107"/>
      <path d="M147 57 C147 48, 161 48, 161 57 C161 61, 158 63, 158 66 H150 C150 63, 147 61, 147 57 Z" fill="#FFFFFF"/>
      <rect x="150.5" y="67.5" width="7" height="3.5" rx="1.5" fill="#1E255E"/>
      <line x1="154" y1="30" x2="154" y2="33" stroke="#E91E63" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="176" y1="44" x2="179" y2="42" stroke="#E91E63" stroke-width="2.2" stroke-linecap="round"/>
      <line x1="132" y1="44" x2="129" y2="42" stroke="#E91E63" stroke-width="2.2" stroke-linecap="round"/>
    </g>
    <g>
      <circle cx="110" cy="116" r="17" fill="#FFE0BD"/>
      <path d="M93 114 C93 98, 127 98, 127 114 C121 105, 99 105, 93 114 Z" fill="#1E255E"/>
      <circle cx="104.5" cy="116" r="2" fill="#1E255E"/>
      <circle cx="115.5" cy="116" r="2" fill="#1E255E"/>
      <path d="M106 122 Q110 126 114 122" stroke="#E91E63" stroke-width="2" fill="none" stroke-linecap="round"/>
      <rect x="92" y="133" width="36" height="14" rx="7" fill="#3B82F6"/>
      <line x1="97" y1="142" x2="102" y2="131" stroke="#1E255E" stroke-width="2"/>
      <circle cx="102.5" cy="130" r="2.5" fill="#E91E63"/>
      <rect x="82" y="141" width="56" height="8" rx="4" fill="#FFC107"/>
      <rect x="87" y="149" width="46" height="40" rx="7" fill="#1E255E"/>
      <circle cx="110" cy="169" r="10" fill="#E91E63"/>
      <text x="110" y="172.5" text-anchor="middle" fill="#FFFFFF" font-weight="900" font-size="9.5">B2</text>
    </g>
  </svg>`,

  // Năm 4: C1 (CAE) - Classic academic building/columns upper-left, rising bar chart whiteboard upper-right, "CAE • C1" badge + scholar centered at bottom
  `<svg viewBox="0 0 220 220" class="w-[220px] h-[220px] mx-auto drop-shadow-sm overflow-visible">
    <circle cx="110" cy="110" r="98" fill="#EDE9FE" stroke="#DDD6FE" stroke-width="1.5"/>
    <g class="svg-float-alt">
      <polygon points="64,34 38,49 90,49" fill="#E91E63"/>
      <rect x="42" y="49" width="44" height="5" rx="2" fill="#1E255E"/>
      <rect x="46" y="54" width="6.5" height="24" fill="#FFFFFF" stroke="#1E255E" stroke-width="1.6"/>
      <rect x="60.75" y="54" width="6.5" height="24" fill="#FFFFFF" stroke="#1E255E" stroke-width="1.6"/>
      <rect x="75.5" y="54" width="6.5" height="24" fill="#FFFFFF" stroke="#1E255E" stroke-width="1.6"/>
      <rect x="39" y="78" width="50" height="6" rx="3" fill="#1E255E"/>
    </g>
    <g class="svg-float">
      <rect x="122" y="36" width="58" height="40" rx="8" fill="#FFFFFF" stroke="#1E255E" stroke-width="2.5"/>
      <rect x="133" y="58" width="8" height="12" rx="2" fill="#FFC107"/>
      <rect x="146" y="51" width="8" height="19" rx="2" fill="#E91E63"/>
      <rect x="159" y="43" width="8" height="27" rx="2" fill="#1E255E"/>
      <path d="M133 53 L148 45 L163 39" stroke="#10B981" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <line x1="140" y1="76" x2="134" y2="87" stroke="#1E255E" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="162" y1="76" x2="168" y2="87" stroke="#1E255E" stroke-width="2.5" stroke-linecap="round"/>
    </g>
    <g>
      <rect x="74" y="102" width="72" height="22" rx="11" fill="#1E255E"/>
      <text x="110" y="116.5" text-anchor="middle" fill="#FFC107" font-weight="900" font-size="11">CAE · C1</text>
      <rect x="88" y="164" width="44" height="28" rx="13" fill="#1E255E"/>
      <path d="M101 164 L110 175 L119 164 Z" fill="#FFC107"/>
      <circle cx="110" cy="146" r="16" fill="#FFE0BD"/>
      <polygon points="110,125 90,133 110,140 130,133" fill="#1E255E"/>
      <path d="M124 135 L124 144" stroke="#FFC107" stroke-width="2" stroke-linecap="round"/>
      <circle cx="104.5" cy="147" r="2" fill="#1E255E"/>
      <circle cx="115.5" cy="147" r="2" fill="#1E255E"/>
      <path d="M105.5 153 Q110 157 114.5 153" stroke="#E91E63" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`,

  // Năm 5: C1+ / C2 (Proficiency) - Graduation mortarboard cap at top center, C2 global world icon on left, gold-ribbon certificate diploma on right
  `<svg viewBox="0 0 220 220" class="w-[220px] h-[220px] mx-auto drop-shadow-sm overflow-visible">
    <circle cx="110" cy="110" r="98" fill="#FFF8E1" stroke="#FDE68A" stroke-width="1.5"/>
    <g class="svg-float">
      <polygon points="110,28 66,46 110,63 154,46" fill="#1E255E"/>
      <path d="M85 54 L85 68 Q110 78 135 68 L135 54" fill="#2B347A"/>
      <path d="M110 46 L146 56 L146 73" stroke="#FFC107" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="146" cy="75" r="4.5" fill="#E91E63"/>
    </g>
    <g class="svg-float-alt">
      <circle cx="64" cy="134" r="28" fill="#1E255E"/>
      <ellipse cx="64" cy="134" rx="13" ry="28" fill="none" stroke="#38BDF8" stroke-width="2.2"/>
      <line x1="36" y1="134" x2="92" y2="134" stroke="#38BDF8" stroke-width="2.2"/>
      <circle cx="54" cy="124" r="2.5" fill="#FFC107"/>
      <circle cx="74" cy="144" r="2.5" fill="#FFC107"/>
      <circle cx="84" cy="112" r="12" fill="#E91E63" stroke="#FFFFFF" stroke-width="2"/>
      <text x="84" y="115.5" text-anchor="middle" fill="#FFFFFF" font-weight="900" font-size="9.5">C2</text>
    </g>
    <g class="svg-float">
      <rect x="112" y="106" width="68" height="52" rx="9" fill="#FFFFFF" stroke="#1E255E" stroke-width="2.5"/>
      <line x1="123" y1="120" x2="169" y2="120" stroke="#1E255E" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="123" y1="130" x2="156" y2="130" stroke="#94A3B8" stroke-width="2" stroke-linecap="round"/>
      <line x1="123" y1="139" x2="144" y2="139" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"/>
      <circle cx="161" cy="145" r="11" fill="#FFC107" stroke="#FFFFFF" stroke-width="1.8"/>
      <path d="M156 155 L153 168 L161 164 L169 168 L166 155 Z" fill="#E91E63"/>
    </g>
    <polygon class="svg-sparkle" points="110,180 112.5,186 119,186 113.5,190 115.5,196 110,192 104.5,196 106.5,190 101,186 107.5,186" fill="#E91E63"/>
  </svg>`,
];

const BASE_FIVE_YEAR_MILESTONES: TimelineYearMilestone[] = [
  {
    yearIndex: 1,
    yearLabelEn: 'Year 1',
    yearLabelVi: 'Năm 1',
    stageTitleEn: 'Level 1: Core Foundations',
    stageTitleVi: 'Cấp 1: Nền tảng Căn bản',
    targetCefr: 'Pre-A1 Starters',
    targetCefrLabel: 'Pre-A1 (Starters)',
    ageRangeVi: '6 - 7 tuổi',
    ageRangeEn: '6 - 7 yrs',
    badgeBgClass: 'bg-indigo-100 text-[#1E255E]',
    englishPercent: 32,
    wholeChildPercent: 45,
    milestonesVi: [
      'Làm quen với bảng chữ cái & phát âm.',
      'Từ vựng cơ bản (Màu sắc, số đếm, gia đình).',
      'Chào hỏi & giới thiệu bản thân đơn giản.',
    ],
    milestonesEn: [
      'Master the alphabet & foundational phonics.',
      'Core vocabulary (Colors, numbers, family).',
      'Simple greetings & self-introductions.',
    ],
    outcomeEn: 'Reads illustrated fables aloud and holds joyful everyday English conversations.',
    outcomeVi: 'Đọc diễn cảm truyện ngụ ngôn ngắn và giao tiếp tiếng Anh tự nhiên hàng ngày.',
    accentColor: '#1E255E',
    courses: [
      {
        code: 'BW-01',
        titleEn: 'Be Whole: 13-Week Values & English Curriculum',
        titleVi: 'Be Whole: Giáo trình Tiếng Anh & 13 Giá trị Sống',
        weeksLabel: '13w × 2',
        focusEn: 'Kindness, Gratitude, Courage & Sentence House dialogue',
        focusVi: 'Lòng tốt, Biết ơn, Can đảm & hội thoại Sentence House',
      },
      {
        code: 'FS-01',
        titleEn: 'Cambridge Pre-A1 Starters · Phonics & Storytelling',
        titleVi: 'Cambridge Pre-A1 Starters · Đánh vần & Kể chuyện',
        weeksLabel: '13w × 2',
        focusEn: '400+ core words, phonics blends & picture description',
        focusVi: '400+ từ vựng nền tảng, ghép âm & miêu tả tranh',
      },
    ],
  },
  {
    yearIndex: 2,
    yearLabelEn: 'Year 2',
    yearLabelVi: 'Năm 2',
    stageTitleEn: 'Level 2: Grammar & Communication',
    stageTitleVi: 'Cấp 2: Ngữ pháp & Giao tiếp',
    targetCefr: 'A1 Movers',
    targetCefrLabel: 'A1 (Movers) - A2 (Flyers)',
    ageRangeVi: '7 - 9 tuổi',
    ageRangeEn: '7 - 9 yrs',
    badgeBgClass: 'bg-blue-100 text-blue-900',
    englishPercent: 52,
    wholeChildPercent: 62,
    milestonesVi: [
      'Cấu trúc câu S-V-O cơ bản.',
      'Thì hiện tại đơn & tiếp diễn.',
      'Hội thoại hàng ngày & kể chuyện ngắn.',
    ],
    milestonesEn: [
      'Core S-V-O sentence structures.',
      'Present Simple & Present Continuous tenses.',
      'Daily conversations & short storytelling.',
    ],
    outcomeEn: 'Writes coherent 6–8 sentence stories and converses naturally on familiar topics.',
    outcomeVi: 'Viết đoạn văn 6–8 câu mạch lạc và trò chuyện tự nhiên về các chủ đề quen thuộc.',
    accentColor: '#2563EB',
    courses: [
      {
        code: 'CM-A1',
        titleEn: 'Cambridge A1 Movers · Sentence Builders & Grammar',
        titleVi: 'Cambridge A1 Movers · Xây dựng Câu & Ngữ pháp',
        weeksLabel: '16w',
        focusEn: 'S-V-O structures, Present Simple & Continuous tenses',
        focusVi: 'Cấu trúc câu S-V-O, thì hiện tại đơn & tiếp diễn',
      },
      {
        code: 'CF-A2',
        titleEn: 'Cambridge A2 Flyers · Creative Readers & Drama',
        titleVi: 'Cambridge A2 Flyers · Đọc hiểu Sáng tạo & Kịch nghệ',
        weeksLabel: '16w',
        focusEn: 'Everyday dialogues, short storytelling & teamwork',
        focusVi: 'Hội thoại hàng ngày, kể chuyện ngắn & hợp tác nhóm',
      },
    ],
  },
  {
    yearIndex: 3,
    yearLabelEn: 'Year 3',
    yearLabelVi: 'Năm 3',
    stageTitleEn: 'Level 3: Expansion & Intermediate Mastery',
    stageTitleVi: 'Cấp 3: Mở rộng & Nâng cao',
    targetCefr: 'B1 Preliminary',
    targetCefrLabel: 'B1 (PET) - B2 (FCE)',
    ageRangeVi: '9 - 11 tuổi',
    ageRangeEn: '9 - 11 yrs',
    badgeBgClass: 'bg-pink-100 text-[#E91E63]',
    englishPercent: 72,
    wholeChildPercent: 78,
    milestonesVi: [
      'Thì phức tạp (Quá khứ hoàn thành, Tương lai hoàn thành).',
      'Văn phong đa dạng (Mô tả, so sánh, tranh luận).',
      'Thảo luận các vấn đề xã hội.',
    ],
    milestonesEn: [
      'Complex tenses (Past Perfect, Future Perfect).',
      'Diverse writing styles (Descriptive, comparative, persuasive).',
      'Discussing social and global topics.',
    ],
    outcomeEn: 'Delivers structured speeches, writes multi-paragraph essays, and debates real-world topics.',
    outcomeVi: 'Thuyết trình mạch lạc, viết bài luận nhiều đoạn và phản biện các chủ đề thực tế.',
    accentColor: '#E91E63',
    courses: [
      {
        code: 'BP-B1',
        titleEn: 'Cambridge B1 Preliminary (PET) · Academic Writing',
        titleVi: 'Cambridge B1 Preliminary (PET) · Viết Học thuật',
        weeksLabel: '18w',
        focusEn: 'Complex tenses, comparative essays & listening mastery',
        focusVi: 'Các thì phức tạp, bài viết so sánh & nghe hiểu chuyên sâu',
      },
      {
        code: 'BF-B2',
        titleEn: 'Cambridge B2 First (FCE) · Debate & Social Inquiry',
        titleVi: 'Cambridge B2 First (FCE) · Tranh biện & Tư duy Xã hội',
        weeksLabel: '18w',
        focusEn: 'Persuasive speaking, social discussions & critical reading',
        focusVi: 'Thuyết trình thuyết phục, thảo luận xã hội & đọc phản biện',
      },
    ],
  },
  {
    yearIndex: 4,
    yearLabelEn: 'Year 4',
    yearLabelVi: 'Năm 4',
    stageTitleEn: 'Level 4: Advanced & Academic Excellence',
    stageTitleVi: 'Cấp 4: Chuyên sâu & Học thuật',
    targetCefr: 'C1 Advanced',
    targetCefrLabel: 'C1 (CAE)',
    ageRangeVi: '11 - 13 tuổi',
    ageRangeEn: '11 - 13 yrs',
    badgeBgClass: 'bg-purple-100 text-purple-900',
    englishPercent: 88,
    wholeChildPercent: 90,
    milestonesVi: [
      'Ngữ pháp nâng cao & Cấu trúc đảo ngữ.',
      'Bài luận học thuật, phân tích dữ liệu.',
      'Kỹ năng thuyết trình chuyên nghiệp.',
    ],
    milestonesEn: [
      'Advanced grammar & stylistic inversion structures.',
      'Academic essays & data analysis synthesis.',
      'Professional presentation & public speaking skills.',
    ],
    outcomeEn: 'Produces research essays, analyzes complex data charts, and leads seminars.',
    outcomeVi: 'Viết tiểu luận nghiên cứu, phân tích biểu đồ dữ liệu và dẫn dắt hội thảo học thuật.',
    accentColor: '#6D28D9',
    courses: [
      {
        code: 'CA-C1',
        titleEn: 'Cambridge C1 Advanced (CAE) · Rhetoric & Research',
        titleVi: 'Cambridge C1 Advanced (CAE) · Học thuật & Nghiên cứu',
        weeksLabel: '20w',
        focusEn: 'Inversion grammar, academic essays & data synthesis',
        focusVi: 'Cấu trúc đảo ngữ, luận văn học thuật & phân tích dữ liệu',
      },
      {
        code: 'PS-04',
        titleEn: 'Executive Public Speaking & Seminar Leadership',
        titleVi: 'Thuyết trình Chuyên nghiệp & Dẫn dắt Hội thảo',
        weeksLabel: '16w',
        focusEn: 'Keynote delivery, structured Q&A & ethical leadership',
        focusVi: 'Diễn thuyết trước đám đông, phản biện Q&A & lãnh đạo',
      },
    ],
  },
  {
    yearIndex: 5,
    yearLabelEn: 'Year 5',
    yearLabelVi: 'Năm 5',
    stageTitleEn: 'Level 5: Near-Native Mastery & Global Leadership',
    stageTitleVi: 'Cấp 5: Tinh thông & Gần bản xứ',
    targetCefr: 'C2 Proficiency',
    targetCefrLabel: 'C1+ / C2 (Proficiency)',
    ageRangeVi: '13+ tuổi',
    ageRangeEn: '13+ yrs',
    badgeBgClass: 'bg-amber-100 text-amber-900',
    englishPercent: 98,
    wholeChildPercent: 97,
    milestonesVi: [
      'Sử dụng ngôn ngữ uyển chuyển, tự nhiên như người bản xứ.',
      'Giao tiếp đàm phán ở cấp độ cao nhất.',
      'Làm chủ ngôn ngữ trong mọi bối cảnh chuyên môn & văn hóa.',
    ],
    milestonesEn: [
      'Nuanced, effortless near-native language fluency.',
      'High-level diplomatic & academic negotiation.',
      'Complete mastery across professional and cultural contexts.',
    ],
    outcomeEn: 'Graduates as a bilingual C1+/C2 scholar and compassionate Be Whole leader.',
    outcomeVi: 'Tốt nghiệp với năng lực C1+/C2 như người bản xứ cùng nhân cách lãnh đạo nhân ái.',
    accentColor: '#D97706',
    courses: [
      {
        code: 'CP-C2',
        titleEn: 'Cambridge C1+ / C2 Proficiency · Global Scholar',
        titleVi: 'Cambridge C1+ / C2 Proficiency · Tinh thông Quốc tế',
        weeksLabel: '20w × 2',
        focusEn: 'Near-native rhetoric, high-stakes negotiation & discourse',
        focusVi: 'Ngôn ngữ tự nhiên như bản xứ, đàm phán cấp cao & chuyên môn sâu',
      },
      {
        code: 'WC-05',
        titleEn: 'Whole-Child Global Capstone & Ambassador Mentorship',
        titleVi: 'Dự án Tốt nghiệp Toàn cầu & Đại sứ Nhân cách Be Whole',
        weeksLabel: '13w',
        focusEn: 'Cross-cultural leadership, community impact & mentoring',
        focusVi: 'Lãnh đạo đa văn hóa, dự án cộng đồng & cố vấn học viên nhỏ',
      },
    ],
  },
];

function cefrToStartingYearIndex(level?: CefrLevel | string): 1 | 2 | 3 | 4 | 5 {
  switch (level) {
    case 'Pre-A1 Starters':
      return 1;
    case 'A1 Movers':
    case 'A2 Flyers':
      return 2;
    case 'A2 Key':
    case 'B1 Preliminary':
    case 'B2 First':
      return 3;
    case 'C1 Advanced':
      return 4;
    case 'C2 Proficiency':
      return 5;
    default:
      return 1;
  }
}

export interface FiveYearTimelineProps {
  lang: LangCode;
  variant: 'template' | 'student';
  student?: StudentProfile | null;
  students?: StudentProfile[];
  onSelectStudent?: (studentId: string) => void;
  assessments?: StudentAssessment[];
  programs?: ProgramCourse[];
}

export const FiveYearTimeline: React.FC<FiveYearTimelineProps> = ({
  lang,
  variant,
  student,
  students = [],
  onSelectStudent,
  assessments = [],
  programs = [],
}) => {
  const [selectedYear, setSelectedYear] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [completedYears, setCompletedYears] = useState<number[]>([]);
  const [checkedMilestones, setCheckedMilestones] = useState<Record<string, boolean>>({});
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stickyHeaderRef = useRef<HTMLElement | null>(null);
  const cardRefs = useRef<Record<number, HTMLElement | null>>({});
  const isProgrammaticScrollRef = useRef(false);
  const scrollLockTimerRef = useRef<number | null>(null);
  const lastCelebratedYearRef = useRef<number>(-1);

  const activeLevel: CefrLevel =
    variant === 'student' && student ? student.cefrLevel : 'Pre-A1 Starters';
  const activeModifier = variant === 'student' && student ? student.cefrModifier : 'standard';
  const baseAge = variant === 'student' && student ? student.age : 6;

  const currentYearNumber: 1 | 2 | 3 | 4 | 5 =
    variant === 'student' && student ? cefrToStartingYearIndex(student.cefrLevel) : 1;

  useEffect(() => {
    setSelectedYear(currentYearNumber);
    if (variant === 'student') {
      const prior: number[] = [];
      const initialChecks: Record<string, boolean> = {};
      for (let y = 1; y < currentYearNumber; y++) {
        prior.push(y);
        for (let m = 0; m < 3; m++) {
          initialChecks[`${y}-${m}`] = true;
        }
      }
      setCompletedYears(prior);
      setCheckedMilestones(initialChecks);
    }
  }, [variant, student?.id, currentYearNumber]);

  const triggerCelebrationBurst = useCallback(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#E91E63', '#FFC107', '#1E255E', '#38BDF8', '#10B981'];
    let particles = Array.from({ length: 85 }, () => ({
      x: canvas.width * (0.2 + Math.random() * 0.6),
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 1.1) * 14,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.25,
      alpha: 1,
    }));

    const animateConfetti = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38;
        p.rotation += p.vRot;
        p.alpha -= 0.012;

        if (p.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
        }
      });

      particles = particles.filter((p) => p.alpha > 0 && p.y < canvas.height + 30);
      if (particles.length > 0) {
        requestAnimationFrame(animateConfetti);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    requestAnimationFrame(animateConfetti);
  }, []);

  const updateYearActive = useCallback(
    (yearNum: 1 | 2 | 3 | 4 | 5) => {
      setSelectedYear(yearNum);
      if (yearNum === 5 && lastCelebratedYearRef.current !== 5) {
        lastCelebratedYearRef.current = 5;
        triggerCelebrationBurst();
      }
    },
    [triggerCelebrationBurst]
  );

  const scrollToYear = (yearNum: 1 | 2 | 3 | 4 | 5) => {
    const target = cardRefs.current[yearNum];
    updateYearActive(yearNum);
    if (!target) return;

    isProgrammaticScrollRef.current = true;
    if (scrollLockTimerRef.current) window.clearTimeout(scrollLockTimerRef.current);

    const headerHeight = stickyHeaderRef.current ? stickyHeaderRef.current.offsetHeight : 120;
    const yOffset = -(headerHeight + 24);
    const targetY = Math.max(0, target.getBoundingClientRect().top + window.pageYOffset + yOffset);

    window.scrollTo({ top: targetY, behavior: 'smooth' });

    scrollLockTimerRef.current = window.setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 900);
  };

  const advanceNextYear = () => {
    const nextYear = ((selectedYear % 5) + 1) as 1 | 2 | 3 | 4 | 5;
    scrollToYear(nextYear);
  };

  const toggleYearComplete = (yearNum: 1 | 2 | 3 | 4 | 5, forceComplete?: boolean) => {
    const isCurrentlyDone = completedYears.includes(yearNum);
    const shouldComplete = forceComplete !== undefined ? forceComplete : !isCurrentlyDone;

    if (shouldComplete) {
      setCompletedYears((prev) => (prev.includes(yearNum) ? prev : [...prev, yearNum]));
      setCheckedMilestones((prev) => ({
        ...prev,
        [`${yearNum}-0`]: true,
        [`${yearNum}-1`]: true,
        [`${yearNum}-2`]: true,
      }));
      triggerCelebrationBurst();
    } else {
      setCompletedYears((prev) => prev.filter((y) => y !== yearNum));
    }
  };

  const toggleMilestoneCheck = (yearNum: 1 | 2 | 3 | 4 | 5, milestoneIdx: number) => {
    const key = `${yearNum}-${milestoneIdx}`;
    setCheckedMilestones((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const allThreeChecked = [0, 1, 2].every((i) => Boolean(next[`${yearNum}-${i}`]));
      if (allThreeChecked && !completedYears.includes(yearNum)) {
        setCompletedYears((cPrev) => (cPrev.includes(yearNum) ? cPrev : [...cPrev, yearNum]));
        triggerCelebrationBurst();
      }
      return next;
    });
  };

  // Scroll synchronization for the 5 year cards
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        if (isProgrammaticScrollRef.current) return;

        const headerHeight = stickyHeaderRef.current ? stickyHeaderRef.current.offsetHeight : 120;
        const focalPoint = headerHeight + (window.innerHeight - headerHeight) * 0.38;
        let closestYear: 1 | 2 | 3 | 4 | 5 = selectedYear;
        let minDistance = Infinity;

        ([1, 2, 3, 4, 5] as const).forEach((yr) => {
          const el = cardRefs.current[yr];
          if (!el) return;
          const rect = el.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > window.innerHeight) return;
          const cardCenter = rect.top + rect.height / 2;
          const distance = Math.abs(cardCenter - focalPoint);
          if (distance < minDistance) {
            minDistance = distance;
            closestYear = yr;
          }
        });

        if (minDistance < window.innerHeight * 0.65 && closestYear !== selectedYear) {
          updateYearActive(closestYear);
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [selectedYear, updateYearActive]);

  const latestStudentAssessment = useMemo(() => {
    if (variant !== 'student' || !student) return null;
    const list = assessments.filter((a) => a.studentId === student.id);
    return list[0] ?? null;
  }, [variant, student, assessments]);

  const liveOverallScore = useMemo(() => {
    if (!latestStudentAssessment) return null;
    const eng =
      (latestStudentAssessment.speakingScore +
        latestStudentAssessment.readingScore +
        latestStudentAssessment.writingScore +
        (latestStudentAssessment.vocabularyScore ?? 0) +
        (latestStudentAssessment.comprehensionScore ?? 0)) /
      5;
    const whole =
      (latestStudentAssessment.socialScore +
        latestStudentAssessment.emotionalScore +
        latestStudentAssessment.mentalScore) /
      3;
    return Math.round((eng + whole) / 2);
  }, [latestStudentAssessment]);

  const timelineSteps = useMemo(() => {
    return BASE_FIVE_YEAR_MILESTONES.map((base, idx) => {
      const yearNum = (idx + 1) as 1 | 2 | 3 | 4 | 5;
      const mergedCourses = base.courses.map((c) => {
        const matchingProg = programs.find((p) => p.code === c.code);
        if (!matchingProg) return c;
        return {
          code: matchingProg.code || c.code,
          titleEn: matchingProg.titleEn,
          titleVi: matchingProg.titleVi,
          weeksLabel: `${matchingProg.weeksCount}w`,
          focusEn: matchingProg.descriptionEn.slice(0, 120),
          focusVi: matchingProg.descriptionVi.slice(0, 120),
        };
      });

      const ageAtYear = Math.max(5, baseAge + (yearNum - currentYearNumber));
      const isCheckedDone = completedYears.includes(yearNum);
      const status: 'completed' | 'current' | 'upcoming' = isCheckedDone
        ? 'completed'
        : yearNum < currentYearNumber
          ? 'completed'
          : yearNum === currentYearNumber
            ? 'current'
            : 'upcoming';

      const displayCefrLabel =
        status === 'current' && variant === 'student' && student
          ? formatCefrLabel(student.cefrLevel, student.cefrModifier)
          : base.targetCefrLabel;

      return {
        ...base,
        displayCefrLabel,
        ageAtYear,
        status,
        courses: mergedCourses,
      };
    });
  }, [programs, baseAge, currentYearNumber, completedYears, variant, student]);

  const activeStep =
    timelineSteps.find((s) => s.yearIndex === selectedYear) || timelineSteps[0];
  const finalYear = timelineSteps[timelineSteps.length - 1];
  const currentStep =
    timelineSteps.find((s) => s.yearIndex === currentYearNumber) || timelineSteps[0];

  const totalLevels = timelineSteps.length;
  const stepPercent = ((selectedYear - 1) / (totalLevels - 1)) * 100;
  const completionPercent = Math.round((selectedYear / totalLevels) * 100);
  const ringCircumference = 69.115;
  const ringOffset = (ringCircumference - (completionPercent / 100) * ringCircumference).toFixed(2);

  return (
    <div className="bg-[#FFFDF9] text-[#1E255E] rounded-3xl border border-slate-200/90 shadow-sm relative selection:bg-[#E91E63] selection:text-white">
      {/* Fullscreen Celebratory Confetti Canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="fixed inset-0 pointer-events-none z-50 w-full h-full no-print"
      />

      {/* Sticky Top Header & Synchronized 5-Year Progress Stepper */}
      <nav
        ref={stickyHeaderRef}
        className="sticky top-0 z-30 bg-[#FFFDF9]/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs rounded-t-3xl"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5">
          {/* Header Top Row: Left Title/Badge & Top-Right Synchronized "Hoàn thành" Progress Ring */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
              <h2 className="font-display font-black text-base sm:text-lg text-[#1E255E] tracking-tight">
                {variant === 'student' && student
                  ? biText(
                      lang,
                      `${student.fullName} · 5-Year Learning & Development Roadmap`,
                      `Lộ trình Học tập & Phát triển 5 Năm · ${student.fullName}`
                    )
                  : biText(
                      lang,
                      '5-Year Learning & Development Roadmap',
                      'Lộ trình Học tập & Phát triển 5 Năm'
                    )}
              </h2>
              <span className="inline-flex items-center gap-1.5 bg-[#1E255E]/5 px-3 py-1 rounded-full w-fit">
                <span className="w-2 h-2 rounded-full bg-[#E91E63] animate-pulse" />
                <span className="text-[11px] font-extrabold text-[#1E255E] tracking-wide">
                  {biText(
                    lang,
                    'Cambridge CEFR & Whole-Child Values Rubric',
                    'Khung đánh giá Cambridge CEFR & Giá trị Sống'
                  )}
                </span>
              </span>
            </div>

            {/* Top-Right Dynamic "Hoàn thành" Progress Badge with Circular Ring */}
            <div className="flex items-center gap-2.5 ml-auto">
              {variant === 'student' && onSelectStudent && students.length > 0 && (
                <select
                  value={student?.id || ''}
                  onChange={(e) => onSelectStudent(e.target.value)}
                  className="px-3 py-1.5 rounded-full border border-[#1E255E]/20 bg-white text-xs font-extrabold text-[#1E255E] no-print"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({formatCefrLabel(st.cefrLevel, st.cefrModifier)})
                    </option>
                  ))}
                </select>
              )}

              <span className="hidden md:inline-block text-xs font-extrabold bg-[#FFC107]/25 text-[#1E255E] px-3 py-1.5 rounded-full border border-[#FFC107]/60">
                {biText(
                  lang,
                  `Year ${activeStep.yearIndex} · ${activeStep.displayCefrLabel}`,
                  `Năm ${activeStep.yearIndex} · ${activeStep.displayCefrLabel}`
                )}
              </span>

              <div className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-black text-[#E91E63] bg-pink-50 px-4 py-1.5 rounded-full border border-pink-200 shadow-xs transition-all duration-300">
                <div className="relative w-6 h-6 flex items-center justify-center">
                  <svg className="w-6 h-6 -rotate-90" viewBox="0 0 28 28">
                    <circle cx="14" cy="14" r="11" stroke="#FBCFE8" strokeWidth="3.5" fill="none" />
                    <circle
                      cx="14"
                      cy="14"
                      r="11"
                      stroke="#E91E63"
                      strokeWidth="3.5"
                      fill="none"
                      strokeDasharray="69.115"
                      strokeDashoffset={ringOffset}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                </div>
                <span>
                  {biText(
                    lang,
                    `Completed: Level ${selectedYear}/${totalLevels} • ${completionPercent}%`,
                    `Hoàn thành: Cấp ${selectedYear}/${totalLevels} • ${completionPercent}%`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Horizontal Interactive 5-Year Stepper Bar with Gliding Student Mascot */}
          <div className="relative pt-5 pb-1 px-3 sm:px-8">
            <div className="h-3 bg-slate-200/80 rounded-full w-full relative overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#E91E63] via-[#FFC107] to-[#1E255E] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${stepPercent}%` }}
              />
            </div>

            {/* Cute Gliding Student Mascot Avatar */}
            <div
              className="absolute -top-2.5 transition-all duration-500 ease-out -translate-x-1/2 pointer-events-none z-20"
              style={{ left: `${stepPercent}%` }}
            >
              <div className="mascot-hop bg-white rounded-full p-1 shadow-md border-2 border-[#E91E63] w-9 h-9 flex items-center justify-center">
                <svg viewBox="0 0 40 40" className="w-7 h-7">
                  <circle cx="20" cy="22" r="12" fill="#FFE0BD" />
                  <path d="M8 20 C8 11, 32 11, 32 20 C30 15, 10 15, 8 20 Z" fill="#1E255E" />
                  <circle cx="16" cy="21" r="1.6" fill="#1E255E" />
                  <circle cx="24" cy="21" r="1.6" fill="#1E255E" />
                  <circle cx="13.5" cy="23.5" r="2" fill="#FF8A9E" opacity="0.65" />
                  <circle cx="26.5" cy="23.5" r="2" fill="#FF8A9E" opacity="0.65" />
                  <path d="M17 25 Q20 28 23 25" stroke="#E91E63" strokeWidth="2" fill="none" strokeLinecap="round" />
                  <path d="M10 12 L20 7 L30 12 L20 16 Z" fill="#E91E63" />
                  <circle cx="20" cy="7" r="2" fill="#FFC107" />
                </svg>
              </div>
            </div>

            {/* 5 Clickable Year Nodes */}
            <div className="flex justify-between items-center relative -mt-4 z-10">
              {timelineSteps.map((item) => {
                const isSelected = item.yearIndex === selectedYear;
                const isDone =
                  item.yearIndex < selectedYear || completedYears.includes(item.yearIndex);
                return (
                  <button
                    key={item.yearIndex}
                    type="button"
                    onClick={() => scrollToYear(item.yearIndex)}
                    aria-label={`Chuyển đến Năm ${item.yearIndex}: ${item.displayCefrLabel}`}
                    className="group flex flex-col items-center focus:outline-none cursor-pointer"
                  >
                    <div
                      className={
                        isSelected
                          ? 'w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E91E63] border-4 border-[#FFC107] flex items-center justify-center font-display font-black text-xs sm:text-sm text-white shadow-md scale-110 transition-all duration-300'
                          : isDone
                            ? 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1E255E] border-4 border-[#1E255E] flex items-center justify-center font-display font-black text-xs sm:text-sm text-[#FFC107] shadow-xs transition-all duration-300'
                            : 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border-4 border-slate-300 flex items-center justify-center font-display font-black text-xs sm:text-sm text-[#1E255E] shadow-xs transition-all duration-300 group-hover:scale-110'
                      }
                    >
                      {item.yearIndex}
                    </div>
                    <span
                      className={
                        isSelected
                          ? 'mt-1.5 text-[11px] sm:text-xs font-black text-[#E91E63] transition-colors duration-300'
                          : 'mt-1.5 text-[11px] sm:text-xs font-bold text-slate-500 transition-colors duration-300'
                      }
                    >
                      {lang === 'en' ? item.yearLabelEn : item.yearLabelVi}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Clean Centered Hero Banner */}
      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-pink-200/80 shadow-xs mb-5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FFC107]" />
          <span className="text-xs sm:text-sm font-extrabold text-[#E91E63] tracking-wide">
            {biText(
              lang,
              'Cambridge CEFR & Whole-Child Character Framework',
              'Khung đánh giá Cambridge CEFR & Giá trị Sống'
            )}
          </span>
        </div>

        <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-black text-[#1E255E] tracking-tight leading-tight mb-4">
          {lang === 'en' ? (
            <>
              Learning &amp; Development{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E91E63] via-[#FFC107] to-[#1E255E]">
                5-Year Roadmap
              </span>
            </>
          ) : (
            <>
              Lộ trình Học tập &amp; Phát triển{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E91E63] via-[#FFC107] to-[#1E255E]">
                5 Năm
              </span>
            </>
          )}
        </h1>

        <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto font-medium leading-relaxed mb-7">
          {biText(
            lang,
            'Scroll or select each academic year to accompany your child through every developmental milestone — from their first English steps to near-native C1+/C2 mastery.',
            'Cuộn trang hoặc chọn từng năm học để đồng hành cùng con qua từng cột mốc trưởng thành — từ những bước làm quen đầu tiên đến làm chủ tiếng Anh như người bản xứ.'
          )}
        </p>

        {/* Primary Navigation CTA Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 no-print">
          <button
            type="button"
            onClick={() => scrollToYear(1)}
            className="px-6 py-3 rounded-2xl bg-[#1E255E] hover:bg-[#151a46] text-white font-bold text-sm shadow-lg shadow-indigo-900/15 transition flex items-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 text-[#FFC107] fill-[#FFC107]" />
            {biText(lang, 'Start from Year 1', 'Bắt đầu từ Năm 1')}
          </button>
          <button
            type="button"
            onClick={advanceNextYear}
            className="px-6 py-3 rounded-2xl bg-[#E91E63] hover:bg-[#d81b60] text-white font-bold text-sm shadow-lg shadow-pink-500/20 transition flex items-center gap-2 cursor-pointer"
          >
            {biText(lang, 'Continue Journey', 'Tiếp tục hành trình')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Point Student Summary Strip when in Student Portal / Teacher / Admin view */}
        {variant === 'student' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-left">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
              <div className="text-[11px] font-bold text-[#E91E63]">
                {biText(lang, '1. Current Stage', '1. Vị trí Hiện tại')}
              </div>
              <div className="font-display text-lg font-bold text-[#1E255E] font-mono-num">
                {formatCefrLabel(activeLevel, activeModifier)} ·{' '}
                {lang === 'en' ? currentStep.yearLabelEn : currentStep.yearLabelVi}
              </div>
              <p className="text-xs text-slate-600">
                {biText(
                  lang,
                  `Age ${baseAge} · ${currentStep.stageTitleEn}${liveOverallScore !== null ? ` · Overall ${liveOverallScore}%` : ''}`,
                  `${baseAge} tuổi · ${currentStep.stageTitleVi}${liveOverallScore !== null ? ` · Điểm TB ${liveOverallScore}%` : ''}`
                )}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1 shadow-2xs">
              <div className="text-[11px] font-bold text-[#0D9488]">
                {biText(lang, '2. Where Student Is Headed', '2. Hướng phát triển Tiếp theo')}
              </div>
              <div className="font-display text-lg font-bold text-[#1E255E]">
                {lang === 'en'
                  ? (timelineSteps[Math.min(4, currentStep.yearIndex)] || currentStep).stageTitleEn
                  : (timelineSteps[Math.min(4, currentStep.yearIndex)] || currentStep).stageTitleVi}
              </div>
              <p className="text-xs text-slate-600 font-mono-num">
                {biText(
                  lang,
                  `Target: ${(timelineSteps[Math.min(4, currentStep.yearIndex)] || currentStep).displayCefrLabel}`,
                  `Đích đến: ${(timelineSteps[Math.min(4, currentStep.yearIndex)] || currentStep).displayCefrLabel}`
                )}
              </p>
            </div>

            <div className="bg-[#1E255E] text-white rounded-2xl p-4 space-y-1 shadow-2xs">
              <div className="text-[11px] font-bold text-[#FFC107] flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                {biText(lang, '3. 5-Year End Result', '3. Kết quả Đầu ra 5 Năm')}
              </div>
              <div className="font-display text-lg font-bold font-mono-num">
                {finalYear.targetCefrLabel} · {biText(lang, `Age ${finalYear.ageAtYear}`, `${finalYear.ageAtYear}+ tuổi`)}
              </div>
              <p className="text-xs text-indigo-100">
                {lang === 'en' ? finalYear.outcomeEn : finalYear.outcomeVi}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Main 5-Year Progressive Vertical Timeline */}
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pb-16 relative">
        {/* Central Vertical Connecting Spine */}
        <div className="hidden md:block absolute left-1/2 top-6 bottom-28 w-1.5 bg-slate-200/80 -translate-x-1/2 rounded-full overflow-hidden pointer-events-none">
          <div
            className="w-full bg-gradient-to-b from-[#E91E63] via-[#FFC107] to-[#1E255E] transition-all duration-700 ease-out"
            style={{ height: `${completionPercent}%` }}
          />
        </div>

        {/* 5 Year Timeline Cards Wrapper */}
        <div className="space-y-10 sm:space-y-14 relative z-10">
          {timelineSteps.map((item, idx) => {
            const isEven = idx % 2 === 1;
            const isActive = item.yearIndex === selectedYear;
            const isDone = completedYears.includes(item.yearIndex);

            return (
              <article
                key={item.yearIndex}
                ref={(el) => {
                  cardRefs.current[item.yearIndex] = el;
                }}
                onClick={() => scrollToYear(item.yearIndex)}
                className={`year-card ${
                  isActive ? 'active-card' : 'inactive-card'
                } bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200/80 shadow-md cursor-pointer relative overflow-hidden`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-center">
                  {/* Illustration Column */}
                  <div
                    className={`md:col-span-5 flex flex-col items-center justify-center ${
                      isEven ? 'md:order-2' : 'md:order-1'
                    }`}
                  >
                    <span
                      className={`inline-block px-3.5 py-1 rounded-full text-xs font-black tracking-wide uppercase mb-3 ${item.badgeBgClass}`}
                    >
                      {biText(
                        lang,
                        `YEAR ${item.yearIndex} · ${item.ageRangeEn}`,
                        `NĂM ${item.yearIndex} · ${item.ageRangeVi}`
                      )}
                    </span>
                    <div
                      className="w-full flex items-center justify-center"
                      dangerouslySetInnerHTML={{ __html: LEVEL_ILLUSTRATIONS_SVG[idx] }}
                    />
                  </div>

                  {/* Curriculum Details & Interactive Milestones Column */}
                  <div className={`md:col-span-7 ${isEven ? 'md:order-1' : 'md:order-2'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E255E] text-[#FFC107] text-xs font-extrabold">
                        <Award className="w-3.5 h-3.5" />
                        {item.displayCefrLabel}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleYearComplete(item.yearIndex);
                        }}
                        className={
                          isDone
                            ? 'px-3.5 py-1.5 rounded-full text-xs font-extrabold border border-emerald-200 bg-emerald-50 text-emerald-700 transition flex items-center gap-1.5 cursor-pointer'
                            : 'px-3.5 py-1.5 rounded-full text-xs font-extrabold border border-slate-200 bg-slate-50 text-slate-600 hover:border-[#E91E63] hover:text-[#E91E63] transition flex items-center gap-1.5 cursor-pointer'
                        }
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isDone
                          ? biText(
                              lang,
                              `Completed Year ${item.yearIndex}`,
                              `Đã hoàn thành Năm ${item.yearIndex}`
                            )
                          : biText(
                              lang,
                              `Mark Year ${item.yearIndex} Complete`,
                              `Đánh dấu hoàn thành Năm ${item.yearIndex}`
                            )}
                      </button>
                    </div>

                    <h3 className="font-display text-xl sm:text-2xl font-black text-[#1E255E] mb-4">
                      {lang === 'en' ? item.stageTitleEn : item.stageTitleVi}
                    </h3>

                    <ul className="space-y-3" onClick={(e) => e.stopPropagation()}>
                      {(lang === 'en' ? item.milestonesEn : item.milestonesVi).map((mText, mIdx) => {
                        const mKey = `${item.yearIndex}-${mIdx}`;
                        const isChecked = Boolean(checkedMilestones[mKey]);
                        return (
                          <li key={mKey}>
                            <label className="flex items-start gap-3 p-3 rounded-2xl bg-[#FFFDF9] hover:bg-pink-50/50 border border-slate-100 transition cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleMilestoneCheck(item.yearIndex, mIdx)}
                                className="milestone-checkbox mt-0.5 w-5 h-5 rounded-md border-2 border-slate-300 text-[#E91E63] accent-[#E91E63] focus:ring-[#E91E63] cursor-pointer shrink-0"
                              />
                              <span className="text-sm sm:text-base font-medium text-slate-700 leading-snug">
                                {mText}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Proposed Courses per Year */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2">
                      <div className="text-xs font-extrabold text-[#1E255E] flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#E91E63]" />
                        {biText(lang, 'Proposed Courses:', 'Khóa học đề xuất:')}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {item.courses.map((course, cIdx) => (
                          <div
                            key={`${item.yearIndex}-${course.code}-${cIdx}`}
                            className="p-2.5 rounded-xl bg-[#FFFDF9] border border-slate-200/70 text-xs"
                          >
                            <div className="font-mono-num font-bold text-[#E91E63]">
                              {course.code} · {course.weeksLabel}
                            </div>
                            <div className="font-bold text-[#1E255E] mt-0.5">
                              {lang === 'en' ? course.titleEn : course.titleVi}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* End-of-Journey 5-Year Graduation Celebration Card */}
        <div className="mt-14 bg-gradient-to-r from-[#1E255E] via-[#2b347a] to-[#1E255E] rounded-3xl p-7 sm:p-10 text-white shadow-xl border border-indigo-900/30 relative overflow-hidden text-center">
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#E91E63]/25 blur-2xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-[#FFC107]/25 blur-2xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="inline-block px-4 py-1 rounded-full bg-[#FFC107] text-[#1E255E] font-black text-xs uppercase tracking-wider mb-3">
              {biText(
                lang,
                '100% 5-Year Roadmap Completed',
                'Hoàn Thành 100% Lộ Trình 5 Năm'
              )}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-black mb-3">
              {biText(
                lang,
                'Global Confidence & A Compassionate Heart',
                'Tự Tin Hội Nhập Quốc Tế & Giàu Lòng Nhân Ái'
              )}
            </h2>
            <p className="text-indigo-100 text-sm sm:text-base mb-6 leading-relaxed">
              {biText(
                lang,
                'Mastering all 5 Cambridge CEFR levels from Pre-A1 Starters to C1+/C2 Proficiency alongside a strong Whole-Child character foundation.',
                'Chinh phục trọn vẹn 5 cấp độ Cambridge CEFR từ Pre-A1 Starters đến C1+/C2 Proficiency cùng nền tảng Giá trị Sống vững vàng.'
              )}
            </p>
            <button
              type="button"
              onClick={triggerCelebrationBurst}
              className="px-7 py-3.5 rounded-2xl bg-[#E91E63] hover:bg-[#d81b60] text-white font-extrabold text-sm shadow-lg shadow-pink-600/30 transition transform hover:scale-105 inline-flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#FFC107]" />
              {biText(lang, 'Celebrate Student Achievement', 'Chúc Mừng Thành Tích Của Bé')}
            </button>
          </div>
        </div>
      </div>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200/70 py-5 text-center text-xs font-semibold text-slate-400 bg-white/70 rounded-b-3xl">
        {biText(
          lang,
          '5-Year Learning & Development Roadmap · Cambridge CEFR & Whole-Child Values',
          'Lộ trình Học tập & Phát triển 5 Năm · Khung đánh giá Cambridge CEFR & Giá trị Sống'
        )}
      </footer>
    </div>
  );
};

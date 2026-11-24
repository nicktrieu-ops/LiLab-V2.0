import React, { useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Circle,
  Code2,
  Flame,
  Lightbulb,
  Lock,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import { biText } from '../i18n';
import type { LangCode } from '../types';

export type ChallengeCategory = 'all' | 'html' | 'css' | 'js' | 'bugfix';
export type ChallengeDifficulty = 'easy' | 'medium' | 'pro';

export interface ChallengeGoalCheck {
  id: string;
  labelEn: string;
  labelVi: string;
  tipEn: string;
  tipVi: string;
  test: (code: string) => boolean;
}

export interface ChallengeHelperBlock {
  id: string;
  labelEn: string;
  labelVi: string;
  snippetPreview: string;
  apply: (code: string) => string;
}

export interface CodeChallengeItem {
  id: string;
  order: number;
  category: Exclude<ChallengeCategory, 'all'>;
  difficulty: ChallengeDifficulty;
  xpReward: number;
  titleEn: string;
  titleVi: string;
  missionEn: string;
  missionVi: string;
  hintEn: string;
  hintVi: string;
  concepts: string[];
  starterCode: string;
  goals: ChallengeGoalCheck[];
  helperBlocks: ChallengeHelperBlock[];
}

export interface DigitalBadgeDef {
  id: string;
  titleEn: string;
  titleVi: string;
  descEn: string;
  descVi: string;
  accentHex: string;
  bgSoft: string;
  ringHex: string;
  iconType: 'spark' | 'html' | 'css' | 'js' | 'bug' | 'crown';
  checkUnlocked: (completedIds: string[], xpPoints: number) => boolean;
}

export interface VibeCodeProgressState {
  xpPoints: number;
  completedChallengeIds: string[];
  earnedBadgeIds: string[];
  currentStreak: number;
  lastCompletedAt?: string;
}

export interface CoderRankInfo {
  level: number;
  titleEn: string;
  titleVi: string;
  minXp: number;
  nextXp: number;
  progressPercent: number;
}

export const CODER_RANKS: Array<{
  level: number;
  minXp: number;
  titleEn: string;
  titleVi: string;
}> = [
  { level: 1, minXp: 0, titleEn: 'Code Explorer', titleVi: 'Nhà Thám Hiểm Code' },
  { level: 2, minXp: 120, titleEn: 'Pixel Painter', titleVi: 'Họa Sĩ Pixel' },
  { level: 3, minXp: 260, titleEn: 'Logic Knight', titleVi: 'Hiệp Sĩ Logic' },
  { level: 4, minXp: 440, titleEn: 'App Wizard', titleVi: 'Phù Thủy Ứng Dụng' },
  { level: 5, minXp: 640, titleEn: 'LiLab Master Coder', titleVi: 'Bậc Thầy Lập Trình LiLab' },
];

export function getCoderRank(xpPoints: number): CoderRankInfo {
  let current = CODER_RANKS[0];
  let next = CODER_RANKS[1];
  for (let i = 0; i < CODER_RANKS.length; i++) {
    if (xpPoints >= CODER_RANKS[i].minXp) {
      current = CODER_RANKS[i];
      next = CODER_RANKS[i + 1] ?? {
        level: current.level + 1,
        minXp: current.minXp + 200,
        titleEn: current.titleEn,
        titleVi: current.titleVi,
      };
    }
  }
  const span = Math.max(1, next.minXp - current.minXp);
  const progressPercent =
    current.level === CODER_RANKS[CODER_RANKS.length - 1].level
      ? 100
      : Math.min(100, Math.max(0, Math.round(((xpPoints - current.minXp) / span) * 100)));

  return {
    level: current.level,
    titleEn: current.titleEn,
    titleVi: current.titleVi,
    minXp: current.minXp,
    nextXp: next.minXp,
    progressPercent,
  };
}

export const CODE_CHALLENGES: CodeChallengeItem[] = [
  {
    id: 'hello-hero-banner',
    order: 1,
    category: 'html',
    difficulty: 'easy',
    xpReward: 50,
    titleEn: '01. Hello Hero Banner',
    titleVi: '01. Biểu Ngữ Siêu Anh Hùng',
    missionEn:
      'Personalize this welcome sign! Change the <h1> title to introduce yourself and update the <p> message with your own excited sentence.',
    missionVi:
      'Hãy cá nhân hóa bảng chào mừng này! Sửa tiêu đề <h1> để giới thiệu bản thân và đổi câu <p> thành lời nhắn hào hứng của em.',
    hintEn: 'Find <h1>Welcome, Coder!</h1> and replace the words between <h1> and </h1> with your own name or hero title.',
    hintVi: 'Tìm dòng <h1>Welcome, Coder!</h1> rồi thay chữ ở giữa cặp thẻ <h1> và </h1> bằng tên của em nhé.',
    concepts: ['HTML Headings', 'Paragraph Tags'],
    starterCode: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fffbeb; font-family: system-ui, sans-serif; color: #172154; padding: 20px; }
  .banner { background: #ffffff; border: 2px solid #fed7aa; border-radius: 24px; padding: 32px; text-align: center; max-width: 420px; width: 100%; box-shadow: 0 12px 24px rgba(255,107,0,0.08); }
  h1 { margin: 0 0 10px; font-size: 28px; color: #ff6b00; }
  p { margin: 0; font-size: 16px; color: #525e80; font-weight: 600; }
</style>
</head>
<body>
  <div class="banner">
    <h1>Welcome, Coder!</h1>
    <p>Ready to build?</p>
  </div>
</body>
</html>`,
    goals: [
      {
        id: 'custom-h1',
        labelEn: 'Change the <h1> headline to your own hero greeting',
        labelVi: 'Đổi tiêu đề <h1> thành lời chào của riêng em',
        tipEn: 'Edit the words inside <h1>...</h1> so it no longer says "Welcome, Coder!".',
        tipVi: 'Sửa nội dung bên trong <h1>...</h1> khác với "Welcome, Coder!".',
        test: (code) => {
          const match = code.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
          if (!match) return false;
          const text = match[1].replace(/<[^>]+>/g, '').trim();
          return text.length >= 3 && text.toLowerCase() !== 'welcome, coder!';
        },
      },
      {
        id: 'custom-p',
        labelEn: 'Update the <p> message with your own line',
        labelVi: 'Cập nhật dòng chữ <p> theo ý của em',
        tipEn: 'Change the text inside <p>Ready to build?</p> to your own fun sentence.',
        tipVi: 'Đổi chữ trong thẻ <p>Ready to build?</p> thành câu nói vui của em.',
        test: (code) => {
          const match = code.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
          if (!match) return false;
          const text = match[1].replace(/<[^>]+>/g, '').trim();
          return text.length >= 4 && text.toLowerCase() !== 'ready to build?';
        },
      },
    ],
    helperBlocks: [
      {
        id: 'h1-sample',
        labelEn: 'Set Hero Title',
        labelVi: 'Đổi Tiêu Đề Anh Hùng',
        snippetPreview: '<h1>Hi, I am a LiLab Coder! 🚀</h1>',
        apply: (code) =>
          code.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '<h1>Hi, I am a LiLab Coder! 🚀</h1>'),
      },
      {
        id: 'p-sample',
        labelEn: 'Set Exciting Subtitle',
        labelVi: 'Đổi Lời Nhắn Hào Hứng',
        snippetPreview: '<p>Today I am building real apps! ⭐</p>',
        apply: (code) =>
          code.replace(/<p[^>]*>[\s\S]*?<\/p>/i, '<p>Today I am building real apps! ⭐</p>'),
      },
    ],
  },
  {
    id: 'rainbow-button-pop',
    order: 2,
    category: 'css',
    difficulty: 'easy',
    xpReward: 60,
    titleEn: '02. Arcade Button Makeover',
    titleVi: '02. Thiết Kế Nút Bấm Siêu Đẹp',
    missionEn:
      'This gray square button looks sleepy! Give .magic-btn a bright new background color and round its corners with border-radius.',
    missionVi:
      'Chiếc nút màu xám hình vuông này trông hơi buồn ngủ! Hãy đổi màu nền background thật rực rỡ cho .magic-btn và bo tròn góc bằng border-radius.',
    hintEn: 'Change background: #94a3b8; to a bright hex like #ff6b00 or #0d9488, and change border-radius: 0px; to 18px or 99px!',
    hintVi: 'Đổi background: #94a3b8; thành mã màu tươi như #ff6b00, và đổi border-radius: 0px; thành 18px hoặc 99px nhé!',
    concepts: ['CSS Colors', 'Border Radius'],
    starterCode: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #f0f9ff; font-family: system-ui, sans-serif; color: #172154; }
  .magic-btn {
    background: #94a3b8;
    border-radius: 0px;
    color: #ffffff;
    border: none;
    padding: 16px 32px;
    font-size: 18px;
    font-weight: 800;
    cursor: pointer;
    transition: transform 0.15s ease;
  }
  .magic-btn:active { transform: scale(0.95); }
</style>
</head>
<body>
  <h2>Press My Custom Button!</h2>
  <button class="magic-btn" onclick="this.textContent='Yay! Awesome style! ✨'">Tap Me!</button>
</body>
</html>`,
    goals: [
      {
        id: 'bright-bg',
        labelEn: 'Change the button background color from gray (#94a3b8)',
        labelVi: 'Đổi màu nền nút từ màu xám (#94a3b8) sang màu tươi sáng',
        tipEn: 'Replace #94a3b8 in .magic-btn with a colorful value like #ff6b00, #2563eb, or a linear-gradient.',
        tipVi: 'Thay #94a3b8 trong .magic-btn bằng màu khác như #ff6b00, #2563eb hoặc linear-gradient.',
        test: (code) => {
          const btnBlock = code.match(/\.magic-btn\s*\{([\s\S]*?)\}/i)?.[1] || '';
          const bgMatch = btnBlock.match(/background(?:-color)?\s*:\s*([^;]+)/i);
          if (!bgMatch) return false;
          const val = bgMatch[1].trim().toLowerCase();
          return val.length > 0 && val !== '#94a3b8' && val !== 'gray' && val !== 'grey';
        },
      },
      {
        id: 'round-corners',
        labelEn: 'Round the corners with border-radius (12px or higher)',
        labelVi: 'Bo tròn góc nút với border-radius (từ 12px trở lên)',
        tipEn: 'Set border-radius: 18px; (or 99px for a pill shape) inside .magic-btn.',
        tipVi: 'Đặt border-radius: 18px; (hoặc 99px) bên trong .magic-btn.',
        test: (code) => {
          const btnBlock = code.match(/\.magic-btn\s*\{([\s\S]*?)\}/i)?.[1] || '';
          const brMatch = btnBlock.match(/border-radius\s*:\s*(\d+)(px|rem|%)/i);
          if (!brMatch) return false;
          const num = Number(brMatch[1]);
          const unit = brMatch[2].toLowerCase();
          return unit === 'px' ? num >= 12 : num >= 1;
        },
      },
    ],
    helperBlocks: [
      {
        id: 'sunny-orange-bg',
        labelEn: 'Sunny Orange Color',
        labelVi: 'Màu Cam Nắng',
        snippetPreview: 'background: #ff6b00;',
        apply: (code) =>
          code.replace(/background(?:-color)?\s*:\s*[^;]+;/i, 'background: #ff6b00;'),
      },
      {
        id: 'rainbow-bg',
        labelEn: 'Sunset Gradient',
        labelVi: 'Màu Chuyển Sắc Cầu Vồng',
        snippetPreview: 'background: linear-gradient(90deg, #ff6b00, #e61e64);',
        apply: (code) =>
          code.replace(
            /background(?:-color)?\s*:\s*[^;]+;/i,
            'background: linear-gradient(90deg, #ff6b00, #e61e64);'
          ),
      },
      {
        id: 'round-20',
        labelEn: 'Round Corners (20px)',
        labelVi: 'Bo Tròn Góc (20px)',
        snippetPreview: 'border-radius: 20px;',
        apply: (code) =>
          code.replace(/border-radius\s*:\s*[^;]+;/i, 'border-radius: 20px;'),
      },
    ],
  },
  {
    id: 'emoji-click-counter',
    order: 3,
    category: 'js',
    difficulty: 'medium',
    xpReward: 80,
    titleEn: '03. Star Click Counter',
    titleVi: '03. Bộ Đếm Sao Tương Tác',
    missionEn:
      'Make the Star Collector button work! Add JavaScript inside the click handler so every tap increases the stars variable.',
    missionVi:
      'Hãy kích hoạt nút Thu Thập Sao! Thêm dòng lệnh JavaScript vào sự kiện bấm nút để mỗi lần nhấn sẽ cộng thêm điểm vào biến stars.',
    hintEn: 'Replace /* TODO: add 1 to stars */ with stars = stars + 1; (or stars += 5; for super speed!).',
    hintVi: 'Thay dòng /* TODO: add 1 to stars */ bằng stars = stars + 1; (hoặc stars += 5; để tăng nhanh!).',
    concepts: ['Variables', 'Click Events', 'DOM Updates'],
    starterCode: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #0f172a; color: #fff; font-family: system-ui, sans-serif; }
  .score { font-size: 54px; font-weight: 900; color: #ffd41d; }
  button { background: #ff6b00; color: #fff; border: none; border-radius: 16px; padding: 14px 26px; font-size: 17px; font-weight: 800; cursor: pointer; }
  button:active { transform: scale(0.96); }
</style>
</head>
<body>
  <div class="score" id="count">0 ⭐</div>
  <button id="starBtn">Collect Star!</button>
<script>
  let stars = 0;
  const countEl = document.getElementById('count');
  document.getElementById('starBtn').onclick = () => {
    /* TODO: add 1 to stars */
    countEl.textContent = stars + ' ⭐';
  };
</script>
</body>
</html>`,
    goals: [
      {
        id: 'increment-stars',
        labelEn: 'Increase the stars variable when the button is clicked',
        labelVi: 'Tăng giá trị biến stars mỗi khi bấm nút',
        tipEn: 'Add stars = stars + 1; or stars++; inside the onclick function.',
        tipVi: 'Thêm lệnh stars = stars + 1; hoặc stars++; vào trong hàm onclick.',
        test: (code) =>
          /(?:stars\s*\+\+|\+\+\s*stars|stars\s*\+=\s*[1-9]\d*|stars\s*=\s*stars\s*\+\s*[1-9]\d*)/i.test(
            code
          ),
      },
      {
        id: 'update-screen',
        labelEn: 'Display the updated count on screen',
        labelVi: 'Hiển thị số sao mới lên màn hình',
        tipEn: 'Keep countEl.textContent = stars + " ⭐"; so the number updates visually.',
        tipVi: 'Giữ dòng countEl.textContent = stars + " ⭐"; để số sao hiện ra trên màn hình.',
        test: (code) => /countEl\.(?:textContent|innerText|innerHTML)\s*=/i.test(code),
      },
    ],
    helperBlocks: [
      {
        id: 'add-one',
        labelEn: 'Add +1 Star',
        labelVi: 'Cộng +1 Sao',
        snippetPreview: 'stars = stars + 1;',
        apply: (code) =>
          code.includes('/* TODO: add 1 to stars */')
            ? code.replace('/* TODO: add 1 to stars */', 'stars = stars + 1;')
            : code.replace(/let stars = 0;/i, 'let stars = 0;\n  // Tip: stars = stars + 1; inside onclick'),
      },
      {
        id: 'add-five',
        labelEn: 'Super +5 Stars',
        labelVi: 'Siêu Tốc +5 Sao',
        snippetPreview: 'stars += 5;',
        apply: (code) =>
          code.includes('/* TODO: add 1 to stars */')
            ? code.replace('/* TODO: add 1 to stars */', 'stars += 5;')
            : code.replace(/stars\s*=\s*stars\s*\+\s*\d+;/i, 'stars += 5;'),
      },
    ],
  },
  {
    id: 'secret-treasure-reveal',
    order: 4,
    category: 'js',
    difficulty: 'medium',
    xpReward: 85,
    titleEn: '04. Secret Treasure Chest',
    titleVi: '04. Mở Rương Kho Báu Bí Mật',
    missionEn:
      'There is a hidden treasure message on this page! Write JavaScript so clicking "Open Chest" reveals the treasure and updates the button text.',
    missionVi:
      'Có một kho báu đang ẩn trên trang web! Hãy viết JavaScript để khi bấm "Open Chest", kho báu sẽ hiện ra và chữ trên nút cũng đổi theo.',
    hintEn: "Set treasure.style.display = 'block'; and openBtn.textContent = 'Chest Opened! 🎉'; inside openBtn.onclick.",
    hintVi: "Thêm treasure.style.display = 'block'; và openBtn.textContent = 'Đã Mở Rương! 🎉'; vào trong hàm openBtn.onclick.",
    concepts: ['DOM Style Control', 'Event Listeners'],
    starterCode: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; background: #fefce8; font-family: system-ui, sans-serif; color: #172154; padding: 20px; text-align: center; }
  button { background: #172154; color: #ffd41d; border: none; border-radius: 14px; padding: 14px 26px; font-size: 16px; font-weight: 800; cursor: pointer; }
  #treasure { display: none; background: #ffffff; border: 2px solid #f59e0b; border-radius: 18px; padding: 18px 24px; font-size: 18px; font-weight: 800; color: #b45309; }
</style>
</head>
<body>
  <h2>🗺️ Pirates of LiLab Island</h2>
  <button id="openBtn">Open Treasure Chest</button>
  <div id="treasure">💎 You unlocked the Golden Star Key!</div>
<script>
  const openBtn = document.getElementById('openBtn');
  const treasure = document.getElementById('treasure');
  openBtn.onclick = () => {
    /* TODO: show treasure */
    /* TODO: update button text */
  };
</script>
</body>
</html>`,
    goals: [
      {
        id: 'show-treasure',
        labelEn: "Reveal the hidden #treasure box (display = 'block')",
        labelVi: "Làm hiện hộp kho báu #treasure (display = 'block')",
        tipEn: "Add treasure.style.display = 'block'; inside openBtn.onclick.",
        tipVi: "Thêm treasure.style.display = 'block'; vào trong openBtn.onclick.",
        test: (code) =>
          /treasure\.style\.display\s*=\s*['"](?:block|flex|inline-block)['"]/i.test(code),
      },
      {
        id: 'change-btn-label',
        labelEn: 'Change the button text after opening the chest',
        labelVi: 'Đổi chữ trên nút sau khi mở rương',
        tipEn: "Add openBtn.textContent = 'Chest Opened! 🎉'; inside openBtn.onclick.",
        tipVi: "Thêm openBtn.textContent = 'Chest Opened! 🎉'; vào trong openBtn.onclick.",
        test: (code) => /openBtn\.(?:textContent|innerText)\s*=\s*['"][^'"]+['"]/i.test(code),
      },
    ],
    helperBlocks: [
      {
        id: 'reveal-box',
        labelEn: 'Reveal Treasure',
        labelVi: 'Hiện Kho Báu',
        snippetPreview: "treasure.style.display = 'block';",
        apply: (code) =>
          code.replace('/* TODO: show treasure */', "treasure.style.display = 'block';"),
      },
      {
        id: 'opened-label',
        labelEn: 'Update Button Text',
        labelVi: 'Đổi Chữ Trên Nút',
        snippetPreview: "openBtn.textContent = 'Chest Opened! 🎉';",
        apply: (code) =>
          code.replace(
            '/* TODO: update button text */',
            "openBtn.textContent = 'Chest Opened! 🎉';"
          ),
      },
    ],
  },
  {
    id: 'space-rocket-launch',
    order: 5,
    category: 'css',
    difficulty: 'medium',
    xpReward: 90,
    titleEn: '05. Space Rocket Launchpad',
    titleVi: '05. Bệ Phóng Tên Lửa Vũ Trụ',
    missionEn:
      'Power up the launchpad! Add a CSS transform inside .rocket.launched so the rocket flies upward, and give it a bright golden glow.',
    missionVi:
      'Khởi động bệ phóng nào! Thêm thuộc tính CSS transform trong .rocket.launched để tên lửa bay vút lên cao và tỏa ánh sáng vàng rực rỡ.',
    hintEn: 'Inside .rocket.launched { ... }, add transform: translateY(-90px); and filter: drop-shadow(0 12px 16px #ffd41d);',
    hintVi: 'Bên trong .rocket.launched { ... }, thêm transform: translateY(-90px); và filter: drop-shadow(0 12px 16px #ffd41d);',
    concepts: ['CSS Transforms', 'Smooth Transitions', 'Glow Filters'],
    starterCode: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 22px; padding-bottom: 42px; background: radial-gradient(circle at 50% 20%, #1e3a8a, #0f172a); color: #fff; font-family: system-ui, sans-serif; }
  .rocket { font-size: 68px; transition: transform 0.7s ease, filter 0.5s ease; }
  .rocket.launched {
    /* TODO: move rocket up */
    /* TODO: add rocket glow */
  }
  button { background: #ff6b00; color: #fff; border: none; border-radius: 14px; padding: 12px 24px; font-size: 16px; font-weight: 800; cursor: pointer; }
</style>
</head>
<body>
  <div class="rocket" id="rocket">🚀</div>
  <button onclick="document.getElementById('rocket').classList.toggle('launched')">Launch Rocket!</button>
</body>
</html>`,
    goals: [
      {
        id: 'rocket-lift',
        labelEn: 'Move the rocket upward using translateY(-...)',
        labelVi: 'Đẩy tên lửa bay lên cao bằng translateY(-...)',
        tipEn: 'Add transform: translateY(-90px); inside .rocket.launched.',
        tipVi: 'Thêm transform: translateY(-90px); vào bên trong .rocket.launched.',
        test: (code) => {
          const block = code.match(/\.rocket\.launched\s*\{([\s\S]*?)\}/i)?.[1] || '';
          return /translateY\s*\(\s*-\d+/i.test(block);
        },
      },
      {
        id: 'rocket-glow',
        labelEn: 'Add a golden glow or scale boost when launched',
        labelVi: 'Thêm hiệu ứng phát sáng hoặc phóng to khi phóng lên',
        tipEn: 'Add filter: drop-shadow(0 12px 16px #ffd41d); or scale(1.15) inside .rocket.launched.',
        tipVi: 'Thêm filter: drop-shadow(0 12px 16px #ffd41d); hoặc scale(1.15) trong .rocket.launched.',
        test: (code) => {
          const block = code.match(/\.rocket\.launched\s*\{([\s\S]*?)\}/i)?.[1] || '';
          return /(?:drop-shadow|box-shadow|text-shadow|scale\s*\()/i.test(block);
        },
      },
    ],
    helperBlocks: [
      {
        id: 'lift-up',
        labelEn: 'Fly Upward',
        labelVi: 'Bay Vút Lên Cao',
        snippetPreview: 'transform: translateY(-100px) scale(1.15);',
        apply: (code) =>
          code.replace('/* TODO: move rocket up */', 'transform: translateY(-100px) scale(1.15);'),
      },
      {
        id: 'golden-glow',
        labelEn: 'Add Golden Glow',
        labelVi: 'Thêm Ánh Sáng Vàng',
        snippetPreview: 'filter: drop-shadow(0 14px 18px #ffd41d);',
        apply: (code) =>
          code.replace(
            '/* TODO: add rocket glow */',
            'filter: drop-shadow(0 14px 18px #ffd41d);'
          ),
      },
    ],
  },
  {
    id: 'bug-detective-score',
    order: 6,
    category: 'bugfix',
    difficulty: 'medium',
    xpReward: 100,
    titleEn: '06. Bug Detective: Broken Scoreboard',
    titleVi: '06. Thám Tử Sửa Lỗi Bảng Điểm',
    missionEn:
      'Uh oh! Two sneaky bugs broke our arcade scoreboard! Fix the string number bug ("0") and the misspelled ID ("scroe") so +10 points adds properly.',
    missionVi:
      'Ôi không! Có 2 chú bọ lỗi làm hỏng bảng điểm! Hãy sửa lỗi chuỗi chữ ("0") và lỗi viết sai chính tả ("scroe") để cộng +10 điểm thật chuẩn nhé.',
    hintEn: 'Change let score = "0"; to let score = 0; (no quotes) and fix getElementById("scroe") to getElementById("score").',
    hintVi: 'Sửa let score = "0"; thành let score = 0; (bỏ dấu ngoặc kép) và sửa "scroe" thành "score".',
    concepts: ['Debugging', 'Numbers vs Strings', 'Element IDs'],
    starterCode: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #fdf2f8; font-family: system-ui, sans-serif; color: #172154; }
  .board { background: #fff; border: 2px solid #fbcfe8; border-radius: 20px; padding: 24px 36px; text-align: center; }
  .num { font-size: 46px; font-weight: 900; color: #e61e64; }
  button { background: #e61e64; color: #fff; border: none; border-radius: 12px; padding: 12px 22px; font-weight: 800; font-size: 15px; cursor: pointer; margin-top: 12px; }
</style>
</head>
<body>
  <div class="board">
    <div>Arcade Score</div>
    <div class="num" id="score">0</div>
    <button id="addBtn">+10 Points</button>
  </div>
<script>
  let score = "0";
  document.getElementById('addBtn').onclick = () => {
    score = score + 10;
    document.getElementById('scroe').textContent = score;
  };
</script>
</body>
</html>`,
    goals: [
      {
        id: 'fix-number-type',
        labelEn: 'Bug 1: Change score from text "0" to the real number 0',
        labelVi: 'Lỗi 1: Đổi score từ chữ "0" thành số 0 thật sự',
        tipEn: 'Remove the quotes around "0" so it reads: let score = 0;',
        tipVi: 'Bỏ dấu ngoặc kép quanh "0" để thành: let score = 0;',
        test: (code) => /\blet\s+score\s*=\s*0\s*;/i.test(code),
      },
      {
        id: 'fix-id-typo',
        labelEn: "Bug 2: Fix the misspelled ID 'scroe' to 'score'",
        labelVi: "Lỗi 2: Sửa tên ID bị sai chính tả 'scroe' thành 'score'",
        tipEn: "Change document.getElementById('scroe') to document.getElementById('score').",
        tipVi: "Sửa document.getElementById('scroe') thành document.getElementById('score').",
        test: (code) =>
          /getElementById\s*\(\s*['"]score['"]\s*\)/i.test(code) && !/scroe/i.test(code),
      },
    ],
    helperBlocks: [
      {
        id: 'fix-zero',
        labelEn: 'Fix Bug 1 (Number 0)',
        labelVi: 'Sửa Lỗi 1 (Số 0)',
        snippetPreview: 'let score = 0;',
        apply: (code) => code.replace(/let\s+score\s*=\s*['"]0['"]\s*;/i, 'let score = 0;'),
      },
      {
        id: 'fix-typo',
        labelEn: "Fix Bug 2 ('score' ID)",
        labelVi: "Sửa Lỗi 2 (ID 'score')",
        snippetPreview: "getElementById('score')",
        apply: (code) => code.replace(/['"]scroe['"]/gi, "'score'"),
      },
    ],
  },
  {
    id: 'bilingual-greeting-card',
    order: 7,
    category: 'html',
    difficulty: 'medium',
    xpReward: 95,
    titleEn: '07. Bilingual Kindness Card',
    titleVi: '07. Thiệp Lòng Tốt Song Ngữ',
    missionEn:
      'Design a warm LiLab greeting card! Add a Vietnamese message alongside the English greeting and frame the card with a colorful border.',
    missionVi:
      'Hãy thiết kế một tấm thiệp song ngữ ấm áp! Thêm lời chúc bằng Tiếng Việt bên cạnh câu Tiếng Anh và trang trí khung viền thật đẹp cho tấm thiệp.',
    hintEn: 'Add a <p> with Vietnamese words like "Xin chào" or "Chúc bạn một ngày vui!" and add border: 3px solid #0d9488; to .card.',
    hintVi: 'Thêm thẻ <p> chứa lời chúc Tiếng Việt như "Xin chào" hoặc "Chúc bạn vui vẻ!" và thêm border: 3px solid #0d9488; vào .card.',
    concepts: ['Bilingual UI', 'CSS Borders & Shadows'],
    starterCode: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f0fdfa; font-family: system-ui, sans-serif; color: #172154; padding: 20px; }
  .card {
    background: #ffffff;
    border-radius: 24px;
    padding: 28px;
    max-width: 380px;
    width: 100%;
    text-align: center;
    /* TODO: add colorful border */
  }
  h2 { margin: 0 0 8px; color: #0d9488; }
  .vi { color: #ff6b00; font-weight: 700; margin-top: 8px; }
</style>
</head>
<body>
  <div class="card">
    <div style="font-size:44px">🌻</div>
    <h2>Have a Wonderful Day!</h2>
    <!-- TODO: add Vietnamese greeting -->
  </div>
</body>
</html>`,
    goals: [
      {
        id: 'add-vi-text',
        labelEn: 'Add a Vietnamese greeting inside the card',
        labelVi: 'Thêm lời chúc bằng Tiếng Việt vào trong thiệp',
        tipEn: 'Add <p class="vi">Xin chào! Chúc bạn một ngày thật vui!</p> inside the .card div.',
        tipVi: 'Thêm dòng <p class="vi">Xin chào! Chúc bạn một ngày thật vui!</p> vào trong thẻ .card.',
        test: (code) =>
          /(?:xin\s*ch[aà]o|ch[uú]c|ch[aà]o\s*b[aạ]n|c[aả]m\s*[oơ]n|y[eê]u\s*th[uươ][oơ]ng|tuy[eệ]t\s*v[oờ]i)/i.test(
            code
          ),
      },
      {
        id: 'style-card-border',
        labelEn: 'Frame the .card with a colored CSS border',
        labelVi: 'Thêm đường viền màu sắc cho .card bằng CSS border',
        tipEn: 'Add border: 3px solid #0d9488; inside the .card CSS rule.',
        tipVi: 'Thêm border: 3px solid #0d9488; vào bên trong khối .card.',
        test: (code) => {
          const cardBlock = code.match(/\.card\s*\{([\s\S]*?)\}/i)?.[1] || '';
          return /border\s*:\s*\d+px\s+solid\s+[^;]+;/i.test(cardBlock);
        },
      },
    ],
    helperBlocks: [
      {
        id: 'insert-vi',
        labelEn: 'Add Vietnamese Greeting',
        labelVi: 'Thêm Lời Chúc Tiếng Việt',
        snippetPreview: '<p class="vi">Xin chào! Chúc bạn một ngày thật vui! 💛</p>',
        apply: (code) =>
          code.replace(
            '<!-- TODO: add Vietnamese greeting -->',
            '<p class="vi">Xin chào! Chúc bạn một ngày thật vui! 💛</p>'
          ),
      },
      {
        id: 'insert-border',
        labelEn: 'Add Teal Card Border',
        labelVi: 'Thêm Viền Ngọc Lam',
        snippetPreview: 'border: 3px solid #0d9488;',
        apply: (code) =>
          code.replace(
            '/* TODO: add colorful border */',
            'border: 3px solid #0d9488;\n    box-shadow: 0 12px 24px rgba(13,148,136,0.12);'
          ),
      },
    ],
  },
  {
    id: 'pet-mood-switcher',
    order: 8,
    category: 'js',
    difficulty: 'pro',
    xpReward: 120,
    titleEn: '08. Virtual Pet Mood Switcher',
    titleVi: '08. Đổi Tâm Trạng Thú Cưng',
    missionEn:
      'Complete the if / else logic for our pocket puppy! Make the "Sleepy" and "Super" buttons change the pet emoji and mood label.',
    missionVi:
      'Hoàn thiện câu lệnh điều kiện if / else cho chú cún con! Làm cho nút "Sleepy" và "Super" đổi biểu tượng và lời nhắn của cún nhé.',
    hintEn: "Add else if (mood === 'sleepy') { ... } and else if (mood === 'super') { ... } inside setMood(mood).",
    hintVi: "Thêm nhánh else if (mood === 'sleepy') { ... } và else if (mood === 'super') { ... } trong hàm setMood(mood).",
    concepts: ['If / Else Logic', 'Functions', 'Interactive State'],
    starterCode: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f5f3ff; font-family: system-ui, sans-serif; color: #172154; padding: 20px; }
  .box { background: #fff; border: 2px solid #ddd6fe; border-radius: 24px; padding: 26px; text-align: center; max-width: 380px; width: 100%; }
  .pet { font-size: 72px; margin: 6px 0; }
  .label { font-size: 16px; font-weight: 800; color: #7c3aed; margin-bottom: 16px; }
  .row { display: flex; gap: 8px; justify-content: center; }
  button { border: none; border-radius: 12px; padding: 10px 14px; font-weight: 800; color: #fff; cursor: pointer; }
</style>
</head>
<body>
  <div class="box">
    <div class="pet" id="pet">🐶</div>
    <div class="label" id="label">Milo is ready to play!</div>
    <div class="row">
      <button style="background:#059669" onclick="setMood('happy')">Happy</button>
      <button style="background:#2563eb" onclick="setMood('sleepy')">Sleepy</button>
      <button style="background:#ff6b00" onclick="setMood('super')">Super</button>
    </div>
  </div>
<script>
  function setMood(mood) {
    const pet = document.getElementById('pet');
    const label = document.getElementById('label');
    if (mood === 'happy') {
      pet.textContent = '🐶';
      label.textContent = 'Milo is super happy!';
    }
    /* TODO: add sleepy mood */
    /* TODO: add super mood */
  }
</script>
</body>
</html>`,
    goals: [
      {
        id: 'sleepy-branch',
        labelEn: "Add an if / else if branch for mood === 'sleepy'",
        labelVi: "Thêm nhánh điều kiện cho mood === 'sleepy'",
        tipEn: "Add else if (mood === 'sleepy') { pet.textContent = '😴'; label.textContent = 'Zzz... nap time!'; }",
        tipVi: "Thêm else if (mood === 'sleepy') { pet.textContent = '😴'; label.textContent = 'Khò khò... giờ ngủ trưa!'; }",
        test: (code) => /mood\s*===?\s*['"]sleepy['"]/i.test(code),
      },
      {
        id: 'super-branch',
        labelEn: "Add an if / else if branch for mood === 'super'",
        labelVi: "Thêm nhánh điều kiện cho mood === 'super'",
        tipEn: "Add else if (mood === 'super') { pet.textContent = '🦸‍♂️'; label.textContent = 'Super Milo to the rescue!'; }",
        tipVi: "Thêm else if (mood === 'super') { pet.textContent = '🦸‍♂️'; label.textContent = 'Siêu nhân Milo xuất kích!'; }",
        test: (code) => /mood\s*===?\s*['"]super['"]/i.test(code),
      },
    ],
    helperBlocks: [
      {
        id: 'add-sleepy',
        labelEn: 'Add Sleepy Logic',
        labelVi: 'Thêm Trạng Thái Buồn Ngủ',
        snippetPreview: "else if (mood === 'sleepy') { ... }",
        apply: (code) =>
          code.replace(
            '/* TODO: add sleepy mood */',
            `else if (mood === 'sleepy') {\n      pet.textContent = '😴';\n      label.textContent = 'Zzz... cozy nap time!';\n    }`
          ),
      },
      {
        id: 'add-super',
        labelEn: 'Add Super Hero Logic',
        labelVi: 'Thêm Trạng Thái Siêu Anh Hùng',
        snippetPreview: "else if (mood === 'super') { ... }",
        apply: (code) =>
          code.replace(
            '/* TODO: add super mood */',
            `else if (mood === 'super') {\n      pet.textContent = '🦸';\n      label.textContent = 'Super Milo to the rescue!';\n    }`
          ),
      },
    ],
  },
];

export const DIGITAL_BADGES: DigitalBadgeDef[] = [
  {
    id: 'first_spark',
    titleEn: 'First Spark',
    titleVi: 'Tia Sáng Đầu Tiên',
    descEn: 'Complete your first Code Challenge',
    descVi: 'Hoàn thành thử thách lập trình đầu tiên',
    accentHex: '#FF6B00',
    bgSoft: '#FFF7ED',
    ringHex: '#FDBA74',
    iconType: 'spark',
    checkUnlocked: (completed) => completed.length >= 1,
  },
  {
    id: 'html_architect',
    titleEn: 'HTML Architect',
    titleVi: 'Kiến Trúc Sư HTML',
    descEn: 'Finish both HTML Builder challenges',
    descVi: 'Hoàn thành 2 thử thách HTML',
    accentHex: '#0D9488',
    bgSoft: '#F0FDFA',
    ringHex: '#5EEAD4',
    iconType: 'html',
    checkUnlocked: (completed) =>
      completed.includes('hello-hero-banner') && completed.includes('bilingual-greeting-card'),
  },
  {
    id: 'style_painter',
    titleEn: 'Style Painter',
    titleVi: 'Họa Sĩ CSS',
    descEn: 'Master both CSS color & motion quests',
    descVi: 'Chinh phục 2 thử thách màu sắc & chuyển động CSS',
    accentHex: '#2563EB',
    bgSoft: '#EFF6FF',
    ringHex: '#93C5FD',
    iconType: 'css',
    checkUnlocked: (completed) =>
      completed.includes('rainbow-button-pop') && completed.includes('space-rocket-launch'),
  },
  {
    id: 'logic_wizard',
    titleEn: 'Logic Wizard',
    titleVi: 'Phù Thủy Logic',
    descEn: 'Complete at least 2 JavaScript challenges',
    descVi: 'Hoàn thành ít nhất 2 thử thách JavaScript',
    accentHex: '#7C3AED',
    bgSoft: '#F5F3FF',
    ringHex: '#C4B5FD',
    iconType: 'js',
    checkUnlocked: (completed) => {
      const jsIds = ['emoji-click-counter', 'secret-treasure-reveal', 'pet-mood-switcher'];
      return jsIds.filter((id) => completed.includes(id)).length >= 2;
    },
  },
  {
    id: 'bug_buster',
    titleEn: 'Bug Buster',
    titleVi: 'Thợ Săn Bọ Lỗi',
    descEn: 'Solve Bug Detective: Broken Scoreboard',
    descVi: 'Giải mã thành công Thám Tử Sửa Lỗi',
    accentHex: '#E61E64',
    bgSoft: '#FDF2F8',
    ringHex: '#F9A8D4',
    iconType: 'bug',
    checkUnlocked: (completed) => completed.includes('bug-detective-score'),
  },
  {
    id: 'vibe_master',
    titleEn: 'LiLab Vibe Master',
    titleVi: 'Bậc Thầy Vibe LiLab',
    descEn: 'Earn 400+ XP or finish 6+ challenges',
    descVi: 'Đạt 400+ XP hoặc hoàn thành 6+ thử thách',
    accentHex: '#D97706',
    bgSoft: '#FFFBEB',
    ringHex: '#FCD34D',
    iconType: 'crown',
    checkUnlocked: (completed, xp) => xp >= 400 || completed.length >= 6,
  },
];

export function evaluateEarnedBadges(completedIds: string[], xpPoints: number): string[] {
  return DIGITAL_BADGES.filter((b) => b.checkUnlocked(completedIds, xpPoints)).map((b) => b.id);
}

function playCelebrationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const startAt = ctx.currentTime + i * 0.085;
      gain.gain.setValueAtTime(0.001, startAt);
      gain.gain.linearRampToValueAtTime(0.11, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.29);
    });
  } catch {
    // Audio playback is optional
  }
}

const BadgeMedallionSvg: React.FC<{
  badge: DigitalBadgeDef;
  unlocked: boolean;
  size?: number;
}> = ({ badge, unlocked, size = 56 }) => {
  const stroke = unlocked ? badge.accentHex : '#94A3B8';
  const fill = unlocked ? badge.bgSoft : '#F1F5F9';
  const ring = unlocked ? badge.ringHex : '#CBD5E1';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="32" cy="32" r="29" fill={fill} stroke={ring} strokeWidth="3" />
      <circle
        cx="32"
        cy="32"
        r="23"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeDasharray={unlocked ? undefined : '3 3'}
        opacity={unlocked ? 0.4 : 0.5}
      />
      {badge.iconType === 'spark' && (
        <path
          d="M32 15L36.2 26.8L48 31L36.2 35.2L32 47L27.8 35.2L16 31L27.8 26.8L32 15Z"
          fill={unlocked ? badge.accentHex : '#CBD5E1'}
        />
      )}
      {badge.iconType === 'html' && (
        <g stroke={stroke} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 23L16 32L24 41" />
          <path d="M40 23L48 32L40 41" />
          <path d="M35 20L29 44" />
        </g>
      )}
      {badge.iconType === 'css' && (
        <g>
          <path
            d="M32 17C23.7 17 17 23.3 17 31C17 38.7 23.7 45 32 45C34.5 45 36.2 43.4 36.2 41.3C36.2 40.3 35.8 39.4 35.2 38.7C34.6 38 34.9 37 35.8 37H38.5C43.2 37 47 33.4 47 28.8C47 22.1 40.3 17 32 17Z"
            fill={unlocked ? badge.accentHex : '#CBD5E1'}
            opacity={unlocked ? 0.2 : 0.4}
            stroke={stroke}
            strokeWidth="2.5"
          />
          <circle cx="25" cy="28" r="2.4" fill={stroke} />
          <circle cx="32" cy="24" r="2.4" fill={stroke} />
          <circle cx="39" cy="28" r="2.4" fill={stroke} />
        </g>
      )}
      {badge.iconType === 'js' && (
        <path
          d="M35 15L20 35H31L29 49L44 29H33L35 15Z"
          fill={unlocked ? badge.accentHex : '#CBD5E1'}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
      {badge.iconType === 'bug' && (
        <g stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <ellipse
            cx="32"
            cy="35"
            rx="9"
            ry="11"
            fill={unlocked ? badge.accentHex : '#CBD5E1'}
            opacity={unlocked ? 0.2 : 0.35}
          />
          <path d="M27 24C27 21 29.2 19 32 19C34.8 19 37 21 37 24" />
          <path d="M19 29L23 31M45 29L41 31M18 36H23M41 36H46M20 43L24 41M44 43L40 41" />
        </g>
      )}
      {badge.iconType === 'crown' && (
        <path
          d="M17 42L20 24L28 31L32 20L36 31L44 24L47 42H17Z"
          fill={unlocked ? badge.accentHex : '#CBD5E1'}
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

interface VibeCodeChallengesProps {
  lang: LangCode;
  studentName: string;
  progress: VibeCodeProgressState;
  onCompleteChallenge: (
    challenge: CodeChallengeItem,
    newlyEarnedBadgeIds: string[],
    solvedHtml: string
  ) => void;
  onOpenInBuilder: (payload: {
    titleEn: string;
    titleVi: string;
    summaryEn: string;
    summaryVi: string;
    concepts: string[];
    html: string;
  }) => void;
}

export const VibeCodeChallenges: React.FC<VibeCodeChallengesProps> = ({
  lang,
  studentName,
  progress,
  onCompleteChallenge,
  onOpenInBuilder,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<ChallengeCategory>('all');
  const [showBadgeDrawer, setShowBadgeDrawer] = useState(false);

  // Pick first incomplete challenge as default active quest
  const initialChallengeId = useMemo(() => {
    const firstPending = CODE_CHALLENGES.find(
      (c) => !progress.completedChallengeIds.includes(c.id)
    );
    return firstPending?.id || CODE_CHALLENGES[0].id;
  }, []);

  const [activeChallengeId, setActiveChallengeId] = useState<string>(initialChallengeId);
  const [draftsByChallenge, setDraftsByChallenge] = useState<Record<string, string>>({});
  const [liveByChallenge, setLiveByChallenge] = useState<Record<string, string>>({});
  const [iframeTick, setIframeTick] = useState(1);
  const [showHint, setShowHint] = useState(false);
  const [helperNotice, setHelperNotice] = useState<string | null>(null);
  const [checkFeedback, setCheckFeedback] = useState<{
    status: 'idle' | 'needs_work' | 'passed';
    message: string;
    earnedXpNow?: number;
    newBadgeIds?: string[];
  }>({ status: 'idle', message: '' });

  const activeChallenge = useMemo(
    () => CODE_CHALLENGES.find((c) => c.id === activeChallengeId) || CODE_CHALLENGES[0],
    [activeChallengeId]
  );

  const currentDraft = draftsByChallenge[activeChallenge.id] ?? activeChallenge.starterCode;
  const currentLiveHtml = liveByChallenge[activeChallenge.id] ?? activeChallenge.starterCode;

  const goalResults = useMemo(
    () =>
      activeChallenge.goals.map((g) => ({
        goal: g,
        passed: g.test(currentDraft),
      })),
    [activeChallenge, currentDraft]
  );

  const filteredChallenges = useMemo(
    () =>
      categoryFilter === 'all'
        ? CODE_CHALLENGES
        : CODE_CHALLENGES.filter((c) => c.category === categoryFilter),
    [categoryFilter]
  );

  const rank = useMemo(() => getCoderRank(progress.xpPoints), [progress.xpPoints]);
  const completedCount = progress.completedChallengeIds.length;
  const isCurrentCompleted = progress.completedChallengeIds.includes(activeChallenge.id);

  const handleSelectChallenge = (challenge: CodeChallengeItem) => {
    setActiveChallengeId(challenge.id);
    setShowHint(false);
    setHelperNotice(null);
    setCheckFeedback({ status: 'idle', message: '' });
    setIframeTick((t) => t + 1);
  };

  const updateDraft = (nextCode: string) => {
    setDraftsByChallenge((prev) => ({ ...prev, [activeChallenge.id]: nextCode }));
  };

  const handleApplyHelperBlock = (block: ChallengeHelperBlock) => {
    const nextCode = block.apply(currentDraft);
    updateDraft(nextCode);
    setLiveByChallenge((prev) => ({ ...prev, [activeChallenge.id]: nextCode }));
    setIframeTick((t) => t + 1);
    setHelperNotice(
      biText(
        lang,
        `Added "${block.labelEn}" to your code! Check the preview and click "Run & Check My Code".`,
        `Đã thêm "${block.labelVi}" vào mã của em! Xem màn hình bên phải rồi bấm "Chạy & Kiểm Tra Code".`
      )
    );
  };

  const handleResetStarter = () => {
    updateDraft(activeChallenge.starterCode);
    setLiveByChallenge((prev) => ({
      ...prev,
      [activeChallenge.id]: activeChallenge.starterCode,
    }));
    setIframeTick((t) => t + 1);
    setHelperNotice(null);
    setCheckFeedback({ status: 'idle', message: '' });
  };

  const handleRunAndCheck = () => {
    setLiveByChallenge((prev) => ({ ...prev, [activeChallenge.id]: currentDraft }));
    setIframeTick((t) => t + 1);
    setHelperNotice(null);

    const results = activeChallenge.goals.map((g) => ({
      goal: g,
      passed: g.test(currentDraft),
    }));
    const firstFailed = results.find((r) => !r.passed);

    if (firstFailed) {
      setCheckFeedback({
        status: 'needs_work',
        message: biText(lang, firstFailed.goal.tipEn, firstFailed.goal.tipVi),
      });
      return;
    }

    // All goals passed!
    playCelebrationChime();
    const alreadyDone = progress.completedChallengeIds.includes(activeChallenge.id);
    const nextCompleted = alreadyDone
      ? progress.completedChallengeIds
      : [...progress.completedChallengeIds, activeChallenge.id];
    const nextXp = alreadyDone ? progress.xpPoints : progress.xpPoints + activeChallenge.xpReward;
    const allBadgesAfter = evaluateEarnedBadges(nextCompleted, nextXp);
    const newlyUnlocked = allBadgesAfter.filter((id) => !progress.earnedBadgeIds.includes(id));

    if (!alreadyDone) {
      onCompleteChallenge(activeChallenge, newlyUnlocked, currentDraft);
    }

    setCheckFeedback({
      status: 'passed',
      earnedXpNow: alreadyDone ? 0 : activeChallenge.xpReward,
      newBadgeIds: newlyUnlocked,
      message: alreadyDone
        ? biText(
            lang,
            'Awesome replay! Every goal passed again. Try the next challenge or remix this app in the App Builder!',
            'Xuất sắc! Em đã hoàn thành lại thử thách này cực chuẩn. Thử nhiệm vụ tiếp theo hoặc mở trong Xưởng Tạo Ứng Dụng nhé!'
          )
        : biText(
            lang,
            `Quest Complete, ${studentName}! You earned +${activeChallenge.xpReward} XP!`,
            `Hoàn thành xuất sắc, ${studentName}! Em vừa nhận được +${activeChallenge.xpReward} XP!`
          ),
    });
  };

  const handleGoNextChallenge = () => {
    const idx = CODE_CHALLENGES.findIndex((c) => c.id === activeChallenge.id);
    const next =
      CODE_CHALLENGES.slice(idx + 1).find(
        (c) => !progress.completedChallengeIds.includes(c.id)
      ) || CODE_CHALLENGES[(idx + 1) % CODE_CHALLENGES.length];
    handleSelectChallenge(next);
  };

  const categoryLabel = (cat: Exclude<ChallengeCategory, 'all'>) => {
    switch (cat) {
      case 'html':
        return biText(lang, 'HTML Basics', 'HTML Cơ Bản');
      case 'css':
        return biText(lang, 'CSS Style', 'Màu Sắc CSS');
      case 'js':
        return biText(lang, 'JavaScript', 'JavaScript');
      case 'bugfix':
        return biText(lang, 'Bug Fixer', 'Sửa Lỗi Bug');
    }
  };

  const difficultyLabel = (diff: ChallengeDifficulty) => {
    switch (diff) {
      case 'easy':
        return biText(lang, 'Starter', 'Khởi đầu');
      case 'medium':
        return biText(lang, 'Explorer', 'Khám phá');
      case 'pro':
        return biText(lang, 'Pro Kid', 'Siêu nhí');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. XP, Rank & Digital Badges Overview Bar */}
      <section className="bg-white border border-[#172154]/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF5EE] border border-[#FF6B00]/20 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6 text-[#FF6B00]" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#525E80]">
                {biText(lang, `Level ${rank.level}`, `Cấp ${rank.level}`)}
                {' · '}
                <span className="text-[#FF6B00]">
                  {biText(lang, rank.titleEn, rank.titleVi)}
                </span>
                {' · '}
                <span className="tabular-nums text-[#172154]">
                  {completedCount}/{CODE_CHALLENGES.length}{' '}
                  {biText(lang, 'Quests Done', 'Nhiệm vụ')}
                </span>
              </div>
              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="font-display text-2xl font-extrabold text-[#172154] tabular-nums">
                  {progress.xpPoints} XP
                </span>
                <span className="text-xs text-[#525E80] tabular-nums">
                  {rank.level >= CODER_RANKS.length
                    ? biText(lang, 'Top Rank Achieved!', 'Đã đạt cấp bậc cao nhất!')
                    : biText(
                        lang,
                        `${Math.max(0, rank.nextXp - progress.xpPoints)} XP to Level ${rank.level + 1}`,
                        `Còn ${Math.max(0, rank.nextXp - progress.xpPoints)} XP lên Cấp ${rank.level + 1}`
                      )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {progress.currentStreak > 0 && (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D97706] tabular-nums">
                <Flame className="w-4 h-4" />
                {biText(
                  lang,
                  `${progress.currentStreak} Quest Streak`,
                  `Chuỗi ${progress.currentStreak} nhiệm vụ`
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowBadgeDrawer((v) => !v)}
              className={`px-3.5 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showBadgeDrawer
                  ? 'bg-[#172154] text-white border-[#172154]'
                  : 'bg-[#FFFBEB] text-[#172154] border-[#F59E0B]/35 hover:bg-[#FEF3C7]'
              }`}
            >
              <Award className={`w-4 h-4 ${showBadgeDrawer ? 'text-[#FFD41D]' : 'text-[#D97706]'}`} />
              {biText(
                lang,
                `Digital Badges (${progress.earnedBadgeIds.length}/${DIGITAL_BADGES.length})`,
                `Huy Hiệu Số (${progress.earnedBadgeIds.length}/${DIGITAL_BADGES.length})`
              )}
            </button>
          </div>
        </div>

        {/* Clean Level XP Bar */}
        <div className="space-y-1">
          <div className="h-2.5 w-full rounded-full bg-[#EEF2F7] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#FF6B00] transition-all duration-300"
              style={{ width: `${rank.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Expandable Digital Badges Trophy Shelf */}
        {showBadgeDrawer && (
          <div className="pt-4 border-t border-[#172154]/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-[#172154]">
                {biText(lang, 'Your Digital Badge Collection', 'Bộ Sưu Tập Huy Hiệu Số Của Em')}
              </h3>
              <span className="text-xs text-[#525E80] tabular-nums">
                {progress.earnedBadgeIds.length} / {DIGITAL_BADGES.length}{' '}
                {biText(lang, 'Unlocked', 'Đã mở khóa')}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DIGITAL_BADGES.map((badge) => {
                const unlocked = progress.earnedBadgeIds.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`rounded-2xl border p-3.5 flex items-center gap-3.5 transition-colors ${
                      unlocked
                        ? 'bg-white border-[#172154]/12'
                        : 'bg-[#F8FAFC] border-[#172154]/8 opacity-75'
                    }`}
                  >
                    <BadgeMedallionSvg badge={badge} unlocked={unlocked} size={52} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display text-sm font-bold text-[#172154] truncate">
                          {biText(lang, badge.titleEn, badge.titleVi)}
                        </span>
                        {unlocked ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#525E80] mt-0.5 leading-snug">
                        {biText(lang, badge.descEn, badge.descVi)}
                      </p>
                      <div className="text-[11px] font-semibold mt-1 text-[#525E80]">
                        {unlocked
                          ? biText(lang, 'Earned', 'Đã đạt được')
                          : biText(lang, 'Locked', 'Chưa mở khóa')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 2. Quest Filter Bar & Horizontal Challenge Selector */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-[#172154]">
            {biText(lang, 'Choose a Coding Quest', 'Chọn Một Nhiệm Vụ Lập Trình')}
          </h2>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2F4F8] rounded-xl border border-[#172154]/8">
            {(
              [
                { id: 'all', en: 'All Quests', vi: 'Tất cả' },
                { id: 'html', en: 'HTML', vi: 'HTML' },
                { id: 'css', en: 'CSS Style', vi: 'CSS' },
                { id: 'js', en: 'JavaScript', vi: 'JavaScript' },
                { id: 'bugfix', en: 'Bug Fixer', vi: 'Sửa Lỗi' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  categoryFilter === tab.id
                    ? 'bg-white text-[#172154] shadow-xs'
                    : 'text-[#525E80] hover:text-[#172154]'
                }`}
              >
                {biText(lang, tab.en, tab.vi)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {filteredChallenges.map((item) => {
            const done = progress.completedChallengeIds.includes(item.id);
            const selected = item.id === activeChallenge.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectChallenge(item)}
                className={`text-left rounded-2xl border p-3.5 transition-colors cursor-pointer flex flex-col justify-between gap-2.5 ${
                  selected
                    ? 'bg-[#FFF5EE] border-[#FF6B00]'
                    : done
                      ? 'bg-white border-[#0D9488]/30 hover:border-[#0D9488]'
                      : 'bg-white border-[#172154]/10 hover:border-[#172154]/30'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#525E80]">
                    <span>
                      {categoryLabel(item.category)} · {difficultyLabel(item.difficulty)}
                    </span>
                    {done ? (
                      <span className="inline-flex items-center gap-1 text-[#0D9488] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {biText(lang, 'Done', 'Xong')}
                      </span>
                    ) : (
                      <span className="font-bold text-[#FF6B00] tabular-nums">
                        +{item.xpReward} XP
                      </span>
                    )}
                  </div>
                  <div className="font-display text-sm font-bold text-[#172154] leading-snug">
                    {biText(lang, item.titleEn, item.titleVi)}
                  </div>
                </div>
                <div className="text-[11px] text-[#525E80] truncate">
                  {item.concepts.join(' · ')}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Two-Zone Interactive Challenge Arena (5 cols Mission + Editor | 7 cols Live Stage + Feedback) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT ZONE: Mission Brief, Live Checklist, Helper Blocks & Code Editor */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#525E80]">
                  {categoryLabel(activeChallenge.category)}
                  {' · '}
                  {difficultyLabel(activeChallenge.difficulty)}
                  {' · '}
                  <span className="text-[#FF6B00] tabular-nums">
                    +{activeChallenge.xpReward} XP
                  </span>
                </div>
                <h3 className="font-display text-xl font-extrabold text-[#172154] mt-0.5">
                  {biText(lang, activeChallenge.titleEn, activeChallenge.titleVi)}
                </h3>
              </div>
              {isCurrentCompleted && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0D9488] shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                  {biText(lang, 'Completed', 'Đã hoàn thành')}
                </span>
              )}
            </div>

            <p className="text-sm text-[#525E80] leading-relaxed">
              {biText(lang, activeChallenge.missionEn, activeChallenge.missionVi)}
            </p>

            {/* Real-Time Goal Checklist (Icon + Explicit Text) */}
            <div className="space-y-2 pt-3 border-t border-[#172154]/8">
              <div className="text-xs font-bold text-[#172154]">
                {biText(lang, 'Quest Checklist', 'Danh Sách Mục Tiêu')}
              </div>
              <ul className="space-y-2">
                {goalResults.map(({ goal, passed }) => (
                  <li
                    key={goal.id}
                    className={`flex items-start gap-2.5 text-xs rounded-xl px-3 py-2 border ${
                      passed
                        ? 'bg-[#F0FDFA] border-[#0D9488]/25 text-[#0F766E]'
                        : 'bg-[#F8FAFC] border-[#172154]/10 text-[#172154]'
                    }`}
                  >
                    {passed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#94A3B8] shrink-0 mt-0.5" />
                    )}
                    <span className="font-medium leading-snug">
                      {biText(lang, goal.labelEn, goal.labelVi)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Kid-Friendly 1-Tap Helper Blocks */}
            <div className="space-y-2 pt-3 border-t border-[#172154]/8">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#525E80]">
                  {biText(lang, 'Quick Helper Blocks (Tap to Insert)', 'Khối Lệnh Gợi Ý (Chạm để Chèn)')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowHint((v) => !v)}
                  className="text-xs font-bold text-[#2563EB] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {showHint
                    ? biText(lang, 'Hide Hint', 'Ẩn gợi ý')
                    : biText(lang, 'Need a Hint?', 'Xem gợi ý')}
                </button>
              </div>

              {showHint && (
                <div className="rounded-xl bg-[#EFF6FF] border border-[#2563EB]/20 px-3.5 py-2.5 text-xs text-[#1E3A8A] leading-relaxed">
                  {biText(lang, activeChallenge.hintEn, activeChallenge.hintVi)}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {activeChallenge.helperBlocks.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => handleApplyHelperBlock(block)}
                    className="px-3 py-2 rounded-xl bg-[#FFF5EE] hover:bg-[#FFEDD5] border border-[#FF6B00]/25 text-xs font-bold text-[#172154] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                    {biText(lang, block.labelEn, block.labelVi)}
                  </button>
                ))}
              </div>

              {helperNotice && (
                <p className="text-xs font-medium text-[#0F766E]">{helperNotice}</p>
              )}
            </div>
          </div>

          {/* Monospace Live Code Editor */}
          <div className="bg-[#0F172A] text-slate-100 rounded-2xl p-4 space-y-3 border border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FFD41D]">
                <Code2 className="w-4 h-4" />
                {biText(lang, 'Your Quest Code Editor', 'Trình Soạn Thảo Code Của Em')}
              </div>
              <button
                type="button"
                onClick={handleResetStarter}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                {biText(lang, 'Reset Code', 'Đặt lại')}
              </button>
            </div>

            <textarea
              value={currentDraft}
              onChange={(e) => updateDraft(e.target.value)}
              spellCheck={false}
              rows={13}
              aria-label={biText(lang, 'Challenge code editor', 'Trình soạn thảo mã thử thách')}
              className="w-full rounded-xl bg-[#020617] border border-slate-700 p-3 font-mono text-xs leading-relaxed text-emerald-300 focus:outline-none focus:border-[#FF6B00]"
            />

            <button
              type="button"
              onClick={handleRunAndCheck}
              className="w-full py-3 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4" />
              {biText(lang, 'Run & Check My Code', 'Chạy & Kiểm Tra Code')}
            </button>
          </div>
        </div>

        {/* RIGHT ZONE: Live Sandboxed Preview & Celebration Feedback */}
        <div className="lg:col-span-7 space-y-4">
          {/* Celebration / Guidance Feedback Banner */}
          {checkFeedback.status === 'passed' && (
            <div className="bg-[#F0FDFA] border border-[#0D9488]/35 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E]">
                    <Sparkles className="w-4 h-4 text-[#0D9488]" />
                    {biText(lang, 'Mission Accomplished!', 'Hoàn Thành Nhiệm Vụ!')}
                  </div>
                  <h4 className="font-display text-lg font-extrabold text-[#172154]">
                    {checkFeedback.message}
                  </h4>
                </div>
                {checkFeedback.earnedXpNow ? (
                  <div className="font-display text-xl font-extrabold text-[#FF6B00] tabular-nums">
                    +{checkFeedback.earnedXpNow} XP
                  </div>
                ) : null}
              </div>

              {checkFeedback.newBadgeIds && checkFeedback.newBadgeIds.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#0D9488]/20">
                  {checkFeedback.newBadgeIds.map((bId) => {
                    const bDef = DIGITAL_BADGES.find((b) => b.id === bId);
                    if (!bDef) return null;
                    return (
                      <div
                        key={bId}
                        className="flex items-center gap-2.5 bg-white rounded-xl border border-[#172154]/10 px-3 py-2"
                      >
                        <BadgeMedallionSvg badge={bDef} unlocked={true} size={38} />
                        <div>
                          <div className="text-[11px] font-bold text-[#D97706]">
                            {biText(lang, 'New Digital Badge Unlocked!', 'Mở Khóa Huy Hiệu Mới!')}
                          </div>
                          <div className="text-xs font-bold text-[#172154]">
                            {biText(lang, bDef.titleEn, bDef.titleVi)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleGoNextChallenge}
                  className="px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  {biText(lang, 'Next Coding Quest', 'Nhiệm Vụ Tiếp Theo')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenInBuilder({
                      titleEn: activeChallenge.titleEn.replace(/^\d+\.\s*/, ''),
                      titleVi: activeChallenge.titleVi.replace(/^\d+\.\s*/, ''),
                      summaryEn: activeChallenge.missionEn,
                      summaryVi: activeChallenge.missionVi,
                      concepts: activeChallenge.concepts,
                      html: currentDraft,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#172154]/15 text-[#172154] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[#FF6B00]" />
                  {biText(lang, 'Remix in App Builder', 'Mở Rộng trong App Builder')}
                </button>
              </div>
            </div>
          )}

          {checkFeedback.status === 'needs_work' && (
            <div className="bg-[#FFFBEB] border border-[#F59E0B]/35 rounded-2xl p-4 flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-[#92400E]">
                  {biText(lang, 'Almost there! One small tweak left:', 'Sắp xong rồi! Thử chỉnh nhẹ bước này nhé:')}
                </div>
                <p className="text-xs text-[#78350F] leading-relaxed">{checkFeedback.message}</p>
              </div>
            </div>
          )}

          {/* Live Sandboxed Preview Stage */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#172154]/10 bg-[#F8FAFC] flex items-center justify-between gap-2">
              <div>
                <div className="font-display text-sm font-bold text-[#172154]">
                  {biText(lang, 'Live Quest Preview', 'Màn Hình Xem Trước Nhiệm Vụ')}
                </div>
                <div className="text-[11px] text-[#525E80]">
                  {activeChallenge.concepts.join(' · ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLiveByChallenge((prev) => ({
                    ...prev,
                    [activeChallenge.id]: currentDraft,
                  }));
                  setIframeTick((t) => t + 1);
                }}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#172154]/12 hover:bg-[#F2F4F8] text-xs font-semibold text-[#172154] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {biText(lang, 'Refresh Preview', 'Tải lại')}
              </button>
            </div>

            <div className="bg-[#EEF2F7] p-3 sm:p-4">
              <div className="w-full bg-white rounded-2xl overflow-hidden border border-[#172154]/12 shadow-xs">
                <iframe
                  key={`quest-stage-${activeChallenge.id}-${iframeTick}`}
                  title={activeChallenge.titleEn}
                  sandbox="allow-scripts"
                  srcDoc={currentLiveHtml}
                  className="w-full h-[460px] border-0 block bg-white"
                />
              </div>
            </div>
          </div>

          {/* Compact Next-Badge Motivation Strip */}
          <div className="bg-white border border-[#172154]/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {(() => {
                const nextLocked =
                  DIGITAL_BADGES.find((b) => !progress.earnedBadgeIds.includes(b.id)) ||
                  DIGITAL_BADGES[DIGITAL_BADGES.length - 1];
                const isAllUnlocked = progress.earnedBadgeIds.length === DIGITAL_BADGES.length;
                return (
                  <>
                    <BadgeMedallionSvg badge={nextLocked} unlocked={isAllUnlocked} size={42} />
                    <div>
                      <div className="text-[11px] font-bold text-[#525E80]">
                        {isAllUnlocked
                          ? biText(lang, 'All Digital Badges Collected!', 'Đã Sưu Tập Trọn Bộ Huy Hiệu!')
                          : biText(lang, 'Next Badge to Unlock', 'Huy Hiệu Tiếp Theo')}
                      </div>
                      <div className="text-xs font-bold text-[#172154]">
                        {biText(lang, nextLocked.titleEn, nextLocked.titleVi)}
                        {' — '}
                        <span className="font-normal text-[#525E80]">
                          {biText(lang, nextLocked.descEn, nextLocked.descVi)}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            <button
              type="button"
              onClick={() => setShowBadgeDrawer(true)}
              className="text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer whitespace-nowrap"
            >
              {biText(lang, 'View All Badges', 'Xem tất cả huy hiệu')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Award,
  Code2,
  Download,
  FolderHeart,
  Layers,
  Maximize2,
  Minimize2,
  Monitor,
  Palette,
  Play,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Trophy,
  Wand2,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { biText } from '../i18n';
import { generateKidVibeApp } from '../services/aiClient';
import { isSuperAdminEmail } from '../services/seedData';
import type { LangCode, StudentProfile, UserProfile } from '../types';
import {
  CODE_CHALLENGES,
  DIGITAL_BADGES,
  evaluateEarnedBadges,
  getCoderRank,
  VibeCodeChallenges,
  type CodeChallengeItem,
  type VibeCodeProgressState,
} from './VibeCodeChallenges';

interface KidsVibeCodingLabProps {
  lang: LangCode;
  currentUser: UserProfile;
  student: StudentProfile | null;
}

type VibeViewMode = 'explore' | 'studio' | 'challenges' | 'gallery';
type PreviewDevice = 'desktop' | 'tablet' | 'phone';
type VibeThemeId = 'sunny' | 'ocean' | 'forest' | 'starlight';

interface StarterAppTemplate {
  id: string;
  titleEn: string;
  titleVi: string;
  categoryEn: string;
  categoryVi: string;
  summaryEn: string;
  summaryVi: string;
  accentHex: string;
  surfaceBg: string;
  concepts: string[];
  remixIdeasEn: string[];
  remixIdeasVi: string[];
  html: string;
}

interface SavedVibeApp {
  id: string;
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  theme: VibeThemeId;
  concepts: string[];
  html: string;
  savedAt: string;
}

const VIBE_THEMES: Array<{
  id: VibeThemeId;
  labelEn: string;
  labelVi: string;
  bg: string;
  card: string;
  ink: string;
  accent: string;
  accentSoft: string;
}> = [
  {
    id: 'sunny',
    labelEn: 'Sunny Pop',
    labelVi: 'Nắng Vàng',
    bg: '#FFFBEB',
    card: '#FFFFFF',
    ink: '#172154',
    accent: '#FF6B00',
    accentSoft: '#FFEDD5',
  },
  {
    id: 'ocean',
    labelEn: 'Ocean Breeze',
    labelVi: 'Biển Xanh',
    bg: '#F0F9FF',
    card: '#FFFFFF',
    ink: '#0F172A',
    accent: '#0284C7',
    accentSoft: '#E0F2FE',
  },
  {
    id: 'forest',
    labelEn: 'Forest Magic',
    labelVi: 'Rừng Xanh',
    bg: '#F0FDF4',
    card: '#FFFFFF',
    ink: '#14532D',
    accent: '#059669',
    accentSoft: '#DCFCE7',
  },
  {
    id: 'starlight',
    labelEn: 'Starry Night',
    labelVi: 'Đêm Sao',
    bg: '#0F172A',
    card: '#1E293B',
    ink: '#F8FAFC',
    accent: '#F59E0B',
    accentSoft: '#334155',
  },
];

const STARTER_APPS: StarterAppTemplate[] = [
  {
    id: 'star-catcher',
    titleEn: 'Star Catcher Arcade',
    titleVi: 'Trò Chơi Hứng Sao',
    categoryEn: 'Mini Game',
    categoryVi: 'Trò chơi nhỏ',
    summaryEn: 'Move your glowing basket to catch falling golden stars and build a high score!',
    summaryVi: 'Di chuyển giỏ phép thuật để hứng những ngôi sao vàng rơi xuống và ghi điểm cao!',
    accentHex: '#FF6B00',
    surfaceBg: '#FFF7ED',
    concepts: ['Canvas Animation', 'Collision Math', 'Score State'],
    remixIdeasEn: [
      'Add rainbow bonus stars worth 5 points',
      'Make the basket turn into a friendly rocket ship',
      'Add a 30-second countdown timer with confetti at the end',
    ],
    remixIdeasVi: [
      'Thêm sao cầu vồng cộng 5 điểm',
      'Biến chiếc giỏ thành tàu vũ trụ đáng yêu',
      'Thêm đồng hồ đếm ngược 30 giây và pháo giấy chiến thắng',
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Star Catcher Arcade</title>
<style>
  :root { --bg: #0f172a; --card: #1e293b; --ink: #f8fafc; --accent: #ff6b00; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
  body { min-height: 100vh; background: linear-gradient(180deg, #172154 0%, #0f172a 100%); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; gap: 12px; }
  .hud { width: 100%; max-width: 540px; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.1); padding: 10px 16px; border-radius: 14px; font-weight: 700; }
  .hud span { font-size: 16px; }
  .stage-wrap { position: relative; width: 100%; max-width: 540px; }
  canvas { width: 100%; height: 320px; display: block; border-radius: 18px; background: radial-gradient(circle at 50% 20%, #2d3e99, #0b1120); border: 2px solid rgba(255,212,29,0.4); touch-action: none; cursor: pointer; }
  .controls { display: flex; gap: 10px; }
  button { background: #ff6b00; color: #fff; border: none; padding: 10px 20px; border-radius: 12px; font-weight: 800; font-size: 14px; cursor: pointer; }
  button:hover { background: #e05a00; }
  .hint { font-size: 13px; opacity: 0.85; text-align: center; }
</style>
</head>
<body>
  <div class="hud">
    <span>Score: <strong id="score">0</strong></span>
    <span>Best: <strong id="best">0</strong></span>
    <span>Lives: <strong id="lives">❤️❤️❤️</strong></span>
  </div>
  <div class="stage-wrap">
    <canvas id="game" width="540" height="320"></canvas>
  </div>
  <div class="controls">
    <button id="leftBtn">◀ Left</button>
    <button id="restartBtn">Play Again</button>
    <button id="rightBtn">Right ▶</button>
  </div>
  <p class="hint">Drag, move your mouse, or use arrow keys to catch golden stars!</p>
<script>
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  let score = 0, best = 0, lives = 3, running = true;
  let basketX = 270;
  const basketW = 92;
  let stars = [];
  let sparks = [];
  let tick = 0;

  function beep(freq) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.12, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.16);
      osc.connect(g); g.connect(ac.destination);
      osc.start(); osc.stop(ac.currentTime + 0.16);
    } catch (e) {}
  }

  function resetGame() {
    score = 0; lives = 3; stars = []; sparks = []; running = true;
    scoreEl.textContent = '0';
    livesEl.textContent = '❤️❤️❤️';
  }

  function drawStar(x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const b = a + (2 * Math.PI) / 10;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(b) * (r * 0.45), Math.sin(b) * (r * 0.45));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Twinkling background dots
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.25 * Math.sin(tick * 0.04 + i)) + ')';
      ctx.beginPath();
      ctx.arc((i * 73) % 540, (i * 41) % 240, (i % 2) + 1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (running) {
      tick++;
      if (tick % 44 === 0) {
        const isSuper = Math.random() > 0.82;
        stars.push({ x: 30 + Math.random() * 480, y: -15, vy: 2.2 + Math.min(score * 0.07, 2.5), pts: isSuper ? 3 : 1, color: isSuper ? '#38bdf8' : '#ffd41d' });
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const st = stars[i];
        st.y += st.vy;
        drawStar(st.x, st.y, st.pts > 1 ? 16 : 13, st.color);
        if (st.y >= 268 && st.y <= 300 && Math.abs(st.x - basketX) < basketW * 0.56) {
          score += st.pts;
          if (score > best) best = score;
          scoreEl.textContent = String(score);
          bestEl.textContent = String(best);
          beep(st.pts > 1 ? 880 : 620);
          for (let k = 0; k < 8; k++) sparks.push({ x: st.x, y: 274, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4, life: 22, color: st.color });
          stars.splice(i, 1);
        } else if (st.y > 330) {
          lives--;
          livesEl.textContent = lives > 0 ? '❤️'.repeat(lives) : 'Game Over!';
          beep(220);
          stars.splice(i, 1);
          if (lives <= 0) running = false;
        }
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / 22);
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (p.life <= 0) sparks.splice(i, 1);
    }

    // Basket
    ctx.fillStyle = '#ff6b00';
    ctx.beginPath();
    ctx.roundRect(basketX - basketW / 2, 276, basketW, 24, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd41d';
    ctx.fillRect(basketX - basketW / 2 + 12, 282, basketW - 24, 5);

    if (!running) {
      ctx.fillStyle = 'rgba(15,23,42,0.75)';
      ctx.fillRect(110, 105, 320, 105);
      ctx.fillStyle = '#ffd41d';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Awesome Run! Score: ' + score, 270, 150);
      ctx.fillStyle = '#fff';
      ctx.font = '14px system-ui';
      ctx.fillText('Tap Play Again to beat your best!', 270, 182);
    }
    requestAnimationFrame(update);
  }

  function setPointer(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    basketX = Math.max(50, Math.min(490, x));
  }
  canvas.addEventListener('pointermove', (e) => setPointer(e.clientX));
  canvas.addEventListener('pointerdown', (e) => setPointer(e.clientX));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') basketX = Math.max(50, basketX - 36);
    if (e.key === 'ArrowRight') basketX = Math.min(490, basketX + 36);
  });
  document.getElementById('leftBtn').onclick = () => { basketX = Math.max(50, basketX - 42); };
  document.getElementById('rightBtn').onclick = () => { basketX = Math.min(490, basketX + 42); };
  document.getElementById('restartBtn').onclick = resetGame;
  update();
</script>
</body>
</html>`,
  },
  {
    id: 'vocab-flashcards',
    titleEn: 'English Flashcard Quizzer',
    titleVi: 'Thẻ Học Từ Vựng Tiếng Anh',
    categoryEn: 'Study App',
    categoryVi: 'Ứng dụng Học tập',
    summaryEn: 'Flip interactive English-Vietnamese cards, listen to pronunciation, and track your streak!',
    summaryVi: 'Lật thẻ từ vựng Anh-Việt, nghe phát âm chuẩn và tích lũy chuỗi câu trả lời đúng!',
    accentHex: '#0D9488',
    surfaceBg: '#F0FDFA',
    concepts: ['Arrays & Objects', 'Flip Animation', 'Speech Synthesis'],
    remixIdeasEn: [
      'Change all vocabulary words to space & planets',
      'Add a quiz mode with 3 answer buttons',
      'Add a button so I can add my own new English word',
    ],
    remixIdeasVi: [
      'Đổi tất cả từ vựng sang chủ đề vũ trụ & hành tinh',
      'Thêm chế độ trắc nghiệm với 3 đáp án',
      'Thêm nút để em tự nhập từ mới vào bộ thẻ',
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>English Flashcard Quizzer</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
  body { min-height: 100vh; background: #f0fdfa; color: #172154; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 16px; }
  .top { display: flex; justify-content: space-between; width: 100%; max-width: 440px; font-weight: 800; font-size: 14px; color: #0f766e; }
  .card { width: 100%; max-width: 440px; min-height: 230px; background: #fff; border: 2px solid #99f6e4; border-radius: 24px; padding: 28px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; cursor: pointer; transition: transform 0.18s ease; box-shadow: 0 12px 24px rgba(13,148,136,0.1); }
  .card:active { transform: scale(0.98); }
  .emoji { font-size: 56px; }
  .word { font-size: 30px; font-weight: 900; color: #172154; }
  .sub { font-size: 15px; color: #525e80; }
  .meaning { font-size: 20px; font-weight: 800; color: #ff6b00; margin-top: 6px; }
  .row { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  button { border: none; border-radius: 12px; padding: 11px 18px; font-weight: 800; font-size: 14px; cursor: pointer; }
  .speak { background: #0d9488; color: #fff; }
  .knew { background: #ff6b00; color: #fff; }
  .next { background: #e2e8f0; color: #172154; }
</style>
</head>
<body>
  <div class="top">
    <span id="counter">Card 1 / 6</span>
    <span>Streak: <strong id="streak">0</strong> 🔥</span>
  </div>
  <div class="card" id="card">
    <div class="emoji" id="emoji">🦁</div>
    <div class="word" id="word">Courage</div>
    <div class="sub" id="example">"The little mouse showed great courage."</div>
    <div class="meaning" id="meaning" style="display:none">Lòng dũng cảm</div>
  </div>
  <div class="row">
    <button class="speak" id="speakBtn">🔊 Listen</button>
    <button class="knew" id="knewBtn">✓ I Know It!</button>
    <button class="next" id="nextBtn">Next Card →</button>
  </div>
<script>
  const cards = [
    { e: '🦁', w: 'Courage', ex: 'Being brave even when something feels big.', vi: 'Lòng dũng cảm' },
    { e: '🌱', w: 'Kindness', ex: 'Helping friends with a warm smile.', vi: 'Lòng tốt bụng' },
    { e: '🔭', w: 'Curious', ex: 'Asking smart questions to learn more.', vi: 'Tò mò khám phá' },
    { e: '🌈', w: 'Creative', ex: 'Building brand-new stories and apps.', vi: 'Sáng tạo' },
    { e: '🤝', w: 'Teamwork', ex: 'Working happily together as one team.', vi: 'Tinh thần đồng đội' },
    { e: '🌟', w: 'Grateful', ex: 'Saying thank you for good things each day.', vi: 'Biết ơn' }
  ];
  let idx = 0, flipped = false, streak = 0;
  function render() {
    const c = cards[idx];
    document.getElementById('counter').textContent = 'Card ' + (idx + 1) + ' / ' + cards.length;
    document.getElementById('emoji').textContent = c.e;
    document.getElementById('word').textContent = c.w;
    document.getElementById('example').textContent = '"' + c.ex + '"';
    const m = document.getElementById('meaning');
    m.textContent = c.vi;
    m.style.display = flipped ? 'block' : 'none';
  }
  document.getElementById('card').onclick = () => { flipped = !flipped; render(); };
  document.getElementById('speakBtn').onclick = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cards[idx].w + '. ' + cards[idx].ex);
      u.lang = 'en-US'; u.rate = 0.92;
      window.speechSynthesis.speak(u);
    }
  };
  document.getElementById('knewBtn').onclick = () => {
    streak++; document.getElementById('streak').textContent = String(streak);
    idx = (idx + 1) % cards.length; flipped = false; render();
  };
  document.getElementById('nextBtn').onclick = () => {
    idx = (idx + 1) % cards.length; flipped = false; render();
  };
  render();
</script>
</body>
</html>`,
  },
  {
    id: 'pixel-art-pad',
    titleEn: 'Rainbow Pixel Art Pad',
    titleVi: 'Bảng Vẽ Pixel Cầu Vồng',
    categoryEn: 'Creative Tool',
    categoryVi: 'Công cụ Sáng tạo',
    summaryEn: 'Paint colorful 12×12 pixel characters, toggle mirror symmetry, and design game sprites!',
    summaryVi: 'Vẽ nhân vật pixel 12×12 đầy màu sắc, bật chế độ đối xứng gương để tạo nhân vật game!',
    accentHex: '#2563EB',
    surfaceBg: '#EFF6FF',
    concepts: ['CSS Grid', 'DOM Loops', 'Pointer Drawing'],
    remixIdeasEn: [
      'Add a Fill Bucket tool to color the whole background',
      'Add a smiley face stamp button',
      'Make the grid 16x16 with pastel neon colors',
    ],
    remixIdeasVi: [
      'Thêm công cụ đổ màu toàn bộ nền',
      'Thêm nút đóng dấu hình mặt cười',
      'Tăng kích thước lưới lên 16x16 với màu pastel',
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Rainbow Pixel Art Pad</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
  body { min-height: 100vh; background: #eff6ff; color: #172154; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; gap: 12px; }
  h2 { font-size: 20px; font-weight: 900; }
  .palette { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .swatch { width: 32px; height: 32px; border-radius: 10px; border: 3px solid #fff; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.12); }
  .swatch.active { outline: 3px solid #172154; transform: scale(1.1); }
  .grid { display: grid; grid-template-columns: repeat(12, 24px); gap: 2px; background: #cbd5e1; padding: 6px; border-radius: 14px; user-select: none; touch-action: none; }
  .cell { width: 24px; height: 24px; background: #fff; border-radius: 4px; cursor: crosshair; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  button { padding: 8px 14px; border-radius: 10px; border: none; font-weight: 800; font-size: 13px; cursor: pointer; background: #172154; color: #fff; }
  button.alt { background: #2563eb; }
  button.warn { background: #e11d48; }
</style>
</head>
<body>
  <h2>🎨 Rainbow Pixel Art Pad</h2>
  <div class="palette" id="palette"></div>
  <div class="grid" id="grid"></div>
  <div class="actions">
    <button class="alt" id="mirrorBtn">Mirror Mode: OFF</button>
    <button id="heartBtn">Draw Heart</button>
    <button class="warn" id="clearBtn">Clear Grid</button>
  </div>
<script>
  const colors = ['#ff6b00','#ffd41d','#10b981','#0284c7','#6366f1','#e61e64','#172154','#ffffff'];
  let activeColor = colors[0], painting = false, mirror = false;
  const pal = document.getElementById('palette');
  const grid = document.getElementById('grid');
  const cells = [];

  colors.forEach((c, idx) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (idx === 0 ? ' active' : '');
    b.style.background = c;
    b.onclick = () => {
      activeColor = c;
      document.querySelectorAll('.swatch').forEach(el => el.classList.remove('active'));
      b.classList.add('active');
    };
    pal.appendChild(b);
  });

  function paintIndex(index) {
    cells[index].style.background = activeColor;
    if (mirror) {
      const row = Math.floor(index / 12);
      const col = index % 12;
      cells[row * 12 + (11 - col)].style.background = activeColor;
    }
  }

  for (let i = 0; i < 144; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    d.onpointerdown = () => { painting = true; paintIndex(i); };
    d.onpointerenter = () => { if (painting) paintIndex(i); };
    grid.appendChild(d);
    cells.push(d);
  }
  window.addEventListener('pointerup', () => { painting = false; });

  document.getElementById('mirrorBtn').onclick = (e) => {
    mirror = !mirror;
    e.target.textContent = 'Mirror Mode: ' + (mirror ? 'ON ✨' : 'OFF');
  };
  document.getElementById('clearBtn').onclick = () => cells.forEach(c => c.style.background = '#ffffff');
  document.getElementById('heartBtn').onclick = () => {
    cells.forEach(c => c.style.background = '#ffffff');
    const pts = [[3,2],[4,2],[7,2],[8,2],[2,3],[5,3],[6,3],[9,3],[2,4],[9,4],[2,5],[9,5],[3,6],[8,6],[4,7],[7,7],[5,8],[6,8]];
    pts.forEach(([x,y]) => { cells[y * 12 + x].style.background = '#e61e64'; });
  };
</script>
</body>
</html>`,
  },
  {
    id: 'pocket-piano',
    titleEn: 'Pocket Piano & Beat Maker',
    titleVi: 'Đàn Piano Mini & Tạo Nhịp',
    categoryEn: 'Music Lab',
    categoryVi: 'Phòng Âm nhạc',
    summaryEn: 'Play real musical notes using Web Audio synthesis or press Auto-Play to hear a melody!',
    summaryVi: 'Chơi các nốt nhạc sống động bằng Web Audio hoặc bấm Tự Động Phát để nghe giai điệu!',
    accentHex: '#7C3AED',
    surfaceBg: '#F5F3FF',
    concepts: ['Web Audio API', 'Sound Frequencies', 'Timers'],
    remixIdeasEn: [
      'Add drum buttons (Kick, Snare, Clap)',
      'Add Happy Birthday song button',
      'Make floating music notes bounce above each key',
    ],
    remixIdeasVi: [
      'Thêm các nút trống (Kick, Snare, Vỗ tay)',
      'Thêm nút tự chơi bài Happy Birthday',
      'Làm các nốt nhạc bay lên mỗi khi bấm phím',
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Pocket Piano</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
  body { min-height: 100vh; background: #faf5ff; color: #172154; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px; gap: 16px; }
  h2 { font-size: 22px; font-weight: 900; }
  .display { font-size: 16px; font-weight: 800; color: #7c3aed; min-height: 24px; }
  .keys { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; width: 100%; max-width: 520px; }
  .key { height: 150px; border: none; border-radius: 14px; color: #fff; font-weight: 900; font-size: 16px; cursor: pointer; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 14px; transition: transform 0.08s; box-shadow: 0 6px 0 rgba(0,0,0,0.18); }
  .key:active, .key.lit { transform: translateY(4px) scale(0.97); filter: brightness(1.12); }
  .song-btn { background: #172154; color: #fff; border: none; padding: 11px 20px; border-radius: 12px; font-weight: 800; cursor: pointer; }
</style>
</head>
<body>
  <h2>🎹 Pocket Rainbow Piano</h2>
  <div class="display" id="noteLabel">Tap any colorful key!</div>
  <div class="keys" id="keys"></div>
  <button class="song-btn" id="songBtn">🎵 Play "Twinkle Twinkle"</button>
<script>
  const notes = [
    { name: 'C', f: 261.6, c: '#ef4444' }, { name: 'D', f: 293.7, c: '#f97316' },
    { name: 'E', f: 329.6, c: '#eab308' }, { name: 'F', f: 349.2, c: '#10b981' },
    { name: 'G', f: 392.0, c: '#06b6d4' }, { name: 'A', f: 440.0, c: '#3b82f6' },
    { name: 'B', f: 493.9, c: '#8b5cf6' }, { name: 'C2', f: 523.3, c: '#ec4899' }
  ];
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const keyWrap = document.getElementById('keys');
  const btns = [];

  function playNote(i) {
    if (ctx.state === 'suspended') ctx.resume();
    const n = notes[i];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = n.f;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.45);
    document.getElementById('noteLabel').textContent = 'Playing Note: ' + n.name + ' (' + Math.round(n.f) + ' Hz)';
    btns[i].classList.add('lit');
    setTimeout(() => btns[i].classList.remove('lit'), 180);
  }

  notes.forEach((n, i) => {
    const b = document.createElement('button');
    b.className = 'key';
    b.style.background = n.c;
    b.textContent = n.name;
    b.onclick = () => playNote(i);
    keyWrap.appendChild(b);
    btns.push(b);
  });

  document.getElementById('songBtn').onclick = () => {
    const melody = [0,0,4,4,5,5,4,3,3,2,2,1,1,0];
    melody.forEach((noteIdx, step) => setTimeout(() => playNote(noteIdx), step * 340));
  };
</script>
</body>
</html>`,
  },
  {
    id: 'virtual-pet',
    titleEn: 'Pocket Dragon Pet',
    titleVi: 'Thú Cưng Rồng Mini',
    categoryEn: 'Simulation',
    categoryVi: 'Mô phỏng',
    summaryEn: 'Feed snacks, play ball, and tuck your friendly baby dragon into bed while watching its meters!',
    summaryVi: 'Cho rồng con ăn, chơi đùa và ru ngủ trong khi theo dõi thanh năng lượng & niềm vui!',
    accentHex: '#059669',
    surfaceBg: '#ECFDF5',
    concepts: ['State Variables', 'Progress Bars', 'Intervals'],
    remixIdeasEn: [
      'Let me rename my pet and pick a cute hat',
      'Turn the dragon into a cosmic space cat',
      'Add a mini treat shop with earned coins',
    ],
    remixIdeasVi: [
      'Cho em đặt tên cho thú cưng và chọn chiếc mũ dễ thương',
      'Đổi rồng con thành mèo phi hành gia vũ trụ',
      'Thêm cửa hàng bánh thưởng bằng xu kiếm được',
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Pocket Dragon Pet</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
  body { min-height: 100vh; background: #ecfdf5; color: #14532d; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px; }
  .box { width: 100%; max-width: 420px; background: #fff; border: 2px solid #a7f3d0; border-radius: 24px; padding: 24px; text-align: center; display: flex; flex-direction: column; gap: 14px; }
  .pet { font-size: 76px; transition: transform 0.25s; }
  .pet.bounce { transform: translateY(-14px) scale(1.12); }
  .mood { font-size: 15px; font-weight: 800; color: #059669; min-height: 22px; }
  .meters { display: flex; flex-direction: column; gap: 8px; text-align: left; }
  .m-label { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 3px; }
  .bar { height: 12px; background: #e2e8f0; border-radius: 99px; overflow: hidden; }
  .fill { height: 100%; border-radius: 99px; transition: width 0.25s; }
  .btns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  button { border: none; border-radius: 12px; padding: 11px 8px; font-weight: 800; font-size: 13px; cursor: pointer; color: #fff; }
</style>
</head>
<body>
  <div class="box">
    <h2>🐉 Sunny the Baby Dragon</h2>
    <div class="pet" id="pet">🐲</div>
    <div class="mood" id="mood">Sunny is happy to see you!</div>
    <div class="meters">
      <div><div class="m-label"><span>🍎 Tummy</span><span id="hVal">80%</span></div><div class="bar"><div class="fill" id="hBar" style="width:80%;background:#ff6b00"></div></div></div>
      <div><div class="m-label"><span>🎉 Fun</span><span id="fVal">75%</span></div><div class="bar"><div class="fill" id="fBar" style="width:75%;background:#0d9488"></div></div></div>
      <div><div class="m-label"><span>⚡ Energy</span><span id="eVal">85%</span></div><div class="bar"><div class="fill" id="eBar" style="width:85%;background:#2563eb"></div></div></div>
    </div>
    <div class="btns">
      <button style="background:#ff6b00" id="feedBtn">🍎 Feed</button>
      <button style="background:#0d9488" id="playBtn">⚽ Play</button>
      <button style="background:#2563eb" id="napBtn">💤 Nap</button>
    </div>
  </div>
<script>
  let hunger = 80, fun = 75, energy = 85;
  const pet = document.getElementById('pet');
  const mood = document.getElementById('mood');
  function clamp(v) { return Math.max(0, Math.min(100, v)); }
  function pop(msg) {
    mood.textContent = msg;
    pet.classList.add('bounce');
    setTimeout(() => pet.classList.remove('bounce'), 260);
    sync();
  }
  function sync() {
    document.getElementById('hVal').textContent = hunger + '%';
    document.getElementById('fVal').textContent = fun + '%';
    document.getElementById('eVal').textContent = energy + '%';
    document.getElementById('hBar').style.width = hunger + '%';
    document.getElementById('fBar').style.width = fun + '%';
    document.getElementById('eBar').style.width = energy + '%';
  }
  document.getElementById('feedBtn').onclick = () => { hunger = clamp(hunger + 18); energy = clamp(energy + 4); pop('Yum! Crunchy star apples!'); };
  document.getElementById('playBtn').onclick = () => { fun = clamp(fun + 20); energy = clamp(energy - 10); hunger = clamp(hunger - 6); pop('Wheee! Dragon soccer!'); };
  document.getElementById('napBtn').onclick = () => { energy = clamp(energy + 25); pop('Zzz... recharging dragon wings!'); };
  setInterval(() => { hunger = clamp(hunger - 2); fun = clamp(fun - 2); energy = clamp(energy - 1); sync(); }, 4500);
</script>
</body>
</html>`,
  },
  {
    id: 'kindness-jar',
    titleEn: 'Be Whole Kindness Jar',
    titleVi: 'Hũ Hạt Giống Lòng Tốt',
    categoryEn: 'Daily Habits',
    categoryVi: 'Thói quen tốt',
    summaryEn: 'Drop glowing kindness marbles into your jar every time you help someone at home or school!',
    summaryVi: 'Thả một viên bi phát sáng vào hũ mỗi khi em làm một việc tốt giúp gia đình hoặc bạn bè!',
    accentHex: '#E61E64',
    surfaceBg: '#FDF2F8',
    concepts: ['Form Input', 'Dynamic Elements', 'Goal Progress'],
    remixIdeasEn: [
      'Celebrate with fireworks when the jar reaches 10 marbles',
      'Let me pick the marble color for each kind act',
      'Add a Kindness Idea Spinner button',
    ],
    remixIdeasVi: [
      'Bắn pháo hoa ăn mừng khi hũ đạt 10 viên bi',
      'Cho em chọn màu viên bi cho từng việc tốt',
      'Thêm nút Vòng Quay Gợi Ý Việc Tốt',
    ],
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Be Whole Kindness Jar</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
  body { min-height: 100vh; background: #fdf2f8; color: #172154; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18px; gap: 14px; }
  h2 { font-size: 21px; font-weight: 900; color: #be185d; }
  .jar { width: 220px; min-height: 180px; border: 4px solid #f472b6; border-top-width: 10px; border-radius: 20px 20px 44px 44px; background: rgba(255,255,255,0.85); padding: 14px; display: flex; flex-wrap: wrap; align-content: flex-end; justify-content: center; gap: 7px; }
  .marble { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; animation: drop 0.3s ease; box-shadow: inset -3px -3px 6px rgba(0,0,0,0.18); }
  @keyframes drop { from { transform: translateY(-40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .form { display: flex; gap: 8px; width: 100%; max-width: 400px; }
  input { flex: 1; padding: 10px 12px; border-radius: 12px; border: 2px solid #fbcfe8; font-size: 14px; }
  button { background: #e61e64; color: #fff; border: none; border-radius: 12px; padding: 10px 16px; font-weight: 800; cursor: pointer; }
  .log { width: 100%; max-width: 400px; font-size: 13px; color: #525e80; text-align: center; font-weight: 600; }
</style>
</head>
<body>
  <h2>💖 My Kindness Jar (<span id="count">2</span> / 12)</h2>
  <div class="jar" id="jar"></div>
  <form class="form" id="form">
    <input id="inp" placeholder="I shared my pencils with a friend..." maxlength="80" />
    <button type="submit">+ Add</button>
  </form>
  <div class="log" id="log">Latest: Helped set the dinner table!</div>
<script>
  const colors = ['#f43f5e','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ec4899'];
  const icons = ['⭐','💖','🌈','🌻','🦋','✨'];
  const jar = document.getElementById('jar');
  let count = 0;
  function addMarble(text) {
    const m = document.createElement('div');
    m.className = 'marble';
    m.style.background = colors[count % colors.length];
    m.textContent = icons[count % icons.length];
    m.title = text;
    jar.appendChild(m);
    count++;
    document.getElementById('count').textContent = String(count);
    document.getElementById('log').textContent = 'Latest: ' + text;
  }
  addMarble('Smiled and said good morning!');
  addMarble('Helped tidy up my desk!');
  document.getElementById('form').onsubmit = (e) => {
    e.preventDefault();
    const inp = document.getElementById('inp');
    const txt = inp.value.trim();
    if (!txt) return;
    addMarble(txt);
    inp.value = '';
  };
</script>
</body>
</html>`,
  },
];

const ONE_TAP_UPGRADES = [
  {
    en: 'Add confetti celebration',
    vi: 'Thêm pháo giấy ăn mừng',
    prompt: 'Add a colorful confetti celebration burst whenever the user clicks a main button or scores.',
  },
  {
    en: 'Make it bilingual EN / VI',
    vi: 'Thêm song ngữ Anh - Việt',
    prompt: 'Make the titles and instructions clearly bilingual in English and Vietnamese for kids.',
  },
  {
    en: 'Add sound effects',
    vi: 'Thêm hiệu ứng âm thanh',
    prompt: 'Add cheerful Web Audio API sound effects (pop, chime, victory) when clicking buttons.',
  },
  {
    en: 'Add a score & star counter',
    vi: 'Thêm bảng điểm & sao',
    prompt: 'Add a bright Star Counter and Level Up badge at the top of the app.',
  },
];

function applyThemeOverrideToHtml(html: string, themeId: VibeThemeId): string {
  const theme = VIBE_THEMES.find((t) => t.id === themeId);
  if (!theme) return html;
  const themeTagId = 'lilab-vibe-theme-override';
  const stripped = html.replace(
    new RegExp(`<style id="${themeTagId}">[\\s\\S]*?<\\/style>`, 'gi'),
    ''
  );
  const styleBlock = `<style id="${themeTagId}">body{background:${theme.bg} !important;color:${theme.ink} !important;}button{box-shadow:0 3px 0 rgba(0,0,0,0.12);}</style>`;
  if (stripped.includes('</head>')) {
    return stripped.replace('</head>', `${styleBlock}</head>`);
  }
  return `${styleBlock}${stripped}`;
}

function buildSmartLocalFallbackApp(prompt: string, themeId: VibeThemeId): {
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  concepts: string[];
  remixIdeasEn: string[];
  remixIdeasVi: string[];
  html: string;
} {
  const theme = VIBE_THEMES.find((t) => t.id === themeId) || VIBE_THEMES[0];
  const cleanTitle = prompt.trim().slice(0, 42) || 'My Super Clicker App';
  const safeTitle = cleanTitle.replace(/[<>&"]/g, '');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
  body { min-height: 100vh; background: ${theme.bg}; color: ${theme.ink}; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 16px; text-align: center; }
  .card { width: 100%; max-width: 440px; background: ${theme.card}; border: 2px solid ${theme.accentSoft}; border-radius: 24px; padding: 26px; display: flex; flex-direction: column; align-items: center; gap: 14px; box-shadow: 0 12px 24px rgba(0,0,0,0.06); }
  h1 { font-size: 22px; font-weight: 900; }
  .score { font-size: 46px; font-weight: 900; color: ${theme.accent}; font-variant-numeric: tabular-nums; }
  .btn { background: ${theme.accent}; color: #fff; border: none; padding: 14px 26px; border-radius: 16px; font-size: 16px; font-weight: 900; cursor: pointer; transition: transform 0.1s; }
  .btn:active { transform: scale(0.95); }
  .badge { font-size: 13px; font-weight: 700; opacity: 0.8; }
</style>
</head>
<body>
  <div class="card">
    <h1>✨ ${safeTitle}</h1>
    <div class="score" id="score">0</div>
    <button class="btn" id="tapBtn">Tap to Power Up! 🚀</button>
    <div class="badge" id="msg">Built with LiLab Vibe Coding!</div>
  </div>
<script>
  let pts = 0;
  const msgs = ['Great job!', 'You are a real coder!', 'Leveling up!', 'Awesome energy!', 'Super creator!'];
  document.getElementById('tapBtn').onclick = () => {
    pts += 1;
    document.getElementById('score').textContent = String(pts);
    document.getElementById('msg').textContent = msgs[pts % msgs.length] + ' (' + pts + ' stars)';
  };
</script>
</body>
</html>`;

  return {
    titleEn: safeTitle,
    titleVi: safeTitle,
    summaryEn: 'A joyful interactive starter app created from your idea! Open "Peek Code" or ask for an upgrade to add games, timers, or new buttons.',
    summaryVi: 'Một ứng dụng tương tác vui nhộn được tạo từ ý tưởng của em! Mở "Xem Code" hoặc bấm gợi ý nâng cấp để thêm tính năng mới.',
    concepts: ['HTML Structure', 'CSS Theme Variables', 'JavaScript Click Events'],
    remixIdeasEn: [
      'Add a 20-second challenge timer',
      'Change the button to launch floating stars',
      'Add a second button that resets the score',
    ],
    remixIdeasVi: [
      'Thêm đồng hồ đếm ngược 20 giây',
      'Thêm hiệu ứng sao bay khi bấm nút',
      'Thêm nút đặt lại điểm số',
    ],
    html,
  };
}

export const KidsVibeCodingLab: React.FC<KidsVibeCodingLabProps> = ({
  lang,
  currentUser,
  student,
}) => {
  const storageKey = useMemo(
    () => `lilab_vibe_apps_${student?.id || currentUser.uid || 'guest'}`,
    [student?.id, currentUser.uid]
  );

  const safeStudentId = useMemo(
    () => (student?.id || currentUser.uid || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120),
    [student?.id, currentUser.uid]
  );

  const progressStorageKey = useMemo(
    () => `lilab_vibe_code_progress_${safeStudentId}`,
    [safeStudentId]
  );

  const progressDocId = useMemo(() => {
    const ownerPart = (currentUser.uid || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 56);
    const studentPart = safeStudentId.slice(0, 56);
    return `${ownerPart}_${studentPart}`;
  }, [currentUser.uid, safeStudentId]);

  const [viewMode, setViewMode] = useState<VibeViewMode>('studio');
  const [activeTheme, setActiveTheme] = useState<VibeThemeId>('sunny');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // Active app state (starts loaded with Star Catcher Arcade so it's instantly playable!)
  const [appTitleEn, setAppTitleEn] = useState(STARTER_APPS[0].titleEn);
  const [appTitleVi, setAppTitleVi] = useState(STARTER_APPS[0].titleVi);
  const [appSummaryEn, setAppSummaryEn] = useState(STARTER_APPS[0].summaryEn);
  const [appSummaryVi, setAppSummaryVi] = useState(STARTER_APPS[0].summaryVi);
  const [codeConcepts, setCodeConcepts] = useState<string[]>(STARTER_APPS[0].concepts);
  const [remixIdeasEn, setRemixIdeasEn] = useState<string[]>(STARTER_APPS[0].remixIdeasEn);
  const [remixIdeasVi, setRemixIdeasVi] = useState<string[]>(STARTER_APPS[0].remixIdeasVi);
  const [liveHtml, setLiveHtml] = useState<string>(STARTER_APPS[0].html);
  const [editorDraftHtml, setEditorDraftHtml] = useState<string>(STARTER_APPS[0].html);
  const [iframeRevision, setIframeRevision] = useState(1);

  // Vibe prompt state
  const [promptInput, setPromptInput] = useState('');
  const [buildMode, setBuildMode] = useState<'remix' | 'fresh'>('remix');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Code Challenges XP & Digital Badges progress (synced with Firestore + localStorage)
  const [codeProgress, setCodeProgress] = useState<VibeCodeProgressState>(() => {
    try {
      const raw = localStorage.getItem(progressStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<VibeCodeProgressState>;
        const completed = Array.isArray(parsed.completedChallengeIds)
          ? parsed.completedChallengeIds
          : [];
        const xp = typeof parsed.xpPoints === 'number' ? parsed.xpPoints : 0;
        return {
          xpPoints: xp,
          completedChallengeIds: completed,
          earnedBadgeIds: evaluateEarnedBadges(completed, xp),
          currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
          lastCompletedAt: parsed.lastCompletedAt,
        };
      }
    } catch {
      // Fallback to fresh progress
    }
    return {
      xpPoints: 0,
      completedChallengeIds: [],
      earnedBadgeIds: [],
      currentStreak: 0,
    };
  });
  const remoteProgressDocIdRef = useRef<string | null>(null);

  // Saved student apps gallery
  const [savedApps, setSavedApps] = useState<SavedVibeApp[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as SavedVibeApp[]) : [];
    } catch {
      return [];
    }
  });

  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      setSavedApps(raw ? (JSON.parse(raw) as SavedVibeApp[]) : []);
    } catch {
      setSavedApps([]);
    }
  }, [storageKey]);

  // Hydrate and subscribe to Firestore student_code_progress
  useEffect(() => {
    remoteProgressDocIdRef.current = null;
    try {
      const raw = localStorage.getItem(progressStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<VibeCodeProgressState>;
        const completed = Array.isArray(parsed.completedChallengeIds)
          ? parsed.completedChallengeIds
          : [];
        const xp = typeof parsed.xpPoints === 'number' ? parsed.xpPoints : 0;
        setCodeProgress({
          xpPoints: xp,
          completedChallengeIds: completed,
          earnedBadgeIds: evaluateEarnedBadges(completed, xp),
          currentStreak: typeof parsed.currentStreak === 'number' ? parsed.currentStreak : 0,
          lastCompletedAt: parsed.lastCompletedAt,
        });
      } else {
        setCodeProgress({
          xpPoints: 0,
          completedChallengeIds: [],
          earnedBadgeIds: [],
          currentStreak: 0,
        });
      }
    } catch {
      // Ignore storage read issues
    }

    if (!currentUser?.uid) return;
    const isAdminPreview =
      isSuperAdminEmail(currentUser.email || '') ||
      currentUser.role === 'super_admin' ||
      currentUser.role === 'admin';

    const progressQuery = isAdminPreview
      ? query(collection(db, 'student_code_progress'), where('studentId', '==', safeStudentId))
      : query(collection(db, 'student_code_progress'), where('ownerUid', '==', currentUser.uid));

    const unsub = onSnapshot(
      progressQuery,
      (snap) => {
        const matched =
          snap.docs.find((d) => d.id === progressDocId) ||
          snap.docs.find((d) => d.data().studentId === safeStudentId) ||
          snap.docs[0];
        if (!matched) {
          remoteProgressDocIdRef.current = null;
          return;
        }
        remoteProgressDocIdRef.current = matched.id;
        const data = matched.data();
        const remoteCompleted = Array.isArray(data.completedChallengeIds)
          ? (data.completedChallengeIds as string[])
          : [];
        const remoteXp = typeof data.xpPoints === 'number' ? data.xpPoints : 0;
        const remoteStreak = typeof data.currentStreak === 'number' ? data.currentStreak : 0;
        const remoteLast = typeof data.lastCompletedAt === 'string' ? data.lastCompletedAt : undefined;

        setCodeProgress((prev) => {
          const mergedCompleted = Array.from(
            new Set([...prev.completedChallengeIds, ...remoteCompleted])
          ).slice(0, 50);
          const mergedXp = Math.max(prev.xpPoints, remoteXp);
          const mergedBadges = evaluateEarnedBadges(mergedCompleted, mergedXp);
          const merged: VibeCodeProgressState = {
            xpPoints: mergedXp,
            completedChallengeIds: mergedCompleted,
            earnedBadgeIds: mergedBadges,
            currentStreak: Math.max(prev.currentStreak, remoteStreak),
            lastCompletedAt: remoteLast || prev.lastCompletedAt,
          };
          try {
            localStorage.setItem(progressStorageKey, JSON.stringify(merged));
          } catch {
            // Ignore quota issues
          }
          return merged;
        });
      },
      (err) => {
        if (auth.currentUser) {
          try {
            handleFirestoreError(err, OperationType.LIST, 'student_code_progress');
          } catch {
            // Preserve localStorage progress cleanly while logging structured Firestore error context
          }
        }
      }
    );

    return () => unsub();
  }, [currentUser.email, currentUser.role, currentUser.uid, progressDocId, progressStorageKey, safeStudentId]);

  const handleCompleteCodeChallenge = (
    challenge: CodeChallengeItem,
    _newlyEarnedBadgeIds: string[],
    _solvedHtml: string
  ) => {
    const alreadyDone = codeProgress.completedChallengeIds.includes(challenge.id);
    if (alreadyDone) return;

    const nextCompleted = Array.from(
      new Set([...codeProgress.completedChallengeIds, challenge.id])
    ).slice(0, 50);
    const nextXp = Math.min(100000, codeProgress.xpPoints + challenge.xpReward);
    const nextBadges = evaluateEarnedBadges(nextCompleted, nextXp).slice(0, 30);
    const nextStreak = Math.min(365, codeProgress.currentStreak + 1);
    const nowIso = new Date().toISOString().slice(0, 40);

    const nextState: VibeCodeProgressState = {
      xpPoints: nextXp,
      completedChallengeIds: nextCompleted,
      earnedBadgeIds: nextBadges,
      currentStreak: nextStreak,
      lastCompletedAt: nowIso,
    };

    setCodeProgress(nextState);
    try {
      localStorage.setItem(progressStorageKey, JSON.stringify(nextState));
    } catch {
      // Ignore quota issues
    }

    if (!currentUser?.uid) return;
    const targetDocId = remoteProgressDocIdRef.current || progressDocId;
    const targetRef = doc(db, 'student_code_progress', targetDocId);
    const basePayload: Record<string, unknown> = {
      studentId: safeStudentId,
      studentName: (student?.fullName || currentUser.displayName || 'LiLab Student').slice(0, 120),
      ownerUid: currentUser.uid.slice(0, 128),
      xpPoints: nextXp,
      completedChallengeIds: nextCompleted,
      earnedBadgeIds: nextBadges,
      currentStreak: nextStreak,
      lastCompletedAt: nowIso,
      updatedAt: serverTimestamp(),
    };
    const stuEmail = (student?.studentEmail || currentUser.email || '').trim().slice(0, 160);
    if (stuEmail) basePayload.studentEmail = stuEmail;
    const parEmail = (student?.parentEmail || '').trim().slice(0, 160);
    if (parEmail) basePayload.parentEmail = parEmail;

    if (remoteProgressDocIdRef.current) {
      void updateDoc(targetRef, basePayload).catch((err) => {
        if (auth.currentUser) {
          try {
            handleFirestoreError(err, OperationType.UPDATE, `student_code_progress/${targetDocId}`);
          } catch {
            // Local progress already saved cleanly
          }
        }
      });
    } else {
      void setDoc(targetRef, { ...basePayload, createdAt: serverTimestamp() })
        .then(() => {
          remoteProgressDocIdRef.current = targetDocId;
        })
        .catch((err) => {
          if (auth.currentUser) {
            try {
              handleFirestoreError(err, OperationType.CREATE, `student_code_progress/${targetDocId}`);
            } catch {
              // Local progress already saved cleanly
            }
          }
        });
    }
  };

  const coderRank = useMemo(() => getCoderRank(codeProgress.xpPoints), [codeProgress.xpPoints]);

  const persistSavedApps = (next: SavedVibeApp[]) => {
    setSavedApps(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore quota issues
    }
  };

  const loadTemplate = (tpl: StarterAppTemplate) => {
    setAppTitleEn(tpl.titleEn);
    setAppTitleVi(tpl.titleVi);
    setAppSummaryEn(tpl.summaryEn);
    setAppSummaryVi(tpl.summaryVi);
    setCodeConcepts(tpl.concepts);
    setRemixIdeasEn(tpl.remixIdeasEn);
    setRemixIdeasVi(tpl.remixIdeasVi);
    setLiveHtml(tpl.html);
    setEditorDraftHtml(tpl.html);
    setIframeRevision((r) => r + 1);
    setViewMode('studio');
    setStatusNotice(
      biText(
        lang,
        `Loaded "${tpl.titleEn}"! Play with it on the right or type a vibe prompt to remix it.`,
        `Đã mở "${tpl.titleVi}"! Hãy chơi thử bên phải hoặc nhập ý tưởng để tùy biến theo cách của em.`
      )
    );
  };

  const handleApplyTheme = (themeId: VibeThemeId) => {
    setActiveTheme(themeId);
    const updated = applyThemeOverrideToHtml(liveHtml, themeId);
    setLiveHtml(updated);
    setEditorDraftHtml(updated);
    setIframeRevision((r) => r + 1);
  };

  const handleGenerateVibeApp = async (overridePrompt?: string, forceFresh?: boolean) => {
    const finalPrompt = (overridePrompt ?? promptInput).trim();
    if (!finalPrompt) {
      promptInputRef.current?.focus();
      return;
    }
    const useFresh = forceFresh ?? buildMode === 'fresh';
    setIsGenerating(true);
    setStatusNotice(null);

    try {
      const result = await generateKidVibeApp({
        prompt: finalPrompt,
        currentHtml: useFresh ? '' : liveHtml,
        theme: activeTheme,
        ageGroup: student?.age ? `${Math.max(6, student.age - 1)}-${student.age + 2}` : '7-14',
      });
      setAppTitleEn(result.titleEn || 'My Custom App');
      setAppTitleVi(result.titleVi || result.titleEn || 'Ứng dụng của em');
      setAppSummaryEn(result.summaryEn || 'Built live with Vibe Coding!');
      setAppSummaryVi(result.summaryVi || result.summaryEn || 'Được tạo trực tiếp bằng Vibe Coding!');
      setCodeConcepts(
        Array.isArray(result.codeConcepts) && result.codeConcepts.length > 0
          ? result.codeConcepts.slice(0, 4)
          : ['HTML', 'CSS', 'JavaScript']
      );
      setRemixIdeasEn(
        Array.isArray(result.remixIdeasEn) && result.remixIdeasEn.length > 0
          ? result.remixIdeasEn.slice(0, 3)
          : ONE_TAP_UPGRADES.slice(0, 3).map((u) => u.en)
      );
      setRemixIdeasVi(
        Array.isArray(result.remixIdeasVi) && result.remixIdeasVi.length > 0
          ? result.remixIdeasVi.slice(0, 3)
          : ONE_TAP_UPGRADES.slice(0, 3).map((u) => u.vi)
      );
      setLiveHtml(result.html);
      setEditorDraftHtml(result.html);
      setIframeRevision((r) => r + 1);
      setPromptInput('');
      setStatusNotice(
        biText(
          lang,
          'Your app is live! Try clicking around inside the preview stage.',
          'Ứng dụng của em đã chạy rồi! Hãy bấm thử trực tiếp trên màn hình xem trước nhé.'
        )
      );
    } catch {
      const fallback = buildSmartLocalFallbackApp(finalPrompt, activeTheme);
      setAppTitleEn(fallback.titleEn);
      setAppTitleVi(fallback.titleVi);
      setAppSummaryEn(fallback.summaryEn);
      setAppSummaryVi(fallback.summaryVi);
      setCodeConcepts(fallback.concepts);
      setRemixIdeasEn(fallback.remixIdeasEn);
      setRemixIdeasVi(fallback.remixIdeasVi);
      setLiveHtml(fallback.html);
      setEditorDraftHtml(fallback.html);
      setIframeRevision((r) => r + 1);
      setPromptInput('');
      setStatusNotice(
        biText(
          lang,
          'Created an instant offline starter app for your idea! Open "Peek Code" to customize anything.',
          'Đã tạo ngay ứng dụng mẫu ngoại tuyến cho ý tưởng của em! Mở "Xem Code" để tự chỉnh sửa thêm.'
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunEditedCode = () => {
    setLiveHtml(editorDraftHtml);
    setIframeRevision((r) => r + 1);
    setStatusNotice(
      biText(
        lang,
        'Code updated! Your real changes are now running live.',
        'Đã cập nhật mã nguồn! Thay đổi của em đang chạy trực tiếp.'
      )
    );
  };

  const handleSaveCurrentApp = () => {
    const newEntry: SavedVibeApp = {
      id: `vibe_${Date.now()}`,
      titleEn: appTitleEn,
      titleVi: appTitleVi,
      summaryEn: appSummaryEn,
      summaryVi: appSummaryVi,
      theme: activeTheme,
      concepts: codeConcepts,
      html: liveHtml,
      savedAt: new Date().toISOString(),
    };
    persistSavedApps([newEntry, ...savedApps].slice(0, 18));
    setStatusNotice(
      biText(
        lang,
        `Saved "${appTitleEn}" to My Apps!`,
        `Đã lưu "${appTitleVi}" vào Bộ sưu tập Ứng dụng!`
      )
    );
  };

  const handleDownloadHtml = (htmlCode = liveHtml, fileTitle = appTitleEn) => {
    const slug = fileTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const blob = new Blob([htmlCode], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'my-lilab-app'}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const previewWidthClass =
    previewDevice === 'phone'
      ? 'max-w-[375px]'
      : previewDevice === 'tablet'
        ? 'max-w-[680px]'
        : 'max-w-full';

  return (
    <div className="space-y-6">
      {/* Studio Top Bar */}
      <section className="bg-white border border-[#172154]/10 rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold tracking-wider uppercase text-[#FF6B00]">
              {biText(lang, 'LiLab Young Creators · Vibe Coding Lab', 'Phòng Sáng tạo LiLab · Lập Trình Vibe')}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#172154] leading-tight">
              {biText(
                lang,
                'Imagine It. Describe It. Build Real Apps.',
                'Tưởng tượng. Mô tả. Tự tay tạo Ứng dụng Thật.'
              )}
            </h1>
            <p className="text-sm text-[#525E80] max-w-2xl">
              {biText(
                lang,
                'Pick a starter game or type your own idea in English or Vietnamese—watch your real interactive app come alive, peek inside the code, and download it to share.',
                'Chọn một ứng dụng mẫu hoặc gõ ý tưởng bằng Tiếng Anh / Tiếng Việt — xem ứng dụng thật chạy ngay lập tức, khám phá mã nguồn và tải về khoe gia đình.'
              )}
            </p>
          </div>

          {/* 4-Mode Segmented Control */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F2F4F8] rounded-xl border border-[#172154]/8 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('studio')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'studio'
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-[#525E80] hover:text-[#172154]'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              {biText(lang, 'App Builder', 'Tạo Ứng Dụng')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('challenges')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'challenges'
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-[#525E80] hover:text-[#172154]'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              {biText(
                lang,
                `Code Challenges (${codeProgress.completedChallengeIds.length}/${CODE_CHALLENGES.length})`,
                `Thử Thách Code (${codeProgress.completedChallengeIds.length}/${CODE_CHALLENGES.length})`
              )}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('explore')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'explore'
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-[#525E80] hover:text-[#172154]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              {biText(lang, `Starter Apps (${STARTER_APPS.length})`, `Mẫu Có Sẵn (${STARTER_APPS.length})`)}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gallery')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'gallery'
                  ? 'bg-[#FF6B00] text-white'
                  : 'text-[#525E80] hover:text-[#172154]'
              }`}
            >
              <FolderHeart className="w-3.5 h-3.5" />
              {biText(lang, `My Apps (${savedApps.length})`, `Ứng Dụng Của Em (${savedApps.length})`)}
            </button>
          </div>
        </div>

        {/* Clean Unboxed XP & Digital Badges Status Strip */}
        <div className="mt-4 pt-3.5 border-t border-[#172154]/8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#525E80]">
            <span className="font-bold text-[#172154] inline-flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#FF6B00]" />
              {biText(lang, `Level ${coderRank.level}`, `Cấp ${coderRank.level}`)} ·{' '}
              {biText(lang, coderRank.titleEn, coderRank.titleVi)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-bold text-[#FF6B00] tabular-nums">{codeProgress.xpPoints} XP</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {biText(
                lang,
                `${codeProgress.earnedBadgeIds.length}/${DIGITAL_BADGES.length} Digital Badges`,
                `${codeProgress.earnedBadgeIds.length}/${DIGITAL_BADGES.length} Huy Hiệu Số`
              )}
            </span>
          </div>
          {viewMode !== 'challenges' && (
            <button
              type="button"
              onClick={() => setViewMode('challenges')}
              className="text-xs font-bold text-[#FF6B00] hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Trophy className="w-3.5 h-3.5" />
              {biText(lang, 'Earn XP & Badges in Code Challenges →', 'Chinh phục Thử Thách Code để nhận XP & Huy Hiệu →')}
            </button>
          )}
        </div>
      </section>

      {/* MODE 1B: CODE CHALLENGES QUEST ARENA */}
      {viewMode === 'challenges' && (
        <VibeCodeChallenges
          lang={lang}
          studentName={student?.fullName || currentUser.displayName || 'Young Coder'}
          progress={codeProgress}
          onCompleteChallenge={handleCompleteCodeChallenge}
          onOpenInBuilder={(payload) => {
            setAppTitleEn(payload.titleEn);
            setAppTitleVi(payload.titleVi);
            setAppSummaryEn(payload.summaryEn);
            setAppSummaryVi(payload.summaryVi);
            setCodeConcepts(payload.concepts);
            setLiveHtml(payload.html);
            setEditorDraftHtml(payload.html);
            setIframeRevision((r) => r + 1);
            setViewMode('studio');
            setStatusNotice(
              biText(
                lang,
                `Loaded your solved "${payload.titleEn}" challenge into App Builder! Keep upgrading it!`,
                `Đã chuyển thử thách "${payload.titleVi}" sang App Builder! Em có thể nâng cấp thêm thật nhiều tính năng!`
              )
            );
          }}
        />
      )}

      {/* MODE 1: APP BUILDER STUDIO (Two-Zone Sandbox: 40% Vibe Prompt & Controls + 60% Live Playable App) */}
      {viewMode === 'studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT DECK (5 cols): Vibe Prompt, Mode Toggle, Magic Remixes & Theme Switcher */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-[#172154]">
                  {biText(lang, '1. Describe Your Vibe', '1. Mô tả Ý tưởng của Em')}
                </h2>
                <div className="flex items-center gap-1 p-0.5 bg-[#F2F4F8] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setBuildMode('remix')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      buildMode === 'remix' ? 'bg-white text-[#172154] shadow-xs' : 'text-[#525E80]'
                    }`}
                  >
                    {biText(lang, 'Upgrade Current', 'Nâng cấp')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuildMode('fresh')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                      buildMode === 'fresh' ? 'bg-white text-[#172154] shadow-xs' : 'text-[#525E80]'
                    }`}
                  >
                    {biText(lang, 'Brand New', 'Tạo Mới')}
                  </button>
                </div>
              </div>

              <textarea
                ref={promptInputRef}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void handleGenerateVibeApp();
                  }
                }}
                rows={3}
                placeholder={
                  buildMode === 'remix'
                    ? biText(
                        lang,
                        'Example: "Add rainbow bonus stars and a 30-second countdown timer!"',
                        'Ví dụ: "Thêm sao cầu vồng cộng 5 điểm và đồng hồ đếm ngược 30 giây!"'
                      )
                    : biText(
                        lang,
                        'Example: "Build a cute math rocket quiz game with cheering sound effects!"',
                        'Ví dụ: "Tạo trò chơi tên lửa giải toán có hiệu ứng âm thanh cổ vũ!"'
                      )
                }
                className="w-full rounded-xl border border-[#172154]/15 bg-[#F8FAFC] focus:bg-white focus:border-[#FF6B00] focus:outline-none p-3.5 text-sm text-[#172154] resize-none"
              />

              <button
                type="button"
                disabled={isGenerating || !promptInput.trim()}
                onClick={() => void handleGenerateVibeApp()}
                className="w-full py-3 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating
                  ? biText(lang, 'Building your real app…', 'Đang lập trình ứng dụng của em…')
                  : buildMode === 'remix'
                    ? biText(lang, 'Upgrade My App', 'Nâng Cấp Ứng Dụng')
                    : biText(lang, 'Create New App', 'Tạo Ứng Dụng Mới')}
              </button>

              {statusNotice && (
                <div className="rounded-xl bg-[#F0FDFA] border border-[#0D9488]/25 px-3.5 py-2.5 text-xs font-medium text-[#0F766E]">
                  {statusNotice}
                </div>
              )}

              {/* Contextual Remix Suggestions for current app */}
              <div className="space-y-2 pt-2 border-t border-[#172154]/8">
                <div className="text-xs font-bold text-[#525E80]">
                  {biText(lang, 'Try a 1-Tap Remix Idea:', 'Thử 1 chạm để nâng cấp ngay:')}
                </div>
                <div className="space-y-1.5">
                  {(lang === 'vi' ? remixIdeasVi : remixIdeasEn).map((idea, idx) => (
                    <button
                      key={`${idea}-${idx}`}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => void handleGenerateVibeApp(idea, false)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-[#FFF5EE] hover:bg-[#FFEDD5] border border-[#FF6B00]/15 text-xs font-semibold text-[#172154] transition-colors cursor-pointer"
                    >
                      + {idea}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Visual Theme & Quick Power-Ups */}
            <div className="bg-white border border-[#172154]/10 rounded-2xl p-5 space-y-4">
              <div className="space-y-2.5">
                <h3 className="font-display text-sm font-bold text-[#172154] flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#FF6B00]" />
                  {biText(lang, '2. Instant Color Mood', '2. Đổi Bảng Màu Tức Thì')}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {VIBE_THEMES.map((th) => {
                    const isActive = activeTheme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => handleApplyTheme(th.id)}
                        className={`px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                          isActive
                            ? 'border-[#FF6B00] bg-[#FFF5EE]'
                            : 'border-[#172154]/10 bg-white hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-full border border-black/10 shrink-0"
                          style={{ background: `linear-gradient(135deg, ${th.bg} 45%, ${th.accent} 45%)` }}
                        />
                        <span className="text-xs font-bold text-[#172154] truncate">
                          {biText(lang, th.labelEn, th.labelVi)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-[#172154]/8">
                <div className="text-xs font-bold text-[#525E80]">
                  {biText(lang, 'Quick Feature Power-Ups:', 'Thêm Tính Năng Nhanh:')}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ONE_TAP_UPGRADES.map((u) => (
                    <button
                      key={u.en}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => void handleGenerateVibeApp(u.prompt, false)}
                      className="px-3 py-2 rounded-xl border border-[#172154]/12 bg-[#F8FAFC] hover:bg-[#EFF6FF] hover:border-[#2563EB]/30 text-xs font-semibold text-[#172154] text-left transition-colors cursor-pointer"
                    >
                      {biText(lang, u.en, u.vi)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Learning Takeaway */}
              <div className="pt-3 border-t border-[#172154]/8 space-y-1.5">
                <div className="text-xs font-bold text-[#0D9488]">
                  {biText(lang, 'What You Are Learning Inside This App', 'Kiến thức Lập trình Trong Ứng Dụng Này')}
                </div>
                <p className="text-xs text-[#525E80] leading-relaxed">
                  {biText(lang, appSummaryEn, appSummaryVi)}
                </p>
                <div className="text-xs font-semibold text-[#172154] pt-1">
                  {codeConcepts.join(' · ')}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT STAGE (7 cols): Live Sandboxed Real App Preview + Peek Inside Code */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-[#172154]/10 rounded-2xl overflow-hidden">
              {/* Preview Toolbar */}
              <div className="px-4 py-3 border-b border-[#172154]/10 bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-[#172154] truncate">
                    {biText(lang, appTitleEn, appTitleVi)}
                  </div>
                  <div className="text-[11px] text-[#525E80]">
                    {biText(lang, 'Live Interactive App Sandbox', 'Màn hình Chạy Thử Ứng Dụng Thật')}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Device Preview Switch */}
                  <div className="flex items-center p-0.5 bg-white border border-[#172154]/10 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      title={biText(lang, 'Desktop View', 'Màn hình Máy tính')}
                      className={`p-1.5 rounded-md cursor-pointer ${
                        previewDevice === 'desktop' ? 'bg-[#172154] text-white' : 'text-[#525E80]'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('tablet')}
                      title={biText(lang, 'Tablet View', 'Màn hình Máy tính bảng')}
                      className={`p-1.5 rounded-md cursor-pointer ${
                        previewDevice === 'tablet' ? 'bg-[#172154] text-white' : 'text-[#525E80]'
                      }`}
                    >
                      <Tablet className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('phone')}
                      title={biText(lang, 'Phone View', 'Màn hình Điện thoại')}
                      className={`p-1.5 rounded-md cursor-pointer ${
                        previewDevice === 'phone' ? 'bg-[#172154] text-white' : 'text-[#525E80]'
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIframeRevision((r) => r + 1)}
                    className="px-2.5 py-1.5 rounded-lg border border-[#172154]/12 bg-white hover:bg-[#F2F4F8] text-xs font-semibold text-[#172154] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {biText(lang, 'Restart', 'Chạy lại')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCodeEditor((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors ${
                      showCodeEditor
                        ? 'bg-[#172154] text-white border-[#172154]'
                        : 'bg-white text-[#172154] border-[#172154]/12 hover:bg-[#F2F4F8]'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    {biText(lang, 'Peek Code', 'Xem Code')}
                  </button>

                  <button
                    type="button"
                    onClick={() => setFullscreenOpen(true)}
                    className="p-1.5 rounded-lg border border-[#172154]/12 bg-white hover:bg-[#F2F4F8] text-[#172154] cursor-pointer"
                    title={biText(lang, 'Play Fullscreen', 'Toàn màn hình')}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sandboxed Live Preview Stage (strictly sandbox="allow-scripts" — never allow-same-origin) */}
              <div className="bg-[#EEF2F7] p-3 sm:p-4 flex justify-center">
                <div
                  className={`w-full ${previewWidthClass} transition-all duration-200 bg-white rounded-2xl overflow-hidden border border-[#172154]/12 shadow-sm`}
                >
                  <iframe
                    key={`vibe-stage-${iframeRevision}`}
                    title={appTitleEn}
                    sandbox="allow-scripts"
                    srcDoc={liveHtml}
                    className="w-full h-[500px] border-0 block bg-white"
                  />
                </div>
              </div>

              {/* Save & Export Footer */}
              <div className="px-4 py-3 border-t border-[#172154]/10 bg-white flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-[#525E80]">
                  {biText(
                    lang,
                    'Safe Kid Sandbox · Download as a real standalone .html file anytime',
                    'Hộp cát An toàn cho Trẻ · Tải về thành tệp .html độc lập bất kỳ lúc nào'
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveCurrentApp}
                    className="px-3.5 py-2 rounded-xl border border-[#172154]/15 bg-white hover:bg-[#FFF5EE] text-xs font-bold text-[#172154] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#FF6B00]" />
                    {biText(lang, 'Save to My Apps', 'Lưu Ứng Dụng')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadHtml()}
                    className="px-3.5 py-2 rounded-xl bg-[#172154] hover:bg-[#243273] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {biText(lang, 'Download .HTML App', 'Tải File .HTML')}
                  </button>
                </div>
              </div>
            </div>

            {/* Toggleable "Peek Inside the Code" Editor */}
            {showCodeEditor && (
              <div className="bg-[#0F172A] text-slate-100 rounded-2xl p-4 space-y-3 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-[#FFD41D]">
                      {biText(lang, 'Inside Your App Code (HTML + CSS + JavaScript)', 'Bên Trong Mã Nguồn Của Em (HTML + CSS + JavaScript)')}
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      {biText(
                        lang,
                        'Try changing a word, emoji, or color hex code below, then click "Run My Code"!',
                        'Hãy thử sửa một chữ, biểu tượng hoặc mã màu bên dưới rồi bấm "Chạy Mã Của Em"!'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunEditedCode}
                    className="px-3.5 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {biText(lang, 'Run My Code', 'Chạy Mã Của Em')}
                  </button>
                </div>
                <textarea
                  value={editorDraftHtml}
                  onChange={(e) => setEditorDraftHtml(e.target.value)}
                  spellCheck={false}
                  rows={14}
                  className="w-full rounded-xl bg-[#020617] border border-slate-700 p-3 font-mono text-xs leading-relaxed text-emerald-300 focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: STARTER APPS GALLERY */}
      {viewMode === 'explore' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STARTER_APPS.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white border border-[#172154]/10 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#FF6B00]/40 transition-colors"
            >
              <div className="space-y-3">
                <div
                  className="h-36 rounded-xl border border-[#172154]/8 overflow-hidden relative"
                  style={{ backgroundColor: tpl.surfaceBg }}
                >
                  <iframe
                    title={tpl.titleEn}
                    sandbox="allow-scripts"
                    srcDoc={tpl.html}
                    className="w-[200%] h-[200%] border-0 pointer-events-none origin-top-left scale-50"
                  />
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tpl.accentHex }}>
                    {biText(lang, tpl.categoryEn, tpl.categoryVi)}
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#172154] mt-0.5">
                    {biText(lang, tpl.titleEn, tpl.titleVi)}
                  </h3>
                  <p className="text-xs text-[#525E80] mt-1 leading-relaxed">
                    {biText(lang, tpl.summaryEn, tpl.summaryVi)}
                  </p>
                </div>
                <div className="text-[11px] font-semibold text-[#525E80]">
                  {tpl.concepts.join(' · ')}
                </div>
              </div>

              <button
                type="button"
                onClick={() => loadTemplate(tpl)}
                className="w-full py-2.5 px-4 rounded-xl bg-[#172154] hover:bg-[#FF6B00] text-white text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                {biText(lang, 'Play & Remix This App', 'Chơi & Tùy Biến Ứng Dụng')}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODE 3: MY SAVED APPS GALLERY */}
      {viewMode === 'gallery' && (
        <div className="bg-white border border-[#172154]/10 rounded-2xl p-6">
          {savedApps.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="font-display text-lg font-bold text-[#172154]">
                {biText(lang, 'Your App Shelf is Ready!', 'Kệ Ứng Dụng Của Em Đã Sẵn Sàng!')}
              </div>
              <p className="text-sm text-[#525E80] max-w-md mx-auto">
                {biText(
                  lang,
                  'Create or remix any app in the App Builder and click "Save to My Apps" to keep your personal collection here.',
                  'Hãy tạo hoặc tùy biến một ứng dụng trong mục Tạo Ứng Dụng rồi bấm "Lưu Ứng Dụng" để trưng bày tại đây.'
                )}
              </p>
              <button
                type="button"
                onClick={() => setViewMode('studio')}
                className="px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold cursor-pointer"
              >
                {biText(lang, 'Open App Builder', 'Mở Xưởng Tạo Ứng Dụng')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {savedApps.map((app) => (
                <div
                  key={app.id}
                  className="border border-[#172154]/10 rounded-2xl p-4 flex flex-col justify-between gap-3 bg-[#F8FAFC]"
                >
                  <div className="space-y-2">
                    <div className="h-32 rounded-xl overflow-hidden border border-[#172154]/10 bg-white">
                      <iframe
                        title={app.titleEn}
                        sandbox="allow-scripts"
                        srcDoc={app.html}
                        className="w-[200%] h-[200%] border-0 pointer-events-none origin-top-left scale-50"
                      />
                    </div>
                    <h3 className="font-display text-base font-bold text-[#172154] truncate">
                      {biText(lang, app.titleEn, app.titleVi)}
                    </h3>
                    <p className="text-xs text-[#525E80] line-clamp-2">
                      {biText(lang, app.summaryEn, app.summaryVi)}
                    </p>
                    <div className="text-[11px] text-[#525E80]">
                      {new Date(app.savedAt).toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB')}
                      {' · '}
                      {app.concepts.join(' / ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-[#172154]/8">
                    <button
                      type="button"
                      onClick={() => {
                        setAppTitleEn(app.titleEn);
                        setAppTitleVi(app.titleVi);
                        setAppSummaryEn(app.summaryEn);
                        setAppSummaryVi(app.summaryVi);
                        setCodeConcepts(app.concepts);
                        setActiveTheme(app.theme);
                        setLiveHtml(app.html);
                        setEditorDraftHtml(app.html);
                        setIframeRevision((r) => r + 1);
                        setViewMode('studio');
                      }}
                      className="flex-1 py-2 px-3 rounded-lg bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold cursor-pointer"
                    >
                      {biText(lang, 'Open & Edit', 'Mở & Sửa')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadHtml(app.html, app.titleEn)}
                      className="p-2 rounded-lg bg-white border border-[#172154]/15 text-[#172154] hover:bg-[#F2F4F8] cursor-pointer"
                      title={biText(lang, 'Download .HTML', 'Tải .HTML')}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => persistSavedApps(savedApps.filter((a) => a.id !== app.id))}
                      className="p-2 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title={biText(lang, 'Delete', 'Xóa')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Live App Modal */}
      {fullscreenOpen && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/85 p-4 sm:p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between text-white">
            <div className="font-display text-lg font-bold">
              {biText(lang, appTitleEn, appTitleVi)}
            </div>
            <button
              type="button"
              onClick={() => setFullscreenOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Minimize2 className="w-4 h-4" />
              {biText(lang, 'Exit Fullscreen', 'Thu nhỏ')}
            </button>
          </div>
          <div className="flex-1 bg-white rounded-2xl overflow-hidden border border-white/15">
            <iframe
              key={`vibe-full-${iframeRevision}`}
              title={`${appTitleEn} Fullscreen`}
              sandbox="allow-scripts"
              srcDoc={liveHtml}
              className="w-full h-full border-0 block"
            />
          </div>
        </div>
      )}
    </div>
  );
};

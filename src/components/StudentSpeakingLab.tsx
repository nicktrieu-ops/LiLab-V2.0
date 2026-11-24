import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Globe,
  Headphones,
  Lock,
  MessageSquareQuote,
  Mic,
  MicOff,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Square,
  Star,
  Target,
  Trophy,
  Volume2,
  Wand2,
  Zap,
} from 'lucide-react';
import { biText } from '../i18n';
import {
  evaluateSpeakingPractice,
  synthesizeNaturalVoice,
  type NaturalVoiceName,
  type SpeakingEvalResult,
} from '../services/aiClient';
import {
  loadSpeakingLevelData,
  mapStudentCefrToSpeakingLevel,
  SPEAKING_LEVELS,
  type CulturalRegion,
  type SpeakingItem,
  type SpeakingItemKind,
  type SpeakingLevelDataset,
  type SpeakingLevelId,
  type SpeakingStyleTag,
} from '../data/speakingLab';
import type { LangCode, StudentProfile, UserProfile } from '../types';

interface StudentSpeakingLabProps {
  lang: LangCode;
  currentUser: UserProfile;
  student: StudentProfile | null;
}

interface SpeakingProgressState {
  xp: number;
  streakDays: number;
  lastPracticeDate: string;
  totalAttempts: number;
  questsCompleted: number;
  bestScores: Record<string, number>;
}

const DEFAULT_PROGRESS: SpeakingProgressState = {
  xp: 0,
  streakDays: 0,
  lastPracticeDate: '',
  totalAttempts: 0,
  questsCompleted: 0,
  bestScores: {},
};

const REGION_LABELS: Record<CulturalRegion, { en: string; vi: string; badge: string }> = {
  US: { en: 'United States', vi: 'Hoa Kỳ', badge: 'US' },
  UK: { en: 'United Kingdom', vi: 'Anh Quốc', badge: 'UK' },
  AU: { en: 'Australia', vi: 'Úc', badge: 'AU' },
  CA: { en: 'Canada', vi: 'Canada', badge: 'CA' },
  IE: { en: 'Ireland', vi: 'Ireland', badge: 'IE' },
  NZ: { en: 'New Zealand', vi: 'New Zealand', badge: 'NZ' },
  SG: { en: 'Singapore', vi: 'Singapore', badge: 'SG' },
  ZA: { en: 'South Africa', vi: 'Nam Phi', badge: 'ZA' },
  Global: { en: 'Global English', vi: 'Quốc tế', badge: 'INTL' },
};

const STYLE_TAG_META: Record<
  SpeakingStyleTag,
  { labelEn: string; labelVi: string; pillClass: string }
> = {
  core: {
    labelEn: 'Core CEFR',
    labelVi: 'Chuẩn CEFR',
    pillClass: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#2563EB]/20',
  },
  single_syllable: {
    labelEn: '1-Syllable Focus',
    labelVi: 'Đơn Âm Tiết',
    pillClass: 'bg-[#FFF5EE] text-[#C2410C] border-[#FF6B00]/25',
  },
  multisyllable: {
    labelEn: 'Multisyllable',
    labelVi: 'Đa Âm Tiết',
    pillClass: 'bg-[#F5F3FF] text-[#6D28D9] border-[#7C3AED]/25',
  },
  difficult: {
    labelEn: 'Challenge Vocab',
    labelVi: 'Từ Khó Nâng Cao',
    pillClass: 'bg-[#FDF2F8] text-[#BE185D] border-[#E61E64]/25',
  },
  idiom: {
    labelEn: 'Idiom',
    labelVi: 'Thành Ngữ',
    pillClass: 'bg-[#FEFCE8] text-[#A16207] border-[#EAB308]/35',
  },
  cultural: {
    labelEn: 'World Culture',
    labelVi: 'Văn Hoá Thế Giới',
    pillClass: 'bg-[#F0FDFA] text-[#0F766E] border-[#0D9488]/25',
  },
  slang: {
    labelEn: 'Slang & Colloquial',
    labelVi: 'Khẩu Ngữ Tự Nhiên',
    pillClass: 'bg-[#FDF4FF] text-[#A21CAF] border-[#C026D3]/25',
  },
};

const SPEAKER_RANKS = [
  { minXp: 0, titleEn: 'Voice Spark', titleVi: 'Tia Lửa Giọng Nói', nextXp: 120 },
  { minXp: 120, titleEn: 'Sound Explorer', titleVi: 'Nhà Thám Hiểm Âm Thanh', nextXp: 350 },
  { minXp: 350, titleEn: 'Rhythm Builder', titleVi: 'Nhạc Trưởng Nhịp Điệu', nextXp: 750 },
  { minXp: 750, titleEn: 'Stage Star', titleVi: 'Ngôi Sao Sân Khấu', nextXp: 1500 },
  { minXp: 1500, titleEn: 'Global Orator', titleVi: 'Diễn Giả Toàn Cầu', nextXp: 3000 },
];

const PAGE_SIZE = 36;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function getRankInfo(xp: number) {
  let current = SPEAKER_RANKS[0];
  for (const r of SPEAKER_RANKS) {
    if (xp >= r.minXp) current = r;
  }
  const span = Math.max(1, current.nextXp - current.minXp);
  const pct = Math.min(100, Math.round(((xp - current.minXp) / span) * 100));
  return { ...current, pct };
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read audio clip.'));
    reader.readAsDataURL(blob);
  });
}

function pickSupportedRecorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const StudentSpeakingLab: React.FC<StudentSpeakingLabProps> = ({
  lang,
  currentUser,
  student,
}) => {
  const storageKey = `lilab_speaking_lab_v1_${student?.id || currentUser.uid}`;

  const [selectedLevel, setSelectedLevel] = useState<SpeakingLevelId>(() =>
    mapStudentCefrToSpeakingLevel(student?.cefrLevel)
  );
  const [dataset, setDataset] = useState<SpeakingLevelDataset | null>(null);
  const [loadingLevel, setLoadingLevel] = useState(true);

  // Explorer controls
  const [labMode, setLabMode] = useState<'explore' | 'quest'>('explore');
  const [activeKind, setActiveKind] = useState<SpeakingItemKind | 'mastered'>('word');
  const [styleFilter, setStyleFilter] = useState<SpeakingStyleTag | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [letterFilter, setLetterFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Active speaking item
  const [activeItem, setActiveItem] = useState<SpeakingItem | null>(null);

  // Quest mini-game state
  const [questItems, setQuestItems] = useState<SpeakingItem[]>([]);
  const [questIndex, setQuestIndex] = useState<number>(0);
  const [questScores, setQuestScores] = useState<number[]>([]);
  const [questFinished, setQuestFinished] = useState<boolean>(false);

  // Gamification & persistence
  const [progress, setProgress] = useState<SpeakingProgressState>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SpeakingProgressState>;
        return { ...DEFAULT_PROGRESS, ...parsed, bestScores: parsed.bestScores || {} };
      }
    } catch {
      // ignore storage read errors
    }
    return DEFAULT_PROGRESS;
  });

  // Model Voice (TTS) state
  const [voiceName, setVoiceName] = useState<NaturalVoiceName>('Kore');
  const [ttsLoading, setTtsLoading] = useState<'normal' | 'slow' | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const ttsCacheRef = useRef<Map<string, string>>(new Map());
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Microphone recording & visualizer state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveCaption, setLiveCaption] = useState('');
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<SpeakingEvalResult | null>(null);
  const [lastXpAwarded, setLastXpAwarded] = useState<number>(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [micErrorType, setMicErrorType] = useState<'permission' | 'not_found' | 'in_use' | 'generic' | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [micPermissionState, setMicPermissionState] = useState<'unknown' | 'prompt' | 'granted' | 'denied'>('unknown');
  const [micTesting, setMicTesting] = useState(false);
  const [micReadyNotice, setMicReadyNotice] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const speechRecRef = useRef<SpeechRecognitionLike | null>(null);
  const liveCaptionRef = useRef<string>('');
  const activeItemRef = useRef<SpeakingItem | null>(null);

  useEffect(() => {
    activeItemRef.current = activeItem;
  }, [activeItem]);

  // Monitor browser microphone permission status when supported
  useEffect(() => {
    let permStatus: PermissionStatus | null = null;
    let active = true;
    const checkMicPermission = async () => {
      try {
        if (!navigator.permissions || !navigator.permissions.query) return;
        permStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (!active) return;
        setMicPermissionState(permStatus.state as 'prompt' | 'granted' | 'denied');
        permStatus.onchange = () => {
          if (!active || !permStatus) return;
          const nextState = permStatus.state as 'prompt' | 'granted' | 'denied';
          setMicPermissionState(nextState);
          if (nextState === 'granted') {
            setMicError(null);
            setMicErrorType(null);
            setMicReadyNotice(true);
          }
        };
      } catch {
        // Safari/older browsers may not support permissions.query('microphone')
      }
    };
    void checkMicPermission();
    return () => {
      active = false;
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  // Reload persisted progress if student profile changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SpeakingProgressState>;
        setProgress({ ...DEFAULT_PROGRESS, ...parsed, bestScores: parsed.bestScores || {} });
      } else {
        setProgress(DEFAULT_PROGRESS);
      }
    } catch {
      setProgress(DEFAULT_PROGRESS);
    }
  }, [storageKey]);

  const saveProgress = useCallback(
    (updater: (prev: SpeakingProgressState) => SpeakingProgressState) => {
      setProgress((prev) => {
        const next = updater(prev);
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // ignore quota errors
        }
        return next;
      });
    },
    [storageKey]
  );

  // Load selected CEFR level dataset on demand
  useEffect(() => {
    let cancelled = false;
    setLoadingLevel(true);
    setStyleFilter('all');
    setCategoryFilter('all');
    setLetterFilter('');
    setSearchQuery('');
    setPage(1);
    setEvalResult(null);
    setMicError(null);
    setEvalError(null);

    void loadSpeakingLevelData(selectedLevel).then((loaded) => {
      if (cancelled) return;
      setDataset(loaded);
      setActiveItem(loaded.words[0] || loaded.phrases[0] || null);
      setLoadingLevel(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedLevel]);

  // Clean up audio & mic resources on unmount
  const stopAudioCleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopAudioCleanup();
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      if (lastRecordingUrl) {
        URL.revokeObjectURL(lastRecordingUrl);
      }
    };
  }, [stopAudioCleanup, lastRecordingUrl]);

  // Draw idle / live audio waveform on canvas
  const drawIdleWave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const bars = 36;
    const gap = 4;
    const barW = Math.max(3, (w - gap * (bars - 1)) / bars);
    for (let i = 0; i < bars; i++) {
      const centerDist = Math.abs(i - bars / 2) / (bars / 2);
      const barH = Math.max(6, (1 - centerDist * 0.65) * 18);
      const x = i * (barW + gap);
      const y = (h - barH) / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 4);
      ctx.fill();
    }
  }, []);

  useEffect(() => {
    if (!isRecording) drawIdleWave();
  }, [isRecording, drawIdleWave, activeItem?.id]);

  const startVisualizerLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const palette = ['#FF6B00', '#FFD41D', '#0D9488', '#38BDF8', '#E61E64'];

    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const bars = 36;
      const gap = 4;
      const barW = Math.max(3, (w - gap * (bars - 1)) / bars);
      const step = Math.max(1, Math.floor(bufferLength / bars));

      for (let i = 0; i < bars; i++) {
        const val = dataArray[i * step] || 0;
        const normalized = Math.max(0.12, val / 255);
        const barH = Math.max(8, normalized * (h - 10));
        const x = i * (barW + gap);
        const y = (h - barH) / 2;
        ctx.fillStyle = palette[i % palette.length];
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, 4);
        ctx.fill();
      }
    };
    render();
  }, []);

  // Filtered items for left explorer
  const currentPool = useMemo<SpeakingItem[]>(() => {
    if (!dataset) return [];
    if (activeKind === 'mastered') {
      return [...dataset.words, ...dataset.phrases].filter(
        (item) => (progress.bestScores[item.id] ?? 0) >= 80
      );
    }
    return activeKind === 'word' ? dataset.words : dataset.phrases;
  }, [dataset, activeKind, progress.bestScores]);

  const availableCategories = useMemo<string[]>(() => {
    if (!dataset) return [];
    if (activeKind === 'word') return dataset.wordCategories;
    if (activeKind === 'phrase') return dataset.phraseCategories;
    return Array.from(new Set(currentPool.map((i) => i.category)));
  }, [dataset, activeKind, currentPool]);

  const filteredItems = useMemo<SpeakingItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    return currentPool.filter((item) => {
      if (styleFilter !== 'all' && item.styleTag !== styleFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (letterFilter && !item.text.toUpperCase().startsWith(letterFilter)) return false;
      if (!q) return true;
      return (
        item.text.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.region || '').toLowerCase().includes(q)
      );
    });
  }, [currentPool, styleFilter, categoryFilter, letterFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedItems = useMemo(
    () => filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredItems, safePage]
  );

  // Level mastery count (words & phrases in active level + per-level words mastered out of 1,000-word target)
  const WORD_MASTERY_TARGET = 1000;

  const masteredWordsByLevel = useMemo<Record<SpeakingLevelId, number>>(() => {
    const counts: Record<SpeakingLevelId, number> = {
      pre_a1: 0,
      a1: 0,
      a2: 0,
      b1: 0,
      b2: 0,
    };
    for (const [id, score] of Object.entries(progress.bestScores)) {
      if (score < 80) continue;
      if (id.startsWith('pre_a1_w_')) counts.pre_a1++;
      else if (id.startsWith('a1_w_')) counts.a1++;
      else if (id.startsWith('a2_w_')) counts.a2++;
      else if (id.startsWith('b1_w_')) counts.b1++;
      else if (id.startsWith('b2_w_')) counts.b2++;
    }
    return counts;
  }, [progress.bestScores]);

  const levelMasteredCount = useMemo(() => {
    if (!dataset) return 0;
    let count = 0;
    for (const item of dataset.words) {
      if ((progress.bestScores[item.id] ?? 0) >= 80) count++;
    }
    for (const item of dataset.phrases) {
      if ((progress.bestScores[item.id] ?? 0) >= 80) count++;
    }
    return count;
  }, [dataset, progress.bestScores]);

  const totalMasteredAllLevels = useMemo(
    () => Object.values(progress.bestScores).filter((s) => s >= 80).length,
    [progress.bestScores]
  );

  const selectItem = useCallback((item: SpeakingItem) => {
    setActiveItem(item);
    setEvalResult(null);
    setMicError(null);
    setEvalError(null);
    setLiveCaption('');
    setLastXpAwarded(0);
  }, []);

  const handleRandomPick = useCallback(() => {
    const source = filteredItems.length > 0 ? filteredItems : currentPool;
    if (source.length === 0) return;
    const pick = source[Math.floor(Math.random() * source.length)];
    selectItem(pick);
  }, [filteredItems, currentPool, selectItem]);

  const handleStepItem = useCallback(
    (delta: number) => {
      if (labMode === 'quest' && questItems.length > 0) {
        const nextIdx = Math.max(0, Math.min(questItems.length - 1, questIndex + delta));
        setQuestIndex(nextIdx);
        selectItem(questItems[nextIdx]);
        return;
      }
      const source = filteredItems.length > 0 ? filteredItems : currentPool;
      if (source.length === 0) return;
      const idx = activeItem ? source.findIndex((i) => i.id === activeItem.id) : -1;
      const nextIdx = idx < 0 ? 0 : (idx + delta + source.length) % source.length;
      selectItem(source[nextIdx]);
    },
    [labMode, questItems, questIndex, filteredItems, currentPool, activeItem, selectItem]
  );

  // Start a fun 5-Round Speaking Quest mixing core words, tricky syllables, idioms & cultural phrases!
  const startSpeakingQuest = useCallback(() => {
    if (!dataset) return;
    const pickOne = (arr: SpeakingItem[]): SpeakingItem | null =>
      arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;

    const candidates = [
      pickOne(dataset.words.filter((i) => i.styleTag === 'core')),
      pickOne(dataset.words.filter((i) => i.styleTag === 'single_syllable' || i.styleTag === 'multisyllable')),
      pickOne(dataset.words.filter((i) => i.styleTag === 'difficult')),
      pickOne(dataset.phrases.filter((i) => i.styleTag === 'idiom' || i.styleTag === 'cultural')),
      pickOne(dataset.phrases.filter((i) => i.styleTag === 'slang' || i.styleTag === 'core')),
    ].filter((x): x is SpeakingItem => x !== null);

    if (candidates.length === 0) return;
    setLabMode('quest');
    setQuestItems(candidates);
    setQuestIndex(0);
    setQuestScores([]);
    setQuestFinished(false);
    selectItem(candidates[0]);
  }, [dataset, selectItem]);

  // Native Human Voice TTS playback
  const handleListenModel = useCallback(
    async (mode: 'normal' | 'slow') => {
      if (!activeItem) return;
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current = null;
      }
      setMicError(null);
      const cacheKey = `${activeItem.id}_${voiceName}_${mode}`;
      const cachedUrl = ttsCacheRef.current.get(cacheKey);
      if (cachedUrl) {
        const audio = new Audio(cachedUrl);
        activeAudioRef.current = audio;
        setTtsPlaying(true);
        audio.onended = () => setTtsPlaying(false);
        audio.onerror = () => setTtsPlaying(false);
        await audio.play().catch(() => setTtsPlaying(false));
        return;
      }

      setTtsLoading(mode);
      try {
        const stylePrompt =
          mode === 'slow'
            ? 'Clear, slow, deliberate English pronunciation teacher articulating every syllable and final consonant gently for young learners'
            : activeItem.styleTag === 'cultural' && activeItem.region
              ? `Warm, friendly, natural English speaker with a clear, authentic ${REGION_LABELS[activeItem.region]?.en || 'international'} cadence`
              : 'Warm, upbeat, crystal-clear native English teacher speaking naturally for kids and teens';

        const res = await synthesizeNaturalVoice({
          text: activeItem.text,
          lang: 'en',
          voiceName,
          style: stylePrompt,
        });

        const dataUrl = `data:${res.mimeType || 'audio/wav'};base64,${res.audioBase64}`;
        if (ttsCacheRef.current.size > 40) {
          const first = ttsCacheRef.current.keys().next().value;
          if (first) ttsCacheRef.current.delete(first);
        }
        ttsCacheRef.current.set(cacheKey, dataUrl);

        const audio = new Audio(dataUrl);
        activeAudioRef.current = audio;
        setTtsPlaying(true);
        audio.onended = () => setTtsPlaying(false);
        audio.onerror = () => setTtsPlaying(false);
        await audio.play();
      } catch (err) {
        // Fallback to browser Web Speech if TTS fails so students can always hear the word
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(activeItem.text);
          utter.lang = activeItem.region === 'UK' ? 'en-GB' : activeItem.region === 'AU' ? 'en-AU' : 'en-US';
          utter.rate = mode === 'slow' ? 0.72 : 0.96;
          setTtsPlaying(true);
          utter.onend = () => setTtsPlaying(false);
          utter.onerror = () => setTtsPlaying(false);
          window.speechSynthesis.speak(utter);
        } else {
          setMicError(err instanceof Error ? err.message : 'Unable to play model voice.');
        }
      } finally {
        setTtsLoading(null);
      }
    },
    [activeItem, voiceName]
  );

  // Stop recording & send real audio to Gemini AI Speaking Coach
  const stopAndEvaluate = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecording(false);
    stopAudioCleanup();
  }, [stopAudioCleanup]);

  const startRecording = useCallback(async () => {
    if (!activeItem || evaluating) return;
    setMicError(null);
    setMicErrorType(null);
    setEvalError(null);
    setMicReadyNotice(false);
    setEvalResult(null);
    setLiveCaption('');
    liveCaptionRef.current = '';
    setRecordingSeconds(0);
    setLastXpAwarded(0);

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      setTtsPlaying(false);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicErrorType('generic');
      setMicError(
        biText(
          lang,
          'Your browser does not support microphone recording. Please use Chrome, Edge, or Safari over HTTPS.',
          'Trình duyệt chưa hỗ trợ ghi âm micro. Vui lòng dùng Chrome, Edge hoặc Safari qua HTTPS.'
        )
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionState('granted');
      mediaStreamRef.current = stream;

      // Setup live Web Audio waveform analyser
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyserRef.current = analyser;
        startVisualizerLoop();
      }

      // Optional live browser speech caption preview while recording
      const SpeechRecCtor = (
        window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }
      ).SpeechRecognition ||
        (
          window as unknown as {
            webkitSpeechRecognition?: new () => SpeechRecognitionLike;
          }
        ).webkitSpeechRecognition;

      if (SpeechRecCtor) {
        try {
          const rec = new SpeechRecCtor();
          rec.lang =
            activeItem.region === 'UK'
              ? 'en-GB'
              : activeItem.region === 'AU'
                ? 'en-AU'
                : activeItem.region === 'CA'
                  ? 'en-CA'
                  : activeItem.region === 'IE'
                    ? 'en-IE'
                    : activeItem.region === 'NZ'
                      ? 'en-NZ'
                      : 'en-US';
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (ev) => {
            const parts: string[] = [];
            for (let i = 0; i < ev.results.length; i++) {
              const seg = (ev.results[i][0]?.transcript || '').trim();
              if (seg) parts.push(seg);
            }
            const joined = parts.join(' ').trim();
            if (joined) {
              liveCaptionRef.current = joined;
              setLiveCaption(joined);
            }
          };
          rec.onerror = () => {
            // Silent ignore — Gemini evaluates the actual audio regardless
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          // ignore speech recognition init issues
        }
      }

      const preferredMime = pickSupportedRecorderMime();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const recordedItem = activeItemRef.current;
        const blobMime = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: blobMime });

        if (lastRecordingUrl) URL.revokeObjectURL(lastRecordingUrl);
        const playbackUrl = URL.createObjectURL(blob);
        setLastRecordingUrl(playbackUrl);

        if (!recordedItem || blob.size < 400) {
          setMicError(
            biText(
              lang,
              'Recording was too short. Tap the mic, speak clearly, then tap Stop!',
              'Bản ghi quá ngắn. Hãy nhấn micro, đọc rõ ràng rồi nhấn Dừng nhé!'
            )
          );
          return;
        }

        setEvaluating(true);
        try {
          // Allow browser SpeechRecognition a brief 220ms window to flush its final recognized words
          if (!liveCaptionRef.current) {
            await new Promise((resolve) => window.setTimeout(resolve, 220));
          }
          const audioBase64 = await blobToBase64(blob);
          const levelMeta = SPEAKING_LEVELS.find((l) => l.id === recordedItem.level);
          const result = await evaluateSpeakingPractice({
            targetText: recordedItem.text,
            itemKind: recordedItem.kind,
            cefrLevel: levelMeta?.code || 'A1',
            styleTag: recordedItem.styleTag,
            region: recordedItem.region,
            audioBase64,
            mimeType: blobMime,
            browserTranscript: liveCaptionRef.current,
          });

          setEvalResult(result);

          // Award XP & update mastery/streak
          const baseXp =
            result.overallScore >= 90
              ? 30
              : result.overallScore >= 80
                ? 22
                : result.overallScore >= 65
                  ? 15
                  : result.overallScore >= 40
                    ? 8
                    : 3;

          const today = getTodayIso();
          let totalBonus = baseXp;

          // Update Quest state if in Quest mode
          if (labMode === 'quest' && !questFinished) {
            setQuestScores((prev) => {
              const updated = [...prev];
              updated[questIndex] = result.overallScore;
              if (updated.filter((v) => typeof v === 'number').length >= questItems.length) {
                setQuestFinished(true);
                totalBonus += 50;
              }
              return updated;
            });
          }

          setLastXpAwarded(totalBonus);
          saveProgress((prev) => {
            const prevBest = prev.bestScores[recordedItem.id] ?? 0;
            const nextBest = Math.max(prevBest, result.overallScore);
            let nextStreak = prev.streakDays;
            if (prev.lastPracticeDate !== today) {
              const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
              nextStreak = prev.lastPracticeDate === yesterday ? prev.streakDays + 1 : 1;
            }
            return {
              xp: prev.xp + totalBonus,
              streakDays: Math.max(1, nextStreak),
              lastPracticeDate: today,
              totalAttempts: prev.totalAttempts + 1,
              questsCompleted:
                prev.questsCompleted + (totalBonus > baseXp ? 1 : 0),
              bestScores: {
                ...prev.bestScores,
                [recordedItem.id]: nextBest,
              },
            };
          });
        } catch (err) {
          let friendly = biText(
            lang,
            'Could not score your voice right now. Please try again in a moment.',
            'Chưa thể chấm điểm giọng nói ngay lúc này. Hãy thử lại sau giây lát nhé.'
          );
          if (err instanceof Error && err.message) {
            const rawMsg = err.message.trim();
            if (rawMsg.startsWith('{')) {
              try {
                const parsedErr = JSON.parse(rawMsg) as { error?: { message?: string } };
                friendly = parsedErr?.error?.message || friendly;
              } catch {
                friendly = rawMsg.slice(0, 220);
              }
            } else {
              friendly = rawMsg;
            }
          }
          setEvalError(friendly);
        } finally {
          setEvaluating(false);
        }
      };

      recorder.start();
      setIsRecording(true);

      const maxSec = activeItem.kind === 'phrase' ? 14 : 7;
      const startedAt = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        setRecordingSeconds(elapsed);
        if (elapsed >= maxSec) {
          stopAndEvaluate();
        }
      }, 250);
    } catch (err) {
      stopAudioCleanup();
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errName === 'SecurityError') {
        setMicPermissionState('denied');
        setMicErrorType('permission');
        setMicError(
          biText(
            lang,
            'Microphone access is currently blocked by your browser or preview window.',
            'Trình duyệt hoặc cửa sổ xem trước hiện đang chặn quyền sử dụng Micro.'
          )
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setMicErrorType('not_found');
        setMicError(
          biText(
            lang,
            'No microphone was detected on this device. Please plug in a headset or check your system audio input.',
            'Không tìm thấy micro trên thiết bị này. Vui lòng cắm tai nghe/micro hoặc kiểm tra cài đặt âm thanh.'
          )
        );
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setMicErrorType('in_use');
        setMicError(
          biText(
            lang,
            'Your microphone is currently busy in another app (like Zoom, Google Meet, or another tab). Close it and try again.',
            'Micro đang được sử dụng bởi ứng dụng khác (như Zoom, Google Meet hoặc tab khác). Hãy tắt ứng dụng đó và thử lại.'
          )
        );
      } else {
        setMicErrorType('generic');
        setMicError(
          biText(
            lang,
            'Unable to access your microphone. Please check your browser permissions and audio device.',
            'Không thể kết nối micro. Vui lòng kiểm tra quyền trình duyệt và thiết bị âm thanh.'
          )
        );
      }
    }
  }, [
    activeItem,
    evaluating,
    lang,
    lastRecordingUrl,
    labMode,
    questFinished,
    questIndex,
    questItems.length,
    saveProgress,
    startVisualizerLoop,
    stopAndEvaluate,
    stopAudioCleanup,
  ]);

  // Explicit one-click Microphone permission check / prompt helper
  const handleEnableMicrophone = useCallback(async () => {
    setMicTesting(true);
    setMicReadyNotice(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicErrorType('generic');
        setMicError(
          biText(
            lang,
            'Your browser does not support microphone access here. Please open this app in Chrome, Edge, or Safari.',
            'Trình duyệt không hỗ trợ micro tại đây. Vui lòng mở ứng dụng trên Chrome, Edge hoặc Safari.'
          )
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermissionState('granted');
      setMicError(null);
      setMicErrorType(null);
      setMicReadyNotice(true);
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errName === 'SecurityError') {
        setMicPermissionState('denied');
        setMicErrorType('permission');
        setMicError(
          biText(
            lang,
            'Microphone is still blocked. Follow the 3 quick steps below to allow it in your browser, then click Test Again.',
            'Micro vẫn đang bị chặn. Hãy làm theo 3 bước nhanh bên dưới để cho phép trong trình duyệt, rồi nhấn Thử Lại.'
          )
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setMicErrorType('not_found');
        setMicError(
          biText(
            lang,
            'No microphone found. Please connect a microphone or headset and try again.',
            'Không tìm thấy micro. Vui lòng kết nối micro hoặc tai nghe rồi thử lại.'
          )
        );
      } else {
        setMicErrorType('generic');
        setMicError(
          biText(
            lang,
            'Could not enable microphone yet. Please check your browser and OS microphone privacy settings.',
            'Chưa thể bật micro. Vui lòng kiểm tra quyền micro của trình duyệt và hệ điều hành.'
          )
        );
      }
    } finally {
      setMicTesting(false);
    }
  }, [lang]);

  const handlePlayMyRecording = useCallback(() => {
    if (!lastRecordingUrl) return;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
    }
    const audio = new Audio(lastRecordingUrl);
    activeAudioRef.current = audio;
    void audio.play();
  }, [lastRecordingUrl]);

  const currentLevelMeta =
    SPEAKING_LEVELS.find((l) => l.id === selectedLevel) || SPEAKING_LEVELS[0];
  const rank = getRankInfo(progress.xp);

  const scoreRingRadius = 42;
  const scoreRingCircumference = 2 * Math.PI * scoreRingRadius;
  const scoreStrokeOffset = evalResult
    ? scoreRingCircumference * (1 - evalResult.overallScore / 100)
    : scoreRingCircumference;

  return (
    <div className="space-y-6">
      {/* HERO STUDIO HEADER & GAMIFICATION STRIP */}
      <div className="bg-[#172154] text-white rounded-2xl p-5 sm:p-6 shadow-md relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full opacity-25"
          style={{
            background: 'radial-gradient(circle, #FF6B00 0%, rgba(255,107,0,0) 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute -left-20 -bottom-24 w-64 h-64 rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, #0D9488 0%, rgba(13,148,136,0) 70%)',
          }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#FFD41D]">
              <Mic className="w-3.5 h-3.5" />
              <span>
                {biText(
                  lang,
                  'LILAB INTERACTIVE AI SPEAKING LAB · 7,400+ WORDS & 1,360+ PHRASES',
                  'PHÒNG LUYỆN NÓI AI TƯƠNG TÁC LILAB · 7.400+ TỪ & 1.360+ CÂU GIAO TIẾP'
                )}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              {biText(
                lang,
                'Speak Out Loud & Train with Your AI Voice Coach',
                'Luyện Nói Tự Tin Cùng Huấn Luyện Viên Giọng Nói AI'
              )}
            </h2>
            <p className="text-xs sm:text-sm text-white/80">
              {biText(
                lang,
                'Choose any CEFR level — master single & multisyllable words, tough vocabulary, idioms, world cultural phrases, and everyday slang with real-time AI scoring.',
                'Chọn cấp độ CEFR bất kỳ — chinh phục từ đơn & đa âm tiết, từ khó, thành ngữ, văn hoá đa quốc gia và khẩu ngữ tự nhiên với điểm số & nhận xét AI tức thì.'
              )}
            </p>
          </div>

          {/* Mode Toggle: Free Explorer vs 5-Round Speaking Quest */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLabMode('explore')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                labMode === 'explore'
                  ? 'bg-white text-[#172154] shadow-sm'
                  : 'bg-white/12 text-white hover:bg-white/20'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{biText(lang, 'Explore Library', 'Kho Từ & Câu')}</span>
            </button>
            <button
              type="button"
              onClick={startSpeakingQuest}
              disabled={!dataset}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors disabled:opacity-50 ${
                labMode === 'quest'
                  ? 'bg-[#FF6B00] text-white shadow-sm'
                  : 'bg-[#FF6B00]/90 hover:bg-[#FF6B00] text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-[#FFD41D]" />
              <span>{biText(lang, '5-Round Voice Quest', 'Thử Thách 5 Vòng')}</span>
            </button>
          </div>
        </div>

        {/* Gamified Stats Bar */}
        <div className="relative mt-5 pt-4 border-t border-white/12 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white/10 px-3.5 py-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FFD41D]/20 text-[#FFD41D] flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-white/65 font-bold">
                {biText(lang, 'Speaker Rank', 'Hạng Luyện Nói')}
              </div>
              <div className="text-xs font-extrabold truncate">
                {biText(lang, rank.titleEn, rank.titleVi)}
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FFD41D] transition-all duration-500"
                  style={{ width: `${rank.pct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 px-3.5 py-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FF6B00]/25 text-[#FF9E5E] flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/65 font-bold">
                {biText(lang, 'Speaking XP', 'Điểm Kinh Nghiệm')}
              </div>
              <div className="font-display text-lg font-extrabold tabular-nums">
                {progress.xp.toLocaleString()} <span className="text-xs text-white/70">XP</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 px-3.5 py-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#E61E64]/25 text-[#FF8BB4] flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/65 font-bold">
                {biText(lang, 'Practice Streak', 'Chuỗi Luyện Tập')}
              </div>
              <div className="font-display text-lg font-extrabold tabular-nums">
                {progress.streakDays}{' '}
                <span className="text-xs text-white/70">{biText(lang, 'days', 'ngày')}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white/10 px-3.5 py-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0D9488]/30 text-[#5EEAD4] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/65 font-bold">
                {biText(lang, 'Mastered (80%+)', 'Đã Thuần Thục')}
              </div>
              <div className="font-display text-lg font-extrabold tabular-nums">
                {totalMasteredAllLevels}{' '}
                <span className="text-xs text-white/70">
                  ({levelMasteredCount} {biText(lang, 'in level', 'cấp này')})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CEFR LEVEL SELECTOR CARDS WITH 1,000-WORD MASTERY PROGRESS RINGS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SPEAKING_LEVELS.map((lvl) => {
          const isCurrent = lvl.id === selectedLevel;
          const masteredWords = masteredWordsByLevel[lvl.id] || 0;
          const rawPct = Math.min(100, (masteredWords / WORD_MASTERY_TARGET) * 100);
          const visualPct = masteredWords > 0 ? Math.max(3, rawPct) : 0;
          const pctLabel =
            masteredWords === 0
              ? '0%'
              : rawPct < 10
                ? `${rawPct.toFixed(1)}%`
                : `${Math.round(rawPct)}%`;
          const ringRadius = 22;
          const ringCircumference = 2 * Math.PI * ringRadius;
          const ringOffset = ringCircumference * (1 - visualPct / 100);
          const isComplete = masteredWords >= WORD_MASTERY_TARGET;

          return (
            <button
              key={lvl.id}
              type="button"
              onClick={() => {
                setSelectedLevel(lvl.id);
                setLabMode('explore');
              }}
              aria-label={`${lvl.nameEn}: ${masteredWords} of ${WORD_MASTERY_TARGET} words mastered (${pctLabel})`}
              className={`text-left rounded-2xl p-3.5 border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                isCurrent
                  ? 'bg-white border-[#FF6B00] shadow-md ring-2 ring-[#FF6B00]/15'
                  : 'bg-white border-[#172154]/10 hover:border-[#172154]/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <span
                    className="inline-block px-2 py-0.5 rounded-md text-[11px] font-mono font-extrabold text-white"
                    style={{ backgroundColor: lvl.accentHex }}
                  >
                    {lvl.code}
                  </span>
                  <div className="text-[10px] font-bold text-[#525E80]">{lvl.ageRange}</div>
                </div>

                {/* Circular 1,000-Word Mastery Progress Ring */}
                <div
                  className="relative w-[52px] h-[52px] shrink-0 flex items-center justify-center"
                  title={biText(
                    lang,
                    `${masteredWords.toLocaleString()} / 1,000 words mastered (${pctLabel})`,
                    `${masteredWords.toLocaleString()} / 1.000 từ đã thuần thục (${pctLabel})`
                  )}
                >
                  <svg className="w-[52px] h-[52px] -rotate-90" viewBox="0 0 56 56">
                    <circle
                      cx="28"
                      cy="28"
                      r={ringRadius}
                      fill="none"
                      stroke="#E8ECF4"
                      strokeWidth="5"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r={ringRadius}
                      fill="none"
                      stroke={isComplete ? '#059669' : lvl.accentHex}
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-[11px] font-extrabold text-[#172154] leading-none tabular-nums">
                      {pctLabel}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-display text-sm font-extrabold text-[#172154] leading-tight">
                  {biText(lang, lvl.nameEn, lvl.nameVi)}
                </div>
                <div className="text-[11px] text-[#525E80] mt-0.5 line-clamp-2">
                  {biText(lang, lvl.subtitleEn, lvl.subtitleVi)}
                </div>
              </div>

              <div className="pt-2 border-t border-[#172154]/8 space-y-0.5">
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold tabular-nums">
                  <span style={{ color: isComplete ? '#059669' : lvl.accentHex }}>
                    {masteredWords.toLocaleString()} / 1,000{' '}
                    {biText(lang, 'words', 'từ')}
                  </span>
                  <span className="text-[#525E80] font-semibold">
                    {biText(lang, 'mastered', 'đạt')}
                  </span>
                </div>
                <div className="text-[10px] text-[#525E80]/80 font-medium tabular-nums">
                  {lvl.minWordsLabel} · {lvl.minPhrasesLabel}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 5-ROUND SPEAKING QUEST PROGRESS BAR */}
      {labMode === 'quest' && questItems.length > 0 && (
        <div className="bg-[#FFF8F1] border-2 border-[#FF6B00]/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-[#FFD41D]" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#C2410C]">
                {biText(lang, '5-ROUND VOICE QUEST', 'THỬ THÁCH GIỌNG NÓI 5 VÒNG')} · {currentLevelMeta.code}
              </div>
              <div className="text-sm font-bold text-[#172154]">
                {questFinished
                  ? biText(
                      lang,
                      `Quest Complete! Average Score: ${Math.round(
                        questScores.reduce((a, b) => a + b, 0) / Math.max(1, questScores.length)
                      )}% (+50 Bonus XP!)`,
                      `Hoàn Thành Thử Thách! Điểm trung bình: ${Math.round(
                        questScores.reduce((a, b) => a + b, 0) / Math.max(1, questScores.length)
                      )}% (+50 XP Thưởng!)`
                    )
                  : biText(
                      lang,
                      `Round ${questIndex + 1} of ${questItems.length} — Speak each prompt clearly to earn +50 Bonus XP!`,
                      `Vòng ${questIndex + 1} / ${questItems.length} — Đọc rõ từng thử thách để nhận +50 XP Thưởng!`
                    )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {questItems.map((qi, idx) => {
              const s = questScores[idx];
              const isCur = idx === questIndex && !questFinished;
              return (
                <button
                  key={qi.id}
                  type="button"
                  onClick={() => {
                    setQuestIndex(idx);
                    selectItem(qi);
                  }}
                  className={`w-9 h-9 rounded-xl text-xs font-mono font-extrabold flex items-center justify-center cursor-pointer transition-all tabular-nums ${
                    typeof s === 'number'
                      ? 'bg-[#0D9488] text-white'
                      : isCur
                        ? 'bg-[#FF6B00] text-white ring-2 ring-[#FF6B00]/30'
                        : 'bg-white border border-[#172154]/15 text-[#172154]'
                  }`}
                >
                  {typeof s === 'number' ? s : idx + 1}
                </button>
              );
            })}
            <button
              type="button"
              onClick={startSpeakingQuest}
              className="px-3 py-2 rounded-xl bg-[#172154] hover:bg-[#233275] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{biText(lang, 'New Quest', 'Thử Thách Mới')}</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN INTERACTIVE SPEAKING STUDIO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: FULL COMPREHENSIVE WORDS & PHRASES EXPLORER */}
        <div className="lg:col-span-5 bg-white border border-[#172154]/12 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          {/* Kind Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#F4F6FA]">
            <button
              type="button"
              onClick={() => {
                setActiveKind('word');
                setStyleFilter('all');
                setCategoryFilter('all');
                setLetterFilter('');
                setPage(1);
              }}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                activeKind === 'word'
                  ? 'bg-[#172154] text-white shadow-sm'
                  : 'text-[#525E80] hover:text-[#172154]'
              }`}
            >
              {biText(lang, 'Words', 'Từ vựng')} ({dataset?.words.length.toLocaleString() || '1,000+'})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveKind('phrase');
                setStyleFilter('all');
                setCategoryFilter('all');
                setLetterFilter('');
                setPage(1);
              }}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                activeKind === 'phrase'
                  ? 'bg-[#172154] text-white shadow-sm'
                  : 'text-[#525E80] hover:text-[#172154]'
              }`}
            >
              {biText(lang, 'Phrases', 'Câu & Cụm')} ({dataset?.phrases.length.toLocaleString() || '250+'})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveKind('mastered');
                setStyleFilter('all');
                setCategoryFilter('all');
                setLetterFilter('');
                setPage(1);
              }}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                activeKind === 'mastered'
                  ? 'bg-[#0D9488] text-white shadow-sm'
                  : 'text-[#525E80] hover:text-[#172154]'
              }`}
            >
              {biText(lang, 'Mastered', 'Thuần thục')} ({levelMasteredCount})
            </button>
          </div>

          {/* Style Filter Chips (Core / 1-Syllable / Multisyllable / Difficult / Idioms / World Cultures / Slang) */}
          <div className="flex flex-wrap gap-1.5">
            {(activeKind === 'word'
              ? (['all', 'core', 'single_syllable', 'multisyllable', 'difficult'] as const)
              : activeKind === 'phrase'
                ? (['all', 'core', 'idiom', 'cultural', 'slang'] as const)
                : (['all'] as const)
            ).map((tag) => {
              const isSel = styleFilter === tag;
              const label =
                tag === 'all'
                  ? biText(lang, 'All Styles', 'Tất cả')
                  : biText(lang, STYLE_TAG_META[tag].labelEn, STYLE_TAG_META[tag].labelVi);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setStyleFilter(tag);
                    setCategoryFilter('all');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors ${
                    isSel
                      ? 'bg-[#FF6B00] text-white shadow-xs'
                      : 'bg-[#F8F9FB] text-[#172154]/75 border border-[#172154]/10 hover:border-[#FF6B00]/50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search + Category Selector + Surprise Me */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-[#525E80] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder={biText(
                    lang,
                    'Search word, idiom, UK, AU, slang…',
                    'Tìm từ vựng, thành ngữ, UK, AU, slang…'
                  )}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#172154]/15 bg-[#F8F9FB] focus:bg-white focus:border-[#FF6B00] focus:outline-none text-xs text-[#172154]"
                />
              </div>
              <button
                type="button"
                onClick={handleRandomPick}
                title={biText(lang, 'Pick a random word or phrase', 'Chọn ngẫu nhiên')}
                className="px-3 py-2 rounded-xl bg-[#FFF5EE] hover:bg-[#FFE8D6] border border-[#FF6B00]/25 text-[#C2410C] text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>{biText(lang, 'Surprise', 'Ngẫu nhiên')}</span>
              </button>
            </div>

            {availableCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 rounded-xl border border-[#172154]/15 bg-[#F8F9FB] text-xs font-semibold text-[#172154] focus:outline-none focus:border-[#FF6B00]"
              >
                <option value="all">
                  {biText(lang, 'All Topics & Categories', 'Tất cả Chủ đề')} ({filteredItems.length.toLocaleString()})
                </option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}

            {/* Quick A-Z Jump Strip for Words */}
            {activeKind === 'word' && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setLetterFilter('');
                    setPage(1);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                    !letterFilter
                      ? 'bg-[#172154] text-white'
                      : 'bg-[#F4F6FA] text-[#525E80] hover:text-[#172154]'
                  }`}
                >
                  ALL
                </button>
                {ALPHABET.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      setLetterFilter(letterFilter === ch ? '' : ch);
                      setPage(1);
                    }}
                    className={`w-5 h-5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                      letterFilter === ch
                        ? 'bg-[#FF6B00] text-white'
                        : 'bg-[#F4F6FA] text-[#525E80] hover:bg-[#172154]/10 hover:text-[#172154]'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Item List Grid */}
          {loadingLevel ? (
            <div className="py-12 text-center text-xs text-[#525E80]">
              {biText(lang, 'Loading CEFR level word bank…', 'Đang tải kho từ vựng CEFR…')}
            </div>
          ) : pagedItems.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-xs font-semibold text-[#525E80]">
                {activeKind === 'mastered'
                  ? biText(
                      lang,
                      'No mastered items in this level yet — score 80%+ on any word or phrase to collect it here!',
                      'Chưa có từ thuần thục ở cấp này — đạt từ 80% trở lên để lưu vào đây nhé!'
                    )
                  : biText(
                      lang,
                      'No words or phrases matched your filter.',
                      'Không tìm thấy từ hoặc câu phù hợp với bộ lọc.'
                    )}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStyleFilter('all');
                  setCategoryFilter('all');
                  setLetterFilter('');
                  setSearchQuery('');
                  if (activeKind === 'mastered') setActiveKind('word');
                }}
                className="px-3 py-1.5 rounded-lg bg-[#172154] text-white text-xs font-bold cursor-pointer"
              >
                {biText(lang, 'Reset Filters', 'Đặt lại bộ lọc')}
              </button>
            </div>
          ) : (
            <div
              className={
                activeKind === 'phrase'
                  ? 'space-y-2 max-h-[540px] overflow-y-auto pr-1'
                  : 'grid grid-cols-2 gap-2 max-h-[540px] overflow-y-auto pr-1'
              }
            >
              {pagedItems.map((item) => {
                const isSelected = activeItem?.id === item.id;
                const best = progress.bestScores[item.id];
                const tagInfo = STYLE_TAG_META[item.styleTag];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className={`text-left rounded-xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-[#FFF5EE] border-[#FF6B00] ring-2 ring-[#FF6B00]/15'
                        : 'bg-[#FAFBFD] border-[#172154]/10 hover:border-[#172154]/30 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span
                        className={`font-bold text-[#172154] leading-snug ${
                          item.kind === 'phrase' ? 'text-xs' : 'text-sm capitalize'
                        }`}
                      >
                        {item.text}
                      </span>
                      {typeof best === 'number' && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold shrink-0 tabular-nums ${
                            best >= 80
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {best}%
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      {item.region && (
                        <span className="px-1.5 py-0.5 rounded bg-[#172154] text-white text-[9px] font-mono font-bold">
                          {REGION_LABELS[item.region]?.badge || item.region}
                        </span>
                      )}
                      {item.styleTag !== 'core' && (
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${tagInfo.pillClass}`}
                        >
                          {biText(lang, tagInfo.labelEn, tagInfo.labelVi)}
                        </span>
                      )}
                      {item.styleTag === 'core' && (
                        <span className="text-[10px] text-[#525E80] truncate">{item.category}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {filteredItems.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2 border-t border-[#172154]/8 text-xs">
              <span className="text-[#525E80] tabular-nums">
                {(safePage - 1) * PAGE_SIZE + 1}–
                {Math.min(safePage * PAGE_SIZE, filteredItems.length)} /{' '}
                {filteredItems.length.toLocaleString()}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-[#172154]/15 bg-white hover:bg-[#F4F6FA] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-[#172154]" />
                </button>
                <span className="font-mono font-bold text-[#172154] px-1 tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-[#172154]/15 bg-white hover:bg-[#F4F6FA] disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-[#172154]" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: LIVE AI SPEAKING STAGE & FEEDBACK STUDIO */}
        <div className="lg:col-span-7 space-y-5">
          {activeItem && (
            <div className="bg-white border border-[#172154]/12 rounded-2xl overflow-hidden shadow-sm">
              {/* Spotlight Target Banner */}
              <div className="bg-[#172154] text-white p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-extrabold text-white"
                      style={{ backgroundColor: currentLevelMeta.accentHex }}
                    >
                      {currentLevelMeta.code}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white/12 text-white text-[11px] font-bold">
                      {activeItem.category}
                    </span>
                    {activeItem.region && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0D9488] text-white text-[11px] font-bold">
                        <Globe className="w-3 h-3" />
                        {biText(
                          lang,
                          REGION_LABELS[activeItem.region]?.en || activeItem.region,
                          REGION_LABELS[activeItem.region]?.vi || activeItem.region
                        )}
                      </span>
                    )}
                    {activeItem.styleTag !== 'core' && (
                      <span className="px-2.5 py-1 rounded-lg bg-[#FFD41D] text-[#172154] text-[11px] font-extrabold">
                        {biText(
                          lang,
                          STYLE_TAG_META[activeItem.styleTag].labelEn,
                          STYLE_TAG_META[activeItem.styleTag].labelVi
                        )}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStepItem(-1)}
                      className="p-2 rounded-lg bg-white/12 hover:bg-white/22 text-white cursor-pointer transition-colors"
                      title={biText(lang, 'Previous item', 'Mục trước')}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleRandomPick}
                      className="p-2 rounded-lg bg-white/12 hover:bg-white/22 text-white cursor-pointer transition-colors"
                      title={biText(lang, 'Random item', 'Chọn ngẫu nhiên')}
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepItem(1)}
                      className="p-2 rounded-lg bg-white/12 hover:bg-white/22 text-white cursor-pointer transition-colors"
                      title={biText(lang, 'Next item', 'Mục tiếp theo')}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Big Spotlight Word or Phrase */}
                <div className="py-3 sm:py-5 text-center space-y-3">
                  <div className="text-[11px] uppercase tracking-widest text-white/60 font-bold">
                    {activeItem.kind === 'phrase'
                      ? biText(lang, 'READ THIS PHRASE OUT LOUD', 'ĐỌC TO CÂU GIAO TIẾP NÀY')
                      : biText(lang, 'PRONOUNCE THIS WORD CLEARLY', 'PHÁT ÂM RÕ RÀNG TỪ NÀY')}
                  </div>
                  <div
                    className={`font-display font-extrabold tracking-tight text-white leading-tight ${
                      activeItem.kind === 'phrase'
                        ? 'text-xl sm:text-2xl lg:text-3xl max-w-2xl mx-auto'
                        : 'text-3xl sm:text-5xl capitalize'
                    }`}
                  >
                    {activeItem.text}
                  </div>
                  {typeof progress.bestScores[activeItem.id] === 'number' && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/12 text-xs font-bold text-[#FFD41D] tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-[#FFD41D]" />
                      <span>
                        {biText(lang, 'Personal Best:', 'Kỷ lục của em:')}{' '}
                        {progress.bestScores[activeItem.id]}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Listen to Native Model Voice Controls */}
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={ttsLoading !== null}
                    onClick={() => void handleListenModel('normal')}
                    className="px-4 py-2.5 rounded-xl bg-white hover:bg-[#FFF5EE] text-[#172154] text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    <Volume2 className={`w-4 h-4 text-[#FF6B00] ${ttsPlaying ? 'animate-bounce' : ''}`} />
                    <span>
                      {ttsLoading === 'normal'
                        ? biText(lang, 'Generating voice…', 'Đang tạo giọng đọc…')
                        : biText(lang, 'Listen (Natural Voice)', 'Nghe Giọng Mẫu Tự Nhiên')}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={ttsLoading !== null}
                    onClick={() => void handleListenModel('slow')}
                    className="px-4 py-2.5 rounded-xl bg-white/14 hover:bg-white/24 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    <Headphones className="w-4 h-4 text-[#5EEAD4]" />
                    <span>
                      {ttsLoading === 'slow'
                        ? biText(lang, 'Loading slow coach…', 'Đang tải giọng chậm…')
                        : biText(lang, 'Slow Clear Coach', 'Nghe Chậm Từng Âm')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoiceName((v) => (v === 'Kore' ? 'Puck' : 'Kore'))}
                    className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/18 text-white/85 text-[11px] font-bold cursor-pointer whitespace-nowrap"
                    title={biText(lang, 'Switch voice coach persona', 'Đổi giọng giáo viên')}
                  >
                    {voiceName === 'Kore'
                      ? biText(lang, 'Voice: Ms. Kore', 'Giọng: Cô Kore')
                      : biText(lang, 'Voice: Coach Puck', 'Giọng: Thầy Puck')}
                  </button>
                </div>

                {/* Live Audio Waveform Visualizer */}
                <div className="pt-2">
                  <div className="rounded-xl bg-[#0F173D] border border-white/10 px-4 py-3 flex flex-col items-center gap-2">
                    <canvas
                      ref={canvasRef}
                      width={540}
                      height={64}
                      className="w-full h-16 max-w-[540px]"
                    />
                    <div className="text-[11px] font-medium text-white/75 min-h-[18px] text-center">
                      {isRecording ? (
                        <span className="text-[#FFD41D] font-bold tabular-nums">
                          {biText(lang, 'Listening…', 'Đang lắng nghe…')} 00:
                          {String(recordingSeconds).padStart(2, '0')}
                          {liveCaption ? ` · “${liveCaption}”` : ''}
                        </span>
                      ) : evaluating ? (
                        <span className="text-[#5EEAD4] font-bold">
                          {biText(
                            lang,
                            'AI Voice Coach is analyzing your pronunciation, stress & fluency…',
                            'Huấn luyện viên AI đang phân tích phát âm, trọng âm và độ trôi chảy…'
                          )}
                        </span>
                      ) : (
                        <span>
                          {biText(
                            lang,
                            'Tap the big orange microphone below, speak clearly, then tap Stop to get your AI score!',
                            'Nhấn nút micro màu cam bên dưới, đọc thật rõ rồi nhấn Dừng để nhận điểm AI ngay!'
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Microphone Action Deck */}
              <div className="p-5 sm:p-6 bg-[#FAFBFD] flex flex-wrap items-center justify-center gap-4 border-b border-[#172154]/10">
                {!isRecording ? (
                  <button
                    type="button"
                    disabled={evaluating}
                    onClick={() => void startRecording()}
                    className="px-7 py-4 rounded-2xl bg-[#FF6B00] hover:bg-[#E05A00] text-white font-display text-base font-extrabold shadow-lg shadow-[#FF6B00]/25 flex items-center gap-3 cursor-pointer transition-all active:scale-95 disabled:opacity-60 whitespace-nowrap"
                  >
                    <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      <Mic className="w-5 h-5" />
                    </span>
                    <span>
                      {evaluating
                        ? biText(lang, 'Scoring Your Voice…', 'Đang Chấm Điểm…')
                        : biText(lang, 'Tap to Speak & Practice', 'Nhấn Để Nói & Luyện Tập')}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopAndEvaluate}
                    className="px-7 py-4 rounded-2xl bg-[#E61E64] hover:bg-[#c81655] text-white font-display text-base font-extrabold shadow-lg shadow-[#E61E64]/25 flex items-center gap-3 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                  >
                    <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      <Square className="w-4 h-4 fill-white" />
                    </span>
                    <span>
                      {biText(lang, 'Stop & Check My Score', 'Dừng & Chấm Điểm Ngay')}
                    </span>
                  </button>
                )}

                {lastRecordingUrl && !isRecording && (
                  <button
                    type="button"
                    onClick={handlePlayMyRecording}
                    className="px-4 py-3 rounded-xl bg-white hover:bg-[#F4F6FA] border border-[#172154]/15 text-[#172154] text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 text-[#0D9488]" />
                    <span>{biText(lang, 'Play My Voice', 'Nghe Lại Giọng Em')}</span>
                  </button>
                )}
              </div>

              {evalError && (
                <div className="mx-5 my-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-xs font-extrabold text-amber-950">
                        {biText(lang, 'AI Voice Coach Notice', 'Thông Báo Huấn Luyện Viên AI')}
                      </div>
                      <p className="text-xs text-amber-900/90 leading-relaxed break-words">
                        {evalError}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {micReadyNotice && !micError && (
                <div className="mx-5 my-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {biText(
                      lang,
                      'Microphone is enabled and ready! Tap "Tap to Speak & Practice" above whenever you are ready.',
                      'Micro đã được bật và sẵn sàng! Em hãy nhấn "Nhấn Để Nói & Luyện Tập" ở trên để bắt đầu nói nhé.'
                    )}
                  </span>
                </div>
              )}

              {(micError || micPermissionState === 'denied') && (
                <div className="mx-5 my-4 p-4 rounded-2xl bg-rose-50/90 border border-rose-200 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                      <MicOff className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="text-xs font-extrabold text-rose-900">
                        {micError ||
                          biText(
                            lang,
                            'Microphone permission is blocked in your browser.',
                            'Quyền sử dụng Micro đang bị chặn trên trình duyệt.'
                          )}
                      </div>
                      {(micErrorType === 'permission' || micPermissionState === 'denied') && (
                        <div className="text-[11px] text-rose-800/90 space-y-1.5 pt-1">
                          <div className="font-bold text-rose-900 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {biText(
                                lang,
                                'How to enable your microphone (takes 5 seconds):',
                                'Cách bật quyền Micro (chỉ mất 5 giây):'
                              )}
                            </span>
                          </div>
                          <ol className="list-decimal list-inside space-y-1 pl-0.5 leading-relaxed">
                            <li>
                              {biText(
                                lang,
                                'Click the Site Settings / Lock icon on the left side of your browser address bar.',
                                'Nhấn vào biểu tượng Cài đặt trang / Ổ khóa ở góc trái thanh địa chỉ trình duyệt.'
                              )}
                            </li>
                            <li>
                              {biText(
                                lang,
                                'Find "Microphone" and switch it to "Allow" (on Mac/Windows, also ensure your browser is allowed in System Privacy > Microphone).',
                                'Tìm mục "Micro / Microphone" và chuyển sang "Cho phép (Allow)" (trên Mac/Windows, kiểm tra trình duyệt đã được cấp quyền Micro trong cài đặt hệ thống).'
                              )}
                            </li>
                            <li>
                              {biText(
                                lang,
                                'Click "Test & Enable Microphone" below (or refresh the page once if needed).',
                                'Nhấn nút "Kiểm Tra & Bật Micro" bên dưới (hoặc tải lại trang một lần nếu cần).'
                              )}
                            </li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 pl-10">
                    <button
                      type="button"
                      disabled={micTesting}
                      onClick={() => void handleEnableMicrophone()}
                      className="px-3.5 py-2 rounded-xl bg-[#172154] hover:bg-[#233075] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>
                        {micTesting
                          ? biText(lang, 'Checking Microphone…', 'Đang Kiểm Tra Micro…')
                          : biText(lang, 'Test & Enable Microphone', 'Kiểm Tra & Bật Micro')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-100/60 border border-rose-200 text-rose-900 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{biText(lang, 'Reload Page', 'Tải Lại Trang')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* AI COACH EVALUATION SCORE & IMPROVEMENT FEEDBACK */}
              {evalResult && (
                <div className="p-5 sm:p-6 space-y-5 bg-white">
                  {/* Top Score Hero Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                    {/* Circular Score Gauge */}
                    <div className="sm:col-span-4 flex flex-col items-center justify-center p-4 rounded-2xl bg-[#FAFBFD] border border-[#172154]/10">
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                          <circle
                            cx="50"
                            cy="50"
                            r={scoreRingRadius}
                            fill="none"
                            stroke="#E5E9F2"
                            strokeWidth="9"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={scoreRingRadius}
                            fill="none"
                            stroke={
                              evalResult.overallScore >= 85
                                ? '#0D9488'
                                : evalResult.overallScore >= 65
                                  ? '#FF6B00'
                                  : '#E61E64'
                            }
                            strokeWidth="9"
                            strokeLinecap="round"
                            strokeDasharray={scoreRingCircumference}
                            strokeDashoffset={scoreStrokeOffset}
                            className="transition-all duration-700"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="font-display text-3xl font-extrabold text-[#172154] tabular-nums">
                            {evalResult.overallScore}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#525E80]">
                            / 100
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 mt-2">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-5 h-5 ${
                              s <= evalResult.stars
                                ? 'text-[#FFD41D] fill-[#FFD41D]'
                                : 'text-[#172154]/15'
                            }`}
                          />
                        ))}
                      </div>

                      {lastXpAwarded > 0 && (
                        <span className="mt-2 px-2.5 py-0.5 rounded-full bg-[#FFF5EE] border border-[#FF6B00]/25 text-[#C2410C] text-[11px] font-extrabold tabular-nums">
                          +{lastXpAwarded} XP
                        </span>
                      )}
                    </div>

                    {/* 4 Detailed Skill Meters */}
                    <div className="sm:col-span-8 space-y-3">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#172154] flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-[#FF6B00]" />
                        <span>{biText(lang, 'AI Voice Breakdown', 'Phân Tích Giọng Nói Chi Tiết')}</span>
                      </div>

                      {(
                        [
                          {
                            labelEn: 'Pronunciation Clarity',
                            labelVi: 'Độ Rõ Phát Âm',
                            val: evalResult.pronunciationScore,
                            color: '#FF6B00',
                          },
                          {
                            labelEn: 'Fluency & Rhythm',
                            labelVi: 'Độ Trôi Chảy & Nhịp Điệu',
                            val: evalResult.fluencyScore,
                            color: '#0D9488',
                          },
                          {
                            labelEn: 'Word Accuracy',
                            labelVi: 'Độ Chính Xác Từ Vựng',
                            val: evalResult.accuracyScore,
                            color: '#2563EB',
                          },
                          {
                            labelEn: 'Intonation & Confidence',
                            labelVi: 'Ngữ Điệu & Tự Tin',
                            val: evalResult.intonationScore,
                            color: '#7C3AED',
                          },
                        ] as const
                      ).map((metric) => (
                        <div key={metric.labelEn} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#172154]">
                              {biText(lang, metric.labelEn, metric.labelVi)}
                            </span>
                            <span className="font-mono font-extrabold text-[#172154] tabular-nums">
                              {metric.val}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[#EEF1F7] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${metric.val}%`, backgroundColor: metric.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* What I Heard + Phonetic Stress Focus */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#525E80] flex items-center gap-1.5">
                        <MessageSquareQuote className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>{biText(lang, 'What the AI Heard', 'AI Đã Nghe Được')}</span>
                      </div>
                      <div className="text-sm font-bold text-[#172154]">
                        “{evalResult.heardTranscript || biText(lang, 'No speech detected', 'Chưa nghe rõ giọng nói')}”
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 space-y-1">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#525E80] flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>{biText(lang, 'Stress & Sound Guide', 'Mẹo Trọng Âm & Phát Âm')}</span>
                      </div>
                      <div className="text-xs sm:text-sm font-semibold text-[#172154]">
                        {evalResult.phoneticFocus || activeItem.text}
                      </div>
                    </div>
                  </div>

                  {/* Word-by-Word Pronunciation Map */}
                  {evalResult.wordBreakdown.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#172154]">
                        {biText(lang, 'Word-by-Word Pronunciation Check', 'Kiểm Tra Phát Âm Từng Từ')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {evalResult.wordBreakdown.map((wb, idx) => {
                          const pillStyle =
                            wb.status === 'great'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : wb.status === 'practice'
                                ? 'bg-amber-50 border-amber-300 text-amber-900'
                                : 'bg-rose-50 border-rose-300 text-rose-800';
                          return (
                            <div
                              key={`${wb.word}_${idx}`}
                              className={`px-3 py-1.5 rounded-xl border text-xs flex flex-col gap-0.5 ${pillStyle}`}
                            >
                              <span className="font-extrabold">{wb.word}</span>
                              {wb.tip && wb.status !== 'great' && (
                                <span className="text-[10px] opacity-85">{wb.tip}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Praise + Actionable Improvement Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl bg-[#F0FDFA] border border-[#0D9488]/25 space-y-1.5">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#0F766E] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{biText(lang, 'What You Did Great', 'Điểm Em Làm Rất Tốt')}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#172154] leading-relaxed">
                        {lang === 'vi'
                          ? evalResult.praiseVi || evalResult.praiseEn
                          : evalResult.praiseEn || evalResult.praiseVi}
                      </p>
                      {lang === 'bi' && evalResult.praiseVi && (
                        <p className="text-xs text-[#0F766E] leading-relaxed pt-1 border-t border-[#0D9488]/15">
                          {evalResult.praiseVi}
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-[#FFF8F1] border border-[#FF6B00]/25 space-y-1.5">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#C2410C] flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        <span>{biText(lang, 'Where to Improve Next', 'Cách Cải Thiện Tốt Hơn')}</span>
                      </div>
                      <p className="text-xs sm:text-sm text-[#172154] leading-relaxed">
                        {lang === 'vi'
                          ? evalResult.improvementVi || evalResult.improvementEn
                          : evalResult.improvementEn || evalResult.improvementVi}
                      </p>
                      {lang === 'bi' && evalResult.improvementVi && (
                        <p className="text-xs text-[#C2410C] leading-relaxed pt-1 border-t border-[#FF6B00]/15">
                          {evalResult.improvementVi}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quick Next Action Bar */}
                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#172154]/8">
                    <button
                      type="button"
                      onClick={() => void startRecording()}
                      className="px-4 py-2.5 rounded-xl border border-[#172154]/15 bg-white hover:bg-[#F4F6FA] text-[#172154] text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{biText(lang, 'Practice Again', 'Luyện Lại Lần Nữa')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepItem(1)}
                      className="px-5 py-2.5 rounded-xl bg-[#172154] hover:bg-[#233275] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <span>
                        {labMode === 'quest' && questIndex < questItems.length - 1
                          ? biText(lang, 'Next Quest Round', 'Vòng Tiếp Theo')
                          : biText(lang, 'Next Word / Phrase', 'Từ / Câu Tiếp Theo')}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Helpful Practice Tips when no recording evaluated yet */}
              {!evalResult && !evaluating && (
                <div className="p-5 sm:p-6 bg-white grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-[#F8F9FB] border border-[#172154]/8 space-y-1">
                    <div className="font-extrabold text-[#172154]">
                      1. {biText(lang, 'Listen First', 'Nghe Mẫu Trước')}
                    </div>
                    <p className="text-[#525E80] leading-relaxed">
                      {biText(
                        lang,
                        'Tap Natural Voice or Slow Coach to hear exact syllable stress and rhythm.',
                        'Nhấn Giọng Mẫu hoặc Nghe Chậm để cảm nhận rõ trọng âm và ngữ điệu.'
                      )}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F8F9FB] border border-[#172154]/8 space-y-1">
                    <div className="font-extrabold text-[#172154]">
                      2. {biText(lang, 'Speak Out Loud', 'Nói To Rõ Ràng')}
                    </div>
                    <p className="text-[#525E80] leading-relaxed">
                      {biText(
                        lang,
                        'Watch the colorful soundwave dance as you pronounce every ending sound!',
                        'Quan sát sóng âm đầy màu sắc chuyển động khi em đọc rõ từng âm cuối!'
                      )}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F8F9FB] border border-[#172154]/8 space-y-1">
                    <div className="font-extrabold text-[#172154]">
                      3. {biText(lang, 'Level Up & Collect Stars', 'Lên Hạng & Săn Sao')}
                    </div>
                    <p className="text-[#525E80] leading-relaxed">
                      {biText(
                        lang,
                        'Read your AI coach feedback, retry to hit 80%+, and unlock Global Orator rank!',
                        'Đọc nhận xét từ AI, luyện lại đạt từ 80%+ để mở khoá danh hiệu Diễn Giả Toàn Cầu!'
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

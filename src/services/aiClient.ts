import { auth, getAppCheckHeader } from '../firebase';
import type { LangCode } from '../types';

export interface ChatHistoryItem {
  sender: 'user' | 'assistant';
  text: string;
}

async function getJsonAuthHeaders(required = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(await getAppCheckHeader()) };
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  } else if (required) {
    throw new Error('Sign in required to perform this action.');
  }
  return headers;
}

export async function sendAiChat(params: {
  message: string;
  history: ChatHistoryItem[];
  lang: LangCode;
  preferredReplyLang?: 'auto' | 'en' | 'vi';
  role: string;
  contextSummary?: string;
  searchResults?: Array<{ category: string; title: string; detail: string }>;
}): Promise<string> {
  const headers = await getJsonAuthHeaders(false);
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get AI response');
  return data.reply as string;
}

export async function translateText(params: {
  text: string;
  targetLang: LangCode;
  context?: string;
}): Promise<string> {
  const headers = await getJsonAuthHeaders(false);
  const res = await fetch('/api/ai/translate', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Translation failed');
  return data.translatedText as string;
}

export async function assistAssessmentInsight(payload: {
  studentName: string;
  cefrDisplay: string;
  speakingScore: number;
  readingScore: number;
  writingScore: number;
  vocabularyScore?: number;
  comprehensionScore?: number;
  socialScore: number;
  emotionalScore: number;
  mentalScore: number;
  teacherCommentEn: string;
  quickNotes?: Array<{
    observationDate: string;
    category: string;
    noteText: string;
  }>;
}): Promise<{
  insightEn: string;
  insightVi: string;
  draftTeacherCommentEn?: string;
  draftTeacherCommentVi?: string;
  suggestedActivities: string[];
}> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/ai/assist-update', {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode: 'assessment_insight', payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Assessment AI insight failed');
  return data;
}

export async function assistAdminDraft(payload: {
  topic: string;
  draftText: string;
}): Promise<{ titleEn: string; titleVi: string; descriptionEn: string; descriptionVi: string }> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/ai/assist-update', {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode: 'admin_update', payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'AI drafting failed');
  return data;
}

export async function synthesizeGeminiNotes(params: {
  title?: string;
  programTitle: string;
  weekNumber: number;
  rawText?: string;
  fileBase64?: string;
  mimeType?: string;
}): Promise<{
  title: string;
  weekNumber: number;
  summaryEn: string;
  summaryVi: string;
  keyVocabulary: string[];
  phonicsFocus: string;
  grammarFocus: string;
  activitiesEn: string;
  activitiesVi: string;
}> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/ai/gemini-notes', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gemini Notes generation failed');
  return data;
}

export interface GeneratedStoryScenePayload {
  titleEn: string;
  titleVi: string;
  backdrop: 'savanna' | 'lantern_bay' | 'cosmos' | 'coral_reef';
  effect: 'sunbeams' | 'fireflies' | 'stars' | 'bubbles' | 'hearts' | 'confetti';
  camera: 'zoom-in' | 'pan-right' | 'pan-left' | 'gentle-float';
  captionEn: string;
  captionVi: string;
  vocabWordEn?: string;
  vocabWordVi?: string;
  actors: Array<{
    kind: 'lion' | 'mouse' | 'dragon' | 'lila_girl' | 'lila_boy' | 'turtle' | 'owl' | 'robot';
    name: string;
    x: number;
    y: number;
    motion: 'hop' | 'walk' | 'float' | 'wave' | 'spin';
    speechEn?: string;
    speechVi?: string;
  }>;
}

export async function generateKidStoryMovie(params: {
  idea: string;
  preferredBackdrop?: string;
  ageGroup?: string;
}): Promise<{
  titleEn: string;
  titleVi: string;
  moralEn: string;
  moralVi: string;
  scenes: GeneratedStoryScenePayload[];
}> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/ai/story-studio', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Story generation failed');
  return data;
}

export type NaturalVoiceName = 'Kore' | 'Puck' | 'Zephyr' | 'Charon';

export async function synthesizeNaturalVoice(params: {
  text: string;
  lang: 'en' | 'vi';
  voiceName?: NaturalVoiceName;
  style?: string;
}): Promise<{ audioBase64: string; mimeType: string; voiceName: string }> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/ai/tts', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Natural voice generation failed');
  return data as { audioBase64: string; mimeType: string; voiceName: string };
}

export interface SpeakingWordEval {
  word: string;
  status: 'great' | 'practice' | 'missed';
  tip?: string;
}

export interface SpeakingEvalResult {
  overallScore: number;
  pronunciationScore: number;
  fluencyScore: number;
  accuracyScore: number;
  intonationScore: number;
  stars: number;
  heardTranscript: string;
  phoneticFocus: string;
  praiseEn: string;
  praiseVi: string;
  improvementEn: string;
  improvementVi: string;
  wordBreakdown: SpeakingWordEval[];
}

export async function evaluateSpeakingPractice(params: {
  targetText: string;
  itemKind: 'word' | 'phrase';
  cefrLevel: string;
  styleTag?: string;
  region?: string;
  audioBase64: string;
  mimeType: string;
  browserTranscript?: string;
}): Promise<SpeakingEvalResult> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/ai/speaking-eval', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Speaking evaluation failed');
  return data as SpeakingEvalResult;
}

export interface GeneratedVibeAppPayload {
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  codeConcepts: string[];
  remixIdeasEn: string[];
  remixIdeasVi: string[];
  html: string;
}

export async function generateKidVibeApp(params: {
  prompt: string;
  currentHtml?: string;
  theme?: string;
  ageGroup?: string;
}): Promise<GeneratedVibeAppPayload> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/ai/vibe-code', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'App generation failed');
  return data as GeneratedVibeAppPayload;
}

export async function sendReportEmail(params: {
  recipientEmail: string;
  studentName: string;
  termLabel: string;
  cefrDisplay: string;
  reportBodyText: string;
}): Promise<{
  success: boolean;
  deliveryMode: 'webhook' | 'mailto_ready';
  recipientEmail: string;
  subject: string;
  mailtoUrl: string;
  sentAt: string;
}> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/reports/send-email', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Email preparation failed');
  return data;
}

export async function sendPaymentReminderEmail(params: {
  recipientEmail: string;
  studentName: string;
  invoiceNumber: string;
  programTitle: string;
  amountVnd: number;
  dueDate: string;
  reminderBodyText: string;
}): Promise<{
  success: boolean;
  deliveryMode: 'webhook' | 'mailto_ready';
  recipientEmail: string;
  subject: string;
  mailtoUrl: string;
  sentAt: string;
}> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/billing/send-reminder-email', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Payment reminder email failed');
  return data;
}

export async function sendPaymentReminderZalo(params: {
  recipientPhone?: string;
  zaloUserId?: string;
  studentName: string;
  invoiceNumber: string;
  programTitle: string;
  amountVnd: number;
  dueDate: string;
  messageText: string;
  fallbackHotline?: string;
}): Promise<{
  success: boolean;
  deliveryMode: 'zalo_webhook' | 'zalo_oa_api' | 'zalo_link_ready';
  recipientPhone: string;
  hasDirectParentPhone: boolean;
  formattedMessage: string;
  zaloUrl: string;
  sentAt: string;
}> {
  const headers = await getJsonAuthHeaders(true);
  const res = await fetch('/api/billing/send-reminder-zalo', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Payment reminder Zalo dispatch failed');
  return data;
}

export async function storeProtectedMaterial(params: {
  noteId: string;
  fileName: string;
  mimeType: string;
  contentBase64?: string;
  rawText?: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const token = await user.getIdToken();
  const res = await fetch('/api/materials/store', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save protected material');
  }
}

export interface ReadOnlyMaterialPayload {
  noteId: string;
  fileName: string;
  mimeType: string;
  dataBase64: string;
  rawText: string;
  readOnly: boolean;
}

export async function fetchReadOnlyMaterial(noteId: string): Promise<ReadOnlyMaterialPayload> {
  const headers: Record<string, string> = {
    'X-LiLab-Read-Only': '1',
  };
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`/api/materials/read/${encodeURIComponent(noteId)}`, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Unable to load read-only material');
  return data as ReadOnlyMaterialPayload;
}

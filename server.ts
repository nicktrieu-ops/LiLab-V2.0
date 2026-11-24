import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { isServerSuperAdmin, requireAuth, SERVER_SUPER_ADMIN_EMAILS, type AuthRequest } from './src/middleware/auth.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  deleteAcademyRecord,
  getMediaAsset,
  getProtectedMaterial,
  getSqlAcademySnapshotForAdmin,
  resetAllAcademySqlRecords,
  upsertAcademyRecord,
  upsertProtectedMaterial,
  type AcademyCollectionName,
} from './src/db/academyRepo.ts';
import { getOrCreateUser } from './src/db/users.ts';

// V2 cost control: small in-memory LRU for repeatable AI outputs (TTS audio, translations).
// The same phrase narrated or translated twice is served from memory instead of a new paid call.
import { createHash } from 'crypto';
class AiResponseCache<T> {
  private store = new Map<string, { value: T; expiresAt: number; bytes: number }>();
  private totalBytes = 0;
  private maxBytes: number;
  private ttlMs: number;
  constructor(maxBytes: number, ttlMs: number) {
    this.maxBytes = maxBytes;
    this.ttlMs = ttlMs;
  }
  static key(...parts: unknown[]): string {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }
  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.delete(key);
      return undefined;
    }
    this.store.delete(key);
    this.store.set(key, hit); // refresh LRU position
    return hit.value;
  }
  set(key: string, value: T, bytes: number): void {
    if (bytes > this.maxBytes / 4) return;
    this.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs, bytes });
    this.totalBytes += bytes;
    while (this.totalBytes > this.maxBytes) {
      const oldest = this.store.keys().next().value;
      if (!oldest) break;
      this.delete(oldest);
    }
  }
  private delete(key: string): void {
    const hit = this.store.get(key);
    if (hit) {
      this.totalBytes -= hit.bytes;
      this.store.delete(key);
    }
  }
}
const ttsCache = new AiResponseCache<{ audioBase64: string; mimeType: string; voiceName: string }>(
  64 * 1024 * 1024,
  7 * 24 * 60 * 60 * 1000
);
const translateCache = new AiResponseCache<string>(8 * 1024 * 1024, 24 * 60 * 60 * 1000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '15mb' }));

// Lightweight in-memory rate limiter for public AI endpoints to prevent API credit abuse
const aiRateBuckets = new Map<string, { count: number; resetAt: number }>();
function checkPublicAiRateLimit(req: express.Request, maxPerWindow = 30, windowMs = 5 * 60 * 1000): boolean {
  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.ip) || 'unknown';
  const now = Date.now();
  const bucket = aiRateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    if (aiRateBuckets.size > 2000) aiRateBuckets.clear();
    aiRateBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxPerWindow) return false;
  bucket.count += 1;
  return true;
}

// Validate outbound webhook URLs to block loopback, link-local, and private network targets
function isSafeWebhookUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host === '169.254.169.254' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      /^169\.254\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function resolveCallerRole(req: AuthRequest): Promise<{
  uid: string;
  email: string;
  role: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
}> {
  const uid = req.user?.uid || '';
  const email = (req.user?.email || '').trim().toLowerCase();
  const superAdmin = isServerSuperAdmin(email);
  let role = superAdmin ? 'super_admin' : 'parent';
  if (uid && email) {
    try {
      const sqlUser = await getOrCreateUser({ uid, email });
      if (sqlUser?.role) {
        role = superAdmin ? 'super_admin' : sqlUser.role;
      }
    } catch {
      // Fallback to token-derived role
    }
  }
  const isAdmin = superAdmin || role === 'super_admin' || role === 'admin';
  const isTeacher = role === 'teacher';
  return { uid, email, role, isSuperAdmin: superAdmin || role === 'super_admin', isAdmin, isTeacher };
}

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'openrouter/free';

interface OpenRouterChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callOpenRouterChatCompletion(params: {
  messages: OpenRouterChatMessage[];
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = getCleanEnvKey(process.env.OPENROUTER_API_KEY);
  if (!apiKey || apiKey === 'MY_OPENROUTER_API_KEY') {
    throw new Error('OpenRouter API key is not configured in Secrets (OPENROUTER_API_KEY).');
  }

  const sendRequest = async (includeJsonFormat: boolean) => {
    const body: Record<string, unknown> = {
      model: OPENROUTER_MODEL,
      messages: params.messages,
      temperature: params.temperature ?? 0.4,
    };
    if (params.maxTokens) {
      body.max_tokens = params.maxTokens;
    }
    if (includeJsonFormat) {
      body.response_format = { type: 'json_object' };
    }

    return fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.APP_URL?.trim() || 'https://lilab.edu.vn',
        'X-Title': 'LiLab Creative Talent Academy',
      },
      body: JSON.stringify(body),
    });
  };

  let resp = await sendRequest(Boolean(params.jsonMode));
  let rawText = await resp.text();

  // Some free models behind openrouter/free do not support response_format: json_object.
  // Retry once without response_format and rely on the strict JSON system prompt + parser.
  if (!resp.ok && params.jsonMode && (resp.status === 400 || resp.status === 422)) {
    resp = await sendRequest(false);
    rawText = await resp.text();
  }

  if (!resp.ok) {
    let errDetail = rawText.slice(0, 320);
    try {
      const parsedErr = JSON.parse(rawText) as { error?: { message?: string } };
      if (parsedErr?.error?.message) {
        errDetail = parsedErr.error.message;
      }
    } catch {
      // Preserve raw error snippet
    }
    throw new Error(`OpenRouter API error (${resp.status}): ${errDetail}`);
  }

  const parsed = JSON.parse(rawText) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  };
  const content = parsed.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }
  return (content ?? '').trim();
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('AI model returned an invalid JSON payload.');
  }
}

function extractReadableTextFromBase64(fileBase64: string, mimeType: string): string {
  try {
    const buf = Buffer.from(fileBase64, 'base64');
    if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml')) {
      return buf.toString('utf-8').slice(0, 12000);
    }
    // Extract readable ASCII/UTF-8 text segments from uploaded PDF/binary docs as context
    const decoded = buf.toString('latin1');
    const printableRuns = decoded.match(/[A-Za-z0-9,.;:!?'"()\-/\s]{6,}/g) || [];
    const filtered = printableRuns
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 6 && !/^(obj|endobj|stream|endstream|xref|trailer|startxref)$/i.test(s));
    return filtered.join('\n').slice(0, 10000);
  } catch {
    return '';
  }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Database-backed static media endpoint (images & curriculum PDFs served from Cloud SQL with in-memory cache)
interface CachedMediaEntry {
  buffer: Buffer;
  mimeType: string;
  etag: string;
}
const mediaCache = new Map<string, CachedMediaEntry>();

app.get('/api/media/:key', async (req, res) => {
  try {
    const key = String(req.params.key || '');
    if (!/^[a-zA-Z0-9._-]{1,160}$/.test(key) || key.includes('..') || key.startsWith('.')) {
      return res.status(400).json({ error: 'Invalid media key.' });
    }

    let entry = mediaCache.get(key);
    if (!entry) {
      // Serve bundled lightweight image assets directly from disk first (strictly confined inside base dirs)
      const allowedBaseDirs = [
        path.resolve(__dirname, 'dist', 'assets', 'media'),
        path.resolve(__dirname, 'public', 'assets', 'media'),
        path.resolve(__dirname, 'dist', 'assets'),
        path.resolve(__dirname, 'public', 'assets'),
      ];
      let localFile: string | undefined;
      for (const baseDir of allowedBaseDirs) {
        const resolved = path.resolve(baseDir, key);
        if (resolved.startsWith(baseDir + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
          localFile = resolved;
          break;
        }
      }
      if (localFile) {
        const buffer = fs.readFileSync(localFile);
        const ext = path.extname(key).toLowerCase();
        const mimeType =
          ext === '.webp'
            ? 'image/webp'
            : ext === '.png'
              ? 'image/png'
              : ext === '.jpg' || ext === '.jpeg'
                ? 'image/jpeg'
                : ext === '.pdf'
                  ? 'application/pdf'
                  : 'application/octet-stream';
        entry = {
          buffer,
          mimeType,
          etag: `"local-${key}-${buffer.length}"`,
        };
      } else {
        const row = await getMediaAsset(key);
        if (!row || !row.dataBase64) {
          return res.status(404).json({ error: 'Media asset not found.' });
        }
        const buffer = Buffer.from(row.dataBase64, 'base64');
        const etag = row.etag || `"${key}-${buffer.length}"`;
        entry = {
          buffer,
          mimeType: row.mimeType || 'application/octet-stream',
          etag,
        };
      }
      // Cap in-memory cache to 128 items to keep memory footprint bounded
      if (mediaCache.size > 128) {
        const firstKey = mediaCache.keys().next().value;
        if (firstKey) mediaCache.delete(firstKey);
      }
      mediaCache.set(key, entry);
    }

    if (req.headers['if-none-match'] === entry.etag) {
      return res.status(304).end();
    }

    res.setHeader('Content-Type', entry.mimeType);
    res.setHeader('Content-Length', String(entry.buffer.length));
    res.setHeader('ETag', entry.etag);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(entry.buffer);
  } catch (error) {
    console.error('Media asset fetch error:', error);
    return res.status(500).json({ error: 'Failed to load media asset.' });
  }
});

// Block any direct PDF asset download to preserve material copyright
app.use('/protected_materials', (_req, res) => {
  res.status(403).json({
    error: 'Direct file download is disabled to preserve curriculum copyright. View materials read-only inside Gemini Notebook.',
  });
});
app.use('/assets/aistudio', (req, res, next) => {
  if (req.path.toLowerCase().endsWith('.pdf')) {
    return res.status(403).json({
      error: 'Direct file download is disabled to preserve curriculum copyright. View materials read-only inside Gemini Notebook.',
    });
  }
  next();
});

// 0. Copyright-Protected Read-Only Gemini Notebook Materials API
app.post('/api/materials/store', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.email) {
      return res.status(403).json({ error: 'Verified email required.' });
    }
    const sqlUser = await getOrCreateUser({
      uid: req.user.uid,
      email: req.user.email,
    });
    if (
      !isServerSuperAdmin(req.user.email) &&
      sqlUser.role !== 'admin' &&
      sqlUser.role !== 'super_admin' &&
      sqlUser.role !== 'teacher'
    ) {
      return res.status(403).json({ error: 'Only admins and teachers can upload curriculum materials.' });
    }

    const { noteId, fileName = '', mimeType = 'application/pdf', contentBase64 = '', rawText = '' } = req.body ?? {};
    if (!noteId || typeof noteId !== 'string' || !/^[a-zA-Z0-9_-]{3,128}$/.test(noteId)) {
      return res.status(400).json({ error: 'Valid noteId is required.' });
    }
    if (!contentBase64 && !rawText) {
      return res.status(400).json({ error: 'Material content is required.' });
    }

    await upsertProtectedMaterial({
      noteId,
      fileName: String(fileName || 'Curriculum Material').slice(0, 200),
      mimeType: String(mimeType || 'application/pdf').slice(0, 120),
      contentBase64: typeof contentBase64 === 'string' ? contentBase64 : '',
      rawText: typeof rawText === 'string' ? rawText : '',
      uploadedByUid: req.user.uid,
    });

    res.json({ ok: true, noteId });
  } catch (error) {
    console.error('Store protected material error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to store protected material.';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/materials/read/:noteId', async (req, res) => {
  try {
    const readerHeader = req.headers['x-lilab-read-only'];
    if (readerHeader !== '1') {
      return res.status(403).json({
        error: 'Materials are strictly read-only and cannot be downloaded directly.',
      });
    }

    const noteId = String(req.params.noteId || '');
    if (!/^[a-zA-Z0-9_-]{3,128}$/.test(noteId)) {
      return res.status(400).json({ error: 'Invalid material id.' });
    }

    // All uploaded notes require authenticated Firebase session; Week 01 sample preview is allowed read-only on login screen
    if (noteId !== 'note_be_whole_week_01') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Sign in required to read Gemini Notebook materials.' });
      }
      const token = authHeader.split('Bearer ')[1];
      await adminAuth.verifyIdToken(token);
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('Content-Disposition', 'inline');

    const stored = await getProtectedMaterial(noteId).catch(() => null);
    if (stored && (stored.contentBase64 || stored.rawText)) {
      return res.json({
        noteId: stored.noteId,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        dataBase64: stored.contentBase64,
        rawText: stored.rawText,
        readOnly: true,
      });
    }

    if (noteId === 'note_be_whole_week_01') {
      const protectedPdfPath = path.join(__dirname, 'protected_materials', 'week_01_be_whole.pdf');
      if (fs.existsSync(protectedPdfPath)) {
        const pdfBuf = fs.readFileSync(protectedPdfPath);
        return res.json({
          noteId,
          fileName: 'Be Whole Week 01 · Kindness (Read-Only)',
          mimeType: 'application/pdf',
          dataBase64: pdfBuf.toString('base64'),
          rawText: '',
          readOnly: true,
        });
      }
    }

    return res.json({
      noteId,
      fileName: '',
      mimeType: '',
      dataBase64: '',
      rawText: '',
      readOnly: true,
    });
  } catch (error) {
    console.error('Read protected material error:', error);
    return res.status(401).json({ error: 'Unable to verify read-only access for this material.' });
  }
});

// 1. Bilingual AI Academy Chatbox (with live academy search & context; rate-limited for guest preview)
app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!checkPublicAiRateLimit(req, 30, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    }
    const {
      message,
      history = [],
      lang = 'en',
      preferredReplyLang = 'auto',
      role = 'guest',
      contextSummary = '',
      searchResults = [],
    } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }
    const safeMessage = message.slice(0, 4000);
    const safeContextSummary = typeof contextSummary === 'string' ? contextSummary.slice(0, 8000) : '';

    const languageRule =
      preferredReplyLang === 'vi'
        ? 'Always reply in clear, natural Vietnamese (Tiếng Việt), keeping English curriculum terms/CEFR codes where helpful.'
        : preferredReplyLang === 'en'
          ? 'Always reply in clear, natural English.'
          : lang === 'bi'
            ? 'Reply in a balanced bilingual English + Vietnamese mix (provide clear English followed by natural Vietnamese so teachers and parents understand both).'
            : 'Detect the user message language: if they write in Vietnamese, reply in natural Vietnamese; if in English, reply in English (and provide bilingual highlights when helpful).';

    const hitsText =
      Array.isArray(searchResults) && searchResults.length > 0
        ? `\nMatched Academy Records for this query:\n${searchResults
            .map((h: { category?: string; title?: string; detail?: string }) => `- [${h.category}] ${h.title}: ${h.detail}`)
            .join('\n')}`
        : '';

    const systemInstruction = `You are the bilingual Vietnamese/English Backend AI Assistant & Search Copilot for LiLab Creative Talent Academy.
You help Super Admins, Admins, Teachers, Parents, and Students search live academy records, answer any operational or curriculum question, draft bilingual messages, explain Cambridge English CEFR levels (Pre-A1 Starters through C2 Proficiency with -/standard/+ modifiers), and navigate the "Be Whole" 13-week values curriculum (including Week 01 Kindness: "The Lion and the Mouse", Phonics /k/, /h/, /sh/, Sentence House).
Current user role: ${role}. UI language: ${lang === 'vi' ? 'Vietnamese' : lang === 'bi' ? 'Bilingual EN + VI Mix' : 'English'}.
Language rule: ${languageRule}
${safeContextSummary ? `\nLive Authorized Academy Data Summary:\n${safeContextSummary}` : ''}${hitsText}
Be concise, accurate, and grounded in the live academy records provided above whenever the user searches or asks about specific students, teachers, classes, schedules, invoices, banking, or study notes. Never fabricate student scores or invoice amounts not present in the context.`;

    const messages: OpenRouterChatMessage[] = [{ role: 'system', content: systemInstruction }];
    if (Array.isArray(history)) {
      for (const item of history.slice(-8) as Array<{ sender?: string; text?: string }>) {
        const txt = String(item?.text ?? '').trim().slice(0, 2000);
        if (!txt) continue;
        messages.push({
          role: item.sender === 'user' ? 'user' : 'assistant',
          content: txt,
        });
      }
    }
    messages.push({ role: 'user', content: safeMessage });

    const reply = await callOpenRouterChatCompletion({ messages, temperature: 0.4 });
    res.json({ reply });
  } catch (error) {
    console.error('AI chat error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate AI response.';
    res.status(500).json({ error: msg });
  }
});

// 2. English <-> Vietnamese Translation (rate-limited for visitor drawer & authenticated users)
app.post('/api/ai/translate', async (req, res) => {
  try {
    if (!checkPublicAiRateLimit(req, 35, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many translation requests. Please wait a moment.' });
    }
    const { text, targetLang = 'vi', context = 'academy communication' } = req.body ?? {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text to translate is required.' });
    }
    const safeText = text.slice(0, 6000);
    const safeContext = String(context || 'academy communication').slice(0, 200);

    const targetName = targetLang === 'vi' ? 'Vietnamese (Tiếng Việt)' : 'English';
    const translateKey = AiResponseCache.key(safeText, targetName, safeContext);
    const cachedTranslation = translateCache.get(translateKey);
    if (cachedTranslation) {
      return res.json({ translatedText: cachedTranslation, cached: true });
    }
    const translatedText = await callOpenRouterChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a precise bilingual English/Vietnamese translator for LiLab Creative Talent Academy. Preserve educational terms, CEFR level codes (like Pre-A1 Starters+, A1 Movers-), and formatting. Return only the translated text without commentary.',
        },
        {
          role: 'user',
          content: `Translate the following ${safeContext} cleanly and naturally into ${targetName}:\n\n${safeText}`,
        },
      ],
      temperature: 0.2,
    });

    if (translatedText) translateCache.set(translateKey, translatedText, translatedText.length * 2);
    res.json({ translatedText });
  } catch (error) {
    console.error('AI translate error:', error);
    const msg = error instanceof Error ? error.message : 'Translation failed.';
    res.status(500).json({ error: msg });
  }
});

// 3. AI-Assisted Info Update (Admin) & Assessment Understanding (Teacher)
app.post('/api/ai/assist-update', requireAuth, async (req: AuthRequest, res) => {
  try {
    const caller = await resolveCallerRole(req);
    if (!caller.isAdmin && !caller.isTeacher) {
      return res.status(403).json({ error: 'Only admins and teachers can use AI assessment and drafting tools.' });
    }
    const { mode, payload } = req.body ?? {};

    if (mode === 'assessment_insight') {
      const quickNotesList = Array.isArray(payload?.quickNotes)
        ? (payload.quickNotes as Array<{ observationDate?: string; category?: string; noteText?: string }>)
        : [];
      const observationsBlock =
        quickNotesList.length > 0
          ? `\nDaily Teacher Quick Notes / Classroom Observations (chronological evidence to weave naturally into the report):\n${quickNotesList
              .map(
                (n) =>
                  `- [${n.observationDate || 'Recent'} · ${(n.category || 'general').toUpperCase()}] ${n.noteText || ''}`
              )
              .join('\n')}`
          : '';

      const raw = await callOpenRouterChatCompletion({
        jsonMode: true,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content: `You are an academic evaluation specialist for LiLab Creative Talent Academy. Return ONLY valid JSON matching this exact schema:
{
  "insightEn": "Encouraging analytical summary in English synthesizing CEFR level +/-, Speaking/Reading/Writing/Vocabulary/Comprehension-Listening, Social/Emotional/Mental growth, and specific observations from daily Quick Notes.",
  "insightVi": "Natural Vietnamese translation and parent-friendly explanation of the same assessment and daily Quick Notes observations.",
  "draftTeacherCommentEn": "Concise, warm 2-3 sentence English teacher narrative ready for the student report, weaving in key daily Quick Notes.",
  "draftTeacherCommentVi": "Natural Vietnamese 2-3 sentence teacher narrative ready for parents, weaving in key daily Quick Notes.",
  "suggestedActivities": ["activity 1", "activity 2", "activity 3"]
}`,
          },
          {
            role: 'user',
            content: `Analyze this LiLab Creative Talent Academy student evaluation and the teacher's daily Quick Notes observations. Generate clear, encouraging, evidence-backed bilingual insights and synthesized parent-ready teacher feedback, plus 3 concrete home/class practice activities.\n\nStudent Data:\n${JSON.stringify(payload, null, 2)}${observationsBlock}`,
          },
        ],
      });
      const parsed = parseJsonResponse(raw);
      return res.json(parsed);
    }

    // Admin info update / drafting assistant
    const raw = await callOpenRouterChatCompletion({
      jsonMode: true,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `You are an academy operations assistant for LiLab Creative Talent Academy. Return ONLY valid JSON matching this exact schema:
{
  "titleEn": "string",
  "titleVi": "string",
  "descriptionEn": "string",
  "descriptionVi": "string"
}`,
        },
        {
          role: 'user',
          content: `Improve, structure, and translate this record information:\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
    });
    const parsed = parseJsonResponse(raw);
    return res.json(parsed);
  } catch (error) {
    console.error('AI assist-update error:', error);
    const msg = error instanceof Error ? error.message : 'AI assistance failed.';
    res.status(500).json({ error: msg });
  }
});

// 4. Upload Curriculum Materials to Study Notes (Admin / Teacher only)
app.post('/api/ai/gemini-notes', requireAuth, async (req: AuthRequest, res) => {
  try {
    const caller = await resolveCallerRole(req);
    if (!caller.isAdmin && !caller.isTeacher) {
      return res.status(403).json({ error: 'Only admins and teachers can synthesize curriculum study notes.' });
    }
    const {
      title = '',
      programTitle = 'Be Whole Values Curriculum',
      weekNumber = 1,
      rawText = '',
      fileBase64 = '',
      mimeType = 'application/pdf',
    } = req.body ?? {};

    if (!rawText && !fileBase64) {
      return res.status(400).json({ error: 'Provide curriculum text or upload a material file.' });
    }

    const extractedFromFile = fileBase64 ? extractReadableTextFromBase64(String(fileBase64), String(mimeType)) : '';
    const combinedMaterial = [
      rawText ? `Provided Material Text:\n${String(rawText).slice(0, 14000)}` : '',
      extractedFromFile ? `Extracted File Text (${mimeType}):\n${extractedFromFile}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const raw = await callOpenRouterChatCompletion({
      jsonMode: true,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: `You are a bilingual curriculum designer for LiLab Creative Talent Academy. Return ONLY valid JSON matching this exact schema:
{
  "title": "string",
  "weekNumber": 1,
  "summaryEn": "concise English summary",
  "summaryVi": "concise Vietnamese summary",
  "keyVocabulary": ["word 1", "word 2"],
  "phonicsFocus": "string",
  "grammarFocus": "string",
  "activitiesEn": "classroom and homework activities in English",
  "activitiesVi": "classroom and homework activities in Vietnamese"
}`,
        },
        {
          role: 'user',
          content: `Extract and synthesize structured bilingual study notes for LiLab Creative Talent Academy from this curriculum material.
Program: ${programTitle}, Week ${weekNumber}, Title hint: ${title || 'Auto-detect'}.
Include concise English and Vietnamese summaries, key English vocabulary words/phrases, phonics focus, grammar focus, and classroom/homework activities.

${combinedMaterial || `Uploaded curriculum file (${mimeType}) for ${programTitle}, Week ${weekNumber}, Title: ${title || 'Lesson Study Guide'}.`}`,
        },
      ],
    });

    const parsed = parseJsonResponse(raw);
    res.json(parsed);
  } catch (error) {
    console.error('Curriculum study notes error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to synthesize study notes.';
    res.status(500).json({ error: msg });
  }
});

// 4b. Kids Animation Studio — Bilingual 4-Scene Animated Storyboard Generator
app.post('/api/ai/story-studio', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!checkPublicAiRateLimit(req, 20, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Please wait a moment before generating another story.' });
    }
    const { idea = '', preferredBackdrop = 'savanna', ageGroup = '6-12' } = req.body ?? {};
    if (!idea || typeof idea !== 'string' || !idea.trim()) {
      return res.status(400).json({ error: 'Please enter a story idea.' });
    }
    const safeIdea = idea.trim().slice(0, 600);

    const systemPrompt = `You are a joyful children's animation director and bilingual English/Vietnamese teacher at LiLab Creative Talent Academy.
Create a wholesome, imaginative 4-scene animated short story suitable for kids ages ${ageGroup}.
Return ONLY valid JSON matching this exact schema:
{
  "titleEn": "Short exciting story title in English",
  "titleVi": "Vietnamese title",
  "moralEn": "One-sentence Be Whole value lesson in English",
  "moralVi": "One-sentence lesson in Vietnamese",
  "scenes": [
    {
      "titleEn": "Scene 1 title",
      "titleVi": "Tiêu đề cảnh 1",
      "backdrop": "savanna" | "lantern_bay" | "cosmos" | "coral_reef",
      "effect": "sunbeams" | "fireflies" | "stars" | "bubbles" | "hearts" | "confetti",
      "camera": "zoom-in" | "pan-right" | "pan-left" | "gentle-float",
      "captionEn": "1-2 short lively storybook sentences in English (max 140 chars)",
      "captionVi": "Natural Vietnamese translation (max 150 chars)",
      "vocabWordEn": "One key English word from this scene",
      "vocabWordVi": "Vietnamese meaning",
      "actors": [
        {
          "kind": "lion" | "mouse" | "dragon" | "lila_girl" | "lila_boy" | "turtle" | "owl" | "robot",
          "name": "Friendly short name",
          "x": 0.3,
          "y": 0.68,
          "motion": "hop" | "walk" | "float" | "wave" | "spin",
          "speechEn": "Short fun quote (max 45 chars)",
          "speechVi": "Short Vietnamese quote (max 50 chars)"
        }
      ]
    }
  ]
}
Include 4 scenes and 2 actors per scene with well-spaced x positions (e.g. 0.28 and 0.72) and y between 0.52 and 0.74. Default starting backdrop preference: ${preferredBackdrop}.`;

    const userPrompt = `Create a 4-scene animated bilingual kids story about: ${safeIdea}`;
    const geminiAi = getGeminiClient();
    let raw = '';

    if (geminiAi) {
      try {
        const response = await geminiAi.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
          },
        });
        raw = (response.text ?? '').trim();
      } catch (geminiErr) {
        if (isGeminiAuthError(geminiErr)) {
          markGeminiKeyRejected();
        }
        if (hasConfiguredOpenRouterKey() && isGeminiAuthError(geminiErr)) {
          raw = await callOpenRouterChatCompletion({
            jsonMode: true,
            temperature: 0.65,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          });
        } else {
          throw geminiErr;
        }
      }
    } else {
      raw = await callOpenRouterChatCompletion({
        jsonMode: true,
        temperature: 0.65,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
    }

    const parsed = parseJsonResponse(raw);
    res.json(parsed);
  } catch (error) {
    console.error('Kids story studio AI error:', error);
    const msg = formatUpstreamAiError(error, 'Failed to generate animated story.');
    res.status(500).json({ error: msg });
  }
});

let sharedGeminiClient: GoogleGenAI | null = null;
let sharedGeminiApiKey = '';
let rejectedGeminiApiKey = '';

function getCleanEnvKey(raw?: string): string {
  return (raw || '').trim().replace(/^["']|["']$/g, '').trim();
}

function isPlaceholderOrWrongProviderKey(key: string): boolean {
  if (!key || key.length < 16) return true;
  if (/^(MY_|YOUR_|REPLACE_|PLACEHOLDER|TEST_)/i.test(key)) return true;
  // Guard against OpenRouter / OpenAI keys accidentally placed in GEMINI_API_KEY
  if (/^sk-/i.test(key)) return true;
  return false;
}

function markGeminiKeyRejected(): void {
  const currentKey = getCleanEnvKey(process.env.GEMINI_API_KEY);
  if (currentKey) {
    rejectedGeminiApiKey = currentKey;
    sharedGeminiClient = null;
  }
}

function hasConfiguredOpenRouterKey(): boolean {
  const key = getCleanEnvKey(process.env.OPENROUTER_API_KEY);
  return Boolean(key && key !== 'MY_OPENROUTER_API_KEY');
}

function isGeminiAuthError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || '');
  return (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('API key not valid') ||
    msg.includes('UNAUTHENTICATED') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')
  );
}

function formatUpstreamAiError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (isGeminiAuthError(error)) {
    return 'Gemini API key is invalid or unauthorized. Please open Settings > Secrets and select a valid GEMINI_API_KEY, then retry.';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'AI Coach is momentarily busy (rate limit reached). Please wait a few seconds and try again.';
  }
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // plain text error
  }
  return raw ? raw.slice(0, 260) : fallback;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = getCleanEnvKey(process.env.GEMINI_API_KEY);
  if (isPlaceholderOrWrongProviderKey(apiKey)) return null;
  if (rejectedGeminiApiKey && rejectedGeminiApiKey === apiKey) return null;
  if (!sharedGeminiClient || sharedGeminiApiKey !== apiKey) {
    sharedGeminiApiKey = apiKey;
    rejectedGeminiApiKey = '';
    sharedGeminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return sharedGeminiClient;
}

const VALID_TTS_VOICES = new Set(['Kore', 'Puck', 'Zephyr', 'Charon', 'Fenrir']);

// 4b-tts. Natural Human Storyteller Voice (Gemini 3.8 Flash Lite TTS)
app.post('/api/ai/tts', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!checkPublicAiRateLimit(req, 60, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Please wait a moment before generating more narration.' });
    }
    const {
      text = '',
      lang: voiceLang = 'en',
      voiceName = 'Kore',
      style = '',
    } = req.body ?? {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for voice narration.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Natural AI storyteller voice is not configured yet. Check GEMINI_API_KEY in Settings > Secrets.',
      });
    }

    const safeText = text.trim().slice(0, 800);
    const chosenVoice = VALID_TTS_VOICES.has(String(voiceName)) ? String(voiceName) : 'Kore';
    const defaultStyle =
      voiceLang === 'vi'
        ? "Warm, natural, joyful Vietnamese children's storybook narrator, gentle pacing, crystal-clear human intonation"
        : "Warm, natural, joyful English children's storybook narrator, expressive human warmth, friendly and clear pacing for young learners";
    const chosenStyle =
      typeof style === 'string' && style.trim() ? style.trim().slice(0, 180) : defaultStyle;

    const ttsKey = AiResponseCache.key(safeText, chosenVoice, chosenStyle);
    const cachedAudio = ttsCache.get(ttsKey);
    if (cachedAudio) {
      res.setHeader('X-LiLab-Cache', 'hit');
      return res.json(cachedAudio);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: safeText,
              speechMetadata: {
                style: chosenStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    );
    const base64Audio = audioPart?.inlineData?.data;
    if (!base64Audio) {
      return res.status(502).json({ error: 'No audio was returned by the voice narrator.' });
    }

    // Unary gemini-3.8-flash-lite-tts returns a complete WAV file (audio/wav, 24kHz mono 16-bit)
    const ttsPayload = {
      audioBase64: base64Audio,
      mimeType: audioPart?.inlineData?.mimeType || 'audio/wav',
      voiceName: chosenVoice,
    };
    ttsCache.set(ttsKey, ttsPayload, base64Audio.length);
    res.json(ttsPayload);
  } catch (error) {
    if (isGeminiAuthError(error)) {
      markGeminiKeyRejected();
      console.warn('Gemini TTS unavailable: GEMINI_API_KEY was rejected (401/403). Check Settings > Secrets.');
      return res.status(401).json({
        error: formatUpstreamAiError(error, 'Natural AI voice requires a valid GEMINI_API_KEY in Settings > Secrets.'),
      });
    }
    console.error('Gemini TTS error:', error);
    const msg = formatUpstreamAiError(error, 'Failed to generate natural voice audio.');
    res.status(500).json({ error: msg });
  }
});

// 4b-eval. Student Speaking Lab — Real Audio Pronunciation & Fluency AI Coach (Gemini 4 Hydrogen)
app.post('/api/ai/speaking-eval', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!checkPublicAiRateLimit(req, 60, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Please wait a moment before recording another practice clip.' });
    }
    const {
      targetText = '',
      itemKind = 'word',
      cefrLevel = 'A1',
      styleTag = 'core',
      region = '',
      audioBase64 = '',
      mimeType = 'audio/webm',
      browserTranscript = '',
    } = req.body ?? {};

    const cleanTarget = String(targetText || '').trim().slice(0, 320);
    if (!cleanTarget) {
      return res.status(400).json({ error: 'Target word or phrase is required.' });
    }
    if (!audioBase64 || typeof audioBase64 !== 'string' || audioBase64.length < 200) {
      return res.status(400).json({ error: 'Recorded speech audio is too short. Please tap the mic and speak clearly!' });
    }
    if (audioBase64.length > 8_000_000) {
      return res.status(413).json({ error: 'Audio clip is too long. Please keep each practice recording under 15 seconds.' });
    }

    const ai = getGeminiClient();
    const canUseOpenRouterFallback = hasConfiguredOpenRouterKey();
    if (!ai && !canUseOpenRouterFallback) {
      return res.status(503).json({
        error: 'AI Speaking Coach is not configured yet. Please select a valid GEMINI_API_KEY in Settings > Secrets.',
      });
    }

    // Normalize mimeType (strip codec params like ";codecs=opus" which some APIs dislike)
    const rawMime = String(mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    const safeMime = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg', 'audio/mp3'].includes(rawMime)
      ? rawMime
      : 'audio/webm';

    const safeBrowserHint = String(browserTranscript || '').trim().slice(0, 320);
    const contextNote =
      styleTag === 'idiom'
        ? 'This is an English idiom—encourage natural connected speech.'
        : styleTag === 'cultural'
          ? `This is a cultural phrase (${region || 'World English'})—celebrate natural rhythm and warmth.`
          : styleTag === 'slang'
            ? 'This is casual everyday colloquial English—encourage relaxed, friendly intonation.'
            : styleTag === 'single_syllable'
              ? 'This is a single-syllable pronunciation focus item—pay close attention to exact vowel quality, consonant clusters, and ending consonants.'
              : styleTag === 'multisyllable'
                ? 'This is a multisyllable word—pay close attention to primary syllable stress and clear unstressed syllables.'
                : 'Evaluate clear pronunciation, natural pacing, and accurate English sounds.';

    const promptText = `You are a warm, encouraging, expert English pronunciation coach for young learners at LiLab Creative Talent Academy.
Listen carefully to the attached student audio recording and evaluate how well the student spoke the target English ${itemKind === 'phrase' ? 'phrase' : 'word'}.

Target ${itemKind}: "${cleanTarget}"
Student CEFR Practice Level: ${String(cefrLevel).slice(0, 20)}
Focus note: ${contextNote}
${safeBrowserHint ? `Live browser caption hint (verify against the actual audio—trust the audio over the hint): "${safeBrowserHint}"` : ''}

SCORING RULES (be fair, honest, and kid-friendly):
- If the audio is silent, noise-only, or completely unrelated to the target, set overallScore between 0 and 25, stars to 0, heardTranscript to what was actually heard (or "(no speech detected)"), and kindly encourage them to speak closer to the mic.
- If the student spoke the target with minor accent/ending/stress issues, score fairly between 65 and 89 with specific, concrete mouth/sound/stress tips on exactly what to refine.
- If the student spoke clearly, accurately, and naturally, score 90 to 100 and award 3 stars!
- In wordBreakdown, include each word of the target text in order and mark status as "great", "practice" (heard but vowel/stress/ending needs polish), or "missed" (skipped or mispronounced strongly), plus a short tip (3–10 words) when status is not "great".
- Write praiseEn/praiseVi and improvementEn/improvementVi in warm, cheerful, concrete kid-friendly language (1–2 sentences each). Never be harsh.`;

    let parsed: Record<string, unknown> | null = null;
    let geminiFailure: unknown = null;

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: safeMime,
                  data: audioBase64,
                },
              },
              { text: promptText },
            ],
          },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                overallScore: { type: Type.INTEGER, description: 'Overall speaking score from 0 to 100' },
                pronunciationScore: { type: Type.INTEGER, description: 'Pronunciation clarity score 0 to 100' },
                fluencyScore: { type: Type.INTEGER, description: 'Fluency and rhythm score 0 to 100' },
                accuracyScore: { type: Type.INTEGER, description: 'Target word/phrase match score 0 to 100' },
                intonationScore: { type: Type.INTEGER, description: 'Stress, pitch, and confidence score 0 to 100' },
                stars: { type: Type.INTEGER, description: '0, 1, 2, or 3 stars earned' },
                heardTranscript: { type: Type.STRING, description: 'Verbatim transcript of what the student actually said' },
                phoneticFocus: { type: Type.STRING, description: 'Syllable stress and key sound guide for this target' },
                praiseEn: { type: Type.STRING, description: 'Encouraging English praise for what went well' },
                praiseVi: { type: Type.STRING, description: 'Warm Vietnamese praise for what went well' },
                improvementEn: { type: Type.STRING, description: 'Specific, actionable English tip on how to improve' },
                improvementVi: { type: Type.STRING, description: 'Specific, actionable Vietnamese tip on how to improve' },
                wordBreakdown: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      status: { type: Type.STRING, description: 'great, practice, or missed' },
                      tip: { type: Type.STRING },
                    },
                    required: ['word', 'status'],
                  },
                },
              },
              required: [
                'overallScore',
                'pronunciationScore',
                'fluencyScore',
                'accuracyScore',
                'intonationScore',
                'stars',
                'heardTranscript',
                'phoneticFocus',
                'praiseEn',
                'praiseVi',
                'improvementEn',
                'improvementVi',
                'wordBreakdown',
              ],
            },
          },
        });

        const rawJson = (response.text ?? '').trim();
        if (!rawJson) {
          throw new Error('The AI Coach did not return an evaluation. Please try recording again.');
        }
        parsed = parseJsonResponse(rawJson);
      } catch (err) {
        geminiFailure = err;
        if (isGeminiAuthError(err)) {
          markGeminiKeyRejected();
          console.warn('Gemini speaking-eval skipped: GEMINI_API_KEY was rejected (401/403). Falling back if available.');
        } else {
          console.error('Gemini speaking-eval primary error:', err);
        }
      }
    }

    // Secondary real-AI path via OpenRouter when Gemini key is invalid/missing and browser captured real speech transcript
    if (!parsed && canUseOpenRouterFallback && safeBrowserHint) {
      const fallbackRaw = await callOpenRouterChatCompletion({
        jsonMode: true,
        temperature: 0.35,
        messages: [
          {
            role: 'system',
            content: `You are a warm, encouraging, expert English pronunciation coach for young learners at LiLab Creative Talent Academy.
Evaluate the student's spoken transcript against the target English ${itemKind === 'phrase' ? 'phrase' : 'word'}.
Return ONLY valid JSON matching this exact schema:
{
  "overallScore": 0-100 integer,
  "pronunciationScore": 0-100 integer,
  "fluencyScore": 0-100 integer,
  "accuracyScore": 0-100 integer,
  "intonationScore": 0-100 integer,
  "stars": 0-3 integer,
  "heardTranscript": "exact transcript heard",
  "phoneticFocus": "syllable stress and key sound guide for the target",
  "praiseEn": "warm encouraging English praise (1-2 sentences)",
  "praiseVi": "warm encouraging Vietnamese praise (1-2 sentences)",
  "improvementEn": "concrete actionable English pronunciation tip (1-2 sentences)",
  "improvementVi": "concrete actionable Vietnamese pronunciation tip (1-2 sentences)",
  "wordBreakdown": [{ "word": "targetWord", "status": "great" | "practice" | "missed", "tip": "short 3-8 word tip when not great" }]
}`,
          },
          {
            role: 'user',
            content: `Target ${itemKind}: "${cleanTarget}"
Student CEFR Level: ${String(cefrLevel).slice(0, 20)}
Focus note: ${contextNote}
Student's spoken transcript: "${safeBrowserHint}"`,
          },
        ],
      });
      parsed = parseJsonResponse(fallbackRaw);
    }

    if (!parsed) {
      if (geminiFailure) {
        const status = isGeminiAuthError(geminiFailure) ? 401 : 502;
        return res.status(status).json({
          error: formatUpstreamAiError(
            geminiFailure,
            'Failed to evaluate your speaking clip. Please check GEMINI_API_KEY in Settings > Secrets.'
          ),
        });
      }
      return res.status(503).json({
        error:
          'No speech was detected for transcription, and GEMINI_API_KEY is not configured for direct audio analysis. Please speak clearly into the mic or verify GEMINI_API_KEY in Settings > Secrets.',
      });
    }

    const clamp = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    const overall = clamp(parsed.overallScore);
    const stars = overall >= 85 ? 3 : overall >= 68 ? 2 : overall >= 45 ? 1 : 0;

    res.json({
      overallScore: overall,
      pronunciationScore: clamp(parsed.pronunciationScore),
      fluencyScore: clamp(parsed.fluencyScore),
      accuracyScore: clamp(parsed.accuracyScore),
      intonationScore: clamp(parsed.intonationScore),
      stars,
      heardTranscript: String(parsed.heardTranscript || safeBrowserHint || ''),
      phoneticFocus: String(parsed.phoneticFocus || ''),
      praiseEn: String(parsed.praiseEn || ''),
      praiseVi: String(parsed.praiseVi || ''),
      improvementEn: String(parsed.improvementEn || ''),
      improvementVi: String(parsed.improvementVi || ''),
      wordBreakdown: Array.isArray(parsed.wordBreakdown) ? parsed.wordBreakdown : [],
    });
  } catch (error) {
    console.error('Speaking Lab AI eval error:', error);
    const status = isGeminiAuthError(error) ? 401 : 500;
    const msg = formatUpstreamAiError(error, 'Failed to evaluate your speaking clip.');
    res.status(status).json({ error: msg });
  }
});

// 4c. Kids Vibe Coding Lab — Kid-Safe Interactive Single-File Web App Generator
app.post('/api/ai/vibe-code', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!checkPublicAiRateLimit(req, 20, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Please wait a moment before building another app.' });
    }
    const {
      prompt = '',
      currentHtml = '',
      theme = 'sunny',
      ageGroup = '7-14',
    } = req.body ?? {};

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Tell us what kind of app you want to create!' });
    }

    const safePrompt = prompt.trim().slice(0, 700);
    const safeCurrentHtml = typeof currentHtml === 'string' ? currentHtml.slice(0, 12000) : '';
    const isRemix = safeCurrentHtml.length > 40;

    const raw = await callOpenRouterChatCompletion({
      jsonMode: true,
      temperature: 0.55,
      messages: [
        {
          role: 'system',
          content: `You are a joyful, patient kids coding mentor at LiLab Creative Talent Academy helping young students (ages ${ageGroup}) build REAL, working, visually delightful single-file HTML/CSS/JS mini-apps and games.
STRICT SAFETY & QUALITY RULES:
- Produce a complete, self-contained HTML5 document (<!DOCTYPE html>...) with inline <style> and <script>.
- ZERO external network fetches, ZERO external CDN scripts/fonts/images, ZERO cookies/localStorage/window.open/alert/prompt/confirm. Use inline SVG, HTML5 Canvas, CSS art, emoji, and Web Audio API for sounds!
- Make it visually joyful, big touch-friendly buttons, crisp contrast, responsive layout fitting inside an iframe (min-height: 100vh, overflow-x: hidden), and instantly interactive on load.
- Preferred visual theme mood: ${theme}.
- Return ONLY valid JSON matching this exact schema:
{
  "titleEn": "Short fun app name in English",
  "titleVi": "Vietnamese app name",
  "summaryEn": "1-2 kid-friendly sentences explaining what the app does and what coding concept it uses",
  "summaryVi": "Natural Vietnamese explanation for kids",
  "codeConcepts": ["HTML Buttons", "CSS Colors", "JavaScript Events"],
  "remixIdeasEn": ["Fun idea 1 to upgrade the app", "Fun idea 2", "Fun idea 3"],
  "remixIdeasVi": ["Ý tưởng nâng cấp 1", "Ý tưởng nâng cấp 2", "Ý tưởng nâng cấp 3"],
  "html": "<!DOCTYPE html>...complete self-contained interactive HTML/CSS/JS app..."
}`,
        },
        {
          role: 'user',
          content: isRemix
            ? `Upgrade / remix the student's existing mini-app based on their request: "${safePrompt}"\n\nExisting HTML:\n${safeCurrentHtml}`
            : `Create a brand-new, super fun, visually rich interactive kids app for this idea: "${safePrompt}"`,
        },
      ],
    });

    const parsed = parseJsonResponse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed.html !== 'string' || !parsed.html.includes('<')) {
      return res.status(502).json({ error: 'Could not assemble app code. Please try a simpler description.' });
    }
    res.json(parsed);
  } catch (error) {
    console.error('Kids vibe coding AI error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to build your app.';
    res.status(500).json({ error: msg });
  }
});

// 5. Email Report Preparation & Dispatch (Authenticated users only)
app.post('/api/reports/send-email', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { recipientEmail, studentName, termLabel, cefrDisplay, reportBodyText } = req.body ?? {};
    if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid recipient email is required.' });
    }

    const subject = `LiLab Progress Report: ${studentName} (${termLabel} · ${cefrDisplay})`;
    const webhookUrl = process.env.SMTP_WEBHOOK_URL;
    let deliveryMode: 'webhook' | 'mailto_ready' = 'mailto_ready';

    if (webhookUrl && isSafeWebhookUrl(webhookUrl)) {
      const hookResp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipientEmail, subject, text: reportBodyText }),
      });
      if (hookResp.ok) {
        deliveryMode = 'webhook';
      }
    }

    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(String(reportBodyText ?? '').slice(0, 1800))}`;
    res.json({
      success: true,
      deliveryMode,
      recipientEmail,
      subject,
      mailtoUrl,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Report email error:', error);
    res.status(500).json({ error: 'Failed to prepare report email.' });
  }
});

// 5b. Tuition Payment Due Reminder Email Dispatch (Admin only)
app.post('/api/billing/send-reminder-email', requireAuth, async (req: AuthRequest, res) => {
  try {
    const caller = await resolveCallerRole(req);
    if (!caller.isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required to dispatch payment reminders.' });
    }
    const {
      recipientEmail,
      studentName,
      invoiceNumber,
      programTitle,
      amountVnd,
      dueDate,
      reminderBodyText,
    } = req.body ?? {};
    if (!recipientEmail || typeof recipientEmail !== 'string' || !recipientEmail.includes('@')) {
      return res.status(400).json({ error: 'Valid parent email is required.' });
    }

    const formattedAmount = new Intl.NumberFormat('vi-VN').format(Number(amountVnd) || 0) + ' VND';
    const subject = `[LiLab Academy] Tuition Payment Reminder · ${invoiceNumber || 'Invoice'} (${studentName || 'Student'} · ${formattedAmount})`;
    const bodyText =
      String(reminderBodyText ?? '').trim() ||
      `Dear Parent,\n\nThis is a friendly tuition payment reminder from LiLab Creative Talent Academy.\nStudent: ${studentName || ''}\nCourse: ${programTitle || ''}\nInvoice: ${invoiceNumber || ''}\nAmount Due: ${formattedAmount}\nDue Date: ${dueDate || ''}\n\nThank you for partnering with LiLab Academy!`;

    const webhookUrl = process.env.SMTP_WEBHOOK_URL;
    let deliveryMode: 'webhook' | 'mailto_ready' = 'mailto_ready';

    if (webhookUrl && isSafeWebhookUrl(webhookUrl)) {
      const hookResp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipientEmail, subject, text: bodyText }),
      });
      if (hookResp.ok) {
        deliveryMode = 'webhook';
      }
    }

    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText.slice(0, 1800))}`;
    res.json({
      success: true,
      deliveryMode,
      recipientEmail,
      subject,
      mailtoUrl,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Payment reminder email error:', error);
    res.status(500).json({ error: 'Failed to send payment reminder email.' });
  }
});

// 5c. Tuition Payment Due Reminder Zalo Dispatch (Admin only)
app.post('/api/billing/send-reminder-zalo', requireAuth, async (req: AuthRequest, res) => {
  try {
    const caller = await resolveCallerRole(req);
    if (!caller.isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required to dispatch Zalo payment reminders.' });
    }
    const {
      recipientPhone,
      zaloUserId,
      studentName,
      invoiceNumber,
      programTitle,
      amountVnd,
      dueDate,
      messageText,
      fallbackHotline,
    } = req.body ?? {};

    const normalizePhone = (raw?: unknown): string => {
      const digits = String(raw ?? '').replace(/[^\d]/g, '');
      if (!digits) return '';
      if (digits.startsWith('84') && digits.length >= 10) return '0' + digits.slice(2);
      return digits;
    };

    const normalizedPhone = normalizePhone(recipientPhone);
    const effectivePhone = normalizedPhone || normalizePhone(fallbackHotline) || '0707547187';
    const formattedAmount = new Intl.NumberFormat('vi-VN').format(Number(amountVnd) || 0) + ' VND';
    const formattedMessage =
      String(messageText ?? '').trim() ||
      `LiLab Academy — Nhắc học phí / Tuition Reminder\n• Học viên / Student: ${studentName || ''}\n• Khóa học / Course: ${programTitle || ''}\n• Mã hóa đơn / Invoice: ${invoiceNumber || ''}\n• Số tiền / Amount: ${formattedAmount}\n• Hạn đóng / Due: ${dueDate || ''}`;

    let deliveryMode: 'zalo_webhook' | 'zalo_oa_api' | 'zalo_link_ready' = 'zalo_link_ready';

    const zaloWebhookUrl = process.env.ZALO_WEBHOOK_URL;
    const zaloOaToken = process.env.ZALO_OA_ACCESS_TOKEN;

    if (zaloWebhookUrl && isSafeWebhookUrl(zaloWebhookUrl) && normalizedPhone) {
      const hookResp = await fetch(zaloWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'zalo',
          to: normalizedPhone,
          zaloUserId: typeof zaloUserId === 'string' ? zaloUserId : undefined,
          invoiceNumber,
          studentName,
          programTitle,
          amountVnd: Number(amountVnd) || 0,
          dueDate,
          text: formattedMessage,
        }),
      });
      if (hookResp.ok) {
        deliveryMode = 'zalo_webhook';
      }
    } else if (zaloOaToken && typeof zaloUserId === 'string' && zaloUserId.trim()) {
      const oaResp = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          access_token: zaloOaToken,
        },
        body: JSON.stringify({
          recipient: { user_id: zaloUserId.trim() },
          message: { text: formattedMessage.slice(0, 1900) },
        }),
      });
      if (oaResp.ok) {
        deliveryMode = 'zalo_oa_api';
      }
    }

    const zaloUrl = `https://zalo.me/${encodeURIComponent(effectivePhone)}`;
    res.json({
      success: true,
      deliveryMode,
      recipientPhone: effectivePhone,
      hasDirectParentPhone: Boolean(normalizedPhone),
      formattedMessage,
      zaloUrl,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Payment reminder Zalo error:', error);
    res.status(500).json({ error: 'Failed to dispatch Zalo payment reminder.' });
  }
});

// 6. Cloud SQL (PostgreSQL) Persistence Endpoints (Firebase Auth protected)
const VALID_SQL_COLLECTIONS = new Set<AcademyCollectionName>([
  'users',
  'user_invites',
  'teachers',
  'students',
  'programs',
  'classes',
  'schedules',
  'assessments',
  'gemini_notes',
  'invoices',
  'payables',
  'enrollments',
  'payment_methods',
  'quick_notes',
]);

// Helper: enforce strict role & record ownership for SQL persistence endpoints
function authorizeSqlUpsert(
  caller: Awaited<ReturnType<typeof resolveCallerRole>>,
  col: AcademyCollectionName,
  id: string,
  data: Record<string, unknown>
): { allowed: boolean; sanitizedData: Record<string, unknown>; reason?: string } {
  if (caller.isAdmin) {
    // Only Super Admins can assign the super_admin role
    if (col === 'users' && data.role === 'super_admin' && !caller.isSuperAdmin) {
      return { allowed: false, sanitizedData: data, reason: 'Only Super Admins can assign super_admin role.' };
    }
    return { allowed: true, sanitizedData: data };
  }

  if (col === 'users') {
    if (id !== caller.uid) {
      return { allowed: false, sanitizedData: data, reason: 'Users may only update their own profile.' };
    }
    // Prevent self-escalation: force server-verified role & email
    const safeSelfRole =
      caller.role === 'teacher' || caller.role === 'student' || caller.role === 'parent'
        ? caller.role
        : 'parent';
    return {
      allowed: true,
      sanitizedData: {
        ...data,
        uid: caller.uid,
        email: caller.email,
        role: safeSelfRole,
      },
    };
  }

  if (caller.isTeacher) {
    if (col === 'quick_notes' || col === 'assessments') {
      return {
        allowed: true,
        sanitizedData: { ...data, teacherUid: caller.uid, teacherEmail: caller.email },
      };
    }
    if (col === 'schedules') {
      const schedEmail = String(data.teacherEmail || '').trim().toLowerCase();
      if (schedEmail && schedEmail !== caller.email) {
        return { allowed: false, sanitizedData: data, reason: 'Teachers may only update their own schedules.' };
      }
      return { allowed: true, sanitizedData: { ...data, teacherEmail: caller.email } };
    }
    if (col === 'teachers') {
      const tEmail = String(data.teacherEmail || '').trim().toLowerCase();
      if (tEmail !== caller.email) {
        return { allowed: false, sanitizedData: data, reason: 'Teachers may only update their own profile.' };
      }
      return { allowed: true, sanitizedData: data };
    }
    if (col === 'students') {
      return { allowed: true, sanitizedData: data };
    }
    return { allowed: false, sanitizedData: data, reason: 'Teachers are not authorized to modify this collection.' };
  }

  // Parent / Student self-owned records only
  if (col === 'payment_methods' || col === 'enrollments' || col === 'invoices') {
    const recParentEmail = String(data.parentEmail || '').trim().toLowerCase();
    const recParentUid = String(data.parentUid || '').trim();
    if (recParentEmail === caller.email || (recParentUid && recParentUid === caller.uid)) {
      return {
        allowed: true,
        sanitizedData: {
          ...data,
          parentEmail: caller.email,
          parentUid: caller.uid,
        },
      };
    }
    return { allowed: false, sanitizedData: data, reason: 'Parents may only update their own billing/enrollment records.' };
  }

  return { allowed: false, sanitizedData: data, reason: 'Admin privileges required to modify this collection.' };
}

app.post('/api/sql/upsert', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { collection: col, id, data } = req.body ?? {};
    if (!col || !VALID_SQL_COLLECTIONS.has(col) || !id || typeof data !== 'object' || data === null) {
      return res.status(400).json({ error: 'Valid collection, id, and data are required.' });
    }
    const caller = await resolveCallerRole(req);
    const check = authorizeSqlUpsert(caller, col, String(id), data as Record<string, unknown>);
    if (!check.allowed) {
      return res.status(403).json({ error: `Forbidden: ${check.reason || 'Insufficient privileges.'}` });
    }
    await upsertAcademyRecord(col, String(id), check.sanitizedData);
    res.json({ ok: true });
  } catch (error: unknown) {
    console.error('SQL upsert route error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to store record in SQL.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/sql/upsert-batch', requireAuth, async (req: AuthRequest, res) => {
  try {
    const caller = await resolveCallerRole(req);
    if (!caller.isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required for batch SQL sync.' });
    }
    const { items } = req.body ?? {};
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required.' });
    }
    let processed = 0;
    for (const item of items.slice(0, 150)) {
      if (!item || !VALID_SQL_COLLECTIONS.has(item.collection) || !item.id || typeof item.data !== 'object' || item.data === null) {
        continue;
      }
      const check = authorizeSqlUpsert(caller, item.collection, String(item.id), item.data as Record<string, unknown>);
      if (!check.allowed) continue;
      await upsertAcademyRecord(item.collection, String(item.id), check.sanitizedData);
      processed += 1;
    }
    res.json({ ok: true, count: processed });
  } catch (error: unknown) {
    console.error('SQL batch upsert route error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to sync records to SQL.';
    res.status(500).json({ error: msg });
  }
});

app.delete('/api/sql/record/:col/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const col = req.params.col as AcademyCollectionName;
    const id = req.params.id;
    if (!VALID_SQL_COLLECTIONS.has(col) || !id) {
      return res.status(400).json({ error: 'Invalid collection or record id.' });
    }
    const caller = await resolveCallerRole(req);
    if (col === 'users') {
      if (!caller.isSuperAdmin) {
        return res.status(403).json({ error: 'Forbidden: Only Super Admins may remove user records.' });
      }
    } else if (!caller.isAdmin) {
      const teacherDeletable = caller.isTeacher && (col === 'quick_notes' || col === 'assessments');
      if (!teacherDeletable) {
        return res.status(403).json({ error: 'Forbidden: Admin privileges required to delete records.' });
      }
    }
    await deleteAcademyRecord(col, id);
    res.json({ ok: true });
  } catch (error: unknown) {
    console.error('SQL delete route error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to remove record from SQL.';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/sql/overview', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.email) {
      return res.status(403).json({ error: 'Verified email required.' });
    }
    const caller = await resolveCallerRole(req);
    if (!caller.isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required.' });
    }
    const snapshot = await getSqlAcademySnapshotForAdmin();
    res.json(snapshot);
  } catch (error: unknown) {
    console.error('SQL overview route error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to load SQL overview.';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/sql/reset-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.email) {
      return res.status(403).json({ error: 'Verified email required.' });
    }
    const caller = await resolveCallerRole(req);
    if (!caller.isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required.' });
    }
    await resetAllAcademySqlRecords(req.user.uid, SERVER_SUPER_ADMIN_EMAILS);
    res.json({ ok: true });
  } catch (error: unknown) {
    console.error('SQL reset-all route error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to reset SQL storage.';
    res.status(500).json({ error: msg });
  }
});

const VITE_CLIENT_NO_WS_SHIM = `
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if ("document" in globalThis) {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
function injectQuery(url, queryToInject) {
  if (!url || (url[0] !== "." && url[0] !== "/")) return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (search ? "&" + search.slice(1) : "") + (hash || "");
}
class ErrorOverlay extends HTMLElement {}
export { ErrorOverlay, createHotContext, injectQuery, removeStyle, updateStyle };
`;

async function startServer() {
  const distPath = path.join(__dirname, 'dist');
  const indexFile = path.join(distPath, 'index.html');
  const hasBuiltDist = fs.existsSync(indexFile);
  const useViteDevMiddleware =
    process.env.NODE_ENV === 'development' ||
    (process.env.NODE_ENV !== 'production' && !hasBuiltDist);

  if (useViteDevMiddleware) {
    // When HMR is disabled in middlewareMode, Vite 8's built-in /@vite/client still attempts
    // a WebSocket connection that immediately closes. Serve a clean WebSocket-free shim with
    // full CSS/HMR exports so styles and modules work with zero WebSocket errors.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).send(VITE_CLIENT_NO_WS_SHIM);
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: false,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.get('/favicon.ico', (_req, res) => {
      const pngLogo = path.join(distPath, 'assets', 'lilab_logo.png');
      if (fs.existsSync(pngLogo)) {
        res.setHeader('Cache-Control', 'public, max-age=604800');
        return res.sendFile(pngLogo);
      }
      return res.status(204).end();
    });
    app.use(
      express.static(distPath, {
        index: false,
        maxAge: '7d',
        setHeaders: (res, filePath) => {
          if (/[\\/]assets[\\/].*-[a-zA-Z0-9_-]{6,}\.(js|mjs|css)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      if (fs.existsSync(indexFile)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `LiLab Creative Talent Academy server running on http://0.0.0.0:${PORT} (${useViteDevMiddleware ? 'dev-vite' : 'production-static'})`
    );
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}, shutting down LiLab server gracefully...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Fatal error starting LiLab Academy server:', err);
  process.exit(1);
});

// Server-only: Gemini narration with a two-tier cache (memory, then Cloud Storage).
// A phrase is synthesised once, ever; afterwards every instance serves the stored clip.
import { createHash } from 'crypto';
import type { GoogleGenAI } from '@google/genai';
import { adminBucket } from '../lib/firebase-admin.ts';

export const TTS_MODEL = process.env.LILAB_TTS_MODEL || 'gemini-3.8-flash-lite-tts';

export interface NarrationClip {
  audioBase64: string;
  mimeType: string;
  voiceName: string;
}

export function narrationKey(text: string, voiceName: string, style: string): string {
  return createHash('sha256').update(JSON.stringify([text, voiceName, style])).digest('hex');
}

const objectPath = (key: string) => `narration/${key}.json`;

export async function loadStoredNarration(key: string): Promise<NarrationClip | null> {
  try {
    const file = adminBucket().file(objectPath(key));
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return JSON.parse(buf.toString('utf-8')) as NarrationClip;
  } catch {
    return null; // storage not configured or unreachable: fall through to synthesis
  }
}

export async function storeNarration(key: string, clip: NarrationClip): Promise<void> {
  try {
    await adminBucket()
      .file(objectPath(key))
      .save(JSON.stringify(clip), {
        contentType: 'application/json',
        resumable: false,
        metadata: { cacheControl: 'private, max-age=31536000' },
      });
  } catch (err) {
    console.warn('Narration not stored (Cloud Storage unavailable):', err instanceof Error ? err.message : err);
  }
}

export async function synthesizeNarration(
  ai: GoogleGenAI,
  text: string,
  voiceName: string,
  style: string
): Promise<NarrationClip | null> {
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: [{ role: 'user', parts: [{ text, speechMetadata: { style } } as never] }],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });
  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) return null;
  return { audioBase64: part.inlineData.data, mimeType: part.inlineData.mimeType || 'audio/wav', voiceName };
}

/**
 * Pre-records Speaking Lab narration into Cloud Storage (LiLab V2.0).
 *
 * Every clip is stored under the same key the live /api/ai/tts endpoint uses, so once a
 * phrase is recorded, children hear it from storage and no Gemini call is made.
 * Clips that already exist are skipped, so the script is safe to re-run.
 *
 * Examples:
 *   npm run narration:generate -- --dry-run                 # count clips, no calls
 *   npm run narration:generate -- --level pre_a1 --limit 50 # small first batch
 *   npm run narration:generate -- --voices Kore,Puck --slow # both voices, plus slow mode
 *
 * Needs GEMINI_API_KEY and Google credentials that can write to the Storage bucket.
 */
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { loadStoredNarration, narrationKey, storeNarration, synthesizeNarration } from '../src/services/ttsNarration.ts';
import { speakingNarrationStyle, type NarrationMode } from '../src/data/speakingLab/narrationStyle.ts';
import type { SpeakingItem, SpeakingLevelDataset, SpeakingLevelId } from '../src/data/speakingLab/types.ts';
import { PRE_A1_DATASET } from '../src/data/speakingLab/preA1.ts';
import { A1_DATASET } from '../src/data/speakingLab/a1.ts';
import { A2_DATASET } from '../src/data/speakingLab/a2.ts';
import { B1_DATASET } from '../src/data/speakingLab/b1.ts';
import { B2_DATASET } from '../src/data/speakingLab/b2.ts';

const DATASETS: Record<SpeakingLevelId, SpeakingLevelDataset> = {
  pre_a1: PRE_A1_DATASET,
  a1: A1_DATASET,
  a2: A2_DATASET,
  b1: B1_DATASET,
  b2: B2_DATASET,
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const levels = (arg('level')?.split(',') as SpeakingLevelId[] | undefined) ?? (Object.keys(DATASETS) as SpeakingLevelId[]);
const voices = arg('voices')?.split(',') ?? ['Kore'];
const modes: NarrationMode[] = flag('slow') ? ['normal', 'slow'] : ['normal'];
const limit = Number(arg('limit') ?? Infinity);
const dryRun = flag('dry-run');
const CONCURRENCY = Number(arg('concurrency') ?? 3);

// Mirror the server's request normalisation so keys match exactly.
const normaliseText = (t: string) => t.trim().slice(0, 800);
const normaliseStyle = (s: string) => s.trim().slice(0, 180);

async function main() {
  const jobs: Array<{ item: SpeakingItem; voice: string; mode: NarrationMode }> = [];
  for (const level of levels) {
    const ds = DATASETS[level];
    if (!ds) throw new Error(`Unknown level "${level}"`);
    for (const item of [...ds.words, ...ds.phrases]) {
      for (const voice of voices) for (const mode of modes) jobs.push({ item, voice, mode });
    }
  }
  const planned = jobs.slice(0, limit);
  console.log(`${planned.length} clips planned (${levels.join(', ')}; voices ${voices.join(', ')}; ${modes.join(' + ')}).`);
  if (dryRun) return;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');
  const ai = new GoogleGenAI({ apiKey });

  let done = 0;
  let made = 0;
  let skipped = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < planned.length) {
      const { item, voice, mode } = planned[cursor++];
      const text = normaliseText(item.text);
      const style = normaliseStyle(speakingNarrationStyle(item, mode));
      const key = narrationKey(text, voice, style);
      try {
        if (await loadStoredNarration(key)) {
          skipped++;
        } else {
          const clip = await synthesizeNarration(ai, text, voice, style);
          if (clip) {
            await storeNarration(key, clip);
            made++;
          } else {
            failed++;
          }
        }
      } catch (err) {
        failed++;
        console.warn(`failed: "${text}" (${voice}, ${mode}):`, err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, 2000)); // back off on rate limits
      }
      done++;
      if (done % 50 === 0) console.log(`${done}/${planned.length}  recorded ${made}, already stored ${skipped}, failed ${failed}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`Finished: recorded ${made}, already stored ${skipped}, failed ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

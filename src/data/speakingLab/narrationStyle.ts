import type { CulturalRegion, SpeakingItem } from './types';

/**
 * Narration style prompts for the Speaking Lab. Shared by the browser and by
 * scripts/generate-speaking-narration.ts so a pre-recorded clip and a live request
 * produce the same cache key on the server (text + voice + style).
 */
export const REGION_NAMES_EN: Record<CulturalRegion, string> = {
  US: 'United States',
  UK: 'United Kingdom',
  AU: 'Australia',
  CA: 'Canada',
  IE: 'Ireland',
  NZ: 'New Zealand',
  SG: 'Singapore',
  ZA: 'South Africa',
  Global: 'Global English',
};

export type NarrationMode = 'normal' | 'slow';

export function speakingNarrationStyle(item: Pick<SpeakingItem, 'styleTag' | 'region'>, mode: NarrationMode): string {
  if (mode === 'slow') {
    return 'Clear, slow, deliberate English pronunciation teacher articulating every syllable and final consonant gently for young learners';
  }
  if (item.styleTag === 'cultural' && item.region) {
    return `Warm, friendly, natural English speaker with a clear, authentic ${REGION_NAMES_EN[item.region] || 'international'} cadence`;
  }
  return 'Warm, upbeat, crystal-clear native English teacher speaking naturally for kids and teens';
}

export const SPEAKING_LAB_VOICES = ['Kore', 'Puck'] as const;

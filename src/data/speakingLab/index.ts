import type { SpeakingLevelDataset, SpeakingLevelId } from './types';

export * from './types';

const levelCache = new Map<SpeakingLevelId, SpeakingLevelDataset>();

export async function loadSpeakingLevelData(
  level: SpeakingLevelId
): Promise<SpeakingLevelDataset> {
  const cached = levelCache.get(level);
  if (cached) return cached;

  let dataset: SpeakingLevelDataset;
  switch (level) {
    case 'pre_a1': {
      const mod = await import('./preA1');
      dataset = mod.PRE_A1_DATASET;
      break;
    }
    case 'a1': {
      const mod = await import('./a1');
      dataset = mod.A1_DATASET;
      break;
    }
    case 'a2': {
      const mod = await import('./a2');
      dataset = mod.A2_DATASET;
      break;
    }
    case 'b1': {
      const mod = await import('./b1');
      dataset = mod.B1_DATASET;
      break;
    }
    case 'b2': {
      const mod = await import('./b2');
      dataset = mod.B2_DATASET;
      break;
    }
  }

  levelCache.set(level, dataset);
  return dataset;
}

export function mapStudentCefrToSpeakingLevel(cefrLevel?: string | null): SpeakingLevelId {
  const normalized = (cefrLevel || '').toLowerCase();
  if (normalized.includes('b2') || normalized.includes('c1') || normalized.includes('c2')) {
    return 'b2';
  }
  if (normalized.includes('b1') || normalized.includes('preliminary')) {
    return 'b1';
  }
  if (normalized.includes('a2') || normalized.includes('flyers') || normalized.includes('key')) {
    return 'a2';
  }
  if (normalized.includes('pre-a1') || normalized.includes('pre_a1') || normalized.includes('starters')) {
    return 'pre_a1';
  }
  if (normalized.includes('a1') || normalized.includes('movers')) {
    return 'a1';
  }
  return 'a1';
}

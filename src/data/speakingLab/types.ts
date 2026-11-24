export type SpeakingLevelId = 'pre_a1' | 'a1' | 'a2' | 'b1' | 'b2';

export type SpeakingItemKind = 'word' | 'phrase';

export type SpeakingStyleTag =
  | 'core'
  | 'difficult'
  | 'single_syllable'
  | 'multisyllable'
  | 'idiom'
  | 'cultural'
  | 'slang';

export type CulturalRegion = 'US' | 'UK' | 'AU' | 'CA' | 'IE' | 'NZ' | 'SG' | 'ZA' | 'Global';

export interface SpeakingItem {
  id: string;
  text: string;
  kind: SpeakingItemKind;
  category: string;
  level: SpeakingLevelId;
  styleTag: SpeakingStyleTag;
  region?: CulturalRegion;
  tip?: string;
}

export interface RawCategoryBucket {
  category: string;
  styleTag?: SpeakingStyleTag;
  region?: CulturalRegion;
  items: string[];
}

export interface SpeakingLevelDataset {
  level: SpeakingLevelId;
  words: SpeakingItem[];
  phrases: SpeakingItem[];
  wordCategories: string[];
  phraseCategories: string[];
}

export interface SpeakingLevelMeta {
  id: SpeakingLevelId;
  code: string;
  nameEn: string;
  nameVi: string;
  subtitleEn: string;
  subtitleVi: string;
  ageRange: string;
  accentHex: string;
  softBgClass: string;
  borderClass: string;
  badgeTextClass: string;
  minWordsLabel: string;
  minPhrasesLabel: string;
}

export const SPEAKING_LEVELS: SpeakingLevelMeta[] = [
  {
    id: 'pre_a1',
    code: 'Pre-A1',
    nameEn: 'Pre-A1 Starters',
    nameVi: 'Pre-A1 Khởi Đầu',
    subtitleEn: 'First everyday words, tricky phonics, playful idioms & mini-sentences',
    subtitleVi: 'Từ vựng khởi đầu, luyện âm, thành ngữ vui & câu giao tiếp ngắn',
    ageRange: 'Ages 4–7',
    accentHex: '#FF6B00',
    softBgClass: 'bg-[#FFF5EE]',
    borderClass: 'border-[#FF6B00]/30',
    badgeTextClass: 'text-[#C2410C]',
    minWordsLabel: '1,000+ words',
    minPhrasesLabel: '300+ phrases',
  },
  {
    id: 'a1',
    code: 'A1',
    nameEn: 'A1 Movers',
    nameVi: 'A1 Vươn Mình',
    subtitleEn: 'School, daily routines, multisyllable practice, idioms & world greetings',
    subtitleVi: 'Trường lớp, sinh hoạt, từ đa âm tiết, thành ngữ & lời chào quốc tế',
    ageRange: 'Ages 7–9',
    accentHex: '#0D9488',
    softBgClass: 'bg-[#F0FDFA]',
    borderClass: 'border-[#0D9488]/30',
    badgeTextClass: 'text-[#0F766E]',
    minWordsLabel: '1,000+ words',
    minPhrasesLabel: '300+ phrases',
  },
  {
    id: 'a2',
    code: 'A2',
    nameEn: 'A2 Flyers & Key',
    nameVi: 'A2 Bay Cao',
    subtitleEn: 'Travel, stories, tough vocabulary, cultural phrases & everyday slang',
    subtitleVi: 'Du lịch, kể chuyện, từ nâng cao, văn hoá đa quốc gia & tiếng lóng tự nhiên',
    ageRange: 'Ages 9–11',
    accentHex: '#2563EB',
    softBgClass: 'bg-[#EFF6FF]',
    borderClass: 'border-[#2563EB]/30',
    badgeTextClass: 'text-[#1D4ED8]',
    minWordsLabel: '1,000+ words',
    minPhrasesLabel: '300+ phrases',
  },
  {
    id: 'b1',
    code: 'B1',
    nameEn: 'B1 Preliminary',
    nameVi: 'B1 Trung Cấp',
    subtitleEn: 'Opinions, science, complex multisyllables, idioms & global colloquialisms',
    subtitleVi: 'Quan điểm, khoa học, từ đa âm tiết khó, thành ngữ & khẩu ngữ toàn cầu',
    ageRange: 'Ages 11–13',
    accentHex: '#7C3AED',
    softBgClass: 'bg-[#F5F3FF]',
    borderClass: 'border-[#7C3AED]/30',
    badgeTextClass: 'text-[#6D28D9]',
    minWordsLabel: '1,000+ words',
    minPhrasesLabel: '300+ phrases',
  },
  {
    id: 'b2',
    code: 'B2',
    nameEn: 'B2 First',
    nameVi: 'B2 Tự Tin Hội Nhập',
    subtitleEn: 'Debate, academic lexicon, nuanced idioms, regional dialects & slang',
    subtitleVi: 'Tranh biện, từ vựng học thuật, thành ngữ sâu sắc & văn hoá bản xứ',
    ageRange: 'Ages 13–16',
    accentHex: '#E61E64',
    softBgClass: 'bg-[#FDF2F8]',
    borderClass: 'border-[#E61E64]/30',
    badgeTextClass: 'text-[#BE185D]',
    minWordsLabel: '1,000+ words',
    minPhrasesLabel: '300+ phrases',
  },
];

/**
 * Helper to split compact curated whitespace-separated word lists into clean string arrays.
 * Supports multi-word items encoded with underscores (e.g. "ice_cream" -> "ice cream").
 */
export function w(block: string): string[] {
  return block
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/_/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Helper to split newline-separated phrase lists. Supports optional region tags via `[UK] Phrase text`.
 */
export function p(block: string): string[] {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const REGION_PREFIX_RE = /^\[(US|UK|AU|CA|IE|NZ|SG|ZA|Global)\]\s*/;

export function buildLevelDataset(
  level: SpeakingLevelId,
  wordBuckets: RawCategoryBucket[],
  phraseBuckets: RawCategoryBucket[]
): SpeakingLevelDataset {
  const seenWords = new Set<string>();
  const words: SpeakingItem[] = [];
  const wordCategories: string[] = [];

  for (const bucket of wordBuckets) {
    let addedInCat = 0;
    const styleTag: SpeakingStyleTag = bucket.styleTag || 'core';
    for (const raw of bucket.items) {
      const regionMatch = raw.match(REGION_PREFIX_RE);
      const region = (regionMatch?.[1] as CulturalRegion | undefined) || bucket.region;
      const text = raw.replace(REGION_PREFIX_RE, '').trim();
      const key = text.toLowerCase();
      if (!text || seenWords.has(key)) continue;
      seenWords.add(key);
      words.push({
        id: `${level}_w_${words.length + 1}`,
        text,
        kind: 'word',
        category: bucket.category,
        level,
        styleTag,
        region,
      });
      addedInCat++;
    }
    if (addedInCat > 0) wordCategories.push(bucket.category);
  }

  const seenPhrases = new Set<string>();
  const phrases: SpeakingItem[] = [];
  const phraseCategories: string[] = [];

  for (const bucket of phraseBuckets) {
    let addedInCat = 0;
    const styleTag: SpeakingStyleTag = bucket.styleTag || 'core';
    for (const raw of bucket.items) {
      const regionMatch = raw.match(REGION_PREFIX_RE);
      const region = (regionMatch?.[1] as CulturalRegion | undefined) || bucket.region;
      const text = raw.replace(REGION_PREFIX_RE, '').trim();
      const key = text.toLowerCase();
      if (!text || seenPhrases.has(key)) continue;
      seenPhrases.add(key);
      phrases.push({
        id: `${level}_p_${phrases.length + 1}`,
        text,
        kind: 'phrase',
        category: bucket.category,
        level,
        styleTag,
        region,
      });
      addedInCat++;
    }
    if (addedInCat > 0) phraseCategories.push(bucket.category);
  }

  return { level, words, phrases, wordCategories, phraseCategories };
}

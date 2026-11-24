import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Camera,
  Check,
  Compass,
  Copy,
  Download,
  Film,
  FlipHorizontal2,
  Image as ImageIcon,
  Layers,
  Loader2,
  Pause,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Volume2,
  VolumeX,
  Wand2,
} from 'lucide-react';
import { biText } from '../i18n';
import {
  generateKidStoryMovie,
  synthesizeNaturalVoice,
  type NaturalVoiceName,
} from '../services/aiClient';
import type { LangCode, StudentProfile, UserProfile } from '../types';

import savannaBackdropImg from '../assets/images/story_savanna_lion_mouse_1795407181343.webp';
import lanternBayBackdropImg from '../assets/images/story_dragon_lantern_bay_1795407180822.webp';
import cosmosBackdropImg from '../assets/images/story_treehouse_cosmos_1795407180910.webp';
import coralReefBackdropImg from '../assets/images/story_coral_reef_adventure_1795407180376.webp';

type BackdropId = 'savanna' | 'lantern_bay' | 'cosmos' | 'coral_reef' | 'custom';
type EffectId = 'sunbeams' | 'fireflies' | 'stars' | 'bubbles' | 'hearts' | 'confetti';
type CameraMotionId = 'zoom-in' | 'pan-right' | 'pan-left' | 'gentle-float';
type ActorKind = 'lion' | 'mouse' | 'dragon' | 'lila_girl' | 'lila_boy' | 'turtle' | 'owl' | 'robot';
type ActorMotion = 'hop' | 'walk' | 'float' | 'wave' | 'spin';

interface StoryActor {
  id: string;
  kind: ActorKind;
  name: string;
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  scale: number; // 0.6..1.5
  flipX: boolean;
  motion: ActorMotion;
  speechEn: string;
  speechVi: string;
}

interface StoryScene {
  id: string;
  titleEn: string;
  titleVi: string;
  backdrop: BackdropId;
  customBackdropDataUrl?: string;
  effect: EffectId;
  camera: CameraMotionId;
  durationSec: number;
  captionEn: string;
  captionVi: string;
  vocabWordEn?: string;
  vocabWordVi?: string;
  actors: StoryActor[];
}

interface KidStoryProject {
  id: string;
  titleEn: string;
  titleVi: string;
  moralEn: string;
  moralVi: string;
  updatedAt: string;
  scenes: StoryScene[];
}

interface ExploreHotspot {
  id: string;
  x: number;
  y: number;
  wordEn: string;
  wordVi: string;
  phonics: string;
  storyFactEn: string;
  storyFactVi: string;
}

interface StoryWorldMeta {
  id: Exclude<BackdropId, 'custom'>;
  nameEn: string;
  nameVi: string;
  subtitleEn: string;
  subtitleVi: string;
  imageSrc: string;
  fallbackGradient: string;
  defaultEffect: EffectId;
  hotspots: ExploreHotspot[];
}

interface CapturedExportItem {
  id: string;
  kind: 'image' | 'video';
  title: string;
  url: string;
  createdAt: string;
}

interface KidsAnimationStudioProps {
  lang: LangCode;
  currentUser: UserProfile;
  student?: StudentProfile | null;
}

const CANVAS_W = 960;
const CANVAS_H = 540;

const STORY_WORLDS: StoryWorldMeta[] = [
  {
    id: 'savanna',
    nameEn: 'Golden Savanna · The Lion & The Mouse',
    nameVi: 'Thảo Nguyên Vàng · Sư Tử & Chuột Nhắt',
    subtitleEn: 'Be Whole Week 01 · Kindness & Courage',
    subtitleVi: 'Be Whole Tuần 01 · Lòng Tốt & Dũng Cảm',
    imageSrc: savannaBackdropImg,
    fallbackGradient: 'linear-gradient(135deg, #FDE68A 0%, #F59E0B 55%, #92400E 100%)',
    defaultEffect: 'sunbeams',
    hotspots: [
      {
        id: 'hs_acacia',
        x: 61,
        y: 38,
        wordEn: 'Acacia Tree',
        wordVi: 'Cây Keo Thảo Nguyên',
        phonics: '/əˈkeɪ.ʃə triː/',
        storyFactEn: 'Leo the Lion loves resting in the cool shade beneath the tall acacia tree.',
        storyFactVi: 'Sư tử Leo thích nghỉ ngơi dưới bóng mát của cây keo cao lớn.',
      },
      {
        id: 'hs_meadow',
        x: 42,
        y: 78,
        wordEn: 'Kindness',
        wordVi: 'Lòng Tốt Bụng',
        phonics: '/ˈkaɪnd.nəs/',
        storyFactEn: 'Even the smallest friend can show big kindness and help save the day!',
        storyFactVi: 'Ngay cả người bạn nhỏ bé nhất cũng có thể trao đi lòng tốt lớn lao!',
      },
      {
        id: 'hs_wildflowers',
        x: 78,
        y: 82,
        wordEn: 'Wildflowers',
        wordVi: 'Hoa Dại',
        phonics: '/ˈwaɪld.flaʊ.ərz/',
        storyFactEn: 'Milo the Mouse gathers bright yellow wildflowers to celebrate friendship.',
        storyFactVi: 'Chuột Milo hái những bông hoa dại vàng rực để mừng tình bạn đẹp.',
      },
    ],
  },
  {
    id: 'lantern_bay',
    nameEn: 'Emerald Lantern Bay · Heritage Legend',
    nameVi: 'Vịnh Đèn Lồng Ngọc Bích · Truyền Thuyết',
    subtitleEn: 'Vietnamese Folklore · Harmony & Family',
    subtitleVi: 'Cổ Tích Việt Nam · Hòa Hợp & Gia Đình',
    imageSrc: lanternBayBackdropImg,
    fallbackGradient: 'linear-gradient(135deg, #99F6E4 0%, #0D9488 55%, #1E3A8A 100%)',
    defaultEffect: 'fireflies',
    hotspots: [
      {
        id: 'hs_lanterns',
        x: 68,
        y: 75,
        wordEn: 'Paper Lantern',
        wordVi: 'Đèn Lồng Giấy',
        phonics: '/ˈpeɪ.pər ˈlæn.tərn/',
        storyFactEn: 'Warm paper lanterns carry wishes of peace and curiosity across the bay.',
        storyFactVi: 'Những chiếc đèn lồng giấy mang theo ước mơ bình an và khám phá trên vịnh.',
      },
      {
        id: 'hs_islands',
        x: 19,
        y: 44,
        wordEn: 'Limestone Island',
        wordVi: 'Đảo Đá Vôi',
        phonics: '/ˈlaɪm.stoʊn ˈaɪ.lənd/',
        storyFactEn: 'Legend says emerald dragons shaped these towering islands to protect the coast.',
        storyFactVi: 'Truyền thuyết kể rằng rồng ngọc đã tạo nên những hòn đảo để che chở bờ biển.',
      },
      {
        id: 'hs_boat',
        x: 77,
        y: 60,
        wordEn: 'Sailing Boat',
        wordVi: 'Thuyền Buồm',
        phonics: '/ˈseɪ.lɪŋ boʊt/',
        storyFactEn: 'Friends sail together from island to island sharing English stories.',
        storyFactVi: 'Các bạn nhỏ cùng chèo thuyền qua từng hòn đảo và kể chuyện bằng tiếng Anh.',
      },
    ],
  },
  {
    id: 'cosmos',
    nameEn: 'Cloud Treehouse · Starlight Observatory',
    nameVi: 'Nhà Cây Trên Mây · Đài Quan Sát Sao',
    subtitleEn: 'STEM & Imagination · Space Discovery',
    subtitleVi: 'STEM & Trí Tưởng Tượng · Khám Phá Vũ Trụ',
    imageSrc: cosmosBackdropImg,
    fallbackGradient: 'linear-gradient(135deg, #312E81 0%, #1E1B4B 60%, #4C1D95 100%)',
    defaultEffect: 'stars',
    hotspots: [
      {
        id: 'hs_treehouse',
        x: 50,
        y: 36,
        wordEn: 'Observatory',
        wordVi: 'Đài Quan Sát',
        phonics: '/əbˈzɜːr.və.tɔːr.i/',
        storyFactEn: 'Inside the glowing treehouse, young explorers map constellations and dream big.',
        storyFactVi: 'Bên trong ngôi nhà cây rực sáng, các nhà thám hiểm nhí vẽ bản đồ chòm sao.',
      },
      {
        id: 'hs_moon',
        x: 20,
        y: 25,
        wordEn: 'Crescent Moon',
        wordVi: 'Trăng Lưỡi Liềm',
        phonics: '/ˈkres.ənt muːn/',
        storyFactEn: 'The crescent moon smiles down like a golden lantern in the velvet sky.',
        storyFactVi: 'Vầng trăng lưỡi liềm tỏa sáng như chiếc đèn vàng giữa bầu trời đêm.',
      },
      {
        id: 'hs_planet',
        x: 80,
        y: 22,
        wordEn: 'Ringed Planet',
        wordVi: 'Hành Tinh Có Vành Đai',
        phonics: '/rɪŋd ˈplæn.ɪt/',
        storyFactEn: 'A friendly ringed planet spins gracefully around bright stardust rings.',
        storyFactVi: 'Hành tinh có vành đai xoay nhẹ nhàng giữa những vòng bụi sao lấp lánh.',
      },
    ],
  },
  {
    id: 'coral_reef',
    nameEn: 'Sunlit Coral Reef · Ocean Rescue',
    nameVi: 'Rạn San Hô Nắng Sáng · Giải Cứu Đại Dương',
    subtitleEn: 'Nature Care · Teamwork & Ecology',
    subtitleVi: 'Bảo Vệ Thiên Nhiên · Làm Việc Nhóm',
    imageSrc: coralReefBackdropImg,
    fallbackGradient: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 55%, #0F766E 100%)',
    defaultEffect: 'bubbles',
    hotspots: [
      {
        id: 'hs_coral',
        x: 24,
        y: 38,
        wordEn: 'Coral Arch',
        wordVi: 'Vòm San Hô',
        phonics: '/ˈkɔːr.əl ɑːrtʃ/',
        storyFactEn: 'Colorful coral arches give tiny reef fish a safe home to play and hide.',
        storyFactVi: 'Vòm san hô rực rỡ là ngôi nhà an toàn cho các chú cá nhỏ vui chơi.',
      },
      {
        id: 'hs_sunbeam',
        x: 50,
        y: 22,
        wordEn: 'Sunbeams',
        wordVi: 'Tia Nắng Xuyên Nước',
        phonics: '/ˈsʌn.biːmz/',
        storyFactEn: 'Golden sunbeams dance down through the clear turquoise ocean waves.',
        storyFactVi: 'Những tia nắng vàng nhảy múa xuyên qua làn nước biển xanh ngọc.',
      },
      {
        id: 'hs_seagrass',
        x: 28,
        y: 84,
        wordEn: 'Sea Grass',
        wordVi: 'Cỏ Biển',
        phonics: '/siː ɡræs/',
        storyFactEn: 'Sea turtles love munching fresh green sea grass along the sandy floor.',
        storyFactVi: 'Rùa biển rất thích ăn những ngọn cỏ biển xanh tươi dưới đáy cát.',
      },
    ],
  },
];

const ACTOR_CATALOG: Array<{
  kind: ActorKind;
  labelEn: string;
  labelVi: string;
  accent: string;
  defaultSpeechEn: string;
  defaultSpeechVi: string;
}> = [
  {
    kind: 'lion',
    labelEn: 'Leo Lion',
    labelVi: 'Sư Tử Leo',
    accent: '#F59E0B',
    defaultSpeechEn: 'Thank you, little friend!',
    defaultSpeechVi: 'Cảm ơn bạn nhỏ nhé!',
  },
  {
    kind: 'mouse',
    labelEn: 'Milo Mouse',
    labelVi: 'Chuột Milo',
    accent: '#94A3B8',
    defaultSpeechEn: 'Small paws can help big!',
    defaultSpeechVi: 'Bàn tay nhỏ giúp việc lớn!',
  },
  {
    kind: 'dragon',
    labelEn: 'Jade Dragon',
    labelVi: 'Rồng Ngọc',
    accent: '#10B981',
    defaultSpeechEn: 'Let us fly over the bay!',
    defaultSpeechVi: 'Cùng bay qua vịnh nào!',
  },
  {
    kind: 'lila_girl',
    labelEn: 'Lila Girl',
    labelVi: 'Bé Lila',
    accent: '#EC4899',
    defaultSpeechEn: 'What an amazing adventure!',
    defaultSpeechVi: 'Chuyến phiêu lưu thật tuyệt!',
  },
  {
    kind: 'lila_boy',
    labelEn: 'Lila Explorer',
    labelVi: 'Nhà Thám Hiểm',
    accent: '#2563EB',
    defaultSpeechEn: 'Let us explore together!',
    defaultSpeechVi: 'Cùng khám phá nào!',
  },
  {
    kind: 'turtle',
    labelEn: 'Sunny Turtle',
    labelVi: 'Rùa Biển Sunny',
    accent: '#0D9488',
    defaultSpeechEn: 'Keep our ocean clean!',
    defaultSpeechVi: 'Hãy giữ biển thật sạch!',
  },
  {
    kind: 'owl',
    labelEn: 'Professor Owl',
    labelVi: 'Cú Thông Thái',
    accent: '#8B5CF6',
    defaultSpeechEn: 'New word unlocked!',
    defaultSpeechVi: 'Mở khóa từ vựng mới!',
  },
  {
    kind: 'robot',
    labelEn: 'Spark Robot',
    labelVi: 'Robot Spark',
    accent: '#FF6B00',
    defaultSpeechEn: 'Ready for liftoff!',
    defaultSpeechVi: 'Sẵn sàng cất cánh!',
  },
];

const STARTER_STORIES: Record<Exclude<BackdropId, 'custom'>, KidStoryProject> = {
  savanna: {
    id: 'starter_savanna',
    titleEn: 'The Lion and The Mouse',
    titleVi: 'Sư Tử và Chuột Nhắt',
    moralEn: 'No act of kindness, no matter how small, is ever wasted.',
    moralVi: 'Không một hành động tử tế nào là quá nhỏ bé.',
    updatedAt: new Date().toISOString(),
    scenes: [
      {
        id: 'sc_sav_1',
        titleEn: 'Sunny Nap Under the Acacia',
        titleVi: 'Giấc Ngủ Trưa Dưới Cây Keo',
        backdrop: 'savanna',
        effect: 'sunbeams',
        camera: 'zoom-in',
        durationSec: 5,
        captionEn: 'One golden morning, Leo the Lion slept peacefully while tiny Milo Mouse tip-toed nearby.',
        captionVi: 'Một buổi sáng nắng vàng, Sư tử Leo đang ngủ ngon lành thì Chuột Milo rón rén đi ngang qua.',
        vocabWordEn: 'Peacefully',
        vocabWordVi: 'Bình yên',
        actors: [
          {
            id: 'a1',
            kind: 'lion',
            name: 'Leo',
            x: 0.34,
            y: 0.68,
            scale: 1.15,
            flipX: false,
            motion: 'wave',
            speechEn: 'Zzz... What a warm day!',
            speechVi: 'Khò khò... Ngày thật ấm áp!',
          },
          {
            id: 'a2',
            kind: 'mouse',
            name: 'Milo',
            x: 0.72,
            y: 0.74,
            scale: 0.85,
            flipX: true,
            motion: 'hop',
            speechEn: 'Oops! Please forgive me!',
            speechVi: 'Ôi! Xin hãy tha cho tớ!',
          },
        ],
      },
      {
        id: 'sc_sav_2',
        titleEn: 'A Kind Promise',
        titleVi: 'Lời Hứa Tử Tế',
        backdrop: 'savanna',
        effect: 'hearts',
        camera: 'gentle-float',
        durationSec: 5,
        captionEn: 'Leo smiled gently and let Milo go free. Milo promised to help Leo one day.',
        captionVi: 'Leo mỉm cười hiền hậu thả Milo đi. Milo hứa một ngày nào đó sẽ giúp lại Leo.',
        vocabWordEn: 'Promise',
        vocabWordVi: 'Lời hứa',
        actors: [
          {
            id: 'a3',
            kind: 'lion',
            name: 'Leo',
            x: 0.36,
            y: 0.68,
            scale: 1.15,
            flipX: false,
            motion: 'hop',
            speechEn: 'Go safely, little friend!',
            speechVi: 'Đi bình an nhé bạn nhỏ!',
          },
          {
            id: 'a4',
            kind: 'mouse',
            name: 'Milo',
            x: 0.68,
            y: 0.72,
            scale: 0.85,
            flipX: true,
            motion: 'wave',
            speechEn: 'I will help you someday!',
            speechVi: 'Tớ sẽ giúp cậu một ngày nào đó!',
          },
        ],
      },
      {
        id: 'sc_sav_3',
        titleEn: 'Brave Rescue!',
        titleVi: 'Cuộc Giải Cứu Dũng Cảm!',
        backdrop: 'savanna',
        effect: 'fireflies',
        camera: 'pan-right',
        durationSec: 5,
        captionEn: 'When Leo got tangled in a rope net, Milo rushed over and nibbled the knots apart!',
        captionVi: 'Khi Leo bị mắc kẹt trong lưới dây, Milo vội chạy tới và cắn đứt từng nút dây!',
        vocabWordEn: 'Brave',
        vocabWordVi: 'Dũng cảm',
        actors: [
          {
            id: 'a5',
            kind: 'lion',
            name: 'Leo',
            x: 0.32,
            y: 0.68,
            scale: 1.1,
            flipX: false,
            motion: 'wave',
            speechEn: 'Milo! You came to save me!',
            speechVi: 'Milo! Cậu đã đến cứu tớ!',
          },
          {
            id: 'a6',
            kind: 'mouse',
            name: 'Milo',
            x: 0.56,
            y: 0.72,
            scale: 0.9,
            flipX: true,
            motion: 'walk',
            speechEn: 'Hold on, I am cutting the rope!',
            speechVi: 'Đợi chút, tớ đang cắn dây đây!',
          },
        ],
      },
      {
        id: 'sc_sav_4',
        titleEn: 'Best Friends Forever',
        titleVi: 'Đôi Bạn Thân Mãi Mãi',
        backdrop: 'savanna',
        effect: 'confetti',
        camera: 'zoom-in',
        durationSec: 5,
        captionEn: 'Leo and Milo danced among the wildflowers. Kindness makes every friend mighty!',
        captionVi: 'Leo và Milo vui múa giữa đồng hoa dại. Lòng tốt làm cho mọi tình bạn thêm mạnh mẽ!',
        vocabWordEn: 'Friendship',
        vocabWordVi: 'Tình bạn',
        actors: [
          {
            id: 'a7',
            kind: 'lion',
            name: 'Leo',
            x: 0.36,
            y: 0.68,
            scale: 1.12,
            flipX: false,
            motion: 'hop',
            speechEn: 'Thank you, mighty Milo!',
            speechVi: 'Cảm ơn Milo dũng cảm!',
          },
          {
            id: 'a8',
            kind: 'mouse',
            name: 'Milo',
            x: 0.64,
            y: 0.7,
            scale: 0.92,
            flipX: true,
            motion: 'spin',
            speechEn: 'Hooray for kindness!',
            speechVi: 'Hoan hô lòng tốt bụng!',
          },
        ],
      },
    ],
  },
  lantern_bay: {
    id: 'starter_lantern_bay',
    titleEn: 'Lanterns Over Emerald Bay',
    titleVi: 'Đèn Lồng Trên Vịnh Ngọc Bích',
    moralEn: 'Sharing light with others makes our world brighter.',
    moralVi: 'Chia sẻ ánh sáng giúp thế giới của chúng ta rực rỡ hơn.',
    updatedAt: new Date().toISOString(),
    scenes: [
      {
        id: 'sc_lb_1',
        titleEn: 'Sunset on the Terrace',
        titleVi: 'Hoàng Hôn Trên Sân Gỗ',
        backdrop: 'lantern_bay',
        effect: 'fireflies',
        camera: 'pan-right',
        durationSec: 5,
        captionEn: 'Lila lit a warm paper lantern by the bay as Jade Dragon soared across the emerald hills.',
        captionVi: 'Bé Lila thắp chiếc đèn lồng ấm áp bên vịnh khi Rồng Ngọc bay qua những ngọn đồi xanh.',
        vocabWordEn: 'Lantern',
        vocabWordVi: 'Đèn lồng',
        actors: [
          {
            id: 'lb1',
            kind: 'lila_girl',
            name: 'Lila',
            x: 0.28,
            y: 0.72,
            scale: 1.0,
            flipX: false,
            motion: 'wave',
            speechEn: 'Look at the glowing bay!',
            speechVi: 'Nhìn vịnh biển phát sáng kìa!',
          },
          {
            id: 'lb2',
            kind: 'dragon',
            name: 'Jade',
            x: 0.72,
            y: 0.42,
            scale: 1.05,
            flipX: true,
            motion: 'float',
            speechEn: 'Hello from the sky!',
            speechVi: 'Xin chào từ bầu trời nhé!',
          },
        ],
      },
      {
        id: 'sc_lb_2',
        titleEn: 'Floating Wishes',
        titleVi: 'Những Điều Ước Trôi Trên Sóng',
        backdrop: 'lantern_bay',
        effect: 'hearts',
        camera: 'zoom-in',
        durationSec: 5,
        captionEn: 'Together they wrote English wishes of gratitude and floated them gently over the waves.',
        captionVi: 'Cùng nhau họ viết những lời cảm ơn bằng tiếng Anh và thả nhẹ trên mặt sóng.',
        vocabWordEn: 'Gratitude',
        vocabWordVi: 'Lòng biết ơn',
        actors: [
          {
            id: 'lb3',
            kind: 'lila_girl',
            name: 'Lila',
            x: 0.34,
            y: 0.72,
            scale: 1.0,
            flipX: false,
            motion: 'hop',
            speechEn: 'I am grateful for my family!',
            speechVi: 'Con biết ơn gia đình mình!',
          },
          {
            id: 'lb4',
            kind: 'lila_boy',
            name: 'Minh',
            x: 0.64,
            y: 0.72,
            scale: 1.0,
            flipX: true,
            motion: 'wave',
            speechEn: 'Our lanterns shine so bright!',
            speechVi: 'Đèn lồng của tụi mình sáng quá!',
          },
        ],
      },
    ],
  },
  cosmos: {
    id: 'starter_cosmos',
    titleEn: 'Mission From Cloud Treehouse',
    titleVi: 'Nhiệm Vụ Từ Nhà Cây Trên Mây',
    moralEn: 'Curiosity turns every question into an adventure.',
    moralVi: 'Sự tò mò biến mọi câu hỏi thành một cuộc phiêu lưu.',
    updatedAt: new Date().toISOString(),
    scenes: [
      {
        id: 'sc_cos_1',
        titleEn: 'Stargazing With Spark Robot',
        titleVi: 'Ngắm Sao Cùng Robot Spark',
        backdrop: 'cosmos',
        effect: 'stars',
        camera: 'gentle-float',
        durationSec: 5,
        captionEn: 'High above the clouds, Spark Robot and Professor Owl spotted a smiling ringed planet!',
        captionVi: 'Trên cao giữa tầng mây, Robot Spark và Cú Thông Thái nhìn thấy hành tinh có vành đai!',
        vocabWordEn: 'Constellation',
        vocabWordVi: 'Chòm sao',
        actors: [
          {
            id: 'c1',
            kind: 'robot',
            name: 'Spark',
            x: 0.32,
            y: 0.7,
            scale: 1.05,
            flipX: false,
            motion: 'float',
            speechEn: 'Beep boop! Look at Saturn!',
            speechVi: 'Bíp bíp! Nhìn Sao Thổ kìa!',
          },
          {
            id: 'c2',
            kind: 'owl',
            name: 'Professor Owl',
            x: 0.68,
            y: 0.56,
            scale: 1.0,
            flipX: true,
            motion: 'wave',
            speechEn: 'Hoo-hoo! Let us count the stars!',
            speechVi: 'Hú hú! Cùng đếm sao nào!',
          },
        ],
      },
      {
        id: 'sc_cos_2',
        titleEn: 'Moonlight Celebration',
        titleVi: 'Lễ Hội Dưới Ánh Trăng',
        backdrop: 'cosmos',
        effect: 'confetti',
        camera: 'zoom-in',
        durationSec: 5,
        captionEn: 'Lila joined the cosmic team to name every star in English and Vietnamese!',
        captionVi: 'Bé Lila cùng đội vũ trụ gọi tên từng ngôi sao bằng cả tiếng Anh và tiếng Việt!',
        vocabWordEn: 'Universe',
        vocabWordVi: 'Vũ trụ',
        actors: [
          {
            id: 'c3',
            kind: 'lila_boy',
            name: 'Explorer',
            x: 0.36,
            y: 0.7,
            scale: 1.05,
            flipX: false,
            motion: 'hop',
            speechEn: 'Reach for the stars!',
            speechVi: 'Vươn tới những vì sao!',
          },
          {
            id: 'c4',
            kind: 'robot',
            name: 'Spark',
            x: 0.66,
            y: 0.66,
            scale: 1.0,
            flipX: true,
            motion: 'spin',
            speechEn: 'Mission accomplished!',
            speechVi: 'Hoàn thành nhiệm vụ!',
          },
        ],
      },
    ],
  },
  coral_reef: {
    id: 'starter_coral_reef',
    titleEn: 'Sunny Turtle’s Coral Rescue',
    titleVi: 'Rùa Sunny Giải Cứu Rạn San Hô',
    moralEn: 'When we work together, we protect our beautiful Earth.',
    moralVi: 'Khi chung tay cùng nhau, chúng ta bảo vệ Trái Đất xinh đẹp.',
    updatedAt: new Date().toISOString(),
    scenes: [
      {
        id: 'sc_cr_1',
        titleEn: 'Welcome to Coral Garden',
        titleVi: 'Chào Mừng Đến Vườn San Hô',
        backdrop: 'coral_reef',
        effect: 'bubbles',
        camera: 'pan-left',
        durationSec: 5,
        captionEn: 'Sunny the Sea Turtle swam gracefully beneath the shimmering turquoise sunbeams.',
        captionVi: 'Rùa Biển Sunny bơi uyển chuyển dưới những tia nắng xanh ngọc lấp lánh.',
        vocabWordEn: 'Coral Reef',
        vocabWordVi: 'Rạn san hô',
        actors: [
          {
            id: 'cr1',
            kind: 'turtle',
            name: 'Sunny',
            x: 0.36,
            y: 0.64,
            scale: 1.1,
            flipX: false,
            motion: 'float',
            speechEn: 'Welcome to my coral home!',
            speechVi: 'Chào mừng đến nhà san hô!',
          },
          {
            id: 'cr2',
            kind: 'lila_girl',
            name: 'Lila',
            x: 0.68,
            y: 0.68,
            scale: 0.96,
            flipX: true,
            motion: 'wave',
            speechEn: 'The ocean is full of colors!',
            speechVi: 'Đại dương tràn ngập sắc màu!',
          },
        ],
      },
      {
        id: 'sc_cr_2',
        titleEn: 'Sparkling Clean Ocean',
        titleVi: 'Đại Dương Sạch Lấp Lánh',
        backdrop: 'coral_reef',
        effect: 'hearts',
        camera: 'zoom-in',
        durationSec: 5,
        captionEn: 'Together they planted fresh sea grass and cheered for a clean, happy ocean!',
        captionVi: 'Cả hai cùng trồng cỏ biển xanh tươi và reo vang vì đại dương sạch đẹp!',
        vocabWordEn: 'Protect',
        vocabWordVi: 'Bảo vệ',
        actors: [
          {
            id: 'cr3',
            kind: 'turtle',
            name: 'Sunny',
            x: 0.4,
            y: 0.64,
            scale: 1.1,
            flipX: false,
            motion: 'hop',
            speechEn: 'Thank you for caring!',
            speechVi: 'Cảm ơn vì đã yêu thiên nhiên!',
          },
          {
            id: 'cr4',
            kind: 'lila_boy',
            name: 'Minh',
            x: 0.66,
            y: 0.68,
            scale: 0.96,
            flipX: true,
            motion: 'hop',
            speechEn: 'Teamwork saves the sea!',
            speechVi: 'Đoàn kết bảo vệ biển xanh!',
          },
        ],
      },
    ],
  },
};

function playChimeTone(freq = 523.25, duration = 0.22) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.25, ctx.currentTime + duration * 0.6);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => void ctx.close().catch(() => {}), duration * 1000 + 80);
  } catch {
    // Non-blocking audio fallback
  }
}

const NATURAL_VOICE_PERSONAS: Array<{
  id: NaturalVoiceName;
  labelEn: string;
  labelVi: string;
  descEn: string;
  descVi: string;
  styleEn: string;
  styleVi: string;
}> = [
  {
    id: 'Kore',
    labelEn: 'Warm Storyteller',
    labelVi: 'Cô Kể Chuyện Ấm Áp',
    descEn: 'Friendly & expressive',
    descVi: 'Ấm áp & giàu cảm xúc',
    styleEn: "Warm, loving, expressive children's storybook narrator with clear natural human pacing",
    styleVi: 'Giọng kể chuyện thiếu nhi tiếng Việt ấm áp, tự nhiên, truyền cảm và dịu dàng',
  },
  {
    id: 'Puck',
    labelEn: 'Playful Friend',
    labelVi: 'Người Bạn Vui Nhộn',
    descEn: 'Bright & upbeat',
    descVi: 'Tươi vui & năng động',
    styleEn: 'Cheerful, lively, playful young-at-heart storyteller with bright human smiles in the voice',
    styleVi: 'Giọng kể chuyện vui tươi, năng động, thân thiện như người bạn đồng hành cùng bé',
  },
  {
    id: 'Zephyr',
    labelEn: 'Gentle Breeze',
    labelVi: 'Giọng Dịu Êm',
    descEn: 'Calm & cozy',
    descVi: 'Nhẹ nhàng & êm ái',
    styleEn: 'Soft, calm, cozy bedtime-story narrator with soothing natural human cadence',
    styleVi: 'Giọng kể chuyện êm ái, nhẹ nhàng, trong trẻo và thư thái cho trẻ em',
  },
  {
    id: 'Charon',
    labelEn: 'Adventure Guide',
    labelVi: 'Nhà Thám Hiểm',
    descEn: 'Rich & heroic',
    descVi: 'Trầm ấm & hào hùng',
    styleEn: 'Rich, confident, warm adventure-tale storyteller bringing magical worlds to life',
    styleVi: 'Giọng kể chuyện phiêu lưu trầm ấm, rõ ràng và đầy hứng khởi',
  },
];

// Client-side audio cache so replaying scenes or vocabulary is instantaneous
const ttsDataUriCache = new Map<string, string>();
let activeHtmlAudio: HTMLAudioElement | null = null;
let activeNarrationTicket = 0;

function stopAllNarration() {
  activeNarrationTicket++;
  if (activeHtmlAudio) {
    try {
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
    } catch {
      // ignore
    }
    activeHtmlAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

function pickBestNaturalBrowserVoice(voiceLang: 'en' | 'vi'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefix = voiceLang === 'vi' ? 'vi' : 'en';
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!candidates.length) return null;

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    let score = 0;
    if (name.includes('natural') || name.includes('neural') || name.includes('online')) score += 60;
    if (name.includes('enhanced') || name.includes('premium') || name.includes('studio')) score += 45;
    if (name.includes('google')) score += 35;
    if (name.includes('samantha') || name.includes('karen') || name.includes('aria') || name.includes('jenny') || name.includes('ava') || name.includes('hoaimy') || name.includes('linh')) score += 30;
    if (v.localService === false) score += 10;
    if (name.includes('compact') || name.includes('espeak') || name.includes('robot')) score -= 40;
    return score;
  };

  return [...candidates].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
}

function speakBrowserNaturalFallback(text: string, voiceLang: 'en' | 'vi', onDone?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
    onDone?.();
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = voiceLang === 'vi' ? 'vi-VN' : 'en-US';
    const bestVoice = pickBestNaturalBrowserVoice(voiceLang);
    if (bestVoice) utter.voice = bestVoice;
    utter.rate = 0.96;
    utter.pitch = 1.0;
    utter.onend = () => onDone?.();
    utter.onerror = () => onDone?.();
    window.speechSynthesis.speak(utter);
  } catch {
    onDone?.();
  }
}

async function fetchNaturalTtsUri(
  text: string,
  voiceLang: 'en' | 'vi',
  voiceName: NaturalVoiceName
): Promise<string | null> {
  const clean = text.trim().slice(0, 600);
  if (!clean) return null;
  const cacheKey = `${voiceName}|${voiceLang}|${clean}`;
  const cached = ttsDataUriCache.get(cacheKey);
  if (cached) return cached;

  const persona = NATURAL_VOICE_PERSONAS.find((p) => p.id === voiceName) || NATURAL_VOICE_PERSONAS[0];
  const res = await synthesizeNaturalVoice({
    text: clean,
    lang: voiceLang,
    voiceName,
    style: voiceLang === 'vi' ? persona.styleVi : persona.styleEn,
  });
  const uri = `data:${res.mimeType || 'audio/wav'};base64,${res.audioBase64}`;
  if (ttsDataUriCache.size > 40) {
    const firstKey = ttsDataUriCache.keys().next().value;
    if (firstKey) ttsDataUriCache.delete(firstKey);
  }
  ttsDataUriCache.set(cacheKey, uri);
  return uri;
}

async function speakTextBilingual(
  text: string,
  voiceLang: 'en' | 'vi',
  voiceName: NaturalVoiceName = 'Kore',
  onStateChange?: (state: 'loading' | 'playing' | 'idle') => void
) {
  const clean = text.trim();
  if (!clean) return;
  stopAllNarration();
  const ticket = activeNarrationTicket;
  onStateChange?.('loading');

  try {
    const uri = await fetchNaturalTtsUri(clean, voiceLang, voiceName);
    if (ticket !== activeNarrationTicket) return;
    if (uri) {
      const audio = new Audio(uri);
      activeHtmlAudio = audio;
      audio.onplay = () => {
        if (ticket === activeNarrationTicket) onStateChange?.('playing');
      };
      audio.onended = () => {
        if (ticket === activeNarrationTicket) {
          activeHtmlAudio = null;
          onStateChange?.('idle');
        }
      };
      audio.onerror = () => {
        if (ticket === activeNarrationTicket) {
          activeHtmlAudio = null;
          speakBrowserNaturalFallback(clean, voiceLang, () => onStateChange?.('idle'));
        }
      };
      await audio.play();
      return;
    }
  } catch {
    if (ticket !== activeNarrationTicket) return;
  }

  onStateChange?.('playing');
  speakBrowserNaturalFallback(clean, voiceLang, () => {
    if (ticket === activeNarrationTicket) onStateChange?.('idle');
  });
}

interface CustomStoryPageDraft {
  id: string;
  stageLabelEn: string;
  stageLabelVi: string;
  backdrop: BackdropId;
  customBackdropDataUrl?: string;
  effect: EffectId;
  camera: CameraMotionId;
  narration: string;
  speechLine: string;
  vocabWord: string;
}

interface CustomStoryCastDraft {
  kind: ActorKind;
  customName: string;
  motion: ActorMotion;
}

function createStarterCustomPages(): CustomStoryPageDraft[] {
  return [
    {
      id: 'cp_1',
      stageLabelEn: 'Page 1 · Once Upon a Time',
      stageLabelVi: 'Trang 1 · Ngày Xửa Ngày Xưa',
      backdrop: 'savanna',
      effect: 'sunbeams',
      camera: 'zoom-in',
      narration: '',
      speechLine: '',
      vocabWord: 'Adventure',
    },
    {
      id: 'cp_2',
      stageLabelEn: 'Page 2 · The Big Discovery',
      stageLabelVi: 'Trang 2 · Khám Phá Bất Ngờ',
      backdrop: 'lantern_bay',
      effect: 'fireflies',
      camera: 'pan-right',
      narration: '',
      speechLine: '',
      vocabWord: 'Curious',
    },
    {
      id: 'cp_3',
      stageLabelEn: 'Page 3 · Helping Together',
      stageLabelVi: 'Trang 3 · Chung Tay Giúp Đỡ',
      backdrop: 'cosmos',
      effect: 'stars',
      camera: 'gentle-float',
      narration: '',
      speechLine: '',
      vocabWord: 'Kindness',
    },
    {
      id: 'cp_4',
      stageLabelEn: 'Page 4 · Happy Ending',
      stageLabelVi: 'Trang 4 · Kết Thúc Hạnh Phúc',
      backdrop: 'coral_reef',
      effect: 'confetti',
      camera: 'zoom-in',
      narration: '',
      speechLine: '',
      vocabWord: 'Celebrate',
    },
  ];
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawStoryActorOnCanvas(
  ctx: CanvasRenderingContext2D,
  actor: StoryActor,
  tSec: number,
  isSelected: boolean,
  captionLang: 'en' | 'vi'
) {
  let dx = 0;
  let dy = 0;
  let rot = 0;
  let squashX = 1;
  let squashY = 1;

  if (actor.motion === 'hop') {
    const phase = Math.abs(Math.sin(tSec * 4.2));
    dy = -phase * 26;
    squashX = 1 + (1 - phase) * 0.06;
    squashY = 1 - (1 - phase) * 0.05;
  } else if (actor.motion === 'walk') {
    dx = Math.sin(tSec * 2.2) * 34;
    dy = -Math.abs(Math.sin(tSec * 5.2)) * 10;
    rot = Math.sin(tSec * 5.2) * 0.07;
  } else if (actor.motion === 'float') {
    dy = Math.sin(tSec * 2.4) * 16;
    rot = Math.sin(tSec * 1.8) * 0.05;
  } else if (actor.motion === 'wave') {
    rot = Math.sin(tSec * 3.8) * 0.09;
    dy = -Math.abs(Math.sin(tSec * 2.0)) * 5;
  } else if (actor.motion === 'spin') {
    rot = Math.sin(tSec * 2.6) * 0.45;
    dy = -Math.abs(Math.sin(tSec * 3.2)) * 18;
  }

  const cx = actor.x * CANVAS_W + dx;
  const cy = actor.y * CANVAS_H + dy;
  const s = actor.scale;

  // Ground shadow
  ctx.save();
  ctx.fillStyle = 'rgba(23, 33, 84, 0.24)';
  ctx.beginPath();
  ctx.ellipse(actor.x * CANVAS_W + dx, actor.y * CANVAS_H + 54 * s, 42 * s, 11 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Selection ring in Studio Editor
  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = '#FFD41D';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, 66 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const blink = Math.sin(tSec * 1.9 + actor.x * 9) > 0.96;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale((actor.flipX ? -1 : 1) * s * squashX, s * squashY);

  const drawEyes = (ey = -10, spread = 13) => {
    ctx.fillStyle = '#172154';
    if (blink) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#172154';
      ctx.beginPath();
      ctx.moveTo(-spread - 5, ey);
      ctx.lineTo(-spread + 5, ey);
      ctx.moveTo(spread - 5, ey);
      ctx.lineTo(spread + 5, ey);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-spread, ey, 4.6, 0, Math.PI * 2);
      ctx.arc(spread, ey, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-spread + 1.5, ey - 1.5, 1.8, 0, Math.PI * 2);
      ctx.arc(spread + 1.5, ey - 1.5, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (actor.kind === 'lion') {
    // Mane petals
    ctx.fillStyle = '#D97706';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 34, -8 + Math.sin(a) * 34, 15, 0, Math.PI * 2);
      ctx.fill();
    }
    // Body
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.ellipse(0, 32, 28, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(0, -8, 30, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(-22, -32, 9, 0, Math.PI * 2);
    ctx.arc(22, -32, 9, 0, Math.PI * 2);
    ctx.fill();
    // Muzzle & Smile
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(0, 4, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#92400E';
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(6, -2);
    ctx.lineTo(0, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 4, 7, 0.2, Math.PI - 0.2);
    ctx.stroke();
    drawEyes(-12, 11);
  } else if (actor.kind === 'mouse') {
    // Big round ears
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.arc(-22, -26, 17, 0, Math.PI * 2);
    ctx.arc(22, -26, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FBCFE8';
    ctx.beginPath();
    ctx.arc(-22, -26, 10, 0, Math.PI * 2);
    ctx.arc(22, -26, 10, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.ellipse(0, 26, 22, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.strokeStyle = '#F472B6';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, 32);
    ctx.quadraticCurveTo(-45, 22 + Math.sin(tSec * 5) * 8, -36, 4);
    ctx.stroke();
    // Head
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.arc(0, -4, 24, 0, Math.PI * 2);
    ctx.fill();
    // Pink nose
    ctx.fillStyle = '#EC4899';
    ctx.beginPath();
    ctx.arc(0, 4, 5, 0, Math.PI * 2);
    ctx.fill();
    drawEyes(-8, 9);
  } else if (actor.kind === 'dragon') {
    // Wings flapping
    const flap = Math.sin(tSec * 6.5) * 14;
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(-14, 10);
    ctx.quadraticCurveTo(-58, -22 + flap, -44, 22);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, 10);
    ctx.quadraticCurveTo(58, -22 + flap, 44, 22);
    ctx.closePath();
    ctx.fill();
    // Body
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.ellipse(0, 26, 26, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#A7F3D0';
    ctx.beginPath();
    ctx.ellipse(0, 28, 15, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head & Horns
    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(0, -10, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(-14, -34);
    ctx.lineTo(-22, -52);
    ctx.lineTo(-4, -36);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -34);
    ctx.lineTo(22, -52);
    ctx.lineTo(4, -36);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -2, 10, 0.15, Math.PI - 0.15);
    ctx.stroke();
    drawEyes(-14, 11);
  } else if (actor.kind === 'turtle') {
    // Flippers
    const swim = Math.sin(tSec * 4.5) * 8;
    ctx.fillStyle = '#14B8A6';
    ctx.beginPath();
    ctx.ellipse(-34, 16 + swim, 18, 8, -0.4, 0, Math.PI * 2);
    ctx.ellipse(34, 16 - swim, 18, 8, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Shell
    ctx.fillStyle = '#0F766E';
    ctx.beginPath();
    ctx.ellipse(0, 14, 34, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#99F6E4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 14, 16, 0, Math.PI * 2);
    ctx.stroke();
    // Head
    ctx.fillStyle = '#2DD4BF';
    ctx.beginPath();
    ctx.arc(0, -18, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#134E4A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -11, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
    drawEyes(-22, 9);
  } else if (actor.kind === 'owl') {
    // Body
    ctx.fillStyle = '#7C3AED';
    ctx.beginPath();
    ctx.ellipse(0, 12, 30, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly
    ctx.fillStyle = '#EDE9FE';
    ctx.beginPath();
    ctx.ellipse(0, 22, 19, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glasses / Eye Rings
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-11, -8, 12, 0, Math.PI * 2);
    ctx.arc(11, -8, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Beak
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(6, -2);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    // Graduation cap
    ctx.fillStyle = '#172154';
    ctx.beginPath();
    ctx.moveTo(0, -36);
    ctx.lineTo(28, -26);
    ctx.lineTo(0, -18);
    ctx.lineTo(-28, -26);
    ctx.closePath();
    ctx.fill();
    drawEyes(-8, 11);
  } else if (actor.kind === 'robot') {
    // Antenna
    ctx.strokeStyle = '#FF6B00';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(0, -48);
    ctx.stroke();
    ctx.fillStyle = '#FFD41D';
    ctx.beginPath();
    ctx.arc(0, -50, 6, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = '#2563EB';
    drawRoundedRectPath(ctx, -24, 6, 48, 38, 12);
    ctx.fill();
    ctx.fillStyle = '#93C5FD';
    drawRoundedRectPath(ctx, -14, 15, 28, 18, 6);
    ctx.fill();
    // Head
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 3;
    drawRoundedRectPath(ctx, -26, -34, 52, 36, 12);
    ctx.fill();
    ctx.stroke();
    // Visor
    ctx.fillStyle = '#172154';
    drawRoundedRectPath(ctx, -20, -26, 40, 18, 6);
    ctx.fill();
    // Glowing eyes
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.arc(-9, -17, 4, 0, Math.PI * 2);
    ctx.arc(9, -17, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // lila_girl or lila_boy
    const isGirl = actor.kind === 'lila_girl';
    // Hair back
    ctx.fillStyle = '#291D18';
    if (isGirl) {
      ctx.beginPath();
      ctx.arc(-22, -16, 13, 0, Math.PI * 2);
      ctx.arc(22, -16, 13, 0, Math.PI * 2);
      ctx.fill();
    }
    // Outfit
    ctx.fillStyle = isGirl ? '#E61E64' : '#2D3E99';
    drawRoundedRectPath(ctx, -22, 10, 44, 38, 14);
    ctx.fill();
    // LiLab Star Emblem
    ctx.fillStyle = '#FFD41D';
    ctx.beginPath();
    ctx.arc(0, 26, 7, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.fillStyle = '#FDE2C8';
    ctx.beginPath();
    ctx.arc(0, -12, 26, 0, Math.PI * 2);
    ctx.fill();
    // Hair fringe / Cap
    ctx.fillStyle = isGirl ? '#291D18' : '#FF6B00';
    ctx.beginPath();
    ctx.arc(0, -17, 26, Math.PI, Math.PI * 2);
    ctx.fill();
    // Rosy cheeks
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath();
    ctx.arc(-15, -3, 5, 0, Math.PI * 2);
    ctx.arc(15, -3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#9A3412';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -4, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();
    drawEyes(-12, 10);
  }
  ctx.restore();

  // Speech bubble (always unflipped for crisp legibility!)
  const bubbleText = captionLang === 'vi' ? actor.speechVi || actor.speechEn : actor.speechEn || actor.speechVi;
  if (bubbleText && bubbleText.trim()) {
    ctx.save();
    ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
    const lines = wrapCanvasText(ctx, bubbleText.trim(), 200);
    const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width), 60);
    const bw = maxLineW + 28;
    const bh = lines.length * 20 + 18;
    const bx = Math.min(Math.max(cx - bw / 2, 16), CANVAS_W - bw - 16);
    const by = Math.max(cy - 68 * s - bh - 12, 14);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = '#172154';
    ctx.lineWidth = 2;
    drawRoundedRectPath(ctx, bx, by, bw, bh, 14);
    ctx.fill();
    ctx.stroke();

    // Tail triangle
    const tailX = Math.min(Math.max(cx, bx + 18), bx + bw - 18);
    ctx.beginPath();
    ctx.moveTo(tailX - 7, by + bh - 1);
    ctx.lineTo(tailX + 7, by + bh - 1);
    ctx.lineTo(tailX, by + bh + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#172154';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, idx) => {
      ctx.fillText(line, bx + bw / 2, by + 18 + idx * 20);
    });
    ctx.restore();
  }
}

function drawParticlesOnCanvas(ctx: CanvasRenderingContext2D, effect: EffectId, tSec: number) {
  ctx.save();
  if (effect === 'sunbeams') {
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W * 0.65, CANVAS_H * 0.8);
    grad.addColorStop(0, `rgba(255, 236, 153, ${0.22 + Math.sin(tSec * 1.4) * 0.06})`);
    grad.addColorStop(1, 'rgba(255, 236, 153, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(CANVAS_W * 0.55, 0);
    ctx.lineTo(CANVAS_W, 0);
    ctx.lineTo(CANVAS_W * 0.72, CANVAS_H);
    ctx.lineTo(CANVAS_W * 0.15, CANVAS_H);
    ctx.closePath();
    ctx.fill();
  }

  const count = effect === 'sunbeams' ? 16 : 26;
  for (let i = 0; i < count; i++) {
    const seed = i * 97.31;
    if (effect === 'bubbles') {
      const x = ((seed * 13) % CANVAS_W) + Math.sin(tSec * 1.8 + i) * 14;
      const y = CANVAS_H - (((tSec * 45 + seed * 7) % (CANVAS_H + 40)) - 20);
      const r = 4 + (i % 7) * 1.8;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.fillStyle = 'rgba(224,242,254,0.28)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (effect === 'stars' || effect === 'fireflies') {
      const x = ((seed * 19) % CANVAS_W) + Math.cos(tSec * 0.9 + i) * 18;
      const y = ((seed * 11) % (CANVAS_H * 0.75)) + Math.sin(tSec * 1.3 + i) * 12;
      const alpha = 0.35 + Math.abs(Math.sin(tSec * 2.5 + i)) * 0.65;
      const r = effect === 'fireflies' ? 3.5 + (i % 3) : 2.5 + (i % 4);
      ctx.fillStyle =
        effect === 'fireflies'
          ? `rgba(253, 224, 71, ${alpha})`
          : `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (effect === 'hearts') {
      const x = ((seed * 17) % CANVAS_W) + Math.sin(tSec * 1.5 + i) * 12;
      const y = CANVAS_H - (((tSec * 38 + seed * 9) % (CANVAS_H + 30)) - 15);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(236, 72, 153, 0.7)' : 'rgba(251, 113, 133, 0.7)';
      const sz = 6 + (i % 4);
      ctx.beginPath();
      ctx.moveTo(x, y + sz * 0.3);
      ctx.bezierCurveTo(x - sz, y - sz * 0.5, x - sz * 0.4, y - sz * 1.1, x, y - sz * 0.35);
      ctx.bezierCurveTo(x + sz * 0.4, y - sz * 1.1, x + sz, y - sz * 0.5, x, y + sz * 0.3);
      ctx.fill();
    } else if (effect === 'confetti') {
      const colors = ['#FF6B00', '#FFD41D', '#E61E64', '#2D3E99', '#10B981', '#38BDF8'];
      const x = ((seed * 23) % CANVAS_W) + Math.sin(tSec * 2.5 + i) * 20;
      const y = (tSec * 75 + seed * 11) % (CANVAS_H + 20);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tSec * 3 + i);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    } else {
      // sunbeams floating motes
      const x = ((seed * 13) % CANVAS_W) + Math.sin(tSec * 0.8 + i) * 12;
      const y = ((seed * 17) % CANVAS_H) + Math.cos(tSec * 0.7 + i) * 10;
      ctx.fillStyle = 'rgba(255, 251, 235, 0.55)';
      ctx.beginPath();
      ctx.arc(x, y, 2.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export const KidsAnimationStudio: React.FC<KidsAnimationStudioProps> = ({
  lang,
  currentUser,
  student,
}) => {
  const storageKey = `lilab_kids_studio_projects_v1_${student?.id || currentUser.uid}`;
  const [studioMode, setStudioMode] = useState<'explore' | 'write' | 'create' | 'gallery'>('explore');
  const [exploreWorldId, setExploreWorldId] = useState<Exclude<BackdropId, 'custom'>>('savanna');
  const [activeHotspotId, setActiveHotspotId] = useState<string>('hs_acacia');
  const [discoveredHotspots, setDiscoveredHotspots] = useState<string[]>(['hs_acacia']);

  const [project, setProject] = useState<KidStoryProject>(() => STARTER_STORIES.savanna);
  const [savedProjects, setSavedProjects] = useState<KidStoryProject[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as KidStoryProject[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [STARTER_STORIES.savanna];
  });
  const [exportsList, setExportsList] = useState<CapturedExportItem[]>([]);

  const [activeSceneIndex, setActiveSceneIndex] = useState<number>(0);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(
    STARTER_STORIES.savanna.scenes[0]?.actors[0]?.id || null
  );
  const [directorTab, setDirectorTab] = useState<'ai' | 'scene' | 'actors' | 'dialogue'>('ai');

  // Playback, Natural Human Voice & Video Recording state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playFullMovie, setPlayFullMovie] = useState<boolean>(true);
  const [voiceMode, setVoiceMode] = useState<'en' | 'vi' | 'off'>(lang === 'vi' ? 'vi' : 'en');
  const [voicePersona, setVoicePersona] = useState<NaturalVoiceName>('Kore');
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [soundFxOn, setSoundFxOn] = useState<boolean>(true);
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const [recordingProgress, setRecordingProgress] = useState<number>(0);

  // Create My Own Story guided builder state
  const [customStoryTitle, setCustomStoryTitle] = useState<string>('');
  const [customStoryMoral, setCustomStoryMoral] = useState<string>('');
  const [customCast, setCustomCast] = useState<CustomStoryCastDraft[]>([
    { kind: 'lila_girl', customName: 'Lila', motion: 'hop' },
    { kind: 'dragon', customName: 'Jade Dragon', motion: 'float' },
  ]);
  const [customPages, setCustomPages] = useState<CustomStoryPageDraft[]>(() => createStarterCustomPages());
  const [customSparkIdea, setCustomSparkIdea] = useState<string>('');
  const [isDraftingCustomPages, setIsDraftingCustomPages] = useState<boolean>(false);

  // AI Story Generator state
  const [storyIdeaInput, setStoryIdeaInput] = useState<string>('');
  const [isGeneratingStory, setIsGeneratingStory] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const draggingActorIdRef = useRef<string | null>(null);
  const sceneStartTimeRef = useRef<number>(performance.now());
  const animTimeRef = useRef<number>(0);
  const projectRef = useRef(project);
  const activeSceneIndexRef = useRef(activeSceneIndex);
  const isPlayingRef = useRef(isPlaying);
  const selectedActorIdRef = useRef(selectedActorId);
  const isRecordingRef = useRef(isRecordingVideo);

  projectRef.current = project;
  activeSceneIndexRef.current = activeSceneIndex;
  isPlayingRef.current = isPlaying;
  selectedActorIdRef.current = selectedActorId;
  isRecordingRef.current = isRecordingVideo;

  const activeScene: StoryScene = project.scenes[activeSceneIndex] || project.scenes[0];
  const selectedActor = activeScene?.actors.find((a) => a.id === selectedActorId) || null;
  const activeExploreWorld = useMemo(
    () => STORY_WORLDS.find((w) => w.id === exploreWorldId) || STORY_WORLDS[0],
    [exploreWorldId]
  );
  const activeExploreHotspot =
    activeExploreWorld.hotspots.find((h) => h.id === activeHotspotId) || activeExploreWorld.hotspots[0];

  const flashNotice = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 5500);
  }, []);

  // Preload all 4 generated storybook backdrops into Image objects for instant Canvas rendering
  useEffect(() => {
    STORY_WORLDS.forEach((world) => {
      if (!loadedImagesRef.current.has(world.id)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = world.imageSrc;
        loadedImagesRef.current.set(world.id, img);
      }
    });
  }, []);

  // Preload custom backdrop image if uploaded
  useEffect(() => {
    project.scenes.forEach((sc) => {
      if (sc.customBackdropDataUrl && !loadedImagesRef.current.has(sc.id)) {
        const img = new Image();
        img.src = sc.customBackdropDataUrl;
        loadedImagesRef.current.set(sc.id, img);
      }
    });
  }, [project.scenes]);

  const captionLang: 'en' | 'vi' = lang === 'vi' ? 'vi' : 'en';

  // Speak natural human narration whenever scene advances while playing + pre-warm next scene
  useEffect(() => {
    if (!isPlaying || voiceMode === 'off' || studioMode !== 'create') return;
    const sc = project.scenes[activeSceneIndex];
    if (!sc) return;
    const textToRead = voiceMode === 'vi' ? sc.captionVi || sc.captionEn : sc.captionEn || sc.captionVi;
    void speakTextBilingual(textToRead, voiceMode, voicePersona, setVoiceStatus);

    // Pre-fetch the next scene's natural human voice so transitions feel seamless
    const nextSc = project.scenes[activeSceneIndex + 1];
    if (nextSc) {
      const nextText = voiceMode === 'vi' ? nextSc.captionVi || nextSc.captionEn : nextSc.captionEn || nextSc.captionVi;
      if (nextText.trim()) {
        void fetchNaturalTtsUri(nextText, voiceMode, voicePersona).catch(() => {});
      }
    }
  }, [isPlaying, activeSceneIndex, voiceMode, voicePersona, studioMode, project.scenes]);

  // Stop all audio narration on unmount
  useEffect(() => {
    return () => {
      stopAllNarration();
    };
  }, []);

  // Main 60fps HTML5 Canvas Render Loop (works in Create mode & during Video Recording)
  useEffect(() => {
    if (studioMode !== 'create') return;
    let rafId = 0;

    const renderFrame = (nowMs: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const curProj = projectRef.current;
          const idx = Math.min(activeSceneIndexRef.current, curProj.scenes.length - 1);
          const sc = curProj.scenes[idx] || curProj.scenes[0];
          const elapsedInScene = (nowMs - sceneStartTimeRef.current) / 1000;
          const tSec = isPlayingRef.current ? elapsedInScene : nowMs / 1000;
          animTimeRef.current = tSec;

          // Clear canvas
          ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

          // Resolve backdrop image
          const img =
            sc.backdrop === 'custom' && sc.customBackdropDataUrl
              ? loadedImagesRef.current.get(sc.id)
              : loadedImagesRef.current.get(sc.backdrop);

          // Camera transform (Ken Burns pan/zoom)
          const progress = Math.min(1, (elapsedInScene % Math.max(1, sc.durationSec)) / Math.max(1, sc.durationSec));
          let zoom = 1.04;
          let panX = 0;
          let panY = 0;
          if (sc.camera === 'zoom-in') {
            zoom = 1.0 + progress * 0.1;
          } else if (sc.camera === 'pan-right') {
            zoom = 1.1;
            panX = (progress - 0.5) * -60;
          } else if (sc.camera === 'pan-left') {
            zoom = 1.1;
            panX = (progress - 0.5) * 60;
          } else if (sc.camera === 'gentle-float') {
            zoom = 1.06;
            panY = Math.sin(tSec * 1.1) * 10;
          }

          ctx.save();
          ctx.translate(CANVAS_W / 2 + panX, CANVAS_H / 2 + panY);
          ctx.scale(zoom, zoom);
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, -CANVAS_W / 2, -CANVAS_H / 2, CANVAS_W, CANVAS_H);
          } else {
            const bgGrad = ctx.createLinearGradient(-CANVAS_W / 2, -CANVAS_H / 2, CANVAS_W / 2, CANVAS_H / 2);
            bgGrad.addColorStop(0, '#1E3A8A');
            bgGrad.addColorStop(1, '#0D9488');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(-CANVAS_W / 2, -CANVAS_H / 2, CANVAS_W, CANVAS_H);
          }
          ctx.restore();

          // Animated atmosphere particles
          drawParticlesOnCanvas(ctx, sc.effect, tSec);

          // Actors
          sc.actors.forEach((actor) => {
            drawStoryActorOnCanvas(
              ctx,
              actor,
              tSec,
              !isPlayingRef.current && !isRecordingRef.current && actor.id === selectedActorIdRef.current,
              captionLang
            );
          });

          // Top-left Scene Title chip (clean contrast scrim)
          const sceneHeader = `${idx + 1}/${curProj.scenes.length} · ${captionLang === 'vi' ? sc.titleVi || sc.titleEn : sc.titleEn}`;
          ctx.save();
          ctx.font = '700 14px "Plus Jakarta Sans", system-ui, sans-serif';
          const tw = ctx.measureText(sceneHeader).width + 26;
          ctx.fillStyle = 'rgba(23, 33, 84, 0.72)';
          drawRoundedRectPath(ctx, 18, 16, tw, 32, 10);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.textBaseline = 'middle';
          ctx.fillText(sceneHeader, 31, 32);

          // Optional Vocab Spotlight top-right
          if (sc.vocabWordEn) {
            const vocabStr = `${sc.vocabWordEn}${sc.vocabWordVi ? ` · ${sc.vocabWordVi}` : ''}`;
            const vw = ctx.measureText(vocabStr).width + 26;
            ctx.fillStyle = 'rgba(255, 107, 0, 0.88)';
            drawRoundedRectPath(ctx, CANVAS_W - vw - 18, 16, vw, 32, 10);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(vocabStr, CANVAS_W - vw - 5, 32);
          }
          ctx.restore();

          // Bottom Storybook Caption Scrim (WCAG AA contrast >= 4.5:1)
          const captionText = captionLang === 'vi' ? sc.captionVi || sc.captionEn : sc.captionEn || sc.captionVi;
          if (captionText) {
            ctx.save();
            const scrim = ctx.createLinearGradient(0, CANVAS_H - 120, 0, CANVAS_H);
            scrim.addColorStop(0, 'rgba(15, 23, 42, 0)');
            scrim.addColorStop(0.35, 'rgba(15, 23, 42, 0.72)');
            scrim.addColorStop(1, 'rgba(15, 23, 42, 0.92)');
            ctx.fillStyle = scrim;
            ctx.fillRect(0, CANVAS_H - 120, CANVAS_W, 120);

            ctx.font = '600 20px "Bricolage Grotesque", "Plus Jakarta Sans", system-ui, sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const capLines = wrapCanvasText(ctx, captionText, CANVAS_W - 88);
            const startY = CANVAS_H - 28 - (capLines.length - 1) * 26;
            capLines.forEach((line, i) => {
              ctx.fillText(line, CANVAS_W / 2, startY + i * 26);
            });
            ctx.restore();
          }

          // Auto-advance scenes during playback (not while recording, since recorder controls exact timing)
          if (isPlayingRef.current && !isRecordingRef.current && elapsedInScene >= sc.durationSec) {
            if (playFullMovie && idx < curProj.scenes.length - 1) {
              sceneStartTimeRef.current = nowMs;
              setActiveSceneIndex(idx + 1);
            } else if (playFullMovie) {
              sceneStartTimeRef.current = nowMs;
              setActiveSceneIndex(0);
            } else {
              sceneStartTimeRef.current = nowMs;
            }
          }
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [studioMode, captionLang, playFullMovie]);

  // Direct Canvas pointer drag-and-drop for actors
  const getNormalizedCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0.5, y: 0.65 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(0.92, Math.max(0.08, (e.clientX - rect.left) / rect.width));
    const y = Math.min(0.84, Math.max(0.2, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPlaying || isRecordingVideo) return;
    const pos = getNormalizedCanvasPos(e);
    const hit = [...activeScene.actors]
      .reverse()
      .find((a) => Math.hypot((a.x - pos.x) * CANVAS_W, (a.y - pos.y) * CANVAS_H) < 64 * a.scale);
    if (hit) {
      draggingActorIdRef.current = hit.id;
      setSelectedActorId(hit.id);
      setDirectorTab('actors');
      if (soundFxOn) playChimeTone(587.33, 0.14);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const dragId = draggingActorIdRef.current;
    if (!dragId) return;
    const pos = getNormalizedCanvasPos(e);
    updateActiveScene((sc) => ({
      ...sc,
      actors: sc.actors.map((a) => (a.id === dragId ? { ...a, x: pos.x, y: pos.y } : a)),
    }));
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingActorIdRef.current) {
      draggingActorIdRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const updateActiveScene = (updater: (sc: StoryScene) => StoryScene) => {
    setProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      scenes: prev.scenes.map((sc, i) => (i === activeSceneIndex ? updater(sc) : sc)),
    }));
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopAllNarration();
      setVoiceStatus('idle');
    } else {
      sceneStartTimeRef.current = performance.now();
      setIsPlaying(true);
      if (soundFxOn) playChimeTone(523.25, 0.18);
    }
  };

  const handleAddScene = () => {
    const newScene: StoryScene = {
      id: `sc_${Date.now()}`,
      titleEn: `Scene ${project.scenes.length + 1}`,
      titleVi: `Cảnh ${project.scenes.length + 1}`,
      backdrop: activeScene.backdrop,
      customBackdropDataUrl: activeScene.customBackdropDataUrl,
      effect: activeScene.effect,
      camera: 'gentle-float',
      durationSec: 5,
      captionEn: 'A new surprise appeared on the horizon!',
      captionVi: 'Một điều bất ngờ mới xuất hiện phía chân trời!',
      vocabWordEn: 'Adventure',
      vocabWordVi: 'Phiêu lưu',
      actors: [
        {
          id: `act_${Date.now()}`,
          kind: 'lila_girl',
          name: 'Lila',
          x: 0.45,
          y: 0.68,
          scale: 1.0,
          flipX: false,
          motion: 'hop',
          speechEn: 'Let us see what happens next!',
          speechVi: 'Cùng xem chuyện gì xảy ra tiếp theo nhé!',
        },
      ],
    };
    setProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      scenes: [...prev.scenes, newScene],
    }));
    setActiveSceneIndex(project.scenes.length);
    setSelectedActorId(newScene.actors[0].id);
  };

  const handleDuplicateScene = () => {
    const copy: StoryScene = {
      ...activeScene,
      id: `sc_${Date.now()}`,
      titleEn: `${activeScene.titleEn} (Copy)`,
      titleVi: `${activeScene.titleVi} (Bản sao)`,
      actors: activeScene.actors.map((a, idx) => ({ ...a, id: `act_${Date.now()}_${idx}` })),
    };
    setProject((prev) => {
      const next = [...prev.scenes];
      next.splice(activeSceneIndex + 1, 0, copy);
      return { ...prev, updatedAt: new Date().toISOString(), scenes: next };
    });
    setActiveSceneIndex(activeSceneIndex + 1);
  };

  const handleDeleteScene = (indexToRemove: number) => {
    if (project.scenes.length <= 1) return;
    setProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      scenes: prev.scenes.filter((_, i) => i !== indexToRemove),
    }));
    setActiveSceneIndex((prev) => Math.max(0, Math.min(prev, project.scenes.length - 2)));
  };

  const handleAddActor = (kind: ActorKind) => {
    const meta = ACTOR_CATALOG.find((a) => a.kind === kind)!;
    const newActor: StoryActor = {
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind,
      name: meta.labelEn.split(' ')[0],
      x: 0.25 + ((activeScene.actors.length * 0.22) % 0.55),
      y: 0.66,
      scale: 1.0,
      flipX: activeScene.actors.length % 2 === 1,
      motion: 'hop',
      speechEn: meta.defaultSpeechEn,
      speechVi: meta.defaultSpeechVi,
    };
    updateActiveScene((sc) => ({ ...sc, actors: [...sc.actors, newActor] }));
    setSelectedActorId(newActor.id);
    if (soundFxOn) playChimeTone(659.25, 0.16);
  };

  const handleRemoveActor = (actorId: string) => {
    updateActiveScene((sc) => ({
      ...sc,
      actors: sc.actors.filter((a) => a.id !== actorId),
    }));
    if (selectedActorId === actorId) setSelectedActorId(null);
  };

  const handleCustomBackdropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;
      const img = new Image();
      img.src = dataUrl;
      loadedImagesRef.current.set(activeScene.id, img);
      updateActiveScene((sc) => ({
        ...sc,
        backdrop: 'custom',
        customBackdropDataUrl: dataUrl,
      }));
      flashNotice(biText(lang, 'Custom scene artwork added!', 'Đã tải ảnh nền tự chọn của bạn!'));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProjectToGallery = () => {
    const stamped: KidStoryProject = {
      ...project,
      id: project.id.startsWith('starter_') ? `story_${Date.now()}` : project.id,
      updatedAt: new Date().toISOString(),
    };
    setProject(stamped);
    setSavedProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== stamped.id);
      const next = [stamped, ...filtered].slice(0, 12);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage full fallback
      }
      return next;
    });
    if (soundFxOn) playChimeTone(783.99, 0.22);
    flashNotice(
      biText(lang, `Saved "${stamped.titleEn}" to My Gallery!`, `Đã lưu "${stamped.titleVi || stamped.titleEn}" vào Thư viện của bé!`)
    );
  };

  const handleSaveSnapshotImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const title = `${project.titleEn} · Scene ${activeSceneIndex + 1}`;
    setExportsList((prev) => [
      { id: `img_${Date.now()}`, kind: 'image', title, url: dataUrl, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${project.titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_scene_${activeSceneIndex + 1}.png`;
    a.click();
    if (soundFxOn) playChimeTone(880, 0.18);
    flashNotice(
      biText(lang, 'Story picture (.PNG) downloaded & saved to My Gallery!', 'Đã tải ảnh truyện (.PNG) và lưu vào Thư viện của bé!')
    );
  };

  const handleRecordStoryVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecordingVideo) return;
    if (typeof MediaRecorder === 'undefined' || !('captureStream' in canvas)) {
      flashNotice(
        biText(
          lang,
          'Video recording is not supported in this browser. Use Save Picture (.PNG) instead.',
          'Trình duyệt này chưa hỗ trợ quay video. Bé hãy dùng nút Lưu Ảnh (.PNG) nhé.'
        )
      );
      return;
    }

    setIsRecordingVideo(true);
    setIsPlaying(true);
    setSelectedActorId(null);
    setRecordingProgress(5);

    const stream = canvas.captureStream(30);
    const preferredTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    const donePromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
      };
    });

    recorder.start(200);

    const totalSec = project.scenes.reduce((sum, s) => sum + Math.max(2, Math.min(6, s.durationSec)), 0);
    let elapsedTotal = 0;

    for (let i = 0; i < project.scenes.length; i++) {
      const scDurationMs = Math.max(2, Math.min(6, project.scenes[i].durationSec)) * 1000;
      setActiveSceneIndex(i);
      sceneStartTimeRef.current = performance.now();
      const stepMs = 200;
      const steps = Math.ceil(scDurationMs / stepMs);
      for (let step = 0; step < steps; step++) {
        await new Promise((r) => setTimeout(r, stepMs));
        elapsedTotal += stepMs / 1000;
        setRecordingProgress(Math.min(98, Math.round((elapsedTotal / totalSec) * 100)));
      }
    }

    recorder.stop();
    const videoBlob = await donePromise;
    const videoUrl = URL.createObjectURL(videoBlob);
    setExportsList((prev) => [
      {
        id: `vid_${Date.now()}`,
        kind: 'video',
        title: `${project.titleEn} (${project.scenes.length} scenes)`,
        url: videoUrl,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `${project.titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_lilab_movie.webm`;
    a.click();

    setIsRecordingVideo(false);
    setIsPlaying(false);
    setRecordingProgress(0);
    setStudioMode('gallery');
    if (soundFxOn) playChimeTone(987.77, 0.25);
    flashNotice(
      biText(
        lang,
        'Animated Story Video (.WEBM) created! Watch & download it anytime in My Gallery.',
        'Đã tạo xong Video Hoạt Hình (.WEBM)! Bé có thể xem lại và tải về ngay trong Thư viện.'
      )
    );
  };

  const handleGenerateAiStory = async (ideaOverride?: string) => {
    const promptIdea = (ideaOverride ?? storyIdeaInput).trim();
    if (!promptIdea || isGeneratingStory) return;
    setStoryIdeaInput(promptIdea);
    setIsGeneratingStory(true);
    try {
      const res = await generateKidStoryMovie({
        idea: promptIdea,
        preferredBackdrop: activeScene.backdrop === 'custom' ? 'savanna' : activeScene.backdrop,
        ageGroup: student?.age ? `${Math.max(4, student.age - 1)}-${student.age + 2}` : '6-12',
      });
      const validBackdrops = new Set(['savanna', 'lantern_bay', 'cosmos', 'coral_reef']);
      const validEffects = new Set(['sunbeams', 'fireflies', 'stars', 'bubbles', 'hearts', 'confetti']);
      const validCameras = new Set(['zoom-in', 'pan-right', 'pan-left', 'gentle-float']);
      const validActors = new Set(['lion', 'mouse', 'dragon', 'lila_girl', 'lila_boy', 'turtle', 'owl', 'robot']);
      const validMotions = new Set(['hop', 'walk', 'float', 'wave', 'spin']);

      const scenes: StoryScene[] = (res.scenes || []).slice(0, 6).map((sc, idx) => ({
        id: `ai_sc_${Date.now()}_${idx}`,
        titleEn: sc.titleEn || `Scene ${idx + 1}`,
        titleVi: sc.titleVi || sc.titleEn || `Cảnh ${idx + 1}`,
        backdrop: (validBackdrops.has(sc.backdrop) ? sc.backdrop : 'savanna') as BackdropId,
        effect: (validEffects.has(sc.effect) ? sc.effect : 'stars') as EffectId,
        camera: (validCameras.has(sc.camera) ? sc.camera : 'zoom-in') as CameraMotionId,
        durationSec: 5,
        captionEn: sc.captionEn || promptIdea,
        captionVi: sc.captionVi || sc.captionEn || promptIdea,
        vocabWordEn: sc.vocabWordEn || 'Imagine',
        vocabWordVi: sc.vocabWordVi || 'Tưởng tượng',
        actors: (sc.actors || []).slice(0, 3).map((a, aIdx) => ({
          id: `ai_act_${Date.now()}_${idx}_${aIdx}`,
          kind: (validActors.has(a.kind) ? a.kind : aIdx === 0 ? 'lila_girl' : 'owl') as ActorKind,
          name: a.name || (aIdx === 0 ? 'Lila' : 'Buddy'),
          x: Math.min(0.84, Math.max(0.18, Number(a.x) || (aIdx === 0 ? 0.32 : 0.7))),
          y: Math.min(0.76, Math.max(0.42, Number(a.y) || 0.68)),
          scale: 1.0,
          flipX: aIdx === 1,
          motion: (validMotions.has(a.motion) ? a.motion : 'hop') as ActorMotion,
          speechEn: a.speechEn || 'Let us go!',
          speechVi: a.speechVi || a.speechEn || 'Đi thôi nào!',
        })),
      }));

      if (scenes.length > 0) {
        const nextProject: KidStoryProject = {
          id: `story_${Date.now()}`,
          titleEn: res.titleEn || promptIdea.slice(0, 48),
          titleVi: res.titleVi || res.titleEn || promptIdea.slice(0, 48),
          moralEn: res.moralEn || 'Creativity and kindness light up every story.',
          moralVi: res.moralVi || 'Sự sáng tạo và lòng tốt làm bừng sáng mọi câu chuyện.',
          updatedAt: new Date().toISOString(),
          scenes,
        };
        setProject(nextProject);
        setActiveSceneIndex(0);
        setSelectedActorId(scenes[0].actors[0]?.id || null);
        sceneStartTimeRef.current = performance.now();
        setIsPlaying(true);
        if (soundFxOn) playChimeTone(659.25, 0.22);
        flashNotice(
          biText(
            lang,
            `Generated 4-scene animated movie "${nextProject.titleEn}"! Press Record Video to export.`,
            `Đã tạo xong phim hoạt hình 4 cảnh "${nextProject.titleVi}"! Nhấn Quay Video để xuất phim nhé.`
          )
        );
      }
    } catch {
      // Graceful offline/local instant storyboard fallback so kids always succeed
      const lower = promptIdea.toLowerCase();
      const chosenBackdrop: Exclude<BackdropId, 'custom'> =
        lower.includes('ocean') || lower.includes('sea') || lower.includes('fish') || lower.includes('turtle') || lower.includes('biển')
          ? 'coral_reef'
          : lower.includes('space') || lower.includes('moon') || lower.includes('star') || lower.includes('rocket') || lower.includes('vũ trụ')
            ? 'cosmos'
            : lower.includes('dragon') || lower.includes('lantern') || lower.includes('bay') || lower.includes('rồng')
              ? 'lantern_bay'
              : 'savanna';
      const base = STARTER_STORIES[chosenBackdrop];
      const remixed: KidStoryProject = {
        ...base,
        id: `story_${Date.now()}`,
        titleEn: promptIdea.slice(0, 52),
        titleVi: promptIdea.slice(0, 52),
        updatedAt: new Date().toISOString(),
        scenes: base.scenes.map((sc, i) => ({
          ...sc,
          id: `loc_${Date.now()}_${i}`,
          captionEn: i === 0 ? `Our adventure begins: ${promptIdea}!` : sc.captionEn,
          captionVi: i === 0 ? `Cuộc phiêu lưu bắt đầu: ${promptIdea}!` : sc.captionVi,
        })),
      };
      setProject(remixed);
      setActiveSceneIndex(0);
      sceneStartTimeRef.current = performance.now();
      setIsPlaying(true);
      flashNotice(
        biText(
          lang,
          'Created an animated starter storyboard from your idea! Customize any character or dialogue.',
          'Đã dựng sẵn khung phim hoạt hình theo ý tưởng của bé! Bé có thể chỉnh nhân vật và lời thoại tùy thích.'
        )
      );
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleLaunchWorldInStudio = (worldId: Exclude<BackdropId, 'custom'>) => {
    const starter = STARTER_STORIES[worldId];
    setProject({
      ...starter,
      id: `story_${Date.now()}`,
      updatedAt: new Date().toISOString(),
    });
    setActiveSceneIndex(0);
    setSelectedActorId(starter.scenes[0]?.actors[0]?.id || null);
    setStudioMode('create');
    sceneStartTimeRef.current = performance.now();
    if (soundFxOn) playChimeTone(587.33, 0.2);
  };

  const handleToggleCustomCast = (kind: ActorKind) => {
    setCustomCast((prev) => {
      const exists = prev.some((c) => c.kind === kind);
      if (exists) {
        if (prev.length <= 1) return prev; // Keep at least 1 hero
        return prev.filter((c) => c.kind !== kind);
      }
      if (prev.length >= 3) {
        const meta = ACTOR_CATALOG.find((a) => a.kind === kind);
        return [...prev.slice(1), { kind, customName: meta?.labelEn || 'Hero', motion: 'hop' }];
      }
      const meta = ACTOR_CATALOG.find((a) => a.kind === kind);
      return [...prev, { kind, customName: meta?.labelEn || 'Hero', motion: 'hop' }];
    });
  };

  const handleAddCustomPage = () => {
    if (customPages.length >= 6) return;
    const nextIdx = customPages.length + 1;
    setCustomPages((prev) => [
      ...prev,
      {
        id: `cp_${Date.now()}`,
        stageLabelEn: `Page ${nextIdx} · New Chapter`,
        stageLabelVi: `Trang ${nextIdx} · Chương Mới`,
        backdrop: 'savanna',
        effect: 'stars',
        camera: 'gentle-float',
        narration: '',
        speechLine: '',
        vocabWord: 'Magic',
      },
    ]);
  };

  const handleCustomPageBackdropUpload = (pageId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setCustomPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, backdrop: 'custom', customBackdropDataUrl: dataUrl } : p))
      );
    };
    reader.readAsDataURL(file);
  };

  const handleDraftCustomPagesWithAi = async () => {
    const idea = customSparkIdea.trim();
    if (!idea || isDraftingCustomPages) return;
    setIsDraftingCustomPages(true);
    try {
      const res = await generateKidStoryMovie({
        idea,
        preferredBackdrop: customPages[0]?.backdrop === 'custom' ? 'savanna' : customPages[0]?.backdrop || 'savanna',
        ageGroup: student?.age ? `${Math.max(4, student.age - 1)}-${student.age + 2}` : '6-12',
      });
      const validBackdrops = new Set(['savanna', 'lantern_bay', 'cosmos', 'coral_reef']);
      const validEffects = new Set(['sunbeams', 'fireflies', 'stars', 'bubbles', 'hearts', 'confetti']);
      const validCameras = new Set(['zoom-in', 'pan-right', 'pan-left', 'gentle-float']);

      if (res.titleEn || res.titleVi) {
        setCustomStoryTitle(lang === 'vi' ? res.titleVi || res.titleEn : res.titleEn || res.titleVi);
      }
      if (res.moralEn || res.moralVi) {
        setCustomStoryMoral(lang === 'vi' ? res.moralVi || res.moralEn : res.moralEn || res.moralVi);
      }
      if (Array.isArray(res.scenes) && res.scenes.length > 0) {
        setCustomPages(
          res.scenes.slice(0, 6).map((sc, idx) => ({
            id: `cp_ai_${Date.now()}_${idx}`,
            stageLabelEn: `Page ${idx + 1} · ${sc.titleEn || `Scene ${idx + 1}`}`,
            stageLabelVi: `Trang ${idx + 1} · ${sc.titleVi || sc.titleEn || `Cảnh ${idx + 1}`}`,
            backdrop: (validBackdrops.has(sc.backdrop) ? sc.backdrop : 'savanna') as BackdropId,
            effect: (validEffects.has(sc.effect) ? sc.effect : 'stars') as EffectId,
            camera: (validCameras.has(sc.camera) ? sc.camera : 'zoom-in') as CameraMotionId,
            narration: lang === 'vi' ? sc.captionVi || sc.captionEn : sc.captionEn || sc.captionVi,
            speechLine:
              lang === 'vi'
                ? sc.actors?.[0]?.speechVi || sc.actors?.[0]?.speechEn || ''
                : sc.actors?.[0]?.speechEn || sc.actors?.[0]?.speechVi || '',
            vocabWord: sc.vocabWordEn || 'Imagine',
          }))
        );
      }
      if (soundFxOn) playChimeTone(659.25, 0.2);
      flashNotice(
        biText(
          lang,
          'Drafted 4 editable story pages! Customize any sentence, change characters, and click Animate My Story.',
          'Đã phác thảo xong 4 trang truyện! Bé có thể chỉnh sửa từng câu chữ rồi bấm Làm Phim Truyện Của Em.'
        )
      );
    } catch {
      const heroNames = customCast.map((c) => c.customName).join(' & ') || 'Lila';
      setCustomStoryTitle(idea.slice(0, 56));
      setCustomStoryMoral(
        biText(
          lang,
          'Curiosity and kindness turn every dream into an adventure.',
          'Sự tò mò và lòng tốt biến mọi ước mơ thành cuộc phiêu lưu kỳ diệu.'
        )
      );
      setCustomPages([
        {
          id: `cp_loc_1_${Date.now()}`,
          stageLabelEn: 'Page 1 · Once Upon a Time',
          stageLabelVi: 'Trang 1 · Ngày Xửa Ngày Xưa',
          backdrop: 'savanna',
          effect: 'sunbeams',
          camera: 'zoom-in',
          narration: biText(
            lang,
            `One bright morning, ${heroNames} set off on a brand-new adventure: ${idea}.`,
            `Một buổi sáng rực nắng, ${heroNames} bắt đầu hành trình mới: ${idea}.`
          ),
          speechLine: biText(lang, 'Let our story begin!', 'Câu chuyện bắt đầu thôi!'),
          vocabWord: 'Adventure',
        },
        {
          id: `cp_loc_2_${Date.now()}`,
          stageLabelEn: 'Page 2 · The Magical Clue',
          stageLabelVi: 'Trang 2 · Manh Mối Kỳ Diệu',
          backdrop: 'lantern_bay',
          effect: 'fireflies',
          camera: 'pan-right',
          narration: biText(
            lang,
            `Along the glowing lantern bay, ${heroNames} discovered a sparkling secret map.`,
            `Dọc theo vịnh đèn lồng lung linh, ${heroNames} tìm thấy một tấm bản đồ bí mật.`
          ),
          speechLine: biText(lang, 'Look what we found!', 'Nhìn xem chúng ta tìm thấy gì này!'),
          vocabWord: 'Discovery',
        },
        {
          id: `cp_loc_3_${Date.now()}`,
          stageLabelEn: 'Page 3 · Teamwork Shines',
          stageLabelVi: 'Trang 3 · Sức Mạnh Đồng Đội',
          backdrop: 'cosmos',
          effect: 'stars',
          camera: 'gentle-float',
          narration: biText(
            lang,
            `Even when the puzzle felt tricky, ${heroNames} listened to each other and solved it together.`,
            `Dù thử thách thật khó, ${heroNames} vẫn lắng nghe nhau và cùng giải quyết thành công.`
          ),
          speechLine: biText(lang, 'Together we can do it!', 'Cùng nhau chúng ta làm được!'),
          vocabWord: 'Teamwork',
        },
        {
          id: `cp_loc_4_${Date.now()}`,
          stageLabelEn: 'Page 4 · Happy Celebration',
          stageLabelVi: 'Trang 4 · Ăn Mừng Chiến Thắng',
          backdrop: 'coral_reef',
          effect: 'confetti',
          camera: 'zoom-in',
          narration: biText(
            lang,
            `Everyone cheered under a shower of confetti, proud of the story ${heroNames} created!`,
            `Mọi người hò reo giữa cơn mưa pháo giấy, thật tự hào về câu chuyện của ${heroNames}!`
          ),
          speechLine: biText(lang, 'Hooray! Best day ever!', 'Hoan hô! Ngày tuyệt nhất!'),
          vocabWord: 'Celebrate',
        },
      ]);
      flashNotice(
        biText(
          lang,
          'Created 4 starter pages from your idea—edit any sentence to make it 100% yours!',
          'Đã tạo 4 trang khung truyện từ ý tưởng của bé — hãy chỉnh sửa để câu chuyện thật độc đáo nhé!'
        )
      );
    } finally {
      setIsDraftingCustomPages(false);
    }
  };

  const handleLaunchCustomStory = () => {
    const cleanTitle =
      customStoryTitle.trim() ||
      biText(
        lang,
        `${student?.fullName || currentUser.displayName}'s Original Story`,
        `Truyện Sáng Tác Của ${student?.fullName || currentUser.displayName}`
      );
    const cleanMoral =
      customStoryMoral.trim() ||
      biText(
        lang,
        'Imagination and kindness bring every story to life.',
        'Trí tưởng tượng và lòng tốt làm bừng sáng mọi câu chuyện.'
      );
    const castList =
      customCast.length > 0
        ? customCast
        : [{ kind: 'lila_girl' as ActorKind, customName: 'Lila', motion: 'hop' as ActorMotion }];

    const builtScenes: StoryScene[] = customPages.map((pg, idx) => {
      const defaultNarration = biText(
        lang,
        `${castList[0].customName} explored scene ${idx + 1} with curiosity and joy!`,
        `${castList[0].customName} khám phá cảnh ${idx + 1} với tràn đầy niềm vui và tò mò!`
      );
      const narrationText = pg.narration.trim() || defaultNarration;
      const speechText =
        pg.speechLine.trim() ||
        (idx === 0
          ? biText(lang, 'Welcome to my story!', 'Chào mừng đến với truyện của em!')
          : idx === customPages.length - 1
            ? biText(lang, 'What a wonderful ending!', 'Một cái kết thật tuyệt vời!')
            : biText(lang, 'Let us keep exploring!', 'Cùng khám phá tiếp nào!'));

      const xPositions = castList.length === 1 ? [0.5] : castList.length === 2 ? [0.3, 0.72] : [0.22, 0.5, 0.78];

      return {
        id: `my_sc_${Date.now()}_${idx}`,
        titleEn: pg.stageLabelEn,
        titleVi: pg.stageLabelVi,
        backdrop: pg.backdrop,
        customBackdropDataUrl: pg.customBackdropDataUrl,
        effect: pg.effect,
        camera: pg.camera,
        durationSec: 6,
        captionEn: narrationText,
        captionVi: narrationText,
        vocabWordEn: pg.vocabWord.trim() || 'Imagine',
        vocabWordVi: pg.vocabWord.trim() || 'Sáng tạo',
        actors: castList.map((member, mIdx) => ({
          id: `my_act_${Date.now()}_${idx}_${mIdx}`,
          kind: member.kind,
          name: member.customName.trim() || 'Hero',
          x: xPositions[mIdx] ?? 0.5,
          y: 0.67,
          scale: 1.0,
          flipX: mIdx === castList.length - 1 && castList.length > 1,
          motion: member.motion,
          speechEn: mIdx === 0 ? speechText : '',
          speechVi: mIdx === 0 ? speechText : '',
        })),
      };
    });

    const newProject: KidStoryProject = {
      id: `my_story_${Date.now()}`,
      titleEn: cleanTitle,
      titleVi: cleanTitle,
      moralEn: cleanMoral,
      moralVi: cleanMoral,
      updatedAt: new Date().toISOString(),
      scenes: builtScenes,
    };

    setProject(newProject);
    setSavedProjects((prev) => {
      const updated = [newProject, ...prev].slice(0, 14);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    setActiveSceneIndex(0);
    setSelectedActorId(builtScenes[0]?.actors[0]?.id || null);
    setStudioMode('create');
    sceneStartTimeRef.current = performance.now();
    setIsPlaying(true);
    if (soundFxOn) playChimeTone(783.99, 0.25);
    flashNotice(
      biText(
        lang,
        `Your original story "${cleanTitle}" is now playing with natural human narration!`,
        `Truyện sáng tác "${cleanTitle}" của em đang phát cùng giọng kể chuyện tự nhiên!`
      )
    );
  };

  const handleStartBlankStory = () => {
    stopAllNarration();
    setIsPlaying(false);
    setCustomStoryTitle('');
    setCustomStoryMoral('');
    setCustomSparkIdea('');
    setCustomPages(createStarterCustomPages());
    setStudioMode('write');
  };

  return (
    <div className="space-y-6">
      {/* Studio Workspace Header & Mode Switcher */}
      <div className="bg-white rounded-2xl border border-[#172154]/10 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#525E80]">
              {biText(
                lang,
                'Student Creative Lab · Write Original Stories & Direct Animated Movies',
                'Phòng Sáng Tạo Học Viên · Tự Viết Truyện & Làm Phim Hoạt Hình'
              )}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#172154]">
              {biText(lang, 'Kids Animation & Story Studio', 'Xưởng Hoạt Hình & Sáng Tác Truyện Nhí')}
            </h2>
            <p className="text-sm text-[#525E80] max-w-2xl">
              {biText(
                lang,
                'Write your own original stories, pick animated heroes, listen with a natural human storyteller voice, and export pictures or animated movies.',
                'Tự sáng tác câu chuyện của riêng bé, chọn nhân vật hoạt hình, nghe giọng kể chuyện tự nhiên như người thật và xuất ảnh hoặc video phim hoạt hình.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <div className="inline-flex flex-wrap items-center p-1 bg-[#F2F4F8] rounded-xl border border-[#172154]/10">
              {(
                [
                  { id: 'explore', labelEn: 'Explore Worlds', labelVi: 'Khám Phá', icon: Compass },
                  { id: 'write', labelEn: 'Create My Story', labelVi: 'Tự Viết Truyện', icon: PenLine },
                  { id: 'create', labelEn: 'Animation Studio', labelVi: 'Xưởng Phim', icon: Film },
                  { id: 'gallery', labelEn: `My Gallery (${savedProjects.length + exportsList.length})`, labelVi: `Thư Viện (${savedProjects.length + exportsList.length})`, icon: Layers },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = studioMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      stopAllNarration();
                      setIsPlaying(false);
                      setVoiceStatus('idle');
                      setStudioMode(tab.id);
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#FF6B00] text-white shadow-xs'
                        : 'text-[#172154]/75 hover:text-[#172154]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {lang === 'vi' ? tab.labelVi : tab.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* MODE 1: INTERACTIVE STORY WORLD EXPLORER */}
      {studioMode === 'explore' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Interactive Visual Stage (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-[#172154]/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#172154]/10 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-[#172154]">
                  {lang === 'vi' ? activeExploreWorld.nameVi : activeExploreWorld.nameEn}
                </h3>
                <div className="text-xs text-[#525E80]">
                  {lang === 'vi' ? activeExploreWorld.subtitleVi : activeExploreWorld.subtitleEn}
                  {' · '}
                  {biText(lang, 'Tap glowing markers to discover vocabulary', 'Chạm vào các điểm sáng để khám phá từ vựng')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleLaunchWorldInStudio(activeExploreWorld.id)}
                className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Film className="w-3.5 h-3.5" />
                {biText(lang, 'Animate This Story', 'Làm Phim Truyện Này')}
              </button>
            </div>

            <div
              className="relative aspect-video w-full overflow-hidden select-none"
              style={{ background: activeExploreWorld.fallbackGradient }}
            >
              <img
                src={activeExploreWorld.imageSrc}
                alt={activeExploreWorld.nameEn}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />

              {/* Tappable Interactive Discovery Hotspots */}
              {activeExploreWorld.hotspots.map((hs, index) => {
                const isSelected = activeExploreHotspot.id === hs.id;
                const isDiscovered = discoveredHotspots.includes(hs.id);
                return (
                  <button
                    key={hs.id}
                    type="button"
                    onClick={() => {
                      setActiveHotspotId(hs.id);
                      if (!isDiscovered) setDiscoveredHotspots((prev) => [...prev, hs.id]);
                      if (soundFxOn) playChimeTone(523.25 + index * 110, 0.2);
                      void speakTextBilingual(hs.wordEn, 'en', voicePersona, setVoiceStatus);
                    }}
                    style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm transition-transform cursor-pointer border-2 shadow-md ${
                      isSelected
                        ? 'bg-[#FF6B00] text-white border-white scale-115'
                        : isDiscovered
                          ? 'bg-emerald-600 text-white border-white hover:scale-110'
                          : 'bg-[#172154]/90 text-[#FFD41D] border-white hover:scale-110'
                    }`}
                    aria-label={hs.wordEn}
                  >
                    {index + 1}
                  </button>
                );
              })}

              {/* Bottom Discovery Caption Overlay */}
              <div className="absolute bottom-3 left-3 right-3 bg-[#172154]/88 backdrop-blur-xs text-white rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-sm font-bold flex flex-wrap items-center gap-2">
                    <span className="text-[#FFD41D]">{activeExploreHotspot.wordEn}</span>
                    <span className="text-white/50">·</span>
                    <span>{activeExploreHotspot.wordVi}</span>
                    <span className="text-xs font-mono-num text-white/75">{activeExploreHotspot.phonics}</span>
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed">
                    {lang === 'vi' ? activeExploreHotspot.storyFactVi : activeExploreHotspot.storyFactEn}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      void speakTextBilingual(activeExploreHotspot.storyFactEn, 'en', voicePersona, setVoiceStatus)
                    }
                    className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    {voiceStatus === 'loading' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void speakTextBilingual(activeExploreHotspot.storyFactVi, 'vi', voicePersona, setVoiceStatus)
                    }
                    className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    VI
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Story Worlds Picker (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-[#172154]/10 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-[#172154]">
                {biText(lang, 'Choose a Story World', 'Chọn Thế Giới Truyện')}
              </h3>
              <span className="text-xs font-mono-num text-[#525E80] tabular-nums">
                {discoveredHotspots.length} / {STORY_WORLDS.length * 3} {biText(lang, 'found', 'đã mở')}
              </span>
            </div>

            <div className="space-y-3">
              {STORY_WORLDS.map((world) => {
                const selected = world.id === exploreWorldId;
                return (
                  <button
                    key={world.id}
                    type="button"
                    onClick={() => {
                      setExploreWorldId(world.id);
                      setActiveHotspotId(world.hotspots[0].id);
                      if (soundFxOn) playChimeTone(440, 0.14);
                    }}
                    className={`w-full text-left rounded-xl border overflow-hidden transition-all cursor-pointer flex items-center gap-3 p-2 ${
                      selected
                        ? 'border-[#FF6B00] bg-[#FFF5EE]'
                        : 'border-[#172154]/10 hover:border-[#172154]/25 bg-white'
                    }`}
                  >
                    <div
                      className="w-24 h-16 rounded-lg overflow-hidden shrink-0"
                      style={{ background: world.fallbackGradient }}
                    >
                      <img
                        src={world.imageSrc}
                        alt={world.nameEn}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#172154] truncate">
                        {lang === 'vi' ? world.nameVi : world.nameEn}
                      </div>
                      <div className="text-[11px] text-[#525E80] mt-0.5 truncate">
                        {lang === 'vi' ? world.subtitleVi : world.subtitleEn}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#172154]/10 space-y-2.5">
              <div className="text-xs font-semibold text-[#172154]">
                {biText(lang, 'Want to write your own brand-new story?', 'Bé muốn tự sáng tác câu chuyện của riêng mình?')}
              </div>
              <button
                type="button"
                onClick={() => setStudioMode('write')}
                className="w-full px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <PenLine className="w-4 h-4" />
                {biText(lang, 'Create My Own Story', 'Tự Viết Truyện Của Em')}
              </button>
              <button
                type="button"
                onClick={() => setStudioMode('create')}
                className="w-full px-4 py-2.5 rounded-xl bg-[#2D3E99] hover:bg-[#1E2B70] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                {biText(lang, 'Open Animation Studio', 'Mở Xưởng Hoạt Hình')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 1B: CREATE MY OWN STORY (GUIDED STORYBOOK BUILDER) */}
      {studioMode === 'write' && (
        <div className="space-y-6">
          {/* Top Author Card: Story Title, Lesson, Voice Narrator & Optional AI Co-Writer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#172154]/10 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
                    {biText(lang, 'Step 1 · Your Original Storybook', 'Bước 1 · Cuốn Truyện Của Riêng Em')}
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#172154] mt-0.5">
                    {biText(lang, 'Name Your Story & Pick Your Natural Voice', 'Đặt Tên Truyện & Chọn Giọng Kể Tự Nhiên')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleStartBlankStory}
                  className="px-3 py-1.5 rounded-lg bg-[#F2F4F8] hover:bg-[#E2E8F0] text-[#172154] text-xs font-semibold cursor-pointer"
                >
                  {biText(lang, 'Clear Draft', 'Làm mới')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="space-y-1.5 block">
                  <span className="text-xs font-bold text-[#172154]">
                    {biText(lang, 'Story Title', 'Tên Câu Chuyện')}
                  </span>
                  <input
                    type="text"
                    value={customStoryTitle}
                    onChange={(e) => setCustomStoryTitle(e.target.value)}
                    placeholder={biText(lang, 'e.g. The Dragon Who Loved Painting', 'VD: Chú Rồng Thích Vẽ Tranh')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#172154]/15 text-sm text-[#172154] focus:border-[#FF6B00] focus:outline-none"
                  />
                </label>

                <label className="space-y-1.5 block">
                  <span className="text-xs font-bold text-[#172154]">
                    {biText(lang, 'Story Lesson (Be Whole Value)', 'Bài Học Ý Nghĩa (Be Whole)')}
                  </span>
                  <input
                    type="text"
                    value={customStoryMoral}
                    onChange={(e) => setCustomStoryMoral(e.target.value)}
                    placeholder={biText(lang, 'e.g. Kindness makes every friend brave', 'VD: Lòng tốt giúp mọi người thêm dũng cảm')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#172154]/15 text-sm text-[#172154] focus:border-[#FF6B00] focus:outline-none"
                  />
                </label>
              </div>

              {/* Natural Human Voice Narrator Picker */}
              <div className="space-y-2 pt-2 border-t border-[#172154]/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#172154]">
                    {biText(lang, 'Choose Your Natural Human Storyteller Voice', 'Chọn Giọng Kể Chuyện Tự Nhiên')}
                  </span>
                  <span className="text-[11px] text-[#0D9488] font-semibold">
                    {biText(lang, 'Studio Human Voice', 'Giọng Đọc Tự Nhiên')}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NATURAL_VOICE_PERSONAS.map((vp) => {
                    const active = voicePersona === vp.id;
                    return (
                      <button
                        key={vp.id}
                        type="button"
                        onClick={() => {
                          setVoicePersona(vp.id);
                          const sampleText =
                            lang === 'vi'
                              ? 'Xin chào! Hãy cùng kể câu chuyện kỳ diệu của em nhé!'
                              : 'Hello young storyteller! Ready to bring your story to life?';
                          void speakTextBilingual(sampleText, lang === 'vi' ? 'vi' : 'en', vp.id, setVoiceStatus);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'border-[#FF6B00] bg-[#FFF5EE] ring-2 ring-[#FF6B00]/15'
                            : 'border-[#172154]/12 hover:border-[#172154]/30 bg-white'
                        }`}
                      >
                        <div className="text-xs font-bold text-[#172154] truncate">
                          {lang === 'vi' ? vp.labelVi : vp.labelEn}
                        </div>
                        <div className="text-[11px] text-[#525E80] truncate mt-0.5">
                          {lang === 'vi' ? vp.descVi : vp.descEn}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Optional Magic Co-Writer Spark Card */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#172154]/10 p-5 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="text-xs font-bold text-[#2D3E99] uppercase tracking-wider">
                  {biText(lang, 'Optional · Magic Story Co-Writer', 'Tùy Chọn · Trợ Lý Gợi Ý Cốt Truyện')}
                </div>
                <h3 className="font-display text-base font-bold text-[#172154]">
                  {biText(lang, 'Need Help Starting Your Pages?', 'Cần Gợi Ý Để Khởi Đầu Các Trang Truyện?')}
                </h3>
                <p className="text-xs text-[#525E80] leading-relaxed">
                  {biText(
                    lang,
                    'Type a short idea below and we will draft 4 starter pages that you can edit, rewrite, and make 100% your own.',
                    'Nhập một ý tưởng ngắn bên dưới để tạo sẵn 4 trang khung truyện, sau đó bé có thể tự do chỉnh sửa theo ý thích.'
                  )}
                </p>
                <textarea
                  rows={3}
                  value={customSparkIdea}
                  onChange={(e) => setCustomSparkIdea(e.target.value)}
                  placeholder={biText(
                    lang,
                    'Example: A baby sea turtle finds a glowing lantern and invites friends to a moonlit picnic...',
                    'Ví dụ: Chú rùa biển nhỏ tìm thấy chiếc đèn lồng phát sáng và mời các bạn đi dã ngoại dưới ánh trăng...'
                  )}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#172154]/15 text-sm text-[#172154] focus:border-[#2D3E99] focus:outline-none resize-none"
                />
              </div>

              <button
                type="button"
                disabled={isDraftingCustomPages || !customSparkIdea.trim()}
                onClick={() => void handleDraftCustomPagesWithAi()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#2D3E99] hover:bg-[#1E2B70] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isDraftingCustomPages ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {biText(lang, 'Drafting your 4 pages...', 'Đang phác thảo 4 trang truyện...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {biText(lang, 'Draft 4 Editable Pages for Me', 'Gợi Ý 4 Trang Truyện Cho Em')}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2: Pick Your Cast of Animated Heroes */}
          <div className="bg-white rounded-2xl border border-[#172154]/10 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
                  {biText(lang, 'Step 2 · Cast Your Heroes (Pick 1–3)', 'Bước 2 · Chọn Nhân Vật Chính (1–3 Nhân Vật)')}
                </div>
                <h3 className="font-display text-base font-bold text-[#172154] mt-0.5">
                  {biText(lang, 'Who Stars in Your Story?', 'Ai Sẽ Xuất Hiện Trong Truyện Của Em?')}
                </h3>
              </div>
              <span className="text-xs font-mono-num text-[#525E80]">
                {customCast.length} / 3 {biText(lang, 'selected', 'đã chọn')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {ACTOR_CATALOG.map((actor) => {
                const picked = customCast.some((c) => c.kind === actor.kind);
                return (
                  <button
                    key={actor.kind}
                    type="button"
                    onClick={() => handleToggleCustomCast(actor.kind)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      picked
                        ? 'border-[#FF6B00] bg-[#FFF5EE] ring-2 ring-[#FF6B00]/15'
                        : 'border-[#172154]/12 hover:border-[#172154]/30 bg-white'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full mx-auto mb-1.5 flex items-center justify-center text-white text-xs font-extrabold"
                      style={{ backgroundColor: actor.accent }}
                    >
                      {(lang === 'vi' ? actor.labelVi : actor.labelEn).slice(0, 1)}
                    </div>
                    <div className="text-xs font-bold text-[#172154] truncate">
                      {lang === 'vi' ? actor.labelVi : actor.labelEn}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Rename & Pick Motion for Chosen Heroes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#172154]/10">
              {customCast.map((member, idx) => (
                <div key={member.kind} className="p-3 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 space-y-2">
                  <div className="text-[11px] font-bold text-[#525E80]">
                    {biText(lang, `Hero #${idx + 1}`, `Nhân vật #${idx + 1}`)}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={member.customName}
                      onChange={(e) =>
                        setCustomCast((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, customName: e.target.value } : c))
                        )
                      }
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white border border-[#172154]/15 text-xs font-semibold text-[#172154]"
                      placeholder={biText(lang, 'Hero name', 'Tên nhân vật')}
                    />
                    <select
                      value={member.motion}
                      onChange={(e) =>
                        setCustomCast((prev) =>
                          prev.map((c, i) =>
                            i === idx ? { ...c, motion: e.target.value as ActorMotion } : c
                          )
                        )
                      }
                      className="px-2 py-1.5 rounded-lg bg-white border border-[#172154]/15 text-xs font-semibold text-[#172154]"
                    >
                      <option value="hop">{biText(lang, 'Hop', 'Nhảy')}</option>
                      <option value="walk">{biText(lang, 'Walk', 'Đi bộ')}</option>
                      <option value="float">{biText(lang, 'Float', 'Bay nhẹ')}</option>
                      <option value="wave">{biText(lang, 'Wave', 'Vẫy tay')}</option>
                      <option value="spin">{biText(lang, 'Twirl', 'Xoay tròn')}</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Write Your Story Pages */}
          <div className="bg-white rounded-2xl border border-[#172154]/10 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#FF6B00] uppercase tracking-wider">
                  {biText(lang, 'Step 3 · Write Your Story Scenes', 'Bước 3 · Viết Từng Trang Truyện Của Em')}
                </div>
                <h3 className="font-display text-base font-bold text-[#172154] mt-0.5">
                  {biText(lang, 'Write What Happens & Listen in a Natural Human Voice', 'Viết Diễn Biến Từng Cảnh & Nghe Thử Bằng Giọng Tự Nhiên')}
                </h3>
              </div>
              <button
                type="button"
                disabled={customPages.length >= 6}
                onClick={handleAddCustomPage}
                className="px-3.5 py-2 rounded-xl bg-[#F2F4F8] hover:bg-[#E2E8F0] disabled:opacity-50 text-[#172154] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {biText(lang, `Add Page (${customPages.length}/6)`, `Thêm Trang (${customPages.length}/6)`)}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customPages.map((pg, idx) => (
                <div key={pg.id} className="rounded-2xl border border-[#172154]/12 bg-[#FDFBF7] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#172154] flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#FF6B00]" />
                      {lang === 'vi' ? pg.stageLabelVi : pg.stageLabelEn}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const sample =
                            pg.narration.trim() ||
                            biText(lang, 'Write a sentence first to hear it read aloud!', 'Hãy viết một câu trước để nghe đọc nhé!');
                          void speakTextBilingual(sample, lang === 'vi' ? 'vi' : 'en', voicePersona, setVoiceStatus);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white border border-[#172154]/15 hover:border-[#FF6B00] text-[#172154] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3 text-[#FF6B00]" />
                        {biText(lang, 'Listen', 'Nghe thử')}
                      </button>
                      {customPages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCustomPages((prev) => prev.filter((item) => item.id !== pg.id))}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                          aria-label={biText(lang, 'Remove page', 'Xóa trang')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mini Backdrop Picker + Custom Drawing Upload */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {STORY_WORLDS.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() =>
                          setCustomPages((prev) =>
                            prev.map((item) =>
                              item.id === pg.id ? { ...item, backdrop: w.id, effect: w.defaultEffect } : item
                            )
                          )
                        }
                        className={`h-11 rounded-lg overflow-hidden border-2 cursor-pointer ${
                          pg.backdrop === w.id ? 'border-[#FF6B00]' : 'border-transparent opacity-75 hover:opacity-100'
                        }`}
                        title={lang === 'vi' ? w.nameVi : w.nameEn}
                      >
                        <img src={w.imageSrc} alt={w.nameEn} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                    <label
                      className={`h-11 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-[10px] font-bold cursor-pointer ${
                        pg.backdrop === 'custom'
                          ? 'border-[#FF6B00] bg-[#FFF5EE] text-[#FF6B00]'
                          : 'border-[#172154]/20 bg-white text-[#525E80] hover:border-[#FF6B00]'
                      }`}
                      title={biText(lang, 'Upload your own drawing', 'Tải tranh vẽ của bé')}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{biText(lang, 'Draw', 'Ảnh')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleCustomPageBackdropUpload(pg.id, e)}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <textarea
                    rows={2}
                    value={pg.narration}
                    onChange={(e) =>
                      setCustomPages((prev) =>
                        prev.map((item) => (item.id === pg.id ? { ...item, narration: e.target.value } : item))
                      )
                    }
                    placeholder={
                      idx === 0
                        ? biText(lang, 'Write how your story begins...', 'Viết phần mở đầu câu chuyện của em...')
                        : biText(lang, 'Write what happens next in this scene...', 'Viết điều gì xảy ra tiếp theo trong cảnh này...')
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#172154]/15 text-xs text-[#172154] focus:border-[#FF6B00] focus:outline-none resize-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={pg.speechLine}
                      onChange={(e) =>
                        setCustomPages((prev) =>
                          prev.map((item) => (item.id === pg.id ? { ...item, speechLine: e.target.value } : item))
                        )
                      }
                      placeholder={biText(lang, 'Hero speech bubble...', 'Lời thoại nhân vật...')}
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#172154]/15 text-xs text-[#172154]"
                    />
                    <select
                      value={pg.effect}
                      onChange={(e) =>
                        setCustomPages((prev) =>
                          prev.map((item) =>
                            item.id === pg.id ? { ...item, effect: e.target.value as EffectId } : item
                          )
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-[#172154]/15 text-xs font-semibold text-[#172154]"
                    >
                      <option value="sunbeams">{biText(lang, 'FX: Sunbeams', 'Hiệu ứng: Tia Nắng')}</option>
                      <option value="fireflies">{biText(lang, 'FX: Fireflies', 'Hiệu ứng: Đom Đóm')}</option>
                      <option value="stars">{biText(lang, 'FX: Starlight', 'Hiệu ứng: Ánh Sao')}</option>
                      <option value="bubbles">{biText(lang, 'FX: Bubbles', 'Hiệu ứng: Bong Bóng')}</option>
                      <option value="hearts">{biText(lang, 'FX: Kind Hearts', 'Hiệu ứng: Trái Tim')}</option>
                      <option value="confetti">{biText(lang, 'FX: Confetti', 'Hiệu ứng: Pháo Giấy')}</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Step 4 Launch Footer */}
            <div className="pt-4 border-t border-[#172154]/10 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#525E80]">
                {biText(
                  lang,
                  'Step 4 · Your story will automatically save to My Gallery and open on the live animation stage!',
                  'Bước 4 · Truyện sẽ tự động lưu vào Thư Viện và mở ngay trên sân khấu hoạt hình sống động!'
                )}
              </div>
              <button
                type="button"
                onClick={handleLaunchCustomStory}
                className="px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Film className="w-4 h-4" />
                {biText(lang, 'Animate & Watch My Story', 'Làm Phim & Xem Truyện Của Em')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: ANIMATION STUDIO & MOVIE MAKER */}
      {studioMode === 'create' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT 8 COLS: LIVE ANIMATION STAGE + PLAYBACK + SCENE FILMSTRIP */}
          <div className="xl:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-[#172154]/10 overflow-hidden">
              {/* Top Stage Bar */}
              <div className="px-4 py-3 border-b border-[#172154]/10 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={lang === 'vi' ? project.titleVi : project.titleEn}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProject((prev) => ({
                        ...prev,
                        titleEn: lang === 'vi' ? prev.titleEn : val,
                        titleVi: lang === 'vi' ? val : prev.titleVi,
                      }));
                    }}
                    className="w-full max-w-md font-display text-base font-bold text-[#172154] bg-transparent border-b border-transparent hover:border-[#172154]/20 focus:border-[#FF6B00] focus:outline-none py-0.5"
                    aria-label={biText(lang, 'Story title', 'Tên truyện')}
                  />
                  <div className="text-[11px] text-[#525E80]">
                    {biText(
                      lang,
                      'Drag any character on the stage to move them · Export PNG image or WEBM animated video',
                      'Kéo thả nhân vật ngay trên sân khấu để di chuyển · Xuất ảnh PNG hoặc video hoạt hình WEBM'
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartBlankStory}
                    className="px-3 py-2 rounded-lg bg-[#FFF5EE] hover:bg-[#FFEDD5] border border-[#FF6B00]/25 text-[#C2410C] text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    {biText(lang, 'New Story', 'Viết Truyện Mới')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProjectToGallery}
                    className="px-3 py-2 rounded-lg bg-[#F2F4F8] hover:bg-[#E2E8F0] text-[#172154] text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {biText(lang, 'Save', 'Lưu')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSnapshotImage}
                    disabled={isRecordingVideo}
                    className="px-3 py-2 rounded-lg bg-[#EEF2FF] hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {biText(lang, 'Save Picture', 'Lưu Ảnh')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRecordStoryVideo()}
                    disabled={isRecordingVideo}
                    className="px-3.5 py-2 rounded-lg bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                  >
                    {isRecordingVideo ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {biText(lang, `Recording ${recordingProgress}%`, `Đang quay ${recordingProgress}%`)}
                      </>
                    ) : (
                      <>
                        <Video className="w-3.5 h-3.5" />
                        {biText(lang, 'Record Video', 'Quay Video')}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 16:9 Interactive Animation Canvas */}
              <div className="relative bg-[#0F172A] aspect-video w-full">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  onPointerDown={handleCanvasPointerDown}
                  onPointerMove={handleCanvasPointerMove}
                  onPointerUp={handleCanvasPointerUp}
                  onPointerCancel={handleCanvasPointerUp}
                  className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
                />
                {isRecordingVideo && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-2 shadow-md">
                    <Video className="w-3.5 h-3.5" />
                    <span>
                      {biText(lang, `Recording Movie · ${recordingProgress}%`, `Đang quay phim · ${recordingProgress}%`)}
                    </span>
                  </div>
                )}
              </div>

              {/* Playback Controls Strip */}
              <div className="px-4 py-3 bg-[#F8F9FB] border-t border-[#172154]/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTogglePlay}
                    disabled={isRecordingVideo}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                      isPlaying
                        ? 'bg-[#172154] text-white'
                        : 'bg-[#FF6B00] hover:bg-[#E05A00] text-white'
                    }`}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isPlaying
                      ? biText(lang, 'Pause', 'Tạm dừng')
                      : biText(lang, 'Play Movie', 'Phát Phim')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveSceneIndex(0);
                      sceneStartTimeRef.current = performance.now();
                    }}
                    className="px-3 py-2 rounded-xl bg-white border border-[#172154]/15 hover:bg-[#F2F4F8] text-[#172154] text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title={biText(lang, 'Restart from Scene 1', 'Xem lại từ Cảnh 1')}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {biText(lang, 'Restart', 'Từ đầu')}
                  </button>

                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#172154] ml-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={playFullMovie}
                      onChange={(e) => setPlayFullMovie(e.target.checked)}
                      className="rounded accent-[#FF6B00]"
                    />
                    {biText(lang, 'All scenes', 'Tất cả cảnh')}
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Natural Human Voice Persona Selector */}
                  <select
                    value={voicePersona}
                    onChange={(e) => setVoicePersona(e.target.value as NaturalVoiceName)}
                    disabled={voiceMode === 'off'}
                    aria-label={biText(lang, 'Natural storyteller voice', 'Giọng kể chuyện tự nhiên')}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#172154]/15 text-[11px] font-semibold text-[#172154] disabled:opacity-45 cursor-pointer"
                  >
                    {NATURAL_VOICE_PERSONAS.map((vp) => (
                      <option key={vp.id} value={vp.id}>
                        {lang === 'vi' ? vp.labelVi : vp.labelEn}
                      </option>
                    ))}
                  </select>

                  {/* Voice Language Toggle */}
                  <div className="inline-flex items-center gap-1 bg-white p-1 rounded-lg border border-[#172154]/12 text-[11px] font-semibold">
                    {voiceStatus === 'loading' ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#FF6B00] animate-spin ml-1" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-[#525E80] ml-1" />
                    )}
                    {(['en', 'vi', 'off'] as const).map((vm) => (
                      <button
                        key={vm}
                        type="button"
                        onClick={() => {
                          if (vm === 'off') stopAllNarration();
                          setVoiceMode(vm);
                        }}
                        className={`px-2 py-1 rounded cursor-pointer uppercase ${
                          voiceMode === vm
                            ? 'bg-[#2D3E99] text-white'
                            : 'text-[#525E80] hover:text-[#172154]'
                        }`}
                      >
                        {vm === 'off' ? biText(lang, 'Mute', 'Tắt') : vm}
                      </button>
                    ))}
                  </div>

                  {/* Sound FX button */}
                  <button
                    type="button"
                    onClick={() => setSoundFxOn((prev) => !prev)}
                    className="px-2.5 py-1.5 rounded-lg bg-white border border-[#172154]/12 text-xs font-semibold text-[#172154] flex items-center gap-1 cursor-pointer"
                  >
                    {soundFxOn ? <Volume2 className="w-3.5 h-3.5 text-[#0D9488]" /> : <VolumeX className="w-3.5 h-3.5 text-[#525E80]" />}
                    {biText(lang, 'SFX', 'Âm thanh')}
                  </button>

                  {/* Scene Duration Slider (explicitly labeled with unit) */}
                  <div className="flex items-center gap-2 text-xs font-medium text-[#172154]">
                    <span className="whitespace-nowrap">
                      {biText(lang, 'Scene length:', 'Thời lượng:')} <strong className="font-mono-num tabular-nums">{activeScene.durationSec}s</strong>
                    </span>
                    <input
                      type="range"
                      min={3}
                      max={8}
                      step={1}
                      value={activeScene.durationSec}
                      onChange={(e) =>
                        updateActiveScene((sc) => ({ ...sc, durationSec: Number(e.target.value) || 5 }))
                      }
                      className="w-20 accent-[#FF6B00] cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Scene Filmstrip Timeline */}
            <div className="bg-white rounded-2xl border border-[#172154]/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-[#172154]">
                  {biText(lang, `Storyboard Timeline (${project.scenes.length} Scenes)`, `Dòng Thời Gian Phim (${project.scenes.length} Cảnh)`)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDuplicateScene}
                    className="px-3 py-1.5 rounded-lg bg-[#F2F4F8] hover:bg-[#E2E8F0] text-[#172154] text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {biText(lang, 'Duplicate', 'Nhân bản')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddScene}
                    className="px-3 py-1.5 rounded-lg bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {biText(lang, 'Add Scene', 'Thêm Cảnh')}
                  </button>
                </div>
              </div>

              <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
                {project.scenes.map((sc, idx) => {
                  const isCurrent = idx === activeSceneIndex;
                  const worldMeta = STORY_WORLDS.find((w) => w.id === sc.backdrop);
                  const thumbSrc = sc.backdrop === 'custom' ? sc.customBackdropDataUrl : worldMeta?.imageSrc;
                  return (
                    <div
                      key={sc.id}
                      onClick={() => {
                        setActiveSceneIndex(idx);
                        setSelectedActorId(sc.actors[0]?.id || null);
                        sceneStartTimeRef.current = performance.now();
                      }}
                      className={`w-40 shrink-0 rounded-xl border overflow-hidden cursor-pointer transition-all ${
                        isCurrent
                          ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/20 bg-[#FFF5EE]'
                          : 'border-[#172154]/12 hover:border-[#172154]/30 bg-white'
                      }`}
                    >
                      <div className="relative h-20 bg-[#172154]/10 overflow-hidden">
                        {thumbSrc && (
                          <img
                            src={thumbSrc}
                            alt={sc.titleEn}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#172154]/80 text-white text-[10px] font-mono-num font-bold">
                          #{idx + 1} · {sc.durationSec}s
                        </div>
                        {project.scenes.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteScene(idx);
                            }}
                            className="absolute top-1.5 right-1.5 p-1 rounded bg-black/55 hover:bg-rose-600 text-white cursor-pointer"
                            aria-label={biText(lang, 'Delete scene', 'Xóa cảnh')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-[11px] font-bold text-[#172154] truncate">
                          {lang === 'vi' ? sc.titleVi || sc.titleEn : sc.titleEn}
                        </div>
                        <div className="text-[10px] text-[#525E80] truncate">
                          {sc.actors.length} {biText(lang, 'actors', 'nhân vật')} · {sc.effect}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLS: KID-FRIENDLY DIRECTOR DECK */}
          <div className="xl:col-span-4 bg-white rounded-2xl border border-[#172154]/10 overflow-hidden">
            {/* Director Deck Tabs */}
            <div className="grid grid-cols-4 border-b border-[#172154]/10 bg-[#F8F9FB]">
              {(
                [
                  { id: 'ai', labelEn: 'AI Story', labelVi: 'Tạo Truyện' },
                  { id: 'scene', labelEn: 'Scene & FX', labelVi: 'Bối Cảnh' },
                  { id: 'actors', labelEn: 'Actors', labelVi: 'Nhân Vật' },
                  { id: 'dialogue', labelEn: 'Dialogue', labelVi: 'Lời Thoại' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDirectorTab(tab.id)}
                  className={`py-3 px-2 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                    directorTab === tab.id
                      ? 'border-[#FF6B00] text-[#FF6B00] bg-white'
                      : 'border-transparent text-[#525E80] hover:text-[#172154]'
                  }`}
                >
                  {lang === 'vi' ? tab.labelVi : tab.labelEn}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* TAB A: AI STORY GENERATOR */}
              {directorTab === 'ai' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display text-sm font-bold text-[#172154]">
                      {biText(lang, 'Turn Your Idea Into an Animated Movie', 'Biến Ý Tưởng Thành Phim Hoạt Hình')}
                    </h3>
                    <p className="text-xs text-[#525E80] mt-1">
                      {biText(
                        lang,
                        'Type any story idea in English or Vietnamese to create 4 animated scenes with characters, dialogue, and new vocabulary.',
                        'Nhập bất kỳ ý tưởng nào bằng tiếng Anh hoặc tiếng Việt để tạo ngay 4 cảnh hoạt hình kèm nhân vật, lời thoại và từ vựng mới.'
                      )}
                    </p>
                  </div>

                  <textarea
                    rows={3}
                    value={storyIdeaInput}
                    onChange={(e) => setStoryIdeaInput(e.target.value)}
                    placeholder={biText(
                      lang,
                      'Example: A friendly dragon and a mouse build a glowing lantern boat to explore the starry moon...',
                      'Ví dụ: Một chú rồng thân thiện và chuột nhắt đóng chiếc thuyền đèn lồng để bay lên mặt trăng...'
                    )}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#172154]/15 text-sm text-[#172154] focus:border-[#FF6B00] focus:outline-none"
                  />

                  <button
                    type="button"
                    disabled={isGeneratingStory || !storyIdeaInput.trim()}
                    onClick={() => void handleGenerateAiStory()}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingStory ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {biText(lang, 'Creating 4 Animated Scenes...', 'Đang tạo 4 cảnh hoạt hình...')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {biText(lang, 'Generate Animated Story', 'Tạo Phim Hoạt Hình')}
                      </>
                    )}
                  </button>

                  <div className="pt-3 border-t border-[#172154]/10 space-y-2">
                    <div className="text-xs font-semibold text-[#525E80]">
                      {biText(lang, 'Quick Story Ideas to Try:', 'Ý tưởng gợi ý nhanh:')}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        {
                          en: 'A shy sea turtle learns to sing and leads a coral reef concert',
                          vi: 'Chú rùa biển nhút nhát học hát và tổ chức đêm nhạc san hô',
                        },
                        {
                          en: 'Spark Robot and Lila rescue a lost star from the cloud treehouse',
                          vi: 'Robot Spark và bé Lila giải cứu ngôi sao đi lạc từ nhà cây trên mây',
                        },
                        {
                          en: 'Leo Lion and Milo Mouse share a picnic of Vietnamese bánh chưng',
                          vi: 'Sư tử Leo và Chuột Milo cùng đi dã ngoại thưởng thức bánh chưng',
                        },
                      ].map((idea, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={isGeneratingStory}
                          onClick={() => void handleGenerateAiStory(lang === 'vi' ? idea.vi : idea.en)}
                          className="text-left px-3 py-2 rounded-xl border border-[#172154]/12 hover:border-[#FF6B00] hover:bg-[#FFF5EE] text-xs text-[#172154] transition-colors cursor-pointer"
                        >
                          {lang === 'vi' ? idea.vi : idea.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB B: SCENE BACKDROP, CAMERA & MAGIC EFFECTS */}
              {directorTab === 'scene' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#172154]">
                      {biText(lang, 'Visual Story Backdrop', 'Bối Cảnh Truyện')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {STORY_WORLDS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => updateActiveScene((sc) => ({ ...sc, backdrop: w.id, effect: w.defaultEffect }))}
                          className={`rounded-xl overflow-hidden border text-left cursor-pointer transition-all ${
                            activeScene.backdrop === w.id
                              ? 'border-[#FF6B00] ring-2 ring-[#FF6B00]/20'
                              : 'border-[#172154]/12 hover:border-[#172154]/30'
                          }`}
                        >
                          <div className="h-16 bg-slate-200">
                            <img
                              src={w.imageSrc}
                              alt={w.nameEn}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="px-2 py-1.5 text-[11px] font-semibold text-[#172154] truncate">
                            {lang === 'vi' ? w.nameVi.split('·')[0].trim() : w.nameEn.split('·')[0].trim()}
                          </div>
                        </button>
                      ))}
                    </div>

                    <label className="mt-2 w-full px-3 py-2 rounded-xl border border-dashed border-[#2D3E99]/35 hover:border-[#FF6B00] bg-[#F8F9FB] text-xs font-semibold text-[#2D3E99] flex items-center justify-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      {biText(lang, 'Upload Your Own Drawing / Photo', 'Tải Tranh Vẽ / Ảnh Nền Của Bé')}
                      <input type="file" accept="image/*" onChange={handleCustomBackdropUpload} className="hidden" />
                    </label>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-[#172154]/10">
                    <div className="text-xs font-bold text-[#172154]">
                      {biText(lang, 'Magic Visual Effect', 'Hiệu Ứng Phép Thuật')}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'sunbeams', en: 'Sunbeams', vi: 'Tia Nắng' },
                          { id: 'fireflies', en: 'Fireflies', vi: 'Đom Đóm' },
                          { id: 'stars', en: 'Starlight', vi: 'Ánh Sao' },
                          { id: 'bubbles', en: 'Bubbles', vi: 'Bong Bóng' },
                          { id: 'hearts', en: 'Kind Hearts', vi: 'Trái Tim' },
                          { id: 'confetti', en: 'Confetti', vi: 'Pháo Giấy' },
                        ] as const
                      ).map((fx) => (
                        <button
                          key={fx.id}
                          type="button"
                          onClick={() => updateActiveScene((sc) => ({ ...sc, effect: fx.id }))}
                          className={`px-2.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            activeScene.effect === fx.id
                              ? 'bg-[#2D3E99] text-white border-[#2D3E99]'
                              : 'bg-white text-[#172154] border-[#172154]/15 hover:bg-[#F2F4F8]'
                          }`}
                        >
                          {lang === 'vi' ? fx.vi : fx.en}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-[#172154]/10">
                    <div className="text-xs font-bold text-[#172154]">
                      {biText(lang, 'Camera Motion', 'Chuyển Động Máy Quay')}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'zoom-in', en: 'Zoom In', vi: 'Phóng Gần' },
                          { id: 'pan-right', en: 'Pan Right', vi: 'Lia Phải' },
                          { id: 'pan-left', en: 'Pan Left', vi: 'Lia Trái' },
                          { id: 'gentle-float', en: 'Gentle Float', vi: 'Trôi Nhẹ' },
                        ] as const
                      ).map((cam) => (
                        <button
                          key={cam.id}
                          type="button"
                          onClick={() => updateActiveScene((sc) => ({ ...sc, camera: cam.id }))}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                            activeScene.camera === cam.id
                              ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                              : 'bg-white text-[#172154] border-[#172154]/15 hover:bg-[#F2F4F8]'
                          }`}
                        >
                          {lang === 'vi' ? cam.vi : cam.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB C: ACTORS & ANIMATIONS */}
              {directorTab === 'actors' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-[#172154]">
                      {biText(lang, 'Tap to Add Animated Actor', 'Chạm Để Thêm Nhân Vật Hoạt Hình')}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ACTOR_CATALOG.map((item) => (
                        <button
                          key={item.kind}
                          type="button"
                          onClick={() => handleAddActor(item.kind)}
                          className="px-3 py-2 rounded-lg border border-[#172154]/12 hover:border-[#FF6B00] hover:bg-[#FFF5EE] text-left text-xs font-semibold text-[#172154] flex items-center justify-between gap-2 cursor-pointer transition-colors"
                        >
                          <span className="truncate">{lang === 'vi' ? item.labelVi : item.labelEn}</span>
                          <Plus className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Active Scene Actors List */}
                  <div className="space-y-2 pt-3 border-t border-[#172154]/10">
                    <div className="text-xs font-bold text-[#172154]">
                      {biText(lang, `Actors in This Scene (${activeScene.actors.length})`, `Nhân Vật Trong Cảnh (${activeScene.actors.length})`)}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {activeScene.actors.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedActorId(a.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                            selectedActorId === a.id
                              ? 'bg-[#2D3E99] text-white border-[#2D3E99]'
                              : 'bg-[#F8F9FB] text-[#172154] border-[#172154]/15'
                          }`}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Actor Controls */}
                  {selectedActor && (
                    <div className="space-y-3 pt-3 border-t border-[#172154]/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#172154]">
                          {biText(lang, `Animate: ${selectedActor.name}`, `Chuyển động: ${selectedActor.name}`)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateActiveScene((sc) => ({
                                ...sc,
                                actors: sc.actors.map((a) =>
                                  a.id === selectedActor.id ? { ...a, flipX: !a.flipX } : a
                                ),
                              }))
                            }
                            className="px-2 py-1 rounded-lg border border-[#172154]/15 text-xs font-semibold text-[#172154] flex items-center gap-1 cursor-pointer hover:bg-[#F2F4F8]"
                          >
                            <FlipHorizontal2 className="w-3.5 h-3.5" />
                            {biText(lang, 'Flip', 'Lật')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveActor(selectedActor.id)}
                            className="px-2 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                            aria-label={biText(lang, 'Remove actor', 'Xóa nhân vật')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-1">
                        {(['hop', 'walk', 'float', 'wave', 'spin'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() =>
                              updateActiveScene((sc) => ({
                                ...sc,
                                actors: sc.actors.map((a) =>
                                  a.id === selectedActor.id ? { ...a, motion: m } : a
                                ),
                              }))
                            }
                            className={`py-1.5 rounded-lg text-[11px] font-semibold capitalize border cursor-pointer ${
                              selectedActor.motion === m
                                ? 'bg-[#FF6B00] text-white border-[#FF6B00]'
                                : 'bg-white text-[#172154] border-[#172154]/15'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-[#525E80]">
                          <span>{biText(lang, 'Character Size', 'Kích cỡ nhân vật')}</span>
                          <span className="font-mono-num tabular-nums">{Math.round(selectedActor.scale * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0.65}
                          max={1.45}
                          step={0.05}
                          value={selectedActor.scale}
                          onChange={(e) =>
                            updateActiveScene((sc) => ({
                              ...sc,
                              actors: sc.actors.map((a) =>
                                a.id === selectedActor.id ? { ...a, scale: Number(e.target.value) } : a
                              ),
                            }))
                          }
                          className="w-full accent-[#FF6B00] cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-[#172154]">
                          {biText(lang, 'Speech Bubble (English)', 'Bong bóng thoại (Tiếng Anh)')}
                        </label>
                        <input
                          type="text"
                          value={selectedActor.speechEn}
                          onChange={(e) =>
                            updateActiveScene((sc) => ({
                              ...sc,
                              actors: sc.actors.map((a) =>
                                a.id === selectedActor.id ? { ...a, speechEn: e.target.value } : a
                              ),
                            }))
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-[#172154]/15 text-xs text-[#172154]"
                        />
                        <label className="block text-xs font-semibold text-[#172154]">
                          {biText(lang, 'Speech Bubble (Vietnamese)', 'Bong bóng thoại (Tiếng Việt)')}
                        </label>
                        <input
                          type="text"
                          value={selectedActor.speechVi}
                          onChange={(e) =>
                            updateActiveScene((sc) => ({
                              ...sc,
                              actors: sc.actors.map((a) =>
                                a.id === selectedActor.id ? { ...a, speechVi: e.target.value } : a
                              ),
                            }))
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-[#172154]/15 text-xs text-[#172154]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB D: DIALOGUE & CAPTION */}
              {directorTab === 'dialogue' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#172154] mb-1">
                      {biText(lang, 'Scene Title (English)', 'Tiêu đề cảnh (Tiếng Anh)')}
                    </label>
                    <input
                      type="text"
                      value={activeScene.titleEn}
                      onChange={(e) => updateActiveScene((sc) => ({ ...sc, titleEn: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-xs text-[#172154]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172154] mb-1">
                      {biText(lang, 'Story Narration (English)', 'Lời dẫn chuyện (Tiếng Anh)')}
                    </label>
                    <textarea
                      rows={3}
                      value={activeScene.captionEn}
                      onChange={(e) => updateActiveScene((sc) => ({ ...sc, captionEn: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-xs text-[#172154]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172154] mb-1">
                      {biText(lang, 'Story Narration (Vietnamese)', 'Lời dẫn chuyện (Tiếng Việt)')}
                    </label>
                    <textarea
                      rows={3}
                      value={activeScene.captionVi}
                      onChange={(e) => updateActiveScene((sc) => ({ ...sc, captionVi: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-[#172154]/15 text-xs text-[#172154]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-[#172154] mb-1">
                        {biText(lang, 'Vocab Word (EN)', 'Từ vựng (EN)')}
                      </label>
                      <input
                        type="text"
                        value={activeScene.vocabWordEn || ''}
                        onChange={(e) => updateActiveScene((sc) => ({ ...sc, vocabWordEn: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#172154]/15 text-xs text-[#172154]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#172154] mb-1">
                        {biText(lang, 'Meaning (VI)', 'Nghĩa (VI)')}
                      </label>
                      <input
                        type="text"
                        value={activeScene.vocabWordVi || ''}
                        onChange={(e) => updateActiveScene((sc) => ({ ...sc, vocabWordVi: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg border border-[#172154]/15 text-xs text-[#172154]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: MY STORY GALLERY & EXPORTED VIDEOS / IMAGES */}
      {studioMode === 'gallery' && (
        <div className="space-y-6">
          {/* Recorded Videos & Exported Pictures */}
          <div className="bg-white rounded-2xl border border-[#172154]/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#172154]">
                {biText(lang, 'My Created Pictures & Story Videos', 'Ảnh & Video Hoạt Hình Bé Đã Tạo')}
              </h3>
              <button
                type="button"
                onClick={() => setStudioMode('create')}
                className="px-3.5 py-2 rounded-lg bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {biText(lang, '+ Create New Scene', '+ Tạo Cảnh Mới')}
              </button>
            </div>

            {exportsList.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#F8F9FB] border border-[#172154]/10 text-center space-y-2">
                <div className="text-sm font-semibold text-[#172154]">
                  {biText(lang, 'No exported pictures or videos yet', 'Chưa có ảnh hoặc video nào được xuất')}
                </div>
                <p className="text-xs text-[#525E80] max-w-md mx-auto">
                  {biText(
                    lang,
                    'Open the Animation Studio and click Save Picture (.PNG) or Record Video (.WEBM) to build your own movie reel!',
                    'Mở Xưởng Hoạt Hình và nhấn Lưu Ảnh (.PNG) hoặc Quay Video (.WEBM) để tạo bộ sưu tập phim của bé!'
                  )}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exportsList.map((item) => (
                  <div key={item.id} className="rounded-xl border border-[#172154]/10 overflow-hidden bg-[#F8F9FB]">
                    <div className="aspect-video bg-[#0F172A]">
                      {item.kind === 'video' ? (
                        <video src={item.url} controls className="w-full h-full object-contain" />
                      ) : (
                        <img
                          src={item.url}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-3.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#172154] truncate">{item.title}</div>
                        <div className="text-[11px] text-[#525E80]">
                          {item.kind === 'video' ? 'WEBM Video' : 'PNG Picture'}
                        </div>
                      </div>
                      <a
                        href={item.url}
                        download={`${item.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${item.kind === 'video' ? 'webm' : 'png'}`}
                        className="px-3 py-1.5 rounded-lg bg-[#2D3E99] hover:bg-[#1E2B70] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {biText(lang, 'Download', 'Tải về')}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved Storyboard Projects */}
          <div className="bg-white rounded-2xl border border-[#172154]/10 p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#172154]">
              {biText(lang, 'Saved Storyboard Projects', 'Dự Án Phim Đã Lưu')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedProjects.map((proj) => {
                const firstSc = proj.scenes[0];
                const worldMeta = STORY_WORLDS.find((w) => w.id === firstSc?.backdrop);
                return (
                  <div
                    key={proj.id}
                    className="rounded-xl border border-[#172154]/10 overflow-hidden bg-white flex flex-col"
                  >
                    <div className="h-32 bg-slate-100 overflow-hidden">
                      {worldMeta && (
                        <img
                          src={worldMeta.imageSrc}
                          alt={proj.titleEn}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-[#172154]">
                          {lang === 'vi' ? proj.titleVi || proj.titleEn : proj.titleEn}
                        </div>
                        <div className="text-xs text-[#525E80] mt-0.5">
                          {proj.scenes.length} {biText(lang, 'scenes', 'cảnh')} · {lang === 'vi' ? proj.moralVi : proj.moralEn}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProject(proj);
                          setActiveSceneIndex(0);
                          setStudioMode('create');
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-[#EEF2FF] hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        {biText(lang, 'Open in Studio', 'Mở Trong Xưởng')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

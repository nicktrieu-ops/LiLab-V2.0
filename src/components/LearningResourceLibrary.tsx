import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen,
  FileText,
  Download,
  Eye,
  Search,
  Sparkles,
  CheckCircle2,
  Calendar,
  GraduationCap,
  Layers,
  Award,
  Printer,
  BookmarkCheck,
  Filter,
  Volume2,
  X,
  Trash2,
  Edit3,
  Tag,
  CloudUpload,
  ShieldCheck,
  FileUp,
  Send,
  Users,
  UserCheck,
  ExternalLink,
  ClipboardCheck,
  Plus,
  Clock,
  MessageSquare
} from 'lucide-react';
import {
  CEFR_LEVELS,
  type LangCode,
  type StudentProfile,
  type GeminiNote,
  type CefrLevel,
  type UserProfile,
  type LearningResourceRecord,
  type AcademyClass,
  type ResourceSubmissionRecord,
  type ResourceSubmissionAnswerItem
} from '../types';
import { isSuperAdminEmail } from '../services/seedData';
import { storeProtectedMaterial } from '../services/aiClient';
import { db } from '../firebase';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';

export type ResourceCategory = 'pdf_handout' | 'practice_worksheet' | 'supplemental_reading';

export interface WorksheetPromptItem {
  questionEn: string;
  questionVi: string;
  options?: string[];
  answerKey: string;
}

export interface CuratedLearningResource {
  id: string;
  code: string;
  weekNumber: number;
  weekThemeEn: string;
  weekThemeVi: string;
  cefrLevel: CefrLevel;
  category: ResourceCategory;
  skillFocus: 'Speaking' | 'Reading' | 'Writing' | 'Phonics & Vocabulary' | 'Listening' | 'Be Whole Values';
  estimatedMinutes: number;
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  vocabularyFocus: string[];
  phonicsOrGrammarFocus: string;
  readingPassageEn?: string;
  readingPassageVi?: string;
  worksheetPrompts: WorksheetPromptItem[];
  parentTipEn: string;
  parentTipVi: string;
  noteId?: string;
  note?: GeminiNote;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  fileBase64?: string;
  uploadedByUid?: string;
  uploadedByEmail?: string;
  uploadedByName?: string;
  assignedScope?: 'all' | 'class' | 'student';
  assignedClassIds?: string[];
  assignedClassNames?: string[];
  assignedStudentIds?: string[];
  assignedStudentNames?: string[];
  materialLinkUrl?: string;
  isFirestoreRecord?: boolean;
}

export const CURATED_RESOURCES: CuratedLearningResource[] = [
  {
    id: 'res-w01-handout',
    code: 'BW-W01-H1',
    weekNumber: 1,
    weekThemeEn: 'All About Me & Mindful Greetings',
    weekThemeVi: 'Bản thân Em & Lời chào Chánh niệm',
    cefrLevel: 'Pre-A1 Starters',
    category: 'pdf_handout',
    skillFocus: 'Phonics & Vocabulary',
    estimatedMinutes: 15,
    titleEn: 'Week 1 Anchor Chart: Feelings, Greetings & Short Vowel /a/',
    titleVi: 'Bảng tổng hợp Tuần 1: Cảm xúc, Lời chào & Nguyên âm ngắn /a/',
    summaryEn: 'Illustrated reference handout covering polite classroom greetings, emotion check-in vocabulary, and CVC phonics families (-at, -an, -ap).',
    summaryVi: 'Tài liệu PDF minh họa tổng hợp mẫu câu chào hỏi lễ phép, từ vựng nhận diện cảm xúc và nhóm âm CVC (-at, -an, -ap).',
    vocabularyFocus: ['confident', 'curious', 'calm', 'grateful', 'respectful', 'greeting'],
    phonicsOrGrammarFocus: 'Short Vowel /a/ CVC Blending & "I feel... because..." sentence frames',
    readingPassageEn:
      'Every morning at LiLab, we pause at the classroom door, place one hand on our heart, and take a slow breath. "Good morning, Teacher! Today I feel curious and ready to learn." Naming our feelings helps our Mind, Heart, and Body work together in harmony.',
    readingPassageVi:
      'Mỗi buổi sáng tại LiLab, chúng em dừng lại trước cửa lớp, đặt một tay lên ngực và hít thở chậm rãi. "Chào buổi sáng Thầy/Cô! Hôm nay em cảm thấy tò mò và sẵn sàng học tập." Gọi tên cảm xúc giúp Tâm - Trí - Thân cùng hòa hợp.',
    worksheetPrompts: [
      {
        questionEn: 'Complete the greeting frame: "Good morning! Today I feel ______ because I am ready to read."',
        questionVi: 'Hoàn thành mẫu câu chào hỏi: "Chào buổi sáng! Hôm nay em cảm thấy ______ vì em đã sẵn sàng đọc sách."',
        options: ['curious', 'sleeping', 'yesterday', 'table'],
        answerKey: 'curious'
      },
      {
        questionEn: 'Which word belongs to the short /a/ (-at) phonics family?',
        questionVi: 'Từ nào dưới đây thuộc nhóm âm ngắn /a/ (-at)?',
        options: ['cat', 'tree', 'sun', 'boat'],
        answerKey: 'cat'
      },
      {
        questionEn: 'What are the 3 pillars of LiLab Be Whole education?',
        questionVi: '3 trụ cột giáo dưỡng toàn diện Be Whole tại LiLab là gì?',
        options: ['Mind, Heart, Body', 'Fast, Loud, Busy', 'Read, Sleep, Run', 'Pen, Book, Desk'],
        answerKey: 'Mind, Heart, Body'
      }
    ],
    parentTipEn: 'Practice the "3-Second Mindful Greeting" at the breakfast table in both English and Vietnamese.',
    parentTipVi: 'Thực hành "Lời chào Chánh niệm 3 giây" tại bàn ăn sáng bằng cả tiếng Anh và tiếng Việt.',
    assignedScope: 'all'
  },
  {
    id: 'res-w01-worksheet',
    code: 'BW-W01-W1',
    weekNumber: 1,
    weekThemeEn: 'All About Me & Mindful Greetings',
    weekThemeVi: 'Bản thân Em & Lời chào Chánh niệm',
    cefrLevel: 'A1 Movers',
    category: 'practice_worksheet',
    skillFocus: 'Writing',
    estimatedMinutes: 20,
    titleEn: 'Practice Worksheet: My Strengths & Daily Gratitude Journal',
    titleVi: 'Phiếu bài tập: Điểm mạnh của Em & Nhật ký Biết ơn Hàng ngày',
    summaryEn: 'Guided sentence-building worksheet practicing present simple tense, personal adjectives, and three daily gratitude reflections.',
    summaryVi: 'Phiếu bài tập rèn kỹ năng viết câu thì hiện tại đơn, tính từ mô tả bản thân và 3 điều biết ơn mỗi ngày.',
    vocabularyFocus: ['strength', 'kindness', 'patience', 'practice', 'improve', 'appreciate'],
    phonicsOrGrammarFocus: 'Present Simple (I am / I can / I appreciate) + descriptive adjectives',
    worksheetPrompts: [
      {
        questionEn: 'Choose the correct verb form: "My classmate always ______ kindly when we work in pairs."',
        questionVi: 'Chọn dạng động từ đúng: "Bạn cùng lớp của em luôn ______ tử tế khi chúng em làm việc theo cặp."',
        options: ['speaks', 'speak', 'speaking', 'spoke'],
        answerKey: 'speaks'
      },
      {
        questionEn: 'Which sentence expresses gratitude using complete grammar?',
        questionVi: 'Câu nào diễn đạt lòng biết ơn với ngữ pháp hoàn chỉnh?',
        options: [
          'I appreciate my parents for reading with me tonight.',
          'Appreciate parents read tonight.',
          'Me thank you book read.',
          'Yesterday appreciate tomorrow.'
        ],
        answerKey: 'I appreciate my parents for reading with me tonight.'
      },
      {
        questionEn: 'Select the best adjective: "When a puzzle is difficult, I stay ______ and try again."',
        questionVi: 'Chọn tính từ phù hợp nhất: "Khi gặp bài toán khó, em giữ sự ______ và thử lại lần nữa."',
        options: ['patient', 'noisy', 'hungry', 'Cloudy'],
        answerKey: 'patient'
      }
    ],
    parentTipEn: 'Encourage your child to read their completed sentences aloud with clear pronunciation and posture.',
    parentTipVi: 'Khuyến khích con đọc to các câu đã hoàn thành với phát âm rõ ràng và tư thế tự tin.',
    assignedScope: 'all'
  },
  {
    id: 'res-w02-reading',
    code: 'BW-W02-R1',
    weekNumber: 2,
    weekThemeEn: 'Family Tree, Heritage & Filial Respect',
    weekThemeVi: 'Cây Gia đình, Cội nguồn & Lòng Hiếu thảo',
    cefrLevel: 'A1 Movers',
    category: 'supplemental_reading',
    skillFocus: 'Reading',
    estimatedMinutes: 20,
    titleEn: 'Bilingual Story Reader: The Banyan Tree & Grandmother’s Tea',
    titleVi: 'Truyện đọc Song ngữ: Cây Đa Đầu Làng & Ấm Trà của Bà',
    summaryEn: 'Leveled bilingual short story exploring family generations, active listening to elders, and Cambridge Movers reading comprehension.',
    summaryVi: 'Truyện ngắn song ngữ phân bậc khám phá các thế hệ gia đình, kỹ năng lắng nghe ông bà và đọc hiểu chuẩn Cambridge Movers.',
    vocabularyFocus: ['generations', 'ancestors', 'heritage', 'storyteller', 'cherish', 'wisdom'],
    phonicsOrGrammarFocus: 'Past Simple regular/irregular verbs & possessive nouns (Grandmother’s)',
    readingPassageEn:
      'Every Sunday afternoon, Minh helped his grandmother set two porcelain cups on the wooden table. As warm lotus tea filled the air with a gentle aroma, Grandmother pointed to the family photo album. "A strong tree needs deep roots," she smiled. Minh listened carefully and wrote down three stories about his great-grandfather’s village school.',
    readingPassageVi:
      'Mỗi chiều Chủ nhật, Minh đều giúp bà đặt hai tách sứ lên chiếc bàn gỗ. Khi hương trà sen ấm áp lan tỏa dịu nhẹ, bà chỉ vào cuốn album ảnh gia đình. "Một cái cây vững chãi cần bộ rễ sâu bền," bà mỉm cười. Minh chăm chú lắng nghe và ghi lại ba câu chuyện về ngôi trường làng của cụ ngoại.',
    worksheetPrompts: [
      {
        questionEn: 'What metaphor does Grandmother use to describe family heritage?',
        questionVi: 'Bà đã dùng hình ảnh ẩn dụ nào để miêu tả cội nguồn gia đình?',
        options: [
          'A strong tree needs deep roots',
          'A fast river runs to the sea',
          'A tall mountain touches the clouds',
          'A bright star shines at night'
        ],
        answerKey: 'A strong tree needs deep roots'
      },
      {
        questionEn: 'How did Minh show filial respect (Lễ & Hiếu) to his grandmother?',
        questionVi: 'Minh đã thể hiện lòng hiếu kính với bà như thế nào?',
        options: [
          'He helped prepare tea and listened carefully to her stories',
          'He played video games while she talked',
          'He left the room before tea was ready',
          'He forgot to bring the photo album'
        ],
        answerKey: 'He helped prepare tea and listened carefully to her stories'
      }
    ],
    parentTipEn: 'Ask your child to interview a grandparent or elder this week and record 3 English sentences about their childhood.',
    parentTipVi: 'Hãy cùng con trò chuyện với ông bà tuần này và ghi lại 3 câu tiếng Anh về tuổi thơ của ông bà.',
    assignedScope: 'all'
  },
  {
    id: 'res-w03-handout',
    code: 'BW-W03-H1',
    weekNumber: 3,
    weekThemeEn: 'Nature Explorers & Mindful Observation',
    weekThemeVi: 'Nhà Thám hiểm Thiên nhiên & Quan sát Chánh niệm',
    cefrLevel: 'A2 Flyers',
    category: 'pdf_handout',
    skillFocus: 'Speaking',
    estimatedMinutes: 15,
    titleEn: 'Week 3 Speaking Toolkit: Describing Ecosystems & Weather Patterns',
    titleVi: 'Cẩm nang Nói Tuần 3: Miêu tả Hệ sinh thái & Thời tiết',
    summaryEn: 'Cambridge A2 Flyers speaking prompt cards, sensory observation adjectives, and cause-and-effect connectors (because, therefore, so that).',
    summaryVi: 'Thẻ gợi ý nói chuẩn Cambridge A2 Flyers, tính từ quan sát giác quan và từ nối nguyên nhân - kết quả.',
    vocabularyFocus: ['ecosystem', 'biodiversity', 'canopy', 'pollinate', 'sustainable', 'conservation'],
    phonicsOrGrammarFocus: 'Zero & First Conditional ("If we protect the forest, birds will thrive")',
    readingPassageEn:
      'When we walk quietly through a garden, we notice details that busy eyes miss: honeybees transferring golden pollen, earthworms enriching the soil, and leaves turning toward sunlight. Scientists and poets both begin with patient observation.',
    readingPassageVi:
      'Khi bước đi nhẹ nhàng qua khu vườn, chúng ta nhận ra những chi tiết mà đôi mắt vội vàng bỏ lỡ: đàn ong mật truyền phấn vàng, giun đất làm giàu dinh dưỡng cho đất và tán lá vươn về phía ánh mặt trời. Cả nhà khoa học lẫn thi sĩ đều bắt đầu từ sự quan sát kiên nhẫn.',
    worksheetPrompts: [
      {
        questionEn: 'Complete the First Conditional: "If we plant native flowers, more butterflies ______ our school garden."',
        questionVi: 'Hoàn thành câu điều kiện loại 1: "Nếu chúng ta trồng hoa bản địa, nhiều loài bướm ______ vườn trường hơn."',
        options: ['will visit', 'visited', 'visiting', 'visits yesterday'],
        answerKey: 'will visit'
      },
      {
        questionEn: 'Which word describes the variety of plant and animal life in a habitat?',
        questionVi: 'Từ nào mô tả sự đa dạng của thực vật và động vật trong một môi trường sống?',
        options: ['biodiversity', 'transportation', 'calculator', 'dictionary'],
        answerKey: 'biodiversity'
      }
    ],
    parentTipEn: 'Take a 10-minute walk outdoors and challenge your child to describe 3 natural objects using at least 2 adjectives each.',
    parentTipVi: 'Đi dạo ngoài trời 10 phút và đố con miêu tả 3 sự vật tự nhiên bằng ít nhất 2 tính từ tiếng Anh.',
    assignedScope: 'all'
  },
  {
    id: 'res-w04-worksheet',
    code: 'BW-W04-W1',
    weekNumber: 4,
    weekThemeEn: 'Emotional Intelligence & Peaceful Conflict Resolution',
    weekThemeVi: 'Trí tuệ Cảm xúc & Giải quyết Bất đồng Hòa bình',
    cefrLevel: 'A2 Flyers',
    category: 'practice_worksheet',
    skillFocus: 'Be Whole Values',
    estimatedMinutes: 25,
    titleEn: 'Practice Worksheet: "I-Messages" & Empathy Roleplay Scenarios',
    titleVi: 'Phiếu bài tập: Thông điệp "Tôi cảm thấy..." & Tình huống Thấu cảm',
    summaryEn: 'Interactive SEL + English communication worksheet teaching students how to replace blame with constructive empathy statements.',
    summaryVi: 'Phiếu bài tập kết hợp kỹ năng cảm xúc xã hội (SEL) và giao tiếp tiếng Anh giúp học sinh nói lời thấu cảm thay vì trách móc.',
    vocabularyFocus: ['empathy', 'perspective', 'compromise', 'apologize', 'solution', 'harmony'],
    phonicsOrGrammarFocus: 'Modal verbs for polite suggestion (could, would, should, let’s)',
    worksheetPrompts: [
      {
        questionEn: 'Transform into a peaceful I-Message: Instead of "You never share the markers!", say:',
        questionVi: 'Chuyển thành thông điệp hòa bình: Thay vì nói "Bạn chẳng bao giờ chia sẻ bút màu!", hãy nói:',
        options: [
          'I feel left out when I cannot color. Could we take turns using the blue marker?',
          'Give me the marker right now or I will shout!',
          'You are a bad partner!',
          'I will hide all the markers tomorrow.'
        ],
        answerKey: 'I feel left out when I cannot color. Could we take turns using the blue marker?'
      },
      {
        questionEn: 'What does "empathy" mean in our Be Whole Heart pillar?',
        questionVi: 'Từ "empathy" (thấu cảm) có nghĩa là gì trong trụ cột Tâm (Heart)?',
        options: [
          'Understanding and caring about how another person feels',
          'Winning every argument in class',
          'Speaking louder than everyone else',
          'Finishing homework without reading instructions'
        ],
        answerKey: 'Understanding and caring about how another person feels'
      }
    ],
    parentTipEn: 'Roleplay one scenario together after dinner so your child feels confident using polite modal verbs.',
    parentTipVi: 'Cùng con đóng vai một tình huống sau bữa tối để con tự tin sử dụng các động từ khuyết thiếu lịch sự.',
    assignedScope: 'all'
  },
  {
    id: 'res-w05-reading',
    code: 'BW-W05-R1',
    weekNumber: 5,
    weekThemeEn: 'Creative Storytelling & Ethical Leadership',
    weekThemeVi: 'Kể chuyện Sáng tạo & Tinh thần Lãnh đạo Nhân văn',
    cefrLevel: 'B1 Preliminary',
    category: 'supplemental_reading',
    skillFocus: 'Reading',
    estimatedMinutes: 25,
    titleEn: 'Supplemental Reading: The Lantern Maker of Hoi An & Integrity in Craft',
    titleVi: 'Đọc mở rộng: Nghệ nhân Đèn lồng Hội An & Chữ Tín trong Nghề',
    summaryEn: 'B1 Preliminary nonfiction & narrative reading pack with inference questions, discourse markers, and essay reflection prompts.',
    summaryVi: 'Bài đọc tự sự chuẩn B1 (PET) kèm câu hỏi suy luận, từ nối học thuật và đề bài viết phản tư về chữ Tín.',
    vocabularyFocus: ['integrity', 'craftsmanship', 'perseverance', 'authentic', 'dedication', 'legacy'],
    phonicsOrGrammarFocus: 'Relative clauses (who, which, whose) & narrative tenses (Past Continuous + Past Simple)',
    readingPassageEn:
      'While the evening breeze rippled across the Thu Bon River, Master Lan carefully inspected each bamboo frame before stretching silk over it. Even when tourists were in a hurry, he refused to use weak glue. "True leadership," he told his young apprentices, "means doing the right thing even when nobody is watching."',
    readingPassageVi:
      'Khi làn gió chiều lăn tăn trên dòng sông Thu Bồn, nghệ nhân Lân tỉ mỉ kiểm tra từng khung tre trước khi căng lụa. Ngay cả khi du khách vội vã, ông vẫn từ chối dùng loại keo kém chất lượng. "Tinh thần lãnh đạo đích thực," ông nhắn nhủ các học trò nhỏ, "là làm điều đúng đắn ngay cả khi không ai nhìn thấy."',
    worksheetPrompts: [
      {
        questionEn: 'Why did Master Lan refuse to use weak glue even when customers were in a hurry?',
        questionVi: 'Vì sao nghệ nhân Lân từ chối dùng keo kém chất lượng dù khách đang vội?',
        options: [
          'Because he valued integrity and lasting craftsmanship over quick profit',
          'Because he ran out of bamboo frames',
          'Because the shop was closing forever',
          'Because he wanted to paint the lanterns blue'
        ],
        answerKey: 'Because he valued integrity and lasting craftsmanship over quick profit'
      },
      {
        questionEn: 'Combine using a relative clause: "Master Lan is an artisan. His lanterns illuminate the ancient town."',
        questionVi: 'Kết hợp câu dùng mệnh đề quan hệ: "Nghệ nhân Lân là một người thợ. Những chiếc đèn lồng của ông thắp sáng phố cổ."',
        options: [
          'Master Lan is an artisan whose lanterns illuminate the ancient town.',
          'Master Lan is an artisan which lanterns illuminate the ancient town.',
          'Master Lan is an artisan where illuminates the ancient town.',
          'Master Lan whose is an artisan illuminates.'
        ],
        answerKey: 'Master Lan is an artisan whose lanterns illuminate the ancient town.'
      }
    ],
    parentTipEn: 'Discuss a real-life example of "integrity" (Chữ Tín & Chính trực) in your family or community.',
    parentTipVi: 'Trò chuyện cùng con về một tấm gương giữ chữ Tín và sự chính trực trong gia đình hoặc cộng đồng.',
    assignedScope: 'all'
  },
  {
    id: 'res-w06-handout',
    code: 'BW-W06-H1',
    weekNumber: 6,
    weekThemeEn: 'Public Speaking, Debate & Global Citizenship',
    weekThemeVi: 'Hùng biện, Tranh biện & Công dân Toàn cầu',
    cefrLevel: 'B2 First',
    category: 'pdf_handout',
    skillFocus: 'Speaking',
    estimatedMinutes: 30,
    titleEn: 'Week 6 Debate Blueprint: Structuring Persuasive Arguments (PEEL Method)',
    titleVi: 'Khung Hùng biện Tuần 6: Cấu trúc Lập luận Thuyết phục (Phương pháp PEEL)',
    summaryEn: 'Advanced B2 First handout detailing Point-Evidence-Explanation-Link (PEEL) structure, academic signposting phrases, and respectful rebuttal etiquette.',
    summaryVi: 'Tài liệu nâng cao chuẩn B2 hướng dẫn cấu trúc lập luận PEEL, cụm từ chuyển ý học thuật và văn hóa phản biện văn minh.',
    vocabularyFocus: ['substantiate', 'counterargument', 'perspective', 'consequently', 'furthermore', 'advocate'],
    phonicsOrGrammarFocus: 'Passive voice in academic discourse & concession clauses (Although / Despite / Whereas)',
    readingPassageEn:
      'A persuasive speaker does not win by speaking louder; they win by illuminating the truth with clear evidence and deep respect for their audience. Using the PEEL framework—Point, Evidence, Explanation, and Link—allows young leaders to bridge local Vietnamese heritage with global innovation.',
    readingPassageVi:
      'Người hùng biện thuyết phục không chiến thắng bằng âm lượng lớn, mà bằng việc soi sáng sự thật qua dẫn chứng rõ ràng và sự tôn trọng sâu sắc dành cho người nghe. Áp dụng khung PEEL (Luận điểm - Dẫn chứng - Giải thích - Liên kết) giúp các nhà lãnh đạo trẻ kết nối bản sắc Việt Nam với tri thức toàn cầu.',
    worksheetPrompts: [
      {
        questionEn: 'In the PEEL method, what is the role of the "Explanation" step?',
        questionVi: 'Trong phương pháp PEEL, bước "Explanation" (Giải thích) đóng vai trò gì?',
        options: [
          'To analyze how the evidence supports your main point',
          'To introduce a completely unrelated topic',
          'To apologize for speaking in front of the class',
          'To repeat the title three times'
        ],
        answerKey: 'To analyze how the evidence supports your main point'
      },
      {
        questionEn: 'Choose the best academic connector: "______ digital tools accelerate research, face-to-face mentorship remains irreplaceable."',
        questionVi: 'Chọn từ nối học thuật phù hợp nhất: "______ công cụ số giúp tăng tốc nghiên cứu, sự dìu dắt trực tiếp của người thầy vẫn không thể thay thế."',
        options: ['Although', 'Because of', 'Therefore', 'Unless'],
        answerKey: 'Although'
      }
    ],
    parentTipEn: 'Invite your child to deliver a 90-second PEEL speech at home on a topic they care about.',
    parentTipVi: 'Mời con trình bày một bài hùng biện 90 giây theo cấu trúc PEEL tại nhà về chủ đề con yêu thích.',
    assignedScope: 'all'
  }
];

function sanitizeAsciiPdfText(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function triggerPrintableHandoutDownload(resource: CuratedLearningResource, studentName?: string) {
  const pdfBase64 = resource.fileBase64;

  if (
    pdfBase64 &&
    (resource.mimeType?.includes('pdf') ||
      pdfBase64.startsWith('data:application/pdf') ||
      pdfBase64.startsWith('JVBERi'))
  ) {
    try {
      const cleanBase64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
      const binaryString = window.atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resource.fileName?.endsWith('.pdf')
        ? resource.fileName
        : `LiLab_${resource.code}_${resource.titleEn.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 28)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return;
    } catch (e) {
      console.warn('Fallback to generated A4 handout PDF:', e);
    }
  }

  const lines: string[] = [
    `LILAB CREATIVE TALENT ACADEMY - LEARNING RESOURCE LIBRARY`,
    `Resource Code: ${resource.code} | Week ${resource.weekNumber} | Level: ${resource.cefrLevel}`,
    `Category: ${resource.category.replace('_', ' ').toUpperCase()} | Skill Focus: ${resource.skillFocus}`,
    studentName ? `Prepared for Student: ${studentName}` : `Bilingual English & Values Curriculum`,
    `--------------------------------------------------------------------------------`,
    `TITLE (EN): ${resource.titleEn}`,
    `TITLE (VI): ${resource.titleVi}`,
    `THEME: ${resource.weekThemeEn} / ${resource.weekThemeVi}`,
    `--------------------------------------------------------------------------------`,
    `SUMMARY (EN): ${resource.summaryEn}`,
    `SUMMARY (VI): ${resource.summaryVi}`,
    ``,
    `KEY VOCABULARY: ${resource.vocabularyFocus.join(', ')}`,
    `GRAMMAR / PHONICS FOCUS: ${resource.phonicsOrGrammarFocus}`,
    ``
  ];

  if (resource.readingPassageEn) {
    lines.push(`READING PASSAGE (EN):`);
    const wordsEn = resource.readingPassageEn.split(' ');
    let curLine = '';
    for (const w of wordsEn) {
      if ((curLine + ' ' + w).length > 82) {
        lines.push(`  ${curLine.trim()}`);
        curLine = w;
      } else {
        curLine += ' ' + w;
      }
    }
    if (curLine.trim()) lines.push(`  ${curLine.trim()}`);
    lines.push(``);
  }

  if (resource.readingPassageVi) {
    lines.push(`READING PASSAGE (VI):`);
    const wordsVi = resource.readingPassageVi.split(' ');
    let curLine = '';
    for (const w of wordsVi) {
      if ((curLine + ' ' + w).length > 82) {
        lines.push(`  ${curLine.trim()}`);
        curLine = w;
      } else {
        curLine += ' ' + w;
      }
    }
    if (curLine.trim()) lines.push(`  ${curLine.trim()}`);
    lines.push(``);
  }

  lines.push(`PRACTICE WORKSHEET EXERCISES:`);
  resource.worksheetPrompts.forEach((p, idx) => {
    lines.push(`${idx + 1}. ${p.questionEn}`);
    lines.push(`   (${p.questionVi})`);
    if (p.options && p.options.length > 0) {
      p.options.forEach((opt, oIdx) => {
        lines.push(`     [${String.fromCharCode(65 + oIdx)}] ${opt}`);
      });
    } else {
      lines.push(`     Answer: ______________________________________________________`);
    }
    lines.push(``);
  });

  lines.push(`--------------------------------------------------------------------------------`);
  lines.push(`HOME PRACTICE TIP (EN): ${resource.parentTipEn}`);
  lines.push(`HOME PRACTICE TIP (VI): ${resource.parentTipVi}`);
  lines.push(`Answer Key: ${resource.worksheetPrompts.map((p, i) => `Q${i + 1}: ${p.answerKey}`).join(' | ')}`);

  const textOps = lines
    .slice(0, 48)
    .map((rawLine, idx) => {
      const safe = sanitizeAsciiPdfText(rawLine).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      const y = 790 - idx * 15;
      const font =
        idx === 0 || idx === 5 || rawLine.startsWith('PRACTICE') || rawLine.startsWith('READING')
          ? '/F2 10 Tf'
          : '/F1 9.5 Tf';
      return `BT ${font} 42 ${y} Td (${safe}) Tj ET`;
    })
    .join('\n');

  const streamContent = `0.15 0.14 0.35 rg\n42 805 511 2 re f\n0.1 0.1 0.15 rg\n${textOps}\n`;
  const objects: string[] = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`
  );
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  objects.push(`5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);
  objects.push(`6 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}endstream\nendobj\n`);

  let pdf = `%PDF-1.4\n`;
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `LiLab_${resource.code}_${resource.titleEn.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 28)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

interface LearningResourceLibraryProps {
  lang: LangCode;
  student?: StudentProfile | null;
  geminiNotes?: GeminiNote[];
  currentUser?: UserProfile | null;
  classes?: AcademyClass[];
  students?: StudentProfile[];
  portalRole?: 'admin' | 'teacher' | 'parent' | 'student';
  onOpenReadOnlyNote?: (resource: {
    noteId: string;
    note?: GeminiNote;
    fallbackTitle?: string;
  }) => void;
}

export const LearningResourceLibrary: React.FC<LearningResourceLibraryProps> = ({
  lang,
  student,
  geminiNotes = [],
  currentUser,
  classes: propClasses,
  students: propStudents,
  portalRole,
  onOpenReadOnlyNote
}) => {
  const [organizationMode, setOrganizationMode] = useState<'week' | 'level'>('week');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ResourceCategory>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<number | 'all'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned_only'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeResource, setActiveResource] = useState<CuratedLearningResource | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [studentSubmissionNotes, setStudentSubmissionNotes] = useState<string>('');
  const [isSubmittingExercise, setIsSubmittingExercise] = useState(false);
  const [completedResourceIds, setCompletedResourceIds] = useState<string[]>(['res-w01-handout']);

  // Firestore real-time uploaded resources & student exercise submissions
  const [firestoreResources, setFirestoreResources] = useState<LearningResourceRecord[]>([]);
  const [submissions, setSubmissions] = useState<ResourceSubmissionRecord[]>([]);
  const [localClasses, setLocalClasses] = useState<AcademyClass[]>([]);
  const [localStudents, setLocalStudents] = useState<StudentProfile[]>([]);
  const [deletedBaselineIds, setDeletedBaselineIds] = useState<string[]>([]);
  const autoSeededRef = useRef(false);

  const effectiveClasses = propClasses && propClasses.length > 0 ? propClasses : localClasses;
  const effectiveStudents = propStudents && propStudents.length > 0 ? propStudents : localStudents;

  // Determine role capabilities
  const canManageResources = Boolean(
    currentUser &&
      (portalRole === 'admin' ||
        portalRole === 'teacher' ||
        (portalRole !== 'parent' &&
          portalRole !== 'student' &&
          (currentUser.role === 'super_admin' ||
            currentUser.role === 'admin' ||
            currentUser.role === 'teacher' ||
            isSuperAdminEmail(currentUser.email))))
  );

  const isStudentOrParentMode = !canManageResources || portalRole === 'parent' || portalRole === 'student';

  const [showUploadStudio, setShowUploadStudio] = useState(false);
  const [showGradingInbox, setShowGradingInbox] = useState(canManageResources);
  const [gradingFilterStatus, setGradingFilterStatus] = useState<'all' | 'submitted' | 'graded'>('all');
  const [activeGradingSubmission, setActiveGradingSubmission] = useState<ResourceSubmissionRecord | null>(null);
  const [gradeScoreInput, setGradeScoreInput] = useState<number>(92);
  const [teacherFeedbackEnInput, setTeacherFeedbackEnInput] = useState<string>('');
  const [teacherFeedbackViInput, setTeacherFeedbackViInput] = useState<string>('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form fields for Admin/Teacher Upload, Assignment & Exercise Builder
  const [formCode, setFormCode] = useState('BW-W01-U1');
  const [formWeekNumber, setFormWeekNumber] = useState<number>(1);
  const [formWeekThemeEn, setFormWeekThemeEn] = useState('Mindful Communication & Phonics Foundations');
  const [formWeekThemeVi, setFormWeekThemeVi] = useState('Giao tiếp Chánh niệm & Nền tảng Ngữ âm');
  const [formCefrLevel, setFormCefrLevel] = useState<CefrLevel>(student?.cefrLevel || 'A1 Movers');
  const [formCategory, setFormCategory] = useState<ResourceCategory>('pdf_handout');
  const [formSkillFocus, setFormSkillFocus] = useState<CuratedLearningResource['skillFocus']>('Reading');
  const [formEstimatedMinutes, setFormEstimatedMinutes] = useState<number>(20);
  const [formTitleEn, setFormTitleEn] = useState('');
  const [formTitleVi, setFormTitleVi] = useState('');
  const [formSummaryEn, setFormSummaryEn] = useState('');
  const [formSummaryVi, setFormSummaryVi] = useState('');
  const [formVocabularyInput, setFormVocabularyInput] = useState('mindful, heritage, eloquent, perseverance');
  const [formGrammarFocus, setFormGrammarFocus] = useState('Sentence Framing & Academic Vocabulary');
  const [formReadingPassageEn, setFormReadingPassageEn] = useState('');
  const [formReadingPassageVi, setFormReadingPassageVi] = useState('');
  const [formMaterialLinkUrl, setFormMaterialLinkUrl] = useState('');
  const [formAssignedScope, setFormAssignedScope] = useState<'all' | 'class' | 'student'>('all');
  const [formAssignedClassIds, setFormAssignedClassIds] = useState<string[]>([]);
  const [formAssignedStudentIds, setFormAssignedStudentIds] = useState<string[]>([]);
  const [formPrompts, setFormPrompts] = useState<WorksheetPromptItem[]>([
    {
      questionEn: 'Complete the key sentence or concept from today’s class material:',
      questionVi: 'Hoàn thành câu hoặc khái niệm trọng tâm từ học liệu hôm nay:',
      options: ['Completed mindfully with examples', 'Need teacher review', 'Practiced vocabulary aloud', 'In progress'],
      answerKey: 'Completed mindfully with examples'
    }
  ]);
  const [formFileName, setFormFileName] = useState<string>('');
  const [formMimeType, setFormMimeType] = useState<string>('application/pdf');
  const [formFileSizeBytes, setFormFileSizeBytes] = useState<number>(0);
  const [formFileBase64, setFormFileBase64] = useState<string>('');

  // Subscribe to Firestore `learning_resources` and `resource_submissions`
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    const qRes = query(collection(db, 'learning_resources'), orderBy('createdAt', 'desc'));
    unsubs.push(
      onSnapshot(
        qRes,
        (snap) => {
          const docs: LearningResourceRecord[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as Omit<LearningResourceRecord, 'id'>;
            docs.push({
              ...data,
              id: docSnap.id
            });
          });
          setFirestoreResources(docs);
        },
        (err) => {
          console.warn('LearningResourceLibrary Firestore listener error:', err);
        }
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'resource_submissions'),
        (snap) => {
          const list: ResourceSubmissionRecord[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as Omit<ResourceSubmissionRecord, 'id'>;
            list.push({
              ...data,
              id: docSnap.id
            });
          });
          list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
          setSubmissions(list);
        },
        (err) => {
          console.warn('resource_submissions listener error:', err);
        }
      )
    );

    if (!propClasses || propClasses.length === 0) {
      unsubs.push(
        onSnapshot(
          collection(db, 'classes'),
          (snap) => {
            setLocalClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AcademyClass)));
          },
          () => {}
        )
      );
    }

    if (!propStudents || propStudents.length === 0) {
      unsubs.push(
        onSnapshot(
          collection(db, 'students'),
          (snap) => {
            setLocalStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentProfile)));
          },
          () => {}
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [propClasses?.length, propStudents?.length]);

  // Automatically sync curated baseline exercises & materials into Firestore + SQL when Admin/Teacher opens the library
  useEffect(() => {
    if (!canManageResources || !currentUser || autoSeededRef.current) return;
    if (firestoreResources.length > 0) {
      autoSeededRef.current = true;
      return;
    }
    const timer = setTimeout(async () => {
      if (autoSeededRef.current || firestoreResources.length > 0) return;
      autoSeededRef.current = true;
      try {
        for (const item of CURATED_RESOURCES) {
          const payload = {
            code: item.code,
            weekNumber: item.weekNumber,
            weekThemeEn: item.weekThemeEn,
            weekThemeVi: item.weekThemeVi,
            cefrLevel: item.cefrLevel,
            category: item.category,
            skillFocus: item.skillFocus,
            estimatedMinutes: item.estimatedMinutes,
            titleEn: item.titleEn,
            titleVi: item.titleVi,
            summaryEn: item.summaryEn,
            summaryVi: item.summaryVi,
            keyVocabulary: item.vocabularyFocus,
            phonicsOrGrammar: item.phonicsOrGrammarFocus,
            ...(item.readingPassageEn ? { readingPassageEn: item.readingPassageEn } : {}),
            ...(item.readingPassageVi ? { readingPassageVi: item.readingPassageVi } : {}),
            assignedScope: 'all' as const,
            assignedClassIds: [],
            assignedClassNames: [],
            assignedStudentIds: [],
            assignedStudentNames: [],
            worksheetPromptsJson: JSON.stringify(item.worksheetPrompts),
            uploadedByUid: currentUser.uid,
            uploadedByEmail: currentUser.email.slice(0, 160),
            uploadedByName: (currentUser.displayName || currentUser.email).slice(0, 120)
          };
          await setDoc(doc(db, 'learning_resources', item.id), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (e) {
        console.warn('Auto-seed baseline learning resources skipped:', e);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [canManageResources, currentUser, firestoreResources.length]);

  const flashBanner = (msg: string) => {
    setUploadStatusMsg(msg);
    setTimeout(() => {
      setUploadStatusMsg((prev) => (prev === msg ? null : prev));
    }, 5500);
  };

  const resetUploadForm = () => {
    const nextNum = firestoreResources.length + 1;
    setEditingResourceId(null);
    setFormCode(`BW-W${String(formWeekNumber).padStart(2, '0')}-U${nextNum}`);
    setFormTitleEn('');
    setFormTitleVi('');
    setFormSummaryEn('');
    setFormSummaryVi('');
    setFormReadingPassageEn('');
    setFormReadingPassageVi('');
    setFormMaterialLinkUrl('');
    setFormAssignedScope('all');
    setFormAssignedClassIds([]);
    setFormAssignedStudentIds([]);
    setFormPrompts([
      {
        questionEn: 'Complete the key sentence or concept from today’s class material:',
        questionVi: 'Hoàn thành câu hoặc khái niệm trọng tâm từ học liệu hôm nay:',
        options: ['Completed mindfully with examples', 'Need teacher review', 'Practiced vocabulary aloud', 'In progress'],
        answerKey: 'Completed mindfully with examples'
      }
    ]);
    setFormFileName('');
    setFormMimeType('application/pdf');
    setFormFileSizeBytes(0);
    setFormFileBase64('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectEditResource = (res: CuratedLearningResource) => {
    setEditingResourceId(res.id);
    setFormCode(res.code);
    setFormWeekNumber(res.weekNumber);
    setFormWeekThemeEn(res.weekThemeEn);
    setFormWeekThemeVi(res.weekThemeVi);
    setFormCefrLevel(res.cefrLevel);
    setFormCategory(res.category);
    setFormSkillFocus(res.skillFocus);
    setFormEstimatedMinutes(res.estimatedMinutes);
    setFormTitleEn(res.titleEn);
    setFormTitleVi(res.titleVi);
    setFormSummaryEn(res.summaryEn);
    setFormSummaryVi(res.summaryVi);
    setFormVocabularyInput(res.vocabularyFocus.join(', '));
    setFormGrammarFocus(res.phonicsOrGrammarFocus);
    setFormReadingPassageEn(res.readingPassageEn || '');
    setFormReadingPassageVi(res.readingPassageVi || '');
    setFormMaterialLinkUrl(res.materialLinkUrl || '');
    setFormAssignedScope(res.assignedScope || 'all');
    setFormAssignedClassIds(res.assignedClassIds || []);
    setFormAssignedStudentIds(res.assignedStudentIds || []);
    setFormPrompts(
      res.worksheetPrompts && res.worksheetPrompts.length > 0
        ? res.worksheetPrompts
        : [
            {
              questionEn: 'Complete the key sentence or concept from today’s class material:',
              questionVi: 'Hoàn thành câu hoặc khái niệm trọng tâm từ học liệu hôm nay:',
              options: ['Completed mindfully with examples', 'Need teacher review', 'Practiced vocabulary aloud', 'In progress'],
              answerKey: 'Completed mindfully with examples'
            }
          ]
    );
    setFormFileName(res.fileName || '');
    setFormMimeType(res.mimeType || 'application/pdf');
    setFormFileSizeBytes(res.fileSizeBytes || 0);
    setFormFileBase64(res.fileBase64 || '');
    setShowUploadStudio(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormFileName(file.name);
    setFormMimeType(file.type || 'application/pdf');
    setFormFileSizeBytes(file.size);

    const baseTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
    if (!formTitleEn.trim()) {
      setFormTitleEn(baseTitle);
    }
    if (!formTitleVi.trim()) {
      setFormTitleVi(`Học liệu: ${baseTitle}`);
    }
    if (!formSummaryEn.trim()) {
      setFormSummaryEn(
        `Class ${formCategory.replace('_', ' ')} (${file.name}) tagged for Week ${formWeekNumber} (${formCefrLevel}).`
      );
    }
    if (!formSummaryVi.trim()) {
      setFormSummaryVi(
        `Tài liệu học tập (${file.name}) dành cho Tuần ${formWeekNumber} - Cấp độ ${formCefrLevel}.`
      );
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormFileBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveResourceToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageResources || !currentUser) return;

    if (!formTitleEn.trim()) {
      flashBanner(
        lang === 'vi'
          ? 'Vui lòng nhập tiêu đề học liệu hoặc chọn tệp PDF!'
          : 'Please enter a resource title or select a PDF file!'
      );
      return;
    }

    setIsUploading(true);
    try {
      const resourceId = editingResourceId || `res_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const vocabList = formVocabularyInput
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 30);

      let storedInSql = false;
      if (formFileBase64) {
        try {
          await storeProtectedMaterial({
            noteId: resourceId,
            fileName: formFileName || `${formCode.trim() || resourceId}.pdf`,
            mimeType: formMimeType || 'application/pdf',
            contentBase64: formFileBase64
          });
          storedInSql = true;
        } catch (err) {
          console.warn('Protected material SQL store fallback to compact Firestore payload:', err);
        }
      }

      // Only inline small files (<350 KB) into Firestore if Cloud SQL storage did not persist them
      const inlineInFirestore = !storedInSql && Boolean(formFileBase64 && formFileBase64.length <= 350000);

      const selectedClasses = effectiveClasses.filter((c) => formAssignedClassIds.includes(c.id));
      const selectedStudents = effectiveStudents.filter((s) => formAssignedStudentIds.includes(s.id));

      const cleanPrompts = formPrompts
        .filter((p) => p.questionEn.trim() || p.questionVi.trim())
        .map((p) => ({
          questionEn: p.questionEn.trim() || p.questionVi.trim(),
          questionVi: p.questionVi.trim() || p.questionEn.trim(),
          options: (p.options || []).map((o) => o.trim()).filter(Boolean),
          answerKey: p.answerKey.trim() || (p.options?.[0]?.trim() ?? '')
        }));

      const baseFields = {
        code: (formCode.trim() || `BW-W${String(formWeekNumber).padStart(2, '0')}-PDF`).slice(0, 40),
        weekNumber: Math.min(52, Math.max(1, Number(formWeekNumber) || 1)),
        weekThemeEn: (formWeekThemeEn.trim() || `Week ${formWeekNumber} Curriculum`).slice(0, 160),
        weekThemeVi: (formWeekThemeVi.trim() || `Chương trình Tuần ${formWeekNumber}`).slice(0, 160),
        cefrLevel: formCefrLevel,
        category: formCategory,
        skillFocus: formSkillFocus,
        estimatedMinutes: Math.min(180, Math.max(1, Number(formEstimatedMinutes) || 20)),
        titleEn: formTitleEn.trim().slice(0, 160),
        titleVi: (formTitleVi.trim() || formTitleEn.trim()).slice(0, 160),
        summaryEn: (
          formSummaryEn.trim() ||
          `Curated ${formCategory.replace('_', ' ')} for Week ${formWeekNumber} (${formCefrLevel}).`
        ).slice(0, 1500),
        summaryVi: (
          formSummaryVi.trim() ||
          formSummaryEn.trim() ||
          `Học liệu ${formCategory.replace('_', ' ')} cho Tuần ${formWeekNumber} (${formCefrLevel}).`
        ).slice(0, 1500),
        keyVocabulary: vocabList.length > 0 ? vocabList : ['vocabulary', 'fluency', 'mindfulness'],
        phonicsOrGrammar: (formGrammarFocus.trim() || `${formSkillFocus} & CEFR ${formCefrLevel} Mastery`).slice(
          0,
          500
        ),
        assignedScope: formAssignedScope,
        assignedClassIds: formAssignedScope === 'class' ? selectedClasses.map((c) => c.id).slice(0, 30) : [],
        assignedClassNames: formAssignedScope === 'class' ? selectedClasses.map((c) => c.name).slice(0, 30) : [],
        assignedStudentIds: formAssignedScope === 'student' ? selectedStudents.map((s) => s.id).slice(0, 50) : [],
        assignedStudentNames:
          formAssignedScope === 'student' ? selectedStudents.map((s) => s.fullName).slice(0, 50) : [],
        ...(formMaterialLinkUrl.trim() ? { materialLinkUrl: formMaterialLinkUrl.trim().slice(0, 500) } : {}),
        ...(cleanPrompts.length > 0 ? { worksheetPromptsJson: JSON.stringify(cleanPrompts).slice(0, 8000) } : {}),
        ...(formReadingPassageEn.trim() ? { readingPassageEn: formReadingPassageEn.trim().slice(0, 3000) } : {}),
        ...(formReadingPassageVi.trim() ? { readingPassageVi: formReadingPassageVi.trim().slice(0, 3000) } : {}),
        ...(formFileName ? { fileName: formFileName.slice(0, 200) } : {}),
        ...(formMimeType ? { mimeType: formMimeType.slice(0, 100) } : {}),
        ...(formFileSizeBytes ? { fileSizeBytes: Number(formFileSizeBytes) } : {}),
        ...(inlineInFirestore ? { fileBase64: formFileBase64 } : {})
      };

      const existsInFirestore = firestoreResources.some((r) => r.id === resourceId);

      if (editingResourceId && existsInFirestore) {
        await updateDoc(doc(db, 'learning_resources', editingResourceId), {
          ...baseFields,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, 'learning_resources', resourceId), {
          ...baseFields,
          uploadedByUid: currentUser.uid,
          uploadedByEmail: currentUser.email.slice(0, 160),
          uploadedByName: (currentUser.displayName || currentUser.email).slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      flashBanner(
        editingResourceId
          ? lang === 'vi'
            ? `Đã lưu cập nhật học liệu & phân công "${baseFields.titleVi}" vào Cơ sở dữ liệu!`
            : `Updated resource & class/student assignment for "${baseFields.titleEn}" in database!`
          : lang === 'vi'
            ? `Đã tải lên & giao học liệu "${baseFields.titleVi}" thành công!`
            : `Uploaded & assigned "${baseFields.titleEn}" to database!`
      );
      resetUploadForm();
      setShowUploadStudio(false);
    } catch (err: any) {
      console.error('Failed to save learning resource to Firestore:', err);
      flashBanner(
        lang === 'vi'
          ? `Lỗi khi lưu học liệu: ${err?.message || 'Vui lòng thử lại'}`
          : `Failed to save resource: ${err?.message || 'Please try again'}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFirestoreResource = async (res: CuratedLearningResource) => {
    if (!canManageResources) return;
    try {
      if (res.isFirestoreRecord) {
        await deleteDoc(doc(db, 'learning_resources', res.id));
      }
      setDeletedBaselineIds((prev) => Array.from(new Set([...prev, res.id])));
      if (activeResource?.id === res.id) {
        setActiveResource(null);
      }
      flashBanner(
        lang === 'vi'
          ? `Đã xóa học liệu "${res.titleVi}" khỏi Thư viện & Cơ sở dữ liệu.`
          : `Deleted resource "${res.titleEn}" from the Resource Library database.`
      );
    } catch (err: any) {
      console.error('Failed to delete learning resource:', err);
    }
  };

  // Student submits exercise to their assigned teacher
  const handleSubmitExerciseToTeacher = async (res: CuratedLearningResource) => {
    if (!currentUser) return;

    const targetStudent: StudentProfile | null =
      student ||
      effectiveStudents.find(
        (s) =>
          (s.studentEmail || '').toLowerCase() === currentUser.email.toLowerCase() ||
          (s.parentEmail || '').toLowerCase() === currentUser.email.toLowerCase()
      ) ||
      effectiveStudents[0] ||
      null;

    const studentId = targetStudent?.id || `stu_${currentUser.uid.slice(0, 8)}`;
    const studentName = targetStudent?.fullName || currentUser.displayName || currentUser.email.split('@')[0];
    const studentEmail = (targetStudent?.studentEmail || currentUser.email || '').toLowerCase();
    const parentEmail = (targetStudent?.parentEmail || currentUser.email || '').toLowerCase();

    // Determine the student's class & assigned teacher
    const enrolledClass =
      effectiveClasses.find(
        (c) =>
          targetStudent?.enrolledClassIds?.includes(c.id) ||
          (c.studentIds && targetStudent && c.studentIds.includes(targetStudent.id)) ||
          (res.assignedClassIds && res.assignedClassIds.includes(c.id))
      ) || effectiveClasses[0];

    const classId = enrolledClass?.id || res.assignedClassIds?.[0] || 'cls_be_whole_w01';
    const className = enrolledClass?.name || res.assignedClassNames?.[0] || 'Be Whole Class';
    const teacherEmail = (
      enrolledClass?.teacherEmail ||
      targetStudent?.assignedTeacherEmails?.[0] ||
      res.uploadedByEmail ||
      'teacher@lilab.edu.vn'
    ).toLowerCase();
    const teacherName = enrolledClass?.teacherName || res.uploadedByName || 'LiLab Assigned Teacher';

    const answerItems: ResourceSubmissionAnswerItem[] = res.worksheetPrompts.map((p, idx) => {
      const key = `${res.id}-q${idx}`;
      const selectedAnswer = selectedAnswers[key] || '';
      const isCorrect = selectedAnswer === p.answerKey;
      return {
        questionIndex: idx,
        questionEn: p.questionEn,
        questionVi: p.questionVi,
        selectedAnswer,
        answerKey: p.answerKey,
        isCorrect
      };
    });

    const answeredCount = answerItems.filter((a) => a.selectedAnswer.trim().length > 0).length;
    if (answeredCount === 0 && res.worksheetPrompts.length > 0) {
      flashBanner(
        lang === 'vi'
          ? 'Vui lòng chọn câu trả lời cho bài tập trước khi nộp cho Giáo viên!'
          : 'Please select answers for the exercise questions before submitting to your teacher!'
      );
      return;
    }

    const correctCount = answerItems.filter((a) => a.isCorrect).length;
    const autoScorePercent =
      res.worksheetPrompts.length > 0 ? Math.round((correctCount / res.worksheetPrompts.length) * 100) : 100;

    setIsSubmittingExercise(true);
    try {
      const subId = `sub_${res.id}_${studentId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 90);
      const existingSub = submissions.find((s) => s.id === subId);
      const nowIso = new Date().toISOString();

      const basePayload = {
        resourceId: res.id.slice(0, 120),
        resourceCode: res.code.slice(0, 40),
        resourceTitleEn: res.titleEn.slice(0, 160),
        resourceTitleVi: (res.titleVi || res.titleEn).slice(0, 160),
        weekNumber: Math.min(52, Math.max(1, Number(res.weekNumber) || 1)),
        cefrLevel: res.cefrLevel,
        studentId: studentId.slice(0, 120),
        studentName: studentName.slice(0, 120),
        studentEmail: studentEmail.slice(0, 160),
        parentEmail: parentEmail.slice(0, 160),
        classId: classId.slice(0, 120),
        className: className.slice(0, 120),
        teacherEmail: teacherEmail.slice(0, 160),
        teacherName: teacherName.slice(0, 120),
        answersJson: JSON.stringify(answerItems).slice(0, 8000),
        studentNotes: studentSubmissionNotes.trim().slice(0, 1500),
        autoScorePercent,
        status: 'submitted' as const,
        submittedAt: nowIso
      };

      if (existingSub) {
        await updateDoc(doc(db, 'resource_submissions', subId), {
          ...basePayload,
          updatedAt: serverTimestamp()
        });
      } else {
        await setDoc(doc(db, 'resource_submissions', subId), {
          ...basePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      if (!completedResourceIds.includes(res.id)) {
        setCompletedResourceIds((prev) => [...prev, res.id]);
      }

      flashBanner(
        lang === 'vi'
          ? `Đã nộp bài tập "${res.titleVi}" tới Giáo viên ${teacherName} (${teacherEmail}) để chấm điểm!`
          : `Submitted exercise "${res.titleEn}" to Teacher ${teacherName} (${teacherEmail}) for grading!`
      );
    } catch (err: any) {
      console.error('Failed to submit exercise to teacher:', err);
      flashBanner(
        lang === 'vi'
          ? `Lỗi khi nộp bài tập: ${err?.message || 'Vui lòng thử lại'}`
          : `Failed to submit exercise: ${err?.message || 'Please try again'}`
      );
    } finally {
      setIsSubmittingExercise(false);
    }
  };

  // Teacher / Admin grades a student submission and sends it back to the student
  const handleTeacherGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGradingSubmission || !canManageResources || !currentUser) return;

    setIsSavingGrade(true);
    try {
      const nowIso = new Date().toISOString();
      const cleanScore = Math.min(100, Math.max(0, Math.round(Number(gradeScoreInput) || 0)));
      const cleanFbEn =
        teacherFeedbackEnInput.trim() ||
        `Great effort on ${activeGradingSubmission.resourceTitleEn}! Reviewed and graded by ${currentUser.displayName || currentUser.email}.`;
      const cleanFbVi =
        teacherFeedbackViInput.trim() ||
        `Cô/Thầy đánh giá cao nỗ lực của con trong bài "${activeGradingSubmission.resourceTitleVi}"!`;

      const updates = {
        status: 'graded' as const,
        gradeScore: cleanScore,
        teacherFeedbackEn: cleanFbEn.slice(0, 2000),
        teacherFeedbackVi: cleanFbVi.slice(0, 2000),
        gradedByEmail: currentUser.email.slice(0, 160),
        gradedByName: (currentUser.displayName || currentUser.email).slice(0, 120),
        gradedAt: nowIso
      };

      await updateDoc(doc(db, 'resource_submissions', activeGradingSubmission.id), {
        ...updates,
        updatedAt: serverTimestamp()
      });

      flashBanner(
        lang === 'vi'
          ? `Đã chấm điểm (${cleanScore}/100) và trả bài cho học viên ${activeGradingSubmission.studentName}!`
          : `Graded (${cleanScore}/100) and returned assignment to student ${activeGradingSubmission.studentName}!`
      );
      setActiveGradingSubmission(null);
    } catch (err: any) {
      console.error('Failed to grade submission:', err);
      flashBanner(
        lang === 'vi'
          ? `Lỗi khi lưu điểm chấm: ${err?.message || 'Vui lòng thử lại'}`
          : `Failed to save grade: ${err?.message || 'Please try again'}`
      );
    } finally {
      setIsSavingGrade(false);
    }
  };

  // Merge Firestore uploaded resources + curated baseline (de-duplicated by id/code) + dynamic teacher GeminiNotes
  const allResources = useMemo<CuratedLearningResource[]>(() => {
    const firestoreIdSet = new Set(firestoreResources.map((r) => r.id));
    const firestoreCodeSet = new Set(firestoreResources.map((r) => r.code));

    const mappedFirestore: CuratedLearningResource[] = firestoreResources
      .filter((rec) => !deletedBaselineIds.includes(rec.id))
      .map((rec) => {
        let parsedPrompts: WorksheetPromptItem[] = [];
        if (rec.worksheetPromptsJson) {
          try {
            const parsed = JSON.parse(rec.worksheetPromptsJson);
            if (Array.isArray(parsed) && parsed.length > 0) {
              parsedPrompts = parsed;
            }
          } catch {
            // fallback below
          }
        }
        const matchingBaseline = CURATED_RESOURCES.find((b) => b.id === rec.id || b.code === rec.code);
        if (parsedPrompts.length === 0 && matchingBaseline) {
          parsedPrompts = matchingBaseline.worksheetPrompts;
        }
        if (parsedPrompts.length === 0) {
          parsedPrompts = [
            {
              questionEn: `After studying "${rec.titleEn}", which key skill focus did you practice today?`,
              questionVi: `Sau khi học "${rec.titleVi || rec.titleEn}", em đã rèn luyện trọng tâm kỹ năng nào hôm nay?`,
              options: [
                `${rec.skillFocus} (${rec.cefrLevel})`,
                'Skipping instructions',
                'Unrelated activity',
                'None of the above'
              ],
              answerKey: `${rec.skillFocus} (${rec.cefrLevel})`
            }
          ];
        }

        return {
          id: rec.id,
          code: rec.code || 'BW-PDF',
          weekNumber: rec.weekNumber || 1,
          weekThemeEn: rec.weekThemeEn || `Week ${rec.weekNumber} Curriculum`,
          weekThemeVi: rec.weekThemeVi || `Chương trình Tuần ${rec.weekNumber}`,
          cefrLevel: rec.cefrLevel || 'A1 Movers',
          category: rec.category || 'pdf_handout',
          skillFocus: rec.skillFocus || 'Reading',
          estimatedMinutes: rec.estimatedMinutes || 20,
          titleEn: rec.titleEn,
          titleVi: rec.titleVi || rec.titleEn,
          summaryEn: rec.summaryEn,
          summaryVi: rec.summaryVi || rec.summaryEn,
          vocabularyFocus:
            rec.keyVocabulary && rec.keyVocabulary.length > 0
              ? rec.keyVocabulary
              : ['vocabulary', 'comprehension', 'expression'],
          phonicsOrGrammarFocus: rec.phonicsOrGrammar || `${rec.skillFocus} (${rec.cefrLevel})`,
          readingPassageEn: rec.readingPassageEn || matchingBaseline?.readingPassageEn,
          readingPassageVi: rec.readingPassageVi || matchingBaseline?.readingPassageVi,
          worksheetPrompts: parsedPrompts,
          parentTipEn:
            matchingBaseline?.parentTipEn ||
            'Review this teacher-uploaded handout together and discuss the highlighted vocabulary.',
          parentTipVi:
            matchingBaseline?.parentTipVi ||
            'Cùng con xem lại tài liệu giáo viên đã tải lên và thảo luận các từ vựng chính.',
          noteId: rec.id,
          fileName: rec.fileName,
          mimeType: rec.mimeType,
          fileSizeBytes: rec.fileSizeBytes,
          fileBase64: rec.fileBase64,
          uploadedByUid: rec.uploadedByUid,
          uploadedByEmail: rec.uploadedByEmail,
          uploadedByName: rec.uploadedByName,
          assignedScope: rec.assignedScope || 'all',
          assignedClassIds: rec.assignedClassIds || [],
          assignedClassNames: rec.assignedClassNames || [],
          assignedStudentIds: rec.assignedStudentIds || [],
          assignedStudentNames: rec.assignedStudentNames || [],
          materialLinkUrl: rec.materialLinkUrl,
          isFirestoreRecord: true
        };
      });

    const unseededCurated = CURATED_RESOURCES.filter(
      (c) => !firestoreIdSet.has(c.id) && !firestoreCodeSet.has(c.code) && !deletedBaselineIds.includes(c.id)
    );

    const dynamicNotes: CuratedLearningResource[] = geminiNotes.map((note, idx) => ({
      id: `note-${note.id}`,
      code: `BW-W0${(idx % 6) + 1}-GN${idx + 1}`,
      weekNumber: note.weekNumber || (idx % 6) + 1,
      weekThemeEn: note.programTitle || 'Teacher Uploaded Study Guide & Workbook',
      weekThemeVi: note.programTitle || 'Tài liệu & Phiếu bài tập Giáo viên Tải lên',
      cefrLevel: student?.cefrLevel || 'A1 Movers',
      category: 'pdf_handout',
      skillFocus: 'Reading',
      estimatedMinutes: 20,
      titleEn: note.title,
      titleVi: `${note.title} (Tài liệu Lớp học)`,
      summaryEn: note.summaryEn || 'Curated class study guide and read-only workbook material uploaded by your teacher.',
      summaryVi: note.summaryVi || 'Tài liệu hướng dẫn học tập và phiếu bài tập chỉ đọc do giáo viên phụ trách biên soạn.',
      vocabularyFocus:
        note.keyVocabulary && note.keyVocabulary.length > 0
          ? note.keyVocabulary
          : ['comprehension', 'reflection', 'application', 'fluency'],
      phonicsOrGrammarFocus: note.grammarFocus || note.phonicsFocus || 'Classroom Guided Reading & Synthesis',
      readingPassageEn: note.activitiesEn || note.summaryEn,
      readingPassageVi: note.activitiesVi || note.summaryVi,
      worksheetPrompts: [
        {
          questionEn: 'Did you review the key takeaways and complete your notebook reflection for this handout?',
          questionVi: 'Em đã đọc kỹ nội dung trọng tâm và ghi chép phản tư vào sổ tay cho tài liệu này chưa?',
          options: ['Yes, completed mindfully!', 'In progress'],
          answerKey: 'Yes, completed mindfully!'
        }
      ],
      parentTipEn: 'Open this material in the Read-Only Viewer and discuss the main theme with your child.',
      parentTipVi: 'Mở tài liệu này trong Trình xem Chỉ đọc và thảo luận chủ đề chính cùng con.',
      noteId: note.id,
      note,
      fileName: note.sourceFileName,
      mimeType: 'application/pdf',
      assignedScope: 'all'
    }));

    return [...mappedFirestore, ...unseededCurated, ...dynamicNotes];
  }, [firestoreResources, geminiNotes, student?.cefrLevel, deletedBaselineIds]);

  // Helper to check if a resource is specifically assigned to the current student
  const isResourceAssignedToActiveStudent = (res: CuratedLearningResource): boolean => {
    if (!res.assignedScope || res.assignedScope === 'all') return true;
    if (!student) return true;
    if (res.assignedScope === 'student') {
      return Boolean(
        res.assignedStudentIds?.includes(student.id) ||
          res.assignedStudentNames?.some((n) => n.toLowerCase() === student.fullName.toLowerCase())
      );
    }
    if (res.assignedScope === 'class') {
      return Boolean(
        res.assignedClassIds?.some((cid) => student.enrolledClassIds?.includes(cid))
      );
    }
    return true;
  };

  // Map submissions for the active student (or current user)
  const studentSubmissionByResourceId = useMemo(() => {
    const map = new Map<string, ResourceSubmissionRecord>();
    const email = (currentUser?.email || '').toLowerCase();
    submissions.forEach((sub) => {
      const matchStudent =
        (student && sub.studentId === student.id) ||
        (!student &&
          (sub.studentEmail?.toLowerCase() === email || sub.parentEmail?.toLowerCase() === email));
      if (matchStudent) {
        map.set(sub.resourceId, sub);
      }
    });
    return map;
  }, [submissions, student, currentUser?.email]);

  // Submissions visible to Teacher or Admin in the Grading Inbox
  const teacherVisibleSubmissions = useMemo(() => {
    if (!canManageResources || !currentUser) return [];
    const email = currentUser.email.toLowerCase();
    const isAdminOrSuper =
      portalRole === 'admin' ||
      currentUser.role === 'admin' ||
      currentUser.role === 'super_admin' ||
      isSuperAdminEmail(email);

    return submissions.filter((sub) => {
      if (gradingFilterStatus !== 'all' && sub.status !== gradingFilterStatus) return false;
      if (isAdminOrSuper) return true;
      return (
        sub.teacherEmail?.toLowerCase() === email ||
        effectiveClasses.some((c) => c.id === sub.classId && c.teacherEmail?.toLowerCase() === email)
      );
    });
  }, [submissions, canManageResources, currentUser, portalRole, gradingFilterStatus, effectiveClasses]);

  const availableWeeks = useMemo(() => {
    const weeks = Array.from(new Set<number>(allResources.map((r) => r.weekNumber))).sort((a, b) => a - b);
    return weeks;
  }, [allResources]);

  const availableLevels = useMemo(() => {
    const present = new Set(allResources.map((r) => r.cefrLevel));
    return CEFR_LEVELS.filter((lvl) => present.has(lvl));
  }, [allResources]);

  const filteredResources = useMemo(() => {
    return allResources.filter((r) => {
      // In Student/Parent mode, if resource is assigned to another specific student/class, filter appropriately
      if (isStudentOrParentMode && student && r.assignedScope && r.assignedScope !== 'all') {
        if (!isResourceAssignedToActiveStudent(r)) return false;
      }
      if (assignmentFilter === 'assigned_only') {
        const hasSpecificAssignment =
          (r.assignedScope && r.assignedScope !== 'all') || studentSubmissionByResourceId.has(r.id);
        if (!hasSpecificAssignment && !isResourceAssignedToActiveStudent(r)) return false;
      }
      if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
      if (selectedLevel !== 'all' && r.cefrLevel !== selectedLevel) return false;
      if (selectedWeek !== 'all' && r.weekNumber !== selectedWeek) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.titleEn.toLowerCase().includes(q) || r.titleVi.toLowerCase().includes(q);
        const matchTheme = r.weekThemeEn.toLowerCase().includes(q) || r.weekThemeVi.toLowerCase().includes(q);
        const matchVocab = r.vocabularyFocus.some((v) => v.toLowerCase().includes(q));
        const matchCode = r.code.toLowerCase().includes(q);
        const matchSkill = r.skillFocus.toLowerCase().includes(q);
        if (!matchTitle && !matchTheme && !matchVocab && !matchCode && !matchSkill) return false;
      }
      return true;
    });
  }, [
    allResources,
    isStudentOrParentMode,
    student,
    assignmentFilter,
    studentSubmissionByResourceId,
    selectedCategory,
    selectedLevel,
    selectedWeek,
    searchQuery
  ]);

  // Group filtered resources by Week or by CEFR Skill Level
  const groupedSections = useMemo(() => {
    if (organizationMode === 'week') {
      const map = new Map<number, CuratedLearningResource[]>();
      filteredResources.forEach((r) => {
        const list = map.get(r.weekNumber) || [];
        list.push(r);
        map.set(r.weekNumber, list);
      });
      return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([weekNum, items]) => ({
          key: `week-${weekNum}`,
          badge: `WEEK ${String(weekNum).padStart(2, '0')}`,
          titleEn: items[0]?.weekThemeEn || `Week ${weekNum}`,
          titleVi: items[0]?.weekThemeVi || `Tuần ${weekNum}`,
          subtitle: `${items.length} ${items.length === 1 ? 'Resource' : 'Resources'} · CEFR ${Array.from(
            new Set(items.map((i) => i.cefrLevel.split(' ')[0]))
          ).join(', ')}`,
          items
        }));
    } else {
      const map = new Map<CefrLevel, CuratedLearningResource[]>();
      filteredResources.forEach((r) => {
        const list = map.get(r.cefrLevel) || [];
        list.push(r);
        map.set(r.cefrLevel, list);
      });
      return CEFR_LEVELS.filter((lvl) => map.has(lvl)).map((lvl) => {
        const items = map.get(lvl) || [];
        return {
          key: `level-${lvl}`,
          badge: lvl.split(' ')[0],
          titleEn: `${lvl} Skill Level Collection`,
          titleVi: `Bộ Học liệu Cấp độ ${lvl}`,
          subtitle: `${items.length} Curated Materials · Weeks ${Array.from(
            new Set(items.map((i) => i.weekNumber))
          ).join(', ')}`,
          items
        };
      });
    }
  }, [filteredResources, organizationMode]);

  const categoryMeta = (cat: ResourceCategory) => {
    switch (cat) {
      case 'pdf_handout':
        return {
          labelEn: 'PDF Handout',
          labelVi: 'Tài liệu PDF',
          badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          icon: FileText
        };
      case 'practice_worksheet':
        return {
          labelEn: 'Practice Worksheet',
          labelVi: 'Phiếu Bài tập',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: Award
        };
      case 'supplemental_reading':
        return {
          labelEn: 'Supplemental Reading',
          labelVi: 'Đọc Mở rộng',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          icon: BookOpen
        };
    }
  };

  const toggleCompleted = (id: string) => {
    setCompletedResourceIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const speakPassage = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    }
  };

  const openResourceModal = (res: CuratedLearningResource) => {
    setActiveResource(res);
    const existingSub = studentSubmissionByResourceId.get(res.id);
    if (existingSub) {
      setStudentSubmissionNotes(existingSub.studentNotes || '');
      try {
        const parsed: ResourceSubmissionAnswerItem[] = JSON.parse(existingSub.answersJson || '[]');
        const nextAnswers: Record<string, string> = { ...selectedAnswers };
        parsed.forEach((ans) => {
          nextAnswers[`${res.id}-q${ans.questionIndex}`] = ans.selectedAnswer;
        });
        setSelectedAnswers(nextAnswers);
      } catch {
        // ignore parse errors
      }
    } else {
      setStudentSubmissionNotes('');
    }
  };

  const pendingTeacherSubmissionsCount = submissions.filter((s) => s.status === 'submitted').length;
  const gradedStudentSubmissionsCount = Array.from(studentSubmissionByResourceId.values()).filter(
    (s) => s.status === 'graded'
  ).length;

  return (
    <div className="bg-white rounded-2xl border border-[#172154]/10 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-white px-6 py-6 border-b border-[#172154]/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold uppercase tracking-wider text-[#172154]/60">
              <span className="inline-flex items-center gap-1.5 text-[#FF6B00]">
                <BookOpen className="w-3.5 h-3.5" />
                {lang === 'vi'
                  ? 'Thư viện Học liệu & Bài tập Be Whole'
                  : 'Learning Resource Library & Homework'}
              </span>
              {student && (
                <>
                  <span className="text-[#172154]/25">·</span>
                  <span className="normal-case text-[#172154]/80">
                    {lang === 'vi' ? student.fullName : student.fullName} ({student.cefrLevel})
                  </span>
                </>
              )}
              {canManageResources && (
                <>
                  <span className="text-[#172154]/25">·</span>
                  <span className="normal-case text-[#0F766E]">
                    {lang === 'vi' ? 'Quản lý & Chấm bài' : 'Assign & Grade Enabled'}
                  </span>
                </>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[#172154]">
              {canManageResources
                ? lang === 'vi'
                  ? 'Học liệu Lớp học, Giao Bài tập & Chấm điểm'
                  : 'Class Material Library, Homework Assignment & Grading'
                : lang === 'vi'
                  ? 'Bài tập Về nhà, Tài liệu Lớp học & Phản hồi Giáo viên'
                  : 'Class Materials, Interactive Exercises & Teacher Feedback'}
            </h2>
            <p className="text-xs sm:text-sm text-[#172154]/65 max-w-3xl">
              {canManageResources
                ? lang === 'vi'
                  ? 'Tải lên, chỉnh sửa học liệu PDF & bài tập; giao theo từng Lớp hoặc từng Học viên; chấm điểm và trả lời phê trực tiếp.'
                  : 'Upload and organize class materials, assign exercises to classes or students, and return graded bilingual feedback.'
                : lang === 'vi'
                  ? 'Hoàn thành bài tập trong Thư viện Học liệu để gửi trực tiếp tới Giáo viên chấm điểm và nhận lời phê song ngữ.'
                  : 'Complete exercises in the Resource Library and submit them directly to your teacher for graded bilingual feedback.'}
            </p>
          </div>

          {/* Organization Mode Toggle + Admin/Teacher Upload & Grading Inbox Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            {canManageResources && (
              <>
                <button
                  type="button"
                  onClick={() => setShowGradingInbox((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border whitespace-nowrap cursor-pointer ${
                    showGradingInbox
                      ? 'bg-[#172154] text-white border-[#172154]'
                      : 'bg-white hover:bg-[#F8F9FB] text-[#172154] border-[#172154]/15'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'vi' ? 'Chấm bài' : 'Grading Inbox'} ({pendingTeacherSubmissionsCount})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (showUploadStudio && editingResourceId) {
                      resetUploadForm();
                    }
                    setShowUploadStudio((prev) => !prev);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    showUploadStudio
                      ? 'bg-[#172154] text-white'
                      : 'bg-[#FF6B00] hover:bg-[#E05A00] text-white'
                  }`}
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  {showUploadStudio
                    ? lang === 'vi'
                      ? 'Đóng Khung Tải lên'
                      : 'Close Upload Studio'
                    : lang === 'vi'
                      ? '+ Tải Học liệu & Giao bài'
                      : '+ Upload & Assign'}
                </button>
              </>
            )}

            <div className="flex items-center gap-1 bg-[#F2F4F8] p-1 rounded-xl border border-[#172154]/8">
              <button
                type="button"
                onClick={() => setOrganizationMode('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  organizationMode === 'week'
                    ? 'bg-[#FF6B00] text-white'
                    : 'text-[#172154]/75 hover:bg-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {lang === 'vi' ? 'Theo Tuần' : 'By Week'}
              </button>
              <button
                type="button"
                onClick={() => setOrganizationMode('level')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  organizationMode === 'level'
                    ? 'bg-[#FF6B00] text-white'
                    : 'text-[#172154]/75 hover:bg-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                {lang === 'vi' ? 'Theo Cấp độ' : 'By Level'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#172154]/8">
          <div className="bg-[#F8F9FB] rounded-xl px-4 py-3 border border-[#172154]/8">
            <div className="text-[11px] font-medium text-[#172154]/60">
              {lang === 'vi' ? 'Tổng Học liệu' : 'Total Materials'}
            </div>
            <div className="text-lg font-mono-num font-bold text-[#172154] mt-0.5 flex items-baseline gap-2 tabular-nums">
              <span>{allResources.length}</span>
              <span className="text-[11px] font-sans font-medium text-[#172154]/55">
                {firestoreResources.length > 0
                  ? `${firestoreResources.length} in DB`
                  : `${availableWeeks.length} wks`}
              </span>
            </div>
          </div>
          <div className="bg-[#F8F9FB] rounded-xl px-4 py-3 border border-[#172154]/8">
            <div className="text-[11px] font-medium text-[#172154]/60">
              {lang === 'vi' ? 'Giao Lớp / Cá nhân' : 'Targeted Assigned'}
            </div>
            <div className="text-lg font-mono-num font-bold text-[#172154] mt-0.5 tabular-nums">
              {allResources.filter((r) => r.assignedScope && r.assignedScope !== 'all').length}{' '}
              <span className="text-[11px] font-sans font-normal text-[#172154]/55">
                ({allResources.filter((r) => !r.assignedScope || r.assignedScope === 'all').length}{' '}
                {lang === 'vi' ? 'chung' : 'shared'})
              </span>
            </div>
          </div>
          <div className="bg-[#F8F9FB] rounded-xl px-4 py-3 border border-[#172154]/8">
            <div className="text-[11px] font-medium text-[#172154]/60">
              {canManageResources
                ? lang === 'vi'
                  ? 'Chờ Giáo viên Chấm'
                  : 'Awaiting Grade'
                : lang === 'vi'
                  ? 'Đã nộp cho GV'
                  : 'Submitted'}
            </div>
            <div className="text-lg font-mono-num font-bold text-[#FF6B00] mt-0.5 tabular-nums">
              {canManageResources ? pendingTeacherSubmissionsCount : studentSubmissionByResourceId.size}
            </div>
          </div>
          <div className="bg-[#F8F9FB] rounded-xl px-4 py-3 border border-[#172154]/8">
            <div className="text-[11px] font-medium text-[#172154]/60">
              {canManageResources
                ? lang === 'vi'
                  ? 'Đã Chấm & Trả bài'
                  : 'Graded & Returned'
                : lang === 'vi'
                  ? 'Đã Chấm điểm'
                  : 'Graded'}
            </div>
            <div className="text-lg font-mono-num font-bold text-[#0F766E] mt-0.5 flex items-center gap-1.5 tabular-nums">
              <CheckCircle2 className="w-4 h-4" />
              {canManageResources
                ? submissions.filter((s) => s.status === 'graded').length
                : gradedStudentSubmissionsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Status Notification Banner */}
      {uploadStatusMsg && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex items-center justify-between text-xs font-bold text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{uploadStatusMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadStatusMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TEACHER & ADMIN EXERCISE GRADING STUDIO PANEL */}
      {canManageResources && showGradingInbox && (
        <div className="bg-gradient-to-br from-rose-50/70 via-white to-indigo-50/50 border-b border-rose-200/80 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-[#E61E64] text-white">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  {lang === 'vi'
                    ? 'HỘP THƯ BÀI TẬP HỌC VIÊN & CHẤM ĐIỂM TRẢ BÀI'
                    : 'STUDENT EXERCISE SUBMISSIONS & TEACHER GRADING QUEUE'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 mt-1">
                {lang === 'vi'
                  ? 'Chấm điểm Bài tập Học viên Hoàn thành & Gửi trả Kết quả về Cổng Học viên'
                  : 'Review Completed Student Exercises, Assign Grades & Return Feedback to Student'}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200">
              {(
                [
                  { id: 'all', labelEn: `All (${submissions.length})`, labelVi: `Tất cả (${submissions.length})` },
                  {
                    id: 'submitted',
                    labelEn: `Needs Grading (${pendingTeacherSubmissionsCount})`,
                    labelVi: `Chờ chấm (${pendingTeacherSubmissionsCount})`
                  },
                  {
                    id: 'graded',
                    labelEn: `Graded (${submissions.filter((s) => s.status === 'graded').length})`,
                    labelVi: `Đã trả bài (${submissions.filter((s) => s.status === 'graded').length})`
                  }
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setGradingFilterStatus(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    gradingFilterStatus === f.id
                      ? 'bg-[#1A1838] text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {lang === 'vi' ? f.labelVi : f.labelEn}
                </button>
              ))}
            </div>
          </div>

          {teacherVisibleSubmissions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-500">
              {lang === 'vi'
                ? 'Chưa có bài nộp nào trong danh sách này. Khi học viên hoàn thành bài tập và nhấn "Nộp bài cho Giáo viên", bài làm sẽ xuất hiện tại đây để Thầy/Cô chấm điểm.'
                : 'No student exercise submissions match this filter yet. Once a student finishes an exercise in the Resource Library and submits it, it will appear here for grading.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {teacherVisibleSubmissions.map((sub) => {
                let parsedAnswers: ResourceSubmissionAnswerItem[] = [];
                try {
                  parsedAnswers = JSON.parse(sub.answersJson || '[]');
                } catch {
                  parsedAnswers = [];
                }
                const isGraded = sub.status === 'graded';

                return (
                  <div
                    key={sub.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                      isGraded
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-white border-rose-200 shadow-xs'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            isGraded
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          {isGraded
                            ? lang === 'vi'
                              ? `Đã chấm & Trả bài: ${sub.gradeScore}/100`
                              : `Graded & Returned: ${sub.gradeScore}/100`
                            : lang === 'vi'
                              ? 'Mới nộp · Chờ Giáo viên Chấm'
                              : 'Submitted · Awaiting Grade'}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-stone-500">
                          W{String(sub.weekNumber).padStart(2, '0')} · {sub.resourceCode}
                        </span>
                      </div>

                      <div>
                        <div className="text-sm font-bold text-indigo-950">{sub.studentName}</div>
                        <div className="text-[11px] text-stone-600">
                          {sub.className} · GV: {sub.teacherName} ({sub.teacherEmail})
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1">
                        <div className="text-xs font-bold text-stone-900">
                          {lang === 'vi' ? sub.resourceTitleVi : sub.resourceTitleEn}
                        </div>
                        <div className="text-[11px] text-stone-600 flex items-center justify-between">
                          <span>
                            {lang === 'vi' ? 'Điểm trắc nghiệm tự động:' : 'Auto-Check Score:'}{' '}
                            <strong className="text-indigo-900">{sub.autoScorePercent}%</strong> (
                            {parsedAnswers.filter((a) => a.isCorrect).length}/{parsedAnswers.length})
                          </span>
                          <span>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                        </div>
                        {sub.studentNotes && (
                          <div className="text-[11px] text-stone-700 italic pt-1 border-t border-stone-200/60">
                            "{sub.studentNotes}"
                          </div>
                        )}
                      </div>

                      {isGraded && (sub.teacherFeedbackVi || sub.teacherFeedbackEn) && (
                        <div className="p-2.5 rounded-xl bg-emerald-100/60 border border-emerald-200 text-[11px] text-emerald-950">
                          <strong>{lang === 'vi' ? 'Nhận xét của GV:' : 'Teacher Feedback:'}</strong>{' '}
                          {lang === 'vi'
                            ? sub.teacherFeedbackVi || sub.teacherFeedbackEn
                            : sub.teacherFeedbackEn || sub.teacherFeedbackVi}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/70">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGradingSubmission(sub);
                          setGradeScoreInput(sub.gradeScore ?? sub.autoScorePercent ?? 90);
                          setTeacherFeedbackEnInput(
                            sub.teacherFeedbackEn ||
                              `Excellent work on ${sub.resourceTitleEn}, ${sub.studentName}! Keep practicing the key vocabulary.`
                          );
                          setTeacherFeedbackViInput(
                            sub.teacherFeedbackVi ||
                              `Khen ngợi ${sub.studentName} đã hoàn thành tốt bài tập "${sub.resourceTitleVi}"! Con hãy tiếp tục ôn luyện từ vựng nhé.`
                          );
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-[#1A1838] hover:bg-indigo-900 text-amber-300 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {isGraded
                          ? lang === 'vi'
                            ? 'Xem bài làm & Cập nhật Điểm trả Học viên'
                            : 'Review Answers & Update Returned Grade'
                          : lang === 'vi'
                            ? 'Mở Bài làm · Chấm điểm & Trả bài cho Học viên'
                            : 'Open Submission · Grade & Send Back to Student'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Teacher Grading Modal / Drawer */}
          {activeGradingSubmission && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 p-6 space-y-5">
                <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded bg-[#E61E64] text-white text-[10px] font-bold uppercase">
                      {lang === 'vi' ? 'Chấm điểm & Trả bài Học viên' : 'Grade & Return Student Assignment'}
                    </span>
                    <h4 className="text-lg font-serif font-bold text-stone-900 mt-1">
                      {activeGradingSubmission.studentName} ·{' '}
                      {lang === 'vi'
                        ? activeGradingSubmission.resourceTitleVi
                        : activeGradingSubmission.resourceTitleEn}
                    </h4>
                    <p className="text-xs text-stone-500">
                      {activeGradingSubmission.className} · Auto-check: {activeGradingSubmission.autoScorePercent}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveGradingSubmission(null)}
                    className="p-1.5 rounded-lg bg-stone-100 text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Student's Submitted Answers Breakdown */}
                <div className="space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    {lang === 'vi' ? 'Chi tiết Câu trả lời của Học viên:' : 'Student Submitted Answers:'}
                  </div>
                  {(() => {
                    let parsed: ResourceSubmissionAnswerItem[] = [];
                    try {
                      parsed = JSON.parse(activeGradingSubmission.answersJson || '[]');
                    } catch {
                      parsed = [];
                    }
                    return parsed.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${
                          item.isCorrect
                            ? 'bg-emerald-50/70 border-emerald-200'
                            : 'bg-amber-50/70 border-amber-200'
                        }`}
                      >
                        <div className="font-bold text-stone-900">
                          Q{idx + 1}: {lang === 'vi' ? item.questionVi : item.questionEn}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {lang === 'vi' ? 'Học viên chọn:' : 'Student Answer:'}{' '}
                            <strong className={item.isCorrect ? 'text-emerald-800' : 'text-rose-700'}>
                              {item.selectedAnswer || '(No answer)'}
                            </strong>
                          </span>
                          <span className="text-stone-600">
                            {lang === 'vi' ? 'Đáp án chuẩn:' : 'Answer Key:'} <strong>{item.answerKey}</strong>
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                  {activeGradingSubmission.studentNotes && (
                    <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950">
                      <strong>{lang === 'vi' ? 'Ghi chú / Tự luận của Học viên:' : 'Student Written Reflection:'}</strong>{' '}
                      {activeGradingSubmission.studentNotes}
                    </div>
                  )}
                </div>

                <form onSubmit={handleTeacherGradeSubmission} className="space-y-4 pt-2 border-t border-stone-200">
                  <div>
                    <label className="block text-xs font-bold text-stone-800 mb-1">
                      {lang === 'vi'
                        ? 'Điểm Chấm của Giáo viên (Thang điểm 0 - 100) *'
                        : 'Official Teacher Grade Score (0 - 100) *'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={gradeScoreInput}
                      onChange={(e) => setGradeScoreInput(Number(e.target.value))}
                      className="w-40 px-3 py-2 rounded-xl border border-stone-300 text-base font-mono font-bold text-indigo-950"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-800 mb-1">
                        {lang === 'vi' ? 'Lời phê của Giáo viên (Tiếng Anh)' : 'Teacher Feedback (English)'}
                      </label>
                      <textarea
                        rows={3}
                        value={teacherFeedbackEnInput}
                        onChange={(e) => setTeacherFeedbackEnInput(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-stone-300 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-800 mb-1">
                        {lang === 'vi' ? 'Lời phê của Giáo viên (Tiếng Việt)' : 'Teacher Feedback (Vietnamese)'}
                      </label>
                      <textarea
                        rows={3}
                        value={teacherFeedbackViInput}
                        onChange={(e) => setTeacherFeedbackViInput(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-stone-300 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveGradingSubmission(null)}
                      className="px-4 py-2 rounded-xl border border-stone-300 text-xs font-semibold text-stone-700 cursor-pointer"
                    >
                      {lang === 'vi' ? 'Đóng' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingGrade}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {isSavingGrade
                        ? lang === 'vi'
                          ? 'Đang gửi trả bài...'
                          : 'Sending back to student...'
                        : lang === 'vi'
                          ? 'Chấm điểm & Gửi trả bài cho Học viên'
                          : 'Save Grade & Send Back to Student'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ADMIN & TEACHER DIRECT FIRESTORE PDF UPLOAD, ASSIGNMENT & EXERCISE BUILDER STUDIO */}
      {canManageResources && showUploadStudio && (
        <div className="bg-gradient-to-br from-amber-50/90 via-stone-50 to-indigo-50/50 border-b border-amber-200/80 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-amber-200/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-indigo-900 text-amber-300">
                  <CloudUpload className="w-3.5 h-3.5" />
                  {lang === 'vi'
                    ? 'STUDIO QUẢN LÝ HỌC LIỆU & GIAO BÀI TẬP (ADMIN & GIÁO VIÊN)'
                    : 'ADMIN & TEACHER MATERIAL UPLOAD & ASSIGNMENT STUDIO'}
                </span>
                {editingResourceId && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-200 text-amber-950">
                    <Edit3 className="w-3 h-3" />
                    {lang === 'vi' ? 'Đang chỉnh sửa học liệu & phân công' : 'Editing Resource & Assignment'}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 mt-1">
                {editingResourceId
                  ? lang === 'vi'
                    ? 'Chỉnh sửa Học liệu, Câu hỏi Bài tập & Giao cho Lớp học / Học viên'
                    : 'Edit Class Material, Exercise Prompts & Class/Student Assignments'
                  : lang === 'vi'
                    ? 'Tải lên Học liệu / Bài tập Mới & Giao cho Lớp học hoặc Cá nhân Học viên'
                    : 'Upload Class Material / Exercise & Assign to Specific Classes or Individual Students'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {editingResourceId && (
                <button
                  type="button"
                  onClick={resetUploadForm}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  {lang === 'vi' ? '+ Tạo mới' : '+ New Upload'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowUploadStudio(false)}
                className="p-1.5 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveResourceToFirestore} className="space-y-4">
            {/* Step 1: PDF File Upload Box + Core Tags */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* File Picker Dropzone + Class Material Link */}
              <div className="lg:col-span-5 bg-white rounded-2xl border-2 border-dashed border-indigo-300 p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                      <FileUp className="w-4 h-4 text-indigo-600" />
                      {lang === 'vi' ? '1. Tệp PDF & Liên kết Tài liệu Lớp học' : '1. PDF File & Class Material Link'}
                    </span>
                    {formFileName && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {Math.max(1, Math.round(formFileSizeBytes / 1024))} KB
                      </span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf,.png,.jpg,.jpeg,.txt"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-stone-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-900 file:text-white hover:file:bg-indigo-800 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {lang === 'vi'
                      ? 'Liên kết Tài liệu / Slide Lớp học (URL học viên có thể mở)'
                      : 'External Class Material Link / Workbook URL (for Students)'}
                  </label>
                  <input
                    type="url"
                    value={formMaterialLinkUrl}
                    onChange={(e) => setFormMaterialLinkUrl(e.target.value)}
                    placeholder="https://docs.google.com/... or class material link"
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800"
                  />
                </div>

                {formFileName && (
                  <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-700 shrink-0" />
                      <div className="truncate text-xs font-bold text-indigo-950">{formFileName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormFileName('');
                        setFormFileBase64('');
                        setFormFileSizeBytes(0);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 cursor-pointer"
                    >
                      {lang === 'vi' ? 'Xóa tệp' : 'Clear'}
                    </button>
                  </div>
                )}
              </div>

              {/* Tagging Matrix */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-stone-200/90 p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-amber-600" />
                  {lang === 'vi'
                    ? '2. Gắn thẻ Phân loại (Tuần học · Cấp độ CEFR · Kỹ năng)'
                    : '2. Resource Classification Tags (Week · CEFR Skill Level · Focus)'}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {lang === 'vi' ? 'Tuần học (Week 1-52)' : 'Curriculum Week (1-52)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={52}
                      value={formWeekNumber}
                      onChange={(e) => {
                        const wk = Math.max(1, Math.min(52, Number(e.target.value) || 1));
                        setFormWeekNumber(wk);
                        if (!editingResourceId) {
                          setFormCode(`BW-W${String(wk).padStart(2, '0')}-U${firestoreResources.length + 1}`);
                        }
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-bold text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {lang === 'vi' ? 'Cấp độ Kỹ năng CEFR' : 'CEFR Skill Level Tag'}
                    </label>
                    <select
                      value={formCefrLevel}
                      onChange={(e) => setFormCefrLevel(e.target.value as CefrLevel)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-bold text-indigo-950 bg-indigo-50/40"
                    >
                      {CEFR_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {lang === 'vi' ? 'Loại Học liệu' : 'Resource Category'}
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as ResourceCategory)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-stone-800"
                    >
                      <option value="pdf_handout">PDF Handout (Tài liệu PDF)</option>
                      <option value="practice_worksheet">Practice Worksheet (Phiếu Bài tập)</option>
                      <option value="supplemental_reading">Supplemental Reading (Đọc Mở rộng)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {lang === 'vi' ? 'Kỹ năng Trọng tâm' : 'Primary Skill Focus'}
                    </label>
                    <select
                      value={formSkillFocus}
                      onChange={(e) =>
                        setFormSkillFocus(e.target.value as CuratedLearningResource['skillFocus'])
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-stone-800"
                    >
                      <option value="Reading">Reading</option>
                      <option value="Writing">Writing</option>
                      <option value="Speaking">Speaking</option>
                      <option value="Listening">Listening</option>
                      <option value="Phonics & Vocabulary">Phonics & Vocabulary</option>
                      <option value="Be Whole Values">Be Whole Values</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {lang === 'vi' ? 'Mã Học liệu (Code)' : 'Resource Code'}
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="BW-W01-H2"
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-mono font-bold text-stone-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      {lang === 'vi' ? 'Thời lượng (Phút)' : 'Est. Duration (Mins)'}
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={formEstimatedMinutes}
                      onChange={(e) => setFormEstimatedMinutes(Number(e.target.value) || 20)}
                      className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold text-stone-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Assign Material to Specific Classes or Individual Students */}
            <div className="bg-white rounded-2xl border border-indigo-200 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#E61E64]" />
                  {lang === 'vi'
                    ? '3. Giao Học liệu & Bài tập cho Lớp học hoặc Cá nhân Học viên'
                    : '3. Assign Material to Specific Classes or Individual Students'}
                </div>

                <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                  {(
                    [
                      { id: 'all', labelEn: 'All Classes & Students', labelVi: 'Tất cả Lớp & Học viên' },
                      { id: 'class', labelEn: 'Specific Classes', labelVi: 'Giao theo Lớp học' },
                      { id: 'student', labelEn: 'Individual Students', labelVi: 'Giao Cá nhân Học viên' }
                    ] as const
                  ).map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => setFormAssignedScope(scope.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        formAssignedScope === scope.id
                          ? 'bg-[#2D3E99] text-white'
                          : 'text-stone-700 hover:bg-white'
                      }`}
                    >
                      {lang === 'vi' ? scope.labelVi : scope.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {formAssignedScope === 'class' && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-semibold text-stone-700">
                    {lang === 'vi'
                      ? 'Chọn các Lớp học nhận tài liệu / bài tập này:'
                      : 'Select which classes receive this material / exercise:'}
                  </div>
                  {effectiveClasses.length === 0 ? (
                    <div className="text-xs text-stone-500 italic">
                      {lang === 'vi' ? 'Chưa có lớp học nào được tạo.' : 'No classes found in database.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {effectiveClasses.map((cls) => {
                        const checked = formAssignedClassIds.includes(cls.id);
                        return (
                          <label
                            key={cls.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                              checked
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold'
                                : 'bg-stone-50 border-stone-200 text-stone-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormAssignedClassIds((prev) => [...prev, cls.id]);
                                } else {
                                  setFormAssignedClassIds((prev) => prev.filter((id) => id !== cls.id));
                                }
                              }}
                              className="rounded"
                            />
                            <div className="truncate">
                              <div>{cls.name}</div>
                              <div className="text-[10px] text-stone-500">
                                {cls.cefrLevel} · GV: {cls.teacherName}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {formAssignedScope === 'student' && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-semibold text-stone-700">
                    {lang === 'vi'
                      ? 'Chọn từng Học viên cụ thể nhận bài tập / học liệu này:'
                      : 'Select individual students to assign this material / homework to:'}
                  </div>
                  {effectiveStudents.length === 0 ? (
                    <div className="text-xs text-stone-500 italic">
                      {lang === 'vi' ? 'Chưa có hồ sơ học viên nào.' : 'No student profiles found.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {effectiveStudents.map((stu) => {
                        const checked = formAssignedStudentIds.includes(stu.id);
                        return (
                          <label
                            key={stu.id}
                            className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                              checked
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                                : 'bg-stone-50 border-stone-200 text-stone-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormAssignedStudentIds((prev) => [...prev, stu.id]);
                                } else {
                                  setFormAssignedStudentIds((prev) => prev.filter((id) => id !== stu.id));
                                }
                              }}
                              className="rounded"
                            />
                            <div className="truncate">
                              <div>{stu.fullName}</div>
                              <div className="text-[10px] text-stone-500">
                                {stu.cefrLevel} · {stu.studentEmail || stu.parentEmail}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 3: Bilingual Title, Week Theme, Summary & Vocabulary */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Tiêu đề Học liệu (Tiếng Anh) *' : 'Resource Title (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitleEn}
                    onChange={(e) => setFormTitleEn(e.target.value)}
                    placeholder="e.g., Week 2 Phonics & Family Heritage Worksheet"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Tiêu đề Học liệu (Tiếng Việt)' : 'Resource Title (Vietnamese)'}
                  </label>
                  <input
                    type="text"
                    value={formTitleVi}
                    onChange={(e) => setFormTitleVi(e.target.value)}
                    placeholder="VD: Phiếu bài tập Ngữ âm & Cội nguồn Gia đình Tuần 2"
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-stone-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Tóm tắt / Hướng dẫn (Tiếng Anh)' : 'Summary / Instructions (English)'}
                  </label>
                  <textarea
                    rows={2}
                    value={formSummaryEn}
                    onChange={(e) => setFormSummaryEn(e.target.value)}
                    placeholder="Brief description of what students will practice in this handout or worksheet..."
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Tóm tắt / Hướng dẫn (Tiếng Việt)' : 'Summary / Instructions (Vietnamese)'}
                  </label>
                  <textarea
                    rows={2}
                    value={formSummaryVi}
                    onChange={(e) => setFormSummaryVi(e.target.value)}
                    placeholder="Mô tả ngắn gọn nội dung rèn luyện dành cho học sinh..."
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Từ vựng Trọng tâm (phân cách bằng dấu phẩy)' : 'Key Vocabulary (comma-separated)'}
                  </label>
                  <input
                    type="text"
                    value={formVocabularyInput}
                    onChange={(e) => setFormVocabularyInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    {lang === 'vi' ? 'Trọng tâm Ngữ âm / Ngữ pháp' : 'Phonics / Grammar Focus'}
                  </label>
                  <input
                    type="text"
                    value={formGrammarFocus}
                    onChange={(e) => setFormGrammarFocus(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-800"
                  />
                </div>
              </div>
            </div>

            {/* Step 4: Interactive Exercise Questions Builder */}
            <div className="bg-white rounded-2xl border border-stone-200/90 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-600" />
                  {lang === 'vi'
                    ? '4. Câu hỏi Bài tập Tương tác (Học viên làm & nộp cho Giáo viên chấm)'
                    : '4. Interactive Homework Exercise Questions (Submitted to Teacher)'}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormPrompts((prev) => [
                      ...prev,
                      {
                        questionEn: '',
                        questionVi: '',
                        options: ['Option A', 'Option B', 'Option C', 'Option D'],
                        answerKey: 'Option A'
                      }
                    ])
                  }
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {lang === 'vi' ? 'Thêm Câu hỏi' : 'Add Question'}
                </button>
              </div>

              <div className="space-y-3">
                {formPrompts.map((p, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-950">Question #{idx + 1}</span>
                      {formPrompts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setFormPrompts((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                        >
                          {lang === 'vi' ? 'Xóa câu hỏi' : 'Remove'}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={p.questionEn}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormPrompts((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, questionEn: val } : item))
                          );
                        }}
                        placeholder="Question in English"
                        className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                      />
                      <input
                        type="text"
                        value={p.questionVi}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormPrompts((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, questionVi: val } : item))
                          );
                        }}
                        placeholder="Câu hỏi bằng Tiếng Việt"
                        className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={(p.options || []).join(' | ')}
                        onChange={(e) => {
                          const opts = e.target.value.split('|').map((s) => s.trim());
                          setFormPrompts((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, options: opts } : item))
                          );
                        }}
                        placeholder="Options separated by | (e.g., cat | tree | sun)"
                        className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs bg-white"
                      />
                      <input
                        type="text"
                        value={p.answerKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormPrompts((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, answerKey: val } : item))
                          );
                        }}
                        placeholder="Correct Answer Key"
                        className="px-2.5 py-1.5 rounded-lg border border-emerald-300 text-xs bg-white font-semibold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-stone-600 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-700" />
                <span>
                  {lang === 'vi'
                    ? `Người tải lên & giao bài: ${currentUser?.displayName || currentUser?.email}`
                    : `Authenticated Uploader: ${currentUser?.displayName || currentUser?.email}`}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    resetUploadForm();
                    setShowUploadStudio(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 cursor-pointer"
                >
                  {lang === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#1A1838] hover:bg-indigo-950 text-amber-300 shadow-sm flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <CloudUpload className="w-4 h-4" />
                  {isUploading
                    ? lang === 'vi'
                      ? 'Đang lưu vào Cơ sở dữ liệu...'
                      : 'Saving to Database...'
                    : editingResourceId
                      ? lang === 'vi'
                        ? 'Lưu Cập nhật Học liệu & Phân công'
                        : 'Save Material & Assignment Changes'
                      : lang === 'vi'
                        ? 'Tải lên & Giao Học liệu'
                        : 'Upload & Assign Material'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="p-5 bg-stone-50/80 border-b border-stone-200/80 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Category Segment Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', labelEn: 'All Materials', labelVi: 'Tất cả Học liệu' },
                { id: 'pdf_handout', labelEn: 'PDF Handouts', labelVi: 'Tài liệu PDF' },
                { id: 'practice_worksheet', labelEn: 'Practice Worksheets', labelVi: 'Phiếu Bài tập' },
                { id: 'supplemental_reading', labelEn: 'Supplemental Reading', labelVi: 'Đọc Mở rộng' }
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                  selectedCategory === tab.id
                    ? 'bg-[#1A1838] text-white border-[#1A1838] shadow-xs'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {lang === 'vi' ? tab.labelVi : tab.labelEn}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setAssignmentFilter((prev) => (prev === 'all' ? 'assigned_only' : 'all'))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                assignmentFilter === 'assigned_only'
                  ? 'bg-[#E61E64] text-white border-[#E61E64]'
                  : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              {lang === 'vi' ? 'Bài được Giao riêng / Đã nộp' : 'Assigned / Submitted Only'}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'vi'
                  ? 'Tìm theo chủ đề, từ vựng, mã học liệu (VD: BW-W01)...'
                  : 'Search handouts, vocabulary, phonics, or code...'
              }
              className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-filters: Week Pills & CEFR Skill Level Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" />
              {lang === 'vi' ? 'Tuần:' : 'Week:'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedWeek('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                selectedWeek === 'all'
                  ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {lang === 'vi' ? 'Tất cả' : 'All Weeks'}
            </button>
            {availableWeeks.map((wk) => (
              <button
                key={wk}
                type="button"
                onClick={() => setSelectedWeek(wk)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedWeek === wk
                    ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                W{String(wk).padStart(2, '0')}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mr-1">
              {lang === 'vi' ? 'Cấp độ CEFR:' : 'Skill Level:'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedLevel('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                selectedLevel === 'all'
                  ? 'bg-amber-100 text-amber-950 border border-amber-300'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {lang === 'vi' ? 'Tất cả Cấp độ' : 'All Levels'}
            </button>
            {availableLevels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedLevel === lvl
                    ? 'bg-amber-100 text-amber-950 border border-amber-300'
                    : student?.cefrLevel === lvl
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                {lvl.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grouped Resource Sections */}
      <div className="p-6 space-y-8">
        {groupedSections.length === 0 ? (
          <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
            <BookOpen className="w-10 h-10 text-stone-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-stone-700">
              {lang === 'vi'
                ? 'Không tìm thấy học liệu phù hợp với bộ lọc hiện tại.'
                : 'No learning resources match your current filters.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSelectedLevel('all');
                setSelectedWeek('all');
                setAssignmentFilter('all');
                setSearchQuery('');
              }}
              className="mt-3 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-900 text-white hover:bg-indigo-800 cursor-pointer"
            >
              {lang === 'vi' ? 'Đặt lại Bộ lọc' : 'Reset Filters'}
            </button>
          </div>
        ) : (
          groupedSections.map((section) => (
            <div key={section.key} className="space-y-4">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-200">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-lg bg-[#1A1838] text-amber-300 font-mono text-xs font-bold tracking-wider">
                    {section.badge}
                  </span>
                  <div>
                    <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900">
                      {lang === 'vi'
                        ? section.titleVi
                        : lang === 'en'
                          ? section.titleEn
                          : `${section.titleEn} · ${section.titleVi}`}
                    </h3>
                    <p className="text-xs text-stone-500">{section.subtitle}</p>
                  </div>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {section.items.map((res) => {
                  const meta = categoryMeta(res.category);
                  const IconComp = meta.icon;
                  const studentSub = studentSubmissionByResourceId.get(res.id);
                  const isDone = completedResourceIds.includes(res.id) || Boolean(studentSub);
                  const isStudentLevel = student?.cefrLevel === res.cefrLevel;

                  return (
                    <div
                      key={res.id}
                      className={`group rounded-xl border transition-colors flex flex-col justify-between p-5 bg-white ${
                        studentSub?.status === 'graded'
                          ? 'border-[#0F766E]/35'
                          : isStudentLevel
                            ? 'border-[#FF6B00]/30 hover:border-[#FF6B00]/60'
                            : 'border-[#172154]/10 hover:border-[#172154]/25'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Clean Single-Line Metadata Row */}
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#172154]/75">
                            <IconComp className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                            <span>{lang === 'vi' ? meta.labelVi : meta.labelEn}</span>
                            <span className="text-[#172154]/25">·</span>
                            <span className="font-mono-num text-[#172154]/60">
                              W{String(res.weekNumber).padStart(2, '0')} · {res.cefrLevel.split(' ')[0]}
                            </span>
                          </span>

                          {studentSub?.status === 'graded' ? (
                            <span className="font-mono-num font-bold text-[#0F766E] tabular-nums shrink-0">
                              {studentSub.gradeScore}/100
                            </span>
                          ) : studentSub?.status === 'submitted' ? (
                            <span className="font-semibold text-[#FF6B00] shrink-0">
                              {lang === 'vi' ? 'Đã nộp' : 'Submitted'}
                            </span>
                          ) : (
                            <span className="font-mono-num text-[#172154]/45 shrink-0">
                              {res.estimatedMinutes}m
                            </span>
                          )}
                        </div>

                        {/* Optional Targeted Assignment Line (Unboxed) */}
                        {res.assignedScope && res.assignedScope !== 'all' && (
                          <div className="text-[11px] font-medium text-[#2D3E99] flex items-center gap-1.5">
                            {res.assignedScope === 'class' ? (
                              <>
                                <Users className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {lang === 'vi' ? 'Lớp:' : 'Class:'}{' '}
                                  {(res.assignedClassNames && res.assignedClassNames.length > 0
                                    ? res.assignedClassNames
                                    : res.assignedClassIds || []
                                  ).join(', ')}
                                </span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {lang === 'vi' ? 'Học viên:' : 'Student:'}{' '}
                                  {(res.assignedStudentNames && res.assignedStudentNames.length > 0
                                    ? res.assignedStudentNames
                                    : res.assignedStudentIds || []
                                  ).join(', ')}
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Title & 2-Line Summary */}
                        <div>
                          <h4 className="text-base font-display font-bold text-[#172154] group-hover:text-[#FF6B00] transition-colors leading-snug">
                            {lang === 'vi' ? res.titleVi : res.titleEn}
                          </h4>
                          {lang === 'bi' && (
                            <p className="text-xs text-[#172154]/55 mt-0.5 line-clamp-1">{res.titleVi}</p>
                          )}
                          <p className="text-xs text-[#172154]/70 mt-1.5 line-clamp-2 leading-relaxed">
                            {lang === 'vi' ? res.summaryVi : res.summaryEn}
                          </p>
                        </div>

                        {/* Returned Teacher Feedback Box on Card */}
                        {studentSub?.status === 'graded' && (studentSub.teacherFeedbackVi || studentSub.teacherFeedbackEn) && (
                          <div className="p-3 rounded-lg bg-[#F0FDF9] border border-[#0F766E]/20 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F766E]">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {lang === 'vi'
                                  ? `Nhận xét (${studentSub.gradedByName || studentSub.teacherName})`
                                  : `Feedback (${studentSub.gradedByName || studentSub.teacherName})`}
                              </span>
                              <span className="font-mono-num tabular-nums">{studentSub.gradeScore}/100</span>
                            </div>
                            <p className="text-xs text-[#172154]/80 leading-relaxed line-clamp-2">
                              {lang === 'vi'
                                ? studentSub.teacherFeedbackVi || studentSub.teacherFeedbackEn
                                : studentSub.teacherFeedbackEn || studentSub.teacherFeedbackVi}
                            </p>
                          </div>
                        )}

                        {/* Concise Skill & Key Vocabulary Strip */}
                        <div className="pt-2.5 border-t border-[#172154]/8 space-y-1 text-[11px] text-[#172154]/65">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#172154]/80">{res.skillFocus}</span>
                            <span className="font-mono-num tabular-nums">
                              {res.worksheetPrompts.length} Qs
                            </span>
                          </div>
                          {res.vocabularyFocus.length > 0 && (
                            <div className="truncate">
                              <span className="text-[#172154]/50">
                                {lang === 'vi' ? 'Từ vựng:' : 'Vocab:'}{' '}
                              </span>
                              <span className="font-medium text-[#172154]/80">
                                {res.vocabularyFocus.slice(0, 4).join(', ')}
                              </span>
                            </div>
                          )}
                          {res.materialLinkUrl && (
                            <a
                              href={res.materialLinkUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[#2D3E99] hover:text-[#FF6B00] underline pt-0.5"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {lang === 'vi' ? 'Mở Liên kết Học liệu' : 'Open Material Link'}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Card Footer Actions — Single Primary CTA + Subtle Secondary */}
                      <div className="pt-4 mt-4 border-t border-[#172154]/8 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => openResourceModal(res)}
                              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#FF6B00] text-white hover:bg-[#E05A00] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {studentSub?.status === 'graded'
                                ? lang === 'vi'
                                  ? 'Xem Điểm'
                                  : 'View Grade'
                                : lang === 'vi'
                                  ? 'Mở & Làm bài'
                                  : 'Open Exercise'}
                            </button>

                            <button
                              type="button"
                              onClick={() => triggerPrintableHandoutDownload(res, student?.fullName)}
                              className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-white text-[#172154] hover:bg-[#F8F9FB] transition-colors flex items-center gap-1 border border-[#172154]/12 cursor-pointer"
                              title={lang === 'vi' ? 'Tải xuống PDF khổ A4' : 'Download Printable A4 PDF Handout'}
                            >
                              <Download className="w-3.5 h-3.5 text-[#172154]/70" />
                              <span>PDF</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleCompleted(res.id)}
                            className={`p-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                            }`}
                            title={lang === 'vi' ? 'Đánh dấu hoàn thành' : 'Mark as completed'}
                          >
                            <BookmarkCheck className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Admin / Teacher Edit, Assign & Delete Controls for ALL Materials */}
                        {canManageResources && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-dashed border-stone-200">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
                              {lang === 'vi' ? 'Quản lý & Giao bài:' : 'Admin / Teacher:'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSelectEditResource(res)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                {lang === 'vi' ? 'Sửa & Giao bài' : 'Edit & Assign'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFirestoreResource(res)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                {lang === 'vi' ? 'Xóa' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Interactive Handout / Worksheet / Student Exercise Submission Modal */}
      {activeResource && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#1A1838] text-white px-6 py-5 flex items-start justify-between gap-4 sticky top-0 z-10">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-xs font-bold">
                    WEEK {String(activeResource.weekNumber).padStart(2, '0')} · {activeResource.code}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-white/15 text-indigo-100 text-xs font-semibold">
                    {activeResource.cefrLevel}
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-emerald-400/20 text-emerald-200 text-xs font-semibold">
                    {activeResource.skillFocus}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-serif font-bold text-white pt-1">
                  {activeResource.titleEn}
                </h3>
                <p className="text-xs text-amber-200/90">{activeResource.titleVi}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveResource(null)}
                className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Returned Teacher Grade & Feedback Banner inside Modal */}
              {(() => {
                const activeSub = studentSubmissionByResourceId.get(activeResource.id);
                if (!activeSub) return null;
                return (
                  <div
                    className={`rounded-2xl p-4 border space-y-2 ${
                      activeSub.status === 'graded'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-amber-50 border-amber-300 text-amber-950'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <ClipboardCheck className="w-4 h-4" />
                        {activeSub.status === 'graded'
                          ? lang === 'vi'
                            ? `BÀI TẬP ĐÃ ĐƯỢC GIÁO VIÊN CHẤM & TRẢ BÀI (${activeSub.gradedByName || activeSub.teacherName})`
                            : `GRADED & RETURNED BY TEACHER (${activeSub.gradedByName || activeSub.teacherName})`
                          : lang === 'vi'
                            ? `ĐÃ NỘP BÀI CHO GIÁO VIÊN ${activeSub.teacherName.toUpperCase()} — ĐANG CHỜ CHẤM ĐIỂM`
                            : `SUBMITTED TO TEACHER ${activeSub.teacherName.toUpperCase()} — AWAITING GRADE`}
                      </span>
                      {activeSub.status === 'graded' && (
                        <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-mono text-sm font-extrabold">
                          {activeSub.gradeScore} / 100
                        </span>
                      )}
                    </div>
                    {activeSub.status === 'graded' && (
                      <div className="space-y-1 text-xs pt-1 border-t border-emerald-200">
                        {activeSub.teacherFeedbackEn && (
                          <p className="font-semibold text-emerald-950">EN: {activeSub.teacherFeedbackEn}</p>
                        )}
                        {activeSub.teacherFeedbackVi && (
                          <p className="text-emerald-900">VI: {activeSub.teacherFeedbackVi}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Attached PDF or External Class Material Link */}
              {(activeResource.fileBase64 || activeResource.noteId || activeResource.materialLinkUrl) && (
                <div className="bg-indigo-950 text-white rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-indigo-800">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      {lang === 'vi'
                        ? 'Tài liệu Lớp học & Tệp Đính kèm'
                        : 'Attached Class Handout & Material Link'}
                    </div>
                    <p className="text-xs text-indigo-100">
                      {activeResource.fileName || `${activeResource.code}.pdf`}
                      {activeResource.uploadedByName ? ` · Uploaded by ${activeResource.uploadedByName}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeResource.materialLinkUrl && (
                      <a
                        href={activeResource.materialLinkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-400 text-slate-950 hover:bg-emerald-300 flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {lang === 'vi' ? 'Mở Liên kết Tài liệu Lớp' : 'Open Class Material Link'}
                      </a>
                    )}
                    {onOpenReadOnlyNote && activeResource.noteId && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenReadOnlyNote({
                            noteId: activeResource.noteId!,
                            note: activeResource.note,
                            fallbackTitle: activeResource.titleEn
                          });
                          setActiveResource(null);
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {lang === 'vi' ? 'Xem toàn màn hình' : 'Open PDF Viewer'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => triggerPrintableHandoutDownload(activeResource, student?.fullName)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/15 text-white hover:bg-white/25 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {lang === 'vi' ? 'Tải PDF' : 'Download PDF'}
                    </button>
                  </div>
                </div>
              )}

              {/* Vocabulary & Grammar Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                    {lang === 'vi' ? 'Từ vựng Trọng tâm' : 'Target Vocabulary'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeResource.vocabularyFocus.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => speakPassage(w)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-xs font-bold text-indigo-900 hover:bg-indigo-50 flex items-center gap-1 cursor-pointer"
                      >
                        <Volume2 className="w-3 h-3 text-indigo-600" />
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                    {lang === 'vi' ? 'Ngữ âm & Cấu trúc Câu' : 'Phonics & Grammar Structure'}
                  </div>
                  <p className="text-xs font-semibold text-stone-800 leading-relaxed">
                    {activeResource.phonicsOrGrammarFocus}
                  </p>
                </div>
              </div>

              {/* Reading Passage (if present) */}
              {activeResource.readingPassageEn && (
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-700" />
                      {lang === 'vi' ? 'Bài đọc Song ngữ & Ngữ cảnh' : 'Bilingual Reading Passage'}
                    </span>
                    <button
                      type="button"
                      onClick={() => speakPassage(activeResource.readingPassageEn || '')}
                      className="px-3 py-1 rounded-lg bg-amber-200/70 hover:bg-amber-200 text-amber-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      {lang === 'vi' ? 'Nghe Phát âm Mẫu' : 'Listen Aloud'}
                    </button>
                  </div>
                  <p className="text-sm sm:text-base font-serif text-stone-900 leading-relaxed">
                    "{activeResource.readingPassageEn}"
                  </p>
                  {activeResource.readingPassageVi && (
                    <p className="text-xs sm:text-sm text-stone-600 italic border-t border-amber-200/60 pt-2.5 leading-relaxed">
                      "{activeResource.readingPassageVi}"
                    </p>
                  )}
                </div>
              )}

              {/* Interactive Practice Worksheet Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-700" />
                    {lang === 'vi'
                      ? 'Bài tập Thực hành (Chọn đáp án & Nộp cho Giáo viên)'
                      : 'Interactive Exercise Questions (Complete & Submit to Assigned Teacher)'}
                  </h4>
                  <span className="text-xs text-stone-500">
                    {activeResource.worksheetPrompts.length} {lang === 'vi' ? 'câu hỏi' : 'questions'}
                  </span>
                </div>

                {activeResource.worksheetPrompts.map((prompt, qIdx) => {
                  const key = `${activeResource.id}-q${qIdx}`;
                  const chosen = selectedAnswers[key];
                  const isCorrect = chosen === prompt.answerKey;

                  return (
                    <div key={key} className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-stone-900">
                          {qIdx + 1}. {prompt.questionEn}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">{prompt.questionVi}</div>
                      </div>

                      {prompt.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {prompt.options.map((opt) => {
                            const isSelected = chosen === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setSelectedAnswers((prev) => ({ ...prev, [key]: opt }))}
                                className={`text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? opt === prompt.answerKey
                                      ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                                      : 'bg-rose-100 border-rose-300 text-rose-900'
                                    : 'bg-white border-stone-200 text-stone-700 hover:border-indigo-300'
                                }`}
                              >
                                <span>{opt}</span>
                                {isSelected && (
                                  <span className="text-[10px] font-bold uppercase">
                                    {isCorrect ? '✓ Correct' : 'Selected'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Student Written Answer / Reflection Note to Teacher */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2">
                  <label className="block text-xs font-bold text-indigo-950">
                    {lang === 'vi'
                      ? 'Câu đặt thêm / Ghi chú Bài làm gửi Giáo viên chấm điểm:'
                      : 'Student Written Sentences / Reflection Note for Teacher Grading:'}
                  </label>
                  <textarea
                    rows={2}
                    value={studentSubmissionNotes}
                    onChange={(e) => setStudentSubmissionNotes(e.target.value)}
                    placeholder={
                      lang === 'vi'
                        ? 'Viết câu tiếng Anh tự đặt hoặc lời nhắn gửi Thầy/Cô phụ trách...'
                        : 'Write your own practice sentences or a note for your assigned teacher...'
                    }
                    className="w-full p-2.5 rounded-xl border border-indigo-200 bg-white text-xs text-stone-800"
                  />
                </div>
              </div>

              {/* Parent Coaching Tip */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold text-indigo-950 uppercase tracking-wider">
                    {lang === 'vi' ? 'Gợi ý Thực hành tại Nhà' : 'Home Practice Coaching Tip'}
                  </div>
                  <p className="text-indigo-900 font-medium">{activeResource.parentTipEn}</p>
                  <p className="text-indigo-700/90">{activeResource.parentTipVi}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerPrintableHandoutDownload(activeResource, student?.fullName)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-stone-200 text-stone-800 hover:bg-stone-300 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-indigo-800" />
                  {lang === 'vi' ? 'Tải & In PDF A4' : 'Download A4 PDF'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmittingExercise}
                  onClick={() => void handleSubmitExerciseToTeacher(activeResource)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#E61E64] hover:bg-[#c81855] text-white flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmittingExercise
                    ? lang === 'vi'
                      ? 'Đang gửi tới Giáo viên...'
                      : 'Sending to Teacher...'
                    : studentSubmissionByResourceId.has(activeResource.id)
                      ? lang === 'vi'
                        ? 'Cập nhật & Gửi lại Bài tập cho Giáo viên'
                        : 'Resubmit Exercise to Assigned Teacher'
                      : lang === 'vi'
                        ? 'Hoàn thành & Gửi Bài tập cho Giáo viên Chấm'
                        : 'Finish & Submit Exercise to Assigned Teacher'}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveResource(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {lang === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

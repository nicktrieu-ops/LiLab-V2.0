import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Bold,
  BookMarked,
  Check,
  CheckCircle2,
  CheckSquare,
  Cloud,
  Heading2,
  Highlighter,
  List,
  Network,
  NotebookPen,
  Plus,
  Search,
  Square,
  Trash2,
  Type,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { biText } from '../i18n';
import { isSuperAdminEmail } from '../services/seedData';
import type {
  LangCode,
  MindMapSeedPayload,
  StudentProfile,
  StudentStudyNoteRecord,
  StudyNoteBlock,
  StudyNoteBlockType,
  StudyVocabItem,
  UserProfile,
} from '../types';

interface StudentStudyNotesProps {
  lang: LangCode;
  currentUser: UserProfile;
  student: StudentProfile | null;
  onConvertToMindMap: (seed: MindMapSeedPayload) => void;
}

const SUBJECT_TAGS = [
  'Reading & Story',
  'Speaking',
  'Writing',
  'Vocabulary',
  'Be Whole Values',
  'Grammar & CEFR',
] as const;

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function createStarterBlocks(lang: LangCode): StudyNoteBlock[] {
  return [
    {
      id: makeId('blk'),
      type: 'heading',
      text: biText(lang, 'Lesson Highlights', 'Điểm Chính Của Bài Học'),
    },
    {
      id: makeId('blk'),
      type: 'bullet',
      text: biText(
        lang,
        'Small acts of kindness can make a big difference for our friends.',
        'Những hành động tử tế nhỏ bé có thể tạo ra sự khác biệt lớn cho bạn bè.'
      ),
      selectedForMap: true,
    },
    {
      id: makeId('blk'),
      type: 'bullet',
      text: biText(
        lang,
        'Practice speaking clearly in full sentences with confident eye contact.',
        'Luyện nói rõ ràng cả câu và giao tiếp bằng ánh mắt tự tin.'
      ),
      selectedForMap: true,
    },
    {
      id: makeId('blk'),
      type: 'checklist',
      text: biText(lang, 'Read the story aloud for 5 minutes at home', 'Đọc to câu chuyện 5 phút ở nhà'),
      checked: false,
      selectedForMap: true,
    },
  ];
}

function createStarterVocab(lang: LangCode): StudyVocabItem[] {
  return [
    {
      id: makeId('voc'),
      word: 'courageous',
      meaning: biText(lang, 'brave and willing to try new things', 'dũng cảm và sẵn sàng thử điều mới'),
      example: 'The tiny mouse was courageous when he helped the lion.',
    },
    {
      id: makeId('voc'),
      word: 'gratitude',
      meaning: biText(lang, 'feeling thankful and showing appreciation', 'lòng biết ơn và sự trân trọng'),
      example: 'We show gratitude by saying thank you with a smile.',
    },
  ];
}

export const StudentStudyNotes: React.FC<StudentStudyNotesProps> = ({
  lang,
  currentUser,
  student,
  onConvertToMindMap,
}) => {
  const studentId = student?.id || `user_${currentUser.uid}`;
  const studentName = student?.fullName || currentUser.displayName || 'LiLab Student';
  const defaultCefr = student?.cefrLevel || 'Pre-A1 Starters';

  const [savedNotes, setSavedNotes] = useState<StudentStudyNoteRecord[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Active note editor state
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>(
    biText(lang, 'Week 01 · Kindness & Storytelling Notes', 'Tuần 01 · Ghi Chú Lòng Tốt & Kể Chuyện')
  );
  const [subjectTag, setSubjectTag] = useState<string>('Reading & Story');
  const [cefrUnit, setCefrUnit] = useState<string>(defaultCefr);
  const [blocks, setBlocks] = useState<StudyNoteBlock[]>(() => createStarterBlocks(lang));
  const [vocabItems, setVocabItems] = useState<StudyVocabItem[]>(() => createStarterVocab(lang));
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  // Add vocab form
  const [newVocabWord, setNewVocabWord] = useState('');
  const [newVocabMeaning, setNewVocabMeaning] = useState('');
  const [newVocabExample, setNewVocabExample] = useState('');

  // Auto-save state
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const hasAutoLoadedFirstRef = useRef(false);

  // Subscribe to student's saved study notes
  useEffect(() => {
    const email = (currentUser.email || '').toLowerCase();
    const isAdminAccount =
      isSuperAdminEmail(email) || currentUser.role === 'super_admin' || currentUser.role === 'admin';

    const notesQuery = isAdminAccount
      ? collection(db, 'student_study_notes')
      : query(collection(db, 'student_study_notes'), where('ownerUid', '==', currentUser.uid));

    const unsub = onSnapshot(
      notesQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as StudentStudyNoteRecord))
          .filter((n) => !student || n.studentId === student.id || n.ownerUid === currentUser.uid);

        list.sort((a, b) => {
          const ta = (a.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0;
          const tb = (b.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0;
          return tb - ta;
        });

        setSavedNotes(list);
        setNotesLoaded(true);

        if (!hasAutoLoadedFirstRef.current && list.length > 0) {
          hasAutoLoadedFirstRef.current = true;
          loadNoteIntoEditor(list[0]);
        }
      },
      (err) => {
        setNotesLoaded(true);
        handleFirestoreError(err, OperationType.LIST, 'student_study_notes');
      }
    );

    return () => unsub();
  }, [currentUser.uid, currentUser.email, currentUser.role, student?.id]);

  const loadNoteIntoEditor = (rec: StudentStudyNoteRecord) => {
    setActiveNoteId(rec.id);
    setTitle(rec.title);
    setSubjectTag(rec.subjectTag || 'Reading & Story');
    setCefrUnit(rec.cefrLevel || defaultCefr);
    try {
      const parsedBlocks = JSON.parse(rec.blocksJson) as StudyNoteBlock[];
      setBlocks(Array.isArray(parsedBlocks) && parsedBlocks.length > 0 ? parsedBlocks : createStarterBlocks(lang));
    } catch {
      setBlocks(createStarterBlocks(lang));
    }
    try {
      const parsedVocab = JSON.parse(rec.vocabJson) as StudyVocabItem[];
      setVocabItems(Array.isArray(parsedVocab) ? parsedVocab : []);
    } catch {
      setVocabItems([]);
    }
    setDirty(false);
    setSaveStatus('saved');
    setConfirmDeleteId(null);
  };

  const handleCreateNewNote = () => {
    setActiveNoteId(null);
    setTitle(biText(lang, 'New Lesson Note', 'Ghi Chú Bài Học Mới'));
    setSubjectTag('Reading & Story');
    setCefrUnit(defaultCefr);
    setBlocks([
      {
        id: makeId('blk'),
        type: 'heading',
        text: biText(lang, 'Key Takeaways', 'Ý Chính Cần Nhớ'),
      },
      {
        id: makeId('blk'),
        type: 'bullet',
        text: '',
        selectedForMap: true,
      },
    ]);
    setVocabItems([]);
    setDirty(true);
    setSaveStatus('idle');
  };

  const persistNote = async () => {
    setSaveStatus('saving');
    try {
      const cleanTitle = title.trim().slice(0, 160) || biText(lang, 'Untitled Note', 'Ghi Chú Chưa Đặt Tên');
      const cleanSubject = subjectTag.trim().slice(0, 80) || 'Reading & Story';
      const cleanCefr = cefrUnit.trim().slice(0, 60) || defaultCefr;
      const blocksJson = JSON.stringify(blocks).slice(0, 49500);
      const vocabJson = JSON.stringify(vocabItems).slice(0, 14500);
      const firstText = blocks.find((b) => b.text.trim())?.text.trim() || cleanTitle;
      const excerpt = firstText.slice(0, 260);

      if (activeNoteId) {
        await updateDoc(doc(db, 'student_study_notes', activeNoteId), {
          title: cleanTitle,
          subjectTag: cleanSubject,
          cefrLevel: cleanCefr,
          blocksJson,
          vocabJson,
          excerpt,
          updatedAt: serverTimestamp(),
        });
      } else {
        const docId = `snote_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const payload: Record<string, unknown> = {
          studentId: studentId.slice(0, 128),
          studentName: studentName.slice(0, 120),
          ownerUid: currentUser.uid.slice(0, 128),
          title: cleanTitle,
          subjectTag: cleanSubject,
          cefrLevel: cleanCefr,
          blocksJson,
          vocabJson,
          excerpt,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (student?.studentEmail) payload.studentEmail = student.studentEmail.toLowerCase().slice(0, 160);
        if (student?.parentEmail) payload.parentEmail = student.parentEmail.toLowerCase().slice(0, 160);

        await setDoc(doc(db, 'student_study_notes', docId), payload);
        setActiveNoteId(docId);
      }

      setDirty(false);
      setSaveStatus('saved');
      setLastSavedTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err) {
      setSaveStatus('idle');
      handleFirestoreError(err, OperationType.WRITE, 'student_study_notes');
    }
  };

  // Debounced auto-save whenever edits occur
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      void persistNote();
    }, 1100);
    return () => clearTimeout(timer);
  }, [dirty, title, subjectTag, cefrUnit, blocks, vocabItems, activeNoteId]);

  const markDirty = () => {
    setDirty(true);
    setSaveStatus('saving');
  };

  const updateBlock = (id: string, patch: Partial<StudyNoteBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    markDirty();
  };

  const insertBlock = (type: StudyNoteBlockType, afterId?: string | null) => {
    const newBlock: StudyNoteBlock = {
      id: makeId('blk'),
      type,
      text: '',
      checked: type === 'checklist' ? false : undefined,
      selectedForMap: type === 'bullet' || type === 'checklist',
    };
    setBlocks((prev) => {
      if (!afterId) return [...prev, newBlock];
      const idx = prev.findIndex((b) => b.id === afterId);
      if (idx === -1) return [...prev, newBlock];
      const copy = [...prev];
      copy.splice(idx + 1, 0, newBlock);
      return copy;
    });
    setFocusedBlockId(newBlock.id);
    markDirty();
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => {
      if (prev.length <= 1) return [{ ...prev[0], text: '' }];
      return prev.filter((b) => b.id !== id);
    });
    markDirty();
  };

  const handleAddVocab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVocabWord.trim()) return;
    setVocabItems((prev) => [
      ...prev,
      {
        id: makeId('voc'),
        word: newVocabWord.trim().slice(0, 60),
        meaning: newVocabMeaning.trim().slice(0, 140),
        example: newVocabExample.trim().slice(0, 180) || undefined,
      },
    ]);
    setNewVocabWord('');
    setNewVocabMeaning('');
    setNewVocabExample('');
    markDirty();
  };

  const handleDeleteVocab = (id: string) => {
    setVocabItems((prev) => prev.filter((v) => v.id !== id));
    markDirty();
  };

  const handleDeleteNote = async (rec: StudentStudyNoteRecord) => {
    try {
      await deleteDoc(doc(db, 'student_study_notes', rec.id));
      setConfirmDeleteId(null);
      if (activeNoteId === rec.id) {
        const remaining = savedNotes.filter((n) => n.id !== rec.id);
        if (remaining.length > 0) {
          loadNoteIntoEditor(remaining[0]);
        } else {
          handleCreateNewNote();
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'student_study_notes');
    }
  };

  // Key points selected for conversion to Mind Map Studio
  const selectedKeyPoints = useMemo(() => {
    const explicit = blocks
      .filter((b) => b.selectedForMap && b.text.trim())
      .map((b) => b.text.trim());
    if (explicit.length > 0) return explicit;
    return blocks
      .filter((b) => (b.type === 'bullet' || b.type === 'checklist' || b.type === 'heading') && b.text.trim())
      .map((b) => b.text.trim());
  }, [blocks]);

  const handleConvertClick = () => {
    onConvertToMindMap({
      seedId: makeId('seed'),
      title: title.trim() || biText(lang, 'Study Notes Mind Map', 'Sơ Đồ Từ Sổ Tay'),
      topicTag: subjectTag,
      cefrLevel: cefrUnit,
      points:
        selectedKeyPoints.length > 0
          ? selectedKeyPoints
          : [biText(lang, 'Main Idea 1', 'Ý chính 1'), biText(lang, 'Main Idea 2', 'Ý chính 2')],
      vocabWords: vocabItems.map((v) => ({ word: v.word, meaning: v.meaning })),
    });
  };

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return savedNotes.filter((n) => {
      if (subjectFilter !== 'all' && n.subjectTag !== subjectFilter) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.subjectTag.toLowerCase().includes(q) ||
        n.cefrLevel.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q)
      );
    });
  }, [savedNotes, searchQuery, subjectFilter]);

  const focusedBlock = blocks.find((b) => b.id === focusedBlockId) || null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left Sidebar: Saved Notes & Quick Filters */}
      <aside className="xl:col-span-4 bg-white rounded-2xl border border-[#172154]/10 p-4 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NotebookPen className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="font-display text-base font-extrabold text-[#172154]">
              {biText(lang, 'My Study Notes', 'Sổ Tay Học Tập')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCreateNewNote}
            className="px-3 py-1.5 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{biText(lang, 'New Note', 'Ghi Chú Mới')}</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#172154]/45 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={biText(lang, 'Search notes, units, or topics...', 'Tìm ghi chú, bài học...')}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[#172154]/12 bg-[#F8F9FB] text-xs focus:bg-white focus:border-[#FF6B00] focus:outline-none"
          />
        </div>

        {/* Subject Filter Chips (Interactive Buttons) */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setSubjectFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              subjectFilter === 'all'
                ? 'bg-[#FF6B00] text-white'
                : 'bg-[#F8F9FB] text-[#172154]/70 hover:text-[#172154]'
            }`}
          >
            {biText(lang, 'All', 'Tất cả')}
          </button>
          {SUBJECT_TAGS.slice(0, 5).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSubjectFilter(tag)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                subjectFilter === tag
                  ? 'bg-[#FF6B00] text-white'
                  : 'bg-[#F8F9FB] text-[#172154]/70 hover:text-[#172154]'
              }`}
            >
              {tag.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Saved Notes List */}
        <div className="space-y-2 max-h-[540px] overflow-y-auto pr-0.5">
          {!notesLoaded ? (
            <div className="text-xs text-[#172154]/55 py-6 text-center">
              {biText(lang, 'Loading notebook...', 'Đang tải sổ tay...')}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-4 rounded-xl bg-[#F8F9FB] border border-[#172154]/8 text-xs text-[#172154]/65 text-center leading-relaxed">
              {biText(
                lang,
                'Start typing on the right — your lesson notes will auto-save here automatically.',
                'Hãy bắt đầu viết bên phải — ghi chú bài học sẽ tự động lưu tại đây.'
              )}
            </div>
          ) : (
            filteredNotes.map((rec) => {
              const isActive = activeNoteId === rec.id;
              return (
                <div
                  key={rec.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    isActive
                      ? 'bg-[#FFF5EE] border-[#FF6B00]'
                      : 'bg-white border-[#172154]/10 hover:border-[#172154]/25'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => loadNoteIntoEditor(rec)}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="text-xs font-extrabold text-[#172154] truncate">
                        {rec.title}
                      </div>
                      <div className="text-[11px] text-[#FF6B00] font-semibold mt-0.5">
                        {rec.subjectTag} · {rec.cefrLevel}
                      </div>
                      <p className="text-[11px] text-[#172154]/60 line-clamp-2 mt-1">
                        {rec.excerpt}
                      </p>
                    </button>

                    {confirmDeleteId === rec.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleDeleteNote(rec)}
                          className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold cursor-pointer"
                        >
                          {biText(lang, 'Delete', 'Xoá')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-0.5 rounded border border-[#172154]/15 text-[10px] font-semibold cursor-pointer"
                        >
                          {biText(lang, 'No', 'Huỷ')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(rec.id)}
                        className="p-1 text-[#172154]/40 hover:text-red-600 cursor-pointer shrink-0"
                        title={biText(lang, 'Delete note', 'Xoá ghi chú')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Distraction-Free Notebook Editor */}
      <section className="xl:col-span-8 bg-white rounded-2xl border border-[#172154]/10 overflow-hidden">
        {/* Top Editor Status & Convert to Mind Map CTA */}
        <div className="px-5 py-3.5 border-b border-[#172154]/10 bg-[#F8F9FB] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={subjectTag}
              onChange={(e) => {
                setSubjectTag(e.target.value);
                markDirty();
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[#172154]/12 bg-white text-xs font-semibold text-[#172154] focus:border-[#FF6B00] focus:outline-none"
            >
              {SUBJECT_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={cefrUnit}
              onChange={(e) => {
                setCefrUnit(e.target.value);
                markDirty();
              }}
              placeholder="CEFR Unit"
              className="w-36 px-2.5 py-1.5 rounded-lg border border-[#172154]/12 bg-white text-xs font-semibold text-[#172154] focus:border-[#FF6B00] focus:outline-none"
            />

            {/* Auto-Save Indicator */}
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#172154]/60 pl-1">
              {saveStatus === 'saving' ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-[#FF6B00] animate-pulse" />
                  <span>{biText(lang, 'Auto-saving...', 'Đang tự động lưu...')}</span>
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>
                    {lastSavedTime
                      ? biText(lang, `Saved ${lastSavedTime}`, `Đã lưu ${lastSavedTime}`)
                      : biText(lang, 'Saved', 'Đã lưu')}
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void persistNote()}
                  className="text-xs font-semibold text-[#FF6B00] hover:underline cursor-pointer"
                >
                  {biText(lang, 'Save now', 'Lưu ngay')}
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleConvertClick}
            className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Network className="w-4 h-4" />
            <span>
              {biText(
                lang,
                `Convert Key Points to Mind Map (${selectedKeyPoints.length})`,
                `Chuyển Ý Chính Sang Sơ Đồ Tư Duy (${selectedKeyPoints.length})`
              )}
            </span>
          </button>
        </div>

        {/* Formatting Toolbar */}
        <div className="px-5 py-2.5 border-b border-[#172154]/8 bg-white flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => insertBlock('heading', focusedBlockId)}
            className="px-2.5 py-1.5 rounded-lg border border-[#172154]/10 hover:border-[#FF6B00]/45 hover:bg-[#FFF5EE] text-xs font-semibold text-[#172154] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Heading2 className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>{biText(lang, 'Heading', 'Tiêu đề')}</span>
          </button>
          <button
            type="button"
            onClick={() => insertBlock('bullet', focusedBlockId)}
            className="px-2.5 py-1.5 rounded-lg border border-[#172154]/10 hover:border-[#FF6B00]/45 hover:bg-[#FFF5EE] text-xs font-semibold text-[#172154] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <List className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>{biText(lang, 'Bullet', 'Gạch đầu dòng')}</span>
          </button>
          <button
            type="button"
            onClick={() => insertBlock('checklist', focusedBlockId)}
            className="px-2.5 py-1.5 rounded-lg border border-[#172154]/10 hover:border-[#FF6B00]/45 hover:bg-[#FFF5EE] text-xs font-semibold text-[#172154] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>{biText(lang, 'Checklist', 'Danh sách việc')}</span>
          </button>
          <button
            type="button"
            onClick={() => insertBlock('paragraph', focusedBlockId)}
            className="px-2.5 py-1.5 rounded-lg border border-[#172154]/10 hover:border-[#FF6B00]/45 hover:bg-[#FFF5EE] text-xs font-semibold text-[#172154] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Type className="w-3.5 h-3.5 text-[#172154]/65" />
            <span>{biText(lang, 'Text', 'Đoạn văn')}</span>
          </button>

          <div className="h-5 w-px bg-[#172154]/12 mx-1" />

          <button
            type="button"
            disabled={!focusedBlock}
            onClick={() => focusedBlock && updateBlock(focusedBlock.id, { bold: !focusedBlock.bold })}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors ${
              focusedBlock?.bold
                ? 'bg-[#172154] text-white border-[#172154]'
                : 'border-[#172154]/10 text-[#172154] hover:bg-[#F8F9FB]'
            }`}
          >
            <Bold className="w-3.5 h-3.5" />
            <span>{biText(lang, 'Bold', 'Đậm')}</span>
          </button>

          <button
            type="button"
            disabled={!focusedBlock}
            onClick={() =>
              focusedBlock && updateBlock(focusedBlock.id, { highlight: !focusedBlock.highlight })
            }
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 transition-colors ${
              focusedBlock?.highlight
                ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
                : 'border-[#172154]/10 text-[#172154] hover:bg-[#F8F9FB]'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>{biText(lang, 'Highlight', 'Tô sáng')}</span>
          </button>
        </div>

        {/* Crisp Paper Editor Canvas */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Note Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            placeholder={biText(lang, 'Lesson Title...', 'Tiêu đề bài học...')}
            className="w-full font-display text-2xl sm:text-3xl font-extrabold text-[#172154] tracking-tight placeholder:text-[#172154]/25 focus:outline-none"
          />

          {/* Structured Note Blocks */}
          <div className="space-y-2.5">
            {blocks.map((block) => {
              const isFocused = focusedBlockId === block.id;
              return (
                <div
                  key={block.id}
                  className={`group flex items-start gap-2.5 rounded-xl px-3 py-2 transition-colors ${
                    block.highlight
                      ? 'bg-[#FEF3C7]/70'
                      : isFocused
                        ? 'bg-[#F8F9FB]'
                        : 'hover:bg-[#F8F9FB]/60'
                  }`}
                >
                  {/* Prefix marker by block type */}
                  {block.type === 'bullet' && (
                    <span className="w-2 h-2 rounded-full bg-[#FF6B00] mt-2.5 shrink-0" />
                  )}
                  {block.type === 'checklist' && (
                    <button
                      type="button"
                      onClick={() => updateBlock(block.id, { checked: !block.checked })}
                      className="mt-1 text-[#FF6B00] cursor-pointer shrink-0"
                    >
                      {block.checked ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4 text-[#172154]/40" />
                      )}
                    </button>
                  )}

                  {/* Editable Text */}
                  <input
                    type="text"
                    value={block.text}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        insertBlock(block.type === 'heading' ? 'bullet' : block.type, block.id);
                      }
                    }}
                    placeholder={
                      block.type === 'heading'
                        ? biText(lang, 'Section heading...', 'Tiêu đề mục...')
                        : block.type === 'checklist'
                          ? biText(lang, 'Study task to complete...', 'Nhiệm vụ cần hoàn thành...')
                          : biText(lang, 'Write a key point or lesson note...', 'Viết ý chính hoặc ghi chú bài học...')
                    }
                    className={`w-full bg-transparent focus:outline-none ${
                      block.type === 'heading'
                        ? 'font-display text-lg font-extrabold text-[#172154] pt-1'
                        : 'text-sm text-[#172154] leading-relaxed'
                    } ${block.bold ? 'font-bold' : ''} ${
                      block.checked ? 'line-through text-[#172154]/45' : ''
                    }`}
                  />

                  {/* Select-for-Mind-Map toggle + remove */}
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {(block.type === 'bullet' || block.type === 'checklist') && (
                      <button
                        type="button"
                        onClick={() =>
                          updateBlock(block.id, { selectedForMap: !block.selectedForMap })
                        }
                        title={biText(
                          lang,
                          'Include in Mind Map conversion',
                          'Chọn đưa vào Sơ đồ Tư duy'
                        )}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          block.selectedForMap
                            ? 'bg-[#FFF5EE] text-[#FF6B00] border border-[#FF6B00]/30'
                            : 'bg-white text-[#172154]/45 border border-[#172154]/10 hover:text-[#172154]'
                        }`}
                      >
                        {block.selectedForMap && <Check className="w-3 h-3" />}
                        <span>{biText(lang, 'Map', 'Sơ đồ')}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      className="p-1 text-[#172154]/30 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                      title={biText(lang, 'Delete line', 'Xoá dòng')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Key Vocabulary Callout Boxes */}
          <div className="pt-5 border-t border-[#172154]/10 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-[#FF6B00]" />
                <h3 className="font-display text-sm font-extrabold text-[#172154]">
                  {biText(lang, 'Key Vocabulary Callouts', 'Hộp Từ Vựng Trọng Tâm')}
                </h3>
              </div>
              <span className="text-xs font-mono-num tabular-nums text-[#172154]/60">
                {vocabItems.length} {biText(lang, 'words', 'từ')}
              </span>
            </div>

            {vocabItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vocabItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[#FFF9F4] border border-[#FF6B00]/20 p-3.5 space-y-1 relative group"
                  >
                    <button
                      type="button"
                      onClick={() => handleDeleteVocab(item.id)}
                      className="absolute top-2.5 right-2.5 p-1 text-[#172154]/35 hover:text-red-600 opacity-0 group-hover:opacity-100 cursor-pointer"
                      title={biText(lang, 'Remove word', 'Xoá từ')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="font-display text-sm font-extrabold text-[#FF6B00]">
                      {item.word}
                    </div>
                    {item.meaning && (
                      <div className="text-xs font-medium text-[#172154]">{item.meaning}</div>
                    )}
                    {item.example && (
                      <div className="text-[11px] italic text-[#172154]/65 pt-0.5">
                        “{item.example}”
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Quick Add Vocabulary Form */}
            <form
              onSubmit={handleAddVocab}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-[#F8F9FB] p-3 rounded-xl border border-[#172154]/8"
            >
              <input
                type="text"
                value={newVocabWord}
                onChange={(e) => setNewVocabWord(e.target.value)}
                placeholder={biText(lang, 'New word...', 'Từ mới...')}
                className="sm:col-span-3 px-3 py-1.5 rounded-lg border border-[#172154]/12 bg-white text-xs font-semibold focus:border-[#FF6B00] focus:outline-none"
              />
              <input
                type="text"
                value={newVocabMeaning}
                onChange={(e) => setNewVocabMeaning(e.target.value)}
                placeholder={biText(lang, 'Meaning / definition...', 'Nghĩa của từ...')}
                className="sm:col-span-4 px-3 py-1.5 rounded-lg border border-[#172154]/12 bg-white text-xs focus:border-[#FF6B00] focus:outline-none"
              />
              <input
                type="text"
                value={newVocabExample}
                onChange={(e) => setNewVocabExample(e.target.value)}
                placeholder={biText(lang, 'Example sentence (optional)', 'Câu ví dụ (tuỳ chọn)')}
                className="sm:col-span-3 px-3 py-1.5 rounded-lg border border-[#172154]/12 bg-white text-xs focus:border-[#FF6B00] focus:outline-none"
              />
              <button
                type="submit"
                className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-[#172154] hover:bg-[#FF6B00] text-white text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{biText(lang, 'Add', 'Thêm')}</span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

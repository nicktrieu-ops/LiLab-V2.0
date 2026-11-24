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
  CheckCircle2,
  Download,
  GitBranch,
  Maximize2,
  Network,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { biText } from '../i18n';
import { isSuperAdminEmail } from '../services/seedData';
import type {
  LangCode,
  MindMapBranchColor,
  MindMapNode,
  MindMapSeedPayload,
  StudentMindMapRecord,
  StudentProfile,
  UserProfile,
} from '../types';

interface StudentMindMapStudioProps {
  lang: LangCode;
  currentUser: UserProfile;
  student: StudentProfile | null;
  incomingSeed?: MindMapSeedPayload | null;
  onConsumeSeed?: () => void;
}

const BRANCH_COLORS: Array<{ hex: MindMapBranchColor; labelEn: string; labelVi: string }> = [
  { hex: '#FF6B00', labelEn: 'Orange', labelVi: 'Cam' },
  { hex: '#2563EB', labelEn: 'Blue', labelVi: 'Xanh dương' },
  { hex: '#0D9488', labelEn: 'Teal', labelVi: 'Ngọc lam' },
  { hex: '#E61E64', labelEn: 'Rose', labelVi: 'Hồng' },
  { hex: '#D97706', labelEn: 'Amber', labelVi: 'Vàng hổ phách' },
  { hex: '#7C3AED', labelEn: 'Violet', labelVi: 'Tím' },
];

const CANVAS_CENTER_X = 600;
const CANVAS_CENTER_Y = 340;

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function buildStarterNodes(
  template: 'story' | 'vocab' | 'lesson' | 'blank',
  lang: LangCode,
  studentName: string
): { title: string; topicTag: string; nodes: MindMapNode[] } {
  const rootId = 'root';
  if (template === 'vocab') {
    return {
      title: biText(lang, 'My Vocabulary Tree', 'Cây Từ Vựng Của Em'),
      topicTag: 'Vocabulary',
      nodes: [
        { id: rootId, parentId: null, label: biText(lang, 'Nature & Animals', 'Thiên Nhiên & Động Vật'), x: CANVAS_CENTER_X, y: CANVAS_CENTER_Y, color: '#FF6B00' },
        { id: 'b1', parentId: rootId, label: biText(lang, 'Forest Animals', 'Động vật rừng'), x: 330, y: 195, color: '#0D9488' },
        { id: 'b1a', parentId: 'b1', label: 'brave lion', x: 130, y: 135, color: '#0D9488' },
        { id: 'b1b', parentId: 'b1', label: 'tiny mouse', x: 130, y: 245, color: '#0D9488' },
        { id: 'b2', parentId: rootId, label: biText(lang, 'Action Verbs', 'Động từ hành động'), x: 870, y: 195, color: '#2563EB' },
        { id: 'b2a', parentId: 'b2', label: 'rescue / help', x: 1065, y: 145, color: '#2563EB' },
        { id: 'b2b', parentId: 'b2', label: 'discover', x: 1065, y: 245, color: '#2563EB' },
        { id: 'b3', parentId: rootId, label: biText(lang, 'Kind Words', 'Lời nói tử tế'), x: 855, y: 490, color: '#E61E64' },
        { id: 'b4', parentId: rootId, label: biText(lang, 'Example Sentences', 'Câu ví dụ'), x: 345, y: 490, color: '#7C3AED' },
      ],
    };
  }
  if (template === 'lesson') {
    return {
      title: biText(lang, 'Unit Lesson Map', 'Sơ Đồ Bài Học'),
      topicTag: 'Lesson Summary',
      nodes: [
        { id: rootId, parentId: null, label: biText(lang, 'Today’s Lesson', 'Bài Học Hôm Nay'), x: CANVAS_CENTER_X, y: CANVAS_CENTER_Y, color: '#FF6B00' },
        { id: 'l1', parentId: rootId, label: biText(lang, 'Key Ideas', 'Ý chính'), x: 340, y: 210, color: '#2563EB' },
        { id: 'l2', parentId: rootId, label: biText(lang, 'New Words', 'Từ mới'), x: 860, y: 210, color: '#0D9488' },
        { id: 'l3', parentId: rootId, label: biText(lang, 'My Questions', 'Câu hỏi của em'), x: 860, y: 475, color: '#D97706' },
        { id: 'l4', parentId: rootId, label: biText(lang, 'Practice Plan', 'Kế hoạch luyện tập'), x: 340, y: 475, color: '#E61E64' },
      ],
    };
  }
  if (template === 'blank') {
    return {
      title: biText(lang, `${studentName.split(' ')[0]}'s New Mind Map`, `Sơ Đồ Mới Của ${studentName.split(' ')[0]}`),
      topicTag: 'Brainstorm',
      nodes: [
        { id: rootId, parentId: null, label: biText(lang, 'Central Topic', 'Chủ Đề Trung Tâm'), x: CANVAS_CENTER_X, y: CANVAS_CENTER_Y, color: '#FF6B00' },
      ],
    };
  }
  // Default: Story Brainstorm
  return {
    title: biText(lang, 'Story Brainstorm: Kindness Adventure', 'Ý Tưởng Truyện: Hành Trình Lòng Tốt'),
    topicTag: 'Storytelling',
    nodes: [
      { id: rootId, parentId: null, label: biText(lang, 'The Lion & The Mouse', 'Sư Tử & Chuột Nhắt'), x: CANVAS_CENTER_X, y: CANVAS_CENTER_Y, color: '#FF6B00' },
      { id: 's1', parentId: rootId, label: biText(lang, 'Characters', 'Nhân vật'), x: 340, y: 195, color: '#2563EB' },
      { id: 's1a', parentId: 's1', label: biText(lang, 'Gentle Lion', 'Sư tử dũng cảm'), x: 140, y: 145, color: '#2563EB' },
      { id: 's1b', parentId: 's1', label: biText(lang, 'Clever Mouse', 'Chuột thông minh'), x: 140, y: 245, color: '#2563EB' },
      { id: 's2', parentId: rootId, label: biText(lang, 'Setting', 'Bối cảnh'), x: 865, y: 195, color: '#0D9488' },
      { id: 's2a', parentId: 's2', label: biText(lang, 'Sunny Jungle', 'Khu rừng đầy nắng'), x: 1065, y: 195, color: '#0D9488' },
      { id: 's3', parentId: rootId, label: biText(lang, 'Big Problem', 'Thử thách'), x: 865, y: 485, color: '#E61E64' },
      { id: 's4', parentId: rootId, label: biText(lang, 'Kindness Moral', 'Bài học lòng tốt'), x: 340, y: 485, color: '#D97706' },
    ],
  };
}

function buildNodesFromSeed(seed: MindMapSeedPayload): MindMapNode[] {
  const rootId = 'root';
  const nodes: MindMapNode[] = [
    {
      id: rootId,
      parentId: null,
      label: seed.title.slice(0, 60) || 'Study Notes Map',
      x: CANVAS_CENTER_X,
      y: CANVAS_CENTER_Y,
      color: '#FF6B00',
    },
  ];

  const cleanPoints = seed.points.map((p) => p.trim()).filter(Boolean).slice(0, 10);
  const vocabList = (seed.vocabWords || []).filter((v) => v.word.trim()).slice(0, 6);
  const branchItems: Array<{ label: string; children?: string[]; color: MindMapBranchColor }> = [];

  cleanPoints.forEach((pt, idx) => {
    const col = BRANCH_COLORS[(idx + 1) % BRANCH_COLORS.length].hex;
    branchItems.push({ label: pt.slice(0, 58), color: col });
  });

  if (vocabList.length > 0) {
    branchItems.push({
      label: 'Key Vocabulary',
      color: '#0D9488',
      children: vocabList.map((v) =>
        v.meaning ? `${v.word}: ${v.meaning}`.slice(0, 48) : v.word.slice(0, 48)
      ),
    });
  }

  const total = Math.max(1, branchItems.length);
  const radiusX = 275;
  const radiusY = 185;

  branchItems.forEach((item, idx) => {
    const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
    const bx = Math.round(CANVAS_CENTER_X + Math.cos(angle) * radiusX);
    const by = Math.round(CANVAS_CENTER_Y + Math.sin(angle) * radiusY);
    const branchId = `seed_${idx + 1}`;
    nodes.push({
      id: branchId,
      parentId: rootId,
      label: item.label,
      x: bx,
      y: by,
      color: item.color,
    });

    if (item.children && item.children.length > 0) {
      const spread = 0.42;
      item.children.forEach((childText, cIdx) => {
        const offset = (cIdx - (item.children!.length - 1) / 2) * spread;
        const cAngle = angle + offset;
        nodes.push({
          id: `${branchId}_c${cIdx}`,
          parentId: branchId,
          label: childText,
          x: Math.round(bx + Math.cos(cAngle) * 195),
          y: Math.round(by + Math.sin(cAngle) * 125),
          color: item.color,
        });
      });
    }
  });

  return nodes;
}

function autoLayoutRadial(nodes: MindMapNode[]): MindMapNode[] {
  const root = nodes.find((n) => n.parentId === null);
  if (!root) return nodes;

  const updated = new Map<string, MindMapNode>();
  updated.set(root.id, { ...root, x: CANVAS_CENTER_X, y: CANVAS_CENTER_Y });

  const level1 = nodes.filter((n) => n.parentId === root.id);
  const count1 = Math.max(1, level1.length);

  level1.forEach((n1, idx) => {
    const angle = (idx / count1) * Math.PI * 2 - Math.PI / 2;
    const x1 = Math.round(CANVAS_CENTER_X + Math.cos(angle) * 265);
    const y1 = Math.round(CANVAS_CENTER_Y + Math.sin(angle) * 175);
    updated.set(n1.id, { ...n1, x: x1, y: y1 });

    const children = nodes.filter((c) => c.parentId === n1.id);
    children.forEach((c, cIdx) => {
      const spread = 0.46;
      const cAngle = angle + (cIdx - (children.length - 1) / 2) * spread;
      const cx = Math.round(x1 + Math.cos(cAngle) * 195);
      const cy = Math.round(y1 + Math.sin(cAngle) * 120);
      updated.set(c.id, { ...c, x: cx, y: cy });

      // Grandchildren
      const grand = nodes.filter((g) => g.parentId === c.id);
      grand.forEach((g, gIdx) => {
        const gAngle = cAngle + (gIdx - (grand.length - 1) / 2) * 0.38;
        updated.set(g.id, {
          ...g,
          x: Math.round(cx + Math.cos(gAngle) * 170),
          y: Math.round(cy + Math.sin(gAngle) * 95),
        });
      });
    });
  });

  return nodes.map((n) => updated.get(n.id) || n);
}

export const StudentMindMapStudio: React.FC<StudentMindMapStudioProps> = ({
  lang,
  currentUser,
  student,
  incomingSeed,
  onConsumeSeed,
}) => {
  const studentId = student?.id || `user_${currentUser.uid}`;
  const studentName = student?.fullName || currentUser.displayName || 'LiLab Student';
  const defaultCefr = student?.cefrLevel || 'Pre-A1 Starters';

  const [savedMaps, setSavedMaps] = useState<StudentMindMapRecord[]>([]);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [mapTitle, setMapTitle] = useState<string>(
    biText(lang, 'Story Brainstorm: Kindness Adventure', 'Ý Tưởng Truyện: Hành Trình Lòng Tốt')
  );
  const [topicTag, setTopicTag] = useState<string>('Storytelling');
  const [nodes, setNodes] = useState<MindMapNode[]>(
    () => buildStarterNodes('story', lang, studentName).nodes
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string>('root');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<string>('');

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; panX: number; panY: number } | null>(null);

  // Dragging node state
  const dragNodeRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [busySave, setBusySave] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const consumedSeedRef = useRef<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Subscribe to student's saved mind maps in Firestore
  useEffect(() => {
    const email = (currentUser.email || '').toLowerCase();
    const isAdminAccount =
      isSuperAdminEmail(email) || currentUser.role === 'super_admin' || currentUser.role === 'admin';

    const mapsQuery = isAdminAccount
      ? collection(db, 'student_mind_maps')
      : query(collection(db, 'student_mind_maps'), where('ownerUid', '==', currentUser.uid));

    const unsub = onSnapshot(
      mapsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as StudentMindMapRecord))
          .filter((m) => !student || m.studentId === student.id || m.ownerUid === currentUser.uid);
        list.sort((a, b) => {
          const ta = (a.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0;
          const tb = (b.updatedAt as { seconds?: number } | undefined)?.seconds ?? 0;
          return tb - ta;
        });
        setSavedMaps(list);
        setMapsLoaded(true);
      },
      (err) => {
        setMapsLoaded(true);
        handleFirestoreError(err, OperationType.LIST, 'student_mind_maps');
      }
    );

    return () => unsub();
  }, [currentUser.uid, currentUser.email, currentUser.role, student?.id]);

  // Apply incoming seed from "My Study Notes" -> "Convert Key Points to Mind Map"
  useEffect(() => {
    if (!incomingSeed || consumedSeedRef.current === incomingSeed.seedId) return;
    consumedSeedRef.current = incomingSeed.seedId;
    const generated = buildNodesFromSeed(incomingSeed);
    setActiveMapId(null);
    setMapTitle(incomingSeed.title || biText(lang, 'Study Notes Mind Map', 'Sơ Đồ Từ Sổ Tay'));
    setTopicTag(incomingSeed.topicTag || 'Study Notes');
    setNodes(generated);
    setSelectedNodeId('root');
    setEditingNodeId(null);
    setZoom(0.95);
    setPan({ x: 0, y: 0 });
    showToast(
      biText(
        lang,
        `Converted "${incomingSeed.title}" into a visual mind map! Click Save Map to keep it.`,
        `Đã chuyển "${incomingSeed.title}" thành sơ đồ tư duy! Bấm Lưu Sơ Đồ để giữ lại.`
      )
    );
    if (onConsumeSeed) onConsumeSeed();
  }, [incomingSeed, lang, onConsumeSeed]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null,
    [nodes, selectedNodeId]
  );

  // Add a child branch to any node via one-click '+' button
  const handleAddChildBranch = (parentNode: MindMapNode) => {
    const existingChildren = nodes.filter((n) => n.parentId === parentNode.id);
    const parentOfParent = parentNode.parentId
      ? nodes.find((n) => n.id === parentNode.parentId) || null
      : null;

    let baseAngle: number;
    let distX = 230;
    let distY = 145;

    if (!parentOfParent) {
      // Children of central root radiate cleanly around 360 degrees
      const idx = existingChildren.length;
      const presetAngles = [-Math.PI * 0.78, -Math.PI * 0.22, Math.PI * 0.22, Math.PI * 0.78, -Math.PI / 2, Math.PI / 2, 0, Math.PI];
      baseAngle = presetAngles[idx % presetAngles.length] + Math.floor(idx / 8) * 0.25;
      distX = 265;
      distY = 175;
    } else {
      const dx = parentNode.x - parentOfParent.x;
      const dy = parentNode.y - parentOfParent.y;
      const outward = Math.atan2(dy, dx);
      const step = existingChildren.length % 2 === 0 ? 1 : -1;
      const ring = Math.ceil(existingChildren.length / 2);
      baseAngle = outward + step * ring * 0.42;
      distX = 195;
      distY = 115;
    }

    const nextColor: MindMapBranchColor =
      parentNode.parentId === null
        ? BRANCH_COLORS[(existingChildren.length + 1) % BRANCH_COLORS.length].hex
        : parentNode.color;

    const newNode: MindMapNode = {
      id: makeId('node'),
      parentId: parentNode.id,
      label: biText(lang, 'New Idea', 'Ý tưởng mới'),
      x: Math.round(parentNode.x + Math.cos(baseAngle) * distX),
      y: Math.round(parentNode.y + Math.sin(baseAngle) * distY),
      color: nextColor,
    };

    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
    setEditingNodeId(newNode.id);
    setEditingDraft(newNode.label);
  };

  const handleDeleteNode = (nodeId: string) => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target || target.parentId === null) return; // Never delete root

    // Collect target + all descendants
    const toRemove = new Set<string>([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          changed = true;
        }
      }
    }

    setNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));
    setSelectedNodeId('root');
    if (editingNodeId && toRemove.has(editingNodeId)) {
      setEditingNodeId(null);
    }
  };

  const handleStartEditNode = (node: MindMapNode) => {
    setSelectedNodeId(node.id);
    setEditingNodeId(node.id);
    setEditingDraft(node.label);
  };

  const handleCommitEditNode = () => {
    if (!editingNodeId) return;
    const trimmed = editingDraft.trim().slice(0, 80);
    if (trimmed) {
      setNodes((prev) =>
        prev.map((n) => (n.id === editingNodeId ? { ...n, label: trimmed } : n))
      );
    }
    setEditingNodeId(null);
  };

  const handleRecolorBranch = (nodeId: string, color: MindMapBranchColor) => {
    // Recolor node + its descendants for harmonious branch grouping
    const affected = new Set<string>([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (n.parentId && affected.has(n.parentId) && !affected.has(n.id)) {
          affected.add(n.id);
          changed = true;
        }
      }
    }
    setNodes((prev) => prev.map((n) => (affected.has(n.id) ? { ...n, color } : n)));
  };

  // Pointer handlers for dragging nodes & panning canvas
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-mindmap-node="true"]')) return;
    setEditingNodeId(null);
    setIsPanning(true);
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleNodePointerDown = (e: React.PointerEvent<HTMLDivElement>, node: MindMapNode) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    e.stopPropagation();
    setSelectedNodeId(node.id);
    dragNodeRef.current = {
      nodeId: node.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: node.x,
      origY: node.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragNodeRef.current) {
      const { nodeId, startClientX, startClientY, origX, origY } = dragNodeRef.current;
      const dx = (e.clientX - startClientX) / zoom;
      const dy = (e.clientY - startClientY) / zoom;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, x: Math.round(origX + dx), y: Math.round(origY + dy) } : n
        )
      );
      return;
    }
    if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.clientX;
      const dy = e.clientY - panStartRef.current.clientY;
      setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
    }
  };

  const handlePointerUp = () => {
    dragNodeRef.current = null;
    setIsPanning(false);
    panStartRef.current = null;
  };

  const handleLoadTemplate = (template: 'story' | 'vocab' | 'lesson' | 'blank') => {
    const starter = buildStarterNodes(template, lang, studentName);
    setActiveMapId(null);
    setMapTitle(starter.title);
    setTopicTag(starter.topicTag);
    setNodes(starter.nodes);
    setSelectedNodeId('root');
    setEditingNodeId(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleOpenSavedMap = (rec: StudentMindMapRecord) => {
    try {
      const parsed = JSON.parse(rec.nodesJson) as MindMapNode[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setActiveMapId(rec.id);
        setMapTitle(rec.title);
        setTopicTag(rec.topicTag || 'Brainstorm');
        setNodes(parsed);
        setSelectedNodeId(parsed[0].id);
        setEditingNodeId(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    } catch {
      showToast(biText(lang, 'Could not parse saved mind map.', 'Không thể mở sơ đồ đã lưu.'));
    }
  };

  const handleSaveMap = async () => {
    setBusySave(true);
    try {
      const cleanTitle = mapTitle.trim().slice(0, 160) || biText(lang, 'Untitled Mind Map', 'Sơ Đồ Chưa Đặt Tên');
      const cleanTag = topicTag.trim().slice(0, 80) || 'Brainstorm';
      const nodesJson = JSON.stringify(nodes).slice(0, 49500);

      if (activeMapId) {
        await updateDoc(doc(db, 'student_mind_maps', activeMapId), {
          title: cleanTitle,
          topicTag: cleanTag,
          cefrLevel: defaultCefr.slice(0, 60),
          nodesJson,
          nodeCount: nodes.length,
          updatedAt: serverTimestamp(),
        });
        showToast(biText(lang, `Saved changes to "${cleanTitle}".`, `Đã lưu thay đổi vào "${cleanTitle}".`));
      } else {
        const docId = `mmap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const payload: Record<string, unknown> = {
          studentId: studentId.slice(0, 128),
          studentName: studentName.slice(0, 120),
          ownerUid: currentUser.uid.slice(0, 128),
          title: cleanTitle,
          topicTag: cleanTag,
          cefrLevel: defaultCefr.slice(0, 60),
          nodesJson,
          nodeCount: nodes.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (student?.studentEmail) payload.studentEmail = student.studentEmail.toLowerCase().slice(0, 160);
        if (student?.parentEmail) payload.parentEmail = student.parentEmail.toLowerCase().slice(0, 160);

        await setDoc(doc(db, 'student_mind_maps', docId), payload);
        setActiveMapId(docId);
        showToast(biText(lang, `Saved "${cleanTitle}" to your Mind Map Studio!`, `Đã lưu "${cleanTitle}" vào Sơ đồ Tư duy!`));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'student_mind_maps');
    } finally {
      setBusySave(false);
    }
  };

  const handleDeleteSavedMap = async (rec: StudentMindMapRecord) => {
    try {
      await deleteDoc(doc(db, 'student_mind_maps', rec.id));
      setConfirmDeleteId(null);
      if (activeMapId === rec.id) {
        setActiveMapId(null);
      }
      showToast(biText(lang, `Deleted "${rec.title}".`, `Đã xoá "${rec.title}".`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'student_mind_maps');
    }
  };

  // High-resolution PNG exporter using HTML5 Canvas
  const handleExportPng = () => {
    setBusyExport(true);
    try {
      const padding = 140;
      const xs = nodes.map((n) => n.x);
      const ys = nodes.map((n) => n.y);
      const minX = Math.min(...xs) - padding;
      const maxX = Math.max(...xs) + padding;
      const minY = Math.min(...ys) - padding;
      const maxY = Math.max(...ys) + padding;

      const width = Math.max(1200, maxX - minX);
      const height = Math.max(760, maxY - minY + 90);
      const scale = 2;

      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = '#F8F9FB';
      ctx.fillRect(0, 0, width, height);

      // Subtle dot grid
      ctx.fillStyle = '#CBD5E1';
      for (let gx = 24; gx < width; gx += 28) {
        for (let gy = 76; gy < height - 30; gy += 28) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Header bar
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, 64);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, 64, width, 1);

      ctx.fillStyle = '#FF6B00';
      ctx.font = '800 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('LiLab Mind Map Studio', 28, 38);

      ctx.fillStyle = '#172154';
      ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${mapTitle} · ${studentName}`, width - 28, 38);
      ctx.textAlign = 'left';

      const offsetX = -minX + (width - (maxX - minX)) / 2;
      const offsetY = -minY + 64 + (height - 94 - (maxY - minY)) / 2;

      // Draw smooth Bezier connectors
      nodes.forEach((node) => {
        if (!node.parentId) return;
        const parent = nodes.find((p) => p.id === node.parentId);
        if (!parent) return;
        const x1 = parent.x + offsetX;
        const y1 = parent.y + offsetY;
        const x2 = node.x + offsetX;
        const y2 = node.y + offsetY;
        const midX = (x1 + x2) / 2;

        ctx.strokeStyle = node.color;
        ctx.lineWidth = parent.parentId === null ? 3.5 : 2.25;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Draw rounded node pills
      nodes.forEach((node) => {
        const isRoot = node.parentId === null;
        const cx = node.x + offsetX;
        const cy = node.y + offsetY;
        ctx.font = isRoot
          ? '800 17px "Plus Jakarta Sans", sans-serif'
          : '700 14px "Plus Jakarta Sans", sans-serif';
        const textWidth = ctx.measureText(node.label).width;
        const boxW = Math.min(260, Math.max(isRoot ? 170 : 120, textWidth + 42));
        const boxH = isRoot ? 54 : 40;
        const rx = cx - boxW / 2;
        const ry = cy - boxH / 2;
        const radius = isRoot ? 18 : 999;

        ctx.beginPath();
        const r = Math.min(radius, boxH / 2);
        ctx.moveTo(rx + r, ry);
        ctx.arcTo(rx + boxW, ry, rx + boxW, ry + boxH, r);
        ctx.arcTo(rx + boxW, ry + boxH, rx, ry + boxH, r);
        ctx.arcTo(rx, ry + boxH, rx, ry, r);
        ctx.arcTo(rx, ry, rx + boxW, ry, r);
        ctx.closePath();

        if (isRoot) {
          ctx.fillStyle = node.color;
          ctx.fill();
        } else {
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = node.color;
          ctx.stroke();
        }

        ctx.fillStyle = isRoot ? '#FFFFFF' : '#172154';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayLabel = node.label.length > 32 ? `${node.label.slice(0, 30)}…` : node.label;
        ctx.fillText(displayLabel, cx, cy);
      });

      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `LiLab_MindMap_${mapTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 36)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(biText(lang, 'Exported high-resolution PNG mind map!', 'Đã xuất ảnh sơ đồ tư duy PNG sắc nét!'));
    } finally {
      setBusyExport(false);
    }
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="bg-[#FFF5EE] border border-[#FF6B00]/30 text-[#C2410C] px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#FF6B00]" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Studio Bar */}
      <div className="bg-white rounded-2xl border border-[#172154]/10 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-[#FFF5EE] border border-[#FF6B00]/20 text-[#FF6B00] flex items-center justify-center shrink-0">
            <Network className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 max-w-md">
            <input
              type="text"
              value={mapTitle}
              onChange={(e) => setMapTitle(e.target.value)}
              placeholder={biText(lang, 'Mind Map Title...', 'Tên Sơ Đồ Tư Duy...')}
              className="w-full font-display text-base sm:text-lg font-extrabold text-[#172154] bg-transparent border-b border-transparent hover:border-[#172154]/15 focus:border-[#FF6B00] focus:outline-none pb-0.5 truncate"
            />
            <div className="flex items-center gap-2 text-xs text-[#172154]/60 mt-0.5">
              <input
                type="text"
                value={topicTag}
                onChange={(e) => setTopicTag(e.target.value)}
                placeholder={biText(lang, 'Lesson / Topic tag', 'Chủ đề bài học')}
                className="w-36 bg-transparent text-xs font-semibold text-[#FF6B00] focus:outline-none"
              />
              <span aria-hidden="true">·</span>
              <span className="font-mono-num tabular-nums">
                {nodes.length} {biText(lang, 'nodes', 'nhánh')}
              </span>
              <span aria-hidden="true">·</span>
              <span>{biText(lang, 'Double-click any node to edit', 'Nhấp đúp vào nhánh để sửa chữ')}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNodes((prev) => autoLayoutRadial(prev))}
            className="px-3 py-2 rounded-xl bg-white border border-[#172154]/15 hover:border-[#FF6B00] text-[#172154] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>{biText(lang, 'Auto-Arrange', 'Sắp xếp gọn')}</span>
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            disabled={busyExport}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#172154]/15 hover:border-[#172154]/35 text-[#172154] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{biText(lang, 'Export PNG', 'Xuất PNG')}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSaveMap()}
            disabled={busySave}
            className="px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>
              {busySave
                ? biText(lang, 'Saving...', 'Đang lưu...')
                : biText(lang, 'Save Map', 'Lưu Sơ Đồ')}
            </span>
          </button>
        </div>
      </div>

      {/* Main 12-Col Layout: Saved Maps Sidebar + Interactive Canvas */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left Sidebar: Templates & Saved Maps */}
        <div className="xl:col-span-3 space-y-4">
          {/* Quick Starter Templates */}
          <div className="bg-white rounded-2xl border border-[#172154]/10 p-4 space-y-2.5">
            <div className="text-xs font-extrabold text-[#172154]">
              {biText(lang, 'Start a New Mind Map', 'Bắt Đầu Sơ Đồ Mới')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'story' as const, label: biText(lang, 'Story Map', 'Ý tưởng Truyện') },
                  { id: 'vocab' as const, label: biText(lang, 'Vocab Tree', 'Cây Từ Vựng') },
                  { id: 'lesson' as const, label: biText(lang, 'Lesson Map', 'Tóm tắt Bài') },
                  { id: 'blank' as const, label: biText(lang, 'Blank Canvas', 'Sơ đồ Trống') },
                ] as const
              ).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleLoadTemplate(tpl.id)}
                  className="px-2.5 py-2 rounded-xl border border-[#172154]/12 bg-[#F8F9FB] hover:bg-[#FFF5EE] hover:border-[#FF6B00]/45 text-xs font-semibold text-[#172154] text-left cursor-pointer transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Saved Mind Maps List */}
          <div className="bg-white rounded-2xl border border-[#172154]/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#172154]">
                {biText(lang, 'My Saved Maps', 'Sơ Đồ Đã Lưu')}
              </span>
              <span className="text-xs font-mono-num tabular-nums text-[#172154]/60">
                {savedMaps.length}
              </span>
            </div>

            {!mapsLoaded ? (
              <div className="text-xs text-[#172154]/55 py-4 text-center">
                {biText(lang, 'Loading saved maps...', 'Đang tải sơ đồ...')}
              </div>
            ) : savedMaps.length === 0 ? (
              <p className="text-xs text-[#172154]/60 bg-[#F8F9FB] rounded-xl p-3 border border-[#172154]/8 leading-relaxed">
                {biText(
                  lang,
                  'No saved mind maps yet. Brainstorm on the canvas and click "Save Map" to build your collection!',
                  'Chưa có sơ đồ nào được lưu. Hãy sáng tạo trên khung vẽ và bấm "Lưu Sơ Đồ"!'
                )}
              </p>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                {savedMaps.map((rec) => {
                  const isActive = activeMapId === rec.id;
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
                          onClick={() => handleOpenSavedMap(rec)}
                          className="text-left min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="text-xs font-bold text-[#172154] truncate">
                            {rec.title}
                          </div>
                          <div className="text-[11px] text-[#172154]/60 mt-0.5 font-mono-num tabular-nums">
                            {rec.topicTag} · {rec.nodeCount} {biText(lang, 'nodes', 'nhánh')}
                          </div>
                        </button>

                        {confirmDeleteId === rec.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleDeleteSavedMap(rec)}
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
                            title={biText(lang, 'Delete map', 'Xoá sơ đồ')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Main Interactive Canvas */}
        <div className="xl:col-span-9 flex flex-col bg-white rounded-2xl border border-[#172154]/10 overflow-hidden">
          {/* Selected Node Inspector + Zoom Controls */}
          <div className="px-4 py-2.5 border-b border-[#172154]/10 bg-[#F8F9FB] flex flex-wrap items-center justify-between gap-3">
            {/* Selected Node Controls */}
            {selectedNode && (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-semibold text-[#172154]/70">
                  {biText(lang, 'Selected:', 'Đang chọn:')}
                </span>
                <span className="text-xs font-extrabold text-[#172154] max-w-[160px] truncate">
                  {selectedNode.label}
                </span>

                <div className="flex items-center gap-1 pl-2 border-l border-[#172154]/12">
                  {BRANCH_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => handleRecolorBranch(selectedNode.id, c.hex)}
                      title={lang === 'vi' ? c.labelVi : c.labelEn}
                      className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                        selectedNode.color === c.hex
                          ? 'ring-2 ring-offset-1 ring-[#172154] scale-110'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleAddChildBranch(selectedNode)}
                  className="px-2.5 py-1 rounded-lg bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{biText(lang, 'Add Branch', 'Thêm Nhánh')}</span>
                </button>

                {selectedNode.parentId !== null && (
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    className="px-2.5 py-1 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{biText(lang, 'Remove', 'Xoá')}</span>
                  </button>
                )}
              </div>
            )}

            {/* Zoom & Pan Controls */}
            <div className="flex items-center gap-1 bg-white border border-[#172154]/12 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
                className="p-1.5 text-[#172154]/75 hover:text-[#172154] cursor-pointer"
                title={biText(lang, 'Zoom Out', 'Thu nhỏ')}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono-num tabular-nums font-bold text-[#172154] px-1.5">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
                className="p-1.5 text-[#172154]/75 hover:text-[#172154] cursor-pointer"
                title={biText(lang, 'Zoom In', 'Phóng to')}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 text-[#172154]/75 hover:text-[#FF6B00] border-l border-[#172154]/10 cursor-pointer"
                title={biText(lang, 'Reset View', 'Đặt lại khung nhìn')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(0.85);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-1.5 text-[#172154]/75 hover:text-[#FF6B00] cursor-pointer"
                title={biText(lang, 'Fit View', 'Vừa khung hình')}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Stage */}
          <div
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={`relative w-full h-[560px] sm:h-[620px] overflow-hidden select-none ${
              isPanning ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{
              backgroundColor: '#F8F9FB',
              backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            <div
              className="absolute inset-0 origin-center transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                width: '1200px',
                height: '680px',
              }}
            >
              {/* Curved SVG Connectors */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                width="1200"
                height="680"
              >
                {nodes.map((node) => {
                  if (!node.parentId) return null;
                  const parent = nodes.find((p) => p.id === node.parentId);
                  if (!parent) return null;
                  const midX = (parent.x + node.x) / 2;
                  const d = `M ${parent.x} ${parent.y} C ${midX} ${parent.y}, ${midX} ${node.y}, ${node.x} ${node.y}`;
                  return (
                    <path
                      key={`edge_${node.id}`}
                      d={d}
                      fill="none"
                      stroke={node.color}
                      strokeWidth={parent.parentId === null ? 3.5 : 2.25}
                      strokeOpacity={0.72}
                      strokeLinecap="round"
                    />
                  );
                })}
              </svg>

              {/* Interactive Draggable Nodes */}
              {nodes.map((node) => {
                const isRoot = node.parentId === null;
                const isSelected = node.id === selectedNodeId;
                const isEditing = node.id === editingNodeId;

                return (
                  <div
                    key={node.id}
                    data-mindmap-node="true"
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartEditNode(node);
                    }}
                    className={`group absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 transition-shadow ${
                      isRoot
                        ? 'px-5 py-3 rounded-2xl text-white font-display font-extrabold text-sm sm:text-base shadow-md'
                        : 'px-4 py-2 rounded-full bg-white text-[#172154] font-semibold text-xs sm:text-sm shadow-xs'
                    } ${
                      isSelected ? 'ring-2 ring-offset-2 ring-[#172154] z-20' : 'z-10 hover:z-20'
                    }`}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      backgroundColor: isRoot ? node.color : '#FFFFFF',
                      border: isRoot ? `2px solid ${node.color}` : `2px solid ${node.color}`,
                      maxWidth: isRoot ? '280px' : '240px',
                    }}
                  >
                    {!isRoot && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: node.color }}
                      />
                    )}

                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingDraft}
                        onChange={(e) => setEditingDraft(e.target.value)}
                        onBlur={handleCommitEditNode}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitEditNode();
                          if (e.key === 'Escape') setEditingNodeId(null);
                        }}
                        className={`bg-transparent outline-none min-w-[90px] w-full ${
                          isRoot
                            ? 'text-white placeholder:text-white/70 font-bold'
                            : 'text-[#172154] font-semibold'
                        }`}
                      />
                    ) : (
                      <span className="truncate cursor-move">{node.label}</span>
                    )}

                    {/* One-click '+' button to spawn child branch */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddChildBranch(node);
                      }}
                      title={biText(lang, 'Add child branch', 'Thêm nhánh con')}
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-110 cursor-pointer ${
                        isRoot
                          ? 'bg-white/25 hover:bg-white/40 text-white'
                          : 'bg-[#F8F9FB] hover:bg-[#FF6B00] text-[#172154] hover:text-white border border-[#172154]/15'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Bottom Subtle Hint */}
            <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-white/95 border border-[#172154]/10 text-[11px] font-medium text-[#172154]/70 flex items-center gap-2 pointer-events-none">
              <GitBranch className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>
                {biText(
                  lang,
                  'Drag nodes to arrange · Click + on any node to branch · Double-click text to edit · Drag empty space to pan',
                  'Kéo nhánh để di chuyển · Bấm + để thêm nhánh con · Nhấp đúp để sửa chữ · Kéo nền trống để di chuyển khung'
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

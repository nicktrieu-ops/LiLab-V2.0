import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Calendar,
  Check,
  CheckCircle2,
  Download,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { biText } from '../../i18n';
import { PanelCard, SegmentedControl } from '../ui/Primitives';
import type {
  CrmActivity,
  CrmActivityType,
  CrmContact,
  CrmContactType,
  CrmDeal,
  CrmDealStage,
  CrmLeadSource,
  CrmLifecycleStage,
  CrmTask,
  EnrollmentRequest,
  LangCode,
  ProgramCourse,
  StudentProfile,
  TuitionInvoice,
  UserProfile,
  UserRole,
} from '../../types';

/*
 * LiLab CRM: contacts, deal pipeline, activity timeline, tasks and sign-up approvals.
 * Admin-only; data lives in crm_contacts, crm_deals, crm_activities and crm_tasks.
 */

type CrmView = 'signups' | 'pipeline' | 'contacts' | 'tasks';

interface AdminCrmPanelProps {
  lang: LangCode;
  currentUser: UserProfile;
  users: UserProfile[];
  students: StudentProfile[];
  programs: ProgramCourse[];
  enrollments: EnrollmentRequest[];
  invoices: TuitionInvoice[];
  onFlash: (msg: string) => void;
}

const DEAL_STAGES: Array<{ id: CrmDealStage; en: string; vi: string; tone: string }> = [
  { id: 'new', en: 'New lead', vi: 'Lead mới', tone: 'bg-chalk' },
  { id: 'contacted', en: 'Contacted', vi: 'Đã liên hệ', tone: 'bg-chalk' },
  { id: 'trial_booked', en: 'Trial booked', vi: 'Đã hẹn học thử', tone: 'bg-chalk' },
  { id: 'trial_done', en: 'Trial done', vi: 'Đã học thử', tone: 'bg-chalk' },
  { id: 'offer', en: 'Offer sent', vi: 'Đã gửi ưu đãi', tone: 'bg-chalk' },
  { id: 'won', en: 'Enrolled', vi: 'Đã ghi danh', tone: 'bg-[#E6F6F4]' },
  { id: 'lost', en: 'Lost', vi: 'Không thành', tone: 'bg-[#FDECEF]' },
];

const LIFECYCLE: Array<{ id: CrmLifecycleStage; en: string; vi: string }> = [
  { id: 'subscriber', en: 'Subscriber', vi: 'Quan tâm' },
  { id: 'lead', en: 'Lead', vi: 'Lead' },
  { id: 'qualified', en: 'Qualified', vi: 'Tiềm năng' },
  { id: 'opportunity', en: 'Opportunity', vi: 'Cơ hội' },
  { id: 'customer', en: 'Customer', vi: 'Khách hàng' },
  { id: 'alumni', en: 'Alumni', vi: 'Cựu học viên' },
];

const CONTACT_TYPES: Array<{ id: CrmContactType; en: string; vi: string }> = [
  { id: 'lead', en: 'Lead', vi: 'Lead' },
  { id: 'parent', en: 'Parent', vi: 'Phụ huynh' },
  { id: 'student', en: 'Student', vi: 'Học viên' },
  { id: 'teacher', en: 'Teacher', vi: 'Giáo viên' },
  { id: 'partner', en: 'Partner', vi: 'Đối tác' },
];

const SOURCES: Array<{ id: CrmLeadSource; en: string; vi: string }> = [
  { id: 'website', en: 'Website', vi: 'Website' },
  { id: 'signup', en: 'App sign-up', vi: 'Đăng ký trên app' },
  { id: 'zalo', en: 'Zalo', vi: 'Zalo' },
  { id: 'facebook', en: 'Facebook', vi: 'Facebook' },
  { id: 'referral', en: 'Referral', vi: 'Giới thiệu' },
  { id: 'walk_in', en: 'Walk-in', vi: 'Đến trực tiếp' },
  { id: 'event', en: 'Event', vi: 'Sự kiện' },
  { id: 'roster', en: 'Existing roster', vi: 'Danh sách hiện có' },
  { id: 'other', en: 'Other', vi: 'Khác' },
];

const ACTIVITY_TYPES: Array<{ id: CrmActivityType; en: string; vi: string }> = [
  { id: 'note', en: 'Note', vi: 'Ghi chú' },
  { id: 'call', en: 'Call', vi: 'Cuộc gọi' },
  { id: 'zalo', en: 'Zalo', vi: 'Zalo' },
  { id: 'email', en: 'Email', vi: 'Email' },
  { id: 'meeting', en: 'Meeting', vi: 'Gặp mặt' },
];

const APPROVABLE_ROLES: Array<{ id: Extract<UserRole, 'parent' | 'student' | 'teacher'>; en: string; vi: string }> = [
  { id: 'parent', en: 'Parent', vi: 'Phụ huynh' },
  { id: 'student', en: 'Student', vi: 'Học viên' },
  { id: 'teacher', en: 'Teacher', vi: 'Giáo viên' },
];

const label = <T extends { id: string; en: string; vi: string }>(list: T[], id: string | undefined, lang: LangCode) => {
  const item = list.find((x) => x.id === id);
  return item ? biText(lang, item.en, item.vi) : id || '—';
};

const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const emailKey = (email: string) => email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 100);

const todayIso = () => new Date().toISOString().slice(0, 10);

const formatVnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n || 0) + ' ₫';

const formatDate = (iso: string | undefined, lang: LangCode) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const zaloLink = (phone?: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  return digits ? `https://zalo.me/${digits}` : '';
};

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-ink/15 bg-white text-sm text-ink focus:border-ink/40 transition-colors';
const btnPrimary =
  'px-3.5 py-2 rounded-lg bg-lantern hover:bg-lantern-deep text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50';
const btnQuiet =
  'px-3 py-2 rounded-lg border border-ink/15 bg-white hover:bg-chalk text-ink text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50';

export const AdminCrmPanel: React.FC<AdminCrmPanelProps> = ({
  lang,
  currentUser,
  users,
  students,
  programs,
  enrollments,
  invoices,
  onFlash,
}) => {
  const me = (currentUser.email || '').toLowerCase();
  const [view, setView] = useState<CrmView>('pipeline');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { kind: 'contact' } | { kind: 'deal'; contactId?: string }>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        collection(db, 'crm_contacts'),
        (s) => setContacts(s.docs.map((d) => ({ id: d.id, ...d.data() }) as CrmContact)),
        (e) => handleFirestoreError(e, OperationType.LIST, 'crm_contacts')
      ),
      onSnapshot(
        collection(db, 'crm_deals'),
        (s) => setDeals(s.docs.map((d) => ({ id: d.id, ...d.data() }) as CrmDeal)),
        (e) => handleFirestoreError(e, OperationType.LIST, 'crm_deals')
      ),
      onSnapshot(
        query(collection(db, 'crm_activities'), orderBy('occurredAt', 'desc'), limit(500)),
        (s) => setActivities(s.docs.map((d) => ({ id: d.id, ...d.data() }) as CrmActivity)),
        (e) => handleFirestoreError(e, OperationType.LIST, 'crm_activities')
      ),
      onSnapshot(
        collection(db, 'crm_tasks'),
        (s) => setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }) as CrmTask)),
        (e) => handleFirestoreError(e, OperationType.LIST, 'crm_tasks')
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const owners = useMemo(
    () =>
      users
        .filter((u) => (u.role === 'admin' || u.role === 'super_admin') && u.status !== 'declined')
        .map((u) => ({ email: (u.email || '').toLowerCase(), name: u.displayName || u.email })),
    [users]
  );
  const ownerName = (email?: string) => owners.find((o) => o.email === email)?.name || email || '—';

  const pendingUsers = useMemo(() => users.filter((u) => u.status === 'pending'), [users]);
  const reviewedUsers = useMemo(
    () =>
      users
        .filter((u) => u.status === 'declined' || (u.status === 'active' && u.reviewedAt))
        .sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''))
        .slice(0, 15),
    [users]
  );

  const today = todayIso();
  const openTasks = tasks.filter((t) => !t.done);
  const overdueTasks = openTasks.filter((t) => t.dueDate < today);
  const openDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const monthStart = today.slice(0, 7);
  const wonThisMonth = deals.filter(
    (d) => d.stage === 'won' && typeof d.expectedCloseDate === 'string' && d.expectedCloseDate.startsWith(monthStart)
  );
  const closedDeals = deals.filter((d) => d.stage === 'won' || d.stage === 'lost');
  const winRate = closedDeals.length ? Math.round((deals.filter((d) => d.stage === 'won').length / closedDeals.length) * 100) : null;

  // ---- writes ---------------------------------------------------------------
  const logActivity = async (a: Omit<CrmActivity, 'id' | 'authorEmail' | 'occurredAt'> & { occurredAt?: string }) => {
    const id = newId('act');
    const occurredAt = a.occurredAt || new Date().toISOString();
    await setDoc(doc(db, 'crm_activities', id), {
      ...a,
      occurredAt,
      authorEmail: me,
      createdAt: serverTimestamp(),
    });
    if (a.contactId) {
      await updateDoc(doc(db, 'crm_contacts', a.contactId), { lastActivityAt: occurredAt, updatedAt: serverTimestamp() }).catch(
        () => {}
      );
    }
  };

  const upsertContactForUser = async (u: UserProfile, role: UserRole) => {
    const email = (u.email || '').toLowerCase();
    const existing = contacts.find((c) => c.linkedUid === u.uid || (email && c.email === email));
    const id = existing?.id || `u_${u.uid}`;
    const contactType: CrmContactType = role === 'teacher' ? 'teacher' : role === 'student' ? 'student' : 'parent';
    await setDoc(
      doc(db, 'crm_contacts', id),
      {
        fullName: existing?.fullName || u.displayName || email,
        email,
        ...(u.phone ? { phone: u.phone } : {}),
        contactType,
        lifecycleStage: existing?.lifecycleStage || 'lead',
        leadSource: existing?.leadSource || 'signup',
        tags: existing?.tags || [],
        linkedUid: u.uid,
        ownerEmail: existing?.ownerEmail || me,
        createdByEmail: existing?.createdByEmail || me,
        ...(existing ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return id;
  };

  const approveUser = async (u: UserProfile, role: UserRole) => {
    setBusy(`approve_${u.uid}`);
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        status: 'active',
        role,
        reviewedByEmail: me,
        reviewedAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      const contactId = await upsertContactForUser(u, role);
      await logActivity({
        contactId,
        activityType: 'approval',
        body: `Account approved as ${role}.`,
      });
      onFlash(biText(lang, `${u.displayName || u.email} can now sign in.`, `${u.displayName || u.email} đã có thể đăng nhập.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    } finally {
      setBusy(null);
    }
  };

  const declineUser = async (u: UserProfile, note: string) => {
    setBusy(`decline_${u.uid}`);
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        status: 'declined',
        reviewedByEmail: me,
        reviewedAt: new Date().toISOString(),
        ...(note.trim() ? { reviewNote: note.trim().slice(0, 300) } : {}),
        updatedAt: serverTimestamp(),
      });
      onFlash(biText(lang, `Declined ${u.displayName || u.email}.`, `Đã từ chối ${u.displayName || u.email}.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${u.uid}`);
    } finally {
      setBusy(null);
    }
  };

  const saveContact = async (id: string | null, data: Partial<CrmContact>) => {
    const docId = id || (data.email ? `e_${emailKey(data.email)}` : newId('ct'));
    try {
      await setDoc(
        doc(db, 'crm_contacts', docId),
        {
          ...data,
          tags: data.tags || [],
          ...(id ? {} : { createdByEmail: me, createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return docId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `crm_contacts/${docId}`);
    }
  };

  const deleteContact = async (c: CrmContact) => {
    try {
      await deleteDoc(doc(db, 'crm_contacts', c.id));
      setOpenContactId(null);
      onFlash(biText(lang, `Deleted ${c.fullName}.`, `Đã xoá ${c.fullName}.`));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `crm_contacts/${c.id}`);
    }
  };

  const saveDeal = async (data: Omit<CrmDeal, 'id' | 'createdByEmail'>) => {
    const id = newId('deal');
    try {
      await setDoc(doc(db, 'crm_deals', id), {
        ...data,
        createdByEmail: me,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logActivity({ contactId: data.contactId, dealId: id, activityType: 'stage_change', body: `Deal created: ${data.title}` });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `crm_deals/${id}`);
    }
  };

  const moveDeal = async (deal: CrmDeal, stage: CrmDealStage) => {
    if (deal.stage === stage) return;
    try {
      await updateDoc(doc(db, 'crm_deals', deal.id), {
        stage,
        ...(stage === 'won' && !deal.expectedCloseDate ? { expectedCloseDate: todayIso() } : {}),
        updatedAt: serverTimestamp(),
      });
      await logActivity({
        contactId: deal.contactId,
        dealId: deal.id,
        activityType: 'stage_change',
        body: `${deal.title}: ${label(DEAL_STAGES, deal.stage, 'en')} → ${label(DEAL_STAGES, stage, 'en')}`,
      });
      if (stage === 'won') {
        await updateDoc(doc(db, 'crm_contacts', deal.contactId), { lifecycleStage: 'customer', updatedAt: serverTimestamp() }).catch(
          () => {}
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `crm_deals/${deal.id}`);
    }
  };

  const deleteDeal = async (deal: CrmDeal) => {
    try {
      await deleteDoc(doc(db, 'crm_deals', deal.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `crm_deals/${deal.id}`);
    }
  };

  const saveTask = async (data: Pick<CrmTask, 'title' | 'dueDate' | 'contactId' | 'contactName' | 'ownerEmail'>) => {
    const id = newId('task');
    try {
      await setDoc(doc(db, 'crm_tasks', id), {
        title: data.title,
        dueDate: data.dueDate,
        ...(data.contactId ? { contactId: data.contactId, contactName: data.contactName || '' } : {}),
        ownerEmail: data.ownerEmail || me,
        done: false,
        createdByEmail: me,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `crm_tasks/${id}`);
    }
  };

  const toggleTask = async (t: CrmTask) => {
    try {
      await updateDoc(doc(db, 'crm_tasks', t.id), { done: !t.done, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `crm_tasks/${t.id}`);
    }
  };

  const deleteTask = async (t: CrmTask) => {
    try {
      await deleteDoc(doc(db, 'crm_tasks', t.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `crm_tasks/${t.id}`);
    }
  };

  /** Creates a CRM contact for every parent and student email on the roster that isn't in the CRM yet. */
  const importRoster = async () => {
    setBusy('import');
    const known = new Set(contacts.map((c) => (c.email || '').toLowerCase()).filter(Boolean));
    let added = 0;
    try {
      for (const s of students) {
        const pe = (s.parentEmail || '').toLowerCase();
        if (pe && !known.has(pe)) {
          known.add(pe);
          await setDoc(doc(db, 'crm_contacts', `e_${emailKey(pe)}`), {
            fullName: s.parentName || pe,
            email: pe,
            ...(s.parentPhone ? { phone: s.parentPhone } : {}),
            contactType: 'parent',
            lifecycleStage: s.status === 'graduated' ? 'alumni' : 'customer',
            leadSource: 'roster',
            tags: [],
            childNames: students
              .filter((x) => (x.parentEmail || '').toLowerCase() === pe)
              .map((x) => x.fullName)
              .join(', '),
            ownerEmail: me,
            createdByEmail: me,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          added++;
        }
      }
      onFlash(
        added
          ? biText(lang, `Added ${added} families from the roster.`, `Đã thêm ${added} gia đình từ danh sách.`)
          : biText(lang, 'Every roster family is already in the CRM.', 'Tất cả gia đình đã có trong CRM.')
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'crm_contacts');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    const cols = ['fullName', 'email', 'phone', 'contactType', 'lifecycleStage', 'leadSource', 'ownerEmail', 'tags', 'childNames', 'lastActivityAt'];
    const esc = (v: unknown) => {
      const s = Array.isArray(v) ? v.join('; ') : String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...contacts.map((c) => cols.map((k) => esc((c as unknown as Record<string, unknown>)[k])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lilab-crm-contacts-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openContact = contacts.find((c) => c.id === openContactId) || null;

  return (
    <div className="space-y-5">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          label={biText(lang, 'Waiting for approval', 'Chờ duyệt')}
          value={String(pendingUsers.length)}
          tone={pendingUsers.length ? 'alert' : 'plain'}
          onClick={() => setView('signups')}
        />
        <Kpi label={biText(lang, 'Open deals', 'Cơ hội đang mở')} value={String(openDeals.length)} sub={formatVnd(openDeals.reduce((a, d) => a + (d.amountVnd || 0), 0))} />
        <Kpi
          label={biText(lang, 'Enrolled this month', 'Ghi danh tháng này')}
          value={String(wonThisMonth.length)}
          sub={formatVnd(wonThisMonth.reduce((a, d) => a + (d.amountVnd || 0), 0))}
        />
        <Kpi label={biText(lang, 'Win rate', 'Tỉ lệ chốt')} value={winRate === null ? '—' : `${winRate}%`} sub={biText(lang, `${closedDeals.length} closed`, `${closedDeals.length} đã đóng`)} />
        <Kpi
          label={biText(lang, 'Overdue tasks', 'Việc quá hạn')}
          value={String(overdueTasks.length)}
          tone={overdueTasks.length ? 'alert' : 'plain'}
          onClick={() => setView('tasks')}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl<CrmView>
          value={view}
          onChange={setView}
          options={[
            { id: 'signups', label: biText(lang, `Sign-ups${pendingUsers.length ? ` (${pendingUsers.length})` : ''}`, `Duyệt tài khoản${pendingUsers.length ? ` (${pendingUsers.length})` : ''}`) },
            { id: 'pipeline', label: biText(lang, 'Pipeline', 'Quy trình bán') },
            { id: 'contacts', label: biText(lang, `Contacts (${contacts.length})`, `Liên hệ (${contacts.length})`) },
            { id: 'tasks', label: biText(lang, `Tasks (${openTasks.length})`, `Công việc (${openTasks.length})`) },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnQuiet} onClick={() => setDialog({ kind: 'deal' })} disabled={!contacts.length}>
            <Plus className="w-3.5 h-3.5" />
            {biText(lang, 'New deal', 'Cơ hội mới')}
          </button>
          <button type="button" className={btnPrimary} onClick={() => setDialog({ kind: 'contact' })}>
            <Plus className="w-3.5 h-3.5" />
            {biText(lang, 'New contact', 'Liên hệ mới')}
          </button>
        </div>
      </div>

      {view === 'signups' && (
        <SignupsView
          lang={lang}
          pending={pendingUsers}
          reviewed={reviewedUsers}
          busy={busy}
          onApprove={approveUser}
          onDecline={declineUser}
        />
      )}

      {view === 'pipeline' && (
        <PipelineView
          lang={lang}
          deals={deals}
          ownerName={ownerName}
          onMove={moveDeal}
          onOpenContact={setOpenContactId}
          onDelete={deleteDeal}
          onNewDeal={() => setDialog({ kind: 'deal' })}
          hasContacts={contacts.length > 0}
        />
      )}

      {view === 'contacts' && (
        <ContactsView
          lang={lang}
          contacts={contacts}
          deals={deals}
          tasks={tasks}
          owners={owners}
          ownerName={ownerName}
          onOpen={setOpenContactId}
          onImport={importRoster}
          onExport={exportCsv}
          importing={busy === 'import'}
        />
      )}

      {view === 'tasks' && (
        <TasksView
          lang={lang}
          tasks={tasks}
          me={me}
          ownerName={ownerName}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onOpenContact={setOpenContactId}
          onAdd={saveTask}
          owners={owners}
        />
      )}

      {openContact && (
        <ContactDrawer
          lang={lang}
          contact={openContact}
          owners={owners}
          ownerName={ownerName}
          deals={deals.filter((d) => d.contactId === openContact.id)}
          activities={activities.filter((a) => a.contactId === openContact.id)}
          tasks={tasks.filter((t) => t.contactId === openContact.id)}
          students={students}
          enrollments={enrollments}
          invoices={invoices}
          onClose={() => setOpenContactId(null)}
          onSave={(data) => saveContact(openContact.id, data)}
          onDelete={() => deleteContact(openContact)}
          onLog={(type, body) => logActivity({ contactId: openContact.id, activityType: type, body })}
          onAddTask={(title, dueDate) =>
            saveTask({ title, dueDate, contactId: openContact.id, contactName: openContact.fullName, ownerEmail: openContact.ownerEmail || me })
          }
          onToggleTask={toggleTask}
          onNewDeal={() => setDialog({ kind: 'deal', contactId: openContact.id })}
          onMoveDeal={moveDeal}
        />
      )}

      {dialog?.kind === 'contact' && (
        <ContactDialog
          lang={lang}
          owners={owners}
          me={me}
          onClose={() => setDialog(null)}
          onSave={async (data) => {
            const id = await saveContact(null, data);
            setDialog(null);
            if (id) setOpenContactId(id);
          }}
        />
      )}

      {dialog?.kind === 'deal' && (
        <DealDialog
          lang={lang}
          contacts={contacts}
          programs={programs}
          owners={owners}
          me={me}
          initialContactId={dialog.contactId}
          onClose={() => setDialog(null)}
          onSave={async (data) => {
            await saveDeal(data);
            setDialog(null);
            setView('pipeline');
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const Kpi: React.FC<{ label: string; value: string; sub?: string; tone?: 'plain' | 'alert'; onClick?: () => void }> = ({
  label: text,
  value,
  sub,
  tone = 'plain',
  onClick,
}) => {
  const body = (
    <>
      <p className="text-xs font-semibold text-muted">{text}</p>
      <p className={`text-2xl font-extrabold tracking-tight mt-1 ${tone === 'alert' ? 'text-lotus' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5 font-mono-num">{sub}</p>}
    </>
  );
  const cls = 'bg-white border border-ink/10 rounded-2xl px-4 py-3 text-left';
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:border-ink/25 transition-colors cursor-pointer`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
};

// ---- Sign-ups --------------------------------------------------------------

const SignupsView: React.FC<{
  lang: LangCode;
  pending: UserProfile[];
  reviewed: UserProfile[];
  busy: string | null;
  onApprove: (u: UserProfile, role: UserRole) => void;
  onDecline: (u: UserProfile, note: string) => void;
}> = ({ lang, pending, reviewed, busy, onApprove, onDecline }) => {
  const [roles, setRoles] = useState<Record<string, UserRole>>({});
  const [declining, setDeclining] = useState<string | null>(null);
  const [note, setNote] = useState('');

  return (
    <div className="space-y-5">
      <PanelCard padding="none">
        <div className="px-5 py-4 border-b border-ink/8">
          <h3 className="text-base font-bold text-ink">{biText(lang, 'New accounts waiting for approval', 'Tài khoản mới chờ duyệt')}</h3>
          <p className="text-sm text-muted mt-0.5">
            {biText(
              lang,
              'People who registered themselves can’t open the portal until you approve them. Invited people are approved automatically.',
              'Người tự đăng ký chỉ vào được cổng sau khi bạn duyệt. Người được mời sẽ tự động được duyệt.'
            )}
          </p>
        </div>
        {pending.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted text-center">{biText(lang, 'No one is waiting. New sign-ups will appear here.', 'Không có ai đang chờ. Đăng ký mới sẽ hiện ở đây.')}</p>
        ) : (
          <ul className="divide-y divide-ink/8">
            {pending.map((u) => {
              const role = roles[u.uid] || (u.role === 'student' ? 'student' : 'parent');
              return (
                <li key={u.uid} className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink truncate">{u.displayName || u.email}</p>
                    <p className="text-xs text-muted truncate">
                      {u.email}
                      {u.phone ? ` · ${u.phone}` : ''} · {biText(lang, 'asked to join as', 'đăng ký với vai trò')}{' '}
                      {label(APPROVABLE_ROLES, u.role, lang)}
                    </p>
                  </div>
                  {declining === u.uid ? (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <input
                        className={`${inputCls} sm:w-64`}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={biText(lang, 'Reason (optional, internal)', 'Lý do (không bắt buộc, nội bộ)')}
                        aria-label={biText(lang, 'Reason for declining', 'Lý do từ chối')}
                      />
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg bg-lotus text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                        disabled={busy === `decline_${u.uid}`}
                        onClick={() => {
                          onDecline(u, note);
                          setDeclining(null);
                          setNote('');
                        }}
                      >
                        {biText(lang, 'Decline account', 'Từ chối tài khoản')}
                      </button>
                      <button type="button" className={btnQuiet} onClick={() => setDeclining(null)}>
                        {biText(lang, 'Cancel', 'Huỷ')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="sr-only" htmlFor={`role_${u.uid}`}>
                        {biText(lang, 'Approve as', 'Duyệt với vai trò')}
                      </label>
                      <select
                        id={`role_${u.uid}`}
                        className="px-2.5 py-2 rounded-lg border border-ink/15 bg-white text-xs font-semibold text-ink"
                        value={role}
                        onChange={(e) => setRoles((r) => ({ ...r, [u.uid]: e.target.value as UserRole }))}
                      >
                        {APPROVABLE_ROLES.map((r) => (
                          <option key={r.id} value={r.id}>
                            {biText(lang, `as ${r.en}`, `là ${r.vi}`)}
                          </option>
                        ))}
                      </select>
                      <button type="button" className={btnPrimary} disabled={busy === `approve_${u.uid}`} onClick={() => onApprove(u, role)}>
                        <UserCheck className="w-3.5 h-3.5" />
                        {biText(lang, 'Approve', 'Duyệt')}
                      </button>
                      <button type="button" className={btnQuiet} onClick={() => setDeclining(u.uid)}>
                        <UserX className="w-3.5 h-3.5" />
                        {biText(lang, 'Decline', 'Từ chối')}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      {reviewed.length > 0 && (
        <PanelCard padding="none">
          <h3 className="px-5 py-4 border-b border-ink/8 text-sm font-bold text-ink">{biText(lang, 'Recently reviewed', 'Đã duyệt gần đây')}</h3>
          <ul className="divide-y divide-ink/8">
            {reviewed.map((u) => (
              <li key={u.uid} className="px-5 py-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="flex-1 min-w-0 truncate text-ink">
                  {u.displayName || u.email} <span className="text-muted">· {u.email}</span>
                </span>
                <span className={`text-xs font-bold ${u.status === 'declined' ? 'text-lotus' : 'text-lagoon'}`}>
                  {u.status === 'declined' ? biText(lang, 'Declined', 'Đã từ chối') : biText(lang, `Approved as ${u.role}`, `Đã duyệt (${u.role})`)}
                </span>
                <span className="text-xs text-muted">{formatDate(u.reviewedAt, lang)}</span>
                {u.status === 'declined' && (
                  <button type="button" className={btnQuiet} onClick={() => onApprove(u, u.role === 'student' ? 'student' : 'parent')}>
                    {biText(lang, 'Approve instead', 'Duyệt lại')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </PanelCard>
      )}
    </div>
  );
};

// ---- Pipeline --------------------------------------------------------------

const PipelineView: React.FC<{
  lang: LangCode;
  deals: CrmDeal[];
  ownerName: (email?: string) => string;
  onMove: (deal: CrmDeal, stage: CrmDealStage) => void;
  onOpenContact: (id: string) => void;
  onDelete: (deal: CrmDeal) => void;
  onNewDeal: () => void;
  hasContacts: boolean;
}> = ({ lang, deals, ownerName, onMove, onOpenContact, onDelete, onNewDeal, hasContacts }) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<CrmDealStage | null>(null);

  if (deals.length === 0) {
    return (
      <PanelCard className="text-center space-y-3">
        <h3 className="text-base font-bold text-ink">{biText(lang, 'No deals yet', 'Chưa có cơ hội nào')}</h3>
        <p className="text-sm text-muted max-w-md mx-auto">
          {hasContacts
            ? biText(lang, 'Create a deal for a family you’re talking to and move it along as they book a trial and enrol.', 'Tạo cơ hội cho gia đình đang tư vấn và kéo qua các bước đến khi ghi danh.')
            : biText(lang, 'Add a contact first, or import the families already on your roster from the Contacts view.', 'Hãy thêm liên hệ trước, hoặc nhập các gia đình có sẵn ở mục Liên hệ.')}
        </p>
        {hasContacts && (
          <button type="button" className={btnPrimary} onClick={onNewDeal}>
            <Plus className="w-3.5 h-3.5" />
            {biText(lang, 'New deal', 'Cơ hội mới')}
          </button>
        )}
      </PanelCard>
    );
  }

  return (
    <div className="overflow-x-auto no-scrollbar -mx-1 px-1 pb-2">
      <div className="grid grid-flow-col auto-cols-[minmax(230px,1fr)] gap-3 min-w-max lg:min-w-0">
        {DEAL_STAGES.map((stage) => {
          const items = deals.filter((d) => d.stage === stage.id);
          const total = items.reduce((a, d) => a + (d.amountVnd || 0), 0);
          return (
            <section
              key={stage.id}
              aria-label={biText(lang, stage.en, stage.vi)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const deal = deals.find((d) => d.id === dragId);
                if (deal) onMove(deal, stage.id);
                setDragId(null);
                setOverStage(null);
              }}
              className={`${stage.tone} rounded-2xl p-2.5 min-h-[240px] transition-shadow ${overStage === stage.id ? 'ring-2 ring-ink/30' : ''}`}
            >
              <header className="px-1.5 pb-2">
                <p className="text-xs font-bold text-ink">
                  {biText(lang, stage.en, stage.vi)} <span className="text-muted font-semibold">· {items.length}</span>
                </p>
                <p className="text-[11px] text-muted font-mono-num">{formatVnd(total)}</p>
              </header>
              <div className="space-y-2">
                {items.map((d) => (
                  <article
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`bg-white rounded-xl border border-ink/10 p-3 space-y-2 cursor-grab active:cursor-grabbing ${dragId === d.id ? 'opacity-50' : ''}`}
                  >
                    <button type="button" onClick={() => onOpenContact(d.contactId)} className="text-left w-full cursor-pointer">
                      <p className="text-sm font-bold text-ink leading-snug">{d.title}</p>
                      <p className="text-xs text-muted truncate">{d.contactName}</p>
                    </button>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-ink font-mono-num">{formatVnd(d.amountVnd)}</span>
                      {d.expectedCloseDate && <span className="text-muted">{formatDate(d.expectedCloseDate, lang)}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="sr-only" htmlFor={`stage_${d.id}`}>
                        {biText(lang, 'Stage', 'Giai đoạn')}
                      </label>
                      <select
                        id={`stage_${d.id}`}
                        value={d.stage}
                        onChange={(e) => onMove(d, e.target.value as CrmDealStage)}
                        className="flex-1 min-w-0 px-2 py-1 rounded-md border border-ink/12 bg-paper text-[11px] font-semibold text-ink"
                      >
                        {DEAL_STAGES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {biText(lang, s.en, s.vi)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => onDelete(d)}
                        aria-label={biText(lang, `Delete deal ${d.title}`, `Xoá cơ hội ${d.title}`)}
                        className="p-1.5 rounded-md text-muted hover:text-lotus hover:bg-chalk cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {d.ownerEmail && <p className="text-[11px] text-muted truncate">{ownerName(d.ownerEmail)}</p>}
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

// ---- Contacts ----------------------------------------------------------------

const ContactsView: React.FC<{
  lang: LangCode;
  contacts: CrmContact[];
  deals: CrmDeal[];
  tasks: CrmTask[];
  owners: Array<{ email: string; name: string }>;
  ownerName: (email?: string) => string;
  onOpen: (id: string) => void;
  onImport: () => void;
  onExport: () => void;
  importing: boolean;
}> = ({ lang, contacts, deals, tasks, owners, ownerName, onOpen, onImport, onExport, importing }) => {
  const [q, setQ] = useState('');
  const [type, setType] = useState<string>('all');
  const [stage, setStage] = useState<string>('all');
  const [owner, setOwner] = useState<string>('all');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contacts
      .filter((c) => type === 'all' || c.contactType === type)
      .filter((c) => stage === 'all' || c.lifecycleStage === stage)
      .filter((c) => owner === 'all' || c.ownerEmail === owner)
      .filter(
        (c) =>
          !needle ||
          [c.fullName, c.email, c.phone, c.childNames, (c.tags || []).join(' ')].some((v) => (v || '').toLowerCase().includes(needle))
      )
      .sort((a, b) =>
        sort === 'name' ? a.fullName.localeCompare(b.fullName) : (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '')
      );
  }, [contacts, q, type, stage, owner, sort]);

  const selectCls = 'px-2.5 py-2 rounded-lg border border-ink/15 bg-white text-xs font-semibold text-ink';

  return (
    <PanelCard padding="none">
      <div className="px-4 py-3 border-b border-ink/8 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className={`${inputCls} pl-9`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={biText(lang, 'Search name, email, phone, child, tag', 'Tìm tên, email, SĐT, tên bé, nhãn')}
            aria-label={biText(lang, 'Search contacts', 'Tìm liên hệ')}
          />
        </div>
        <select className={selectCls} value={type} onChange={(e) => setType(e.target.value)} aria-label={biText(lang, 'Type', 'Loại')}>
          <option value="all">{biText(lang, 'All types', 'Mọi loại')}</option>
          {CONTACT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {biText(lang, t.en, t.vi)}
            </option>
          ))}
        </select>
        <select className={selectCls} value={stage} onChange={(e) => setStage(e.target.value)} aria-label={biText(lang, 'Lifecycle stage', 'Giai đoạn')}>
          <option value="all">{biText(lang, 'All stages', 'Mọi giai đoạn')}</option>
          {LIFECYCLE.map((t) => (
            <option key={t.id} value={t.id}>
              {biText(lang, t.en, t.vi)}
            </option>
          ))}
        </select>
        <select className={selectCls} value={owner} onChange={(e) => setOwner(e.target.value)} aria-label={biText(lang, 'Owner', 'Phụ trách')}>
          <option value="all">{biText(lang, 'All owners', 'Mọi người phụ trách')}</option>
          {owners.map((o) => (
            <option key={o.email} value={o.email}>
              {o.name}
            </option>
          ))}
        </select>
        <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')} aria-label={biText(lang, 'Sort', 'Sắp xếp')}>
          <option value="recent">{biText(lang, 'Recent activity', 'Hoạt động gần đây')}</option>
          <option value="name">{biText(lang, 'Name A–Z', 'Tên A–Z')}</option>
        </select>
        <button type="button" className={btnQuiet} onClick={onImport} disabled={importing}>
          {importing ? biText(lang, 'Importing…', 'Đang nhập…') : biText(lang, 'Import roster', 'Nhập từ danh sách')}
        </button>
        <button type="button" className={btnQuiet} onClick={onExport} disabled={!contacts.length}>
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-5 py-10 text-sm text-muted text-center">
          {contacts.length
            ? biText(lang, 'No contacts match these filters.', 'Không có liên hệ nào khớp bộ lọc.')
            : biText(lang, 'No contacts yet. Add one, or import the families already on your roster.', 'Chưa có liên hệ. Hãy thêm mới hoặc nhập từ danh sách học viên.')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted border-b border-ink/8">
                <th className="px-4 py-2.5">{biText(lang, 'Name', 'Tên')}</th>
                <th className="px-4 py-2.5">{biText(lang, 'Type', 'Loại')}</th>
                <th className="px-4 py-2.5">{biText(lang, 'Stage', 'Giai đoạn')}</th>
                <th className="px-4 py-2.5">{biText(lang, 'Owner', 'Phụ trách')}</th>
                <th className="px-4 py-2.5 text-right">{biText(lang, 'Open deals', 'Cơ hội mở')}</th>
                <th className="px-4 py-2.5">{biText(lang, 'Next task', 'Việc tiếp theo')}</th>
                <th className="px-4 py-2.5">{biText(lang, 'Last activity', 'Hoạt động cuối')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {rows.map((c) => {
                const open = deals.filter((d) => d.contactId === c.id && d.stage !== 'won' && d.stage !== 'lost');
                const next = tasks
                  .filter((t) => t.contactId === c.id && !t.done)
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
                return (
                  <tr key={c.id} className="hover:bg-paper cursor-pointer" onClick={() => onOpen(c.id)}>
                    <td className="px-4 py-3">
                      <button type="button" className="text-left cursor-pointer" onClick={() => onOpen(c.id)}>
                        <span className="block font-bold text-ink">{c.fullName}</span>
                        <span className="block text-xs text-muted">{c.email || c.phone || '—'}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-ink">{label(CONTACT_TYPES, c.contactType, lang)}</td>
                    <td className="px-4 py-3 text-ink">{label(LIFECYCLE, c.lifecycleStage, lang)}</td>
                    <td className="px-4 py-3 text-muted">{ownerName(c.ownerEmail)}</td>
                    <td className="px-4 py-3 text-right font-mono-num text-ink">{open.length || '—'}</td>
                    <td className="px-4 py-3 text-xs">
                      {next ? (
                        <span className={next.dueDate < todayIso() ? 'text-lotus font-semibold' : 'text-ink'}>
                          {next.title} · {formatDate(next.dueDate, lang)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDate(c.lastActivityAt, lang)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
};

// ---- Tasks ---------------------------------------------------------------------

const TasksView: React.FC<{
  lang: LangCode;
  tasks: CrmTask[];
  me: string;
  owners: Array<{ email: string; name: string }>;
  ownerName: (email?: string) => string;
  onToggle: (t: CrmTask) => void;
  onDelete: (t: CrmTask) => void;
  onOpenContact: (id: string) => void;
  onAdd: (t: Pick<CrmTask, 'title' | 'dueDate' | 'contactId' | 'contactName' | 'ownerEmail'>) => void;
}> = ({ lang, tasks, me, owners, ownerName, onToggle, onDelete, onOpenContact, onAdd }) => {
  const [scope, setScope] = useState<'mine' | 'all' | 'done'>('mine');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayIso());
  const [owner, setOwner] = useState(me);
  const today = todayIso();

  const rows = tasks
    .filter((t) => (scope === 'done' ? t.done : !t.done))
    .filter((t) => scope !== 'mine' || t.ownerEmail === me)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <PanelCard padding="none">
      <form
        className="px-4 py-3 border-b border-ink/8 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onAdd({ title: title.trim().slice(0, 200), dueDate: due, ownerEmail: owner });
          setTitle('');
        }}
      >
        <input
          className={`${inputCls} flex-1 min-w-[200px]`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={biText(lang, 'Add a task, e.g. “Call back about Saturday trial”', 'Thêm việc, vd. “Gọi lại về buổi học thử thứ Bảy”')}
          aria-label={biText(lang, 'Task', 'Công việc')}
        />
        <input type="date" className={`${inputCls} w-auto`} value={due} onChange={(e) => setDue(e.target.value)} aria-label={biText(lang, 'Due date', 'Hạn')} />
        <select className="px-2.5 py-2 rounded-lg border border-ink/15 bg-white text-xs font-semibold text-ink" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label={biText(lang, 'Owner', 'Phụ trách')}>
          {owners.map((o) => (
            <option key={o.email} value={o.email}>
              {o.name}
            </option>
          ))}
        </select>
        <button type="submit" className={btnPrimary} disabled={!title.trim()}>
          <Plus className="w-3.5 h-3.5" />
          {biText(lang, 'Add task', 'Thêm việc')}
        </button>
      </form>
      <div className="px-4 pt-3">
        <SegmentedControl
          value={scope}
          onChange={setScope}
          options={[
            { id: 'mine', label: biText(lang, 'My tasks', 'Việc của tôi') },
            { id: 'all', label: biText(lang, 'Everyone', 'Tất cả') },
            { id: 'done', label: biText(lang, 'Done', 'Đã xong') },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-10 text-sm text-muted text-center">{biText(lang, 'Nothing here.', 'Không có việc nào.')}</p>
      ) : (
        <ul className="divide-y divide-ink/6 mt-2">
          {rows.map((t) => {
            const overdue = !t.done && t.dueDate < today;
            return (
              <li key={t.id} className="px-4 py-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onToggle(t)}
                  aria-label={t.done ? biText(lang, 'Mark as not done', 'Đánh dấu chưa xong') : biText(lang, 'Mark as done', 'Đánh dấu đã xong')}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${t.done ? 'bg-lagoon border-lagoon text-white' : 'border-ink/30 bg-white'}`}
                >
                  {t.done && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${t.done ? 'line-through text-muted' : 'text-ink font-semibold'}`}>{t.title}</p>
                  <p className="text-xs text-muted">
                    {t.contactId ? (
                      <button type="button" className="underline underline-offset-2 hover:text-ink cursor-pointer" onClick={() => onOpenContact(t.contactId as string)}>
                        {t.contactName}
                      </button>
                    ) : null}
                    {t.contactId ? ' · ' : ''}
                    {ownerName(t.ownerEmail)}
                  </p>
                </div>
                <span className={`text-xs whitespace-nowrap ${overdue ? 'text-lotus font-bold' : 'text-muted'}`}>
                  {overdue ? biText(lang, 'Overdue · ', 'Quá hạn · ') : ''}
                  {formatDate(t.dueDate, lang)}
                </span>
                <button type="button" onClick={() => onDelete(t)} aria-label={biText(lang, 'Delete task', 'Xoá việc')} className="p-1.5 rounded-md text-muted hover:text-lotus hover:bg-chalk cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
};

// ---- Contact drawer -----------------------------------------------------------

const ContactDrawer: React.FC<{
  lang: LangCode;
  contact: CrmContact;
  owners: Array<{ email: string; name: string }>;
  ownerName: (email?: string) => string;
  deals: CrmDeal[];
  activities: CrmActivity[];
  tasks: CrmTask[];
  students: StudentProfile[];
  enrollments: EnrollmentRequest[];
  invoices: TuitionInvoice[];
  onClose: () => void;
  onSave: (data: Partial<CrmContact>) => Promise<unknown>;
  onDelete: () => void;
  onLog: (type: CrmActivityType, body: string) => Promise<unknown>;
  onAddTask: (title: string, dueDate: string) => void;
  onToggleTask: (t: CrmTask) => void;
  onNewDeal: () => void;
  onMoveDeal: (d: CrmDeal, s: CrmDealStage) => void;
}> = (p) => {
  const { lang, contact } = p;
  const [form, setForm] = useState<CrmContact>(contact);
  const [tagText, setTagText] = useState((contact.tags || []).join(', '));
  const [actType, setActType] = useState<CrmActivityType>('note');
  const [actBody, setActBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState(todayIso());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(contact);
    setTagText((contact.tags || []).join(', '));
    setConfirmDelete(false);
  }, [contact.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && p.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p]);

  const email = (contact.email || '').toLowerCase();
  const linkedStudents = email
    ? p.students.filter((s) => (s.parentEmail || '').toLowerCase() === email || (s.studentEmail || '').toLowerCase() === email)
    : [];
  const linkedInvoices = email ? p.invoices.filter((i) => (i.parentEmail || '').toLowerCase() === email) : [];
  const linkedEnrollments = email ? p.enrollments.filter((e) => (e.parentEmail || '').toLowerCase() === email) : [];
  const unpaid = linkedInvoices.filter((i) => i.status !== 'paid');

  const save = async () => {
    await p.onSave({
      fullName: form.fullName.trim() || contact.fullName,
      email: (form.email || '').trim().toLowerCase(),
      phone: (form.phone || '').trim(),
      contactType: form.contactType,
      lifecycleStage: form.lifecycleStage,
      leadSource: form.leadSource,
      ownerEmail: form.ownerEmail || '',
      childNames: (form.childNames || '').trim(),
      notes: (form.notes || '').trim().slice(0, 4000),
      tags: tagText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (labelText: string, el: React.ReactNode) => (
    <label className="block space-y-1">
      <span className="text-xs font-bold text-ink">{labelText}</span>
      {el}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end no-print" role="dialog" aria-modal="true" aria-label={contact.fullName}>
      <button type="button" aria-label={biText(lang, 'Close', 'Đóng')} className="absolute inset-0 bg-ink/40 cursor-default" onClick={p.onClose} />
      <aside className="relative w-full max-w-[640px] h-full bg-paper overflow-y-auto shadow-2xl">
        <header className="sticky top-0 z-10 bg-white border-b border-ink/10 px-5 py-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold text-ink truncate">{contact.fullName}</h2>
            <p className="text-xs text-muted">
              {label(CONTACT_TYPES, contact.contactType, lang)} · {label(LIFECYCLE, contact.lifecycleStage, lang)} ·{' '}
              {biText(lang, 'Owner', 'Phụ trách')}: {p.ownerName(contact.ownerEmail)}
            </p>
            <div className="flex flex-wrap gap-2 mt-2.5">
              {contact.email && (
                <a className={btnQuiet} href={`mailto:${contact.email}`}>
                  <Mail className="w-3.5 h-3.5" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a className={btnQuiet} href={`tel:${contact.phone}`}>
                  <Phone className="w-3.5 h-3.5" />
                  {contact.phone}
                </a>
              )}
              {zaloLink(contact.phone) && (
                <a className={btnQuiet} href={zaloLink(contact.phone)} target="_blank" rel="noreferrer">
                  <MessageCircle className="w-3.5 h-3.5" />
                  Zalo
                </a>
              )}
            </div>
          </div>
          <button type="button" onClick={p.onClose} aria-label={biText(lang, 'Close', 'Đóng')} className="p-2 rounded-lg hover:bg-chalk cursor-pointer">
            <X className="w-5 h-5 text-ink" />
          </button>
        </header>

        <div className="p-5 space-y-5">
          {/* Log activity */}
          <PanelCard padding="sm" className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={actType === t.id}
                  onClick={() => setActType(t.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${actType === t.id ? 'bg-ink text-white' : 'bg-chalk text-muted hover:text-ink'}`}
                >
                  {biText(lang, t.en, t.vi)}
                </button>
              ))}
            </div>
            <textarea
              className={`${inputCls} min-h-[72px]`}
              value={actBody}
              onChange={(e) => setActBody(e.target.value)}
              placeholder={biText(lang, 'What happened? e.g. “Mum wants Saturday mornings, will bring both kids to the trial.”', 'Đã trao đổi gì? vd. “Mẹ muốn học sáng thứ Bảy, sẽ đưa cả hai bé đi học thử.”')}
              aria-label={biText(lang, 'Activity details', 'Chi tiết hoạt động')}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className={btnPrimary}
                disabled={!actBody.trim()}
                onClick={async () => {
                  await p.onLog(actType, actBody.trim().slice(0, 4000));
                  setActBody('');
                }}
              >
                {biText(lang, `Log ${label(ACTIVITY_TYPES, actType, 'en').toLowerCase()}`, `Lưu ${label(ACTIVITY_TYPES, actType, 'vi').toLowerCase()}`)}
              </button>
            </div>
          </PanelCard>

          {/* Deals */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{biText(lang, 'Deals', 'Cơ hội')}</h3>
              <button type="button" className={btnQuiet} onClick={p.onNewDeal}>
                <Plus className="w-3.5 h-3.5" />
                {biText(lang, 'New deal', 'Cơ hội mới')}
              </button>
            </div>
            {p.deals.length === 0 ? (
              <p className="text-sm text-muted">{biText(lang, 'No deals for this contact.', 'Chưa có cơ hội.')}</p>
            ) : (
              p.deals.map((d) => (
                <div key={d.id} className="bg-white rounded-xl border border-ink/10 px-3.5 py-2.5 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink">{d.title}</p>
                    <p className="text-xs text-muted font-mono-num">{formatVnd(d.amountVnd)}</p>
                  </div>
                  <select
                    value={d.stage}
                    onChange={(e) => p.onMoveDeal(d, e.target.value as CrmDealStage)}
                    className="px-2 py-1.5 rounded-md border border-ink/12 bg-paper text-xs font-semibold text-ink"
                    aria-label={biText(lang, 'Stage', 'Giai đoạn')}
                  >
                    {DEAL_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {biText(lang, s.en, s.vi)}
                      </option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </section>

          {/* Tasks */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-ink">{biText(lang, 'Tasks', 'Công việc')}</h3>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskTitle.trim()) return;
                p.onAddTask(taskTitle.trim().slice(0, 200), taskDue);
                setTaskTitle('');
              }}
            >
              <input className={`${inputCls} flex-1 min-w-[160px]`} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={biText(lang, 'Follow-up task', 'Việc cần làm tiếp')} aria-label={biText(lang, 'Task', 'Công việc')} />
              <input type="date" className={`${inputCls} w-auto`} value={taskDue} onChange={(e) => setTaskDue(e.target.value)} aria-label={biText(lang, 'Due date', 'Hạn')} />
              <button type="submit" className={btnQuiet} disabled={!taskTitle.trim()}>
                <Calendar className="w-3.5 h-3.5" />
                {biText(lang, 'Add', 'Thêm')}
              </button>
            </form>
            {p.tasks
              .slice()
              .sort((a, b) => Number(a.done) - Number(b.done) || a.dueDate.localeCompare(b.dueDate))
              .map((t) => (
                <label key={t.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={t.done} onChange={() => p.onToggleTask(t)} className="w-4 h-4 accent-[#1F9A92]" />
                  <span className={t.done ? 'line-through text-muted' : t.dueDate < todayIso() ? 'text-lotus font-semibold' : 'text-ink'}>
                    {t.title} · {formatDate(t.dueDate, lang)}
                  </span>
                </label>
              ))}
          </section>

          {/* Linked academy records */}
          {(linkedStudents.length > 0 || linkedInvoices.length > 0 || linkedEnrollments.length > 0) && (
            <section className="space-y-2">
              <h3 className="text-sm font-bold text-ink">{biText(lang, 'At the academy', 'Tại học viện')}</h3>
              <div className="bg-white rounded-xl border border-ink/10 divide-y divide-ink/6 text-sm">
                {linkedStudents.map((s) => (
                  <p key={s.id} className="px-3.5 py-2.5 text-ink">
                    {s.fullName} <span className="text-muted">· {s.cefrLevel} · {s.status}</span>
                  </p>
                ))}
                {linkedEnrollments.map((e) => (
                  <p key={e.id} className="px-3.5 py-2.5 text-ink">
                    {biText(lang, 'Enrolment', 'Ghi danh')}: {e.programTitle} <span className="text-muted">· {e.status}</span>
                  </p>
                ))}
                {linkedInvoices.length > 0 && (
                  <p className="px-3.5 py-2.5 text-ink">
                    {biText(lang, `${linkedInvoices.length} invoices`, `${linkedInvoices.length} hoá đơn`)}
                    {unpaid.length > 0 ? (
                      <span className="text-lotus font-semibold">
                        {' '}
                        · {biText(lang, 'unpaid', 'chưa thanh toán')} {formatVnd(unpaid.reduce((a, i) => a + (i.amountVnd || 0), 0))}
                      </span>
                    ) : (
                      <span className="text-lagoon font-semibold"> · {biText(lang, 'all paid', 'đã thanh toán đủ')}</span>
                    )}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Timeline */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-ink">{biText(lang, 'Activity', 'Lịch sử hoạt động')}</h3>
            {p.activities.length === 0 ? (
              <p className="text-sm text-muted">{biText(lang, 'Nothing logged yet.', 'Chưa có hoạt động.')}</p>
            ) : (
              <ol className="space-y-2">
                {p.activities.map((a) => (
                  <li key={a.id} className="bg-white rounded-xl border border-ink/10 px-3.5 py-2.5">
                    <p className="text-xs text-muted">
                      <span className="font-bold text-ink">
                        {a.activityType === 'stage_change'
                          ? biText(lang, 'Deal update', 'Cập nhật cơ hội')
                          : a.activityType === 'approval'
                            ? biText(lang, 'Account', 'Tài khoản')
                            : label(ACTIVITY_TYPES, a.activityType, lang)}
                      </span>{' '}
                      · {formatDate(a.occurredAt, lang)} · {a.authorEmail}
                    </p>
                    <p className="text-sm text-ink whitespace-pre-wrap mt-1">{a.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Details */}
          <PanelCard padding="sm" className="space-y-3">
            <h3 className="text-sm font-bold text-ink">{biText(lang, 'Details', 'Thông tin')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {field(biText(lang, 'Full name', 'Họ tên'), <input className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />)}
              {field('Email', <input type="email" className={inputCls} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />)}
              {field(biText(lang, 'Phone / Zalo', 'SĐT / Zalo'), <input className={inputCls} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />)}
              {field(
                biText(lang, 'Children', 'Tên các bé'),
                <input className={inputCls} value={form.childNames || ''} onChange={(e) => setForm({ ...form, childNames: e.target.value })} />
              )}
              {field(
                biText(lang, 'Type', 'Loại'),
                <select className={inputCls} value={form.contactType} onChange={(e) => setForm({ ...form, contactType: e.target.value as CrmContactType })}>
                  {CONTACT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {biText(lang, t.en, t.vi)}
                    </option>
                  ))}
                </select>
              )}
              {field(
                biText(lang, 'Lifecycle stage', 'Giai đoạn'),
                <select className={inputCls} value={form.lifecycleStage} onChange={(e) => setForm({ ...form, lifecycleStage: e.target.value as CrmLifecycleStage })}>
                  {LIFECYCLE.map((t) => (
                    <option key={t.id} value={t.id}>
                      {biText(lang, t.en, t.vi)}
                    </option>
                  ))}
                </select>
              )}
              {field(
                biText(lang, 'Source', 'Nguồn'),
                <select className={inputCls} value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value as CrmLeadSource })}>
                  {SOURCES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {biText(lang, t.en, t.vi)}
                    </option>
                  ))}
                </select>
              )}
              {field(
                biText(lang, 'Owner', 'Phụ trách'),
                <select className={inputCls} value={form.ownerEmail || ''} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}>
                  <option value="">{biText(lang, 'Unassigned', 'Chưa giao')}</option>
                  {p.owners.map((o) => (
                    <option key={o.email} value={o.email}>
                      {o.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {field(
              biText(lang, 'Tags (comma-separated)', 'Nhãn (cách nhau bởi dấu phẩy)'),
              <input className={inputCls} value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="VIP, siblings, Thu Duc" />
            )}
            {field(
              biText(lang, 'Notes', 'Ghi chú'),
              <textarea className={`${inputCls} min-h-[80px]`} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-lotus font-semibold">{biText(lang, 'Delete this contact? Deals and history stay.', 'Xoá liên hệ? Cơ hội và lịch sử vẫn được giữ.')}</span>
                  <button type="button" className="px-3 py-2 rounded-lg bg-lotus text-white text-xs font-bold cursor-pointer" onClick={p.onDelete}>
                    {biText(lang, 'Delete contact', 'Xoá liên hệ')}
                  </button>
                  <button type="button" className={btnQuiet} onClick={() => setConfirmDelete(false)}>
                    {biText(lang, 'Keep', 'Giữ lại')}
                  </button>
                </div>
              ) : (
                <button type="button" className="text-xs font-semibold text-muted hover:text-lotus cursor-pointer inline-flex items-center gap-1" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="w-3.5 h-3.5" />
                  {biText(lang, 'Delete contact', 'Xoá liên hệ')}
                </button>
              )}
              <button type="button" className={btnPrimary} onClick={() => void save()}>
                {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                {saved ? biText(lang, 'Saved', 'Đã lưu') : biText(lang, 'Save details', 'Lưu thông tin')}
              </button>
            </div>
          </PanelCard>
        </div>
      </aside>
    </div>
  );
};

// ---- Dialogs ---------------------------------------------------------------------

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; closeLabel: string }> = ({ title, onClose, children, closeLabel }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={closeLabel} className="absolute inset-0 bg-ink/40 cursor-default" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="p-1.5 rounded-lg hover:bg-chalk cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const ContactDialog: React.FC<{
  lang: LangCode;
  owners: Array<{ email: string; name: string }>;
  me: string;
  onClose: () => void;
  onSave: (data: Partial<CrmContact>) => Promise<void>;
}> = ({ lang, owners, me, onClose, onSave }) => {
  const [f, setF] = useState({
    fullName: '',
    email: '',
    phone: '',
    childNames: '',
    contactType: 'lead' as CrmContactType,
    leadSource: 'zalo' as CrmLeadSource,
    ownerEmail: me,
    notes: '',
  });
  return (
    <Modal title={biText(lang, 'New contact', 'Liên hệ mới')} onClose={onClose} closeLabel={biText(lang, 'Close', 'Đóng')}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            fullName: f.fullName.trim(),
            email: f.email.trim().toLowerCase(),
            phone: f.phone.trim(),
            childNames: f.childNames.trim(),
            contactType: f.contactType,
            lifecycleStage: f.contactType === 'lead' ? 'lead' : 'customer',
            leadSource: f.leadSource,
            ownerEmail: f.ownerEmail,
            notes: f.notes.trim(),
            tags: [],
          });
        }}
      >
        <input required className={inputCls} placeholder={biText(lang, 'Full name', 'Họ tên')} value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} aria-label={biText(lang, 'Full name', 'Họ tên')} />
        <div className="grid grid-cols-2 gap-2">
          <input type="email" className={inputCls} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email" />
          <input className={inputCls} placeholder={biText(lang, 'Phone / Zalo', 'SĐT / Zalo')} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} aria-label={biText(lang, 'Phone', 'SĐT')} />
        </div>
        <input className={inputCls} placeholder={biText(lang, 'Children’s names and ages', 'Tên và tuổi các bé')} value={f.childNames} onChange={(e) => setF({ ...f, childNames: e.target.value })} aria-label={biText(lang, 'Children', 'Các bé')} />
        <div className="grid grid-cols-3 gap-2">
          <select className={inputCls} value={f.contactType} onChange={(e) => setF({ ...f, contactType: e.target.value as CrmContactType })} aria-label={biText(lang, 'Type', 'Loại')}>
            {CONTACT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {biText(lang, t.en, t.vi)}
              </option>
            ))}
          </select>
          <select className={inputCls} value={f.leadSource} onChange={(e) => setF({ ...f, leadSource: e.target.value as CrmLeadSource })} aria-label={biText(lang, 'Source', 'Nguồn')}>
            {SOURCES.map((t) => (
              <option key={t.id} value={t.id}>
                {biText(lang, t.en, t.vi)}
              </option>
            ))}
          </select>
          <select className={inputCls} value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} aria-label={biText(lang, 'Owner', 'Phụ trách')}>
            {owners.map((o) => (
              <option key={o.email} value={o.email}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <textarea className={`${inputCls} min-h-[70px]`} placeholder={biText(lang, 'Notes', 'Ghi chú')} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} aria-label={biText(lang, 'Notes', 'Ghi chú')} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnQuiet} onClick={onClose}>
            {biText(lang, 'Cancel', 'Huỷ')}
          </button>
          <button type="submit" className={btnPrimary} disabled={!f.fullName.trim()}>
            {biText(lang, 'Create contact', 'Tạo liên hệ')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const DealDialog: React.FC<{
  lang: LangCode;
  contacts: CrmContact[];
  programs: ProgramCourse[];
  owners: Array<{ email: string; name: string }>;
  me: string;
  initialContactId?: string;
  onClose: () => void;
  onSave: (data: Omit<CrmDeal, 'id' | 'createdByEmail'>) => Promise<void>;
}> = ({ lang, contacts, programs, owners, me, initialContactId, onClose, onSave }) => {
  const sorted = useMemo(() => contacts.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)), [contacts]);
  const [contactId, setContactId] = useState(initialContactId || sorted[0]?.id || '');
  const [programId, setProgramId] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState(0);
  const [stage, setStage] = useState<CrmDealStage>('new');
  const [close, setClose] = useState('');
  const [owner, setOwner] = useState(me);
  const contact = contacts.find((c) => c.id === contactId);
  const program = programs.find((pr) => pr.id === programId);

  return (
    <Modal title={biText(lang, 'New deal', 'Cơ hội mới')} onClose={onClose} closeLabel={biText(lang, 'Close', 'Đóng')}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!contact) return;
          void onSave({
            title: title.trim() || `${contact.fullName} · ${program ? program.titleEn : 'Enrolment'}`,
            contactId: contact.id,
            contactName: contact.fullName,
            ...(program ? { programId: program.id, programTitle: lang === 'en' ? program.titleEn : program.titleVi } : {}),
            amountVnd: Math.max(0, Math.round(amount || 0)),
            stage,
            ...(close ? { expectedCloseDate: close } : {}),
            ownerEmail: owner,
          });
        }}
      >
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink">{biText(lang, 'Contact', 'Liên hệ')}</span>
          <select className={inputCls} value={contactId} onChange={(e) => setContactId(e.target.value)} required>
            {sorted.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
                {c.email ? ` · ${c.email}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink">{biText(lang, 'Program', 'Chương trình')}</span>
          <select
            className={inputCls}
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              const pr = programs.find((x) => x.id === e.target.value);
              if (pr && !amount) setAmount(pr.tuitionVnd || 0);
            }}
          >
            <option value="">{biText(lang, 'Not decided yet', 'Chưa chọn')}</option>
            {programs.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {lang === 'en' ? pr.titleEn : pr.titleVi} · {formatVnd(pr.tuitionVnd)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-ink">{biText(lang, 'Deal name (optional)', 'Tên cơ hội (không bắt buộc)')}</span>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={contact ? `${contact.fullName} · ${program ? program.titleEn : 'Enrolment'}` : ''} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-bold text-ink">{biText(lang, 'Value (VND)', 'Giá trị (VND)')}</span>
            <input type="number" min={0} step={50000} className={`${inputCls} font-mono-num`} value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-ink">{biText(lang, 'Expected close', 'Dự kiến chốt')}</span>
            <input type="date" className={inputCls} value={close} onChange={(e) => setClose(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-ink">{biText(lang, 'Stage', 'Giai đoạn')}</span>
            <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value as CrmDealStage)}>
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {biText(lang, s.en, s.vi)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-ink">{biText(lang, 'Owner', 'Phụ trách')}</span>
            <select className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
              {owners.map((o) => (
                <option key={o.email} value={o.email}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnQuiet} onClick={onClose}>
            {biText(lang, 'Cancel', 'Huỷ')}
          </button>
          <button type="submit" className={btnPrimary} disabled={!contact}>
            {biText(lang, 'Create deal', 'Tạo cơ hội')}
          </button>
        </div>
      </form>
    </Modal>
  );
};

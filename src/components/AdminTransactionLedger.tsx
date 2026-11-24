import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  BellRing,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Download,
  History,
  Mail,
  MessageCircle,
  QrCode,
  Receipt,
  Search,
  TrendingUp,
  User,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { biText, formatVnd } from '../i18n';
import { isSuperAdminEmail } from '../services/seedData';
import type {
  LangCode,
  ParentPaymentMethod,
  PaymentReminderLog,
  StudentProfile,
  TuitionInvoice,
  UserProfile,
} from '../types';

interface AdminTransactionLedgerProps {
  lang: LangCode;
  currentUser: UserProfile;
  students: StudentProfile[];
  paymentMethods: ParentPaymentMethod[];
  onOpenReminder: (inv: TuitionInvoice) => void;
  onMarkInvoicePaid: (inv: TuitionInvoice) => Promise<void>;
  onNavigateToAnalytics?: () => void;
  onFlash: (msg: string) => void;
}

type LedgerViewMode = 'by_parent' | 'timeline';
type LedgerEntryType = 'all' | 'completed' | 'pending' | 'reminder';

interface UnifiedLedgerEntry {
  id: string;
  entryType: 'completed' | 'pending' | 'reminder';
  timestampIso: string;
  sortMs: number;
  parentEmail: string;
  studentName: string;
  invoiceNumber: string;
  programTitle: string;
  amountVnd: number;
  methodOrChannel: string;
  referenceOrPreview: string;
  bankOrPhone: string;
  statusLabel: string;
  invoice?: TuitionInvoice;
}

interface ParentLedgerSummary {
  parentEmail: string;
  parentDisplayName: string;
  parentPhone: string;
  studentNames: string[];
  savedBankSummary: string;
  completedTransactions: TuitionInvoice[];
  pendingInvoices: TuitionInvoice[];
  reminderLogs: PaymentReminderLog[];
  totalCollectedVnd: number;
  totalPendingVnd: number;
  latestActivityMs: number;
}

function toIsoAndMs(value: unknown, fallbackDateStr?: string): { iso: string; ms: number } {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return { iso: value.slice(0, 19).replace('T', ' '), ms: parsed };
    }
    return { iso: value.slice(0, 19), ms: 0 };
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const secs = Number((value as { seconds?: number }).seconds || 0);
    if (secs > 0) {
      const d = new Date(secs * 1000);
      return { iso: d.toISOString().slice(0, 19).replace('T', ' '), ms: secs * 1000 };
    }
  }
  if (fallbackDateStr) {
    const parsed = Date.parse(fallbackDateStr);
    if (!Number.isNaN(parsed)) {
      return { iso: fallbackDateStr, ms: parsed };
    }
    return { iso: fallbackDateStr, ms: 0 };
  }
  return { iso: '—', ms: 0 };
}

export const AdminTransactionLedger: React.FC<AdminTransactionLedgerProps> = ({
  lang,
  currentUser,
  students,
  paymentMethods,
  onOpenReminder,
  onMarkInvoicePaid,
  onNavigateToAnalytics,
  onFlash,
}) => {
  const [ledgerInvoices, setLedgerInvoices] = useState<TuitionInvoice[]>([]);
  const [firestoreReminderLogs, setFirestoreReminderLogs] = useState<PaymentReminderLog[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(true);

  const [viewMode, setViewMode] = useState<LedgerViewMode>('by_parent');
  const [entryFilter, setEntryFilter] = useState<LedgerEntryType>('all');
  const [selectedParentEmail, setSelectedParentEmail] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  const isFullAdmin =
    isSuperAdminEmail(currentUser.email) ||
    currentUser.role === 'super_admin' ||
    currentUser.role === 'admin';

  // Fetch live payment records (invoices) & automated reminder logs directly from Firestore
  useEffect(() => {
    setLoadingLedger(true);
    let invoicesReady = false;
    let logsReady = false;
    const markReady = () => {
      if (invoicesReady && logsReady) setLoadingLedger(false);
    };

    const invRef = isFullAdmin
      ? collection(db, 'invoices')
      : query(collection(db, 'invoices'), where('adminUids', 'array-contains', currentUser.uid));

    // V2: the reminder log only grows; show the latest 300 instead of reading every log ever sent
    const logRef = isFullAdmin
      ? query(collection(db, 'reminder_logs'), orderBy('sentAt', 'desc'), limit(300))
      : query(collection(db, 'reminder_logs'), where('adminUids', 'array-contains', currentUser.uid));

    const unsubInv = onSnapshot(
      invRef,
      (snap) => {
        setLedgerInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TuitionInvoice)));
        invoicesReady = true;
        markReady();
      },
      (err) => {
        invoicesReady = true;
        markReady();
        handleFirestoreError(err, OperationType.LIST, 'invoices');
      }
    );

    const unsubLogs = onSnapshot(
      logRef,
      (snap) => {
        setFirestoreReminderLogs(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentReminderLog))
        );
        logsReady = true;
        markReady();
      },
      (err) => {
        logsReady = true;
        markReady();
        handleFirestoreError(err, OperationType.LIST, 'reminder_logs');
      }
    );

    return () => {
      unsubInv();
      unsubLogs();
    };
  }, [currentUser.uid, isFullAdmin]);

  // Combine dedicated Firestore reminder_logs with legacy invoice reminder metadata
  const mergedReminderLogs = useMemo<PaymentReminderLog[]>(() => {
    const byKey = new Set<string>();
    const combined: PaymentReminderLog[] = [];

    for (const log of firestoreReminderLogs) {
      byKey.add(`${log.invoiceId}|${log.sentAt.slice(0, 16)}|${log.channel}`);
      combined.push(log);
    }

    for (const inv of ledgerInvoices) {
      if (!inv.lastReminderAt && !inv.reminderNote) continue;
      const channel: 'email' | 'zalo' = inv.reminderChannel === 'email' ? 'email' : 'zalo';
      const sentAt =
        inv.lastReminderAt || toIsoAndMs(inv.updatedAt, inv.dueDate).iso || new Date().toISOString().slice(0, 19);
      const dedupeKey = `${inv.id}|${sentAt.slice(0, 16)}|${channel}`;
      const hasAnyLogForInv = firestoreReminderLogs.some((l) => l.invoiceId === inv.id);
      if (byKey.has(dedupeKey) || hasAnyLogForInv) continue;

      combined.push({
        id: `legacy_${inv.id}`,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        studentId: inv.studentId,
        studentName: inv.studentName,
        parentEmail: inv.parentEmail,
        parentPhone: inv.parentPhone,
        programTitle: inv.programTitle,
        amountVnd: inv.amountVnd,
        channel,
        deliveryMode: channel === 'zalo' ? 'zalo_logged' : 'email_logged',
        messagePreview: inv.reminderNote || `Payment reminder dispatched for ${inv.invoiceNumber}.`,
        sentByUid: currentUser.uid,
        sentByEmail: currentUser.email,
        sentAt,
        adminUids: inv.adminUids || [],
        createdAt: inv.updatedAt || inv.createdAt,
      });
    }

    return combined.sort((a, b) => {
      const ma = toIsoAndMs(a.sentAt || a.createdAt).ms;
      const mb = toIsoAndMs(b.sentAt || b.createdAt).ms;
      return mb - ma;
    });
  }, [firestoreReminderLogs, ledgerInvoices, currentUser.uid, currentUser.email]);

  // Build per-parent ledger summaries
  const parentSummaries = useMemo<ParentLedgerSummary[]>(() => {
    const map = new Map<string, ParentLedgerSummary>();

    const ensureParent = (rawEmail: string): ParentLedgerSummary => {
      const email = (rawEmail || 'unknown@lilab.academy').trim().toLowerCase();
      const existing = map.get(email);
      if (existing) return existing;

      const linkedStudents = students.filter((s) => s.parentEmail.toLowerCase() === email);
      const linkedMethods = paymentMethods.filter((pm) => pm.parentEmail.toLowerCase() === email);
      const primaryMethod = linkedMethods[0];
      const phone =
        linkedStudents.find((s) => s.parentPhone)?.parentPhone ||
        linkedMethods.find((m) => m.parentPhone)?.parentPhone ||
        '';
      const displayName =
        primaryMethod?.accountHolderName ||
        linkedStudents[0]?.parentName ||
        email.split('@')[0];
      const savedBankSummary = primaryMethod
        ? `${primaryMethod.bankName || primaryMethod.providerLabel} (${primaryMethod.accountNumberMasked || `•••• ${primaryMethod.accountLast4}`})`
        : '';

      const created: ParentLedgerSummary = {
        parentEmail: email,
        parentDisplayName: displayName,
        parentPhone: phone,
        studentNames: Array.from(new Set(linkedStudents.map((s) => s.fullName))),
        savedBankSummary,
        completedTransactions: [],
        pendingInvoices: [],
        reminderLogs: [],
        totalCollectedVnd: 0,
        totalPendingVnd: 0,
        latestActivityMs: 0,
      };
      map.set(email, created);
      return created;
    };

    for (const inv of ledgerInvoices) {
      const parent = ensureParent(inv.parentEmail);
      if (inv.studentName && !parent.studentNames.includes(inv.studentName)) {
        parent.studentNames.push(inv.studentName);
      }
      if (!parent.parentPhone && inv.parentPhone) {
        parent.parentPhone = inv.parentPhone;
      }
      if (inv.payerAccountHolder && parent.parentDisplayName === parent.parentEmail.split('@')[0]) {
        parent.parentDisplayName = inv.payerAccountHolder;
      }

      if (inv.status === 'paid') {
        parent.completedTransactions.push(inv);
        parent.totalCollectedVnd += Number(inv.amountVnd) || 0;
        const { ms } = toIsoAndMs(inv.paidAt || inv.updatedAt || inv.createdAt, inv.dueDate);
        parent.latestActivityMs = Math.max(parent.latestActivityMs, ms);
      } else {
        parent.pendingInvoices.push(inv);
        parent.totalPendingVnd += Number(inv.amountVnd) || 0;
        const { ms } = toIsoAndMs(inv.updatedAt || inv.createdAt, inv.dueDate);
        parent.latestActivityMs = Math.max(parent.latestActivityMs, ms);
      }
    }

    for (const log of mergedReminderLogs) {
      const parent = ensureParent(log.parentEmail);
      parent.reminderLogs.push(log);
      if (!parent.parentPhone && log.parentPhone) {
        parent.parentPhone = log.parentPhone;
      }
      const { ms } = toIsoAndMs(log.sentAt || log.createdAt);
      parent.latestActivityMs = Math.max(parent.latestActivityMs, ms);
    }

    const list = Array.from(map.values());
    for (const p of list) {
      p.completedTransactions.sort(
        (a, b) =>
          toIsoAndMs(b.paidAt || b.updatedAt || b.createdAt, b.dueDate).ms -
          toIsoAndMs(a.paidAt || a.updatedAt || a.createdAt, a.dueDate).ms
      );
      p.pendingInvoices.sort(
        (a, b) =>
          toIsoAndMs(a.dueDate).ms - toIsoAndMs(b.dueDate).ms
      );
      p.reminderLogs.sort(
        (a, b) => toIsoAndMs(b.sentAt || b.createdAt).ms - toIsoAndMs(a.sentAt || a.createdAt).ms
      );
    }

    return list.sort((a, b) => b.latestActivityMs - a.latestActivityMs);
  }, [ledgerInvoices, mergedReminderLogs, students, paymentMethods]);

  const filteredParents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return parentSummaries.filter((p) => {
      if (selectedParentEmail !== 'all' && p.parentEmail !== selectedParentEmail) return false;
      if (entryFilter === 'completed' && p.completedTransactions.length === 0) return false;
      if (entryFilter === 'pending' && p.pendingInvoices.length === 0) return false;
      if (entryFilter === 'reminder' && p.reminderLogs.length === 0) return false;
      if (!q) return true;
      return (
        p.parentEmail.includes(q) ||
        p.parentDisplayName.toLowerCase().includes(q) ||
        p.parentPhone.toLowerCase().includes(q) ||
        p.studentNames.some((s) => s.toLowerCase().includes(q)) ||
        p.completedTransactions.some(
          (i) =>
            i.invoiceNumber.toLowerCase().includes(q) ||
            (i.paymentReference || '').toLowerCase().includes(q) ||
            (i.payerBankName || '').toLowerCase().includes(q) ||
            i.programTitle.toLowerCase().includes(q)
        ) ||
        p.pendingInvoices.some(
          (i) => i.invoiceNumber.toLowerCase().includes(q) || i.programTitle.toLowerCase().includes(q)
        )
      );
    });
  }, [parentSummaries, selectedParentEmail, entryFilter, searchQuery]);

  // Unified chronological timeline entries
  const timelineEntries = useMemo<UnifiedLedgerEntry[]>(() => {
    const rows: UnifiedLedgerEntry[] = [];

    for (const inv of ledgerInvoices) {
      if (inv.status === 'paid') {
        const { iso, ms } = toIsoAndMs(inv.paidAt || inv.updatedAt || inv.createdAt, inv.dueDate);
        rows.push({
          id: `tx_${inv.id}`,
          entryType: 'completed',
          timestampIso: iso,
          sortMs: ms,
          parentEmail: inv.parentEmail.toLowerCase(),
          studentName: inv.studentName,
          invoiceNumber: inv.invoiceNumber,
          programTitle: inv.programTitle,
          amountVnd: inv.amountVnd,
          methodOrChannel: inv.paymentMethod,
          referenceOrPreview: inv.paymentReference || 'Confirmed payment',
          bankOrPhone: inv.payerBankName || inv.payerAccountHolder || '—',
          statusLabel: 'PAID',
          invoice: inv,
        });
      } else {
        const { iso, ms } = toIsoAndMs(inv.updatedAt || inv.createdAt, inv.dueDate);
        rows.push({
          id: `pend_${inv.id}`,
          entryType: 'pending',
          timestampIso: inv.dueDate ? `Due ${inv.dueDate}` : iso,
          sortMs: ms,
          parentEmail: inv.parentEmail.toLowerCase(),
          studentName: inv.studentName,
          invoiceNumber: inv.invoiceNumber,
          programTitle: inv.programTitle,
          amountVnd: inv.amountVnd,
          methodOrChannel: inv.status,
          referenceOrPreview: inv.reminderNote || `Due on ${inv.dueDate}`,
          bankOrPhone: inv.parentPhone || '—',
          statusLabel: inv.status.toUpperCase(),
          invoice: inv,
        });
      }
    }

    for (const log of mergedReminderLogs) {
      const { iso, ms } = toIsoAndMs(log.sentAt || log.createdAt);
      rows.push({
        id: `rem_${log.id}`,
        entryType: 'reminder',
        timestampIso: iso,
        sortMs: ms,
        parentEmail: log.parentEmail.toLowerCase(),
        studentName: log.studentName,
        invoiceNumber: log.invoiceNumber,
        programTitle: log.programTitle,
        amountVnd: log.amountVnd,
        methodOrChannel: log.channel === 'zalo' ? 'Zalo Reminder' : 'Email Reminder',
        referenceOrPreview: log.messagePreview,
        bankOrPhone: log.parentPhone || log.parentEmail,
        statusLabel: log.deliveryMode.replace(/_/g, ' ').toUpperCase(),
      });
    }

    const q = searchQuery.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (selectedParentEmail !== 'all' && r.parentEmail !== selectedParentEmail) return false;
        if (entryFilter !== 'all' && r.entryType !== entryFilter) return false;
        if (!q) return true;
        return (
          r.parentEmail.includes(q) ||
          r.studentName.toLowerCase().includes(q) ||
          r.invoiceNumber.toLowerCase().includes(q) ||
          r.programTitle.toLowerCase().includes(q) ||
          r.referenceOrPreview.toLowerCase().includes(q) ||
          r.bankOrPhone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.sortMs - a.sortMs);
  }, [ledgerInvoices, mergedReminderLogs, selectedParentEmail, entryFilter, searchQuery]);

  const totals = useMemo(() => {
    const completed = ledgerInvoices.filter((i) => i.status === 'paid');
    const pending = ledgerInvoices.filter((i) => i.status !== 'paid');
    return {
      completedCount: completed.length,
      completedVnd: completed.reduce((s, i) => s + (Number(i.amountVnd) || 0), 0),
      pendingCount: pending.length,
      pendingVnd: pending.reduce((s, i) => s + (Number(i.amountVnd) || 0), 0),
      reminderCount: mergedReminderLogs.length,
      parentCount: parentSummaries.length,
    };
  }, [ledgerInvoices, mergedReminderLogs, parentSummaries]);

  const toggleParentExpanded = (email: string) => {
    setExpandedParents((prev) => ({ ...prev, [email]: !(prev[email] ?? true) }));
  };

  const handleExportLedgerCsv = () => {
    const headers = [
      'Entry Type',
      'Timestamp / Due Date',
      'Parent Email',
      'Student Name',
      'Invoice Number',
      'Course / Program',
      'Amount VND',
      'Channel / Payment Method',
      'Bank / Phone',
      'Status / Delivery Mode',
      'Reference / Reminder Log',
    ];
    const csvRows = [
      headers.join(','),
      ...timelineEntries.map((r) =>
        [
          r.entryType,
          r.timestampIso,
          r.parentEmail,
          r.studentName,
          r.invoiceNumber,
          r.programTitle,
          r.amountVnd,
          r.methodOrChannel,
          r.bankOrPhone,
          r.statusLabel,
          r.referenceOrPreview,
        ]
          .map((v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lilab-historical-transaction-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onFlash(
      biText(
        lang,
        `Exported ${timelineEntries.length} historical ledger entries to CSV.`,
        `Đã xuất ${timelineEntries.length} bản ghi lịch sử giao dịch ra tệp CSV.`
      )
    );
  };

  const renderMethodBadge = (method: string) => {
    if (method === 'qr_transfer') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FFD41D]/25 text-[#172154] text-[11px] font-bold">
          <QrCode className="w-3 h-3" /> QR
        </span>
      );
    }
    if (method === 'direct_debit') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2D3E99]/10 text-[#2D3E99] text-[11px] font-bold">
          <Building2 className="w-3 h-3" /> Bank
        </span>
      );
    }
    if (method === 'credit_card') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E61E64]/10 text-[#E61E64] text-[11px] font-bold">
          <CreditCard className="w-3 h-3" /> Card
        </span>
      );
    }
    return <span className="text-[11px] font-semibold text-[#172154]/65">{method}</span>;
  };

  return (
    <div className="space-y-5">
      {/* Ledger Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#0D9488]/25 rounded-xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0D9488] flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {biText(lang, 'Completed Transactions', 'Giao dịch Hoàn tất')}
          </div>
          <div className="font-display text-xl font-extrabold text-[#172154] mt-1 tabular-nums">
            {formatVnd(totals.completedVnd)}
          </div>
          <div className="text-xs text-[#172154]/65 mt-0.5">
            {totals.completedCount} {biText(lang, 'settled payments in Firestore', 'giao dịch đã thanh toán')}
          </div>
        </div>

        <div className="bg-white border border-[#E61E64]/25 rounded-xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#E61E64] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {biText(lang, 'Pending Invoices', 'Hóa đơn Chờ thu')}
          </div>
          <div className="font-display text-xl font-extrabold text-[#172154] mt-1 tabular-nums">
            {formatVnd(totals.pendingVnd)}
          </div>
          <div className="text-xs text-[#172154]/65 mt-0.5">
            {totals.pendingCount} {biText(lang, 'unpaid / overdue balances', 'hóa đơn chưa thu / quá hạn')}
          </div>
        </div>

        <div className="bg-white border border-[#0068FF]/25 rounded-xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0068FF] flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5" />
            {biText(lang, 'Automated Reminder Logs', 'Lịch sử Nhắc tự động')}
          </div>
          <div className="font-display text-xl font-extrabold text-[#172154] mt-1 tabular-nums">
            {totals.reminderCount}
          </div>
          <div className="text-xs text-[#172154]/65 mt-0.5">
            {biText(lang, 'Zalo & Email dispatch records', 'Tin nhắn Zalo & Email đã ghi nhận')}
          </div>
        </div>

        <div className="bg-white border border-[#2D3E99]/20 rounded-xl p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#2D3E99] flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {biText(lang, 'Parents in Ledger', 'Phụ huynh trong Sổ cái')}
          </div>
          <div className="font-display text-xl font-extrabold text-[#172154] mt-1 tabular-nums">
            {totals.parentCount}
          </div>
          <div className="text-xs text-[#172154]/65 mt-0.5">
            {biText(lang, 'Live Firestore audit trail', 'Đồng bộ trực tiếp từ Firestore')}
          </div>
        </div>
      </div>

      {/* Filter & View Controls */}
      <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('by_parent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'by_parent'
                  ? 'bg-[#2D3E99] text-white'
                  : 'text-[#172154]/75 hover:bg-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {biText(lang, 'Grouped by Parent', 'Nhóm theo Phụ huynh')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-[#2D3E99] text-white'
                  : 'text-[#172154]/75 hover:bg-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              {biText(lang, 'Chronological Timeline', 'Dòng thời gian Toàn bộ')}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: biText(lang, 'All Entries', 'Tất cả') },
                { id: 'completed', label: biText(lang, 'Completed', 'Đã thanh toán') },
                { id: 'pending', label: biText(lang, 'Pending', 'Chờ thu') },
                { id: 'reminder', label: biText(lang, 'Reminder Logs', 'Nhắc học phí') },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setEntryFilter(f.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors ${
                  entryFilter === f.id
                    ? 'bg-[#E61E64] text-white border-[#E61E64]'
                    : 'bg-white text-[#172154]/75 border-[#2D3E99]/15 hover:bg-[#FDF9EE]'
                }`}
              >
                {f.label}
              </button>
            ))}

            {onNavigateToAnalytics && (
              <button
                type="button"
                onClick={onNavigateToAnalytics}
                className="px-3 py-1.5 rounded-lg bg-[#56BEB8]/15 hover:bg-[#56BEB8]/25 text-[#172154] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <TrendingUp className="w-3.5 h-3.5 text-[#2D3E99]" />
                {biText(lang, 'Visual Analytics', 'Biểu đồ Phân tích')}
              </button>
            )}

            <button
              type="button"
              onClick={handleExportLedgerCsv}
              className="px-3 py-1.5 rounded-lg bg-[#2D3E99]/10 hover:bg-[#2D3E99] text-[#2D3E99] hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {biText(lang, 'Export Ledger CSV', 'Xuất Sổ cái CSV')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-7 relative">
            <Search className="w-4 h-4 text-[#172154]/45 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={biText(
                lang,
                'Search parent email, student, invoice #, bank name, or transfer reference...',
                'Tìm theo email phụ huynh, học viên, mã hóa đơn, ngân hàng, mã giao dịch...'
              )}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#2D3E99]/20 text-xs bg-[#FDF9EE]/40"
            />
          </div>
          <div className="md:col-span-5">
            <select
              value={selectedParentEmail}
              onChange={(e) => setSelectedParentEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#2D3E99]/20 text-xs bg-white font-medium"
            >
              <option value="all">
                {biText(lang, `All Parents (${parentSummaries.length})`, `Tất cả Phụ huynh (${parentSummaries.length})`)}
              </option>
              {parentSummaries.map((p) => (
                <option key={p.parentEmail} value={p.parentEmail}>
                  {p.parentDisplayName} — {p.parentEmail}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Ledger Body */}
      {loadingLedger ? (
        <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-10 text-center text-sm text-[#2D3E99] font-semibold">
          {biText(lang, 'Loading live Firestore transaction ledger...', 'Đang tải sổ cái lịch sử giao dịch từ Firestore...')}
        </div>
      ) : viewMode === 'by_parent' ? (
        filteredParents.length === 0 ? (
          <div className="bg-white border border-[#2D3E99]/12 rounded-2xl p-10 text-center text-sm text-[#172154]/65">
            {biText(
              lang,
              'No parent transaction records match your current filter.',
              'Không tìm thấy lịch sử giao dịch nào khớp với bộ lọc hiện tại.'
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredParents.map((parent) => {
              const isExpanded = expandedParents[parent.parentEmail] ?? true;
              const showCompleted = entryFilter === 'all' || entryFilter === 'completed';
              const showPending = entryFilter === 'all' || entryFilter === 'pending';
              const showReminders = entryFilter === 'all' || entryFilter === 'reminder';

              return (
                <div
                  key={parent.parentEmail}
                  className="bg-white border border-[#2D3E99]/15 rounded-2xl overflow-hidden shadow-xs"
                >
                  {/* Parent Summary Header */}
                  <button
                    type="button"
                    onClick={() => toggleParentExpanded(parent.parentEmail)}
                    className="w-full text-left px-5 py-4 bg-[#FDF9EE]/70 hover:bg-[#FDF9EE] border-b border-[#2D3E99]/10 flex flex-wrap items-center justify-between gap-4 cursor-pointer transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-extrabold text-[#2D3E99]">
                          {parent.parentDisplayName}
                        </span>
                        <span className="text-xs font-mono text-[#172154]/70">{parent.parentEmail}</span>
                        {parent.parentPhone && (
                          <span className="px-2 py-0.5 rounded bg-[#0068FF]/10 text-[#0068FF] text-[11px] font-mono font-bold">
                            Zalo: {parent.parentPhone}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#172154]/70">
                        {parent.studentNames.length > 0 && (
                          <span>
                            <strong>{biText(lang, 'Student(s):', 'Học viên:')}</strong>{' '}
                            {parent.studentNames.join(', ')}
                          </span>
                        )}
                        {parent.savedBankSummary && (
                          <span>
                            <strong>{biText(lang, 'Saved Bank:', 'NH đã lưu:')}</strong>{' '}
                            {parent.savedBankSummary}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-[#0D9488]">
                          {biText(lang, 'Paid', 'Đã thu')} ({parent.completedTransactions.length})
                        </div>
                        <div className="font-mono text-sm font-extrabold text-[#0D9488] tabular-nums">
                          {formatVnd(parent.totalCollectedVnd)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-[#E61E64]">
                          {biText(lang, 'Pending', 'Chờ thu')} ({parent.pendingInvoices.length})
                        </div>
                        <div className="font-mono text-sm font-extrabold text-[#E61E64] tabular-nums">
                          {formatVnd(parent.totalPendingVnd)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold uppercase text-[#0068FF]">
                          {biText(lang, 'Reminders', 'Nhắc phí')}
                        </div>
                        <div className="font-mono text-sm font-extrabold text-[#0068FF] tabular-nums">
                          {parent.reminderLogs.length}
                        </div>
                      </div>
                      <span className="p-1.5 rounded-lg bg-white border border-[#2D3E99]/15 text-[#2D3E99]">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </button>

                  {/* Parent Detailed 3-Section Ledger */}
                  {isExpanded && (
                    <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* 1. Completed Transactions */}
                      {showCompleted && (
                        <div className="rounded-xl border border-[#0D9488]/20 bg-[#0D9488]/[0.03] p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0D9488] flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {biText(lang, 'Completed Transactions', 'Giao dịch Đã thanh toán')} (
                              {parent.completedTransactions.length})
                            </h4>
                          </div>
                          {parent.completedTransactions.length === 0 ? (
                            <p className="text-xs text-[#172154]/55">
                              {biText(lang, 'No completed payments yet.', 'Chưa có giao dịch hoàn tất.')}
                            </p>
                          ) : (
                            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                              {parent.completedTransactions.map((inv) => (
                                <div
                                  key={inv.id}
                                  className="p-3 rounded-lg bg-white border border-[#0D9488]/20 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-bold text-[#2D3E99]">
                                      {inv.invoiceNumber}
                                    </span>
                                    <span className="font-mono font-extrabold text-[#0D9488] tabular-nums">
                                      {formatVnd(inv.amountVnd)}
                                    </span>
                                  </div>
                                  <div className="font-semibold text-[#172154]">
                                    {inv.studentName} · {inv.programTitle}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    {renderMethodBadge(inv.paymentMethod)}
                                    {inv.payerBankName && (
                                      <span className="text-[11px] text-[#172154]/75">
                                        {inv.payerBankName}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] font-mono text-[#172154]/60">
                                    {inv.paymentReference ? `Ref: ${inv.paymentReference} · ` : ''}
                                    {toIsoAndMs(inv.paidAt || inv.updatedAt, inv.dueDate).iso}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 2. Pending Invoices */}
                      {showPending && (
                        <div className="rounded-xl border border-[#E61E64]/20 bg-[#E61E64]/[0.03] p-4 space-y-3">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#E61E64] flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5" />
                            {biText(lang, 'Pending Invoices', 'Hóa đơn Chờ thu')} (
                            {parent.pendingInvoices.length})
                          </h4>
                          {parent.pendingInvoices.length === 0 ? (
                            <p className="text-xs text-[#172154]/55">
                              {biText(lang, 'All invoices are settled!', 'Tất cả hóa đơn đã được thanh toán!')}
                            </p>
                          ) : (
                            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                              {parent.pendingInvoices.map((inv) => (
                                <div
                                  key={inv.id}
                                  className="p-3 rounded-lg bg-white border border-[#E61E64]/20 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono font-bold text-[#2D3E99]">
                                      {inv.invoiceNumber}
                                    </span>
                                    <span className="font-mono font-extrabold text-[#E61E64] tabular-nums">
                                      {formatVnd(inv.amountVnd)}
                                    </span>
                                  </div>
                                  <div className="font-semibold text-[#172154]">
                                    {inv.studentName} · {inv.programTitle}
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-[#172154]/70 font-mono">
                                    <span>
                                      {biText(lang, 'Due:', 'Hạn:')} {inv.dueDate}
                                    </span>
                                    <span className="uppercase font-bold text-[#E61E64]">
                                      {inv.status.replace('_', ' ')}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => void onMarkInvoicePaid(inv)}
                                      className="px-2 py-1 rounded bg-[#0D9488] hover:bg-[#0f766e] text-white text-[11px] font-bold cursor-pointer"
                                    >
                                      {biText(lang, 'Mark Paid', 'Đánh dấu Đã thu')}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onOpenReminder(inv)}
                                      className="px-2 py-1 rounded bg-[#FFD41D] hover:bg-[#f0c50c] text-[#172154] text-[11px] font-bold cursor-pointer"
                                    >
                                      {biText(lang, 'Remind Email/Zalo', 'Nhắc Email/Zalo')}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3. Automated Reminder Logs */}
                      {showReminders && (
                        <div className="rounded-xl border border-[#0068FF]/20 bg-[#0068FF]/[0.03] p-4 space-y-3">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0068FF] flex items-center gap-1.5">
                            <BellRing className="w-3.5 h-3.5" />
                            {biText(lang, 'Automated Reminder Logs', 'Lịch sử Nhắc Học phí')} (
                            {parent.reminderLogs.length})
                          </h4>
                          {parent.reminderLogs.length === 0 ? (
                            <p className="text-xs text-[#172154]/55">
                              {biText(lang, 'No reminders dispatched yet.', 'Chưa có lịch sử nhắc học phí.')}
                            </p>
                          ) : (
                            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                              {parent.reminderLogs.map((log) => (
                                <div
                                  key={log.id}
                                  className="p-3 rounded-lg bg-white border border-[#0068FF]/20 text-xs space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                        log.channel === 'zalo'
                                          ? 'bg-[#0068FF]/12 text-[#0068FF]'
                                          : 'bg-[#2D3E99]/12 text-[#2D3E99]'
                                      }`}
                                    >
                                      {log.channel === 'zalo' ? (
                                        <MessageCircle className="w-3 h-3" />
                                      ) : (
                                        <Mail className="w-3 h-3" />
                                      )}
                                      {log.channel}
                                    </span>
                                    <span className="font-mono text-[10px] text-[#172154]/60">
                                      {toIsoAndMs(log.sentAt || log.createdAt).iso}
                                    </span>
                                  </div>
                                  <div className="font-semibold text-[#172154]">
                                    {log.invoiceNumber} · {log.studentName} ({formatVnd(log.amountVnd)})
                                  </div>
                                  <div className="text-[11px] text-[#172154]/70 line-clamp-2">
                                    {log.messagePreview}
                                  </div>
                                  <div className="text-[10px] font-mono text-[#172154]/55">
                                    {log.parentPhone || log.parentEmail} · {log.deliveryMode.replace(/_/g, ' ')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Chronological Timeline View */
        <div className="bg-white border border-[#2D3E99]/15 rounded-2xl overflow-hidden">
          {timelineEntries.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#172154]/65">
              {biText(lang, 'No ledger entries match your filter.', 'Không có bản ghi nào phù hợp.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FDF9EE] border-b border-[#2D3E99]/12 text-[11px] uppercase tracking-wider text-[#172154]/70">
                  <tr>
                    <th className="py-3 px-4">{biText(lang, 'Type', 'Loại')}</th>
                    <th className="py-3 px-4">{biText(lang, 'Date / Time', 'Thời gian')}</th>
                    <th className="py-3 px-4">{biText(lang, 'Parent & Student', 'Phụ huynh & Học viên')}</th>
                    <th className="py-3 px-4">{biText(lang, 'Invoice & Course', 'Hóa đơn & Khóa học')}</th>
                    <th className="py-3 px-4 text-right">{biText(lang, 'Amount', 'Số tiền')}</th>
                    <th className="py-3 px-4">{biText(lang, 'Method / Channel', 'Phương thức / Kênh')}</th>
                    <th className="py-3 px-4">{biText(lang, 'Reference / Log', 'Mã GD / Nội dung')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3E99]/8">
                  {timelineEntries.map((row) => (
                    <tr key={row.id} className="hover:bg-[#FDF9EE]/50">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded font-bold text-[10px] uppercase ${
                            row.entryType === 'completed'
                              ? 'bg-[#0D9488]/12 text-[#0D9488]'
                              : row.entryType === 'pending'
                              ? 'bg-[#E61E64]/12 text-[#E61E64]'
                              : 'bg-[#0068FF]/12 text-[#0068FF]'
                          }`}
                        >
                          {row.entryType === 'completed'
                            ? biText(lang, 'Completed', 'Đã thu')
                            : row.entryType === 'pending'
                            ? biText(lang, 'Pending', 'Chờ thu')
                            : biText(lang, 'Reminder', 'Nhắc phí')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#172154]/75 whitespace-nowrap">
                        {row.timestampIso}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#172154]">{row.studentName}</div>
                        <div className="text-[11px] text-[#172154]/65">{row.parentEmail}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-[#2D3E99]">{row.invoiceNumber}</div>
                        <div className="text-[11px] text-[#172154]/70">{row.programTitle}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-[#172154] tabular-nums whitespace-nowrap">
                        {formatVnd(row.amountVnd)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div>{renderMethodBadge(row.methodOrChannel)}</div>
                        <div className="text-[10px] text-[#172154]/60 mt-0.5">{row.bankOrPhone}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-[11px] text-[#172154]/80 line-clamp-2">
                          {row.referenceOrPreview}
                        </div>
                        <div className="text-[10px] font-mono text-[#172154]/50 mt-0.5">
                          {row.statusLabel}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

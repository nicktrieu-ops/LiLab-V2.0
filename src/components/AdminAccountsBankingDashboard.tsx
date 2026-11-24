import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  AlertTriangle,
  Banknote,
  BellRing,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  History,
  Landmark,
  Mail,
  MessageCircle,
  Plus,
  QrCode,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { biText, formatVnd } from '../i18n';
import { sendPaymentReminderEmail } from '../services/aiClient';
import {
  buildPaymentReminderCopy,
  buildVietQrImageUrl,
  buildZaloDeepLink,
  compressQrImageFile,
  normalizeZaloPhone,
  resolveActiveBankConfig,
  resolveVietBankCode,
  VIETNAM_BANK_PRESETS,
} from '../services/bankingQr';
import type {
  AcademyBankConfig,
  LangCode,
  ParentPaymentMethod,
  PayableRecord,
  ProgramCourse,
  StudentProfile,
  TeacherProfile,
  TuitionInvoice,
  UserProfile,
  UserRole,
} from '../types';

import { ErrorBoundary } from './ErrorBoundary';
import { PortalLoader } from './ui/Primitives';
import type { ZaloReminderDispatchResult } from './AdminConsole';

const AdminBankingAnalyticsDashboard = lazy(() =>
  import('./AdminBankingAnalyticsDashboard').then((m) => ({
    default: m.AdminBankingAnalyticsDashboard,
  }))
);
const AdminTransactionLedger = lazy(() =>
  import('./AdminTransactionLedger').then((m) => ({
    default: m.AdminTransactionLedger,
  }))
);

interface AdminAccountsBankingDashboardProps {
  lang: LangCode;
  currentUser: UserProfile;
  adminUids: string[];
  students: StudentProfile[];
  teachers: TeacherProfile[];
  programs: ProgramCourse[];
  invoices: TuitionInvoice[];
  pendingPayments?: TuitionInvoice[];
  payables: PayableRecord[];
  paymentMethods: ParentPaymentMethod[];
  academyBankConfigs: AcademyBankConfig[];
  zaloDispatching?: boolean;
  zaloDispatchResults?: ZaloReminderDispatchResult[];
  onClearZaloResults?: () => void;
  onSendAutomatedZaloReminders?: (options?: {
    targetInvoices?: TuitionInvoice[];
    customMessage?: string;
    overridePhone?: string;
  }) => Promise<ZaloReminderDispatchResult[]>;
  onFlash: (msg: string) => void;
}

type BankingSection = 'receivables' | 'ledger' | 'analytics' | 'lilab_qr' | 'parent_banking' | 'payables';
type InvoiceFilter = 'all' | 'paid' | 'pending' | 'reminder_sent' | 'overdue';

export const AdminAccountsBankingDashboard: React.FC<AdminAccountsBankingDashboardProps> = ({
  lang,
  currentUser,
  adminUids,
  students,
  teachers,
  programs,
  invoices,
  pendingPayments: pendingPaymentsProp,
  payables,
  paymentMethods,
  academyBankConfigs,
  zaloDispatching = false,
  zaloDispatchResults = [],
  onClearZaloResults,
  onSendAutomatedZaloReminders,
  onFlash,
}) => {
  const safeUser: UserProfile = useMemo(() => {
    return {
      uid: currentUser?.uid || auth.currentUser?.uid || 'admin-root',
      email: currentUser?.email || auth.currentUser?.email || 'admin@lilab.edu.vn',
      displayName: currentUser?.displayName || auth.currentUser?.displayName || 'Admin',
      role: (currentUser?.role as UserRole) || 'super_admin',
      status: 'active',
      preferredLang: lang,
    };
  }, [currentUser, lang]);

  const [section, setSection] = useState<BankingSection>('receivables');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Invoices filter & search
  const [invFilter, setInvFilter] = useState<InvoiceFilter>('all');
  const [invSearch, setInvSearch] = useState('');
  const [showIssueInvoiceForm, setShowIssueInvoiceForm] = useState(false);

  // Issue Invoice form
  const [invStudentId, setInvStudentId] = useState('');
  const [invProgramId, setInvProgramId] = useState('');
  const [invProgramTitle, setInvProgramTitle] = useState('');
  const [invAmount, setInvAmount] = useState(4800000);
  const [invDueDate, setInvDueDate] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );

  // LiLab Receiving Bank & QR Setup form
  const activeBank = useMemo(() => resolveActiveBankConfig(academyBankConfigs), [academyBankConfigs]);
  const [bankName, setBankName] = useState(activeBank.bankName);
  const [bankCode, setBankCode] = useState(activeBank.bankCode);
  const [accountNumber, setAccountNumber] = useState(activeBank.accountNumber);
  const [accountHolder, setAccountHolder] = useState(activeBank.accountHolder);
  const [branchName, setBranchName] = useState(activeBank.branchName || '');
  const [zaloHotline, setZaloHotline] = useState(activeBank.zaloHotline || '0707547187');
  const [instructionsEn, setInstructionsEn] = useState(activeBank.paymentInstructionsEn || '');
  const [instructionsVi, setInstructionsVi] = useState(activeBank.paymentInstructionsVi || '');
  const [qrImageDataUrl, setQrImageDataUrl] = useState(activeBank.qrImageDataUrl || '');
  const [useDynamicVietQr, setUseDynamicVietQr] = useState(activeBank.useDynamicVietQr !== false);
  const [previewSampleAmount, setPreviewSampleAmount] = useState(4800000);

  useEffect(() => {
    setBankName(activeBank.bankName);
    setBankCode(activeBank.bankCode);
    setAccountNumber(activeBank.accountNumber);
    setAccountHolder(activeBank.accountHolder);
    setBranchName(activeBank.branchName || '');
    setZaloHotline(activeBank.zaloHotline || '0707547187');
    setInstructionsEn(activeBank.paymentInstructionsEn || '');
    setInstructionsVi(activeBank.paymentInstructionsVi || '');
    setQrImageDataUrl(activeBank.qrImageDataUrl || '');
    setUseDynamicVietQr(activeBank.useDynamicVietQr !== false);
  }, [activeBank.id, activeBank.bankName, activeBank.bankCode, activeBank.accountNumber, activeBank.accountHolder, activeBank.qrImageDataUrl, activeBank.useDynamicVietQr]);

  // Parent Banking search
  const [parentBankSearch, setParentBankSearch] = useState('');

  // Payables / Payroll form
  const [payType, setPayType] = useState<PayableRecord['recordType']>('teacher_payroll');
  const [payTeacherPick, setPayTeacherPick] = useState('');
  const [payRecipient, setPayRecipient] = useState('');
  const [payEmail, setPayEmail] = useState('');
  const [payBankName, setPayBankName] = useState('');
  const [payBankNumber, setPayBankNumber] = useState('');
  const [payBankHolder, setPayBankHolder] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [payHourlyRate, setPayHourlyRate] = useState(0);
  const [payDue, setPayDue] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );
  const [payNotes, setPayNotes] = useState('');
  const [saveBankToTeacher, setSaveBankToTeacher] = useState(true);
  const [payrollQrPayable, setPayrollQrPayable] = useState<PayableRecord | null>(null);

  // Reminder Dispatch Modal state
  const [reminderInvoice, setReminderInvoice] = useState<TuitionInvoice | null>(null);
  const [reminderEmailTo, setReminderEmailTo] = useState('');
  const [reminderZaloPhone, setReminderZaloPhone] = useState('');
  const [reminderText, setReminderText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastEmailResult, setLastEmailResult] = useState<{
    mailtoUrl: string;
    deliveryMode: 'webhook' | 'mailto_ready';
    recipientEmail: string;
  } | null>(null);

  const makeId = (prefix: string) =>
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2200);
    } catch {
      onFlash(biText(lang, 'Copy blocked by browser; please select and copy manually.', 'Không thể tự chép; vui lòng bôi đen để sao chép.'));
    }
  };

  // Financial KPI Metrics
  const kpis = useMemo(() => {
    const paidInvoices = invoices.filter((i) => i.status === 'paid');
    const unpaidInvoices = invoices.filter((i) => i.status !== 'paid');
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
    const collectedVnd = paidInvoices.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const outstandingVnd = unpaidInvoices.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const qrPaidCount = paidInvoices.filter((i) => i.paymentMethod === 'qr_transfer').length;
    const autoPayCount = paymentMethods.filter((pm) => pm.autoPayEnabled).length;
    const unpaidPayables = payables.filter(
      (p) => p.recordType !== 'academy_bank_config' && p.status !== 'paid'
    );
    const paidPayables = payables.filter(
      (p) => p.recordType !== 'academy_bank_config' && p.status === 'paid'
    );
    const scheduledPayablesVnd = unpaidPayables.reduce((sum, p) => sum + (Number(p.amountVnd) || 0), 0);
    const paidOutVnd = paidPayables.reduce((sum, p) => sum + (Number(p.amountVnd) || 0), 0);
    return {
      collectedVnd,
      paidCount: paidInvoices.length,
      qrPaidCount,
      outstandingVnd,
      unpaidCount: unpaidInvoices.length,
      overdueCount: overdueInvoices.length,
      parentBankCount: paymentMethods.length,
      autoPayCount,
      scheduledPayablesVnd,
      unpaidPayablesCount: unpaidPayables.length,
      netCashflowVnd: collectedVnd - paidOutVnd,
    };
  }, [invoices, payables, paymentMethods]);

  const filteredInvoices = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    return [...invoices]
      .filter((inv) => {
        if (invFilter !== 'all' && inv.status !== invFilter) return false;
        if (!q) return true;
        return (
          (inv.invoiceNumber || '').toLowerCase().includes(q) ||
          (inv.studentName || '').toLowerCase().includes(q) ||
          (inv.parentEmail || '').toLowerCase().includes(q) ||
          (inv.programTitle || '').toLowerCase().includes(q) ||
          (inv.paymentReference || '').toLowerCase().includes(q) ||
          (inv.payerBankName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ta = (a.createdAt as { seconds?: number } | undefined)?.seconds || 0;
        const tb = (b.createdAt as { seconds?: number } | undefined)?.seconds || 0;
        return tb - ta;
      });
  }, [invoices, invFilter, invSearch]);

  const resolveParentPhoneForInvoice = (inv: TuitionInvoice): string => {
    if (inv.parentPhone) return inv.parentPhone;
    const stu = students.find(
      (s) => s.id === inv.studentId || s.parentEmail.toLowerCase() === inv.parentEmail.toLowerCase()
    );
    if (stu?.parentPhone) return stu.parentPhone;
    const pm = paymentMethods.find(
      (m) => m.parentEmail.toLowerCase() === inv.parentEmail.toLowerCase() && m.parentPhone
    );
    return pm?.parentPhone || '';
  };

  // Issue new Tuition Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const stu = students.find((s) => s.id === invStudentId) || students[0];
    if (!stu) {
      onFlash(biText(lang, 'Add a student first before issuing an invoice.', 'Vui lòng thêm học viên trước khi tạo hóa đơn.'));
      return;
    }
    const chosenProg = programs.find((p) => p.id === invProgramId);
    const title = (invProgramTitle.trim() || chosenProg?.titleEn || 'LiLab Tuition Fee').slice(0, 160);
    setBusyAction('invoice');
    try {
      const id = makeId('inv');
      const payload: Record<string, unknown> = {
        invoiceNumber: `LILAB-${Math.floor(10000 + Math.random() * 90000)}`,
        studentId: stu.id,
        studentName: stu.fullName.slice(0, 120),
        parentEmail: stu.parentEmail.slice(0, 160),
        programTitle: title,
        amountVnd: Math.max(0, Math.round(Number(invAmount) || 0)),
        dueDate: invDueDate.slice(0, 30),
        status: 'pending',
        paymentMethod: 'unselected',
        adminUids,
      };
      if (stu.parentUid) payload.parentUid = stu.parentUid.slice(0, 128);
      if (stu.parentPhone) payload.parentPhone = stu.parentPhone.slice(0, 40);
      if (chosenProg?.id) payload.programId = chosenProg.id.slice(0, 128);

      await setDoc(doc(db, 'invoices', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowIssueInvoiceForm(false);
      onFlash(
        biText(
          lang,
          `Invoice issued for ${stu.fullName} (${formatVnd(Number(invAmount) || 0)}).`,
          `Đã phát hành hóa đơn cho bé ${stu.fullName} (${formatVnd(Number(invAmount) || 0)}).`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'invoices');
    } finally {
      setBusyAction(null);
    }
  };

  // Mark Invoice Paid / Overdue / Pending
  const handleUpdateInvoiceStatus = async (
    inv: TuitionInvoice,
    nextStatus: TuitionInvoice['status'],
    methodOverride?: TuitionInvoice['paymentMethod']
  ) => {
    setBusyAction(`inv_status_${inv.id}`);
    try {
      const patch: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };
      if (nextStatus === 'paid') {
        patch.paymentMethod = methodOverride || (inv.paymentMethod === 'unselected' ? 'qr_transfer' : inv.paymentMethod);
        patch.paymentReference = inv.paymentReference || `ADMIN-VERIFIED-${inv.invoiceNumber}`;
        patch.paidAt = new Date().toISOString().slice(0, 19);
      }
      await updateDoc(doc(db, 'invoices', inv.id), patch);
      onFlash(
        biText(
          lang,
          `Invoice ${inv.invoiceNumber} updated to ${nextStatus.toUpperCase()}.`,
          `Hóa đơn ${inv.invoiceNumber} đã chuyển sang trạng thái ${nextStatus.toUpperCase()}.`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${inv.id}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteInvoice = async (invId: string) => {
    setBusyAction(`inv_del_${invId}`);
    try {
      await deleteDoc(doc(db, 'invoices', invId));
      onFlash(biText(lang, 'Invoice deleted.', 'Đã xóa hóa đơn.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invoices/${invId}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Open Reminder Modal for Email & Zalo
  const openReminderDispatcher = (inv: TuitionInvoice) => {
    const phone = resolveParentPhoneForInvoice(inv);
    const { emailText } = buildPaymentReminderCopy({
      invoice: inv,
      bank: activeBank,
      lang,
    });
    setReminderInvoice(inv);
    setReminderEmailTo(inv.parentEmail);
    setReminderZaloPhone(phone);
    setReminderText(emailText);
    setLastEmailResult(null);
  };

  const handleDispatchEmailReminder = async () => {
    if (!reminderInvoice || !reminderEmailTo.trim()) return;
    setBusyAction('send_email_reminder');
    try {
      const res = await sendPaymentReminderEmail({
        recipientEmail: reminderEmailTo.trim(),
        studentName: reminderInvoice.studentName,
        invoiceNumber: reminderInvoice.invoiceNumber,
        programTitle: reminderInvoice.programTitle,
        amountVnd: reminderInvoice.amountVnd,
        dueDate: reminderInvoice.dueDate,
        reminderBodyText: reminderText,
      });
      setLastEmailResult({
        mailtoUrl: res.mailtoUrl,
        deliveryMode: res.deliveryMode,
        recipientEmail: res.recipientEmail,
      });
      const nowIso = new Date().toISOString().slice(0, 19);
      const nextChannel: 'email' | 'both' =
        reminderInvoice.reminderChannel === 'zalo' || reminderInvoice.reminderChannel === 'both'
          ? 'both'
          : 'email';
      const note = `Email reminder sent to ${reminderEmailTo.trim()} on ${new Date().toLocaleDateString()} (${res.deliveryMode}).`.slice(
        0,
        500
      );
      await updateDoc(doc(db, 'invoices', reminderInvoice.id), {
        status: reminderInvoice.status === 'overdue' ? 'overdue' : 'reminder_sent',
        reminderNote: note,
        reminderChannel: nextChannel,
        lastReminderAt: nowIso,
        updatedAt: serverTimestamp(),
      });

      const logId = makeId('remlog');
      const emailLogPayload: Record<string, unknown> = {
        invoiceId: reminderInvoice.id.slice(0, 128),
        invoiceNumber: (reminderInvoice.invoiceNumber || 'LILAB-INV').slice(0, 40),
        studentId: (reminderInvoice.studentId || 'unknown_student').slice(0, 128),
        studentName: (reminderInvoice.studentName || 'Student').slice(0, 120),
        parentEmail: reminderEmailTo.trim().slice(0, 160),
        programTitle: (reminderInvoice.programTitle || 'LiLab Tuition').slice(0, 160),
        amountVnd: Math.min(500000000, Math.max(0, Math.round(Number(reminderInvoice.amountVnd) || 0))),
        channel: 'email',
        deliveryMode: (res.deliveryMode || 'mailto_ready').slice(0, 40),
        messagePreview: (reminderText || note).slice(0, 600),
        sentByUid: safeUser.uid.slice(0, 128),
        sentByEmail: (safeUser.email || 'admin@lilab.edu.vn').slice(0, 160),
        sentAt: nowIso.slice(0, 60),
        adminUids,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (reminderZaloPhone.trim()) {
        emailLogPayload.parentPhone = reminderZaloPhone.trim().slice(0, 40);
      }
      await setDoc(doc(db, 'reminder_logs', logId), emailLogPayload);
      onFlash(
        res.deliveryMode === 'webhook'
          ? biText(
              lang,
              `Email payment reminder delivered to ${reminderEmailTo.trim()}!`,
              `Đã gửi email nhắc học phí tới ${reminderEmailTo.trim()}!`
            )
          : biText(
              lang,
              `Email reminder logged & ready — click "Open Mail App" to send immediately.`,
              `Đã lưu lịch sử nhắc qua Email — bấm "Mở ứng dụng Email" để gửi ngay.`
            )
      );
    } catch (err) {
      onFlash(err instanceof Error ? err.message : 'Email reminder failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleLogZaloReminder = async () => {
    if (!reminderInvoice) return;
    if (onSendAutomatedZaloReminders) {
      setBusyAction('send_zalo_reminder');
      try {
        await onSendAutomatedZaloReminders({
          targetInvoices: [reminderInvoice],
          customMessage: reminderText,
          overridePhone: reminderZaloPhone,
        });
      } finally {
        setBusyAction(null);
      }
      return;
    }
    setBusyAction('send_zalo_reminder');
    try {
      await copyText(reminderText, 'zalo_modal_msg');
      const nowIso = new Date().toISOString().slice(0, 19);
      const cleanPhone = normalizeZaloPhone(reminderZaloPhone) || activeBank.zaloHotline || '0707547187';
      const nextChannel: 'zalo' | 'both' =
        reminderInvoice.reminderChannel === 'email' || reminderInvoice.reminderChannel === 'both'
          ? 'both'
          : 'zalo';
      const note = `Zalo text reminder prepared for ${cleanPhone} on ${new Date().toLocaleDateString()}.`.slice(
        0,
        500
      );
      const updatePayload: Record<string, unknown> = {
        status: reminderInvoice.status === 'overdue' ? 'overdue' : 'reminder_sent',
        reminderNote: note,
        reminderChannel: nextChannel,
        lastReminderAt: nowIso,
        updatedAt: serverTimestamp(),
      };
      if (reminderZaloPhone.trim()) {
        updatePayload.parentPhone = reminderZaloPhone.trim().slice(0, 40);
      }
      await updateDoc(doc(db, 'invoices', reminderInvoice.id), updatePayload);

      const logId = makeId('remlog');
      const zaloLogPayload: Record<string, unknown> = {
        invoiceId: reminderInvoice.id.slice(0, 128),
        invoiceNumber: (reminderInvoice.invoiceNumber || 'LILAB-INV').slice(0, 40),
        studentId: (reminderInvoice.studentId || 'unknown_student').slice(0, 128),
        studentName: (reminderInvoice.studentName || 'Student').slice(0, 120),
        parentEmail: (reminderInvoice.parentEmail || 'parent@lilab.edu.vn').slice(0, 160),
        programTitle: (reminderInvoice.programTitle || 'LiLab Tuition').slice(0, 160),
        amountVnd: Math.min(500000000, Math.max(0, Math.round(Number(reminderInvoice.amountVnd) || 0))),
        channel: 'zalo',
        deliveryMode: 'zalo_link_ready',
        messagePreview: (reminderText || note).slice(0, 600),
        sentByUid: safeUser.uid.slice(0, 128),
        sentByEmail: (safeUser.email || 'admin@lilab.edu.vn').slice(0, 160),
        sentAt: nowIso.slice(0, 60),
        adminUids,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (cleanPhone) {
        zaloLogPayload.parentPhone = cleanPhone.slice(0, 40);
      }
      await setDoc(doc(db, 'reminder_logs', logId), zaloLogPayload);
      onFlash(
        biText(
          lang,
          `Zalo message copied & logged! Paste directly into Zalo chat for ${cleanPhone}.`,
          `Đã chép tin nhắn Zalo & ghi nhận! Dán trực tiếp vào khung chat Zalo (${cleanPhone}).`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `invoices/${reminderInvoice.id}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Save LiLab Official Bank & QR Config
  const handleUploadQrImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyAction('upload_qr');
    try {
      const compressed = await compressQrImageFile(file);
      setQrImageDataUrl(compressed);
      setUseDynamicVietQr(false);
      onFlash(
        biText(
          lang,
          'LiLab QR image loaded! Click "Save LiLab Bank & QR" to publish to Parents.',
          'Đã tải ảnh QR LiLab! Bấm "Lưu Ngân hàng & Mã QR LiLab" để hiển thị ngay cho Phụ huynh.'
        )
      );
    } catch (err) {
      onFlash(err instanceof Error ? err.message : 'Unable to process QR image.');
    } finally {
      setBusyAction(null);
      e.target.value = '';
    }
  };

  const handleSaveAcademyBankConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim() || !accountHolder.trim()) return;
    setBusyAction('save_bank_qr');
    try {
      const id = 'lilab_primary';
      const existing = academyBankConfigs.find((c) => c.id === id);
      const payload: Record<string, unknown> = {
        bankName: bankName.trim().slice(0, 120),
        bankCode: (bankCode.trim() || 'VCB').toUpperCase().slice(0, 30),
        accountNumber: accountNumber.trim().slice(0, 60),
        accountHolder: accountHolder.trim().slice(0, 120),
        useDynamicVietQr,
        isActive: true,
        updatedByEmail: (safeUser.email || 'admin@lilab.edu.vn').slice(0, 160),
      };
      if (branchName.trim()) payload.branchName = branchName.trim().slice(0, 120);
      if (zaloHotline.trim()) payload.zaloHotline = zaloHotline.trim().slice(0, 40);
      if (instructionsEn.trim()) payload.paymentInstructionsEn = instructionsEn.trim().slice(0, 600);
      if (instructionsVi.trim()) payload.paymentInstructionsVi = instructionsVi.trim().slice(0, 600);
      if (qrImageDataUrl.trim()) payload.qrImageDataUrl = qrImageDataUrl.trim().slice(0, 180000);

      await setDoc(doc(db, 'academy_banking', id), {
        ...payload,
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onFlash(
        biText(
          lang,
          'LiLab official receiving bank & QR code published! Parents now see it immediately during course checkout.',
          'Đã lưu Ngân hàng & Mã QR chính thức của LiLab! Phụ huynh sẽ thấy ngay khi thanh toán học phí.'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'academy_banking/lilab_primary');
    } finally {
      setBusyAction(null);
    }
  };

  // Add Payable / Payroll
  const handleAddPayable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction('payable');
    try {
      const id = makeId('pay');
      const payload: Record<string, unknown> = {
        recordType: payType,
        recipientName: payRecipient.trim().slice(0, 120),
        bankName: payBankName.trim().slice(0, 120),
        bankAccountNumber: payBankNumber.trim().slice(0, 60),
        bankAccountHolder: payBankHolder.trim().slice(0, 120),
        amountVnd: Math.max(0, Math.round(Number(payAmount) || 0)),
        dueDate: payDue.trim().slice(0, 30),
        status: payType === 'academy_bank_config' ? 'active' : 'scheduled',
        adminUids,
      };
      if (payEmail.trim()) payload.recipientEmail = payEmail.trim().slice(0, 160);
      if (payNotes.trim()) payload.notes = payNotes.trim().slice(0, 600);

      await setDoc(doc(db, 'payables', id), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // If linked to a teacher profile and toggle is checked, persist bank & salary info on the teacher record
      if (payType === 'teacher_payroll' && payTeacherPick && saveBankToTeacher) {
        const pickedTeacher = teachers.find((t) => t.id === payTeacherPick);
        if (pickedTeacher) {
          const teacherPatch: Record<string, unknown> = {
            bankName: payBankName.trim().slice(0, 120),
            bankAccountNumber: payBankNumber.trim().slice(0, 60),
            bankAccountHolder: payBankHolder.trim().slice(0, 120),
            monthlyBaseVnd: Math.max(0, Math.round(Number(payAmount) || 0)),
            hourlyRateVnd: Math.max(0, Math.round(Number(payHourlyRate) || pickedTeacher.hourlyRateVnd || 0)),
          };
          await updateDoc(doc(db, 'teachers', pickedTeacher.id), {
            ...teacherPatch,
            updatedAt: serverTimestamp(),
          });
        }
      }

      setPayTeacherPick('');
      setPayRecipient('');
      setPayEmail('');
      setPayBankName('');
      setPayBankNumber('');
      setPayBankHolder('');
      setPayAmount(0);
      setPayHourlyRate(0);
      setPayNotes('');
      onFlash(biText(lang, 'Payable & payroll QR record saved.', 'Đã lưu khoản chi & mã QR lương giáo viên.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'payables');
    } finally {
      setBusyAction(null);
    }
  };

  const handleTogglePayableStatus = async (p: PayableRecord) => {
    setBusyAction(`pay_status_${p.id}`);
    try {
      const nextStatus: PayableRecord['status'] = p.status === 'paid' ? 'scheduled' : 'paid';
      await updateDoc(doc(db, 'payables', p.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      onFlash(
        biText(
          lang,
          `Payable for ${p.recipientName} marked ${nextStatus.toUpperCase()}.`,
          `Khoản chi cho ${p.recipientName} đã chuyển thành ${nextStatus.toUpperCase()}.`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payables/${p.id}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeletePayable = async (id: string) => {
    setBusyAction(`pay_del_${id}`);
    try {
      await deleteDoc(doc(db, 'payables', id));
      onFlash(biText(lang, 'Payable deleted.', 'Đã xóa khoản chi.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `payables/${id}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteParentMethod = async (id: string) => {
    setBusyAction(`pm_del_${id}`);
    try {
      await deleteDoc(doc(db, 'payment_methods', id));
      onFlash(biText(lang, 'Parent banking profile removed.', 'Đã xóa thông tin ngân hàng phụ huynh.'));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `payment_methods/${id}`);
    } finally {
      setBusyAction(null);
    }
  };

  // Export CSV Ledger
  const handleExportCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [
      'TYPE,REFERENCE,ENTITY,EMAIL_OR_PHONE,COURSE_OR_BANK,AMOUNT_VND,DUE_DATE,METHOD_OR_ACCOUNT,STATUS,NOTES',
    ];
    for (const inv of invoices) {
      lines.push(
        [
          'RECEIVABLE_INVOICE',
          inv.invoiceNumber,
          inv.studentName,
          inv.parentEmail,
          inv.programTitle,
          inv.amountVnd,
          inv.dueDate,
          `${inv.paymentMethod}${inv.paymentReference ? ` (${inv.paymentReference})` : ''}`,
          inv.status,
          inv.reminderNote || inv.payerBankName || '',
        ]
          .map(esc)
          .join(',')
      );
    }
    for (const pm of paymentMethods) {
      lines.push(
        [
          'PARENT_BANKING',
          pm.id,
          pm.accountHolderName,
          `${pm.parentEmail}${pm.parentPhone ? ` / ${pm.parentPhone}` : ''}`,
          pm.bankName || pm.providerLabel,
          0,
          '',
          `${pm.methodType} · ${pm.accountNumberMasked || `•••• ${pm.accountLast4}`}`,
          pm.autoPayEnabled ? 'AUTO_PAY' : 'MANUAL',
          pm.branchOrNotes || '',
        ]
          .map(esc)
          .join(',')
      );
    }
    for (const p of payables) {
      lines.push(
        [
          `PAYABLE_${p.recordType.toUpperCase()}`,
          p.id,
          p.recipientName,
          p.recipientEmail || '',
          p.bankName,
          p.amountVnd,
          p.dueDate,
          `${p.bankAccountNumber} (${p.bankAccountHolder})`,
          p.status,
          p.notes || '',
        ]
          .map(esc)
          .join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lilab-accounts-banking-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onFlash(biText(lang, 'Exported full Accounts & Banking CSV ledger.', 'Đã xuất sổ kế toán & ngân hàng CSV.'));
  };

  const livePreviewVietQrUrl = useMemo(
    () =>
      buildVietQrImageUrl({
        bankCode,
        accountNumber,
        accountHolder,
        amountVnd: previewSampleAmount,
        memo: 'LILAB-10248 NGUYEN MINH AN',
      }),
    [bankCode, accountNumber, accountHolder, previewSampleAmount]
  );

  const filteredParentMethods = useMemo(() => {
    const q = parentBankSearch.trim().toLowerCase();
    return paymentMethods.filter((pm) => {
      if (!q) return true;
      return (
        (pm.parentEmail || '').toLowerCase().includes(q) ||
        (pm.accountHolderName || '').toLowerCase().includes(q) ||
        (pm.providerLabel || '').toLowerCase().includes(q) ||
        (pm.bankName || '').toLowerCase().includes(q) ||
        (pm.accountLast4 || '').toLowerCase().includes(q) ||
        (pm.parentPhone || '').toLowerCase().includes(q)
      );
    });
  }, [paymentMethods, parentBankSearch]);

  const statusBadge = (status: TuitionInvoice['status']) => {
    if (status === 'paid') {
      return 'bg-[#0D9488]/12 text-[#0D9488] border-[#0D9488]/25';
    }
    if (status === 'overdue') {
      return 'bg-[#E61E64]/12 text-[#E61E64] border-[#E61E64]/25';
    }
    if (status === 'reminder_sent') {
      return 'bg-[#D97706]/12 text-[#B45309] border-[#D97706]/25';
    }
    return 'bg-[#2D3E99]/10 text-[#2D3E99] border-[#2D3E99]/20';
  };

  return (
    <div className="space-y-6">
      {/* Executive Header & Action Buttons */}
      <div className="bg-gradient-to-r from-[#172154] via-[#2D3E99] to-[#1f2c73] text-white rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFD41D] text-[#172154] text-[11px] font-extrabold uppercase tracking-wider">
              <Landmark className="w-3.5 h-3.5" />
              {biText(lang, 'LILAB ACCOUNTS & BANKING COMMAND CENTER', 'TRUNG TÂM TÀI CHÍNH, KẾ TOÁN & NGÂN HÀNG LILAB')}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold mt-2">
              {biText(lang, 'Accounts, Banking, QR Checkout & Reminders', 'Tài khoản, Ngân hàng, Mã QR & Nhắc Học Phí')}
            </h2>
            <p className="text-xs sm:text-sm text-white/80 mt-1 max-w-2xl">
              {biText(
                lang,
                'Manage LiLab official receiving bank & QR code, inspect all parent banking details & instant QR payments in real time, dispatch Email & Zalo payment due reminders, and process teacher payroll.',
                'Cấu hình tài khoản & mã QR nhận học phí LiLab, theo dõi trực tiếp thông tin ngân hàng & thanh toán QR từ Phụ huynh, gửi nhắc học phí qua Email/Zalo và quản lý sổ chi giáo viên.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSendAutomatedZaloReminders && (
              <button
                type="button"
                disabled={zaloDispatching || (pendingPaymentsProp?.length ?? kpis.unpaidCount) === 0}
                onClick={() => void onSendAutomatedZaloReminders()}
                className="px-3.5 py-2 rounded-xl bg-[#0068FF] hover:bg-[#0055d4] disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                {zaloDispatching
                  ? biText(lang, 'Sending Zalo Reminders...', 'Đang gửi nhắc Zalo...')
                  : biText(
                      lang,
                      `Auto-Send Zalo Reminders (${pendingPaymentsProp?.length ?? kpis.unpaidCount})`,
                      `Gửi Nhắc Zalo Tự Động (${pendingPaymentsProp?.length ?? kpis.unpaidCount})`
                    )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSection('receivables');
                setShowIssueInvoiceForm((v) => !v);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#FFD41D] hover:bg-[#f0c50c] text-[#172154] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              {biText(lang, 'Issue Tuition Invoice', 'Xuất Hóa đơn Mới')}
            </button>
            <button
              type="button"
              onClick={() => setSection('lilab_qr')}
              className="px-3.5 py-2 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <QrCode className="w-4 h-4" />
              {biText(lang, 'LiLab Bank & QR Setup', 'Cài đặt QR LiLab')}
            </button>
            <button
              type="button"
              onClick={() => setSection('analytics')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                section === 'analytics'
                  ? 'bg-[#56BEB8] text-[#172154] shadow-sm'
                  : 'bg-white/12 hover:bg-white/20 border border-white/20 text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-[#FFD41D]" />
              {biText(lang, 'Revenue Analytics', 'Biểu đồ Doanh thu')}
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              {biText(lang, 'Export CSV Ledger', 'Xuất Sổ CSV')}
            </button>
          </div>
        </div>

        {/* Automated Zalo Dispatch Results Panel */}
        {zaloDispatchResults.length > 0 && (
          <div className="bg-white text-[#172154] rounded-xl p-4 border border-[#0068FF]/30 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#0068FF]" />
                <h3 className="font-display text-sm font-extrabold text-[#2D3E99]">
                  {biText(
                    lang,
                    `Automated Zalo Payment Reminders (${zaloDispatchResults.length} processed)`,
                    `Kết quả Gửi Nhắc Học Phí Zalo Tự Động (${zaloDispatchResults.length} hóa đơn)`
                  )}
                </h3>
              </div>
              {onClearZaloResults && (
                <button
                  type="button"
                  onClick={onClearZaloResults}
                  className="text-xs font-bold text-[#172154]/60 hover:text-[#E61E64] inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  {biText(lang, 'Dismiss', 'Đóng')}
                </button>
              )}
            </div>
            <div className="divide-y divide-[#2D3E99]/10 max-h-64 overflow-y-auto">
              {zaloDispatchResults.map((res) => (
                <div
                  key={res.invoiceId}
                  className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-[#172154]">
                      {res.invoiceNumber} · {res.studentName}{' '}
                      <span className="font-mono text-[#2D3E99]">({res.recipientPhone})</span>
                    </div>
                    <div className="text-[11px] text-[#172154]/65">
                      {res.error ? (
                        <span className="text-[#E61E64] font-semibold">{res.error}</span>
                      ) : res.deliveryMode === 'zalo_webhook' || res.deliveryMode === 'zalo_oa_api' ? (
                        <span className="text-[#0D9488] font-semibold">
                          {biText(
                            lang,
                            `Sent automatically via ${res.deliveryMode === 'zalo_oa_api' ? 'Zalo OA API' : 'Zalo Webhook'}`,
                            `Đã gửi tự động qua ${res.deliveryMode === 'zalo_oa_api' ? 'Zalo OA API' : 'Zalo Webhook'}`
                          )}
                        </span>
                      ) : (
                        <span>
                          {res.hasDirectParentPhone
                            ? biText(
                                lang,
                                'Logged in DB · Copy message & open parent Zalo chat',
                                'Đã ghi nhận · Chép tin nhắn & mở khung chat Zalo Phụ huynh'
                              )
                            : biText(
                                lang,
                                'No parent phone on file · Using LiLab Zalo hotline link',
                                'Chưa có SĐT Phụ huynh · Dùng đường dẫn Zalo Hotline LiLab'
                              )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void copyText(res.formattedMessage, `zalo_res_${res.invoiceId}`)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#FDF9EE] border border-[#2D3E99]/15 text-[#2D3E99] hover:bg-[#2D3E99]/10 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === `zalo_res_${res.invoiceId}` ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                          <span className="text-[#0D9488]">{biText(lang, 'Copied', 'Đã chép')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{biText(lang, 'Copy Text', 'Chép tin')}</span>
                        </>
                      )}
                    </button>
                    <a
                      href={res.zaloUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void copyText(res.formattedMessage, `zalo_res_${res.invoiceId}`)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0068FF] hover:bg-[#0055d4] text-white font-bold inline-flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{biText(lang, 'Open Zalo', 'Mở Zalo')}</span>
                      <ExternalLink className="w-3 h-3 opacity-85" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5 Live Financial KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'Tuition Collected', 'Học phí Đã thu')}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#56BEB8]" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-[#56BEB8] mt-1 tabular-nums">
              {formatVnd(kpis.collectedVnd)}
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">
              {kpis.paidCount} {biText(lang, 'paid', 'đã thu')} · {kpis.qrPaidCount} QR
            </div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'Receivables Due', 'Học phí Chờ thu')}</span>
              <BellRing className="w-3.5 h-3.5 text-[#FFD41D]" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-[#FFD41D] mt-1 tabular-nums">
              {formatVnd(kpis.outstandingVnd)}
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">
              {kpis.unpaidCount} {biText(lang, 'unpaid', 'chưa thu')} · {kpis.overdueCount}{' '}
              {biText(lang, 'overdue', 'quá hạn')}
            </div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'Parent Banking Info', 'NH Phụ huynh lưu')}</span>
              <CreditCard className="w-3.5 h-3.5 text-[#FFD41D]" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-white mt-1 tabular-nums">
              {kpis.parentBankCount}
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">
              {kpis.autoPayCount} {biText(lang, 'Auto-Pay active', 'Trích nợ tự động')}
            </div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'Payables & Payroll', 'Công nợ & Lương GV')}</span>
              <Wallet className="w-3.5 h-3.5 text-[#E61E64]" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-white mt-1 tabular-nums">
              {formatVnd(kpis.scheduledPayablesVnd)}
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">
              {kpis.unpaidPayablesCount} {biText(lang, 'pending payouts', 'khoản chờ chi')}
            </div>
          </div>

          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 col-span-2 lg:col-span-1">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'LiLab Active QR', 'Mã QR LiLab')}</span>
              <QrCode className="w-3.5 h-3.5 text-[#56BEB8]" />
            </div>
            <div className="font-display text-sm font-extrabold text-white mt-1 truncate">
              {activeBank.bankName}
            </div>
            <div className="text-[11px] font-mono text-[#56BEB8] mt-0.5 truncate">
              {activeBank.accountNumber}
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-white border border-[#2D3E99]/15 rounded-xl">
        {[
          {
            id: 'receivables' as const,
            label: biText(lang, `Invoices & Payments (${invoices.length})`, `Hóa đơn & Thu học phí (${invoices.length})`),
            icon: <Receipt className="w-4 h-4" />,
          },
          {
            id: 'ledger' as const,
            label: biText(lang, 'Transaction Ledger', 'Sổ cái Giao dịch & Nhắc phí'),
            icon: <History className="w-4 h-4" />,
          },
          {
            id: 'analytics' as const,
            label: biText(lang, 'Revenue Analytics & Trends', 'Phân tích Doanh thu & Xu hướng'),
            icon: <TrendingUp className="w-4 h-4" />,
          },
          {
            id: 'lilab_qr' as const,
            label: biText(lang, 'LiLab Bank & QR Setup', 'Ngân hàng & Mã QR LiLab'),
            icon: <QrCode className="w-4 h-4" />,
          },
          {
            id: 'parent_banking' as const,
            label: biText(lang, `Parent Banking Vault (${paymentMethods.length})`, `Thông tin NH Phụ huynh (${paymentMethods.length})`),
            icon: <Building2 className="w-4 h-4" />,
          },
          {
            id: 'payables' as const,
            label: biText(lang, `Payables & Payroll (${payables.length})`, `Sổ chi & Lương GV (${payables.length})`),
            icon: <Banknote className="w-4 h-4" />,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer ${
              section === tab.id
                ? 'bg-[#2D3E99] text-white shadow-sm'
                : 'text-[#172154]/75 hover:text-[#2D3E99] hover:bg-[#FDF9EE]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* SECTION 1B: HISTORICAL TRANSACTION LEDGER (FIRESTORE-BACKED PER-PARENT & TIMELINE) */}
      {section === 'ledger' && (
        <ErrorBoundary variant="section" sectionLabel="Transaction Ledger">
          <Suspense
            fallback={
              <PortalLoader
                label={biText(lang, 'Loading transaction ledger...', 'Đang tải sổ cái giao dịch...')}
              />
            }
          >
            <AdminTransactionLedger
              lang={lang}
              currentUser={currentUser}
              students={students}
              paymentMethods={paymentMethods}
              onOpenReminder={openReminderDispatcher}
              onMarkInvoicePaid={(inv) => handleUpdateInvoiceStatus(inv, 'paid')}
              onNavigateToAnalytics={() => setSection('analytics')}
              onFlash={onFlash}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* SECTION 1C: VISUAL REVENUE TRENDS & PAYMENT STATUS DISTRIBUTION (RECHARTS DASHBOARD) */}
      {section === 'analytics' && (
        <ErrorBoundary variant="section" sectionLabel="Revenue Analytics">
          <Suspense
            fallback={
              <PortalLoader
                label={biText(lang, 'Loading revenue charts...', 'Đang tải biểu đồ doanh thu...')}
              />
            }
          >
            <AdminBankingAnalyticsDashboard
              lang={lang}
              currentUser={currentUser}
              invoices={invoices}
              payables={payables}
              students={students}
              programs={programs}
              paymentMethods={paymentMethods}
              onNavigateToInvoices={() => setSection('receivables')}
              onNavigateToLedger={() => setSection('ledger')}
              onFlash={onFlash}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* SECTION 1: RECEIVABLES, INSTANT PAYMENTS & EMAIL/ZALO REMINDERS */}
      {section === 'receivables' && (
        <div className="space-y-5">
          {showIssueInvoiceForm && (
            <form
              onSubmit={handleCreateInvoice}
              className="bg-white border-2 border-[#2D3E99]/25 rounded-2xl p-6 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-extrabold text-[#2D3E99] flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#E61E64]" />
                  {biText(lang, 'Issue New Student Tuition Invoice', 'Phát hành Hóa đơn Học phí Mới')}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIssueInvoiceForm(false)}
                  className="p-1.5 rounded-lg text-[#172154]/60 hover:bg-[#FDF9EE] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {biText(lang, 'Student / Family *', 'Học viên / Phụ huynh *')}
                  </label>
                  <select
                    required
                    value={invStudentId}
                    onChange={(e) => setInvStudentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                  >
                    <option value="">{biText(lang, 'Select student...', 'Chọn học viên...')}</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.parentEmail})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {biText(lang, 'Pick LiLab Course', 'Chọn Khóa học LiLab')}
                  </label>
                  <select
                    value={invProgramId}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setInvProgramId(pid);
                      const found = programs.find((p) => p.id === pid);
                      if (found) {
                        setInvProgramTitle(found.titleEn);
                        setInvAmount(found.tuitionVnd);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                  >
                    <option value="">{biText(lang, '-- Custom course title --', '-- Tự nhập tên khóa --')}</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} · {p.titleEn} ({formatVnd(p.tuitionVnd)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {biText(lang, 'Tuition Amount (VND) *', 'Số tiền học phí (VNĐ) *')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    required
                    value={invAmount}
                    onChange={(e) => setInvAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {biText(lang, 'Due Date *', 'Hạn thanh toán *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  required
                  value={invProgramTitle}
                  onChange={(e) => setInvProgramTitle(e.target.value)}
                  placeholder={biText(lang, 'Course / Invoice Description', 'Tên khóa học / Nội dung hóa đơn')}
                  className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
                <button
                  type="submit"
                  disabled={busyAction === 'invoice'}
                  className="px-5 py-2.5 rounded-xl bg-[#2D3E99] hover:bg-[#1f2c73] text-white text-xs font-bold cursor-pointer"
                >
                  {busyAction === 'invoice'
                    ? biText(lang, 'Issuing...', 'Đang tạo...')
                    : biText(lang, 'Issue Invoice Now', 'Phát hành Hóa đơn')}
                </button>
              </div>
            </form>
          )}

          {/* Filter & Search Toolbar */}
          <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: biText(lang, 'All', 'Tất cả') },
                  { id: 'paid', label: biText(lang, 'Paid', 'Đã thu') },
                  { id: 'pending', label: biText(lang, 'Pending', 'Chờ thu') },
                  { id: 'reminder_sent', label: biText(lang, 'Reminded', 'Đã nhắc') },
                  { id: 'overdue', label: biText(lang, 'Overdue', 'Quá hạn') },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setInvFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    invFilter === f.id
                      ? 'bg-[#2D3E99] text-white'
                      : 'bg-[#FDF9EE] text-[#172154]/75 hover:bg-[#2D3E99]/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-4 h-4 text-[#172154]/45 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={invSearch}
                onChange={(e) => setInvSearch(e.target.value)}
                placeholder={biText(lang, 'Search student, email, invoice #, QR ref...', 'Tìm học viên, email, mã HĐ, mã GD...')}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#2D3E99]/15 text-xs bg-[#FDF9EE]/60"
              />
            </div>
          </div>

          {/* Invoices & Live Payments Table */}
          <div className="bg-white border border-[#2D3E99]/15 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2D3E99]/10 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-extrabold text-[#2D3E99]">
                {biText(lang, 'Tuition Invoices, Parent QR Payments & Due Reminders', 'Danh sách Hóa đơn, Thanh toán QR & Nhắc Học Phí')}
              </h3>
              <span className="text-xs text-[#172154]/60 font-semibold">
                {filteredInvoices.length} {biText(lang, 'records', 'hóa đơn')}
              </span>
            </div>

            {filteredInvoices.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#172154]/60">
                {biText(lang, 'No invoices match this filter yet.', 'Chưa có hóa đơn nào khớp bộ lọc.')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FDF9EE] border-b border-[#2D3E99]/12 text-[11px] uppercase tracking-wider text-[#172154]/65">
                    <tr>
                      <th className="py-3 px-4">{biText(lang, 'Invoice & Course', 'Mã HĐ & Khóa học')}</th>
                      <th className="py-3 px-4">{biText(lang, 'Student / Parent', 'Học viên / Phụ huynh')}</th>
                      <th className="py-3 px-4 text-right">{biText(lang, 'Amount', 'Số tiền')}</th>
                      <th className="py-3 px-4">{biText(lang, 'Payment & Bank Ref', 'PT Thanh toán & Mã GD')}</th>
                      <th className="py-3 px-4">{biText(lang, 'Due & Status', 'Hạn & Trạng thái')}</th>
                      <th className="py-3 px-4 text-right">{biText(lang, 'Banking Actions', 'Thao tác')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D3E99]/10">
                    {filteredInvoices.map((inv) => {
                      const parentPhone = resolveParentPhoneForInvoice(inv);
                      return (
                        <tr key={inv.id} className="hover:bg-[#FDF9EE]/40">
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-mono font-extrabold text-[#2D3E99]">{inv.invoiceNumber}</div>
                            <div className="text-xs text-[#172154]/80 font-medium max-w-[220px] leading-snug mt-0.5">
                              {inv.programTitle}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-bold text-[#172154]">{inv.studentName}</div>
                            <div className="text-xs text-[#172154]/70">{inv.parentEmail}</div>
                            {parentPhone && (
                              <div className="text-[11px] font-mono text-[#0068FF] mt-0.5">
                                Zalo: {parentPhone}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 align-top text-right font-mono font-extrabold text-[#172154] tabular-nums whitespace-nowrap">
                            {formatVnd(inv.amountVnd)}
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-semibold text-xs text-[#2D3E99]">
                              {inv.paymentMethod === 'qr_transfer'
                                ? biText(lang, 'QR Transfer', 'Chuyển khoản QR')
                                : inv.paymentMethod === 'direct_debit'
                                  ? biText(lang, 'Direct Bank Debit', 'Trích nợ Ngân hàng')
                                  : inv.paymentMethod === 'credit_card'
                                    ? biText(lang, 'Credit / Debit Card', 'Thẻ Tín dụng / Ghi nợ')
                                    : biText(lang, 'Awaiting Selection', 'Chưa chọn')}
                            </div>
                            {inv.paymentReference && (
                              <div className="text-[11px] font-mono text-[#0D9488] font-bold mt-0.5">
                                Ref: {inv.paymentReference}
                              </div>
                            )}
                            {inv.payerBankName && (
                              <div className="text-[11px] text-[#172154]/70 mt-0.5">
                                {inv.payerBankName}
                                {inv.payerAccountHolder ? ` · ${inv.payerAccountHolder}` : ''}
                              </div>
                            )}
                            {inv.paidAt && (
                              <div className="text-[10px] text-[#172154]/55 font-mono">
                                {biText(lang, 'Paid:', 'TT lúc:')} {inv.paidAt.replace('T', ' ')}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 align-top space-y-1">
                            <div className="text-xs font-mono text-[#172154]/80">
                              {biText(lang, 'Due:', 'Hạn:')} {inv.dueDate}
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase ${statusBadge(
                                inv.status
                              )}`}
                            >
                              {inv.status.replace('_', ' ')}
                            </span>
                            {inv.reminderNote && (
                              <div className="text-[11px] text-[#B45309] max-w-[200px] leading-snug">
                                {inv.reminderNote}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 align-top text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              {inv.status !== 'paid' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busyAction === `inv_status_${inv.id}`}
                                    onClick={() => void handleUpdateInvoiceStatus(inv, 'paid')}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#0D9488] hover:bg-[#0b7c72] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    title={biText(lang, 'Mark Paid', 'Xác nhận Đã thu')}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {biText(lang, 'Mark Paid', 'Đã thu')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openReminderDispatcher(inv)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#FFD41D] hover:bg-[#f0c50c] text-[#172154] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                    title={biText(lang, 'Send Email or Zalo Reminder', 'Gửi nhắc qua Email & Zalo')}
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    {biText(lang, 'Email / Zalo', 'Nhắc Email/Zalo')}
                                  </button>
                                  {inv.status !== 'overdue' && (
                                    <button
                                      type="button"
                                      disabled={busyAction === `inv_status_${inv.id}`}
                                      onClick={() => void handleUpdateInvoiceStatus(inv, 'overdue')}
                                      className="px-2 py-1.5 rounded-lg border border-[#E61E64]/30 text-[#E61E64] hover:bg-[#E61E64]/10 text-[11px] font-bold cursor-pointer"
                                      title={biText(lang, 'Flag Overdue', 'Đánh dấu Quá hạn')}
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                              {inv.status === 'paid' && (
                                <button
                                  type="button"
                                  disabled={busyAction === `inv_status_${inv.id}`}
                                  onClick={() => void handleUpdateInvoiceStatus(inv, 'pending')}
                                  className="px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/20 text-[#2D3E99] hover:bg-[#FDF9EE] text-[11px] font-semibold cursor-pointer"
                                >
                                  {biText(lang, 'Reopen', 'Mở lại')}
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busyAction === `inv_del_${inv.id}`}
                                onClick={() => void handleDeleteInvoice(inv.id)}
                                className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                                title={biText(lang, 'Delete Invoice', 'Xóa hóa đơn')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: LILAB OFFICIAL RECEIVING BANK & QR CODE SETUP */}
      {section === 'lilab_qr' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSaveAcademyBankConfig}
            className="lg:col-span-7 bg-white border border-[#2D3E99]/15 rounded-2xl p-6 space-y-4 shadow-sm"
          >
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-[#E61E64] flex items-center gap-1.5">
                <QrCode className="w-4 h-4" />
                {biText(lang, 'OFFICIAL LILAB RECEIVING ACCOUNT & QR CODE', 'TÀI KHOẢN NGÂN HÀNG & MÃ QR CHÍNH THỨC CỦA LILAB')}
              </div>
              <h3 className="font-display text-xl font-extrabold text-[#2D3E99] mt-1">
                {biText(lang, 'Configure LiLab Bank & Payment QR for Parents', 'Thiết lập Ngân hàng & Mã QR Thanh toán')}
              </h3>
              <p className="text-xs text-[#172154]/70 mt-1">
                {biText(
                  lang,
                  'Upload your official LiLab bank QR image OR use live auto-generated VietQR with exact tuition amounts pre-filled. Changes sync immediately to the Parent Portal.',
                  'Tải lên ảnh mã QR ngân hàng của LiLab HOẶC dùng mã VietQR động tự điền đúng số tiền học phí. Thay đổi sẽ cập nhật ngay sang Cổng Phụ huynh.'
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(lang, 'Vietnam Bank Preset (VietQR Code) *', 'Chọn Ngân hàng (Mã VietQR) *')}
                </label>
                <select
                  value={bankCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setBankCode(code);
                    const preset = VIETNAM_BANK_PRESETS.find((b) => b.code === code);
                    if (preset) setBankName(preset.name);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
                >
                  {VIETNAM_BANK_PRESETS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(lang, 'Bank Display Name *', 'Tên Ngân hàng hiển thị *')}
                </label>
                <input
                  type="text"
                  required
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Vietcombank (VCB)"
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(lang, 'LiLab Bank Account Number *', 'Số Tài khoản LiLab *')}
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="1028869900123"
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(lang, 'Account Holder Name *', 'Tên Chủ Tài khoản *')}
                </label>
                <input
                  type="text"
                  required
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="CONG TY TNHH HOC VIEN LILAB"
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(lang, 'Bank Branch', 'Chi nhánh')}
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="Ho Chi Minh City Branch"
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(lang, 'Billing / Zalo Hotline', 'Số Zalo / Hotline Học phí')}
                </label>
                <input
                  type="text"
                  value={zaloHotline}
                  onChange={(e) => setZaloHotline(e.target.value)}
                  placeholder="0707547187"
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                />
              </div>
            </div>

            {/* Custom LiLab QR Image Uploader */}
            <div className="p-4 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/15 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-[#2D3E99] flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-[#E61E64]" />
                  {biText(lang, 'LiLab Payment QR Image (Upload Custom QR or Use Live VietQR)', 'Ảnh Mã QR LiLab (Tải ảnh QR hoặc dùng VietQR tự động)')}
                </div>
                {qrImageDataUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setQrImageDataUrl('');
                      setUseDynamicVietQr(true);
                    }}
                    className="text-xs font-bold text-[#E61E64] hover:underline cursor-pointer"
                  >
                    {biText(lang, 'Remove Uploaded QR', 'Xóa ảnh QR đã tải')}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="px-4 py-2 rounded-xl bg-[#2D3E99] hover:bg-[#1f2c73] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {busyAction === 'upload_qr'
                      ? biText(lang, 'Processing QR...', 'Đang xử lý...')
                      : biText(lang, 'Upload LiLab QR Image (PNG/JPG)', 'Tải Ảnh Mã QR LiLab (PNG/JPG)')}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadQrImage}
                    className="hidden"
                  />
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-[#172154] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDynamicVietQr}
                    onChange={(e) => setUseDynamicVietQr(e.target.checked)}
                    className="rounded"
                  />
                  <span>
                    {biText(
                      lang,
                      'Auto-generate exact-amount VietQR when no custom QR is active',
                      'Tự tạo mã VietQR điền sẵn đúng số tiền (khi không dùng ảnh riêng)'
                    )}
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(lang, 'Parent Instructions (English)', 'Hướng dẫn thanh toán (Tiếng Anh)')}
                </label>
                <textarea
                  rows={2}
                  value={instructionsEn}
                  onChange={(e) => setInstructionsEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#172154] mb-1">
                  {biText(lang, 'Parent Instructions (Vietnamese)', 'Hướng dẫn thanh toán (Tiếng Việt)')}
                </label>
                <textarea
                  rows={2}
                  value={instructionsVi}
                  onChange={(e) => setInstructionsVi(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busyAction === 'save_bank_qr'}
              className="w-full py-3 px-4 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              {busyAction === 'save_bank_qr'
                ? biText(lang, 'Saving to Database...', 'Đang lưu vào cơ sở dữ liệu...')
                : biText(lang, 'Save & Publish LiLab Bank & QR Code', 'Lưu & Công bố Tài khoản & Mã QR LiLab')}
            </button>
          </form>

          {/* Right: Live Parent Portal QR Preview */}
          <div className="lg:col-span-5 bg-white border-2 border-[#2D3E99]/20 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#0D9488]">
                  {biText(lang, 'LIVE PARENT PORTAL PREVIEW', 'XEM TRƯỚC TRÊN CỔNG PHỤ HUYNH')}
                </div>
                <h4 className="font-display text-lg font-extrabold text-[#2D3E99]">
                  {biText(lang, 'What Parents See When Paying by QR', 'Giao diện Quét QR của Phụ huynh')}
                </h4>
              </div>
              <span className="px-2 py-1 rounded-md bg-[#0D9488]/12 text-[#0D9488] text-[10px] font-extrabold">
                {!useDynamicVietQr && qrImageDataUrl ? 'CUSTOM QR' : 'LIVE VIETQR'}
              </span>
            </div>

            <div className="bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-2xl p-5 flex flex-col items-center text-center space-y-3">
              {!useDynamicVietQr && qrImageDataUrl ? (
                <img
                  src={qrImageDataUrl}
                  alt="LiLab Official Payment QR"
                  className="w-56 h-56 object-contain bg-white p-2 rounded-xl border border-[#2D3E99]/15 shadow-sm"
                />
              ) : livePreviewVietQrUrl ? (
                <img
                  src={livePreviewVietQrUrl}
                  alt="LiLab VietQR Code"
                  className="w-56 h-auto object-contain bg-white p-2 rounded-xl border border-[#2D3E99]/15 shadow-sm"
                />
              ) : (
                <div className="w-48 h-48 rounded-xl bg-white border border-dashed border-[#2D3E99]/25 flex items-center justify-center text-xs text-[#172154]/50">
                  {biText(lang, 'Enter account number or upload QR', 'Nhập số TK hoặc tải ảnh QR')}
                </div>
              )}

              <div className="w-full text-left bg-white rounded-xl p-3.5 border border-[#2D3E99]/12 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[#172154]/60">{biText(lang, 'Bank:', 'Ngân hàng:')}</span>
                  <strong className="text-[#2D3E99] text-right">{bankName}</strong>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[#172154]/60">{biText(lang, 'Account:', 'Số TK:')}</span>
                  <button
                    type="button"
                    onClick={() => void copyText(accountNumber, 'preview_acc')}
                    className="inline-flex items-center gap-1 font-mono font-extrabold text-[#172154] hover:text-[#E61E64] cursor-pointer"
                  >
                    <span>{accountNumber}</span>
                    {copiedId === 'preview_acc' ? (
                      <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#172154]/60">{biText(lang, 'Holder:', 'Chủ TK:')}</span>
                  <strong className="text-[#172154] text-right">{accountHolder}</strong>
                </div>
                <div className="flex justify-between gap-2 pt-1.5 border-t border-[#2D3E99]/10">
                  <span className="text-[#172154]/60">{biText(lang, 'Sample Amount:', 'Mẫu học phí:')}</span>
                  <strong className="font-mono text-[#E61E64]">{formatVnd(previewSampleAmount)}</strong>
                </div>
              </div>

              <div className="w-full flex items-center gap-2 text-xs">
                <span className="text-[#172154]/65 shrink-0">{biText(lang, 'Test Amount:', 'Thử số tiền:')}</span>
                <input
                  type="number"
                  step={100000}
                  value={previewSampleAmount}
                  onChange={(e) => setPreviewSampleAmount(Number(e.target.value))}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/20 bg-white font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: PARENT BANKING & PAYMENT METHODS VAULT (LIVE FROM DB) */}
      {section === 'parent_banking' && (
        <div className="space-y-4">
          <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-extrabold text-[#2D3E99]">
                {biText(lang, 'Parent Submitted Banking & Payment Profiles', 'Hồ sơ Ngân hàng & Phương thức Thanh toán của Phụ huynh')}
              </h3>
              <p className="text-xs text-[#172154]/70 mt-0.5">
                {biText(
                  lang,
                  'Every bank account, debit authorization, card, or QR profile entered by parents in the Parent Portal appears here automatically from the database.',
                  'Mọi thông tin ngân hàng, thẻ hoặc trích nợ tự động do Phụ huynh nhập trên Cổng Phụ huynh sẽ tự động lưu vào cơ sở dữ liệu và hiển thị trực tiếp tại đây.'
                )}
              </p>
            </div>
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-[#172154]/45 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={parentBankSearch}
                onChange={(e) => setParentBankSearch(e.target.value)}
                placeholder={biText(lang, 'Search parent, bank, account...', 'Tìm phụ huynh, ngân hàng, số TK...')}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#2D3E99]/15 text-xs bg-[#FDF9EE]/60"
              />
            </div>
          </div>

          {filteredParentMethods.length === 0 ? (
            <div className="bg-white border border-dashed border-[#2D3E99]/25 rounded-2xl p-10 text-center space-y-2">
              <Building2 className="w-10 h-10 text-[#2D3E99]/35 mx-auto" />
              <h4 className="font-display text-base font-bold text-[#2D3E99]">
                {biText(lang, 'No Parent Banking Records Yet', 'Chưa có thông tin ngân hàng Phụ huynh nào')}
              </h4>
              <p className="text-xs text-[#172154]/65 max-w-md mx-auto">
                {biText(
                  lang,
                  'When parents save their banking details or check out for a course on the Parent Portal, their records will appear here immediately.',
                  'Khi Phụ huynh nhập thông tin ngân hàng hoặc thanh toán khóa học trên Cổng Phụ huynh, dữ liệu sẽ tự động hiển thị tại đây.'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredParentMethods.map((pm) => {
                const linkedKids = students.filter(
                  (s) => s.parentEmail.toLowerCase() === pm.parentEmail.toLowerCase()
                );
                const phone = pm.parentPhone || linkedKids[0]?.parentPhone || '';
                return (
                  <div
                    key={pm.id}
                    className="bg-white border border-[#2D3E99]/15 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#2D3E99]/10 text-[#2D3E99] text-[11px] font-extrabold uppercase">
                          {pm.methodType === 'direct_debit'
                            ? biText(lang, 'Direct Debit', 'Trích nợ NH')
                            : pm.methodType === 'credit_card'
                              ? biText(lang, 'Card', 'Thẻ')
                              : 'QR Transfer'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            pm.autoPayEnabled
                              ? 'bg-[#0D9488]/12 text-[#0D9488]'
                              : 'bg-[#172154]/8 text-[#172154]/60'
                          }`}
                        >
                          {pm.autoPayEnabled
                            ? biText(lang, 'Auto-Pay ON', 'Tự động thu')
                            : biText(lang, 'Manual Pay', 'Thủ công')}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-display text-base font-extrabold text-[#2D3E99]">
                          {pm.bankName || pm.providerLabel}
                        </h4>
                        <div className="text-xs font-bold text-[#172154] mt-0.5">
                          {pm.accountHolderName}
                        </div>
                        <div className="font-mono text-xs text-[#E61E64] font-bold mt-0.5">
                          {pm.accountNumberMasked || `•••• ${pm.accountLast4}`}
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/10 text-xs space-y-1">
                        <div className="text-[#172154]/80 truncate">
                          <strong>Email:</strong> {pm.parentEmail}
                        </div>
                        {phone && (
                          <div className="text-[#0068FF] font-mono font-semibold">
                            <strong>Zalo / Tel:</strong> {phone}
                          </div>
                        )}
                        {linkedKids.length > 0 && (
                          <div className="text-[#172154]/75">
                            <strong>{biText(lang, 'Student(s):', 'Học viên:')}</strong>{' '}
                            {linkedKids.map((k) => k.fullName).join(', ')}
                          </div>
                        )}
                        {pm.branchOrNotes && (
                          <div className="text-[#172154]/70 italic">{pm.branchOrNotes}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#2D3E99]/10">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(
                              `${pm.accountHolderName} | ${pm.bankName || pm.providerLabel} | ${pm.accountNumberMasked || pm.accountLast4} | ${pm.parentEmail}`,
                              `pm_${pm.id}`
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#2D3E99]/10 hover:bg-[#2D3E99]/18 text-[#2D3E99] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedId === `pm_${pm.id}` ? (
                            <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          {biText(lang, 'Copy', 'Chép')}
                        </button>
                        {phone && (
                          <a
                            href={buildZaloDeepLink(phone, activeBank.zaloHotline)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-[#0068FF] hover:bg-[#0055d4] text-white text-[11px] font-bold flex items-center gap-1"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Zalo
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={busyAction === `pm_del_${pm.id}`}
                        onClick={() => void handleDeleteParentMethod(pm.id)}
                        className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: ACCOUNTS PAYABLE & TEACHER PAYROLL (WITH TEACHER PAYROLL QR CODE) */}
      {section === 'payables' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <form
              onSubmit={handleAddPayable}
              className="lg:col-span-5 bg-white border border-[#2D3E99]/15 rounded-2xl p-6 space-y-3.5 shadow-sm"
            >
              <div className="flex items-center gap-2 text-[#E61E64]">
                <Landmark className="w-5 h-5" />
                <h3 className="font-display text-lg font-extrabold">
                  {biText(lang, 'Add Payroll / Accounts Payable', 'Thêm Lương Giáo viên / Khoản Phải Trả')}
                </h3>
              </div>

              <select
                value={payType}
                onChange={(e) => setPayType(e.target.value as PayableRecord['recordType'])}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm bg-white"
              >
                <option value="teacher_payroll">{biText(lang, 'Teacher Payroll', 'Lương Giáo viên')}</option>
                <option value="vendor_expense">{biText(lang, 'Vendor / Facility Expense', 'Chi phí Cơ sở / Đối tác')}</option>
                <option value="academy_bank_config">{biText(lang, 'Academy Reserve Account Note', 'Tài khoản Quỹ Học viện')}</option>
              </select>

              {payType === 'teacher_payroll' && teachers.length > 0 && (
                <div className="p-3 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/12 space-y-2">
                  <label className="text-[11px] font-bold text-[#2D3E99] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {biText(lang, 'Quick-Fill from Teacher Roster', 'Điền nhanh từ Danh sách Giáo viên')}
                  </label>
                  <select
                    value={payTeacherPick}
                    onChange={(e) => {
                      const tid = e.target.value;
                      setPayTeacherPick(tid);
                      const tc = teachers.find((t) => t.id === tid);
                      if (tc) {
                        setPayRecipient(tc.fullName);
                        setPayEmail(tc.teacherEmail);
                        setPayBankName(tc.bankName || '');
                        setPayBankNumber(tc.bankAccountNumber || '');
                        setPayBankHolder(tc.bankAccountHolder || tc.fullName);
                        setPayAmount(tc.monthlyBaseVnd || 0);
                        setPayHourlyRate(tc.hourlyRateVnd || 0);
                        setPayNotes(`Monthly payroll${tc.specialty ? ` · ${tc.specialty}` : ''}`);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#2D3E99]/20 text-xs bg-white"
                  >
                    <option value="">{biText(lang, '-- Select a teacher --', '-- Chọn giáo viên --')}</option>
                    {teachers.map((tc) => (
                      <option key={tc.id} value={tc.id}>
                        {tc.fullName} {tc.monthlyBaseVnd > 0 ? `· ${formatVnd(tc.monthlyBaseVnd)}` : ''}
                        {tc.bankAccountNumber ? ` · ${tc.bankName || 'Bank'}` : ''}
                      </option>
                    ))}
                  </select>
                  {payTeacherPick && (
                    <label className="flex items-center gap-2 text-[11px] text-[#172154]/80 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={saveBankToTeacher}
                        onChange={(e) => setSaveBankToTeacher(e.target.checked)}
                        className="rounded border-[#2D3E99]/30 text-[#6B21A8]"
                      />
                      <span>
                        {biText(
                          lang,
                          'Also save bank details & salary to this teacher profile',
                          'Đồng bộ lưu thông tin ngân hàng & mức lương vào hồ sơ giáo viên'
                        )}
                      </span>
                    </label>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={payRecipient}
                  onChange={(e) => setPayRecipient(e.target.value)}
                  placeholder={biText(lang, 'Recipient / Entity *', 'Người nhận / Đơn vị *')}
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
                <input
                  type="email"
                  value={payEmail}
                  onChange={(e) => setPayEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[#172154]/70">
                    {biText(lang, 'Bank Account (VietQR Ready)', 'Tài khoản Ngân hàng (Tạo mã VietQR)')}
                  </span>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) setPayBankName(e.target.value);
                    }}
                    className="px-2 py-1 rounded-md border border-[#2D3E99]/20 text-[11px] bg-white text-[#2D3E99] font-semibold"
                  >
                    <option value="">{biText(lang, 'Quick Pick Bank…', 'Chọn nhanh Ngân hàng…')}</option>
                    {VIETNAM_BANK_PRESETS.map((b) => (
                      <option key={b.code} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    required
                    value={payBankName}
                    onChange={(e) => setPayBankName(e.target.value)}
                    placeholder={biText(lang, 'Bank Name *', 'Ngân hàng *')}
                    className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                  <input
                    type="text"
                    required
                    value={payBankNumber}
                    onChange={(e) => setPayBankNumber(e.target.value)}
                    placeholder={biText(lang, 'Account No. *', 'Số TK *')}
                    className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                  />
                  <input
                    type="text"
                    required
                    value={payBankHolder}
                    onChange={(e) => setPayBankHolder(e.target.value)}
                    placeholder={biText(lang, 'Holder *', 'Chủ TK *')}
                    className="px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                </div>
              </div>

              <div className={`grid gap-2.5 ${payType === 'teacher_payroll' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#172154]/60 mb-1">
                    {biText(lang, 'Payout Amount (VND)', 'Số tiền chi (VND)')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={50000}
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                  />
                </div>
                {payType === 'teacher_payroll' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#172154]/60 mb-1">
                      {biText(lang, 'Hourly Rate (VND)', 'Lương giờ (VND)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={payHourlyRate || ''}
                      onChange={(e) => setPayHourlyRate(Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#172154]/60 mb-1">
                    {biText(lang, 'Pay Date', 'Ngày chi')}
                  </label>
                  <input
                    type="date"
                    required
                    value={payDue}
                    onChange={(e) => setPayDue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                  />
                </div>
              </div>

              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder={biText(lang, 'Payment memo / notes', 'Ghi chú khoản chi')}
                className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
              />

              {/* Live Teacher Payroll VietQR Preview */}
              {payType === 'teacher_payroll' && payBankNumber.trim() && (
                <div className="p-3.5 rounded-xl bg-[#FAF5FF] border border-[#6B21A8]/20 flex items-center gap-3.5">
                  <div className="w-24 h-24 rounded-xl bg-white border border-[#6B21A8]/20 p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={buildVietQrImageUrl({
                        bankCode: resolveVietBankCode(payBankName),
                        accountNumber: payBankNumber.trim(),
                        accountHolder: payBankHolder.trim() || payRecipient.trim(),
                        amountVnd: payAmount > 0 ? payAmount : undefined,
                        memo: `LILAB PAYROLL ${payRecipient.trim()} ${payDue}`.trim(),
                      })}
                      alt="Teacher Payroll VietQR Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 space-y-1 text-xs">
                    <div className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-[#6B21A8]">
                      <QrCode className="w-3.5 h-3.5" />
                      {biText(lang, 'Live Teacher Payroll VietQR', 'Mã VietQR Trả Lương Trực Tiếp')}
                    </div>
                    <div className="font-bold text-[#172154] truncate">
                      {payBankHolder.trim() || payRecipient.trim() || biText(lang, 'Teacher Recipient', 'Giáo viên nhận lương')}
                    </div>
                    <div className="font-mono text-[11px] text-[#172154]/75 truncate">
                      {resolveVietBankCode(payBankName)} · {payBankNumber.trim()}
                    </div>
                    <div className="font-mono font-extrabold text-[#6B21A8]">
                      {payAmount > 0 ? formatVnd(payAmount) : biText(lang, 'Enter amount to lock VND', 'Nhập số tiền để gắn sẵn vào QR')}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busyAction === 'payable'}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-sm font-bold cursor-pointer"
              >
                {busyAction === 'payable'
                  ? biText(lang, 'Saving...', 'Đang lưu...')
                  : biText(lang, 'Save Payable / Payroll Record', 'Lưu Khoản Chi / Lương')}
              </button>
            </form>

            <div className="lg:col-span-7 bg-white border border-[#2D3E99]/15 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-extrabold text-[#2D3E99]">
                  {biText(lang, 'Payables, Payroll & Academy Ledger', 'Sổ Chi, Lương Giáo Viên & Ngân Hàng')}
                </h3>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6B21A8]">
                  <QrCode className="w-3.5 h-3.5" />
                  {biText(lang, 'Click Payroll QR to scan & transfer', 'Nhấn Mã QR Lương để quét chuyển khoản')}
                </span>
              </div>
              {payables.length === 0 ? (
                <p className="text-sm text-[#172154]/60">
                  {biText(lang, 'No payables recorded yet.', 'Chưa có khoản chi nào.')}
                </p>
              ) : (
                <div className="divide-y divide-[#2D3E99]/10 text-sm">
                  {payables.map((p) => {
                    const canShowQr = Boolean(p.bankAccountNumber && p.bankAccountNumber.trim());
                    return (
                      <div key={p.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-[#172154]">{p.recipientName}</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#2D3E99]/10 text-[#2D3E99] text-[10px] font-bold uppercase">
                              {p.recordType.replace('_', ' ')}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                p.status === 'paid'
                                  ? 'bg-[#0D9488]/12 text-[#0D9488]'
                                  : 'bg-[#FFD41D]/30 text-[#172154]'
                              }`}
                            >
                              {p.status}
                            </span>
                          </div>
                          <div className="text-xs text-[#172154]/70 font-mono">
                            {p.bankName} · {p.bankAccountNumber} · {p.bankAccountHolder} · Due {p.dueDate}
                          </div>
                          {p.notes && <div className="text-xs text-[#172154]/65">{p.notes}</div>}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-extrabold text-[#2D3E99] tabular-nums">
                            {formatVnd(p.amountVnd)}
                          </span>
                          {canShowQr && (
                            <button
                              type="button"
                              onClick={() => setPayrollQrPayable(p)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#FAF5FF] hover:bg-[#6B21A8] text-[#6B21A8] hover:text-white border border-[#6B21A8]/25 inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title={biText(lang, 'Open Teacher Payroll QR Code', 'Mở Mã QR Trả Lương')}
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              {p.recordType === 'teacher_payroll'
                                ? biText(lang, 'Payroll QR', 'QR Lương')
                                : biText(lang, 'Bank QR', 'QR Chuyển')}
                            </button>
                          )}
                          {p.recordType !== 'academy_bank_config' && (
                            <button
                              type="button"
                              disabled={busyAction === `pay_status_${p.id}`}
                              onClick={() => void handleTogglePayableStatus(p)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                p.status === 'paid'
                                  ? 'bg-[#2D3E99]/10 text-[#2D3E99]'
                                  : 'bg-[#0D9488] text-white'
                              }`}
                            >
                              {p.status === 'paid'
                                ? biText(lang, 'Undo Paid', 'Hoàn tác')
                                : biText(lang, 'Mark Paid', 'Đã chi')}
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyAction === `pay_del_${p.id}`}
                            onClick={() => void handleDeletePayable(p.id)}
                            className="p-1.5 text-[#E61E64] hover:bg-[#E61E64]/10 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Teacher Payroll QR Quick Directory (scan any teacher with bank details directly) */}
          {teachers.length > 0 && (
            <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-base font-extrabold text-[#172154] flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#6B21A8]" />
                    {biText(lang, 'Teacher Payroll QR Directory', 'Danh bạ Mã QR Trả Lương Giáo Viên')}
                  </h4>
                  <p className="text-xs text-[#172154]/65 mt-0.5">
                    {biText(
                      lang,
                      'Instant VietQR cards for faculty payroll transfers. Select a teacher in the form above to update their bank account or monthly base.',
                      'Thẻ mã VietQR trả lương nhanh cho từng giáo viên. Chọn giáo viên ở biểu mẫu bên trên để cập nhật tài khoản ngân hàng hoặc mức lương.'
                    )}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {teachers.map((tc) => {
                  const hasBank = Boolean(tc.bankAccountNumber && tc.bankAccountNumber.trim());
                  const bankCodeVal = resolveVietBankCode(tc.bankName);
                  const qrUrl = hasBank
                    ? buildVietQrImageUrl({
                        bankCode: bankCodeVal,
                        accountNumber: tc.bankAccountNumber || '',
                        accountHolder: tc.bankAccountHolder || tc.fullName,
                        amountVnd: tc.monthlyBaseVnd > 0 ? tc.monthlyBaseVnd : undefined,
                        memo: `LILAB PAYROLL ${tc.fullName}`,
                      })
                    : '';
                  return (
                    <div
                      key={tc.id}
                      className="rounded-xl border border-[#2D3E99]/12 bg-[#F8F9FB] p-4 flex items-center gap-3.5"
                    >
                      {hasBank && qrUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPayrollQrPayable({
                              id: `teacher_quick_${tc.id}`,
                              recordType: 'teacher_payroll',
                              recipientName: tc.fullName,
                              recipientEmail: tc.teacherEmail,
                              bankName: tc.bankName || bankCodeVal,
                              bankAccountNumber: tc.bankAccountNumber || '',
                              bankAccountHolder: tc.bankAccountHolder || tc.fullName,
                              amountVnd: tc.monthlyBaseVnd || 0,
                              dueDate: payDue,
                              status: 'scheduled',
                              notes: `Monthly payroll · ${tc.fullName}`,
                              adminUids,
                            })
                          }
                          className="w-20 h-20 rounded-xl bg-white border border-[#6B21A8]/20 p-1 shrink-0 overflow-hidden hover:ring-2 hover:ring-[#6B21A8] transition cursor-pointer"
                          title={biText(lang, 'Enlarge Teacher Payroll QR', 'Phóng to mã QR lương')}
                        >
                          <img
                            src={qrUrl}
                            alt={`Payroll QR for ${tc.fullName}`}
                            className="w-full h-full object-contain"
                          />
                        </button>
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-white border border-dashed border-[#2D3E99]/25 shrink-0 flex flex-col items-center justify-center text-center px-1 text-[10px] text-[#172154]/50">
                          <QrCode className="w-5 h-5 mb-1 text-[#2D3E99]/35" />
                          <span>{biText(lang, 'No Bank Yet', 'Chưa có TK')}</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-bold text-sm text-[#172154] truncate">{tc.fullName}</div>
                        <div className="text-[11px] text-[#172154]/65 truncate">
                          {hasBank
                            ? `${tc.bankName || bankCodeVal} · ${tc.bankAccountNumber}`
                            : biText(lang, 'Bank details not configured yet', 'Chưa nhập số tài khoản ngân hàng')}
                        </div>
                        <div className="font-mono text-xs font-extrabold text-[#6B21A8]">
                          {tc.monthlyBaseVnd > 0
                            ? `${formatVnd(tc.monthlyBaseVnd)} / mo`
                            : biText(lang, 'Salary not set', 'Chưa đặt mức lương')}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPayType('teacher_payroll');
                            setPayTeacherPick(tc.id);
                            setPayRecipient(tc.fullName);
                            setPayEmail(tc.teacherEmail);
                            setPayBankName(tc.bankName || '');
                            setPayBankNumber(tc.bankAccountNumber || '');
                            setPayBankHolder(tc.bankAccountHolder || tc.fullName);
                            setPayAmount(tc.monthlyBaseVnd || 0);
                            setPayHourlyRate(tc.hourlyRateVnd || 0);
                            setPayNotes(`Monthly payroll${tc.specialty ? ` · ${tc.specialty}` : ''}`);
                          }}
                          className="text-[11px] font-bold text-[#2D3E99] hover:underline cursor-pointer"
                        >
                          {hasBank
                            ? biText(lang, 'Load into Payroll Form →', 'Nạp vào Biểu mẫu Lương →')
                            : biText(lang, '+ Configure Bank & QR →', '+ Cài đặt Ngân hàng & QR →')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TEACHER PAYROLL VIETQR MODAL */}
      {payrollQrPayable && (() => {
        const bankCodeVal = resolveVietBankCode(payrollQrPayable.bankName);
        const memo = `LILAB PAYROLL ${payrollQrPayable.recipientName} ${payrollQrPayable.dueDate}`.trim();
        const qrImgUrl = buildVietQrImageUrl({
          bankCode: bankCodeVal,
          accountNumber: payrollQrPayable.bankAccountNumber,
          accountHolder: payrollQrPayable.bankAccountHolder || payrollQrPayable.recipientName,
          amountVnd: payrollQrPayable.amountVnd > 0 ? payrollQrPayable.amountVnd : undefined,
          memo,
        });
        const isPersistedPayable = !payrollQrPayable.id.startsWith('teacher_quick_');
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172154]/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={() => setPayrollQrPayable(null)}
          >
            <div
              className="w-full max-w-md bg-white rounded-3xl border border-[#6B21A8]/20 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-6 py-4 bg-[#6B21A8] text-white flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-purple-200 flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" />
                    {biText(lang, 'TEACHER PAYROLL VIETQR', 'MÃ VIETQR CHUYỂN KHOẢN LƯƠNG')}
                  </div>
                  <h3 className="font-display text-lg font-extrabold mt-0.5">
                    {payrollQrPayable.recipientName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPayrollQrPayable(null)}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-[#FAF5FF] border border-[#6B21A8]/15 rounded-2xl p-4 flex flex-col items-center">
                  {qrImgUrl ? (
                    <img
                      src={qrImgUrl}
                      alt={`VietQR for ${payrollQrPayable.recipientName}`}
                      className="w-60 h-60 object-contain rounded-xl bg-white p-2 border border-[#6B21A8]/15"
                    />
                  ) : (
                    <div className="py-10 text-xs text-[#172154]/60">
                      {biText(lang, 'Account number missing for QR generation.', 'Thiếu số tài khoản để tạo mã QR.')}
                    </div>
                  )}
                  <div className="mt-3 text-center">
                    <div className="text-xl font-mono font-extrabold text-[#6B21A8] tabular-nums">
                      {formatVnd(payrollQrPayable.amountVnd)}
                    </div>
                    <div className="text-[11px] text-[#172154]/65">
                      {biText(lang, 'Scan with any Vietnamese banking app (VietQR / Napas 247)', 'Quét bằng bất kỳ ứng dụng ngân hàng nào (VietQR / Napas 247)')}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs bg-[#F8F9FB] rounded-xl p-3.5 border border-[#172154]/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#172154]/60">{biText(lang, 'Bank:', 'Ngân hàng:')}</span>
                    <span className="font-bold text-[#172154]">{payrollQrPayable.bankName} ({bankCodeVal})</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#172154]/60">{biText(lang, 'Account No:', 'Số tài khoản:')}</span>
                    <button
                      type="button"
                      onClick={() => void copyText(payrollQrPayable.bankAccountNumber, 'payroll_acc')}
                      className="font-mono font-bold text-[#2D3E99] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {payrollQrPayable.bankAccountNumber}
                      {copiedId === 'payroll_acc' ? <Check className="w-3.5 h-3.5 text-[#0D9488]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#172154]/60">{biText(lang, 'Account Holder:', 'Chủ tài khoản:')}</span>
                    <span className="font-bold text-[#172154]">{payrollQrPayable.bankAccountHolder}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#172154]/60">{biText(lang, 'Transfer Memo:', 'Nội dung CK:')}</span>
                    <button
                      type="button"
                      onClick={() => void copyText(memo, 'payroll_memo')}
                      className="font-mono font-semibold text-[#172154] hover:text-[#6B21A8] inline-flex items-center gap-1 truncate max-w-[220px] cursor-pointer"
                    >
                      <span className="truncate">{memo}</span>
                      {copiedId === 'payroll_memo' ? <Check className="w-3.5 h-3.5 text-[#0D9488] shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {isPersistedPayable && payrollQrPayable.recordType !== 'academy_bank_config' && payrollQrPayable.status !== 'paid' && (
                    <button
                      type="button"
                      disabled={busyAction === `pay_status_${payrollQrPayable.id}`}
                      onClick={async () => {
                        await handleTogglePayableStatus(payrollQrPayable);
                        setPayrollQrPayable(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {biText(lang, 'Mark Payroll Paid', 'Xác nhận Đã Chi Lương')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPayrollQrPayable(null)}
                    className="px-4 py-2 rounded-xl bg-[#172154] hover:bg-[#2D3E99] text-white text-xs font-bold cursor-pointer"
                  >
                    {biText(lang, 'Close', 'Đóng')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* PAYMENT DUE REMINDER MODAL (EMAIL & ZALO TEXT MESSAGE) */}
      {reminderInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172154]/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setReminderInvoice(null)}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-3xl border-2 border-[#2D3E99]/20 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-gradient-to-r from-[#2D3E99] to-[#172154] text-white flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#FFD41D] flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5" />
                  {biText(lang, 'PAYMENT DUE REMINDER DISPATCH', 'GỬI NHẮC HỌC PHÍ QUA EMAIL & ZALO')}
                </div>
                <h3 className="font-display text-lg font-extrabold mt-0.5">
                  {reminderInvoice.invoiceNumber} · {reminderInvoice.studentName} ({formatVnd(reminderInvoice.amountVnd)})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReminderInvoice(null)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {biText(lang, 'Parent Email Address', 'Email Phụ huynh')}
                  </label>
                  <input
                    type="email"
                    value={reminderEmailTo}
                    onChange={(e) => setReminderEmailTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {biText(lang, 'Parent Zalo Phone Number', 'Số điện thoại Zalo Phụ huynh')}
                  </label>
                  <input
                    type="tel"
                    value={reminderZaloPhone}
                    onChange={(e) => setReminderZaloPhone(e.target.value)}
                    placeholder="e.g. 0901234567"
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-[#172154]">
                    {biText(lang, 'Reminder Message (Email & Zalo Text)', 'Nội dung tin nhắn nhắc học phí (Email & Zalo)')}
                  </label>
                  <button
                    type="button"
                    onClick={() => void copyText(reminderText, 'zalo_modal_msg')}
                    className="text-xs font-bold text-[#2D3E99] hover:text-[#E61E64] inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'zalo_modal_msg' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#0D9488]" />
                        <span>{biText(lang, 'Copied!', 'Đã chép!')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{biText(lang, 'Copy Text', 'Chép nội dung')}</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={10}
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#2D3E99]/20 text-xs font-mono leading-relaxed bg-[#FDF9EE]/60"
                />
              </div>

              {lastEmailResult && (
                <div className="p-3.5 rounded-xl bg-[#0D9488]/10 border border-[#0D9488]/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#0D9488]">
                    {lastEmailResult.deliveryMode === 'webhook'
                      ? biText(lang, `Delivered via SMTP to ${lastEmailResult.recipientEmail}`, `Đã gửi trực tiếp tới ${lastEmailResult.recipientEmail}`)
                      : biText(lang, `Logged in database. Launch mail client to send to ${lastEmailResult.recipientEmail}:`, `Đã ghi nhận. Bấm mở Email để gửi tới ${lastEmailResult.recipientEmail}:`)}
                  </span>
                  <a
                    href={lastEmailResult.mailtoUrl}
                    className="px-3 py-1.5 rounded-lg bg-[#2D3E99] text-white font-bold inline-flex items-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {biText(lang, 'Open Mail App', 'Mở ứng dụng Email')}
                  </a>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#2D3E99]/10">
                <button
                  type="button"
                  disabled={busyAction === 'send_email_reminder'}
                  onClick={() => void handleDispatchEmailReminder()}
                  className="px-4 py-2.5 rounded-xl bg-[#2D3E99] hover:bg-[#1f2c73] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  {busyAction === 'send_email_reminder'
                    ? biText(lang, 'Sending...', 'Đang gửi...')
                    : biText(lang, 'Send Email Reminder', 'Gửi Nhắc qua Email')}
                </button>

                <a
                  href={buildZaloDeepLink(reminderZaloPhone, activeBank.zaloHotline)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void handleLogZaloReminder()}
                  className="px-4 py-2.5 rounded-xl bg-[#0068FF] hover:bg-[#0055d4] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{biText(lang, 'Copy & Send via Zalo Text', 'Chép & Gửi Tin Nhắn Zalo')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

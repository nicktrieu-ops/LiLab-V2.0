import React, { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  GraduationCap,
  QrCode,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { biText, formatVnd } from '../i18n';
import { buildVietQrImageUrl } from '../services/bankingQr';
import { syncRecordToSql } from '../services/sqlSyncClient';
import type {
  AcademyBankConfig,
  LangCode,
  ParentPaymentMethod,
  ProgramCourse,
  StudentProfile,
  UserProfile,
} from '../types';

interface ParentCourseCheckoutModalProps {
  lang: LangCode;
  program: ProgramCourse;
  students: StudentProfile[];
  initialStudent: StudentProfile | null;
  currentUser: UserProfile;
  activeBank: AcademyBankConfig;
  savedMethods: ParentPaymentMethod[];
  initialNotes?: string;
  onClose: () => void;
  onSuccess: (summaryMsg: string, goToBilling?: boolean) => void;
}

type CheckoutPayMethod = 'qr_transfer' | 'direct_debit' | 'credit_card' | 'pay_later';

export const ParentCourseCheckoutModal: React.FC<ParentCourseCheckoutModalProps> = ({
  lang,
  program,
  students,
  initialStudent,
  currentUser,
  activeBank,
  savedMethods,
  initialNotes = '',
  onClose,
  onSuccess,
}) => {
  const [studentId, setStudentId] = useState(initialStudent?.id || students[0]?.id || '');
  const [payMethod, setPayMethod] = useState<CheckoutPayMethod>('qr_transfer');
  const [selectedSavedMethodId, setSelectedSavedMethodId] = useState('');
  const [payerBankName, setPayerBankName] = useState(savedMethods[0]?.bankName || savedMethods[0]?.providerLabel || '');
  const [payerAccountHolder, setPayerAccountHolder] = useState(
    savedMethods[0]?.accountHolderName || currentUser.displayName || ''
  );
  const [accountNumberInput, setAccountNumberInput] = useState(savedMethods[0]?.accountLast4 || '');
  const [parentPhone, setParentPhone] = useState(
    initialStudent?.parentPhone || savedMethods[0]?.parentPhone || ''
  );
  const [transferRef, setTransferRef] = useState('');
  const [saveBankingToProfile, setSaveBankingToProfile] = useState(true);
  const [enableAutoPay, setEnableAutoPay] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedStudent = students.find((s) => s.id === studentId) || initialStudent || students[0] || null;
  const invoiceNumber = useMemo(
    () => `LILAB-${Math.floor(10000 + Math.random() * 90000)}`,
    [program.id]
  );
  const transferMemo = `${invoiceNumber} ${selectedStudent?.fullName || currentUser.displayName}`.trim().slice(0, 65);

  const vietQrUrl = useMemo(
    () =>
      buildVietQrImageUrl({
        bankCode: activeBank.bankCode,
        accountNumber: activeBank.accountNumber,
        accountHolder: activeBank.accountHolder,
        amountVnd: program.tuitionVnd,
        memo: transferMemo,
      }),
    [activeBank, program.tuitionVnd, transferMemo]
  );

  const showCustomQr = Boolean(activeBank.qrImageDataUrl && activeBank.useDynamicVietQr === false);

  const copyValue = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const applySavedMethod = (pmId: string) => {
    setSelectedSavedMethodId(pmId);
    const pm = savedMethods.find((m) => m.id === pmId);
    if (!pm) return;
    setPayerBankName(pm.bankName || pm.providerLabel);
    setPayerAccountHolder(pm.accountHolderName);
    setAccountNumberInput(pm.accountNumberMasked || pm.accountLast4);
    if (pm.parentPhone) setParentPhone(pm.parentPhone);
  };

  const handleCompleteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!selectedStudent) {
      setErrorMsg(
        biText(
          lang,
          'No linked student profile found. Please ask LiLab Admin to link your child profile first.',
          'Chưa tìm thấy hồ sơ học viên liên kết. Vui lòng liên hệ văn phòng LiLab để liên kết hồ sơ bé.'
        )
      );
      return;
    }

    if ((payMethod === 'direct_debit' || payMethod === 'credit_card') && (!payerBankName.trim() || !payerAccountHolder.trim())) {
      setErrorMsg(
        biText(
          lang,
          'Please enter your bank / card provider and account holder name.',
          'Vui lòng nhập tên ngân hàng / loại thẻ và tên chủ tài khoản.'
        )
      );
      return;
    }

    setBusy(true);
    try {
      const nowIso = new Date().toISOString().slice(0, 19);
      const isPayingNow = payMethod !== 'pay_later';
      const resolvedAdminUids = selectedStudent.adminUids || [];
      const resolvedPhone = (parentPhone || selectedStudent.parentPhone || '').trim().slice(0, 40);

      // 1. Optionally save Parent's banking info into Firestore payment_methods so Admin sees it in Accounts & Banking
      if (isPayingNow && saveBankingToProfile && (payerBankName.trim() || payerAccountHolder.trim())) {
        const cleanDigits = accountNumberInput.replace(/\s+/g, '');
        const last4 = (cleanDigits.slice(-4) || '0000').slice(0, 16);
        const masked =
          cleanDigits.length > 4
            ? `${'•'.repeat(Math.min(8, cleanDigits.length - 4))}${cleanDigits.slice(-4)}`
            : `•••• ${last4}`;
        const pmId = `pm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const pmPayload: Record<string, unknown> = {
          parentUid: currentUser.uid,
          parentEmail: currentUser.email,
          methodType: payMethod,
          providerLabel: (
            payerBankName.trim() ||
            (payMethod === 'qr_transfer'
              ? 'VietQR Bank Transfer'
              : payMethod === 'credit_card'
                ? 'Visa / Mastercard'
                : 'Direct Bank Debit')
          ).slice(0, 120),
          accountLast4: last4,
          accountNumberMasked: masked.slice(0, 40),
          accountHolderName: (payerAccountHolder.trim() || currentUser.displayName || currentUser.email).slice(0, 120),
          autoPayEnabled: payMethod === 'direct_debit' ? enableAutoPay : false,
          adminUids: resolvedAdminUids,
        };
        if (payerBankName.trim()) pmPayload.bankName = payerBankName.trim().slice(0, 120);
        if (resolvedPhone) pmPayload.parentPhone = resolvedPhone;
        pmPayload.branchOrNotes = `Added during ${program.titleEn} checkout`.slice(0, 240);

        await setDoc(doc(db, 'payment_methods', pmId), {
          ...pmPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await syncRecordToSql('payment_methods', pmId, pmPayload);
      }

      // 2. Create Enrollment record (enrolled immediately if paid now, pending if pay later)
      const enrId = `enr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const noteBits = [
        notes.trim() || (isPayingNow ? `Paid immediately via ${payMethod.replace('_', ' ')}` : 'Reserved seat · Pay later'),
        program.teacherName ? `Teacher: ${program.teacherName}` : '',
        program.enrollmentDate ? `Enroll Date: ${program.enrollmentDate}` : '',
        `Invoice: ${invoiceNumber}`,
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 500);

      const enrPayload = {
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName.slice(0, 120),
        parentUid: currentUser.uid,
        parentEmail: currentUser.email,
        programId: program.id.slice(0, 128),
        programTitle: program.titleEn.slice(0, 160),
        preferredSchedule: (program.scheduleSummary || 'Weekend / Evening').slice(0, 160),
        notes: noteBits,
        status: isPayingNow ? 'enrolled' : 'pending',
        adminUids: resolvedAdminUids,
      };
      await setDoc(doc(db, 'enrollments', enrId), {
        ...enrPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('enrollments', enrId, enrPayload);

      // 3. Create Tuition Invoice immediately so Admin Accounts & Banking Dashboard sees the payment or due balance right away
      const invId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const paymentReference = isPayingNow
        ? (
            transferRef.trim() ||
            `${payMethod === 'qr_transfer' ? 'QR' : payMethod === 'direct_debit' ? 'BANK' : 'CARD'}-${invoiceNumber}`
          ).slice(0, 120)
        : undefined;

      const invPayload: Record<string, unknown> = {
        invoiceNumber,
        studentId: selectedStudent.id,
        studentName: selectedStudent.fullName.slice(0, 120),
        parentEmail: currentUser.email,
        parentUid: currentUser.uid,
        programId: program.id.slice(0, 128),
        programTitle: program.titleEn.slice(0, 160),
        amountVnd: Math.max(0, Math.round(Number(program.tuitionVnd) || 0)),
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        status: isPayingNow ? 'paid' : 'pending',
        paymentMethod: isPayingNow ? payMethod : 'unselected',
        adminUids: resolvedAdminUids,
      };
      if (resolvedPhone) invPayload.parentPhone = resolvedPhone;
      if (paymentReference) invPayload.paymentReference = paymentReference;
      if (payerBankName.trim()) invPayload.payerBankName = payerBankName.trim().slice(0, 120);
      if (payerAccountHolder.trim()) invPayload.payerAccountHolder = payerAccountHolder.trim().slice(0, 120);
      if (isPayingNow) invPayload.paidAt = nowIso;

      await setDoc(doc(db, 'invoices', invId), {
        ...invPayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await syncRecordToSql('invoices', invId, invPayload);

      onSuccess(
        isPayingNow
          ? biText(
              lang,
              `Payment confirmed (${invoiceNumber})! ${selectedStudent.fullName} is now enrolled in ${program.titleEn}.`,
              `Thanh toán thành công (${invoiceNumber})! Bé ${selectedStudent.fullName} đã chính thức ghi danh khóa ${program.titleVi || program.titleEn}.`
            )
          : biText(
              lang,
              `Seat reserved & invoice ${invoiceNumber} created for ${selectedStudent.fullName}. You can complete payment anytime in Invoices & Payment.`,
              `Đã giữ chỗ & tạo hóa đơn ${invoiceNumber} cho bé ${selectedStudent.fullName}. Ba mẹ có thể thanh toán ngay tại mục Hóa đơn & Thanh toán.`
            ),
        !isPayingNow
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'invoices');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#172154]/65 backdrop-blur-sm no-print"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] bg-[#FDF9EE] rounded-3xl border-2 border-[#2D3E99]/20 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#2D3E99] via-[#263585] to-[#172154] text-white flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#FFD41D] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {biText(lang, 'INSTANT COURSE ENROLLMENT & PAYMENT', 'ĐĂNG KÝ & THANH TOÁN KHÓA HỌC NGAY')}
            </div>
            <h3 className="font-display text-lg sm:text-xl font-extrabold mt-0.5 leading-snug">
              {lang === 'vi' ? program.titleVi || program.titleEn : program.titleEn}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCompleteCheckout} className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
          {/* Course & Student Summary Bar */}
          <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-extrabold text-[#2D3E99] bg-[#2D3E99]/8 px-2 py-0.5 rounded-md">
                  {program.code}
                </span>
                {program.teacherName && (
                  <span className="inline-flex items-center gap-1 text-[#172154]/80 font-semibold">
                    <GraduationCap className="w-3.5 h-3.5 text-[#2D3E99]" />
                    {program.teacherName}
                  </span>
                )}
                {program.enrollmentDate && (
                  <span className="inline-flex items-center gap-1 text-[#172154]/80">
                    <Calendar className="w-3.5 h-3.5 text-[#E61E64]" />
                    {program.enrollmentDate}
                  </span>
                )}
                {program.maxClassSize && (
                  <span className="inline-flex items-center gap-1 text-[#172154]/80">
                    <Users className="w-3.5 h-3.5 text-[#0D9488]" />
                    Max {program.maxClassSize}
                  </span>
                )}
              </div>
              {students.length > 1 ? (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-[#172154]/70">
                    {biText(lang, 'Student:', 'Chọn bé:')}
                  </span>
                  <select
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-[#2D3E99]/20 text-xs font-bold bg-[#FDF9EE]"
                  >
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.fullName} ({st.cefrLevel})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-xs text-[#172154]/75">
                  {biText(lang, 'Enrolling Student:', 'Học viên:')}{' '}
                  <strong className="text-[#2D3E99]">{selectedStudent?.fullName || '—'}</strong>
                </div>
              )}
            </div>

            <div className="text-right">
              <div className="text-[11px] font-bold uppercase text-[#172154]/55">
                {biText(lang, 'Total Tuition Due', 'Tổng học phí')}
              </div>
              <div className="font-display text-2xl font-extrabold text-[#E61E64] tabular-nums">
                {formatVnd(program.tuitionVnd)}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#E61E64]/10 border border-[#E61E64]/30 text-xs font-bold text-[#b0134a]">
              {errorMsg}
            </div>
          )}

          {/* Step 1: Payment Method Tabs */}
          <div className="space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#2D3E99]">
              {biText(lang, 'Choose How You Want to Pay Now', 'Chọn Phương Thức Thanh Toán Ngay')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                {
                  id: 'qr_transfer' as const,
                  label: biText(lang, 'Pay by LiLab QR', 'Quét Mã QR LiLab'),
                  icon: <QrCode className="w-4 h-4" />,
                },
                {
                  id: 'direct_debit' as const,
                  label: biText(lang, 'Bank / Direct Debit', 'Tài khoản Ngân hàng'),
                  icon: <Building2 className="w-4 h-4" />,
                },
                {
                  id: 'credit_card' as const,
                  label: biText(lang, 'Credit / Debit Card', 'Thẻ Tín dụng / Ghi nợ'),
                  icon: <CreditCard className="w-4 h-4" />,
                },
                {
                  id: 'pay_later' as const,
                  label: biText(lang, 'Reserve & Pay Later', 'Giữ chỗ · TT Sau'),
                  icon: <Clock className="w-4 h-4" />,
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPayMethod(opt.id)}
                  className={`p-3 rounded-xl border-2 text-xs font-bold flex flex-col items-center gap-1.5 text-center transition-all cursor-pointer ${
                    payMethod === opt.id
                      ? 'bg-[#2D3E99] text-white border-[#2D3E99] shadow-sm'
                      : 'bg-white text-[#172154] border-[#2D3E99]/15 hover:border-[#2D3E99]/40'
                  }`}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Option A: Live LiLab QR Payment Panel */}
          {payMethod === 'qr_transfer' && (
            <div className="bg-white border-2 border-[#0D9488]/30 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-5 flex flex-col items-center text-center space-y-2">
                {showCustomQr && activeBank.qrImageDataUrl ? (
                  <img
                    src={activeBank.qrImageDataUrl}
                    alt="LiLab Official Payment QR"
                    className="w-52 h-52 object-contain rounded-xl border border-[#2D3E99]/15 p-2 bg-white shadow-sm"
                  />
                ) : vietQrUrl ? (
                  <img
                    src={vietQrUrl}
                    alt="LiLab VietQR Payment Code"
                    className="w-52 h-auto object-contain rounded-xl border border-[#2D3E99]/15 p-2 bg-white shadow-sm"
                  />
                ) : null}
                <span className="text-[11px] font-bold text-[#0D9488]">
                  {biText(lang, 'Scan with any Vietnam Banking App', 'Quét bằng mọi ứng dụng Ngân hàng Việt Nam')}
                </span>
              </div>

              <div className="md:col-span-7 space-y-3">
                <div className="p-3.5 rounded-xl bg-[#FDF9EE] border border-[#2D3E99]/12 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#172154]/60">{biText(lang, 'Bank:', 'Ngân hàng:')}</span>
                    <strong className="text-[#2D3E99]">{activeBank.bankName}</strong>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[#172154]/60">{biText(lang, 'Account #:', 'Số TK:')}</span>
                    <button
                      type="button"
                      onClick={() => void copyValue(activeBank.accountNumber, 'acc')}
                      className="inline-flex items-center gap-1 font-mono font-extrabold text-[#172154] hover:text-[#E61E64] cursor-pointer"
                    >
                      <span>{activeBank.accountNumber}</span>
                      {copiedKey === 'acc' ? <Check className="w-3.5 h-3.5 text-[#0D9488]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#172154]/60">{biText(lang, 'Holder:', 'Chủ TK:')}</span>
                    <strong className="text-[#172154] text-right">{activeBank.accountHolder}</strong>
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-1 border-t border-[#2D3E99]/10">
                    <span className="text-[#172154]/60">{biText(lang, 'Transfer Memo:', 'Nội dung CK:')}</span>
                    <button
                      type="button"
                      onClick={() => void copyValue(transferMemo, 'memo')}
                      className="inline-flex items-center gap-1 font-mono font-bold text-[#E61E64] cursor-pointer text-right"
                    >
                      <span className="truncate max-w-[180px]">{transferMemo}</span>
                      {copiedKey === 'memo' ? <Check className="w-3.5 h-3.5 text-[#0D9488]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#172154] mb-1">
                      {biText(lang, 'Your Bank Name', 'Ngân hàng chuyển khoản')}
                    </label>
                    <input
                      type="text"
                      value={payerBankName}
                      onChange={(e) => setPayerBankName(e.target.value)}
                      placeholder="e.g. Vietcombank, Techcombank"
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#172154] mb-1">
                      {biText(lang, 'Transfer Ref / Transaction Code', 'Mã giao dịch / Tham chiếu')}
                    </label>
                    <input
                      type="text"
                      value={transferRef}
                      onChange={(e) => setTransferRef(e.target.value)}
                      placeholder={`QR-${invoiceNumber}`}
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-[#172154] mb-1">
                      {biText(lang, 'Sender Name', 'Tên người chuyển')}
                    </label>
                    <input
                      type="text"
                      value={payerAccountHolder}
                      onChange={(e) => setPayerAccountHolder(e.target.value)}
                      placeholder="Account Holder"
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#172154] mb-1">
                      {biText(lang, 'Zalo Phone (Receipt & Updates)', 'SĐT Zalo nhận xác nhận')}
                    </label>
                    <input
                      type="tel"
                      value={parentPhone}
                      onChange={(e) => setParentPhone(e.target.value)}
                      placeholder="0901234567"
                      className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Option B / C: Bank Direct Debit or Credit Card */}
          {(payMethod === 'direct_debit' || payMethod === 'credit_card') && (
            <div className="bg-white border border-[#2D3E99]/18 rounded-2xl p-5 space-y-3.5">
              {savedMethods.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#2D3E99] mb-1">
                    {biText(lang, 'Use Saved Parent Banking Profile', 'Chọn Tài khoản đã lưu')}
                  </label>
                  <select
                    value={selectedSavedMethodId}
                    onChange={(e) => applySavedMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs bg-[#FDF9EE]"
                  >
                    <option value="">{biText(lang, '-- Enter new banking details --', '-- Nhập tài khoản mới --')}</option>
                    {savedMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>
                        {pm.bankName || pm.providerLabel} · {pm.accountHolderName} ({pm.accountNumberMasked || `•••• ${pm.accountLast4}`})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {payMethod === 'credit_card'
                      ? biText(lang, 'Card Network / Bank *', 'Loại Thẻ / Ngân hàng phát hành *')
                      : biText(lang, 'Bank Name *', 'Tên Ngân hàng *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={payerBankName}
                    onChange={(e) => setPayerBankName(e.target.value)}
                    placeholder={payMethod === 'credit_card' ? 'Visa / Mastercard (Vietcombank)' : 'Vietcombank / Techcombank / MB'}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {biText(lang, 'Account / Card Holder Name *', 'Tên Chủ Tài khoản / Chủ Thẻ *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={payerAccountHolder}
                    onChange={(e) => setPayerAccountHolder(e.target.value)}
                    placeholder="NGUYEN VAN A"
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {payMethod === 'credit_card'
                      ? biText(lang, 'Last 4 Card Digits *', '4 số cuối Thẻ *')
                      : biText(lang, 'Bank Account Number (Stored Masked) *', 'Số Tài khoản (lưu ẩn 4 số cuối) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumberInput}
                    onChange={(e) => setAccountNumberInput(e.target.value)}
                    placeholder={payMethod === 'credit_card' ? '4242' : '1028869900'}
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#172154] mb-1">
                    {biText(lang, 'Parent Zalo Phone Number', 'Số Zalo Phụ huynh')}
                  </label>
                  <input
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#172154]">
                  <input
                    type="checkbox"
                    checked={saveBankingToProfile}
                    onChange={(e) => setSaveBankingToProfile(e.target.checked)}
                    className="rounded"
                  />
                  <span>
                    {biText(
                      lang,
                      'Save banking profile to LiLab database for faster tuition payments',
                      'Lưu thông tin ngân hàng vào hệ thống LiLab cho các kỳ học phí sau'
                    )}
                  </span>
                </label>
                {payMethod === 'direct_debit' && (
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-[#0D9488]">
                    <input
                      type="checkbox"
                      checked={enableAutoPay}
                      onChange={(e) => setEnableAutoPay(e.target.checked)}
                      className="rounded"
                    />
                    <span>{biText(lang, 'Enable Auto-Pay on due dates', 'Bật trích nợ tự động')}</span>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Option D: Reserve & Pay Later */}
          {payMethod === 'pay_later' && (
            <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-4 space-y-2.5 text-xs text-[#172154]/80">
              <p className="font-semibold text-[#2D3E99]">
                {biText(
                  lang,
                  `A pending invoice (${invoiceNumber}) for ${formatVnd(program.tuitionVnd)} will be generated immediately with a 7-day due date.`,
                  `Hệ thống sẽ tạo ngay hóa đơn chờ thanh toán (${invoiceNumber}) trị giá ${formatVnd(program.tuitionVnd)} với hạn thanh toán 7 ngày.`
                )}
              </p>
              <div>
                <label className="block text-[11px] font-bold text-[#172154] mb-1">
                  {biText(lang, 'Parent Zalo Phone (for payment reminders)', 'SĐT Zalo nhận thông báo học phí')}
                </label>
                <input
                  type="tel"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="0901234567"
                  className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-bold text-[#172154] mb-1">
              {biText(lang, 'Optional Enrollment Note', 'Ghi chú đăng ký (tùy chọn)')}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={biText(lang, 'Preferred class days, sibling note, or questions...', 'Lịch học mong muốn, lưu ý về bé...')}
              className="w-full px-3 py-2 rounded-lg border border-[#2D3E99]/20 bg-white text-xs"
            />
          </div>

          {/* Submit Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#2D3E99]/12">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#2D3E99]/20 text-[#172154] text-xs font-bold cursor-pointer"
            >
              {biText(lang, 'Cancel', 'Hủy')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-6 py-3 rounded-xl bg-[#E61E64] hover:bg-[#c81655] text-white text-sm font-extrabold flex items-center gap-2 shadow-md cursor-pointer transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {busy
                ? biText(lang, 'Processing...', 'Đang xử lý...')
                : payMethod === 'qr_transfer'
                  ? biText(lang, `Confirm QR Payment (${formatVnd(program.tuitionVnd)}) & Enroll`, `Xác nhận Đã Chuyển Khoản QR (${formatVnd(program.tuitionVnd)})`)
                  : payMethod === 'pay_later'
                    ? biText(lang, 'Reserve Seat & Generate Invoice', 'Giữ Chỗ & Tạo Hóa Đơn')
                    : biText(lang, `Pay ${formatVnd(program.tuitionVnd)} & Enroll Immediately`, `Thanh Toán ${formatVnd(program.tuitionVnd)} & Ghi Danh Ngay`)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

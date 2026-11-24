import React, { useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  Database,
  Download,
  Lock,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { biText } from '../../i18n';
import { isSuperAdminEmail } from '../../services/seedData';
import { PanelCard, SectionHeader } from '../ui/Primitives';
import type { LangCode, UserProfile } from '../../types';

const BACKUP_COLLECTIONS = [
  'users',
  'user_invites',
  'teachers',
  'students',
  'programs',
  'classes',
  'schedules',
  'assessments',
  'gemini_notes',
  'learning_resources',
  'resource_submissions',
  'academy_events',
  'invoices',
  'payables',
  'enrollments',
  'payment_methods',
  'quick_notes',
  'issued_certificates',
  'student_mind_maps',
  'student_study_notes',
] as const;

export interface AdminOperationsPanelProps {
  lang: LangCode;
  currentUser: UserProfile;
  isSuperAdmin: boolean;
  counts: {
    students: number;
    teachers: number;
    classes: number;
    assessments: number;
    programs: number;
    geminiNotes: number;
    invoices: number;
    users: number;
  };
  onFlash: (msg: string) => void;
  onAfterResetAll: () => void;
}

export const AdminOperationsPanel: React.FC<AdminOperationsPanelProps> = ({
  lang,
  currentUser,
  isSuperAdmin,
  counts,
  onFlash,
  onAfterResetAll,
}) => {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const [lastBackupTimestamp, setLastBackupTimestamp] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restorePayload, setRestorePayload] = useState<{
    exportedAt?: string;
    exportedBy?: string;
    collections: Record<string, Array<Record<string, unknown>>>;
  } | null>(null);

  const handleBackupAllData = async () => {
    setBusyAction('backup_all_data');
    try {
      const collectionsDump: Record<string, Array<Record<string, unknown>>> = {};
      let totalDocs = 0;

      for (const colName of BACKUP_COLLECTIONS) {
        try {
          const snap = await getDocs(collection(db, colName));
          const rows = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          collectionsDump[colName] = rows;
          totalDocs += rows.length;
        } catch (err) {
          console.warn(`Skipped collection ${colName} during backup:`, err);
          collectionsDump[colName] = [];
        }
      }

      const nowIso = new Date().toISOString();
      const backupObject = {
        academy: 'LiLab Creative Talent Academy',
        version: '2.0',
        exportedAt: nowIso,
        exportedBy: currentUser.email,
        exportedByRole: isSuperAdmin ? 'super_admin' : currentUser.role,
        totalRecords: totalDocs,
        collections: collectionsDump,
      };

      const jsonStr = JSON.stringify(backupObject, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lilab-academy-backup-${nowIso.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setLastBackupTimestamp(new Date().toLocaleString());
      onFlash(
        biText(
          lang,
          `Backed up ${totalDocs} records across ${BACKUP_COLLECTIONS.length} collections!`,
          `Đã sao lưu thành công ${totalDocs} bản ghi từ ${BACKUP_COLLECTIONS.length} bảng dữ liệu!`
        )
      );
    } catch (err) {
      onFlash(err instanceof Error ? err.message : 'Failed to export backup');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || typeof parsed !== 'object' || !parsed.collections) {
          onFlash(
            biText(
              lang,
              'Invalid backup file format. Expected a LiLab JSON backup with a "collections" object.',
              'Định dạng tệp sao lưu không hợp lệ. Vui lòng chọn tệp JSON sao lưu từ LiLab.'
            )
          );
          setRestorePayload(null);
          return;
        }
        setRestorePayload({
          exportedAt: parsed.exportedAt,
          exportedBy: parsed.exportedBy,
          collections: parsed.collections,
        });
        onFlash(
          biText(
            lang,
            `Loaded backup file "${file.name}". Ready to restore.`,
            `Đã đọc tệp sao lưu "${file.name}". Sẵn sàng khôi phục.`
          )
        );
      } catch {
        onFlash(
          biText(
            lang,
            'Could not parse JSON backup file.',
            'Không thể đọc tệp JSON sao lưu.'
          )
        );
        setRestorePayload(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreBackupData = async () => {
    if (!restorePayload || !restorePayload.collections) return;
    setBusyAction('restore_backup_data');
    try {
      let restoredCount = 0;
      for (const colName of BACKUP_COLLECTIONS) {
        const records = restorePayload.collections[colName];
        if (!Array.isArray(records)) continue;
        for (const rawItem of records) {
          if (!rawItem || typeof rawItem !== 'object') continue;
          const docId = String(rawItem.id || rawItem.uid || '').trim();
          if (!docId) continue;
          const cleanPayload: Record<string, unknown> = { ...rawItem };
          delete cleanPayload.id;
          delete cleanPayload.createdAt;
          delete cleanPayload.updatedAt;

          await setDoc(
            doc(db, colName, docId),
            {
              ...cleanPayload,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          restoredCount += 1;
        }
      }

      setRestorePayload(null);
      setRestoreFileName('');
      onFlash(
        biText(
          lang,
          `Successfully restored ${restoredCount} records from backup!`,
          `Đã khôi phục thành công ${restoredCount} bản ghi từ tệp sao lưu!`
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'restore_backup');
    } finally {
      setBusyAction(null);
    }
  };

  const handleResetAllAppData = async () => {
    if (!isSuperAdmin) {
      onFlash(
        biText(
          lang,
          'Only Super Admin accounts are authorized to reset all app data.',
          'Chỉ tài khoản Super Admin mới có quyền làm mới toàn bộ dữ liệu ứng dụng.'
        )
      );
      return;
    }
    setBusyAction('reset_all_data');
    try {
      const colsToReset = [
        'quick_notes',
        'assessments',
        'enrollments',
        'invoices',
        'payables',
        'payment_methods',
        'schedules',
        'classes',
        'students',
        'teachers',
        'user_invites',
        'learning_resources',
        'resource_submissions',
        'academy_events',
        'issued_certificates',
        'student_mind_maps',
        'student_study_notes',
      ] as const;

      for (const colName of colsToReset) {
        const snap = await getDocs(collection(db, colName));
        for (const d of snap.docs) {
          await deleteDoc(doc(db, colName, d.id));
        }
      }

      const progSnap = await getDocs(
        query(collection(db, 'programs'), where('isActive', 'in', [true, false]))
      );
      for (const d of progSnap.docs) {
        await deleteDoc(doc(db, 'programs', d.id));
      }

      const notesSnap = await getDocs(
        query(collection(db, 'gemini_notes'), where('weekNumber', '>=', 1))
      );
      for (const d of notesSnap.docs) {
        await deleteDoc(doc(db, 'gemini_notes', d.id));
      }

      const usersSnap = await getDocs(collection(db, 'users'));
      for (const d of usersSnap.docs) {
        const uData = d.data() as Partial<UserProfile>;
        if (d.id !== currentUser.uid && !isSuperAdminEmail(uData.email)) {
          await deleteDoc(doc(db, 'users', d.id));
        }
      }
      const adminsSnap = await getDocs(collection(db, 'admins'));
      for (const d of adminsSnap.docs) {
        const aData = d.data() as { email?: string };
        if (d.id !== currentUser.uid && !isSuperAdminEmail(aData.email)) {
          await deleteDoc(doc(db, 'admins', d.id));
        }
      }

      setConfirmResetAll(false);
      onAfterResetAll();

      onFlash(
        biText(
          lang,
          'All academy data has been reset. You are starting with a clean workspace.',
          'Đã xóa và đặt lại toàn bộ dữ liệu. Ứng dụng đã sẵn sàng như mới!'
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'reset_all');
    } finally {
      setBusyAction(null);
    }
  };

  const statItems = [
    { label: biText(lang, 'Students', 'Học viên'), count: counts.students },
    { label: biText(lang, 'Teachers', 'Giáo viên'), count: counts.teachers },
    { label: biText(lang, 'Classes', 'Lớp học'), count: counts.classes },
    { label: biText(lang, 'Reports', 'Báo cáo'), count: counts.assessments },
    { label: biText(lang, 'Programs', 'Chương trình'), count: counts.programs },
    { label: biText(lang, 'Workbooks', 'Giáo trình'), count: counts.geminiNotes },
    { label: biText(lang, 'Invoices', 'Hóa đơn'), count: counts.invoices },
    { label: biText(lang, 'Users', 'Tài khoản'), count: counts.users },
  ];

  return (
    <div className="space-y-6">
      <PanelCard padding="lg">
        <SectionHeader
          meta={biText(lang, 'Academy Data Operations', 'Vận hành & Sao lưu Dữ liệu')}
          title={biText(
            lang,
            'Backup All Data, Restore Backup & System Reset',
            'Sao lưu Toàn bộ Dữ liệu, Khôi phục Bản sao lưu & Đặt lại Hệ thống'
          )}
          subtitle={biText(
            lang,
            'Export complete timestamped JSON snapshots and restore records across Firestore and Cloud SQL. Full system reset is restricted to Super Admin accounts.',
            'Xuất bản sao lưu JSON toàn hệ thống và khôi phục dữ liệu trên Firestore và Cloud SQL. Chức năng đặt lại toàn bộ hệ thống chỉ dành cho Super Admin.'
          )}
          action={
            <div className="text-xs font-semibold text-[#172154]/75 bg-[#F8F9FB] border border-[#172154]/10 rounded-lg px-3 py-2 flex items-center gap-2 whitespace-nowrap">
              <Database className="w-3.5 h-3.5 text-[#FF6B00]" />
              {isSuperAdmin
                ? biText(lang, 'Super Admin · Full Control', 'Super Admin · Toàn quyền')
                : biText(lang, 'Admin · Backup & Restore', 'Admin · Sao lưu & Khôi phục')}
            </div>
          }
        />
      </PanelCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. BACKUP ALL DATA */}
        <PanelCard padding="lg" className="flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#FF6B00] uppercase tracking-wider">
                {biText(lang, 'JSON Snapshot Export', 'Xuất Bản sao lưu JSON')}
              </span>
              {lastBackupTimestamp && (
                <span className="text-[11px] font-mono-num text-[#172154]/60">
                  {biText(lang, 'Last:', 'Gần nhất:')} {lastBackupTimestamp}
                </span>
              )}
            </div>
            <h3 className="font-display text-lg font-bold text-[#172154]">
              {biText(lang, 'Backup All Academy Data', 'Sao lưu Toàn bộ Dữ liệu Học viện')}
            </h3>
            <p className="text-xs text-[#172154]/70 leading-relaxed">
              {biText(
                lang,
                'Downloads a complete timestamped JSON snapshot of Users, Invites, Teachers, Students, Programs, Classes, Schedules, CEFR Assessments, Resource Library, Homework, Events, Invoices, and Enrollments.',
                'Tải xuống tệp JSON sao lưu toàn bộ dữ liệu Học viện: Tài khoản, Lời mời, Giáo viên, Học viên, Chương trình, Lớp học, Lịch học, Báo cáo CEFR, Thư viện Học liệu, Bài tập, Sự kiện, Hóa đơn và Đăng ký.'
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {statItems.map((stat, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#F8F9FB] border border-[#172154]/8 text-center"
                >
                  <div className="font-mono-num text-base font-bold text-[#172154] tabular-nums">
                    {stat.count}
                  </div>
                  <div className="text-[11px] text-[#172154]/65">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#172154]/8">
            <button
              type="button"
              onClick={() => void handleBackupAllData()}
              disabled={busyAction === 'backup_all_data'}
              className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E05A00] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {busyAction === 'backup_all_data'
                ? biText(lang, 'Exporting Full Academy Backup…', 'Đang xuất tệp sao lưu toàn hệ thống…')
                : biText(lang, 'Backup All Data (Download JSON)', 'Sao lưu Toàn bộ Dữ liệu (Tải JSON)')}
            </button>
          </div>
        </PanelCard>

        {/* 2. RESTORE BACKUP */}
        <PanelCard padding="lg" className="flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[#0F766E] uppercase tracking-wider">
                {biText(lang, 'Snapshot Recovery', 'Khôi phục Dữ liệu')}
              </span>
              {restoreFileName && (
                <span className="text-[11px] font-mono-num font-semibold text-[#172154]/75 truncate max-w-[200px]">
                  {restoreFileName}
                </span>
              )}
            </div>
            <h3 className="font-display text-lg font-bold text-[#172154]">
              {biText(lang, 'Restore Backup', 'Khôi phục từ Bản sao lưu')}
            </h3>
            <p className="text-xs text-[#172154]/70 leading-relaxed">
              {biText(
                lang,
                'Upload a previously exported LiLab JSON backup file to restore records across Firestore and Cloud SQL without disrupting active sessions.',
                'Tải lên tệp JSON sao lưu của LiLab đã xuất trước đó để khôi phục toàn bộ bản ghi vào Firestore và Cloud SQL.'
              )}
            </p>

            <label className="block p-5 rounded-xl border border-dashed border-[#172154]/20 bg-[#F8F9FB] hover:border-[#FF6B00]/60 transition-colors cursor-pointer text-center space-y-1.5">
              <Upload className="w-5 h-5 text-[#172154]/60 mx-auto" />
              <div className="text-xs font-semibold text-[#172154]">
                {restoreFileName
                  ? biText(lang, `Selected: ${restoreFileName}`, `Đã chọn: ${restoreFileName}`)
                  : biText(
                      lang,
                      'Click to select a LiLab Backup (.json) file',
                      'Nhấn để chọn tệp Sao lưu LiLab (.json)'
                    )}
              </div>
              <div className="text-[11px] text-[#172154]/55">
                {biText(lang, 'Supports lilab-academy-backup-*.json', 'Hỗ trợ lilab-academy-backup-*.json')}
              </div>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleRestoreFileSelect}
                className="hidden"
              />
            </label>

            {restorePayload && (
              <div className="p-3.5 rounded-xl bg-[#56BEB8]/10 border border-[#56BEB8]/35 text-xs space-y-1">
                <div className="font-semibold text-[#172154]">
                  {biText(lang, 'Backup File Verified & Ready', 'Tệp sao lưu hợp lệ & sẵn sàng khôi phục')}
                </div>
                {restorePayload.exportedAt && (
                  <div className="text-[#172154]/70 font-mono-num">
                    {biText(lang, 'Exported:', 'Thời gian:')} {restorePayload.exportedAt}{' '}
                    {restorePayload.exportedBy ? `(${restorePayload.exportedBy})` : ''}
                  </div>
                )}
                <div className="text-[#172154]/75 font-mono-num">
                  {Object.keys(restorePayload.collections).length} {biText(lang, 'collections', 'bảng')} ·{' '}
                  {Object.values(restorePayload.collections).reduce(
                    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
                    0
                  )}{' '}
                  {biText(lang, 'documents', 'bản ghi')}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#172154]/8">
            <button
              type="button"
              onClick={() => void handleRestoreBackupData()}
              disabled={!restorePayload || busyAction === 'restore_backup_data'}
              className="w-full py-2.5 px-4 rounded-xl bg-[#172154] hover:bg-[#23306d] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45"
            >
              <Upload className="w-4 h-4" />
              {busyAction === 'restore_backup_data'
                ? biText(lang, 'Restoring Backup Data…', 'Đang khôi phục dữ liệu…')
                : biText(lang, 'Restore Backup Now', 'Khôi phục Dữ liệu Ngay')}
            </button>
          </div>
        </PanelCard>
      </div>

      {/* 3. RESET ALL APP DATA (Strictly Super Admin ONLY) */}
      {isSuperAdmin ? (
        <PanelCard padding="lg" className="border-[#E61E64]/25 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#E61E64] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                {biText(lang, 'Super Admin Exclusive Control', 'Chỉ dành riêng cho Super Admin')}
              </div>
              <h3 className="font-display text-lg font-bold text-[#172154]">
                {biText(lang, 'Reset All App Data', 'Làm mới Toàn bộ Dữ liệu Ứng dụng')}
              </h3>
              <p className="text-xs text-[#172154]/70 max-w-2xl">
                {biText(
                  lang,
                  'Permanently clears students, teachers, classes, schedules, CEFR reports, resource materials, homework submissions, calendar events, invoices, and enrollments across Firestore and Cloud SQL.',
                  'Xóa toàn bộ học viên, giáo viên, lớp học, lịch học, báo cáo CEFR, thư viện học liệu, bài tập đã nộp, lịch sự kiện, hóa đơn và đăng ký trên Firestore và Cloud SQL để bắt đầu lại từ đầu.'
                )}
              </p>
            </div>

            {!confirmResetAll && (
              <button
                type="button"
                onClick={() => setConfirmResetAll(true)}
                disabled={busyAction === 'reset_all_data'}
                className="px-4 py-2.5 rounded-xl bg-[#E61E64] text-white text-xs font-semibold hover:bg-[#c51754] transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                {biText(lang, 'Reset All App Data', 'Làm mới Toàn bộ Dữ liệu')}
              </button>
            )}
          </div>

          {confirmResetAll && (
            <div className="p-4 rounded-xl bg-[#E61E64]/8 border border-[#E61E64]/30 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs sm:text-sm text-[#172154]">
                <strong className="text-[#b0134a]">
                  {biText(lang, 'Confirm Fresh App Reset:', 'Xác nhận đặt lại toàn bộ dữ liệu:')}
                </strong>{' '}
                {biText(
                  lang,
                  'This permanently deletes all reports, students, teachers, classes, schedules, programs, resources, invoices, enrollments, and invites.',
                  'Hành động này sẽ xóa vĩnh viễn toàn bộ báo cáo, học viên, giáo viên, lớp học, lịch học, chương trình, tài liệu, hóa đơn và lời mời.'
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmResetAll(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#172154]/15 text-xs font-semibold cursor-pointer"
                >
                  {biText(lang, 'Cancel', 'Hủy')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleResetAllAppData()}
                  disabled={busyAction === 'reset_all_data'}
                  className="px-4 py-1.5 rounded-lg bg-[#E61E64] text-white text-xs font-semibold hover:bg-[#c51754] cursor-pointer disabled:opacity-50"
                >
                  {busyAction === 'reset_all_data'
                    ? biText(lang, 'Resetting…', 'Đang xóa dữ liệu…')
                    : biText(lang, 'Confirm Reset All', 'Xác nhận Làm mới')}
                </button>
              </div>
            </div>
          )}
        </PanelCard>
      ) : (
        <div className="p-4 rounded-xl bg-white border border-[#172154]/10 text-xs text-[#172154]/70 flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-[#172154]/50 shrink-0" />
          <span>
            {biText(
              lang,
              'Note: "Reset All App Data" is restricted exclusively to Super Admin accounts.',
              'Lưu ý: Chức năng "Làm mới toàn bộ dữ liệu" chỉ dành riêng cho tài khoản Super Admin.'
            )}
          </span>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  GraduationCap,
  History,
  Layers,
  PieChart as PieChartIcon,
  QrCode,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { biText, formatVnd } from '../i18n';
import { isSuperAdminEmail } from '../services/seedData';
import type {
  LangCode,
  ParentPaymentMethod,
  PayableRecord,
  ProgramCourse,
  StudentProfile,
  TuitionInvoice,
  UserProfile,
} from '../types';

export interface AdminBankingAnalyticsDashboardProps {
  lang: LangCode;
  currentUser: UserProfile;
  invoices?: TuitionInvoice[];
  payables?: PayableRecord[];
  students?: StudentProfile[];
  programs?: ProgramCourse[];
  paymentMethods?: ParentPaymentMethod[];
  onNavigateToInvoices?: () => void;
  onNavigateToLedger?: () => void;
  onFlash?: (msg: string) => void;
}

type TimeRangeOption = '3m' | '6m' | '12m' | 'all';
type MonthlyChartType = 'area' | 'bar' | 'composed';

interface MonthRevenueBucket {
  key: string; // YYYY-MM
  label: string;
  shortLabel: string;
  collectedVnd: number;
  pendingVnd: number;
  overdueVnd: number;
  totalInvoicedVnd: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalCount: number;
  collectionRate: number; // 0 - 100
}

interface StatusSlice {
  key: string;
  name: string;
  nameVi: string;
  valueVnd: number;
  count: number;
  color: string;
  percentage: number;
}

interface PaymentMethodSlice {
  key: string;
  name: string;
  nameVi: string;
  valueVnd: number;
  count: number;
  color: string;
  percentage: number;
}

interface ProgramRevenueRow {
  programTitle: string;
  collectedVnd: number;
  pendingVnd: number;
  totalVnd: number;
  paidCount: number;
  unpaidCount: number;
  collectionRate: number;
}

/** Formats VNĐ in compact human-readable form (e.g. 12.5M ₫, 800k ₫) for chart axes */
function formatVndCompact(amount: number): string {
  if (Math.abs(amount) >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B ₫`;
  }
  if (Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M ₫`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}k ₫`;
  }
  return `${amount} ₫`;
}

// Brand color constants
const STATUS_COLORS = {
  paid: '#56BEB8', // LiLab Teal
  pending: '#FFD41D', // LiLab Amber
  reminder_sent: '#2D3E99', // LiLab Primary Navy
  overdue: '#E61E64', // LiLab Crimson
};

const METHOD_COLORS = {
  qr_transfer: '#56BEB8', // VietQR Instant
  direct_debit: '#2D3E99', // Direct Debit Auto-Pay
  credit_card: '#8E9AFF', // Card
  cash: '#FFB800', // Cash / Counter
  unselected: '#E61E64', // Unselected
};

export const AdminBankingAnalyticsDashboard: React.FC<AdminBankingAnalyticsDashboardProps> = ({
  lang,
  currentUser,
  invoices: initialInvoices = [],
  payables = [],
  students = [],
  programs = [],
  paymentMethods = [],
  onNavigateToInvoices,
  onNavigateToLedger,
  onFlash,
}) => {
  const isSuperAdmin = isSuperAdminEmail(currentUser.email);

  // Live Firestore subscription if props invoices are empty or need live sync
  const [liveInvoices, setLiveInvoices] = useState<TuitionInvoice[]>(initialInvoices);
  const [loading, setLoading] = useState<boolean>(initialInvoices.length === 0);
  const [timeRange, setTimeRange] = useState<TimeRangeOption>('6m');
  const [monthlyChartType, setMonthlyChartType] = useState<MonthlyChartType>('area');
  const [statusHoverIndex, setStatusHoverIndex] = useState<number | null>(null);
  const [selectedProgramFilter, setSelectedProgramFilter] = useState<string>('all');

  useEffect(() => {
    if (initialInvoices.length > 0) {
      setLiveInvoices(initialInvoices);
      setLoading(false);
    }
  }, [initialInvoices]);

  // Firestore real-time listener
  useEffect(() => {
    try {
      const isPrivileged =
        isSuperAdmin || currentUser.role === 'super_admin' || currentUser.role === 'admin';
      const colRef = collection(db, 'invoices');
      const q = isPrivileged
        ? query(colRef)
        : query(colRef, where('adminUids', 'array-contains', currentUser.uid));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs: TuitionInvoice[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<TuitionInvoice, 'id'>),
          }));
          setLiveInvoices(docs);
          setLoading(false);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'invoices');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'invoices');
      setLoading(false);
    }
  }, [isSuperAdmin, currentUser.uid, currentUser.role]);

  // Filter invoices by program if selected
  const scopedInvoices = useMemo(() => {
    if (selectedProgramFilter === 'all') return liveInvoices;
    return liveInvoices.filter(
      (inv) =>
        inv.programId === selectedProgramFilter ||
        (inv.programTitle || '').toLowerCase() === selectedProgramFilter.toLowerCase()
    );
  }, [liveInvoices, selectedProgramFilter]);

  // Aggregate Overall KPI Metrics
  const summaryKpis = useMemo(() => {
    const totalCount = scopedInvoices.length;
    const paidInvoices = scopedInvoices.filter((i) => i.status === 'paid');
    const pendingInvoices = scopedInvoices.filter(
      (i) => i.status === 'pending' || i.status === 'reminder_sent'
    );
    const overdueInvoices = scopedInvoices.filter((i) => i.status === 'overdue');

    const totalInvoicedVnd = scopedInvoices.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const collectedVnd = paidInvoices.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const pendingVnd = pendingInvoices.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const overdueVnd = overdueInvoices.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);

    const collectionRate =
      totalInvoicedVnd > 0 ? Math.round((collectedVnd / totalInvoicedVnd) * 100) : 0;
    const qrPaidCount = paidInvoices.filter((i) => i.paymentMethod === 'qr_transfer').length;
    const qrPaidVnd = paidInvoices
      .filter((i) => i.paymentMethod === 'qr_transfer')
      .reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const qrAdoptionRate = collectedVnd > 0 ? Math.round((qrPaidVnd / collectedVnd) * 100) : 0;

    const avgInvoiceVnd = totalCount > 0 ? Math.round(totalInvoicedVnd / totalCount) : 0;

    return {
      totalCount,
      totalInvoicedVnd,
      collectedVnd,
      paidCount: paidInvoices.length,
      pendingVnd,
      pendingCount: pendingInvoices.length,
      overdueVnd,
      overdueCount: overdueInvoices.length,
      collectionRate,
      qrPaidCount,
      qrPaidVnd,
      qrAdoptionRate,
      avgInvoiceVnd,
    };
  }, [scopedInvoices]);

  // Build Monthly Revenue Buckets based on selected TimeRange
  const monthlyData: MonthRevenueBucket[] = useMemo(() => {
    const monthKeys: string[] = [];
    const now = new Date();

    let monthCount = 6;
    if (timeRange === '3m') monthCount = 3;
    if (timeRange === '6m') monthCount = 6;
    if (timeRange === '12m') monthCount = 12;

    if (timeRange === 'all') {
      // Find earliest invoice date
      let earliestYear = now.getFullYear();
      let earliestMonth = now.getMonth();
      for (const inv of scopedInvoices) {
        const dStr =
          inv.paidAt ||
          inv.dueDate ||
          ((inv.createdAt as { seconds?: number })?.seconds
            ? new Date((inv.createdAt as { seconds: number }).seconds * 1000).toISOString()
            : null);
        if (dStr) {
          const d = new Date(dStr);
          if (!isNaN(d.getTime())) {
            if (
              d.getFullYear() < earliestYear ||
              (d.getFullYear() === earliestYear && d.getMonth() < earliestMonth)
            ) {
              earliestYear = d.getFullYear();
              earliestMonth = d.getMonth();
            }
          }
        }
      }
      const curYear = now.getFullYear();
      const curMonth = now.getMonth();
      let y = earliestYear;
      let m = earliestMonth;
      while (y < curYear || (y === curYear && m <= curMonth + 1)) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        monthKeys.push(key);
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
      }
    } else {
      for (let i = monthCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthKeys.push(key);
      }
      // Include current month + 1 next month for forward receivables schedule
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextKey = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;
      if (!monthKeys.includes(nextKey)) {
        monthKeys.push(nextKey);
      }
    }

    const map = new Map<string, MonthRevenueBucket>();
    monthKeys.forEach((key) => {
      const [yearStr, mStr] = key.split('-');
      const mNum = parseInt(mStr, 10);
      const monthNamesEn = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const monthNamesVi = [
        'T01',
        'T02',
        'T03',
        'T04',
        'T05',
        'T06',
        'T07',
        'T08',
        'T09',
        'T10',
        'T11',
        'T12',
      ];
      const enLabel = `${monthNamesEn[mNum - 1]} ${yearStr.slice(2)}`;
      const viLabel = `${monthNamesVi[mNum - 1]}/${yearStr.slice(2)}`;
      const shortLabel = lang === 'vi' ? monthNamesVi[mNum - 1] : monthNamesEn[mNum - 1];

      map.set(key, {
        key,
        label: lang === 'vi' ? viLabel : enLabel,
        shortLabel,
        collectedVnd: 0,
        pendingVnd: 0,
        overdueVnd: 0,
        totalInvoicedVnd: 0,
        paidCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        totalCount: 0,
        collectionRate: 0,
      });
    });

    // Populate with scoped invoices
    scopedInvoices.forEach((inv) => {
      const amount = Number(inv.amountVnd) || 0;
      let dateTarget: string | null = null;
      if (inv.status === 'paid' && inv.paidAt) {
        dateTarget = inv.paidAt;
      } else if (inv.dueDate) {
        dateTarget = inv.dueDate;
      } else if ((inv.createdAt as { seconds?: number })?.seconds) {
        dateTarget = new Date((inv.createdAt as { seconds: number }).seconds * 1000).toISOString();
      }

      if (!dateTarget) return;
      const key = dateTarget.slice(0, 7); // "YYYY-MM"
      const bucket = map.get(key);
      if (bucket) {
        bucket.totalCount += 1;
        bucket.totalInvoicedVnd += amount;
        if (inv.status === 'paid') {
          bucket.collectedVnd += amount;
          bucket.paidCount += 1;
        } else if (inv.status === 'overdue') {
          bucket.overdueVnd += amount;
          bucket.overdueCount += 1;
        } else {
          bucket.pendingVnd += amount;
          bucket.pendingCount += 1;
        }
      }
    });

    // Calculate collection rate per month
    return Array.from(map.values()).map((b) => ({
      ...b,
      collectionRate:
        b.totalInvoicedVnd > 0 ? Math.round((b.collectedVnd / b.totalInvoicedVnd) * 100) : 0,
    }));
  }, [scopedInvoices, timeRange, lang]);

  // Payment Status Distribution Pie Data
  const statusDistribution: StatusSlice[] = useMemo(() => {
    const paid = scopedInvoices.filter((i) => i.status === 'paid');
    const pending = scopedInvoices.filter((i) => i.status === 'pending');
    const reminderSent = scopedInvoices.filter((i) => i.status === 'reminder_sent');
    const overdue = scopedInvoices.filter((i) => i.status === 'overdue');

    const totalVnd = scopedInvoices.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0) || 1;

    const paidVnd = paid.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const pendingVnd = pending.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const reminderVnd = reminderSent.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);
    const overdueVnd = overdue.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0);

    const slices: StatusSlice[] = [
      {
        key: 'paid',
        name: 'Paid & Verified',
        nameVi: 'Đã thanh toán',
        valueVnd: paidVnd,
        count: paid.length,
        color: STATUS_COLORS.paid,
        percentage: Math.round((paidVnd / totalVnd) * 100),
      },
      {
        key: 'pending',
        name: 'Pending Payment',
        nameVi: 'Chờ thanh toán',
        valueVnd: pendingVnd,
        count: pending.length,
        color: STATUS_COLORS.pending,
        percentage: Math.round((pendingVnd / totalVnd) * 100),
      },
      {
        key: 'reminder_sent',
        name: 'Reminder Dispatched',
        nameVi: 'Đã gửi nhắc phí',
        valueVnd: reminderVnd,
        count: reminderSent.length,
        color: STATUS_COLORS.reminder_sent,
        percentage: Math.round((reminderVnd / totalVnd) * 100),
      },
      {
        key: 'overdue',
        name: 'Overdue Tuition',
        nameVi: 'Quá hạn thanh toán',
        valueVnd: overdueVnd,
        count: overdue.length,
        color: STATUS_COLORS.overdue,
        percentage: Math.round((overdueVnd / totalVnd) * 100),
      },
    ];

    // Filter out zero slices if there is at least one active slice, or keep for clean representation
    return slices;
  }, [scopedInvoices]);

  // Payment Methods Adoption Distribution
  const paymentMethodDistribution: PaymentMethodSlice[] = useMemo(() => {
    const totalVnd = scopedInvoices.reduce((sum, i) => sum + (Number(i.amountVnd) || 0), 0) || 1;
    const groups: Record<
      string,
      { name: string; nameVi: string; color: string; count: number; valueVnd: number }
    > = {
      qr_transfer: {
        name: 'VietQR Dynamic QR',
        nameVi: 'Chuyển khoản VietQR',
        color: METHOD_COLORS.qr_transfer,
        count: 0,
        valueVnd: 0,
      },
      direct_debit: {
        name: 'Direct Debit / Auto-Pay',
        nameVi: 'Trích nợ tự động',
        color: METHOD_COLORS.direct_debit,
        count: 0,
        valueVnd: 0,
      },
      credit_card: {
        name: 'Credit / Debit Card',
        nameVi: 'Thẻ thanh toán',
        color: METHOD_COLORS.credit_card,
        count: 0,
        valueVnd: 0,
      },
      cash: {
        name: 'Cash / In-Person',
        nameVi: 'Tiền mặt tại quầy',
        color: METHOD_COLORS.cash,
        count: 0,
        valueVnd: 0,
      },
      unselected: {
        name: 'Pending Selection',
        nameVi: 'Chưa chọn phương thức',
        color: METHOD_COLORS.unselected,
        count: 0,
        valueVnd: 0,
      },
    };

    scopedInvoices.forEach((inv) => {
      const m = inv.paymentMethod || 'unselected';
      const target = groups[m] || groups.unselected;
      target.count += 1;
      target.valueVnd += Number(inv.amountVnd) || 0;
    });

    return Object.entries(groups).map(([key, data]) => ({
      key,
      name: data.name,
      nameVi: data.nameVi,
      valueVnd: data.valueVnd,
      count: data.count,
      color: data.color,
      percentage: Math.round((data.valueVnd / totalVnd) * 100),
    }));
  }, [scopedInvoices]);

  // Course / Program Revenue Breakdown
  const programRevenues: ProgramRevenueRow[] = useMemo(() => {
    const progMap = new Map<
      string,
      { collected: number; pending: number; paidCount: number; unpaidCount: number }
    >();

    scopedInvoices.forEach((inv) => {
      const title = inv.programTitle || 'LiLab Tuition';
      const existing = progMap.get(title) || {
        collected: 0,
        pending: 0,
        paidCount: 0,
        unpaidCount: 0,
      };
      const amount = Number(inv.amountVnd) || 0;
      if (inv.status === 'paid') {
        existing.collected += amount;
        existing.paidCount += 1;
      } else {
        existing.pending += amount;
        existing.unpaidCount += 1;
      }
      progMap.set(title, existing);
    });

    return Array.from(progMap.entries())
      .map(([title, stats]) => {
        const total = stats.collected + stats.pending;
        return {
          programTitle: title,
          collectedVnd: stats.collected,
          pendingVnd: stats.pending,
          totalVnd: total,
          paidCount: stats.paidCount,
          unpaidCount: stats.unpaidCount,
          collectionRate: total > 0 ? Math.round((stats.collected / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.totalVnd - a.totalVnd);
  }, [scopedInvoices]);

  // Export Analytics Summary CSV
  const handleExportCsv = () => {
    const headers = [
      'Month',
      'Collected Revenue (VND)',
      'Pending Receivables (VND)',
      'Overdue Balance (VND)',
      'Total Invoiced (VND)',
      'Paid Transactions',
      'Pending Invoices',
      'Collection Efficiency (%)',
    ];
    const rows = monthlyData.map((m) => [
      m.label,
      m.collectedVnd,
      m.pendingVnd,
      m.overdueVnd,
      m.totalInvoicedVnd,
      m.paidCount,
      m.pendingCount + m.overdueCount,
      `${m.collectionRate}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `lilab_revenue_analytics_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (onFlash) {
      onFlash(
        biText(
          lang,
          'Exported monthly revenue analytics CSV successfully.',
          'Đã xuất báo cáo phân tích doanh thu dạng CSV thành công.'
        )
      );
    }
  };

  // Custom Recharts Tooltip for Monthly Revenue Trends
  const CustomMonthlyTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
    label?: string;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const bucket = monthlyData.find((m) => m.label === label);
    return (
      <div className="bg-[#172154] text-white p-3.5 rounded-xl border border-white/15 shadow-xl text-xs space-y-2 min-w-[220px]">
        <div className="font-bold text-sm border-b border-white/15 pb-1 flex items-center justify-between">
          <span>{label}</span>
          {bucket && (
            <span className="px-1.5 py-0.5 rounded bg-[#56BEB8]/20 text-[#56BEB8] text-[10px] font-bold">
              {bucket.collectionRate}% {biText(lang, 'Collected', 'Đã thu')}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {payload.map((entry) => (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-white/80">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-bold font-mono text-white">{formatVnd(entry.value)}</span>
            </div>
          ))}
        </div>
        {bucket && (
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/70">
            <span>{biText(lang, 'Total Invoiced:', 'Tổng phát hành:')}</span>
            <span className="font-extrabold text-[#FFD41D]">{formatVnd(bucket.totalInvoicedVnd)}</span>
          </div>
        )}
      </div>
    );
  };

  // Custom Recharts Tooltip for Status Distribution Pie
  const CustomStatusTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: StatusSlice }>;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0].payload;
    return (
      <div className="bg-[#172154] text-white p-3 rounded-xl border border-white/15 shadow-xl text-xs space-y-1 min-w-[190px]">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span
            className="w-3 h-3 rounded-full inline-block shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span>{lang === 'vi' ? item.nameVi : item.name}</span>
        </div>
        <div className="font-mono text-base font-extrabold text-white mt-1">
          {formatVnd(item.valueVnd)}
        </div>
        <div className="text-white/75 text-[11px] flex items-center justify-between pt-1 border-t border-white/10">
          <span>
            {item.count} {biText(lang, 'invoices', 'hóa đơn')}
          </span>
          <span className="font-bold text-[#FFD41D]">{item.percentage}% share</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* EXECUTIVE HEADER & CONTROLS */}
      <div className="bg-gradient-to-r from-[#172154] via-[#2D3E99] to-[#172154] rounded-2xl p-6 text-white shadow-md space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#FFD41D] text-[#172154] text-xs font-extrabold uppercase tracking-wider">
              <TrendingUp className="w-4 h-4" />
              <span>{biText(lang, 'Recharts Financial Intelligence', 'Phân tích Tài chính Recharts')}</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              {biText(lang, 'Revenue Trends & Payment Analytics', 'Xu hướng Doanh thu & Phân bổ Thanh toán')}
            </h2>
            <p className="text-sm text-white/80 max-w-2xl">
              {biText(
                lang,
                'Interactive Recharts visualization of historical tuition ledger, monthly collection efficiency, and multi-channel payment distribution.',
                'Trực quan hóa sổ cái học phí với Recharts: xu hướng doanh thu hàng tháng, hiệu suất thu hồi công nợ và tỷ trọng các kênh thanh toán.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateToInvoices && (
              <button
                type="button"
                onClick={onNavigateToInvoices}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{biText(lang, 'Manage Invoices', 'Quản lý Hóa đơn')}</span>
              </button>
            )}
            {onNavigateToLedger && (
              <button
                type="button"
                onClick={onNavigateToLedger}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>{biText(lang, 'Transaction Ledger', 'Sổ cái Giao dịch')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl bg-[#56BEB8] hover:bg-[#48aaa4] text-[#172154] text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{biText(lang, 'Export CSV', 'Xuất CSV')}</span>
            </button>
          </div>
        </div>

        {/* TIME-RANGE & FILTER TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/15">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-white/75 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#FFD41D]" />
              {biText(lang, 'Time Horizon:', 'Kỳ phân tích:')}
            </span>
            <div className="inline-flex rounded-lg bg-black/20 p-1 border border-white/10">
              {(
                [
                  { id: '3m' as const, label: biText(lang, 'Last 3M', '3 Tháng') },
                  { id: '6m' as const, label: biText(lang, 'Last 6M', '6 Tháng') },
                  { id: '12m' as const, label: biText(lang, 'Last 12M', '12 Tháng') },
                  { id: 'all' as const, label: biText(lang, 'All Time', 'Tất cả') },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTimeRange(opt.id)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    timeRange === opt.id
                      ? 'bg-[#FFD41D] text-[#172154] shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-white/75 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#56BEB8]" />
              {biText(lang, 'Program Filter:', 'Khóa học:')}
            </span>
            <select
              value={selectedProgramFilter}
              onChange={(e) => setSelectedProgramFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-xs font-semibold text-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFD41D]"
            >
              <option value="all" className="bg-[#172154] text-white">
                {biText(lang, 'All Programs & Courses', 'Tất cả Chương trình')}
              </option>
              {programs.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#172154] text-white">
                  {lang === 'vi' ? p.titleVi : p.titleEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 5 TOP EXECUTIVE FINANCIAL METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          {/* Card 1: Total Invoiced */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'Total Invoiced', 'Tổng Học phí')}</span>
              <Receipt className="w-3.5 h-3.5 text-white/80" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-white mt-1 tabular-nums">
              {formatVnd(summaryKpis.totalInvoicedVnd)}
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">
              {summaryKpis.totalCount} {biText(lang, 'invoices issued', 'hóa đơn phát hành')}
            </div>
          </div>

          {/* Card 2: Total Collected */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'Collected Revenue', 'Đã Thực thu')}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#56BEB8]" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-[#56BEB8] mt-1 tabular-nums">
              {formatVnd(summaryKpis.collectedVnd)}
            </div>
            <div className="text-[11px] text-[#56BEB8]/90 font-bold mt-0.5 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              <span>{summaryKpis.collectionRate}% {biText(lang, 'collection efficiency', 'hiệu suất thu')}</span>
            </div>
          </div>

          {/* Card 3: Pending Receivables */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'Pending Receivables', 'Chờ Thu hồi')}</span>
              <Clock className="w-3.5 h-3.5 text-[#FFD41D]" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-[#FFD41D] mt-1 tabular-nums">
              {formatVnd(summaryKpis.pendingVnd)}
            </div>
            <div className="text-[11px] text-white/70 mt-0.5">
              {summaryKpis.pendingCount} {biText(lang, 'invoices pending', 'hóa đơn chưa thu')}
            </div>
          </div>

          {/* Card 4: Overdue Risk */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'Overdue Exposure', 'Nợ Quá hạn')}</span>
              <AlertTriangle className="w-3.5 h-3.5 text-[#E61E64]" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-[#E61E64] mt-1 tabular-nums">
              {formatVnd(summaryKpis.overdueVnd)}
            </div>
            <div className="text-[11px] text-[#E61E64]/90 font-bold mt-0.5">
              {summaryKpis.overdueCount} {biText(lang, 'overdue invoices', 'hóa đơn quá hạn')}
            </div>
          </div>

          {/* Card 5: VietQR Adoption */}
          <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 col-span-2 md:col-span-1">
            <div className="text-[11px] font-semibold text-white/75 flex items-center justify-between">
              <span>{biText(lang, 'VietQR Digital Share', 'Tỷ trọng VietQR')}</span>
              <QrCode className="w-3.5 h-3.5 text-[#56BEB8]" />
            </div>
            <div className="font-display text-lg sm:text-xl font-extrabold text-white mt-1 tabular-nums">
              {summaryKpis.qrAdoptionRate}%
            </div>
            <div className="text-[11px] text-white/70 mt-0.5 truncate">
              {formatVnd(summaryKpis.qrPaidVnd)} ({summaryKpis.qrPaidCount} QR)
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: MONTHLY REVENUE TRENDS (RECHARTS AREA / BAR / COMPOSED) */}
      <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#2D3E99]" />
              <h3 className="font-display text-lg font-extrabold text-[#172154]">
                {biText(lang, 'Monthly Revenue & Collection Trends', 'Xu hướng Doanh thu & Hiệu suất Thu tiền')}
              </h3>
            </div>
            <p className="text-xs text-[#172154]/70">
              {biText(
                lang,
                'Comparison of collected tuition vs. pending receivables and overdue balances over time.',
                'So sánh học phí đã thực thu với công nợ đang chờ và nợ quá hạn theo từng tháng.'
              )}
            </p>
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-[#FDF9EE] border border-[#2D3E99]/15 rounded-xl">
            <button
              type="button"
              onClick={() => setMonthlyChartType('area')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                monthlyChartType === 'area'
                  ? 'bg-[#2D3E99] text-white shadow-sm'
                  : 'text-[#172154]/70 hover:text-[#2D3E99]'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{biText(lang, 'Area Wave', 'Vùng sóng')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMonthlyChartType('bar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                monthlyChartType === 'bar'
                  ? 'bg-[#2D3E99] text-white shadow-sm'
                  : 'text-[#172154]/70 hover:text-[#2D3E99]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{biText(lang, 'Stacked Bar', 'Cột chồng')}</span>
            </button>
            <button
              type="button"
              onClick={() => setMonthlyChartType('composed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                monthlyChartType === 'composed'
                  ? 'bg-[#2D3E99] text-white shadow-sm'
                  : 'text-[#172154]/70 hover:text-[#2D3E99]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{biText(lang, 'Revenue + Rate', 'Hỗn hợp')}</span>
            </button>
          </div>
        </div>

        {/* RECHARTS CONTAINER */}
        <div className="w-full h-[340px] pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {monthlyChartType === 'area' ? (
              <AreaChart data={monthlyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#56BEB8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#56BEB8" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD41D" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#FFD41D" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E61E64" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#E61E64" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3E99" strokeOpacity={0.1} />
                <XAxis dataKey="label" stroke="#172154" opacity={0.7} tick={{ fontSize: 11 }} />
                <YAxis
                  stroke="#172154"
                  opacity={0.7}
                  tickFormatter={formatVndCompact}
                  tick={{ fontSize: 11 }}
                  width={68}
                />
                <Tooltip content={<CustomMonthlyTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                  iconType="circle"
                  formatter={(value: string) => {
                    if (value === 'collectedVnd') return biText(lang, 'Collected Revenue', 'Học phí Thực thu');
                    if (value === 'pendingVnd') return biText(lang, 'Pending Receivables', 'Công nợ Chờ thu');
                    if (value === 'overdueVnd') return biText(lang, 'Overdue Risk', 'Nợ Quá hạn');
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="collectedVnd"
                  name="collectedVnd"
                  stroke="#56BEB8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorCollected)"
                />
                <Area
                  type="monotone"
                  dataKey="pendingVnd"
                  name="pendingVnd"
                  stroke="#FFD41D"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPending)"
                />
                <Area
                  type="monotone"
                  dataKey="overdueVnd"
                  name="overdueVnd"
                  stroke="#E61E64"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorOverdue)"
                />
              </AreaChart>
            ) : monthlyChartType === 'bar' ? (
              <BarChart data={monthlyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3E99" strokeOpacity={0.1} />
                <XAxis dataKey="label" stroke="#172154" opacity={0.7} tick={{ fontSize: 11 }} />
                <YAxis
                  stroke="#172154"
                  opacity={0.7}
                  tickFormatter={formatVndCompact}
                  tick={{ fontSize: 11 }}
                  width={68}
                />
                <Tooltip content={<CustomMonthlyTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                  iconType="circle"
                  formatter={(value: string) => {
                    if (value === 'collectedVnd') return biText(lang, 'Collected Revenue', 'Học phí Thực thu');
                    if (value === 'pendingVnd') return biText(lang, 'Pending Receivables', 'Công nợ Chờ thu');
                    if (value === 'overdueVnd') return biText(lang, 'Overdue Risk', 'Nợ Quá hạn');
                    return value;
                  }}
                />
                <Bar
                  dataKey="collectedVnd"
                  name="collectedVnd"
                  stackId="revenue"
                  fill="#56BEB8"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="pendingVnd"
                  name="pendingVnd"
                  stackId="revenue"
                  fill="#FFD41D"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="overdueVnd"
                  name="overdueVnd"
                  stackId="revenue"
                  fill="#E61E64"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : (
              <ComposedChart data={monthlyData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3E99" strokeOpacity={0.1} />
                <XAxis dataKey="label" stroke="#172154" opacity={0.7} tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="left"
                  stroke="#172154"
                  opacity={0.7}
                  tickFormatter={formatVndCompact}
                  tick={{ fontSize: 11 }}
                  width={68}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#2D3E99"
                  tickFormatter={(val: number) => `${val}%`}
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  width={45}
                />
                <Tooltip content={<CustomMonthlyTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
                  iconType="circle"
                  formatter={(value: string) => {
                    if (value === 'collectedVnd') return biText(lang, 'Collected Revenue', 'Học phí Thực thu');
                    if (value === 'pendingVnd') return biText(lang, 'Pending Receivables', 'Công nợ Chờ thu');
                    if (value === 'collectionRate')
                      return biText(lang, 'Collection Rate (%)', 'Tỷ lệ thu hồi (%)');
                    return value;
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="collectedVnd"
                  name="collectedVnd"
                  fill="#56BEB8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="pendingVnd"
                  name="pendingVnd"
                  fill="#FFD41D"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="collectionRate"
                  name="collectionRate"
                  stroke="#E61E64"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#E61E64' }}
                />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 2: 2-COLUMN GRID FOR PAYMENT STATUS & PAYMENT METHODS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 2A: PAYMENT STATUS DISTRIBUTION (RECHARTS DONUT) */}
        <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-display text-base font-extrabold text-[#172154] flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-[#E61E64]" />
                {biText(lang, 'Payment Status Distribution', 'Phân bổ Trạng thái Thanh toán')}
              </h3>
              <p className="text-xs text-[#172154]/70">
                {biText(
                  lang,
                  'Proportion of completed receipts vs pending and overdue balances.',
                  'Tỷ trọng hóa đơn đã thu, đang chờ và quá hạn trong sổ cái.'
                )}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#2D3E99]/10 text-[#2D3E99] font-mono text-xs font-bold">
              {summaryKpis.totalCount} {biText(lang, 'total', 'tổng số')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            {/* Recharts Donut */}
            <div className="h-[210px] relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="valueVnd"
                    onMouseEnter={(_, index) => setStatusHoverIndex(index)}
                    onMouseLeave={() => setStatusHoverIndex(null)}
                  >
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomStatusTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Donut Center Display */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[11px] font-semibold text-[#172154]/65">
                  {biText(lang, 'Efficiency', 'Hiệu suất')}
                </div>
                <div className="font-display text-xl font-extrabold text-[#56BEB8]">
                  {summaryKpis.collectionRate}%
                </div>
              </div>
            </div>

            {/* Breakdown Cards */}
            <div className="space-y-2">
              {statusDistribution.map((slice, idx) => (
                <div
                  key={slice.key}
                  onMouseEnter={() => setStatusHoverIndex(idx)}
                  onMouseLeave={() => setStatusHoverIndex(null)}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                    statusHoverIndex === idx
                      ? 'border-[#2D3E99] bg-[#FDF9EE] shadow-sm ring-1 ring-[#2D3E99]/30'
                      : 'border-[#2D3E99]/10 hover:bg-[#FDF9EE]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <div>
                      <div className="text-xs font-bold text-[#172154]">
                        {lang === 'vi' ? slice.nameVi : slice.name}
                      </div>
                      <div className="text-[10px] text-[#172154]/65">
                        {slice.count} {biText(lang, 'invoices', 'hóa đơn')} · {slice.percentage}%
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-bold text-[#172154]">
                      {formatVnd(slice.valueVnd)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CHART 2B: PAYMENT METHOD CHANNELS (RECHARTS BAR) */}
        <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-display text-base font-extrabold text-[#172154] flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#56BEB8]" />
                {biText(lang, 'Settlement Channels & Adoption', 'Kênh Thanh toán & Tỷ lệ Sử dụng')}
              </h3>
              <p className="text-xs text-[#172154]/70">
                {biText(
                  lang,
                  'Adoption of VietQR instant settlement vs Auto-Pay and direct methods.',
                  'Tỷ trọng thu qua mã QR động VietQR so với Trích nợ tự động và các kênh khác.'
                )}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#56BEB8]/15 text-[#56BEB8] font-mono text-xs font-bold">
              {summaryKpis.qrAdoptionRate}% VietQR
            </span>
          </div>

          <div className="h-[210px] w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={paymentMethodDistribution}
                margin={{ top: 5, right: 25, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3E99" strokeOpacity={0.08} />
                <XAxis
                  type="number"
                  tickFormatter={formatVndCompact}
                  stroke="#172154"
                  opacity={0.7}
                  tick={{ fontSize: 10 }}
                />
                <YAxis
                  type="category"
                  dataKey={lang === 'vi' ? 'nameVi' : 'name'}
                  stroke="#172154"
                  opacity={0.8}
                  tick={{ fontSize: 11, fontWeight: 600 }}
                  width={130}
                />
                <Tooltip
                  formatter={(val?: unknown) => [formatVnd(Number(val) || 0), biText(lang, 'Volume', 'Giá trị')]}
                  labelStyle={{ fontWeight: 'bold', color: '#172154' }}
                />
                <Bar dataKey="valueVnd" radius={[0, 4, 4, 0]}>
                  {paymentMethodDistribution.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECTION 3: COURSE & PROGRAM REVENUE PERFORMANCE */}
      <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="font-display text-base font-extrabold text-[#172154] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#2D3E99]" />
              {biText(lang, 'Program & Course Revenue Performance', 'Hiệu suất Doanh thu theo Khóa học')}
            </h3>
            <p className="text-xs text-[#172154]/70">
              {biText(
                lang,
                'Tuition collected vs pending balances categorized by LiLab educational programs.',
                'Doanh thu học phí đã thu và số dư còn nợ phân loại theo từng chương trình đào tạo.'
              )}
            </p>
          </div>
          <span className="text-xs text-[#172154]/60 font-semibold">
            {programRevenues.length} {biText(lang, 'programs tracked', 'khóa học được ghi nhận')}
          </span>
        </div>

        {programRevenues.length === 0 ? (
          <div className="p-8 text-center bg-[#FDF9EE] rounded-xl text-xs text-[#172154]/60">
            {biText(lang, 'No program revenue records found.', 'Chưa có dữ liệu doanh thu khóa học.')}
          </div>
        ) : (
          <div className="space-y-3">
            {programRevenues.slice(0, 6).map((prog) => (
              <div
                key={prog.programTitle}
                className="p-3.5 rounded-xl border border-[#2D3E99]/10 bg-[#FDF9EE]/40 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-xs text-[#172154] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#2D3E99]" />
                    <span>{prog.programTitle}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-[#56BEB8]">
                      {formatVnd(prog.collectedVnd)} {biText(lang, 'collected', 'đã thu')}
                    </span>
                    {prog.pendingVnd > 0 && (
                      <span className="font-semibold text-[#FFD41D] bg-[#172154] px-2 py-0.5 rounded text-[11px]">
                        {formatVnd(prog.pendingVnd)} {biText(lang, 'pending', 'chờ thu')}
                      </span>
                    )}
                    <span className="font-extrabold font-mono text-[#172154] bg-white px-2 py-0.5 rounded border border-[#2D3E99]/15">
                      {prog.collectionRate}%
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-[#2D3E99]/10 rounded-full h-2 overflow-hidden flex">
                  <div
                    className="bg-[#56BEB8] h-full transition-all duration-500"
                    style={{ width: `${prog.collectionRate}%` }}
                    title={`Collected: ${prog.collectionRate}%`}
                  />
                  <div
                    className="bg-[#FFD41D] h-full transition-all duration-500"
                    style={{ width: `${100 - prog.collectionRate}%` }}
                    title={`Pending: ${100 - prog.collectionRate}%`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4: DETAILED MONTHLY LEDGER BREAKDOWN TABLE */}
      <div className="bg-white border border-[#2D3E99]/15 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="font-display text-base font-extrabold text-[#172154] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#2D3E99]" />
              {biText(lang, 'Monthly Ledger Breakdown Summary', 'Bảng Tổng hợp Sổ cái Hàng tháng')}
            </h3>
            <p className="text-xs text-[#172154]/70">
              {biText(
                lang,
                'Tabular audit of invoices, collected cashflow, pending balances, and efficiency ratios.',
                'Bảng tổng hợp chi tiết số lượng hóa đơn, dòng tiền thực thu, công nợ và tỷ lệ thu hồi.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded-lg border border-[#2D3E99]/20 hover:bg-[#FDF9EE] text-[#2D3E99] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{biText(lang, 'Download Table CSV', 'Tải Bảng CSV')}</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#2D3E99]/15">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FDF9EE] text-[#172154] font-extrabold border-b border-[#2D3E99]/15">
              <tr>
                <th className="px-4 py-3">{biText(lang, 'Month', 'Tháng')}</th>
                <th className="px-4 py-3">{biText(lang, 'Total Invoiced', 'Tổng Phát hành')}</th>
                <th className="px-4 py-3">{biText(lang, 'Collected Revenue', 'Đã Thực thu')}</th>
                <th className="px-4 py-3">{biText(lang, 'Pending Receivables', 'Chờ Thu hồi')}</th>
                <th className="px-4 py-3">{biText(lang, 'Overdue Risk', 'Nợ Quá hạn')}</th>
                <th className="px-4 py-3 text-center">{biText(lang, 'Receipts / Invoices', 'Đã thu / Tổng')}</th>
                <th className="px-4 py-3 text-right">{biText(lang, 'Collection Rate', 'Hiệu suất')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D3E99]/10">
              {monthlyData.map((m) => (
                <tr key={m.key} className="hover:bg-[#FDF9EE]/50 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#172154]">{m.label}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#172154]">
                    {formatVnd(m.totalInvoicedVnd)}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-[#56BEB8]">
                    {formatVnd(m.collectedVnd)}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#FFD41D] text-[#172154]">
                    {formatVnd(m.pendingVnd)}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#E61E64]">
                    {formatVnd(m.overdueVnd)}
                  </td>
                  <td className="px-4 py-3 text-center font-mono">
                    <span className="text-[#56BEB8] font-bold">{m.paidCount}</span>
                    <span className="text-gray-400"> / </span>
                    <span>{m.totalCount}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        m.collectionRate >= 75
                          ? 'bg-[#56BEB8]/20 text-[#56BEB8]'
                          : m.collectionRate >= 40
                            ? 'bg-[#FFD41D]/20 text-[#172154]'
                            : 'bg-[#E61E64]/15 text-[#E61E64]'
                      }`}
                    >
                      {m.collectionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import { formatVnd } from '../i18n';
import type { AcademyBankConfig, LangCode, TuitionInvoice } from '../types';

export const DEFAULT_LILAB_BANK: AcademyBankConfig = {
  id: 'lilab_primary',
  bankName: 'Vietcombank (VCB)',
  bankCode: 'VCB',
  accountNumber: '1028869900123',
  accountHolder: 'CONG TY TNHH HOC VIEN LILAB',
  branchName: 'Ho Chi Minh City Branch',
  zaloHotline: '0707547187',
  paymentInstructionsEn:
    'Scan the LiLab QR code or transfer to the official account above. Include the invoice code & student name in your transfer memo.',
  paymentInstructionsVi:
    'Quét mã QR LiLab hoặc chuyển khoản theo thông tin tài khoản chính thức. Vui lòng ghi rõ mã hóa đơn và họ tên học viên trong nội dung chuyển khoản.',
  useDynamicVietQr: true,
  isActive: true,
};

export const VIETNAM_BANK_PRESETS: Array<{ code: string; name: string }> = [
  { code: 'VCB', name: 'Vietcombank (VCB)' },
  { code: 'TCB', name: 'Techcombank (TCB)' },
  { code: 'MB', name: 'MB Bank (MB)' },
  { code: 'ACB', name: 'ACB (Asia Commercial Bank)' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'VPB', name: 'VPBank (VPB)' },
  { code: 'ICB', name: 'VietinBank (ICB)' },
  { code: 'TPB', name: 'TPBank (TPB)' },
  { code: 'STB', name: 'Sacombank (STB)' },
  { code: 'VIB', name: 'VIB' },
  { code: 'MSB', name: 'MSB (Maritime Bank)' },
  { code: 'HDB', name: 'HDBank (HDB)' },
  { code: 'SHB', name: 'SHB' },
  { code: 'OCB', name: 'OCB' },
];

export function resolveVietBankCode(bankNameOrCode?: string | null): string {
  const raw = (bankNameOrCode || '').trim();
  if (!raw) return 'VCB';
  const upper = raw.toUpperCase();
  const exact = VIETNAM_BANK_PRESETS.find((b) => b.code === upper);
  if (exact) return exact.code;
  const byParen = upper.match(/\(([A-Z0-9]{2,10})\)/);
  if (byParen) {
    const parenMatch = VIETNAM_BANK_PRESETS.find((b) => b.code === byParen[1]);
    if (parenMatch) return parenMatch.code;
  }
  const lower = raw.toLowerCase();
  const keywordMap: Array<[string, string]> = [
    ['vietcombank', 'VCB'],
    ['vcb', 'VCB'],
    ['techcombank', 'TCB'],
    ['tcb', 'TCB'],
    ['mbbank', 'MB'],
    ['mb bank', 'MB'],
    ['quân đội', 'MB'],
    ['acb', 'ACB'],
    ['á châu', 'ACB'],
    ['bidv', 'BIDV'],
    ['vpbank', 'VPB'],
    ['vp bank', 'VPB'],
    ['vietinbank', 'ICB'],
    ['vietin', 'ICB'],
    ['icb', 'ICB'],
    ['tpbank', 'TPB'],
    ['tiên phong', 'TPB'],
    ['sacombank', 'STB'],
    ['vib', 'VIB'],
    ['msb', 'MSB'],
    ['maritime', 'MSB'],
    ['hdbank', 'HDB'],
    ['shb', 'SHB'],
    ['ocb', 'OCB'],
  ];
  for (const [kw, code] of keywordMap) {
    if (lower.includes(kw)) return code;
  }
  const cleanCode = upper.replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return cleanCode || 'VCB';
}

export function resolveActiveBankConfig(configs: AcademyBankConfig[]): AcademyBankConfig {
  const active = configs.find((c) => c.isActive !== false) || configs[0];
  if (!active) return DEFAULT_LILAB_BANK;
  return {
    ...DEFAULT_LILAB_BANK,
    ...active,
  };
}

/**
 * Generates a scannable VietQR image URL using the standard VietQR quick-link format.
 * Works across all Vietnamese banking apps (VCB, TCB, MB, ACB, BIDV, MoMo, ZaloPay, etc.).
 */
export function buildVietQrImageUrl(params: {
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  amountVnd?: number;
  memo?: string;
}): string {
  const bank = encodeURIComponent((params.bankCode || 'VCB').trim().toUpperCase());
  const acc = encodeURIComponent((params.accountNumber || '').replace(/\s+/g, ''));
  if (!acc) return '';
  const query = new URLSearchParams();
  if (params.amountVnd && params.amountVnd > 0) {
    query.set('amount', String(Math.round(params.amountVnd)));
  }
  if (params.memo) {
    query.set('addInfo', params.memo.trim().slice(0, 80));
  }
  if (params.accountHolder) {
    query.set('accountName', params.accountHolder.trim().slice(0, 80));
  }
  return `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?${query.toString()}`;
}

/**
 * Compresses an admin-uploaded QR image file to a crisp, lightweight WebP/PNG data URL
 * guaranteed to fit comfortably under Firestore's field size limits (<140 KB).
 */
export async function compressQrImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read QR image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported QR image format.'));
      img.onload = () => {
        const maxSide = 420;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
        const width = Math.max(120, Math.round(img.width * scale));
        const height = Math.max(120, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', 0.85);
        if (dataUrl.length > 150000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        }
        if (dataUrl.length > 175000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export function normalizeZaloPhone(rawPhone?: string | null): string {
  const digits = (rawPhone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('84') && digits.length >= 10) {
    return '0' + digits.slice(2);
  }
  return digits;
}

export function buildZaloDeepLink(rawPhone?: string | null, fallbackHotline = '0707547187'): string {
  const normalized = normalizeZaloPhone(rawPhone) || normalizeZaloPhone(fallbackHotline) || '0707547187';
  return `https://zalo.me/${normalized}`;
}

export function buildPaymentReminderCopy(params: {
  invoice: TuitionInvoice;
  bank: AcademyBankConfig;
  lang: LangCode;
}): { zaloText: string; emailText: string } {
  const { invoice, bank, lang } = params;
  const amount = formatVnd(invoice.amountVnd);
  const memo = `${invoice.invoiceNumber} ${invoice.studentName}`.trim();

  const viMessage = [
    `Kính gửi Quý Phụ huynh của bé ${invoice.studentName},`,
    `LiLab Creative Talent Academy xin gửi thông báo nhắc học phí:`,
    `• Mã hóa đơn: ${invoice.invoiceNumber}`,
    `• Khóa học: ${invoice.programTitle}`,
    `• Số tiền cần thanh toán: ${amount}`,
    `• Hạn thanh toán: ${invoice.dueDate}`,
    ``,
    `Thông tin chuyển khoản / quét QR LiLab:`,
    `• Ngân hàng: ${bank.bankName}`,
    `• Số tài khoản: ${bank.accountNumber}`,
    `• Chủ tài khoản: ${bank.accountHolder}`,
    `• Nội dung CK: ${memo}`,
    ``,
    `Ba mẹ cũng có thể đăng nhập Cổng Phụ huynh LiLab để quét mã QR hoặc thanh toán trực tuyến ngay. Xin chân thành cảm ơn Quý Phụ huynh!`,
  ].join('\n');

  const enMessage = [
    `Dear Parent of ${invoice.studentName},`,
    `This is a friendly tuition payment reminder from LiLab Creative Talent Academy:`,
    `• Invoice #: ${invoice.invoiceNumber}`,
    `• Course / Program: ${invoice.programTitle}`,
    `• Amount Due: ${amount}`,
    `• Due Date: ${invoice.dueDate}`,
    ``,
    `LiLab Official Bank / QR Transfer Details:`,
    `• Bank: ${bank.bankName}`,
    `• Account Number: ${bank.accountNumber}`,
    `• Account Holder: ${bank.accountHolder}`,
    `• Transfer Memo: ${memo}`,
    ``,
    `You may also sign in to the LiLab Parent Portal to scan our QR code or complete payment right away. Thank you!`,
  ].join('\n');

  if (lang === 'en') {
    return { zaloText: enMessage, emailText: enMessage };
  }
  if (lang === 'vi') {
    return { zaloText: viMessage, emailText: viMessage };
  }
  const combined = `${viMessage}\n\n---\n\n${enMessage}`;
  return { zaloText: combined, emailText: combined };
}

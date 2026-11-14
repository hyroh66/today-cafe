import type { OrderStatus } from '../types/cafe';

export function formatKRW(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export function isValidKoreanPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits);
}

export function maskPhone(normalized: string): string {
  const parts = normalized.split('-');
  if (parts.length === 3) {
    return `${parts[0]}-****-${parts[2]}`;
  }
  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 10) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  return normalized;
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    description: string;
    toneClass: string;
    stepIndex: number;
  }
> = {
  RECEIVED: {
    label: '접수',
    description: '주문이 접수되었습니다. 준비 시작 전까지 취소가 가능합니다.',
    toneClass: 'text-[#8C4A1C] bg-[#F6E8DC] border-[#E4C7AF]',
    stepIndex: 0,
  },
  PREPARING: {
    label: '준비 중',
    description: '매장에서 메뉴를 정성껏 준비하고 있습니다.',
    toneClass: 'text-[#9A5B13] bg-[#FAF0DC] border-[#E6CF9E]',
    stepIndex: 1,
  },
  READY: {
    label: '준비 완료',
    description: '메뉴가 준비되었습니다. 메인로비 1층에서 현장 결제 후 수령해 주세요.',
    toneClass: 'text-[#B54112] bg-[#FCEAE2] border-[#F0BFA8]',
    stepIndex: 2,
  },
  COMPLETED: {
    label: '수령 완료',
    description: '현장 결제 및 수령이 완료되었습니다.',
    toneClass: 'text-[#3F5139] bg-[#E8EFE6] border-[#C6D6C1]',
    stepIndex: 3,
  },
  CANCELLED: {
    label: '취소',
    description: '주문이 취소되었습니다.',
    toneClass: 'text-[#6E5A4F] bg-[#EFE9E1] border-[#DDD2C5]',
    stepIndex: -1,
  },
};

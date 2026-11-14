import heroWinterCafeImg from '../assets/images/hero_winter_cafe_1794638203950.jpg';
import menuCarrotCakeImg from '../assets/images/menu_carrot_cake_1794638205738.jpg';
import menuPersimmonLatteImg from '../assets/images/menu_persimmon_latte_1794638204043.jpg';
import menuWinterSetImg from '../assets/images/menu_winter_set_1794638203829.jpg';
import type {
  AuditLogRecord,
  DailyEventQuota,
  MenuItemSpec,
  OrderRecord,
} from '../types/cafe';

export const HERO_IMAGE = {
  url: heroWinterCafeImg,
  alt: 'TODAY CAFE 메인로비 1층 겨울 신메뉴 아이스 홍시라떼와 무가당 오가닉 당근케이크',
};

export const PREVIEW_BUSINESS_DATE = '2026-12-01';
export const PREVIEW_ORDER_PREFIX = '1201';

export const MENU_ITEMS: MenuItemSpec[] = [
  {
    code: 'PERSIMMON_LATTE',
    name: '아이스 홍시라떼',
    subtitle: '제철 홍시 퓨레와 부드러운 우유의 조화',
    description:
      '국내산 완숙 홍시를 곱게 갈아 넣은 진한 과육층에 고소한 우유와 얼음을 더한 겨울 시즌 한정 라떼입니다.',
    originalPrice: 5000,
    discountAmount: 1000,
    finalPrice: 4000,
    dailyLimit: 20,
    imageUrl: menuPersimmonLatteImg,
    imageAlt: '유리잔에 담긴 아이스 홍시라떼',
    note: '1일 1인 1잔 한정 · 현장 결제',
  },
  {
    code: 'CARROT_CAKE',
    name: '무가당 오가닉 당근케이크',
    subtitle: '유기농 당근과 구운 호두의 촉촉한 식감',
    description:
      '설탕을 넣지 않고 유기농 당근 본연의 은은한 단맛과 시나몬, 크림 프로스팅을 조화롭게 담아낸 수제 케이크입니다.',
    originalPrice: 5000,
    discountAmount: 1000,
    finalPrice: 4000,
    dailyLimit: 20,
    imageUrl: menuCarrotCakeImg,
    imageAlt: '도자기 접시에 담긴 무가당 오가닉 당근케이크',
    note: '1일 1인 1조각 한정 · 현장 결제',
  },
  {
    code: 'SET',
    name: '아이스 홍시라떼 + 오가닉 당근케이크 세트 특가',
    subtitle: '겨울 신메뉴 2종을 한 번에 즐기는 페어링 세트',
    description:
      '아이스 홍시라떼 1잔과 무가당 오가닉 당근케이크 1조각을 함께 구성한 세트 특가로, 단품 할인과 중복 적용되지 않습니다.',
    originalPrice: 10000,
    discountAmount: 3000,
    finalPrice: 7000,
    dailyLimit: 20,
    imageUrl: menuWinterSetImg,
    imageAlt: '나무 트레이에 함께 구성된 아이스 홍시라떼 + 오가닉 당근케이크 세트 특가',
    note: '단품 할인 중복 불가 · 1일 1인 1세트 한정',
  },
];

export const INITIAL_QUOTAS: DailyEventQuota[] = [
  {
    eventCode: 'PERSIMMON_LATTE',
    businessDate: PREVIEW_BUSINESS_DATE,
    limit: 20,
    consumed: 7,
    restored: 0,
    updatedAt: '09:24:10',
  },
  {
    eventCode: 'CARROT_CAKE',
    businessDate: PREVIEW_BUSINESS_DATE,
    limit: 20,
    consumed: 5,
    restored: 0,
    updatedAt: '09:18:42',
  },
  {
    eventCode: 'SET',
    businessDate: PREVIEW_BUSINESS_DATE,
    limit: 20,
    consumed: 11,
    restored: 0,
    updatedAt: '09:21:05',
  },
];

export const INITIAL_ORDERS: OrderRecord[] = [
  {
    internalId: 'ORD-2026-1201-005',
    orderNumber: '1201-005',
    businessDate: PREVIEW_BUSINESS_DATE,
    createdAt: '2026-12-01T09:24:10+09:00',
    createdTimeLabel: '09:24',
    customerName: '이하늘',
    phoneNormalized: '010-1122-3344',
    totalAmount: 4000,
    status: 'RECEIVED',
    items: [
      {
        id: 'ITEM-005-1',
        eventCode: 'PERSIMMON_LATTE',
        itemName: '아이스 홍시라떼',
        quantity: 1,
        unitFinalPrice: 4000,
        slotStatus: 'ALLOCATED',
      },
    ],
  },
  {
    internalId: 'ORD-2026-1201-004',
    orderNumber: '1201-004',
    businessDate: PREVIEW_BUSINESS_DATE,
    createdAt: '2026-12-01T09:18:42+09:00',
    createdTimeLabel: '09:18',
    customerName: '정우성',
    phoneNormalized: '010-5566-7788',
    totalAmount: 11000,
    status: 'CANCELLED',
    cancelledAt: '09:20',
    items: [
      {
        id: 'ITEM-004-1',
        eventCode: 'CARROT_CAKE',
        itemName: '무가당 오가닉 당근케이크',
        quantity: 1,
        unitFinalPrice: 4000,
        slotStatus: 'CANCELLED_UNRESTORED',
      },
      {
        id: 'ITEM-004-2',
        eventCode: 'SET',
        itemName: '아이스 홍시라떼 + 오가닉 당근케이크 세트 특가',
        quantity: 1,
        unitFinalPrice: 7000,
        slotStatus: 'CANCELLED_UNRESTORED',
      },
    ],
  },
  {
    internalId: 'ORD-2026-1201-003',
    orderNumber: '1201-003',
    businessDate: PREVIEW_BUSINESS_DATE,
    createdAt: '2026-12-01T09:05:19+09:00',
    createdTimeLabel: '09:05',
    customerName: '박지훈',
    phoneNormalized: '010-8765-4321',
    totalAmount: 7000,
    status: 'PREPARING',
    items: [
      {
        id: 'ITEM-003-1',
        eventCode: 'SET',
        itemName: '아이스 홍시라떼 + 오가닉 당근케이크 세트 특가',
        quantity: 1,
        unitFinalPrice: 7000,
        slotStatus: 'ALLOCATED',
      },
    ],
  },
  {
    internalId: 'ORD-2026-1201-002',
    orderNumber: '1201-002',
    businessDate: PREVIEW_BUSINESS_DATE,
    createdAt: '2026-12-01T08:42:03+09:00',
    createdTimeLabel: '08:42',
    customerName: '김서연',
    phoneNormalized: '010-2345-6789',
    totalAmount: 8000,
    status: 'READY',
    markedUncollected: true,
    items: [
      {
        id: 'ITEM-002-1',
        eventCode: 'PERSIMMON_LATTE',
        itemName: '아이스 홍시라떼',
        quantity: 1,
        unitFinalPrice: 4000,
        slotStatus: 'ALLOCATED',
      },
      {
        id: 'ITEM-002-2',
        eventCode: 'CARROT_CAKE',
        itemName: '무가당 오가닉 당근케이크',
        quantity: 1,
        unitFinalPrice: 4000,
        slotStatus: 'ALLOCATED',
      },
    ],
  },
  {
    internalId: 'ORD-2026-1201-001',
    orderNumber: '1201-001',
    businessDate: PREVIEW_BUSINESS_DATE,
    createdAt: '2026-12-01T08:11:30+09:00',
    createdTimeLabel: '08:11',
    customerName: '최유진',
    phoneNormalized: '010-9988-7766',
    totalAmount: 7000,
    status: 'COMPLETED',
    completedAt: '08:22',
    items: [
      {
        id: 'ITEM-001-1',
        eventCode: 'SET',
        itemName: '아이스 홍시라떼 + 오가닉 당근케이크 세트 특가',
        quantity: 1,
        unitFinalPrice: 7000,
        slotStatus: 'ALLOCATED',
      },
    ],
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogRecord[] = [
  {
    id: 'LOG-003',
    timestamp: '2026-12-01 09:07:12',
    adminId: 'today_admin',
    actionType: 'STATUS_CHANGE',
    targetLabel: '주문 1201-003',
    beforeValue: '접수',
    afterValue: '준비 중',
    reason: '음료 및 케이크 제조 시작',
  },
  {
    id: 'LOG-002',
    timestamp: '2026-12-01 08:48:35',
    adminId: 'today_admin',
    actionType: 'STATUS_CHANGE',
    targetLabel: '주문 1201-002',
    beforeValue: '준비 중',
    afterValue: '준비 완료',
    reason: '픽업대 준비 완료 및 알림 전송',
  },
  {
    id: 'LOG-001',
    timestamp: '2026-12-01 08:22:09',
    adminId: 'today_admin',
    actionType: 'STATUS_CHANGE',
    targetLabel: '주문 1201-001',
    beforeValue: '준비 완료',
    afterValue: '수령 완료',
    reason: '메인로비 1층 현장 결제 및 수령 확인',
  },
];

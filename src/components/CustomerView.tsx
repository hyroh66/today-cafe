import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  Volume2,
  X,
} from 'lucide-react';
import { HERO_IMAGE, MENU_ITEMS, PREVIEW_BUSINESS_DATE } from '../data/initialPreviewData';
import type {
  BusinessSimulationMode,
  DailyEventQuota,
  EventCode,
  OrderRecord,
} from '../types/cafe';
import {
  formatKRW,
  isValidKoreanPhone,
  normalizePhone,
  ORDER_STATUS_META,
} from '../utils/format';
import { playCafeChime } from '../utils/sound';
import { SafeImage } from './SafeImage';

interface CustomerViewProps {
  quotas: DailyEventQuota[];
  orders: OrderRecord[];
  businessMode: BusinessSimulationMode;
  lastSyncedAt: string;
  activeCustomerOrderId: string | null;
  onSelectActiveOrderId: (id: string | null) => void;
  onPlaceOrder: (payload: {
    customerName: string;
    phoneNormalized: string;
    selectedCodes: EventCode[];
  }) => { ok: true; order: OrderRecord } | { ok: false; message: string };
  onCancelOrder: (orderId: string) => { ok: boolean; message: string };
  onRefreshSync: () => void;
}

const STEPS = ['접수', '준비 중', '준비 완료', '수령 완료'] as const;

export function CustomerView({
  quotas,
  orders,
  businessMode,
  lastSyncedAt,
  activeCustomerOrderId,
  onSelectActiveOrderId,
  onPlaceOrder,
  onCancelOrder,
  onRefreshSync,
}: CustomerViewProps) {
  const [selectedCodes, setSelectedCodes] = useState<EventCode[]>(['SET']);
  const [customerName, setCustomerName] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupOrderNo, setLookupOrderNo] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotifyState, setBrowserNotifyState] = useState<string>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission;
  });

  const activeOrder = activeCustomerOrderId
    ? orders.find((o) => o.internalId === activeCustomerOrderId) ?? null
    : null;

  const prevOrderStatusRef = useRef<{ id: string | null; status: string | null }>({
    id: activeOrder?.internalId ?? null,
    status: activeOrder?.status ?? null,
  });

  // Play chime when the currently viewed order transitions to READY
  useEffect(() => {
    const prev = prevOrderStatusRef.current;
    const isTransitionToReady =
      activeOrder &&
      prev.id === activeOrder.internalId &&
      prev.status !== 'READY' &&
      activeOrder.status === 'READY';

    prevOrderStatusRef.current = {
      id: activeOrder?.internalId ?? null,
      status: activeOrder?.status ?? null,
    };

    if (isTransitionToReady) {
      if (soundEnabled) {
        playCafeChime('customer_ready');
      }
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        try {
          new window.Notification(`TODAY CAFE 주문 준비 완료 (${activeOrder.orderNumber})`, {
            body: '메인로비 1층에서 현장 결제 후 메뉴를 수령해 주세요.',
          });
        } catch {
          // Ignore browser notification restrictions in embedded iframes
        }
      }
    }
  }, [activeOrder, soundEnabled]);

  const getQuotaForCode = (code: EventCode) => {
    const q = quotas.find((item) => item.eventCode === code);
    if (!q) return { remaining: 0, limit: 20 };
    const remaining = Math.max(0, Math.min(q.limit, q.limit - q.consumed + q.restored));
    return { remaining, limit: q.limit };
  };

  const toggleMenuSelection = (code: EventCode) => {
    if (businessMode !== 'OPEN') return;
    const { remaining } = getQuotaForCode(code);
    if (remaining <= 0) return;

    setFormError(null);
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  };

  const selectedItems = MENU_ITEMS.filter((item) => selectedCodes.includes(item.code));
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.finalPrice, 0);
  const selectedSavings = selectedItems.reduce((sum, item) => sum + item.discountAmount, 0);

  const handleOrderSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCancelFeedback(null);

    if (businessMode === 'CLOSED_HOURS') {
      setFormError('현재 영업시간 외(영업일 08:00~19:00)이므로 신규 주문을 접수할 수 없습니다.');
      return;
    }
    if (businessMode === 'DISCONNECTED') {
      setFormError('실시간 재고 연결이 끊어진 상태입니다. 새로고침 후 다시 시도해 주세요.');
      return;
    }
    if (selectedCodes.length === 0) {
      setFormError('주문할 신메뉴를 최소 1개 이상 선택해 주세요.');
      return;
    }
    if (!customerName.trim()) {
      setFormError('주문자 이름을 입력해 주세요.');
      return;
    }
    if (!isValidKoreanPhone(phoneInput)) {
      setFormError('올바른 휴대전화번호(예: 010-1234-5678)를 입력해 주세요.');
      return;
    }
    if (!privacyAgreed) {
      setFormError('개인정보 수집 및 이용 안내에 동의해 주세요.');
      return;
    }

    const result = onPlaceOrder({
      customerName: customerName.trim(),
      phoneNormalized: normalizePhone(phoneInput),
      selectedCodes,
    });

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    setSelectedCodes([]);
    setCustomerName('');
    setPhoneInput('');
    setPrivacyAgreed(false);
    setLookupPhone(result.order.phoneNormalized);
    setLookupOrderNo(result.order.orderNumber);
    onSelectActiveOrderId(result.order.internalId);

    requestAnimationFrame(() => {
      document.getElementById('order-confirmation-card')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  const handleLookupSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setCancelFeedback(null);

    const normalized = normalizePhone(lookupPhone);
    const trimmedOrderNo = lookupOrderNo.trim().toUpperCase();

    if (!isValidKoreanPhone(normalized) || !trimmedOrderNo) {
      setLookupError('휴대전화번호와 주문번호를 모두 정확히 입력해 주세요.');
      return;
    }

    const found = orders.find(
      (o) =>
        o.phoneNormalized === normalized &&
        o.orderNumber.toUpperCase() === trimmedOrderNo,
    );

    if (!found) {
      setLookupError('일치하는 주문 내역을 찾을 수 없습니다. 번호를 다시 확인해 주세요.');
      return;
    }

    onSelectActiveOrderId(found.internalId);
    document.getElementById('order-confirmation-card')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const handleQuickLookup = (order: OrderRecord) => {
    setLookupPhone(order.phoneNormalized);
    setLookupOrderNo(order.orderNumber);
    setLookupError(null);
    setCancelFeedback(null);
    setConfirmingCancelId(null);
    onSelectActiveOrderId(order.internalId);
    document.getElementById('order-confirmation-card')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const requestBrowserNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotifyState('unsupported');
      return;
    }
    try {
      const perm = await window.Notification.requestPermission();
      setBrowserNotifyState(perm);
    } catch {
      setBrowserNotifyState('denied');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2B1E16]">
      {/* 3-Zone Top Bar Contract */}
      <header className="border-b border-[#E6DCD0] bg-[#FAF7F2]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-4 py-4 sm:px-6">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-[#2B1E16] whitespace-nowrap shrink-0"
          >
            TODAY CAFE
          </a>

          <nav
            aria-label="주요 메뉴"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#523F34]"
          >
            <a
              href="#menu"
              className="hover:text-[#2B1E16] transition-colors whitespace-nowrap shrink-0"
            >
              신메뉴 특가
            </a>
            <a
              href="#order-section"
              className="hover:text-[#2B1E16] transition-colors whitespace-nowrap shrink-0"
            >
              주문하기
            </a>
            <a
              href="#lookup-section"
              className="hover:text-[#2B1E16] transition-colors whitespace-nowrap shrink-0"
            >
              주문 조회
            </a>
            <a
              href="#visit-section"
              className="hover:text-[#2B1E16] transition-colors whitespace-nowrap shrink-0"
            >
              방문 안내
            </a>
          </nav>

          <div className="shrink-0">
            <a
              href="#order-section"
              className="inline-flex items-center justify-center rounded-lg bg-[#D95D24] px-4 py-2 text-sm font-semibold text-white hover:bg-[#BE4E1B] transition-colors whitespace-nowrap shrink-0"
            >
              즉시 주문하기
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1200px] px-4 sm:px-6">
        {/* Simulation Status Banners */}
        {businessMode === 'CLOSED_HOURS' && (
          <div
            role="status"
            className="mt-6 flex flex-col gap-2 rounded-xl border border-[#DFCBB5] bg-[#F4EBE0] px-5 py-4 text-sm text-[#4D3729] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#B85223]" />
              <div>
                <p className="font-semibold text-[#2B1E16]">
                  현재 주문 접수 시간이 아닙니다 (영업일 08:00~19:00 · 주말·공휴일 휴무)
                </p>
                <p className="mt-0.5 text-[#523F34]">
                  신규 주문은 다음 영업일 08:00부터 가능합니다. 아래 주문 조회에서 기존 주문 상태를 확인하실 수 있습니다.
                </p>
              </div>
            </div>
            <a
              href="#lookup-section"
              className="self-start rounded-lg border border-[#CBB6A0] bg-white px-3.5 py-2 text-xs font-semibold text-[#2B1E16] hover:bg-[#FAF7F2] whitespace-nowrap shrink-0 sm:self-center"
            >
              기존 주문 조회
            </a>
          </div>
        )}

        {businessMode === 'DISCONNECTED' && (
          <div
            role="alert"
            className="mt-6 flex flex-col gap-3 rounded-xl border border-[#E5B8A6] bg-[#FDF1EC] px-5 py-4 text-sm text-[#7A2E14] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#C24112]" />
              <div>
                <p className="font-semibold">실시간 잔여 인원 연결이 잠시 끊어졌습니다</p>
                <p className="mt-0.5 text-[#8E472C] tabular-nums">
                  마지막 동기화 시각: {lastSyncedAt} · 정확한 선착순 잔여 수량 확인을 위해 새로고침해 주세요.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRefreshSync}
              className="inline-flex items-center gap-1.5 self-start rounded-lg bg-[#C24112] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#A6350C] transition-colors whitespace-nowrap shrink-0 sm:self-center"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              다시 연결하기
            </button>
          </div>
        )}

        {/* Hero Section */}
        <section className="py-10 lg:py-14 border-b border-[#E6DCD0]">
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
            <div className="flex flex-col justify-between lg:col-span-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#5C473A]">
                  <span>2026 겨울 신메뉴 이벤트</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">2026.12.01 — 12.15</span>
                  <span aria-hidden="true">·</span>
                  <span>메인로비 1층</span>
                </div>

                <h1 className="mt-4 font-display text-3xl font-bold leading-[1.22] tracking-tight text-[#2B1E16] sm:text-4xl lg:text-[44px] [text-wrap:balance]">
                  따뜻한 겨울의 시작,
                  <br />
                  홍시와 당근의 계절 특가
                </h1>

                <p className="mt-5 max-w-xl text-base leading-[1.7] text-[#47362C]">
                  사내 직원과 방문객을 위해 TODAY CAFE가 준비한 겨울 시즌 한정 프로모션입니다.
                  평일 영업시간(08:00~19:00) 동안 매일 메뉴별 선착순 20명에게 할인가로 제공하며,
                  주문 후 메인로비 1층 매장에서 현장 결제 및 수령하실 수 있습니다.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <a
                    href="#menu"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#2B1E16] px-6 py-2.5 text-sm font-semibold text-[#FAF7F2] hover:bg-[#412E23] transition-colors whitespace-nowrap shrink-0"
                  >
                    특가 메뉴 선택하기
                  </a>
                  <a
                    href="#lookup-section"
                    className="inline-flex min-h-[44px] items-center justify-center text-sm font-semibold text-[#B85223] underline decoration-[#B85223]/40 underline-offset-4 hover:text-[#963F18] whitespace-nowrap shrink-0"
                  >
                    주문번호로 내역 조회
                  </a>
                </div>
              </div>

              {/* Clean 3-column summary strip */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-[#E6DCD0] pt-6">
                <div>
                  <p className="text-xs text-[#5C473A]">일일 선착순</p>
                  <p className="mt-1 text-lg font-bold text-[#2B1E16] tabular-nums">메뉴별 20명</p>
                </div>
                <div>
                  <p className="text-xs text-[#5C473A]">접수 시간</p>
                  <p className="mt-1 text-lg font-bold text-[#2B1E16] tabular-nums">08:00–19:00</p>
                </div>
                <div>
                  <p className="text-xs text-[#5C473A]">결제 및 수령</p>
                  <p className="mt-1 text-lg font-bold text-[#2B1E16]">1층 현장 결제</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[260px] overflow-hidden rounded-xl border border-[#E6DCD0] bg-[#F3ECE1]">
                <SafeImage
                  src={HERO_IMAGE.url}
                  alt={HERO_IMAGE.alt}
                  fallbackTitle="TODAY CAFE 겨울 신메뉴"
                  className="h-full w-full object-cover aspect-[16/10] lg:aspect-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Menu Cards Section */}
        <section id="menu" className="py-12 lg:py-16 border-b border-[#E6DCD0]">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#2B1E16] sm:text-3xl">
                겨울 신메뉴 및 실시간 잔여 수량
              </h2>
              <p className="mt-2 text-sm text-[#523F34]">
                1인 1일 이벤트별 1개씩 주문 가능하며, 단품과 세트 특가를 한 번에 함께 선택할 수 있습니다.
              </p>
            </div>
            <div className="text-xs text-[#5C473A] tabular-nums whitespace-nowrap shrink-0">
              {businessMode === 'DISCONNECTED'
                ? `마지막 동기화 ${lastSyncedAt} (재연결 필요)`
                : `실시간 동기화 · ${lastSyncedAt} 기준`}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
            {MENU_ITEMS.map((item) => {
              const { remaining, limit } = getQuotaForCode(item.code);
              const isSoldOut = remaining <= 0;
              const isDisabled = isSoldOut || businessMode !== 'OPEN';
              const isSelected = selectedCodes.includes(item.code) && !isDisabled;

              return (
                <article
                  key={item.code}
                  className={`flex flex-col overflow-hidden rounded-xl border transition-all duration-200 bg-white ${
                    isSelected
                      ? 'border-[#D95D24] ring-1 ring-[#D95D24]'
                      : 'border-[#E6DCD0] hover:-translate-y-0.5'
                  }`}
                >
                  <div className="aspect-[4/3] w-full overflow-hidden bg-[#F3ECE1]">
                    <SafeImage
                      src={item.imageUrl}
                      alt={item.imageAlt}
                      fallbackTitle={item.name}
                      className={`h-full w-full object-cover transition-transform duration-300 ${
                        isSoldOut ? 'grayscale opacity-70' : ''
                      }`}
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs font-medium">
                        {businessMode === 'DISCONNECTED' ? (
                          <span className="text-[#B54112]">수량 동기화 필요</span>
                        ) : isSoldOut ? (
                          <span className="font-semibold text-[#B54112]">
                            선착순 마감 · 잔여 0명
                          </span>
                        ) : (
                          <span className="text-[#5C493E] tabular-nums">
                            오늘 잔여 <strong className="text-[#D95D24]">{remaining}</strong> / {limit}명
                          </span>
                        )}
                        <span className="text-[#665043] tabular-nums">
                          {item.discountAmount.toLocaleString('ko-KR')}원 할인
                        </span>
                      </div>

                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#EFE7DC]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isSoldOut ? 'bg-[#C7B8A8]' : 'bg-[#D95D24]'
                          }`}
                          style={{
                            width:
                              businessMode === 'DISCONNECTED'
                                ? '0%'
                                : `${Math.round((remaining / limit) * 100)}%`,
                          }}
                        />
                      </div>

                      <h3 className="mt-4 text-lg font-bold leading-snug text-[#2B1E16]">
                        {item.name}
                      </h3>
                      <p className="mt-2 text-[14.5px] leading-[1.65] text-[#523F34]">
                        {item.description}
                      </p>
                      {item.note && (
                        <p className="mt-2.5 text-xs font-medium text-[#665043]">{item.note}</p>
                      )}
                    </div>

                    <div className="mt-6 border-t border-[#EFE7DC] pt-4">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2 tabular-nums">
                          <span className="text-xl font-bold text-[#2B1E16]">
                            {formatKRW(item.finalPrice)}
                          </span>
                          <span className="text-sm text-[#9A8577] line-through">
                            {formatKRW(item.originalPrice)}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-[#B85223]">
                          현장 결제
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => toggleMenuSelection(item.code)}
                        className={`mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                          isDisabled
                            ? 'cursor-not-allowed bg-[#EDE5DA] text-[#9A8577]'
                            : isSelected
                              ? 'bg-[#D95D24] text-white hover:bg-[#BE4E1B]'
                              : 'bg-[#FAF7F2] text-[#2B1E16] border border-[#D7C9B8] hover:bg-[#F2EAE0]'
                        }`}
                      >
                        {isSoldOut ? (
                          '선착순 마감'
                        ) : businessMode === 'CLOSED_HOURS' ? (
                          '영업시간 외 주문 불가'
                        ) : businessMode === 'DISCONNECTED' ? (
                          '연결 확인 필요'
                        ) : isSelected ? (
                          <>
                            <Check className="h-4 w-4" />
                            선택됨 (클릭 시 해제)
                          </>
                        ) : (
                          '이 메뉴 선택하기'
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-5 text-xs text-[#665043]">
            ※ 위 메뉴 이미지는 이해를 돕기 위해 제작된 AI 연출 이미지로, 실제 매장에서 제공되는 모습과 다를 수 있습니다.
          </p>
        </section>

        {/* Order Placement + Confirmation Section */}
        <section id="order-section" className="py-12 lg:py-16 border-b border-[#E6DCD0]">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            {/* Left: Checkout Form */}
            <div className="lg:col-span-7">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#2B1E16]">
                즉시 주문하기
              </h2>
              <p className="mt-1.5 text-sm text-[#523F34]">
                이름과 휴대전화번호를 입력하면 즉시 주문번호가 발급되며, 수령 시 매장에서 결제합니다.
              </p>

              <form
                onSubmit={handleOrderSubmit}
                className="mt-6 rounded-xl border border-[#E6DCD0] bg-white p-6 sm:p-7"
              >
                {/* Selected Summary */}
                <div className="border-b border-[#EFE7DC] pb-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#2B1E16]">
                      선택한 이벤트 메뉴 ({selectedItems.length}건)
                    </span>
                    {selectedItems.length > 0 && (
                      <span className="text-xs font-medium text-[#B85223] tabular-nums">
                        총 {formatKRW(selectedSavings)} 할인 적용
                      </span>
                    )}
                  </div>

                  {selectedItems.length === 0 ? (
                    <p className="mt-3 text-sm text-[#665043]">
                      위 메뉴 카드에서 주문하실 메뉴를 선택해 주세요. (1일 이벤트별 1개 선택 가능)
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-[#F3ECE1]">
                      {selectedItems.map((item) => (
                        <li
                          key={item.code}
                          className="flex items-center justify-between gap-4 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[#2B1E16] truncate">{item.name}</p>
                            <p className="text-xs text-[#665043]">수량 1 · 현장 결제</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-semibold text-[#2B1E16] tabular-nums">
                              {formatKRW(item.finalPrice)}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleMenuSelection(item.code)}
                              aria-label={`${item.name} 선택 해제`}
                              className="rounded p-1 text-[#665043] hover:bg-[#FAF7F2] hover:text-[#2B1E16]"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-4 flex items-baseline justify-between border-t border-[#EFE7DC] pt-4">
                    <span className="text-sm font-semibold text-[#5C493E]">
                      현장 결제 예정 금액
                    </span>
                    <span className="text-2xl font-bold text-[#2B1E16] tabular-nums">
                      {formatKRW(selectedTotal)}
                    </span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="customer-name"
                      className="block text-xs font-semibold text-[#4D3729]"
                    >
                      이름
                    </label>
                    <input
                      id="customer-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="예: 김투데이"
                      maxLength={30}
                      className="mt-1.5 w-full rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#2B1E16] placeholder:text-[#A38F82] focus:border-[#D95D24] focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="customer-phone"
                      className="block text-xs font-semibold text-[#4D3729]"
                    >
                      휴대전화번호
                    </label>
                    <input
                      id="customer-phone"
                      type="tel"
                      inputMode="numeric"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(normalizePhone(e.target.value))}
                      placeholder="010-0000-0000"
                      maxLength={13}
                      className="mt-1.5 w-full rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#2B1E16] placeholder:text-[#A38F82] tabular-nums focus:border-[#D95D24] focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Privacy Collection Notice (PRD §8) */}
                <div className="mt-5 rounded-lg border border-[#EAE0D3] bg-[#FAF7F2] p-4 text-xs leading-relaxed text-[#5C493E]">
                  <p className="font-semibold text-[#2B1E16]">개인정보 수집·이용 안내</p>
                  <p className="mt-1">
                    수집 항목: 이름, 휴대전화번호 · 수집 목적: 겨울 신메뉴 주문 접수, 준비 완료 알림, 1일 1회 중복 참여 확인 · 보유 기간: 이벤트 종료일(2026-12-15) 후 30일 이내 파기
                  </p>
                  <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#2B1E16]">
                    <input
                      type="checkbox"
                      checked={privacyAgreed}
                      onChange={(e) => setPrivacyAgreed(e.target.checked)}
                      className="h-4 w-4 rounded border-[#CBB6A0] accent-[#D95D24]"
                    />
                    <span>위 개인정보 수집 및 이용에 동의합니다. (필수)</span>
                  </label>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="mt-4 flex items-start gap-2 rounded-lg border border-[#E5B8A6] bg-[#FDF1EC] px-3.5 py-2.5 text-xs font-medium text-[#A6350C]"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={businessMode !== 'OPEN' || selectedItems.length === 0}
                  className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#D95D24] px-6 py-3 text-sm font-bold text-white hover:bg-[#BE4E1B] disabled:cursor-not-allowed disabled:bg-[#DFD4C7] disabled:text-[#8E7B6E] transition-colors whitespace-nowrap"
                >
                  {businessMode === 'CLOSED_HOURS'
                    ? '영업시간 외 신규 주문 마감'
                    : businessMode === 'DISCONNECTED'
                      ? '연결 복구 후 주문 가능'
                      : `${formatKRW(selectedTotal)} 현장결제 주문 확정하기`}
                </button>
              </form>
            </div>

            {/* Right: Order Confirmation & Live Status Tracker */}
            <div className="lg:col-span-5" id="order-confirmation-card">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#2B1E16]">
                주문 확인 및 진행 상태
              </h2>
              <p className="mt-1.5 text-sm text-[#523F34]">
                주문 완료 또는 조회 시 발급된 주문번호와 실시간 상태를 확인합니다.
              </p>

              {!activeOrder ? (
                <div className="mt-6 rounded-xl border border-[#E6DCD0] bg-white p-6 text-center sm:p-8">
                  <p className="text-sm font-semibold text-[#2B1E16]">
                    아직 선택된 주문이 없습니다
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-[#5C473A]">
                    왼쪽에서 주문을 확정하거나, 아래 기존 주문 조회에서 샘플 주문을 클릭해 상태별 화면을 미리 확인해 보세요.
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-[#E6DCD0] bg-white p-6">
                  <div className="flex items-start justify-between gap-4 border-b border-[#EFE7DC] pb-5">
                    <div>
                      <p className="text-xs font-medium text-[#5C473A]">
                        주문번호 (매장 수령 시 제시)
                      </p>
                      <p className="mt-1 font-mono-num text-4xl font-bold tracking-tight text-[#2B1E16]">
                        {activeOrder.orderNumber}
                      </p>
                      <p className="mt-1.5 text-xs text-[#523F34] tabular-nums">
                        {activeOrder.customerName} · {activeOrder.phoneNormalized} · {activeOrder.createdTimeLabel} 접수
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${
                        ORDER_STATUS_META[activeOrder.status].toneClass
                      }`}
                    >
                      {ORDER_STATUS_META[activeOrder.status].label}
                    </span>
                  </div>

                  {/* Ready Notification Banner */}
                  {activeOrder.status === 'READY' && (
                    <div
                      role="status"
                      className="mt-4 rounded-lg border border-[#F0BFA8] bg-[#FCEAE2] p-4 text-sm text-[#8E2F0B]"
                    >
                      <p className="font-bold">메뉴 준비가 완료되었습니다</p>
                      <p className="mt-1 text-xs leading-relaxed">
                        메인로비 1층 TODAY CAFE 카운터에서 주문번호{' '}
                        <strong className="font-mono-num">{activeOrder.orderNumber}</strong>를
                        보여주시고 {formatKRW(activeOrder.totalAmount)} 현장 결제 후 수령해 주세요.
                      </p>
                    </div>
                  )}

                  {/* 4-Step Progress Bar */}
                  {activeOrder.status !== 'CANCELLED' ? (
                    <div className="mt-5">
                      <div className="grid grid-cols-4 gap-2">
                        {STEPS.map((stepLabel, idx) => {
                          const currentIdx = ORDER_STATUS_META[activeOrder.status].stepIndex;
                          const isDone = idx <= currentIdx;
                          return (
                            <div key={stepLabel} className="text-center">
                              <div
                                className={`h-1.5 w-full rounded-full ${
                                  isDone ? 'bg-[#D95D24]' : 'bg-[#EFE7DC]'
                                }`}
                              />
                              <p
                                className={`mt-2 text-xs ${
                                  isDone
                                    ? 'font-semibold text-[#2B1E16]'
                                    : 'text-[#9A8577]'
                                }`}
                              >
                                {stepLabel}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs text-[#523F34]">
                        {ORDER_STATUS_META[activeOrder.status].description}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-[#DDD2C5] bg-[#F5F1EB] p-3.5 text-xs text-[#5C493E]">
                      {activeOrder.cancelledAt
                        ? `${activeOrder.cancelledAt}에 취소 처리된 주문입니다. 잔여 인원이 있는 경우 동일 메뉴 재주문이 가능합니다.`
                        : '취소된 주문입니다.'}
                    </div>
                  )}

                  {/* Ordered Items */}
                  <div className="mt-5 border-t border-[#EFE7DC] pt-4">
                    <p className="text-xs font-semibold text-[#523F34]">주문 내역</p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {activeOrder.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-2 text-[#2B1E16]"
                        >
                          <span className="truncate">{item.itemName} (1개)</span>
                          <span className="font-medium tabular-nums shrink-0">
                            {formatKRW(item.unitFinalPrice)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-baseline justify-between border-t border-[#F3ECE1] pt-3 text-sm">
                      <span className="font-semibold text-[#5C493E]">현장 결제 예정 금액</span>
                      <span className="text-lg font-bold text-[#2B1E16] tabular-nums">
                        {formatKRW(activeOrder.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Notification Preferences (PRD §5.3) */}
                  {activeOrder.status !== 'COMPLETED' &&
                    activeOrder.status !== 'CANCELLED' && (
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE7DC] pt-4 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            const next = !soundEnabled;
                            setSoundEnabled(next);
                            if (next) playCafeChime('customer_ready');
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                            soundEnabled
                              ? 'border-[#D95D24]/40 bg-[#FDF3EE] text-[#B85223]'
                              : 'border-[#DDD2C5] bg-[#FAF7F2] text-[#523F34]'
                          }`}
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          준비 완료 소리 {soundEnabled ? '켜짐' : '꺼짐'}
                        </button>

                        <button
                          type="button"
                          onClick={requestBrowserNotification}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDD2C5] bg-[#FAF7F2] px-3 py-1.5 font-medium text-[#5C493E] hover:bg-[#F2EAE0] whitespace-nowrap"
                        >
                          <Bell className="h-3.5 w-3.5" />
                          {browserNotifyState === 'granted'
                            ? '브라우저 알림 허용됨'
                            : browserNotifyState === 'denied'
                              ? '브라우저 알림 차단됨'
                              : '브라우저 알림 켜기'}
                        </button>
                      </div>
                    )}

                  {/* Customer Direct Cancel — ONLY in RECEIVED status (PRD §6.3) */}
                  <div className="mt-5 border-t border-[#EFE7DC] pt-4">
                    {activeOrder.status === 'RECEIVED' ? (
                      confirmingCancelId === activeOrder.internalId ? (
                        <div className="rounded-lg border border-[#E5B8A6] bg-[#FDF1EC] p-3.5 text-xs">
                          <p className="font-semibold text-[#8E2F0B]">
                            주문을 취소하시겠습니까?
                          </p>
                          <p className="mt-1 text-[#7A442E]">
                            취소 후에도 관리자 복구 승인 전까지 기존 선착순 인원은 즉시 반환되지 않습니다.
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const res = onCancelOrder(activeOrder.internalId);
                                setConfirmingCancelId(null);
                                setCancelFeedback(res.message);
                              }}
                              className="rounded-lg bg-[#C24112] px-3 py-1.5 font-semibold text-white hover:bg-[#A6350C] whitespace-nowrap"
                            >
                              취소 확정
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingCancelId(null)}
                              className="rounded-lg border border-[#D7C9B8] bg-white px-3 py-1.5 font-medium text-[#5C493E] hover:bg-[#FAF7F2] whitespace-nowrap"
                            >
                              돌아가기
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingCancelId(activeOrder.internalId)}
                          className="flex min-h-[40px] w-full items-center justify-center rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-4 py-2 text-xs font-semibold text-[#523F34] hover:border-[#C24112] hover:text-[#C24112] transition-colors whitespace-nowrap"
                        >
                          접수 상태 주문 직접 취소하기
                        </button>
                      )
                    ) : activeOrder.status === 'PREPARING' ||
                      activeOrder.status === 'READY' ? (
                      <p className="text-xs text-[#665043]">
                        매장에서 메뉴 준비가 시작되어 고객 직접 취소가 불가합니다. 문의는 메인로비 1층 매장에 말씀해 주세요.
                      </p>
                    ) : null}

                    {cancelFeedback && (
                      <p className="mt-2.5 text-xs font-medium text-[#8E2F0B]">
                        {cancelFeedback}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Order Lookup Section */}
        <section id="lookup-section" className="py-12 lg:py-16 border-b border-[#E6DCD0]">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5">
              <h2 className="font-display text-2xl font-bold tracking-tight text-[#2B1E16]">
                기존 주문 조회
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#523F34]">
                주문 시 입력한 휴대전화번호와 발급된 주문번호(예: 1201-005)를 입력하면
                진행 상태 확인 및 접수 상태 주문 취소가 가능합니다.
              </p>

              {/* Sample Quick Buttons for Preview Inspection */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-[#5C473A]">
                  미리보기 샘플 주문 바로 불러오기
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {orders.slice(0, 4).map((sample) => (
                    <button
                      key={sample.internalId}
                      type="button"
                      onClick={() => handleQuickLookup(sample)}
                      className="rounded-lg border border-[#DDD2C5] bg-white px-3 py-1.5 text-xs font-medium text-[#4D3729] hover:border-[#D95D24] hover:text-[#D95D24] transition-colors tabular-nums whitespace-nowrap"
                    >
                      {sample.orderNumber} ({ORDER_STATUS_META[sample.status].label})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <form
              onSubmit={handleLookupSubmit}
              className="rounded-xl border border-[#E6DCD0] bg-white p-6 lg:col-span-7"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="lookup-phone"
                    className="block text-xs font-semibold text-[#4D3729]"
                  >
                    휴대전화번호
                  </label>
                  <input
                    id="lookup-phone"
                    type="tel"
                    inputMode="numeric"
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(normalizePhone(e.target.value))}
                    placeholder="010-1122-3344"
                    maxLength={13}
                    className="mt-1.5 w-full rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#2B1E16] tabular-nums focus:border-[#D95D24] focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="lookup-order-no"
                    className="block text-xs font-semibold text-[#4D3729]"
                  >
                    주문번호
                  </label>
                  <input
                    id="lookup-order-no"
                    type="text"
                    value={lookupOrderNo}
                    onChange={(e) => setLookupOrderNo(e.target.value)}
                    placeholder="예: 1201-005"
                    className="mt-1.5 w-full rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-3.5 py-2.5 text-sm font-mono-num text-[#2B1E16] focus:border-[#D95D24] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {lookupError && (
                <p role="alert" className="mt-3 text-xs font-medium text-[#C24112]">
                  {lookupError}
                </p>
              )}

              <button
                type="submit"
                className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#2B1E16] px-5 py-2.5 text-sm font-semibold text-[#FAF7F2] hover:bg-[#412E23] transition-colors whitespace-nowrap"
              >
                <Search className="h-4 w-4" />
                주문 내역 조회하기
              </button>
            </form>
          </div>
        </section>

        {/* Visit & Policy Section */}
        <section id="visit-section" className="py-12 lg:py-16">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[#2B1E16]">
            매장 방문 및 이용 안내
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[#E6DCD0] bg-white p-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#B85223]">
                <MapPin className="h-4 w-4" />
                <span>위치</span>
              </div>
              <p className="mt-2 text-base font-bold text-[#2B1E16]">메인로비 1층 TODAY CAFE</p>
              <p className="mt-1 text-xs leading-relaxed text-[#523F34]">
                사내 직원 및 외부 방문객 모두 이용 가능합니다.
              </p>
            </div>

            <div className="rounded-xl border border-[#E6DCD0] bg-white p-5">
              <p className="text-xs font-semibold text-[#B85223]">이벤트 기간</p>
              <p className="mt-2 text-base font-bold text-[#2B1E16] tabular-nums">
                2026.12.01 — 12.15
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#523F34]">
                당일 미사용 잔여 인원은 다음 영업일로 이월되지 않습니다.
              </p>
            </div>

            <div className="rounded-xl border border-[#E6DCD0] bg-white p-5">
              <p className="text-xs font-semibold text-[#B85223]">주문 접수 시간</p>
              <p className="mt-2 text-base font-bold text-[#2B1E16] tabular-nums">
                영업일 08:00 — 19:00
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#523F34]">
                주말 및 법정 공휴일은 휴무이며, 19:00 정각 주문 접수가 마감됩니다.
              </p>
            </div>

            <div className="rounded-xl border border-[#E6DCD0] bg-white p-5">
              <p className="text-xs font-semibold text-[#B85223]">결제 및 취소 기준</p>
              <p className="mt-2 text-base font-bold text-[#2B1E16]">100% 카페 현장 결제</p>
              <p className="mt-1 text-xs leading-relaxed text-[#523F34]">
                준비 시작 전(접수 상태)에만 고객 직접 취소가 가능합니다.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E6DCD0] bg-[#F3ECE1] py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col justify-between gap-4 px-4 text-xs text-[#523F34] sm:flex-row sm:items-center sm:px-6">
          <div>
            <span className="font-display font-bold text-[#2B1E16]">TODAY CAFE</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>메인로비 1층 · 2026 겨울 신메뉴 프로모션</span>
          </div>
          <p>이벤트 종료일(2026-12-15) 후 30일 이내 수집된 고객 개인정보를 파기합니다.</p>
        </div>
      </footer>
    </div>
  );
}

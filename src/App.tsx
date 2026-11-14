import { useState } from 'react';
import { AdminView } from './components/AdminView';
import { CustomerView } from './components/CustomerView';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_ORDERS,
  INITIAL_QUOTAS,
  MENU_ITEMS,
  PREVIEW_BUSINESS_DATE,
  PREVIEW_ORDER_PREFIX,
} from './data/initialPreviewData';
import type {
  AuditLogRecord,
  BusinessSimulationMode,
  DailyEventQuota,
  EventCode,
  OrderRecord,
  OrderStatus,
} from './types/cafe';
import { ORDER_STATUS_META } from './utils/format';

function getCurrentTimeHHMMSS(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function App() {
  const [viewMode, setViewMode] = useState<'customer' | 'admin'>('customer');
  const [businessMode, setBusinessMode] = useState<BusinessSimulationMode>('OPEN');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('09:24:10');

  const [quotas, setQuotas] = useState<DailyEventQuota[]>(INITIAL_QUOTAS);
  const [orders, setOrders] = useState<OrderRecord[]>(INITIAL_ORDERS);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(INITIAL_AUDIT_LOGS);
  const [nextSeq, setNextSeq] = useState<number>(6);

  const [activeCustomerOrderId, setActiveCustomerOrderId] = useState<string | null>(
    INITIAL_ORDERS[0].internalId,
  );
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(true);
  const [adminId, setAdminId] = useState<string>('today_admin');
  const [latestOrderPopup, setLatestOrderPopup] = useState<OrderRecord | null>(null);

  const appendAuditLog = (entry: Omit<AuditLogRecord, 'id' | 'timestamp'>) => {
    const newLog: AuditLogRecord = {
      id: `LOG-${Date.now().toString().slice(-5)}`,
      timestamp: `${PREVIEW_BUSINESS_DATE} ${getCurrentTimeHHMMSS()}`,
      ...entry,
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const handlePlaceOrder = (payload: {
    customerName: string;
    phoneNormalized: string;
    selectedCodes: EventCode[];
  }): { ok: true; order: OrderRecord } | { ok: false; message: string } => {
    // 1. Check duplicate active participation (phoneNormalized + businessDate + eventCode)
    const activePhoneOrders = orders.filter(
      (o) =>
        o.businessDate === PREVIEW_BUSINESS_DATE &&
        o.phoneNormalized === payload.phoneNormalized &&
        o.status !== 'CANCELLED',
    );

    for (const code of payload.selectedCodes) {
      const alreadyOrdered = activePhoneOrders.some((o) =>
        o.items.some((item) => item.eventCode === code),
      );
      if (alreadyOrdered) {
        const menuName = MENU_ITEMS.find((m) => m.code === code)?.name ?? code;
        return {
          ok: false,
          message: `해당 번호로 오늘 이미 "${menuName}" 주문 내역이 있습니다. 이벤트별 1일 1회만 주문 가능합니다.`,
        };
      }
    }

    // 2. Check all selected quotas atomically (All-or-Nothing)
    for (const code of payload.selectedCodes) {
      const q = quotas.find((item) => item.eventCode === code);
      const remaining = q ? q.limit - q.consumed + q.restored : 0;
      if (remaining <= 0) {
        const menuName = MENU_ITEMS.find((m) => m.code === code)?.name ?? code;
        return {
          ok: false,
          message: `"${menuName}"의 오늘 선착순 인원이 모두 마감되었습니다. 수량을 다시 확인해 주세요.`,
        };
      }
    }

    const seqStr = String(nextSeq).padStart(3, '0');
    const orderNumber = `${PREVIEW_ORDER_PREFIX}-${seqStr}`;
    const timeLabel = getCurrentTimeHHMM();
    const syncTime = getCurrentTimeHHMMSS();

    const items = payload.selectedCodes.map((code, idx) => {
      const spec = MENU_ITEMS.find((m) => m.code === code)!;
      return {
        id: `ITEM-${seqStr}-${idx + 1}`,
        eventCode: code,
        itemName: spec.name,
        quantity: 1 as const,
        unitFinalPrice: spec.finalPrice,
        slotStatus: 'ALLOCATED' as const,
      };
    });

    const newOrder: OrderRecord = {
      internalId: `ORD-2026-${PREVIEW_ORDER_PREFIX}-${seqStr}`,
      orderNumber,
      businessDate: PREVIEW_BUSINESS_DATE,
      createdAt: new Date().toISOString(),
      createdTimeLabel: timeLabel,
      customerName: payload.customerName,
      phoneNormalized: payload.phoneNormalized,
      totalAmount: items.reduce((sum, i) => sum + i.unitFinalPrice, 0),
      status: 'RECEIVED',
      items,
    };

    // Update quotas & orders atomically
    setQuotas((prev) =>
      prev.map((q) =>
        payload.selectedCodes.includes(q.eventCode)
          ? { ...q, consumed: q.consumed + 1, updatedAt: syncTime }
          : q,
      ),
    );
    setOrders((prev) => [newOrder, ...prev]);
    setNextSeq((prev) => prev + 1);
    setLastSyncedAt(syncTime);
    setLatestOrderPopup(newOrder);

    return { ok: true, order: newOrder };
  };

  const handleCancelOrder = (orderId: string): { ok: boolean; message: string } => {
    const target = orders.find((o) => o.internalId === orderId);
    if (!target) {
      return { ok: false, message: '주문 내역을 찾을 수 없습니다.' };
    }
    if (target.status !== 'RECEIVED') {
      return {
        ok: false,
        message: '이미 준비가 시작되어 고객 직접 취소가 불가합니다.',
      };
    }

    const cancelTime = getCurrentTimeHHMM();
    setOrders((prev) =>
      prev.map((o) =>
        o.internalId === orderId
          ? {
              ...o,
              status: 'CANCELLED',
              cancelledAt: cancelTime,
              items: o.items.map((item) => ({
                ...item,
                slotStatus: 'CANCELLED_UNRESTORED',
              })),
            }
          : o,
      ),
    );

    return {
      ok: true,
      message: '주문이 취소되었습니다. 선착순 잔여 인원은 관리자 복구 승인 시 반영됩니다.',
    };
  };

  const handleUpdateOrderStatus = (
    orderId: string,
    nextStatus: OrderStatus,
    reason: string,
  ) => {
    const target = orders.find((o) => o.internalId === orderId);
    if (!target || target.status === nextStatus) return;

    const prevLabel = ORDER_STATUS_META[target.status].label;
    const nextLabel = ORDER_STATUS_META[nextStatus].label;
    const nowTime = getCurrentTimeHHMM();

    setOrders((prev) =>
      prev.map((o) =>
        o.internalId === orderId
          ? {
              ...o,
              status: nextStatus,
              completedAt: nextStatus === 'COMPLETED' ? nowTime : o.completedAt,
            }
          : o,
      ),
    );

    appendAuditLog({
      adminId,
      actionType: 'STATUS_CHANGE',
      targetLabel: `주문 ${target.orderNumber}`,
      beforeValue: prevLabel,
      afterValue: nextLabel,
      reason,
    });
  };

  const handleRestoreQuotaItem = (
    orderId: string,
    itemId: string,
    eventCode: EventCode,
    reason: string,
  ): { ok: boolean; message: string } => {
    const targetOrder = orders.find((o) => o.internalId === orderId);
    const targetItem = targetOrder?.items.find((i) => i.id === itemId);
    if (!targetOrder || !targetItem) {
      return { ok: false, message: '복구할 취소 항목을 찾지 못했습니다.' };
    }
    if (targetItem.slotStatus === 'RESTORED') {
      return { ok: false, message: '이미 복구 승인된 항목입니다 (중복 복구 불가).' };
    }

    const q = quotas.find((item) => item.eventCode === eventCode);
    if (!q) {
      return { ok: false, message: '이벤트 수량 정보를 찾지 못했습니다.' };
    }

    const prevRemaining = Math.max(0, q.limit - q.consumed + q.restored);
    const nextRemaining = Math.min(q.limit, prevRemaining + 1);
    const syncTime = getCurrentTimeHHMMSS();

    setQuotas((prev) =>
      prev.map((item) =>
        item.eventCode === eventCode
          ? {
              ...item,
              restored: Math.min(item.consumed, item.restored + 1),
              updatedAt: syncTime,
            }
          : item,
      ),
    );

    setOrders((prev) =>
      prev.map((o) =>
        o.internalId === orderId
          ? {
              ...o,
              items: o.items.map((item) =>
                item.id === itemId ? { ...item, slotStatus: 'RESTORED' } : item,
              ),
            }
          : o,
      ),
    );

    setLastSyncedAt(syncTime);

    appendAuditLog({
      adminId,
      actionType: 'QUOTA_RESTORE',
      targetLabel: `주문 ${targetOrder.orderNumber} · ${targetItem.itemName}`,
      beforeValue: `잔여 ${prevRemaining}명`,
      afterValue: `잔여 ${nextRemaining}명`,
      reason,
    });

    return {
      ok: true,
      message: `${targetItem.itemName} 잔여 수량이 1명 복구되었습니다 (현재 잔여 ${nextRemaining}명).`,
    };
  };

  const handleResolveUncollected = (
    orderId: string,
    resolution: 'COMPLETED' | 'KEPT_CLOSED',
  ) => {
    const target = orders.find((o) => o.internalId === orderId);
    if (!target) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.internalId === orderId
          ? {
              ...o,
              markedUncollected: false,
              status: resolution === 'COMPLETED' ? 'COMPLETED' : o.status,
              uncollectedNote: '관리자 미수령 확인 완료',
            }
          : o,
      ),
    );

    appendAuditLog({
      adminId,
      actionType: 'UNCOLLECTED_HANDLED',
      targetLabel: `미수령 주문 ${target.orderNumber}`,
      beforeValue: `${ORDER_STATUS_META[target.status].label} (미수령)`,
      afterValue: '미수령 확인 종결',
      reason: '19:00 이후 미수령 건 관리자 확인 처리 (자동 복구 없음)',
    });
  };

  const handleSimulateIncomingOrder = () => {
    const sampleNames = ['강민준', '윤서아', '임도현', '한지민'];
    const idx = nextSeq % sampleNames.length;
    const phoneSuffix = String(1000 + nextSeq * 111).slice(0, 4);

    const availableQuota = quotas.find(
      (q) => q.limit - q.consumed + q.restored > 0,
    );
    if (!availableQuota) return;

    const res = handlePlaceOrder({
      customerName: sampleNames[idx],
      phoneNormalized: `010-77${String(nextSeq).padStart(2, '0')}-${phoneSuffix}`,
      selectedCodes: [availableQuota.eventCode],
    });

    if (res.ok) {
      setLatestOrderPopup(res.order);
    }
  };

  const handleSetSoldOutPreview = () => {
    const syncTime = getCurrentTimeHHMMSS();
    setQuotas((prev) =>
      prev.map((q) =>
        q.eventCode === 'PERSIMMON_LATTE'
          ? { ...q, consumed: 20, restored: 0, updatedAt: syncTime }
          : q.eventCode === 'SET'
            ? { ...q, consumed: 19, restored: 0, updatedAt: syncTime }
            : q,
      ),
    );
    setBusinessMode('OPEN');
    setLastSyncedAt(syncTime);
  };

  const handleResetPreview = () => {
    setQuotas(INITIAL_QUOTAS);
    setOrders(INITIAL_ORDERS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setNextSeq(6);
    setBusinessMode('OPEN');
    setLastSyncedAt('09:24:10');
    setActiveCustomerOrderId(INITIAL_ORDERS[0].internalId);
    setLatestOrderPopup(null);
  };

  return (
    <div>
      {/* Preview Switcher Strip (Frontend-Only Prototype Controls) */}
      <div className="border-b border-[#3D2C22] bg-[#2B1E16] text-[#FAF7F2]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#F5A87E] whitespace-nowrap">
              화면 미리보기
            </span>
            <div className="flex items-center gap-1 rounded-md bg-[#1F150F] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('customer')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'customer'
                    ? 'bg-[#D95D24] text-white'
                    : 'text-[#CFC3B7] hover:text-white'
                }`}
              >
                고객 페이지
              </button>
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'admin'
                    ? 'bg-[#D95D24] text-white'
                    : 'text-[#CFC3B7] hover:text-white'
                }`}
              >
                관리자 대시보드
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="hidden text-[#B9A798] sm:inline whitespace-nowrap">
              상태 시뮬레이션:
            </span>
            <button
              type="button"
              onClick={() => {
                setBusinessMode('OPEN');
                setLastSyncedAt(getCurrentTimeHHMMSS());
              }}
              className={`rounded px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                businessMode === 'OPEN'
                  ? 'bg-[#463327] font-semibold text-white'
                  : 'text-[#CFC3B7] hover:bg-[#3B2A20]'
              }`}
            >
              영업 중
            </button>
            <button
              type="button"
              onClick={() => setBusinessMode('CLOSED_HOURS')}
              className={`rounded px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                businessMode === 'CLOSED_HOURS'
                  ? 'bg-[#463327] font-semibold text-white'
                  : 'text-[#CFC3B7] hover:bg-[#3B2A20]'
              }`}
            >
              19시 이후 마감
            </button>
            <button
              type="button"
              onClick={() => setBusinessMode('DISCONNECTED')}
              className={`rounded px-2.5 py-1 text-xs transition-colors whitespace-nowrap shrink-0 ${
                businessMode === 'DISCONNECTED'
                  ? 'bg-[#463327] font-semibold text-white'
                  : 'text-[#CFC3B7] hover:bg-[#3B2A20]'
              }`}
            >
              연결 끊김
            </button>
            <button
              type="button"
              onClick={handleSetSoldOutPreview}
              className="rounded px-2.5 py-1 text-xs text-[#F5C6A8] hover:bg-[#3B2A20] transition-colors whitespace-nowrap shrink-0"
            >
              마감/1자리 체험
            </button>
            <button
              type="button"
              onClick={handleResetPreview}
              className="rounded border border-[#544034] px-2.5 py-1 text-xs text-[#CFC3B7] hover:bg-[#3B2A20] hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              초기화
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'customer' ? (
        <CustomerView
          quotas={quotas}
          orders={orders}
          businessMode={businessMode}
          lastSyncedAt={lastSyncedAt}
          activeCustomerOrderId={activeCustomerOrderId}
          onSelectActiveOrderId={setActiveCustomerOrderId}
          onPlaceOrder={handlePlaceOrder}
          onCancelOrder={handleCancelOrder}
          onRefreshSync={() => {
            setBusinessMode('OPEN');
            setLastSyncedAt(getCurrentTimeHHMMSS());
          }}
        />
      ) : (
        <AdminView
          isAuthenticated={isAdminAuthenticated}
          adminId={adminId}
          quotas={quotas}
          orders={orders}
          auditLogs={auditLogs}
          latestOrderPopup={latestOrderPopup}
          onDismissPopup={() => setLatestOrderPopup(null)}
          onLogin={(id, pw) => {
            if (id === 'today_admin' && pw === 'today2026') {
              setAdminId(id);
              setIsAdminAuthenticated(true);
              appendAuditLog({
                adminId: id,
                actionType: 'ADMIN_LOGIN',
                targetLabel: '관리자 세션',
                beforeValue: '로그아웃',
                afterValue: '로그인 성공',
                reason: '관리자 대시보드 접속',
              });
              return { ok: true };
            }
            return { ok: false, message: 'ID 또는 비밀번호가 일치하지 않습니다.' };
          }}
          onLogout={() => setIsAdminAuthenticated(false)}
          onUpdateOrderStatus={handleUpdateOrderStatus}
          onRestoreQuotaItem={handleRestoreQuotaItem}
          onResolveUncollected={handleResolveUncollected}
          onSimulateIncomingOrder={handleSimulateIncomingOrder}
        />
      )}
    </div>
  );
}

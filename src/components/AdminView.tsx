import { useState, type FormEvent } from 'react';
import {
  BellRing,
  CheckCircle2,
  ClipboardList,
  Lock,
  LogOut,
  Plus,
  RotateCcw,
  Volume2,
  X,
} from 'lucide-react';
import { MENU_ITEMS, PREVIEW_BUSINESS_DATE } from '../data/initialPreviewData';
import type {
  AuditLogRecord,
  DailyEventQuota,
  EventCode,
  OrderRecord,
  OrderStatus,
} from '../types/cafe';
import { formatKRW, maskPhone, ORDER_STATUS_META } from '../utils/format';
import { playCafeChime } from '../utils/sound';
import { AdminSummaryDashboard } from './AdminSummaryDashboard';

type AdminTab =
  | 'ALL'
  | OrderStatus
  | 'UNCOLLECTED'
  | 'AUDIT_LOGS';

interface AdminViewProps {
  isAuthenticated: boolean;
  adminId: string;
  quotas: DailyEventQuota[];
  orders: OrderRecord[];
  auditLogs: AuditLogRecord[];
  latestOrderPopup: OrderRecord | null;
  onDismissPopup: () => void;
  onLogin: (id: string, password: string) => { ok: boolean; message?: string };
  onLogout: () => void;
  onUpdateOrderStatus: (orderId: string, nextStatus: OrderStatus, reason: string) => void;
  onRestoreQuotaItem: (
    orderId: string,
    itemId: string,
    eventCode: EventCode,
    reason: string,
  ) => { ok: boolean; message: string };
  onResolveUncollected: (orderId: string, resolution: 'COMPLETED' | 'KEPT_CLOSED') => void;
  onSimulateIncomingOrder: () => void;
}

export function AdminView({
  isAuthenticated,
  adminId,
  quotas,
  orders,
  auditLogs,
  latestOrderPopup,
  onDismissPopup,
  onLogin,
  onLogout,
  onUpdateOrderStatus,
  onRestoreQuotaItem,
  onResolveUncollected,
  onSimulateIncomingOrder,
}: AdminViewProps) {
  const [loginId, setLoginId] = useState('today_admin');
  const [loginPw, setLoginPw] = useState('today2026');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('ALL');
  const [adminSoundEnabled, setAdminSoundEnabled] = useState(true);
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);
  const [restoringTarget, setRestoringTarget] = useState<{
    orderId: string;
    itemId: string;
    eventCode: EventCode;
    itemName: string;
    orderNumber: string;
  } | null>(null);
  const [restoreReason, setRestoreReason] = useState('고객 취소 확인 후 당일 선착순 수량 복구 승인');

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = onLogin(loginId.trim(), loginPw);
    if (!res.ok) {
      setLoginError(res.message || '로그인 정보를 확인해 주세요.');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-44px)] bg-[#F5F2ED] px-4 py-16 text-[#2B1E16]">
        <div className="mx-auto max-w-md rounded-xl border border-[#DFD5C7] bg-white p-7 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#B85223]">
            <Lock className="h-4 w-4" />
            <span>TODAY CAFE 관리자 인증</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-[#2B1E16]">
            매장 주문 관리 로그인
          </h1>
          <p className="mt-1.5 text-xs leading-relaxed text-[#6E5A4F]">
            실제 운영 환경에서는 서버 권한 검증 및 일방향 해시 비밀번호 인증이 적용됩니다.
            프리뷰에서는 기본 입력된 데모 계정으로 바로 체험하실 수 있습니다.
          </p>

          <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="admin-id" className="block text-xs font-semibold text-[#4D3729]">
                관리자 ID
              </label>
              <input
                id="admin-id"
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#2B1E16] focus:border-[#D95D24] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="admin-pw" className="block text-xs font-semibold text-[#4D3729]">
                비밀번호
              </label>
              <input
                id="admin-pw"
                type="password"
                value={loginPw}
                onChange={(e) => setLoginPw(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#2B1E16] focus:border-[#D95D24] focus:bg-white focus:outline-none"
              />
            </div>

            {loginError && (
              <p role="alert" className="text-xs font-medium text-[#C24112]">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#2B1E16] px-5 py-2.5 text-sm font-semibold text-[#FAF7F2] hover:bg-[#412E23] transition-colors whitespace-nowrap"
            >
              관리자 대시보드 열기
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-[#8A7365] tabular-nums">
            데모 계정: today_admin / today2026
          </p>
        </div>
      </div>
    );
  }

  const uncollectedOrders = orders.filter(
    (o) => o.markedUncollected && o.status !== 'COMPLETED' && o.status !== 'CANCELLED',
  );

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'UNCOLLECTED') {
      return order.markedUncollected && order.status !== 'COMPLETED' && order.status !== 'CANCELLED';
    }
    if (activeTab === 'AUDIT_LOGS') return false;
    return order.status === activeTab;
  });

  const countByStatus = (status: OrderStatus) =>
    orders.filter((o) => o.status === status).length;

  return (
    <div className="min-h-[calc(100vh-44px)] bg-[#F5F2ED] text-[#2B1E16]">
      {/* Real-time New Order Popup (PRD §6.2) */}
      {latestOrderPopup && (
        <div
          role="dialog"
          aria-label="신규 주문 알림"
          className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-sm rounded-xl border border-[#D95D24] bg-white p-5 shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D95D24]">
              <BellRing className="h-4 w-4" />
              <span>신규 주문이 접수되었습니다</span>
            </div>
            <button
              type="button"
              onClick={onDismissPopup}
              aria-label="신규 주문 팝업 닫기"
              className="rounded p-1 text-[#8A7365] hover:bg-[#FAF7F2] hover:text-[#2B1E16]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 font-mono-num text-2xl font-bold text-[#2B1E16]">
            {latestOrderPopup.orderNumber}
          </p>
          <p className="mt-1 text-xs text-[#5C493E]">
            {latestOrderPopup.customerName} ({maskPhone(latestOrderPopup.phoneNormalized)}) ·{' '}
            {formatKRW(latestOrderPopup.totalAmount)}
          </p>
          <ul className="mt-2.5 space-y-1 border-t border-[#EFE7DC] pt-2.5 text-xs text-[#2B1E16]">
            {latestOrderPopup.items.map((item) => (
              <li key={item.id}>• {item.itemName} (1개)</li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onUpdateOrderStatus(
                  latestOrderPopup.internalId,
                  'PREPARING',
                  '신규 주문 팝업에서 즉시 준비 시작',
                );
                onDismissPopup();
              }}
              className="flex-1 rounded-lg bg-[#D95D24] px-3 py-2 text-xs font-semibold text-white hover:bg-[#BE4E1B] whitespace-nowrap"
            >
              준비 시작하기
            </button>
            <button
              type="button"
              onClick={onDismissPopup}
              className="rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-3 py-2 text-xs font-medium text-[#5C493E] hover:bg-[#EFE7DC] whitespace-nowrap"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Admin Top Header */}
      <header className="border-b border-[#DFD5C7] bg-white">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-bold text-[#2B1E16] whitespace-nowrap">
              TODAY CAFE 관리자
            </span>
            <span className="text-xs text-[#8A7365] whitespace-nowrap tabular-nums">
              영업일 {PREVIEW_BUSINESS_DATE} · 담당자 {adminId}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const next = !adminSoundEnabled;
                setAdminSoundEnabled(next);
                if (next) playCafeChime('admin_new_order');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                adminSoundEnabled
                  ? 'border-[#D95D24]/40 bg-[#FDF3EE] text-[#B85223]'
                  : 'border-[#D7C9B8] bg-[#FAF7F2] text-[#6E5A4F]'
              }`}
            >
              <Volume2 className="h-3.5 w-3.5" />
              알림음 {adminSoundEnabled ? '켜짐' : '꺼짐'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (adminSoundEnabled) playCafeChime('admin_new_order');
                onSimulateIncomingOrder();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#D95D24] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#BE4E1B] transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              테스트 신규 주문 발생
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7C9B8] bg-white px-3 py-1.5 text-xs font-medium text-[#5C493E] hover:bg-[#FAF7F2] whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
        {/* Daily Quota Summary Row (PRD §6.2 & §3.1 fixed 20 cap) */}
        <section aria-label="당일 이벤트 선착순 현황">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <h1 className="font-display text-xl font-bold text-[#2B1E16]">
              오늘의 이벤트별 선착순 현황
            </h1>
            <p className="text-xs text-[#7A6254]">
              일일 한도는 이벤트별 20명 고정이며, 취소 수량은 관리자 복구 승인 시에만 즉시 반환됩니다.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {MENU_ITEMS.map((menu) => {
              const q = quotas.find((item) => item.eventCode === menu.code);
              const limit = q?.limit ?? 20;
              const consumed = q?.consumed ?? 0;
              const restored = q?.restored ?? 0;
              const netUsed = Math.max(0, consumed - restored);
              const remaining = Math.max(0, Math.min(limit, limit - consumed + restored));

              return (
                <div
                  key={menu.code}
                  className="rounded-xl border border-[#DFD5C7] bg-white p-5"
                >
                  <p className="text-sm font-bold text-[#2B1E16] truncate">{menu.name}</p>
                  <div className="mt-3 flex items-baseline justify-between tabular-nums">
                    <div>
                      <span className="text-xs text-[#7A6254]">현재 잔여</span>
                      <p className="mt-0.5 text-2xl font-bold text-[#D95D24]">
                        {remaining}
                        <span className="text-sm font-normal text-[#8A7365]"> / {limit}명</span>
                      </p>
                    </div>
                    <div className="text-right text-xs text-[#6E5A4F]">
                      <p>당일 사용: {netUsed}명</p>
                      <p className="mt-0.5">복구 승인: {restored}건</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Performance Summary Dashboard (Recharts) */}
        <AdminSummaryDashboard orders={orders} />

        {/* Restore Inline Modal/Panel */}
        {restoringTarget && (
          <div
            role="dialog"
            aria-label="취소 주문 수량 복구 승인"
            className="mt-6 rounded-xl border border-[#D95D24] bg-white p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-[#2B1E16]">
                  취소 수량 복구 승인 — 주문 {restoringTarget.orderNumber}
                </h2>
                <p className="mt-1 text-xs text-[#6E5A4F]">
                  대상 메뉴: <strong>{restoringTarget.itemName}</strong> · 승인 즉시 당일 잔여 수량이 +1 증가하며 감사 로그에 기록됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRestoringTarget(null)}
                className="rounded p-1 text-[#8A7365] hover:bg-[#FAF7F2]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={restoreReason}
                onChange={(e) => setRestoreReason(e.target.value)}
                placeholder="복구 사유 입력 (감사 로그 기록용)"
                className="flex-1 rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-3.5 py-2 text-xs text-[#2B1E16] focus:border-[#D95D24] focus:bg-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const res = onRestoreQuotaItem(
                    restoringTarget.orderId,
                    restoringTarget.itemId,
                    restoringTarget.eventCode,
                    restoreReason.trim() || '관리자 수동 복구 승인',
                  );
                  setRestoreFeedback(res.message);
                  setRestoringTarget(null);
                }}
                className="rounded-lg bg-[#D95D24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#BE4E1B] whitespace-nowrap shrink-0"
              >
                수량 +1 복구 확정
              </button>
            </div>
          </div>
        )}

        {restoreFeedback && (
          <div
            role="status"
            className="mt-5 flex items-center justify-between rounded-lg border border-[#C6D6C1] bg-[#E8EFE6] px-4 py-2.5 text-xs font-medium text-[#3F5139]"
          >
            <span>{restoreFeedback}</span>
            <button
              type="button"
              onClick={() => setRestoreFeedback(null)}
              className="text-[#3F5139] hover:opacity-70"
            >
              닫기
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#DFD5C7] bg-white p-1.5">
            {(
              [
                { id: 'ALL', label: `전체 (${orders.length})` },
                { id: 'RECEIVED', label: `접수 (${countByStatus('RECEIVED')})` },
                { id: 'PREPARING', label: `준비 중 (${countByStatus('PREPARING')})` },
                { id: 'READY', label: `준비 완료 (${countByStatus('READY')})` },
                { id: 'COMPLETED', label: `수령 완료 (${countByStatus('COMPLETED')})` },
                { id: 'CANCELLED', label: `취소 내역 (${countByStatus('CANCELLED')})` },
                { id: 'UNCOLLECTED', label: `미수령 (${uncollectedOrders.length})` },
                { id: 'AUDIT_LOGS', label: `감사 로그 (${auditLogs.length})` },
              ] as const
            ).map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    isActive
                      ? 'bg-[#2B1E16] text-[#FAF7F2]'
                      : 'text-[#6E5A4F] hover:bg-[#FAF7F2] hover:text-[#2B1E16]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Audit Logs View */}
          {activeTab === 'AUDIT_LOGS' ? (
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#DFD5C7] bg-white">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-[#EFE7DC] bg-[#FAF7F2] text-[#6E5A4F]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">수행 시각</th>
                    <th className="px-4 py-3 font-semibold">담당자</th>
                    <th className="px-4 py-3 font-semibold">작업 구분</th>
                    <th className="px-4 py-3 font-semibold">대상</th>
                    <th className="px-4 py-3 font-semibold">변경 전 → 후</th>
                    <th className="px-4 py-3 font-semibold">사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3ECE1]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#FAF7F2]/60">
                      <td className="px-4 py-3 font-mono-num text-[#5C493E] whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#2B1E16] whitespace-nowrap">
                        {log.adminId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-[#B85223]">
                          {log.actionType === 'QUOTA_RESTORE'
                            ? '수량 복구'
                            : log.actionType === 'UNCOLLECTED_HANDLED'
                              ? '미수령 처리'
                              : log.actionType === 'ADMIN_LOGIN'
                                ? '관리자 로그인'
                                : '상태 변경'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-[#2B1E16] whitespace-nowrap">
                        {log.targetLabel}
                      </td>
                      <td className="px-4 py-3 text-[#5C493E] whitespace-nowrap tabular-nums">
                        {log.beforeValue} → <strong className="text-[#2B1E16]">{log.afterValue}</strong>
                      </td>
                      <td className="px-4 py-3 text-[#6E5A4F]">{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              {activeTab === 'UNCOLLECTED' && (
                <div className="mt-4 rounded-xl border border-[#E6CF9E] bg-[#FAF0DC] px-4 py-3 text-xs text-[#6E450B]">
                  19:00 영업 종료 이후 아직 수령 완료되지 않은 주문 목록입니다. 고객 수량을 자동 취소하거나 자동 복구하지 않으며, 매장 확인 후 건별로 최종 처리합니다.
                </div>
              )}

              <div className="mt-4 overflow-x-auto rounded-xl border border-[#DFD5C7] bg-white">
                {filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <ClipboardList className="h-8 w-8 text-[#B7A697]" strokeWidth={1.5} />
                    <p className="mt-3 text-sm font-semibold text-[#2B1E16]">
                      해당 상태의 주문이 없습니다
                    </p>
                    <p className="mt-1 text-xs text-[#7A6254]">
                      상단 &ldquo;테스트 신규 주문 발생&rdquo; 버튼을 누르거나 고객 화면에서 주문을 접수해 보세요.
                    </p>
                  </div>
                ) : (
                  <table className="w-full min-w-[880px] text-left text-xs">
                    <thead className="border-b border-[#EFE7DC] bg-[#FAF7F2] text-[#6E5A4F]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">주문번호</th>
                        <th className="px-4 py-3 font-semibold">시각</th>
                        <th className="px-4 py-3 font-semibold">고객 정보</th>
                        <th className="px-4 py-3 font-semibold">주문 메뉴 및 슬롯 상태</th>
                        <th className="px-4 py-3 font-semibold text-right">결제 예정</th>
                        <th className="px-4 py-3 font-semibold">상태</th>
                        <th className="px-4 py-3 font-semibold text-right">관리자 처리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3ECE1]">
                      {filteredOrders.map((order) => (
                        <tr key={order.internalId} className="hover:bg-[#FAF7F2]/60 align-top">
                          <td className="px-4 py-3.5 font-mono-num text-sm font-bold text-[#2B1E16] whitespace-nowrap">
                            {order.orderNumber}
                          </td>
                          <td className="px-4 py-3.5 font-mono-num text-[#6E5A4F] whitespace-nowrap">
                            {order.createdTimeLabel}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <p className="font-semibold text-[#2B1E16]">{order.customerName}</p>
                            <p className="mt-0.5 font-mono-num text-[#7A6254]">
                              {maskPhone(order.phoneNormalized)}
                            </p>
                          </td>
                          <td className="px-4 py-3.5">
                            <ul className="space-y-1.5">
                              {order.items.map((item) => (
                                <li
                                  key={item.id}
                                  className="flex flex-wrap items-center justify-between gap-2"
                                >
                                  <span className="font-medium text-[#2B1E16]">
                                    {item.itemName}
                                  </span>
                                  {order.status === 'CANCELLED' && (
                                    <span className="text-[11px]">
                                      {item.slotStatus === 'RESTORED' ? (
                                        <span className="font-semibold text-[#3F5139]">
                                          복구 완료
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setRestoringTarget({
                                              orderId: order.internalId,
                                              itemId: item.id,
                                              eventCode: item.eventCode,
                                              itemName: item.itemName,
                                              orderNumber: order.orderNumber,
                                            })
                                          }
                                          className="inline-flex items-center gap-1 rounded border border-[#D95D24] bg-[#FDF3EE] px-2 py-0.5 font-semibold text-[#B85223] hover:bg-[#D95D24] hover:text-white transition-colors whitespace-nowrap"
                                        >
                                          <RotateCcw className="h-3 w-3" />
                                          수량 복구 승인 (+1)
                                        </button>
                                      )}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-[#2B1E16] tabular-nums whitespace-nowrap">
                            {formatKRW(order.totalAmount)}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                                ORDER_STATUS_META[order.status].toneClass
                              }`}
                            >
                              {ORDER_STATUS_META[order.status].label}
                            </span>
                            {order.markedUncollected &&
                              order.status !== 'COMPLETED' &&
                              order.status !== 'CANCELLED' && (
                                <p className="mt-1 text-[11px] font-medium text-[#9A5B13]">
                                  19시 미수령 대상
                                </p>
                              )}
                          </td>
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {order.status === 'RECEIVED' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStatus(
                                      order.internalId,
                                      'PREPARING',
                                      '제조 시작 처리',
                                    )
                                  }
                                  className="rounded-lg bg-[#2B1E16] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#412E23] whitespace-nowrap"
                                >
                                  준비 시작
                                </button>
                              )}
                              {order.status === 'PREPARING' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStatus(
                                      order.internalId,
                                      'READY',
                                      '제조 완료 및 고객 알림 전송',
                                    )
                                  }
                                  className="rounded-lg bg-[#D95D24] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#BE4E1B] whitespace-nowrap"
                                >
                                  준비 완료
                                </button>
                              )}
                              {order.status === 'READY' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateOrderStatus(
                                      order.internalId,
                                      'COMPLETED',
                                      '메인로비 1층 현장 결제 및 수령 확인',
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#3F5139] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#31402C] whitespace-nowrap"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  현장결제·수령 완료
                                </button>
                              )}
                              {activeTab === 'UNCOLLECTED' &&
                                order.status !== 'COMPLETED' &&
                                order.status !== 'CANCELLED' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onResolveUncollected(order.internalId, 'KEPT_CLOSED')
                                    }
                                    className="rounded-lg border border-[#D7C9B8] bg-[#FAF7F2] px-2.5 py-1.5 text-xs font-medium text-[#5C493E] hover:bg-[#EFE7DC] whitespace-nowrap"
                                  >
                                    미수령 종결 확인
                                  </button>
                                )}
                              {order.status === 'COMPLETED' && (
                                <span className="text-[11px] text-[#8A7365] tabular-nums">
                                  {order.completedAt ? `${order.completedAt} 완료` : '처리 완료'}
                                </span>
                              )}
                              {order.status === 'CANCELLED' && (
                                <span className="text-[11px] text-[#8A7365] tabular-nums">
                                  {order.cancelledAt ? `${order.cancelledAt} 취소` : '취소됨'}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

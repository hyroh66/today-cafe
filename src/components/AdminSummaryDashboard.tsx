import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MENU_ITEMS } from '../data/initialPreviewData';
import type { EventCode, OrderRecord } from '../types/cafe';
import { formatKRW } from '../utils/format';

interface AdminSummaryDashboardProps {
  orders: OrderRecord[];
}

const EVENT_COLORS: Record<EventCode, string> = {
  PERSIMMON_LATTE: '#8C4A1C',
  CARROT_CAKE: '#C98A4B',
  SET: '#D95D24',
};

const EVENT_SHORT_LABELS: Record<EventCode, string> = {
  PERSIMMON_LATTE: '아이스 홍시라떼',
  CARROT_CAKE: '오가닉 당근케이크',
  SET: '홍시라떼+당근케이크 세트',
};

const OPERATING_HOURS = [
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
];

function extractHourKey(order: OrderRecord): string {
  const match = order.createdTimeLabel.match(/^(\d{2})/);
  if (match) return match[1];
  const date = new Date(order.createdAt);
  if (!Number.isNaN(date.getTime())) {
    return String(date.getHours()).padStart(2, '0');
  }
  return '09';
}

export function AdminSummaryDashboard({ orders }: AdminSummaryDashboardProps) {
  const [volumeMetric, setVolumeMetric] = useState<'count' | 'revenue'>('count');
  const [breakdownMetric, setBreakdownMetric] = useState<'sales' | 'units'>('sales');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'CANCELLED');
    const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED');

    const totalSales = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalActiveItems = activeOrders.reduce((sum, o) => sum + o.items.length, 0);

    const discountMap = new Map(MENU_ITEMS.map((m) => [m.code, m.discountAmount]));
    const totalDiscount = activeOrders.reduce(
      (sum, o) =>
        sum + o.items.reduce((itemSum, item) => itemSum + (discountMap.get(item.eventCode) ?? 0), 0),
      0,
    );

    const avgOrderValue =
      activeOrders.length > 0 ? Math.round(totalSales / activeOrders.length) : 0;

    return {
      activeCount: activeOrders.length,
      cancelledCount: cancelledOrders.length,
      totalSales,
      totalDiscount,
      totalActiveItems,
      avgOrderValue,
    };
  }, [orders]);

  const hourlyData = useMemo(() => {
    const hourSet = new Set<string>(OPERATING_HOURS);
    for (const order of orders) {
      hourSet.add(extractHourKey(order));
    }

    const sortedHours = Array.from(hourSet).sort((a, b) => Number(a) - Number(b));

    const buckets = new Map<
      string,
      { activeOrders: number; cancelledOrders: number; revenue: number }
    >();
    for (const h of sortedHours) {
      buckets.set(h, { activeOrders: 0, cancelledOrders: 0, revenue: 0 });
    }

    for (const order of orders) {
      const h = extractHourKey(order);
      const bucket = buckets.get(h);
      if (!bucket) continue;
      if (order.status === 'CANCELLED') {
        bucket.cancelledOrders += 1;
      } else {
        bucket.activeOrders += 1;
        bucket.revenue += order.totalAmount;
      }
    }

    return sortedHours.map((h) => {
      const data = buckets.get(h)!;
      return {
        hour: `${h}시`,
        activeOrders: data.activeOrders,
        cancelledOrders: data.cancelledOrders,
        revenue: data.revenue,
      };
    });
  }, [orders]);

  const eventBreakdown = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'CANCELLED');
    const totals = new Map<EventCode, { units: number; sales: number }>();

    for (const menu of MENU_ITEMS) {
      totals.set(menu.code, { units: 0, sales: 0 });
    }

    for (const order of activeOrders) {
      for (const item of order.items) {
        const current = totals.get(item.eventCode);
        if (current) {
          current.units += 1;
          current.sales += item.unitFinalPrice;
        }
      }
    }

    const totalSales = Array.from(totals.values()).reduce((s, v) => s + v.sales, 0);
    const totalUnits = Array.from(totals.values()).reduce((s, v) => s + v.units, 0);

    return MENU_ITEMS.map((menu) => {
      const stat = totals.get(menu.code) ?? { units: 0, sales: 0 };
      const value = breakdownMetric === 'sales' ? stat.sales : stat.units;
      const denominator = breakdownMetric === 'sales' ? totalSales : totalUnits;
      const sharePct = denominator > 0 ? Math.round((stat[breakdownMetric] / denominator) * 100) : 0;

      return {
        eventCode: menu.code,
        shortLabel: EVENT_SHORT_LABELS[menu.code],
        fullName: menu.name,
        units: stat.units,
        sales: stat.sales,
        value,
        sharePct,
        color: EVENT_COLORS[menu.code],
      };
    });
  }, [orders, breakdownMetric]);

  const hasPieData = eventBreakdown.some((item) => item.value > 0);

  return (
    <section aria-label="매출 및 주문 성과 요약 대시보드" className="mt-8">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-xl font-bold text-[#2B1E16]">
            매출 및 주문 성과 요약
          </h2>
          <p className="mt-0.5 text-xs text-[#7A6254]">
            취소 주문을 제외한 유효 주문 기준 시간대별 추이와 이벤트 코드별 매출 분포를 실시간으로 집계합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="self-start rounded-lg border border-[#D7C9B8] bg-white px-3 py-1.5 text-xs font-medium text-[#5C493E] hover:bg-[#FAF7F2] whitespace-nowrap shrink-0 sm:self-auto"
        >
          {isCollapsed ? '차트 펼치기' : '차트 접기'}
        </button>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#DFD5C7] bg-white p-4">
          <p className="text-xs text-[#7A6254]">유효 주문 / 취소</p>
          <p className="mt-1 text-2xl font-bold text-[#2B1E16] tabular-nums">
            {metrics.activeCount}건
            <span className="ml-2 text-xs font-medium text-[#8A7365]">
              (취소 {metrics.cancelledCount}건)
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-[#DFD5C7] bg-white p-4">
          <p className="text-xs text-[#7A6254]">예상 현장 매출</p>
          <p className="mt-1 text-2xl font-bold text-[#D95D24] tabular-nums">
            {formatKRW(metrics.totalSales)}
          </p>
        </div>

        <div className="rounded-xl border border-[#DFD5C7] bg-white p-4">
          <p className="text-xs text-[#7A6254]">누적 이벤트 할인액</p>
          <p className="mt-1 text-2xl font-bold text-[#2B1E16] tabular-nums">
            {formatKRW(metrics.totalDiscount)}
          </p>
        </div>

        <div className="rounded-xl border border-[#DFD5C7] bg-white p-4">
          <p className="text-xs text-[#7A6254]">평균 주문 금액</p>
          <p className="mt-1 text-2xl font-bold text-[#2B1E16] tabular-nums">
            {formatKRW(metrics.avgOrderValue)}
          </p>
        </div>
      </div>

      {!isCollapsed && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Chart 1: Order Volume Over Time */}
          <div className="rounded-xl border border-[#DFD5C7] bg-white p-5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#2B1E16]">
                  시간대별 주문 추이
                </h3>
                <p className="mt-0.5 text-xs text-[#7A6254]">
                  영업시간(08:00~19:00) 및 실시간 유입 주문 현황
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-[#F5F2ED] p-1">
                <button
                  type="button"
                  onClick={() => setVolumeMetric('count')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    volumeMetric === 'count'
                      ? 'bg-white text-[#2B1E16] shadow-xs'
                      : 'text-[#6E5A4F] hover:text-[#2B1E16]'
                  }`}
                >
                  주문 건수
                </button>
                <button
                  type="button"
                  onClick={() => setVolumeMetric('revenue')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    volumeMetric === 'revenue'
                      ? 'bg-white text-[#2B1E16] shadow-xs'
                      : 'text-[#6E5A4F] hover:text-[#2B1E16]'
                  }`}
                >
                  시간대 매출
                </button>
              </div>
            </div>

            <div className="mt-4 h-[230px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hourlyData}
                  margin={{ top: 8, right: 8, left: volumeMetric === 'revenue' ? 12 : -18, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFE7DC" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: '#6E5A4F', fontSize: 11 }}
                    axisLine={{ stroke: '#E6DCD0' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#6E5A4F', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val: number) =>
                      volumeMetric === 'revenue' ? `${(val / 1000).toFixed(0)}k` : String(val)
                    }
                  />
                  <Tooltip
                    cursor={{ fill: '#FAF7F2' }}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#DFD5C7',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#2B1E16',
                    }}
                    formatter={(value, name) => {
                      const num = Number(value ?? 0);
                      if (name === 'revenue') return [formatKRW(num), '유효 매출'];
                      if (name === 'activeOrders') return [`${num}건`, '유효 주문'];
                      return [`${num}건`, '취소 주문'];
                    }}
                  />
                  {volumeMetric === 'count' ? (
                    <>
                      <Bar
                        dataKey="activeOrders"
                        stackId="orders"
                        fill="#D95D24"
                        radius={[0, 0, 0, 0]}
                        maxBarSize={28}
                      />
                      <Bar
                        dataKey="cancelledOrders"
                        stackId="orders"
                        fill="#D7C9B8"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={28}
                      />
                    </>
                  ) : (
                    <Bar
                      dataKey="revenue"
                      fill="#2B1E16"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-5 border-t border-[#F3ECE1] pt-3 text-xs text-[#6E5A4F]">
              {volumeMetric === 'count' ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#D95D24]" />
                    유효 주문
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#D7C9B8]" />
                    취소 주문
                  </span>
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#2B1E16]" />
                  시간대별 유효 매출액 (원)
                </span>
              )}
            </div>
          </div>

          {/* Chart 2: Sales Breakdown by Event Code */}
          <div className="rounded-xl border border-[#DFD5C7] bg-white p-5 lg:col-span-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#2B1E16]">
                  이벤트 코드별 매출 분포
                </h3>
                <p className="mt-0.5 text-xs text-[#7A6254]">
                  단품 2종 및 세트 특가 기여도 (유효 주문 기준)
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-[#F5F2ED] p-1">
                <button
                  type="button"
                  onClick={() => setBreakdownMetric('sales')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    breakdownMetric === 'sales'
                      ? 'bg-white text-[#2B1E16] shadow-xs'
                      : 'text-[#6E5A4F] hover:text-[#2B1E16]'
                  }`}
                >
                  매출액
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownMetric('units')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    breakdownMetric === 'units'
                      ? 'bg-white text-[#2B1E16] shadow-xs'
                      : 'text-[#6E5A4F] hover:text-[#2B1E16]'
                  }`}
                >
                  판매 수량
                </button>
              </div>
            </div>

            {!hasPieData ? (
              <div className="flex h-[230px] items-center justify-center text-xs text-[#8A7365]">
                집계할 유효 주문 내역이 없습니다.
              </div>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-[180px] w-[180px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={eventBreakdown}
                        dataKey="value"
                        nameKey="shortLabel"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={74}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {eventBreakdown.map((entry) => (
                          <Cell key={entry.eventCode} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#FFFFFF',
                          borderColor: '#DFD5C7',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#2B1E16',
                        }}
                        formatter={(value) => {
                          const num = Number(value ?? 0);
                          return [
                            breakdownMetric === 'sales' ? formatKRW(num) : `${num}개`,
                            breakdownMetric === 'sales' ? '매출' : '판매 수량',
                          ];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-full min-w-0 flex-1 divide-y divide-[#F3ECE1] text-xs">
                  {eventBreakdown.map((row) => (
                    <div key={row.eventCode} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 font-semibold text-[#2B1E16] truncate">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-xs"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="truncate">{row.shortLabel}</span>
                        </span>
                        <span className="font-mono-num font-bold text-[#2B1E16] shrink-0">
                          {row.sharePct}%
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between pl-4.5 text-[11px] text-[#6E5A4F] tabular-nums">
                        <span className="font-mono-num">{row.eventCode}</span>
                        <span>
                          {row.units}개 · <strong className="text-[#2B1E16]">{formatKRW(row.sales)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

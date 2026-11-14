export type EventCode = 'PERSIMMON_LATTE' | 'CARROT_CAKE' | 'SET';

export type OrderStatus =
  | 'RECEIVED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export type BusinessSimulationMode = 'OPEN' | 'CLOSED_HOURS' | 'DISCONNECTED';

export interface MenuItemSpec {
  code: EventCode;
  name: string;
  subtitle: string;
  description: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  dailyLimit: number;
  imageUrl: string;
  imageAlt: string;
  note?: string;
}

export interface DailyEventQuota {
  eventCode: EventCode;
  businessDate: string; // YYYY-MM-DD
  limit: number; // Always 20
  consumed: number;
  restored: number;
  updatedAt: string;
}

export interface OrderItemRecord {
  id: string;
  eventCode: EventCode;
  itemName: string;
  quantity: 1;
  unitFinalPrice: number;
  slotStatus: 'ALLOCATED' | 'CANCELLED_UNRESTORED' | 'RESTORED';
}

export interface OrderRecord {
  internalId: string;
  orderNumber: string; // e.g. 1201-001
  businessDate: string; // YYYY-MM-DD
  createdAt: string; // HH:mm:ss or ISO
  createdTimeLabel: string;
  customerName: string;
  phoneNormalized: string;
  totalAmount: number;
  status: OrderStatus;
  items: OrderItemRecord[];
  cancelledAt?: string;
  completedAt?: string;
  markedUncollected?: boolean;
  uncollectedNote?: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  adminId: string;
  actionType:
    | 'STATUS_CHANGE'
    | 'QUOTA_RESTORE'
    | 'UNCOLLECTED_HANDLED'
    | 'ADMIN_LOGIN';
  targetLabel: string;
  beforeValue: string;
  afterValue: string;
  reason: string;
}

export type DecisionType = 'REFILL' | 'SKIP' | 'ORDERED' | null;
export type RefillStatus = 'REFILLED' | 'SKIPPED' | 'ORDERED' | null;
export type FinalTaskStatus = 'Pending' | 'Completed';

export interface ExtractedItem {
  id: string; // BRAND_CODE
  brand: string;
  code: string;
  category: string;
  opening: number;
  purQty: number;
  soldQty: number;
  mrp: number;
  saleRate: number;
  balanceQty: number;
  godown: string;
  isLearned: boolean;
  processed: boolean;
  decisionType: DecisionType;
  refillStatus: RefillStatus;
  processedGodown?: string;
  refillBy?: string;
  refillById?: string;
  assignedSupplier?: string;
  decidedAt?: number;
}

export interface FinalTask {
  taskId: string;
  originalId: string; // points to ExtractedItem.id
  brand: string;
  code: string;
  category: string;
  mrp: number;
  saleRate: number;
  refillQty: number;
  godown: string;
  refillBy: string;
  refillById: string;
  refillAt: string; // ISO string
  status: FinalTaskStatus;
  updatedAt?: number;
}

export interface DailyReport {
  extracted: ExtractedItem[];
  final: FinalTask[];
  tombstones: Record<string, number>; // taskId -> timestamp
  _by: string; // DS_BUILD version
  _at: number; // timestamp
}

export interface ProductMasterEntry {
  godown: string;
  refillBy: string;
  refillById: string;
  refillAt: string;
}

export interface Profile {
  id: string; // UUID from auth.users
  email: string;
  name: string;
  role: 'admin' | 'worker';
  created_at: string;
  is_disabled: boolean;
}

export interface UserIdentity {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'worker';
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  userEmail: string;
  userName: string;
  action: string;
  details: string;
}

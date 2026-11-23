export type HardwareCategory = 'laptop' | 'desktop';

export interface InventoryItem {
  id: string;
  name: string;
  category: HardwareCategory;
  processor: string;
  spec: string;
  totalQuantity: number;
  issuedQuantity: number;
}

export type IssuanceStatus = 'Issued' | 'Partially Returned' | 'Returned';

export interface IssuanceRecord {
  id: string;
  itemId: string;
  itemName: string;
  category: HardwareCategory;
  employeeName: string;
  designation: string;
  quantity: number;
  returnedQuantity: number;
  issuedAt: string;
  lastReturnedAt?: string;
  status: IssuanceStatus;
}

export type HistoryAction = 'Issued' | 'Returned' | 'Stock Updated';

export interface HistoryEntry {
  id: string;
  action: HistoryAction;
  itemId: string;
  itemName: string;
  category: HardwareCategory;
  employeeName: string;
  designation: string;
  quantity: number;
  remainingAvailable: number;
  timestamp: string;
  note?: string;
}

export interface PortalState {
  quantitiesFixed: boolean;
  items: InventoryItem[];
  issuances: IssuanceRecord[];
  history: HistoryEntry[];
}

export interface AuthStatusResponse {
  setupRequired: boolean;
  authMode: 'env' | 'local' | 'setup';
}

export interface LoginResponse {
  token: string;
  login: string;
}

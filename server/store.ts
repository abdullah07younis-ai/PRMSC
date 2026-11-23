import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  HistoryEntry,
  InventoryItem,
  IssuanceRecord,
  PortalState,
} from '../src/types.ts';

export interface AdminCredential {
  login: string;
  salt: string;
  hash: string;
  createdAt: string;
}

interface PersistedStore extends PortalState {
  adminCredential: AdminCredential | null;
  sequence: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'prmsc-store.json');

const DEFAULT_ITEMS: InventoryItem[] = [
  {
    id: 'laptop-i3',
    name: 'Laptop Core i3',
    category: 'laptop',
    processor: 'Intel Core i3',
    spec: '8 GB RAM · 256 GB SSD · 14" Display',
    totalQuantity: 0,
    issuedQuantity: 0,
  },
  {
    id: 'laptop-i5',
    name: 'Laptop Core i5',
    category: 'laptop',
    processor: 'Intel Core i5',
    spec: '16 GB RAM · 512 GB SSD · 14" Display',
    totalQuantity: 0,
    issuedQuantity: 0,
  },
  {
    id: 'laptop-i7',
    name: 'Laptop Core i7',
    category: 'laptop',
    processor: 'Intel Core i7',
    spec: '16 GB RAM · 1 TB SSD · 15.6" Display',
    totalQuantity: 0,
    issuedQuantity: 0,
  },
  {
    id: 'desktop-i3',
    name: 'Desktop Core i3',
    category: 'desktop',
    processor: 'Intel Core i3',
    spec: '8 GB RAM · 256 GB SSD · 22" Monitor',
    totalQuantity: 0,
    issuedQuantity: 0,
  },
  {
    id: 'desktop-i5',
    name: 'Desktop Core i5',
    category: 'desktop',
    processor: 'Intel Core i5',
    spec: '16 GB RAM · 512 GB SSD · 24" Monitor',
    totalQuantity: 0,
    issuedQuantity: 0,
  },
  {
    id: 'desktop-i7',
    name: 'Desktop Core i7',
    category: 'desktop',
    processor: 'Intel Core i7',
    spec: '32 GB RAM · 1 TB SSD · 27" Monitor',
    totalQuantity: 0,
    issuedQuantity: 0,
  },
];

function createInitialStore(): PersistedStore {
  return {
    adminCredential: null,
    quantitiesFixed: false,
    items: DEFAULT_ITEMS.map((item) => ({...item})),
    issuances: [],
    history: [],
    sequence: 1000,
  };
}

let cachedStore: PersistedStore | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
}

export function loadStore(): PersistedStore {
  if (cachedStore) {
    return cachedStore;
  }
  ensureDataDir();
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedStore>;
      cachedStore = {
        adminCredential: parsed.adminCredential ?? null,
        quantitiesFixed: Boolean(parsed.quantitiesFixed),
        items:
          Array.isArray(parsed.items) && parsed.items.length === 6
            ? parsed.items
            : DEFAULT_ITEMS.map((item) => ({...item})),
        issuances: Array.isArray(parsed.issuances) ? parsed.issuances : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        sequence: typeof parsed.sequence === 'number' ? parsed.sequence : 1000,
      };
      return cachedStore;
    } catch {
      cachedStore = createInitialStore();
      saveStore(cachedStore);
      return cachedStore;
    }
  }
  cachedStore = createInitialStore();
  saveStore(cachedStore);
  return cachedStore;
}

export function saveStore(store: PersistedStore): void {
  ensureDataDir();
  cachedStore = store;
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

export function getPublicPortalState(store: PersistedStore): PortalState {
  return {
    quantitiesFixed: store.quantitiesFixed,
    items: store.items.map((item) => ({...item})),
    issuances: store.issuances.map((record) => ({...record})),
    history: store.history.map((entry) => ({...entry})),
  };
}

export function hashPassword(password: string, salt?: string): {salt: string; hash: string} {
  const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return {salt: actualSalt, hash: derived};
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

export function nextRecordId(store: PersistedStore, prefix: string): string {
  store.sequence += 1;
  return `${prefix}-${store.sequence}`;
}

export function createHistoryEntry(
  store: PersistedStore,
  params: Omit<HistoryEntry, 'id' | 'timestamp'>,
): HistoryEntry {
  return {
    id: nextRecordId(store, 'LOG'),
    timestamp: new Date().toISOString(),
    ...params,
  };
}

export function createIssuanceRecord(
  store: PersistedStore,
  params: Omit<IssuanceRecord, 'id' | 'issuedAt' | 'returnedQuantity' | 'status'>,
): IssuanceRecord {
  return {
    id: nextRecordId(store, 'ISS'),
    issuedAt: new Date().toISOString(),
    returnedQuantity: 0,
    status: 'Issued',
    ...params,
  };
}

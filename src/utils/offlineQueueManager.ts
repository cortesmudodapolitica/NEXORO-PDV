/**
 * Fila offline durável — IndexedDB com cache síncrono em memória
 * Compatível com call sites síncronos do StoreContext (getOfflineQueue / enqueue / remove).
 * Migra automaticamente de localStorage (tokio_offline_operations_v2).
 */

export type OfflineOperationType =
  | 'CREATE_ORDER'
  | 'APPEND_TABLE_ITEMS'
  | 'CLOSE_TABLE'
  | 'UPDATE_STATUS'
  | 'UPDATE_STATION_STATUS'
  | 'REMOVE_ITEM';

export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  idempotencyKey: string;
  timestamp: string;
  payload: any;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'confirmed';
  error?: string;
  terminalId?: string;
  lastAttemptAt?: string;
  serverResult?: any;
}

const DB_NAME = 'nexoro_offline_v1';
const DB_VERSION = 1;
const STORE = 'operations';
const LEGACY_KEY = 'tokio_offline_operations_v2';
const SIMULATION_KEY = 'tokio_simulated_offline_mode';

/** Cache em memória espelhando a fila ativa (não confirmed) — permite API síncrona */
let memoryQueue: OfflineOperation[] = [];
let memoryReady = false;
let initPromise: Promise<void> | null = null;

function notify() {
  try {
    window.dispatchEvent(
      new CustomEvent('tokio-offline-queue-change', {
        detail: { count: memoryQueue.filter((o) => o.status !== 'confirmed').length },
      })
    );
  } catch {
    /* ignore */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('by_status', 'status', { unique: false });
        os.createIndex('by_idem', 'idempotencyKey', { unique: true });
        os.createIndex('by_ts', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbAll(db: IDBDatabase): Promise<OfflineOperation[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as OfflineOperation[]) || []);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, op: OfflineOperation): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function loadLegacyLocalStorage(): OfflineOperation[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistLegacyFallback(queue: OfflineOperation[]) {
  try {
    localStorage.setItem(LEGACY_KEY, JSON.stringify(queue.filter((o) => o.status !== 'confirmed')));
  } catch (e) {
    console.warn('[OFFLINE] Falha ao gravar fallback localStorage:', e);
  }
}

/** Inicializa IDB + migração; seguro chamar várias vezes */
export function ensureOfflineQueueReady(): Promise<void> {
  if (memoryReady) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const db = await openDb();
      let all = await idbAll(db);
      const legacy = loadLegacyLocalStorage();
      if (legacy.length && all.length === 0) {
        for (const op of legacy) {
          if (!op?.id || !op?.idempotencyKey) continue;
          await idbPut(db, { ...op, status: op.status || 'pending' });
        }
        all = await idbAll(db);
        try {
          localStorage.removeItem(LEGACY_KEY);
        } catch {
          /* ignore */
        }
        console.log(`[OFFLINE] Migradas ${legacy.length} ops do localStorage → IndexedDB`);
      }
      memoryQueue = all.filter((o) => o.status !== 'confirmed');
      memoryReady = true;
      notify();
    } catch (e) {
      console.warn('[OFFLINE] IndexedDB indisponível, usando localStorage:', e);
      memoryQueue = loadLegacyLocalStorage();
      memoryReady = true;
      notify();
    }
  })();
  return initPromise;
}

// Boot best-effort
if (typeof window !== 'undefined') {
  ensureOfflineQueueReady().catch(() => {});
}

export function getSimulatedOffline(): boolean {
  try {
    return localStorage.getItem(SIMULATION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSimulatedOffline(val: boolean): void {
  try {
    localStorage.setItem(SIMULATION_KEY, val ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('tokio-offline-mode-change', { detail: { isOffline: val } }));
  } catch {
    /* ignore */
  }
}

/** API síncrona — usa cache em memória (após ensureOfflineQueueReady) */
export function getOfflineQueue(): OfflineOperation[] {
  if (!memoryReady) {
    // Primeira chamada antes do IDB: hidrata do legacy síncrono
    memoryQueue = loadLegacyLocalStorage();
  }
  return memoryQueue.filter((o) => o.status !== 'confirmed');
}

export function saveOfflineQueue(queue: OfflineOperation[]): void {
  memoryQueue = queue.filter((o) => o.status !== 'confirmed');
  notify();
  persistLegacyFallback(memoryQueue);
  ensureOfflineQueueReady().then(async () => {
    try {
      const db = await openDb();
      const existing = await idbAll(db);
      const keep = new Set(memoryQueue.map((o) => o.id));
      for (const e of existing) {
        if (!keep.has(e.id) && e.status !== 'confirmed') await idbDelete(db, e.id);
      }
      for (const op of memoryQueue) await idbPut(db, op);
    } catch (e) {
      console.warn('[OFFLINE] save IDB falhou:', e);
    }
  });
}

export function enqueueOfflineOperation(
  type: OfflineOperationType,
  payload: any,
  idempotencyKey?: string
): OfflineOperation {
  const key = idempotencyKey || `idem-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  if (!memoryReady) memoryQueue = loadLegacyLocalStorage();

  const existing = memoryQueue.find((op) => op.idempotencyKey === key);
  if (existing) {
    console.log(`[OFFLINE] Operação idempotente ${key} já na fila`);
    return existing;
  }

  const terminalId =
    (typeof localStorage !== 'undefined' && localStorage.getItem('tokio_mobile_paired_id')) || 'browser';

  const newOp: OfflineOperation = {
    id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    idempotencyKey: key,
    timestamp: new Date().toISOString(),
    payload,
    retryCount: 0,
    status: 'pending',
    terminalId,
  };

  memoryQueue = [...memoryQueue, newOp];
  notify();
  persistLegacyFallback(memoryQueue);
  ensureOfflineQueueReady().then(async () => {
    try {
      const db = await openDb();
      await idbPut(db, newOp);
    } catch (e) {
      console.warn('[OFFLINE] put IDB falhou:', e);
    }
  });
  return newOp;
}

/**
 * Remove da fila ativa. Preferir após success HTTP + corpo válido.
 * Operações confirmed podem permanecer no IDB para auditoria local.
 */
export function removeOfflineOperation(opId: string): void {
  memoryQueue = memoryQueue.filter((op) => op.id !== opId);
  notify();
  persistLegacyFallback(memoryQueue);
  ensureOfflineQueueReady().then(async () => {
    try {
      const db = await openDb();
      await idbDelete(db, opId);
    } catch (e) {
      console.warn('[OFFLINE] delete IDB falhou:', e);
    }
  });
}

export function clearAllOfflineQueue(): void {
  memoryQueue = [];
  notify();
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
  ensureOfflineQueueReady().then(async () => {
    try {
      const db = await openDb();
      const all = await idbAll(db);
      for (const op of all) await idbDelete(db, op.id);
    } catch {
      /* ignore */
    }
  });
}

/** Marca confirmed no IDB sem manter na fila ativa */
export function confirmOfflineOperation(opId: string, serverResult?: any): void {
  const op = memoryQueue.find((o) => o.id === opId);
  memoryQueue = memoryQueue.filter((o) => o.id !== opId);
  notify();
  persistLegacyFallback(memoryQueue);
  if (!op) return;
  const confirmed: OfflineOperation = {
    ...op,
    status: 'confirmed',
    serverResult,
    lastAttemptAt: new Date().toISOString(),
  };
  ensureOfflineQueueReady().then(async () => {
    try {
      const db = await openDb();
      await idbPut(db, confirmed);
    } catch {
      /* ignore */
    }
  });
}

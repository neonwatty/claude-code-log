import { ZodSession } from "@shared";

/**
 * Offline storage types
 */
export type OfflineStorageType = "indexeddb" | "localstorage" | "websql";

/**
 * Offline sync status
 */
export type SyncStatus = "synced" | "pending" | "failed" | "offline";

/**
 * Offline data entry
 */
export interface OfflineDataEntry {
  id: string;
  type: "session" | "search_index" | "preferences" | "analytics";
  data: unknown;
  lastModified: string;
  syncStatus: SyncStatus;
  syncAttempts: number;
  size: number;
}

/**
 * Offline capabilities configuration
 */
export interface OfflineConfig {
  enableOfflineMode: boolean;
  storageType: OfflineStorageType;
  maxStorageSize: number; // in MB
  autoSync: boolean;
  syncInterval: number; // in seconds
  retryAttempts: number;
  compressData: boolean;
}

/**
 * Offline sync result
 */
export interface SyncResult {
  success: boolean;
  syncedItems: number;
  failedItems: number;
  errors: string[];
  syncDuration: number;
}

/**
 * Storage quota information
 */
export interface StorageQuota {
  used: number;
  available: number;
  total: number;
  percentage: number;
}

/**
 * Offline support service with data synchronization
 */
export class OfflineService {
  private config: OfflineConfig;
  private db: IDBDatabase | null = null;
  private offlineQueue: Map<string, OfflineDataEntry> = new Map();
  private syncInProgress = false;
  private syncListeners: Array<(result: SyncResult) => void> = [];

  private readonly DEFAULT_CONFIG: OfflineConfig = {
    enableOfflineMode: false,
    storageType: "indexeddb",
    maxStorageSize: 100, // 100MB
    autoSync: true,
    syncInterval: 60, // 1 minute
    retryAttempts: 3,
    compressData: true,
  };

  constructor(config: Partial<OfflineConfig> = {}) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.init();
  }

  /**
   * Initialize offline service
   */
  private async init(): Promise<void> {
    if (!this.config.enableOfflineMode) {
      return;
    }

    try {
      await this.initializeStorage();
      this.setupOnlineOfflineListeners();
      this.setupServiceWorkerIntegration();

      if (this.config.autoSync && navigator.onLine) {
        this.startAutoSync();
      }
    } catch (error) {
      console.error("Failed to initialize offline service:", error);
    }
  }

  /**
   * Store session data offline
   */
  async storeSession(session: ZodSession): Promise<boolean> {
    if (!this.config.enableOfflineMode) {
      return false;
    }

    try {
      const entry: OfflineDataEntry = {
        id: `session-${session.id}`,
        type: "session",
        data: session,
        lastModified: new Date().toISOString(),
        syncStatus: navigator.onLine ? "synced" : "pending",
        syncAttempts: 0,
        size: JSON.stringify(session).length,
      };

      await this.storeData(entry);
      
      // Also cache in service worker for faster offline access
      await this.cacheSessionInServiceWorker(session);
      
      return true;
    } catch (error) {
      console.error("Failed to store session offline:", error);
      return false;
    }
  }

  /**
   * Retrieve session from offline storage
   */
  async getOfflineSession(sessionId: string): Promise<ZodSession | null> {
    if (!this.config.enableOfflineMode) {
      return null;
    }

    try {
      const entry = await this.getData(`session-${sessionId}`);
      return entry ? entry.data : null;
    } catch (error) {
      console.error("Failed to retrieve offline session:", error);
      return null;
    }
  }

  /**
   * Get all offline sessions
   */
  async getAllOfflineSessions(): Promise<ZodSession[]> {
    if (!this.config.enableOfflineMode) {
      return [];
    }

    try {
      const entries = await this.getAllDataByType("session");
      return entries.map((entry) => entry.data);
    } catch (error) {
      console.error("Failed to retrieve offline sessions:", error);
      return [];
    }
  }

  /**
   * Store search index offline
   */
  async storeSearchIndex(indexData: unknown): Promise<boolean> {
    if (!this.config.enableOfflineMode) {
      return false;
    }

    try {
      const entry: OfflineDataEntry = {
        id: "search-index",
        type: "search_index",
        data: indexData,
        lastModified: new Date().toISOString(),
        syncStatus: "synced",
        syncAttempts: 0,
        size: JSON.stringify(indexData).length,
      };

      await this.storeData(entry);
      return true;
    } catch (error) {
      console.error("Failed to store search index offline:", error);
      return false;
    }
  }

  /**
   * Get offline search index
   */
  async getOfflineSearchIndex(): Promise<unknown | null> {
    if (!this.config.enableOfflineMode) {
      return null;
    }

    try {
      const entry = await this.getData("search-index");
      return entry ? entry.data : null;
    } catch (error) {
      console.error("Failed to retrieve offline search index:", error);
      return null;
    }
  }

  /**
   * Sync offline data with server
   */
  async syncOfflineData(): Promise<SyncResult> {
    if (this.syncInProgress || !navigator.onLine) {
      return {
        success: false,
        syncedItems: 0,
        failedItems: 0,
        errors: ["Sync already in progress or offline"],
        syncDuration: 0,
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      const pendingEntries = await this.getPendingDataEntries();
      let syncedItems = 0;
      let failedItems = 0;
      const errors: string[] = [];

      for (const entry of pendingEntries) {
        try {
          // Attempt to sync with server (would integrate with backend API)
          const synced = await this.syncDataEntry(entry);

          if (synced) {
            entry.syncStatus = "synced";
            entry.syncAttempts = 0;
            syncedItems++;
          } else {
            entry.syncStatus = "failed";
            entry.syncAttempts++;
            failedItems++;
            errors.push(`Failed to sync ${entry.id}`);
          }

          await this.updateData(entry);
        } catch (error) {
          entry.syncStatus = "failed";
          entry.syncAttempts++;
          failedItems++;
          errors.push(`Error syncing ${entry.id}: ${error}`);
          await this.updateData(entry);
        }
      }

      const result: SyncResult = {
        success: failedItems === 0,
        syncedItems,
        failedItems,
        errors,
        syncDuration: Date.now() - startTime,
      };

      this.notifySyncListeners(result);
      return result;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<StorageQuota> {
    try {
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const available = estimate.quota || 0;

        return {
          used,
          available: available - used,
          total: available,
          percentage: available > 0 ? (used / available) * 100 : 0,
        };
      }
    } catch (error) {
      console.warn("Could not get storage quota:", error);
    }

    return {
      used: 0,
      available: 0,
      total: 0,
      percentage: 0,
    };
  }

  /**
   * Add sync listener
   */
  addSyncListener(listener: (result: SyncResult) => void): () => void {
    this.syncListeners.push(listener);

    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  /**
   * Check if offline mode is enabled
   */
  isOfflineModeEnabled(): boolean {
    return this.config.enableOfflineMode;
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Get offline configuration
   */
  getConfig(): OfflineConfig {
    return { ...this.config };
  }

  /**
   * Update offline configuration
   */
  updateConfig(updates: Partial<OfflineConfig>): void {
    this.config = { ...this.config, ...updates };

    if (updates.enableOfflineMode !== undefined) {
      if (updates.enableOfflineMode) {
        this.init();
      } else {
        this.cleanup();
      }
    }
  }

  /**
   * Initialize storage based on configured type
   */
  private async initializeStorage(): Promise<void> {
    switch (this.config.storageType) {
      case "indexeddb":
        await this.initIndexedDB();
        break;
      case "localstorage":
        // LocalStorage is already available
        break;
      case "websql":
        throw new Error("WebSQL is deprecated and not supported");
      default:
        throw new Error(`Unsupported storage type: ${this.config.storageType}`);
    }
  }

  /**
   * Initialize IndexedDB
   */
  private async initIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("claude-code-offline", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains("offlineData")) {
          const store = db.createObjectStore("offlineData", { keyPath: "id" });
          store.createIndex("type", "type", { unique: false });
          store.createIndex("syncStatus", "syncStatus", { unique: false });
        }
      };
    });
  }

  /**
   * Store data entry
   */
  private async storeData(entry: OfflineDataEntry): Promise<void> {
    if (this.config.storageType === "indexeddb" && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(["offlineData"], "readwrite");
        const store = transaction.objectStore("offlineData");
        const request = store.put(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } else if (this.config.storageType === "localstorage") {
      localStorage.setItem(`offline-${entry.id}`, JSON.stringify(entry));
    }
  }

  /**
   * Get data entry by ID
   */
  private async getData(id: string): Promise<OfflineDataEntry | null> {
    if (this.config.storageType === "indexeddb" && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(["offlineData"], "readonly");
        const store = transaction.objectStore("offlineData");
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } else if (this.config.storageType === "localstorage") {
      const stored = localStorage.getItem(`offline-${id}`);
      return stored ? JSON.parse(stored) : null;
    }

    return null;
  }

  /**
   * Get all data entries by type
   */
  private async getAllDataByType(type: string): Promise<OfflineDataEntry[]> {
    if (this.config.storageType === "indexeddb" && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(["offlineData"], "readonly");
        const store = transaction.objectStore("offlineData");
        const index = store.index("type");
        const request = index.getAll(type);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } else if (this.config.storageType === "localstorage") {
      const entries: OfflineDataEntry[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("offline-")) {
          try {
            const entry = JSON.parse(localStorage.getItem(key)!);
            if (entry.type === type) {
              entries.push(entry);
            }
          } catch (error) {
            console.warn(`Failed to parse offline entry ${key}:`, error);
          }
        }
      }
      return entries;
    }

    return [];
  }

  /**
   * Get pending data entries that need sync
   */
  private async getPendingDataEntries(): Promise<OfflineDataEntry[]> {
    if (this.config.storageType === "indexeddb" && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(["offlineData"], "readonly");
        const store = transaction.objectStore("offlineData");
        const index = store.index("syncStatus");
        const request = index.getAll("pending");

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } else if (this.config.storageType === "localstorage") {
      const entries = await this.getAllDataByType("session");
      return entries.filter((entry) => entry.syncStatus === "pending");
    }

    return [];
  }

  /**
   * Update data entry
   */
  private async updateData(entry: OfflineDataEntry): Promise<void> {
    entry.lastModified = new Date().toISOString();
    return this.storeData(entry);
  }

  /**
   * Sync individual data entry with server
   */
  private async syncDataEntry(entry: OfflineDataEntry): Promise<boolean> {
    try {
      // This would integrate with the backend API to sync data
      // For now, simulate successful sync
      await new Promise((resolve) => setTimeout(resolve, 100));
      return true;
    } catch (error) {
      console.error(`Failed to sync entry ${entry.id}:`, error);
      return false;
    }
  }

  /**
   * Setup online/offline event listeners
   */
  private setupOnlineOfflineListeners(): void {
    window.addEventListener("online", () => {
      console.log("Back online - starting sync");
      if (this.config.autoSync) {
        this.syncOfflineData();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Gone offline - queuing changes");
    });
  }

  /**
   * Start automatic sync timer
   */
  private startAutoSync(): void {
    if (this.config.autoSync) {
      setInterval(() => {
        if (navigator.onLine && !this.syncInProgress) {
          this.syncOfflineData();
        }
      }, this.config.syncInterval * 1000);
    }
  }

  /**
   * Notify sync listeners
   */
  private notifySyncListeners(result: SyncResult): void {
    this.syncListeners.forEach((listener) => {
      try {
        listener(result);
      } catch (error) {
        console.error("Error in sync listener:", error);
      }
    });
  }

  /**
   * Cleanup offline resources
   */
  private cleanup(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.offlineQueue.clear();
  }

  /**
   * Clear all offline data
   */
  async clearOfflineData(): Promise<void> {
    if (this.config.storageType === "indexeddb" && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(["offlineData"], "readwrite");
        const store = transaction.objectStore("offlineData");
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } else if (this.config.storageType === "localstorage") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("offline-")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    }
  }

  /**
   * Get offline storage statistics
   */
  async getOfflineStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    pendingSync: number;
    lastSyncTime?: string;
  }> {
    try {
      const allEntries = await this.getAllDataByType("session");
      const pendingEntries = allEntries.filter(
        (e) => e.syncStatus === "pending",
      );

      return {
        totalEntries: allEntries.length,
        totalSize: allEntries.reduce((sum, entry) => sum + entry.size, 0),
        pendingSync: pendingEntries.length,
        lastSyncTime: this.getLastSyncTime(),
      };
    } catch (error) {
      console.error("Failed to get offline stats:", error);
      return {
        totalEntries: 0,
        totalSize: 0,
        pendingSync: 0,
      };
    }
  }

  /**
   * Get last sync time from localStorage
   */
  private getLastSyncTime(): string | undefined {
    try {
      return localStorage.getItem("claude-code-last-sync") || undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Set last sync time
   */
  private setLastSyncTime(): void {
    try {
      localStorage.setItem("claude-code-last-sync", new Date().toISOString());
    } catch (error) {
      console.warn("Could not save last sync time:", error);
    }
  }

  /**
   * Setup service worker integration
   */
  private setupServiceWorkerIntegration(): void {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return;
    }

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });

    // Wait for service worker to be ready
    navigator.serviceWorker.ready.then((_registration) => {
      console.log('Service worker ready, offline service integrated');
    }).catch((error) => {
      console.error('Service worker not ready:', error);
    });
  }

  /**
   * Handle messages from service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data || {};

    switch (type) {
      case 'OFFLINE_SYNC_REQUEST':
        this.syncOfflineData();
        break;
      case 'CACHE_STATUS_UPDATE':
        console.log('Cache status updated:', payload);
        break;
      default:
        console.log('Unknown service worker message:', type);
    }
  }

  /**
   * Cache session data in service worker
   */
  private async cacheSessionInServiceWorker(session: ZodSession): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({
          type: 'CACHE_SESSION_DATA',
          payload: session
        });
      }
    } catch (error) {
      console.error('Failed to cache session in service worker:', error);
    }
  }

  /**
   * Get service worker cache status
   */
  async getServiceWorkerCacheStatus(): Promise<unknown> {
    if (!('serviceWorker' in navigator)) {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        return new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => {
            resolve(event.data);
          };

          registration.active!.postMessage({
            type: 'GET_CACHE_STATUS'
          }, [channel.port2]);
        });
      }
    } catch (error) {
      console.error('Failed to get service worker cache status:', error);
      return null;
    }
  }

  /**
   * Clear service worker cache
   */
  async clearServiceWorkerCache(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        return new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => {
            resolve(event.data.success || false);
          };

          registration.active!.postMessage({
            type: 'CLEAR_CACHE'
          }, [channel.port2]);
        });
      }
      return false;
    } catch (error) {
      console.error('Failed to clear service worker cache:', error);
      return false;
    }
  }

  /**
   * Request background sync via service worker
   */
  async requestBackgroundSync(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.log('Background sync not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('offline-data-sync');
      console.log('Background sync registered');
    } catch (error) {
      console.error('Failed to register background sync:', error);
    }
  }

  /**
   * Enable offline mode with service worker integration
   */
  async enableOfflineMode(): Promise<boolean> {
    try {
      // Update config
      this.updateConfig({ enableOfflineMode: true });

      // Request background sync for offline data
      await this.requestBackgroundSync();

      return true;
    } catch (error) {
      console.error('Failed to enable offline mode:', error);
      return false;
    }
  }

  /**
   * Get comprehensive offline status including service worker
   */
  async getOfflineStatus(): Promise<{
    offlineModeEnabled: boolean;
    serviceWorkerActive: boolean;
    backgroundSyncSupported: boolean;
    cacheStatus: unknown;
    storageQuota: StorageQuota;
    offlineStats: unknown;
  }> {
    const [cacheStatus, storageQuota, offlineStats] = await Promise.all([
      this.getServiceWorkerCacheStatus(),
      this.getStorageQuota(),
      this.getOfflineStats()
    ]);

    return {
      offlineModeEnabled: this.config.enableOfflineMode,
      serviceWorkerActive: 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null,
      backgroundSyncSupported: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      cacheStatus,
      storageQuota,
      offlineStats
    };
  }
}

// Export singleton instance
export const offlineService = new OfflineService();

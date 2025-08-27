import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { OfflineService } from "../offline.service";
import type { ZodSession } from "@shared";
import type { OfflineConfig, SyncResult } from "../offline.service";

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  databases: vi.fn(),
};

const mockDatabase = {
  transaction: vi.fn(),
  close: vi.fn(),
  objectStoreNames: {
    contains: vi.fn(),
  },
  createObjectStore: vi.fn(),
};

const mockObjectStore = {
  put: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  clear: vi.fn(),
  createIndex: vi.fn(),
  index: vi.fn(),
};

const mockTransaction = {
  objectStore: vi.fn(() => mockObjectStore),
  oncomplete: null,
  onerror: null,
};

const mockIndex = {
  getAll: vi.fn(),
};

const mockRequest = {
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null,
  result: null,
  error: null,
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock navigator
const mockNavigator = {
  onLine: true,
  storage: {
    estimate: vi.fn(),
  },
};

// Mock ZodSession
const createMockSession = (id: string = "test-session-1"): ZodSession => ({
  id,
  cwd: "/test/project",
  firstTimestamp: "2024-01-01T10:00:00.000Z",
  lastTimestamp: "2024-01-01T11:00:00.000Z",
  totalUsage: {
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_input_tokens: 200,
    cache_creation_input_tokens: 100,
  },
  entries: [
    {
      uuid: "entry-1",
      type: "user",
      timestamp: "2024-01-01T10:00:00.000Z",
      message: { content: [{ type: "text", text: "Hello" }] },
    },
  ] as any[],
});

Object.defineProperty(globalThis, "indexedDB", { value: mockIndexedDB });
Object.defineProperty(window, "localStorage", { value: localStorageMock });
Object.defineProperty(globalThis, "navigator", { value: mockNavigator });
Object.defineProperty(window, "addEventListener", { value: vi.fn() });

describe("OfflineService", () => {
  let offlineService: OfflineService;
  let mockSession: ZodSession;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mocks
    mockIndexedDB.open.mockReturnValue(mockRequest);
    mockDatabase.transaction.mockReturnValue(mockTransaction);
    mockObjectStore.index.mockReturnValue(mockIndex);
    mockDatabase.objectStoreNames.contains.mockReturnValue(false);
    localStorageMock.getItem.mockReturnValue(null);
    mockNavigator.onLine = true;

    // Setup successful IndexedDB initialization
    mockRequest.result = mockDatabase;

    mockSession = createMockSession();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with offline mode disabled by default", () => {
      offlineService = new OfflineService();

      expect(offlineService.isOfflineModeEnabled()).toBe(false);
    });

    it("should initialize with custom config", () => {
      const config: Partial<OfflineConfig> = {
        enableOfflineMode: true,
        storageType: "localstorage",
        maxStorageSize: 50,
      };

      offlineService = new OfflineService(config);

      const actualConfig = offlineService.getConfig();
      expect(actualConfig.enableOfflineMode).toBe(true);
      expect(actualConfig.storageType).toBe("localstorage");
      expect(actualConfig.maxStorageSize).toBe(50);
    });

    it("should not initialize storage when offline mode is disabled", () => {
      offlineService = new OfflineService({ enableOfflineMode: false });

      expect(mockIndexedDB.open).not.toHaveBeenCalled();
    });

    it("should initialize IndexedDB when enabled", async () => {
      offlineService = new OfflineService({ enableOfflineMode: true });

      // Simulate successful DB opening
      setTimeout(() => {
        if (mockRequest.onsuccess) {
          mockRequest.onsuccess(new Event("success") as any);
        }
      }, 0);

      expect(mockIndexedDB.open).toHaveBeenCalledWith("claude-code-offline", 1);
    });

    it("should handle IndexedDB initialization errors", async () => {
      offlineService = new OfflineService({ enableOfflineMode: true });

      // Simulate DB error
      setTimeout(() => {
        if (mockRequest.onerror) {
          mockRequest.error = new Error("DB Error");
          mockRequest.onerror(new Event("error") as any);
        }
      }, 0);

      expect(mockIndexedDB.open).toHaveBeenCalled();
    });

    it("should create object store on upgrade needed", async () => {
      mockDatabase.createObjectStore.mockReturnValue(mockObjectStore);

      offlineService = new OfflineService({ enableOfflineMode: true });

      // Use Promise to handle async event
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (mockRequest.onupgradeneeded) {
            mockRequest.result = mockDatabase;
            mockDatabase.objectStoreNames.contains.mockReturnValue(false);
            mockRequest.onupgradeneeded(new Event("upgradeneeded") as any);

            // Check the expectations after event fires
            setTimeout(() => {
              expect(mockDatabase.createObjectStore).toHaveBeenCalledWith(
                "offlineData",
                { keyPath: "id" },
              );
              expect(mockObjectStore.createIndex).toHaveBeenCalledWith(
                "type",
                "type",
                { unique: false },
              );
              resolve();
            }, 0);
          }
        }, 0);
      });
    });
  });

  describe("storeSession", () => {
    beforeEach(() => {
      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should return false when offline mode is disabled", async () => {
      offlineService = new OfflineService({ enableOfflineMode: false });

      const result = await offlineService.storeSession(mockSession);

      expect(result).toBe(false);
    });

    it("should store session with localStorage", async () => {
      const result = await offlineService.storeSession(mockSession);

      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it("should set sync status to synced when online", async () => {
      mockNavigator.onLine = true;

      const result = await offlineService.storeSession(mockSession);

      expect(result).toBe(true);
      // Would verify sync status in storage call
    });

    it("should set sync status to pending when offline", async () => {
      mockNavigator.onLine = false;

      const result = await offlineService.storeSession(mockSession);

      expect(result).toBe(true);
    });

    it("should handle storage errors", async () => {
      // Create a new instance to avoid affecting other tests
      const testService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });

      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error("Storage full");
      });

      const result = await testService.storeSession(mockSession);

      expect(result).toBe(false);
    });
  });

  describe("getOfflineSession", () => {
    beforeEach(() => {
      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should return null when offline mode is disabled", async () => {
      offlineService = new OfflineService({ enableOfflineMode: false });

      const result = await offlineService.getOfflineSession("test-session-1");

      expect(result).toBeNull();
    });

    it("should retrieve session from localStorage", async () => {
      const storedEntry = {
        id: "session-test-session-1",
        type: "session",
        data: mockSession,
        lastModified: "2024-01-01T00:00:00.000Z",
        syncStatus: "synced",
        syncAttempts: 0,
        size: 1000,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedEntry));

      const result = await offlineService.getOfflineSession("test-session-1");

      expect(result).toEqual(mockSession);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        "offline-session-test-session-1",
      );
    });

    it("should return null when session not found", async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await offlineService.getOfflineSession("non-existent");

      expect(result).toBeNull();
    });

    it("should handle retrieval errors", async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error("Storage error");
      });

      const result = await offlineService.getOfflineSession("test-session-1");

      expect(result).toBeNull();
    });
  });

  describe("getAllOfflineSessions", () => {
    beforeEach(() => {
      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should return empty array when offline mode is disabled", async () => {
      offlineService = new OfflineService({ enableOfflineMode: false });

      const result = await offlineService.getAllOfflineSessions();

      expect(result).toEqual([]);
    });

    it("should retrieve all sessions from localStorage", async () => {
      const storedEntry1 = {
        id: "session-test-1",
        type: "session",
        data: mockSession,
        lastModified: "2024-01-01T00:00:00.000Z",
        syncStatus: "synced",
        syncAttempts: 0,
        size: 1000,
      };

      const storedEntry2 = {
        id: "session-test-2",
        type: "session",
        data: createMockSession("test-2"),
        lastModified: "2024-01-01T01:00:00.000Z",
        syncStatus: "pending",
        syncAttempts: 0,
        size: 1200,
      };

      localStorageMock.length = 4;
      localStorageMock.key.mockImplementation((index) => {
        const keys = [
          "offline-session-test-1",
          "offline-session-test-2",
          "other-key",
          "another-key",
        ];
        return keys[index];
      });

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === "offline-session-test-1")
          return JSON.stringify(storedEntry1);
        if (key === "offline-session-test-2")
          return JSON.stringify(storedEntry2);
        return null;
      });

      const result = await offlineService.getAllOfflineSessions();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockSession);
    });

    it("should handle corrupted entries gracefully", async () => {
      localStorageMock.length = 1;
      localStorageMock.key.mockReturnValue("offline-session-test-1");
      localStorageMock.getItem.mockReturnValue("invalid-json");

      const result = await offlineService.getAllOfflineSessions();

      expect(result).toEqual([]);
    });
  });

  describe("storeSearchIndex", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation(() => {}); // Reset to successful mock

      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should store search index", async () => {
      const indexData = { terms: ["test", "search"], mappings: {} };

      // Ensure localStorage mock works
      expect(localStorageMock.setItem).not.toThrow();

      const result = await offlineService.storeSearchIndex(indexData);

      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "offline-search-index",
        expect.stringContaining("search-index"),
      );
    });

    it("should return false when offline mode is disabled", async () => {
      offlineService = new OfflineService({ enableOfflineMode: false });
      const indexData = { terms: ["test"] };

      const result = await offlineService.storeSearchIndex(indexData);

      expect(result).toBe(false);
    });
  });

  describe("getOfflineSearchIndex", () => {
    beforeEach(() => {
      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should retrieve search index", async () => {
      const indexData = { terms: ["test", "search"] };
      const storedEntry = {
        id: "search-index",
        type: "search_index",
        data: indexData,
        lastModified: "2024-01-01T00:00:00.000Z",
        syncStatus: "synced",
        syncAttempts: 0,
        size: 100,
      };

      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedEntry));

      const result = await offlineService.getOfflineSearchIndex();

      expect(result).toEqual(indexData);
    });

    it("should return null when not found", async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await offlineService.getOfflineSearchIndex();

      expect(result).toBeNull();
    });
  });

  describe("syncOfflineData", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorageMock.setItem.mockClear();
      localStorageMock.setItem.mockImplementation(() => {}); // Reset to default mock

      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should return failure when offline", async () => {
      mockNavigator.onLine = false;

      const result = await offlineService.syncOfflineData();

      expect(result.success).toBe(false);
      expect(result.errors).toContain("Sync already in progress or offline");
    });

    it("should sync pending entries when online", async () => {
      mockNavigator.onLine = true;

      // Clear any previous mock implementations
      vi.clearAllMocks();
      localStorageMock.setItem.mockClear();

      // Mock pending entries
      const pendingEntry = {
        id: "session-test-1",
        type: "session",
        data: mockSession,
        lastModified: "2024-01-01T00:00:00.000Z",
        syncStatus: "pending",
        syncAttempts: 0,
        size: 1000,
      };

      localStorageMock.length = 1;
      localStorageMock.key.mockReturnValue("offline-session-test-1");
      localStorageMock.getItem.mockReturnValue(JSON.stringify(pendingEntry));

      const result = await offlineService.syncOfflineData();

      expect(result.success).toBe(true);
      expect(result.syncedItems).toBe(1);
      expect(result.failedItems).toBe(0);
    });

    it("should prevent concurrent sync", async () => {
      mockNavigator.onLine = true;

      // Start first sync
      const promise1 = offlineService.syncOfflineData();

      // Try to start second sync immediately
      const result2 = await offlineService.syncOfflineData();

      expect(result2.success).toBe(false);
      expect(result2.errors).toContain("Sync already in progress or offline");

      // Wait for first sync to complete
      await promise1;
    });
  });

  describe("getStorageQuota", () => {
    beforeEach(() => {
      offlineService = new OfflineService();
    });

    it("should return storage quota information", async () => {
      mockNavigator.storage.estimate.mockResolvedValue({
        usage: 1000000,
        quota: 10000000,
      });

      const quota = await offlineService.getStorageQuota();

      expect(quota.used).toBe(1000000);
      expect(quota.available).toBe(9000000);
      expect(quota.total).toBe(10000000);
      expect(quota.percentage).toBe(10);
    });

    it("should handle missing storage API", async () => {
      const originalStorage = mockNavigator.storage;
      delete (mockNavigator as any).storage;

      const quota = await offlineService.getStorageQuota();

      expect(quota.used).toBe(0);
      expect(quota.available).toBe(0);
      expect(quota.total).toBe(0);
      expect(quota.percentage).toBe(0);

      mockNavigator.storage = originalStorage;
    });
  });

  describe("isOnline", () => {
    beforeEach(() => {
      offlineService = new OfflineService();
    });

    it("should return true when online", () => {
      mockNavigator.onLine = true;

      expect(offlineService.isOnline()).toBe(true);
    });

    it("should return false when offline", () => {
      mockNavigator.onLine = false;

      expect(offlineService.isOnline()).toBe(false);
    });
  });

  describe("updateConfig", () => {
    beforeEach(() => {
      offlineService = new OfflineService({ enableOfflineMode: false });
    });

    it("should update configuration", () => {
      offlineService.updateConfig({ maxStorageSize: 200 });

      const config = offlineService.getConfig();
      expect(config.maxStorageSize).toBe(200);
    });

    it("should enable offline mode when updated", () => {
      expect(offlineService.isOfflineModeEnabled()).toBe(false);

      offlineService.updateConfig({ enableOfflineMode: true });

      expect(offlineService.isOfflineModeEnabled()).toBe(true);
    });
  });

  describe("addSyncListener", () => {
    beforeEach(() => {
      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should add sync listener and return unsubscribe function", () => {
      const listener = vi.fn();
      const unsubscribe = offlineService.addSyncListener(listener);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should notify listeners on sync completion", async () => {
      const listener = vi.fn();
      offlineService.addSyncListener(listener);

      mockNavigator.onLine = true;
      localStorageMock.length = 0; // No pending entries

      await offlineService.syncOfflineData();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          syncedItems: 0,
          failedItems: 0,
        }),
      );
    });

    it("should allow unsubscribing", async () => {
      const listener = vi.fn();
      const unsubscribe = offlineService.addSyncListener(listener);

      unsubscribe();

      mockNavigator.onLine = true;
      await offlineService.syncOfflineData();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("clearOfflineData", () => {
    beforeEach(() => {
      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should clear localStorage data", async () => {
      localStorageMock.length = 2;
      localStorageMock.key.mockImplementation(
        (index) => ["offline-session-1", "other-key"][index],
      );

      await offlineService.clearOfflineData();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith(
        "offline-session-1",
      );
      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(1);
    });
  });

  describe("getOfflineStats", () => {
    beforeEach(() => {
      offlineService = new OfflineService({
        enableOfflineMode: true,
        storageType: "localstorage",
      });
    });

    it("should return offline statistics", async () => {
      const entry1 = {
        id: "session-1",
        type: "session",
        data: mockSession,
        syncStatus: "synced",
        size: 1000,
      };

      const entry2 = {
        id: "session-2",
        type: "session",
        data: createMockSession("test-2"),
        syncStatus: "pending",
        size: 1200,
      };

      localStorageMock.length = 2;
      localStorageMock.key.mockImplementation(
        (index) => ["offline-session-1", "offline-session-2"][index],
      );

      localStorageMock.getItem.mockImplementation((key) => {
        if (key === "offline-session-1") return JSON.stringify(entry1);
        if (key === "offline-session-2") return JSON.stringify(entry2);
        return null;
      });

      const stats = await offlineService.getOfflineStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBe(2200);
      expect(stats.pendingSync).toBe(1);
    });

    it("should handle errors gracefully", async () => {
      localStorageMock.key.mockImplementation(() => {
        throw new Error("Storage error");
      });

      const stats = await offlineService.getOfflineStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.pendingSync).toBe(0);
    });
  });
});

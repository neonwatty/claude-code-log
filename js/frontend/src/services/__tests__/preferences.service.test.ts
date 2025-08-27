import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { PreferencesService } from "../preferences.service";
import type {
  UserPreferences,
  PreferenceChangeEvent,
} from "../preferences.service";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock matchMedia
const mockMatchMedia = vi.fn();

// Mock document.documentElement
const mockDocumentElement = {
  setAttribute: vi.fn(),
  classList: {
    add: vi.fn(),
    remove: vi.fn(),
  },
};

Object.defineProperty(window, "localStorage", { value: localStorageMock });
Object.defineProperty(window, "matchMedia", { value: mockMatchMedia });
Object.defineProperty(document, "documentElement", {
  value: mockDocumentElement,
});

describe("PreferencesService", () => {
  let preferencesService: PreferencesService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockMatchMedia.mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
    });

    preferencesService = new PreferencesService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with default preferences", () => {
      const preferences = preferencesService.getPreferences();

      expect(preferences.theme).toBe("auto");
      expect(preferences.displayDensity).toBe("comfortable");
      expect(preferences.dateFormat).toBe("relative");
      expect(preferences.showTimestamps).toBe(true);
      expect(preferences.enableAnalytics).toBe(true);
    });

    it("should load saved preferences from localStorage", () => {
      const savedPreferences = {
        version: "1.0.0",
        preferences: {
          theme: "dark",
          showTimestamps: false,
        },
      };

      localStorageMock.getItem.mockReturnValue(
        JSON.stringify(savedPreferences),
      );

      const newService = new PreferencesService();
      const preferences = newService.getPreferences();

      expect(preferences.theme).toBe("dark");
      expect(preferences.showTimestamps).toBe(false);
      // Should merge with defaults
      expect(preferences.displayDensity).toBe("comfortable");
    });

    it("should handle corrupted localStorage data", () => {
      localStorageMock.getItem.mockReturnValue("invalid-json");

      const newService = new PreferencesService();
      const preferences = newService.getPreferences();

      // Should fall back to defaults
      expect(preferences.theme).toBe("auto");
    });
  });

  describe("getPreference", () => {
    it("should return specific preference value", () => {
      const theme = preferencesService.getPreference("theme");
      const showTimestamps = preferencesService.getPreference("showTimestamps");

      expect(theme).toBe("auto");
      expect(showTimestamps).toBe(true);
    });
  });

  describe("setPreference", () => {
    it("should set individual preference", () => {
      preferencesService.setPreference("theme", "dark");

      expect(preferencesService.getPreference("theme")).toBe("dark");
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it("should not save if value is unchanged", () => {
      preferencesService.setPreference("theme", "auto"); // Same as default

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it("should emit change event", () => {
      const listener = vi.fn();
      preferencesService.addChangeListener(listener);

      preferencesService.setPreference("theme", "dark");

      expect(listener).toHaveBeenCalledWith({
        key: "theme",
        oldValue: "auto",
        newValue: "dark",
        timestamp: expect.any(String),
      });
    });

    it("should apply theme changes immediately", () => {
      preferencesService.setPreference("theme", "dark");

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith(
        "data-theme",
        "dark",
      );
    });

    it("should apply accessibility changes", () => {
      preferencesService.setPreference("highContrastMode", true);

      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith(
        "high-contrast",
      );
    });
  });

  describe("setPreferences", () => {
    it("should set multiple preferences at once", () => {
      const updates: Partial<UserPreferences> = {
        theme: "dark",
        showTimestamps: false,
        displayDensity: "compact",
      };

      preferencesService.setPreferences(updates);

      expect(preferencesService.getPreference("theme")).toBe("dark");
      expect(preferencesService.getPreference("showTimestamps")).toBe(false);
      expect(preferencesService.getPreference("displayDensity")).toBe(
        "compact",
      );
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it("should emit change events for all changed preferences", () => {
      const listener = vi.fn();
      preferencesService.addChangeListener(listener);

      preferencesService.setPreferences({
        theme: "dark",
        showTimestamps: false,
      });

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("should not emit events for unchanged values", () => {
      const listener = vi.fn();
      preferencesService.addChangeListener(listener);

      preferencesService.setPreferences({
        theme: "auto", // Same as default
        showTimestamps: false, // Different from default
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("resetToDefaults", () => {
    it("should reset all preferences to defaults", () => {
      // Change some preferences first
      preferencesService.setPreferences({
        theme: "dark",
        showTimestamps: false,
        displayDensity: "compact",
      });

      preferencesService.resetToDefaults();

      const preferences = preferencesService.getPreferences();
      expect(preferences.theme).toBe("auto");
      expect(preferences.showTimestamps).toBe(true);
      expect(preferences.displayDensity).toBe("comfortable");
    });

    it("should emit change events for reset preferences", () => {
      const listener = vi.fn();

      preferencesService.setPreference("theme", "dark");
      preferencesService.addChangeListener(listener);

      preferencesService.resetToDefaults();

      expect(listener).toHaveBeenCalledWith({
        key: "theme",
        oldValue: "dark",
        newValue: "auto",
        timestamp: expect.any(String),
      });
    });
  });

  describe("exportPreferences", () => {
    it("should export preferences as JSON string", () => {
      preferencesService.setPreference("theme", "dark");

      const exported = preferencesService.exportPreferences();
      const parsed = JSON.parse(exported);

      expect(parsed.version).toBeDefined();
      expect(parsed.preferences.theme).toBe("dark");
      expect(parsed.exportedAt).toBeDefined();
    });
  });

  describe("importPreferences", () => {
    it("should import valid preferences configuration", () => {
      const config = {
        version: "1.0.0",
        preferences: {
          theme: "dark",
          showTimestamps: false,
        },
      };

      const result = preferencesService.importPreferences(
        JSON.stringify(config),
      );

      expect(result).toBe(true);
      expect(preferencesService.getPreference("theme")).toBe("dark");
      expect(preferencesService.getPreference("showTimestamps")).toBe(false);
    });

    it("should reject invalid JSON", () => {
      const result = preferencesService.importPreferences("invalid-json");

      expect(result).toBe(false);
    });

    it("should reject configuration without preferences", () => {
      const config = { version: "1.0.0" };

      const result = preferencesService.importPreferences(
        JSON.stringify(config),
      );

      expect(result).toBe(false);
    });

    it("should validate imported preferences", () => {
      const config = {
        preferences: {
          theme: "invalid-theme", // Invalid value
          showTimestamps: true, // Valid value
        },
      };

      const result = preferencesService.importPreferences(
        JSON.stringify(config),
      );

      expect(result).toBe(true);
      // Should only import valid preferences
      expect(preferencesService.getPreference("theme")).toBe("auto"); // Should remain default
      expect(preferencesService.getPreference("showTimestamps")).toBe(true); // Should be imported
    });
  });

  describe("addChangeListener", () => {
    it("should add change listener", () => {
      const listener = vi.fn();
      const unsubscribe = preferencesService.addChangeListener(listener);

      preferencesService.setPreference("theme", "dark");

      expect(listener).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe("function");
    });

    it("should remove change listener", () => {
      const listener = vi.fn();
      const unsubscribe = preferencesService.addChangeListener(listener);

      unsubscribe();
      preferencesService.setPreference("theme", "dark");

      expect(listener).not.toHaveBeenCalled();
    });

    it("should handle listener errors gracefully", () => {
      const faultyListener = vi.fn(() => {
        throw new Error("Listener error");
      });

      preferencesService.addChangeListener(faultyListener);

      // Should not throw error
      expect(() => {
        preferencesService.setPreference("theme", "dark");
      }).not.toThrow();
    });
  });

  describe("getPreferenceSchema", () => {
    it("should return preference schema", () => {
      const schema = preferencesService.getPreferenceSchema();

      expect(schema.theme).toEqual({
        type: "select",
        options: ["light", "dark", "auto"],
      });
      expect(schema.showTimestamps).toEqual({ type: "boolean" });
      expect(schema.maxSearchResults).toEqual({ type: "number" });
    });
  });

  describe("theme handling", () => {
    it("should apply light theme directly", () => {
      preferencesService.setPreference("theme", "light");

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith(
        "data-theme",
        "light",
      );
    });

    it("should apply dark theme directly", () => {
      preferencesService.setPreference("theme", "dark");

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith(
        "data-theme",
        "dark",
      );
    });

    it("should use system preference for auto theme", () => {
      // Clear any previous calls
      vi.clearAllMocks();

      mockMatchMedia.mockReturnValue({
        matches: true, // prefers dark
        addEventListener: vi.fn(),
      });

      // Create a new service instance that will pick up the updated matchMedia mock
      const testService = new PreferencesService();
      testService.setPreference("theme", "auto");

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith(
        "data-theme",
        "dark",
      );
    });

    it("should use light theme when system prefers light", () => {
      // Clear any previous calls
      vi.clearAllMocks();

      mockMatchMedia.mockReturnValue({
        matches: false, // does not prefer dark
        addEventListener: vi.fn(),
      });

      // Create a new service instance that will pick up the updated matchMedia mock
      const testService = new PreferencesService();
      testService.setPreference("theme", "auto");

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith(
        "data-theme",
        "light",
      );
    });
  });

  describe("accessibility preferences", () => {
    it("should apply high contrast mode", () => {
      preferencesService.setPreference("highContrastMode", true);

      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith(
        "high-contrast",
      );
    });

    it("should remove high contrast mode", () => {
      // First set it to true, then set to false to trigger the remove
      preferencesService.setPreference("highContrastMode", true);
      vi.clearAllMocks(); // Clear the add call

      preferencesService.setPreference("highContrastMode", false);

      expect(mockDocumentElement.classList.remove).toHaveBeenCalledWith(
        "high-contrast",
      );
    });

    it("should apply reduced motion", () => {
      preferencesService.setPreference("reducedMotion", true);

      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith(
        "reduced-motion",
      );
    });

    it("should apply screen reader support", () => {
      preferencesService.setPreference("enableScreenReaderSupport", true);

      expect(mockDocumentElement.classList.add).toHaveBeenCalledWith(
        "screen-reader-enabled",
      );
    });
  });

  describe("display density", () => {
    it("should apply display density", () => {
      preferencesService.setPreference("displayDensity", "compact");

      expect(mockDocumentElement.setAttribute).toHaveBeenCalledWith(
        "data-density",
        "compact",
      );
    });
  });

  describe("preference validation", () => {
    it("should validate select options", () => {
      const validated = preferencesService["validatePreferences"]({
        theme: "dark", // valid
        displayDensity: "invalid", // invalid
      });

      expect(validated.theme).toBe("dark");
      expect(validated.displayDensity).toBeUndefined();
    });

    it("should validate boolean values", () => {
      const validated = preferencesService["validatePreferences"]({
        showTimestamps: true, // valid
        enableAnalytics: "yes", // invalid type
      });

      expect(validated.showTimestamps).toBe(true);
      expect(validated.enableAnalytics).toBeUndefined();
    });

    it("should validate number values", () => {
      const validated = preferencesService["validatePreferences"]({
        maxSearchResults: 100, // valid
        refreshInterval: "fast", // invalid type
      });

      expect(validated.maxSearchResults).toBe(100);
      expect(validated.refreshInterval).toBeUndefined();
    });

    it("should validate array values", () => {
      const validated = preferencesService["validatePreferences"]({
        defaultSearchFields: ["all"], // valid
      });

      expect(validated.defaultSearchFields).toEqual(["all"]);
    });
  });
});

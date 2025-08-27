/**
 * User preference types and themes
 */
export type ThemeMode = "light" | "dark" | "auto";
export type DisplayDensity = "compact" | "comfortable" | "spacious";
export type DateFormat = "relative" | "absolute" | "iso";

/**
 * User preferences interface
 */
export interface UserPreferences {
  // Display preferences
  theme: ThemeMode;
  displayDensity: DisplayDensity;
  dateFormat: DateFormat;
  showTimestamps: boolean;
  showTokenUsage: boolean;
  highlightCodeBlocks: boolean;

  // Search preferences
  defaultSearchFields: string[];
  maxSearchResults: number;
  enableSearchSuggestions: boolean;
  caseSensitiveSearch: boolean;

  // Session preferences
  autoRefreshSessions: boolean;
  refreshInterval: number; // in seconds
  defaultPageSize: number;
  showSystemMessages: boolean;
  collapseToolResults: boolean;

  // Export preferences
  defaultExportFormat: string;
  includeMetadataByDefault: boolean;
  compressExportsByDefault: boolean;

  // Accessibility preferences
  enableScreenReaderSupport: boolean;
  highContrastMode: boolean;
  reducedMotion: boolean;
  keyboardNavigationEnabled: boolean;

  // Advanced preferences
  enableDeveloperMode: boolean;
  debugMode: boolean;
  enableAnalytics: boolean;
  enableOfflineMode: boolean;
}

/**
 * Preference change event
 */
export interface PreferenceChangeEvent {
  key: keyof UserPreferences;
  oldValue: any;
  newValue: any;
  timestamp: string;
}

/**
 * Default user preferences
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  // Display
  theme: "auto",
  displayDensity: "comfortable",
  dateFormat: "relative",
  showTimestamps: true,
  showTokenUsage: true,
  highlightCodeBlocks: true,

  // Search
  defaultSearchFields: ["all"],
  maxSearchResults: 50,
  enableSearchSuggestions: true,
  caseSensitiveSearch: false,

  // Session
  autoRefreshSessions: false,
  refreshInterval: 30,
  defaultPageSize: 20,
  showSystemMessages: false,
  collapseToolResults: true,

  // Export
  defaultExportFormat: "json",
  includeMetadataByDefault: true,
  compressExportsByDefault: false,

  // Accessibility
  enableScreenReaderSupport: false,
  highContrastMode: false,
  reducedMotion: false,
  keyboardNavigationEnabled: true,

  // Advanced
  enableDeveloperMode: false,
  debugMode: false,
  enableAnalytics: true,
  enableOfflineMode: false,
};

/**
 * User preferences service with persistence and validation
 */
export class PreferencesService {
  private preferences: UserPreferences;
  private changeListeners: Array<(event: PreferenceChangeEvent) => void> = [];
  private readonly STORAGE_KEY = "claude-code-preferences";
  private readonly STORAGE_VERSION = "1.0.0";

  constructor() {
    this.preferences = this.loadPreferences();
    this.applyThemePreferences();
    this.setupMediaQueryListeners();
  }

  /**
   * Get all preferences
   */
  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * Get a specific preference value
   */
  getPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return this.preferences[key];
  }

  /**
   * Set a specific preference
   */
  setPreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ): void {
    const oldValue = this.preferences[key];

    if (oldValue === value) {
      return; // No change
    }

    this.preferences[key] = value;
    this.savePreferences();

    // Emit change event
    const changeEvent: PreferenceChangeEvent = {
      key,
      oldValue,
      newValue: value,
      timestamp: new Date().toISOString(),
    };

    this.notifyListeners(changeEvent);

    // Apply special handling for certain preferences
    this.handlePreferenceChange(key, value);
  }

  /**
   * Set multiple preferences at once
   */
  setPreferences(updates: Partial<UserPreferences>): void {
    const changes: PreferenceChangeEvent[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const typedKey = key as keyof UserPreferences;
      const oldValue = this.preferences[typedKey];

      if (oldValue !== value) {
        this.preferences[typedKey] = value as any;
        changes.push({
          key: typedKey,
          oldValue,
          newValue: value,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (changes.length > 0) {
      this.savePreferences();
      changes.forEach((change) => this.notifyListeners(change));

      // Apply bulk changes
      this.applyThemePreferences();
      this.applyAccessibilityPreferences();
    }
  }

  /**
   * Reset preferences to defaults
   */
  resetToDefaults(): void {
    const oldPreferences = { ...this.preferences };
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.savePreferences();

    // Emit change events for all preferences
    for (const key of Object.keys(DEFAULT_PREFERENCES) as Array<
      keyof UserPreferences
    >) {
      if (oldPreferences[key] !== DEFAULT_PREFERENCES[key]) {
        this.notifyListeners({
          key,
          oldValue: oldPreferences[key],
          newValue: DEFAULT_PREFERENCES[key],
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.applyThemePreferences();
    this.applyAccessibilityPreferences();
  }

  /**
   * Export preferences configuration
   */
  exportPreferences(): string {
    return JSON.stringify(
      {
        version: this.STORAGE_VERSION,
        preferences: this.preferences,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  /**
   * Import preferences from exported configuration
   */
  importPreferences(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);

      if (!config.preferences) {
        throw new Error("Invalid preferences configuration");
      }

      // Validate preferences structure
      const validatedPreferences = this.validatePreferences(config.preferences);
      this.setPreferences(validatedPreferences);

      return true;
    } catch (error) {
      console.error("Failed to import preferences:", error);
      return false;
    }
  }

  /**
   * Add preference change listener
   */
  addChangeListener(
    listener: (event: PreferenceChangeEvent) => void,
  ): () => void {
    this.changeListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get preference schema for validation
   */
  getPreferenceSchema(): Record<
    keyof UserPreferences,
    { type: string; options?: any[] }
  > {
    return {
      theme: { type: "select", options: ["light", "dark", "auto"] },
      displayDensity: {
        type: "select",
        options: ["compact", "comfortable", "spacious"],
      },
      dateFormat: { type: "select", options: ["relative", "absolute", "iso"] },
      showTimestamps: { type: "boolean" },
      showTokenUsage: { type: "boolean" },
      highlightCodeBlocks: { type: "boolean" },
      defaultSearchFields: { type: "array" },
      maxSearchResults: { type: "number" },
      enableSearchSuggestions: { type: "boolean" },
      caseSensitiveSearch: { type: "boolean" },
      autoRefreshSessions: { type: "boolean" },
      refreshInterval: { type: "number" },
      defaultPageSize: { type: "number" },
      showSystemMessages: { type: "boolean" },
      collapseToolResults: { type: "boolean" },
      defaultExportFormat: {
        type: "select",
        options: ["json", "csv", "markdown", "html"],
      },
      includeMetadataByDefault: { type: "boolean" },
      compressExportsByDefault: { type: "boolean" },
      enableScreenReaderSupport: { type: "boolean" },
      highContrastMode: { type: "boolean" },
      reducedMotion: { type: "boolean" },
      keyboardNavigationEnabled: { type: "boolean" },
      enableDeveloperMode: { type: "boolean" },
      debugMode: { type: "boolean" },
      enableAnalytics: { type: "boolean" },
      enableOfflineMode: { type: "boolean" },
    };
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): UserPreferences {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (!saved) {
        return { ...DEFAULT_PREFERENCES };
      }

      const parsed = JSON.parse(saved);

      // Merge with defaults to handle new preferences in updates
      return { ...DEFAULT_PREFERENCES, ...parsed.preferences };
    } catch (error) {
      console.warn("Could not load preferences from localStorage:", error);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      const data = {
        version: this.STORAGE_VERSION,
        preferences: this.preferences,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Could not save preferences to localStorage:", error);
    }
  }

  /**
   * Validate preferences object
   */
  private validatePreferences(prefs: any): Partial<UserPreferences> {
    const validated: Partial<UserPreferences> = {};
    const schema = this.getPreferenceSchema();

    for (const [key, schemaInfo] of Object.entries(schema)) {
      const typedKey = key as keyof UserPreferences;
      const value = prefs[key];

      if (value === undefined) continue;

      switch (schemaInfo.type) {
        case "boolean":
          if (typeof value === "boolean") {
            validated[typedKey] = value as any;
          }
          break;
        case "number":
          if (typeof value === "number" && !isNaN(value)) {
            validated[typedKey] = value as any;
          }
          break;
        case "string":
          if (typeof value === "string") {
            validated[typedKey] = value as any;
          }
          break;
        case "select":
          if (schemaInfo.options && schemaInfo.options.includes(value)) {
            validated[typedKey] = value as any;
          }
          break;
        case "array":
          if (Array.isArray(value)) {
            validated[typedKey] = value as any;
          }
          break;
      }
    }

    return validated;
  }

  /**
   * Notify all change listeners
   */
  private notifyListeners(event: PreferenceChangeEvent): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in preference change listener:", error);
      }
    });
  }

  /**
   * Handle specific preference changes
   */
  private handlePreferenceChange<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ): void {
    switch (key) {
      case "theme":
        this.applyThemePreferences();
        break;
      case "highContrastMode":
      case "reducedMotion":
      case "enableScreenReaderSupport":
        this.applyAccessibilityPreferences();
        break;
      case "displayDensity":
        this.applyDensityPreferences();
        break;
    }
  }

  /**
   * Apply theme preferences to document
   */
  private applyThemePreferences(): void {
    const theme = this.preferences.theme;
    const root = document.documentElement;

    if (theme === "auto") {
      // Use system preference
      if (typeof window !== "undefined" && window.matchMedia) {
        const prefersDark = window.matchMedia(
          "(prefers-color-scheme: dark)",
        ).matches;
        root.setAttribute("data-theme", prefersDark ? "dark" : "light");
      } else {
        root.setAttribute("data-theme", "light"); // Default fallback
      }
    } else {
      root.setAttribute("data-theme", theme);
    }
  }

  /**
   * Apply accessibility preferences
   */
  private applyAccessibilityPreferences(): void {
    const root = document.documentElement;

    if (this.preferences.highContrastMode) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }

    if (this.preferences.reducedMotion) {
      root.classList.add("reduced-motion");
    } else {
      root.classList.remove("reduced-motion");
    }

    if (this.preferences.enableScreenReaderSupport) {
      root.classList.add("screen-reader-enabled");
    } else {
      root.classList.remove("screen-reader-enabled");
    }
  }

  /**
   * Apply display density preferences
   */
  private applyDensityPreferences(): void {
    const root = document.documentElement;
    root.setAttribute("data-density", this.preferences.displayDensity);
  }

  /**
   * Setup media query listeners for auto theme
   */
  private setupMediaQueryListeners(): void {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      const handleChange = () => {
        if (this.preferences.theme === "auto") {
          this.applyThemePreferences();
        }
      };

      mediaQuery.addEventListener("change", handleChange);
    }
  }
}

// Export singleton instance
export const preferencesService = new PreferencesService();

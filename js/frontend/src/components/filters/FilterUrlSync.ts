import { FilterController, FilterState } from './FilterController';
import type { SearchOptions } from './FilterEngine';

export interface FilterUrlSyncOptions {
  enableHistory?: boolean;
  prefix?: string;
  debounceMs?: number;
  includeSearchOptions?: boolean;
}

/**
 * Utility class for synchronizing filter state with URL parameters
 * Enables shareable search URLs and browser history integration
 */
export class FilterUrlSync {
  private controller: FilterController;
  private options: FilterUrlSyncOptions;
  private debounceTimer: number | undefined;
  private isUpdatingFromUrl = false;

  constructor(controller: FilterController, options: FilterUrlSyncOptions = {}) {
    this.controller = controller;
    this.options = {
      enableHistory: true,
      prefix: 'filter',
      debounceMs: 500,
      includeSearchOptions: true,
      ...options,
    };

    // Listen for URL changes
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handlePopState);
      
      // Initialize from current URL
      this.syncFromUrl();
    }
  }

  /**
   * Sync filter state to URL parameters
   */
  syncToUrl(state?: FilterState, searchOptions?: SearchOptions) {
    if (this.isUpdatingFromUrl) return;

    // Clear existing debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      const currentState = state || this.controller.state;
      const params = this.buildUrlParams(currentState, searchOptions);
      this.updateUrl(params);
      this.debounceTimer = undefined;
    }, this.options.debounceMs);
  }

  /**
   * Sync from URL parameters to filter state
   */
  syncFromUrl() {
    if (typeof window === 'undefined') return;

    this.isUpdatingFromUrl = true;
    
    try {
      const url = new URL(window.location.href);
      const params = url.searchParams;
      
      // Check if any filter parameters exist
      const hasFilterParams = Array.from(params.keys()).some(key => 
        key.startsWith(this.options.prefix!)
      );

      if (hasFilterParams) {
        this.applyUrlParams(params);
      }
    } catch (error) {
      console.warn('Failed to sync filters from URL:', error);
    } finally {
      this.isUpdatingFromUrl = false;
    }
  }

  /**
   * Clear all filter parameters from URL
   */
  clearFromUrl() {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const params = url.searchParams;
    
    // Remove all filter parameters
    const keysToRemove: string[] = [];
    params.forEach((_, key) => {
      if (key.startsWith(this.options.prefix!)) {
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => params.delete(key));
    
    this.updateUrl(params);
  }

  /**
   * Generate a shareable URL with current filters
   */
  getShareableUrl(baseUrl?: string): string {
    const url = new URL(baseUrl || window.location.href);
    const params = this.buildUrlParams(this.controller.state);
    
    // Clear existing filter params
    const keysToRemove: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (key.startsWith(this.options.prefix!)) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => url.searchParams.delete(key));

    // Add current filter params
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    return url.toString();
  }

  /**
   * Import filters from a URL string
   */
  importFromUrl(urlString: string) {
    try {
      const url = new URL(urlString);
      this.applyUrlParams(url.searchParams);
    } catch (error) {
      console.warn('Failed to import filters from URL:', error);
    }
  }

  /**
   * Export current filters as URL parameters object
   */
  exportAsParams(): Record<string, string> {
    const params = this.buildUrlParams(this.controller.state);
    const result: Record<string, string> = {};
    
    params.forEach((value, key) => {
      result[key] = value;
    });
    
    return result;
  }

  /**
   * Build URL parameters from filter state
   */
  private buildUrlParams(state: FilterState, searchOptions?: SearchOptions): URLSearchParams {
    const params = new URLSearchParams();
    const prefix = this.options.prefix!;

    // Search query
    if (state.searchQuery.trim()) {
      params.set(`${prefix}_q`, state.searchQuery);
    }

    // Search fields (only if not all fields are selected)
    const allFields = ['content', 'role', 'toolName', 'error'];
    if (state.searchFields.length > 0 && state.searchFields.length < allFields.length) {
      params.set(`${prefix}_fields`, state.searchFields.join(','));
    }

    // Message types (only if not all types are selected)
    const allTypes = ['user', 'assistant', 'system', 'error'];
    if (state.messageTypes.length > 0 && state.messageTypes.length < allTypes.length) {
      params.set(`${prefix}_types`, state.messageTypes.join(','));
    }

    // Date range
    if (state.dateRange.start) {
      params.set(`${prefix}_from`, state.dateRange.start.toISOString().split('T')[0]);
    }
    if (state.dateRange.end) {
      params.set(`${prefix}_to`, state.dateRange.end.toISOString().split('T')[0]);
    }

    // Session IDs
    if (state.sessionIds.length > 0) {
      params.set(`${prefix}_sessions`, state.sessionIds.join(','));
    }

    // Active filter combinations
    const activeFilters = state.activeFilters.filter(f => f.isActive);
    if (activeFilters.length > 0) {
      params.set(`${prefix}_combos`, activeFilters.map(f => f.id).join(','));
    }

    // Search options (if enabled)
    if (this.options.includeSearchOptions && searchOptions) {
      if (searchOptions.caseSensitive) {
        params.set(`${prefix}_case`, '1');
      }
      if (searchOptions.wholeWord) {
        params.set(`${prefix}_word`, '1');
      }
      if (searchOptions.regex) {
        params.set(`${prefix}_regex`, '1');
      }
      if (searchOptions.fuzzyThreshold && searchOptions.fuzzyThreshold < 1) {
        params.set(`${prefix}_fuzzy`, searchOptions.fuzzyThreshold.toString());
      }
    }

    return params;
  }

  /**
   * Apply URL parameters to filter state
   */
  private applyUrlParams(params: URLSearchParams) {
    const prefix = this.options.prefix!;
    const updates: Partial<FilterState> = {};

    // Search query
    const query = params.get(`${prefix}_q`);
    if (query !== null) {
      this.controller.setSearchQuery(query, 0); // No debounce when loading from URL
    }

    // Search fields
    const fields = params.get(`${prefix}_fields`);
    if (fields) {
      const fieldArray = fields.split(',').filter(field => 
        ['content', 'role', 'toolName', 'error'].includes(field)
      ) as Array<'content' | 'role' | 'toolName' | 'error'>;
      if (fieldArray.length > 0) {
        this.controller.setSearchFields(fieldArray);
      }
    }

    // Message types
    const types = params.get(`${prefix}_types`);
    if (types) {
      const typeArray = types.split(',').filter(type => 
        ['user', 'assistant', 'system', 'error'].includes(type)
      ) as Array<'user' | 'assistant' | 'system' | 'error'>;
      if (typeArray.length > 0) {
        this.controller.setMessageTypes(typeArray);
      }
    }

    // Date range
    const fromDate = params.get(`${prefix}_from`);
    const toDate = params.get(`${prefix}_to`);
    if (fromDate || toDate) {
      const start = fromDate ? new Date(fromDate) : null;
      const end = toDate ? new Date(toDate) : null;
      this.controller.setDateRange(start, end);
    }

    // Session IDs
    const sessions = params.get(`${prefix}_sessions`);
    if (sessions) {
      const sessionArray = sessions.split(',').filter(Boolean);
      this.controller.setSessionFilters(sessionArray);
    }

    // Active filter combinations
    const combos = params.get(`${prefix}_combos`);
    if (combos) {
      const comboIds = combos.split(',').filter(Boolean);
      // Toggle each combination to active state
      comboIds.forEach(id => {
        this.controller.toggleFilterCombination(id);
      });
    }
  }

  /**
   * Update the browser URL
   */
  private updateUrl(params: URLSearchParams) {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    
    // Remove existing filter parameters
    const keysToRemove: string[] = [];
    url.searchParams.forEach((_, key) => {
      if (key.startsWith(this.options.prefix!)) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => url.searchParams.delete(key));

    // Add new parameters
    params.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const newUrl = url.toString();
    
    if (newUrl !== window.location.href) {
      if (this.options.enableHistory) {
        window.history.pushState(null, '', newUrl);
      } else {
        window.history.replaceState(null, '', newUrl);
      }

      // Dispatch event for other components that might need to know
      window.dispatchEvent(new CustomEvent('filtersUrlChanged', {
        detail: { url: newUrl, params: this.exportAsParams() }
      }));
    }
  }

  /**
   * Handle browser back/forward navigation
   */
  private handlePopState = () => {
    this.syncFromUrl();
  };

  /**
   * Clean up event listeners
   */
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

/**
 * Hook for easy integration with Lit components
 */
export function useFilterUrlSync(
  controller: FilterController, 
  options?: FilterUrlSyncOptions
): FilterUrlSync {
  const sync = new FilterUrlSync(controller, options);
  
  // Auto-sync when controller state changes
  const originalRequestUpdate = controller['host'].requestUpdate.bind(controller['host']);
  controller['host'].requestUpdate = function() {
    sync.syncToUrl();
    return originalRequestUpdate();
  };

  return sync;
}

/**
 * Utility functions for URL parameter manipulation
 */
export const FilterUrlUtils = {
  /**
   * Parse filter parameters from a URL string
   */
  parseFiltersFromUrl(urlString: string, prefix = 'filter'): Record<string, string> {
    try {
      const url = new URL(urlString);
      const result: Record<string, string> = {};
      
      url.searchParams.forEach((value, key) => {
        if (key.startsWith(prefix)) {
          result[key.substring(prefix.length + 1)] = value;
        }
      });
      
      return result;
    } catch {
      return {};
    }
  },

  /**
   * Build a filter URL from parameters
   */
  buildFilterUrl(baseUrl: string, filters: Record<string, string>, prefix = 'filter'): string {
    try {
      const url = new URL(baseUrl);
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(`${prefix}_${key}`, value);
        }
      });
      
      return url.toString();
    } catch {
      return baseUrl;
    }
  },

  /**
   * Remove all filter parameters from a URL
   */
  cleanFilterUrl(urlString: string, prefix = 'filter'): string {
    try {
      const url = new URL(urlString);
      const keysToRemove: string[] = [];
      
      url.searchParams.forEach((_, key) => {
        if (key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      });
      
      keysToRemove.forEach(key => url.searchParams.delete(key));
      
      return url.toString();
    } catch {
      return urlString;
    }
  },

  /**
   * Check if a URL contains filter parameters
   */
  hasFilterParams(urlString: string, prefix = 'filter'): boolean {
    try {
      const url = new URL(urlString);
      return Array.from(url.searchParams.keys()).some(key => key.startsWith(prefix));
    } catch {
      return false;
    }
  },

  /**
   * Generate a human-readable description of filters from URL
   */
  describeFilters(urlString: string, prefix = 'filter'): string {
    const filters = FilterUrlUtils.parseFiltersFromUrl(urlString, prefix);
    const descriptions: string[] = [];

    if (filters.q) {
      descriptions.push(`search: "${filters.q}"`);
    }
    
    if (filters.types && filters.types !== 'user,assistant,system,error') {
      descriptions.push(`types: ${filters.types}`);
    }
    
    if (filters.from || filters.to) {
      const dateRange = [];
      if (filters.from) dateRange.push(`from ${filters.from}`);
      if (filters.to) dateRange.push(`to ${filters.to}`);
      descriptions.push(`dates: ${dateRange.join(' ')}`);
    }
    
    if (filters.sessions) {
      const sessionCount = filters.sessions.split(',').length;
      descriptions.push(`${sessionCount} session${sessionCount !== 1 ? 's' : ''}`);
    }

    return descriptions.length > 0 
      ? descriptions.join(', ')
      : 'no active filters';
  },
};

// Global event types for TypeScript
declare global {
  interface WindowEventMap {
    filtersUrlChanged: CustomEvent<{
      url: string;
      params: Record<string, string>;
    }>;
  }
}
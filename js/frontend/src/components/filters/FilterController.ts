import { ReactiveController, ReactiveControllerHost } from 'lit';
import { FilterEngine, SearchOptions, FilterResult, SearchMatch } from './FilterEngine';

export interface FilterState {
  // Search and text filtering
  searchQuery: string;
  searchFields: Array<'content' | 'role' | 'toolName' | 'error'>;
  
  // Message type filtering
  messageTypes: Array<'user' | 'assistant' | 'system' | 'error'>;
  
  // Date range filtering
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  
  // Session filtering
  sessionIds: string[];
  
  // Active filter combinations
  activeFilters: FilterCombination[];
}

export interface FilterCombination {
  id: string;
  name: string;
  filters: Partial<FilterState>;
  isActive: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  filters: Partial<FilterState>;
  isDefault: boolean;
}

/**
 * Reactive controller for managing filter state with persistence and analytics
 */
export class FilterController implements ReactiveController {
  private host: ReactiveControllerHost;
  private storageKey = 'claude-code-log-filters';
  private _filterState: FilterState;
  private _presets: FilterPreset[] = [];
  private _analytics: { [key: string]: number } = {};
  private _debounceTimers: { [key: string]: number } = {};
  private _filterEngine: FilterEngine;
  private _lastSearchMatches: Map<string, SearchMatch[]> | undefined;

  constructor(host: ReactiveControllerHost, initialState?: Partial<FilterState>) {
    this.host = host;
    
    // Initialize filter engine
    this._filterEngine = new FilterEngine();
    
    // Initialize default filter state
    this._filterState = {
      searchQuery: '',
      searchFields: ['content', 'role', 'toolName', 'error'],
      messageTypes: ['user', 'assistant', 'system', 'error'],
      dateRange: { start: null, end: null },
      sessionIds: [],
      activeFilters: [],
      ...initialState,
    };

    // Load from localStorage
    this.loadFromStorage();
    
    // Initialize default presets
    this.initializeDefaultPresets();
    
    this.host.addController(this);
  }

  hostConnected() {
    // Controller is now connected to the host
  }

  hostDisconnected() {
    // Clean up debounce timers
    Object.values(this._debounceTimers).forEach(timer => clearTimeout(timer));
    
    // Clear filter engine cache to free memory
    this._filterEngine.clearCache();
    
    this.saveToStorage();
  }

  // Getter for current filter state
  get state(): FilterState {
    return { ...this._filterState };
  }

  get presets(): FilterPreset[] {
    return [...this._presets];
  }

  get analytics(): { [key: string]: number } {
    return { ...this._analytics };
  }

  get hasActiveFilters(): boolean {
    return (
      this._filterState.searchQuery.length > 0 ||
      this._filterState.messageTypes.length < 4 ||
      this._filterState.dateRange.start !== null ||
      this._filterState.dateRange.end !== null ||
      this._filterState.sessionIds.length > 0 ||
      this._filterState.activeFilters.some(f => f.isActive)
    );
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this._filterState.searchQuery) count++;
    if (this._filterState.messageTypes.length < 4) count++;
    if (this._filterState.dateRange.start || this._filterState.dateRange.end) count++;
    if (this._filterState.sessionIds.length > 0) count++;
    count += this._filterState.activeFilters.filter(f => f.isActive).length;
    return count;
  }

  // Search query methods
  setSearchQuery(query: string, debounceMs = 300) {
    if (this._debounceTimers.search) {
      clearTimeout(this._debounceTimers.search);
    }

    this._debounceTimers.search = window.setTimeout(() => {
      this._filterState.searchQuery = query;
      this.trackUsage('search', query.length > 0 ? 1 : 0);
      this.requestUpdate();
      delete this._debounceTimers.search;
    }, debounceMs);
  }

  clearSearch() {
    this._filterState.searchQuery = '';
    this.requestUpdate();
  }

  setSearchFields(fields: Array<'content' | 'role' | 'toolName' | 'error'>) {
    this._filterState.searchFields = [...fields];
    this.requestUpdate();
  }

  // Message type filtering
  toggleMessageType(type: 'user' | 'assistant' | 'system' | 'error') {
    const types = [...this._filterState.messageTypes];
    const index = types.indexOf(type);
    
    if (index === -1) {
      types.push(type);
    } else {
      types.splice(index, 1);
    }
    
    this._filterState.messageTypes = types;
    this.trackUsage(`messageType_${type}`, index === -1 ? 1 : -1);
    this.requestUpdate();
  }

  setMessageTypes(types: Array<'user' | 'assistant' | 'system' | 'error'>) {
    this._filterState.messageTypes = [...types];
    this.requestUpdate();
  }

  // Date range filtering
  setDateRange(start: Date | null, end: Date | null) {
    this._filterState.dateRange = { start, end };
    this.trackUsage('dateRange', (start || end) ? 1 : 0);
    this.requestUpdate();
  }

  setStartDate(date: Date | null) {
    this._filterState.dateRange.start = date;
    this.requestUpdate();
  }

  setEndDate(date: Date | null) {
    this._filterState.dateRange.end = date;
    this.requestUpdate();
  }

  clearDateRange() {
    this._filterState.dateRange = { start: null, end: null };
    this.requestUpdate();
  }

  // Session filtering
  addSessionFilter(sessionId: string) {
    if (!this._filterState.sessionIds.includes(sessionId)) {
      this._filterState.sessionIds.push(sessionId);
      this.requestUpdate();
    }
  }

  removeSessionFilter(sessionId: string) {
    this._filterState.sessionIds = this._filterState.sessionIds.filter(id => id !== sessionId);
    this.requestUpdate();
  }

  setSessionFilters(sessionIds: string[]) {
    this._filterState.sessionIds = [...sessionIds];
    this.requestUpdate();
  }

  // Filter combinations
  addFilterCombination(name: string, filters: Partial<FilterState>): string {
    const id = `combo_${Date.now()}`;
    const combination: FilterCombination = {
      id,
      name,
      filters: { ...filters },
      isActive: false,
    };
    
    this._filterState.activeFilters.push(combination);
    this.requestUpdate();
    return id;
  }

  toggleFilterCombination(id: string) {
    const combination = this._filterState.activeFilters.find(f => f.id === id);
    if (combination) {
      combination.isActive = !combination.isActive;
      
      if (combination.isActive) {
        // Apply the combination filters
        this.applyFilterCombination(combination.filters);
      }
      
      this.trackUsage(`combination_${id}`, combination.isActive ? 1 : 0);
      this.requestUpdate();
    }
  }

  removeFilterCombination(id: string) {
    this._filterState.activeFilters = this._filterState.activeFilters.filter(f => f.id !== id);
    this.requestUpdate();
  }

  private applyFilterCombination(filters: Partial<FilterState>) {
    if (filters.searchQuery !== undefined) {
      this._filterState.searchQuery = filters.searchQuery;
    }
    if (filters.messageTypes !== undefined) {
      this._filterState.messageTypes = [...filters.messageTypes];
    }
    if (filters.dateRange !== undefined) {
      this._filterState.dateRange = { ...filters.dateRange };
    }
    if (filters.sessionIds !== undefined) {
      this._filterState.sessionIds = [...filters.sessionIds];
    }
  }

  // Filter presets
  applyPreset(presetId: string) {
    const preset = this._presets.find(p => p.id === presetId);
    if (preset) {
      this.applyFilterCombination(preset.filters);
      this.trackUsage(`preset_${presetId}`, 1);
      this.requestUpdate();
    }
  }

  addPreset(name: string, description: string, filters?: Partial<FilterState>): string {
    const id = `preset_${Date.now()}`;
    const preset: FilterPreset = {
      id,
      name,
      description,
      filters: filters || { ...this._filterState },
      isDefault: false,
    };
    
    this._presets.push(preset);
    this.saveToStorage();
    return id;
  }

  removePreset(presetId: string) {
    this._presets = this._presets.filter(p => p.id !== presetId && !p.isDefault);
    this.saveToStorage();
  }

  // Clear all filters
  clearAllFilters() {
    this._filterState = {
      searchQuery: '',
      searchFields: ['content', 'role', 'toolName', 'error'],
      messageTypes: ['user', 'assistant', 'system', 'error'],
      dateRange: { start: null, end: null },
      sessionIds: [],
      activeFilters: this._filterState.activeFilters.map(f => ({ ...f, isActive: false })),
    };
    
    this.trackUsage('clearAll', 1);
    this.requestUpdate();
  }

  // Export filter state for URL synchronization
  exportToUrlParams(): URLSearchParams {
    const params = new URLSearchParams();
    
    if (this._filterState.searchQuery) {
      params.set('q', this._filterState.searchQuery);
    }
    
    if (this._filterState.messageTypes.length < 4) {
      params.set('types', this._filterState.messageTypes.join(','));
    }
    
    if (this._filterState.dateRange.start) {
      params.set('from', this._filterState.dateRange.start.toISOString().split('T')[0]);
    }
    
    if (this._filterState.dateRange.end) {
      params.set('to', this._filterState.dateRange.end.toISOString().split('T')[0]);
    }
    
    if (this._filterState.sessionIds.length > 0) {
      params.set('sessions', this._filterState.sessionIds.join(','));
    }
    
    const activeFilters = this._filterState.activeFilters.filter(f => f.isActive);
    if (activeFilters.length > 0) {
      params.set('filters', activeFilters.map(f => f.id).join(','));
    }
    
    return params;
  }

  // Import filter state from URL parameters
  importFromUrlParams(params: URLSearchParams) {
    const query = params.get('q');
    if (query) {
      this._filterState.searchQuery = query;
    }
    
    const types = params.get('types');
    if (types) {
      this._filterState.messageTypes = types.split(',') as Array<'user' | 'assistant' | 'system' | 'error'>;
    }
    
    const from = params.get('from');
    if (from) {
      this._filterState.dateRange.start = new Date(from);
    }
    
    const to = params.get('to');
    if (to) {
      this._filterState.dateRange.end = new Date(to);
    }
    
    const sessions = params.get('sessions');
    if (sessions) {
      this._filterState.sessionIds = sessions.split(',');
    }
    
    const filters = params.get('filters');
    if (filters) {
      const filterIds = filters.split(',');
      this._filterState.activeFilters.forEach(f => {
        f.isActive = filterIds.includes(f.id);
      });
    }
    
    this.requestUpdate();
  }

  // Enhanced filtering logic using FilterEngine
  filterMessages<T extends {
    id?: string;
    role?: string;
    content?: string;
    tool_name?: string;
    error?: string;
    timestamp?: Date;
    sessionId?: string;
  }>(messages: T[], searchOptions?: SearchOptions): FilterResult<T> {
    const result = this._filterEngine.filterMessages(messages, {
      searchQuery: this._filterState.searchQuery || undefined,
      searchFields: this._filterState.searchFields,
      messageTypes: this._filterState.messageTypes,
      dateRange: this._filterState.dateRange,
      sessionIds: this._filterState.sessionIds.length > 0 ? this._filterState.sessionIds : undefined,
    }, searchOptions);
    
    // Store search matches for highlighting
    this._lastSearchMatches = result.searchMatches;
    
    return result;
  }

  // Legacy method for backward compatibility
  filterMessagesSimple<T extends {
    role?: string;
    content?: string;
    tool_name?: string;
    error?: string;
    timestamp?: Date;
    sessionId?: string;
  }>(messages: T[]): T[] {
    const result = this.filterMessages(messages);
    return result.items;
  }

  // Storage methods
  private saveToStorage() {
    try {
      const data = {
        filterState: this._filterState,
        presets: this._presets.filter(p => !p.isDefault),
        analytics: this._analytics,
      };
      sessionStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save filter state to storage:', error);
    }
  }

  private loadFromStorage() {
    try {
      const data = sessionStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        
        if (parsed.filterState) {
          // Restore dates from ISO strings
          if (parsed.filterState.dateRange) {
            if (parsed.filterState.dateRange.start) {
              parsed.filterState.dateRange.start = new Date(parsed.filterState.dateRange.start);
            }
            if (parsed.filterState.dateRange.end) {
              parsed.filterState.dateRange.end = new Date(parsed.filterState.dateRange.end);
            }
          }
          
          this._filterState = { ...this._filterState, ...parsed.filterState };
        }
        
        if (parsed.presets) {
          this._presets = [...this._presets, ...parsed.presets];
        }
        
        if (parsed.analytics) {
          this._analytics = { ...parsed.analytics };
        }
      }
    } catch (error) {
      console.warn('Failed to load filter state from storage:', error);
    }
  }

  private initializeDefaultPresets() {
    const defaultPresets: FilterPreset[] = [
      {
        id: 'recent',
        name: 'Recent Messages',
        description: 'Messages from the last 24 hours',
        filters: {
          dateRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000),
            end: null,
          },
        },
        isDefault: true,
      },
      {
        id: 'user_only',
        name: 'User Messages',
        description: 'Show only user messages',
        filters: {
          messageTypes: ['user'],
        },
        isDefault: true,
      },
      {
        id: 'errors',
        name: 'Errors Only',
        description: 'Show only error messages',
        filters: {
          messageTypes: ['error'],
        },
        isDefault: true,
      },
      {
        id: 'this_week',
        name: 'This Week',
        description: 'Messages from the current week',
        filters: {
          dateRange: {
            start: this.getStartOfWeek(),
            end: null,
          },
        },
        isDefault: true,
      },
    ];

    this._presets = defaultPresets;
  }

  private getStartOfWeek(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    return new Date(now.setDate(diff));
  }

  private trackUsage(filter: string, change: number) {
    this._analytics[filter] = (this._analytics[filter] || 0) + change;
    
    // Periodically save analytics (every 10 operations)
    const totalOps = Object.values(this._analytics).reduce((sum, count) => sum + count, 0);
    if (totalOps % 10 === 0) {
      this.saveToStorage();
    }
  }

  // Advanced search and performance methods
  
  /**
   * Get search matches for highlighting
   */
  getSearchMatches(): Map<string, SearchMatch[]> | undefined {
    return this._lastSearchMatches;
  }

  /**
   * Get performance metrics from the filter engine
   */
  getPerformanceMetrics() {
    return this._filterEngine.getPerformanceStats();
  }

  /**
   * Create a search index for very large datasets
   */
  createSearchIndex<T extends {
    id?: string;
    role?: string;
    content?: string;
    tool_name?: string;
    error?: string;
    timestamp?: Date;
    sessionId?: string;
  }>(messages: T[], fields?: string[]) {
    return this._filterEngine.createSearchIndex(messages, fields);
  }

  /**
   * Clear filter engine cache manually
   */
  clearCache() {
    this._filterEngine.clearCache();
  }

  /**
   * Export analytics data
   */
  exportAnalytics() {
    return {
      filterUsage: { ...this._analytics },
      performance: this.getPerformanceMetrics(),
      presets: this._presets.length,
      activeFilters: this.activeFilterCount,
    };
  }

  private requestUpdate() {
    this.host.requestUpdate();
  }
}
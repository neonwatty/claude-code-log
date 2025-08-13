import { LitElement, PropertyValueMap } from 'lit';
import { state } from 'lit/decorators.js';
import { SessionSummary, SessionDetail } from '../types/session-types';
import { RouteParams } from './session-router';

/**
 * UI state interface
 */
export interface SessionBrowserUIState {
  // Navigation state
  currentSessionId: string | null;
  currentMessageIndex: number | null;
  selectedSessionIds: Set<string>;
  
  // View state
  viewMode: 'list' | 'grid' | 'detailed';
  sortBy: 'startTime' | 'title' | 'messageCount' | 'duration';
  sortOrder: 'asc' | 'desc';
  filterText: string;
  showArchived: boolean;
  showBranches: boolean;
  
  // UI flags
  isLoading: boolean;
  bulkSelectionMode: boolean;
  showSidebar: boolean;
  showShortcuts: boolean;
  compactMode: boolean;
  
  // Error state
  error: string | null;
  
  // Route state
  routeParams: RouteParams;
}

/**
 * State change listener
 */
export type StateChangeListener = (state: SessionBrowserUIState, changedKey?: keyof SessionBrowserUIState) => void;

/**
 * State manager for session browser UI
 * Provides centralized state management with reactive updates
 */
export class SessionStateManager {
  private static instance: SessionStateManager;
  
  private listeners: Set<StateChangeListener> = new Set();
  private state: SessionBrowserUIState;

  private constructor() {
    this.state = this.getInitialState();
  }

  public static getInstance(): SessionStateManager {
    if (!SessionStateManager.instance) {
      SessionStateManager.instance = new SessionStateManager();
    }
    return SessionStateManager.instance;
  }

  private getInitialState(): SessionBrowserUIState {
    // Try to load state from localStorage
    const saved = this.loadStateFromStorage();
    
    return {
      // Navigation state
      currentSessionId: null,
      currentMessageIndex: null,
      selectedSessionIds: new Set(),
      
      // View state  
      viewMode: saved?.viewMode || 'list',
      sortBy: saved?.sortBy || 'startTime',
      sortOrder: saved?.sortOrder || 'desc',
      filterText: '',
      showArchived: saved?.showArchived ?? false,
      showBranches: saved?.showBranches ?? true,
      
      // UI flags
      isLoading: false,
      bulkSelectionMode: false,
      showSidebar: saved?.showSidebar ?? true,
      showShortcuts: saved?.showShortcuts ?? false,
      compactMode: saved?.compactMode ?? false,
      
      // Error state
      error: null,
      
      // Route state
      routeParams: {},
    };
  }

  /**
   * Get current state (immutable copy)
   */
  public getState(): Readonly<SessionBrowserUIState> {
    return { 
      ...this.state, 
      selectedSessionIds: new Set(this.state.selectedSessionIds),
      routeParams: { ...this.state.routeParams }
    };
  }

  /**
   * Update state with partial changes
   */
  public updateState(changes: Partial<SessionBrowserUIState>): void {
    const previousState = { ...this.state };
    
    // Apply changes
    this.state = { ...this.state, ...changes };
    
    // Handle special cases for Set and objects
    if (changes.selectedSessionIds) {
      this.state.selectedSessionIds = new Set(changes.selectedSessionIds);
    }
    if (changes.routeParams) {
      this.state.routeParams = { ...changes.routeParams };
    }
    
    // Save persistent state to storage
    this.saveStateToStorage();
    
    // Notify listeners of changes
    const changedKeys = Object.keys(changes) as (keyof SessionBrowserUIState)[];
    changedKeys.forEach(key => {
      this.notifyListeners(key);
    });
  }

  /**
   * Update a single state property
   */
  public setState<K extends keyof SessionBrowserUIState>(
    key: K, 
    value: SessionBrowserUIState[K]
  ): void {
    this.updateState({ [key]: value } as Partial<SessionBrowserUIState>);
  }

  /**
   * Get a single state property
   */
  public getStateValue<K extends keyof SessionBrowserUIState>(
    key: K
  ): SessionBrowserUIState[K] {
    return this.state[key];
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(changedKey?: keyof SessionBrowserUIState): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState, changedKey);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    });
  }

  /**
   * Reset state to initial values
   */
  public resetState(): void {
    this.state = this.getInitialState();
    this.clearStorage();
    this.notifyListeners();
  }

  // Session selection methods

  /**
   * Select a session
   */
  public selectSession(sessionId: string): void {
    this.setState('currentSessionId', sessionId);
    this.setState('currentMessageIndex', null);
  }

  /**
   * Add session to bulk selection
   */
  public addToSelection(sessionId: string): void {
    const newSelection = new Set(this.state.selectedSessionIds);
    newSelection.add(sessionId);
    this.setState('selectedSessionIds', newSelection);
  }

  /**
   * Remove session from bulk selection
   */
  public removeFromSelection(sessionId: string): void {
    const newSelection = new Set(this.state.selectedSessionIds);
    newSelection.delete(sessionId);
    this.setState('selectedSessionIds', newSelection);
  }

  /**
   * Toggle session in bulk selection
   */
  public toggleSelection(sessionId: string): void {
    if (this.state.selectedSessionIds.has(sessionId)) {
      this.removeFromSelection(sessionId);
    } else {
      this.addToSelection(sessionId);
    }
  }

  /**
   * Clear all selections
   */
  public clearSelection(): void {
    this.setState('selectedSessionIds', new Set());
  }

  /**
   * Select multiple sessions
   */
  public selectMultiple(sessionIds: string[]): void {
    this.setState('selectedSessionIds', new Set(sessionIds));
  }

  /**
   * Check if session is selected
   */
  public isSelected(sessionId: string): boolean {
    return this.state.selectedSessionIds.has(sessionId);
  }

  // View state methods

  /**
   * Toggle view mode
   */
  public toggleViewMode(): void {
    const modes: SessionBrowserUIState['viewMode'][] = ['list', 'grid', 'detailed'];
    const currentIndex = modes.indexOf(this.state.viewMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.setState('viewMode', nextMode);
  }

  /**
   * Toggle sort order
   */
  public toggleSortOrder(): void {
    const newOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
    this.setState('sortOrder', newOrder);
  }

  /**
   * Set filter text with debouncing
   */
  private filterTimeout?: number;
  
  public setFilter(text: string, immediate = false): void {
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }

    if (immediate) {
      this.setState('filterText', text);
    } else {
      this.filterTimeout = window.setTimeout(() => {
        this.setState('filterText', text);
      }, 300);
    }
  }

  /**
   * Clear filter
   */
  public clearFilter(): void {
    this.setFilter('', true);
  }

  // Error handling methods

  /**
   * Set error message
   */
  public setError(error: string | Error | null): void {
    const errorMessage = error instanceof Error ? error.message : error;
    this.setState('error', errorMessage);
    
    if (errorMessage) {
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        if (this.state.error === errorMessage) {
          this.setState('error', null);
        }
      }, 5000);
    }
  }

  /**
   * Clear error
   */
  public clearError(): void {
    this.setState('error', null);
  }

  // Loading state methods

  /**
   * Set loading state
   */
  public setLoading(loading: boolean): void {
    this.setState('isLoading', loading);
  }

  // Route integration methods

  /**
   * Update state from route parameters
   */
  public updateFromRoute(params: RouteParams): void {
    this.updateState({
      routeParams: params,
      currentSessionId: params.sessionId || null,
      currentMessageIndex: params.messageIndex ? parseInt(params.messageIndex) : null,
    });
  }

  // Persistence methods

  private readonly STORAGE_KEY = 'session-browser-state';

  private saveStateToStorage(): void {
    try {
      const persistentState = {
        viewMode: this.state.viewMode,
        sortBy: this.state.sortBy,
        sortOrder: this.state.sortOrder,
        showArchived: this.state.showArchived,
        showBranches: this.state.showBranches,
        showSidebar: this.state.showSidebar,
        showShortcuts: this.state.showShortcuts,
        compactMode: this.state.compactMode,
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(persistentState));
    } catch (error) {
      console.warn('Failed to save state to localStorage:', error);
    }
  }

  private loadStateFromStorage(): Partial<SessionBrowserUIState> | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Failed to load state from localStorage:', error);
      return null;
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear state from localStorage:', error);
    }
  }
}

/**
 * Mixin for Lit components to integrate with state manager
 */
export function withStateManager<T extends Constructor<LitElement>>(superClass: T) {
  class StateManagerMixin extends superClass {
    protected stateManager = SessionStateManager.getInstance();
    
    @state()
    protected uiState: SessionBrowserUIState = this.stateManager.getState();

    private unsubscribe?: () => void;

    connectedCallback() {
      super.connectedCallback();
      
      // Subscribe to state changes
      this.unsubscribe = this.stateManager.subscribe((state) => {
        this.uiState = state;
        this.requestUpdate();
      });
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      
      // Unsubscribe from state changes
      if (this.unsubscribe) {
        this.unsubscribe();
      }
    }

    protected updated(changedProperties: PropertyValueMap<any>) {
      super.updated(changedProperties);
      
      // Optional: React to specific state changes
      if (changedProperties.has('uiState')) {
        this.onStateChanged?.(this.uiState);
      }
    }

    // Optional override point for subclasses
    protected onStateChanged?(state: SessionBrowserUIState): void;
  }

  return StateManagerMixin;
}

// Helper type for constructor
type Constructor<T = {}> = new (...args: any[]) => T;

// Export singleton instance for direct use
export const sessionStateManager = SessionStateManager.getInstance();
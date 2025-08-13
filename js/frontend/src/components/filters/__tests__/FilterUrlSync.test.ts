import { expect } from '@open-wc/testing';
import { FilterUrlSync, FilterUrlUtils } from '../FilterUrlSync';
import { FilterController } from '../FilterController';

// Mock window.location and history
class MockLocation {
  href = 'http://localhost:3000/';
  search = '';

  constructor(href = 'http://localhost:3000/') {
    this.href = href;
    const url = new URL(href);
    this.search = url.search;
  }
}

class MockHistory {
  private states: string[] = [];
  
  pushState(state: any, title: string, url: string) {
    this.states.push(url);
  }
  
  replaceState(state: any, title: string, url: string) {
    if (this.states.length > 0) {
      this.states[this.states.length - 1] = url;
    } else {
      this.states.push(url);
    }
  }
  
  get currentUrl() {
    return this.states[this.states.length - 1] || 'http://localhost:3000/';
  }
}

// Mock host for FilterController
class MockHost {
  private updateRequested = false;
  
  requestUpdate() {
    this.updateRequested = true;
    return Promise.resolve();
  }
  
  addController() {}
  
  get wasUpdateRequested() {
    return this.updateRequested;
  }
  
  resetUpdateFlag() {
    this.updateRequested = false;
  }
}

describe('FilterUrlSync', () => {
  let mockLocation: MockLocation;
  let mockHistory: MockHistory;
  let mockHost: MockHost;
  let filterController: FilterController;
  let urlSync: FilterUrlSync;

  beforeEach(() => {
    // Setup mocks
    mockLocation = new MockLocation();
    mockHistory = new MockHistory();
    mockHost = new MockHost();

    // Mock global objects
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });
    
    Object.defineProperty(window, 'history', {
      value: mockHistory,
      writable: true,
    });

    // Create filter controller with mock host
    filterController = new FilterController(mockHost as any);
    
    // Create URL sync
    urlSync = new FilterUrlSync(filterController, {
      enableHistory: true,
      prefix: 'filter',
      debounceMs: 10, // Shorter for tests
    });
  });

  afterEach(() => {
    urlSync.destroy();
  });

  describe('Sync to URL', () => {
    it('should sync search query to URL', async () => {
      filterController.setSearchQuery('test query', 0);
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockHistory.currentUrl).to.include('filter_q=test%20query');
    });

    it('should sync message types to URL', async () => {
      filterController.setMessageTypes(['user', 'assistant']);
      urlSync.syncToUrl();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockHistory.currentUrl).to.include('filter_types=user%2Cassistant');
    });

    it('should sync date range to URL', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-31');
      
      filterController.setDateRange(startDate, endDate);
      urlSync.syncToUrl();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockHistory.currentUrl).to.include('filter_from=2023-01-01');
      expect(mockHistory.currentUrl).to.include('filter_to=2023-01-31');
    });

    it('should sync session filters to URL', async () => {
      filterController.setSessionFilters(['session_1', 'session_2']);
      urlSync.syncToUrl();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockHistory.currentUrl).to.include('filter_sessions=session_1%2Csession_2');
    });

    it('should not include default values in URL', async () => {
      // Set all message types (default behavior)
      filterController.setMessageTypes(['user', 'assistant', 'system', 'error']);
      urlSync.syncToUrl();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockHistory.currentUrl).to.not.include('filter_types');
    });
  });

  describe('Sync from URL', () => {
    it('should sync search query from URL', () => {
      mockLocation.href = 'http://localhost:3000/?filter_q=test%20query';
      
      urlSync.syncFromUrl();
      
      expect(filterController.state.searchQuery).to.equal('test query');
    });

    it('should sync message types from URL', () => {
      mockLocation.href = 'http://localhost:3000/?filter_types=user%2Cassistant';
      
      urlSync.syncFromUrl();
      
      expect(filterController.state.messageTypes).to.deep.equal(['user', 'assistant']);
    });

    it('should sync date range from URL', () => {
      mockLocation.href = 'http://localhost:3000/?filter_from=2023-01-01&filter_to=2023-01-31';
      
      urlSync.syncFromUrl();
      
      expect(filterController.state.dateRange.start).to.deep.equal(new Date('2023-01-01'));
      expect(filterController.state.dateRange.end).to.deep.equal(new Date('2023-01-31'));
    });

    it('should sync session filters from URL', () => {
      mockLocation.href = 'http://localhost:3000/?filter_sessions=session_1%2Csession_2';
      
      urlSync.syncFromUrl();
      
      expect(filterController.state.sessionIds).to.deep.equal(['session_1', 'session_2']);
    });

    it('should ignore invalid parameters', () => {
      mockLocation.href = 'http://localhost:3000/?filter_types=invalid_type&filter_from=invalid_date';
      
      urlSync.syncFromUrl();
      
      expect(filterController.state.messageTypes).to.not.include('invalid_type');
    });
  });

  describe('Clear from URL', () => {
    it('should remove filter parameters from URL', async () => {
      mockLocation.href = 'http://localhost:3000/?filter_q=test&other_param=keep';
      
      urlSync.clearFromUrl();
      
      expect(mockHistory.currentUrl).to.include('other_param=keep');
      expect(mockHistory.currentUrl).to.not.include('filter_q');
    });
  });

  describe('Shareable URL generation', () => {
    it('should generate shareable URL with current filters', () => {
      filterController.setSearchQuery('test query', 0);
      filterController.setMessageTypes(['user']);
      
      const shareableUrl = urlSync.getShareableUrl();
      
      expect(shareableUrl).to.include('filter_q=test%20query');
      expect(shareableUrl).to.include('filter_types=user');
    });

    it('should generate shareable URL with custom base URL', () => {
      filterController.setSearchQuery('test', 0);
      
      const shareableUrl = urlSync.getShareableUrl('https://example.com/search');
      
      expect(shareableUrl).to.include('https://example.com/search');
      expect(shareableUrl).to.include('filter_q=test');
    });
  });

  describe('Import from URL', () => {
    it('should import filters from URL string', () => {
      const urlString = 'http://localhost:3000/?filter_q=imported&filter_types=user%2Cassistant';
      
      urlSync.importFromUrl(urlString);
      
      expect(filterController.state.searchQuery).to.equal('imported');
      expect(filterController.state.messageTypes).to.deep.equal(['user', 'assistant']);
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url';
      
      expect(() => urlSync.importFromUrl(invalidUrl)).to.not.throw();
    });
  });

  describe('Export as parameters', () => {
    it('should export current filters as parameter object', () => {
      filterController.setSearchQuery('test', 0);
      filterController.setMessageTypes(['user']);
      
      const params = urlSync.exportAsParams();
      
      expect(params).to.have.property('filter_q', 'test');
      expect(params).to.have.property('filter_types', 'user');
    });
  });

  describe('Configuration options', () => {
    it('should use custom prefix', async () => {
      const customSync = new FilterUrlSync(filterController, { prefix: 'search' });
      
      filterController.setSearchQuery('test', 0);
      customSync.syncToUrl();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockHistory.currentUrl).to.include('search_q=test');
      
      customSync.destroy();
    });

    it('should use replace state when history is disabled', async () => {
      const noHistorySync = new FilterUrlSync(filterController, { enableHistory: false });
      
      filterController.setSearchQuery('test', 0);
      noHistorySync.syncToUrl();
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should still update URL but via replaceState
      expect(mockHistory.currentUrl).to.include('filter_q=test');
      
      noHistorySync.destroy();
    });
  });

  describe('Search options sync', () => {
    it('should sync search options when enabled', async () => {
      const searchOptions = {
        caseSensitive: true,
        wholeWord: true,
        regex: true,
        fuzzyThreshold: 0.8,
      };
      
      urlSync.syncToUrl(filterController.state, searchOptions);
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockHistory.currentUrl).to.include('filter_case=1');
      expect(mockHistory.currentUrl).to.include('filter_word=1');
      expect(mockHistory.currentUrl).to.include('filter_regex=1');
      expect(mockHistory.currentUrl).to.include('filter_fuzzy=0.8');
    });

    it('should not sync search options when disabled', async () => {
      const noOptionsSync = new FilterUrlSync(filterController, { includeSearchOptions: false });
      
      const searchOptions = {
        caseSensitive: true,
        wholeWord: true,
        regex: true,
      };
      
      noOptionsSync.syncToUrl(filterController.state, searchOptions);
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(mockHistory.currentUrl).to.not.include('filter_case');
      expect(mockHistory.currentUrl).to.not.include('filter_word');
      expect(mockHistory.currentUrl).to.not.include('filter_regex');
      
      noOptionsSync.destroy();
    });
  });
});

describe('FilterUrlUtils', () => {
  describe('parseFiltersFromUrl', () => {
    it('should parse filter parameters from URL', () => {
      const url = 'http://localhost:3000/?filter_q=test&filter_types=user&other=keep';
      const filters = FilterUrlUtils.parseFiltersFromUrl(url);
      
      expect(filters).to.deep.equal({
        q: 'test',
        types: 'user',
      });
    });

    it('should use custom prefix', () => {
      const url = 'http://localhost:3000/?search_q=test&search_types=user';
      const filters = FilterUrlUtils.parseFiltersFromUrl(url, 'search');
      
      expect(filters).to.deep.equal({
        q: 'test',
        types: 'user',
      });
    });

    it('should handle invalid URLs', () => {
      const filters = FilterUrlUtils.parseFiltersFromUrl('invalid-url');
      expect(filters).to.deep.equal({});
    });
  });

  describe('buildFilterUrl', () => {
    it('should build URL with filter parameters', () => {
      const baseUrl = 'http://localhost:3000/';
      const filters = { q: 'test', types: 'user' };
      
      const url = FilterUrlUtils.buildFilterUrl(baseUrl, filters);
      
      expect(url).to.include('filter_q=test');
      expect(url).to.include('filter_types=user');
    });

    it('should use custom prefix', () => {
      const baseUrl = 'http://localhost:3000/';
      const filters = { q: 'test' };
      
      const url = FilterUrlUtils.buildFilterUrl(baseUrl, filters, 'search');
      
      expect(url).to.include('search_q=test');
    });

    it('should skip empty values', () => {
      const baseUrl = 'http://localhost:3000/';
      const filters = { q: 'test', empty: '' };
      
      const url = FilterUrlUtils.buildFilterUrl(baseUrl, filters);
      
      expect(url).to.include('filter_q=test');
      expect(url).to.not.include('filter_empty');
    });

    it('should handle invalid base URLs', () => {
      const filters = { q: 'test' };
      const url = FilterUrlUtils.buildFilterUrl('invalid-url', filters);
      
      expect(url).to.equal('invalid-url');
    });
  });

  describe('cleanFilterUrl', () => {
    it('should remove filter parameters', () => {
      const url = 'http://localhost:3000/?filter_q=test&filter_types=user&keep=this';
      const cleanedUrl = FilterUrlUtils.cleanFilterUrl(url);
      
      expect(cleanedUrl).to.include('keep=this');
      expect(cleanedUrl).to.not.include('filter_q');
      expect(cleanedUrl).to.not.include('filter_types');
    });

    it('should use custom prefix', () => {
      const url = 'http://localhost:3000/?search_q=test&filter_q=keep';
      const cleanedUrl = FilterUrlUtils.cleanFilterUrl(url, 'search');
      
      expect(cleanedUrl).to.include('filter_q=keep');
      expect(cleanedUrl).to.not.include('search_q');
    });

    it('should handle invalid URLs', () => {
      const cleanedUrl = FilterUrlUtils.cleanFilterUrl('invalid-url');
      expect(cleanedUrl).to.equal('invalid-url');
    });
  });

  describe('hasFilterParams', () => {
    it('should detect filter parameters', () => {
      const url = 'http://localhost:3000/?filter_q=test&other=param';
      expect(FilterUrlUtils.hasFilterParams(url)).to.be.true;
    });

    it('should detect no filter parameters', () => {
      const url = 'http://localhost:3000/?other=param';
      expect(FilterUrlUtils.hasFilterParams(url)).to.be.false;
    });

    it('should use custom prefix', () => {
      const url = 'http://localhost:3000/?search_q=test&filter_other=param';
      expect(FilterUrlUtils.hasFilterParams(url, 'search')).to.be.true;
      expect(FilterUrlUtils.hasFilterParams(url, 'filter')).to.be.true;
    });

    it('should handle invalid URLs', () => {
      expect(FilterUrlUtils.hasFilterParams('invalid-url')).to.be.false;
    });
  });

  describe('describeFilters', () => {
    it('should generate human-readable filter description', () => {
      const url = 'http://localhost:3000/?filter_q=test&filter_types=user%2Cassistant&filter_from=2023-01-01';
      const description = FilterUrlUtils.describeFilters(url);
      
      expect(description).to.include('search: "test"');
      expect(description).to.include('types: user,assistant');
      expect(description).to.include('dates: from 2023-01-01');
    });

    it('should handle date ranges', () => {
      const url = 'http://localhost:3000/?filter_from=2023-01-01&filter_to=2023-01-31';
      const description = FilterUrlUtils.describeFilters(url);
      
      expect(description).to.include('dates: from 2023-01-01 to 2023-01-31');
    });

    it('should handle session filters', () => {
      const url = 'http://localhost:3000/?filter_sessions=session_1%2Csession_2%2Csession_3';
      const description = FilterUrlUtils.describeFilters(url);
      
      expect(description).to.include('3 sessions');
    });

    it('should handle single session', () => {
      const url = 'http://localhost:3000/?filter_sessions=session_1';
      const description = FilterUrlUtils.describeFilters(url);
      
      expect(description).to.include('1 session');
    });

    it('should return no filters message when empty', () => {
      const url = 'http://localhost:3000/';
      const description = FilterUrlUtils.describeFilters(url);
      
      expect(description).to.equal('no active filters');
    });

    it('should not include default message types', () => {
      const url = 'http://localhost:3000/?filter_q=test&filter_types=user%2Cassistant%2Csystem%2Cerror';
      const description = FilterUrlUtils.describeFilters(url);
      
      expect(description).to.not.include('types:');
      expect(description).to.include('search: "test"');
    });
  });
});

// Integration tests
describe('FilterUrlSync Integration', () => {
  let mockLocation: MockLocation;
  let mockHistory: MockHistory;
  let mockHost: MockHost;
  let filterController: FilterController;
  let urlSync: FilterUrlSync;

  beforeEach(() => {
    mockLocation = new MockLocation();
    mockHistory = new MockHistory();
    mockHost = new MockHost();

    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });
    
    Object.defineProperty(window, 'history', {
      value: mockHistory,
      writable: true,
    });

    filterController = new FilterController(mockHost as any);
    urlSync = new FilterUrlSync(filterController);
  });

  afterEach(() => {
    urlSync.destroy();
  });

  it('should maintain sync between controller and URL', async () => {
    // Set filters via controller
    filterController.setSearchQuery('integration test', 0);
    filterController.setMessageTypes(['user']);
    filterController.setDateRange(new Date('2023-01-01'), new Date('2023-01-31'));
    
    // Wait for URL sync
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Check URL was updated
    expect(mockHistory.currentUrl).to.include('filter_q=integration%20test');
    expect(mockHistory.currentUrl).to.include('filter_types=user');
    
    // Now simulate loading from different URL
    mockLocation.href = 'http://localhost:3000/?filter_q=new%20search&filter_types=assistant';
    
    urlSync.syncFromUrl();
    
    // Check controller was updated
    expect(filterController.state.searchQuery).to.equal('new search');
    expect(filterController.state.messageTypes).to.deep.equal(['assistant']);
  });

  it('should handle complex filter combinations', async () => {
    // Apply complex filters
    filterController.setSearchQuery('complex search with spaces', 0);
    filterController.setMessageTypes(['user', 'system']);
    filterController.setDateRange(new Date('2023-01-15'), null);
    filterController.setSessionFilters(['session_1', 'session_2']);
    
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Get shareable URL
    const shareableUrl = urlSync.getShareableUrl();
    
    // Create new sync instance and import
    const newHost = new MockHost();
    const newController = new FilterController(newHost as any);
    const newSync = new FilterUrlSync(newController);
    
    newSync.importFromUrl(shareableUrl);
    
    // Verify all filters were imported correctly
    expect(newController.state.searchQuery).to.equal('complex search with spaces');
    expect(newController.state.messageTypes).to.deep.equal(['user', 'system']);
    expect(newController.state.dateRange.start).to.deep.equal(new Date('2023-01-15'));
    expect(newController.state.dateRange.end).to.be.null;
    expect(newController.state.sessionIds).to.deep.equal(['session_1', 'session_2']);
    
    newSync.destroy();
  });

  it('should handle URL parameter order independence', () => {
    const url1 = 'http://localhost:3000/?filter_q=test&filter_types=user&filter_from=2023-01-01';
    const url2 = 'http://localhost:3000/?filter_types=user&filter_from=2023-01-01&filter_q=test';
    
    const filters1 = FilterUrlUtils.parseFiltersFromUrl(url1);
    const filters2 = FilterUrlUtils.parseFiltersFromUrl(url2);
    
    expect(filters1).to.deep.equal(filters2);
  });
});
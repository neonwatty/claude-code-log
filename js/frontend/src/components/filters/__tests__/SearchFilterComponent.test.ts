import { fixture, html, expect, oneEvent } from '@open-wc/testing';
import { SearchFilterComponent } from '../SearchFilterComponent';
import type { Message } from '../FilterEngine';

describe('SearchFilterComponent', () => {
  let element: SearchFilterComponent;
  let sampleData: Message[];

  beforeEach(async () => {
    // Setup sample data
    sampleData = [
      {
        id: '1',
        role: 'user',
        content: 'Hello, I need help with my JavaScript code.',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        sessionId: 'session_1',
        tokens: 12,
      },
      {
        id: '2',
        role: 'assistant',
        content: 'I can help you with JavaScript. What specific issue are you facing?',
        timestamp: new Date('2023-01-01T10:01:00Z'),
        sessionId: 'session_1',
        tokens: 15,
      },
      {
        id: '3',
        role: 'system',
        content: 'Session started',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        sessionId: 'session_1',
        tokens: 5,
      },
      {
        id: '4',
        role: 'error',
        error: 'Connection timeout occurred',
        timestamp: new Date('2023-01-01T10:02:00Z'),
        sessionId: 'session_2',
        tokens: 8,
      },
      {
        id: '5',
        role: 'user',
        content: 'Can you explain async/await in JavaScript?',
        timestamp: new Date('2023-01-02T14:00:00Z'),
        sessionId: 'session_2',
        tokens: 10,
      },
    ];

    element = await fixture(html`
      <search-filter-component 
        .data=${sampleData}
        .config=${{
          showAdvancedSearch: true,
          showRegexOption: true,
          showFuzzySearch: true,
          enableQueryBuilder: true,
          enableSearchHistory: true,
        }}
      ></search-filter-component>
    `);
  });

  describe('Initialization', () => {
    it('should render with default configuration', async () => {
      expect(element).to.exist;
      expect(element.data).to.deep.equal(sampleData);
    });

    it('should initialize filter controller', async () => {
      expect(element.filterController).to.exist;
    });

    it('should render search input', async () => {
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      expect(searchInput).to.exist;
      expect(searchInput.placeholder).to.include('Search');
    });
  });

  describe('Basic Search Functionality', () => {
    it('should filter data by search query', async () => {
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'JavaScript';
      searchInput.dispatchEvent(new Event('input'));

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const searchEvent = await oneEvent(element, 'search-executed');
      expect(searchEvent.detail.results).to.have.length(2); // Two messages contain 'JavaScript'
    });

    it('should clear search when clear button is clicked', async () => {
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'test query';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 100));

      const clearButton = element.shadowRoot!.querySelector('.search-action-button') as HTMLButtonElement;
      clearButton.click();

      expect(searchInput.value).to.equal('');
    });

    it('should execute search on Enter key', async () => {
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'help';

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      searchInput.dispatchEvent(enterEvent);

      const searchEvent = await oneEvent(element, 'search-executed');
      expect(searchEvent.detail.query).to.equal('help');
    });
  });

  describe('Advanced Search Options', () => {
    it('should toggle case sensitive search', async () => {
      const toggleButton = element.shadowRoot!.querySelector('.toggle-button') as HTMLButtonElement;
      toggleButton.click(); // Enable advanced options

      await element.updateComplete;

      const caseSensitiveChip = element.shadowRoot!.querySelector('[aria-pressed="false"]') as HTMLElement;
      caseSensitiveChip.click();

      expect(element.searchOptions.caseSensitive).to.be.true;
    });

    it('should toggle regex search', async () => {
      element.showAdvancedOptions = true;
      await element.updateComplete;

      const regexChip = Array.from(element.shadowRoot!.querySelectorAll('.search-option-chip'))
        .find(chip => chip.textContent?.includes('Regex')) as HTMLElement;

      if (regexChip) {
        regexChip.click();
        expect(element.searchOptions.regex).to.be.true;
      }
    });

    it('should perform case-sensitive search', async () => {
      element.searchOptions.caseSensitive = true;
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      
      searchInput.value = 'JavaScript';
      searchInput.dispatchEvent(new Event('input'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const searchEvent = await oneEvent(element, 'search-executed');
      expect(searchEvent.detail.results).to.have.length(2);

      // Now try with different case
      searchInput.value = 'javascript';
      searchInput.dispatchEvent(new Event('input'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const searchEvent2 = await oneEvent(element, 'search-executed');
      expect(searchEvent2.detail.results).to.have.length(0);
    });
  });

  describe('Message Type Filtering', () => {
    it('should filter by message type', async () => {
      // Get the filter controller and set message types
      element.filterController.setMessageTypes(['user']);
      
      const searchEvent = await oneEvent(element, 'search-executed');
      const userMessages = searchEvent.detail.results.filter((msg: Message) => msg.role === 'user');
      expect(userMessages).to.have.length(2);
    });

    it('should filter by multiple message types', async () => {
      element.filterController.setMessageTypes(['user', 'assistant']);
      
      const searchEvent = await oneEvent(element, 'search-executed');
      const filteredMessages = searchEvent.detail.results.filter(
        (msg: Message) => msg.role === 'user' || msg.role === 'assistant'
      );
      expect(filteredMessages).to.have.length(3);
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter by start date', async () => {
      const startDate = new Date('2023-01-02T00:00:00Z');
      element.filterController.setStartDate(startDate);
      
      const searchEvent = await oneEvent(element, 'search-executed');
      const filteredMessages = searchEvent.detail.results.filter(
        (msg: Message) => msg.timestamp && msg.timestamp >= startDate
      );
      expect(filteredMessages).to.have.length(1); // Only one message on 2023-01-02
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2023-01-01T00:00:00Z');
      const endDate = new Date('2023-01-01T23:59:59Z');
      
      element.filterController.setDateRange(startDate, endDate);
      
      const searchEvent = await oneEvent(element, 'search-executed');
      const filteredMessages = searchEvent.detail.results.filter(
        (msg: Message) => msg.timestamp && 
          msg.timestamp >= startDate && 
          msg.timestamp <= endDate
      );
      expect(filteredMessages).to.have.length(4); // Four messages on 2023-01-01
    });
  });

  describe('Session Filtering', () => {
    it('should filter by session ID', async () => {
      element.filterController.setSessionFilters(['session_1']);
      
      const searchEvent = await oneEvent(element, 'search-executed');
      const sessionMessages = searchEvent.detail.results.filter(
        (msg: Message) => msg.sessionId === 'session_1'
      );
      expect(sessionMessages).to.have.length(3);
    });

    it('should filter by multiple sessions', async () => {
      element.filterController.setSessionFilters(['session_1', 'session_2']);
      
      const searchEvent = await oneEvent(element, 'search-executed');
      expect(searchEvent.detail.results).to.have.length(5); // All messages
    });
  });

  describe('Query Builder', () => {
    it('should show query builder when enabled', async () => {
      element.showQueryBuilder = true;
      await element.updateComplete;

      const queryBuilder = element.shadowRoot!.querySelector('.query-builder');
      expect(queryBuilder).to.exist;
    });

    it('should add query conditions', async () => {
      element.showQueryBuilder = true;
      await element.updateComplete;

      const addButton = element.shadowRoot!.querySelector('.query-builder button') as HTMLButtonElement;
      addButton.click();

      await element.updateComplete;

      expect(element.queryBuilderConditions).to.have.length(1);
      const conditionRow = element.shadowRoot!.querySelector('.condition-row');
      expect(conditionRow).to.exist;
    });

    it('should remove query conditions', async () => {
      element.showQueryBuilder = true;
      element.queryBuilderConditions = [{
        id: 'test-1',
        field: 'content',
        operator: 'contains',
        value: 'test',
      }];
      
      await element.updateComplete;

      const removeButton = element.shadowRoot!.querySelector('.condition-remove') as HTMLButtonElement;
      removeButton.click();

      expect(element.queryBuilderConditions).to.have.length(0);
    });
  });

  describe('Search History', () => {
    it('should add searches to history', async () => {
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'test search';
      
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      searchInput.dispatchEvent(enterEvent);

      await oneEvent(element, 'search-executed');
      
      expect(element.searchHistory).to.have.length(1);
      expect(element.searchHistory[0].text).to.equal('test search');
    });

    it('should limit search history size', async () => {
      element.config.maxSearchHistory = 2;
      
      // Add multiple searches
      for (let i = 0; i < 5; i++) {
        element.addToSearchHistory({
          text: `search ${i}`,
          fields: ['content'],
          options: {},
          timestamp: new Date(),
        });
      }
      
      expect(element.searchHistory).to.have.length(2);
    });

    it('should apply search from history', async () => {
      const historicalSearch = {
        text: 'historical search',
        fields: ['content'] as Array<'content' | 'role' | 'toolName' | 'error'>,
        options: { caseSensitive: true },
        timestamp: new Date(),
      };
      
      element.addToSearchHistory(historicalSearch);
      element.applyHistoryQuery(historicalSearch);
      
      expect(element.filterController.state.searchQuery).to.equal('historical search');
      expect(element.searchOptions.caseSensitive).to.be.true;
    });
  });

  describe('Tag Filtering', () => {
    beforeEach(() => {
      element.tagFilters = [
        { id: 'javascript', name: 'JavaScript', color: '#f7df1e', isActive: false, count: 2 },
        { id: 'error', name: 'Error', color: '#dc3545', isActive: false, count: 1 },
      ];
    });

    it('should render tag filters', async () => {
      await element.updateComplete;
      
      const tagChips = element.shadowRoot!.querySelectorAll('.tag-filter-chip');
      expect(tagChips).to.have.length(2);
    });

    it('should toggle tag filters', async () => {
      await element.updateComplete;
      
      const tagChip = element.shadowRoot!.querySelector('.tag-filter-chip') as HTMLElement;
      tagChip.click();
      
      expect(element.tagFilters[0].isActive).to.be.true;
    });

    it('should clear all tag filters', async () => {
      element.tagFilters[0].isActive = true;
      element.tagFilters[1].isActive = true;
      
      await element.updateComplete;
      
      const clearButton = element.shadowRoot!.querySelector('.tag-filters-header button') as HTMLButtonElement;
      clearButton.click();
      
      expect(element.tagFilters.every(tag => !tag.isActive)).to.be.true;
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      element.pagination = {
        page: 0,
        pageSize: 2,
        total: 5,
      };
    });

    it('should render pagination controls', async () => {
      await element.updateComplete;
      
      const pagination = element.shadowRoot!.querySelector('.pagination-section');
      expect(pagination).to.exist;
    });

    it('should change pages', async () => {
      await element.updateComplete;
      
      const nextButton = Array.from(element.shadowRoot!.querySelectorAll('.pagination-button'))
        .find(btn => btn.textContent?.includes('▶️')) as HTMLButtonElement;
      
      nextButton.click();
      
      expect(element.pagination.page).to.equal(1);
    });

    it('should disable navigation at boundaries', async () => {
      element.pagination.page = 0;
      await element.updateComplete;
      
      const prevButton = Array.from(element.shadowRoot!.querySelectorAll('.pagination-button'))
        .find(btn => btn.textContent?.includes('◀️')) as HTMLButtonElement;
      
      expect(prevButton.disabled).to.be.true;
    });
  });

  describe('Export and Save Functionality', () => {
    it('should emit export event', async () => {
      const exportButton = Array.from(element.shadowRoot!.querySelectorAll('.toggle-button'))
        .find(btn => btn.textContent?.includes('Export')) as HTMLButtonElement;
      
      exportButton.click();
      
      const exportEvent = await oneEvent(element, 'export-requested');
      expect(exportEvent.detail).to.have.property('data');
      expect(exportEvent.detail).to.have.property('filename');
    });

    it('should save current search as preset', async () => {
      element.filterController.setSearchQuery('test query', 0);
      
      const saveButton = Array.from(element.shadowRoot!.querySelectorAll('.toggle-button'))
        .find(btn => btn.textContent?.includes('Save')) as HTMLButtonElement;
      
      saveButton.click();
      
      const saveEvent = await oneEvent(element, 'search-saved');
      expect(saveEvent.detail).to.have.property('presetId');
      expect(saveEvent.detail).to.have.property('query');
    });
  });

  describe('Performance and Analytics', () => {
    it('should track search performance', async () => {
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'performance test';
      searchInput.dispatchEvent(new Event('input'));

      await new Promise(resolve => setTimeout(resolve, 100));
      
      const searchEvent = await oneEvent(element, 'search-executed');
      expect(searchEvent.detail.performance).to.exist;
      expect(searchEvent.detail.performance.duration).to.be.a('number');
    });

    it('should display performance metrics', async () => {
      element.searchPerformance = { duration: 15.5 };
      await element.updateComplete;
      
      const performanceIndicator = element.shadowRoot!.querySelector('.performance-indicator');
      expect(performanceIndicator?.textContent).to.include('15.5ms');
    });
  });

  describe('Configuration Options', () => {
    it('should hide features when disabled in config', async () => {
      element.config = {
        showAdvancedSearch: false,
        showRegexOption: false,
        showFuzzySearch: false,
        enableQueryBuilder: false,
        showTagFilters: false,
        enableSearchHistory: false,
      };
      
      await element.updateComplete;
      
      const queryBuilder = element.shadowRoot!.querySelector('.query-builder');
      const tagFilters = element.shadowRoot!.querySelector('.tag-filters-section');
      const searchHistory = element.shadowRoot!.querySelector('.search-history');
      
      expect(queryBuilder).to.not.exist;
      expect(tagFilters).to.not.exist;
      expect(searchHistory).to.not.exist;
    });

    it('should respect maxSearchHistory configuration', async () => {
      element.config.maxSearchHistory = 3;
      
      // Add more searches than the limit
      for (let i = 0; i < 10; i++) {
        element.addToSearchHistory({
          text: `search ${i}`,
          fields: ['content'],
          options: {},
          timestamp: new Date(),
        });
      }
      
      expect(element.searchHistory).to.have.length(3);
    });
  });

  describe('Keyboard Navigation and Accessibility', () => {
    it('should support escape key to clear search', async () => {
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'test';
      
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      searchInput.dispatchEvent(escapeEvent);
      
      expect(searchInput.value).to.equal('');
    });

    it('should have proper ARIA attributes', async () => {
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      expect(searchInput.getAttribute('aria-label')).to.exist;
      
      const chips = element.shadowRoot!.querySelectorAll('[aria-pressed]');
      expect(chips.length).to.be.greaterThan(0);
    });

    it('should support keyboard navigation for chips', async () => {
      element.showAdvancedOptions = true;
      await element.updateComplete;
      
      const chips = element.shadowRoot!.querySelectorAll('[tabindex="0"]');
      expect(chips.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty data gracefully', async () => {
      element.setData([]);
      
      const results = element.getCurrentResults();
      expect(results?.items || []).to.have.length(0);
    });

    it('should handle malformed data gracefully', async () => {
      const malformedData = [
        { id: '1' }, // Missing required fields
        { role: 'user' }, // Missing other fields
      ];
      
      element.setData(malformedData as any);
      
      // Should not throw errors
      const searchInput = element.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
      searchInput.value = 'test';
      searchInput.dispatchEvent(new Event('input'));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      // Test passes if no errors are thrown
    });
  });

  describe('Public API Methods', () => {
    it('should allow setting data programmatically', () => {
      const newData = [{ id: 'new', role: 'user', content: 'new message' }] as Message[];
      element.setData(newData);
      
      expect(element.data).to.deep.equal(newData);
    });

    it('should allow setting tag filters programmatically', () => {
      const newTags = [{ id: 'test', name: 'Test', color: '#000', isActive: false }];
      element.setTagFilters(newTags);
      
      expect(element.tagFilters).to.deep.equal(newTags);
    });

    it('should return current search results', async () => {
      element.filterController.setSearchQuery('JavaScript', 0);
      await oneEvent(element, 'search-executed');
      
      const results = element.getCurrentResults();
      expect(results).to.exist;
      expect(results!.items).to.be.an('array');
    });

    it('should return search matches for highlighting', async () => {
      element.filterController.setSearchQuery('JavaScript', 0);
      await oneEvent(element, 'search-executed');
      
      const matches = element.getSearchMatches();
      expect(matches).to.exist;
    });

    it('should apply filter presets', async () => {
      const presetId = element.filterController.addPreset('Test Preset', 'Test description');
      element.applyPreset(presetId);
      
      // Should not throw errors
      expect(true).to.be.true;
    });
  });
});

// Integration tests with FilterController
describe('SearchFilterComponent Integration', () => {
  let element: SearchFilterComponent;
  let sampleData: Message[];

  beforeEach(async () => {
    sampleData = [
      {
        id: '1',
        role: 'user',
        content: 'How do I use async/await in JavaScript?',
        timestamp: new Date('2023-01-01T10:00:00Z'),
        sessionId: 'session_1',
      },
      {
        id: '2',
        role: 'assistant',
        content: 'Async/await is a way to handle asynchronous operations in JavaScript...',
        timestamp: new Date('2023-01-01T10:01:00Z'),
        sessionId: 'session_1',
      },
      {
        id: '3',
        role: 'error',
        error: 'Syntax error in async function',
        timestamp: new Date('2023-01-01T10:02:00Z'),
        sessionId: 'session_1',
      },
    ];

    element = await fixture(html`
      <search-filter-component .data=${sampleData}></search-filter-component>
    `);
  });

  it('should integrate search with message type filtering', async () => {
    // Set search query and message type filter
    element.filterController.setSearchQuery('JavaScript', 0);
    element.filterController.setMessageTypes(['user', 'assistant']);
    
    const searchEvent = await oneEvent(element, 'search-executed');
    const results = searchEvent.detail.results;
    
    // Should find messages that match both search and type criteria
    expect(results).to.have.length(2); // user and assistant messages containing 'JavaScript'
    expect(results.every((msg: Message) => msg.role === 'user' || msg.role === 'assistant')).to.be.true;
  });

  it('should integrate multiple filter types', async () => {
    // Complex filter: search + message type + date range
    element.filterController.setSearchQuery('async', 0);
    element.filterController.setMessageTypes(['user', 'assistant']);
    element.filterController.setDateRange(
      new Date('2023-01-01T00:00:00Z'),
      new Date('2023-01-01T23:59:59Z')
    );
    
    const searchEvent = await oneEvent(element, 'search-executed');
    const results = searchEvent.detail.results;
    
    expect(results.length).to.be.greaterThan(0);
    expect(results.every((msg: Message) => 
      msg.role === 'user' || msg.role === 'assistant'
    )).to.be.true;
  });

  it('should clear all filters together', async () => {
    // Apply multiple filters
    element.filterController.setSearchQuery('test', 0);
    element.filterController.setMessageTypes(['user']);
    element.filterController.setStartDate(new Date('2023-01-01'));
    
    // Clear all
    element.clearAllFilters();
    
    const state = element.filterController.state;
    expect(state.searchQuery).to.equal('');
    expect(state.messageTypes).to.deep.equal(['user', 'assistant', 'system', 'error']);
    expect(state.dateRange.start).to.be.null;
    expect(state.dateRange.end).to.be.null;
  });
});
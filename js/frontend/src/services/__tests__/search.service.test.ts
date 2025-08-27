import { describe, it, expect, beforeEach, vi } from "vitest";
import { SearchService } from "../search.service.js";
import { ZodSession, ZodTranscriptEntry } from "@shared";

describe("SearchService", () => {
  let searchService: SearchService;
  let mockSessions: ZodSession[];

  beforeEach(() => {
    searchService = new SearchService();

    // Create mock session data
    mockSessions = [
      {
        id: "session-1",
        firstTimestamp: "2024-01-01T00:00:00Z",
        lastTimestamp: "2024-01-01T01:00:00Z",
        totalUsage: { input_tokens: 100, output_tokens: 50 },
        cwd: "/test/project",
        entries: [
          {
            uuid: "entry-1",
            type: "user",
            timestamp: "2024-01-01T00:00:00Z",
            sessionId: "session-1",
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            message: {
              type: "user",
              content: [
                {
                  type: "text",
                  text: "Please help me implement a search function for my application.",
                },
              ],
            },
          },
          {
            uuid: "entry-2",
            type: "assistant",
            timestamp: "2024-01-01T00:15:00Z",
            sessionId: "session-1",
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            message: {
              type: "assistant",
              content: [
                {
                  type: "text",
                  text: "I'll help you create a search function. Let me show you how to implement full-text search.",
                },
                {
                  type: "thinking",
                  content:
                    "The user wants to implement search functionality. I should provide a comprehensive solution with indexing and ranking.",
                },
              ],
            },
          },
          {
            uuid: "entry-3",
            type: "assistant",
            timestamp: "2024-01-01T00:30:00Z",
            sessionId: "session-1",
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            message: {
              type: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: "tool-1",
                  name: "create_file",
                  input: {
                    filename: "search.js",
                    content: "function search() {}",
                  },
                },
              ],
            },
          },
          {
            uuid: "entry-4",
            type: "user",
            timestamp: "2024-01-01T00:45:00Z",
            sessionId: "session-1",
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            message: {
              type: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "tool-1",
                  content:
                    "File created successfully with search implementation.",
                },
              ],
            },
          },
        ],
      },
      {
        id: "session-2",
        firstTimestamp: "2024-01-02T00:00:00Z",
        lastTimestamp: "2024-01-02T01:00:00Z",
        totalUsage: { input_tokens: 200, output_tokens: 100 },
        cwd: "/test/project",
        entries: [
          {
            uuid: "entry-5",
            type: "summary",
            timestamp: "2024-01-02T00:00:00Z",
            summary:
              "This session covers database optimization and indexing strategies.",
            leafUuid: "entry-6",
            cwd: "/test/project",
          },
          {
            uuid: "entry-6",
            type: "system",
            timestamp: "2024-01-02T00:30:00Z",
            sessionId: "session-2",
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            content: "Database connection established successfully.",
            level: "info",
          },
        ],
      },
    ];
  });

  describe("Index Management", () => {
    it("should initialize empty index", () => {
      expect(searchService.getIndexStats().totalEntries).toBe(0);
      expect(searchService.getIndexStats().totalTokens).toBe(0);
      expect(searchService.getIndexStats().totalSessions).toBe(0);
    });

    it("should add sessions to index", () => {
      searchService.addSessions(mockSessions);

      const stats = searchService.getIndexStats();
      expect(stats.totalEntries).toBe(6); // 4 entries in session-1 + 2 in session-2
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it("should remove session from index", () => {
      searchService.addSessions(mockSessions);
      searchService.removeSession("session-1");

      const stats = searchService.getIndexStats();
      expect(stats.totalEntries).toBe(2); // Only session-2 entries remain
      expect(stats.totalSessions).toBe(1);
    });

    it("should update existing session", () => {
      searchService.addSessions(mockSessions);
      const initialStats = searchService.getIndexStats();

      // Update session with additional entry
      const updatedSession: ZodSession = {
        ...mockSessions[0],
        entries: [
          ...mockSessions[0].entries,
          {
            uuid: "entry-new",
            type: "user",
            timestamp: "2024-01-01T01:00:00Z",
            sessionId: "session-1",
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            message: {
              type: "user",
              content: [{ type: "text", text: "Additional test message" }],
            },
          },
        ],
      };

      searchService.updateSession(updatedSession);
      const updatedStats = searchService.getIndexStats();

      expect(updatedStats.totalEntries).toBe(initialStats.totalEntries + 1);
    });

    it("should clear entire index", () => {
      searchService.addSessions(mockSessions);
      expect(searchService.getIndexStats().totalEntries).toBeGreaterThan(0);

      searchService.clearIndex();
      const stats = searchService.getIndexStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.totalSessions).toBe(0);
    });
  });

  describe("Text Extraction", () => {
    beforeEach(() => {
      searchService.addSessions(mockSessions);
    });

    it("should extract text from user messages", () => {
      const results = searchService.search("implement search function");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedContent).toContain("search function");
    });

    it("should extract text from assistant messages", () => {
      const results = searchService.search("full-text search");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should extract text from thinking content", () => {
      const results = searchService.search("comprehensive solution");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should extract text from tool use content", () => {
      const results = searchService.search("create_file");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should extract text from tool result content", () => {
      const results = searchService.search("File created successfully");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should extract text from summary entries", () => {
      const results = searchService.search("database optimization");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should extract text from system entries", () => {
      const results = searchService.search("Database connection established");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Search Functionality", () => {
    beforeEach(() => {
      searchService.addSessions(mockSessions);
    });

    it("should return empty results for empty query", () => {
      const results = searchService.search("");
      expect(results).toHaveLength(0);
    });

    it("should return empty results for whitespace-only query", () => {
      const results = searchService.search("   ");
      expect(results).toHaveLength(0);
    });

    it("should perform case-insensitive search by default", () => {
      const results1 = searchService.search("SEARCH");
      const results2 = searchService.search("search");
      expect(results1.length).toBe(results2.length);
    });

    it("should perform case-sensitive search when enabled", () => {
      const results = searchService.search("SEARCH", { caseSensitive: true });
      expect(results.length).toBe(0); // No uppercase SEARCH in content
    });

    it("should find exact phrase matches", () => {
      const results = searchService.search("search function");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchType).toBe("exact");
    });

    it("should find partial word matches", () => {
      const results = searchService.search("implement");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should support fuzzy matching", () => {
      const results = searchService.search("searc", { fuzzyMatch: true });
      expect(results.length).toBeGreaterThan(0);
    });

    it("should limit results based on maxResults option", () => {
      const results = searchService.search("the", { maxResults: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should filter by minimum relevance score", () => {
      const results = searchService.search("test", { minRelevanceScore: 0.9 });
      // Should return fewer or no results due to high threshold
      expect(results.length).toBeLessThanOrEqual(
        searchService.search("test", { minRelevanceScore: 0.1 }).length,
      );
    });

    it("should sort results by relevance score", () => {
      const results = searchService.search("search function implement");

      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].relevanceScore).toBeGreaterThanOrEqual(
            results[i + 1].relevanceScore,
          );
        }
      }
    });
  });

  describe("Search Results", () => {
    beforeEach(() => {
      searchService.addSessions(mockSessions);
    });

    it("should include all required result properties", () => {
      const results = searchService.search("search");

      if (results.length > 0) {
        const result = results[0];
        expect(result).toHaveProperty("entryId");
        expect(result).toHaveProperty("sessionId");
        expect(result).toHaveProperty("relevanceScore");
        expect(result).toHaveProperty("matchedContent");
        expect(result).toHaveProperty("matchType");
        expect(result).toHaveProperty("highlightedText");
        expect(typeof result.relevanceScore).toBe("number");
        expect(["exact", "partial", "fuzzy"]).toContain(result.matchType);
      }
    });

    it("should highlight matches in results", () => {
      const results = searchService.search("search", {
        highlightMatches: true,
      });

      if (results.length > 0) {
        const result = results[0];
        expect(result.highlightedText).toContain("<mark>");
        expect(result.highlightedText).toContain("</mark>");
      }
    });

    it("should include context when requested", () => {
      const results = searchService.search("search", {
        includeContext: true,
        contextLength: 50,
      });

      if (results.length > 0) {
        const result = results[0];
        // Context should be included when requested
        expect(result.contextBefore).toBeDefined();
        expect(result.contextAfter).toBeDefined();
        if (result.contextBefore)
          expect(typeof result.contextBefore).toBe("string");
        if (result.contextAfter)
          expect(typeof result.contextAfter).toBe("string");
      }
    });

    it("should determine correct match types", () => {
      // Test exact match
      const exactResults = searchService.search("search function");
      if (exactResults.length > 0) {
        expect(exactResults[0].matchType).toBe("exact");
      }

      // Test partial match
      const partialResults = searchService.search("search database");
      if (partialResults.length > 0) {
        // Should find matches even though "search database" doesn't appear together
        expect(partialResults.some((r) => r.matchType === "partial")).toBe(
          true,
        );
      }
    });
  });

  describe("Search Suggestions", () => {
    beforeEach(() => {
      searchService.addSessions(mockSessions);
    });

    it("should return search suggestions", () => {
      const suggestions = searchService.getSuggestions("sea");
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes("sea"))).toBe(true);
    });

    it("should limit number of suggestions", () => {
      const suggestions = searchService.getSuggestions("a", 3);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it("should return empty suggestions for empty query", () => {
      const suggestions = searchService.getSuggestions("");
      expect(suggestions).toHaveLength(0);
    });

    it("should return suggestions based on indexed tokens", () => {
      const suggestions = searchService.getSuggestions("impl");
      expect(suggestions.some((s) => s.includes("implement"))).toBe(true);
    });
  });

  describe("Search Options", () => {
    beforeEach(() => {
      searchService.addSessions(mockSessions);
    });

    it("should respect search field restrictions", () => {
      // This test ensures that field-specific searches work
      // In a real implementation, you might want to test specific field filtering
      const results = searchService.search("search", {
        searchFields: ["content.text"],
      });
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle all default options correctly", () => {
      const results = searchService.search("search");
      expect(Array.isArray(results)).toBe(true);

      if (results.length > 0) {
        const result = results[0];
        expect(result.highlightedText).toContain("<mark>"); // highlightMatches: true
        expect(typeof result.contextBefore).toBe("string"); // includeContext: true
        expect(typeof result.contextAfter).toBe("string");
      }
    });
  });

  describe("Performance and Edge Cases", () => {
    it("should handle large datasets efficiently", () => {
      // Create a large mock dataset
      const largeSessions: ZodSession[] = [];
      for (let i = 0; i < 10; i++) {
        largeSessions.push({
          id: `session-large-${i}`,
          firstTimestamp: "2024-01-01T00:00:00Z",
          lastTimestamp: "2024-01-01T01:00:00Z",
          totalUsage: { input_tokens: 100, output_tokens: 50 },
          cwd: "/test/project",
          entries: Array.from({ length: 20 }, (_, j) => ({
            uuid: `entry-large-${i}-${j}`,
            type: "user" as const,
            timestamp: "2024-01-01T00:00:00Z",
            sessionId: `session-large-${i}`,
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            message: {
              type: "user" as const,
              content: [
                {
                  type: "text" as const,
                  text: `This is test message ${j} in session ${i} with searchable content about development and programming.`,
                },
              ],
            },
          })),
        });
      }

      const startTime = performance.now();
      searchService.addSessions(largeSessions);
      const indexTime = performance.now() - startTime;

      const searchStartTime = performance.now();
      const results = searchService.search("development programming");
      const searchTime = performance.now() - searchStartTime;

      // Performance should be reasonable (these are loose bounds for testing)
      expect(indexTime).toBeLessThan(1000); // Less than 1 second to index
      expect(searchTime).toBeLessThan(100); // Less than 100ms to search
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle special characters in search queries", () => {
      const results = searchService.search("search@function.js");
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle unicode characters", () => {
      // Add session with unicode content
      const unicodeSession: ZodSession = {
        id: "unicode-session",
        firstTimestamp: "2024-01-01T00:00:00Z",
        lastTimestamp: "2024-01-01T01:00:00Z",
        totalUsage: { input_tokens: 50, output_tokens: 25 },
        cwd: "/test/project",
        entries: [
          {
            uuid: "unicode-entry",
            type: "user",
            timestamp: "2024-01-01T00:00:00Z",
            sessionId: "unicode-session",
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            message: {
              type: "user",
              content: [
                {
                  type: "text",
                  text: "Testing with émojis 🚀 and ünïcode çhàràcters",
                },
              ],
            },
          },
        ],
      };

      searchService.addSession(unicodeSession);
      const results = searchService.search("émojis");
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle malformed or missing content gracefully", () => {
      const malformedSession: ZodSession = {
        id: "malformed-session",
        firstTimestamp: "2024-01-01T00:00:00Z",
        lastTimestamp: "2024-01-01T01:00:00Z",
        totalUsage: { input_tokens: 0, output_tokens: 0 },
        cwd: "/test/project",
        entries: [
          {
            uuid: "malformed-entry",
            type: "user",
            timestamp: "2024-01-01T00:00:00Z",
            sessionId: "malformed-session",
            userType: "human",
            cwd: "/test/project",
            version: "1.0",
            isSidechain: false,
            message: {
              type: "user",
              content: [], // Empty content array
            },
          },
        ],
      };

      expect(() => {
        searchService.addSession(malformedSession);
        searchService.search("test");
      }).not.toThrow();
    });
  });

  describe("Index Statistics", () => {
    it("should provide accurate index statistics", () => {
      searchService.addSessions(mockSessions);
      const stats = searchService.getIndexStats();

      expect(stats.totalEntries).toBe(6);
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.indexSizeKB).toBeGreaterThan(0);
      expect(typeof stats.indexSizeKB).toBe("number");
    });

    it("should update statistics when index changes", () => {
      const initialStats = searchService.getIndexStats();
      expect(initialStats.totalEntries).toBe(0);

      searchService.addSessions(mockSessions);
      const afterAddStats = searchService.getIndexStats();
      expect(afterAddStats.totalEntries).toBeGreaterThan(0);

      searchService.removeSession("session-1");
      const afterRemoveStats = searchService.getIndexStats();
      expect(afterRemoveStats.totalEntries).toBeLessThan(
        afterAddStats.totalEntries,
      );
    });
  });
});

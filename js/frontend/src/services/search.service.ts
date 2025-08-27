import { ZodTranscriptEntry, ZodSession, ZodContentItem } from "@shared";

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  entryId: string;
  sessionId: string;
  relevanceScore: number;
  matchedContent: string;
  matchType: "exact" | "partial" | "fuzzy";
  highlightedText: string;
  contextBefore?: string;
  contextAfter?: string;
}

/**
 * Search options for configuring search behavior
 */
export interface SearchOptions {
  caseSensitive?: boolean;
  fuzzyMatch?: boolean;
  maxResults?: number;
  minRelevanceScore?: number;
  searchFields?: SearchField[];
  highlightMatches?: boolean;
  includeContext?: boolean;
  contextLength?: number;
}

/**
 * Searchable fields in transcript entries
 */
export type SearchField =
  | "content.text"
  | "content.thinking"
  | "content.toolUse.name"
  | "content.toolUse.parameters"
  | "content.toolResult.output"
  | "content.toolResult.error"
  | "message.text"
  | "summary"
  | "all";

/**
 * Internal search index entry
 */
interface SearchIndexEntry {
  entryId: string;
  sessionId: string;
  searchableText: string;
  fields: Record<string, string>;
  tokens: string[];
  metadata: {
    type: string;
    timestamp: string;
    messageType?: string;
  };
}

/**
 * Full-text search service with indexing and ranking
 */
export class SearchService {
  private index: Map<string, SearchIndexEntry> = new Map();
  private tokenIndex: Map<string, Set<string>> = new Map(); // token -> entry IDs
  private sessions: Map<string, ZodSession> = new Map();

  // Default search options
  private readonly defaultOptions: Required<SearchOptions> = {
    caseSensitive: false,
    fuzzyMatch: true,
    maxResults: 50,
    minRelevanceScore: 0.1,
    searchFields: ["all"],
    highlightMatches: true,
    includeContext: true,
    contextLength: 100,
  };

  /**
   * Add sessions to the search index
   */
  addSessions(sessions: ZodSession[]): void {
    for (const session of sessions) {
      this.addSession(session);
    }
  }

  /**
   * Add a single session to the search index
   */
  addSession(session: ZodSession): void {
    this.sessions.set(session.id, session);

    for (const entry of session.entries) {
      this.indexEntry(entry, session.id);
    }
  }

  /**
   * Remove a session from the search index
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);

    // Remove all entries for this session
    const entryIdsToRemove: string[] = [];
    for (const [entryId, indexEntry] of this.index.entries()) {
      if (indexEntry.sessionId === sessionId) {
        entryIdsToRemove.push(entryId);
      }
    }

    for (const entryId of entryIdsToRemove) {
      this.removeFromIndex(entryId);
    }
  }

  /**
   * Update an existing session in the index
   */
  updateSession(session: ZodSession): void {
    this.removeSession(session.id);
    this.addSession(session);
  }

  /**
   * Perform full-text search across indexed content
   */
  search(query: string, options: Partial<SearchOptions> = {}): SearchResult[] {
    const searchOptions = { ...this.defaultOptions, ...options };

    if (!query.trim()) {
      return [];
    }

    const queryTokens = this.tokenize(query, searchOptions.caseSensitive);
    const candidateEntries = this.findCandidateEntries(queryTokens);
    const scoredResults: SearchResult[] = [];

    for (const entryId of candidateEntries) {
      const indexEntry = this.index.get(entryId);
      if (!indexEntry) continue;

      const relevanceScore = this.calculateRelevanceScore(
        indexEntry,
        queryTokens,
        searchOptions,
      );

      if (relevanceScore >= searchOptions.minRelevanceScore) {
        const result = this.createSearchResult(
          indexEntry,
          query,
          queryTokens,
          relevanceScore,
          searchOptions,
        );
        scoredResults.push(result);
      }
    }

    // Sort by relevance score (descending) and limit results
    return scoredResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, searchOptions.maxResults);
  }

  /**
   * Get search suggestions based on indexed content
   */
  getSuggestions(query: string, maxSuggestions = 10): string[] {
    if (!query.trim()) {
      return [];
    }

    const queryLower = query.toLowerCase();
    const suggestions: Set<string> = new Set();

    for (const token of this.tokenIndex.keys()) {
      if (token.includes(queryLower) && suggestions.size < maxSuggestions) {
        suggestions.add(token);
      }
    }

    return Array.from(suggestions).slice(0, maxSuggestions);
  }

  /**
   * Clear the entire search index
   */
  clearIndex(): void {
    this.index.clear();
    this.tokenIndex.clear();
    this.sessions.clear();
  }

  /**
   * Get index statistics
   */
  getIndexStats(): {
    totalEntries: number;
    totalTokens: number;
    totalSessions: number;
    indexSizeKB: number;
  } {
    const indexSizeKB = Math.round(
      (JSON.stringify(Array.from(this.index.values())).length +
        JSON.stringify(Array.from(this.tokenIndex.entries())).length) /
        1024,
    );

    return {
      totalEntries: this.index.size,
      totalTokens: this.tokenIndex.size,
      totalSessions: this.sessions.size,
      indexSizeKB,
    };
  }

  /**
   * Index a transcript entry
   */
  private indexEntry(entry: ZodTranscriptEntry, sessionId: string): void {
    const searchableText = this.extractSearchableText(entry);
    const fields = this.extractSearchableFields(entry);
    const tokens = this.tokenize(searchableText);

    const indexEntry: SearchIndexEntry = {
      entryId: entry.uuid,
      sessionId,
      searchableText,
      fields,
      tokens,
      metadata: {
        type: entry.type,
        timestamp: entry.timestamp,
        messageType:
          "message" in entry
            ? "type" in entry.message
              ? entry.message.type
              : undefined
            : undefined,
      },
    };

    // Add to main index
    this.index.set(entry.uuid, indexEntry);

    // Add tokens to token index
    for (const token of tokens) {
      if (!this.tokenIndex.has(token)) {
        this.tokenIndex.set(token, new Set());
      }
      this.tokenIndex.get(token)!.add(entry.uuid);
    }
  }

  /**
   * Remove an entry from all indexes
   */
  private removeFromIndex(entryId: string): void {
    const indexEntry = this.index.get(entryId);
    if (!indexEntry) return;

    // Remove from token index
    for (const token of indexEntry.tokens) {
      const entryIds = this.tokenIndex.get(token);
      if (entryIds) {
        entryIds.delete(entryId);
        if (entryIds.size === 0) {
          this.tokenIndex.delete(token);
        }
      }
    }

    // Remove from main index
    this.index.delete(entryId);
  }

  /**
   * Extract searchable text from a transcript entry
   */
  private extractSearchableText(entry: ZodTranscriptEntry): string {
    const textParts: string[] = [];

    if (entry.type === "user" || entry.type === "assistant") {
      const message = entry.message;

      if ("content" in message && Array.isArray(message.content)) {
        for (const contentItem of message.content) {
          textParts.push(this.extractTextFromContent(contentItem));
        }
      } else if ("text" in message && typeof message.text === "string") {
        textParts.push(message.text);
      }
    } else if (entry.type === "summary") {
      textParts.push(entry.summary);
    } else if (entry.type === "system") {
      textParts.push(entry.content);
    }

    return textParts.filter(Boolean).join(" ");
  }

  /**
   * Extract searchable text from content items
   */
  private extractTextFromContent(content: ZodContentItem): string {
    const textParts: string[] = [];

    if (content.type === "text") {
      textParts.push(content.text);
    } else if (content.type === "thinking") {
      textParts.push(content.content);
    } else if (content.type === "tool_use") {
      textParts.push(content.name);
      if (content.input && typeof content.input === "object") {
        textParts.push(JSON.stringify(content.input));
      }
    } else if (content.type === "tool_result") {
      if (typeof content.content === "string") {
        textParts.push(content.content);
      } else if (Array.isArray(content.content)) {
        for (const item of content.content) {
          if (item.type === "text") {
            textParts.push(item.text);
          }
        }
      }
    }

    return textParts.join(" ");
  }

  /**
   * Extract specific searchable fields from entry
   */
  private extractSearchableFields(
    entry: ZodTranscriptEntry,
  ): Record<string, string> {
    const fields: Record<string, string> = {};

    if (entry.type === "user" || entry.type === "assistant") {
      const message = entry.message;

      if ("content" in message && Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === "text") {
            fields["content.text"] =
              (fields["content.text"] || "") + " " + content.text;
          } else if (content.type === "thinking") {
            fields["content.thinking"] =
              (fields["content.thinking"] || "") + " " + content.content;
          } else if (content.type === "tool_use") {
            fields["content.toolUse.name"] = content.name;
            if (content.input) {
              fields["content.toolUse.parameters"] = JSON.stringify(
                content.input,
              );
            }
          } else if (content.type === "tool_result") {
            if (typeof content.content === "string") {
              fields["content.toolResult.output"] = content.content;
            }
          }
        }
      } else if ("text" in message) {
        fields["message.text"] = message.text;
      }
    } else if (entry.type === "summary") {
      fields["summary"] = entry.summary;
    }

    return fields;
  }

  /**
   * Tokenize text into searchable tokens
   */
  private tokenize(text: string, caseSensitive = false): string[] {
    const processedText = caseSensitive ? text : text.toLowerCase();

    // Remove punctuation and split by whitespace
    return processedText
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1) // Exclude single characters
      .filter((token) => !this.isStopWord(token));
  }

  /**
   * Check if a word is a stop word (common words to exclude from indexing)
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Find candidate entries that might contain search terms
   */
  private findCandidateEntries(queryTokens: string[]): Set<string> {
    const candidates: Set<string> = new Set();

    for (const token of queryTokens) {
      const matchingEntries = this.tokenIndex.get(token);
      if (matchingEntries) {
        for (const entryId of matchingEntries) {
          candidates.add(entryId);
        }
      }

      // Also check for partial matches
      for (const indexToken of this.tokenIndex.keys()) {
        if (indexToken.includes(token)) {
          const matchingEntries = this.tokenIndex.get(indexToken);
          if (matchingEntries) {
            for (const entryId of matchingEntries) {
              candidates.add(entryId);
            }
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Calculate relevance score using TF-IDF-like algorithm
   */
  private calculateRelevanceScore(
    indexEntry: SearchIndexEntry,
    queryTokens: string[],
    options: Required<SearchOptions>,
  ): number {
    let score = 0;
    const totalDocuments = this.index.size;

    for (const queryToken of queryTokens) {
      // Term frequency in document
      const tf =
        indexEntry.tokens.filter((token) =>
          options.caseSensitive
            ? token === queryToken
            : token.toLowerCase() === queryToken.toLowerCase(),
        ).length / indexEntry.tokens.length;

      // Document frequency (how many documents contain this term)
      const df = this.tokenIndex.get(queryToken)?.size || 0;

      // Inverse document frequency
      const idf = df > 0 ? Math.log(totalDocuments / df) : 0;

      // TF-IDF score for this term
      score += tf * idf;

      // Boost score for exact matches
      if (indexEntry.searchableText.includes(queryToken)) {
        score += 0.5;
      }

      // Boost score for matches in specific fields
      if (indexEntry.fields["content.text"]?.includes(queryToken)) {
        score += 0.3;
      }
    }

    // Normalize by query length
    return score / queryTokens.length;
  }

  /**
   * Create a search result with highlighting and context
   */
  private createSearchResult(
    indexEntry: SearchIndexEntry,
    originalQuery: string,
    queryTokens: string[],
    relevanceScore: number,
    options: Required<SearchOptions>,
  ): SearchResult {
    const matchedContent = this.findBestMatch(indexEntry, queryTokens);
    const matchType = this.determineMatchType(matchedContent, originalQuery);

    let highlightedText = matchedContent;
    let contextBefore = "";
    let contextAfter = "";

    if (options.highlightMatches) {
      highlightedText = this.highlightMatches(matchedContent, queryTokens);
    }

    if (options.includeContext) {
      const context = this.extractContext(
        indexEntry.searchableText,
        matchedContent,
        options.contextLength,
      );
      contextBefore = context.before || "";
      contextAfter = context.after || "";
    }

    return {
      entryId: indexEntry.entryId,
      sessionId: indexEntry.sessionId,
      relevanceScore,
      matchedContent,
      matchType,
      highlightedText,
      contextBefore: options.includeContext ? contextBefore : undefined,
      contextAfter: options.includeContext ? contextAfter : undefined,
    };
  }

  /**
   * Find the best matching portion of text
   */
  private findBestMatch(
    indexEntry: SearchIndexEntry,
    queryTokens: string[],
  ): string {
    const sentences = indexEntry.searchableText
      .split(/[.!?]+/)
      .filter((s) => s.trim());

    let bestMatch = "";
    let maxMatches = 0;

    for (const sentence of sentences) {
      let matches = 0;
      for (const token of queryTokens) {
        if (sentence.toLowerCase().includes(token.toLowerCase())) {
          matches++;
        }
      }

      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = sentence.trim();
      }
    }

    return bestMatch || indexEntry.searchableText.substring(0, 200);
  }

  /**
   * Determine the type of match (exact, partial, fuzzy)
   */
  private determineMatchType(
    content: string,
    query: string,
  ): "exact" | "partial" | "fuzzy" {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();

    if (contentLower.includes(queryLower)) {
      return "exact";
    } else if (
      queryLower.split(/\s+/).some((token) => contentLower.includes(token))
    ) {
      return "partial";
    } else {
      return "fuzzy";
    }
  }

  /**
   * Highlight matches in text
   */
  private highlightMatches(text: string, queryTokens: string[]): string {
    let highlighted = text;

    for (const token of queryTokens) {
      const regex = new RegExp(`(${token})`, "gi");
      highlighted = highlighted.replace(regex, "<mark>$1</mark>");
    }

    return highlighted;
  }

  /**
   * Extract context before and after a match
   */
  private extractContext(
    fullText: string,
    matchedPortion: string,
    contextLength: number,
  ): { before: string; after: string } {
    if (!fullText || !matchedPortion) {
      return { before: "", after: "" };
    }

    const matchIndex = fullText.indexOf(matchedPortion);

    if (matchIndex === -1) {
      // If exact match not found, try to find a partial match
      const words = matchedPortion.split(/\s+/);
      let bestIndex = -1;
      for (const word of words) {
        const wordIndex = fullText.indexOf(word);
        if (wordIndex !== -1) {
          bestIndex = wordIndex;
          break;
        }
      }

      if (bestIndex === -1) {
        return { before: "", after: "" };
      }

      const before = fullText
        .substring(Math.max(0, bestIndex - contextLength), bestIndex)
        .trim();

      const after = fullText
        .substring(
          bestIndex + words[0].length,
          bestIndex + words[0].length + contextLength,
        )
        .trim();

      return { before, after };
    }

    const before = fullText
      .substring(Math.max(0, matchIndex - contextLength), matchIndex)
      .trim();

    const after = fullText
      .substring(
        matchIndex + matchedPortion.length,
        matchIndex + matchedPortion.length + contextLength,
      )
      .trim();

    return { before, after };
  }
}

// Export singleton instance
export const searchService = new SearchService();

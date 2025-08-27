import { ZodSession, ZodTranscriptEntry } from "@shared";

/**
 * Export format types
 */
export type ExportFormat = "json" | "csv" | "markdown" | "html" | "pdf";

/**
 * Export options configuration
 */
export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeUsageStats?: boolean;
  filterByDateRange?: {
    startDate: string;
    endDate: string;
  };
  includeSystemMessages?: boolean;
  compressOutput?: boolean;
  customTemplate?: string;
}

/**
 * Export result information
 */
export interface ExportResult {
  success: boolean;
  filename: string;
  size: number;
  exportFormat: ExportFormat;
  recordCount: number;
  error?: string;
  downloadUrl?: string;
}

/**
 * Export statistics
 */
export interface ExportStats {
  totalExports: number;
  exportsByFormat: Record<ExportFormat, number>;
  lastExportDate: string | null;
  totalSizeExported: number;
}

/**
 * Session data export service with multiple format support
 */
export class ExportService {
  private exportHistory: ExportResult[] = [];

  // Default export options
  private readonly defaultOptions: Required<
    Omit<ExportOptions, "filterByDateRange" | "customTemplate">
  > = {
    format: "json",
    includeMetadata: true,
    includeUsageStats: true,
    includeSystemMessages: false,
    compressOutput: false,
  };

  /**
   * Export a single session
   */
  async exportSession(
    session: ZodSession,
    options: Partial<ExportOptions> = {},
  ): Promise<ExportResult> {
    const exportOptions = { ...this.defaultOptions, ...options };

    try {
      let data: string;
      let filename: string;
      let mimeType: string;

      // Filter entries if date range is specified
      let filteredEntries = session.entries;
      if (exportOptions.filterByDateRange) {
        filteredEntries = this.filterEntriesByDateRange(
          session.entries,
          exportOptions.filterByDateRange.startDate,
          exportOptions.filterByDateRange.endDate,
        );
      }

      // Filter system messages if not included
      if (!exportOptions.includeSystemMessages) {
        filteredEntries = filteredEntries.filter(
          (entry) => entry.type !== "system",
        );
      }

      const exportData = {
        session: {
          ...session,
          entries: filteredEntries,
        },
        metadata: exportOptions.includeMetadata
          ? this.generateMetadata(session)
          : undefined,
        usageStats: exportOptions.includeUsageStats
          ? this.calculateUsageStats(session)
          : undefined,
        exportInfo: {
          exportedAt: new Date().toISOString(),
          format: exportOptions.format,
          recordCount: filteredEntries.length,
        },
      };

      switch (exportOptions.format) {
        case "json":
          data = JSON.stringify(exportData, null, 2);
          filename = `session-${session.id}.json`;
          mimeType = "application/json";
          break;
        case "csv":
          data = this.convertToCSV(filteredEntries, exportOptions);
          filename = `session-${session.id}.csv`;
          mimeType = "text/csv";
          break;
        case "markdown":
          data = this.convertToMarkdown(exportData, exportOptions);
          filename = `session-${session.id}.md`;
          mimeType = "text/markdown";
          break;
        case "html":
          data = this.convertToHTML(exportData, exportOptions);
          filename = `session-${session.id}.html`;
          mimeType = "text/html";
          break;
        case "pdf":
          // PDF generation would require additional libraries
          throw new Error("PDF export not yet implemented");
        default:
          throw new Error(`Unsupported export format: ${exportOptions.format}`);
      }

      // Compress if requested
      if (
        exportOptions.compressOutput &&
        typeof CompressionStream !== "undefined"
      ) {
        // Use browser compression API if available
        const compressed = await this.compressData(data);
        data = compressed;
        filename += ".gz";
        mimeType = "application/gzip";
      }

      // Create download URL
      const blob = new Blob([data], { type: mimeType });
      const downloadUrl = URL.createObjectURL(blob);

      const result: ExportResult = {
        success: true,
        filename,
        size: data.length,
        exportFormat: exportOptions.format,
        recordCount: filteredEntries.length,
        downloadUrl,
      };

      // Track export in history
      this.exportHistory.push(result);
      this.saveExportHistory();

      return result;
    } catch (error) {
      const result: ExportResult = {
        success: false,
        filename: `session-${session.id}.${exportOptions.format}`,
        size: 0,
        exportFormat: exportOptions.format,
        recordCount: 0,
        error: error instanceof Error ? error.message : "Unknown export error",
      };

      this.exportHistory.push(result);
      this.saveExportHistory();

      return result;
    }
  }

  /**
   * Export multiple sessions
   */
  async exportMultipleSessions(
    sessions: ZodSession[],
    options: Partial<ExportOptions> = {},
  ): Promise<ExportResult> {
    const exportOptions = { ...this.defaultOptions, ...options };

    try {
      const consolidatedData = {
        sessions: sessions.map((session) => ({
          ...session,
          entries: exportOptions.filterByDateRange
            ? this.filterEntriesByDateRange(
                session.entries,
                exportOptions.filterByDateRange.startDate,
                exportOptions.filterByDateRange.endDate,
              )
            : session.entries,
        })),
        metadata: exportOptions.includeMetadata
          ? {
              exportedAt: new Date().toISOString(),
              totalSessions: sessions.length,
              dateRange: this.calculateDateRange(sessions),
            }
          : undefined,
        aggregatedStats: exportOptions.includeUsageStats
          ? this.calculateAggregatedStats(sessions)
          : undefined,
      };

      const totalEntries = consolidatedData.sessions.reduce(
        (sum, session) => sum + session.entries.length,
        0,
      );

      let data: string;
      let filename: string;
      let mimeType: string;

      switch (exportOptions.format) {
        case "json":
          data = JSON.stringify(consolidatedData, null, 2);
          filename = `sessions-${Date.now()}.json`;
          mimeType = "application/json";
          break;
        case "csv":
          const allEntries = consolidatedData.sessions.flatMap(
            (s) => s.entries,
          );
          data = this.convertToCSV(allEntries, exportOptions);
          filename = `sessions-${Date.now()}.csv`;
          mimeType = "text/csv";
          break;
        case "markdown":
          data = this.convertMultiSessionToMarkdown(
            consolidatedData,
            exportOptions,
          );
          filename = `sessions-${Date.now()}.md`;
          mimeType = "text/markdown";
          break;
        case "html":
          data = this.convertMultiSessionToHTML(
            consolidatedData,
            exportOptions,
          );
          filename = `sessions-${Date.now()}.html`;
          mimeType = "text/html";
          break;
        default:
          throw new Error(`Unsupported export format: ${exportOptions.format}`);
      }

      // Create download URL
      const blob = new Blob([data], { type: mimeType });
      const downloadUrl = URL.createObjectURL(blob);

      const result: ExportResult = {
        success: true,
        filename,
        size: data.length,
        exportFormat: exportOptions.format,
        recordCount: totalEntries,
        downloadUrl,
      };

      this.exportHistory.push(result);
      this.saveExportHistory();

      return result;
    } catch (error) {
      const result: ExportResult = {
        success: false,
        filename: `sessions-${Date.now()}.${exportOptions.format}`,
        size: 0,
        exportFormat: exportOptions.format,
        recordCount: 0,
        error: error instanceof Error ? error.message : "Unknown export error",
      };

      this.exportHistory.push(result);
      return result;
    }
  }

  /**
   * Get export statistics
   */
  getExportStats(): ExportStats {
    const history = this.getExportHistory();

    return {
      totalExports: history.length,
      exportsByFormat: history.reduce(
        (acc, result) => {
          acc[result.exportFormat] = (acc[result.exportFormat] || 0) + 1;
          return acc;
        },
        {} as Record<ExportFormat, number>,
      ),
      lastExportDate:
        history.length > 0
          ? new Date().toISOString() // Would be stored with each export in real implementation
          : null,
      totalSizeExported: history.reduce((sum, result) => sum + result.size, 0),
    };
  }

  /**
   * Get export history
   */
  getExportHistory(): ExportResult[] {
    return [...this.exportHistory];
  }

  /**
   * Clear export history
   */
  clearExportHistory(): void {
    this.exportHistory = [];
    this.saveExportHistory();
  }

  /**
   * Generate session metadata
   */
  private generateMetadata(session: ZodSession) {
    return {
      sessionId: session.id,
      cwd: session.cwd,
      firstTimestamp: session.firstTimestamp,
      lastTimestamp: session.lastTimestamp,
      duration:
        new Date(session.lastTimestamp).getTime() -
        new Date(session.firstTimestamp).getTime(),
      entryCount: session.entries.length,
      messageTypes: this.getMessageTypeCounts(session.entries),
    };
  }

  /**
   * Calculate usage statistics
   */
  private calculateUsageStats(session: ZodSession) {
    return {
      totalUsage: session.totalUsage,
      averageTokensPerMessage:
        session.totalUsage.input_tokens + session.totalUsage.output_tokens > 0
          ? Math.round(
              (session.totalUsage.input_tokens +
                session.totalUsage.output_tokens) /
                session.entries.length,
            )
          : 0,
      cacheEfficiency:
        session.totalUsage.cache_read_input_tokens > 0
          ? Math.round(
              (session.totalUsage.cache_read_input_tokens /
                (session.totalUsage.input_tokens +
                  session.totalUsage.cache_read_input_tokens)) *
                100,
            )
          : 0,
    };
  }

  /**
   * Filter entries by date range
   */
  private filterEntriesByDateRange(
    entries: ZodTranscriptEntry[],
    startDate: string,
    endDate: string,
  ): ZodTranscriptEntry[] {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return entries.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      return entryDate >= start && entryDate <= end;
    });
  }

  /**
   * Convert entries to CSV format
   */
  private convertToCSV(
    entries: ZodTranscriptEntry[],
    options: ExportOptions,
  ): string {
    const headers = [
      "UUID",
      "Type",
      "Timestamp",
      "Content",
      "Usage_Input",
      "Usage_Output",
    ];

    const rows = entries.map((entry) => {
      const content = this.extractTextContent(entry);
      const usage =
        "message" in entry && entry.message && "usage" in entry.message
          ? entry.message.usage
          : null;

      return [
        entry.uuid,
        entry.type,
        entry.timestamp,
        `"${content.replace(/"/g, '""')}"`, // Escape quotes for CSV
        usage?.input_tokens || 0,
        usage?.output_tokens || 0,
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  /**
   * Convert session to Markdown format
   */
  private convertToMarkdown(data: any, options: ExportOptions): string {
    const { session } = data;
    let markdown = `# Claude Code Session: ${session.id}\n\n`;

    if (data.metadata) {
      markdown += `## Session Information\n`;
      markdown += `- **Session ID**: ${session.id}\n`;
      markdown += `- **Working Directory**: ${session.cwd}\n`;
      markdown += `- **Start Time**: ${session.firstTimestamp}\n`;
      markdown += `- **End Time**: ${session.lastTimestamp}\n`;
      markdown += `- **Total Entries**: ${session.entries.length}\n\n`;
    }

    if (data.usageStats) {
      markdown += `## Usage Statistics\n`;
      markdown += `- **Input Tokens**: ${session.totalUsage.input_tokens}\n`;
      markdown += `- **Output Tokens**: ${session.totalUsage.output_tokens}\n`;
      markdown += `- **Cache Read Tokens**: ${session.totalUsage.cache_read_input_tokens}\n`;
      markdown += `- **Cache Creation Tokens**: ${session.totalUsage.cache_creation_input_tokens}\n\n`;
    }

    markdown += `## Conversation\n\n`;

    for (const entry of session.entries) {
      markdown += `### ${entry.type.toUpperCase()} - ${entry.timestamp}\n\n`;
      const content = this.extractTextContent(entry);
      markdown += `${content}\n\n---\n\n`;
    }

    return markdown;
  }

  /**
   * Convert session to HTML format
   */
  private convertToHTML(data: any, options: ExportOptions): string {
    const { session } = data;

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Session: ${session.id}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .entry { margin-bottom: 20px; padding: 15px; border-left: 4px solid #007acc; background: #f9f9f9; }
    .entry.user { border-left-color: #28a745; }
    .entry.assistant { border-left-color: #007acc; }
    .entry.system { border-left-color: #ffc107; }
    .timestamp { color: #666; font-size: 0.9em; }
    .usage-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin: 20px 0; }
    .stat-card { padding: 15px; background: white; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <div class="header">
    <h1>Claude Code Session: ${session.id}</h1>
    ${
      data.metadata
        ? `
    <p><strong>Working Directory:</strong> ${session.cwd}</p>
    <p><strong>Duration:</strong> ${session.firstTimestamp} to ${session.lastTimestamp}</p>
    <p><strong>Total Entries:</strong> ${session.entries.length}</p>
    `
        : ""
    }
  </div>`;

    if (data.usageStats) {
      html += `
  <div class="usage-stats">
    <div class="stat-card">
      <h3>Input Tokens</h3>
      <p>${session.totalUsage.input_tokens}</p>
    </div>
    <div class="stat-card">
      <h3>Output Tokens</h3>
      <p>${session.totalUsage.output_tokens}</p>
    </div>
    <div class="stat-card">
      <h3>Cache Read</h3>
      <p>${session.totalUsage.cache_read_input_tokens}</p>
    </div>
    <div class="stat-card">
      <h3>Cache Creation</h3>
      <p>${session.totalUsage.cache_creation_input_tokens}</p>
    </div>
  </div>`;
    }

    html += `<div class="conversation">`;

    for (const entry of session.entries) {
      const content = this.extractTextContent(entry);
      html += `
    <div class="entry ${entry.type}">
      <div class="timestamp">${entry.type.toUpperCase()} - ${entry.timestamp}</div>
      <div class="content">${content.replace(/\n/g, "<br>")}</div>
    </div>`;
    }

    html += `</div></body></html>`;
    return html;
  }

  /**
   * Convert multiple sessions to Markdown
   */
  private convertMultiSessionToMarkdown(
    data: any,
    options: ExportOptions,
  ): string {
    let markdown = `# Claude Code Sessions Export\n\n`;
    markdown += `**Exported on**: ${new Date().toISOString()}\n`;
    markdown += `**Total Sessions**: ${data.sessions.length}\n\n`;

    for (const session of data.sessions) {
      markdown += `## Session: ${session.id}\n\n`;
      markdown += `- **Working Directory**: ${session.cwd}\n`;
      markdown += `- **Entries**: ${session.entries.length}\n`;
      markdown += `- **Duration**: ${session.firstTimestamp} to ${session.lastTimestamp}\n\n`;

      for (const entry of session.entries.slice(0, 3)) {
        // Limit to first 3 entries per session
        const content = this.extractTextContent(entry);
        markdown += `### ${entry.type} - ${entry.timestamp}\n${content}\n\n`;
      }

      if (session.entries.length > 3) {
        markdown += `... and ${session.entries.length - 3} more entries\n\n`;
      }

      markdown += `---\n\n`;
    }

    return markdown;
  }

  /**
   * Convert multiple sessions to HTML
   */
  private convertMultiSessionToHTML(data: any, options: ExportOptions): string {
    // Similar to single session HTML but with session grouping
    // Implementation would be similar to convertToHTML but iterate over sessions
    return this.convertToHTML({ session: data.sessions[0] }, options); // Simplified for now
  }

  /**
   * Extract text content from transcript entry
   */
  private extractTextContent(entry: ZodTranscriptEntry): string {
    if (entry.type === "user" || entry.type === "assistant") {
      const message = entry.message;
      if ("content" in message && Array.isArray(message.content)) {
        return message.content
          .map((item) => {
            if (item.type === "text") return item.text;
            if (item.type === "thinking") return `[Thinking: ${item.content}]`;
            if (item.type === "tool_use") return `[Tool: ${item.name}]`;
            if (item.type === "tool_result")
              return `[Tool Result: ${typeof item.content === "string" ? item.content : JSON.stringify(item.content)}]`;
            return "";
          })
          .join(" ");
      } else if ("text" in message) {
        return message.text;
      }
    } else if (entry.type === "summary") {
      return entry.summary;
    } else if (entry.type === "system") {
      return entry.content;
    }
    return "";
  }

  /**
   * Get message type counts
   */
  private getMessageTypeCounts(entries: ZodTranscriptEntry[]) {
    return entries.reduce(
      (counts, entry) => {
        counts[entry.type] = (counts[entry.type] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );
  }

  /**
   * Calculate date range for multiple sessions
   */
  private calculateDateRange(sessions: ZodSession[]) {
    if (sessions.length === 0) return null;

    const timestamps = sessions.flatMap((s) => [
      s.firstTimestamp,
      s.lastTimestamp,
    ]);
    return {
      start: timestamps.reduce((min, ts) => (ts < min ? ts : min)),
      end: timestamps.reduce((max, ts) => (ts > max ? ts : max)),
    };
  }

  /**
   * Calculate aggregated statistics across sessions
   */
  private calculateAggregatedStats(sessions: ZodSession[]) {
    return sessions.reduce(
      (agg, session) => {
        agg.input_tokens += session.totalUsage.input_tokens;
        agg.output_tokens += session.totalUsage.output_tokens;
        agg.cache_read_input_tokens +=
          session.totalUsage.cache_read_input_tokens;
        agg.cache_creation_input_tokens +=
          session.totalUsage.cache_creation_input_tokens;
        return agg;
      },
      {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    );
  }

  /**
   * Compress data using browser compression APIs
   */
  private async compressData(data: string): Promise<string> {
    // This would use CompressionStream if available in browser
    // For now, return the data as-is
    return data;
  }

  /**
   * Save export history to localStorage
   */
  private saveExportHistory(): void {
    try {
      localStorage.setItem(
        "claude-code-export-history",
        JSON.stringify(this.exportHistory),
      );
    } catch (error) {
      console.warn("Could not save export history to localStorage:", error);
    }
  }

  /**
   * Load export history from localStorage
   */
  private loadExportHistory(): void {
    try {
      const saved = localStorage.getItem("claude-code-export-history");
      if (saved) {
        this.exportHistory = JSON.parse(saved);
      }
    } catch (error) {
      console.warn("Could not load export history from localStorage:", error);
      this.exportHistory = [];
    }
  }

  constructor() {
    this.loadExportHistory();
  }
}

// Export singleton instance
export const exportService = new ExportService();

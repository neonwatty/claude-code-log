import { EventEmitter } from "events";
import { Readable, Transform } from "stream";
import * as fs from "fs/promises";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { marked } from "marked";
import {
  ISession,
  ITranscriptEntry,
  IApiResponse,
  IExportRequest,
  IExportResult,
  IExportStatus,
  IExportProgress,
  IExportOptions,
  ExportFormat,
} from "../../../shared/dist/src/index.js";

export interface ExportJobManager {
  jobs: Map<string, IExportStatus>;
  cleanupExpired(): Promise<void>;
  getJob(exportId: string): IExportStatus | null;
  createJob(request: IExportRequest): IExportStatus;
  updateJob(exportId: string, update: Partial<IExportStatus>): void;
}

export interface StreamingExportOptions extends IExportOptions {
  chunkSize?: number;
  maxMemoryUsage?: number;
  enableCompression?: boolean;
}

export interface ExportMetrics {
  totalExports: number;
  successfulExports: number;
  failedExports: number;
  averageProcessingTime: number;
  totalDataExported: number;
  activeExports: number;
}

export class ExportService extends EventEmitter {
  private static instance: ExportService | null = null;
  private jobManager: ExportJobManager;
  private tempDir: string;
  private maxConcurrentExports: number = 3;
  private activeExports: Set<string> = new Set();
  private exportMetrics: ExportMetrics = {
    totalExports: 0,
    successfulExports: 0,
    failedExports: 0,
    averageProcessingTime: 0,
    totalDataExported: 0,
    activeExports: 0,
  };

  constructor() {
    super();
    this.tempDir = path.join(process.cwd(), "temp", "exports");
    this.jobManager = new DefaultExportJobManager();
    this.initializeService();
  }

  public static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  private async initializeService(): Promise<void> {
    // Ensure temp directory exists
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      console.warn("Failed to create export temp directory:", error);
    }

    // Setup periodic cleanup
    setInterval(() => {
      this.jobManager.cleanupExpired().catch(console.error);
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Creates a new export job and starts processing
   */
  public async createExport(request: IExportRequest): Promise<IExportResult> {
    // Validate request
    if (!this.validateExportRequest(request)) {
      throw new Error("Invalid export request");
    }

    // Check concurrent export limit
    if (this.activeExports.size >= this.maxConcurrentExports) {
      throw new Error("Maximum concurrent exports reached. Please try again later.");
    }

    const job = this.jobManager.createJob(request);
    this.activeExports.add(job.exportId);
    this.exportMetrics.activeExports = this.activeExports.size;

    // Start export processing asynchronously
    this.processExportAsync(job, request);

    return {
      success: true,
      exportId: job.exportId,
      format: request.options.format,
      filename: `export_${job.exportId}.${this.getFileExtension(request.options.format)}`,
      size: 0,
      metadata: {
        sessionCount: 0,
        messageCount: 0,
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        options: request.options,
      },
    };
  }

  /**
   * Gets the status of an export job
   */
  public getExportStatus(exportId: string): IExportStatus | null {
    return this.jobManager.getJob(exportId);
  }

  /**
   * Gets export metrics
   */
  public getExportMetrics(): ExportMetrics {
    return { ...this.exportMetrics };
  }

  /**
   * Streams export data as it's generated
   */
  public createExportStream(exportId: string): Readable | null {
    const job = this.jobManager.getJob(exportId);
    if (!job || job.status !== "completed") {
      return null;
    }

    const filePath = this.getExportFilePath(exportId, job.result?.format || "json");
    return new Readable({
      read() {
        // Stream implementation will be handled by the specific format generators
      },
    });
  }

  /**
   * Private processing methods
   */
  private async processExportAsync(job: IExportStatus, request: IExportRequest): Promise<void> {
    const startTime = Date.now();

    try {
      this.updateJobProgress(job.exportId, {
        stage: "preparing",
        progress: 0,
        message: "Preparing export...",
      });

      // Collect session data
      const sessions = await this.collectSessionData(request);
      const totalMessages = sessions.reduce((sum, session) => sum + session.entries.length, 0);

      this.updateJobProgress(job.exportId, {
        stage: "processing",
        progress: 25,
        totalItems: totalMessages,
        processedItems: 0,
        message: `Processing ${totalMessages} messages from ${sessions.length} sessions...`,
      });

      // Generate export based on format
      const result = await this.generateExport(job.exportId, sessions, request.options, (progress) => {
        this.updateJobProgress(job.exportId, progress);
      });

      const processingTime = Date.now() - startTime;

      // Update job with success result
      this.jobManager.updateJob(job.exportId, {
        status: "completed",
        completedAt: new Date().toISOString(),
        result: {
          ...result,
          metadata: {
            ...result.metadata,
            sessionCount: sessions.length,
            messageCount: totalMessages,
            processingTime,
          },
        },
      });

      // Update metrics
      this.exportMetrics.totalExports++;
      this.exportMetrics.successfulExports++;
      this.exportMetrics.totalDataExported += result.size;
      this.exportMetrics.averageProcessingTime = 
        (this.exportMetrics.averageProcessingTime * (this.exportMetrics.totalExports - 1) + processingTime) 
        / this.exportMetrics.totalExports;

      this.emit("exportCompleted", { exportId: job.exportId, result });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      this.jobManager.updateJob(job.exportId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: errorMessage,
      });

      this.exportMetrics.totalExports++;
      this.exportMetrics.failedExports++;

      this.emit("exportFailed", { exportId: job.exportId, error: errorMessage });
    } finally {
      this.activeExports.delete(job.exportId);
      this.exportMetrics.activeExports = this.activeExports.size;
    }
  }

  private async generateExport(
    exportId: string,
    sessions: ISession[],
    options: IExportOptions,
    onProgress: (progress: IExportProgress) => void
  ): Promise<IExportResult> {
    switch (options.format) {
      case "html":
        return this.generateHTMLExport(exportId, sessions, options, onProgress);
      case "markdown":
        return this.generateMarkdownExport(exportId, sessions, options, onProgress);
      case "json":
        return this.generateJSONExport(exportId, sessions, options, onProgress);
      case "pdf":
        return this.generatePDFExport(exportId, sessions, options, onProgress);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private async generateHTMLExport(
    exportId: string,
    sessions: ISession[],
    options: IExportOptions,
    onProgress: (progress: IExportProgress) => void
  ): Promise<IExportResult> {
    const filename = `export_${exportId}.html`;
    const filePath = path.join(this.tempDir, filename);

    onProgress({
      stage: "generating",
      progress: 50,
      message: "Generating HTML content...",
    });

    let htmlContent = this.generateHTMLHeader(options);
    let processedMessages = 0;
    let totalSize = 0;

    // Process sessions in chunks for memory efficiency
    for (const session of sessions) {
      htmlContent += this.generateSessionHTML(session, options);
      processedMessages += session.entries.length;
      
      onProgress({
        stage: "generating",
        progress: 50 + (processedMessages / this.getTotalMessages(sessions)) * 30,
        processedItems: processedMessages,
        message: `Generated ${processedMessages} messages...`,
      });
    }

    htmlContent += this.generateHTMLFooter();

    onProgress({
      stage: "streaming",
      progress: 85,
      message: "Writing export file...",
    });

    await fs.writeFile(filePath, htmlContent, "utf-8");
    const stats = await fs.stat(filePath);
    totalSize = stats.size;

    onProgress({
      stage: "completed",
      progress: 100,
      message: "HTML export completed",
      bytesProcessed: totalSize,
    });

    return {
      success: true,
      exportId,
      format: "html",
      filename,
      size: totalSize,
      downloadToken: this.generateDownloadToken(exportId),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      metadata: {
        sessionCount: sessions.length,
        messageCount: this.getTotalMessages(sessions),
        generatedAt: new Date().toISOString(),
        processingTime: 0, // Will be set by caller
        options,
      },
    };
  }

  private async generateMarkdownExport(
    exportId: string,
    sessions: ISession[],
    options: IExportOptions,
    onProgress: (progress: IExportProgress) => void
  ): Promise<IExportResult> {
    const filename = `export_${exportId}.md`;
    const filePath = path.join(this.tempDir, filename);

    onProgress({
      stage: "generating",
      progress: 50,
      message: "Generating Markdown content...",
    });

    let markdownContent = this.generateMarkdownHeader(options);
    let processedMessages = 0;

    for (const session of sessions) {
      markdownContent += this.generateSessionMarkdown(session, options);
      processedMessages += session.entries.length;
      
      onProgress({
        stage: "generating",
        progress: 50 + (processedMessages / this.getTotalMessages(sessions)) * 30,
        processedItems: processedMessages,
        message: `Generated ${processedMessages} messages...`,
      });
    }

    onProgress({
      stage: "streaming",
      progress: 85,
      message: "Writing export file...",
    });

    await fs.writeFile(filePath, markdownContent, "utf-8");
    const stats = await fs.stat(filePath);

    onProgress({
      stage: "completed",
      progress: 100,
      message: "Markdown export completed",
      bytesProcessed: stats.size,
    });

    return {
      success: true,
      exportId,
      format: "markdown",
      filename,
      size: stats.size,
      downloadToken: this.generateDownloadToken(exportId),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        sessionCount: sessions.length,
        messageCount: this.getTotalMessages(sessions),
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        options,
      },
    };
  }

  private async generateJSONExport(
    exportId: string,
    sessions: ISession[],
    options: IExportOptions,
    onProgress: (progress: IExportProgress) => void
  ): Promise<IExportResult> {
    const filename = `export_${exportId}.json`;
    const filePath = path.join(this.tempDir, filename);

    onProgress({
      stage: "generating",
      progress: 50,
      message: "Preparing JSON structure...",
    });

    // Create streamlined JSON structure
    const exportData = {
      metadata: {
        exportId,
        generatedAt: new Date().toISOString(),
        format: "json" as ExportFormat,
        options,
        totalSessions: sessions.length,
        totalMessages: this.getTotalMessages(sessions),
      },
      sessions: this.filterSessionsForExport(sessions, options),
    };

    onProgress({
      stage: "streaming",
      progress: 85,
      message: "Writing JSON file...",
    });

    const jsonString = JSON.stringify(exportData, null, options.compressionLevel ? 0 : 2);
    await fs.writeFile(filePath, jsonString, "utf-8");
    const stats = await fs.stat(filePath);

    onProgress({
      stage: "completed",
      progress: 100,
      message: "JSON export completed",
      bytesProcessed: stats.size,
    });

    return {
      success: true,
      exportId,
      format: "json",
      filename,
      size: stats.size,
      downloadToken: this.generateDownloadToken(exportId),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        sessionCount: sessions.length,
        messageCount: this.getTotalMessages(sessions),
        generatedAt: new Date().toISOString(),
        processingTime: 0,
        options,
      },
    };
  }

  private async generatePDFExport(
    exportId: string,
    sessions: ISession[],
    options: IExportOptions,
    onProgress: (progress: IExportProgress) => void
  ): Promise<IExportResult> {
    const filename = `export_${exportId}.pdf`;
    const filePath = path.join(this.tempDir, filename);

    onProgress({
      stage: "generating",
      progress: 30,
      message: "Generating HTML for PDF conversion...",
    });

    // First generate HTML content
    const htmlContent = this.generateHTMLHeader(options) +
      sessions.map(session => this.generateSessionHTML(session, options)).join("\n") +
      this.generateHTMLFooter();

    onProgress({
      stage: "processing",
      progress: 60,
      message: "Launching PDF generator...",
    });

    // Dynamically import puppeteer to avoid static import issues
    const puppeteer = await import("puppeteer");

    // Launch Puppeteer for PDF generation
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      
      onProgress({
        stage: "generating",
        progress: 75,
        message: "Converting to PDF...",
      });

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px',
        },
      });

      await fs.writeFile(filePath, pdfBuffer);
      const stats = await fs.stat(filePath);

      onProgress({
        stage: "completed",
        progress: 100,
        message: "PDF export completed",
        bytesProcessed: stats.size,
      });

      return {
        success: true,
        exportId,
        format: "pdf",
        filename,
        size: stats.size,
        downloadToken: this.generateDownloadToken(exportId),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        metadata: {
          sessionCount: sessions.length,
          messageCount: this.getTotalMessages(sessions),
          generatedAt: new Date().toISOString(),
          processingTime: 0,
          options,
        },
      };

    } finally {
      await browser.close();
    }
  }

  /**
   * HTML generation helpers
   */
  private generateHTMLHeader(options: IExportOptions): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code Log Export</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; }
        .session { margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
        .session-header { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .message { margin-bottom: 20px; padding: 15px; border-radius: 8px; }
        .user-message { background: #e8f4f8; border-left: 4px solid #2196F3; }
        .assistant-message { background: #f0f8e8; border-left: 4px solid #4CAF50; }
        .system-message { background: #fff3e0; border-left: 4px solid #FF9800; }
        .metadata { font-size: 0.9em; color: #666; margin-bottom: 10px; }
        .content { white-space: pre-wrap; }
        .tool-use { background: #f5f5f5; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .thinking { background: #fafafa; padding: 10px; border-radius: 4px; margin: 10px 0; font-style: italic; }
        pre { background: #f8f8f8; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>Claude Code Log Export</h1>
    <div class="export-metadata">
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Format:</strong> HTML</p>
        ${options.includeMetadata ? '<p><strong>Includes:</strong> Metadata, Tool Use, Thinking</p>' : ''}
    </div>
`;
  }

  private generateHTMLFooter(): string {
    return `
</body>
</html>`;
  }

  private generateSessionHTML(session: ISession, options: IExportOptions): string {
    let html = `
    <div class="session">
        <div class="session-header">
            <h2>Session: ${session.id}</h2>
            <div class="metadata">
                <strong>Project:</strong> ${session.cwd}<br>
                <strong>Duration:</strong> ${session.firstTimestamp} - ${session.lastTimestamp}<br>
                <strong>Messages:</strong> ${session.entries.length}<br>
                ${session.totalUsage ? `<strong>Tokens:</strong> ${session.totalUsage.input_tokens || 0} input, ${session.totalUsage.output_tokens || 0} output` : ''}
            </div>
        </div>
`;

    for (const entry of this.filterEntriesForExport(session.entries, options)) {
      html += this.generateMessageHTML(entry, options);
    }

    html += `    </div>`;
    return html;
  }

  private generateMessageHTML(entry: ITranscriptEntry, options: IExportOptions): string {
    const cssClass = `${entry.type}-message`;
    const timestamp = "timestamp" in entry ? new Date(entry.timestamp).toLocaleString() : "Unknown time";
    
    let html = `
        <div class="message ${cssClass}">
            <div class="metadata">
                <strong>${entry.type.toUpperCase()}</strong> - ${timestamp}
            </div>
`;

    if (entry.type === "user" || entry.type === "assistant") {
      const message = "message" in entry ? entry.message : null;
      if (message && message.content) {
        if (typeof message.content === "string") {
          html += `<div class="content">${this.escapeHtml(message.content)}</div>`;
        } else if (Array.isArray(message.content)) {
          for (const content of message.content) {
            html += this.generateContentHTML(content, options);
          }
        }
      }
    }

    html += `        </div>`;
    return html;
  }

  private generateContentHTML(content: any, options: IExportOptions): string {
    if (!content || !content.type) return "";

    switch (content.type) {
      case "text":
        return `<div class="content">${this.escapeHtml(content.text || "")}</div>`;
      
      case "tool_use":
        if (!options.includeToolUse) return "";
        return `<div class="tool-use">
          <strong>Tool:</strong> ${content.name}<br>
          <strong>Input:</strong> <pre>${JSON.stringify(content.input, null, 2)}</pre>
        </div>`;
      
      case "tool_result":
        if (!options.includeToolUse) return "";
        return `<div class="tool-use">
          <strong>Tool Result:</strong><br>
          <pre>${this.escapeHtml(typeof content.content === "string" ? content.content : JSON.stringify(content.content, null, 2))}</pre>
        </div>`;
      
      case "thinking":
        if (!options.includeThinking) return "";
        return `<div class="thinking">
          <strong>Thinking:</strong> ${this.escapeHtml(content.thinking || "")}
        </div>`;
      
      case "image":
        if (!options.includeImages) return "";
        return `<div class="image">
          <img src="data:${content.source?.media_type || 'image/png'};base64,${content.source?.data || ''}" alt="Embedded image" style="max-width: 100%; height: auto;">
        </div>`;
      
      default:
        return "";
    }
  }

  /**
   * Markdown generation helpers
   */
  private generateMarkdownHeader(options: IExportOptions): string {
    return `# Claude Code Log Export

**Generated:** ${new Date().toISOString()}
**Format:** Markdown
${options.includeMetadata ? '**Includes:** Metadata, Tool Use, Thinking' : ''}

---

`;
  }

  private generateSessionMarkdown(session: ISession, options: IExportOptions): string {
    let markdown = `## Session: ${session.id}

**Project:** ${session.cwd}
**Duration:** ${session.firstTimestamp} - ${session.lastTimestamp}
**Messages:** ${session.entries.length}
${session.totalUsage ? `**Tokens:** ${session.totalUsage.input_tokens || 0} input, ${session.totalUsage.output_tokens || 0} output` : ''}

`;

    for (const entry of this.filterEntriesForExport(session.entries, options)) {
      markdown += this.generateMessageMarkdown(entry, options);
    }

    return markdown + "\n---\n\n";
  }

  private generateMessageMarkdown(entry: ITranscriptEntry, options: IExportOptions): string {
    const timestamp = "timestamp" in entry ? new Date(entry.timestamp).toISOString() : "Unknown time";
    let markdown = `### ${entry.type.toUpperCase()} - ${timestamp}\n\n`;

    if (entry.type === "user" || entry.type === "assistant") {
      const message = "message" in entry ? entry.message : null;
      if (message && message.content) {
        if (typeof message.content === "string") {
          markdown += `${message.content}\n\n`;
        } else if (Array.isArray(message.content)) {
          for (const content of message.content) {
            markdown += this.generateContentMarkdown(content, options);
          }
        }
      }
    }

    return markdown;
  }

  private generateContentMarkdown(content: any, options: IExportOptions): string {
    if (!content || !content.type) return "";

    switch (content.type) {
      case "text":
        return `${content.text || ""}\n\n`;
      
      case "tool_use":
        if (!options.includeToolUse) return "";
        return `**Tool:** ${content.name}

\`\`\`json
${JSON.stringify(content.input, null, 2)}
\`\`\`

`;
      
      case "tool_result":
        if (!options.includeToolUse) return "";
        return `**Tool Result:**

\`\`\`
${typeof content.content === "string" ? content.content : JSON.stringify(content.content, null, 2)}
\`\`\`

`;
      
      case "thinking":
        if (!options.includeThinking) return "";
        return `> **Thinking:** ${content.thinking || ""}

`;
      
      case "image":
        if (!options.includeImages) return "";
        return `![Embedded image](data:${content.source?.media_type || 'image/png'};base64,${content.source?.data || ''})

`;
      
      default:
        return "";
    }
  }

  /**
   * Utility methods
   */
  private async collectSessionData(request: IExportRequest): Promise<ISession[]> {
    // Check if this service has been monkey-patched with session data collection
    // This happens in the export route to provide real session data
    if ((this as any).collectSessionData !== ExportService.prototype.collectSessionData) {
      return (this as any).collectSessionData(request);
    }

    // Fallback: return empty array for unit tests or standalone usage
    console.warn("ExportService: No session data collection method provided. Use monkey-patching or dependency injection.");
    return [];
  }

  private filterSessionsForExport(sessions: ISession[], options: IExportOptions): ISession[] {
    let filtered = [...sessions];

    // Apply date range filter
    if (options.dateRange?.startDate) {
      const startDate = new Date(options.dateRange.startDate);
      filtered = filtered.filter(session => new Date(session.firstTimestamp) >= startDate);
    }

    if (options.dateRange?.endDate) {
      const endDate = new Date(options.dateRange.endDate);
      filtered = filtered.filter(session => new Date(session.lastTimestamp) <= endDate);
    }

    // Apply message type filtering to entries within each session
    if (options.messageTypes && options.messageTypes.length > 0) {
      filtered = filtered.map(session => ({
        ...session,
        entries: this.filterEntriesForExport(session.entries, options)
      }));
    }

    return filtered;
  }

  private filterEntriesForExport(entries: ITranscriptEntry[], options: IExportOptions): ITranscriptEntry[] {
    let filtered = [...entries];

    // Filter by message types
    if (options.messageTypes && options.messageTypes.length > 0) {
      filtered = filtered.filter(entry => options.messageTypes!.includes(entry.type));
    }

    return filtered;
  }

  private validateExportRequest(request: IExportRequest): boolean {
    // Basic validation
    if (!request.options || !request.options.format) {
      return false;
    }

    const validFormats: ExportFormat[] = ["html", "markdown", "json", "pdf"];
    if (!validFormats.includes(request.options.format)) {
      return false;
    }

    // Must have at least one identifier
    if (!request.sessionId && !request.sessionIds?.length && !request.projectName) {
      return false;
    }

    return true;
  }

  private updateJobProgress(exportId: string, progress: Partial<IExportProgress>): void {
    const job = this.jobManager.getJob(exportId);
    if (job) {
      job.progress = { ...job.progress, ...progress };
      this.emit("exportProgress", { exportId, progress: job.progress });
    }
  }

  private getTotalMessages(sessions: ISession[]): number {
    return sessions.reduce((sum, session) => sum + session.entries.length, 0);
  }

  private getFileExtension(format: ExportFormat): string {
    switch (format) {
      case "html": return "html";
      case "markdown": return "md";
      case "json": return "json";
      case "pdf": return "pdf";
      default: return "txt";
    }
  }

  private getExportFilePath(exportId: string, format: ExportFormat): string {
    const filename = `export_${exportId}.${this.getFileExtension(format)}`;
    return path.join(this.tempDir, filename);
  }

  private generateDownloadToken(exportId: string): string {
    // Generate a secure token for download access
    return Buffer.from(`${exportId}_${Date.now()}_${Math.random()}`).toString('base64');
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Cleanup methods
   */
  public async cleanupExpiredExports(): Promise<void> {
    await this.jobManager.cleanupExpired();
  }

  public async shutdown(): Promise<void> {
    // Cancel active exports
    for (const exportId of this.activeExports) {
      this.jobManager.updateJob(exportId, {
        status: "failed",
        error: "Service shutdown",
        completedAt: new Date().toISOString(),
      });
    }
    this.activeExports.clear();

    // Cleanup temp files
    try {
      const files = await fs.readdir(this.tempDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.tempDir, file)).catch(() => {}))
      );
    } catch (error) {
      console.warn("Failed to cleanup temp files:", error);
    }

    this.removeAllListeners();
  }
}

/**
 * Default implementation of ExportJobManager
 */
class DefaultExportJobManager implements ExportJobManager {
  public jobs: Map<string, IExportStatus> = new Map();

  createJob(request: IExportRequest): IExportStatus {
    const exportId = uuidv4();
    const job: IExportStatus = {
      exportId,
      status: "pending",
      progress: {
        stage: "preparing",
        progress: 0,
        message: "Export queued",
      },
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(exportId, job);
    return job;
  }

  getJob(exportId: string): IExportStatus | null {
    return this.jobs.get(exportId) || null;
  }

  updateJob(exportId: string, update: Partial<IExportStatus>): void {
    const job = this.jobs.get(exportId);
    if (job) {
      Object.assign(job, update);
    }
  }

  async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, job] of this.jobs) {
      const createdTime = new Date(job.createdAt).getTime();
      const isExpired = now - createdTime > 24 * 60 * 60 * 1000; // 24 hours

      if (isExpired || (job.status === "completed" && job.completedAt)) {
        const completedTime = job.completedAt ? new Date(job.completedAt).getTime() : createdTime;
        if (now - completedTime > 60 * 60 * 1000) { // 1 hour after completion
          expiredIds.push(id);
        }
      }
    }

    // Remove expired jobs
    for (const id of expiredIds) {
      this.jobs.delete(id);
      
      // Also cleanup the file
      try {
        const service = ExportService.getInstance();
        const tempDir = (service as any).tempDir;
        const files = await fs.readdir(tempDir);
        const exportFiles = files.filter(file => file.includes(id));
        await Promise.all(
          exportFiles.map(file => fs.unlink(path.join(tempDir, file)).catch(() => {}))
        );
      } catch (error) {
        console.warn(`Failed to cleanup files for export ${id}:`, error);
      }
    }
  }
}

// Singleton instance getter
export function getExportService(): ExportService {
  return ExportService.getInstance();
}
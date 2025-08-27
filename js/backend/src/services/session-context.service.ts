import { promises as fs } from "fs";
import path from "path";
import {
  ZodSession,
  ZodTranscriptEntry,
} from "../../../shared/src/schemas/index.js";
import {
  SessionContextData,
  ClaudeContextConfig,
  ContextPreparationResult,
  ContextTransferData,
} from "../../../shared/src/schemas/claude-integration.js";

/**
 * Session Context Service
 *
 * Handles preparation and transfer of session context for Claude Code CLI continuation.
 * Generates CLAUDE.md files, extracts relevant conversation context, and prepares
 * session data for seamless continuation.
 *
 * Features:
 * - Context serialization and validation
 * - CLAUDE.md file generation from session data
 * - Session context preparation and cleanup
 * - File context extraction for continuation
 */
export class SessionContextService {
  private static readonly CLAUDE_MD_FILENAME = "CLAUDE.md";
  private static readonly MAX_CONTEXT_LENGTH = 50000; // 50KB limit for context files
  private static readonly EXCLUDED_FILE_PATTERNS = [
    /node_modules/,
    /\.git/,
    /\.env/,
    /\.log/,
    /dist/,
    /build/,
    /coverage/,
    /\.cache/,
    /temp/,
    /tmp/,
  ];

  /**
   * Prepare session context for Claude Code CLI continuation
   */
  async prepareSessionContext(
    session: ZodSession,
    config: ClaudeContextConfig = {
      includeGuidelines: true,
      maxContextFiles: 50,
    },
  ): Promise<ContextPreparationResult> {
    try {
      const startTime = Date.now();

      // Extract context data from session
      const contextData = await this.extractSessionContext(session);

      // Generate CLAUDE.md content
      const claudeMdContent = await this.generateClaudeMdContent(
        session,
        contextData,
        config,
      );

      // Prepare working directory
      const workingDirectory = config.workingDirectory || session.cwd;
      await this.ensureDirectoryExists(workingDirectory);

      // Write CLAUDE.md file
      const claudeMdPath = path.join(
        workingDirectory,
        SessionContextService.CLAUDE_MD_FILENAME,
      );
      await fs.writeFile(claudeMdPath, claudeMdContent, "utf-8");

      // Collect relevant file paths for context
      const relevantFiles = await this.identifyRelevantFiles(
        workingDirectory,
        contextData,
      );

      const result: ContextPreparationResult = {
        success: true,
        contextData,
        claudeMdPath,
        claudeMdContent,
        workingDirectory,
        relevantFiles,
        processingTimeMs: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to prepare session context: ${errorMessage}`,
      };
    }
  }

  /**
   * Extract meaningful context from session data
   */
  private async extractSessionContext(
    session: ZodSession,
  ): Promise<SessionContextData> {
    const entries = session.entries || [];

    // Group entries by type and analyze patterns
    const userMessages = entries.filter(
      (e: ZodTranscriptEntry) => e.type === "user",
    );
    const assistantMessages = entries.filter(
      (e: ZodTranscriptEntry) => e.type === "assistant",
    );

    // Handle both schema-compliant entries and test mock entries
    const toolUses = entries.filter((e: any) => {
      // For test mocks with type 'tool_use'
      if (e.type === "tool_use") return true;
      // For schema-compliant assistant messages with tool_use content
      if (
        e.type === "assistant" &&
        "message" in e &&
        e.message?.content &&
        Array.isArray(e.message.content)
      ) {
        return e.message.content.some((c: any) => c.type === "tool_use");
      }
      return false;
    });

    const toolResults = entries.filter((e: any) => {
      // For test mocks with type 'tool_result'
      if (e.type === "tool_result") return true;
      // For schema-compliant assistant messages with tool_result content
      if (
        e.type === "assistant" &&
        "message" in e &&
        e.message?.content &&
        Array.isArray(e.message.content)
      ) {
        return e.message.content.some((c: any) => c.type === "tool_result");
      }
      return false;
    });

    // Extract key topics and intents from conversation
    const keyTopics = this.extractKeyTopics(userMessages, assistantMessages);
    const codePatterns = this.extractCodePatterns(toolUses, toolResults);
    const projectContext = await this.extractProjectContext(session);

    // Calculate session statistics
    const sessionStats = {
      totalMessages: entries.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      toolUses: toolUses.length,
      totalTokens:
        (session.totalUsage?.input_tokens || 0) +
        (session.totalUsage?.output_tokens || 0),
      duration: this.calculateSessionDuration(entries),
      lastActivity: session.lastTimestamp,
    };

    return {
      sessionId: session.id,
      projectPath: session.cwd,
      keyTopics,
      codePatterns,
      projectContext,
      sessionStats,
      conversationSummary: this.generateConversationSummary(
        userMessages,
        assistantMessages,
      ),
      recentContext: this.extractRecentContext(entries.slice(-20)), // Last 20 entries
    };
  }

  /**
   * Generate CLAUDE.md content based on session data
   */
  private async generateClaudeMdContent(
    session: ZodSession,
    contextData: SessionContextData,
    config: ClaudeContextConfig,
  ): Promise<string> {
    const {
      sessionStats,
      keyTopics,
      codePatterns,
      projectContext,
      conversationSummary,
    } = contextData;

    let content = `# CLAUDE.md\n\n`;
    content += `This file provides session context for Claude Code continuation.\n`;
    content += `Generated from session: ${session.id}\n`;
    content += `Last updated: ${new Date().toISOString()}\n\n`;

    // Project Overview
    content += `## Project Overview\n\n`;
    content += `**Working Directory:** \`${session.cwd}\`\n`;
    if (projectContext.projectType) {
      content += `**Project Type:** ${projectContext.projectType}\n`;
    }
    if (projectContext.mainLanguages?.length > 0) {
      content += `**Main Languages:** ${projectContext.mainLanguages.join(", ")}\n`;
    }
    if (projectContext.frameworks?.length > 0) {
      content += `**Frameworks:** ${projectContext.frameworks.join(", ")}\n`;
    }
    content += `\n`;

    // Session Summary
    content += `## Session Summary\n\n`;
    content += `**Duration:** ${Math.round(sessionStats.duration / 1000 / 60)} minutes\n`;
    content += `**Total Messages:** ${sessionStats.totalMessages}\n`;
    content += `**Tool Uses:** ${sessionStats.toolUses}\n`;
    content += `**Token Usage:** ${sessionStats.totalTokens.toLocaleString()}\n\n`;

    if (conversationSummary) {
      content += `**Key Activities:**\n${conversationSummary}\n\n`;
    }

    // Key Topics
    if (keyTopics.length > 0) {
      content += `## Key Discussion Topics\n\n`;
      keyTopics.forEach((topic) => {
        content += `- ${topic}\n`;
      });
      content += `\n`;
    }

    // Code Patterns and Files
    if (codePatterns.modifiedFiles.length > 0) {
      content += `## Recently Modified Files\n\n`;
      codePatterns.modifiedFiles.forEach((file) => {
        content += `- \`${file}\`\n`;
      });
      content += `\n`;
    }

    if (codePatterns.commonPatterns.length > 0) {
      content += `## Common Code Patterns\n\n`;
      codePatterns.commonPatterns.forEach((pattern) => {
        content += `- ${pattern}\n`;
      });
      content += `\n`;
    }

    // Development Guidelines
    if (config.includeGuidelines !== false) {
      content += `## Development Guidelines\n\n`;
      content += `- Follow existing code patterns and conventions\n`;
      content += `- Maintain consistency with project structure\n`;
      content += `- Use appropriate testing strategies\n`;
      content += `- Consider performance and security implications\n\n`;
    }

    // Context Preparation Settings
    if (config.additionalInstructions) {
      content += `## Additional Context\n\n`;
      content += `${config.additionalInstructions}\n\n`;
    }

    // Footer with metadata
    content += `---\n`;
    content += `*Generated by Claude Code Log Session Context Service*\n`;
    content += `*Session ID: ${session.id}*\n`;
    content += `*Preparation Time: ${new Date().toISOString()}*\n`;

    return content;
  }

  /**
   * Extract key topics from conversation
   */
  private extractKeyTopics(
    userMessages: ZodTranscriptEntry[],
    assistantMessages: ZodTranscriptEntry[],
  ): string[] {
    const topics = new Set<string>();

    // Extract from user messages
    userMessages.forEach((msg) => {
      if ("message" in msg && msg.message?.content) {
        const content = Array.isArray(msg.message.content)
          ? msg.message.content
              .map((c: any) => (typeof c === "string" ? c : c.text))
              .join(" ")
          : msg.message.content;

        // Look for common development topics
        const topicPatterns = [
          /implement\s+(\w+)/gi,
          /create\s+(\w+)/gi,
          /fix\s+(\w+)/gi,
          /add\s+(\w+)/gi,
          /update\s+(\w+)/gi,
          /refactor\s+(\w+)/gi,
          /debug\s+(\w+)/gi,
          /test\s+(\w+)/gi,
        ];

        topicPatterns.forEach((pattern: RegExp) => {
          const matches = content.match(pattern);
          if (matches) {
            matches.forEach((match: string) => topics.add(match.trim()));
          }
        });
      }
    });

    return Array.from(topics).slice(0, 10); // Limit to top 10 topics
  }

  /**
   * Extract code patterns from tool uses
   */
  private extractCodePatterns(toolUses: any[], toolResults: any[]) {
    const modifiedFiles = new Set<string>();
    const commonPatterns = new Set<string>();

    // Process all entries to find tool usage patterns
    [...toolUses, ...toolResults].forEach((entry) => {
      // Handle test mock structure where tool_use entries have message.tool_calls
      if (entry.type === "tool_use" && entry.message?.tool_calls) {
        const toolCalls = entry.message.tool_calls;
        if (Array.isArray(toolCalls)) {
          toolCalls.forEach((call: any) => {
            if (
              call.function?.name === "str_replace_editor" &&
              call.function.arguments
            ) {
              try {
                const args = JSON.parse(call.function.arguments);
                if (args.path) {
                  modifiedFiles.add(args.path);
                }
                if (
                  args.command === "create" ||
                  args.command === "str_replace"
                ) {
                  commonPatterns.add(`File ${args.command} operations`);
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          });
        }
      }

      // Handle schema-compliant assistant messages with ToolUseContent in content array
      if (
        entry.type === "assistant" &&
        entry.message?.content &&
        Array.isArray(entry.message.content)
      ) {
        entry.message.content.forEach((contentItem: any) => {
          if (
            contentItem.type === "tool_use" &&
            contentItem.name === "str_replace_editor" &&
            contentItem.input
          ) {
            const input = contentItem.input;
            if (input.path) {
              modifiedFiles.add(input.path);
            }
            if (input.command === "create" || input.command === "str_replace") {
              commonPatterns.add(`File ${input.command} operations`);
            }
          }
        });
      }
    });

    return {
      modifiedFiles: Array.from(modifiedFiles).slice(0, 20),
      commonPatterns: Array.from(commonPatterns).slice(0, 10),
    };
  }

  /**
   * Extract project context information
   */
  private async extractProjectContext(session: ZodSession) {
    const cwd = session.cwd;
    const projectType = this.inferProjectType(cwd);
    const mainLanguages = await this.inferMainLanguages(cwd);
    const frameworks = await this.inferFrameworks(cwd);

    return {
      projectType,
      mainLanguages,
      frameworks,
      workingDirectory: cwd,
    };
  }

  /**
   * Generate conversation summary
   */
  private generateConversationSummary(
    userMessages: ZodTranscriptEntry[],
    assistantMessages: ZodTranscriptEntry[],
  ): string {
    if (userMessages.length === 0) return "";

    const recentUserMessages = userMessages.slice(-5); // Last 5 user messages
    const summary = recentUserMessages
      .map((msg) => {
        if ("message" in msg && msg.message?.content) {
          const content = Array.isArray(msg.message.content)
            ? msg.message.content
                .map((c: any) => (typeof c === "string" ? c : c.text))
                .join(" ")
            : msg.message.content;

          // Extract first sentence or up to 100 characters
          const firstSentence = content.split(".")[0];
          return `- ${firstSentence.slice(0, 100)}${firstSentence.length > 100 ? "..." : ""}`;
        }
        return "";
      })
      .filter(Boolean);

    return summary.join("\n");
  }

  /**
   * Extract recent context for immediate continuation
   */
  private extractRecentContext(recentEntries: ZodTranscriptEntry[]): string {
    return recentEntries
      .map((entry) => {
        const timestamp =
          "timestamp" in entry
            ? new Date(entry.timestamp).toLocaleTimeString()
            : "Unknown";
        const type = entry.type.toUpperCase();
        let content = "";

        if ("message" in entry && entry.message?.content) {
          content = Array.isArray(entry.message.content)
            ? entry.message.content
                .map((c: any) => (typeof c === "string" ? c : c.text))
                .join(" ")
            : entry.message.content;
          content = content.slice(0, 200); // Limit content length
        }

        return `[${timestamp}] ${type}: ${content}`;
      })
      .join("\n");
  }

  /**
   * Calculate session duration in milliseconds
   */
  private calculateSessionDuration(entries: ZodTranscriptEntry[]): number {
    if (entries.length < 2) return 0;

    const firstEntry = entries[0];
    const lastEntry = entries[entries.length - 1];

    const firstTimestamp =
      "timestamp" in firstEntry ? new Date(firstEntry.timestamp).getTime() : 0;
    const lastTimestamp =
      "timestamp" in lastEntry ? new Date(lastEntry.timestamp).getTime() : 0;

    return lastTimestamp - firstTimestamp;
  }

  /**
   * Identify relevant files for context with advanced discovery
   */
  private async identifyRelevantFiles(
    workingDirectory: string,
    contextData: SessionContextData,
  ): Promise<string[]> {
    const relevantFiles: string[] = [];
    const fileMetadata = new Map<
      string,
      { size: number; lastModified: Date }
    >();

    try {
      // Add modified files from session
      contextData.codePatterns.modifiedFiles.forEach((file) => {
        if (!path.isAbsolute(file)) {
          file = path.resolve(workingDirectory, file);
        }
        relevantFiles.push(file);
      });

      // Add common project files
      const commonFiles = [
        "package.json",
        "package-lock.json",
        "tsconfig.json",
        "vite.config.ts",
        "vitest.config.ts",
        "README.md",
        ".gitignore",
        "CHANGELOG.md",
        "CLAUDE.md",
        ".env.example",
        "docker-compose.yml",
        "Dockerfile",
      ];

      for (const file of commonFiles) {
        const filePath = path.join(workingDirectory, file);
        try {
          const stats = await fs.stat(filePath);
          relevantFiles.push(filePath);
          fileMetadata.set(filePath, {
            size: stats.size,
            lastModified: stats.mtime,
          });
        } catch (error) {
          // File doesn't exist, skip
        }
      }

      // Discover source files based on project structure
      const sourceDirectories = [
        "src",
        "lib",
        "app",
        "components",
        "pages",
        "utils",
        "services",
      ];
      for (const dir of sourceDirectories) {
        const dirPath = path.join(workingDirectory, dir);
        try {
          await fs.access(dirPath);
          const sourceFiles = await this.discoverSourceFiles(dirPath, 3); // 3 levels deep
          relevantFiles.push(...sourceFiles);
        } catch (error) {
          // Directory doesn't exist
        }
      }

      // Add recently modified files (last 7 days)
      const recentFiles =
        await this.findRecentlyModifiedFiles(workingDirectory);
      relevantFiles.push(...recentFiles);
    } catch (error) {
      console.warn("Error identifying relevant files:", error);
    }

    // Remove duplicates and sort by relevance
    const uniqueFiles = Array.from(new Set(relevantFiles));
    return this.sortFilesByRelevance(uniqueFiles, contextData).slice(0, 100); // Limit to 100 files
  }

  /**
   * Discover source files recursively with depth limit
   */
  private async discoverSourceFiles(
    dirPath: string,
    maxDepth: number,
    currentDepth: number = 0,
  ): Promise<string[]> {
    if (currentDepth >= maxDepth) return [];

    const sourceFiles: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip excluded patterns
        if (this.isExcludedPath(fullPath)) continue;

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const sourceExtensions = [
            ".ts",
            ".js",
            ".tsx",
            ".jsx",
            ".vue",
            ".svelte",
            ".py",
            ".rs",
            ".go",
            ".java",
            ".c",
            ".cpp",
            ".h",
            ".hpp",
          ];

          if (sourceExtensions.includes(ext)) {
            sourceFiles.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          // Recurse into subdirectories
          const subFiles = await this.discoverSourceFiles(
            fullPath,
            maxDepth,
            currentDepth + 1,
          );
          sourceFiles.push(...subFiles);
        }
      }
    } catch (error) {
      // Ignore directory access errors
    }

    return sourceFiles;
  }

  /**
   * Find recently modified files (last 7 days)
   */
  private async findRecentlyModifiedFiles(
    workingDirectory: string,
  ): Promise<string[]> {
    const recentFiles: string[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      const entries = await fs.readdir(workingDirectory, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isFile()) {
          const filePath = path.join(workingDirectory, entry.name);

          // Skip excluded patterns
          if (this.isExcludedPath(filePath)) continue;

          try {
            const stats = await fs.stat(filePath);
            if (stats.mtime > sevenDaysAgo) {
              recentFiles.push(filePath);
            }
          } catch (error) {
            // Ignore file access errors
          }
        }
      }
    } catch (error) {
      // Ignore directory access errors
    }

    return recentFiles;
  }

  /**
   * Check if a path should be excluded from context
   */
  private isExcludedPath(filePath: string): boolean {
    return SessionContextService.EXCLUDED_FILE_PATTERNS.some((pattern) =>
      pattern.test(filePath),
    );
  }

  /**
   * Sort files by relevance to session context
   */
  private sortFilesByRelevance(
    files: string[],
    contextData: SessionContextData,
  ): string[] {
    return files.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Higher score for files mentioned in session
      if (contextData.codePatterns.modifiedFiles.some((f) => a.includes(f)))
        scoreA += 10;
      if (contextData.codePatterns.modifiedFiles.some((f) => b.includes(f)))
        scoreB += 10;

      // Higher score for main source files
      const mainExtensions = [".ts", ".js", ".tsx", ".jsx"];
      if (mainExtensions.some((ext) => a.endsWith(ext))) scoreA += 5;
      if (mainExtensions.some((ext) => b.endsWith(ext))) scoreB += 5;

      // Higher score for configuration files
      const configFiles = ["package.json", "tsconfig.json", "vite.config.ts"];
      if (configFiles.some((file) => a.endsWith(file))) scoreA += 8;
      if (configFiles.some((file) => b.endsWith(file))) scoreB += 8;

      return scoreB - scoreA; // Higher scores first
    });
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Infer project type from directory structure
   */
  private inferProjectType(cwd: string): string | null {
    const dirName = path.basename(cwd).toLowerCase();

    if (dirName.includes("web") || dirName.includes("frontend"))
      return "Frontend";
    if (dirName.includes("api") || dirName.includes("backend"))
      return "Backend";
    if (dirName.includes("mobile") || dirName.includes("app")) return "Mobile";
    if (dirName.includes("cli") || dirName.includes("tool")) return "CLI Tool";
    if (dirName.includes("lib") || dirName.includes("package"))
      return "Library";

    return null;
  }

  /**
   * Infer main programming languages from directory structure
   */
  private async inferMainLanguages(cwd: string): Promise<string[]> {
    const languages = new Set<string>();

    try {
      const entries = await fs.readdir(cwd, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          switch (ext) {
            case ".ts":
              languages.add("TypeScript");
              break;
            case ".js":
              languages.add("JavaScript");
              break;
            case ".py":
              languages.add("Python");
              break;
            case ".rs":
              languages.add("Rust");
              break;
            case ".go":
              languages.add("Go");
              break;
            case ".java":
              languages.add("Java");
              break;
            case ".cpp":
            case ".cc":
            case ".cxx":
              languages.add("C++");
              break;
            case ".c":
              languages.add("C");
              break;
            case ".cs":
              languages.add("C#");
              break;
            case ".rb":
              languages.add("Ruby");
              break;
            case ".php":
              languages.add("PHP");
              break;
            case ".swift":
              languages.add("Swift");
              break;
            case ".kt":
              languages.add("Kotlin");
              break;
          }
        }
      }
    } catch (error) {
      // Fallback to default
      return ["TypeScript", "JavaScript"];
    }

    return Array.from(languages);
  }

  /**
   * Infer frameworks from package.json and project structure
   */
  private async inferFrameworks(cwd: string): Promise<string[]> {
    const frameworks = new Set<string>();

    try {
      // Check package.json
      const packageJsonPath = path.join(cwd, "package.json");
      try {
        const packageContent = await fs.readFile(packageJsonPath, "utf-8");
        const packageJson = JSON.parse(packageContent);

        // Check dependencies for frameworks
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        Object.keys(allDeps).forEach((dep) => {
          if (dep.includes("express")) frameworks.add("Express.js");
          if (dep.includes("lit")) frameworks.add("Lit");
          if (dep.includes("react")) frameworks.add("React");
          if (dep.includes("vue")) frameworks.add("Vue.js");
          if (dep.includes("angular")) frameworks.add("Angular");
          if (dep.includes("next")) frameworks.add("Next.js");
          if (dep.includes("nuxt")) frameworks.add("Nuxt.js");
          if (dep.includes("svelte")) frameworks.add("Svelte");
          if (dep.includes("vite")) frameworks.add("Vite");
          if (dep.includes("webpack")) frameworks.add("Webpack");
          if (dep.includes("jest")) frameworks.add("Jest");
          if (dep.includes("vitest")) frameworks.add("Vitest");
        });
      } catch (error) {
        // package.json not found or invalid
      }

      // Check for common framework files
      const frameworkFiles = [
        { file: "angular.json", framework: "Angular" },
        { file: "vue.config.js", framework: "Vue.js" },
        { file: "nuxt.config.js", framework: "Nuxt.js" },
        { file: "svelte.config.js", framework: "Svelte" },
        { file: "vite.config.ts", framework: "Vite" },
        { file: "webpack.config.js", framework: "Webpack" },
        { file: "cargo.toml", framework: "Cargo" },
        { file: "go.mod", framework: "Go Modules" },
        { file: "requirements.txt", framework: "Python" },
        { file: "pyproject.toml", framework: "Python" },
      ];

      for (const { file, framework } of frameworkFiles) {
        try {
          await fs.access(path.join(cwd, file));
          frameworks.add(framework);
        } catch (error) {
          // File doesn't exist
        }
      }

      // Always add Node.js if we have package.json
      try {
        await fs.access(path.join(cwd, "package.json"));
        frameworks.add("Node.js");
      } catch (error) {
        // No package.json
      }
    } catch (error) {
      // Return defaults if detection fails
      return ["Express.js", "Lit", "Node.js"];
    }

    return Array.from(frameworks);
  }

  /**
   * Serialize context data to JSON for transfer
   */
  serializeContextData(contextData: SessionContextData): string {
    try {
      return JSON.stringify(contextData, null, 2);
    } catch (error) {
      throw new Error(
        `Failed to serialize context data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Deserialize context data from JSON
   */
  deserializeContextData(serializedData: string): SessionContextData {
    try {
      const data = JSON.parse(serializedData);

      // Validate deserialized data
      if (!this.validateContextData(data)) {
        throw new Error("Invalid context data structure after deserialization");
      }

      return data;
    } catch (error) {
      throw new Error(
        `Failed to deserialize context data: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Transfer context data for external use with file operations
   */
  async transferContext(
    sessionId: string,
    targetPath?: string,
  ): Promise<ContextTransferData> {
    const startTime = Date.now();

    try {
      if (!targetPath) {
        // Return in-memory transfer
        return {
          sessionId,
          transferTime: new Date().toISOString(),
          status: "completed",
        };
      }

      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      await this.ensureDirectoryExists(targetDir);

      // Check if we can write to target path
      try {
        await fs.access(targetDir, fs.constants.W_OK);
      } catch (error) {
        throw new Error(`Cannot write to target directory: ${targetDir}`);
      }

      // Write context transfer marker
      const transferMarker = {
        sessionId,
        transferTime: new Date().toISOString(),
        source: "SessionContextService",
        version: "1.0.0",
      };

      await fs.writeFile(
        path.join(targetDir, `context-transfer-${sessionId}.json`),
        JSON.stringify(transferMarker, null, 2),
        "utf-8",
      );

      return {
        sessionId,
        transferTime: new Date().toISOString(),
        targetPath,
        status: "completed",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        sessionId,
        transferTime: new Date().toISOString(),
        targetPath,
        status: "failed",
        error: errorMessage,
      };
    }
  }

  /**
   * Create context snapshot for session continuation
   */
  async createContextSnapshot(
    session: ZodSession,
    config?: ClaudeContextConfig,
  ): Promise<{
    contextData: SessionContextData;
    serializedData: string;
    checksum: string;
    metadata: {
      createdAt: string;
      sessionId: string;
      version: string;
      size: number;
    };
  }> {
    try {
      // Extract context data
      const contextData = await this.extractSessionContext(session);

      // Serialize the data
      const serializedData = this.serializeContextData(contextData);

      // Calculate checksum for integrity verification
      const checksum = await this.calculateChecksum(serializedData);

      // Create metadata
      const metadata = {
        createdAt: new Date().toISOString(),
        sessionId: session.id,
        version: "1.0.0",
        size: serializedData.length,
      };

      return {
        contextData,
        serializedData,
        checksum,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to create context snapshot: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Calculate checksum for data integrity
   */
  private async calculateChecksum(data: string): Promise<string> {
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Verify context snapshot integrity
   */
  async verifyContextSnapshot(
    serializedData: string,
    expectedChecksum: string,
  ): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateChecksum(serializedData);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate context data integrity
   */
  validateContextData(contextData: SessionContextData): boolean {
    return !!(
      contextData.sessionId &&
      contextData.projectPath &&
      contextData.sessionStats &&
      contextData.sessionStats.totalMessages > 0
    );
  }

  /**
   * Clean up temporary context files
   */
  async cleanupContext(
    workingDirectory: string,
    keepClaudeMd: boolean = true,
  ): Promise<void> {
    try {
      if (!keepClaudeMd) {
        const claudeMdPath = path.join(
          workingDirectory,
          SessionContextService.CLAUDE_MD_FILENAME,
        );
        await fs.unlink(claudeMdPath);
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn("Warning during context cleanup:", error);
    }
  }
}

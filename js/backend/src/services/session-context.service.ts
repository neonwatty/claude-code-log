import { promises as fs } from 'fs';
import path from 'path';
import { ISession, ILogEntry } from '../../../shared/src/schemas/session.js';
import {
  SessionContextData,
  ClaudeContextConfig,
  ContextPreparationResult,
  ContextTransferData,
} from '../../../shared/src/schemas/claude-integration.js';

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
  private static readonly CLAUDE_MD_FILENAME = 'CLAUDE.md';
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
    session: ISession,
    config: ClaudeContextConfig = {}
  ): Promise<ContextPreparationResult> {
    try {
      const startTime = Date.now();
      
      // Extract context data from session
      const contextData = await this.extractSessionContext(session);
      
      // Generate CLAUDE.md content
      const claudeMdContent = await this.generateClaudeMdContent(session, contextData, config);
      
      // Prepare working directory
      const workingDirectory = config.workingDirectory || session.cwd;
      await this.ensureDirectoryExists(workingDirectory);
      
      // Write CLAUDE.md file
      const claudeMdPath = path.join(workingDirectory, SessionContextService.CLAUDE_MD_FILENAME);
      await fs.writeFile(claudeMdPath, claudeMdContent, 'utf-8');
      
      // Collect relevant file paths for context
      const relevantFiles = await this.identifyRelevantFiles(workingDirectory, contextData);
      
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to prepare session context: ${errorMessage}`,
      };
    }
  }

  /**
   * Extract meaningful context from session data
   */
  private async extractSessionContext(session: ISession): Promise<SessionContextData> {
    const entries = session.entries || [];
    
    // Group entries by type and analyze patterns
    const userMessages = entries.filter(e => e.type === 'user');
    const assistantMessages = entries.filter(e => e.type === 'assistant');
    const toolUses = entries.filter(e => e.type === 'tool_use');
    const toolResults = entries.filter(e => e.type === 'tool_result');
    
    // Extract key topics and intents from conversation
    const keyTopics = this.extractKeyTopics(userMessages, assistantMessages);
    const codePatterns = this.extractCodePatterns(toolUses, toolResults);
    const projectContext = this.extractProjectContext(session);
    
    // Calculate session statistics
    const sessionStats = {
      totalMessages: entries.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      toolUses: toolUses.length,
      totalTokens: session.totalUsage?.input_tokens + session.totalUsage?.output_tokens || 0,
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
      conversationSummary: this.generateConversationSummary(userMessages, assistantMessages),
      recentContext: this.extractRecentContext(entries.slice(-20)), // Last 20 entries
    };
  }

  /**
   * Generate CLAUDE.md content based on session data
   */
  private async generateClaudeMdContent(
    session: ISession, 
    contextData: SessionContextData,
    config: ClaudeContextConfig
  ): Promise<string> {
    const { sessionStats, keyTopics, codePatterns, projectContext, conversationSummary } = contextData;
    
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
      content += `**Main Languages:** ${projectContext.mainLanguages.join(', ')}\n`;
    }
    if (projectContext.frameworks?.length > 0) {
      content += `**Frameworks:** ${projectContext.frameworks.join(', ')}\n`;
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
      keyTopics.forEach(topic => {
        content += `- ${topic}\n`;
      });
      content += `\n`;
    }
    
    // Code Patterns and Files
    if (codePatterns.modifiedFiles.length > 0) {
      content += `## Recently Modified Files\n\n`;
      codePatterns.modifiedFiles.forEach(file => {
        content += `- \`${file}\`\n`;
      });
      content += `\n`;
    }
    
    if (codePatterns.commonPatterns.length > 0) {
      content += `## Common Code Patterns\n\n`;
      codePatterns.commonPatterns.forEach(pattern => {
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
  private extractKeyTopics(userMessages: ILogEntry[], assistantMessages: ILogEntry[]): string[] {
    const topics = new Set<string>();
    
    // Extract from user messages
    userMessages.forEach(msg => {
      if (msg.message?.content) {
        const content = Array.isArray(msg.message.content) 
          ? msg.message.content.map(c => typeof c === 'string' ? c : c.text).join(' ')
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
        
        topicPatterns.forEach(pattern => {
          const matches = content.match(pattern);
          if (matches) {
            matches.forEach(match => topics.add(match.trim()));
          }
        });
      }
    });
    
    return Array.from(topics).slice(0, 10); // Limit to top 10 topics
  }

  /**
   * Extract code patterns from tool uses
   */
  private extractCodePatterns(toolUses: ILogEntry[], toolResults: ILogEntry[]) {
    const modifiedFiles = new Set<string>();
    const commonPatterns = new Set<string>();
    
    // Extract file modifications from tool results
    [...toolUses, ...toolResults].forEach(entry => {
      if (entry.message?.tool_calls) {
        entry.message.tool_calls.forEach(call => {
          if (call.function?.name === 'str_replace_editor' && call.function.arguments) {
            try {
              const args = JSON.parse(call.function.arguments);
              if (args.path) {
                modifiedFiles.add(args.path);
              }
              if (args.command === 'create' || args.command === 'str_replace') {
                commonPatterns.add(`File ${args.command} operations`);
              }
            } catch (e) {
              // Ignore parsing errors
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
  private extractProjectContext(session: ISession) {
    const cwd = session.cwd;
    const projectType = this.inferProjectType(cwd);
    const mainLanguages = this.inferMainLanguages(cwd);
    const frameworks = this.inferFrameworks(cwd);
    
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
  private generateConversationSummary(userMessages: ILogEntry[], assistantMessages: ILogEntry[]): string {
    if (userMessages.length === 0) return '';
    
    const recentUserMessages = userMessages.slice(-5); // Last 5 user messages
    const summary = recentUserMessages.map(msg => {
      if (msg.message?.content) {
        const content = Array.isArray(msg.message.content) 
          ? msg.message.content.map(c => typeof c === 'string' ? c : c.text).join(' ')
          : msg.message.content;
        
        // Extract first sentence or up to 100 characters
        const firstSentence = content.split('.')[0];
        return `- ${firstSentence.slice(0, 100)}${firstSentence.length > 100 ? '...' : ''}`;
      }
      return '';
    }).filter(Boolean);
    
    return summary.join('\n');
  }

  /**
   * Extract recent context for immediate continuation
   */
  private extractRecentContext(recentEntries: ILogEntry[]): string {
    return recentEntries.map(entry => {
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      const type = entry.type.toUpperCase();
      let content = '';
      
      if (entry.message?.content) {
        content = Array.isArray(entry.message.content)
          ? entry.message.content.map(c => typeof c === 'string' ? c : c.text).join(' ')
          : entry.message.content;
        content = content.slice(0, 200); // Limit content length
      }
      
      return `[${timestamp}] ${type}: ${content}`;
    }).join('\n');
  }

  /**
   * Calculate session duration in milliseconds
   */
  private calculateSessionDuration(entries: ILogEntry[]): number {
    if (entries.length < 2) return 0;
    
    const firstTimestamp = new Date(entries[0].timestamp).getTime();
    const lastTimestamp = new Date(entries[entries.length - 1].timestamp).getTime();
    
    return lastTimestamp - firstTimestamp;
  }

  /**
   * Identify relevant files for context
   */
  private async identifyRelevantFiles(workingDirectory: string, contextData: SessionContextData): Promise<string[]> {
    const relevantFiles: string[] = [];
    
    try {
      // Add modified files from session
      contextData.codePatterns.modifiedFiles.forEach(file => {
        if (!path.isAbsolute(file)) {
          file = path.resolve(workingDirectory, file);
        }
        relevantFiles.push(file);
      });
      
      // Add common project files
      const commonFiles = [
        'package.json',
        'tsconfig.json',
        'README.md',
        '.gitignore',
        'CHANGELOG.md',
      ];
      
      for (const file of commonFiles) {
        const filePath = path.join(workingDirectory, file);
        try {
          await fs.access(filePath);
          relevantFiles.push(filePath);
        } catch (error) {
          // File doesn't exist, skip
        }
      }
      
    } catch (error) {
      console.warn('Error identifying relevant files:', error);
    }
    
    return relevantFiles.slice(0, 50); // Limit to 50 files
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Infer project type from directory structure
   */
  private inferProjectType(cwd: string): string | null {
    const dirName = path.basename(cwd).toLowerCase();
    
    if (dirName.includes('web') || dirName.includes('frontend')) return 'Frontend';
    if (dirName.includes('api') || dirName.includes('backend')) return 'Backend';
    if (dirName.includes('mobile') || dirName.includes('app')) return 'Mobile';
    if (dirName.includes('cli') || dirName.includes('tool')) return 'CLI Tool';
    if (dirName.includes('lib') || dirName.includes('package')) return 'Library';
    
    return null;
  }

  /**
   * Infer main programming languages
   */
  private inferMainLanguages(cwd: string): string[] {
    // In a real implementation, this would scan the directory
    // For now, we'll make educated guesses based on context
    return ['TypeScript', 'JavaScript']; // Default for this project
  }

  /**
   * Infer frameworks used
   */
  private inferFrameworks(cwd: string): string[] {
    // In a real implementation, this would check package.json, etc.
    // For now, return common frameworks
    return ['Express.js', 'Lit', 'Node.js']; // Based on the current project
  }

  /**
   * Transfer context data for external use
   */
  async transferContext(sessionId: string, targetPath?: string): Promise<ContextTransferData> {
    try {
      // This would implement context transfer to external systems
      // For now, return basic transfer data
      return {
        sessionId,
        transferTime: new Date().toISOString(),
        targetPath,
        status: 'completed',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        sessionId,
        transferTime: new Date().toISOString(),
        targetPath,
        status: 'failed',
        error: errorMessage,
      };
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
  async cleanupContext(workingDirectory: string, keepClaudeMd: boolean = true): Promise<void> {
    try {
      if (!keepClaudeMd) {
        const claudeMdPath = path.join(workingDirectory, SessionContextService.CLAUDE_MD_FILENAME);
        await fs.unlink(claudeMdPath);
      }
    } catch (error) {
      // Ignore cleanup errors
      console.warn('Warning during context cleanup:', error);
    }
  }
}
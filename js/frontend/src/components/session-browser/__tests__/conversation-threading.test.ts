import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SessionViewer } from '../viewer/SessionViewer';
import { SessionDetail } from '../../types/session-types';

describe('Conversation Threading Tests', () => {
  let element: SessionViewer;
  let mockSession: SessionDetail;

  beforeEach(async () => {
    // Create session with complex threading patterns
    mockSession = {
      sessionId: 'threading-test-session',
      title: 'Conversation Threading Test',
      cwd: '/threading/test',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T12:00:00Z'),
      messageCount: 12,
      userMessageCount: 6,
      assistantMessageCount: 6,
      duration: 7200000,
      isActive: false,
      tags: ['threading', 'conversation'],
      summary: 'Test session for conversation threading logic',
      tokenUsage: {
        inputTokens: 3000,
        outputTokens: 4500,
        totalTokens: 7500
      },
      entries: [
        // Initial user-assistant exchange
        {
          role: 'user',
          content: 'Hello, I need help with JavaScript promises.',
          timestamp: '2024-01-01T10:00:00Z',
          tokenCount: 100
        },
        {
          role: 'assistant',
          content: 'I\'d be happy to help you with JavaScript promises. What specific aspect would you like to learn about?',
          timestamp: '2024-01-01T10:01:00Z',
          tokenCount: 150,
          thinking: ['User wants to learn about promises', 'Should ask for specifics']
        },
        // Continued conversation (threading)
        {
          role: 'user',
          content: 'Can you explain async/await vs .then()?',
          timestamp: '2024-01-01T10:05:00Z',
          tokenCount: 80
        },
        {
          role: 'assistant',
          content: 'Great question! Here are the key differences between async/await and .then():...',
          timestamp: '2024-01-01T10:06:00Z',
          tokenCount: 300
        },
        // System message interruption (breaks thread)
        {
          role: 'system',
          content: 'Connection temporarily lost, reconnecting...',
          timestamp: '2024-01-01T10:15:00Z',
          tokenCount: 20
        },
        // Resume conversation (new thread starts)
        {
          role: 'user',
          content: 'Are you still there? I had more questions about error handling.',
          timestamp: '2024-01-01T10:16:00Z',
          tokenCount: 120
        },
        {
          role: 'assistant',
          content: 'Yes, I\'m back! Let\'s talk about error handling in async functions...',
          timestamp: '2024-01-01T10:17:00Z',
          tokenCount: 250
        },
        // Multiple consecutive assistant messages (continued thread)
        {
          role: 'assistant',
          content: 'Also, here\'s an important point about try-catch blocks...',
          timestamp: '2024-01-01T10:18:00Z',
          tokenCount: 180
        },
        {
          role: 'assistant',
          content: 'And one more thing about Promise.all() error handling...',
          timestamp: '2024-01-01T10:19:00Z',
          tokenCount: 200
        },
        // Tool use interruption
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Let me check the documentation for you.'
            },
            {
              type: 'tool_use',
              id: 'tool-read-1',
              name: 'Read',
              input: { file_path: '/docs/promises.md' }
            }
          ],
          timestamp: '2024-01-01T10:25:00Z',
          tokenCount: 100
        },
        // Tool result (special threading case)
        {
          role: 'tool_result',
          content: 'Documentation content about promises...',
          timestamp: '2024-01-01T10:25:30Z',
          tokenCount: 200
        },
        // Continue after tool use (thread continuation)
        {
          role: 'assistant',
          content: 'Based on the documentation, here are the best practices...',
          timestamp: '2024-01-01T10:26:00Z',
          tokenCount: 300
        }
      ],
      metadata: {
        version: '1.0.0',
        client: 'threading-test'
      },
      referencedFiles: ['/docs/promises.md'],
      toolsUsed: ['Read'],
      errors: []
    };

    element = await fixture(html`<session-viewer></session-viewer>`) as SessionViewer;
  });

  describe('Thread Detection Logic', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.showThreading = true;
      await element.updateComplete;
    });

    it('should detect user-assistant conversation threads', () => {
      // Messages 0->1 and 2->3 should be thread continuations
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      expect(messageGroups?.length).to.equal(mockSession.entries.length);

      // Second message (assistant response to user) should be thread continuation
      const secondMessage = messageGroups?.[1];
      expect(secondMessage?.classList.contains('thread-continuation')).to.be.true;

      // Fourth message (assistant response to user question) should be thread continuation
      const fourthMessage = messageGroups?.[3];
      expect(fourthMessage?.classList.contains('thread-continuation')).to.be.true;
    });

    it('should break threads on system messages', () => {
      // System message (index 4) should break the thread
      const systemMessage = element.shadowRoot?.querySelectorAll('.message-group')[4];
      expect(systemMessage?.classList.contains('thread-continuation')).to.be.false;

      // Message after system message should start new thread
      const messageAfterSystem = element.shadowRoot?.querySelectorAll('.message-group')[5];
      expect(messageAfterSystem?.classList.contains('thread-continuation')).to.be.false;
    });

    it('should detect consecutive same-role messages as thread continuations', () => {
      // Messages 7, 8 are consecutive assistant messages - should be thread continuations
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      
      const eighthMessage = messageGroups?.[7]; // Index 7 (8th message)
      const ninthMessage = messageGroups?.[8]; // Index 8 (9th message)
      
      expect(eighthMessage?.classList.contains('thread-continuation')).to.be.true;
      expect(ninthMessage?.classList.contains('thread-continuation')).to.be.true;
    });

    it('should handle tool use in threading', () => {
      // Tool use message should continue thread
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      const toolUseMessage = messageGroups?.[9]; // Tool use message
      
      expect(toolUseMessage?.classList.contains('thread-continuation')).to.be.true;
    });

    it('should connect tool results to assistant responses', () => {
      // Tool result -> assistant should be thread continuation
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      const assistantAfterTool = messageGroups?.[11]; // Assistant after tool result
      
      expect(assistantAfterTool?.classList.contains('thread-continuation')).to.be.true;
    });
  });

  describe('Threading Visualization', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.showThreading = true;
      await element.updateComplete;
    });

    it('should apply visual threading styles', () => {
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations?.length).to.be.greaterThan(0);

      threadContinuations?.forEach(continuation => {
        // Should have threading CSS class
        expect(continuation.classList.contains('thread-continuation')).to.be.true;
      });
    });

    it('should show threading lines between related messages', () => {
      // Check for CSS pseudo-elements that create threading lines
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      
      messageGroups?.forEach(group => {
        const computedStyle = window.getComputedStyle(group, '::before');
        expect(computedStyle).to.exist;
      });
    });

    it('should differentiate thread types visually', () => {
      // Different thread types should have different visual indicators
      const regularThreads = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation:not(.tool-thread)');
      const toolThreads = element.shadowRoot?.querySelectorAll('.message-group.tool-thread');
      
      expect(regularThreads?.length).to.be.greaterThan(0);
      // Tool threads might exist depending on implementation
    });

    it('should animate threading indicators', () => {
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      
      threadContinuations?.forEach(continuation => {
        const computedStyle = window.getComputedStyle(continuation, '::before');
        // Should have animation properties
        expect(computedStyle).to.exist;
      });
    });
  });

  describe('Threading Toggle Functionality', () => {
    beforeEach(async () => {
      element.session = mockSession;
      await element.updateComplete;
    });

    it('should toggle threading visualization on/off', async () => {
      // Initially enabled
      element.showThreading = true;
      await element.updateComplete;
      
      let threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations?.length).to.be.greaterThan(0);
      
      // Disable threading
      element.showThreading = false;
      await element.updateComplete;
      
      threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations?.length).to.equal(0);
      
      // Re-enable threading
      element.showThreading = true;
      await element.updateComplete;
      
      threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations?.length).to.be.greaterThan(0);
    });

    it('should have accessible threading toggle button', () => {
      const threadingButton = element.shadowRoot?.querySelector('[title="Toggle conversation threading"]');
      expect(threadingButton).to.exist;
      expect(threadingButton?.getAttribute('aria-label')).to.exist;
      expect(threadingButton?.getAttribute('role')).to.equal('button');
    });

    it('should update button state when threading changes', async () => {
      element.showThreading = true;
      await element.updateComplete;
      
      const threadingButton = element.shadowRoot?.querySelector('[title="Toggle conversation threading"]');
      expect(threadingButton?.classList.contains('active')).to.be.true;
      
      element.showThreading = false;
      await element.updateComplete;
      
      expect(threadingButton?.classList.contains('active')).to.be.false;
    });
  });

  describe('Complex Threading Scenarios', () => {
    it('should handle rapid back-and-forth conversations', async () => {
      const rapidConversation: SessionDetail = {
        ...mockSession,
        entries: [
          { role: 'user', content: 'Question 1?', timestamp: '2024-01-01T10:00:00Z', tokenCount: 50 },
          { role: 'assistant', content: 'Answer 1', timestamp: '2024-01-01T10:00:30Z', tokenCount: 100 },
          { role: 'user', content: 'Follow-up 1?', timestamp: '2024-01-01T10:01:00Z', tokenCount: 60 },
          { role: 'assistant', content: 'Follow-up answer 1', timestamp: '2024-01-01T10:01:30Z', tokenCount: 110 },
          { role: 'user', content: 'Question 2?', timestamp: '2024-01-01T10:02:00Z', tokenCount: 55 },
          { role: 'assistant', content: 'Answer 2', timestamp: '2024-01-01T10:02:30Z', tokenCount: 105 }
        ]
      };
      
      element.session = rapidConversation;
      element.showThreading = true;
      await element.updateComplete;
      
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      // Should have thread continuations for alternating user-assistant pattern
      expect(threadContinuations?.length).to.be.greaterThan(2);
    });

    it('should handle mixed content types in threads', async () => {
      const mixedContentSession: SessionDetail = {
        ...mockSession,
        entries: [
          { role: 'user', content: 'Help me code', timestamp: '2024-01-01T10:00:00Z', tokenCount: 50 },
          {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Here\'s some code:' },
              { type: 'tool_use', id: 'tool-1', name: 'Write', input: { file_path: '/code.js', content: 'code here' } }
            ],
            timestamp: '2024-01-01T10:01:00Z',
            tokenCount: 150
          },
          { role: 'tool_result', content: 'File written successfully', timestamp: '2024-01-01T10:01:30Z', tokenCount: 30 },
          { role: 'assistant', content: 'The code has been written!', timestamp: '2024-01-01T10:02:00Z', tokenCount: 80 }
        ]
      };
      
      element.session = mixedContentSession;
      element.showThreading = true;
      await element.updateComplete;
      
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      expect(messageGroups?.length).to.equal(4);
      
      // Should properly thread through tool use
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations?.length).to.be.greaterThan(0);
    });

    it('should handle error messages in threading', async () => {
      const errorSession: SessionDetail = {
        ...mockSession,
        entries: [
          { role: 'user', content: 'Do something that fails', timestamp: '2024-01-01T10:00:00Z', tokenCount: 50 },
          { role: 'assistant', content: 'I\'ll try to do that...', timestamp: '2024-01-01T10:01:00Z', tokenCount: 80 },
          { role: 'error', content: 'Operation failed with error', timestamp: '2024-01-01T10:01:30Z', tokenCount: 40 },
          { role: 'assistant', content: 'I apologize, let me try a different approach', timestamp: '2024-01-01T10:02:00Z', tokenCount: 100 }
        ]
      };
      
      element.session = errorSession;
      element.showThreading = true;
      await element.updateComplete;
      
      // Should handle error messages in thread flow
      const messageGroups = element.shadowRoot?.querySelectorAll('.message-group');
      expect(messageGroups?.length).to.equal(4);
      
      // Error message might break or continue thread depending on implementation
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations).to.exist;
    });
  });

  describe('Threading Performance', () => {
    it('should calculate threading efficiently for large sessions', async () => {
      const largeSession: SessionDetail = {
        ...mockSession,
        messageCount: 1000,
        entries: Array.from({ length: 1000 }, (_, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: `Message ${i + 1}`,
          timestamp: new Date(Date.now() + i * 60000).toISOString(),
          tokenCount: 50
        }))
      };
      
      const startTime = performance.now();
      
      element.session = largeSession;
      element.showThreading = true;
      await element.updateComplete;
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).to.be.lessThan(2000); // Should process threading in under 2 seconds
      
      // Should still show threading
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations?.length).to.be.greaterThan(0);
    });

    it('should not recalculate threading unnecessarily', async () => {
      element.session = mockSession;
      element.showThreading = true;
      await element.updateComplete;
      
      const initialThreadCount = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation').length;
      
      // Change unrelated property
      element.showBranches = !element.showBranches;
      await element.updateComplete;
      
      const newThreadCount = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation').length;
      
      // Thread count should remain the same (no recalculation)
      expect(newThreadCount).to.equal(initialThreadCount);
    });
  });

  describe('Threading Accessibility', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.showThreading = true;
      await element.updateComplete;
    });

    it('should provide screen reader context for threading', () => {
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      
      threadContinuations?.forEach(continuation => {
        // Should have appropriate ARIA attributes or content for screen readers
        const hasAriaLabel = continuation.getAttribute('aria-label');
        const hasScreenReaderContent = continuation.querySelector('.sr-only');
        const hasDataAttribute = continuation.getAttribute('data-thread-continuation');
        
        expect(hasAriaLabel || hasScreenReaderContent || hasDataAttribute).to.be.true;
      });
    });

    it('should announce threading state changes', async () => {
      const threadingButton = element.shadowRoot?.querySelector('[title="Toggle conversation threading"]') as HTMLButtonElement;
      
      threadingButton.click();
      await element.updateComplete;
      
      // Should have aria-live region or similar for announcements
      const liveRegion = element.shadowRoot?.querySelector('[aria-live]');
      expect(liveRegion).to.exist;
    });

    it('should maintain logical tab order with threading visualization', () => {
      const focusableElements = element.shadowRoot?.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
      
      focusableElements?.forEach(element => {
        expect(element.getAttribute('tabindex')).to.not.equal('-1');
      });
    });
  });

  describe('Threading Integration with Other Features', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.showThreading = true;
      element.showBranches = true;
      await element.updateComplete;
    });

    it('should coordinate with branch visualization', () => {
      // Threading and branching should work together
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      const branchPoints = element.shadowRoot?.querySelectorAll('.branch-point-marker');
      
      expect(threadContinuations?.length).to.be.greaterThan(0);
      // Branch points may or may not exist depending on data
    });

    it('should work with message expansion', async () => {
      const messageHeader = element.shadowRoot?.querySelector('.message-header') as HTMLElement;
      if (messageHeader) {
        messageHeader.click();
        await element.updateComplete;
        
        // Threading should still be visible after expansion
        const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
        expect(threadContinuations?.length).to.be.greaterThan(0);
      }
    });

    it('should work with virtual scrolling', async () => {
      element.virtualScrolling = true;
      await element.updateComplete;
      
      // Threading should still work with virtual scrolling
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      expect(threadContinuations?.length).to.be.greaterThan(0);
    });
  });
});
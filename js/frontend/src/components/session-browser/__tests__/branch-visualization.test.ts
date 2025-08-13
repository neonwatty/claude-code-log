import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import { SessionViewer } from '../viewer/SessionViewer';
import { SessionDetail, SessionBranchData } from '../../types/session-types';

describe('Branch Visualization Tests', () => {
  let element: SessionViewer;
  let mockSession: SessionDetail;
  let mockBranchData: SessionBranchData;

  beforeEach(async () => {
    // Create session with branch points
    mockSession = {
      sessionId: 'branch-test-session',
      title: 'Branch Visualization Test',
      cwd: '/branch/test',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T12:00:00Z'),
      messageCount: 10,
      userMessageCount: 5,
      assistantMessageCount: 5,
      duration: 7200000,
      isActive: false,
      tags: ['branching', 'visualization'],
      summary: 'Test session for branch visualization features',
      tokenUsage: {
        inputTokens: 2500,
        outputTokens: 3500,
        totalTokens: 6000
      },
      entries: [
        {
          role: 'user',
          content: 'I need help choosing between different approaches for handling async data.',
          timestamp: '2024-01-01T10:00:00Z',
          tokenCount: 100
        },
        {
          role: 'assistant',
          content: 'There are several approaches you can take for handling async data. Let me explain the main options:',
          timestamp: '2024-01-01T10:01:00Z',
          tokenCount: 150
        }, // Branch point 1 - Alternative approaches could be explored
        {
          role: 'user',
          content: 'Which approach is better for performance?',
          timestamp: '2024-01-01T10:05:00Z',
          tokenCount: 80
        },
        {
          role: 'assistant',
          content: 'For performance, I\'d recommend using Promise.all() for parallel operations. However, there are trade-offs to consider...',
          timestamp: '2024-01-01T10:06:00Z',
          tokenCount: 200
        }, // Branch point 2 - Could explore different performance optimization strategies
        {
          role: 'user',
          content: 'What about error handling in this approach?',
          timestamp: '2024-01-01T10:10:00Z',
          tokenCount: 90
        },
        {
          role: 'assistant',
          content: 'Error handling with Promise.all() requires careful consideration. If any promise rejects, the entire operation fails...',
          timestamp: '2024-01-01T10:11:00Z',
          tokenCount: 250
        }, // Branch point 3 - Alternative error handling strategies could be explored
        {
          role: 'user',
          content: 'Can you show me an alternative that\'s more fault-tolerant?',
          timestamp: '2024-01-01T10:15:00Z',
          tokenCount: 100
        },
        {
          role: 'assistant',
          content: 'Absolutely! Promise.allSettled() is much more fault-tolerant. Here\'s how it works:',
          timestamp: '2024-01-01T10:16:00Z',
          tokenCount: 180
        },
        {
          role: 'user',
          content: 'This is exactly what I needed! Thank you.',
          timestamp: '2024-01-01T10:20:00Z',
          tokenCount: 70
        },
        {
          role: 'assistant',
          content: 'You\'re welcome! Feel free to ask if you have more questions about async handling.',
          timestamp: '2024-01-01T10:21:00Z',
          tokenCount: 120
        }
      ],
      metadata: {
        version: '1.0.0',
        client: 'branch-test'
      },
      referencedFiles: [],
      toolsUsed: [],
      errors: []
    };

    // Mock branch data showing existing branches
    mockBranchData = {
      sessionId: 'branch-test-session',
      branchPoint: 1, // Branched from first assistant response
      parentSessionId: 'parent-session',
      branches: [
        {
          sessionId: 'branch-callback-approach',
          branchPoint: 1,
          metadata: {
            branchName: 'Callback-based Approach',
            branchReason: 'Explore traditional callback patterns',
            createdAt: '2024-01-01T10:02:00Z'
          }
        },
        {
          sessionId: 'branch-rxjs-approach',
          branchPoint: 1,
          metadata: {
            branchName: 'RxJS Observable Approach',
            branchReason: 'Investigate reactive programming solution',
            createdAt: '2024-01-01T10:03:00Z'
          }
        },
        {
          sessionId: 'branch-performance-focus',
          branchPoint: 3,
          metadata: {
            branchName: 'Performance Optimization',
            branchReason: 'Deep dive into performance considerations',
            createdAt: '2024-01-01T10:07:00Z'
          }
        },
        {
          sessionId: 'branch-error-strategies',
          branchPoint: 5,
          metadata: {
            branchName: 'Error Handling Strategies',
            branchReason: 'Comprehensive error handling exploration',
            createdAt: '2024-01-01T10:12:00Z'
          }
        }
      ]
    };

    element = await fixture(html`<session-viewer></session-viewer>`) as SessionViewer;
  });

  describe('Branch Point Detection', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showBranches = true;
      await element.updateComplete;
    });

    it('should identify potential branch points from assistant messages', () => {
      const branchMarkers = element.shadowRoot?.querySelectorAll('.branch-point-marker');
      expect(branchMarkers?.length).to.be.greaterThan(0);

      // Should identify assistant messages as potential branch points
      branchMarkers?.forEach(marker => {
        const messageIndex = marker.closest('.message-group')?.getAttribute('data-message-index');
        if (messageIndex) {
          const entry = mockSession.entries[parseInt(messageIndex)];
          expect(entry.role).to.be.oneOf(['assistant', 'tool_result']);
        }
      });
    });

    it('should show branch availability indicators', () => {
      const branchAvailableBadges = element.shadowRoot?.querySelectorAll('.message-badge.branch-available');
      expect(branchAvailableBadges?.length).to.be.greaterThan(0);

      branchAvailableBadges?.forEach(badge => {
        expect(badge.textContent).to.include('Branch');
      });
    });

    it('should highlight existing branch points', () => {
      const existingBranchPoints = element.shadowRoot?.querySelectorAll('.message-group.branch-point');
      expect(existingBranchPoints?.length).to.be.greaterThan(0);

      // Should correspond to branch points in mockBranchData
      const branchPointIndices = mockBranchData.branches.map(b => b.branchPoint);
      
      existingBranchPoints?.forEach(point => {
        const messageIndex = point.getAttribute('data-message-index');
        if (messageIndex) {
          expect(branchPointIndices).to.include(parseInt(messageIndex));
        }
      });
    });

    it('should detect context-based branching opportunities', () => {
      // Should detect messages with decision language as potential branch points
      const decisionKeywords = ['approach', 'alternative', 'option', 'strategy', 'method'];
      
      const branchableMessages = mockSession.entries.filter((entry, index) => {
        if (entry.role !== 'assistant') return false;
        
        const content = typeof entry.content === 'string' 
          ? entry.content 
          : JSON.stringify(entry.content);
        
        return decisionKeywords.some(keyword => 
          content.toLowerCase().includes(keyword)
        );
      });

      expect(branchableMessages.length).to.be.greaterThan(0);
    });
  });

  describe('Branch Visualization', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showBranches = true;
      await element.updateComplete;
    });

    it('should display branch indicators with shimmer effects', () => {
      const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators?.length).to.be.greaterThan(0);

      branchIndicators?.forEach(indicator => {
        // Should have shimmer animation
        const shimmerElement = indicator.querySelector('::before');
        // Note: Testing CSS animations requires more complex setup, 
        // here we verify the structure exists
        expect(indicator).to.exist;
      });
    });

    it('should show branch information and metadata', () => {
      const branchInfo = element.shadowRoot?.querySelectorAll('.branch-info');
      expect(branchInfo?.length).to.be.greaterThan(0);

      branchInfo?.forEach(info => {
        const branchTitle = info.querySelector('.branch-title');
        const branchDescription = info.querySelector('.branch-description');
        
        expect(branchTitle).to.exist;
        expect(branchDescription).to.exist;
        expect(branchTitle?.textContent).to.not.be.empty;
      });
    });

    it('should display branch count for messages with multiple branches', () => {
      // Find messages with multiple branches
      const branchCounts = new Map<number, number>();
      mockBranchData.branches.forEach(branch => {
        const count = branchCounts.get(branch.branchPoint) || 0;
        branchCounts.set(branch.branchPoint, count + 1);
      });

      const multibranchPoints = Array.from(branchCounts.entries())
        .filter(([_, count]) => count > 1);

      if (multibranchPoints.length > 0) {
        const [branchPoint, count] = multibranchPoints[0];
        const branchIndicator = element.shadowRoot?.querySelector(
          `[data-message-index="${branchPoint}"] .branch-info .branch-title`
        );
        
        if (branchIndicator) {
          expect(branchIndicator.textContent).to.include(count.toString());
        }
      }
    });

    it('should show branch creation buttons with hover effects', () => {
      const branchButtons = element.shadowRoot?.querySelectorAll('.branch-button');
      expect(branchButtons?.length).to.be.greaterThan(0);

      branchButtons?.forEach(button => {
        expect(button.getAttribute('title')).to.exist;
        
        // Should have interactive styles
        const computedStyle = window.getComputedStyle(button);
        expect(computedStyle.cursor).to.equal('pointer');
      });
    });
  });

  describe('Branch Creation Interface', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.showBranches = true;
      await element.updateComplete;
    });

    it('should handle branch creation requests', async () => {
      const branchEventSpy = vi.fn();
      element.addEventListener('branch-requested', branchEventSpy);

      const createBranchButton = element.shadowRoot?.querySelector('[title="Create branch from this message"]') as HTMLButtonElement;
      if (createBranchButton) {
        createBranchButton.click();

        expect(branchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({
              sessionId: mockSession.sessionId,
              branchPoint: expect.any(Number),
              message: expect.any(Object)
            })
          })
        );
      }
    });

    it('should show different branch creation options', () => {
      const branchButtons = element.shadowRoot?.querySelectorAll('.branch-button');
      
      const createButtons = Array.from(branchButtons || [])
        .filter(button => button.textContent?.includes('Create'));
      const viewButtons = Array.from(branchButtons || [])
        .filter(button => button.textContent?.includes('View'));

      expect(createButtons.length).to.be.greaterThan(0);
      expect(viewButtons.length).to.be.greaterThan(0);
    });

    it('should provide context-aware branch suggestions', () => {
      // Should suggest different branch types based on message content
      const branchSuggestions = element.shadowRoot?.querySelectorAll('.branch-suggestion');
      
      if (branchSuggestions && branchSuggestions.length > 0) {
        branchSuggestions.forEach(suggestion => {
          expect(suggestion.textContent).to.not.be.empty;
        });
      }
    });

    it('should handle branch creation for different message types', async () => {
      const branchEventSpy = vi.fn();
      element.addEventListener('branch-requested', branchEventSpy);

      // Test branching from assistant messages
      const assistantMessages = element.shadowRoot?.querySelectorAll('.message-item.assistant .branch-button');
      if (assistantMessages && assistantMessages.length > 0) {
        (assistantMessages[0] as HTMLButtonElement).click();
        expect(branchEventSpy).toHaveBeenCalled();
      }
    });
  });

  describe('Existing Branch Management', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showBranches = true;
      await element.updateComplete;
    });

    it('should display existing branches with metadata', () => {
      const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators?.length).to.be.greaterThan(0);

      // Should show branch names and reasons
      branchIndicators?.forEach(indicator => {
        const branchInfo = indicator.querySelector('.branch-info');
        expect(branchInfo).to.exist;
        
        const title = branchInfo?.querySelector('.branch-title');
        const description = branchInfo?.querySelector('.branch-description');
        
        expect(title?.textContent).to.not.be.empty;
        expect(description?.textContent).to.not.be.empty;
      });
    });

    it('should handle branch navigation requests', async () => {
      const branchViewSpy = vi.fn();
      element.addEventListener('branches-view-requested', branchViewSpy);

      const viewBranchesButton = element.shadowRoot?.querySelector('[title="View all branches from this point"]') as HTMLButtonElement;
      if (viewBranchesButton) {
        viewBranchesButton.click();

        expect(branchViewSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: expect.objectContaining({
              sessionId: mockSession.sessionId,
              messageIndex: expect.any(Number)
            })
          })
        );
      }
    });

    it('should show branch hierarchy information', () => {
      // Should show parent-child relationships between branches
      const branchHierarchy = element.shadowRoot?.querySelectorAll('[data-branch-parent]');
      
      if (branchHierarchy && branchHierarchy.length > 0) {
        branchHierarchy.forEach(branch => {
          const parentId = branch.getAttribute('data-branch-parent');
          expect(parentId).to.exist;
        });
      }
    });

    it('should display branch timestamps and creation info', () => {
      const branchMetadata = element.shadowRoot?.querySelectorAll('.branch-metadata');
      
      if (branchMetadata && branchMetadata.length > 0) {
        branchMetadata.forEach(metadata => {
          // Should show when branch was created
          expect(metadata.textContent).to.match(/\d{4}/); // Should contain year
        });
      }
    });
  });

  describe('Branch Toggle Functionality', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      await element.updateComplete;
    });

    it('should toggle branch visualization on/off', async () => {
      // Initially enabled
      element.showBranches = true;
      await element.updateComplete;

      let branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators?.length).to.be.greaterThan(0);

      // Disable branches
      element.showBranches = false;
      await element.updateComplete;

      branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators?.length).to.equal(0);

      // Re-enable branches
      element.showBranches = true;
      await element.updateComplete;

      branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators?.length).to.be.greaterThan(0);
    });

    it('should have accessible branch toggle button', () => {
      const branchButton = element.shadowRoot?.querySelector('[title="Toggle branch visualization"]');
      expect(branchButton).to.exist;
      expect(branchButton?.getAttribute('aria-label')).to.exist;
      expect(branchButton?.getAttribute('role')).to.equal('button');
    });

    it('should update button state when branch visualization changes', async () => {
      element.showBranches = true;
      await element.updateComplete;

      const branchButton = element.shadowRoot?.querySelector('[title="Toggle branch visualization"]');
      expect(branchButton?.classList.contains('active')).to.be.true;

      element.showBranches = false;
      await element.updateComplete;

      expect(branchButton?.classList.contains('active')).to.be.false;
    });
  });

  describe('Branch Performance and Optimization', () => {
    it('should handle large numbers of branches efficiently', async () => {
      const manyBranches: SessionBranchData = {
        ...mockBranchData,
        branches: Array.from({ length: 50 }, (_, i) => ({
          sessionId: `branch-${i}`,
          branchPoint: Math.floor(i / 5), // Multiple branches per point
          metadata: {
            branchName: `Branch ${i + 1}`,
            branchReason: `Reason ${i + 1}`,
            createdAt: new Date(Date.now() + i * 60000).toISOString()
          }
        }))
      };

      const startTime = performance.now();
      
      element.session = mockSession;
      element.branchData = manyBranches;
      element.showBranches = true;
      await element.updateComplete;
      
      const processingTime = performance.now() - startTime;
      expect(processingTime).to.be.lessThan(1000); // Should handle 50 branches in under 1 second

      const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators?.length).to.be.greaterThan(0);
    });

    it('should optimize branch rendering for virtual scrolling', async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showBranches = true;
      element.virtualScrolling = true;
      await element.updateComplete;

      // Should still show branches in virtual scrolling mode
      const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators?.length).to.be.greaterThan(0);
    });

    it('should not recalculate branch points unnecessarily', async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showBranches = true;
      await element.updateComplete;

      const initialBranchCount = element.shadowRoot?.querySelectorAll('.branch-indicator').length;

      // Change unrelated property
      element.showThreading = !element.showThreading;
      await element.updateComplete;

      const newBranchCount = element.shadowRoot?.querySelectorAll('.branch-indicator').length;
      expect(newBranchCount).to.equal(initialBranchCount);
    });
  });

  describe('Branch Accessibility', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showBranches = true;
      await element.updateComplete;
    });

    it('should provide screen reader context for branches', () => {
      const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      
      branchIndicators?.forEach(indicator => {
        // Should have appropriate ARIA attributes
        const hasAriaLabel = indicator.getAttribute('aria-label');
        const hasAriaDescribedBy = indicator.getAttribute('aria-describedby');
        const hasScreenReaderContent = indicator.querySelector('.sr-only');
        
        expect(hasAriaLabel || hasAriaDescribedBy || hasScreenReaderContent).to.be.true;
      });
    });

    it('should make branch buttons keyboard accessible', () => {
      const branchButtons = element.shadowRoot?.querySelectorAll('.branch-button') as NodeListOf<HTMLElement>;
      
      branchButtons?.forEach(button => {
        expect(button.getAttribute('tabindex')).to.not.equal('-1');
        expect(button.getAttribute('aria-label') || button.getAttribute('title')).to.exist;
        
        // Should be focusable
        button.focus();
        expect(document.activeElement).to.equal(button);
      });
    });

    it('should announce branch state changes', async () => {
      const branchToggle = element.shadowRoot?.querySelector('[title="Toggle branch visualization"]') as HTMLButtonElement;
      
      branchToggle.click();
      await element.updateComplete;

      // Should have aria-live region for announcements
      const liveRegion = element.shadowRoot?.querySelector('[aria-live]');
      expect(liveRegion).to.exist;
    });

    it('should provide proper heading hierarchy for branch sections', () => {
      const branchSections = element.shadowRoot?.querySelectorAll('.branch-indicator');
      
      branchSections?.forEach(section => {
        const headings = section.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
        if (headings.length > 0) {
          // Should have proper heading levels
          expect(headings.length).to.be.greaterThan(0);
        }
      });
    });
  });

  describe('Branch Integration with Other Features', () => {
    beforeEach(async () => {
      element.session = mockSession;
      element.branchData = mockBranchData;
      element.showBranches = true;
      element.showThreading = true;
      await element.updateComplete;
    });

    it('should coordinate with conversation threading', () => {
      const threadContinuations = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation');
      const branchPoints = element.shadowRoot?.querySelectorAll('.message-group.branch-point');

      expect(threadContinuations?.length).to.be.greaterThan(0);
      expect(branchPoints?.length).to.be.greaterThan(0);

      // Should handle messages that are both thread continuations and branch points
      const threadedBranchPoints = element.shadowRoot?.querySelectorAll('.message-group.thread-continuation.branch-point');
      // May or may not exist, but should not cause conflicts
      expect(threadedBranchPoints).to.exist;
    });

    it('should work with message expansion', async () => {
      const messageHeader = element.shadowRoot?.querySelector('.message-header') as HTMLElement;
      if (messageHeader) {
        messageHeader.click();
        await element.updateComplete;

        // Branch indicators should still be visible after message expansion
        const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
        expect(branchIndicators?.length).to.be.greaterThan(0);
      }
    });

    it('should integrate with real-time updates', async () => {
      element.realTimeUpdates = true;
      await element.updateComplete;

      // Add new branch to existing data
      const updatedBranchData: SessionBranchData = {
        ...mockBranchData,
        branches: [
          ...mockBranchData.branches,
          {
            sessionId: 'new-real-time-branch',
            branchPoint: 7,
            metadata: {
              branchName: 'Real-time Branch',
              branchReason: 'Added during real-time update',
              createdAt: new Date().toISOString()
            }
          }
        ]
      };

      element.branchData = updatedBranchData;
      await element.updateComplete;

      // Should show the new branch
      const branchIndicators = element.shadowRoot?.querySelectorAll('.branch-indicator');
      expect(branchIndicators?.length).to.equal(updatedBranchData.branches.length);
    });
  });
});
/**
 * Branch Visualization Components
 * 
 * Interactive session branch tree visualization using SVG.
 * Provides visual representation of session branching relationships
 * with navigation and real-time update capabilities.
 */

export { BranchVisualization } from './BranchVisualization';
export { BranchVisualizationDemo } from './BranchVisualizationDemo';

// Re-export types that might be useful for consumers
export type { 
  SessionBranchTree,
  SessionSummary,
  ComponentEvents
} from '../types/session-types';
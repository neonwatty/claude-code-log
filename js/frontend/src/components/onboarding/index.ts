/**
 * Onboarding components for user guidance and first-time setup
 */

export { WelcomeScreen } from "./welcome-screen.js";
export { QuickStartGuide } from "./quick-start-guide.js";

// Export types for external use
export interface OnboardingEvents {
  "onboarding-complete": void;
  "onboarding-skipped": void;
  "step-action": { stepId: string; action: string };
  "guide-closed": void;
  "guide-reset": void;
}
/**
 * Automated Accessibility Testing Utilities
 * Provides WCAG 2.1 AA compliance checking tools
 */

export interface AccessibilityViolation {
  element: HTMLElement;
  rule: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  helpUrl?: string;
  wcagReference?: string[];
}

export interface AccessibilityTestResult {
  violations: AccessibilityViolation[];
  passes: AccessibilityViolation[];
  inapplicable: AccessibilityViolation[];
  incomplete: AccessibilityViolation[];
}

export interface AccessibilityTestOptions {
  rules?: string[];
  tags?: string[];
  include?: string[];
  exclude?: string[];
  context?: Element | Document;
}

export class AccessibilityTester {
  private static instance: AccessibilityTester | null = null;
  
  private constructor() {}

  public static getInstance(): AccessibilityTester {
    if (!AccessibilityTester.instance) {
      AccessibilityTester.instance = new AccessibilityTester();
    }
    return AccessibilityTester.instance;
  }

  /**
   * Run comprehensive accessibility audit
   */
  public async audit(
    context: Element | Document = document,
    options: AccessibilityTestOptions = {}
  ): Promise<AccessibilityTestResult> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    // Run all built-in checks
    const checks = [
      this.checkColorContrast.bind(this),
      this.checkAriaLabels.bind(this),
      this.checkKeyboardNavigation.bind(this),
      this.checkHeadingStructure.bind(this),
      this.checkFormLabels.bind(this),
      this.checkImageAltText.bind(this),
      this.checkLandmarks.bind(this),
      this.checkFocusable.bind(this),
      this.checkLiveRegions.bind(this),
      this.checkTabindex.bind(this),
    ];

    for (const check of checks) {
      try {
        const results = await check(context, options);
        violations.push(...results.violations);
        passes.push(...results.passes);
      } catch (error) {
        console.warn('Accessibility check failed:', error);
      }
    }

    return {
      violations,
      passes,
      inapplicable: [],
      incomplete: [],
    };
  }

  /**
   * Check color contrast ratios
   */
  private async checkColorContrast(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const textElements = context.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, button, a, label');

    for (const element of textElements) {
      const htmlElement = element as HTMLElement;
      
      if (!this.hasText(htmlElement)) continue;

      const styles = window.getComputedStyle(htmlElement);
      const color = styles.color;
      const backgroundColor = this.getEffectiveBackgroundColor(htmlElement);

      if (color && backgroundColor) {
        const contrast = this.calculateContrastRatio(color, backgroundColor);
        const fontSize = parseInt(styles.fontSize);
        const isLargeText = fontSize >= 18 || (fontSize >= 14 && styles.fontWeight === 'bold');
        const requiredRatio = isLargeText ? 3 : 4.5;

        if (contrast < requiredRatio) {
          violations.push({
            element: htmlElement,
            rule: 'color-contrast',
            impact: 'serious',
            description: `Color contrast ratio ${contrast.toFixed(2)}:1 is below the required ${requiredRatio}:1`,
            wcagReference: ['1.4.3'],
          });
        } else {
          passes.push({
            element: htmlElement,
            rule: 'color-contrast',
            impact: 'minor',
            description: `Color contrast ratio ${contrast.toFixed(2)}:1 meets requirements`,
            wcagReference: ['1.4.3'],
          });
        }
      }
    }

    return { violations, passes };
  }

  /**
   * Check ARIA labels and descriptions
   */
  private async checkAriaLabels(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    // Check elements that require accessible names
    const interactiveElements = context.querySelectorAll(
      'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="textbox"]'
    );

    for (const element of interactiveElements) {
      const htmlElement = element as HTMLElement;
      const accessibleName = this.getAccessibleName(htmlElement);

      if (!accessibleName) {
        violations.push({
          element: htmlElement,
          rule: 'aria-label',
          impact: 'critical',
          description: 'Interactive element lacks accessible name',
          wcagReference: ['4.1.2'],
        });
      } else {
        passes.push({
          element: htmlElement,
          rule: 'aria-label',
          impact: 'minor',
          description: 'Interactive element has accessible name',
          wcagReference: ['4.1.2'],
        });
      }
    }

    return { violations, passes };
  }

  /**
   * Check keyboard navigation
   */
  private async checkKeyboardNavigation(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const interactiveElements = context.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
    );

    for (const element of interactiveElements) {
      const htmlElement = element as HTMLElement;
      
      // Check if element is focusable
      if (!this.isFocusable(htmlElement)) {
        violations.push({
          element: htmlElement,
          rule: 'keyboard-navigation',
          impact: 'serious',
          description: 'Interactive element is not keyboard accessible',
          wcagReference: ['2.1.1'],
        });
      } else {
        passes.push({
          element: htmlElement,
          rule: 'keyboard-navigation',
          impact: 'minor',
          description: 'Interactive element is keyboard accessible',
          wcagReference: ['2.1.1'],
        });
      }
    }

    return { violations, passes };
  }

  /**
   * Check heading structure
   */
  private async checkHeadingStructure(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const headings = Array.from(context.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]'));
    let previousLevel = 0;

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i] as HTMLElement;
      const level = this.getHeadingLevel(heading);

      if (i === 0 && level !== 1) {
        violations.push({
          element: heading,
          rule: 'heading-structure',
          impact: 'moderate',
          description: 'Page should start with h1 heading',
          wcagReference: ['1.3.1'],
        });
      } else if (level > previousLevel + 1) {
        violations.push({
          element: heading,
          rule: 'heading-structure',
          impact: 'moderate',
          description: `Heading level jumps from h${previousLevel} to h${level}`,
          wcagReference: ['1.3.1'],
        });
      } else {
        passes.push({
          element: heading,
          rule: 'heading-structure',
          impact: 'minor',
          description: 'Heading follows proper hierarchy',
          wcagReference: ['1.3.1'],
        });
      }

      previousLevel = level;
    }

    return { violations, passes };
  }

  /**
   * Check form labels
   */
  private async checkFormLabels(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const formControls = context.querySelectorAll('input, select, textarea');

    for (const control of formControls) {
      const htmlControl = control as HTMLFormElement;
      
      if (htmlControl.type === 'hidden' || htmlControl.type === 'submit' || htmlControl.type === 'button') {
        continue;
      }

      const hasLabel = this.hasAssociatedLabel(htmlControl);

      if (!hasLabel) {
        violations.push({
          element: htmlControl,
          rule: 'form-labels',
          impact: 'critical',
          description: 'Form control lacks associated label',
          wcagReference: ['3.3.2'],
        });
      } else {
        passes.push({
          element: htmlControl,
          rule: 'form-labels',
          impact: 'minor',
          description: 'Form control has associated label',
          wcagReference: ['3.3.2'],
        });
      }
    }

    return { violations, passes };
  }

  /**
   * Check image alt text
   */
  private async checkImageAltText(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const images = context.querySelectorAll('img');

    for (const img of images) {
      const htmlImg = img as HTMLImageElement;
      const alt = htmlImg.getAttribute('alt');

      if (alt === null) {
        violations.push({
          element: htmlImg,
          rule: 'image-alt',
          impact: 'critical',
          description: 'Image lacks alt attribute',
          wcagReference: ['1.1.1'],
        });
      } else if (alt === '' && !this.isDecorative(htmlImg)) {
        violations.push({
          element: htmlImg,
          rule: 'image-alt',
          impact: 'serious',
          description: 'Non-decorative image has empty alt text',
          wcagReference: ['1.1.1'],
        });
      } else {
        passes.push({
          element: htmlImg,
          rule: 'image-alt',
          impact: 'minor',
          description: 'Image has appropriate alt text',
          wcagReference: ['1.1.1'],
        });
      }
    }

    return { violations, passes };
  }

  /**
   * Check landmark usage
   */
  private async checkLandmarks(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const landmarks = context.querySelectorAll('main, nav, header, footer, aside, section, [role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"]');

    if (landmarks.length === 0) {
      violations.push({
        element: document.body,
        rule: 'landmarks',
        impact: 'moderate',
        description: 'Page lacks semantic landmarks for navigation',
        wcagReference: ['1.3.1'],
      });
    } else {
      passes.push({
        element: document.body,
        rule: 'landmarks',
        impact: 'minor',
        description: 'Page contains semantic landmarks',
        wcagReference: ['1.3.1'],
      });
    }

    return { violations, passes };
  }

  /**
   * Check focusable elements
   */
  private async checkFocusable(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const focusableElements = context.querySelectorAll('[tabindex]');

    for (const element of focusableElements) {
      const htmlElement = element as HTMLElement;
      const tabindex = htmlElement.getAttribute('tabindex');

      if (tabindex && parseInt(tabindex) > 0) {
        violations.push({
          element: htmlElement,
          rule: 'tabindex',
          impact: 'moderate',
          description: 'Positive tabindex disrupts natural tab order',
          wcagReference: ['2.4.3'],
        });
      }
    }

    return { violations, passes };
  }

  /**
   * Check live regions
   */
  private async checkLiveRegions(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const liveRegions = context.querySelectorAll('[aria-live]');

    for (const region of liveRegions) {
      const htmlRegion = region as HTMLElement;
      const ariaLive = htmlRegion.getAttribute('aria-live');

      if (ariaLive && !['polite', 'assertive', 'off'].includes(ariaLive)) {
        violations.push({
          element: htmlRegion,
          rule: 'aria-live',
          impact: 'moderate',
          description: 'Invalid aria-live value',
          wcagReference: ['4.1.2'],
        });
      } else {
        passes.push({
          element: htmlRegion,
          rule: 'aria-live',
          impact: 'minor',
          description: 'Valid aria-live region',
          wcagReference: ['4.1.2'],
        });
      }
    }

    return { violations, passes };
  }

  /**
   * Check tabindex usage
   */
  private async checkTabindex(
    context: Element | Document,
    options: AccessibilityTestOptions
  ): Promise<{ violations: AccessibilityViolation[]; passes: AccessibilityViolation[] }> {
    const violations: AccessibilityViolation[] = [];
    const passes: AccessibilityViolation[] = [];

    const elementsWithTabindex = context.querySelectorAll('[tabindex]');

    for (const element of elementsWithTabindex) {
      const htmlElement = element as HTMLElement;
      const tabindex = htmlElement.getAttribute('tabindex');

      if (tabindex !== null) {
        const tabindexValue = parseInt(tabindex);
        
        if (tabindexValue > 0) {
          violations.push({
            element: htmlElement,
            rule: 'positive-tabindex',
            impact: 'moderate',
            description: 'Positive tabindex values disrupt natural keyboard navigation',
            wcagReference: ['2.4.3'],
          });
        } else {
          passes.push({
            element: htmlElement,
            rule: 'positive-tabindex',
            impact: 'minor',
            description: 'Appropriate tabindex usage',
            wcagReference: ['2.4.3'],
          });
        }
      }
    }

    return { violations, passes };
  }

  // Helper methods

  private hasText(element: HTMLElement): boolean {
    return !!(element.textContent || element.innerText || '').trim();
  }

  private getEffectiveBackgroundColor(element: HTMLElement): string {
    let currentElement: HTMLElement | null = element;
    
    while (currentElement && currentElement !== document.body) {
      const styles = window.getComputedStyle(currentElement);
      const backgroundColor = styles.backgroundColor;
      
      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
        return backgroundColor;
      }
      
      currentElement = currentElement.parentElement;
    }
    
    return 'rgb(255, 255, 255)'; // Default to white
  }

  private calculateContrastRatio(foreground: string, background: string): number {
    const getLuminance = (color: string): number => {
      const rgb = this.parseColor(color);
      const sRGB = [rgb.r, rgb.g, rgb.b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    };

    const fgLuminance = getLuminance(foreground);
    const bgLuminance = getLuminance(background);
    
    return (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);
  }

  private parseColor(color: string): { r: number; g: number; b: number } {
    // Simple RGB parser - would need more robust implementation for production
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3]),
      };
    }
    return { r: 0, g: 0, b: 0 };
  }

  private getAccessibleName(element: HTMLElement): string {
    return element.getAttribute('aria-label') || 
           element.textContent?.trim() || 
           element.getAttribute('alt') || 
           element.getAttribute('title') || '';
  }

  private isFocusable(element: HTMLElement): boolean {
    const tabindex = element.getAttribute('tabindex');
    if (tabindex === '-1') return false;
    if (tabindex && parseInt(tabindex) >= 0) return true;
    
    const focusableTags = ['button', 'input', 'select', 'textarea', 'a'];
    return focusableTags.includes(element.tagName.toLowerCase());
  }

  private getHeadingLevel(element: HTMLElement): number {
    const tagMatch = element.tagName.match(/h(\d)/i);
    if (tagMatch) return parseInt(tagMatch[1]);
    
    const ariaLevel = element.getAttribute('aria-level');
    return ariaLevel ? parseInt(ariaLevel) : 1;
  }

  private hasAssociatedLabel(control: HTMLFormElement): boolean {
    const id = control.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) return true;
    }
    
    const parentLabel = control.closest('label');
    if (parentLabel) return true;
    
    return !!(control.getAttribute('aria-label') || control.getAttribute('aria-labelledby'));
  }

  private isDecorative(img: HTMLImageElement): boolean {
    return img.getAttribute('role') === 'presentation' ||
           img.getAttribute('role') === 'none' ||
           img.closest('[role="presentation"]') !== null;
  }
}

// Convenience functions
export function getAccessibilityTester(): AccessibilityTester {
  return AccessibilityTester.getInstance();
}

export async function runAccessibilityAudit(
  context?: Element | Document,
  options?: AccessibilityTestOptions
): Promise<AccessibilityTestResult> {
  return getAccessibilityTester().audit(context, options);
}

export function logAccessibilityViolations(result: AccessibilityTestResult): void {
  if (result.violations.length === 0) {
    console.log('✅ No accessibility violations found');
    return;
  }

  console.group(`🚨 Found ${result.violations.length} accessibility violations:`);
  
  result.violations.forEach((violation, index) => {
    console.group(`${index + 1}. ${violation.rule} (${violation.impact})`);
    console.log('Description:', violation.description);
    console.log('Element:', violation.element);
    if (violation.wcagReference) {
      console.log('WCAG:', violation.wcagReference.join(', '));
    }
    console.groupEnd();
  });
  
  console.groupEnd();
}
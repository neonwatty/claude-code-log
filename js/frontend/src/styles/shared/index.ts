import { css, unsafeCSS } from 'lit';

/**
 * Shared styles ported from Python templates
 * These styles maintain visual consistency across all Lit components
 */

// Import CSS file content as strings (will be handled by bundler)
import variablesCssText from './variables.css?inline';
import typographyCssText from './typography.css?inline';
import layoutCssText from './layout.css?inline';
import utilitiesCssText from './utilities.css?inline';

/**
 * Shared styles as Lit CSSResults
 */
export const variablesStyles = css`${unsafeCSS(variablesCssText)}`;
export const typographyStyles = css`${unsafeCSS(typographyCssText)}`;
export const layoutStyles = css`${unsafeCSS(layoutCssText)}`;
export const utilitiesStyles = css`${unsafeCSS(utilitiesCssText)}`;

/**
 * Combined shared styles for easy importing
 * Use this when you want all shared styles in a component
 */
export const sharedStyles = css`
  ${variablesStyles}
  ${typographyStyles}
  ${layoutStyles}
  ${utilitiesStyles}
`;

/**
 * Base styles for all components
 * Includes variables and essential typography
 */
export const baseStyles = css`
  ${variablesStyles}
  ${typographyStyles}
`;

/**
 * Export individual styles for selective use
 */
export {
  variablesStyles as variables,
  typographyStyles as typography,
  layoutStyles as layout,
  utilitiesStyles as utilities
};
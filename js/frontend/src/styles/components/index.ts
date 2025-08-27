import { css, unsafeCSS } from "lit";

/**
 * Component-specific CSS styles that can be imported into Lit components
 * These styles are based on the Python template styles for visual continuity
 */

// Import CSS file content as strings (will be handled by bundler)
import sessionListCssText from "./session-list.css?inline";
import sessionDetailCssText from "./session-detail.css?inline";
import messageCardCssText from "./message-card.css?inline";
import filterBarCssText from "./filter-bar.css?inline";
import timelineCssText from "./timeline.css?inline";

/**
 * Component styles as Lit CSSResults
 */
export const sessionListStyles = css`
  ${unsafeCSS(sessionListCssText)}
`;
export const sessionDetailStyles = css`
  ${unsafeCSS(sessionDetailCssText)}
`;
export const messageCardStyles = css`
  ${unsafeCSS(messageCardCssText)}
`;
export const filterBarStyles = css`
  ${unsafeCSS(filterBarCssText)}
`;
export const timelineStyles = css`
  ${unsafeCSS(timelineCssText)}
`;

/**
 * Export all component styles for easy importing
 */
export {
  sessionListStyles as sessionList,
  sessionDetailStyles as sessionDetail,
  messageCardStyles as messageCard,
  filterBarStyles as filterBar,
  timelineStyles as timeline,
};

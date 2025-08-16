import { css, unsafeCSS } from 'lit';

/**
 * Global CSS styles that can be imported into Lit components
 * These styles are based on the Python template styles for visual continuity
 */

// Import CSS file content as a string (will be handled by bundler)
import globalCssText from './global.css?inline';

/**
 * Global styles as a Lit CSSResult that can be imported by components
 */
export const globalStyles = css`${unsafeCSS(globalCssText)}`;

/**
 * Message type styles for quick application
 */
export const messageTypeStyles = css`
  .message {
    margin-bottom: 1em;
    padding: 1em;
    border-radius: var(--border-radius-md);
    border-left: var(--color-border-light) 1px solid;
    background-color: #e3f2fd55;
    box-shadow: -7px -7px 10px var(--color-shadow-light), 7px 7px 10px var(--color-shadow-dark);
    border-top: var(--color-border-light) 1px solid;
    border-bottom: var(--color-border-dark) 1px solid;
    border-right: var(--color-border-dark) 1px solid;
  }
`;

/**
 * Utility function to create message type specific styles
 */
export function createMessageTypeStyle(messageType: string): ReturnType<typeof css> {
  const colorMap: Record<string, string> = {
    user: 'var(--message-user-color)',
    assistant: 'var(--message-assistant-color)',
    system: 'var(--message-system-color)',
    'tool-use': 'var(--message-tool-use-color)',
    'tool-result': 'var(--message-tool-result-color)',
    thinking: 'var(--message-thinking-color)',
    image: 'var(--message-image-color)',
  };

  const color = colorMap[messageType] || 'var(--color-primary)';
  
  return css`
    :host([message-type="${unsafeCSS(messageType)}"]) {
      border-left-color: ${unsafeCSS(color)};
    }
  `;
}
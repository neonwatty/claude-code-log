import { html, css, CSSResultGroup } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { BaseComponent } from '../base/BaseComponent';
import { baseStyles } from '../styles/theme';
import './MarkdownRenderer';

/**
 * Demo component for testing markdown rendering capabilities
 */
@customElement('markdown-renderer-demo')
export class MarkdownRendererDemo extends BaseComponent {
  static styles: CSSResultGroup = [
    baseStyles,
    css`
      :host {
        display: block;
        padding: var(--space-lg);
        max-width: 800px;
        margin: 0 auto;
      }

      .demo-header {
        text-align: center;
        margin-bottom: var(--space-xl);
      }

      .demo-section {
        margin-bottom: var(--space-xl);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        overflow: hidden;
      }

      .section-header {
        background: var(--color-background-secondary);
        padding: var(--space-md);
        font-weight: var(--font-weight-semibold);
        border-bottom: 1px solid var(--color-border);
      }

      .section-content {
        padding: var(--space-lg);
      }

      .markdown-sample {
        background: var(--color-background-tertiary);
        padding: var(--space-md);
        border-radius: var(--border-radius);
        margin-bottom: var(--space-md);
        font-family: var(--font-mono);
        font-size: var(--font-size-sm);
        white-space: pre-wrap;
      }

      .rendered-output {
        border: 1px solid var(--color-border-light);
        border-radius: var(--border-radius);
        padding: var(--space-md);
        background: var(--color-background);
      }

      .controls {
        display: flex;
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
        padding: var(--space-md);
        background: var(--color-background-secondary);
        border-radius: var(--border-radius);
      }

      .control-group {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }

      .control-group label {
        font-weight: var(--font-weight-medium);
      }

      .test-selector {
        padding: var(--space-sm);
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius);
        background: var(--color-background);
      }
    `,
  ];

  @state()
  private selectedTest = 'basic';

  @state()
  private gfmEnabled = true;

  @state()
  private breaksEnabled = false;

  @state()
  private sanitizeEnabled = true;

  private markdownSamples = {
    basic: `# Basic Markdown Test

This is a **bold** text and this is *italic*.

Here's some \`inline code\` and a [link](https://example.com).

## Lists

### Unordered List
- Item 1
- Item 2
  - Nested item 1
  - Nested item 2
- Item 3

### Ordered List
1. First item
2. Second item
   1. Nested numbered item
   2. Another nested item
3. Third item

## Code Block

\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

## Blockquote

> This is a blockquote.
> 
> It can span multiple lines.
> 
> > And even be nested.`,

    tables: `# Table Examples

## Simple Table

| Name | Age | City |
|------|-----|------|
| Alice | 30 | New York |
| Bob | 25 | San Francisco |
| Carol | 35 | Chicago |

## Aligned Table

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left | Center | Right |
| Text | Text | Text |
| More | More | More |

## Complex Table with Code

| Feature | Syntax | Example |
|---------|--------|---------|
| Bold | \`**text**\` | **bold text** |
| Italic | \`*text*\` | *italic text* |
| Code | \`\\\`code\\\`\` | \`inline code\` |
| Link | \`[text](url)\` | [example](https://example.com) |`,

    advanced: `# Advanced Markdown Features

## Task Lists

- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task
- [ ] Yet another task

## Horizontal Rules

Above the line

---

Below the line

## Mixed Content

Here's a paragraph with **bold**, *italic*, ~~strikethrough~~, and \`code\`.

### Images

![Alt text for image](https://via.placeholder.com/300x200?text=Sample+Image)

### Complex Lists

1. First level
   - Mixed list type
   - Another item
     1. Third level numbered
     2. Another third level
   - Back to second level
2. Back to first level

### Code with Syntax

\`\`\`typescript
interface User {
  name: string;
  age: number;
  active: boolean;
}

class UserManager {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
  
  getActiveUsers(): User[] {
    return this.users.filter(user => user.active);
  }
}
\`\`\`

### Nested Blockquotes

> First level quote
> 
> > Second level quote
> > 
> > > Third level quote
> > 
> > Back to second level
> 
> Back to first level

## Links and References

Here's a [simple link](https://example.com) and here's a [link with title](https://example.com "Example Website").

External links should open in new tabs: [Google](https://google.com)

Internal link should not: [Internal](./internal-page)`,

    gfm: `# GitHub Flavored Markdown

## Strikethrough

~~This text is struck through~~

## Autolinks

https://www.github.com

user@example.com

## Fenced Code Blocks

\`\`\`json
{
  "name": "example",
  "version": "1.0.0",
  "dependencies": {
    "lit": "^3.0.0",
    "marked": "^9.0.0"
  }
}
\`\`\`

## Tables with Pipes

| Feature | Supported | Notes |
|---------|-----------|-------|
| Tables | ✅ | Full support |
| Task Lists | ✅ | GitHub style |
| Strikethrough | ✅ | ~~like this~~ |
| Autolinks | ✅ | Automatic |

## HTML in Markdown

<details>
<summary>Click to expand</summary>

This content is inside a details/summary block.

**Markdown** still works here!

</details>`
  };

  render() {
    const sample = this.markdownSamples[this.selectedTest as keyof typeof this.markdownSamples];

    return html`
      <div class="demo-header">
        <h1>Markdown Renderer Demo</h1>
        <p>Test various markdown features and configurations</p>
      </div>

      <div class="controls">
        <div class="control-group">
          <label for="test-selector">Test Sample:</label>
          <select 
            id="test-selector"
            class="test-selector"
            .value=${this.selectedTest}
            @change=${this.handleTestChange}
          >
            <option value="basic">Basic Features</option>
            <option value="tables">Tables</option>
            <option value="advanced">Advanced Features</option>
            <option value="gfm">GitHub Flavored</option>
          </select>
        </div>

        <div class="control-group">
          <label>
            <input 
              type="checkbox" 
              .checked=${this.gfmEnabled}
              @change=${this.handleGfmChange}
            >
            Enable GFM
          </label>
        </div>

        <div class="control-group">
          <label>
            <input 
              type="checkbox" 
              .checked=${this.breaksEnabled}
              @change=${this.handleBreaksChange}
            >
            Line Breaks
          </label>
        </div>

        <div class="control-group">
          <label>
            <input 
              type="checkbox" 
              .checked=${this.sanitizeEnabled}
              @change=${this.handleSanitizeChange}
            >
            Sanitize HTML
          </label>
        </div>
      </div>

      <div class="demo-section">
        <div class="section-header">Raw Markdown</div>
        <div class="section-content">
          <div class="markdown-sample">${sample}</div>
        </div>
      </div>

      <div class="demo-section">
        <div class="section-header">Rendered Output</div>
        <div class="section-content">
          <div class="rendered-output">
            <markdown-renderer
              .content=${sample}
              .gfm=${this.gfmEnabled}
              .breaks=${this.breaksEnabled}
              .sanitize=${this.sanitizeEnabled}
            ></markdown-renderer>
          </div>
        </div>
      </div>
    `;
  }

  private handleTestChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    this.selectedTest = target.value;
  }

  private handleGfmChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.gfmEnabled = target.checked;
  }

  private handleBreaksChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.breaksEnabled = target.checked;
  }

  private handleSanitizeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.sanitizeEnabled = target.checked;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'markdown-renderer-demo': MarkdownRendererDemo;
  }
}
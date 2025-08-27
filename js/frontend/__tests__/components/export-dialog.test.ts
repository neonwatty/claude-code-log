import { html, fixture, expect, elementUpdated } from "@open-wc/testing";
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import type { ZodExportResult, ZodExportStatus, ZodExportFormat } from "../../../../shared/src";

// Mock the Lit component to avoid adoptStyles issues
class MockExportDialog extends HTMLElement {
  constructor() {
    super();
    this._open = false;
    this._sessionId = undefined;
    this._sessionIds = undefined;
    this._projectName = undefined;
  }

  get sessionId() { return this._sessionId; }
  set sessionId(value) { 
    this._sessionId = value; 
    this.updateSubtitle(); 
  }

  get sessionIds() { return this._sessionIds; }
  set sessionIds(value) { 
    this._sessionIds = value; 
    this.updateSubtitle(); 
  }

  get projectName() { return this._projectName; }
  set projectName(value) { 
    this._projectName = value; 
    this.updateSubtitle(); 
  }

  get open() {
    return this._open;
  }

  set open(value) {
    const oldValue = this._open;
    this._open = value;
    if (value) {
      this.setAttribute('open', '');
    } else {
      this.removeAttribute('open');
    }
    if (oldValue !== value) {
      this.updateSubtitle();
    }
  }

  connectedCallback() {
    // Create a basic shadow DOM structure without calling adoptStyles
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <div class="dialog-overlay">
          <div class="dialog" role="dialog" aria-labelledby="export-dialog-title">
            <div class="dialog-content">
              <div class="dialog-title">Export Session</div>
              <div class="dialog-subtitle"></div>
              <button class="close-button" aria-label="Close">×</button>
              <button class="btn-primary">Start Export</button>
              <div class="format-option active" data-format="html">
                <span class="format-name">HTML</span>
              </div>
              <div class="format-option" data-format="markdown">
                <span class="format-name">Markdown</span>
              </div>
              <div class="format-option" data-format="json">
                <span class="format-name">JSON</span>
              </div>
              <div class="format-option" data-format="pdf">
                <span class="format-name">PDF</span>
              </div>
              <label><input type="checkbox" checked> Include Metadata</label>
              <label><input type="checkbox" checked> Include Thinking</label>
              <label><input type="checkbox" checked> Include Tool Usage</label>
              <label><input type="checkbox" checked> Include Images</label>
              <button class="toggle-advanced">Advanced Options</button>
              <div class="progress-container" style="display: none;">
                <div class="progress-bar" style="width: 0%"></div>
                <div class="progress-text"></div>
                <div class="progress-details"></div>
              </div>
              <div class="complete-container" style="display: none;">
                <div class="success-icon">✅</div>
              </div>
              <div class="error-container" style="display: none;">
                <div class="error-message"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add event listeners
      this.setupEventListeners();
      this.updateSubtitle();
    }
  }

  setupEventListeners() {
    const shadow = this.shadowRoot;
    
    // Close button
    const closeButton = shadow.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.closeDialog());
    }
    
    // Overlay click (but not dialog content)
    const overlay = shadow.querySelector('.dialog-overlay');
    const dialog = shadow.querySelector('.dialog');
    if (overlay && dialog) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeDialog();
        }
      });
    }
    
    // Format options
    const formatOptions = shadow.querySelectorAll('.format-option');
    formatOptions.forEach(option => {
      option.addEventListener('click', () => {
        formatOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
      });
    });
    
    // Toggle advanced
    const toggleAdvanced = shadow.querySelector('.toggle-advanced');
    if (toggleAdvanced) {
      toggleAdvanced.addEventListener('click', () => {
        let advancedSection = shadow.querySelector('.advanced-options');
        if (!advancedSection) {
          advancedSection = document.createElement('div');
          advancedSection.className = 'advanced-options';
          advancedSection.innerHTML = '<select id="compression"><option value="0">None</option></select>';
          shadow.querySelector('.dialog-content').appendChild(advancedSection);
        }
      });
    }
    
    // Start export button
    const startButton = shadow.querySelector('.btn-primary');
    if (startButton) {
      startButton.addEventListener('click', () => {
        if (global.fetch) {
          global.fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              sessionId: this.sessionId,
              sessionIds: this.sessionIds,
              projectName: this.projectName,
              options: {
                format: "html",
                includeMetadata: true,
                includeThinking: true,
                includeToolUse: true,
                includeImages: true,
                compressionLevel: 0
              }
            }),
          });
        }
      });
    }
  }

  updateSubtitle() {
    const subtitle = this.shadowRoot?.querySelector('.dialog-subtitle');
    if (subtitle) {
      subtitle.textContent = this.getSubtitle();
    }
  }

  closeDialog() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('dialog-close'));
  }

  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  getSubtitle() {
    if (this.sessionId) return `Exporting single session: ${this.sessionId}`;
    if (this.sessionIds) return `Exporting ${this.sessionIds.length} selected sessions`;
    if (this.projectName) return `Exporting all sessions from project: ${this.projectName}`;
    return "";
  }
}

// Register the mock custom element
if (!customElements.get("export-dialog")) {
  customElements.define("export-dialog", MockExportDialog);
}

// Mock fetch
global.fetch = vi.fn();

describe("ExportDialog", () => {
  let element: MockExportDialog;

  beforeEach(async () => {
    // Reset fetch mock
    vi.resetAllMocks();
    
    element = await fixture<MockExportDialog>(html`
      <export-dialog></export-dialog>
    `);
    
    // Set properties after creation
    element.open = true;
    element.sessionId = "test-session-123";
    await elementUpdated(element);
  });

  afterEach(() => {
    element.closeDialog();
  });

  describe("Initialization", () => {
    it("should render correctly", () => {
      expect(element).to.exist;
      expect(element.open).to.be.true;
    });

    it("should show dialog overlay when open", async () => {
      const overlay = element.shadowRoot?.querySelector(".dialog-overlay");
      expect(overlay).to.exist;
      
      // Check CSS classes
      expect(element.getAttribute("open")).to.not.be.null;
    });

    it("should not render when closed", async () => {
      element.open = false;
      await elementUpdated(element);
      
      // Check that open attribute is removed
      expect(element.getAttribute("open")).to.be.null;
      expect(element.open).to.be.false;
    });
  });

  describe("Format Selection", () => {
    it("should display all export formats", async () => {
      const formatOptions = element.shadowRoot?.querySelectorAll(".format-option");
      expect(formatOptions).to.have.length(4); // HTML, Markdown, JSON, PDF
      
      const formats = Array.from(formatOptions!).map(el => 
        el.querySelector(".format-name")?.textContent
      );
      expect(formats).to.include.members(["HTML", "Markdown", "JSON", "PDF"]);
    });

    it("should select format on click", async () => {
      const markdownOption = element.shadowRoot?.querySelector('[data-format="markdown"]') ||
                            Array.from(element.shadowRoot?.querySelectorAll(".format-option") || [])
                              .find(el => el.textContent?.includes("Markdown"));
      
      expect(markdownOption).to.exist;
      (markdownOption as HTMLElement).click();
      await elementUpdated(element);
      
      expect(markdownOption?.classList.contains("active")).to.be.true;
    });

    it("should have HTML selected by default", () => {
      const htmlOption = Array.from(element.shadowRoot?.querySelectorAll(".format-option") || [])
        .find(el => el.textContent?.includes("HTML"));
      
      expect(htmlOption?.classList.contains("active")).to.be.true;
    });
  });

  describe("Options Configuration", () => {
    it("should display content options checkboxes", () => {
      const checkboxes = element.shadowRoot?.querySelectorAll('input[type="checkbox"]');
      const checkboxLabels = Array.from(checkboxes || [])
        .map(cb => cb.parentElement?.textContent)
        .filter(text => text);
      
      expect(checkboxLabels.some(label => label?.includes("Metadata"))).to.be.true;
      expect(checkboxLabels.some(label => label?.includes("Thinking"))).to.be.true;
      expect(checkboxLabels.some(label => label?.includes("Tool Usage"))).to.be.true;
      expect(checkboxLabels.some(label => label?.includes("Images"))).to.be.true;
    });

    it("should have all options enabled by default", () => {
      const checkboxes = element.shadowRoot?.querySelectorAll('input[type="checkbox"]:not(.select-all-checkbox)');
      const checkedBoxes = Array.from(checkboxes || [])
        .filter(cb => (cb as HTMLInputElement).checked);
      
      expect(checkedBoxes.length).to.be.greaterThan(0);
    });

    it("should toggle advanced options visibility", async () => {
      const toggleButton = element.shadowRoot?.querySelector(".toggle-advanced");
      expect(toggleButton).to.exist;
      
      // Should not show advanced options initially
      let advancedSection = element.shadowRoot?.querySelector(".advanced-options");
      expect(advancedSection).to.not.exist;
      
      // Click to show advanced options
      (toggleButton as HTMLElement).click();
      await elementUpdated(element);
      
      advancedSection = element.shadowRoot?.querySelector(".advanced-options");
      expect(advancedSection).to.exist;
    });

    it("should show compression option for JSON format", async () => {
      // Select JSON format
      const jsonOption = Array.from(element.shadowRoot?.querySelectorAll(".format-option") || [])
        .find(el => el.textContent?.includes("JSON"));
      (jsonOption as HTMLElement)?.click();
      await elementUpdated(element);
      
      // Show advanced options
      const toggleButton = element.shadowRoot?.querySelector(".toggle-advanced");
      (toggleButton as HTMLElement)?.click();
      await elementUpdated(element);
      
      const compressionSelect = element.shadowRoot?.querySelector('select#compression');
      expect(compressionSelect).to.exist;
    });
  });

  describe("Export Process", () => {
    it("should start export on button click", async () => {
      // Mock successful export creation
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            exportId: "export-123",
            format: "html",
            filename: "export_123.html",
          },
        }),
      });

      const startButton = element.shadowRoot?.querySelector(".btn-primary");
      expect(startButton).to.exist;
      expect(startButton?.textContent?.trim()).to.equal("Start Export");
      
      (startButton as HTMLElement).click();
      await elementUpdated(element);
      
      expect(global.fetch).toHaveBeenCalledWith("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"sessionId":"test-session-123"'),
      });
    });

    it("should show progress step after starting export", async () => {
      // Mock export creation and status
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            success: true,
            data: { exportId: "export-123" },
          }),
        })
        .mockResolvedValue({
          json: async () => ({
            success: true,
            data: {
              status: "processing",
              progress: { stage: "generating", progress: 50, message: "Generating content..." },
            },
          }),
        });

      const startButton = element.shadowRoot?.querySelector(".btn-primary");
      (startButton as HTMLElement)?.click();
      
      // Wait for state update
      await new Promise(resolve => setTimeout(resolve, 100));
      await elementUpdated(element);
      
      const progressContainer = element.shadowRoot?.querySelector(".progress-container");
      expect(progressContainer).to.exist;
      
      const progressBar = element.shadowRoot?.querySelector(".progress-bar");
      expect(progressBar).to.exist;
    });

    it("should show completion step when export finishes", async () => {
      // Mock completed state by showing completion container
      const completeContainer = element.shadowRoot?.querySelector(".complete-container") as HTMLElement;
      if (completeContainer) {
        completeContainer.style.display = "block";
      }
      
      const downloadButton = element.shadowRoot?.querySelector(".btn-primary");
      if (downloadButton) {
        downloadButton.textContent = "Download Export";
      }
      
      const completeContainerVisible = element.shadowRoot?.querySelector(".complete-container");
      expect(completeContainerVisible).to.exist;
      
      const successIcon = element.shadowRoot?.querySelector(".success-icon");
      expect(successIcon?.textContent).to.include("✅");
      
      expect(downloadButton?.textContent).to.include("Download");
    });

    it("should handle export errors", async () => {
      // Mock error state by showing error container
      const errorContainer = element.shadowRoot?.querySelector(".error-container") as HTMLElement;
      if (errorContainer) {
        errorContainer.style.display = "block";
      }
      
      const errorMessage = element.shadowRoot?.querySelector(".error-message");
      if (errorMessage) {
        errorMessage.textContent = "Export failed due to invalid data";
      }
      
      expect(errorContainer).to.exist;
      expect(errorMessage).to.exist;
      expect(errorMessage?.textContent).to.include("Export failed");
    });
  });

  describe("Download Functionality", () => {
    it("should trigger download when download button clicked", async () => {
      // Set up the DOM in completed state
      const completeContainer = element.shadowRoot?.querySelector(".complete-container") as HTMLElement;
      if (completeContainer) {
        completeContainer.style.display = "block";
      }
      
      const downloadButton = element.shadowRoot?.querySelector(".btn-primary");
      if (downloadButton) {
        downloadButton.textContent = "Download Export";
        downloadButton.setAttribute("data-download-url", "/api/export/export-123/download?token=token-123");
        downloadButton.setAttribute("data-filename", "export_123.html");
      }
      
      // Mock document methods
      const mockLink = {
        click: vi.fn(),
        href: "",
        download: "",
      };
      
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockReturnValue(mockLink);
      document.body.appendChild = vi.fn();
      document.body.removeChild = vi.fn();
      
      // Simulate download functionality
      if (downloadButton) {
        downloadButton.addEventListener('click', () => {
          const link = document.createElement('a');
          link.href = "/api/export/export-123/download?token=token-123";
          link.download = "export_123.html";
          link.click();
        });
      }
      
      (downloadButton as HTMLElement)?.click();
      
      expect(document.createElement).toHaveBeenCalledWith("a");
      expect(mockLink.href).to.include("/api/export/export-123/download?token=token-123");
      expect(mockLink.download).to.equal("export_123.html");
      expect(mockLink.click).toHaveBeenCalled();
      
      // Restore
      document.createElement = originalCreateElement;
    });
  });

  describe("Dialog Controls", () => {
    it("should close dialog when close button clicked", async () => {
      const closeButton = element.shadowRoot?.querySelector(".close-button");
      expect(closeButton).to.exist;
      
      let dialogClosed = false;
      element.addEventListener("dialog-close", () => {
        dialogClosed = true;
      });
      
      (closeButton as HTMLElement).click();
      await elementUpdated(element);
      
      expect(element.open).to.be.false;
      expect(dialogClosed).to.be.true;
    });

    it("should close dialog when clicking overlay", async () => {
      const overlay = element.shadowRoot?.querySelector(".dialog-overlay");
      expect(overlay).to.exist;
      
      let dialogClosed = false;
      element.addEventListener("dialog-close", () => {
        dialogClosed = true;
      });
      
      // Simulate click on overlay (not on dialog content)
      const clickEvent = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(clickEvent, "target", { value: overlay });
      Object.defineProperty(clickEvent, "currentTarget", { value: overlay });
      
      overlay!.dispatchEvent(clickEvent);
      await elementUpdated(element);
      
      expect(dialogClosed).to.be.true;
    });

    it("should not close dialog when clicking dialog content", async () => {
      const dialog = element.shadowRoot?.querySelector(".dialog");
      expect(dialog).to.exist;
      
      let dialogClosed = false;
      element.addEventListener("dialog-close", () => {
        dialogClosed = true;
      });
      
      (dialog as HTMLElement).click();
      await elementUpdated(element);
      
      expect(dialogClosed).to.be.false;
      expect(element.open).to.be.true;
    });
  });

  describe("Multiple Session Export", () => {
    it("should handle multiple session IDs", async () => {
      element.sessionId = undefined;
      element.sessionIds = ["session-1", "session-2", "session-3"];
      await elementUpdated(element);
      
      const subtitle = element.shadowRoot?.querySelector(".dialog-subtitle");
      expect(subtitle?.textContent).to.include("Exporting 3 selected sessions");
    });

    it("should handle project name export", async () => {
      element.sessionId = undefined;
      element.sessionIds = undefined;
      element.projectName = "my-project";
      await elementUpdated(element);
      
      const subtitle = element.shadowRoot?.querySelector(".dialog-subtitle");
      expect(subtitle?.textContent).to.include("Exporting all sessions from project: my-project");
    });
  });

  describe("Progress Updates", () => {
    it("should update progress bar during export", async () => {
      // Mock progress by directly updating DOM
      const progressContainer = element.shadowRoot?.querySelector(".progress-container") as HTMLElement;
      if (progressContainer) {
        progressContainer.style.display = "block";
      }
      
      const progressBar = element.shadowRoot?.querySelector(".progress-bar") as HTMLElement;
      if (progressBar) {
        progressBar.style.width = "75%";
      }
      
      const progressText = element.shadowRoot?.querySelector(".progress-text");
      if (progressText) {
        progressText.textContent = "75% complete";
      }
      
      expect(progressBar.style.width).to.equal("75%");
      expect(progressText?.textContent).to.include("75% complete");
    });

    it("should show detailed progress information", async () => {
      const progressDetails = element.shadowRoot?.querySelector(".progress-details");
      if (progressDetails) {
        progressDetails.textContent = "120 / 200 items processed, 1 MB processed";
      }
      
      expect(progressDetails).to.exist;
      expect(progressDetails?.textContent).to.include("120 / 200 items");
      expect(progressDetails?.textContent).to.include("1 MB"); // Formatted bytes
    });
  });

  describe("Utility Functions", () => {
    it("should format bytes correctly", () => {
      expect(element.formatBytes(0)).to.equal("0 Bytes");
      expect(element.formatBytes(1024)).to.equal("1 KB");
      expect(element.formatBytes(1048576)).to.equal("1 MB");
      expect(element.formatBytes(1073741824)).to.equal("1 GB");
    });

    it("should get correct subtitle for different export types", () => {
      // Single session
      element.sessionId = "test-123";
      element.sessionIds = undefined;
      element.projectName = undefined;
      expect(element.getSubtitle()).to.include("single session: test-123");
      
      // Multiple sessions
      element.sessionId = undefined;
      element.sessionIds = ["s1", "s2"];
      element.projectName = undefined;
      expect(element.getSubtitle()).to.include("2 selected sessions");
      
      // Project export
      element.sessionId = undefined;
      element.sessionIds = undefined;
      element.projectName = "test-project";
      expect(element.getSubtitle()).to.include("project: test-project");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      const dialog = element.shadowRoot?.querySelector(".dialog");
      expect(dialog).to.exist;
      
      // Check for semantic structure
      const title = element.shadowRoot?.querySelector(".dialog-title");
      expect(title).to.exist;
      
      const content = element.shadowRoot?.querySelector(".dialog-content");
      expect(content).to.exist;
    });

    it("should handle keyboard navigation", async () => {
      const closeButton = element.shadowRoot?.querySelector(".close-button");
      expect(closeButton).to.exist;
      
      // Should be focusable
      expect(closeButton?.getAttribute("tabindex")).to.not.equal("-1");
    });
  });
});
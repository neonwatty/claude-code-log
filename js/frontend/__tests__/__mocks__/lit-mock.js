// Mock for lit library to work with Jest
class MockLitElement {
  constructor() {
    this._properties = new Map();
    this._observers = new Set();
    this._controllers = new Set();
    this.updateComplete = Promise.resolve();
    this.hasUpdated = false;
    this.isUpdatePending = false;
    this.renderRoot = this;
    this.shadowRoot = null;
  }

  static get properties() {
    return {};
  }

  static set properties(value) {
    // Allow setting properties
  }

  static get styles() {
    return this._styles || "";
  }

  static set styles(value) {
    this._styles = value;
  }

  connectedCallback() {
    this.hasUpdated = true;
    this.requestUpdate();
  }

  disconnectedCallback() {}

  requestUpdate() {
    return Promise.resolve();
  }

  updated() {}

  firstUpdated() {}

  render() {
    return "";
  }

  createRenderRoot() {
    return this;
  }

  // Reactive controller support
  addController(controller) {
    controller.hostConnected?.();
    this._controllers = this._controllers || new Set();
    this._controllers.add(controller);
  }

  removeController(controller) {
    this._controllers?.delete(controller);
    controller.hostDisconnected?.();
  }

  // Event dispatch
  dispatchEvent(event) {
    return true;
  }
}

// Mock CSS template literal tag
const css = (strings, ...values) => {
  let result = "";
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += values[i];
    }
  }
  return result;
};

// Mock html template literal tag
const html = (strings, ...values) => {
  return { strings, values };
};

// Mock nothing template literal tag
const nothing = undefined;

module.exports = {
  LitElement: MockLitElement,
  css,
  html,
  nothing,
};

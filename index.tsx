import { render } from 'preact';
import ShippingDocViewer, { type DownloadRequestEvent, type DownloadState } from './components/ShippingDocViewer';
import { mockShipmentData } from './utils/mockData';
import type { ShipmentData } from './types';
import tailwindStyles from './styles/tailwind.css?inline';

const FONT_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';

const EmptyState = () => (
  <div className="min-h-[300px] flex items-center justify-center text-gray-400 text-sm">
    No data provided. Set the "data" attribute with JSON or assign the `data` property.
  </div>
);

class ShippingDocViewerElement extends HTMLElement {
  private _data?: ShipmentData;
  private _root?: ShadowRoot;
  private _container?: HTMLDivElement;
  private _onDownloadRequest?: (event: DownloadRequestEvent) => void;
  private _downloadState: DownloadState = 'idle';
  private _downloadMessage?: string;
  private _autoClearTimer?: ReturnType<typeof setTimeout>;

  static get observedAttributes() {
    return ['data'];
  }

  connectedCallback() {
    this.ensureRoot();
    this.renderViewer();
  }

  attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
    if (name === 'data' && newValue) {
      this._data = this.parseData(newValue);
    }
    this.renderViewer();
  }

  set data(value: ShipmentData | string | null) {
    if (typeof value === 'string') {
      this._data = this.parseData(value);
    } else if (value) {
      this._data = value;
    } else {
      this._data = undefined;
    }
    this.renderViewer();
  }

  get data() {
    return this._data;
  }

  // Allow setting a callback for download requests
  set onDownloadRequest(callback: ((event: DownloadRequestEvent) => void) | undefined) {
    this._onDownloadRequest = callback;
    this.renderViewer();
  }

  get onDownloadRequest() {
    return this._onDownloadRequest;
  }

  // --- Download state management ---

  set downloadState(value: DownloadState) {
    this._downloadState = value;
    this.renderViewer();
  }

  get downloadState(): DownloadState {
    return this._downloadState;
  }

  /**
   * Set the download state with optional message.
   * 'done' auto-clears after 3 seconds.
   */
  setDownloadState(state: DownloadState, message?: string) {
    if (this._autoClearTimer) clearTimeout(this._autoClearTimer);
    this._downloadState = state;
    this._downloadMessage = message;
    this.renderViewer();
    if (state === 'done') {
      this._autoClearTimer = setTimeout(() => {
        this._downloadState = 'idle';
        this._downloadMessage = undefined;
        this.renderViewer();
      }, 3000);
    }
  }

  private ensureRoot() {
    if (this._root) return;

    this._root = this.attachShadow({ mode: 'open' });

    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = FONT_URL;

    const embeddedStyles = document.createElement('style');
    embeddedStyles.textContent = tailwindStyles;

    this._container = document.createElement('div');
    this._container.id = 'shipping-doc-viewer-root';

    this._root.append(fontLink, embeddedStyles, this._container);
  }

  private parseData(input: string): ShipmentData | undefined {
    try {
      return JSON.parse(input) as ShipmentData;
    } catch {
      return undefined;
    }
  }

  private handleDownloadRequest = (event: DownloadRequestEvent) => {
    // If callback is set, use it
    if (this._onDownloadRequest) {
      this._onDownloadRequest(event);
      return;
    }
    
    // Otherwise, dispatch CustomEvent from this element
    const customEvent = new CustomEvent('download-request', {
      detail: event,
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(customEvent);
  };

  private renderViewer() {
    if (!this._container) return;

    // In DEV mode, always use mock data if no data was provided
    const data = this._data ?? mockShipmentData;

    if (!data) {
      render(<EmptyState />, this._container);
      return;
    }

    render(
      <ShippingDocViewer 
        data={data} 
        onDownloadRequest={this.handleDownloadRequest}
        downloadState={this._downloadState}
        downloadMessage={this._downloadMessage}
      />, 
      this._container
    );
  }
}

if (!customElements.get('shipping-doc-viewer')) {
  customElements.define('shipping-doc-viewer', ShippingDocViewerElement);
}

export type { ShipmentData } from './types';
export type { DownloadRequestEvent, DownloadState } from './components/ShippingDocViewer';
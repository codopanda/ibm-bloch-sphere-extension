import { Complex } from '../lib/complex.js';
import { parseComplexText } from '../lib/complexParser.js';

export interface InspectSample {
  stepIndex: number;
  totalSteps: number;
  label?: string;
  stateVector: Complex[];
  lastUpdated: number;
  qubitCount: number;
}

export type InspectStatus = 'disconnected' | 'connected' | 'collecting' | 'error';

export interface InspectStatusPayload {
  status: InspectStatus;
  message?: string;
}

const STATE_VECTOR_SELECTOR = '#state-vector pre code, [data-panel-id="state-vector"] pre code';
const TOOLBAR_SELECTOR = 'div[role="toolbar"][aria-label="Circuit options"]';

export class InspectScraper extends EventTarget {
  private stateVectorNode: HTMLElement | null = null;

  private toolbarNode: HTMLElement | null = null;

  private stateObserver: MutationObserver | null = null;

  private toolbarObserver: MutationObserver | null = null;

  private scanInterval: number | null = null;

  private collectionFrame: number | null = null;

  private lastHash = '';

  constructor() {
    super();
    this.scan();
    this.scanInterval = window.setInterval(() => this.scan(), 1500);
  }

  disconnect() {
    if (this.stateObserver) {
      this.stateObserver.disconnect();
      this.stateObserver = null;
    }
    if (this.toolbarObserver) {
      this.toolbarObserver.disconnect();
      this.toolbarObserver = null;
    }
    if (this.toolbarNode) {
      this.toolbarNode.removeEventListener('click', this.handleToolbarInteraction, true);
    }
    if (this.scanInterval) {
      window.clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.stateVectorNode = null;
    this.toolbarNode = null;
    this.emitStatus('disconnected');
  }

  private scan() {
    const stateNode = document.querySelector<HTMLElement>(STATE_VECTOR_SELECTOR);
    if (stateNode) {
      if (stateNode !== this.stateVectorNode) {
        this.bindStateVector(stateNode);
      }
    } else if (this.stateVectorNode) {
      this.unbindStateVector();
    }

    const toolbar = document.querySelector<HTMLElement>(TOOLBAR_SELECTOR);
    if (toolbar) {
      if (toolbar !== this.toolbarNode) {
        this.bindToolbar(toolbar);
      }
    } else if (this.toolbarNode) {
      this.unbindToolbar();
    }

    if (!stateNode) {
      const inspectActive = document.querySelector('#composer-toolbar-inspect-switch')?.getAttribute('aria-checked') === 'true';
      this.emitStatus(
        inspectActive ? 'error' : 'disconnected',
        inspectActive ? 'Enable the Statevector visualization to feed Bloch Inspector' : undefined
      );
    }
  }

  private bindStateVector(node: HTMLElement) {
    if (this.stateObserver) {
      this.stateObserver.disconnect();
    }
    this.stateVectorNode = node;
    this.stateObserver = new MutationObserver(() => this.scheduleCollection());
    this.stateObserver.observe(node, { characterData: true, childList: true, subtree: true });
    this.emitStatus('connected');
    this.scheduleCollection();
  }

  private unbindStateVector() {
    if (this.stateObserver) {
      this.stateObserver.disconnect();
      this.stateObserver = null;
    }
    this.stateVectorNode = null;
    this.emitStatus('disconnected');
  }

  private bindToolbar(node: HTMLElement) {
    if (this.toolbarObserver) {
      this.toolbarObserver.disconnect();
    }
    if (this.toolbarNode) {
      this.toolbarNode.removeEventListener('click', this.handleToolbarInteraction, true);
    }
    this.toolbarNode = node;
    this.toolbarNode.addEventListener('click', this.handleToolbarInteraction, true);
    this.toolbarObserver = new MutationObserver(() => this.scheduleCollection());
    this.toolbarObserver.observe(node, { attributes: true, childList: true, subtree: true });
  }

  private unbindToolbar() {
    if (this.toolbarObserver) {
      this.toolbarObserver.disconnect();
      this.toolbarObserver = null;
    }
    if (this.toolbarNode) {
      this.toolbarNode.removeEventListener('click', this.handleToolbarInteraction, true);
      this.toolbarNode = null;
    }
  }

  private readonly handleToolbarInteraction = () => {
    this.scheduleCollection();
  };

  private scheduleCollection() {
    if (this.collectionFrame !== null) {
      return;
    }
    this.collectionFrame = window.requestAnimationFrame(() => {
      this.collectionFrame = null;
      const sample = this.collectSample();
      if (!sample) {
        return;
      }
      const hash = hashState(sample.stateVector);
      if (hash === this.lastHash) {
        return;
      }
      this.lastHash = hash;
      this.emitStatus('collecting');
      this.dispatchEvent(new CustomEvent<InspectSample>('state', { detail: sample }));
    });
  }

  private collectSample(): InspectSample | null {
    if (!this.stateVectorNode) {
      return null;
    }
    const text = this.stateVectorNode.textContent?.trim();
    if (!text) {
      return null;
    }
    const stateVector = parseStateVectorText(text);
    if (!stateVector || !stateVector.length) {
      return null;
    }

    const qubitCount = Math.max(1, Math.round(Math.log2(stateVector.length)));

    const sample: InspectSample = {
      stepIndex: 0,
      totalSteps: 0,
      label: this.extractStepLabel(),
      stateVector,
      lastUpdated: Date.now(),
      qubitCount
    };

    return sample;
  }

  private extractStepLabel(): string | undefined {
    const ariaMatch = document.querySelector('[aria-label*="Inspecting" i]');
    if (ariaMatch?.textContent) {
      return ariaMatch.textContent.trim();
    }
    const statusChip = Array.from(document.querySelectorAll('span, div')).find((node) => {
      const text = node.textContent?.trim();
      return text && /Step\s+\d+/i.test(text);
    });
    if (statusChip?.textContent) {
      return statusChip.textContent.trim();
    }
    const toggle = document.querySelector('#composer-toolbar-inspect-switch');
    if (toggle?.getAttribute('aria-checked') === 'true') {
      return 'Inspecting';
    }
    return undefined;
  }

  private emitStatus(status: InspectStatus, message?: string) {
    this.dispatchEvent(new CustomEvent<InspectStatusPayload>('status', { detail: { status, message } }));
  }
}

function parseStateVectorText(text: string): Complex[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) {
    return null;
  }
  const inner = trimmed.slice(1, -1);
  const entries = inner.split(',');
  const vector: Complex[] = [];
  for (const entry of entries) {
    const parsed = parseComplexText(entry.trim());
    if (!parsed) {
      return null;
    }
    vector.push(parsed);
  }
  return vector;
}

function hashState(state: Complex[]): string {
  return state
    .map((amp) => `${amp.real.toFixed(6)}:${amp.imag.toFixed(6)}`)
    .join('|');
}

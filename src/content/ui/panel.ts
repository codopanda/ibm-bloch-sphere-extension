import { computeBlochVectors, BlochVector } from '../../lib/state.js';
import { InspectSample, InspectStatus } from '../inspectScraper.js';
import { BlochSphereCanvas } from './blochSphere.js';

interface QubitCard {
  container: HTMLDivElement;
  sphere: BlochSphereCanvas;
  stats: Record<string, HTMLElement>;
  update: (vector: BlochVector) => void;
}

export type PanelVisibility = 'visible' | 'hidden';

export class BlochPanel {
  private root: HTMLElement;

  private shadow: ShadowRoot;

  private wrapper: HTMLDivElement;

  private titleEl: HTMLDivElement;

  private body: HTMLDivElement;

  private statusEl: HTMLDivElement;

  private qubitHost: HTMLDivElement;

  private stepLabelEl: HTMLSpanElement;

  private updatedEl: HTMLSpanElement;

  private collapsed = false;

  private cards = new Map<number, QubitCard>();

  private visibility: PanelVisibility = 'visible';

  private dragState: { pointerId: number; offsetX: number; offsetY: number } | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'ibm-bloch-overlay-root';
    this.shadow = this.root.attachShadow({ mode: 'open' });
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'panel';
    this.wrapper.innerHTML = this.buildTemplate();
    this.shadow.appendChild(this.createStyles());
    this.shadow.appendChild(this.wrapper);

    this.titleEl = this.wrapper.querySelector('.panel__title') as HTMLDivElement;
    this.body = this.wrapper.querySelector('.panel__body') as HTMLDivElement;
    this.statusEl = this.wrapper.querySelector('.panel__status') as HTMLDivElement;
    this.qubitHost = this.wrapper.querySelector('.panel__qubits') as HTMLDivElement;
    this.stepLabelEl = this.wrapper.querySelector('.panel__step-label') as HTMLSpanElement;
    this.updatedEl = this.wrapper.querySelector('.panel__updated') as HTMLSpanElement;

    const collapseBtn = this.wrapper.querySelector('[data-action="collapse"]') as HTMLButtonElement;
    const closeBtn = this.wrapper.querySelector('[data-action="close"]') as HTMLButtonElement;
    const header = this.wrapper.querySelector('.panel__header') as HTMLDivElement;
    collapseBtn.addEventListener('click', () => this.toggleCollapse());
    closeBtn.addEventListener('click', () => this.hide());
    header.addEventListener('pointerdown', (event) => this.beginDrag(event));

    this.applyVersionLabel();
  }

  mount(target: ParentNode = document.body) {
    target.appendChild(this.root);
  }

  show() {
    this.visibility = 'visible';
    this.wrapper.style.display = 'flex';
  }

  hide() {
    this.visibility = 'hidden';
    this.wrapper.style.display = 'none';
  }

  toggleVisibility() {
    if (this.visibility === 'visible') {
      this.hide();
    } else {
      this.show();
    }
  }

  setStatus(status: InspectStatus, message?: string) {
    const text = message ?? this.messageForStatus(status);
    this.statusEl.textContent = text;
    this.statusEl.dataset.tone = status;
  }

  renderSample(sample: InspectSample) {
    const { vectors } = computeBlochVectors(sample.stateVector);
    this.stepLabelEl.textContent = sample.label ?? `Step ${sample.stepIndex + 1}`;
    const formatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.updatedEl.textContent = `Updated ${formatter.format(new Date(sample.lastUpdated))}`;

    const seen = new Set<number>();
    for (const vector of vectors) {
      seen.add(vector.index);
      this.getCard(vector.index).update(vector);
    }

    // Remove cards that no longer exist
    for (const [index, card] of this.cards.entries()) {
      if (!seen.has(index)) {
        card.container.remove();
        this.cards.delete(index);
      }
    }
  }

  private getCard(index: number): QubitCard {
    if (this.cards.has(index)) {
      return this.cards.get(index)!;
    }

    const container = document.createElement('div');
    container.className = 'qubit-card';
    const title = document.createElement('div');
    title.className = 'qubit-card__title';
    title.textContent = `Qubit q${index}`;

    const sphere = new BlochSphereCanvas(150);
    const statsHost = document.createElement('dl');
    statsHost.className = 'qubit-card__stats';

    const stats: Record<string, HTMLElement> = {};
    for (const key of ['x', 'y', 'z', 'theta', 'phi']) {
      const dt = document.createElement('dt');
      dt.textContent = key.toUpperCase();
      const dd = document.createElement('dd');
      dd.textContent = '--';
      stats[key] = dd;
      statsHost.appendChild(dt);
      statsHost.appendChild(dd);
    }

    container.appendChild(title);
    container.appendChild(sphere.element);
    container.appendChild(statsHost);
    this.qubitHost.appendChild(container);

    const card: QubitCard = {
      container,
      sphere,
      stats,
      update: (vector) => {
        sphere.render(vector);
        stats.x.textContent = vector.x.toFixed(2);
        stats.y.textContent = vector.y.toFixed(2);
        stats.z.textContent = vector.z.toFixed(2);
        stats.theta.textContent = radToDeg(vector.theta).toFixed(1) + '°';
        stats.phi.textContent = radToDeg(vector.phi).toFixed(1) + '°';
      }
    };

    this.cards.set(index, card);
    return card;
  }

  private toggleCollapse() {
    this.collapsed = !this.collapsed;
    this.wrapper.classList.toggle('panel--collapsed', this.collapsed);
  }

  private beginDrag(event: PointerEvent) {
    if (!(event.buttons & 1)) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    const rect = this.wrapper.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    this.wrapper.setPointerCapture(event.pointerId);
    this.wrapper.style.right = 'auto';
    this.wrapper.style.left = `${rect.left}px`;
    this.wrapper.style.top = `${rect.top}px`;
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    event.preventDefault();
  }

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }
    const newLeft = clamp(event.clientX - this.dragState.offsetX, 8, window.innerWidth - this.wrapper.offsetWidth - 8);
    const newTop = clamp(event.clientY - this.dragState.offsetY, 8, window.innerHeight - this.wrapper.offsetHeight - 8);
    this.wrapper.style.left = `${newLeft}px`;
    this.wrapper.style.top = `${newTop}px`;
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }
    this.wrapper.releasePointerCapture(event.pointerId);
    this.dragState = null;
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
  };

  private messageForStatus(status: InspectStatus): string {
    switch (status) {
      case 'connected':
        return 'Inspect view detected';
      case 'collecting':
        return 'Updating from Inspect view…';
      case 'error':
        return 'Unable to read Inspect view';
      default:
        return 'Open Inspect view to start tracking';
    }
  }

  private createStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
      }
      .panel {
        position: fixed;
        top: 72px;
        right: 32px;
        width: 360px;
        max-height: 80vh;
        color: #e2e8f0;
        font-family: 'IBM Plex Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: rgba(2, 6, 23, 0.95);
        border: 1px solid rgba(148, 163, 184, 0.4);
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(2, 6, 23, 0.55);
        display: flex;
        flex-direction: column;
        z-index: 2147483647;
        backdrop-filter: blur(12px);
      }
      .panel__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: rgba(15, 23, 42, 0.9);
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        cursor: grab;
        user-select: none;
      }
      .panel__title {
        font-size: 14px;
        font-weight: 600;
      }
      .panel__actions {
        display: flex;
        gap: 4px;
      }
      .panel__actions button {
        background: none;
        border: none;
        color: #94a3b8;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        cursor: pointer;
      }
      .panel__actions button:hover {
        background: rgba(148, 163, 184, 0.2);
        color: #f8fafc;
      }
      .panel__body {
        padding: 12px 16px 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .panel__meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: #cbd5f5;
      }
      .panel__status {
        font-size: 12px;
        color: #94a3b8;
      }
      .panel__status[data-tone="collecting"] {
        color: #fcd34d;
      }
      .panel__status[data-tone="error"] {
        color: #f87171;
      }
      .panel__qubits {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .qubit-card {
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 12px;
        padding: 12px;
        background: rgba(15, 23, 42, 0.8);
      }
      .qubit-card__title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .qubit-card canvas {
        border-radius: 12px;
        margin-bottom: 8px;
        display: block;
      }
      .qubit-card__stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px 12px;
        margin: 0;
      }
      .qubit-card__stats dt {
        font-size: 11px;
        text-transform: uppercase;
        color: #94a3b8;
      }
      .qubit-card__stats dd {
        margin: 0;
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }
      .panel--collapsed .panel__body {
        display: none;
      }
    `;
    return style;
  }

  private buildTemplate(): string {
    return `
      <div class="panel__header">
        <div class="panel__title">Bloch Inspector</div>
        <div class="panel__actions">
          <button data-action="collapse" title="Collapse">▁</button>
          <button data-action="close" title="Hide">✕</button>
        </div>
      </div>
      <div class="panel__body">
        <div class="panel__meta">
          <span class="panel__step-label">Waiting for steps…</span>
          <span class="panel__updated">—</span>
          <div class="panel__status" data-tone="disconnected">Open Inspect view to start tracking</div>
        </div>
        <div class="panel__qubits"></div>
      </div>
    `;
  }

  private applyVersionLabel() {
    try {
      const version = chrome?.runtime?.getManifest?.().version;
      if (version) {
        this.titleEl.textContent = `Bloch Inspector v${version}`;
      }
    } catch (error) {
      // Fallback to default title when manifest access fails
    }
  }
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

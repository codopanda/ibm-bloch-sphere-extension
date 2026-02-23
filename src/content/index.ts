import { BlochPanel } from './ui/panel.js';
import { InspectScraper, InspectSample, InspectStatus, InspectStatusPayload } from './inspectScraper.js';

declare global {
  interface Window {
    ibmBlochInspector?: {
      pushSample(sample: InspectSample): void;
      toggle(): void;
    };
  }
}

async function bootstrap() {
  const panel = new BlochPanel();
  panel.mount(document.documentElement);
  const scraper = new InspectScraper();

  const { autoEnable } = await chrome.storage.sync.get({ autoEnable: true });
  if (autoEnable) {
    panel.show();
  } else {
    panel.hide();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.autoEnable) {
      return;
    }
    if (changes.autoEnable.newValue) {
      panel.show();
    } else {
      panel.hide();
    }
  });

  scraper.addEventListener('status', (event) => {
    const statusEvent = event as CustomEvent<InspectStatusPayload>;
    panel.setStatus(statusEvent.detail.status, statusEvent.detail.message);
  });

  scraper.addEventListener('state', (event) => {
    const stateEvent = event as CustomEvent<InspectSample>;
    panel.setStatus('collecting');
    panel.renderSample(stateEvent.detail);
    panel.setStatus('connected', 'Tracking Inspect view');
  });

  document.addEventListener('keydown', (event) => {
    if (event.altKey && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      panel.toggleVisibility();
    }
  });

  window.ibmBlochInspector = {
    pushSample: (sample: InspectSample) => panel.renderSample(sample),
    toggle: () => panel.toggleVisibility()
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

const toggle = document.getElementById('toggle-enabled') as HTMLInputElement | null;

async function init() {
  if (!toggle) {
    return;
  }

  const { autoEnable } = await chrome.storage.sync.get({ autoEnable: true });
  toggle.checked = autoEnable;

  toggle.addEventListener('change', () => {
    chrome.storage.sync.set({ autoEnable: toggle.checked });
  });
}

document.addEventListener('DOMContentLoaded', init);

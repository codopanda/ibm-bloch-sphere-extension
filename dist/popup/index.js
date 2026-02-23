// src/popup/index.ts
var toggle = document.getElementById("toggle-enabled");
async function init() {
  if (!toggle) {
    return;
  }
  const { autoEnable } = await chrome.storage.sync.get({ autoEnable: true });
  toggle.checked = autoEnable;
  toggle.addEventListener("change", () => {
    chrome.storage.sync.set({ autoEnable: toggle.checked });
  });
}
document.addEventListener("DOMContentLoaded", init);
//# sourceMappingURL=index.js.map

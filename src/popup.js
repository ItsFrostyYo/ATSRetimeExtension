"use strict";
const RETIMES_EXPORT_ALL_FORMAT = "ats-retimes-all-v1";

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function cleanTitle(rawTitle) {
  if (!rawTitle) return "Untitled";
  return rawTitle
    .replace(/\s*-\s*YouTube$/i, "")
    .replace(/\s*-\s*Twitch$/i, "")
    .trim() || "Untitled";
}

function sourceFromUrl(urlString) {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "Youtube";
    if (host.includes("twitch.tv")) return "Twitch";
    if (host.includes("bilibili.com")) return "BiliBili";
    if (host.includes("speedrun.com")) return "Speedrun.com";
    return host.replace(/^www\./, "");
  } catch (_error) {
    return "this site";
  }
}

async function detectEmbeddedSource(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const pickSource = (host) => {
          const h = String(host || "").toLowerCase();
          if (h.includes("youtube.com") || h.includes("youtu.be")) return "Youtube";
          if (h.includes("twitch.tv")) return "Twitch";
          if (h.includes("bilibili.com")) return "BiliBili";
          return null;
        };
        const frames = Array.from(document.querySelectorAll("iframe[src]"));
        for (const frame of frames) {
          try {
            const host = new URL(frame.src, location.href).hostname;
            const source = pickSource(host);
            if (source) return source;
          } catch (_error) {}
        }
        return null;
      }
    });
    return results?.[0]?.result || null;
  } catch (_error) {
    return null;
  }
}

async function getTabEnabled(tabId) {
  const response = await chrome.runtime.sendMessage({
    type: "ATS_GET_TAB_STATE",
    tabId
  });
  if (!response || !response.ok) return false;
  return Boolean(response.enabled);
}

async function setTabEnabled(tabId, enabled) {
  const response = await chrome.runtime.sendMessage({
    type: "ATS_SET_TAB_STATE",
    tabId,
    enabled
  });
  return Boolean(response && response.ok);
}

async function getTabLabelMode(tabId) {
  const response = await chrome.runtime.sendMessage({
    type: "ATS_GET_TAB_LABEL_MODE",
    tabId
  });
  if (!response || !response.ok) return "IGT";
  return response.mode === "LRT" ? "LRT" : "IGT";
}

async function setTabLabelMode(tabId, mode) {
  const response = await chrome.runtime.sendMessage({
    type: "ATS_SET_TAB_LABEL_MODE",
    tabId,
    mode
  });
  return Boolean(response && response.ok);
}

async function saveCurrentRetime(tabId) {
  return await chrome.runtime.sendMessage({
    type: "ATS_SAVE_CURRENT_RETIME",
    tabId
  });
}

async function exportSavedRetimes() {
  return await chrome.runtime.sendMessage({
    type: "ATS_EXPORT_SAVED_RETIMES"
  });
}

async function importSavedRetimes(data) {
  return await chrome.runtime.sendMessage({
    type: "ATS_IMPORT_SAVED_RETIMES",
    data
  });
}

async function initPopup() {
  const logoImg = document.getElementById("logo-img");
  const siteLabel = document.getElementById("site-label");
  const toggleBtn = document.getElementById("toggle-btn");
  const labelMode = document.getElementById("label-mode");
  const saveBtn = document.getElementById("save-btn");
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  const saveStatus = document.getElementById("save-status");
  logoImg.src = chrome.runtime.getURL("assets/icons/icon128.png");

  function setStatus(text) {
    saveStatus.textContent = text || "";
  }

  const tab = await getActiveTab();
  if (!tab || !tab.id) {
    toggleBtn.textContent = "Unavailable";
    toggleBtn.disabled = true;
    labelMode.disabled = true;
    saveBtn.disabled = true;
    exportBtn.disabled = true;
    importBtn.disabled = true;
    importFile.disabled = true;
    siteLabel.textContent = "Current Tab: Unavailable";
    setStatus("No active tab.");
    return;
  }

  const source = (await detectEmbeddedSource(tab.id)) || sourceFromUrl(tab.url || "");
  const title = cleanTitle(tab.title || "");
  siteLabel.textContent = `Current Tab: On ${source} Retiming a Speedrun - ${title}`;

  async function refreshUi() {
    const [enabled, mode] = await Promise.all([
      getTabEnabled(tab.id),
      getTabLabelMode(tab.id)
    ]);
    toggleBtn.textContent = enabled ? "Disable" : "Enable";
    toggleBtn.disabled = false;
    toggleBtn.dataset.enabled = enabled ? "1" : "0";
    labelMode.value = mode;
    labelMode.dataset.mode = mode;
    labelMode.disabled = false;
    saveBtn.disabled = false;
    exportBtn.disabled = false;
    importBtn.disabled = false;
    importFile.disabled = false;
  }

  toggleBtn.disabled = true;
  labelMode.disabled = true;
  saveBtn.disabled = true;
  exportBtn.disabled = true;
  importBtn.disabled = true;
  importFile.disabled = true;
  await refreshUi();

  toggleBtn.addEventListener("click", async () => {
    toggleBtn.disabled = true;
    const currentlyEnabled = toggleBtn.dataset.enabled === "1";
    const ok = await setTabEnabled(tab.id, !currentlyEnabled);
    if (!ok) setStatus("Failed to update enable state.");
    await refreshUi();
  });

  labelMode.addEventListener("change", async () => {
    const previous = labelMode.dataset.mode || "IGT";
    const next = labelMode.value === "LRT" ? "LRT" : "IGT";
    labelMode.disabled = true;
    const ok = await setTabLabelMode(tab.id, next);
    if (!ok) {
      labelMode.value = previous;
      setStatus("Failed to change time label.");
    } else {
      labelMode.dataset.mode = next;
      setStatus(`Time label set to ${next}.`);
    }
    await refreshUi();
  });

  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    setStatus("Saving retime for this site...");
    const result = await saveCurrentRetime(tab.id);
    if (result?.ok) {
      setStatus(`Saved for key: ${result.key}`);
    } else {
      const reason = result?.error ? ` (${result.error})` : "";
      setStatus(`Save failed${reason}. Make sure ATS is enabled on this tab.`);
    }
    saveBtn.disabled = false;
  });

  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    const result = await exportSavedRetimes();
    if (!result?.ok) {
      const reason = result?.error ? ` (${result.error})` : "";
      setStatus(`Export failed${reason}.`);
      exportBtn.disabled = false;
      return;
    }

    const all = result.data && typeof result.data === "object" ? result.data : {};
    const payload = {
      format: RETIMES_EXPORT_ALL_FORMAT,
      exportedAt: Date.now(),
      count: Object.keys(all).length,
      retimes: all
    };
    const fileName = "ats-saved-retimes-all.json";
    const json = JSON.stringify(payload, null, 2);
    let downloaded = false;
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      downloaded = true;
    } catch (_error) {}
    if (!downloaded) {
      window.prompt("Copy your saved retime JSON file contents:", json);
      setStatus("Download failed. JSON opened for manual copy.");
    } else {
      setStatus(`Exported ${payload.count} saved site retime(s) to ${fileName}.`);
    }
    exportBtn.disabled = false;
  });

  importBtn.addEventListener("click", async () => {
    importFile.value = "";
    importFile.click();
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;

    importBtn.disabled = true;
    importFile.disabled = true;
    let parsed;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch (_error) {
      setStatus("Import failed: invalid JSON file.");
      importBtn.disabled = false;
      importFile.disabled = false;
      return;
    }

    const result = await importSavedRetimes(parsed);
    if (result?.ok) {
      const count = Number(result.count) || 0;
      const total = Number(result.total) || 0;
      setStatus(`Imported ${count} entry(s). Total saved: ${total}.`);
    } else {
      const reason = result?.error ? ` (${result.error})` : "";
      setStatus(`Import failed${reason}.`);
    }
    importBtn.disabled = false;
    importFile.disabled = false;
  });
}

void initPopup();

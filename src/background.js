"use strict";

const ENABLED_TABS_KEY = "ats_enabled_tabs_v1";
const TAB_LABEL_MODE_KEY = "ats_tab_label_mode_v1";
const LABEL_MODE_DEFAULT_KEY = "ats_label_mode_default_v1";
const SAVED_RETIMES_KEY = "ats_saved_retimes_v1";
const FRAME_REGISTRY = new Map();
const RETIME_EXPORT_FORMAT = "ats-site-retime-v1";
const RETIMES_EXPORT_ALL_FORMAT = "ats-retimes-all-v1";

async function getEnabledTabsMap() {
  const data = await chrome.storage.session.get(ENABLED_TABS_KEY);
  return data[ENABLED_TABS_KEY] || {};
}

async function setEnabledTabsMap(map) {
  await chrome.storage.session.set({ [ENABLED_TABS_KEY]: map });
}

async function getSavedRetimesMap() {
  const data = await chrome.storage.local.get(SAVED_RETIMES_KEY);
  const map = data[SAVED_RETIMES_KEY];
  return map && typeof map === "object" ? map : {};
}

async function setSavedRetimesMap(map) {
  await chrome.storage.local.set({ [SAVED_RETIMES_KEY]: map });
}

function normalizePersistKeyFromUrl(urlString) {
  try {
    const x = new URL(urlString);
    const h = x.hostname.toLowerCase().replace(/^www\./, "");
    const p = x.pathname || "/";
    const q = x.searchParams;

    if (h === "youtu.be") {
      const id = p.split("/").filter(Boolean)[0];
      if (id) return `youtube:${id}`;
    }
    if (h.includes("youtube.com")) {
      const v = q.get("v");
      if (v) return `youtube:${v}`;
      const e = p.match(/\/embed\/([^/?#]+)/i);
      if (e) return `youtube:${e[1]}`;
      const s = p.match(/\/shorts\/([^/?#]+)/i);
      if (s) return `youtube:${s[1]}`;
    }
    if (h.includes("twitch.tv")) {
      const m = p.match(/\/videos\/(\d+)/i);
      if (m) return `twitch:${m[1]}`;
      const qv = q.get("video") || q.get("v");
      if (qv) {
        const n = String(qv).replace(/^v/i, "");
        if (/^\d+$/.test(n)) return `twitch:${n}`;
      }
    }
    return `url:${h}${p}`;
  } catch (_error) {
    return "";
  }
}

async function getTabPersistInfo(tabId) {
  const tab = await chrome.tabs.get(tabId);
  const url = String(tab?.url || "");
  const key = normalizePersistKeyFromUrl(url);
  return {
    key,
    url,
    title: String(tab?.title || "")
  };
}

function parseImportedRetimes(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  if (data.format === RETIMES_EXPORT_ALL_FORMAT && data.retimes && typeof data.retimes === "object") {
    const cleanAll = {};
    for (const [key, value] of Object.entries(data.retimes)) {
      if (!key || typeof value !== "object" || value === null) continue;
      cleanAll[key] = value;
    }
    return cleanAll;
  }

  if (data.format === RETIME_EXPORT_FORMAT && data.key && data.entry && typeof data.entry === "object") {
    return { [String(data.key)]: data.entry };
  }

  if (data.key && data.state && typeof data.state === "object") {
    return {
      [String(data.key)]: {
        ...data.state,
        savedAt: Number.isFinite(data.savedAt) ? data.savedAt : Date.now(),
        title: typeof data.title === "string" ? data.title : ""
      }
    };
  }

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (!key || typeof value !== "object" || value === null) continue;
    clean[key] = value;
  }
  return clean;
}

async function getTabLabelModeMap() {
  const data = await chrome.storage.session.get(TAB_LABEL_MODE_KEY);
  return data[TAB_LABEL_MODE_KEY] || {};
}

async function setTabLabelModeMap(map) {
  await chrome.storage.session.set({ [TAB_LABEL_MODE_KEY]: map });
}

function normalizeLabelMode(mode) {
  return mode === "LRT" ? "LRT" : "IGT";
}

async function getDefaultLabelMode() {
  const data = await chrome.storage.local.get(LABEL_MODE_DEFAULT_KEY);
  return normalizeLabelMode(data[LABEL_MODE_DEFAULT_KEY]);
}

async function setDefaultLabelMode(mode) {
  await chrome.storage.local.set({ [LABEL_MODE_DEFAULT_KEY]: normalizeLabelMode(mode) });
}

async function getTabLabelMode(tabId) {
  const map = await getTabLabelModeMap();
  const tabMode = map[String(tabId)];
  if (tabMode === "LRT" || tabMode === "IGT") {
    return tabMode;
  }
  return await getDefaultLabelMode();
}

async function setTabLabelMode(tabId, mode) {
  const map = await getTabLabelModeMap();
  const normalized = normalizeLabelMode(mode);
  map[String(tabId)] = normalized;
  await setTabLabelModeMap(map);
  await setDefaultLabelMode(normalized);
}

async function isTabEnabled(tabId) {
  const map = await getEnabledTabsMap();
  return Boolean(map[String(tabId)]);
}

async function setTabEnabled(tabId, enabled) {
  const map = await getEnabledTabsMap();
  if (enabled) {
    map[String(tabId)] = true;
  } else {
    delete map[String(tabId)];
  }
  await setEnabledTabsMap(map);
}

async function injectATS(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["src/content.js"]
  });
}

async function disableATS(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    func: () => {
      if (typeof window.__ASSEMBLY_TIMESHARP_DISABLE__ === "function") {
        window.__ASSEMBLY_TIMESHARP_DISABLE__();
      }
    }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (!message || !message.type) {
      sendResponse({ ok: false });
      return;
    }

    if (message.type === "ATS_GET_TAB_STATE") {
      const tabId = Number(message.tabId);
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false });
        return;
      }
      sendResponse({ ok: true, enabled: await isTabEnabled(tabId) });
      return;
    }

    if (message.type === "ATS_SET_TAB_STATE") {
      const tabId = Number(message.tabId);
      const enabled = Boolean(message.enabled);
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false });
        return;
      }

      await setTabEnabled(tabId, enabled);
      if (enabled) {
        await injectATS(tabId);
      } else {
        await disableATS(tabId);
      }
      sendResponse({ ok: true, enabled });
      return;
    }

    if (message.type === "ATS_GET_TAB_LABEL_MODE") {
      const tabId = Number(message.tabId);
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false });
        return;
      }
      sendResponse({ ok: true, mode: await getTabLabelMode(tabId) });
      return;
    }

    if (message.type === "ATS_SET_TAB_LABEL_MODE") {
      const tabId = Number(message.tabId);
      const mode = normalizeLabelMode(message.mode);
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false });
        return;
      }
      await setTabLabelMode(tabId, mode);
      try {
        await chrome.tabs.sendMessage(tabId, { type: "ATS_SET_LABEL_MODE", mode });
      } catch (_error) {
        // Content script may not be injected yet; mode is still persisted.
      }
      sendResponse({ ok: true, mode });
      return;
    }

    if (message.type === "ATS_GET_LABEL_MODE") {
      const sender = _sender;
      const tabId = sender?.tab?.id;
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false });
        return;
      }
      sendResponse({ ok: true, mode: await getTabLabelMode(tabId) });
      return;
    }

    if (message.type === "ATS_SAVE_CURRENT_RETIME") {
      const tabId = Number(message.tabId);
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false, error: "invalid_tab" });
        return;
      }
      try {
        let payload = null;
        const registered = Array.from(FRAME_REGISTRY.get(tabId) || []);
        const candidates = [0, ...registered.filter((id) => id !== 0)];
        for (const frameId of candidates) {
          try {
            const response = await chrome.tabs.sendMessage(
              tabId,
              { type: "ATS_COLLECT_STATE_FOR_SAVE" },
              { frameId }
            );
            if (response?.ok) {
              payload = response;
              break;
            }
          } catch (_error) {
            // Try next frame.
          }
        }
        if (!payload?.ok || !payload?.key || !payload?.state) {
          sendResponse({ ok: false, error: "no_state_or_not_enabled" });
          return;
        }
        const map = await getSavedRetimesMap();
        map[payload.key] = {
          ...payload.state,
          savedAt: Date.now(),
          title: payload.title || ""
        };
        await setSavedRetimesMap(map);
        sendResponse({ ok: true, key: payload.key });
      } catch (error) {
        sendResponse({ ok: false, error: String(error) });
      }
      return;
    }

    if (message.type === "ATS_GET_SAVED_RETIME") {
      const key = String(message.key || "");
      if (!key) {
        sendResponse({ ok: false, state: null });
        return;
      }
      const map = await getSavedRetimesMap();
      sendResponse({ ok: true, state: map[key] || null });
      return;
    }

    if (message.type === "ATS_EXPORT_SAVED_RETIMES") {
      const map = await getSavedRetimesMap();
      sendResponse({ ok: true, data: map });
      return;
    }

    if (message.type === "ATS_EXPORT_CURRENT_RETIME") {
      const tabId = Number(message.tabId);
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false, error: "invalid_tab" });
        return;
      }
      const info = await getTabPersistInfo(tabId);
      if (!info.key) {
        sendResponse({ ok: false, error: "invalid_url" });
        return;
      }
      const map = await getSavedRetimesMap();
      const entry = map[info.key];
      if (!entry || typeof entry !== "object") {
        sendResponse({ ok: false, error: "no_saved_retime_for_current_site", key: info.key });
        return;
      }
      sendResponse({
        ok: true,
        data: {
          format: RETIME_EXPORT_FORMAT,
          exportedAt: Date.now(),
          key: info.key,
          url: info.url,
          title: info.title,
          entry
        }
      });
      return;
    }

    if (message.type === "ATS_IMPORT_SAVED_RETIMES") {
      const incoming = message.data;
      const parsed = parseImportedRetimes(incoming);
      const incomingCount = Object.keys(parsed).length;
      if (incomingCount === 0) {
        sendResponse({ ok: false, error: "invalid_data" });
        return;
      }
      const map = await getSavedRetimesMap();
      for (const [key, value] of Object.entries(parsed)) {
        map[key] = value;
      }
      await setSavedRetimesMap(map);
      sendResponse({ ok: true, count: incomingCount, total: Object.keys(map).length });
      return;
    }

    if (message.type === "ATS_FRAME_REGISTER") {
      const sender = _sender;
      const tabId = sender?.tab?.id;
      const frameId = sender?.frameId;
      if (!Number.isInteger(tabId) || !Number.isInteger(frameId)) {
        sendResponse({ ok: false });
        return;
      }
      let frames = FRAME_REGISTRY.get(tabId);
      if (!frames) {
        frames = new Set();
        FRAME_REGISTRY.set(tabId, frames);
      }
      frames.add(frameId);
      sendResponse({ ok: true, frameId });
      return;
    }

    if (message.type === "ATS_QUERY_FRAMES_STATUS") {
      const sender = _sender;
      const tabId = sender?.tab?.id;
      if (!Number.isInteger(tabId)) {
        sendResponse({ ok: false, frames: [] });
        return;
      }

      const frames = FRAME_REGISTRY.get(tabId) || new Set([0]);
      const checks = Array.from(frames).map(async (frameId) => {
        try {
          const response = await chrome.tabs.sendMessage(
            tabId,
            { type: "ATS_FRAME_GET_STATUS" },
            { frameId }
          );
          if (response?.ok) {
            return { frameId, status: response.status, stale: false };
          }
          return { frameId, status: null, stale: true };
        } catch (_error) {
          return { frameId, status: null, stale: true };
        }
      });
      const results = await Promise.all(checks);
      const statuses = results
        .filter((item) => !item.stale && item.status)
        .map((item) => ({ frameId: item.frameId, status: item.status }));
      const staleFrames = results.filter((item) => item.stale).map((item) => item.frameId);

      if (staleFrames.length) {
        for (const staleFrame of staleFrames) {
          frames.delete(staleFrame);
        }
      }

      sendResponse({ ok: true, frames: statuses });
      return;
    }

    if (message.type === "ATS_RUN_FRAME_COMMAND") {
      const sender = _sender;
      const tabId = sender?.tab?.id;
      const frameId = Number(message.frameId);
      if (!Number.isInteger(tabId) || !Number.isInteger(frameId)) {
        sendResponse({ ok: false });
        return;
      }

      try {
        const response = await chrome.tabs.sendMessage(
          tabId,
          {
            type: "ATS_FRAME_COMMAND",
            command: message.command,
            payload: message.payload
          },
          { frameId }
        );
        sendResponse(response || { ok: false });
      } catch (error) {
        sendResponse({ ok: false, error: String(error) });
      }
      return;
    }

    sendResponse({ ok: false });
  })().catch((error) => {
    console.error("[ATS] Runtime message error:", error);
    sendResponse({ ok: false, error: String(error) });
  });

  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") {
    return;
  }
  try {
    if (await isTabEnabled(tabId)) {
      await injectATS(tabId);
    }
  } catch (error) {
    console.error("[ATS] Failed to auto-inject on tab update:", error);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    await setTabEnabled(tabId, false);
    const modes = await getTabLabelModeMap();
    delete modes[String(tabId)];
    await setTabLabelModeMap(modes);
    FRAME_REGISTRY.delete(tabId);
  } catch (error) {
    console.error("[ATS] Failed to cleanup tab state:", error);
  }
});

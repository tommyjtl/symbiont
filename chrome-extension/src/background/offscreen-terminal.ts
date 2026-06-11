const OFFSCREEN_URL = "offscreen/terminal.html";
const DEFAULT_BACKEND_URL = "http://127.0.0.1:7341";

async function getBackendUrl(): Promise<string> {
  const stored = await chrome.storage.sync.get("backendUrl");
  return (stored.backendUrl as string) || DEFAULT_BACKEND_URL;
}

export async function ensureOffscreenTerminal(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_URL),
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: "Relay interactive sandbox terminal WebSocket sessions.",
  });
}

export async function closeOffscreenTerminalIfIdle(): Promise<void> {
  if (!(await chrome.offscreen.hasDocument())) {
    return;
  }
  await chrome.offscreen.closeDocument();
}

function relayToOffscreen(message: Record<string, unknown>): void {
  void chrome.runtime.sendMessage(message);
}

function forwardToTab(tabId: number, payload: Record<string, unknown>): void {
  void chrome.tabs.sendMessage(tabId, payload).catch(() => {
    // Tab may have closed.
  });
}

export function registerOffscreenTerminalHandlers(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "terminal:to-tab") {
      const tabId = message.tabId as number | undefined;
      const payload = message.message as Record<string, unknown> | undefined;
      if (tabId && payload) {
        forwardToTab(tabId, payload);
      }
      return false;
    }

    if (message?.type === "terminal:ensure-offscreen") {
      ensureOffscreenTerminal()
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) =>
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      return true;
    }

    if (message?.type === "terminal:close-offscreen") {
      closeOffscreenTerminalIfIdle()
        .then(() => sendResponse({ ok: true }))
        .catch((err: unknown) =>
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      return true;
    }

    const tabId = sender.tab?.id;
    if (!tabId) return false;

    if (message?.type === "terminal:start") {
      ensureOffscreenTerminal()
        .then(async () => {
          const backendUrl = await getBackendUrl();
          relayToOffscreen({
            type: "terminal:run",
            tabId,
            recipeId: message.recipeId,
            code: message.code,
            cols: message.cols ?? 80,
            rows: message.rows ?? 12,
            backendUrl,
          });
          sendResponse({ ok: true });
        })
        .catch((err: unknown) =>
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          })
        );
      return true;
    }

    if (
      message?.type === "terminal:input" ||
      message?.type === "terminal:resize" ||
      message?.type === "terminal:stop"
    ) {
      relayToOffscreen({ ...message, tabId });
      return false;
    }

    return false;
  });
}

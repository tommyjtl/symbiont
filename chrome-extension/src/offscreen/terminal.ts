const DEFAULT_BACKEND_URL = "http://127.0.0.1:7341";
const ext = globalThis.chrome;

interface TerminalSession {
  ws: WebSocket;
  tabId: number;
}

const sessions = new Map<number, TerminalSession>();

function backendWsUrl(httpBase: string): string {
  return `${httpBase.replace(/^http/, "ws")}/sandbox/terminal`;
}

function postToTab(tabId: number, message: Record<string, unknown>): void {
  // Offscreen documents cannot use chrome.tabs — relay via the service worker.
  void ext.runtime.sendMessage({
    type: "terminal:to-tab",
    tabId,
    message,
  });
}

function closeSession(tabId: number): void {
  const session = sessions.get(tabId);
  if (!session) return;

  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.send(JSON.stringify({ type: "stop" }));
    session.ws.close();
  }
  sessions.delete(tabId);
}

function startSession(
  tabId: number,
  recipeId: string,
  code: string,
  cols: number,
  rows: number,
  backendUrl: string
): void {
  closeSession(tabId);

  const base = backendUrl || DEFAULT_BACKEND_URL;
  const ws = new WebSocket(backendWsUrl(base));
    ws.binaryType = "arraybuffer";
    sessions.set(tabId, { ws, tabId });

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          recipeId,
          files: { code },
          cols,
          rows,
        })
      );
      postToTab(tabId, { type: "terminal:open" });
    };

    ws.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "started") {
            postToTab(tabId, { type: "terminal:started" });
          } else {
            postToTab(tabId, { type: "terminal:json", data: event.data });
          }
        } catch {
          postToTab(tabId, { type: "terminal:json", data: event.data });
        }
      } else if (event.data instanceof ArrayBuffer) {
        postToTab(tabId, {
          type: "terminal:binary",
          data: new TextDecoder().decode(event.data),
        });
      } else if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then((buf) => {
          postToTab(tabId, {
            type: "terminal:binary",
            data: new TextDecoder().decode(buf),
          });
        });
      }
    };

    ws.onerror = () => {
      postToTab(tabId, {
        type: "terminal:error",
        message: "WebSocket connection failed",
      });
    };

    ws.onclose = () => {
      sessions.delete(tabId);
      postToTab(tabId, { type: "terminal:close" });
    };
}

ext.runtime.onMessage.addListener((message) => {
  if (message?.type === "terminal:run") {
    const tabId = message.tabId as number;
    if (!tabId) return false;
    startSession(
      tabId,
      message.recipeId as string,
      message.code as string,
      (message.cols as number) ?? 80,
      (message.rows as number) ?? 12,
      (message.backendUrl as string) || DEFAULT_BACKEND_URL
    );
    return false;
  }

  if (message?.type === "terminal:input") {
    const tabId = message.tabId as number;
    const session = tabId ? sessions.get(tabId) : undefined;
    if (session?.ws.readyState === WebSocket.OPEN && message.data !== undefined) {
      session.ws.send(new TextEncoder().encode(message.data));
    }
    return false;
  }

  if (message?.type === "terminal:resize") {
    const tabId = message.tabId as number;
    const session = tabId ? sessions.get(tabId) : undefined;
    if (session?.ws.readyState === WebSocket.OPEN) {
      session.ws.send(
        JSON.stringify({
          type: "resize",
          cols: message.cols,
          rows: message.rows,
        })
      );
    }
    return false;
  }

  if (message?.type === "terminal:stop") {
    const tabId = message.tabId as number;
    if (tabId) closeSession(tabId);
    return false;
  }

  return false;
});

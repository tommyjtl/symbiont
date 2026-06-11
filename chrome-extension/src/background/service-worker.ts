import type { ApiMessage, ApiResponse } from "../api/backend-client";
import type { ExecutionResult, HealthResponse, Session } from "../api/types";
import { registerOffscreenTerminalHandlers } from "./offscreen-terminal";

const DEFAULT_BACKEND_URL = "http://127.0.0.1:7341";

async function getBackendUrl(): Promise<string> {
  const stored = await chrome.storage.sync.get("backendUrl");
  return (stored.backendUrl as string) || DEFAULT_BACKEND_URL;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await getBackendUrl();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.detail ?? text;
    } catch {
      // keep raw text
    }
    throw new Error(detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

async function handleMessage(message: ApiMessage): Promise<ApiResponse> {
  try {
    switch (message.type) {
      case "api:health": {
        const data = await apiFetch<HealthResponse>("/health");
        return { ok: true, data };
      }
      case "api:run": {
        const data = await apiFetch<ExecutionResult>("/sandbox/run", {
          method: "POST",
          body: JSON.stringify({
            recipeId: message.recipeId,
            files: { code: message.code },
          }),
        });
        return { ok: true, data };
      }
      case "api:saveSession": {
        const data = await apiFetch<Session>("/session", {
          method: "POST",
          body: JSON.stringify(message.session),
        });
        return { ok: true, data };
      }
      case "api:getSession": {
        const data = await apiFetch<Session>(
          `/session?url=${encodeURIComponent(message.url)}`
        );
        return { ok: true, data };
      }
      case "api:patchSession": {
        const data = await apiFetch<Session>(`/session/${message.sessionId}`, {
          method: "PATCH",
          body: JSON.stringify(message.patch),
        });
        return { ok: true, data };
      }
      case "api:matchRecipe": {
        const data = await apiFetch<{ recipeId: string | null }>(
          `/recipes/match/${encodeURIComponent(message.language)}`
        );
        return { ok: true, data };
      }
      default:
        return { ok: false, error: "Unknown message type" };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

registerOffscreenTerminalHandlers();

chrome.runtime.onMessage.addListener((message: ApiMessage, _sender, sendResponse) => {
  if (typeof message?.type === "string" && message.type.startsWith("api:")) {
    handleMessage(message).then(sendResponse);
    return true;
  }
  return false;
});

// Periodic health check for popup badge
async function updateBadge() {
  try {
    const health = await apiFetch<HealthResponse>("/health");
    await chrome.action.setBadgeText({
      text: health.dockerOk ? "" : "!",
    });
    await chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
  } catch {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#e74c3c" });
  }
}

chrome.alarms.create("health-check", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "health-check") {
    updateBadge();
  }
});
updateBadge();

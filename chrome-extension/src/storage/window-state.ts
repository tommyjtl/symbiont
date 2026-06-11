import type { WindowState } from "../api/types";
import { extensionStorageGet, extensionStorageSet } from "../extension-api";

const DEFAULT_STATE: WindowState = {
  x: 24,
  y: 24,
  width: 520,
  height: 420,
};

function storageKey(url: string): string {
  return `window:${url}`;
}

export async function loadWindowState(url: string): Promise<WindowState> {
  const key = storageKey(url);
  const stored = await extensionStorageGet<Record<string, WindowState>>(key);
  return (stored[key] as WindowState) ?? { ...DEFAULT_STATE };
}

export async function saveWindowState(url: string, state: WindowState): Promise<void> {
  const key = storageKey(url);
  await extensionStorageSet({ [key]: state });
}

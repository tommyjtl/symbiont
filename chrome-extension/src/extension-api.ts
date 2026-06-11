type ExtensionChrome = typeof globalThis.chrome;

function extensionChrome(): ExtensionChrome {
  const api = globalThis.chrome;
  if (!api?.runtime) {
    throw new Error(
      "Symbiont extension APIs are unavailable. Reload this page after updating the extension."
    );
  }
  return api;
}

export function extensionGetURL(path: string): string {
  return extensionChrome().runtime.getURL(path);
}

export function extensionConnect(name: string): chrome.runtime.Port {
  return extensionChrome().runtime.connect({ name });
}

export function extensionSendMessage<T>(
  message: unknown,
  callback: (response: T) => void
): void {
  extensionChrome().runtime.sendMessage(message, callback);
}

export function extensionLastError(): chrome.runtime.LastError | undefined {
  return extensionChrome().runtime.lastError;
}

export async function extensionStorageGet<T extends Record<string, unknown>>(
  keys: string | string[] | T | null
): Promise<T> {
  return extensionChrome().storage.local.get(keys) as Promise<T>;
}

export async function extensionStorageSet(items: Record<string, unknown>): Promise<void> {
  await extensionChrome().storage.local.set(items);
}

export async function extensionSyncGet<T extends Record<string, unknown>>(
  keys: string | string[] | T | null
): Promise<T> {
  return extensionChrome().storage.sync.get(keys) as Promise<T>;
}

export function extensionSendMessageAsync<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    extensionSendMessage<T>(message, (response) => {
      const lastError = extensionLastError();
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

export function extensionOnMessage(
  listener: (message: unknown) => void
): void {
  extensionChrome().runtime.onMessage.addListener(listener);
}

export function extensionOffMessage(
  listener: (message: unknown) => void
): void {
  extensionChrome().runtime.onMessage.removeListener(listener);
}

export function extensionPostMessage(message: unknown): void {
  void extensionChrome().runtime.sendMessage(message);
}

export function extensionOnStorageChanged(
  listener: (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName
  ) => void
): void {
  extensionChrome().storage.onChanged.addListener(listener);
}

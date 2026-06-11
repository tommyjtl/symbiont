import { extensionSyncGet } from "../extension-api";

const STORAGE_KEY = "domainWhitelist";

export const DEFAULT_DOMAIN_WHITELIST_TEXT = `mojolang.org
docs.modular.com`;

export function parseDomainWhitelist(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function formatDomainWhitelist(domains: string[]): string {
  return domains.join("\n");
}

export async function loadDomainWhitelist(): Promise<string[]> {
  const stored = await extensionSyncGet<Record<string, string>>(STORAGE_KEY);
  const text = stored[STORAGE_KEY] ?? DEFAULT_DOMAIN_WHITELIST_TEXT;
  return parseDomainWhitelist(text);
}

export function isDomainAllowed(hostname: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) return false;

  const host = hostname.toLowerCase();
  return whitelist.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

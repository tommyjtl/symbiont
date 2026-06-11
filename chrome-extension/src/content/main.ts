import { detectCodeBlocks, isSymbiontNode } from "./detector";
import { attachToolbar } from "./toolbar";
import { openSandbox, SandboxWindow } from "../overlay/sandbox-window";
import { extensionOnStorageChanged } from "../extension-api";
import { isDomainAllowed, loadDomainWhitelist } from "../storage/domain-whitelist";

let activeSandbox: SandboxWindow | null = null;
const cleanupFns = new Map<HTMLElement, () => void>();
let scanScheduled = false;
let observer: MutationObserver | null = null;
let isScanning = false;
let symbiontEnabled = false;

function teardown(): void {
  if (activeSandbox) {
    activeSandbox.destroy();
    activeSandbox = null;
  }

  for (const cleanup of cleanupFns.values()) {
    cleanup();
  }
  cleanupFns.clear();

  observer?.disconnect();
  observer = null;
}

function openSandboxForBlock(element: HTMLElement, code: string, language: string | null): void {
  if (activeSandbox) {
    activeSandbox.destroy();
  }
  activeSandbox = openSandbox(element, code, language);
}

function scanPage(): void {
  if (!symbiontEnabled || isScanning) return;
  isScanning = true;

  try {
    const blocks = detectCodeBlocks();
    const activePres = new Set<HTMLElement>();

    for (const block of blocks) {
      const container = (block.element.closest("pre") ?? block.element) as HTMLElement;
      activePres.add(container);

      if (cleanupFns.has(container)) continue;

      const cleanup = attachToolbar(block.element, () => {
        openSandboxForBlock(block.element, block.code, block.language);
      });
      cleanupFns.set(container, cleanup);
    }

    for (const [container, cleanup] of cleanupFns) {
      if (!document.contains(container) || !activePres.has(container)) {
        cleanup();
        cleanupFns.delete(container);
      }
    }
  } finally {
    isScanning = false;
  }
}

function scheduleScan(): void {
  if (!symbiontEnabled || scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scanPage();
  });
}

function mutationHasRelevantNodes(mutations: MutationRecord[]): boolean {
  for (const mutation of mutations) {
    if (mutation.type === "attributes") continue;

    for (const node of mutation.addedNodes) {
      if (isSymbiontNode(node)) continue;
      if (node instanceof HTMLElement) {
        if (
          node.matches("pre, code") ||
          node.querySelector("pre, code")
        ) {
          return true;
        }
      }
    }

    for (const node of mutation.removedNodes) {
      if (node instanceof HTMLElement && cleanupFns.has(node)) {
        return true;
      }
    }
  }
  return false;
}

function observeMutations(): void {
  observer?.disconnect();
  observer = new MutationObserver((mutations) => {
    if (!symbiontEnabled || !mutationHasRelevantNodes(mutations)) return;
    scheduleScan();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

async function applyDomainPolicy(): Promise<void> {
  const whitelist = await loadDomainWhitelist();
  const allowed = isDomainAllowed(window.location.hostname, whitelist);

  if (!allowed) {
    symbiontEnabled = false;
    teardown();
    return;
  }

  symbiontEnabled = true;
  scanPage();
  observeMutations();
}

function init(): void {
  void applyDomainPolicy();

  extensionOnStorageChanged((changes, area) => {
    if (area !== "sync" || !changes.domainWhitelist) return;
    void applyDomainPolicy();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

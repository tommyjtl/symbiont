import { markEnhanced } from "./detector";

// Tune button placement here (pixels, relative to the code fence top-left).
// Positive offsetX moves right; negative offsetY moves up, positive moves down.
const BUTTON_OFFSET = {
  x: 0,
  y: -20,
  overlap: 4, // how far the button overlaps into the top of the fence (helps hover)
};

const TOOLBAR_HOST_CLASS = "symbiont-toolbar-host";
const toolbarByPre = new Map<HTMLElement, HTMLElement>();

export function attachToolbar(
  element: HTMLElement,
  onOpenSandbox: () => void
): () => void {
  const pre = (element.closest("pre") ?? element) as HTMLElement;

  if (toolbarByPre.has(pre)) {
    return () => detachToolbar(pre);
  }

  markEnhanced(pre);

  const host = document.createElement("div");
  host.className = TOOLBAR_HOST_CLASS;
  host.style.cssText = `
    position: fixed;
    z-index: 2147483646;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s ease;
  `;

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    button {
      all: unset;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: #1a73e8;
      color: #fff;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      white-space: nowrap;
      display: block;
    }
    button:hover { background: #1557b0; }
  `;

  const btn = document.createElement("button");
  btn.textContent = "Open Sandbox";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenSandbox();
  });

  shadow.append(style, btn);
  document.body.appendChild(host);
  toolbarByPre.set(pre, host);

  const positionHost = () => {
    const rect = pre.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const height = hostRect.height || 28;
    host.style.left = `${rect.left + BUTTON_OFFSET.x}px`;
    host.style.top = `${rect.top - height + BUTTON_OFFSET.overlap + BUTTON_OFFSET.y}px`;
  };

  const show = () => {
    positionHost();
    host.style.opacity = "1";
    host.style.pointerEvents = "auto";
  };

  const hide = () => {
    host.style.opacity = "0";
    host.style.pointerEvents = "none";
  };

  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleHide = () => {
    hideTimer = setTimeout(hide, 150);
  };
  const cancelHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const bindHover = (el: HTMLElement) => {
    el.addEventListener("mouseenter", () => {
      cancelHide();
      show();
    });
    el.addEventListener("mouseleave", scheduleHide);
  };

  const onScrollOrResize = () => {
    if (host.style.opacity === "1") {
      positionHost();
    }
  };

  bindHover(host);
  bindHover(pre);
  window.addEventListener("scroll", onScrollOrResize, true);
  window.addEventListener("resize", onScrollOrResize);

  return () => {
    window.removeEventListener("scroll", onScrollOrResize, true);
    window.removeEventListener("resize", onScrollOrResize);
    detachToolbar(pre);
  };
}

function detachToolbar(pre: HTMLElement): void {
  const host = toolbarByPre.get(pre);
  host?.remove();
  toolbarByPre.delete(pre);
  pre.removeAttribute("data-symbiont-enhanced");
}

import {
  buildContext,
  getSession,
  patchSession,
  saveSession,
} from "../api/backend-client";
import type { CodeBlockContext, Session } from "../api/types";
import { loadWindowState, saveWindowState } from "../storage/window-state";
import { createEditor } from "./editor";
import { overlayStyles, xtermStyles } from "./bundled-styles";
import { TerminalSession } from "./terminal-session";
import { MojoSnippet, wrapInMain } from "../mojo/snippet";

export interface SandboxWindowOptions {
  context: CodeBlockContext;
  onClose?: () => void;
}

export class SandboxWindow {
  private host: HTMLElement;
  private shadow: ShadowRoot;
  private editorView: ReturnType<typeof createEditor> | null = null;
  private context: CodeBlockContext;
  private session: Session | null = null;
  private originalCode: string;
  private currentCode: string;
  private terminalContainer: HTMLElement;
  private terminalSession: TerminalSession | null = null;
  private statusEl: HTMLElement;
  private wrapMainBtn: HTMLButtonElement | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private onClose?: () => void;

  constructor(options: SandboxWindowOptions) {
    this.context = options.context;
    this.originalCode = options.context.code;
    this.currentCode = options.context.code;
    this.onClose = options.onClose;

    this.host = document.createElement("div");
    this.host.id = "symbiont-sandbox-host";
    this.shadow = this.host.attachShadow({ mode: "open" });

    const overlayStyle = document.createElement("style");
    overlayStyle.textContent = overlayStyles;

    const xtermStyle = document.createElement("style");
    xtermStyle.textContent = xtermStyles;

    const windowEl = document.createElement("div");
    windowEl.className = "symbiont-window";
    windowEl.innerHTML = `
      <div class="symbiont-titlebar" data-drag>
        <span class="symbiont-title">Symbiont · ${this.escapeHtml(this.context.recipeId)}</span>
        <div class="symbiont-titlebar-actions">
          <button type="button" data-action="minimize" title="Minimize">−</button>
          <button type="button" data-action="close" title="Close">×</button>
        </div>
      </div>
      <div class="symbiont-body">
        <div class="symbiont-meta-row">
          <div class="symbiont-meta">${this.escapeHtml(this.context.nearestHeading || this.context.pageTitle)}</div>
          <button
            type="button"
            class="symbiont-btn ghost"
            data-action="wrap-main"
            title="Wrap snippet in a main() entry point"
            hidden
          >Wrap in main</button>
        </div>
        <div class="symbiont-editor" id="editor"></div>
        <div class="symbiont-toolbar-row">
          <button type="button" class="symbiont-btn primary" data-action="run">Run</button>
          <button type="button" class="symbiont-btn" data-action="reset">Reset</button>
          <button type="button" class="symbiont-btn" data-action="save">Save</button>
          <span class="symbiont-status" data-status>Ready</span>
        </div>
        <div class="symbiont-output">
          <div class="symbiont-output-header">Terminal</div>
          <div class="symbiont-terminal" data-terminal></div>
        </div>
      </div>
    `;

    this.shadow.append(overlayStyle, xtermStyle, windowEl);
    document.body.appendChild(this.host);

    this.terminalContainer = this.shadow.querySelector("[data-terminal]")!;
    this.statusEl = this.shadow.querySelector("[data-status]")!;
    this.wrapMainBtn = this.shadow.querySelector('[data-action="wrap-main"]');

    this.bindEvents(windowEl);
    this.init();
  }

  private async init(): Promise<void> {
    const editorParent = this.shadow.querySelector("#editor") as HTMLElement;
    this.editorView = createEditor(
      editorParent,
      this.currentCode,
      this.context.language,
      (code) => {
        this.currentCode = code;
        this.updateWrapMainButton();
        this.scheduleSave();
      },
      this.context.recipeId
    );

    const state = await loadWindowState(this.context.url);
    const windowEl = this.shadow.querySelector(".symbiont-window") as HTMLElement;
    windowEl.style.left = `${state.x}px`;
    windowEl.style.top = `${state.y}px`;
    windowEl.style.width = `${state.width}px`;
    windowEl.style.height = `${state.height}px`;

    this.enableDrag(windowEl);
    this.enableResize(windowEl);
    this.updateWrapMainButton();

    // Open Sandbox always starts from the clicked code block on the page.
    // Sessions are still saved on edit/run for future per-block resume, but
    // we do not auto-restore here (that was overwriting fresh page content).
    const existing = await getSession(this.context.url);
    if (
      existing &&
      existing.originalCode === this.originalCode &&
      existing.currentCode !== this.originalCode
    ) {
      this.session = existing;
    }
  }

  private bindEvents(windowEl: HTMLElement): void {
    windowEl.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const action = target.closest("[data-action]")?.getAttribute("data-action");
      if (!action) return;

      switch (action) {
        case "run":
          void this.handleRun();
          break;
        case "reset":
          this.handleReset();
          break;
        case "wrap-main":
          this.handleWrapMain();
          break;
        case "save":
          void this.handleSave();
          break;
        case "close":
          this.destroy();
          break;
        case "minimize":
          windowEl.classList.toggle("minimized");
          break;
      }
    });
  }

  private async handleRun(): Promise<void> {
    this.stopTerminal();
    this.setStatus("Running...");

    this.terminalSession = new TerminalSession({
      container: this.terminalContainer,
      recipeId: this.context.recipeId,
      code: this.currentCode,
      onStarted: () => this.setStatus("Running — type in terminal"),
      onExit: (exitCode) => {
        this.setStatus(exitCode === 0 ? "Done (exit 0)" : `Done (exit ${exitCode})`);
        void this.persistSession(
          this.terminalSession?.getTranscript() ?? "",
          exitCode !== 0 ? `Process exited with code ${exitCode}` : ""
        );
      },
      onError: (message) => {
        this.setStatus("Error");
        void this.persistSession(this.terminalSession?.getTranscript() ?? "", message);
      },
    });

    void this.terminalSession.start().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus("Error");
      void this.persistSession("", message);
    });
  }

  private stopTerminal(): void {
    if (this.terminalSession) {
      this.terminalSession.destroy();
      this.terminalSession = null;
    }
    this.terminalContainer.innerHTML = "";
  }

  private handleReset(): void {
    this.currentCode = this.originalCode;
    if (this.editorView) {
      this.editorView.dispatch({
        changes: {
          from: 0,
          to: this.editorView.state.doc.length,
          insert: this.originalCode,
        },
      });
    }
    this.updateWrapMainButton();
    this.stopTerminal();
    this.setStatus("Reset to original snippet");
    void this.persistSession("", "");
  }

  private handleWrapMain(): void {
    const wrapped = wrapInMain(this.currentCode, this.context.recipeId);
    if (!wrapped || !this.editorView) return;

    this.currentCode = wrapped;
    this.editorView.dispatch({
      changes: {
        from: 0,
        to: this.editorView.state.doc.length,
        insert: wrapped,
      },
    });
    this.updateWrapMainButton();
    this.setStatus("Wrapped in main()");
    this.scheduleSave();
  }

  private updateWrapMainButton(): void {
    if (!this.wrapMainBtn) return;
    const show =
      this.context.recipeId === "mojo" && MojoSnippet.canWrapInMain(this.currentCode);
    this.wrapMainBtn.hidden = !show;
  }

  private async handleSave(): Promise<void> {
    await this.persistSession(
      this.session?.stdout ?? "",
      this.session?.stderr ?? ""
    );
    this.setStatus("Saved");
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      void this.persistSession(
        this.session?.stdout ?? "",
        this.session?.stderr ?? ""
      );
    }, 800);
  }

  private async persistSession(stdout: string, stderr: string): Promise<void> {
    const payload = {
      url: this.context.url,
      domain: this.context.domain,
      pageTitle: this.context.pageTitle,
      nearestHeading: this.context.nearestHeading,
      recipeId: this.context.recipeId,
      originalCode: this.originalCode,
      currentCode: this.currentCode,
      stdout,
      stderr,
    };

    if (this.session) {
      this.session = await patchSession(this.session.id, payload);
    } else {
      this.session = await saveSession(payload);
    }
  }

  private setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  private enableDrag(windowEl: HTMLElement): void {
    const titlebar = this.shadow.querySelector("[data-drag]") as HTMLElement;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let origX = 0;
    let origY = 0;

    titlebar.addEventListener("mousedown", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = windowEl.offsetLeft;
      origY = windowEl.offsetTop;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const x = origX + (e.clientX - startX);
      const y = origY + (e.clientY - startY);
      windowEl.style.left = `${Math.max(0, x)}px`;
      windowEl.style.top = `${Math.max(0, y)}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      void saveWindowState(this.context.url, {
        x: windowEl.offsetLeft,
        y: windowEl.offsetTop,
        width: windowEl.offsetWidth,
        height: windowEl.offsetHeight,
      });
      this.terminalSession?.fit();
    });
  }

  private enableResize(windowEl: HTMLElement): void {
    const handle = document.createElement("div");
    handle.className = "symbiont-resize-handle";
    windowEl.appendChild(handle);

    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    handle.addEventListener("mousedown", (e) => {
      resizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = windowEl.offsetWidth;
      startH = windowEl.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      windowEl.style.width = `${Math.max(360, startW + (e.clientX - startX))}px`;
      windowEl.style.height = `${Math.max(280, startH + (e.clientY - startY))}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!resizing) return;
      resizing = false;
      void saveWindowState(this.context.url, {
        x: windowEl.offsetLeft,
        y: windowEl.offsetTop,
        width: windowEl.offsetWidth,
        height: windowEl.offsetHeight,
      });
      this.terminalSession?.fit();
    });
  }

  destroy(): void {
    this.stopTerminal();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.editorView?.destroy();
    this.host.remove();
    this.onClose?.();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}

export function openSandbox(element: HTMLElement, code: string, language: string | null): SandboxWindow {
  const context = buildContext(element, code, language);
  return new SandboxWindow({ context });
}

export async function openSandboxFromSession(session: Session): Promise<SandboxWindow> {
  const context: CodeBlockContext = {
    url: session.url,
    domain: session.domain,
    pageTitle: session.pageTitle,
    nearestHeading: session.nearestHeading,
    code: session.currentCode,
    language: session.recipeId === "mojo" ? "mojo" : "bash",
    recipeId: session.recipeId,
  };
  const win = new SandboxWindow({ context });
  return win;
}

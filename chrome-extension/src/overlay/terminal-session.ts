import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import {
  extensionOffMessage,
  extensionOnMessage,
  extensionPostMessage,
  extensionSendMessageAsync,
} from "../extension-api";

export interface TerminalSessionOptions {
  container: HTMLElement;
  recipeId: string;
  code: string;
  onExit?: (exitCode: number) => void;
  onError?: (message: string) => void;
  onStarted?: () => void;
}

type TerminalMessage = {
  type: string;
  data?: string | ArrayBuffer;
  message?: string;
  cols?: number;
  rows?: number;
};

export class TerminalSession {
  private terminal: Terminal;
  private fitAddon: FitAddon;
  private started = false;
  private readonly onRuntimeMessage: (message: TerminalMessage) => void;

  constructor(private options: TerminalSessionOptions) {
    this.terminal = new Terminal({
      theme: {
        background: "#ffffff",
        foreground: "#1a1a2e",
        cursor: "#1a73e8",
        selectionBackground: "#cce5ff",
      },
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      fontSize: 12,
      scrollback: 2000,
      cursorBlink: true,
    });
    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(options.container);
    this.fit();

    options.container.addEventListener("mousedown", () => {
      this.terminal.focus();
    });

    this.onRuntimeMessage = (message) => this.handleRuntimeMessage(message);
    extensionOnMessage(this.onRuntimeMessage);

    this.terminal.onData((data) => {
      if (!this.started) return;
      extensionPostMessage({ type: "terminal:input", data });
    });
  }

  async start(): Promise<void> {
    await extensionSendMessageAsync({ type: "terminal:ensure-offscreen" });

    const dims = this.fitAddon.proposeDimensions();
    const ready = await extensionSendMessageAsync<{ ok: boolean; error?: string }>({
      type: "terminal:start",
      recipeId: this.options.recipeId,
      code: this.options.code,
      cols: dims?.cols ?? 80,
      rows: dims?.rows ?? 12,
    });

    if (!ready.ok) {
      throw new Error(ready.error ?? "Failed to start terminal session");
    }
  }

  stop(): void {
    extensionPostMessage({ type: "terminal:stop" });
    void extensionSendMessageAsync({ type: "terminal:close-offscreen" });
  }

  fit(): void {
    try {
      this.fitAddon.fit();
      const dims = this.fitAddon.proposeDimensions();
      if (dims && this.started) {
        extensionPostMessage({
          type: "terminal:resize",
          cols: dims.cols,
          rows: dims.rows,
        });
      }
    } catch {
      // container may be hidden during init
    }
  }

  clear(): void {
    this.terminal.clear();
  }

  getTranscript(): string {
    const lines: string[] = [];
    for (let i = 0; i < this.terminal.buffer.active.length; i++) {
      const line = this.terminal.buffer.active.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }
    return lines.join("\n").trim();
  }

  destroy(): void {
    extensionOffMessage(this.onRuntimeMessage);
    this.stop();
    this.terminal.dispose();
  }

  private handleRuntimeMessage(message: TerminalMessage): void {
    switch (message.type) {
      case "terminal:open":
        break;
      case "terminal:started":
        this.started = true;
        this.fit();
        this.terminal.focus();
        this.options.onStarted?.();
        break;
      case "terminal:binary":
        this.writeBinary(message.data);
        break;
      case "terminal:json":
        if (typeof message.data === "string") {
          try {
            const payload = JSON.parse(message.data);
            if (payload.type === "error") {
              this.terminal.writeln(`\r\n\x1b[31m${payload.message}\x1b[0m`);
              this.options.onError?.(payload.message);
            } else if (payload.type === "exit") {
              this.options.onExit?.(payload.exitCode ?? 1);
            }
          } catch {
            // ignore
          }
        }
        break;
      case "terminal:error":
        this.terminal.writeln(`\r\n\x1b[31m${message.message ?? "Terminal error"}\x1b[0m`);
        this.options.onError?.(message.message ?? "Terminal error");
        break;
      case "terminal:close":
        if (this.started) {
          this.terminal.writeln("\r\n[disconnected]");
        }
        break;
    }
  }

  private writeBinary(data: string | ArrayBuffer | undefined): void {
    if (!data) return;

    if (typeof data === "string") {
      this.terminal.write(data);
      return;
    }

    if (data instanceof ArrayBuffer) {
      this.terminal.write(new TextDecoder().decode(data));
      return;
    }

    const bytes = data as ArrayLike<number> & { length: number };
    if (typeof bytes.length === "number") {
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        buf[i] = bytes[i] ?? 0;
      }
      this.terminal.write(new TextDecoder().decode(buf));
    }
  }
}

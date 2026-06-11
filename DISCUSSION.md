# Interactive Documentation Sandbox Extension — Implementation Plan

## Product Direction

Build a Chrome extension that turns static technical documentation into an interactive learning and practice environment.

The first proof of concept should focus on documentation pages that contain code blocks. When the user hovers over or selects a code block, the extension can create a local runnable sandbox for that snippet. The goal is not to build a generic “chat with docs” tool, but to reduce the friction between reading, trying, modifying, and remembering technical concepts.

Initial target examples:

* Mojo documentation https://mojolang.org/docs/
* Bash / shell-style examples

For v0, avoid frontend framework-specific sandboxes such as React + TypeScript + Vite. Keep the implementation lightweight and focused on single-file execution workflows.

## Core Experience

The user opens a documentation page.

When a code block is detected, the extension adds lightweight actions:

```text
Run
Open Sandbox
```

For the first version, `Run` and `Open Sandbox` can be be the same flow.

The extension creates a floating overlay window inside the webpage, initially positioned near the top-left corner. The webpage becomes a lightweight “OS-like” surface where the sandbox window can live.

The sandbox window contains:

* editable code editor
* run button
* output panel
* reset button
* save/resume state
* optional page/context metadata

The original documentation page should remain unchanged. Instead of making the original code block directly `contenteditable`, the POC should clone the code into the sandbox editor first. Inline editing can come later.

## System Architecture

```text
Chrome Extension
  ├─ Content Script
  │   ├─ detects code blocks
  │   ├─ injects hover actions
  │   ├─ creates floating sandbox window
  │   ├─ extracts page/code context
  │   └─ communicates with local backend
  │
  ├─ Background Worker
  │   ├─ manages extension state
  │   └─ checks local backend availability
  │
  └─ Sandbox Overlay UI
      ├─ editor
      ├─ run controls
      ├─ output panel
      └─ session restore UI

Local Backend
  ├─ local HTTP/WebSocket server
  ├─ sandbox manager
  ├─ recipe registry
  ├─ code execution layer
  ├─ session storage
  └─ optional local AI assistant
```

## Chrome Extension Layer

Responsibilities:

1. Detect documentation code blocks.

Possible selectors:

```js
pre code
pre
[class*="language-"]
[class*="highlight"]
```

2. Infer metadata:

* current URL
* domain
* page title
* nearest heading
* code block text
* language class, if available
* selected text, if any

3. Inject small UI affordances:

* hover toolbar on code blocks
* extension popup action
* floating sandbox overlay

4. Communicate with local backend:

```text
GET  /health
POST /sandbox/create
POST /sandbox/run
POST /session/save
GET  /session?url=...
```

## Sandbox Overlay

The overlay should feel like a small app window inside the webpage.

Initial features:

* top-left default position
* draggable window
* lightweight editor powered by CodeMirror or a simple embedded editor
* output panel
* run button
* reset to original snippet
* save session
* close/minimize

Use Shadow DOM to isolate styles from the host webpage.

Window state should be stored per page/domain:

```ts
{
  url,
  domain,
  windowPosition,
  windowSize,
  lastOpenedSandboxId
}
```

## Local Backend

The backend runs locally and exposes a small API to the extension.

Suggested stack:

* Python for the backend, since it is more developer-friendly and will make future AI/model integration easier
* SQLite for sessions
* Docker for the first sandbox isolation layer
* Optional later: QEMU, Firecracker, or stronger sandboxing

The backend should own all execution. The browser extension should never execute arbitrary code directly.

## Sandbox Recipe System

Create a recipe registry.

Each recipe defines:

```ts
type SandboxRecipe = {
  id: string
  displayName: string
  languages: string[]
  image: string
  fileTemplate: Record<string, string>
  runCommand: string
  timeoutMs: number
  memoryLimit: string
  network: "none" | "enabled"
}
```

Initial recipes:

## 1. Mojo Recipe

Purpose:

Run Mojo snippets from Mojo documentation.

Behavior:

* create a temporary workspace
* write code to `main.mojo`
* run with Mojo CLI inside a predefined container
* return stdout/stderr

Example command:

```bash
mojo main.mojo
```

Container should include:

* Mojo toolchain
* minimal shell tools
* no network by default
* CPU/memory/time limits

## 2. Bash / Shell Recipe

Purpose:

Run small shell examples safely.

Behavior:

* create temporary workspace
* write user code to `script.sh`
* run in a locked-down Linux container
* return stdout/stderr

Example command:

```bash
bash script.sh
```

Restrictions:

* no network by default
* read-only base filesystem if possible
* temporary workspace only
* timeout required
* memory/CPU limits required

This recipe is useful for docs involving CLI tools, installation commands, file manipulation, and general shell learning.

## Session Storage

Sessions should persist locally.

Store:

```ts
{
  id,
  url,
  domain,
  pageTitle,
  nearestHeading,
  recipeId,
  originalCode,
  currentCode,
  files,
  stdout,
  stderr,
  createdAt,
  updatedAt
}
```

When the user revisits the same page, the extension can show:

```text
Resume previous sandbox
```

## Notes Layer

Notes are secondary but useful.

A note should be created from:

* selected text
* code block
* sandbox state
* user-written comments

Each note should preserve:

* URL
* page title
* selected/code content
* timestamp
* optional sandbox files
* optional output/result

The note is less about permanent highlighting and more about capturing the user’s learning journey.

## AI Layer

AI should not be central in the first POC.

Useful first AI actions:

```text
Make this snippet runnable
Generate a small variation
Explain why this failed
Create a tiny exercise
```

The most important one is:

```text
Make this snippet runnable
```

Documentation snippets are often partial. The AI can use the current code block, page title, nearby heading, and surrounding page text to produce a runnable file or project patch.

## POC Scope

The first working demo should prove this flow:

1. User opens Mojo documentation.
2. Extension detects code blocks.
3. User clicks `Run`.
4. Floating sandbox window opens.
5. Code appears in editable editor.
6. Local backend runs it in a Mojo sandbox.
7. Output appears in the overlay.
8. User edits code and runs again.
9. Session is saved.
10. Reloading the page allows the user to resume.

Secondary demo:

1. Open a page with shell commands.
2. Click `Run`.
3. Bash sandbox runs command safely.

## Key Design Principle

The extension should not feel like a search engine or documentation chatbot.

It should feel like:

> “I am reading this documentation, and now the page itself lets me try, modify, save, and learn from the code.”

The sandbox is the differentiating feature. Retrieval, notes, and AI assistance should support that core interaction.

## v0 Milestone

v0 is intentionally a stopping point. The shipped loop:

* Chrome extension with domain whitelist, floating sandbox, CodeMirror editor, xterm terminal
* Local FastAPI backend with Docker-isolated Bash and Mojo recipes
* Interactive terminal over WebSocket (stdin/stdout, `input()` support)
* Mojo snippet preparation (`MojoSnippet`: import extraction, wrap in `main()`)
* SQLite session persistence

Out of scope for v0: native host runner, forkd integration, cloud deployment, additional recipes beyond Bash/Mojo.

### v1 direction (UX)

Inline editing on the documentation page itself — `contenteditable` code blocks, **Run** on the block, output shown directly underneath. No floating overlay window. The backend and runner layer can largely stay; this is a content-script presentation change. See [`TODO.md`](TODO.md).

## Execution Strategy (Scope)

Symbiont must decide *where* user code runs. This is a product/architecture fork, not a small implementation detail.

### Option A — Docker runner (v0 default)

**What it is:** Each run creates an ephemeral Linux container (`symbiont/bash:0.1`, `symbiont/mojo:0.1`), executes the snippet, tears down.

**Pros:**

* Isolates unknown doc snippets from the host (network off, memory limits, read-only root)
* Reproducible environment without asking users to install Mojo
* Already implemented and working

**Cons:**

* On macOS, Docker runs Linux inside a VM — not the same as native Mojo on the host
* Slower cold start, different paths/caches than a real local install
* Does not match the mental model of “I created a project folder and installed the toolchain”

**v0 decision:** Keep Docker. Good enough to validate the extension UX and backend contract.

### Option B — Native host runner

**What it is:** Backend writes snippets to a workspace on disk and runs `mojo` / `bash` from the host `PATH` in a PTY (same WebSocket terminal protocol).

**Pros:**

* Matches how people actually learn a new language or library
* Full native performance on macOS
* Uses the user's real installed toolchain and version

**Cons:**

* Code from whitelisted doc sites still runs as the local user — weaker isolation
* Requires users to install Mojo (or other toolchains) themselves
* More care needed around timeouts, cleanup, and error messages when binaries are missing

**Status:** Discussed, not implemented. Likely direction if the primary goal shifts from “safe try on any page” to “learn with my real environment.”

### Option C — forkd microVM runner (future)

**Reference:** [deeplethe/forkd](https://github.com/deeplethe/forkd) — KVM-isolated microVMs with fork-from-warm snapshot CoW (~100 ms spawn from a warmed parent).

**Why it is interesting for Symbiont:**

* Strong isolation (real VM per run) without Docker-on-Mac overhead
* Fast enough for interactive “click Run on a doc snippet” if a warmed parent image exists (e.g. Python + Mojo pre-imported)
* Designed for short-lived sandboxes and fan-out — similar shape to “many doc snippets, many quick runs”

**Why not v0:**

* Linux + KVM only (no macOS path today)
* Alpha software; operational complexity (daemon, snapshots, host setup)
* No integration work started

**Status:** Worth tracking. Could be a v2 isolation layer if Docker feels too slow or native feels too unsafe.

### Summary

| Runner | v0 | Learning fidelity | Isolation |
|--------|----|-------------------|-----------|
| Docker | ✅ | Medium | Good |
| Native host | — | High | Low |
| forkd | — | Medium–High | Very good (Linux) |

Until explicitly re-scoped, **Symbiont v0 = Docker runner + extension overlay + local backend.** Revisit native vs forkd when moving past v0.

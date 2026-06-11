# Symbiont — TODO & Roadmap

v0 is shipped and intentionally a stopping point. This file tracks scoped future work. See [`DISCUSSION.md`](DISCUSSION.md) for design rationale.

## v1 — Inline UX (primary)

Shift from floating overlay to in-page editing:

- [ ] Make documentation code blocks **contenteditable** (edit in place on the page)
- [ ] Show **Run** on the block; render **output directly below** — no floating sandbox window
- [ ] Anchor the flow to the doc: read → tweak → run → see result, all in context

**Backend impact:** Low. `POST /sandbox/run` and `WS /sandbox/terminal` already exist. Mostly a content-script / UI change.

**Can drop for v1 unless needed:** draggable overlay window, session restore UI, resize handles, exposing offscreen terminal relay complexity to users.

## Execution strategy

Symbiont needs an isolation layer between doc snippets and the host machine. Three paths:

| Approach | Status | Learning fidelity | Isolation |
|----------|--------|-------------------|-----------|
| **Docker runner** | ✅ v0 | Medium — Linux VM on macOS, not native toolchain | Good for trusted doc sites |
| **Native host runner** | Not started | High — host `mojo` / `bash` from `PATH` | Low; runs as local user |
| **[forkd](https://github.com/deeplethe/forkd)** microVMs | Not started | Medium–high | Strong; Linux + KVM only (alpha) |

### Docker runner (v0 — current)

- Ephemeral containers per run (`symbiont/bash:0.1`, `symbiont/mojo:0.1`)
- Keep until a successor runner is chosen

### Native host runner

- [ ] `NativeRunner` — `subprocess` / PTY in temp workspace (`~/.symbiont/runs/…`)
- [ ] `NativeTerminalRunner` — same WebSocket protocol as today
- [ ] Toolchain discovery (`which mojo`, version in `/health`)
- [ ] Optional custom binary paths in extension popup
- [ ] Clear errors when Mojo/bash not installed

**Tradeoff:** Matches how people learn locally; weaker isolation than Docker.

### forkd microVM runner (future research)

- [ ] Evaluate [forkd](https://github.com/deeplethe/forkd) for KVM-isolated, fork-from-warm sandboxes
- [ ] Linux + KVM only; alpha; operational complexity (daemon, snapshots)
- [ ] No integration work started

See [`DISCUSSION.md` § Execution Strategy`](DISCUSSION.md#execution-strategy-scope).

## Post-v0 backend & recipes

- [ ] Native host runner (if chosen over staying on Docker)
- [ ] Additional recipes beyond Bash / Mojo
- [ ] Cloud backend deployment (extension popup already supports custom Backend URL)
- [ ] Richer Mojo syntax highlighting in editor (Shiki + [mojo-syntax](https://github.com/modular/mojo-syntax))

## Post-v0 extension

- [ ] Inline contenteditable blocks + inline output (v1 — see above)
- [ ] Optional persistent workspace folder (`~/symbiont-learn/`) vs temp-only runs
- [ ] Session restore UI (removed in v0 overlay; revisit if overlay path continues)

## Deferred / out of scope

- Generic frontend sandboxes (React + Vite, etc.)
- “Chat with docs” / RAG-first UX
- Auto-run on page load

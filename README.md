# Symbiont

Symbiont turns static technical documentation into an interactive local sandbox for learning by doing.

A Chrome extension detects code blocks on documentation pages, clones them into a floating in-page editor, and runs them via a local Python backend inside Docker-isolated containers.

## Status (v0)

**v0 is a deliberate stopping point.** The core loop works end-to-end:

- Detect code blocks on whitelisted doc sites
- Open an in-page sandbox with editor + interactive terminal
- Run Bash and Mojo snippets in isolated Docker containers
- Wrap Mojo snippets in `main()` (including import extraction)
- Persist sessions locally

Roadmap and future work: [`TODO.md`](TODO.md). Design notes: [`DISCUSSION.md`](DISCUSSION.md).

## Prerequisites

> **Docker is required.** Symbiont v0 runs every snippet inside Docker containers. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and **start it before** running the backend or using the extension. Without Docker, the API starts but **Run** will fail.

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — installed **and running**
- Python 3.12+
- Node.js 18+
- Google Chrome (or any other Chromium-based browsers.)

Verify Docker before continuing:

```bash
docker info
```

If that command errors, open Docker Desktop and wait until it reports running, then try again.

## Quick Start

### 1. Start the local backend

**Requires Docker Desktop to be running.** `scripts/dev.sh` checks for Docker before building images.

```bash
cd python
chmod +x scripts/dev.sh
./scripts/dev.sh
```

This builds the `symbiont/bash:0.1` and `symbiont/mojo:0.1` images and starts the API on `http://127.0.0.1:7341`. The first Mojo build downloads ~200MB from PyPI.

Verify:

```bash
curl http://127.0.0.1:7341/health
```

Run a bash snippet:

```bash
curl -X POST http://127.0.0.1:7341/sandbox/run \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"bash","files":{"code":"echo hello from symbiont"}}'
```

Run a Mojo snippet:

```bash
curl -X POST http://127.0.0.1:7341/sandbox/run \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"mojo","files":{"code":"fn main():\n    print(\"hello from symbiont\")"}}'
```

### 2. Build and load the Chrome extension

```bash
cd chrome-extension
npm install
npm run build
```

In Chrome: **Extensions → Manage Extensions → Load unpacked** → select `chrome-extension/dist`.

### 3. Try it

1. Open the extension popup and confirm the **domain whitelist** includes the site you are on (defaults: `mojolang.org`, `docs.modular.com`).
2. Hover a code block and click **Open Sandbox**.
3. For bare Mojo snippets, click **Wrap in main** if needed, then **Run**.
4. Type in the terminal panel when the program prompts for input.

## Architecture

```
Chrome Extension (UI + detection)
        ↓ HTTP / WebSocket (service worker + offscreen relay)
Local Python Backend (FastAPI)
        ↓ Docker per run
Ephemeral sandbox containers (bash, mojo)
```

Sessions are stored in `~/.symbiont/sessions.db`. Each **Run** starts an interactive terminal session backed by a Docker container with a TTY.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Backend and Docker status |
| GET | `/recipes` | Available sandbox recipes |
| POST | `/sandbox/run` | Execute code in a recipe sandbox (batch) |
| WS | `/sandbox/terminal` | Interactive terminal session |
| POST | `/session` | Save or upsert session by URL |
| GET | `/session?url=` | Get session for a page |
| PATCH | `/session/{id}` | Update session |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SYMBIONT_PORT` | `7341` | Backend port |
| `SYMBIONT_HOST` | `127.0.0.1` | Bind address |
| `SYMBIONT_DATA_DIR` | `~/.symbiont` | SQLite data directory |

In the extension popup, set **Backend URL** to point at a cloud deployment later (same API contract).

## Mojo Recipe

The Mojo image installs the official `mojo` package from PyPI (currently v0.26.x). Mojo code blocks on docs sites (e.g. `language-mojo`) automatically use this recipe. Example:

```mojo
fn main():
    print("Hello, Mojo!")
```

## License

MIT

import asyncio
import json
import shutil
import tempfile
import threading
from pathlib import Path

from docker.errors import APIError, ImageNotFound
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from symbiont.recipes.models import SandboxRecipe
from symbiont.recipes.mojo_prepare import prepare_mojo_code
from symbiont.sandbox.docker_runner import _get_client


def _write_workspace(recipe: SandboxRecipe, code: str, workspace: Path) -> None:
    if recipe.id == "mojo":
        code = prepare_mojo_code(code)
    for filename, template in recipe.file_template.items():
        content = template.replace("{code}", code)
        target = workspace / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


async def run_terminal_session(
    websocket: WebSocket,
    recipe: SandboxRecipe,
    code: str,
    cols: int = 80,
    rows: int = 24,
) -> None:
    workspace = Path(tempfile.mkdtemp(prefix="symbiont-term-"))
    container = None
    sock = None
    stop_event = threading.Event()

    try:
        _write_workspace(recipe, code, workspace)
        client = _get_client()
        network_mode = "none" if recipe.network == "none" else "bridge"

        environment = None
        if recipe.id == "mojo":
            environment = {
                "HOME": "/tmp",
                "XDG_CACHE_HOME": "/tmp/.cache",
                "XDG_DATA_HOME": "/tmp/.local/share",
            }

        try:
            container = client.containers.create(
                image=recipe.image,
                command=recipe.run_command,
                volumes={str(workspace.resolve()): {"bind": "/workspace", "mode": "rw"}},
                working_dir="/workspace",
                network_mode=network_mode,
                mem_limit=recipe.memory_limit,
                nano_cpus=int(recipe.cpu_limit * 1e9),
                pids_limit=recipe.pids_limit,
                read_only=True,
                tmpfs={"/tmp": "size=64m,mode=1777"},
                cap_drop=["ALL"],
                security_opt=["no-new-privileges"],
                stdin_open=True,
                tty=True,
                environment=environment,
            )
        except ImageNotFound as exc:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": f"Docker image '{recipe.image}' not found.",
                }
            )
            raise RuntimeError(str(exc)) from exc
        except APIError as exc:
            await websocket.send_json({"type": "error", "message": str(exc)})
            raise RuntimeError(str(exc)) from exc

        sock = container.attach_socket(
            params={"stdin": 1, "stdout": 1, "stderr": 1, "stream": 1}
        )
        sock._sock.setblocking(True)

        container.start()
        try:
            container.resize(height=rows, width=cols)
        except Exception:
            pass

        await websocket.send_json({"type": "started"})

        loop = asyncio.get_running_loop()

        def pump_output() -> None:
            while not stop_event.is_set():
                try:
                    chunk = sock._sock.recv(4096)
                    if not chunk:
                        break
                    future = asyncio.run_coroutine_threadsafe(
                        websocket.send_bytes(chunk), loop
                    )
                    future.result(timeout=5)
                except Exception:
                    break

        def wait_for_exit() -> int:
            result = container.wait()
            return int(result.get("StatusCode", 1))

        reader = threading.Thread(target=pump_output, daemon=True)
        reader.start()

        try:
            while not stop_event.is_set():
                message = await websocket.receive()
                msg_type = message.get("type")

                if msg_type == "websocket.disconnect":
                    break

                if msg_type != "websocket.receive":
                    continue

                data = message.get("bytes")
                text = message.get("text")
                if data is not None:
                    sock._sock.send(data)
                elif text is not None:
                    try:
                        payload = json.loads(text)
                    except json.JSONDecodeError:
                        sock._sock.send(text.encode("utf-8"))
                        continue

                    msg_kind = payload.get("type")
                    if msg_kind == "resize":
                        try:
                            container.resize(
                                height=int(payload.get("rows", rows)),
                                width=int(payload.get("cols", cols)),
                            )
                        except Exception:
                            pass
                    elif msg_kind == "stop":
                        break
                    elif msg_kind == "input":
                        sock._sock.send(
                            str(payload.get("data", "")).encode("utf-8")
                        )

        except WebSocketDisconnect:
            pass
        finally:
            stop_event.set()
            reader.join(timeout=2)
            exit_code = await asyncio.to_thread(wait_for_exit)
            try:
                await websocket.send_json({"type": "exit", "exitCode": exit_code})
            except Exception:
                pass

    finally:
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass
        if container is not None:
            try:
                if container.status == "running":
                    container.kill()
            except Exception:
                pass
            try:
                container.remove(force=True)
            except Exception:
                pass
        shutil.rmtree(workspace, ignore_errors=True)

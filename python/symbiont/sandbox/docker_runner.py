import logging
import time
from pathlib import Path
from typing import Protocol

import docker
from docker.errors import APIError, ImageNotFound

from symbiont.config import DOCKER_SOCKET
from symbiont.recipes.models import SandboxRecipe
from symbiont.sandbox.models import ExecutionResult

logger = logging.getLogger(__name__)

DOCKER_INSTALL_URL = "https://www.docker.com/products/docker-desktop/"
DOCKER_UNAVAILABLE_MESSAGE = (
    "Docker is not available. Symbiont v0 requires Docker to run sandboxes. "
    f"Install Docker Desktop ({DOCKER_INSTALL_URL}), start it, then try again."
)


class SandboxRunner(Protocol):
    def run(self, recipe: SandboxRecipe, workspace: Path) -> ExecutionResult: ...


def check_docker_available() -> bool:
    try:
        client = _get_client()
        client.ping()
        return True
    except Exception:
        return False


def warn_if_docker_missing() -> bool:
    """Log a startup warning when Docker is unreachable. Returns docker availability."""
    if check_docker_available():
        logger.info("Docker is available.")
        return True

    logger.warning(DOCKER_UNAVAILABLE_MESSAGE)
    return False


def _get_client() -> docker.DockerClient:
    if DOCKER_SOCKET:
        return docker.DockerClient(base_url=DOCKER_SOCKET)
    return docker.from_env()


class DockerRunner:
    def run(self, recipe: SandboxRecipe, workspace: Path) -> ExecutionResult:
        client = _get_client()
        start = time.monotonic()

        network_mode = "none" if recipe.network == "none" else "bridge"
        timeout_sec = max(recipe.timeout_ms / 1000, 1)

        try:
            container = client.containers.run(
                image=recipe.image,
                command=recipe.run_command,
                volumes={str(workspace.resolve()): {"bind": "/workspace", "mode": "rw"}},
                working_dir="/workspace",
                network_mode=network_mode,
                mem_limit=recipe.memory_limit,
                nano_cpus=int(recipe.cpu_limit * 1e9),
                pids_limit=recipe.pids_limit,
                read_only=True,
                tmpfs={"/tmp": "size=16m,mode=1777"},
                cap_drop=["ALL"],
                security_opt=["no-new-privileges"],
                detach=True,
                remove=False,
                stdout=True,
                stderr=True,
            )
        except ImageNotFound as exc:
            raise RuntimeError(
                f"Docker image '{recipe.image}' not found. "
                f"Build it with: docker build -t {recipe.image} docker/{recipe.id}/"
            ) from exc
        except APIError as exc:
            raise RuntimeError(f"Docker execution failed: {exc}") from exc

        try:
            result = container.wait(timeout=timeout_sec)
            exit_code = int(result.get("StatusCode", 1))
            stdout = container.logs(stdout=True, stderr=False).decode("utf-8", errors="replace")
            stderr = container.logs(stdout=False, stderr=True).decode("utf-8", errors="replace")
        except Exception as exc:
            try:
                container.kill()
            except Exception:
                pass
            raise RuntimeError(f"Execution timed out after {recipe.timeout_ms}ms") from exc
        finally:
            try:
                container.remove(force=True)
            except Exception:
                pass

        duration_ms = int((time.monotonic() - start) * 1000)
        return ExecutionResult(
            stdout=stdout,
            stderr=stderr,
            exit_code=exit_code,
            duration_ms=duration_ms,
        )

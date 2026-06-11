from dataclasses import dataclass
from typing import Literal


@dataclass(frozen=True)
class SandboxRecipe:
    id: str
    display_name: str
    languages: list[str]
    image: str
    file_template: dict[str, str]
    run_command: list[str]
    timeout_ms: int
    memory_limit: str
    cpu_limit: float
    network: Literal["none", "enabled"]
    pids_limit: int = 64

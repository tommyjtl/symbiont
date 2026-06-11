import shutil
import tempfile
from pathlib import Path

from symbiont.recipes.models import SandboxRecipe
from symbiont.recipes.mojo_prepare import prepare_mojo_code
from symbiont.sandbox.docker_runner import DockerRunner
from symbiont.sandbox.models import ExecutionResult


class SandboxManager:
    def __init__(self, runner: DockerRunner | None = None) -> None:
        self._runner = runner or DockerRunner()

    def execute(self, recipe: SandboxRecipe, files: dict[str, str]) -> ExecutionResult:
        workspace = Path(tempfile.mkdtemp(prefix="symbiont-"))
        try:
            self._write_workspace(recipe, files, workspace)
            return self._runner.run(recipe, workspace)
        finally:
            shutil.rmtree(workspace, ignore_errors=True)

    def _write_workspace(
        self, recipe: SandboxRecipe, files: dict[str, str], workspace: Path
    ) -> None:
        code = files.get("code", "")
        if recipe.id == "mojo":
            code = prepare_mojo_code(code)
        for filename, template in recipe.file_template.items():
            content = template.replace("{code}", code)
            if filename in files:
                content = files[filename]
            target = workspace / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from symbiont.recipes.registry import get_recipe
from symbiont.sandbox.docker_runner import (
    DOCKER_UNAVAILABLE_MESSAGE,
    check_docker_available,
)
from symbiont.sandbox.manager import SandboxManager
from symbiont.sandbox.models import ExecutionResult

router = APIRouter(prefix="/sandbox")
_manager = SandboxManager()


class RunRequest(BaseModel):
    recipe_id: str = Field(alias="recipeId")
    files: dict[str, str] = Field(default_factory=dict)
    timeout_ms: int | None = Field(alias="timeoutMs", default=None)

    model_config = {"populate_by_name": True}


@router.post("/run", response_model=ExecutionResult)
async def run_sandbox(request: RunRequest) -> ExecutionResult:
    if not check_docker_available():
        raise HTTPException(status_code=503, detail=DOCKER_UNAVAILABLE_MESSAGE)

    recipe = get_recipe(request.recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail=f"Recipe '{request.recipe_id}' not found")

    try:
        return _manager.execute(recipe, request.files)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

from fastapi import APIRouter, WebSocket

from symbiont.recipes.registry import get_recipe
from symbiont.sandbox.docker_runner import (
    DOCKER_UNAVAILABLE_MESSAGE,
    check_docker_available,
)
from symbiont.sandbox.terminal_runner import run_terminal_session

router = APIRouter(prefix="/sandbox")


@router.websocket("/terminal")
async def sandbox_terminal(websocket: WebSocket) -> None:
    await websocket.accept()

    if not check_docker_available():
        await websocket.send_json(
            {
                "type": "error",
                "message": DOCKER_UNAVAILABLE_MESSAGE,
            }
        )
        await websocket.close()
        return

    try:
        init = await websocket.receive_json()
    except Exception:
        await websocket.close()
        return

    recipe_id = init.get("recipeId")
    files = init.get("files") or {}
    code = files.get("code", "")
    cols = int(init.get("cols", 80))
    rows = int(init.get("rows", 24))

    recipe = get_recipe(recipe_id)
    if recipe is None:
        await websocket.send_json(
            {"type": "error", "message": f"Recipe '{recipe_id}' not found."}
        )
        await websocket.close()
        return

    try:
        await run_terminal_session(websocket, recipe, code, cols=cols, rows=rows)
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

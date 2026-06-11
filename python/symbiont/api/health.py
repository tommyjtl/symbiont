from fastapi import APIRouter

from symbiont import __version__
from symbiont.recipes.registry import list_recipes
from symbiont.sandbox.docker_runner import (
    DOCKER_INSTALL_URL,
    DOCKER_UNAVAILABLE_MESSAGE,
    check_docker_available,
)

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    recipes = list_recipes()
    docker_ok = check_docker_available()
    payload: dict = {
        "status": "ok",
        "version": __version__,
        "dockerOk": docker_ok,
        "recipes": [
            {
                "id": r.id,
                "displayName": r.display_name,
                "languages": r.languages,
                "image": r.image,
            }
            for r in recipes
        ],
    }
    if not docker_ok:
        payload["dockerMessage"] = DOCKER_UNAVAILABLE_MESSAGE
        payload["dockerInstallUrl"] = DOCKER_INSTALL_URL
    return payload

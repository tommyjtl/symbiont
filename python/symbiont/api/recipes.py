from fastapi import APIRouter

from symbiont.recipes.registry import list_recipes, recipe_for_language

router = APIRouter(prefix="/recipes")


@router.get("")
async def get_recipes() -> list[dict]:
    return [
        {
            "id": r.id,
            "displayName": r.display_name,
            "languages": r.languages,
            "image": r.image,
            "timeoutMs": r.timeout_ms,
        }
        for r in list_recipes()
    ]


@router.get("/match/{language}")
async def match_recipe(language: str) -> dict:
    recipe = recipe_for_language(language)
    if recipe is None:
        return {"recipeId": None}
    return {"recipeId": recipe.id, "displayName": recipe.display_name}

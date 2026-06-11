from symbiont.recipes.bash import BASH_RECIPE
from symbiont.recipes.models import SandboxRecipe
from symbiont.recipes.mojo import MOJO_RECIPE

_RECIPES: dict[str, SandboxRecipe] = {
    BASH_RECIPE.id: BASH_RECIPE,
    MOJO_RECIPE.id: MOJO_RECIPE,
}


def get_recipe(recipe_id: str) -> SandboxRecipe | None:
    return _RECIPES.get(recipe_id)


def list_recipes() -> list[SandboxRecipe]:
    return list(_RECIPES.values())


def recipe_for_language(language: str) -> SandboxRecipe | None:
    normalized = language.lower().strip()
    for recipe in _RECIPES.values():
        if normalized in recipe.languages:
            return recipe
    return None

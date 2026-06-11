from symbiont.recipes.models import SandboxRecipe

MOJO_RECIPE = SandboxRecipe(
    id="mojo",
    display_name="Mojo",
    languages=["mojo"],
    image="symbiont/mojo:0.1",
    file_template={"main.mojo": "{code}"},
    run_command=["mojo", "/workspace/main.mojo"],
    timeout_ms=30_000,
    memory_limit="1g",
    cpu_limit=1.0,
    network="none",
)

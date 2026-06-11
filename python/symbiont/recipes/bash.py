from symbiont.recipes.models import SandboxRecipe

BASH_RECIPE = SandboxRecipe(
    id="bash",
    display_name="Bash / Shell",
    languages=["bash", "sh", "shell", "zsh"],
    image="symbiont/bash:0.1",
    file_template={"script.sh": "{code}"},
    run_command=["bash", "/workspace/script.sh"],
    timeout_ms=10_000,
    memory_limit="128m",
    cpu_limit=0.5,
    network="none",
)

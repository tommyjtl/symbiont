import { checkHealth } from "../api/backend-client";
import { DEFAULT_DOMAIN_WHITELIST_TEXT } from "../storage/domain-whitelist";

const statusDot = document.getElementById("status-dot")!;
const statusText = document.getElementById("status-text")!;
const recipesEl = document.getElementById("recipes")!;
const whitelistInput = document.getElementById("domain-whitelist") as HTMLTextAreaElement;
const backendInput = document.getElementById("backend-url") as HTMLInputElement;
const saveBtn = document.getElementById("save-settings")!;

async function loadSettings(): Promise<void> {
  const stored = await chrome.storage.sync.get(["backendUrl", "domainWhitelist"]);
  backendInput.value = (stored.backendUrl as string) || "http://127.0.0.1:7341";
  whitelistInput.value =
    (stored.domainWhitelist as string) || DEFAULT_DOMAIN_WHITELIST_TEXT;
}

async function refreshStatus(): Promise<void> {
  try {
    const health = await checkHealth();
    if (health.dockerOk) {
      statusDot.className = "dot ok";
      statusText.textContent = `Backend v${health.version} · Docker ready`;
    } else {
      statusDot.className = "dot warn";
      statusText.textContent = "Backend online · Docker not available";
    }

    recipesEl.innerHTML = `
      <strong>Recipes</strong>
      <ul>
        ${health.recipes
          .map((r) => `<li>${r.displayName} (${r.languages.join(", ")})</li>`)
          .join("")}
      </ul>
    `;
  } catch {
    statusDot.className = "dot error";
    statusText.textContent = "Backend offline — run python/scripts/dev.sh";
    recipesEl.innerHTML = "";
  }
}

saveBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    backendUrl: backendInput.value.trim(),
    domainWhitelist: whitelistInput.value,
  });
  saveBtn.textContent = "Saved!";
  setTimeout(() => {
    saveBtn.textContent = "Save";
  }, 1200);
  await refreshStatus();
});

void loadSettings();
void refreshStatus();

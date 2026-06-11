import { extensionLastError, extensionSendMessage } from "../extension-api";
import type {
  CodeBlockContext,
  ExecutionResult,
  HealthResponse,
  Session,
} from "./types";

export type ApiMessage =
  | { type: "api:health" }
  | { type: "api:run"; recipeId: string; code: string }
  | { type: "api:saveSession"; session: Partial<Session> & { url: string; domain: string; recipeId: string; originalCode: string; currentCode: string } }
  | { type: "api:getSession"; url: string }
  | { type: "api:patchSession"; sessionId: string; patch: Partial<Session> }
  | { type: "api:matchRecipe"; language: string };

export type ApiResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

function sendMessage<T>(message: ApiMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    extensionSendMessage<ApiResponse>(message, (response) => {
      const lastError = extensionLastError();
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error ?? "Unknown API error"));
        return;
      }
      resolve(response.data as T);
    });
  });
}

export async function checkHealth(): Promise<HealthResponse> {
  return sendMessage<HealthResponse>({ type: "api:health" });
}

export async function runCode(recipeId: string, code: string): Promise<ExecutionResult> {
  return sendMessage<ExecutionResult>({
    type: "api:run",
    recipeId,
    code,
  });
}

export async function saveSession(
  session: Partial<Session> & {
    url: string;
    domain: string;
    recipeId: string;
    originalCode: string;
    currentCode: string;
  }
): Promise<Session> {
  return sendMessage<Session>({ type: "api:saveSession", session });
}

export async function getSession(url: string): Promise<Session | null> {
  try {
    return await sendMessage<Session>({ type: "api:getSession", url });
  } catch {
    return null;
  }
}

export async function patchSession(
  sessionId: string,
  patch: Partial<Session>
): Promise<Session> {
  return sendMessage<Session>({ type: "api:patchSession", sessionId, patch });
}

export async function matchRecipe(language: string): Promise<string | null> {
  const result = await sendMessage<{ recipeId: string | null }>({
    type: "api:matchRecipe",
    language,
  });
  return result.recipeId;
}

export function inferRecipeId(language: string | null): string {
  if (!language) return "bash";
  const normalized = language.toLowerCase();
  if (["bash", "sh", "shell", "zsh"].includes(normalized)) return "bash";
  if (normalized === "mojo") return "mojo";
  return "bash";
}

export function buildContext(
  element: HTMLElement,
  code: string,
  language: string | null
): CodeBlockContext {
  const url = window.location.href;
  const domain = window.location.hostname;
  const pageTitle = document.title;
  const nearestHeading = findNearestHeading(element);

  return {
    url,
    domain,
    pageTitle,
    nearestHeading,
    code,
    language,
    recipeId: inferRecipeId(language),
  };
}

function findNearestHeading(element: HTMLElement): string {
  let node: HTMLElement | null = element;
  while (node) {
    const prev = node.previousElementSibling as HTMLElement | null;
    if (prev) {
      const heading = prev.closest("h1, h2, h3, h4, h5, h6") ?? prev.querySelector("h1, h2, h3, h4, h5, h6");
      if (heading?.textContent) return heading.textContent.trim();
    }
    node = node.parentElement;
    if (node) {
      const heading = node.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6");
      if (heading?.textContent) return heading.textContent.trim();
    }
  }
  return "";
}

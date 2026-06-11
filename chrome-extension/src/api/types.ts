export interface RecipeInfo {
  id: string;
  displayName: string;
  languages: string[];
  image: string;
  timeoutMs?: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  dockerOk: boolean;
  recipes: RecipeInfo[];
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface Session {
  id: string;
  url: string;
  domain: string;
  pageTitle: string;
  nearestHeading: string;
  recipeId: string;
  originalCode: string;
  currentCode: string;
  stdout: string;
  stderr: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodeBlockContext {
  url: string;
  domain: string;
  pageTitle: string;
  nearestHeading: string;
  code: string;
  language: string | null;
  recipeId: string;
}

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

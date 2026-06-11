export interface ParsedMojoSnippet {
  imports: string[];
  body: string[];
}

const MAIN_RE = /\b(fn|def)\s+main\s*\(/;
const IMPORT_RE = /^(?:from\s+.+\s+import\s+|import\s+\S)/;
const TOP_LEVEL_DEF_RE = /^(?:fn|def)\s+(\w+)\s*\(/;
const INPUT_RE = /\binput\s*\(/;

function normalizeLines(code: string): string[] {
  return code.replace(/\n$/, "").split("\n");
}

function isImportLine(line: string): boolean {
  return IMPORT_RE.test(line.trim());
}

function indentBlock(lines: string[]): string {
  return lines
    .map((line) => (line.trim() === "" ? "" : `    ${line}`))
    .join("\n");
}

function mainSignature(body: string): string {
  return INPUT_RE.test(body) ? "def main() raises:" : "def main():";
}

export const MojoSnippet = {
  hasMainEntry(code: string): boolean {
    return MAIN_RE.test(code);
  },

  hasTopLevelDefinitions(code: string): boolean {
    for (const line of normalizeLines(code)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(TOP_LEVEL_DEF_RE);
      if (match && match[1] !== "main") {
        return true;
      }
    }
    return false;
  },

  canWrapInMain(code: string): boolean {
    return !this.hasMainEntry(code) && !this.hasTopLevelDefinitions(code);
  },

  parse(code: string): ParsedMojoSnippet {
    const lines = normalizeLines(code);
    const imports: string[] = [];
    const body: string[] = [];
    let index = 0;

    while (index < lines.length && lines[index].trim() === "") {
      index++;
    }

    while (index < lines.length && isImportLine(lines[index])) {
      imports.push(lines[index]);
      index++;
    }

    if (index < lines.length && lines[index].trim() === "") {
      index++;
    }

    while (index < lines.length) {
      body.push(lines[index]);
      index++;
    }

    return { imports, body };
  },

  wrapInMain(code: string): string | null {
    if (!this.canWrapInMain(code)) {
      return null;
    }

    const { imports, body } = this.parse(code);
    if (body.length === 0) {
      return null;
    }

    const signature = mainSignature(body.join("\n"));
    const parts: string[] = [];

    if (imports.length > 0) {
      parts.push(imports.join("\n"), "");
    }

    parts.push(signature, indentBlock(body));
    return `${parts.join("\n")}\n`;
  },
} as const;

// Convenience exports for call sites that do not use the singleton directly.
export const hasMainEntry = MojoSnippet.hasMainEntry.bind(MojoSnippet);
export const wrapInMain = (code: string, recipeId: string): string | null =>
  recipeId === "mojo" ? MojoSnippet.wrapInMain(code) : null;

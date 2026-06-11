const CODE_SELECTORS = [
  "pre code",
  "pre",
];

const SYMBIONT_MARK = "data-symbiont-enhanced";

export interface DetectedBlock {
  element: HTMLElement;
  code: string;
  language: string | null;
}

export function detectCodeBlocks(root: ParentNode = document): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];
  const seenPres = new Set<HTMLElement>();

  for (const node of root.querySelectorAll<HTMLElement>("pre")) {
    if (seenPres.has(node)) continue;
    if (node.closest(`[${SYMBIONT_MARK}]`)) continue;
    if (!isVisibleCodeBlock(node)) continue;

    const codeEl = node.querySelector("code");
    const target = (codeEl ?? node) as HTMLElement;
    const code = extractCode(target, node);
    if (!code.trim()) continue;

    seenPres.add(node);
    blocks.push({
      element: target,
      code,
      language: extractLanguage(target, node),
    });
  }

  // Fallback for sites that use code blocks without <pre>
  for (const selector of CODE_SELECTORS) {
    if (selector === "pre") continue;
    for (const node of root.querySelectorAll<HTMLElement>(selector)) {
      if (node.closest("pre")) continue;
      if (!isVisibleCodeBlock(node)) continue;

      const code = extractCode(node, node.closest("pre"));
      if (!code.trim()) continue;

      blocks.push({
        element: node,
        code,
        language: extractLanguage(node, node.closest("pre")),
      });
    }
  }

  return blocks;
}

export function isSymbiontNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return (
    node.classList.contains("symbiont-toolbar-host") ||
    node.id === "symbiont-sandbox-host" ||
    node.hasAttribute(SYMBIONT_MARK) ||
    !!node.closest(`[${SYMBIONT_MARK}], .symbiont-toolbar-host, #symbiont-sandbox-host`)
  );
}

export function markEnhanced(container: HTMLElement): void {
  container.setAttribute(SYMBIONT_MARK, "true");
}

function isVisibleCodeBlock(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width < 20 || rect.height < 10) return false;
  const text = el.textContent?.trim() ?? "";
  return text.length >= 2;
}

function lineElementText(el: Element): string {
  return (el.textContent ?? "").replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

function isLineElement(el: Element): boolean {
  return (
    el instanceof HTMLElement &&
    (el.classList.contains("line") ||
      el.classList.contains("token-line") ||
      el.classList.contains("code-line") ||
      el.dataset.line !== undefined)
  );
}

function extractFromLineSpans(root: HTMLElement): string | null {
  // Shiki / Docusaurus: one <span class="line"> per source line.
  // Use textContent per span — innerText doubles newlines (block layout + trailing \n).
  const direct = Array.from(root.children).filter(isLineElement);
  if (direct.length > 0) {
    return direct.map(lineElementText).join("\n");
  }

  return null;
}

function extractCode(el: HTMLElement, pre: HTMLElement | null): string {
  const root =
    el.tagName === "CODE" ? el : (el.querySelector("code") ?? pre ?? el);

  const fromLines = extractFromLineSpans(root);
  if (fromLines !== null) {
    return fromLines.trimEnd();
  }

  // highlight.js table layout: one <tr> per line
  const rows = root.querySelectorAll("table tr");
  if (rows.length > 0) {
    return Array.from(rows)
      .map((row) => lineElementText(row))
      .join("\n")
      .trimEnd();
  }

  // Generic fallback: innerText for <br>-based blocks, else textContent
  const rendered = root.innerText?.trimEnd() ?? "";
  if (rendered.includes("\n")) {
    return rendered;
  }

  return (root.textContent ?? "").trimEnd();
}

function extractLanguage(el: HTMLElement, pre: HTMLElement | null): string | null {
  const fromClasses = languageFromClasses(el, pre);
  if (fromClasses) return fromClasses;

  const fromFilename = languageFromCodeBlockTitle(pre ?? el);
  if (fromFilename) return fromFilename;

  return null;
}

function languageFromClasses(el: HTMLElement, pre: HTMLElement | null): string | null {
  let node: HTMLElement | null = el;
  while (node) {
    for (const cls of node.classList) {
      const lang = cls.match(/language-([\w-]+)/);
      if (lang) return lang[1];
      const hljs = cls.match(/hljs-(\w+)/);
      if (hljs) return hljs[1];
    }

    const dataLang =
      node.getAttribute("data-language") ??
      node.getAttribute("data-lang") ??
      node.getAttribute("data-code-language");
    if (dataLang) return dataLang;

    node = node.parentElement;
  }

  if (pre) {
    const code = pre.querySelector("code");
    if (code && code !== el) {
      return languageFromClasses(code as HTMLElement, pre);
    }
  }

  return null;
}

function languageFromCodeBlockTitle(blockRoot: HTMLElement): string | null {
  const container =
    blockRoot.closest(
      '[class*="code-block"], [class*="CodeBlock"], .theme-code-block, .prism-code'
    ) ?? blockRoot.parentElement;

  if (!container) return null;

  const titleEl = container.querySelector(
    '[class*="code-block-title"], [class*="codeBlockTitle"], [class*="filename"], [class*="file-name"]'
  );
  const title = titleEl?.textContent?.trim() ?? "";

  const extMatch = title.match(/\.([a-zA-Z0-9]+)$/);
  if (extMatch) {
    const ext = extMatch[1].toLowerCase();
    if (ext === "mojo") return "mojo";
    if (["sh", "bash", "zsh"].includes(ext)) return "bash";
    return ext;
  }

  return null;
}

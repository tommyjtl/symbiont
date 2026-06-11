import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import {
  StreamLanguage,
  defaultHighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from "@codemirror/language";

const lightTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "#ffffff",
    color: "#1a1a2e",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    lineHeight: "1.5",
  },
  ".cm-content": {
    padding: "8px 0",
    caretColor: "#1a73e8",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#1a73e8",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "#cce5ff !important",
  },
  ".cm-gutters": {
    backgroundColor: "#f6f8fa",
    color: "#8c959f",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#eaeef2",
  },
  ".cm-activeLine": {
    backgroundColor: "#f6f8fa",
  },
});

export function createEditor(
  parent: HTMLElement,
  initialCode: string,
  language: string | null,
  onChange: (code: string) => void,
  recipeId?: string
): EditorView {
  const lang = language?.toLowerCase();
  const extensions = [
    lineNumbers(),
    history(),
    indentUnit.of("    "),
    keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
    EditorView.lineWrapping,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    lightTheme,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
  ];

  if (["bash", "sh", "shell", "zsh"].includes(lang ?? "")) {
    extensions.push(StreamLanguage.define(shell));
  }

  // TODO: Replace with a customized Shiki integration using modular/mojo-syntax
  // (syntaxes/mojo.syntax.json) so highlighting matches Mojo docs / VS Code.
  const highlightLang = lang ?? recipeId?.toLowerCase();
  if (highlightLang === "mojo") {
    extensions.push(python());
  }

  const state = EditorState.create({
    doc: initialCode,
    extensions,
  });

  return new EditorView({ state, parent });
}

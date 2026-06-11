import re
from dataclasses import dataclass

_MAIN_RE = re.compile(r"\b(fn|def)\s+main\s*\(", re.MULTILINE)
_IMPORT_RE = re.compile(r"^(?:from\s+.+\s+import\s+|import\s+\S)")
_TOP_LEVEL_DEF_RE = re.compile(r"^(?:fn|def)\s+(\w+)\s*\(", re.MULTILINE)
_FUNC_RE = re.compile(r"^\s*(?:fn|def)\s+(\w+)\s*\(", re.MULTILINE)
_INPUT_RE = re.compile(r"\binput\s*\(")
_USAGE_PREFIXES = ("use_", "run_", "demo_", "test_", "example_")


@dataclass(frozen=True)
class ParsedMojoSnippet:
    imports: list[str]
    body: list[str]


def _normalize_lines(code: str) -> list[str]:
    return code.rstrip("\n").split("\n")


def _is_import_line(line: str) -> bool:
    return bool(_IMPORT_RE.match(line.strip()))


def _main_signature(body: str) -> str:
    return "def main() raises:" if _INPUT_RE.search(body) else "def main():"


def _indent_block(lines: list[str]) -> str:
    return "\n".join("" if line.strip() == "" else f"    {line}" for line in lines)


class MojoSnippet:
    @staticmethod
    def has_main_entry(code: str) -> bool:
        return bool(_MAIN_RE.search(code))

    @staticmethod
    def has_top_level_definitions(code: str) -> bool:
        for line in _normalize_lines(code):
            trimmed = line.strip()
            if not trimmed or trimmed.startswith("#"):
                continue
            match = _TOP_LEVEL_DEF_RE.match(trimmed)
            if match and match.group(1) != "main":
                return True
        return False

    @staticmethod
    def can_wrap_in_main(code: str) -> bool:
        return not MojoSnippet.has_main_entry(code) and not MojoSnippet.has_top_level_definitions(
            code
        )

    @staticmethod
    def parse(code: str) -> ParsedMojoSnippet:
        lines = _normalize_lines(code)
        imports: list[str] = []
        body: list[str] = []
        index = 0

        while index < len(lines) and lines[index].strip() == "":
            index += 1

        while index < len(lines) and _is_import_line(lines[index]):
            imports.append(lines[index])
            index += 1

        if index < len(lines) and lines[index].strip() == "":
            index += 1

        while index < len(lines):
            body.append(lines[index])
            index += 1

        return ParsedMojoSnippet(imports=imports, body=body)

    @staticmethod
    def wrap_in_main(code: str) -> str | None:
        if not MojoSnippet.can_wrap_in_main(code):
            return None

        parsed = MojoSnippet.parse(code)
        if not parsed.body:
            return None

        parts: list[str] = []
        if parsed.imports:
            parts.extend(["\n".join(parsed.imports), ""])

        parts.extend(
            [
                _main_signature("\n".join(parsed.body)),
                _indent_block(parsed.body),
            ]
        )
        return "\n".join(parts) + "\n"


def prepare_mojo_code(code: str) -> str:
    """Prepare doc snippets for execution in a Mojo sandbox."""
    if MojoSnippet.has_main_entry(code):
        return code

    wrapped = MojoSnippet.wrap_in_main(code)
    if wrapped is not None:
        return wrapped

    funcs = [name for name in _FUNC_RE.findall(code) if name != "main"]
    if not funcs:
        return code.rstrip() + "\n\nfn main():\n    pass\n"

    entry = _pick_entry_function(funcs)
    return (
        code.rstrip()
        + "\n\n# Symbiont: auto-generated entry point\n"
        + f"fn main():\n    {entry}()\n"
    )


def _pick_entry_function(funcs: list[str]) -> str:
    for prefix in _USAGE_PREFIXES:
        for name in reversed(funcs):
            if name.startswith(prefix):
                return name
    return funcs[-1]

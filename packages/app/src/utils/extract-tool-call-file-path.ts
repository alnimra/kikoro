import type { ToolCallDetail } from "@server/server/agent/agent-sdk-types";

const SHELL_FILE_COMMANDS = new Set([
  "cat",
  "bat",
  "less",
  "more",
  "head",
  "tail",
  "wc",
  "nl",
  "tac",
  "od",
  "xxd",
  "file",
  "stat",
  "column",
  "md5",
  "md5sum",
  "sha1sum",
  "sha256sum",
  "shasum",
]);

const SHELL_OPERATOR_PATTERN = /[|><&;`$()]/;
const SHORT_FLAG_PATTERN = /^-[a-zA-Z]$/;

export type ToolCallFileIntent = "read" | "write";

export interface ToolCallFileRef {
  path: string;
  intent: ToolCallFileIntent;
}

function stripQuotes(token: string): string {
  if (token.length >= 2) {
    const first = token[0];
    const last = token[token.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return token.slice(1, -1);
    }
  }
  return token;
}

function looksLikePath(token: string): boolean {
  const cleaned = stripQuotes(token);
  if (!cleaned || cleaned.startsWith("-")) {
    return false;
  }
  if (cleaned.includes("=")) {
    return false;
  }
  return true;
}

function extractFromShellReadCommand(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed || SHELL_OPERATOR_PATTERN.test(trimmed)) {
    return null;
  }
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) {
    return null;
  }
  if (!SHELL_FILE_COMMANDS.has(tokens[0])) {
    return null;
  }
  const last = tokens[tokens.length - 1];
  if (last.startsWith("-")) {
    return null;
  }
  if (tokens.length > 2) {
    const prev = tokens[tokens.length - 2];
    if (!prev.startsWith("-")) {
      const prevPrev = tokens[tokens.length - 3];
      if (!prevPrev || !SHORT_FLAG_PATTERN.test(prevPrev)) {
        return null;
      }
    }
  }
  return last;
}

// Matches the rightmost > or >> redirect target outside quotes.
// Handles: `cmd > file.md`, `cmd >>file.md`, `cmd 2> file.md` (we accept it),
// `cmd > "path with space.md"`, `cmd > 'p.md'`.
const REDIRECT_TARGET_PATTERN =
  /(?:^|\s|\d)>>?\s*("([^"]+)"|'([^']+)'|([^\s|&;`()<>]+))(?=\s|$|[|&;`()<>])/g;

function extractFromShellRedirect(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) {
    return null;
  }
  let match: RegExpExecArray | null;
  let last: string | null = null;
  const re = new RegExp(REDIRECT_TARGET_PATTERN.source, REDIRECT_TARGET_PATTERN.flags);
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex-loop idiom
  while ((match = re.exec(trimmed)) !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (value && looksLikePath(value)) {
      last = value;
    }
  }
  return last;
}

// Matches `tee [-a|--append] [...] path` and treats the final non-flag token as the
// destination path. Handles single-target form only — multi-target `tee a.md b.md` is rare
// and would surface only the last for simplicity.
function extractFromShellTee(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) {
    return null;
  }
  // Be liberal: allow `tee` anywhere in the command (e.g. `cmd | tee path`), but
  // not when followed by another shell operator on its right (e.g. `... | tee | cat`).
  const teeIdx = trimmed.search(/(^|[|;&]\s*)tee(\s|$)/);
  if (teeIdx < 0) {
    return null;
  }
  // Take everything after `tee` up to the next pipe/redirect/semicolon.
  const after = trimmed.slice(teeIdx).replace(/^[^t]*tee\s*/, "");
  const segment = after.split(/[|;&<>]/)[0]?.trim() ?? "";
  if (!segment) {
    return null;
  }
  const tokens = segment.split(/\s+/).filter((t) => t.length > 0);
  // Skip leading flags like `-a`, `--append`.
  const positional = tokens.filter((t) => !t.startsWith("-"));
  if (positional.length === 0) {
    return null;
  }
  const last = positional[positional.length - 1];
  const cleaned = stripQuotes(last);
  return looksLikePath(cleaned) ? cleaned : null;
}

function extractWriteFromShellCommand(command: string): string | null {
  // Prefer the redirect target since it appears later in the pipeline and
  // represents the actual file the user cares about. Fall back to tee.
  const redirect = extractFromShellRedirect(command);
  if (redirect) {
    return redirect;
  }
  return extractFromShellTee(command);
}

export function extractToolCallFilePath(detail: ToolCallDetail | undefined): string | null {
  if (!detail) {
    return null;
  }
  switch (detail.type) {
    case "read":
    case "edit":
    case "write":
      return detail.filePath || null;
    case "shell": {
      const read = extractFromShellReadCommand(detail.command);
      if (read) {
        return read;
      }
      return extractWriteFromShellCommand(detail.command);
    }
    default:
      return null;
  }
}

export function extractToolCallFileRef(detail: ToolCallDetail | undefined): ToolCallFileRef | null {
  if (!detail) {
    return null;
  }
  switch (detail.type) {
    case "read":
      return detail.filePath ? { path: detail.filePath, intent: "read" } : null;
    case "edit":
    case "write":
      return detail.filePath ? { path: detail.filePath, intent: "write" } : null;
    case "shell": {
      const read = extractFromShellReadCommand(detail.command);
      if (read) {
        return { path: read, intent: "read" };
      }
      const write = extractWriteFromShellCommand(detail.command);
      if (write) {
        return { path: write, intent: "write" };
      }
      return null;
    }
    default:
      return null;
  }
}

const MARKDOWN_EXTENSIONS = [".md", ".markdown"];

export function isMarkdownPath(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }
  const lower = path.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

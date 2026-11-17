export type SearchInput = Record<string, unknown>;

export type SearchDecode =
  | { readonly kind: "accepted"; readonly input: SearchInput }
  | { readonly kind: "ignored"; readonly category: "field" | "value" };

const GREP_FIELDS = new Set([
  "pattern",
  "path",
  "glob",
  "output_mode",
  "-B",
  "-A",
  "-C",
  "context",
  "-n",
  "-i",
  "-o",
  "type",
  "head_limit",
  "offset",
  "multiline",
]);

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** Projects Pi's glob and content search calls into the supported hook view. */
export function toHookSearchInput(tool: "find" | "grep", input: SearchInput): SearchInput {
  if (typeof input.pattern !== "string") {
    return input;
  }

  const mapped: SearchInput = { pattern: input.pattern };
  if (input.path !== undefined) {
    mapped.path = input.path;
  }

  if (tool === "find") {
    return mapped;
  }

  mapped.pattern = input.literal === true ? escapeRegex(input.pattern) : input.pattern;
  mapped.output_mode = "content";
  mapped["-n"] = true;
  if (input.glob !== undefined) {
    mapped.glob = input.glob;
  }

  if (input.ignoreCase !== undefined) {
    mapped["-i"] = input.ignoreCase;
  }

  if (input.context !== undefined) {
    mapped.context = input.context;
  }

  if (!(typeof input.context === "number" && input.context > 0)) {
    mapped.head_limit = input.limit ?? 100;
  }

  return mapped;
}

function validGrepOptions(candidate: SearchInput): boolean {
  return !(
    candidate.output_mode !== "content" ||
    candidate["-n"] !== true ||
    (candidate.glob !== undefined && typeof candidate.glob !== "string") ||
    (candidate["-i"] !== undefined && typeof candidate["-i"] !== "boolean") ||
    (candidate["-o"] !== undefined && candidate["-o"] !== false) ||
    (candidate.offset !== undefined && candidate.offset !== 0) ||
    (candidate.multiline !== undefined && candidate.multiline !== false) ||
    candidate.type !== undefined
  );
}

function grepContext(candidate: SearchInput): number | undefined {
  for (const key of ["context", "-C", "-A", "-B"] as const) {
    if (candidate[key] !== undefined && !nonnegativeInteger(candidate[key])) {
      return undefined;
    }
  }

  if (
    candidate.context !== undefined &&
    candidate["-C"] !== undefined &&
    candidate.context !== candidate["-C"]
  ) {
    return undefined;
  }

  const context = (candidate.context ?? candidate["-C"] ?? 0) as number;
  const before = (candidate["-B"] ?? context) as number;
  const after = (candidate["-A"] ?? context) as number;
  const baseSupplied = candidate.context !== undefined || candidate["-C"] !== undefined;
  if (
    before !== after ||
    (baseSupplied && candidate["-A"] !== undefined && candidate["-A"] !== context) ||
    (baseSupplied && candidate["-B"] !== undefined && candidate["-B"] !== context)
  ) {
    return undefined;
  }

  return before;
}

function decodeGrepInput(
  original: SearchInput,
  candidate: SearchInput,
  native: SearchInput,
): SearchDecode {
  if (!validGrepOptions(candidate)) {
    return { kind: "ignored", category: "value" };
  }

  const context = grepContext(candidate);
  if (context === undefined) {
    return { kind: "ignored", category: "value" };
  }

  if (candidate.glob !== undefined) {
    native.glob = candidate.glob;
  }

  if (candidate["-i"] !== undefined) {
    native.ignoreCase = candidate["-i"];
  }

  if (context > 0) {
    native.context = context;
  }

  const originalPattern = original.pattern;
  if (
    original.literal === true &&
    typeof originalPattern === "string" &&
    candidate.pattern === escapeRegex(originalPattern)
  ) {
    native.pattern = originalPattern;
    native.literal = true;
  }

  if (context > 0) {
    if (candidate.head_limit !== undefined) {
      return { kind: "ignored", category: "value" };
    }

    if (original.limit !== undefined) {
      native.limit = original.limit;
    }
  } else if (candidate.head_limit !== undefined) {
    if (!positiveInteger(candidate.head_limit)) {
      return { kind: "ignored", category: "value" };
    }

    native.limit = candidate.head_limit;
  }

  return { kind: "accepted", input: native };
}

/** Rebuilds a native search request only when every supplied option is equivalent. */
export function decodeSearchInput(
  tool: "find" | "grep",
  original: SearchInput,
  candidate: SearchInput,
): SearchDecode {
  const fields = tool === "find" ? new Set(["pattern", "path"]) : GREP_FIELDS;
  if (Object.keys(candidate).some((key) => !fields.has(key))) {
    return { kind: "ignored", category: "field" };
  }

  if (
    typeof candidate.pattern !== "string" ||
    (candidate.path !== undefined && typeof candidate.path !== "string")
  ) {
    return { kind: "ignored", category: "value" };
  }

  const native: SearchInput = { pattern: candidate.pattern };
  if (candidate.path !== undefined) {
    native.path = candidate.path;
  }

  if (tool === "grep") {
    return decodeGrepInput(original, candidate, native);
  }

  if (original.limit !== undefined) {
    native.limit = original.limit;
  }

  return { kind: "accepted", input: native };
}

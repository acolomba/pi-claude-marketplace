// tests/lint-rules/lib/frontmatter.js
//
// Memoized loader for the binding-contract YAML frontmatter at
// `docs/messaging-style-guide.md`. Module-scope cache ensures the 34 MSG-*
// rules that will land in Phase 14 Plans 04/05 don't re-parse the file on
// every lint invocation.
//
// D-14-10 (LOCKED YAML loader strategy): uses the `yaml` package, promoted
// from a transitive to a direct devDep in Plan 14-03 Task 1. The Phase 12
// D-CMC-04 deferral ("Phase 14 owns the richer reader") is satisfied here:
// the four closed sets `status_tokens`, `reasons`, `markers`, and
// `pattern_classes` are all exposed as frozen `string[]` named exports, and
// `tests/architecture/grammar-frontmatter.test.ts` migrates from the
// hand-rolled `extractFrontmatterList` regex extractor to consume this
// loader (Plan 14-03 Task 4).
//
// Fail-fast posture: `readFileSync` runs at ESM import time and any of the
// shape assertions inside `parseStyleGuideFrontmatter` throw on malformed
// input. Any rule file that imports this loader will fail at module load
// if the binding contract drifts -- this IS the drift-guard's "fail
// closed" behavior, satisfying T-14-05 in the threat register.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const STYLE_GUIDE_PATH = path.join(REPO_ROOT, "docs/messaging-style-guide.md");

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

/**
 * Pure parser exposed for unit testing: takes the full style-guide markdown
 * body and returns the frozen 4-key frontmatter projection. Throws on any
 * shape violation (no frontmatter, parsed-as-non-object, missing key, key
 * not a string[]).
 *
 * Plan 14-03 Task 4 uses this helper for the loader-level negative tests
 * that the Phase 12 `extractFrontmatterList throws if ...` tests carried
 * forward.
 *
 * @param {string} md
 * @returns {{
 *   STATUS_TOKENS_FRONTMATTER: readonly string[],
 *   REASONS_FRONTMATTER: readonly string[],
 *   MARKERS_FRONTMATTER: readonly string[],
 *   PATTERN_CLASSES_FRONTMATTER: readonly string[]
 * }}
 */
export function parseStyleGuideFrontmatter(md) {
  const match = FRONTMATTER_RE.exec(md);
  if (match === null) {
    throw new Error("messaging-style-guide.md: no YAML frontmatter found at file head");
  }

  const parsed = parseYaml(match[1]);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("messaging-style-guide.md: frontmatter parsed as non-object");
  }

  const requireList = (key) => {
    const value = parsed[key];
    if (!Array.isArray(value) || value.some((x) => typeof x !== "string")) {
      throw new Error(
        `messaging-style-guide.md frontmatter: key "${key}" missing or not a string[]`,
      );
    }

    return Object.freeze([...value]);
  };

  return Object.freeze({
    STATUS_TOKENS_FRONTMATTER: requireList("status_tokens"),
    REASONS_FRONTMATTER: requireList("reasons"),
    MARKERS_FRONTMATTER: requireList("markers"),
    PATTERN_CLASSES_FRONTMATTER: requireList("pattern_classes"),
  });
}

let _cache = null;

/**
 * Memoized loader: reads `docs/messaging-style-guide.md` once per Node
 * process and returns the frozen 4-key projection. Subsequent calls return
 * the cached value without re-reading the file.
 *
 * @returns {ReturnType<typeof parseStyleGuideFrontmatter>}
 */
export function loadFrontmatter() {
  if (_cache !== null) {
    return _cache;
  }

  const md = readFileSync(STYLE_GUIDE_PATH, "utf8");
  _cache = parseStyleGuideFrontmatter(md);
  return _cache;
}

const _loaded = loadFrontmatter();

export const STATUS_TOKENS_FRONTMATTER = _loaded.STATUS_TOKENS_FRONTMATTER;
export const REASONS_FRONTMATTER = _loaded.REASONS_FRONTMATTER;
export const MARKERS_FRONTMATTER = _loaded.MARKERS_FRONTMATTER;
export const PATTERN_CLASSES_FRONTMATTER = _loaded.PATTERN_CLASSES_FRONTMATTER;

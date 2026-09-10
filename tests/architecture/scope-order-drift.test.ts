// tests/architecture/scope-order-drift.test.ts
//
// Drift guard for scope-order literals OUTSIDE the canonical declaration
// sites. Complements the runtime ESLint rule
// `msg-gr-3-per-scope` (which is scoped to `orchestrators/**` and
// `edge/handlers/**` only).
//
// This test recursively scans every `.ts` file under the extension root for
// two duplications of the canonical scope ordering:
//
//   1. The literal array `["user", "project"]` (in either case-sensitive
//      form, with arbitrary whitespace between tokens). The canonical
//      enumeration constant is `export const SCOPES` in the `SCOPES` owner
//      named below; every iteration site should import-and-reuse rather than
//      re-declare the ordering.
//
//   2. The inline scope-rank ternary `=== "user" ? 0 : 1`. The canonical
//      comparator is `compareByNameThenScope` in the comparator owner named
//      below; every sort site should call the shared helper rather than
//      re-derive the rank in-line.
//
// Both owners, and the walk root, come from the target registry (D-07-05);
// this file spells no production path of its own.
//
// The allowlist contains files that MUST contain the canonical literal
// because they ARE the canonical declaration, so it IS the registry's
// canonical-target group. Adding entries beyond the allowlist requires a
// `// scope-order: justified -- <reason>` marker in the offending file AND
// extending `SCOPE_ORDER_CANONICAL_TARGETS` in the SAME commit (the
// maintainer of the literal owns the marker).
//
// Why not put this in the ESLint plugin? The existing
// `msg-gr-3-per-scope` rule is scoped to `orchestrators/` and
// `edge/handlers/` per the surface-pattern rules; this guard covers the whole
// extension tree and runs at test time so a new offender file outside the
// eslint glob still fails CI.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { EXTENSION_ROOT_REL, SCOPE_ORDER_CANONICAL_TARGETS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

/** The `SCOPES` enumeration owner. Every other iteration site imports from it. */
const SCOPES_OWNER_REL = SCOPE_ORDER_CANONICAL_TARGETS[0];

/**
 * The `compareByNameThenScope` owner. It spells `=== "project" ? -1 : 1`, NOT
 * the user-first form the rank guard detects, so it is allowlisted against a
 * future refactor that flipped the comparator rather than against today's text.
 */
const COMPARATOR_OWNER_REL = SCOPE_ORDER_CANONICAL_TARGETS[1];

// The two canonical declaration sites come from the registry (D-07-05). File
// paths are normalised to forward slashes for cross-platform stability and
// matched with a leading slash so a parent directory accidentally sharing the
// suffix cannot match (defensive containment check, mirrors the
// `path.relative()` containment idiom in `shared/path-safety.ts`).
const ALLOWLIST_FILES: ReadonlySet<string> = new Set(
  SCOPE_ORDER_CANONICAL_TARGETS.map((rel) => `/${rel}`),
);

const USER_FIRST_LITERAL_RE = /\[\s*"user"\s*,\s*"project"\s*\]/;
const USER_FIRST_RANK_RE = /===\s*"user"\s*\?\s*\d+\s*:\s*\d+/;

async function walkTsFiles(root: string, repoRoot: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const abs = path.join(root, entry.name);
    if (entry.isDirectory()) {
      // Skip node_modules / .git / build outputs defensively.
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      out.push(...(await walkTsFiles(abs, repoRoot)));
      continue;
    }

    if (entry.isFile() && abs.endsWith(".ts")) {
      out.push(abs);
    }
  }

  return out;
}

function normaliseRel(repoRoot: string, abs: string): string {
  const rel = path.relative(repoRoot, abs);
  // Normalise Windows backslashes to forward slashes; prepend "/"
  // so the allowlist match cannot accidentally hit a parent directory
  // that ends in the same suffix.
  return "/" + rel.split(path.sep).join("/");
}

test('260525-cjr B3: no `["user", "project"]` literal outside the canonical SCOPES declaration', async () => {
  // Walk the whole extension tree -- assertion is tree-wide by design (not just
  // orchestrators/ + edge/handlers/ where the ESLint rule fires).
  const repoRoot = REPO_ROOT;
  const extensionsRoot = path.join(repoRoot, EXTENSION_ROOT_REL);
  const files = await walkTsFiles(extensionsRoot, repoRoot);

  assert.ok(
    files.length > 0,
    `D-07-03: the walk of ${EXTENSION_ROOT_REL} enumerated no file, so this guard inspected nothing and would report zero offenders over zero modules.`,
  );

  const offenders: { file: string; line: number; text: string }[] = [];
  for (const abs of files) {
    const rel = normaliseRel(repoRoot, abs);
    if (ALLOWLIST_FILES.has(rel)) {
      continue;
    }

    const lines = (await readFile(abs, "utf8")).split("\n");
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] ?? "";
      // Skip lines that carry the explicit justification marker.
      if (text.includes("scope-order: justified")) {
        continue;
      }

      if (USER_FIRST_LITERAL_RE.test(text)) {
        offenders.push({ file: rel, line: i + 1, text: text.trim() });
      }
    }
  }

  assert.equal(
    offenders.length,
    0,
    `Scope-order drift detected. Import the canonical \`SCOPES\` constant from \`${SCOPES_OWNER_REL}\` instead of redeclaring \`["user", "project"]\`. Offenders:\n${offenders
      .map((o) => `  ${o.file}:${String(o.line)}  ${o.text}`)
      .join("\n")}`,
  );
});

test('260525-cjr B3: no `=== "user" ? <low> : <high>` scope-rank ternary outside the canonical comparator', async () => {
  const repoRoot = REPO_ROOT;
  const extensionsRoot = path.join(repoRoot, EXTENSION_ROOT_REL);
  const files = await walkTsFiles(extensionsRoot, repoRoot);

  assert.ok(
    files.length > 0,
    `D-07-03: the walk of ${EXTENSION_ROOT_REL} enumerated no file, so this guard inspected nothing and would report zero offenders over zero modules.`,
  );

  const offenders: { file: string; line: number; text: string }[] = [];
  for (const abs of files) {
    const rel = normaliseRel(repoRoot, abs);
    if (ALLOWLIST_FILES.has(rel)) {
      continue;
    }

    const lines = (await readFile(abs, "utf8")).split("\n");
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i] ?? "";
      if (text.includes("scope-order: justified")) {
        continue;
      }

      if (USER_FIRST_RANK_RE.test(text)) {
        offenders.push({ file: rel, line: i + 1, text: text.trim() });
      }
    }
  }

  assert.equal(
    offenders.length,
    0,
    `Scope-rank drift detected. Use the canonical \`compareByNameThenScope\` from \`${COMPARATOR_OWNER_REL}\` instead of an inline \`scope === "user" ? <low> : <high>\` ternary. Offenders:\n${offenders
      .map((o) => `  ${o.file}:${String(o.line)}  ${o.text}`)
      .join("\n")}`,
  );
});

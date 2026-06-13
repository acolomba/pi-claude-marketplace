// tests/architecture/scope-order-drift.test.ts
//
// Drift guard for scope-order literals OUTSIDE the canonical declaration
// sites. Complements the runtime ESLint rule
// `msg-gr-3-per-scope` (which is scoped to `orchestrators/**` and
// `edge/handlers/**` only).
//
// This test recursively scans every `extensions/**/*.ts` file for two
// duplications of the canonical scope ordering:
//
//   1. The literal array `["user", "project"]` (in either case-sensitive
//      form, with arbitrary whitespace between tokens). The canonical
//      enumeration constant lives in `extensions/pi-claude-marketplace/
//      shared/types.ts` as `export const SCOPES`; every iteration site
//      should import-and-reuse rather than re-declare the ordering.
//
//   2. The inline scope-rank ternary `=== "user" ? 0 : 1`. The canonical
//      comparator lives in
//      `extensions/pi-claude-marketplace/shared/notify.ts::compareByNameThenScope`;
//      every sort site should call the shared helper rather than re-derive the
//      rank in-line.
//
// The allowlist contains files that MUST contain the canonical literal
// because they ARE the canonical declaration. Adding entries beyond the
// allowlist requires a `// scope-order: justified -- <reason>` marker in
// the offending file AND extending the ALLOWLIST_FILES set here in the
// SAME commit (the maintainer of the literal owns the marker).
//
// Why not put this in the ESLint plugin? The existing
// `msg-gr-3-per-scope` rule is scoped to `orchestrators/` and
// `edge/handlers/` per the surface-pattern rules; this guard is
// repo-wide (every TS file under `extensions/`) and runs at test time
// so a new offender file outside the eslint glob still fails CI.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// File paths are normalised to forward slashes for cross-platform stability
// and matched against ALLOWLIST_FILES with a leading slash so a parent
// directory accidentally sharing the suffix cannot match (defensive
// containment check, mirrors the `path.relative()` containment idiom in
// `shared/path-safety.ts`).
const ALLOWLIST_FILES: ReadonlySet<string> = new Set([
  // The canonical `SCOPES` enumeration constant. Every other iteration
  // site imports from here.
  "/extensions/pi-claude-marketplace/shared/types.ts",
  // The canonical `compareByNameThenScope` comparator. Uses
  // `=== "project" ? -1 : 1` (NOT the user-first form the guard
  // detects), but listed here for documentation completeness; a future
  // refactor that flipped the comparator to `=== "user" ? <low> : <high>`
  // would otherwise trip the guard.
  "/extensions/pi-claude-marketplace/shared/notify.ts",
]);

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
  // Walk from the repo root's `extensions/` tree -- assertion is repo-wide
  // by design (not just orchestrators/ + edge/handlers/ where the ESLint
  // rule fires).
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const extensionsRoot = path.join(repoRoot, "extensions");
  const files = await walkTsFiles(extensionsRoot, repoRoot);
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
    `Scope-order drift detected. Import the canonical \`SCOPES\` constant from \`extensions/pi-claude-marketplace/shared/types.ts\` instead of redeclaring \`["user", "project"]\`. Offenders:\n${offenders
      .map((o) => `  ${o.file}:${String(o.line)}  ${o.text}`)
      .join("\n")}`,
  );
});

test('260525-cjr B3: no `=== "user" ? <low> : <high>` scope-rank ternary outside the canonical comparator', async () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const extensionsRoot = path.join(repoRoot, "extensions");
  const files = await walkTsFiles(extensionsRoot, repoRoot);
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
    `Scope-rank drift detected. Use the canonical \`compareByNameThenScope\` from \`extensions/pi-claude-marketplace/shared/notify.ts\` instead of an inline \`scope === "user" ? <low> : <high>\` ternary. Offenders:\n${offenders
      .map((o) => `  ${o.file}:${String(o.line)}  ${o.text}`)
      .join("\n")}`,
  );
});

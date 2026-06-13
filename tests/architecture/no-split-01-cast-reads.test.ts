// SPLIT-01 cast-read baseline + rewire-completion gate.
//
// SPLIT-01 carved `autoupdate` out of MARKETPLACE_RECORD_SCHEMA and moved
// the truth into the per-marketplace config entry. The state
// record's `autoupdate` is read via a cast in 6 orchestrator files (7 total
// cast-read sites; marketplace/info.ts and plugin/info.ts each contain 2):
//
//   - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
//   - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
//   - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
//   - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
//   - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
//   - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
//
// Note on marketplace/shared.ts: that file holds the autoupdate FLIP logic.
// WR-05 made `classifyAutoupdateFlip` classify-only --
// the legacy state field is read (two-step cast, not the trailing-cast form
// below) but never assigned. The ASSIGNMENT-form sibling pattern further
// down locks that in: no orchestrator may write `.autoupdate =` into a
// state record (the config write-back is the sole flip surface).
//
// Rewire target:
//
//   const merged = await loadMergedScopeConfig(locations);
//   const autoupdate = merged.marketplaces[name]?.entry.autoupdate ?? false;
//
// `ALLOWED_SPLIT_01_AUTOUPDATE_CAST_FILES` is now empty -- every cast site
// has been rewired. The sibling "exactly 0" assertion forces a deliberate
// edit if a new cast read regresses (silent widening or silent shrinking
// are both caught in CI -- the same pattern config-state-write-seams.test.ts
// uses).
//
// Shape: mirrors tests/architecture/config-state-write-seams.test.ts (the
// SPLIT-02 architecture test) -- recursive walk of every `.ts` file under
// extensions/pi-claude-marketplace/orchestrators/, regex-based detection,
// ReadonlySet allow-list, sibling "exactly N" guard.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORCHESTRATORS_ROOT = path.join(REPO_ROOT, "extensions/pi-claude-marketplace/orchestrators");

// All 7 cast-read sites rewired to MergedConfig.
// The allow-list is now empty -- the cast-read hazard is closed. The sibling 'exactly 0'
// assertion below catches any future regression that adds a new cast read.
const ALLOWED_SPLIT_01_AUTOUPDATE_CAST_FILES: ReadonlySet<string> = new Set<string>();

// Regex: matches the trailing `).autoupdate` form produced by the SPLIT-01
// cast read pattern:
//
//   (record as unknown as Record<string, unknown>).autoupdate
//
// The `\s*` permits optional whitespace inside the generic argument list
// (which Prettier-formatted code does not insert today, but lexer-friendly
// variants might in future). Trailing `.autoupdate` is matched literally to
// avoid false-positives on unrelated `Record<string, unknown>` casts.
const SPLIT_01_AUTOUPDATE_CAST_PATTERN = /as unknown as Record<string,\s*unknown>\)\.autoupdate/;

// WR-05: sibling ASSIGNMENT-form pattern. SPLIT-01 carved
// `autoupdate` out of the state schema; writing `<expr>.autoupdate = ...`
// re-introduces a schema-stripped legacy field into state.json that the
// D-13 scrub removes again on the next load (pointless churn + a window
// where on-disk state carries a field the schema no longer owns). The
// negative lookahead excludes comparisons (`==` / `===`); object-literal
// property form (`autoupdate: value`) is intentionally NOT matched -- that
// is the sanctioned CONFIG-entry patch shape.
const SPLIT_01_AUTOUPDATE_ASSIGNMENT_PATTERN = /\.autoupdate\s*=(?!=)/;

async function* walkTsFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkTsFiles(full);
    } else if (entry.isFile() && full.endsWith(".ts")) {
      yield full;
    }
  }
}

test("SPLIT-01 baseline: every cast-read of autoupdate is in the allow-list", async () => {
  const offenders: string[] = [];
  for await (const file of walkTsFiles(ORCHESTRATORS_ROOT)) {
    const rel = path.relative(REPO_ROOT, file);
    if (ALLOWED_SPLIT_01_AUTOUPDATE_CAST_FILES.has(rel)) {
      continue;
    }

    const source = await readFile(file, "utf8");
    if (SPLIT_01_AUTOUPDATE_CAST_PATTERN.test(source)) {
      offenders.push(`${rel} matches ${String(SPLIT_01_AUTOUPDATE_CAST_PATTERN)}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `SPLIT-01 baseline violation: a new cast-read of \`autoupdate\` appeared outside the allow-list:\n  ${offenders.join("\n  ")}\n  (the carved-out autoupdate field lives in claude-plugins.json now; new reads should go through loadMergedScopeConfig(loc).merged.marketplaces[name]?.entry.autoupdate. If you intentionally need a new cast read, add the file to ALLOWED_SPLIT_01_AUTOUPDATE_CAST_FILES above AND update the 'exactly N' sibling assertion in this file in the same commit. The allow-list MUST stay at size 0 for SPLIT-01 to remain closed.)`,
  );
});

test("SPLIT-01 whitelist: exactly 0 files may read autoupdate via Record<string,unknown> cast", () => {
  assert.deepEqual([...ALLOWED_SPLIT_01_AUTOUPDATE_CAST_FILES].sort(), []);
});

test("SPLIT-01 / WR-05: no orchestrator assigns `.autoupdate =` on a state record (assignment-form gate, allow-list empty)", async () => {
  const offenders: string[] = [];
  for await (const file of walkTsFiles(ORCHESTRATORS_ROOT)) {
    const rel = path.relative(REPO_ROOT, file);
    const source = await readFile(file, "utf8");
    if (SPLIT_01_AUTOUPDATE_ASSIGNMENT_PATTERN.test(source)) {
      offenders.push(`${rel} matches ${String(SPLIT_01_AUTOUPDATE_ASSIGNMENT_PATTERN)}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `SPLIT-01 / WR-05 violation: an assignment-form write of \`autoupdate\` appeared in an orchestrator:\n  ${offenders.join("\n  ")}\n  (autoupdate truth lives in claude-plugins.json; flips go through the config write-back helpers, never the state record. The D-13 scrub would strip the field again on the next load.)`,
  );
});

// Negative-test the walker itself: prove the regex catches a synthetic
// offender source string AND does NOT match benign patterns. Without this,
// a regex bug could make the walker silently GREEN against ANY codebase.
test("SPLIT-01 walker: pattern catches a synthetic offender and ignores benign casts", () => {
  const offenders = [
    "const x = (record as unknown as Record<string, unknown>).autoupdate;",
    "const y = (mpRecord as unknown as Record<string, unknown>).autoupdate === true;",
    "autoupdate: (record as unknown as Record<string,unknown>).autoupdate === true,",
  ];
  for (const s of offenders) {
    assert.ok(
      SPLIT_01_AUTOUPDATE_CAST_PATTERN.test(s),
      `walker regression: ${String(SPLIT_01_AUTOUPDATE_CAST_PATTERN)} failed to match ${s}`,
    );
  }

  const benign = [
    "const mut = record as unknown as Record<string, unknown>;",
    "const cast = obj as Record<string, unknown>;",
    "autoupdate: record.autoupdate === true,",
    "obj.autoupdate = true;",
  ];
  for (const s of benign) {
    assert.ok(
      !SPLIT_01_AUTOUPDATE_CAST_PATTERN.test(s),
      `walker false-positive: ${String(SPLIT_01_AUTOUPDATE_CAST_PATTERN)} matched a benign expression ${s}`,
    );
  }
});

test("SPLIT-01 / WR-05 walker: assignment pattern catches synthetic offenders and ignores comparisons + config patches", () => {
  const offenders = [
    "mut.autoupdate = enable;",
    "record.autoupdate = true;",
    "(record as unknown as Record<string, unknown>).autoupdate = enable;",
    "legacy.autoupdate=false;",
  ];
  for (const s of offenders) {
    assert.ok(
      SPLIT_01_AUTOUPDATE_ASSIGNMENT_PATTERN.test(s),
      `walker regression: ${String(SPLIT_01_AUTOUPDATE_ASSIGNMENT_PATTERN)} failed to match ${s}`,
    );
  }

  const benign = [
    "if ((legacy.autoupdate === true) === enable) {",
    "if (mut.autoupdate == enable) {",
    "const patch = { autoupdate: enable };",
    "entry.autoupdate ?? false;",
    "current.marketplaces?.[name]?.autoupdate !== enable",
  ];
  for (const s of benign) {
    assert.ok(
      !SPLIT_01_AUTOUPDATE_ASSIGNMENT_PATTERN.test(s),
      `walker false-positive: ${String(SPLIT_01_AUTOUPDATE_ASSIGNMENT_PATTERN)} matched a benign expression ${s}`,
    );
  }
});

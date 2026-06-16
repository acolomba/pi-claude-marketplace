import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Scope-fence architecture lints pinning three v1.13 milestone invariants:
 *
 * SURF-03 (deferred to v1.14+): no synthesis-caveat warning surface ships in
 * v1.13. `shared/notify.ts` must NOT introduce a lossy-synthesis token in
 * `REASONS`; no `<lossy synthesis>` marker family may appear in any source
 * file; no install-arm warning emission outside the orphan-rewake row.
 *
 * SURF-04 (perma-forbidden in v1.13): no `/claude:plugin hooks` edge handler
 * may exist, and the `list` command must not grow a hook-count column. The
 * existing byte-form for `list` is preserved by the catalog-uat byte gate;
 * this test pins the source-level non-additions that would produce such a
 * column.
 *
 * HOOK-04 (prior completion per D-58-01): `shared/notify.ts::REASONS` already
 * contains `"unsupported hooks"`, and `MANIFEST_FIELD_REASONS` in
 * `orchestrators/plugin/install.ts` excludes `"hooks"`. This test pins that
 * prior state so a future regression cannot silently re-add `"hooks"` to the
 * structural-degradation set, which would re-open the supersession.
 *
 * Note on the `commands/plugin/hooks.ts` shape mentioned by SURF-04: this
 * repository routes command surfaces through `edge/handlers/plugin/` rather
 * than `commands/plugin/`, so the absence assertion is run against the
 * actual edge-handler directory and -- for forward compatibility with any
 * future directory rename -- also against the historical `commands/plugin/`
 * path. A non-existent directory makes its assertion trivially satisfied.
 */

const NOTIFY_REL = "extensions/pi-claude-marketplace/shared/notify.ts";
const INSTALL_REL = "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
const LIST_ORCH_REL = "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
const LIST_EDGE_REL = "extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts";
const PLUGIN_EDGE_DIR_REL = "extensions/pi-claude-marketplace/edge/handlers/plugin";
const PLUGIN_COMMANDS_DIR_REL = "extensions/pi-claude-marketplace/commands/plugin";

const HOOKS_EDGE_FILE_REGEX = /^hooks\.(ts|js|cjs|mjs)$/;

const LOSSY_SYNTHESIS_TOKENS: ReadonlyArray<string> = [
  '"lossy synthesis"',
  "'lossy synthesis'",
  "<lossy synthesis>",
  '"LOSSY_SYNTHESIS"',
  "'LOSSY_SYNTHESIS'",
];

const HOOK_COUNT_COLUMN_TOKENS: ReadonlyArray<string> = [
  '"hookCount"',
  "'hookCount'",
  '"hook_count"',
  "'hook_count'",
  '"hooks count"',
  "'hooks count'",
  '"hooks-column"',
  "'hooks-column'",
  '"hookColumn"',
  "'hookColumn'",
];

async function readIfExists(relPath: string): Promise<string | null> {
  const full = path.join(REPO_ROOT, relPath);
  try {
    return await readFile(full, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }

    throw err;
  }
}

async function dirEntries(relPath: string): Promise<readonly string[] | null> {
  const full = path.join(REPO_ROOT, relPath);
  try {
    const entries = await readdir(full, { withFileTypes: true });
    return entries.filter((d) => d.isFile()).map((d) => d.name);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }

    throw err;
  }
}

test("SURF-03: no lossy-synthesis tokens in shared/notify.ts (synthesis-caveat warning surface deferred to v1.14+)", async () => {
  const source = await readFile(path.join(REPO_ROOT, NOTIFY_REL), "utf8");
  const hits: string[] = [];
  for (const token of LOSSY_SYNTHESIS_TOKENS) {
    if (source.includes(token)) {
      hits.push(token);
    }
  }

  assert.deepEqual(
    hits,
    [],
    `SURF-03 violation: synthesis-caveat token(s) ${hits.join(", ")} appeared in ${NOTIFY_REL}. ` +
      `SURF-03 is deferred to v1.14+; v1.13 ships ZERO lossy-synthesis surface. ` +
      `If you genuinely intend to ship a synthesis warning, do it in a v1.14+ phase with REASONS catalog + byte-UAT in lockstep.`,
  );
});

test("SURF-04: no /claude:plugin hooks edge handler (perma-forbidden in v1.13)", async () => {
  const offenders: string[] = [];

  for (const dirRel of [PLUGIN_EDGE_DIR_REL, PLUGIN_COMMANDS_DIR_REL]) {
    const names = await dirEntries(dirRel);
    if (names === null) {
      continue;
    }

    for (const name of names) {
      if (HOOKS_EDGE_FILE_REGEX.test(name)) {
        offenders.push(`${dirRel}/${name}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `SURF-04 violation: edge-handler file(s) ${offenders.join(", ")} present. ` +
      `v1.13 forbids a /claude:plugin hooks command surface. The hooks bridge runs as a load-time ` +
      `wiring concern, not as a user-facing command.`,
  );
});

test("SURF-04: no hook-count column on list (perma-forbidden in v1.13)", async () => {
  const offenders: string[] = [];
  for (const rel of [LIST_ORCH_REL, LIST_EDGE_REL]) {
    const source = await readIfExists(rel);
    if (source === null) {
      continue;
    }

    for (const token of HOOK_COUNT_COLUMN_TOKENS) {
      if (source.includes(token)) {
        offenders.push(`${rel}: ${token}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `SURF-04 violation: hook-count column token(s) ${offenders.join("; ")} appeared. ` +
      `The existing list-row byte-form is locked by catalog-uat; do not grow a hook-count column in v1.13.`,
  );
});

test('HOOK-04: REASONS contains "unsupported hooks" in shared/notify.ts (D-58-01 prior completion)', async () => {
  const source = await readFile(path.join(REPO_ROOT, NOTIFY_REL), "utf8");
  assert.ok(
    source.includes('"unsupported hooks"'),
    `HOOK-04 regression: token "unsupported hooks" missing from ${NOTIFY_REL}. ` +
      `D-58-01 renamed the hooks-degradation REASONS member to "unsupported hooks"; ` +
      `do not revert.`,
  );
});

test('HOOK-04: MANIFEST_FIELD_REASONS excludes "hooks" in orchestrators/plugin/install.ts (D-58-01 atomic supersession)', async () => {
  const source = await readFile(path.join(REPO_ROOT, INSTALL_REL), "utf8");
  const lines = source.split(/\r?\n/);
  const matched = lines.filter((line) => line.includes("MANIFEST_FIELD_REASONS"));
  assert.ok(
    matched.length > 0,
    `HOOK-04 anchor missing: no line in ${INSTALL_REL} mentions MANIFEST_FIELD_REASONS. ` +
      `The structural-degradation Set must still be defined as a single-source token list.`,
  );

  // The DECLARATION line must contain "lspServers" and must NOT contain a
  // string-literal "hooks" token. Lookup lines (`.has(token)`) may legitimately
  // appear elsewhere and are not asserted against.
  const declaration = matched.find((line) => line.includes("new Set("));
  assert.ok(
    declaration !== undefined,
    `HOOK-04 anchor missing: no declaration line for MANIFEST_FIELD_REASONS = new Set([...]) ` +
      `found in ${INSTALL_REL}.`,
  );
  assert.ok(
    declaration.includes('"lspServers"') || declaration.includes("'lspServers'"),
    `HOOK-04 regression: MANIFEST_FIELD_REASONS declaration in ${INSTALL_REL} does not include ` +
      `"lspServers". Expected exactly one structural-degradation token.`,
  );
  assert.ok(
    !declaration.includes('"hooks"') && !declaration.includes("'hooks'"),
    `HOOK-04 regression: MANIFEST_FIELD_REASONS declaration in ${INSTALL_REL} re-introduced ` +
      `"hooks". D-58-01 atomically superseded the legacy "hooks" structural reason by the ` +
      `"unsupported hooks" REASONS member; reverting re-opens the supersession.`,
  );
});

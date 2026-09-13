import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertSingleAppendedBlock,
  resolveEffectiveConfig,
  resolveEffectiveConfigs,
  RESTRICTED_PATHS_OFF,
  ZONE_SUBSTITUTION,
} from "./eslint-effective-config.ts";
import {
  MARKETPLACE_LEDGER_TARGETS,
  ORCHESTRATORS_REL,
  PACKAGE_JSON_REL,
  PLUGIN_LEDGER_TARGETS,
  ZONE_FOLDER_TARGETS,
  ZONE_REPRESENTATIVE_TARGETS,
} from "./gate-targets.ts";
import { REPO_ROOT, stripComments } from "./source-scan.ts";

import type { EffectiveConfig } from "./eslint-effective-config.ts";

/** The rule that carries the whole D-11 import-direction obligation. */
const RESTRICTED_PATHS = "import-x/no-restricted-paths";

/** One zone of the `import-x/no-restricted-paths` options, as ESLint resolves it. */
interface RestrictedPathsZone {
  target: string | string[];
  from: string | string[];
  message?: string;
  except?: string[];
}

/** The rule's state for one file: the severity that applies and the zones it carries. */
interface RestrictedPathsState {
  severity: number;
  zones: RestrictedPathsZone[];
}

const [
  EDGE_ZONE,
  ORCHESTRATORS_ZONE,
  BRIDGES_ZONE,
  DOMAIN_ZONE,
  TRANSACTION_ZONE,
  PERSISTENCE_ZONE,
  PLATFORM_ZONE,
  SHARED_ZONE,
] = ZONE_FOLDER_TARGETS;

/**
 * Expected `from` set per `target` -- the inverse of the D-11 allowed-imports
 * matrix. Each folder's `from` set lists the OTHER folders it must NOT import.
 *
 * D-21-02: edge/ may import domain/ directly, so `edge`'s forbidden set does not
 * name `domain`.
 */
const EXPECTED_FORBIDDEN: Record<string, string[]> = {
  [EDGE_ZONE]: [BRIDGES_ZONE, TRANSACTION_ZONE, PERSISTENCE_ZONE],
  [ORCHESTRATORS_ZONE]: [EDGE_ZONE],
  [BRIDGES_ZONE]: [EDGE_ZONE, ORCHESTRATORS_ZONE, TRANSACTION_ZONE],
  [DOMAIN_ZONE]: [EDGE_ZONE, ORCHESTRATORS_ZONE, BRIDGES_ZONE, TRANSACTION_ZONE, PERSISTENCE_ZONE],
  [TRANSACTION_ZONE]: [EDGE_ZONE, ORCHESTRATORS_ZONE, BRIDGES_ZONE, DOMAIN_ZONE],
  [PERSISTENCE_ZONE]: [EDGE_ZONE, ORCHESTRATORS_ZONE, BRIDGES_ZONE, TRANSACTION_ZONE],
  [PLATFORM_ZONE]: [
    EDGE_ZONE,
    ORCHESTRATORS_ZONE,
    BRIDGES_ZONE,
    DOMAIN_ZONE,
    TRANSACTION_ZONE,
    PERSISTENCE_ZONE,
  ],
  [SHARED_ZONE]: [
    EDGE_ZONE,
    ORCHESTRATORS_ZONE,
    BRIDGES_ZONE,
    DOMAIN_ZONE,
    TRANSACTION_ZONE,
    PERSISTENCE_ZONE,
  ],
};

/**
 * The file the two offender cases resolve, standing in for any extension module.
 *
 * The annotation is the membership check: naming a path the representative group
 * does not carry stops compiling, so this reference cannot drift away from the
 * set it points into.
 */
const ZONE_OFFENDER_PROBE: (typeof ZONE_REPRESENTATIVE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/edge/router.ts";

/**
 * The rule's resolved state for one file, or `null` when the rule does not reach
 * it at all.
 *
 * Severity and zones are read together on purpose. A rule switched off by a
 * later block keeps the options an earlier block gave it, so the zones alone say
 * nothing about whether the rule runs.
 */
function restrictedPathsState(config: EffectiveConfig | null): RestrictedPathsState | null {
  const entry = config?.rules[RESTRICTED_PATHS];
  if (entry === undefined) {
    return null;
  }

  const options = entry[1] as { zones?: RestrictedPathsZone[] } | undefined;

  return { severity: entry[0], zones: options?.zones ?? [] };
}

/** `zones` folded into a target-to-sorted-forbidden-set map. */
function forbiddenMatrix(zones: ReadonlyArray<RestrictedPathsZone>): Record<string, string[]> {
  const matrix: Record<string, string[]> = {};
  for (const zone of zones) {
    const target = typeof zone.target === "string" ? zone.target : (zone.target[0] ?? "");
    matrix[target] = (typeof zone.from === "string" ? [zone.from] : zone.from).slice().sort();
  }

  return matrix;
}

/**
 * The D-11 zone contract, written as one assertion so an offender resolution can
 * be driven through the very assertion the benign control uses.
 *
 * A gate that "would fail" against an offender is a claim; running the real
 * assertion against the offender is evidence.
 */
function assertZoneContract(state: RestrictedPathsState | null): void {
  assert.ok(
    state !== null,
    `D-11: \`${RESTRICTED_PATHS}\` does not reach this file at all, so the import-direction matrix is unenforced for it`,
  );
  assert.strictEqual(
    state.severity,
    2,
    `D-11: \`${RESTRICTED_PATHS}\` resolves to severity ${state.severity} rather than error, so the import-direction matrix is configured but not enforced`,
  );
  assert.strictEqual(
    state.zones.length,
    ZONE_FOLDER_TARGETS.length,
    `D-11: expected ${ZONE_FOLDER_TARGETS.length} zones (one per layer folder), got ${state.zones.length}`,
  );
}

/**
 * D-11: whole-repo cycle detection must stay unfiltered.
 *
 * Cycles are caught by `fallow dead-code` inside `npm run fallow`, not by
 * ESLint. `import-x/no-cycle` reports NOTHING on a deliberate two-file
 * cycle -- including one planted inside `orchestrators/`, its own scope --
 * while `fallow dead-code` flags the identical cycle and exits 1; neither
 * `import-x/no-unresolved`, the built-in node resolver, nor
 * `eslint-import-resolver-typescript` changes that outcome, so the gap is
 * not a resolution problem. Asserting that a rule is merely CONFIGURED
 * cannot distinguish a working gate from an inert one.
 *
 * What needs pinning instead is that the `fallow dead-code` invocation stays
 * UNFILTERED: fallow's `--circular-deps` / `--boundary-violations` flags are
 * only-report filters, not additions, so naming one silently drops every
 * other class the subcommand computes. The bare form reports them all.
 */
test("D-11: npm run fallow runs dead-code unfiltered, so cycles are gated", async () => {
  const pkgPath = path.join(REPO_ROOT, PACKAGE_JSON_REL);
  const pkg: unknown = JSON.parse(await readFile(pkgPath, "utf8"));
  const scripts = (pkg as { scripts?: Record<string, string> }).scripts ?? {};
  const fallowScript = scripts["fallow"];

  assert.ok(
    typeof fallowScript === "string",
    "package.json has no `fallow` script -- whole-repo cycle detection is ungated",
  );

  assert.match(
    fallowScript,
    /fallow dead-code(?![\w-])/,
    "the `fallow` script must invoke `fallow dead-code`; that subcommand is what reports circular dependencies",
  );

  assert.match(
    fallowScript,
    /fallow dead-code[^&|]*--fail-on-issues/,
    "`fallow dead-code` must carry --fail-on-issues, or a reported cycle still exits 0",
  );

  // An ALLOWLIST, not a denylist. `fallow dead-code --help` exposes ~24
  // only-report filters plus `--file` and `--top`; enumerating the ones we
  // know about leaves every flag we did not think of free to narrow the run.
  // Measured: adding `--unused-exports` to the script drops a planted
  // two-file cycle from exit 1 to exit 0 while a denylist of three flags
  // stays green. Anything unrecognized here fails until someone proves the
  // addition still reports cycles.
  const deadCodeSegment = fallowScript
    .split(/&&|\|\||;/)
    .map((segment) => segment.trim())
    .find((segment) => /^(npx\s+)?fallow\s+dead-code(?![\w-])/.test(segment));

  assert.ok(
    deadCodeSegment !== undefined,
    "the `fallow` script has no standalone `fallow dead-code` command; cycles are ungated",
  );

  const ALLOWED_DEAD_CODE_TOKENS = new Set([
    "npx",
    "fallow",
    "dead-code",
    "--fail-on-issues",
    "--format",
    "human",
  ]);

  for (const token of deadCodeSegment.split(/\s+/).filter((t) => t.length > 0)) {
    assert.ok(
      ALLOWED_DEAD_CODE_TOKENS.has(token),
      `unrecognized token \`${token}\` in the \`fallow dead-code\` invocation. fallow's per-issue flags are only-report FILTERS, not additions: naming one narrows the run to that class and silently stops gating cycles. If this token is genuinely safe, add it to ALLOWED_DEAD_CODE_TOKENS after measuring that a planted cycle still exits 1.`,
    );
  }
});

/**
 * D-11: the ledger modules of `orchestrators/plugin/` and
 * `orchestrators/marketplace/` must not statically import each other.
 *
 * Cycle detection cannot cover this -- not `fallow dead-code`'s, and not
 * `import-x/no-cycle`, absent from ESLint for the reason given above. A
 * cycle is reported only once the graph is ALREADY circular, so the first of
 * the two edges lands green and the gate fires on whoever adds the second.
 * The edge that matters here is preventive: a marketplace ledger reaching a
 * plugin ledger drags that ledger's whole graph in, and
 * `orchestrators/types.ts` plus the leaf row composers exist precisely so it
 * does not have to.
 *
 * Type-only imports are forbidden too. A shared TYPE is what
 * `orchestrators/types.ts` is for; reaching into a ledger module for one
 * re-creates the coupling the split removed, and the next author who needs a
 * value has an import line already sitting there to widen.
 *
 * The ledger entry points are named by the registry, and the bare module names
 * both patterns join are DERIVED from those paths. A separate list of bare names
 * beside the paths would be a second source of truth: a name that drifted out of
 * it would stop matching silently instead of failing.
 */
const PLUGIN_LEDGERS = PLUGIN_LEDGER_TARGETS.map((rel) => path.basename(rel, ".ts"));
const MARKETPLACE_LEDGERS = MARKETPLACE_LEDGER_TARGETS.map((rel) => path.basename(rel, ".ts"));

/** How many plugin ledgers the registry is expected to carry. */
const EXPECTED_PLUGIN_LEDGER_COUNT = 5;

/** How many marketplace ledgers the registry is expected to carry. */
const EXPECTED_MARKETPLACE_LEDGER_COUNT = 4;

// Non-global on purpose: a /g regex carries `lastIndex` across `.test()` calls
// and would skip every second file in the walk below.
const PLUGIN_LEDGER_IMPORT = new RegExp(
  `from\\s+"\\.\\./plugin/(?:${PLUGIN_LEDGERS.join("|")})\\.ts"`,
);
const MARKETPLACE_LEDGER_IMPORT = new RegExp(
  `from\\s+"\\.\\./marketplace/(?:${MARKETPLACE_LEDGERS.join("|")})\\.ts"`,
);

// The static form above misses `await import("...")` and the
// `type T = import("...").X` position, both measured. A ledger reached
// dynamically is coupled exactly as tightly as one reached statically, so each
// direction carries a companion pattern for the call form.
const PLUGIN_LEDGER_DYNAMIC_IMPORT = new RegExp(
  `import\\(\\s*"\\.\\./plugin/(?:${PLUGIN_LEDGERS.join("|")})\\.ts"\\s*\\)`,
);
const MARKETPLACE_LEDGER_DYNAMIC_IMPORT = new RegExp(
  `import\\(\\s*"\\.\\./marketplace/(?:${MARKETPLACE_LEDGERS.join("|")})\\.ts"\\s*\\)`,
);

/** A real plugin module that is not a ledger -- the seam a ledger may reach. */
const PLUGIN_NON_LEDGER_SPECIFIER = "../plugin/clone-cache.ts";

/** The one marketplace module a plugin ledger is allowed to import. */
const MARKETPLACE_NON_LEDGER_SPECIFIER = "../marketplace/shared.ts";

/**
 * The marketplace orchestrator folder, walked in full rather than named file by
 * file: this direction of the gate covers every module in it, not only the
 * ledgers.
 */
const MARKETPLACE_ORCHESTRATORS_REL = `${ORCHESTRATORS_REL}/marketplace`;

/** Repository-relative `.ts` files directly inside `rel`. */
async function orchestratorFiles(rel: string): Promise<string[]> {
  const entries = await readdir(path.join(REPO_ROOT, rel), { withFileTypes: true });

  return entries.filter((e) => e.isFile() && e.name.endsWith(".ts")).map((e) => `${rel}/${e.name}`);
}

test("D-11: no orchestrators/marketplace file imports a plugin LEDGER module", async () => {
  const files = await orchestratorFiles(MARKETPLACE_ORCHESTRATORS_REL);
  assert.ok(files.length > 0, `walked ${MARKETPLACE_ORCHESTRATORS_REL} and found no .ts files`);

  const offenders: string[] = [];
  for (const rel of files) {
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    if (PLUGIN_LEDGER_IMPORT.test(stripped) || PLUGIN_LEDGER_DYNAMIC_IMPORT.test(stripped)) {
      offenders.push(rel);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `D-11 violation -- these marketplace files import a plugin ledger module:\n  ${offenders.join("\n  ")}\nImport the leaf row composer (plugin/update-row.ts), a shared type from orchestrators/types.ts, or the injected pluginUpdate seam instead.`,
  );
});

test("D-11: no orchestrators/plugin LEDGER imports a marketplace ledger module", async () => {
  const offenders: string[] = [];
  for (const rel of PLUGIN_LEDGER_TARGETS) {
    // A renamed or deleted ledger must fail loudly rather than silently
    // uncovering this direction of the gate.
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    if (
      MARKETPLACE_LEDGER_IMPORT.test(stripped) ||
      MARKETPLACE_LEDGER_DYNAMIC_IMPORT.test(stripped)
    ) {
      offenders.push(rel);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `D-11 violation -- these plugin ledgers import a marketplace ledger module:\n  ${offenders.join("\n  ")}\nonly orchestrators/marketplace/shared.ts is reachable from a plugin ledger.`,
  );
});

/**
 * D-07-08: a joined regex reports success by omission.
 *
 * `PLUGIN_LEDGER_IMPORT` and its dynamic companion are built by joining the bare
 * ledger names into one alternation. A name that drops out of the list stops
 * being matched, and the scan above then walks every file and finds nothing --
 * green, over a ledger it no longer guards. The only way to see that is to
 * synthesize the exact specifier a violation naming each ledger would use and
 * assert the pattern still matches it.
 *
 * Both halves live in one loop on purpose. The specifier match answers "does the
 * pattern still fire for this name"; the on-disk read answers "is there still a
 * module behind this name". A pattern that matches a module which no longer
 * exists guards nothing, and a module that exists but no longer matches is
 * unguarded -- either alone reports success.
 */
test("D-11: the plugin-ledger patterns match a violation naming each plugin ledger", async () => {
  // arrange
  assert.strictEqual(
    PLUGIN_LEDGERS.length,
    EXPECTED_PLUGIN_LEDGER_COUNT,
    `PLUGIN_LEDGER_TARGETS carries ${PLUGIN_LEDGERS.length} ledgers rather than ${EXPECTED_PLUGIN_LEDGER_COUNT}. A name removed from the group takes its positive control with it, so the count is pinned here rather than derived -- otherwise the proof shrinks silently alongside the pattern it proves.`,
  );

  // act & assert
  for (const rel of PLUGIN_LEDGER_TARGETS) {
    const name = path.basename(rel, ".ts");
    assert.match(
      `import { x } from "../plugin/${name}.ts";`,
      PLUGIN_LEDGER_IMPORT,
      `the joined pattern no longer matches a static import naming ${name} -- the regex drifted from its name list while still reporting success`,
    );
    assert.match(
      `const ledger = await import("../plugin/${name}.ts");`,
      PLUGIN_LEDGER_DYNAMIC_IMPORT,
      `the companion pattern no longer matches a dynamic import naming ${name}`,
    );
    await stat(path.join(REPO_ROOT, rel));
  }
});

test("D-11: the marketplace-ledger patterns match a violation naming each marketplace ledger", async () => {
  // arrange
  assert.strictEqual(
    MARKETPLACE_LEDGERS.length,
    EXPECTED_MARKETPLACE_LEDGER_COUNT,
    `MARKETPLACE_LEDGER_TARGETS carries ${MARKETPLACE_LEDGERS.length} ledgers rather than ${EXPECTED_MARKETPLACE_LEDGER_COUNT}. A name removed from the group takes its positive control with it, so the count is pinned here rather than derived.`,
  );

  // act & assert
  for (const rel of MARKETPLACE_LEDGER_TARGETS) {
    const name = path.basename(rel, ".ts");
    assert.match(
      `import { x } from "../marketplace/${name}.ts";`,
      MARKETPLACE_LEDGER_IMPORT,
      `the joined pattern no longer matches a static import naming ${name} -- the regex drifted from its name list while still reporting success`,
    );
    assert.match(
      `const ledger = await import("../marketplace/${name}.ts");`,
      MARKETPLACE_LEDGER_DYNAMIC_IMPORT,
      `the companion pattern no longer matches a dynamic import naming ${name}`,
    );
    await stat(path.join(REPO_ROOT, rel));
  }
});

/**
 * The negative half of the same obligation: the widened patterns must be
 * precise, not merely eager.
 *
 * Each specifier below names a real module that is deliberately NOT a ledger and
 * is the sanctioned route across the boundary. A pattern that matched one of
 * them would turn the legal import into a reported violation, which is how a
 * gate gets suppressed rather than fixed.
 */
test("D-11: neither ledger pattern matches a specifier naming a non-ledger module", () => {
  // act & assert
  for (const pattern of [PLUGIN_LEDGER_IMPORT, PLUGIN_LEDGER_DYNAMIC_IMPORT]) {
    assert.doesNotMatch(`import { x } from "${PLUGIN_NON_LEDGER_SPECIFIER}";`, pattern);
    assert.doesNotMatch(`const seam = await import("${PLUGIN_NON_LEDGER_SPECIFIER}");`, pattern);
  }

  for (const pattern of [MARKETPLACE_LEDGER_IMPORT, MARKETPLACE_LEDGER_DYNAMIC_IMPORT]) {
    assert.doesNotMatch(`import { x } from "${MARKETPLACE_NON_LEDGER_SPECIFIER}";`, pattern);
    assert.doesNotMatch(
      `const seam = await import("${MARKETPLACE_NON_LEDGER_SPECIFIER}");`,
      pattern,
    );
  }
});

test(
  "D-11: the real config resolves no-restricted-paths to error with one zone per layer folder",
  { timeout: 60_000 },
  async () => {
    // act
    const configs = await resolveEffectiveConfigs(ZONE_REPRESENTATIVE_TARGETS);

    // assert
    for (const representative of ZONE_REPRESENTATIVE_TARGETS) {
      assertZoneContract(restrictedPathsState(configs.get(representative) ?? null));
    }
  },
);

test(
  "D-11: each resolved zone's target and from set matches the allowed-imports matrix",
  { timeout: 60_000 },
  async () => {
    // arrange
    const expectedMatrix = Object.fromEntries(
      Object.entries(EXPECTED_FORBIDDEN).map(([target, from]) => [target, [...from].sort()]),
    );

    // act
    const configs = await resolveEffectiveConfigs(ZONE_REPRESENTATIVE_TARGETS);

    // assert
    for (const representative of ZONE_REPRESENTATIVE_TARGETS) {
      const state = restrictedPathsState(configs.get(representative) ?? null);
      assert.ok(state !== null, `\`${RESTRICTED_PATHS}\` does not reach ${representative}`);
      assert.deepEqual(
        forbiddenMatrix(state.zones),
        expectedMatrix,
        `the matrix resolved for ${representative} does not match the D-11 allowed-imports matrix`,
      );
    }
  },
);

test(
  "GGAT-03: a rule-off override resolves to severity 0 and fails the zone gate",
  { timeout: 60_000 },
  async () => {
    // arrange
    assertSingleAppendedBlock("restricted-paths off", RESTRICTED_PATHS_OFF);

    // act
    const state = restrictedPathsState(
      await resolveEffectiveConfig(ZONE_OFFENDER_PROBE, RESTRICTED_PATHS_OFF),
    );

    // assert
    assert.ok(state !== null, "the rule vanished entirely rather than being switched off");
    assert.strictEqual(state.severity, 0, "the appended block did not switch the rule off");
    assert.strictEqual(
      state.zones.length,
      ZONE_FOLDER_TARGETS.length,
      "all eight zones survive the switch-off, which is precisely why a gate reading the zones without the severity reports a healthy matrix for a rule that no longer runs",
    );
    assert.throws(
      () => {
        assertZoneContract(state);
      },
      assert.AssertionError,
      "the zone contract passed against a disabled rule -- reading the options without the severity is the defect this case exists to catch",
    );
  },
);

test(
  "GGAT-03: a zone-substitution override resolves to a one-zone matrix and fails the zone gate",
  { timeout: 60_000 },
  async () => {
    // arrange
    assertSingleAppendedBlock("zone substitution", ZONE_SUBSTITUTION);

    // act
    const state = restrictedPathsState(
      await resolveEffectiveConfig(ZONE_OFFENDER_PROBE, ZONE_SUBSTITUTION),
    );

    // assert
    assert.ok(state !== null, "the rule vanished entirely rather than being substituted");
    assert.strictEqual(state.severity, 2, "the substituted rule is not at error severity");
    assert.strictEqual(state.zones.length, 1, "the appended block did not replace the matrix");
    assert.throws(
      () => {
        assertZoneContract(state);
      },
      assert.AssertionError,
      "the zone contract passed against a one-zone matrix, so it is not really reading the zones that apply",
    );
  },
);

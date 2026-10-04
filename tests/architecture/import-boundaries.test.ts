import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { resolveEffectiveConfigs } from "./eslint-effective-config.ts";
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
  readonly target: string | string[];
  readonly from: string | string[];
  readonly message?: string;
  readonly except?: string[];
}

/** The rule's state for one file: the severity that applies and the zones it carries. */
interface RestrictedPathsState {
  readonly severity: number;
  readonly zones: RestrictedPathsZone[];
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
 * The D-11 zone contract for one resolved file: the rule reaches it at error
 * severity with one zone per layer folder.
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
 * D-11: cycle detection must reach the whole repository, through BOTH
 * `fallow dead-code` runs in `npm run fallow`.
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
 * ONE invocation does not reach the whole repository. `.fallowrc.json` scopes
 * `deadCode` to production reachability, and production mode excludes the test
 * and script trees, so the bare run is blind to a cycle that lives entirely
 * outside the entry graph. Measured in this repository, with
 * `x.ts` and `y.ts` under `tests/architecture/` importing each other: the bare run
 * reports "No issues found" and exits 0, while `--no-production
 * --circular-deps --re-export-cycles` names the cycle and exits 1.
 *
 * So two things need pinning:
 *
 * 1. The bare, production-scoped run stays UNFILTERED. fallow's
 *    `--circular-deps` / `--boundary-violations` flags are only-report
 *    filters, not additions, so naming one silently drops every other class
 *    the subcommand computes. The bare form reports them all.
 * 2. A second run carries the cycle classes over the whole tree. It has to
 *    stay filtered to those classes: a bare `--no-production` run also
 *    re-reads the two production-mode suppressions as stale and fails on
 *    them, which is a different finding than the one this run exists for.
 */
test("D-11: npm run fallow gates cycles over the whole repository", async () => {
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
  // addition still reports cycles. `--quiet` only suppresses progress output:
  // planted production and tests/ cycles still exit 1 and print under it.
  const deadCodeSegments = fallowScript
    .split(/&&|\|\||;/)
    .map((segment) => segment.trim())
    .filter((segment) => /^(npx\s+)?fallow\s+dead-code(?![\w-])/.test(segment));

  // The FIRST dead-code command is the production-scoped one the allowlist
  // below governs; the whole-tree cycle run is identified by its own flag, not
  // by position, so reordering the chain cannot swap which rules apply to which.
  const deadCodeSegment = deadCodeSegments.find((segment) => !segment.includes("--no-production"));

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
    "--quiet",
  ]);

  for (const token of deadCodeSegment.split(/\s+/).filter((t) => t.length > 0)) {
    assert.ok(
      ALLOWED_DEAD_CODE_TOKENS.has(token),
      `unrecognized token \`${token}\` in the \`fallow dead-code\` invocation. fallow's per-issue flags are only-report FILTERS, not additions: naming one narrows the run to that class and silently stops gating cycles. If this token is genuinely safe, add it to ALLOWED_DEAD_CODE_TOKENS after measuring that a planted cycle still exits 1.`,
    );
  }

  // The second run is what carries the cycle classes across `tests/` and
  // `scripts/`, which production reachability drops. Without it a cycle among
  // the reusable fakes, `gate-targets.ts`, or `source-scan.ts` is reported by
  // nothing.
  const cycleSegment = deadCodeSegments.find((segment) => segment.includes("--no-production"));

  assert.ok(
    cycleSegment !== undefined,
    "the `fallow` script has no `fallow dead-code --no-production` command. `.fallowrc.json` scopes dead-code to production reachability, so without this second run no cycle under tests/ or scripts/ is gated at all.",
  );

  // Every flag this run cannot lose. `--circular-deps` and `--re-export-cycles`
  // are only-report filters, so BOTH have to be named to report both cycle
  // classes, and the filtering is deliberate: a bare `--no-production` run
  // fails on the production-mode suppressions instead.
  for (const required of [
    "--no-production",
    "--circular-deps",
    "--re-export-cycles",
    "--fail-on-issues",
  ]) {
    assert.ok(
      cycleSegment.includes(required),
      `the whole-tree cycle run is missing \`${required}\`; without it the run either loses a cycle class or reports one and still exits 0`,
    );
  }

  // The same allowlist discipline as above, for the same reason: any further
  // only-report filter, `--file`, or `--top` narrows this run past the cycle
  // classes it exists to carry. `--no-cache` only skips the graph cache, which
  // the production-scoped run owns; sharing it makes each run evict the other
  // and print a cache warning.
  const ALLOWED_CYCLE_TOKENS = new Set([
    "npx",
    "fallow",
    "dead-code",
    "--no-production",
    "--circular-deps",
    "--re-export-cycles",
    "--fail-on-issues",
    "--format",
    "human",
    "--quiet",
    "--no-cache",
  ]);

  for (const token of cycleSegment.split(/\s+/).filter((t) => t.length > 0)) {
    assert.ok(
      ALLOWED_CYCLE_TOKENS.has(token),
      `unrecognized token \`${token}\` in the whole-tree \`fallow dead-code --no-production\` invocation. Adding an only-report filter, \`--file\`, or \`--top\` narrows the run away from the cycle classes. If this token is genuinely safe, add it to ALLOWED_CYCLE_TOKENS after measuring that a cycle planted under tests/ still exits 1.`,
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
  // act
  const files = await orchestratorFiles(MARKETPLACE_ORCHESTRATORS_REL);
  assert.ok(files.length > 0, `walked ${MARKETPLACE_ORCHESTRATORS_REL} and found no .ts files`);

  const offenders: string[] = [];
  for (const rel of files) {
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    if (PLUGIN_LEDGER_IMPORT.test(stripped) || PLUGIN_LEDGER_DYNAMIC_IMPORT.test(stripped)) {
      offenders.push(rel);
    }
  }

  // assert
  assert.deepStrictEqual(
    offenders,
    [],
    `D-11 violation -- these marketplace files import a plugin ledger module:\n  ${offenders.join("\n  ")}\nImport the leaf row composer (plugin/update-row.ts), a shared type from orchestrators/types.ts, or the injected pluginUpdate seam instead.`,
  );
});

test("D-11: no orchestrators/plugin LEDGER imports a marketplace ledger module", async () => {
  // act
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

  // assert
  assert.deepStrictEqual(
    offenders,
    [],
    `D-11 violation -- these plugin ledgers import a marketplace ledger module:\n  ${offenders.join("\n  ")}\nonly orchestrators/marketplace/shared.ts is reachable from a plugin ledger.`,
  );
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
      assert.deepStrictEqual(
        forbiddenMatrix(state.zones),
        expectedMatrix,
        `the matrix resolved for ${representative} does not match the D-11 allowed-imports matrix`,
      );
    }
  },
);

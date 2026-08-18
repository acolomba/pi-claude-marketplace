import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { stripComments } from "../helpers/source-scan.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface RestrictedPathsZone {
  target: string | string[];
  from: string | string[];
  message?: string;
  except?: string[];
}

interface RestrictedPathsRule {
  zones: RestrictedPathsZone[];
  basePath?: string;
}

/** Return value shape of an eslint flat-config block (subset). */
interface FlatConfigBlock {
  files?: readonly string[];
  rules?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

/**
 * Read the eslint flat config and extract the import-x/no-restricted-paths
 * rule's zones array. Returns null if the rule is not configured.
 */
async function loadZones(): Promise<RestrictedPathsZone[] | null> {
  const mod = (await import(`${REPO_ROOT}/eslint.config.js`)) as {
    default: FlatConfigBlock[];
  };
  for (const block of mod.default) {
    const ruleEntry = block.rules?.["import-x/no-restricted-paths"];
    if (Array.isArray(ruleEntry) && ruleEntry.length >= 2 && typeof ruleEntry[1] === "object") {
      return (ruleEntry[1] as RestrictedPathsRule).zones;
    }
  }

  return null;
}

const EXTENSION_ROOT = "./extensions/pi-claude-marketplace";
// D-21-02: 8-zone configuration. Edge/ may import domain/ directly;
// accordingly `edge`'s forbidden set does not include `domain`.
const FOLDERS = [
  "edge",
  "orchestrators",
  "bridges",
  "domain",
  "transaction",
  "persistence",
  "platform",
  "shared",
] as const;

/**
 * Expected `from` set per `target` -- the inverse of the D-11 allowed-imports
 * matrix. Each folder's `from` set lists the OTHER folders it must NOT import.
 */
const EXPECTED_FORBIDDEN: Record<string, string[]> = {
  [`${EXTENSION_ROOT}/edge`]: [
    `${EXTENSION_ROOT}/bridges`,
    `${EXTENSION_ROOT}/transaction`,
    `${EXTENSION_ROOT}/persistence`,
  ],
  [`${EXTENSION_ROOT}/orchestrators`]: [`${EXTENSION_ROOT}/edge`],
  [`${EXTENSION_ROOT}/bridges`]: [
    `${EXTENSION_ROOT}/edge`,
    `${EXTENSION_ROOT}/orchestrators`,
    `${EXTENSION_ROOT}/transaction`,
  ],
  [`${EXTENSION_ROOT}/domain`]: [
    `${EXTENSION_ROOT}/edge`,
    `${EXTENSION_ROOT}/orchestrators`,
    `${EXTENSION_ROOT}/bridges`,
    `${EXTENSION_ROOT}/transaction`,
    `${EXTENSION_ROOT}/persistence`,
  ],
  [`${EXTENSION_ROOT}/transaction`]: [
    `${EXTENSION_ROOT}/edge`,
    `${EXTENSION_ROOT}/orchestrators`,
    `${EXTENSION_ROOT}/bridges`,
    `${EXTENSION_ROOT}/domain`,
  ],
  [`${EXTENSION_ROOT}/persistence`]: [
    `${EXTENSION_ROOT}/edge`,
    `${EXTENSION_ROOT}/orchestrators`,
    `${EXTENSION_ROOT}/bridges`,
    `${EXTENSION_ROOT}/transaction`,
  ],
  [`${EXTENSION_ROOT}/platform`]: [
    `${EXTENSION_ROOT}/edge`,
    `${EXTENSION_ROOT}/orchestrators`,
    `${EXTENSION_ROOT}/bridges`,
    `${EXTENSION_ROOT}/domain`,
    `${EXTENSION_ROOT}/transaction`,
    `${EXTENSION_ROOT}/persistence`,
  ],
  [`${EXTENSION_ROOT}/shared`]: [
    `${EXTENSION_ROOT}/edge`,
    `${EXTENSION_ROOT}/orchestrators`,
    `${EXTENSION_ROOT}/bridges`,
    `${EXTENSION_ROOT}/domain`,
    `${EXTENSION_ROOT}/transaction`,
    `${EXTENSION_ROOT}/persistence`,
  ],
};

/**
 * D-11: whole-repo cycle detection must stay unfiltered.
 *
 * This used to pin `import-x/no-cycle`. That rule was removed after it was
 * measured reporting NOTHING on a deliberate two-file cycle -- including one
 * planted inside `orchestrators/`, its own scope -- while `fallow dead-code`
 * flagged the identical cycle and exited 1. Resolution was not the problem
 * (`import-x/no-unresolved` fired on a bogus path and stayed silent on the
 * real one in the same file), and neither the built-in node resolver nor
 * `eslint-import-resolver-typescript` changed the outcome. The old assertion
 * checked that the rule was CONFIGURED, which it always was, so it could not
 * tell a working gate from an inert one.
 *
 * Cycles are now caught by `fallow dead-code` inside `npm run fallow`. What
 * needs pinning is that the invocation stays UNFILTERED: fallow's
 * `--circular-deps` / `--boundary-violations` flags are only-report filters,
 * not additions, so naming one silently drops every other class the
 * subcommand computes. The bare form reports them all.
 */
test("D-11: npm run fallow runs dead-code unfiltered, so cycles are gated", async () => {
  const pkgPath = path.join(REPO_ROOT, "package.json");
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
 * Cycle detection cannot cover this -- not `fallow dead-code`'s, and not the
 * `import-x/no-cycle` rule retired above. A cycle is reported only once the
 * graph is ALREADY circular, so the first of the two edges lands green and the
 * gate fires on whoever adds the second. The edge that matters here is
 * preventive:
 * a marketplace ledger reaching a plugin ledger drags that ledger's whole graph
 * in, and `orchestrators/types.ts` plus the leaf row composers exist precisely
 * so it does not have to.
 *
 * Type-only imports are forbidden too. A shared TYPE is what
 * `orchestrators/types.ts` is for; reaching into a ledger module for one
 * re-creates the coupling the split removed, and the next author who needs a
 * value has an import line already sitting there to widen.
 *
 * `bootstrap.ts` is deliberately absent from the plugin side: it is a composer,
 * not a ledger, and composing `addMarketplace` + `setMarketplaceAutoupdate` is
 * its entire job.
 */
const PLUGIN_LEDGERS = ["install", "update", "uninstall", "reinstall", "enable-disable"] as const;
const MARKETPLACE_LEDGERS = ["add", "remove", "update", "autoupdate"] as const;

// Non-global on purpose: a /g regex carries `lastIndex` across `.test()` calls
// and would skip every second file in the walk below.
const PLUGIN_LEDGER_IMPORT = new RegExp(
  `from\\s+"\\.\\./plugin/(?:${PLUGIN_LEDGERS.join("|")})\\.ts"`,
);
const MARKETPLACE_LEDGER_IMPORT = new RegExp(
  `from\\s+"\\.\\./marketplace/(?:${MARKETPLACE_LEDGERS.join("|")})\\.ts"`,
);

const ORCHESTRATORS_REL = "extensions/pi-claude-marketplace/orchestrators";

/** Repository-relative `.ts` files directly inside one orchestrator subfolder. */
async function orchestratorFiles(subdir: string): Promise<string[]> {
  const rel = `${ORCHESTRATORS_REL}/${subdir}`;
  const entries = await readdir(path.join(REPO_ROOT, rel), { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith(".ts")).map((e) => `${rel}/${e.name}`);
}

test("D-11: no orchestrators/marketplace file imports a plugin LEDGER module", async () => {
  const files = await orchestratorFiles("marketplace");
  assert.ok(files.length > 0, `walked ${ORCHESTRATORS_REL}/marketplace and found no .ts files`);

  const offenders: string[] = [];
  for (const rel of files) {
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    if (PLUGIN_LEDGER_IMPORT.test(stripped)) {
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
  for (const name of PLUGIN_LEDGERS) {
    const rel = `${ORCHESTRATORS_REL}/plugin/${name}.ts`;
    // A renamed or deleted ledger must fail loudly rather than silently
    // uncovering this direction of the gate.
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
    if (MARKETPLACE_LEDGER_IMPORT.test(stripped)) {
      offenders.push(rel);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `D-11 violation -- these plugin ledgers import a marketplace ledger module:\n  ${offenders.join("\n  ")}\nonly orchestrators/marketplace/shared.ts is reachable from a plugin ledger.`,
  );
});

test("import-x/no-restricted-paths defines exactly 8 zones (one per folder) -- D-11", async () => {
  const zones = await loadZones();
  assert.ok(
    zones !== null,
    "import-x/no-restricted-paths is not configured -- D-11 enforcement missing",
  );
  assert.equal(
    zones.length,
    FOLDERS.length,
    `Expected ${FOLDERS.length} zones (one per folder), got ${zones.length}`,
  );
});

test("each zone's target+from set matches the D-11 allowed-imports matrix", async () => {
  const zones = await loadZones();
  assert.ok(zones !== null);

  for (const zone of zones) {
    const target = typeof zone.target === "string" ? zone.target : zone.target[0]!;
    const fromList = (typeof zone.from === "string" ? [zone.from] : zone.from).slice().sort();
    const expected = EXPECTED_FORBIDDEN[target];
    assert.ok(
      expected !== undefined,
      `Zone target ${target} is not in the D-11 expected map -- did someone add a 10th folder without updating this test?`,
    );
    assert.deepEqual(
      fromList,
      expected.slice().sort(),
      `Zone target ${target} forbidden-set does not match D-11 expected: got ${JSON.stringify(fromList)}, expected ${JSON.stringify(expected)}`,
    );
  }
});

test(
  "canary fixture violates the rule -- programmatic ESLint must report import-x/no-restricted-paths and NOT no-unresolved",
  { timeout: 60_000 },
  async () => {
    // W-6: use the programmatic ESLint API rather than `npx eslint`. Avoids
    // cold-cache flakiness and lets us assert on `ruleId` exactly (B-2 fix:
    // require literal "import-x/no-restricted-paths"; refuse if the canary
    // also produces "import-x/no-unresolved", which would mean the bridges/
    // import target was missing rather than the boundary being violated).
    //
    // Why an overrideConfig: the project's eslint.config.js scopes the
    // import-x/no-restricted-paths rule to `extensions/pi-claude-marketplace/**`
    // via a `files` glob, so the rule does NOT apply when ESLint loads
    // tests/fixtures/bad-imports/edge-imports-bridges.ts directly. This is
    // intentional -- the project rule guards the extension tree, not test
    // fixtures. The canary's job is to prove the rule emits the right
    // ruleId when violated, so we synthesize a config block targeting the
    // fixture's directory and forbidding imports from the extension's
    // bridges/ folder. The fixture's `import` statement then trips the
    // synthetic zone, ruleId === "import-x/no-restricted-paths" fires, and
    // because the fixture's target, bridges/agents/index.ts, is a real file,
    // no import-x/no-unresolved is emitted.
    const { ESLint } = (await import("eslint")) as {
      ESLint: new (opts: {
        cwd: string;
        ignore: boolean;
        overrideConfigFile: boolean;
        overrideConfig: unknown[];
      }) => {
        lintFiles: (
          paths: string[],
        ) => Promise<
          { messages: { ruleId: string | null; message: string; severity: number }[] }[]
        >;
      };
    };

    const importX = (await import("eslint-plugin-import-x")) as {
      default: { meta: unknown; rules: unknown };
    };
    const tseslint = (await import("typescript-eslint")) as {
      default: { parser: unknown };
    };

    const FIXTURE_REL = "tests/fixtures/bad-imports/edge-imports-bridges.ts";
    const FIXTURE_DIR_REL = "./tests/fixtures/bad-imports";

    const eslint = new ESLint({
      cwd: REPO_ROOT,
      ignore: false,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["tests/fixtures/bad-imports/**/*.ts"],
          plugins: {
            "import-x": importX.default,
          },
          languageOptions: {
            parser: tseslint.default.parser,
            parserOptions: {
              project: false,
              ecmaVersion: 2022,
              sourceType: "module",
            },
          },
          rules: {
            "import-x/no-restricted-paths": [
              "error",
              {
                basePath: REPO_ROOT,
                zones: [
                  {
                    target: FIXTURE_DIR_REL,
                    from: ["./extensions/pi-claude-marketplace/bridges"],
                    message: "canary fixture: this import deliberately violates the D-11 boundary.",
                  },
                ],
              },
            ],
          },
        },
      ],
    });
    const results = await eslint.lintFiles([FIXTURE_REL]);

    assert.equal(results.length, 1, `expected exactly one lint result, got ${results.length}`);
    const messages = results[0]!.messages;

    const restrictedPathsErrors = messages.filter(
      (m) => m.ruleId === "import-x/no-restricted-paths",
    );
    const unresolvedErrors = messages.filter((m) => m.ruleId === "import-x/no-unresolved");

    assert.ok(
      restrictedPathsErrors.length >= 1,
      `Expected at least one 'import-x/no-restricted-paths' violation, got ruleIds: ${JSON.stringify(messages.map((m) => m.ruleId))}\nFull messages: ${JSON.stringify(messages, null, 2)}`,
    );
    assert.equal(
      unresolvedErrors.length,
      0,
      `'import-x/no-unresolved' fired -- canary is failing for the WRONG reason (the import target bridges/agents/index.ts should resolve). Messages: ${JSON.stringify(messages, null, 2)}`,
    );
  },
);

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
    // because bridges/index.ts exists, no
    // import-x/no-unresolved is emitted.
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
      `'import-x/no-unresolved' fired -- canary is failing for the WRONG reason (the import target should resolve via the bridges/index.ts placeholder). Messages: ${JSON.stringify(messages, null, 2)}`,
    );
  },
);

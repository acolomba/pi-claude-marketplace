// tests/architecture/disabled-state-classification.test.ts
//
// ENBL-05 architecture carrier for the single recorded-disabled predicate.
// Runtime truth-table ownership and the whole-tree no-twin/import-collapse
// contract live here, separate from the pure reconcile planner owner.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { isRecordedButDisabled } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSION_SOURCE_ROOT = "extensions/pi-claude-marketplace";
const PREDICATE_DEFINITION_SITE = "extensions/pi-claude-marketplace/persistence/state-io.ts";

const FORMER_DEFINITION_SITES: readonly string[] = [
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/update.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts",
];

const TWO_AXIS_CONJUNCTION = /compatibility\.installable\s*&&\s*![\w.]+\.enabled/;
const DESTRUCTURED_ENABLED_BINDING = /\{[^{}]*\benabled\b[^{}]*\}\s*=(?![=>])/;
const BRACKET_ENABLED_ACCESS = /\[\s*["']enabled["']\s*\]/;
const BOOLEAN_ENABLED_COERCION = /Boolean\s*\([^)]*\.enabled\b[^)]*\)/;

const INLINE_REDERIVATIONS: readonly RegExp[] = [
  /!\s*[\w.]+\.enabled\b/,
  /\.enabled\s*===\s*false/,
  /\.enabled\s*!==\s*true/,
  DESTRUCTURED_ENABLED_BINDING,
  BRACKET_ENABLED_ACCESS,
  BOOLEAN_ENABLED_COERCION,
];

const ESCAPING_TWIN_SPELLINGS: ReadonlyArray<{
  readonly label: string;
  readonly line: string;
  readonly pattern: RegExp;
}> = [
  {
    label: "Boolean() coercion",
    line: "if (Boolean(record.enabled) === false) {",
    pattern: BOOLEAN_ENABLED_COERCION,
  },
  {
    label: "bracket access",
    line: 'if (!record["enabled"]) {',
    pattern: BRACKET_ENABLED_ACCESS,
  },
  {
    label: "destructured binding",
    line: "const { enabled } = record;",
    pattern: DESTRUCTURED_ENABLED_BINDING,
  },
];

const NON_REDERIVATIONS: ReadonlyArray<{ readonly label: string; readonly line: string }> = [
  { label: "config-declaration axis", line: "if (entry.enabled !== false) {" },
  { label: "legitimate predicate call", line: "if (isRecordedButDisabled(record)) {" },
];

const DELIBERATE_OVER_REACH: ReadonlyArray<{ readonly label: string; readonly line: string }> = [
  { label: "config-declaration destructure", line: "const { enabled } = entry;" },
  {
    label: "untyped destructured parameter",
    line: "function f({ scope, enabled } = defaults) {",
  },
];

const SINGLE_PREDICATE_IMPORT =
  /import\s*\{[^}]*\bisRecordedButDisabled\b[^}]*\}\s*from\s+["'][^"']*persistence\/state-io\.ts["']/;

async function extensionSourceFiles(): Promise<readonly string[]> {
  const sourceFiles: string[] = [];
  const walk = async (relativeDirectory: string): Promise<void> => {
    const entries = await readdir(path.join(REPO_ROOT, relativeDirectory), {
      withFileTypes: true,
    });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(relativePath);
      } else if (entry.name.endsWith(".ts")) {
        sourceFiles.push(relativePath);
      }
    }
  };

  await walk(EXTENSION_SOURCE_ROOT);
  return sourceFiles;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("disabled-state classification architecture", () => {
  for (const { enabled, expected, installable } of [
    { enabled: false, expected: true, installable: false },
    { enabled: true, expected: false, installable: false },
    { enabled: false, expected: true, installable: true },
    { enabled: true, expected: false, installable: true },
  ]) {
    test(`classifies installable ${String(installable)} and enabled ${String(enabled)} as disabled ${String(expected)}`, () => {
      // arrange
      const record = {
        compatibility: { installable },
        enabled,
        resources: enabled ? ["skill-a"] : [],
      };

      // act
      const result = isRecordedButDisabled(record);

      // assert
      assert.equal(result, expected);
    });
  }

  test("classifies an enabled record with an empty inventory as enabled", () => {
    // arrange
    const record = {
      compatibility: { installable: true },
      enabled: true,
      resources: {
        agents: [],
        hooks: [],
        mcpServers: [],
        prompts: [],
        skills: [],
      },
    };

    // act
    const result = isRecordedButDisabled(record);

    // assert
    assert.equal(result, false);
  });

  test("classifies a disabled record with a populated inventory as disabled", () => {
    // arrange
    const record = {
      compatibility: { installable: true },
      enabled: false,
      resources: {
        agents: ["agent-a"],
        hooks: ["hook-a"],
        mcpServers: ["mcp-a"],
        prompts: ["prompt-a"],
        skills: ["skill-a"],
      },
    };

    // act
    const result = isRecordedButDisabled(record);

    // assert
    assert.equal(result, true);
  });

  test("detects disabled-state twins across the complete extension source tree", async () => {
    // arrange
    const offenders: string[] = [];
    const sourceFiles = await extensionSourceFiles();

    // act
    for (const relativePath of sourceFiles) {
      const source = await readFile(path.join(REPO_ROOT, relativePath), "utf8");
      const strippedSource = stripComments(source);
      if (TWO_AXIS_CONJUNCTION.test(strippedSource)) {
        offenders.push(
          `${relativePath} re-derives the disabled state from the availability axis (${String(TWO_AXIS_CONJUNCTION)})`,
        );
      }

      if (relativePath === PREDICATE_DEFINITION_SITE) {
        continue;
      }

      for (const pattern of INLINE_REDERIVATIONS) {
        if (pattern.test(strippedSource)) {
          offenders.push(
            `${relativePath} re-derives the disabled state inline (${String(pattern)}) -- call isRecordedButDisabled instead`,
          );
        }
      }
    }

    // assert
    assert.deepStrictEqual(offenders, []);
  });

  test("detects escaping twin spellings without matching legitimate controls", () => {
    // arrange
    const escapingResults = ESCAPING_TWIN_SPELLINGS.map(({ label, line, pattern }) => ({
      controls: NON_REDERIVATIONS.map((control) => ({
        label: control.label,
        matched: pattern.test(control.line),
      })),
      label,
      matched: pattern.test(line),
    }));
    const combinedControlResults = NON_REDERIVATIONS.map(({ label, line }) => ({
      label,
      matched: INLINE_REDERIVATIONS.some((pattern) => pattern.test(line)),
    }));

    // act
    const result = { combinedControlResults, escapingResults };

    // assert
    assert.deepStrictEqual(result, {
      combinedControlResults: [
        { label: "config-declaration axis", matched: false },
        { label: "legitimate predicate call", matched: false },
      ],
      escapingResults: [
        {
          controls: [
            { label: "config-declaration axis", matched: false },
            { label: "legitimate predicate call", matched: false },
          ],
          label: "Boolean() coercion",
          matched: true,
        },
        {
          controls: [
            { label: "config-declaration axis", matched: false },
            { label: "legitimate predicate call", matched: false },
          ],
          label: "bracket access",
          matched: true,
        },
        {
          controls: [
            { label: "config-declaration axis", matched: false },
            { label: "legitimate predicate call", matched: false },
          ],
          label: "destructured binding",
          matched: true,
        },
      ],
    });
  });

  test("keeps the destructured-binding pattern deliberately fail-closed", () => {
    // arrange
    const inputs = DELIBERATE_OVER_REACH.map(({ label, line }) => ({ label, line }));

    // act
    const result = inputs.map(({ label, line }) => ({
      label,
      matched: DESTRUCTURED_ENABLED_BINDING.test(line),
    }));

    // assert
    assert.deepStrictEqual(result, [
      { label: "config-declaration destructure", matched: true },
      { label: "untyped destructured parameter", matched: true },
    ]);
  });

  test("routes every widened pattern into the source walk without global state", () => {
    // arrange
    const patterns = [...INLINE_REDERIVATIONS];

    // act
    const result = {
      allEscapingPatternsIncluded: ESCAPING_TWIN_SPELLINGS.every(({ pattern }) =>
        patterns.includes(pattern),
      ),
      globalFlags: patterns.map((pattern) => pattern.global),
    };

    // assert
    assert.deepStrictEqual(result, {
      allEscapingPatternsIncluded: true,
      globalFlags: [false, false, false, false, false, false],
    });
  });

  test("requires every former definition site to import the single predicate", async () => {
    // arrange
    const offenders: string[] = [];

    // act
    for (const relativePath of FORMER_DEFINITION_SITES) {
      const source = await readFile(path.join(REPO_ROOT, relativePath), "utf8");
      if (!SINGLE_PREDICATE_IMPORT.test(stripComments(source))) {
        offenders.push(relativePath);
      }
    }

    // assert
    assert.deepStrictEqual(offenders, []);
  });
});

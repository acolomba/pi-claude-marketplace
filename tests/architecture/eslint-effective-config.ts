/**
 * The shared effective-ESLint-configuration resolver for the architecture gates.
 *
 * D-07-09: a gate that asserts a rule's state must ask ESLint what applies to a
 * FILE, never read the configuration's source. A flat config is a cascade -- a
 * later block overrides an earlier one, a `files` glob decides applicability,
 * and a global `ignores` is absolute -- so the first block mentioning a rule is
 * not the rule's state, and a `files` array is not the set of files a rule
 * reaches. Two gates in this tree were measured green while the rule they guard
 * was disabled, both for that reason. `calculateConfigForFile` applies the
 * cascade itself and hands back the answer, with severities already normalised
 * to the integers 0, 1, and 2.
 *
 * D-07-02 / D-07-10: `overrideConfigFile` names the real `eslint.config.js`. The
 * boolean form of that option is forbidden here, and the difference is the whole
 * reason this module exists: passing the boolean tells ESLint there is no
 * configuration file, which promotes `overrideConfig` to the ENTIRE
 * configuration -- a synthetic config that resembles the real one only as
 * closely as whoever typed it managed, and that drifts the moment the real one
 * changes. Naming the file keeps ESLint's own loader and cascade in play, which
 * makes `overrideConfig` exactly what an offender should be: the real
 * configuration plus one appended block.
 *
 * Every offender exported here is therefore a one-element array, and
 * `assertSingleAppendedBlock` makes that property mechanically checked rather
 * than trusted -- an offender that grew a second block would no longer be a
 * mutation of the real configuration, it would be a rewrite of it.
 *
 * Nothing here writes to the repository. The offenders live in memory for the
 * duration of one resolution.
 *
 * This file registers no case of its own.
 */

import assert from "node:assert/strict";

import { ESLint } from "eslint";

import { ESLINT_CONFIG_REL, EXTENSION_ROOT_REL } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

import type { Linter } from "eslint";

/**
 * One resolved rule entry, as `calculateConfigForFile` returns it: the numeric
 * severity followed by whatever options survived the cascade.
 *
 * A rule switched off by a later block keeps the options an earlier block gave
 * it -- measured, `import-x/no-restricted-paths` resolves to `[0, { zones: [...8
 * entries] }]` under an appended `"off"`. Reading the options without the
 * severity is exactly how a gate reports eight healthy zones for a rule that no
 * longer runs.
 */
export type ResolvedRuleEntry = [number, ...unknown[]];

/** The subset of a resolved configuration the gates read. */
export interface EffectiveConfig {
  rules: Record<string, ResolvedRuleEntry | undefined>;
}

/** Blocks appended to the real configuration for one resolution. */
export type AppendedBlocks = readonly Linter.Config[];

/** The glob an appended block uses to reach the extension tree. */
const EXTENSION_GLOB = `${EXTENSION_ROOT_REL}/**/*.ts`;

/**
 * AHG-014: a blanket block that turns `no-console` off for every TypeScript
 * file in the repository.
 *
 * This is the offender the superseded source scrape could not see: it looked for
 * a `files` array literally containing the extension path and skipped every
 * array that did not, so a `**` glob disabling the rule everywhere was not even
 * read.
 */
export const BLANKET_NO_CONSOLE_OFF: AppendedBlocks = [
  { files: ["**/*.ts"], rules: { "no-console": "off" } },
];

/**
 * ABG-004: a block that switches `import-x/no-restricted-paths` off across the
 * extension tree.
 *
 * Measured, this resolves to severity 0 while the eight zones the earlier block
 * configured survive in the options. A gate reading the zones without the
 * severity reports a healthy matrix for a rule that no longer runs.
 */
export const RESTRICTED_PATHS_OFF: AppendedBlocks = [
  { files: [EXTENSION_GLOB], rules: { "import-x/no-restricted-paths": "off" } },
];

/**
 * ABG-004: a block that replaces the eight-zone matrix with a single dummy zone.
 *
 * The zone is dummy but cannot be absent: `zones: []` is rejected outright by
 * the rule's own schema ("should NOT have fewer than 1 items"), which would make
 * the offender fail while constructing rather than while resolving -- the wrong
 * reason, and one that proves nothing about the gate.
 */
export const ZONE_SUBSTITUTION: AppendedBlocks = [
  {
    files: [EXTENSION_GLOB],
    rules: {
      "import-x/no-restricted-paths": [
        "error",
        {
          basePath: REPO_ROOT,
          zones: [
            {
              target: `./${EXTENSION_ROOT_REL}/shared`,
              from: [`./${EXTENSION_ROOT_REL}/edge`],
              message: "substituted matrix: this zone stands in for the real eight.",
            },
          ],
        },
      ],
    },
  },
];

/**
 * D-07-10: assert `offender` is the real configuration plus exactly one block.
 *
 * Lives here rather than in each gate so the property has one definition. An
 * offender carrying two blocks has stopped being a mutation of the real
 * configuration and become a competing one, which is the weakness the deleted
 * synthetic canary had.
 */
export function assertSingleAppendedBlock(name: string, offender: AppendedBlocks): void {
  assert.equal(
    offender.length,
    1,
    `D-07-10: the ${name} offender appends ${offender.length} blocks to ${ESLINT_CONFIG_REL}, not one. An offender is the REAL configuration plus one mutation; more than one makes it a rewritten configuration, which proves nothing about the configuration that ships.`,
  );
}

/**
 * Resolve the effective configuration of every `targetRels` entry, keyed by
 * entry.
 *
 * One `ESLint` instance serves the whole batch on purpose: the instance carries
 * the loaded flat config, so the first resolution pays the load (measured ~2.1 s)
 * and the rest are effectively free. A fresh instance per file costs ~20 ms each
 * and turns the 229-file sweep from 2.2 s into roughly 5 s for no gain.
 */
export async function resolveEffectiveConfigs(
  targetRels: ReadonlyArray<string>,
  appended: AppendedBlocks = [],
): Promise<Map<string, EffectiveConfig | null>> {
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: ESLINT_CONFIG_REL,
    overrideConfig: [...appended],
  });

  const resolved = new Map<string, EffectiveConfig | null>();
  for (const targetRel of targetRels) {
    resolved.set(
      targetRel,
      ((await eslint.calculateConfigForFile(targetRel)) ?? null) as EffectiveConfig | null,
    );
  }

  return resolved;
}

/**
 * Resolve the effective configuration ESLint applies to one file, optionally
 * with `appended` blocks in play.
 *
 * The default empty `appended` is the benign control: the real configuration,
 * loaded by ESLint's own loader, with nothing added. Returns `null` for a file
 * no configuration reaches, which is a different answer from "the rule is off"
 * and is kept distinct for that reason.
 */
export async function resolveEffectiveConfig(
  targetRel: string,
  appended: AppendedBlocks = [],
): Promise<EffectiveConfig | null> {
  return (await resolveEffectiveConfigs([targetRel], appended)).get(targetRel) ?? null;
}

/**
 * The severity `config` resolves `ruleId` to, or `null` when the rule is absent.
 *
 * Absent and off are deliberately different return values. A file outside every
 * block carrying the rule resolves to absent, and collapsing that into 0 would
 * report an unguarded file as a deliberately exempted one.
 */
export function ruleSeverity(config: EffectiveConfig | null, ruleId: string): number | null {
  const entry = config?.rules[ruleId];

  return entry === undefined ? null : entry[0];
}

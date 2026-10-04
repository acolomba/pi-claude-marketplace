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
 * D-07-02: `overrideConfigFile` names the real `eslint.config.js`, so ESLint's
 * own loader and cascade resolve every file. Nothing here writes to the
 * repository.
 *
 * This file registers no case of its own.
 */

import { ESLint } from "eslint";

import { ESLINT_CONFIG_REL } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

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
): Promise<Map<string, EffectiveConfig | null>> {
  const eslint = new ESLint({
    cwd: REPO_ROOT,
    overrideConfigFile: ESLINT_CONFIG_REL,
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
 * Resolve the effective configuration ESLint applies to one file.
 *
 * Returns `null` for a file no configuration reaches, which is a different
 * answer from "the rule is off" and is kept distinct for that reason.
 */
export async function resolveEffectiveConfig(targetRel: string): Promise<EffectiveConfig | null> {
  return (await resolveEffectiveConfigs([targetRel])).get(targetRel) ?? null;
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

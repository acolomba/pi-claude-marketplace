/**
 * @fileoverview Classifies a nightly e2e run against upstream `main`: a pass,
 * an upstream change that the snapshot diff shows, or a regression.
 */

export type NightlyClassification = "pass" | "upstream-change" | "regression";

export function classifyNightlyFailure(args: {
  readonly failed: boolean;
  readonly snapshotDiff: string;
}): NightlyClassification {
  if (!args.failed) {
    return "pass";
  }

  return args.snapshotDiff.trim().length > 0 ? "upstream-change" : "regression";
}

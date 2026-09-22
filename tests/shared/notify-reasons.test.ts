import assert from "node:assert/strict";
import { test } from "node:test";

import {
  companionSeverity,
  malformedReasonsForKinds,
  skipSeverity,
  type DegradeKind,
  type FailureReason,
} from "../../extensions/pi-claude-marketplace/shared/notify-reasons.ts";

import type { Reason } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

type IsExact<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

void ("permission denied" satisfies FailureReason);
void ("source missing" satisfies FailureReason);
void ("network unreachable" satisfies FailureReason);
void ("authentication required" satisfies FailureReason);
void ("unreadable" satisfies FailureReason);
void ("unparseable" satisfies FailureReason);
void ("unreadable manifest" satisfies FailureReason);
void ("invalid manifest" satisfies FailureReason);
void ("malformed mcp" satisfies FailureReason);
void ("malformed skill" satisfies FailureReason);
void ("malformed command" satisfies FailureReason);
void ("not in manifest" satisfies FailureReason);
void ("rollback partial" satisfies FailureReason);
void ("lock held" satisfies FailureReason);
void ("source mismatch" satisfies FailureReason);
void ("dangling reference" satisfies FailureReason);
void ("concurrently uninstalled" satisfies FailureReason);
void ("concurrently updated" satisfies FailureReason);
// @ts-expect-error idempotent reasons are not failure reasons
void ("up-to-date" satisfies FailureReason);
// @ts-expect-error unsupported reasons are not failure reasons
void ("unsupported source" satisfies FailureReason);
// @ts-expect-error declared-state reasons are not failure reasons
void ("installs disabled" satisfies FailureReason);

void ("skill" satisfies DegradeKind);
void ("command" satisfies DegradeKind);
// @ts-expect-error DegradeKind excludes component kinds without degraded frontmatter behavior
void ("hook" satisfies DegradeKind);

/*
 * OUT-08 coverage proof, observed through the contract it guards.
 *
 * The proof is module-private and is folded into the per-kind reason map's
 * annotation, so a reason left without a topic home -- or a stray literal that
 * is not a `Reason` -- collapses that map's value type to `never` and the owner
 * stops compiling. What a caller can still see is the mapping's own result, and
 * it is exactly the failure-class vocabulary rather than the empty type.
 */
void (true satisfies IsExact<ReturnType<typeof malformedReasonsForKinds>[number], FailureReason>);

/*
 * Controls for the gate the owner is annotated against. The offender pair plants
 * each drift direction into a local restatement of the partition: a reason with
 * no home, and a grouped literal that is not a reason. Both must collapse the
 * gate to `never`, which is what turns the owner's `satisfies` into a build
 * failure; the benign case proves the same gate passes a total partition
 * through unchanged.
 */
type GateProven<Partition, T> = [Exclude<Reason, Partition>, Exclude<Partition, Reason>] extends [
  never,
  never,
]
  ? T
  : never;

type BenignPartition = Reason;
type MissingReasonPartition = Exclude<Reason, "workflows">;
type StrayReasonPartition = Reason | "not a reason";

void (true satisfies IsExact<GateProven<BenignPartition, FailureReason>, FailureReason>);
void (true satisfies IsExact<GateProven<MissingReasonPartition, FailureReason>, never>);
void (true satisfies IsExact<GateProven<StrayReasonPartition, FailureReason>, never>);

const skipSeverityCases = [
  {
    title: "classifies absent reasons as an actionable skip",
    reasons: undefined,
    expectedSeverity: "warning",
  },
  {
    title: "classifies an empty reason list as an actionable skip",
    reasons: [],
    expectedSeverity: "warning",
  },
  {
    title: "classifies up-to-date as an informational idempotent skip",
    reasons: ["up-to-date"],
    expectedSeverity: "info",
  },
  {
    title: "classifies already installed as an informational idempotent skip",
    reasons: ["already installed"],
    expectedSeverity: "info",
  },
  {
    title: "classifies already autoupdate as an informational idempotent skip",
    reasons: ["already autoupdate"],
    expectedSeverity: "info",
  },
  {
    title: "classifies already no autoupdate as an informational idempotent skip",
    reasons: ["already no autoupdate"],
    expectedSeverity: "info",
  },
  {
    title: "classifies already enabled as an informational idempotent skip",
    reasons: ["already enabled"],
    expectedSeverity: "info",
  },
  {
    title: "classifies already disabled as an informational idempotent skip",
    reasons: ["already disabled"],
    expectedSeverity: "info",
  },
  {
    title: "classifies a failure reason as an actionable skip",
    reasons: ["permission denied"],
    expectedSeverity: "warning",
  },
  {
    title: "classifies an unsupported reason as an actionable skip",
    reasons: ["unsupported source"],
    expectedSeverity: "warning",
  },
  {
    title: "classifies several idempotent reasons as an informational skip",
    reasons: ["up-to-date", "already enabled", "already disabled"],
    expectedSeverity: "info",
  },
  {
    title: "classifies repeated equal idempotent reasons as an informational skip",
    reasons: ["already installed", "already installed"],
    expectedSeverity: "info",
  },
  {
    title: "classifies an actionable reason after an idempotent reason as a warning",
    reasons: ["already installed", "source missing"],
    expectedSeverity: "warning",
  },
  {
    title: "classifies an actionable reason before an idempotent reason as a warning",
    reasons: ["source missing", "already installed"],
    expectedSeverity: "warning",
  },
  {
    title: "classifies an author-declared state reason as an actionable skip",
    reasons: ["installs disabled"],
    expectedSeverity: "warning",
  },
  {
    title: "D-10-12: classifies the held-update token as an actionable skip, never idempotent",
    reasons: ["dependents constrain"],
    expectedSeverity: "warning",
  },
] as const;

for (const { title, reasons, expectedSeverity } of skipSeverityCases) {
  test(title, () => {
    // arrange
    const expectedSkipSeverity = expectedSeverity;

    // act
    const severity = skipSeverity(reasons);

    // assert
    assert.strictEqual(severity, expectedSkipSeverity);
  });
}

const companionSeverityCases = [
  {
    title: "keeps info when no companion is declared and neither companion is loaded",
    declaresAgents: false,
    declaresMcp: false,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    expectedSeverity: "info",
  },
  {
    title: "warns when only agents are declared and neither companion is loaded",
    declaresAgents: true,
    declaresMcp: false,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    expectedSeverity: "warning",
  },
  {
    title: "warns when only MCP is declared and neither companion is loaded",
    declaresAgents: false,
    declaresMcp: true,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    expectedSeverity: "warning",
  },
  {
    title: "warns when both companions are declared and neither companion is loaded",
    declaresAgents: true,
    declaresMcp: true,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: false },
    expectedSeverity: "warning",
  },
  {
    title: "keeps info when no companion is declared and only MCP is loaded",
    declaresAgents: false,
    declaresMcp: false,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: true },
    expectedSeverity: "info",
  },
  {
    title: "warns when only agents are declared and only MCP is loaded",
    declaresAgents: true,
    declaresMcp: false,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: true },
    expectedSeverity: "warning",
  },
  {
    title: "keeps info when only MCP is declared and loaded",
    declaresAgents: false,
    declaresMcp: true,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: true },
    expectedSeverity: "info",
  },
  {
    title: "warns when agents are also declared but only MCP is loaded",
    declaresAgents: true,
    declaresMcp: true,
    probe: { piSubagentsLoaded: false, piMcpAdapterLoaded: true },
    expectedSeverity: "warning",
  },
  {
    title: "keeps info when no companion is declared and only agents are loaded",
    declaresAgents: false,
    declaresMcp: false,
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: false },
    expectedSeverity: "info",
  },
  {
    title: "keeps info when only agents are declared and loaded",
    declaresAgents: true,
    declaresMcp: false,
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: false },
    expectedSeverity: "info",
  },
  {
    title: "warns when only MCP is declared and only agents are loaded",
    declaresAgents: false,
    declaresMcp: true,
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: false },
    expectedSeverity: "warning",
  },
  {
    title: "warns when MCP is also declared but only agents are loaded",
    declaresAgents: true,
    declaresMcp: true,
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: false },
    expectedSeverity: "warning",
  },
  {
    title: "keeps info when no companion is declared and both companions are loaded",
    declaresAgents: false,
    declaresMcp: false,
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
    expectedSeverity: "info",
  },
  {
    title: "keeps info when only agents are declared and both companions are loaded",
    declaresAgents: true,
    declaresMcp: false,
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
    expectedSeverity: "info",
  },
  {
    title: "keeps info when only MCP is declared and both companions are loaded",
    declaresAgents: false,
    declaresMcp: true,
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
    expectedSeverity: "info",
  },
  {
    title: "keeps info when both companions are declared and loaded",
    declaresAgents: true,
    declaresMcp: true,
    probe: { piSubagentsLoaded: true, piMcpAdapterLoaded: true },
    expectedSeverity: "info",
  },
] as const;

for (const {
  title,
  declaresAgents,
  declaresMcp,
  probe,
  expectedSeverity,
} of companionSeverityCases) {
  test(title, () => {
    // arrange
    const expectedCompanionSeverity = expectedSeverity;

    // act
    const severity = companionSeverity({ declaresAgents, declaresMcp }, probe);

    // assert
    assert.strictEqual(severity, expectedCompanionSeverity);
  });
}

const malformedReasonCases = [
  {
    title: "returns no malformed reasons when degraded kinds are absent",
    kinds: undefined,
    expectedReasons: [],
  },
  {
    title: "returns no malformed reasons for an empty degraded-kind list",
    kinds: [],
    expectedReasons: [],
  },
  {
    title: "maps a degraded skill to its failure reason",
    kinds: ["skill"],
    expectedReasons: ["malformed skill"],
  },
  {
    title: "maps a degraded command to its failure reason",
    kinds: ["command"],
    expectedReasons: ["malformed command"],
  },
  {
    title: "maps adjacent degraded kinds in canonical skill-before-command order",
    kinds: ["skill", "command"],
    expectedReasons: ["malformed skill", "malformed command"],
  },
  {
    title: "keeps canonical malformed-reason order for reversed degraded kinds",
    kinds: ["command", "skill"],
    expectedReasons: ["malformed skill", "malformed command"],
  },
  {
    title: "deduplicates equal degraded kinds without changing canonical order",
    kinds: ["skill", "command", "skill", "command"],
    expectedReasons: ["malformed skill", "malformed command"],
  },
] as const;

for (const { title, kinds, expectedReasons } of malformedReasonCases) {
  test(title, () => {
    // arrange
    const expectedMalformedReasons = [...expectedReasons];

    // act
    const malformedReasons = malformedReasonsForKinds(kinds);

    // assert
    assert.deepStrictEqual(malformedReasons, expectedMalformedReasons);
  });
}

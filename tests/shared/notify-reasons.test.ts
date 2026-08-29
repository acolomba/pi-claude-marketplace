import assert from "node:assert/strict";
import { test } from "node:test";

import {
  companionSeverity,
  malformedReasonsForKinds,
  skipSeverity,
  type DegradeKind,
  type FailureReason,
  type _ReasonsCoverageProof,
} from "../../extensions/pi-claude-marketplace/shared/notify-reasons.ts";

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

type ReasonsCoverageProofIsExact = _ReasonsCoverageProof extends [never, never]
  ? [never, never] extends _ReasonsCoverageProof
    ? true
    : false
  : false;
void (true satisfies ReasonsCoverageProofIsExact);

const skipSeverityCases = [
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
    title: "maps a degraded skill to its failure reason",
    kinds: ["skill"],
    expectedReasons: ["malformed skill"],
  },
  {
    title: "maps a degraded command to its failure reason",
    kinds: ["command"],
    expectedReasons: ["malformed command"],
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

// tests/presentation/manual-recovery.test.ts
//
// CMC-16 / MSG-MR-1..2: manual-recovery composer.
//
// The composer renders a single compact-line via renderRow({kind:
// "manual-recovery", ...}) and (when orphanDetails is non-empty) appends
// 2-space-indented detail lines. The MSG-MR-1 blank-line discipline above
// the manual-recovery block is composed by the CALLER (orchestrator) -- this
// composer never prefixes a blank line.
//
// MSG-MR-2: ManualRecoveryLine has no `marketplace` or `scope` field, so
// neither `@<mp>` nor `[<scope>]` can be emitted (enforced structurally by
// the compact-line variant shape).

import assert from "node:assert/strict";
import test from "node:test";

import { renderManualRecovery } from "../../extensions/pi-claude-marketplace/presentation/manual-recovery.ts";

import type {
  ManualRecoveryLine,
  SoftDepProbe,
} from "../../extensions/pi-claude-marketplace/presentation/compact-line.ts";

const PROBE: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

test("MSG-MR-1: single-reason manual-recovery emits compact line", () => {
  const line: ManualRecoveryLine = {
    kind: "manual-recovery",
    resource: "agent index",
    reasons: ["unparseable"],
  };
  assert.equal(renderManualRecovery(line, PROBE), "⊘ agent index (manual recovery) {unparseable}");
});

test("MSG-MR-1: multi-reason manual-recovery joins reasons with `, ` inside `{}`", () => {
  const line: ManualRecoveryLine = {
    kind: "manual-recovery",
    resource: "state.json",
    reasons: ["unparseable", "stale clone"],
  };
  assert.equal(
    renderManualRecovery(line, PROBE),
    "⊘ state.json (manual recovery) {unparseable, stale clone}",
  );
});

test("MSG-MR-1: empty orphanDetails returns just the head compact line", () => {
  const line: ManualRecoveryLine = {
    kind: "manual-recovery",
    resource: "agent index",
    reasons: ["unparseable"],
    orphanDetails: [],
  };
  assert.equal(renderManualRecovery(line, PROBE), "⊘ agent index (manual recovery) {unparseable}");
});

test("MSG-MR-1: non-empty orphanDetails appended on their own 2-space-indented lines", () => {
  const line: ManualRecoveryLine = {
    kind: "manual-recovery",
    resource: "agent index",
    reasons: ["unparseable"],
    orphanDetails: ["row foo: missing marketplace", "row bar: missing plugin"],
  };
  assert.equal(
    renderManualRecovery(line, PROBE),
    "⊘ agent index (manual recovery) {unparseable}\n  row foo: missing marketplace\n  row bar: missing plugin",
  );
});

test("MSG-MR-2: composer output never contains `@<marketplace>` (structural absence)", () => {
  const line: ManualRecoveryLine = {
    kind: "manual-recovery",
    resource: "agent index",
    reasons: ["unparseable"],
  };
  const out = renderManualRecovery(line, PROBE);
  assert.ok(!out.includes("@"), `manual-recovery must not emit @<mp>: got ${out}`);
});

test("MSG-MR-2: composer output never contains `[<scope>]` (structural absence)", () => {
  const line: ManualRecoveryLine = {
    kind: "manual-recovery",
    resource: "agent index",
    reasons: ["unparseable"],
  };
  const out = renderManualRecovery(line, PROBE);
  assert.ok(!out.includes("[user]"), `manual-recovery must not emit [user]: got ${out}`);
  assert.ok(!out.includes("[project]"), `manual-recovery must not emit [project]: got ${out}`);
});

test("MSG-MR-1: composer does NOT prepend a blank-line prefix (caller composes that)", () => {
  const line: ManualRecoveryLine = {
    kind: "manual-recovery",
    resource: "agent index",
    reasons: ["unparseable"],
  };
  const out = renderManualRecovery(line, PROBE);
  assert.ok(!out.startsWith("\n"), `composer must not prefix newline: got ${JSON.stringify(out)}`);
});

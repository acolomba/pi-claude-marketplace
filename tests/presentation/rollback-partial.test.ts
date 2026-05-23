// tests/presentation/rollback-partial.test.ts
//
// CMC-17 / MSG-RP-1: rollback-partial composer.
//
// The composer routes the parent and each child through renderRow. The
// parent row already carries status "failed" + reasons ["rollback partial"]
// (multi-phase) or a single-phase reason; the children are RollbackChild
// rows with bare compact level (no leading icon) at 2-space indentation.
//
// MSG-RP-1: the cause-chain trailer is composed by the CALLER AFTER the
// rollback block, not by this composer.

import assert from "node:assert/strict";
import test from "node:test";

import { renderRollbackPartial } from "../../extensions/pi-claude-marketplace/presentation/rollback-partial.ts";

import type {
  PluginInlineRow,
  RollbackChild,
  SoftDepProbe,
} from "../../extensions/pi-claude-marketplace/presentation/compact-line.ts";

const PROBE: SoftDepProbe = {
  piSubagentsLoaded: true,
  piMcpAdapterLoaded: true,
};

test("MSG-RP-1: parent + 2 children render with 2-space-indented children below parent", () => {
  const parent: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    version: "1.0.0",
    status: "failed",
    reasons: ["rollback partial"],
  };
  const children: readonly RollbackChild[] = [
    { kind: "rollback-child", phaseLabel: "agents", status: "failed", reasons: ["unparseable"] },
    { kind: "rollback-child", phaseLabel: "mcp", status: "rollback failed", reasons: ["unparseable"] },
  ];
  const out = renderRollbackPartial(parent, children, PROBE);
  const lines = out.split("\n");
  assert.equal(lines.length, 3);
  // Parent row first.
  assert.equal(
    lines[0],
    "⊘ alpha@official [user] v1.0.0 (failed) {rollback partial}",
  );
  // Children: bare compact level (no leading icon), 2-space indentation.
  assert.equal(lines[1], "  agents (failed) {unparseable}");
  assert.equal(lines[2], "  mcp (rollback failed) {unparseable}");
});

test("MSG-RP-1: empty children returns just the parent line (no trailing children block)", () => {
  const parent: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "failed",
    reasons: ["rollback partial"],
  };
  const out = renderRollbackPartial(parent, [], PROBE);
  assert.equal(out, "⊘ alpha@official [user] (failed) {rollback partial}");
  // No newlines -- parent alone.
  assert.ok(!out.includes("\n"), `empty children must not emit newline: ${JSON.stringify(out)}`);
});

test("MSG-RP-1: single-phase parent uses the phase name as a reason (e.g. {agents})", () => {
  const parent: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "failed",
    reasons: ["unparseable"],
  };
  const children: readonly RollbackChild[] = [
    { kind: "rollback-child", phaseLabel: "agents", status: "failed", reasons: ["unparseable"] },
  ];
  const out = renderRollbackPartial(parent, children, PROBE);
  const lines = out.split("\n");
  assert.equal(lines.length, 2);
  // Parent reasons render verbatim from the caller's row spec; this test
  // affirms the composer does not mutate or augment reasons.
  assert.equal(lines[0], "⊘ alpha@official [user] (failed) {unparseable}");
  assert.equal(lines[1], "  agents (failed) {unparseable}");
});

test("MSG-RP-1: composer never appends a cause-chain trailer (caller composes that)", () => {
  const parent: PluginInlineRow = {
    kind: "plugin-inline",
    name: "alpha",
    marketplace: "official",
    scope: "user",
    status: "failed",
    reasons: ["rollback partial"],
  };
  const children: readonly RollbackChild[] = [
    { kind: "rollback-child", phaseLabel: "agents", status: "failed", reasons: ["unparseable"] },
  ];
  const out = renderRollbackPartial(parent, children, PROBE);
  assert.ok(
    !out.includes("cause:"),
    `composer must not emit cause-chain trailer (caller composes that): ${out}`,
  );
});

test("MSG-RP-1: PluginCascadeRow parent (no @marketplace) renders correctly", () => {
  const parent = {
    kind: "plugin-cascade" as const,
    name: "alpha",
    scope: "user" as const,
    version: "1.0.0",
    status: "failed" as const,
    reasons: ["rollback partial" as const],
  };
  const children: readonly RollbackChild[] = [
    { kind: "rollback-child", phaseLabel: "agents", status: "failed", reasons: ["unparseable"] },
  ];
  const out = renderRollbackPartial(parent, children, PROBE);
  const lines = out.split("\n");
  // Cascade parent: no @marketplace (MSG-GR-2 carve-out).
  assert.equal(lines[0], "⊘ alpha [user] v1.0.0 (failed) {rollback partial}");
  assert.ok(!lines[0].includes("@"), `cascade parent must not contain @<mp>: ${lines[0]}`);
  assert.equal(lines[1], "  agents (failed) {unparseable}");
});

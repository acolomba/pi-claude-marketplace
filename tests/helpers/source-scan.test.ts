// tests/helpers/source-scan.test.ts
//
// Gate-the-gate coverage for the shared source-scanning mechanic in
// `source-scan.ts`. Both architecture gates that consume it (the NFR-5
// orchestrator-network gate and the COMPAT-01 no-expansion gate) assert an
// ABSENCE, so every one of their failure modes is silent: a scan that inspects
// nothing passes exactly like a scan that inspects everything and finds nothing.
// These cases pin the difference.

import assert from "node:assert/strict";
import test from "node:test";

import { assertNoForbiddenSurface, stripComments } from "./source-scan.ts";

const NEVER_MATCHES = [{ name: "impossible token", pattern: /zzz-no-such-token-zzz/ }];

test("WR-06: a target that does not exist fails the scan instead of being skipped", async () => {
  await assert.rejects(
    () =>
      assertNoForbiddenSurface(
        ["extensions/pi-claude-marketplace/orchestrators/plugin/renamed-away.ts"],
        NEVER_MATCHES,
        () => "unused: the scan never reaches the offender assertion",
      ),
    /does not exist/,
    "a renamed or deleted target must not green the gate over zero inspected files",
  );
});

test("WR-06: a not-yet-written target passes only when it is named in allowMissing", async () => {
  await assertNoForbiddenSurface(
    ["extensions/pi-claude-marketplace/orchestrators/plugin/not-yet-written.ts"],
    NEVER_MATCHES,
    () => "unused",
    { allowMissing: ["extensions/pi-claude-marketplace/orchestrators/plugin/not-yet-written.ts"] },
  );

  // The waiver is per-path, not a blanket opt-out.
  await assert.rejects(
    () =>
      assertNoForbiddenSurface(
        ["extensions/pi-claude-marketplace/orchestrators/plugin/other-missing.ts"],
        NEVER_MATCHES,
        () => "unused",
        { allowMissing: ["extensions/pi-claude-marketplace/orchestrators/plugin/not-this-one.ts"] },
      ),
    /does not exist/,
  );
});

test("WR-06: an existing target is really inspected -- a forbidden pattern in it fails", async () => {
  await assert.rejects(
    () =>
      assertNoForbiddenSurface(
        ["tests/helpers/source-scan.ts"],
        [{ name: "the helper's own export", pattern: /assertNoForbiddenSurface/ }],
        (offenders) => `expected-failure: ${offenders.join(", ")}`,
      ),
    /expected-failure/,
  );
});

test("stripComments removes block and line comments so a gate does not match its own prose", () => {
  const stripped = stripComments(
    ["/* MUST NOT import gitOps */", "// gitOps is forbidden here", "const ok = 1;"].join("\n"),
  );
  assert.equal(stripped.includes("gitOps"), false);
  assert.match(stripped, /const ok = 1;/);
});

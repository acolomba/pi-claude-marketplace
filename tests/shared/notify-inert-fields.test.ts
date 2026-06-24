/**
 * tests/shared/notify-inert-fields.test.ts -- SEV-02 / RLD-02 live-field guard.
 *
 * `MessageBase.severity` and `MessageBase.needsReload` are the caller-stamped
 * facts the `notify()` reducer reads: emission severity is the numeric MAX over
 * `row.severity` (SEV-02) and the `/reload to pick up changes` trailer fires iff
 * the OR-reduce of `row.needsReload` is true (RLD-02). The reducer performs NO
 * content/status inference -- it reduces the stamped fields directly.
 *
 * These tests pin that the fields are LIVE: a stamped `severity:"error"` row
 * DOES drive the emission severity (and prepend the summary line), and a stamped
 * `needsReload:true` row DOES add the `/reload` trailer. If a future edit makes
 * the reducer stop reading either field, these assertions fail.
 */

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

interface MockPi {
  getAllTools: () => { name?: string }[];
}

/** Probe reports both companion extensions loaded (no soft-dep markers fire). */
function piWithBothLoaded(): MockPi {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

/** Render `msg` through `notify` and return the single `ctx.ui.notify` call args. */
function renderArgs(msg: NotificationMessage): readonly unknown[] {
  const ctx = makeCtx();
  notify(ctx as never, piWithBothLoaded() as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  return ctx.ui.notify.mock.calls[0]!.arguments;
}

test('SEV-02: a stamped severity:"error" plugin row drives the emission to error severity (MAX reduce)', () => {
  // A `failed` plugin row stamps `severity:"error"`. The reducer's MAX over the
  // row severities yields error: the 2nd `ctx.ui.notify` arg is "error" and the
  // summary line is prepended.
  const errorStamped: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "failed",
            name: "commit-commands",
            reasons: ["network unreachable"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  const args = renderArgs(errorStamped);
  // The reducer READS the stamped severity: emission carries the error 2nd arg.
  assert.equal(args.length, 2);
  assert.equal(args[1], "error");
  // ... and prepends the error summary line ahead of the cascade body.
  assert.match(String(args[0]), /^1 plugin operation failed\.\n\n/);
});

test("RLD-02: a stamped needsReload:true row adds the /reload trailer via the OR-reduce", () => {
  // Baseline: a `disabled` INVENTORY row stamps `needsReload:false`, so the
  // OR-reduce is false and NO `/reload` trailer is emitted.
  const noReload: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "commit-commands",
            version: "1.0.0",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };
  assert.equal(String(renderArgs(noReload)[0]).includes("/reload to pick up changes"), false);

  // Same row stamped `needsReload:true` (a realized disable transition): the
  // OR-reduce flips true and the `/reload to pick up changes` trailer appears.
  const withReload: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "commit-commands",
            version: "1.0.0",
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };
  assert.equal(String(renderArgs(withReload)[0]).endsWith("\n\n/reload to pick up changes"), true);
});

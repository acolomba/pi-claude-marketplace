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
  assert.match(String(args[0]), /^A plugin operation has failed\.\n\n/);
});

test("OUT-04 / D-04: a single-target (no cardinality) cascade carrying a label renders no tally (label inert without plural)", () => {
  // A single-target cascade carries the operation label but omits `cardinality`.
  // The tally is gated on `cardinality === "plural"`, so a label alone never
  // produces a tally line -- the single row already embeds the outcome.
  const singleTarget: NotificationMessage = {
    label: "Plugin uninstall",
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "commit-commands",
            reasons: ["not installed"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
  };

  const body = String(renderArgs(singleTarget)[0]);
  // No `<Operation>: ... failure(s)` tally for a single-target op.
  assert.equal(body.includes("Plugin uninstall: "), false);
});

test("OUT-03 / D-04: a plural cascade renders the trailing tally under the operation label", () => {
  // A plural (bulk) cascade carries `cardinality:"plural"` + the label. The
  // tally appears after the body, counting rows by stamped severity (zero-count
  // categories omitted, no terminal period).
  const plural: NotificationMessage = {
    label: "Plugin reinstall",
    cardinality: "plural",
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "failed",
            name: "a",
            reasons: ["network unreachable"],
            severity: "error",
            needsReload: false,
          },
          {
            status: "skipped",
            name: "b",
            reasons: ["not installed"],
            severity: "warning",
            needsReload: false,
          },
          {
            status: "disabled",
            name: "c",
            version: "1.0.0",
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
  };

  const body = String(renderArgs(plural)[0]);
  assert.equal(body.includes("Plugin reinstall: 1 failure, 1 warning, 1 success"), true);
});

test("OUT-03 / D-04: a plural all-success cascade still renders the success tally", () => {
  // OUT-03: the tally appears on plural ops regardless of severity, so a
  // successful bulk operation shows `<Operation>: <n> success(es)`.
  const allSuccess: NotificationMessage = {
    label: "Plugin import",
    cardinality: "plural",
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          { status: "disabled", name: "a", version: "1.0.0", severity: "info", needsReload: false },
          { status: "disabled", name: "b", version: "1.0.0", severity: "info", needsReload: false },
        ],
      },
    ],
  };

  const body = String(renderArgs(allSuccess)[0]);
  assert.equal(body.includes("Plugin import: 2 successes"), true);
});

test("SEV-02: status is INERT as a severity source -- the reducer reads only the stamped severity", () => {
  // The central SEV-02 invariant: the reducer NEVER infers severity from a
  // row's `status` (or `reasons`); it reduces the caller-stamped `severity`
  // only. Two adversarial rows make status and stamped severity DISAGREE:
  //
  //   (a) an `unavailable` row stamped `severity:"info"` -- a status-inferring
  //       reducer would map `unavailable` to `warning`; the stamped reducer
  //       leaves it info. (`failed` cannot be used here: GATE-01 makes its
  //       `severity` a REQUIRED `"error" | "warning"`, so it is not even
  //       constructible with an info stamp -- the type system already pins that
  //       arm.)
  //   (b) an `installed` (success-transition) row stamped `severity:"error"`
  //       -- a status-inferring reducer would force `info`; the stamped
  //       reducer honors the error.
  //
  // Asserting on the actual emitted (wire) severity proves status is inert.

  // (a) `unavailable` + stamped `info` -> emission stays info (undefined 2nd arg).
  const unavailableButInfo: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "unavailable",
            name: "commit-commands",
            reasons: ["no longer installable"],
            severity: "info",
          },
        ],
      },
    ],
  };
  const unavailableArgs = renderArgs(unavailableButInfo);
  // A status-inferring reducer would emit `warning` here; the stamped reducer
  // emits the info severity (undefined 2nd arg) -- status did not bump it.
  assert.equal(unavailableArgs.length, 1);
  // The emitted body reflects the `unavailable` row (symmetry with case (b)).
  assert.match(String(unavailableArgs[0]), /unavailable/);

  // (b) `installed` (success status) + stamped `error` -> emission is error.
  const installedButError: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        status: "added",
        plugins: [
          {
            status: "installed",
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
            severity: "error",
            needsReload: true,
          },
        ],
      },
    ],
  };
  const installedArgs = renderArgs(installedButError);
  // A status-inferring reducer would emit info (a success status); the stamped
  // reducer honors the error stamp -- status did not suppress it.
  assert.equal(installedArgs.length, 2);
  assert.equal(installedArgs[1], "error");
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

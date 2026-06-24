/**
 * tests/shared/notify-inert-fields.test.ts -- D-07 inert-field guard.
 *
 * `MessageBase.severity?` and `MessageBase.needsReload?` are universal optional
 * fields present on every plugin/marketplace row, but they are INERT: the
 * reducer (`computeSeverity` / `shouldEmitReloadHint` in shared/notify.ts)
 * derives severity and the reload-hint STRUCTURALLY from `status` / cascade
 * `kind`, and must NOT read these two fields. Wiring them in is deferred to a
 * later phase; until then, a row that carries `severity: "error"` or
 * `needsReload: true` must NOT change the emitted text OR severity.
 *
 * These tests pin that contract: an otherwise-info cascade rendered with the
 * inert fields injected produces a `ctx.ui.notify` call byte-identical (same
 * text, same severity argument) to the baseline rendered without them. If a
 * future edit makes the reducer read either field, the deep-equal assertion
 * fails -- surfacing the silent severity/trailer change the phase forbids.
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

test('D-07 INERT: row-level severity:"error" does not change emitted text or severity on an info cascade', () => {
  // Baseline: an `installed` row under an `added` marketplace -> info severity
  // (no 2nd `severity` argument), `/reload` trailer fires structurally.
  const baseline: NotificationMessage = {
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
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
  };

  // Same cascade with the inert `severity: "error"` injected on the plugin row.
  // If the reducer read it, the cascade would flip to error severity and prepend
  // a summary line -- the deep-equal below would fail.
  const withInertSeverity: NotificationMessage = {
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

  assert.deepEqual(renderArgs(withInertSeverity), renderArgs(baseline));
});

test("D-07 INERT: row-level needsReload:true does not add a reload trailer to a steady-state list", () => {
  // Baseline: a `present` inventory row on the list surface emits NO `/reload`
  // trailer (steady state, not a transition) and info severity.
  const baseline: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          { status: "present", name: "commit-commands", version: "1.0.0", dependencies: [] },
        ],
      },
    ],
  };

  // Same cascade with the inert `needsReload: true` injected. If the reducer
  // read it, a `/reload to pick up changes` trailer would appear -- failing the
  // deep-equal below.
  const withInertNeedsReload: NotificationMessage = {
    marketplaces: [
      {
        name: "demo",
        scope: "user",
        plugins: [
          {
            status: "present",
            name: "commit-commands",
            version: "1.0.0",
            dependencies: [],
            needsReload: true,
          },
        ],
      },
    ],
  };

  assert.deepEqual(renderArgs(withInertNeedsReload), renderArgs(baseline));
});

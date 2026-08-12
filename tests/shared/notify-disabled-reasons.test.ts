/**
 * tests/shared/notify-disabled-reasons.test.ts -- ENBL-16 / D-100-07 live-field
 * guard for `PluginDisabledMessage.reasons`.
 *
 * FOUR arms render the `(disabled)` row: the central `renderPluginRow` switch in
 * `shared/notify.ts`, and the three command-scoped render maps that lifted its
 * body (`list.messaging.ts`, `enable-disable.messaging.ts`,
 * `reconcile.messaging.ts`). The field is optional on the shared variant, so an
 * arm that passes `undefined` in its place type-checks, renders identical bytes
 * for every producer that stamps nothing, and silently drops the brace for any
 * producer that does not -- which is what two of the four arms did.
 *
 * These tests stamp a reason on ONE representative row per arm and assert the
 * brace reaches the wire. They are not a claim that every producer stamps a
 * reason today: the `list` and `info` producers do, the disable and reconcile
 * producers do not, and both of the latter render a bare row for their own
 * input. The claim is narrower and is the regression class itself -- no arm may
 * discard a reason its caller stamped.
 *
 * Bytes only. Severity and the reload trailer are stamped per row and are
 * asserted by `notify-inert-fields.test.ts` and
 * `notify-producer-wire-coverage.test.ts`.
 */

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { DISABLE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts";
import { LIST_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";
import { RECONCILE_APPLIED_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts";
import {
  notifyReconcileAppliedWithContext,
  notifyWithContext,
} from "../../extensions/pi-claude-marketplace/shared/notify-context.ts";
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

/** Probe reports both companion extensions loaded (no soft-dep markers fire). */
function piWithBothLoaded(): { getAllTools: () => { name?: string }[] } {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

/** The single emitted body, asserted to be the only notification. */
function soleBody(ctx: MockCtx): string {
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  return ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
}

/** The stamped disabled row every arm below renders, minus its status field. */
const DISABLED_ROW = {
  status: "disabled",
  name: "foo-plugin",
  version: "1.2.3",
  reasons: ["not in manifest"],
  severity: "info",
  needsReload: false,
} as const;

const EXPECTED_ROW = "  ◍ foo-plugin v1.2.3 (disabled) {not in manifest}";

test("ENBL-16: the CENTRAL notify arm renders a stamped reason on the disabled row", () => {
  const ctx = makeCtx();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "mp", scope: "user", plugins: [{ ...DISABLED_ROW }] }],
  };
  notify(ctx as never, piWithBothLoaded() as never, msg);
  assert.equal(soleBody(ctx), ["● mp [user]", EXPECTED_ROW].join("\n"));
});

test("ENBL-16: the LIST render map renders a stamped reason on the disabled row", () => {
  const ctx = makeCtx();
  notifyWithContext(ctx as never, piWithBothLoaded() as never, LIST_CONTEXT, [
    { name: "mp", scope: "user", plugins: [{ ...DISABLED_ROW }] },
  ]);
  assert.equal(soleBody(ctx), ["● mp [user]", EXPECTED_ROW].join("\n"));
});

// The disable command stamps no reason on its own row -- a fresh disable
// reaches the requested state and has nothing to report -- so this pins the
// THREADING, not a producer. Before the fix the arm passed `undefined` and the
// brace vanished with no compile error and no failing test.
test("ENBL-16: the DISABLE render map renders a stamped reason on the disabled row", () => {
  const ctx = makeCtx();
  notifyWithContext(ctx as never, piWithBothLoaded() as never, DISABLE_CONTEXT, [
    { name: "mp", scope: "user", plugins: [{ ...DISABLED_ROW }] },
  ]);
  assert.equal(soleBody(ctx), ["● mp [user]", EXPECTED_ROW].join("\n"));
});

// Same claim for the load-time applied cascade, which carries its own standalone
// envelope kind and therefore its own dispatch path to the same row body.
test("ENBL-16: the RECONCILE-APPLIED render map renders a stamped reason on the disabled row", () => {
  const ctx = makeCtx();
  notifyReconcileAppliedWithContext(
    ctx as never,
    piWithBothLoaded() as never,
    RECONCILE_APPLIED_CONTEXT,
    {
      kind: "reconcile-applied-cascade",
      marketplaces: [{ name: "mp", scope: "user", plugins: [{ ...DISABLED_ROW }] }],
    },
  );
  assert.ok(soleBody(ctx).includes(EXPECTED_ROW), soleBody(ctx));
});

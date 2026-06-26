/**
 * tests/shared/notify-context-dispatch-guard.test.ts -- the WR-02 runtime
 * backstop in `dispatchRow` (shared/notify-context.ts).
 *
 * The `CommandContext` render map is total over the command's `Status` set by
 * construction (a missing arm is a TS2741 compile error at the `satisfies
 * CommandContext` site, D-10), and the producers are typed to their command's
 * `Msg` (the `MarketplaceRows<Msg>` distributive type), so a missing arm is
 * unreachable in well-typed code. The runtime guard is defense-in-depth for an
 * out-of-band caller that reaches the seam with an unmapped status: rather than
 * throwing (which would BOTH drop the notification AND escape before the single
 * `ctx.ui.notify` seam), `dispatchRow` renders a conspicuous fallback row that
 * STILL flows through `ctx.ui.notify`. This test forces that illegal state and
 * asserts graceful degradation, not a throw.
 */

import assert from "node:assert/strict";
import { mock } from "node:test";
import test from "node:test";

import { INSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import { notifyWithContext } from "../../extensions/pi-claude-marketplace/shared/notify-context.ts";

function makeCtx(): { ui: { notify: ReturnType<typeof mock.fn> } } {
  return { ui: { notify: mock.fn() } };
}

function piWithBothLoaded(): { getAllTools: () => { name?: string }[] } {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

test("WR-02: dispatchRow renders a conspicuous fallback row (not a throw) when the render map has no arm for the row status", () => {
  // An empty render map under a row whose status is not mapped -- the only way
  // to reach the guard, achievable solely via the cast seam.
  const brokenContext = { Messaging: { label: "Broken command" }, render: {} };
  const ctx = makeCtx();

  // Degrades gracefully: no throw escapes the seam.
  assert.doesNotThrow(() => {
    notifyWithContext(ctx as never, piWithBothLoaded() as never, brokenContext as never, [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "installed", name: "orphan", dependencies: [] }] as never,
      },
    ]);
  });

  // The user's notification STILL flows through the single ctx.ui.notify seam,
  // carrying a self-describing diagnostic in place of the missing arm's body.
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.match(body, /internal: no render arm for "installed"/);
  // The offending plugin name is preserved on the fallback row.
  assert.match(body, /orphan/);
  // SEV-02: the fallback is an internal-drift error condition, so the envelope
  // surfaces at "error" severity (the 2nd ctx.ui.notify arg), not a quiet info.
  assert.equal(ctx.ui.notify.mock.calls[0]!.arguments[1], "error");
});

test("WR-02: a FROZEN unknown-status row still emits gracefully (no throw escapes the seam) even though the severity floor write is rejected", () => {
  // The severity-floor write targets the caller's own row object. A frozen
  // out-of-band row rejects that write in ESM strict mode; the rejection must
  // not escape before ctx.ui.notify or it reintroduces the dropped-notification
  // + uncaught-throw failure the fallback exists to prevent.
  const brokenContext = { Messaging: { label: "Broken command" }, render: {} };
  const ctx = makeCtx();
  const frozenRow = Object.freeze({ status: "installed", name: "orphan", dependencies: [] });

  assert.doesNotThrow(() => {
    notifyWithContext(ctx as never, piWithBothLoaded() as never, brokenContext as never, [
      { name: "official", scope: "user", plugins: [frozenRow] as never },
    ]);
  });

  // The diagnostic still flows through the single seam.
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.match(body, /internal: no render arm for "installed"/);
  assert.match(body, /orphan/);
});

test("OUT-04/D-04: the optional kind + cardinality threads onto the envelope and renders the plural tally", () => {
  // No production caller passes these optional args today, but the seam carries
  // them onto the `CascadeNotificationMessage`; `cardinality: "plural"` makes the
  // OUT-03 trailing tally render under the command's `<Operation>` label.
  const ctx = makeCtx();
  notifyWithContext(
    ctx as never,
    piWithBothLoaded() as never,
    INSTALL_CONTEXT as never,
    [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "p",
            dependencies: [],
            version: "1.0.0",
            severity: "info",
            needsReload: true,
          },
        ] as never,
      },
    ],
    "cascade",
    "plural",
  );

  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  // The plural tally renders the `<Operation>` label + a success count.
  assert.match(body, /Plugin install: 1 success/);
});

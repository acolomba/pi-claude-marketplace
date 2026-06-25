/**
 * tests/shared/notify-context-dispatch-guard.test.ts -- the WR-02 runtime
 * backstop in `dispatchRow` (shared/notify-context.ts).
 *
 * The `CommandContext` render map is total over the command's `Status` set by
 * construction (a missing arm is a TS2741 compile error at the `satisfies
 * CommandContext` site, D-10), so this throw is unreachable in well-typed code.
 * The runtime guard exists for the cast-driven dispatch seam (`notifyWithContext`
 * upcasts the generic context through `unknown`); this test forces an illegal
 * state -- a render map with no arm for the row's status -- and asserts the
 * guard throws a labelled error rather than calling the render arm as undefined.
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

test("WR-02: dispatchRow throws a labelled error when the render map has no arm for the row status", () => {
  // An empty render map under a row whose status is not mapped -- the only way
  // to reach the guard, achievable solely via the cast seam.
  const brokenContext = { Messaging: { label: "Broken command" }, render: {} };
  const ctx = makeCtx();

  assert.throws(() => {
    notifyWithContext(ctx as never, piWithBothLoaded() as never, brokenContext as never, [
      {
        name: "official",
        scope: "user",
        plugins: [{ status: "installed", name: "orphan", dependencies: [] }] as never,
      },
    ]);
  }, /no render arm for status "installed"/);

  // The guard fires before any emission -- no partial notify leaks out.
  assert.equal(ctx.ui.notify.mock.calls.length, 0);
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

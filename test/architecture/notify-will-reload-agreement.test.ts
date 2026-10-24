/**
 * test/architecture/notify-will-reload-agreement.test.ts -- WILL-02
 * cross-surface agreement anchor.
 *
 * WILL-02 names a SINGLE source of truth for "is this action reload-deferred?":
 * the per-command reload-hint discipline (the `/reload to pick up changes`
 * trailer, governed by D-17.1-01 / D-18-04 / D-03 / D-06). The pending
 * PLUGIN-level `will`-grammar must agree with it -- a pending plugin row
 * carries `will` exactly when its corresponding REALIZED command cascade emits
 * the reload-hint trailer.
 *
 * Since D-20 the marketplace-level `will add` / `will remove` headers name
 * changes `apply` makes, not reload-deferred ones, so WILL-02 holds for the
 * plugin-level tokens only. Their realized forms are marketplace bookkeeping
 * that loads no resource, so they never ask for a reload.
 *
 * This test pins both halves at the realized-cascade seam. For each realized
 * plugin transition whose pending preview carries a `will` token -- plugin
 * install, uninstall, enable, disable, update (D-14), and the plugin-uninstall children of a
 * marketplace remove -- the rendered cascade MUST contain the trailer. For the
 * realized marketplace-level actions -- an `(added)` cascade and a header-only
 * `(removed)` cascade with no installed plugins -- the rendered cascade MUST
 * NOT contain the trailer.
 *
 * The reload-deferral decision is the envelope's `needsReload`, which
 * `shared/notification-resolve.ts` resolves from the oracle
 * `shouldEmitReloadHint` in `shared/notification-summary.ts`. The trailer
 * literal (`RELOAD_HINT_TRAILER`) lives in `shared/notification-grammar.ts`,
 * whose text strategy appends it when `needsReload` is true, and
 * `shared/notification-dispatch.ts::notify()` owns their only public effect.
 * The assertion therefore observes the oracle through the trailer's presence
 * in the rendered output (WILL-02 leaves the seam to discretion). The file
 * inspects realized-cascade reload behavior, the anchor the pending surface
 * must agree with.
 */

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { notify } from "../../extensions/pi-claude-marketplace/shared/notification-dispatch.ts";
import { type NotificationMessage } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { runWithAllLoaded } from "../shared/notification-run-seeds.ts";

import type { NotificationContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

// The trailer literal independently mirrors `RELOAD_HINT_TRAILER` in
// shared/notification-grammar.ts, while the agreement is observed through the
// rendered substring dispatched by shared/notification-dispatch.ts (the same
// seam test/architecture/notify-grammar-invariant.test.ts uses).
const RELOAD_HINT_TRAILER = "/reload to pick up changes";

// ---------------------------------------------------------------------------
// Agreement fixtures: each realized cascade is the command-path counterpart of
// a pending `will`-token. `pendingToken` documents the pending row the realized
// cascade is the oracle for; `expectTrailer` is the WILL-02 ground truth.
// ---------------------------------------------------------------------------

interface AgreementFixture {
  readonly label: string;
  readonly pendingToken: string;
  readonly run: NotificationRun;
  readonly message: NotificationMessage;
}

// Reload-deferred realized cascades -- the surviving plugin-level `will` tokens.
// Each stamps `needsReload: true` on its realized transition row, so the
// reload-hint trailer fires (the pending row therefore correctly keeps `will`).
const RELOAD_DEFERRED_FIXTURES: readonly AgreementFixture[] = [
  {
    label: "plugin install -- realized (installed) row",
    pendingToken: "will install",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              status: "installed",
              name: "helper",
              version: "1.0.0",
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    },
  },
  {
    label: "plugin uninstall -- realized (uninstalled) row",
    pendingToken: "will uninstall",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              status: "uninstalled",
              name: "helper",
              version: "1.0.0",
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    },
  },
  {
    label: "plugin enable -- re-materialized (installed) row",
    pendingToken: "will enable",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              status: "installed",
              name: "foo-plugin",
              version: "1.2.3",
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    },
  },
  {
    label: "plugin disable -- realized fresh (disabled) transition row",
    pendingToken: "will disable",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              status: "disabled",
              name: "foo-plugin",
              version: "1.2.3",
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    },
  },
  {
    // D-14: a catalog move `apply` makes is the realized (updated) row.
    label: "catalog move -- realized (updated) row",
    pendingToken: "will update",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              status: "updated",
              name: "helper",
              from: "1.0.0",
              to: "1.1.0",
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    },
  },
  {
    label: "marketplace remove with installed plugins -- realized (uninstalled) child cascade",
    pendingToken: "will uninstall (per recorded plugin under a will-remove header)",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [
        {
          name: "old-mp",
          scope: "user",
          status: "removed",
          plugins: [
            { status: "uninstalled", name: "p1", severity: "info", needsReload: true },
            { status: "uninstalled", name: "p2", severity: "info", needsReload: true },
          ],
        },
      ],
    },
  },
  {
    // FSTAT-02 / D-66-03: a degrading install materializes the supported
    // components, so the realized (partially-installed) cascade row stamps
    // `needsReload: true` -- the pending `will partially install` row therefore
    // correctly keeps its `will` token.
    label: "plugin partial install -- realized (partially-installed) row",
    pendingToken: "will partially install",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              status: "partially-installed",
              name: "helper",
              version: "1.0.0",
              reasons: ["lsp"],
              dependencies: [],
              severity: "info",
              needsReload: true,
            },
          ],
        },
      ],
    },
  },
];

// Realized marketplace-level cascades (D-20). Their pending `will add` /
// `will remove` headers name `apply` changes, and the realized rows are
// bookkeeping that loads no resource: no row stamps `needsReload: true`, so the
// reload-hint trailer never fires.
const MARKETPLACE_BOOKKEEPING_FIXTURES: readonly AgreementFixture[] = [
  {
    label: "marketplace add -- realized (added) header, no installed plugins",
    pendingToken: "will add",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [{ name: "new-mp", scope: "user", status: "added", plugins: [] }],
    },
  },
  {
    label: "marketplace remove with no installed plugins -- realized header-only (removed)",
    pendingToken: "will remove",
    run: runWithAllLoaded(),
    message: {
      marketplaces: [{ name: "old-mp", scope: "user", status: "removed", plugins: [] }],
    },
  },
];

function render(t: TestContext, fixture: AgreementFixture): string {
  const uiNotify = t.mock.fn<(message: string, severity?: string) => void>();
  const ctx: NotificationContext = { mode: "tui", ui: { notify: uiNotify } };
  notify(ctx, fixture.run, fixture.message);
  assert.equal(
    uiNotify.mock.calls.length,
    1,
    `notify() must call ctx.ui.notify exactly once (IL-2) for: ${fixture.label}`,
  );
  const [call] = uiNotify.mock.calls;
  assert.ok(call);
  return call.arguments[0];
}

for (const fixture of RELOAD_DEFERRED_FIXTURES) {
  test(`WILL-02: a reload-deferred realized cascade emits the reload-hint trailer (pending keeps its will-token): ${fixture.label}`, (t) => {
    const emitted = render(t, fixture);
    assert.ok(
      emitted.includes(RELOAD_HINT_TRAILER),
      `${fixture.label}: the realized cascade for pending '${fixture.pendingToken}' MUST emit the reload-hint trailer (WILL-02)`,
    );
  });
}

for (const fixture of MARKETPLACE_BOOKKEEPING_FIXTURES) {
  test(`D-20: a realized marketplace-level cascade omits the reload-hint trailer: ${fixture.label}`, (t) => {
    const emitted = render(t, fixture);
    assert.ok(
      !emitted.includes(RELOAD_HINT_TRAILER),
      `${fixture.label}: the realized cascade for pending '${fixture.pendingToken}' MUST NOT emit the reload-hint trailer (D-20)`,
    );
  });
}

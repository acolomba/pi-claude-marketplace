/**
 * tests/architecture/notify-will-reload-agreement.test.ts -- WILL-02
 * cross-surface agreement anchor.
 *
 * WILL-02 names a SINGLE source of truth for "is this action reload-deferred?":
 * the per-command reload-hint discipline (the `/reload to pick up changes`
 * trailer, governed by D-17.1-01 / D-18-04 / D-03 / D-06). The pending
 * `will`-grammar must agree with it -- a pending row carries `will` exactly when
 * its corresponding REALIZED command cascade emits the reload-hint trailer.
 *
 * This test pins that agreement at the realized-cascade seam. For each realized
 * transition whose pending preview keeps a `will` token -- plugin install,
 * uninstall, enable, disable, and the marketplace-remove plugin-uninstall child
 * cascade -- the rendered cascade MUST contain the trailer. For the RETIRED
 * marketplace-level actions -- a realized `(added)` cascade and a realized
 * header-only `(removed)` cascade with no installed plugins (WILL-03) -- the
 * rendered cascade MUST NOT contain the trailer.
 *
 * The reload-deferral oracle (`shouldEmitReloadHint`) and the trailer literal
 * (`RELOAD_HINT_TRAILER`) are module-private in `shared/notify.ts`, so the
 * assertion observes the oracle through its only public effect: the trailer's
 * presence in the rendered `notify()` output (WILL-02 leaves the seam to
 * discretion). This file is green on the current (pre-retirement) tree -- it
 * inspects realized-cascade reload behavior, which already matches the oracle;
 * it is the anchor the pending-surface retirement must converge to.
 */

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ---------------------------------------------------------------------------
// Mock helpers -- mirror the catalog-uat / grammar-invariant harness.
// ---------------------------------------------------------------------------

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

interface MockTool {
  name?: string;
}

interface MockPi {
  getAllTools: () => MockTool[];
}

/** Probe reports both companion extensions loaded -- no soft-dep markers. */
function piWithBothLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}

// The trailer literal mirrors `RELOAD_HINT_TRAILER` in shared/notify.ts; that
// constant is module-private, so the agreement is observed via its rendered
// substring (the same seam tests/architecture/notify-grammar-invariant.test.ts
// uses).
const RELOAD_HINT_TRAILER = "/reload to pick up changes";

// ---------------------------------------------------------------------------
// Agreement fixtures: each realized cascade is the command-path counterpart of
// a pending `will`-token. `pendingToken` documents the pending row the realized
// cascade is the oracle for; `expectTrailer` is the WILL-02 ground truth.
// ---------------------------------------------------------------------------

interface AgreementFixture {
  readonly label: string;
  readonly pendingToken: string;
  readonly pi: MockPi;
  readonly message: NotificationMessage;
}

// Reload-deferred realized cascades -- the surviving plugin-level `will` tokens.
// Each stamps `needsReload: true` on its realized transition row, so the
// reload-hint trailer fires (the pending row therefore correctly keeps `will`).
const RELOAD_DEFERRED_FIXTURES: readonly AgreementFixture[] = [
  {
    label: "plugin install -- realized (installed) row",
    pendingToken: "will install",
    pi: piWithBothLoaded(),
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
    pi: piWithBothLoaded(),
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
    pi: piWithBothLoaded(),
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
    pi: piWithBothLoaded(),
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
    label: "marketplace remove with installed plugins -- realized (uninstalled) child cascade",
    pendingToken: "will uninstall (per recorded plugin under a bare header)",
    pi: piWithBothLoaded(),
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
    // components, so the realized (force-installed) cascade row stamps
    // `needsReload: true` -- the pending `will force install` row therefore
    // correctly keeps its `will` token.
    label: "plugin force install -- realized (force-installed) row",
    pendingToken: "will force install",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          plugins: [
            {
              status: "force-installed",
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

// Immediate realized cascades -- the RETIRED marketplace-level actions
// (WILL-03). No row stamps `needsReload: true`, so the reload-hint
// trailer never fires (the pending surface therefore drops the `will` token).
const IMMEDIATE_FIXTURES: readonly AgreementFixture[] = [
  {
    label: "marketplace add -- realized (added) header, no installed plugins",
    pendingToken: "(retired) will add",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [{ name: "new-mp", scope: "user", status: "added", plugins: [] }],
    },
  },
  {
    label: "marketplace remove with no installed plugins -- realized header-only (removed)",
    pendingToken: "(retired) will remove",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [{ name: "old-mp", scope: "user", status: "removed", plugins: [] }],
    },
  },
];

function render(fixture: AgreementFixture): string {
  const ctx = makeCtx();
  notify(ctx as never, fixture.pi as never, fixture.message);
  assert.equal(
    ctx.ui.notify.mock.calls.length,
    1,
    `notify() must call ctx.ui.notify exactly once (IL-2) for: ${fixture.label}`,
  );
  const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
  return args[0];
}

test("WILL-02: every reload-deferred realized cascade emits the reload-hint trailer (pending keeps its will-token)", () => {
  for (const fixture of RELOAD_DEFERRED_FIXTURES) {
    const emitted = render(fixture);
    assert.ok(
      emitted.includes(RELOAD_HINT_TRAILER),
      `${fixture.label}: the realized cascade for pending '${fixture.pendingToken}' MUST emit the reload-hint trailer (WILL-02)`,
    );
  }
});

test("WILL-02: every immediate marketplace action's realized cascade omits the reload-hint trailer (pending drops the will-token)", () => {
  for (const fixture of IMMEDIATE_FIXTURES) {
    const emitted = render(fixture);
    assert.ok(
      !emitted.includes(RELOAD_HINT_TRAILER),
      `${fixture.label}: the realized cascade for ${fixture.pendingToken} MUST NOT emit the reload-hint trailer (WILL-03)`,
    );
  }
});

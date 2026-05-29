// tests/shared/snm37-behavioral-smoke.test.ts
//
// Phase 25 Plan 25-01 -- SNM-37 behavioral byte-form smoke (the D-25-04
// v1.4-identity proof).
//
// WHAT THIS PROVES (D-25-04): that a `/claude:plugin list` rendered by the
// CURRENTLY-LOADED extension source emits the v1.4 catalog-conformant byte
// forms. This is STRONGER evidence of v1.4 identity than `pi --version` --
// under the `scripts/pi.sh` source-load (`-e extensions/.../index.ts`, D-25-01)
// the extension is NOT a separately-versioned installed package, so
// `pi --version` reports Pi's own version and is moot for proving the
// extension's code revision (D-25-04). The byte forms below only render if the
// new v1.4 code paths actually execute:
//   - SNM-33: read-only `list` (present/available statuses) emits NO
//     `/reload to pick up changes` trailer (`shouldEmitReloadHint` excludes
//     present/list surfaces).
//   - SNM-35: a persisted PI-7 `hash-<12hex>` version renders as the
//     git-style short SHA `v#<7hex>` (`formatHashVersionForDisplay`).
//   - SNM-36: the emitted Reason brace reads `{lsp}`, never `{lspServers}`
//     (the REASONS member rename; detection substrings may stay camelCase but
//     the emitted brace must read `lsp`).
//
// DELIVERY MECHANISM (SNM-37, D-25-01/D-25-02): the runtime delivery path is
// the existing `scripts/pi.sh --home <tmp> --cd <fixture-project>` source-load
// (sandbox home). The load-only half is covered by the existing e2e smoke
// (`tests/e2e/pi-runtime-smoke.test.ts`); this file is the behavioral half.
//
// CAPTURE BOUNDARY (D-25-09): byte forms are captured at the `ctx.ui.notify`
// call (PRE-tui / pre-markdown). The live tui/markdown layer can mutate
// leading whitespace, so post-markdown bytes are NEVER asserted here.
//
// LOCATION (RESEARCH Pitfall 3): this file lives under `tests/shared/` -- NOT
// `tests/e2e/` -- because `npm test` (and thus `npm run check` and Phase 26's
// GREEN gate) globs
// `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,shared,transaction}/**`
// and EXCLUDES `tests/e2e/**`. Placing it here keeps the v1.4-identity proof
// inside the GREEN bar.
//
// DEFERRAL RECORDED (D-25-06, not silently skipped): real `npm publish` /
// packaged-artifact (release-tarball) validation is explicitly DEFERRED.
// `scripts/pi.sh` does not exercise the `files:` tarball or a real npm install;
// SNM-37 is reproduction-enablement, not a release gate. Real publish-validation
// belongs to an actual release effort, out of v1.4.1 scope.
//
// FIXTURE (Claude's discretion within the locked minimums): pure
// `NotificationMessage` data driven straight through `notify(ctx, pi, message)`
// (RESEARCH Q1 Option 1 -- fastest, no fs install needed for byte-form
// assertions). Shapes mirror `tests/architecture/catalog-uat.test.ts`
// `single-mp-mixed` (installed/available mix + `{hooks, lsp}` reason brace) and
// `hash-version-list` (`v#2ea95f8`).

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ---------------------------------------------------------------------------
// Notify-capture seam (pre-tui). Mirrors the inline `mock.fn()` ctx in
// `tests/architecture/catalog-uat.test.ts:149-151` -- capture the exact string
// passed to `ctx.ui.notify`, before any tui/markdown rendering (D-25-09).
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

/** Probe reports both companions loaded -- no soft-dep markers fire. */
function piWithBothLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}

// ---------------------------------------------------------------------------
// Fixture: a read-only `/claude:plugin list`-surface message (every mp.status
// is undefined; every plugin status is a list-surface inventory discriminator,
// so NO `/reload` trailer fires). Locked minimums:
//   - >=1 installed plugin per marketplace (both `official` and `community`
//     carry a `present` row);
//   - a `{...}` reason-brace row (`epsilon (unavailable) {hooks, lsp}`);
//   - an installed/available mix (`present` + `available` rows);
//   - >=1 hash-versioned plugin (`hashed-plugin` at `hash-2ea95f85703d`).
// ---------------------------------------------------------------------------

const LIST_MESSAGE: NotificationMessage = {
  marketplaces: [
    {
      name: "official",
      scope: "user",
      details: { autoupdate: true },
      plugins: [
        // Installed, SemVer -> `v1.0.0`.
        { status: "present", name: "alpha", version: "1.0.0", dependencies: [] },
        // Installed, PI-7 hash -> renders `v#2ea95f8` (SNM-35).
        {
          status: "present",
          name: "hashed-plugin",
          version: "hash-2ea95f85703d",
          dependencies: [],
        },
        // Uninstallable, two-reason brace -> `{hooks, lsp}` (SNM-36).
        { status: "unavailable", name: "epsilon", reasons: ["hooks", "lsp"] },
        // Available (installed/available mix).
        { status: "available", name: "gamma", version: "2.0.0" },
      ],
    },
    {
      name: "community",
      scope: "project",
      plugins: [
        // >=1 installed plugin in the second marketplace too.
        { status: "present", name: "tool", version: "0.5.0", dependencies: [] },
      ],
    },
  ],
};

test("SNM-37 behavioral smoke :: list renders v1.4 byte forms at the pre-tui notify boundary", () => {
  const ctx = makeCtx();

  notify(ctx as never, piWithBothLoaded() as never, LIST_MESSAGE);

  // Exactly one pre-tui emission per invocation.
  assert.equal(ctx.ui.notify.mock.calls.length, 1, "notify() must call ctx.ui.notify exactly once");

  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
  const body = callArgs[0];

  // SNM-33: a read-only `list` (present/available statuses) carries NO
  // `/reload to pick up changes` trailer.
  assert.doesNotMatch(
    body,
    /\/reload to pick up changes/,
    "read-only list must not emit the /reload trailer (SNM-33)",
  );

  // SNM-35: the persisted PI-7 hash renders as the git-style short SHA
  // `v#<7hex>` (e.g. `hash-2ea95f85703d` -> `v#2ea95f8`).
  assert.match(body, /v#[0-9a-f]{7}\b/, "hash-versioned plugin must render as v#<7hex> (SNM-35)");

  // SNM-36: the emitted Reason brace reads `{lsp}`; the camelCase
  // `lspServers` token must never appear in the rendered bytes.
  assert.match(body, /\{[^}]*\blsp\b[^}]*\}/, "reason brace must contain lsp (SNM-36)");
  assert.doesNotMatch(body, /lspServers/, "rendered bytes must never contain lspServers (SNM-36)");

  // Severity: a read-only list with no failed/skipped rows is info severity
  // (no 2nd arg). Confirms the capture is the info-path emission.
  assert.equal(callArgs.length, 1, "read-only list emits info severity (no 2nd notify arg)");
});

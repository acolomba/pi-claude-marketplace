// tests/shared/snm38-indent-ladder.test.ts
//
// Phase 25 Plan 25-02 -- SNM-38 (G-MIL-03 indent ladder) explicit
// leading-whitespace readability assertion.
//
// VERDICT RECORDED HERE (D-25-09, REFUTE): the renderer emits the
// catalog-conformant indent ladder at the `ctx.ui.notify` boundary --
// marketplace header at column 0, plugin rows two spaces beneath, per-plugin
// cause-chain trailer at four spaces (D-16-04 / D-16-08). The byte capture run
// during plan 25-02 Task 1 recorded, for a representative `/claude:plugin list`
// exercising an installed/available mix + a `{...}` reason brace + a
// failed/cause row:
//
//   indents = [0, 2, 2, 2, 2, 4, 0, 0, 2]
//     0  ● official [user] <autoupdate>        (marketplace header, column 0)
//     2    ● alpha v1.0.0 (installed)          (plugin row, 2-space)
//     2    ⊘ epsilon (unavailable) {hooks, lsp} (plugin row, {...} brace)
//     2    ○ gamma v2.0.0 (available)          (plugin row, 2-space)
//     2    ⊘ zeta (failed) {permission denied} (plugin row, 2-space)
//     4      cause: disk write blocked         (cause trailer, 4-space)
//     0    (blank line between marketplace blocks)
//     0  ● community [project]                 (marketplace header, column 0)
//     2    ● tool v0.5.0 (installed)           (plugin row, 2-space)
//
// The user's observed "1-space header / 3-space plugin" (UAT G-MIL-03) is a
// markdown/tui DISPLAY-LAYER artifact -- the live pi-tui markdown renderer can
// add a single leading space -- NOT a renderer deviation. The byte-exact
// contract is asserted PRE-tui, before that display layer, which is the only
// layer this verdict is binding for.
//
// CAPTURE BOUNDARY (D-25-09): leading whitespace is computed on the body
// captured at `ctx.ui.notify` (pre-tui / pre-markdown). Post-markdown bytes are
// NEVER asserted -- that is exactly the layer that introduces the false 1/3
// appearance.
//
// AUTHORITATIVE BYTE SOURCE (RESEARCH Pitfall 1): the expected indents are
// anchored on the `notify.ts` renderer constants -- header prefix `""`
// (`composeMarketplaceBlock`), plugin row prefix `"  "` (`composePluginLines`),
// cause trailer `"    "` (`renderIndentedCauseChain`) -- and the catalog
// "Indentation discipline" prose ("Marketplace header at column 0; Plugin rows
// at 2-space indent"). They are NOT anchored on the UAT G-MIL-03 `truth:` line,
// which MISQUOTES the contract as "header 2-space / row 4-space". A "fix"
// pushing the header to 2 spaces would BREAK `tests/architecture/catalog-uat.test.ts`
// (the catalog shows column 0) -- that breakage is the wrong-truth tripwire.
//
// RELATIONSHIP TO THE STANDING GATE: the byte-exact ladder is already locked by
// `tests/architecture/catalog-uat.test.ts` (byte-equality between `notify()`
// and `docs/output-catalog.md` for `single-mp-mixed`, `project-orphan-folded`,
// etc.). This file is a cheap, explicit READABILITY assertion on top of that
// gate -- drift insurance feeding Phase 26's GREEN gate (Claude's discretion:
// YES per D-25-09 / RESEARCH Open Question 1, RESOLVED).
//
// LOCATION (RESEARCH Pitfall 3): this file lives under `tests/shared/` -- NOT
// `tests/e2e/` -- because `npm test` (and thus `npm run check` and Phase 26's
// GREEN gate) globs
// `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,shared,transaction}/**`
// and EXCLUDES `tests/e2e/**`.

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
// Fixture: a representative read-only `/claude:plugin list`-surface message
// (every mp.status is undefined; plugin statuses are list-surface inventory
// discriminators). Exercises the locked minimums for the ladder evidence:
//   - >=1 marketplace header (column 0);
//   - an installed/available mix (`present` + `available` rows, 2-space);
//   - a `{...}` reason-brace row (`epsilon (unavailable) {hooks, lsp}`);
//   - a `failed`/`cause` row so the 4-space cause-chain trailer is exercised.
// ---------------------------------------------------------------------------

const LIST_MESSAGE: NotificationMessage = {
  marketplaces: [
    {
      name: "official",
      scope: "user",
      details: { autoupdate: true },
      plugins: [
        { status: "present", name: "alpha", version: "1.0.0", dependencies: [] },
        { status: "unavailable", name: "epsilon", reasons: ["hooks", "lsp"] },
        { status: "available", name: "gamma", version: "2.0.0" },
        {
          status: "failed",
          name: "zeta",
          reasons: ["permission denied"],
          cause: new Error("disk write blocked"),
        },
      ],
    },
    {
      name: "community",
      scope: "project",
      plugins: [{ status: "present", name: "tool", version: "0.5.0", dependencies: [] }],
    },
  ],
};

/** Capture the pre-tui body and return the per-line leading-whitespace counts. */
function captureIndents(): { body: string; lines: string[]; indents: number[] } {
  const ctx = makeCtx();
  notify(ctx as never, piWithBothLoaded() as never, LIST_MESSAGE);
  assert.equal(ctx.ui.notify.mock.calls.length, 1, "notify() must call ctx.ui.notify exactly once");
  const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
  const body = callArgs[0];
  const lines = body.split("\n");
  const indents = lines.map((l) => l.length - l.trimStart().length);
  return { body, lines, indents };
}

test("SNM-38 :: marketplace header lines are at column 0 (0 leading spaces)", () => {
  const { lines, indents } = captureIndents();
  // Marketplace headers are the status-glyph rows that are NOT plugin rows.
  // In a list surface (no marketplace prefix) they are the lines beginning at
  // column 0 with a marketplace glyph; the renderer constant is the empty
  // prefix in `composeMarketplaceBlock` (header has NO leading whitespace).
  const headerLineIndexes = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.startsWith("● ") || l.startsWith("◐ ") || l.startsWith("⊘ "))
    .map(({ i }) => i);

  assert.ok(headerLineIndexes.length >= 1, "fixture must produce at least one marketplace header");
  for (const i of headerLineIndexes) {
    assert.equal(
      indents[i],
      0,
      `marketplace header line ${i} must be at column 0 (got ${indents[i]}): ${JSON.stringify(lines[i])}`,
    );
  }
});

test("SNM-38 :: plugin rows are at 2 leading spaces (D-16-04 / D-16-08)", () => {
  const { lines, indents } = captureIndents();
  // Plugin rows are the indented status-glyph rows (2-space prefix in
  // `composePluginLines`). Identify them by their 2-space + glyph shape.
  const pluginRowIndexes = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^ {2}[●◐○⊘] /.test(l))
    .map(({ i }) => i);

  assert.ok(pluginRowIndexes.length >= 1, "fixture must produce at least one plugin row");
  for (const i of pluginRowIndexes) {
    assert.equal(
      indents[i],
      2,
      `plugin row line ${i} must be at 2-space indent (got ${indents[i]}): ${JSON.stringify(lines[i])}`,
    );
  }
});

test("SNM-38 :: per-plugin cause-chain trailer is at 4 leading spaces (D-16-08)", () => {
  const { lines, indents } = captureIndents();
  // The fixture includes a `failed` row carrying `cause` -> a 4-space
  // `cause: ...` trailer below it (renderIndentedCauseChain indent = "    ").
  const causeLineIndexes = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /^ {4}cause: /.test(l))
    .map(({ i }) => i);

  assert.ok(
    causeLineIndexes.length >= 1,
    "fixture must produce at least one cause-chain trailer (the failed/cause row)",
  );
  for (const i of causeLineIndexes) {
    assert.equal(
      indents[i],
      4,
      `cause-chain trailer line ${i} must be at 4-space indent (got ${indents[i]}): ${JSON.stringify(lines[i])}`,
    );
  }
});

test("SNM-38 :: full ladder snapshot matches the catalog 0/2(/4) ladder (D-25-09 byte evidence)", () => {
  const { indents } = captureIndents();
  // Recorded byte evidence from plan 25-02 Task 1 (REFUTE verdict). This is the
  // explicit drift lock: any renderer change that perturbs the ladder (e.g. a
  // misguided header->2-space "fix" chasing the UAT 2/4 misquote) trips here AND
  // in catalog-uat.test.ts.
  //
  // Phase 29 / UXG-07 (D-29-02): the LIST_MESSAGE fixture carries a `failed`
  // plugin row (`zeta`), so notify() computes "error" severity and PREPENDS the
  // "1 plugin operation failed." summary line + blank line. Those two leading
  // column-0 lines are the first two `0` entries below; the catalog-conformant
  // 0/2(/4) cascade ladder follows unchanged.
  assert.deepEqual(
    indents,
    [0, 0, 0, 2, 2, 2, 2, 4, 0, 0, 2],
    "pre-tui leading-whitespace ladder must be the summary line + blank + the catalog-conformant 0/2(/4) ladder",
  );
});

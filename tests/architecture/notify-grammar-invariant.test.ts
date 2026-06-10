/**
 * tests/architecture/notify-grammar-invariant.test.ts -- cross-cutting
 * notification-grammar invariant (GRAM-01 / GRAM-04 / GRAM-05).
 *
 * Every error/warning-severity `notify()` emission MUST carry a non-empty
 * summary first line that is DISTINCT from the detail block below it:
 *
 *   1. the emitted string's first line is non-empty;
 *   2. the string contains `\n\n` (the summary is its own block, GRAM-01);
 *   3. the first line is a SUMMARY, not a detail row -- it does not start with
 *      a row icon (`●`/`○`/`⊘`), does not contain `(failed)`/`(skipped)`, and
 *      matches the closed summary grammar
 *      `N (plugin|marketplace) operation(s) [and M (plugin|marketplace)
 *      operation(s)] (failed|skipped).`
 *
 * This is the structural anti-divergence gate (GRAM-04 root cause): a FUTURE
 * standalone error/warning kind that forgets the summary -- as the v1.10
 * `marketplace-not-added` / failed `plugin-info` standalone arm did -- trips
 * here. Info-severity emissions (no 2nd `ctx.ui.notify` arg) are exempt: the
 * summary semantics ("N operations failed") do not apply to read-only results.
 *
 * Driven over the SAME error/warning fixtures the catalog-uat forward walk
 * exercises -- standalone `marketplace-not-added`, failed `plugin-info`, and a
 * cascade error fixture -- so the invariant is anchored to real notify shapes.
 */

import assert from "node:assert/strict";
import test, { mock } from "node:test";

import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

// ---------------------------------------------------------------------------
// Mock helpers -- mirror the catalog-uat harness (makeCtx + piWith*Loaded).
// ---------------------------------------------------------------------------

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

interface MockTool {
  name?: string;
  sourceInfo?: { source?: string };
}

interface MockPi {
  getAllTools: () => MockTool[];
}

/** Probe reports both pi-subagents and pi-mcp-adapter loaded -- no soft-dep markers. */
function piWithBothLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}

// ---------------------------------------------------------------------------
// The summary grammar (mirrors 50-PATTERNS.md). A valid summary first line
// is exactly `N (plugin|marketplace) operation(s) [and M ...] (failed|skipped).`
// -- no leading row icon, no `(failed)`/`(skipped)` status token.
// ---------------------------------------------------------------------------

const SUMMARY_GRAMMAR =
  /^\d+ (plugin|marketplace) operations?( and \d+ (plugin|marketplace) operations?)? (failed|skipped)\.$/;

const ROW_ICONS = ["●", "○", "⊘"];

// ---------------------------------------------------------------------------
// Error/warning-producing fixtures spanning the standalone + cascade arms.
// ---------------------------------------------------------------------------

interface GrammarFixture {
  readonly label: string;
  readonly pi: MockPi;
  readonly message: NotificationMessage;
}

const FIXTURES: readonly GrammarFixture[] = [
  {
    label: "standalone marketplace-not-added (marketplace subject)",
    pi: piWithBothLoaded(),
    message: {
      kind: "marketplace-not-added",
      name: "ghost-mp",
      scope: "project",
    },
  },
  {
    label: "standalone failed plugin-info (plugin subject, multi-line body)",
    pi: piWithBothLoaded(),
    message: {
      kind: "plugin-info",
      marketplaceName: "bad-mp",
      marketplaceScope: "user",
      marketplaceDetails: { autoupdate: false },
      plugin: {
        status: "failed",
        name: "bad-mp",
        scope: "user",
        reasons: ["invalid manifest"],
        componentsResolved: false,
      },
    },
  },
  {
    label: "cascade with a failed plugin row (error severity)",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          status: "failed",
          plugins: [
            {
              status: "failed",
              name: "helper",
              version: "1.0.0",
              reasons: ["network unreachable"],
            },
          ],
        },
      ],
    },
  },
  {
    label: "cascade with an actionable skipped plugin row (warning severity)",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "official",
          scope: "user",
          status: "added",
          plugins: [
            {
              status: "skipped",
              name: "helper",
              version: "1.0.0",
              reasons: ["not in manifest"],
            },
          ],
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// DIFF-02 (Phase 53 Plan 02): subject-first row grammar for the 6 new
// pending-tense `(will *)` tokens. Each rendered row matches
// `<glyph> <name> [<scope>] (<token>)` with the status token AFTER the
// subject, never before. The status token is the load-bearing assertion --
// the row icon + name + optional bracket are exercised by the catalog-uat
// byte-equality runner.
// ---------------------------------------------------------------------------

const WILL_VARIANT_FIXTURES: readonly GrammarFixture[] = [
  {
    label: "DIFF-02 / will add marketplace header",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [{ name: "mp", scope: "user", status: "will add", plugins: [] }],
    },
  },
  {
    label: "DIFF-02 / will remove marketplace header",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [{ name: "mp", scope: "user", status: "will remove", plugins: [] }],
    },
  },
  {
    label: "DIFF-02 / will install plugin row under list-arm marketplace",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        { name: "mp", scope: "user", plugins: [{ status: "will install", name: "p" }] },
      ],
    },
  },
  {
    label: "DIFF-02 / will uninstall plugin row",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        { name: "mp", scope: "user", plugins: [{ status: "will uninstall", name: "p" }] },
      ],
    },
  },
  {
    label: "DIFF-02 / will enable plugin row (Phase 54 hand-off shape)",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        { name: "mp", scope: "user", plugins: [{ status: "will enable", name: "p" }] },
      ],
    },
  },
  {
    label: "DIFF-02 / will disable plugin row",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        { name: "mp", scope: "user", plugins: [{ status: "will disable", name: "p" }] },
      ],
    },
  },
];

// Subject-first row grammar for DIFF-02 will-* rows: glyph + name + optional
// [scope] bracket + optional `(will ...)` status token. The status token is
// optional because a list-arm (no-status) marketplace header renders the
// bare `● mp [scope]` form when its plugin children carry the will-* tokens
// -- this is the catalog's `plugin-pending-uninstall` / `enable-disable-
// transitions` shape. The load-bearing invariant is that the status token,
// when present, ALWAYS follows the subject -- never precedes it.
const WILL_TOKEN_RE =
  /^(?:[●○⊘]) [A-Za-z0-9_-]+(?: \[(?:user|project)\])?(?: \(will (?:add|remove|install|uninstall|enable|disable)\))?$/;

test("DIFF-02: every will-* row renders subject-first `<glyph> <name> [<scope>] (will ...)` with the status token AFTER the subject", () => {
  for (const fixture of WILL_VARIANT_FIXTURES) {
    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);
    assert.equal(
      ctx.ui.notify.mock.calls.length,
      1,
      `notify() must call ctx.ui.notify exactly once for: ${fixture.label}`,
    );
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    // will-* tokens are info severity -> no 2nd arg.
    assert.equal(
      args.length,
      1,
      `${fixture.label}: will-* rows route to info severity (no 2nd notify arg)`,
    );
    const emitted = args[0];
    // Every line in the rendered output must match the subject-first grammar
    // (mp header, plugin row -- both shapes match the regex since the regex
    // strips the leading 2-space plugin indent before checking).
    const lines = emitted
      .split("\n")
      .map((l) => l.replace(/^ {2}/, ""))
      .filter((l) => l.length > 0);
    for (const line of lines) {
      assert.match(
        line,
        WILL_TOKEN_RE,
        `${fixture.label}: subject-first row grammar must hold for line '${line}'`,
      );
    }

    // Reload-hint trailer MUST NOT fire on a preview cascade.
    assert.ok(
      !emitted.includes("/reload to pick up changes"),
      `${fixture.label}: will-* preview rows must NOT emit the reload-hint trailer`,
    );
  }
});

test("GRAM-01/04/05: every error/warning emission has a non-empty summary first line distinct from the detail block", () => {
  for (const fixture of FIXTURES) {
    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);

    assert.equal(
      ctx.ui.notify.mock.calls.length,
      1,
      `notify() must call ctx.ui.notify exactly once (IL-2) for: ${fixture.label}`,
    );

    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const severity = args[1];

    // Info-severity emissions (no 2nd arg) are exempt from the summary
    // invariant -- the count semantics do not apply to read-only results.
    if (severity !== "error" && severity !== "warning") {
      continue;
    }

    const emitted = args[0];
    const firstNewline = emitted.indexOf("\n");
    const firstLine = firstNewline === -1 ? emitted : emitted.slice(0, firstNewline);

    // Clause 1: the summary first line is non-empty.
    assert.ok(
      firstLine.length > 0,
      `${fixture.label}: error/warning emission must have a non-empty summary first line`,
    );

    // Clause 2: the summary is its own block (a blank line separates it from
    // the detail block) -- never the glued single line.
    assert.ok(
      emitted.includes("\n\n"),
      `${fixture.label}: summary must be separated from the detail block by a blank line (GRAM-01)`,
    );

    // Clause 3a: the summary first line is NOT a detail row.
    assert.ok(
      !ROW_ICONS.some((icon) => firstLine.startsWith(icon)),
      `${fixture.label}: summary first line must not start with a detail-row icon`,
    );
    assert.ok(
      !firstLine.includes("(failed)") && !firstLine.includes("(skipped)"),
      `${fixture.label}: summary first line must not carry a status token`,
    );

    // Clause 3b: the summary first line matches the closed summary grammar.
    assert.match(
      firstLine,
      SUMMARY_GRAMMAR,
      `${fixture.label}: summary first line must match the summary grammar`,
    );

    // The detail block below the summary must be distinct from the summary.
    const detailBlock = emitted.slice(emitted.indexOf("\n\n") + 2);
    assert.notEqual(
      detailBlock,
      firstLine,
      `${fixture.label}: the detail block must be distinct from the summary first line`,
    );
  }
});

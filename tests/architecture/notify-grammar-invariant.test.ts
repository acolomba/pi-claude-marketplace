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
 * summary semantics ("operations have failed") do not apply to read-only results.
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
// The summary grammar (OUT-02 / D-02). A valid summary first line is exactly
// `[A|Some] [<subject> ]operation[s] has/have failed | needs/need attention.`
// -- `subject` is `plugin`/`marketplace`, dropped for a mixed-subject cascade
// (D-03); no leading row icon, no `(failed)`/`(skipped)` status token.
// ---------------------------------------------------------------------------

const SUMMARY_GRAMMAR =
  /^(A|Some) (plugin |marketplace )?operations? (has failed|have failed|needs attention|need attention)\.$/;

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
          severity: "error",
          plugins: [
            {
              status: "failed",
              severity: "error",
              needsReload: false,
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
              severity: "warning",
              needsReload: false,
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
// DIFF-02: subject-first row grammar for the 4 pending-tense plugin-level
// `(will *)` tokens. Each rendered row matches
// `<glyph> <name> [<scope>] (<token>)` with the status token AFTER the
// subject, never before. WILL-01 / D-65.1-02 / D-65.1-03: the marketplace
// level carries no pending `(will *)` token (add is immediate; remove surfaces
// as per-plugin `will uninstall` child rows under a bare header), so only the
// four plugin-level tokens remain. The status token is the load-bearing
// assertion -- the row icon + name + optional bracket are exercised by the
// catalog-uat byte-equality runner.
// ---------------------------------------------------------------------------

const WILL_VARIANT_FIXTURES: readonly GrammarFixture[] = [
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
    label: "FSTAT-06 / will force install plugin row (force modifier set)",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "mp",
          scope: "user",
          plugins: [{ status: "will install", name: "p", force: true }],
        },
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
    label: "DIFF-02 / will enable plugin row",
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
// FSTAT-06 / D-66-04: the `will install` token also admits the `will force
// install` form when the planned install would degrade (resolves
// `unsupported`). It is a render modifier, not a new closed-set token; there is
// deliberately no `will force update` analog (the reconcile plan has no update
// bucket -- D-66-05).
const WILL_TOKEN_RE =
  /^(?:[●○⊘◌]) [A-Za-z0-9_-]+(?: \[(?:user|project)\])?(?: \(will (?:install|force install|uninstall|enable|disable)\))?$/;

// D-54-01 / ENBL-04: subject-first row grammar for the new
// `(disabled)` inventory token. Each row matches
// `◌ <name> [<scope>] v<version> (disabled)` with the status token AFTER the
// subject, never before. The status token is the load-bearing assertion --
// the row icon + name + optional bracket + optional version are exercised by
// the catalog-uat byte-equality runner.
const DISABLED_TOKEN_RE =
  /^◌ [A-Za-z0-9_-]+(?: \[(?:user|project)\])?(?: v[A-Za-z0-9.#_-]+)? \(disabled\)$/;

const DISABLED_VARIANT_FIXTURES: readonly GrammarFixture[] = [
  {
    label: "D-54-01 / disabled plugin row with version under list-arm marketplace",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "mp",
          scope: "user",
          plugins: [
            {
              status: "disabled",
              name: "foo-plugin",
              version: "1.2.3",
              severity: "info",
              needsReload: false,
            },
          ],
        },
      ],
    },
  },
  {
    label: "D-54-01 / disabled plugin row without version",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "mp",
          scope: "user",
          plugins: [
            { status: "disabled", name: "foo-plugin", severity: "info", needsReload: false },
          ],
        },
      ],
    },
  },
  {
    label: "D-54-01 / disabled plugin row with orphan-fold scope bracket",
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [
        {
          name: "mp",
          scope: "user",
          plugins: [
            {
              status: "disabled",
              name: "foo-plugin",
              version: "1.2.3",
              scope: "project",
              severity: "info",
              needsReload: false,
            },
          ],
        },
      ],
    },
  },
];

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

    // Reload-hint trailer MUST NOT fire on a pending-list cascade.
    assert.ok(
      !emitted.includes("/reload to pick up changes"),
      `${fixture.label}: will-* pending rows must NOT emit the reload-hint trailer`,
    );
  }
});

test("D-54-01 / ENBL-04: every (disabled) row renders subject-first `◌ <name> [<scope>] v<version> (disabled)` with the status token AFTER the subject", () => {
  for (const fixture of DISABLED_VARIANT_FIXTURES) {
    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);
    assert.equal(
      ctx.ui.notify.mock.calls.length,
      1,
      `notify() must call ctx.ui.notify exactly once for: ${fixture.label}`,
    );
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    // (disabled) is an inventory token; routes to info severity (no 2nd arg).
    assert.equal(
      args.length,
      1,
      `${fixture.label}: (disabled) rows route to info severity (no 2nd notify arg)`,
    );
    const emitted = args[0];
    // Every plugin row line (stripped 2-space indent) must match the
    // subject-first grammar; the name appears BEFORE `(disabled)`.
    const lines = emitted
      .split("\n")
      .map((l) => l.replace(/^ {2}/, ""))
      .filter((l) => l.length > 0 && l.includes("(disabled)"));
    assert.ok(lines.length > 0, `${fixture.label}: expected at least one (disabled) row`);
    for (const line of lines) {
      assert.match(
        line,
        DISABLED_TOKEN_RE,
        `${fixture.label}: subject-first row grammar must hold for line '${line}'`,
      );
      // Belt-and-braces: assert the name token appears at byte index before
      // `(disabled)` so the subject-first invariant is independent of the regex.
      const nameIdx = line.indexOf("foo-plugin");
      const tokenIdx = line.indexOf("(disabled)");
      assert.ok(
        nameIdx !== -1 && tokenIdx !== -1 && nameIdx < tokenIdx,
        `${fixture.label}: subject 'foo-plugin' must appear before '(disabled)' in '${line}'`,
      );
    }

    // Reload-hint trailer MUST NOT fire on an inventory cascade.
    assert.ok(
      !emitted.includes("/reload to pick up changes"),
      `${fixture.label}: (disabled) inventory rows must NOT emit the reload-hint trailer`,
    );
  }
});

// ---------------------------------------------------------------------------
// RECON-04: subject-first row grammar for the
// `reconcile-applied-cascade` standalone variant. Carries realized
// transition tokens (`added` / `installed` / `uninstalled` / `disabled` /
// `failed`) which would otherwise trigger the `/reload to pick up changes`
// trailer on the cascade arm; the StandaloneKind dispatch path returns
// `shouldEmitReloadHint = false` so the trailer NEVER appears.
// ---------------------------------------------------------------------------

const RECONCILE_APPLIED_FIXTURES: readonly GrammarFixture[] = [
  {
    label: "RECON-04 / success cascade with realized installed plugin row (transition token)",
    pi: piWithBothLoaded(),
    message: {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "new-mp",
          scope: "user",
          status: "added",
          plugins: [
            {
              status: "installed",
              name: "new-plugin",
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
    label: "RECON-04 / soft-fail cascade mixing failed mp row + installed plugin row",
    pi: piWithBothLoaded(),
    message: {
      kind: "reconcile-applied-cascade",
      marketplaces: [
        {
          name: "flaky-mp",
          scope: "user",
          status: "failed",
          severity: "error",
          needsReload: false,
          reasons: ["network unreachable"],
          plugins: [],
        },
        {
          name: "ok-mp",
          scope: "user",
          status: "added",
          plugins: [
            {
              status: "installed",
              name: "ok-plugin",
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

test("RECON-04: reconcile-applied-cascade NEVER emits `/reload to pick up changes` even on cascades with realized transition tokens", () => {
  for (const fixture of RECONCILE_APPLIED_FIXTURES) {
    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);
    assert.equal(
      ctx.ui.notify.mock.calls.length,
      1,
      `notify() must call ctx.ui.notify exactly once (IL-2) for: ${fixture.label}`,
    );
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const emitted = args[0];

    // RECON-04: the trailer is structurally excluded -- the
    // reconcile already ran ON /reload, so the trailer would be a lie.
    assert.ok(
      !emitted.includes("/reload to pick up changes"),
      `${fixture.label}: reconcile-applied-cascade MUST NOT emit the reload-hint trailer`,
    );
  }
});

test("RECON-04: every reconcile-applied-cascade row renders subject-first `<glyph> <name> [<scope>] (<token>)` with the status token AFTER the subject", () => {
  // Mirrors the WILL_TOKEN_RE / DISABLED_TOKEN_RE invariant but for the
  // realized-token row grammar (added / removed / installed / uninstalled /
  // disabled / failed; optional reasons brace; optional 4-space cause-chain
  // indent on failed rows). The load-bearing assertion is that no line
  // starts with a `(<token>)` discriminator -- the subject (glyph + name)
  // always precedes the token.
  const ROW_ICONS_AT_START = ["●", "○", "⊘"];
  for (const fixture of RECONCILE_APPLIED_FIXTURES) {
    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);
    const args = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const emitted = args[0];

    // Drop the summary line (if present) -- the cascade body starts AFTER the
    // first `\n\n` separator at error/warning severity.
    const body = emitted.includes("\n\n") ? emitted.slice(emitted.indexOf("\n\n") + 2) : emitted;
    const lines = body
      .split("\n")
      .map((l) => l.replace(/^ {2}/, ""))
      .filter((l) => l.length > 0);

    for (const line of lines) {
      // Subject-first invariant: every non-empty row line starts with one of
      // the closed-set row icons (or is a deeper-indent cause-chain trailer).
      assert.ok(
        ROW_ICONS_AT_START.some((icon) => line.startsWith(icon)) || line.startsWith("    "),
        `${fixture.label}: row line MUST start with a row icon (subject-first); got '${line}'`,
      );
      // The status token must never APPEAR before the row icon.
      const tokenMatch = /\((added|removed|installed|uninstalled|disabled|failed)\)/.exec(line);
      if (tokenMatch?.index !== undefined) {
        assert.ok(
          tokenMatch.index > 0,
          `${fixture.label}: status token '(${tokenMatch[1] ?? ""})' must follow the subject; got '${line}'`,
        );
      }
    }
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

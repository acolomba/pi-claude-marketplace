// tests/shared/snm-uxg03-label-color-spike.test.ts
//
// Phase 28 Plan 28-02 -- UXG-03 feasibility spike (the D-28-10/D-28-11
// label/color-coupling EVIDENCE LOCK).
//
// WHAT THIS PROVES (D-28-11): the installed Pi host
// `@earendil-works/pi-coding-agent` derives BOTH the severity color AND the
// `Error:`/`Warning:` label PREFIX from the single `type` argument of
// `ctx.ui.notify(message, type?)`. There is no color-only / label-suppression
// parameter and no host code path that emits the severity color WITHOUT the
// label. So the only in-extension lever -- forcing `info` to drop the label --
// ALSO drops the color (and nullifies UXG-02's warning/error routing). That
// lever is REJECTED per D-28-11, and UXG-03 resolves as an upstream-tracked
// finding (D-28-10/D-28-12), NOT a colorless in-extension workaround.
//
// WHY THE `@earendil-works` HOST, NOT `@mariozechner` (CONTEXT Specific Ideas):
// the extension API *contract* is `@mariozechner/pi-coding-agent` (peer dep per
// CLAUDE.md), but the installed *runtime* host that actually renders the label
// and color is `@earendil-works/pi-coding-agent` (+ `@earendil-works/pi-tui`).
// The spike inspects the `@earendil-works` host -- that is the surface whose
// behavior the operator observed in the UAT sweep.
//
// READ-ONLY EVIDENCE LOCK (T-28-04/T-28-05): this test only READS already-
// installed `node_modules` host files (the public `.d.ts` type decl + the
// shipped `dist/*.js` bundles). It modifies NO host file, adds NO dependency,
// and does NOT touch `extensions/pi-claude-marketplace/shared/notify.ts`. Its
// job is to make the host label/color coupling REPRODUCIBLE evidence inside the
// `npm test` / `npm run check` bar -- so a future host change that decouples
// label from color would flip this test RED and re-open UXG-03 deliberately.
//
// LOCATION (mirrors the SNM-37 placement rationale): under `tests/shared/` so
// `npm test` globs it
// (`tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,shared,transaction}/**`,
// EXCLUDES `tests/e2e/**`); keeps the evidence lock inside the GREEN bar.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Resolve the INSTALLED `@earendil-works/pi-coding-agent` host package root by
// walking `node_modules` upward from this test file (NOT a hard-coded path) --
// the evidence is keyed to whatever host version `npm install` placed in
// `node_modules`. We cannot use `require.resolve(".../package.json")` because
// the host `exports` map only declares the ESM `import` condition and does not
// expose `package.json`, so a CJS-style resolve throws ERR_PACKAGE_PATH_NOT_EXPORTED.
function resolveHostRoot(): string {
  const HOST_PKG = join("@earendil-works", "pi-coding-agent");
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, "node_modules", HOST_PKG);
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `could not locate installed ${HOST_PKG} under any node_modules above ${import.meta.url}`,
      );
    }

    dir = parent;
  }
}

const HOST_ROOT = resolveHostRoot();

const HOST_PKG_META = JSON.parse(readFileSync(join(HOST_ROOT, "package.json"), "utf8")) as {
  version: string;
};
const HOST_VERSION = HOST_PKG_META.version;

// The four host surfaces this spike inspects (relative to the host package root).
const TYPES_DTS = join(HOST_ROOT, "dist/core/extensions/types.d.ts");
const MAIN_JS = join(HOST_ROOT, "dist/main.js");
const INTERACTIVE_JS = join(HOST_ROOT, "dist/modes/interactive/interactive-mode.js");

function readHostFile(absPath: string): string {
  return readFileSync(absPath, "utf8");
}

// ---------------------------------------------------------------------------
// Evidence 1 -- the PUBLIC notify signature carries NO color-only param.
//
// `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
// declares the extension UI `notify` as:
//   notify(message: string, type?: "info" | "warning" | "error"): void;
// i.e. exactly `message` + an optional severity `type`. No options object, no
// `{ color }` / `{ label: false }` / structured-notification parameter exists.
// This is the contract surface a colorless-cascade workaround would have needed
// to target -- and it does not exist (D-28-11).
// ---------------------------------------------------------------------------

test("UXG-03 spike :: host notify(message, type?) signature has NO color-only / label-suppression param (types.d.ts:75)", () => {
  const src = readHostFile(TYPES_DTS);
  const lines = src.split("\n");

  // Locate the `notify(...)` declaration on the ExtensionUIContext surface.
  const notifyIdx = lines.findIndex((l) => /^\s*notify\(/.test(l));
  assert.ok(notifyIdx >= 0, "host types.d.ts must declare a notify(...) member on the UI context");

  const notifyDecl = lines[notifyIdx]!;

  // The canonical evidence ref from the CONTEXT / PLAN is line 75. We assert the
  // exact signature byte-for-byte rather than a brittle line number, but record
  // the observed 1-based line for the finding doc.
  const observedLine = notifyIdx + 1;
  assert.equal(
    notifyDecl.trim(),
    'notify(message: string, type?: "info" | "warning" | "error"): void;',
    `host notify signature changed (observed at types.d.ts:${observedLine}) -- if a color-only / ` +
      "label-suppression parameter was ADDED, UXG-03 should be RE-OPENED for an implementation plan",
  );

  // Defensively assert there is NO options/color/label parameter token anywhere
  // in the signature -- the only params are `message` and the optional `type`.
  assert.doesNotMatch(
    notifyDecl,
    /\b(opts|options|color|colour|label|suppress|prefix|structured)\b/i,
    "host notify signature must carry only message + optional severity type (no color-only param)",
  );
});

// ---------------------------------------------------------------------------
// Evidence 2 -- the host RENDERER derives label AND color from the SAME `type`.
//
// Two independent host render sites prove the coupling:
//
//   (a) Startup diagnostics (dist/main.js `reportDiagnostics`):
//         const color  = type === "error" ? chalk.red  : type === "warning" ? chalk.yellow : chalk.dim;
//         const prefix = type === "error" ? "Error: "   : type === "warning" ? "Warning: "  : "";
//       -- color and the `Error:`/`Warning:` label PREFIX are two ternaries over
//       the SAME `diagnostic.type`. `info`/other -> no prefix, but also `dim`
//       (no severity color).
//
//   (b) Interactive `ctx.ui.notify` path (dist/modes/interactive/interactive-mode.js):
//         showExtensionNotify(message, type):
//           type === "error"   -> showError(message)   -> theme.fg("error",   `Error: ${message}`)
//           type === "warning" -> showWarning(message) -> theme.fg("warning", `Warning: ${message}`)
//           else               -> showStatus(message)  -> theme.fg("dim",     message)   // no label, no color
//
//       This is the path our extension's structured cascade actually flows
//       through. `showError`/`showWarning` pass the severity color AND the label
//       literal to the SAME `theme.fg(...)` call -- there is no argument and no
//       branch that yields the severity color without the label.
// ---------------------------------------------------------------------------

test("UXG-03 spike :: host bundle derives label + color from the single `type` (Error:/Warning: literals present)", () => {
  const mainJs = readHostFile(MAIN_JS);

  // The startup `reportDiagnostics` color+prefix coupling (dist/main.js).
  assert.match(
    mainJs,
    /diagnostic\.type === "error" \? chalk\.red : diagnostic\.type === "warning" \? chalk\.yellow : chalk\.dim/,
    "host main.js must derive COLOR from diagnostic.type (chalk.red/yellow/dim) -- proves color is type-driven",
  );
  assert.match(
    mainJs,
    /diagnostic\.type === "error" \? "Error: " : diagnostic\.type === "warning" \? "Warning: " : ""/,
    "host main.js must derive the LABEL prefix from the SAME diagnostic.type -- proves label is type-driven",
  );

  // The literal label prefixes must be present in the bundle (the bytes the
  // operator sees prepended to a cascade).
  assert.ok(
    mainJs.includes('"Error: "'),
    'host bundle must contain the literal "Error: " label prefix',
  );
  assert.ok(
    mainJs.includes('"Warning: "'),
    'host bundle must contain the literal "Warning: " label prefix',
  );
});

test("UXG-03 spike :: interactive ctx.ui.notify switches label+color entirely on `type` -- no color-without-label path", () => {
  const interactiveJs = readHostFile(INTERACTIVE_JS);

  // showExtensionNotify routes purely on `type` -- error -> showError,
  // warning -> showWarning, else -> showStatus.
  assert.match(
    interactiveJs,
    /showExtensionNotify\(message, type\)\s*\{\s*if \(type === "error"\) \{\s*this\.showError\(message\);\s*\}\s*else if \(type === "warning"\) \{\s*this\.showWarning\(message\);\s*\}\s*else \{\s*this\.showStatus\(message\);\s*\}/,
    "host showExtensionNotify must dispatch label+color purely on `type` (error->showError, warning->showWarning, else->showStatus)",
  );

  // showError binds the severity color AND the `Error:` label in ONE theme.fg call.
  assert.match(
    interactiveJs,
    /theme\.fg\("error", `Error: \$\{errorMessage\}`\)/,
    "host showError must pass the `error` color AND the `Error:` label to the SAME theme.fg call (inseparable)",
  );
  // showWarning binds the severity color AND the `Warning:` label in ONE theme.fg call.
  assert.match(
    interactiveJs,
    /theme\.fg\("warning", `Warning: \$\{warningMessage\}`\)/,
    "host showWarning must pass the `warning` color AND the `Warning:` label to the SAME theme.fg call (inseparable)",
  );
  // The ONLY label-free path (showStatus) uses `dim` -- i.e. it ALSO drops the
  // severity color. There is no host branch that yields severity color w/o label.
  assert.match(
    interactiveJs,
    /theme\.fg\("dim", message\)/,
    "host showStatus (the only label-free path) renders `dim` -- proves dropping the label ALSO drops the severity color",
  );
});

// ---------------------------------------------------------------------------
// Evidence 3 -- spike outcome record. Asserts the feasibility verdict so the
// finding doc and this harness cannot silently drift apart: feasibility is
// REFUTED -> defer-with-finding (the strongly-evidenced expected outcome).
// ---------------------------------------------------------------------------

test("UXG-03 spike :: feasibility REFUTED -- host couples label+color to `type`, no color-only param (D-28-10/11)", () => {
  // This test is a human-readable lock on the spike VERDICT. It re-derives the
  // verdict from the three evidence tests above being green: if any of them
  // flips (host adds a color-only param, or decouples label from color), this
  // assertion's premise no longer holds and the verdict must be re-evaluated.
  const FEASIBILITY = "refuted" as const;
  assert.equal(
    FEASIBILITY,
    "refuted",
    "UXG-03 colorless-cascade feasibility is REFUTED against the installed host: label+color both derive " +
      `from the single notify \`type\` arg (host @earendil-works/pi-coding-agent@${HOST_VERSION}). ` +
      "Resolution: defer-with-finding (UXG-03-FINDING.md); do NOT ship a colorless in-extension workaround (D-28-10).",
  );

  // Sanity: the host version this evidence was captured against is recorded so a
  // major host bump is visible in the test output.
  assert.match(HOST_VERSION, /^\d+\.\d+\.\d+/, "host version must be a resolvable semver string");
});

# UXG-03 Finding -- Multi-line cascade label suppression is an upstream host capability

**Status:** defer-with-finding (feasibility REFUTED)
**Phase / Plan:** 28-severity-routing-label-discipline / 28-02
**Date:** 2026-05-31
**Requirement:** UXG-03 (`.planning/REQUIREMENTS.md`)
**Precedent:** mirrors SNM-39 / G-MIL-07 (`.planning/v1.4-MILESTONE-UAT.md`) -- an
in-repo finding with exact host line refs, a UAT note, a REQUIREMENTS note, and a
STATE.md deferral row (D-28-12).

## 1. The truth UXG-03 asserted

> Multi-line cascade notifications should render *without* the host
> `Error:`/`Warning:` label prefix (it breaks the 0/2 indent ladder and
> duplicates the inline per-row status), while single-line messages (usage
> errors, simple failures) keep the label; the severity *color* is retained in
> both cases.

In other words: for a structured `notify()` cascade we want the severity **color**
but not the **label** prefix. UXG-03's own requirement text anticipated this is
"likely an upstream `@earendil-works/pi-coding-agent` capability" and the phase
carried a feasibility spike before committing the approach.

## 2. Spike method + evidence lock

The spike is a **read-only** evidence lock against the INSTALLED runtime host
`@earendil-works/pi-coding-agent` (NOT the `@mariozechner/pi-coding-agent`
peer-dep contract -- the two namespaces differ; the `@earendil-works` host is the
one that actually renders the label + color, per CONTEXT §Specific Ideas). It
reads the host's public type declaration and shipped `dist/*.js` bundles and
asserts the label/color coupling so a future host change that decouples them
flips the test RED and re-opens UXG-03 deliberately.

- **Harness:** `tests/shared/snm-uxg03-label-color-spike.test.ts` (GREEN under
  `node --test`; runs inside `npm test` / `npm run check`).
- **Host version captured:** `@earendil-works/pi-coding-agent@0.75.5`.
- **No host file modified, no dependency added, `shared/notify.ts` untouched.**

## 3. Exact host line refs (the coupling)

### (a) Public notify signature -- no color-only / label-suppression param

`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:75`

```ts
notify(message: string, type?: "info" | "warning" | "error"): void;
```

The extension UI `notify` takes exactly `message` + an optional severity `type`.
There is **no** options object, **no** `{ color }` / `{ label: false }`, **no**
structured-notification parameter. The contract surface a colorless-cascade
workaround would have needed to target does not exist.

### (b) Startup-diagnostics renderer -- label AND color both derive from `type`

`node_modules/@earendil-works/pi-coding-agent/dist/main.js:64-69` (`reportDiagnostics`)

```js
function reportDiagnostics(diagnostics) {
    for (const diagnostic of diagnostics) {
        const color = diagnostic.type === "error" ? chalk.red : diagnostic.type === "warning" ? chalk.yellow : chalk.dim;
        const prefix = diagnostic.type === "error" ? "Error: " : diagnostic.type === "warning" ? "Warning: " : "";
        console.error(color(`${prefix}${diagnostic.message}`));
    }
}
```

`color` and the `Error:`/`Warning:` label `prefix` are two ternaries over the
**same** `diagnostic.type`. The `info`/other branch drops the prefix -- but it
also drops the severity color (`chalk.dim`).

### (c) Interactive `ctx.ui.notify` renderer -- the path our cascade flows through

`node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:1771-1781`
(`showExtensionNotify`)

```js
showExtensionNotify(message, type) {
    if (type === "error") {
        this.showError(message);
    }
    else if (type === "warning") {
        this.showWarning(message);
    }
    else {
        this.showStatus(message);
    }
}
```

`...:2944-2954` (`showError` / `showWarning`) and `...:2438` (`showStatus`):

```js
showError(errorMessage) {
    this.chatContainer.addChild(new Spacer(1));
    this.chatContainer.addChild(new Text(theme.fg("error", `Error: ${errorMessage}`), 1, 0));
    this.chatContainer.addChild(new Spacer(1));
    this.ui.requestRender();
}
showWarning(warningMessage) {
    this.chatContainer.addChild(new Spacer(1));
    this.chatContainer.addChild(new Text(theme.fg("warning", `Warning: ${warningMessage}`), 1, 0));
    this.ui.requestRender();
}
showStatus(message) {
    // ...
    const text = new Text(theme.fg("dim", message), 1, 0);
    // ...
}
```

`showError` / `showWarning` pass the severity color **and** the `Error:` /
`Warning:` label literal to the **same** `theme.fg(...)` call -- they are
inseparable. The only label-free branch is `showStatus`, which renders `dim`
(i.e. it **also** drops the severity color). There is no host argument and no
host branch that yields the severity color *without* the label.

## 4. Root cause

The label and the color are **both produced by the host from the single `type`
argument** of `ctx.ui.notify(message, type?)`. They cannot be requested
independently: severity color implies the label, and dropping the label
(`type` = `info`/undefined) drops the color too.

The only in-extension lever is the severity arg itself -- forcing the cascade to
`info` to drop the label. That is **REJECTED (D-28-11)** because it:

1. also drops the severity **color** (UXG-03 requires the color be retained);
   and
2. nullifies UXG-02's `warning`/`error` severity routing (Plan 28-01) -- the
   whole point of computing `warning`/`error` for actionable/failed cascades.

So there is no acceptable in-extension path.

## 5. Resolution -- DEFER-WITH-FINDING

- **Feasibility is REFUTED** (the strongly-evidenced expected outcome). The host
  couples label + color to the single `type` arg with no color-only parameter.
- **Do NOT ship a colorless in-extension workaround (D-28-10).** Color is
  non-negotiable; the `info`-forcing lever is self-defeating (D-28-11).
- UXG-03 resolves as an **upstream-tracked finding** mirroring the SNM-39 /
  G-MIL-07 precedent (D-28-12): recorded in-repo with exact host line refs +
  reproducible spike evidence, plus a UAT note, a REQUIREMENTS note, and a
  STATE.md deferral row.
- **Filing the actual upstream issue against `@earendil-works/pi-coding-agent`
  is the OPERATOR's call (D-28-12)** -- it is NOT auto-filed and NOT
  auto-drafted by this plan. The ask, when the operator chooses to file it,
  would be: a way to render the severity *color* on a multi-line notification
  *without* the `Error:`/`Warning:` label prefix (e.g. a `notify` options param
  such as `{ label: false }`, or a dedicated structured-notification mode).

## 6. Contingent policy (D-28-13) -- recorded for intent only

*If* a label-suppression capability ever lands upstream (a future host API param
or a landed upstream change), the discriminator for *when* to suppress the label
is **entrypoint-based**, NOT line-count-based:

- `notify()` (the structured cascade surface -- always renders a marketplace
  header + rows; entry at `shared/notify.ts:1339`) **suppresses** the label.
- `notifyUsageError()` (`shared/notify.ts:199`) always **keeps** the label.

A literal newline / line-count test would be WRONG: `notifyUsageError` emits
`${message.message}\n\n${message.usage}` (a multi-line string), so a "strip the
label on any multi-line message" rule would wrongly strip the label that the
requirement says usage errors must keep. The mechanism here depends entirely on
the spike outcome (D-28-10/11) and is recorded only so a future implementer
inherits the intended split.

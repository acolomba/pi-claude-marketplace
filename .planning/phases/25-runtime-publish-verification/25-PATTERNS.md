# Phase 25: Runtime Publish & Verification - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 3 genuinely-new test files (1 required, 2 optional/discretionary) + 1 conditional renderer fix (expected NOT to land) + 2 doc/process amendments
**Analogs found:** 3 / 3 (every new file has an in-repo analog; no green-field files)

> **Phase shape note (read first).** This is an **operational + investigation**
> phase. RESEARCH.md's verdicts are: SNM-38 **REFUTE** (renderer is already
> catalog-conformant), SNM-39 **DEFER-WITH-FINDING** (root cause is
> `@earendil-works/pi-tui`-external, not our code). So the deliverables are
> *recorded evidence + verdicts*, not feature code. The only genuinely-new
> source artifacts are TEST files that reuse existing harness seams, plus
> requirement-text amendments. There is **no new product code expected to
> land**; the SNM-38 renderer fix is mapped as a *conditional* analog only in
> case the byte evidence (improbably) shows a real off-by-one. Do not invent
> files to pad the plan.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/shared/snm37-behavioral-smoke.test.ts` (NEW, required) | test | request-response (notify capture) | `tests/architecture/catalog-uat.test.ts` + `tests/e2e/_helpers.ts` (`makeMockPi`/`makeCtx`) | exact (role + flow) |
| `tests/shared/snm38-indent-ladder.test.ts` (NEW, optional -- Claude's discretion) | test | transform (byte / leading-whitespace assertion) | `tests/architecture/catalog-uat.test.ts` | exact |
| `tests/edge/completions/provider.test.ts` (MODIFY, optional regression comment/doc) | test | request-response (completion) | itself, `:793-814` (`TC-6 :: update accepts bare @<marketplace>`) | exact (self) |
| `extensions/pi-claude-marketplace/shared/notify.ts` (MODIFY -- **conditional, expected NOT to land**) | renderer | transform | `composePluginLines`/`composeMarketplaceBlock` (self, `:1230`/`:1254`) | exact (self) |
| `.planning/REQUIREMENTS.md` §SNM-37, `.planning/ROADMAP.md` SC#1 (MODIFY -- lockstep amendment) | doc | -- | Phase 23 (D-23-01) / Phase 24 (D-24-03) amendment precedent | process-pattern (not a code analog) |
| `.planning/v1.4-MILESTONE-UAT.md` / `.planning/STATE.md` (MODIFY -- recorded verdicts) | doc | -- | Phase 23/24 finding-recording precedent | process-pattern |

**No new orchestrator, domain, persistence, edge, or bridge source files.** SNM-37
delivery uses the existing `scripts/pi.sh` verbatim (D-25-01); no script change is
needed.

## Pattern Assignments

### `tests/shared/snm37-behavioral-smoke.test.ts` (test, notify-capture) -- REQUIRED, Wave 0

**Why `tests/shared/`, not `tests/e2e/`:** `npm test` globs
`tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,shared,transaction}/**/*.test.ts`
-- `tests/e2e/**` is EXCLUDED (it runs only under `npm run test:e2e`). Any test
that must gate the Phase-26 GREEN bar (`npm run check`) MUST live in an included
dir. `tests/shared/` is the correct home (RESEARCH Pitfall 3, verified against
`package.json:76`).

**Primary analog (the notify-capture seam):** `tests/e2e/_helpers.ts`
`makeMockPi` (`:55-81`) + `makeCtx` (`:83-98`). These give a Pi-API mock whose
`ctx.ui.notify` pushes each `(message, severity?)` into a captured
`notifications[]` array -- the exact pre-tui byte string. Reuse these (export-and-import
or inline a trimmed copy; the catalog-uat test inlines its own `makeCtx` per
RESEARCH Q1 Option 1, so either is precedented).

**Capture-seam excerpt** (`tests/e2e/_helpers.ts:83-98`):
```typescript
export function makeCtx(cwd: string): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd,
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
      addAutocompleteProvider: (): void => {},
    },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}
```

**Driving the `list` handler** (mirror `tests/e2e/_helpers.ts:151-167`
`installTargetWithMockPi`, but assert byte forms instead of state):
```typescript
const mock = makeMockPi(tools);
const { ctx, notifications } = makeCtx(env.cwd);
claudeMarketplaceExtension(mock.pi);          // index.ts default export
const command = mock.commands.get("claude:plugin");
await command!.handler("list", ctx);
const body = notifications.at(-1)!.message;   // the pre-tui bytes
```

**Behavioral-smoke assertions (the D-25-04 v1.4 byte-form proof)** -- the binding
signal, not `pi --version`:
```typescript
assert.doesNotMatch(body, /\/reload to pick up changes/);  // no trailer on read-only list (SNM/list = present)
assert.match(body, /v#[0-9a-f]{7}\b/);                      // v#<7hex> hash display (SNM-35)
assert.doesNotMatch(body, /lspServers/);                    // {lsp} not {lspServers} (SNM-36)
```

**Fixture shape (Claude's discretion, locked minimums):** at least one installed
plugin per marketplace, a row exercising the `{...}` reason brace, and an
installed/available mix. The `catalog-uat.test.ts` `FIXTURES["/claude:plugin list"]`
entries are the ready-made shapes:
- `hash-version-list` (`catalog-uat.test.ts:421-439`) -- gives `v#2ea95f8` for the `v#<7hex>` assertion.
- `single-mp-mixed` (`:226-253`) -- installed/available mix + `{hooks, lsp}` reason brace.

Two construction paths (both precedented):
1. **Pure `NotificationMessage` data** (like catalog-uat) → fastest, no fs. Build
   the message inline and call `notify(ctx, pi, message)` directly. Best for the
   automated SNM-37 smoke since byte forms are all that matter.
2. **Real install path** via `installTargetWithMockPi` (`_helpers.ts:141-168`) →
   produces a real `state.json`; needed only if the SNM-39 live precondition
   reuses the same fixture builder.

---

### `tests/shared/snm38-indent-ladder.test.ts` (test, byte/whitespace transform) -- OPTIONAL, Claude's discretion

**Verdict context:** SNM-38 is expected to **REFUTE**. The renderer already emits
the catalog-conformant ladder (header column 0, plugin row 2-space, cause 4-space,
phase-cause 6-space), and this is ALREADY locked by `catalog-uat.test.ts`. RESEARCH
recommends *citing* the existing lock and adding at most one explicit readability
assertion. Do NOT add a "fix" -- a header→2-space change would BREAK the catalog-uat
byte-equality gate (Pitfall 1 warning sign).

**Analog:** `tests/architecture/catalog-uat.test.ts` (the standing byte-equality
regression). If a fresh test is added, mirror its drive-`notify()`-and-assert
shape; otherwise cite this test as the existing ladder lock.

**Mock-ctx (`mock.fn`) variant** used by catalog-uat (`:149-151`) -- note this is a
*different* ctx shape than `_helpers.ts` `makeCtx`; it uses `node:test`'s
`mock.fn()` to capture call arguments:
```typescript
function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}
// ...
notify(ctx as never, fixture.pi as never, fixture.message);
const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
const actual = callArgs[0];
assert.equal(actual, example.expected);   // byte equality
```

**Explicit leading-whitespace assertion** (the optional readability add -- anchor on
the renderer's true 0/2 ladder, NOT the UAT's misquoted "2/4"):
```typescript
const body = callArgs[0];
const indents = body.split("\n").map((l) => l.length - l.trimStart().length);
// header lines -> 0, plugin rows -> 2 (catalog-conformant; D-16-04 / D-16-08)
```

**Authoritative byte source** (do NOT trust the UAT "truth" line): the renderer
constants in `notify.ts` -- header prefix `""` (`composeMarketplaceBlock:1259`),
plugin row prefix `"  "` (`composePluginLines:1235`), cause trailer `"    "`
(`:1238`), phase-cause `"      "` (`composeRollbackPartialLines:1215`).

---

### `tests/edge/completions/provider.test.ts` (test, completion) -- MODIFY, optional finding comment

**Verdict context:** SNM-39 is expected to **DEFER-WITH-FINDING**. The cause is
pi-tui-external `@`-precedence. Our provider is already correct and already
tested. The only honest regression is the *existing* test below; the recommended
addition is a *comment / finding doc* pointing at the pi-tui line numbers, NOT a
test that contorts our code to fight the host (D-25-10, RESEARCH Anti-Pattern).

**Self-analog -- the passing test that proves our side is correct**
(`tests/edge/completions/provider.test.ts:793-814`):
```typescript
test("TC-6 :: update accepts bare @<marketplace> form", async () => {
  __resetCacheForTests();
  const f = await makeFixture({
    state: { user: { "mp-a": {}, "mp-b": {} }, project: {} },
    manifests: {
      user: {
        "mp-a": [{ name: "p", status: "installed" }],
        "mp-b": [{ name: "p", status: "installed" }],
      },
      project: {},
    },
  });
  try {
    const items = await getArgumentCompletions("update @", f.resolver);
    assert.ok(items !== null);
    const labels = items.map((i) => i.label);
    assert.deepEqual([...labels].sort(), ["@mp-a", "@mp-b"]);  // GREEN -- our provider is correct
  } finally {
    await f.cleanup();
  }
});
```

**Fixture-builder analog** (if a new completion test is wanted): the in-file
`makeFixture` (`provider.test.ts:36-87`) builds a mock `LocationsResolver` from
pure `{ state, manifests }` data -- no fs install needed for the provider path
(`__resetCacheForTests()` from `shared/completion-cache.ts` clears the 10-min
plugin-index TTL between cases; call it first to avoid stale-read false refutes,
RESEARCH Security/Threat row).

---

### `extensions/pi-claude-marketplace/shared/notify.ts` (renderer) -- CONDITIONAL, expected NOT to land

**Only touch this if the byte evidence (improbably) shows a real non-0/2 ladder.**
RESEARCH's verdict is REFUTE; the catalog-uat gate already proves the renderer is
correct. Mapped here solely so the planner has the chokepoints if the evidence
flips.

**Self-analog -- the two render chokepoints** (`shared/notify.ts`, verified line
numbers from RESEARCH drift table):
```typescript
// composeMarketplaceBlock (:1254) -- header at column 0 (no prefix):
const lines: string[] = [renderMpHeader(mp, probe)];          // 0 leading spaces
for (const p of mp.plugins) {
  lines.push(...composePluginLines(p, probe, mp.scope));
}

// composePluginLines (:1230) -- plugin row prefixed with 2 spaces (D-16-04):
const lines: string[] = [`  ${renderPluginRow(p, probe, mpScope)}`];   // 2 spaces
if (p.status === "failed" || p.status === "manual recovery") {
  const trailer = renderIndentedCauseChain(p.cause, "    ");           // 4 spaces (cause)
}

// composeRollbackPartialLines (:1207) -- phase rows 4-space, phase cause 6-space:
lines.push(`    [${phase.phase}] (rollback failed)`);                  // 4 spaces
const phaseTrailer = renderIndentedCauseChain(phase.cause, "      ");  // 6 spaces
```

`renderPluginRow` itself is at `:921` (the `:887` citation in CONTEXT is a doc
comment -- use `:921`). Any fix MUST ship with the catalog (`docs/output-catalog.md`)
+ fixtures updated in the same commit so `catalog-uat.test.ts` stays byte-equal
(v1.4.1 cross-cutting GREEN constraint).

## Shared Patterns

### Notify-boundary byte capture (the automated seam for SNM-37 + SNM-38)
**Source:** `tests/e2e/_helpers.ts` (`makeMockPi:55`, `makeCtx:83`) and the inline
`mock.fn()` ctx in `tests/architecture/catalog-uat.test.ts:149`.
**Apply to:** Both new `tests/shared/` test files. Capture at `ctx.ui.notify`
(pre-tui) -- never assert on post-markdown bytes (the markdown layer is exactly
what introduces the false 1/3 appearance, RESEARCH Anti-Pattern + D-25-09).
```typescript
// pre-tui capture; the binding evidence for every byte assertion
notify(ctx, pi, message);
const body = ctx.ui.notify.mock.calls[0]!.arguments[0];   // or notifications.at(-1).message
```

### Catalog byte-equality as the standing regression
**Source:** `tests/architecture/catalog-uat.test.ts` (the full driver `:1381-1494`).
**Apply to:** SNM-38 -- this IS the ladder lock. It walks every
`<!-- catalog-state: STATE -->` block in `docs/output-catalog.md`, pairs it with a
`NotificationMessage` fixture, and asserts byte-equality with `notify()`. The
`single-mp-mixed` / `project-orphan-folded` / `hash-version-list` states already
encode the 0/2 ladder AND the `v#<7hex>` form. Cite it; add a fresh test only for
readability.

### Requirement-text amendment in lockstep (process, not a code analog)
**Source:** Phase 23 (`.planning/phases/23-version-display-bundle/23-CONTEXT.md`
D-23-01) + Phase 24 (`.planning/phases/24-grammar-consistency/24-CONTEXT.md`
D-24-03).
**Apply to:** `.planning/REQUIREMENTS.md` §SNM-37 ("published to npm or npm-linked"
→ "loaded from source via `scripts/pi.sh` (sandbox home)") and `.planning/ROADMAP.md`
SC#1 (`pi --version` half → behavioral byte-form smoke), per D-25-03 / D-25-04.
Amend in the SAME commit as the phase work. This is a doc/process precedent, not a
file-pattern to copy code from.

### Source-load delivery (SNM-37) -- no new file
**Source:** `scripts/pi.sh` (read in full). It already source-loads the extension
(`-e .../index.ts`), bootstraps both companions (`ensure_global_package` →
`pi-mcp-adapter`, `pi-subagents`), and maps `--home <PATH>` to
`PI_CODING_AGENT_DIR`/`PI_CODING_AGENT_SESSION_DIR` (`:97-101`), then `exec pi`
(bare → GLOBAL pi 0.76.0, Pitfall 4). **Use verbatim** (D-25-01). The interactive
session is needed ONLY for the SNM-39 live keystroke (D-25-08); the SNM-37
behavioral smoke runs fully in-process via the harness above (no `pi` process).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| -- | -- | -- | None. Every genuinely-new artifact (the two `tests/shared/` tests, the provider regression comment) has an exact in-repo analog. There is no green-field code in this phase. |

**Conversely, files NOT to create (anti-padding):** no new orchestrator, domain,
persistence, edge-provider, bridge, or `scripts/` file; no programmable
completion-keystroke harness (D-25-08 forbids it -- go live); no `npm publish`/`npm
link` tooling (D-25-01/06 forbid it -- use `scripts/pi.sh`).

## Metadata

**Analog search scope:** `tests/e2e/`, `tests/architecture/`, `tests/edge/completions/`,
`tests/shared/` (glob), `extensions/pi-claude-marketplace/shared/notify.ts`,
`extensions/pi-claude-marketplace/edge/completions/`, `scripts/`, `package.json`.
**Files scanned (read in full or targeted):** `tests/e2e/_helpers.ts`,
`tests/e2e/pi-runtime-smoke.test.ts`, `tests/architecture/catalog-uat.test.ts`,
`tests/edge/completions/provider.test.ts` (header + `:780-840`),
`extensions/pi-claude-marketplace/shared/notify.ts` (`:921-950`, `:1191-1305`),
`scripts/pi.sh`, `package.json` (test glob).
**Verified-line-number anchor:** RESEARCH.md Landmark Drift Report -- `renderPluginRow`
`:921` (not `:887`), `parseUpdateMode`/`allowMarketplaceOnly` `:196`, provider test
at repo-root `tests/edge/completions/provider.test.ts:806` (NOT under `extensions/`).
**Pattern extraction date:** 2026-05-29

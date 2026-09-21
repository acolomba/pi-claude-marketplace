---
phase: 114-degradation-and-documentation
reviewed: 2026-09-08T07:53:49Z
depth: standard
diff_base: 56ac5e7c
files_reviewed: 98
files_reviewed_list:
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - tests/architecture/workflows-marker-coverage.test.ts
  - tests/architecture/no-probe-in-workflows-bridge.test.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-producer-wire-coverage.test.ts
  - tests/architecture/notify-will-reload-agreement.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/platform/pi-api.test.ts
  - tests/shared/concerns/soft-dep.test.ts
  - tests/domain/resolver.test.ts
  - docs/workflows-compatibility.md
  - docs/output-catalog.md
  - docs/messaging-style-guide.md
  - README.md
  - README.es.md
  - tests/edge/notification-boundary.ts
  - tests/edge/types.test.ts
  - tests/index.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/pending.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/autoupdate.test.ts
  - tests/orchestrators/marketplace/autoupdate.messaging.test.ts
  - tests/orchestrators/marketplace/info.test.ts
  - tests/orchestrators/marketplace/list.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/remove.messaging.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/fetch.messaging.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/info.messaging.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/list.messaging.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.messaging.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/plugin/update.messaging.test.ts
  - tests/orchestrators/plugin/update-row.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/import/execute.messaging.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/apply-outcomes.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
  - tests/orchestrators/reconcile/reconcile.messaging.test.ts
  - tests/orchestrators/types.test.ts
  - tests/shared/notify.test.ts
  - tests/shared/notify-context.test.ts
  - tests/shared/notify-reasons.test.ts
  - tests/integration/marketplace-add-seed-mirrors.test.ts
  - tests/e2e/import-command.test.ts
findings:
  critical: 0
  warning: 6
  info: 4
  total: 10
status: issues_found
---

# Phase 114: Code Review Report

**Reviewed:** 2026-09-08T07:53:49Z
**Depth:** standard
**Files Reviewed:** 98
**Status:** issues_found

## Summary

I tried to falsify all five of the phase's headline claims and could break none of
them on behavior. Specifically:

- **Claim 5 holds and is the strongest result.** `grep -rn "requires pi-workflows"`
  across `extensions/`, `tests/`, `docs/` and both READMEs returns nothing. The
  unscoped spelling survives only inside `.planning/` prose, where it is discussed
  as the rejected form. No CRITICAL finding on this axis.
- **Claim 1's gate is not vacuous.** Each of the seven cases in
  `tests/architecture/workflows-marker-coverage.test.ts` drives a distinct
  derivation. The three hard-to-reach cases seed a plugin carrying a NAMED
  `export const meta` (a default-export body would stage zero envelopes and pass
  for the wrong reason), and no case asserts through a shared composer that would
  keep it green after its own derivation was deleted. I independently enumerated
  the `Dependency[]` construction sites across `orchestrators/` and got exactly the
  seven the gate names.
- **Claim 2's byte pair is not vacuous.** `install.test.ts:9766-9797` pins the
  engine-absent run's envelope against a hand-written literal *before* comparing
  the two runs, and asserts the marker in both directions, so "no bytes at all,
  twice" cannot satisfy it. `no-probe-in-workflows-bridge.test.ts` is a real
  source scan with `stripComments` and no `allowMissing`.
- **Claim 3 holds.** `REASONS` counts 45 members, the new token appends at the
  tail, and both new catalog states are byte-driven fixtures in
  `catalog-uat.test.ts:1144` / `:1173`, with the two-marker state deliberately
  probed with only `mcp` loaded so the ordering assertion is exercised.
- **Claim 4's figures reproduce.** Nine checks, six `validateMeta` messages, 57
  published versions and both peer floors all check out; no "seven gates" or
  "3.5.1" figure survives except as an explicitly labelled lower evidence grade.
  `package.json` declares `acorn ^8.16.0` and no out-of-scope file
  (`package.json`, `package-lock.json`, `sonar-project.properties`,
  `CHANGELOG.md`, `extension-version.ts`) was touched, satisfying D-114-07.

The Tier C sweep is clean: `piWithBothLoaded` has zero leftovers, no fixture string
was corrupted by the rename, and every removed assertion I traced was **tightened**
rather than loosened (three `{stale workflow command}` regexes gained the new
marker; one `deepStrictEqual` gained `stagedWorkflows: true`).

What I did find sits in two places the phase's own success criteria do not reach:
**the two new gates are complete against today's tree but have no forcing construct
to stay complete**, and **the compatibility doc carries one factually false version
claim plus one in-scope README omission the executor logged and left open**.

## Warnings

### WR-01: `docs/workflows-compatibility.md` calls a 3.10.1 package "0.x"

**File:** `docs/workflows-compatibility.md:192`
**Issue:** The Upstream stability section reads "internals of a **0.x package** with
57 published versions". The engine is not 0.x and never has been: `npm view
@quintinshaw/pi-dynamic-workflows versions` returns 57 entries running `1.0.0` →
`3.10.1`, and the same document cites `3.10.1` at lines 7, 23, 25, 50 and 170. The
"57 published versions" half of the sentence was re-derived first-hand for this
phase (114-05-SUMMARY records the `npm view` run); the "0.x" half was carried
verbatim from the archived Phase 105 context and never re-checked.

This is not cosmetic. The whole paragraph's risk argument is "no stability promise",
and a reader who takes "0.x" at face value concludes the package is pre-1.0 and
therefore exempt from semver — which is the wrong reason to distrust it. The true
reason, which the sentence already gives, is that the envelope shape and directory
layout are *private internals*, unversioned regardless of the package's own major.

**Fix:**

```markdown
are all internals of a package that exports no contract for any of them -- 57
published versions since `1.0.0`, currently 3.10.1, with the storage layout
private and unversioned at every one of them.
```

### WR-02: both README taglines still omit workflows and now contradict the Features list below them

**File:** `README.md:12`, `README.es.md:12`
**Issue:** The taglines read "Supports Claude commands, skills, agents, hooks and
MCP servers." / "Admite los comandos, habilidades, agentes, hooks y servidores MCP
de Claude." Three lines further down, the same commit adds "Workflows. Requires
`@quintinshaw/pi-dynamic-workflows`" to both Features lists. The first sentence a
reader sees now contradicts the list it introduces.

The phase's CONTEXT put "the README pair" in scope and said "leaving it divergent is
worse than a modest translation". The executor found this and filed Broken Windows
entry #33 (`[workflows-replay] both README taglines still list five component kinds
and omit workflows`), which is still `open`. Filing it does not make the shipped
README correct — this is the extension's npm and GitHub landing copy.

**Fix:**

```markdown
Access Claude plugin marketplaces from [Pi Coding Agent](https://pi.dev). Supports
Claude commands, skills, agents, hooks, MCP servers and workflows.
```

```markdown
Accede a los mercados de complementos de Claude desde [Pi Coding Agent](https://pi.dev).
Admite los comandos, habilidades, agentes, hooks, servidores MCP y workflows de Claude.
```

### WR-03: the no-probe gate matches symbol names, not the capability, and only ever scans five hardcoded files

**File:** `tests/architecture/no-probe-in-workflows-bridge.test.ts:47-74`
**Issue:** Two independent holes in a gate whose stated purpose is that "the code
that writes, replaces or removes an envelope has **no way** to branch on the answer",
"true by construction rather than by accident".

1. `FORBIDDEN_PATTERNS` is `softDepStatus`, `SoftDepStatus`,
   `hasLoadedWorkflowEngine`, `workflowEngineLoaded`. It does not include
   `getAllTools` or `ExtensionAPI`. `bridges/` is allowed to import `platform/`
   (ARCHITECTURE.md, and `.fallowrc.json`'s `bridges-workflows` zone), so
   `stage.ts` can spell the probe inline —
   `pi.getAllTools().some((t) => t.name === "workflow_control")` — and make the
   envelope write conditional without matching any of the four patterns. The gate
   proves four *symbols* are absent; it does not prove the *capability* is.
2. `FORBIDDEN_TARGETS` is a hardcoded five-path list. The header explicitly
   defends the deletion direction ("a renamed or deleted bridge module must break
   this gate loudly rather than quietly reduce it to scanning four files") and says
   nothing about addition. A new `bridges/workflows/envelope.ts` is unguarded on
   the day it lands, and nothing goes red.

The five paths do currently equal `ls extensions/pi-claude-marketplace/bridges/workflows/`,
so the gate is correct today. It is the standing invariant that is unprotected.

**Fix:** add the capability pattern, and derive the target list from the directory
so an addition is covered by construction:

```ts
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  // ...existing four...
  // The probe spelled inline: the bridge may import `platform/`, so naming the
  // four helper symbols is not the only way to ask the question.
  { name: "raw Pi tool-list read", pattern: /\bgetAllTools\b/ },
];

const WORKFLOWS_BRIDGE_DIR = "extensions/pi-claude-marketplace/bridges/workflows";
const FORBIDDEN_TARGETS = (await readdir(path.join(REPO_ROOT, WORKFLOWS_BRIDGE_DIR)))
  .filter((n) => n.endsWith(".ts"))
  .sort()
  .map((n) => path.posix.join(WORKFLOWS_BRIDGE_DIR, n));
// Keep the explicit-count assertion so a file DISAPPEARING is still loud.
assert.equal(FORBIDDEN_TARGETS.length, 5);
```

### WR-04: the marker-coverage gate's seven cases are hand-maintained with no forcing construct

**File:** `tests/architecture/workflows-marker-coverage.test.ts:239-491`
**Issue:** `SITE_CASES` is a literal seven-entry array, and the expectation at
lines 455-491 is a second literal seven-entry array. The suite header claims the
invariant is "**EVERY** `Dependency[]` derivation site under `orchestrators/`", but
nothing binds the case list to the set of derivation sites that actually exists.
Adding an eighth derivation leaves the gate green while its surface renders no
marker — which is precisely the failure the phase's own CONTEXT names ("a closed-set
amendment has already been bigger than its enumeration twice in this milestone")
and precisely the shape of the two guards this milestone already shipped green
because they checked nothing.

Elsewhere this codebase reaches for a totality construct for exactly this
(`MALFORMED_REASON_BY_KIND` uses `satisfies Record<DegradeKind, ...>`;
`INSTALL_OUTCOMES` uses `Record<WorkflowOutcomeSite, string>`;
`_ReasonsCoverageProof` is a compile-time partition proof). The one new
cross-site coverage gate is the one that got a bare literal.

**Fix:** add a companion assertion that scans `orchestrators/` for the derivation
shape and compares the discovered file set to `SITE_CASES`, so an eighth site is a
red row rather than a silent gap:

```ts
test("WDEP-04: the case list covers every Dependency[] derivation site", async () => {
  // A derivation is a function whose declared return type is `Dependency[]`, or a
  // local `const x: Dependency[] = []` that is pushed into. Scan for both.
  const discovered = await filesUnderMatching(
    "extensions/pi-claude-marketplace/orchestrators",
    /:\s*(readonly\s+)?Dependency\[\]|Dependency\[\]\s*=\s*\[\]/,
  );
  assert.deepEqual([...discovered].sort(), SITE_CASES.map((c) => c.site).sort());
});
```

### WR-05: the host-engine marker renders at `info` on four of the seven surfaces, and the doc states `warning` unqualified

**File:** `docs/workflows-compatibility.md:184`, `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:631`, `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:440`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:522,568`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:170-172`
**Issue:** Only three surfaces route the new declaration through `companionSeverity`
and raise `info` → `warning`: standalone install (`install.ts:1854`), the manual
update cascade (`update.ts:2844`) and standalone enable (`enable-disable.ts:1273`).
Four surfaces render the identical `{requires pi-dynamic-workflows}` bytes at
hardcoded `info`:

| surface | severity source |
| --- | --- |
| `list.ts:631` | literal `severity: "info"` |
| `import/execute.ts:440` | literal `severity: "info"` |
| `reconcile/notify.ts:522` and `:568` | `malformed.length > 0 ? "warning" : "info"` |
| `marketplace/update.messaging.ts:171` | literal `updated: "info"` base severity |

`docs/workflows-compatibility.md:184` states, without qualification, "the row
carries the `{requires pi-dynamic-workflows}` marker at `warning` severity". A user
who installs a workflow-bearing plugin into an engine-less session gets `warning`
from `install`, then `info` from `list` for the same plugin in the same session.
The comment at `marketplace/update.messaging.ts:163-166` also still asserts that
"BOTH row forms are composed by the SAME composer ... so the two surfaces cannot
report one ledger run differently", which is true of the row bytes and false of the
severity channel.

This asymmetry is pre-existing for `agents` and `mcp` — the phase followed the
established shape and did not regress anything. What is new is a published document
that states the raise as a flat property of the marker.

**Fix:** qualify the doc sentence to the surfaces that actually raise, and correct
the over-broad comment:

```markdown
... and the install row carries the `{requires pi-dynamic-workflows}` marker at
`warning` severity ... Read-only inventory surfaces (`list`, `info`) and the
load-time reconcile projection render the same marker at `info`: they report a
standing fact about a record rather than a shortfall in an action just taken.
```

### WR-06: the compatibility doc's engine line-number citations are ungated and will rot silently

**File:** `docs/workflows-compatibility.md:23,25,50,52,71,89,120,124,126,159,186,196`
**Issue:** Roughly a dozen claims cite exact line ranges inside a package that is
not vendored in this tree (`src/workflow.ts:1504-1564`,
`src/workflow-capability-contract.ts:457`, `src/saved-commands.ts:52-71`,
`src/workflow-saved.ts:84-137`, …). `tests/architecture/no-stale-test-citations.test.ts`
polices only `tests/...` paths, so nothing in the repository can detect that these
have drifted. The same document names the risk in its own words: 57 releases with
no exported contract. Line numbers into that are the least durable form the claim
could take, and the first upgrade silently converts every one of them into a
confident pointer at the wrong code.

The phase already deferred `WPIN-01` (a machine-checkable re-read of the vendored
blocklist and envelope internals against a newer engine); this is the same class of
debt, unrecorded.

**Fix:** either drop the line numbers and keep the symbol/file citation
(`src/workflow.ts::parseWorkflowScript`), which survives an upgrade, or record a
`[workflows-replay]` Broken Windows entry naming the doc as a WPIN-01 target so the
re-read has a listed subject.

## Info

### IN-01: `docs/messaging-style-guide.md` now contradicts itself on the variant count within one file

**File:** `docs/messaging-style-guide.md:25-26` vs `:66-67`
**Issue:** Lines 25-26 declare "16-variant discriminated union" and "16 literal
strings, derived from PLUGIN_STATUSES"; `PLUGIN_STATUSES.length` is 19
(`notify-closed-set-locks.test.ts:79`). Line 66 already said "19-member" before this
phase, and line 67 — edited by this phase — now adds "the other 15 of the 19
`PLUGIN_STATUSES` members". The contradiction is pre-existing, but the phase
touched one side of it. The deferred-items.md for this phase records the finding and
the reason it was not fixed (the correct fix is re-deriving the whole 19-row
listing, not editing a count), which is the right call; noting it here so the review
trail and the deferral agree.
**Fix:** none in this phase. The logged docs task remains the right vehicle.

### IN-02: `docs/workflows-compatibility.md:50` states a clean 2-of-9 split that its own table qualifies

**File:** `docs/workflows-compatibility.md:50` vs `:73-83`
**Issue:** Line 50 reads "This bridge replicates **two** of them ... It admits
shapes the other seven refuse." The classification table two sections down marks
checks 6, 7 and 8 as `partly` and check 9 as `name only`, and line 87 explains that
the bridge's own walk reaches four of "the other seven" for its own reasons. A
reader who takes line 50 literally will be surprised by the table.
**Fix:** "This bridge replicates two of them outright — the determinism screen and
the parse — and reaches four more only far enough to find `meta.name`, where it
reaches a softer verdict. It admits shapes the other seven refuse."

### IN-03: the marker-coverage gate spells its seven site paths twice

**File:** `tests/architecture/workflows-marker-coverage.test.ts:243,262,283,309,343,376,408` and `:457,462,467,472,477,482,487`
**Issue:** Each site path appears once in `SITE_CASES` and again in the expected
array. The suite's stated design goal is "that row names the file to open", which a
typo in either copy defeats: the diff would report two paths that differ, not a
coverage failure.
**Fix:** derive the expectation from the case list so only the booleans are
literals:

```ts
assert.deepEqual(
  observed,
  SITE_CASES.map(({ site }) => ({ site, marked: true, clean: true })),
);
```

### IN-04: three gate cases and the install byte-pair helper read `notifications[0]` / `notifications.at(-1)` positionally

**File:** `tests/architecture/workflows-marker-coverage.test.ts:254,275,400`, `tests/orchestrators/plugin/install.test.ts:9725`
**Issue:** The full-orchestrator cases pick the emitted block by index. Any future
change that emits a diagnostic or a warning notification ahead of the cascade block
turns these into confusing marker-absent failures rather than a clear "the surface
emitted something else first". The sibling helper `soleRow(notifications)` used
elsewhere in the suite already encodes the "exactly one row" precondition.
**Fix:** assert the count before indexing, or route through a helper:

```ts
assert.equal(notifications.length, 1, "installPlugin emitted more than one notification");
const emitted = notifications[0];
```

---

_Reviewed: 2026-09-08T07:53:49Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

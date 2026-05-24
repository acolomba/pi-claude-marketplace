---
phase: 14-drift-guard-test-alignment
plan: 02
type: execute
wave: 2
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  - tests/edge/router.test.ts
autonomous: true
requirements:
  - CMC-34

must_haves:
  truths:
    - "The 13 argument-validation callsites listed in CONTEXT.md (edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts + edge/handlers/marketplace/{list,autoupdate}.ts) route through `notifyUsageError`, not `notifyError`."
    - "When an argument-validation failure renders to the user, the on-the-wire bytes contain exactly `\\n\\n` between the human-message body and the Usage block (notifyUsageError contract at shared/notify.ts:95-97 enforces this byte-shape)."
    - "Message strings passed to `notifyUsageError` do NOT include a trailing newline that would create a `\\n\\n\\n` triple-newline gap (per RESEARCH.md Pitfall 4 specifically for `bootstrap.ts:48-50`)."
    - "No edge handler in scope still uses `notifyError(ctx, message)` for an argument-validation failure that includes the `USAGE` literal in `message`."
    - "`npm run check` is green at the wave-2 commit."
  artifacts:
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
      provides: "notifyUsageError-routed argument validation; no notifyError + USAGE concatenation"
      contains: "notifyUsageError"
      contains_not: "notifyError(ctx, USAGE)"
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
      provides: "notifyUsageError-routed argument validation"
      contains: "notifyUsageError"
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
      provides: "notifyUsageError-routed argument validation"
      contains: "notifyUsageError"
    - path: extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
      provides: "notifyUsageError-routed argument validation"
      contains: "notifyUsageError"
    - path: extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
      provides: "notifyUsageError-routed argument validation"
      contains: "notifyUsageError"
    - path: extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
      provides: "notifyUsageError-routed argument validation"
      contains: "notifyUsageError"
  key_links:
    - from: "edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts + edge/handlers/marketplace/{list,autoupdate}.ts"
      to: extensions/pi-claude-marketplace/shared/notify.ts
      via: "import { notifyUsageError } from '../../../shared/notify.ts' (plugin handlers) or '../../../shared/notify.ts' (marketplace handlers, same depth)"
      pattern: "notifyUsageError\\("
---

<objective>
Close CMC-34 (audit BLOCKER per `.planning/v1.3-MILESTONE-AUDIT.md` lines 26-32) by migrating the 13 argument-validation callsites listed in CONTEXT.md from `notifyError(ctx, message_including_USAGE)` to `notifyUsageError(ctx, message, USAGE)`. The migration is mechanical -- the wrapper signature already exists at `shared/notify.ts:95-97` and emits the on-the-wire bytes `${message}\n\n${usageBlock}` with the `\n\n` separator MSG-NC-2 mandates. Today these callsites concatenate `${errorMessage(err)}\n${USAGE}` or `${USAGE}\n  <hint>` into a single message string passed to `notifyError`, which produces a `\n` (single newline) separator instead of `\n\n`. The drift guard's MSG-NC-2 + MSG-SR-7 rules (landed in Plan 05) WILL catch any re-introduction once Wave 3 lands; Wave 2 is the surface migration.

Per D-14-02 (LOCKED), the audit's separately-requested router `\n\n` byte-exact test is satisfied STRUCTURALLY by the MSG-NC-2 / MSG-SR-7 rules in Wave 3 -- no separate router test is added by this plan. However, this plan MUST audit `tests/edge/router.test.ts:70-86` and any related router-level byte-shape assertion: if existing tests pin the WRONG shape (e.g., assert `\n` instead of `\n\n` in the rendered usage-error output), flip those assertions to the correct shape; if tests are presence-only (no byte-shape pinning), leave them and let Wave 3's drift guard own the structural enforcement.

Per RESEARCH.md Pitfall 4: some callsites (especially `bootstrap.ts:48-50`) already include their own trailing `\n` BEFORE the USAGE concatenation. Migration MUST strip that trailing `\n` before passing the message string as the 2nd arg to `notifyUsageError`. Otherwise the result is `msg\n\n\nUSAGE` (triple newline).

Purpose: Close audit BLOCKER CMC-34; restore the MSG-NC-2 `\n\n` separator contract on every argument-validation surface; satisfy the v1.3 milestone-gate property "no callsite-level drift on landing" for the usage-error pattern class. Per D-14-02 (LOCKED).
Output: 13 callsites migrated to `notifyUsageError`; router test audit complete; `npm run check` green.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/14-drift-guard-test-alignment/14-CONTEXT.md
@.planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md
@.planning/v1.3-MILESTONE-AUDIT.md
@docs/messaging-style-guide.md
@extensions/pi-claude-marketplace/shared/notify.ts
@extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
@extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
@extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
@extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
@extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
@extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts

<interfaces>
<!-- The single wrapper signature being migrated TO. -->

From extensions/pi-claude-marketplace/shared/notify.ts:
- `export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void { ctx.ui.notify(`${message}\n\n${usageBlock}`, "error"); }`
- Contract: on-the-wire bytes are exactly `${message}\n\n${usageBlock}` at "error" severity. The blank line is part of the user contract; tests assert it byte-for-byte (Phase 1 plan 06 noted in shared/notify.ts:93-94 docstring).

From extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts:
- `notifyError(ctx, errorMessage(err))` at line 40  (parseArgs failure -- NO USAGE in message, this is NOT a usage-error sense; it carries the parser's error text. Per the audit, this MIGRATES to `notifyUsageError(ctx, errorMessage(err), USAGE)` because the user-contract is "argument validation failed -- here's why + how to retry")
- `notifyError(ctx, USAGE)` at line 57  (unknown long flag -- message IS USAGE; migrate to `notifyUsageError(ctx, "Unknown option.", USAGE)` OR keep the message synthesized to a meaningful error and pass USAGE separately)
- `notifyError(ctx, USAGE)` at line 65  (too-many-positionals -- same pattern)

From extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts:
- `notifyError(ctx, `${errorMessage(err)}\n${USAGE}`)` at line 34  → `notifyUsageError(ctx, errorMessage(err), USAGE)`
- `notifyError(ctx, `Unknown option: "${token}".\n${USAGE}`)` at line 44  → `notifyUsageError(ctx, `Unknown option: "${token}".`, USAGE)`
- `notifyError(ctx, `Too many arguments.\n${USAGE}`)` at line 52  → `notifyUsageError(ctx, "Too many arguments.", USAGE)`
- `notifyError(ctx, USAGE)` at line 86  (parseTarget bad ref) → `notifyUsageError(ctx, "Invalid plugin reference.", USAGE)` (synthesize a short message; or call back to a parser error if available)

From extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts:
- `notifyError(ctx, errorMessage(err))` at line 36  → `notifyUsageError(ctx, errorMessage(err), USAGE)`
- `notifyError(ctx, USAGE)` at line 48  → `notifyUsageError(ctx, "Too many arguments.", USAGE)` (or extract whatever short reason fits)
- `notifyError(ctx, USAGE)` at line 61  → `notifyUsageError(ctx, "Invalid plugin reference.", USAGE)` (or equivalent)
- Note: line 36 currently uses `errorMessage(err)` WITHOUT USAGE concatenation (unlike reinstall/bootstrap); migration still goes to notifyUsageError so the usage block is shown to the user on every argument-validation failure -- consistent with the audit's read.

From extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts:
- `notifyError(ctx, `${errorMessage(err)}\n${USAGE}`)` at line 37  → `notifyUsageError(ctx, errorMessage(err), USAGE)`
- `notifyError(ctx, USAGE)` at line 42  → `notifyUsageError(ctx, "bootstrap takes no arguments.", USAGE)` (or equivalent short reason)
- `notifyError(ctx, `${USAGE}\n  bootstrap does not accept --scope; ...`)` at line 48-50  → `notifyUsageError(ctx, "bootstrap does not accept --scope; it always targets user scope.", USAGE)` -- RESEARCH.md Pitfall 4 applies here: ensure the message string does NOT carry a trailing `\n` before being passed to notifyUsageError. Read the existing 3-line template at bootstrap.ts:48-50 carefully.

From extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts:
- `notifyError(ctx, message)` at line 28 (inside parseCommandArgs callback)  → `notifyUsageError(ctx, message, USAGE)`. Note: the callback signature `(message) => void` is passed to parseCommandArgs -- confirm parseCommandArgs synthesizes the `message` argument WITHOUT a trailing `\n`; if it does include one, strip it before passing.

From extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts:
- `notifyError(ctx, message)` at line 37 (inside parseCommandArgs callback, returned by `usageFor(enable)` helper)  → `notifyUsageError(ctx, message, usage)` (where `usage` is the closure variable holding the result of `usageFor(enable)`).

NOTE: parseCommandArgs is at `extensions/pi-claude-marketplace/edge/args-schema.ts`. The callback signature is `(message: string) => void`. Inspect args-schema.ts to verify the `message` passed to the callback DOES or DOES NOT already include the USAGE block -- that determines whether to pass USAGE as the 3rd argument unchanged or to extract just the message portion. If `message` already includes USAGE (e.g., synthesized as `${reason}\n${USAGE}`), strip it via a regex or call-site rework. (CHECK args-schema.ts before editing list.ts/autoupdate.ts.)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify parseCommandArgs callback contract + audit existing router test byte-shape</name>
  <files>extensions/pi-claude-marketplace/edge/args-schema.ts, tests/edge/router.test.ts</files>
  <read_first>
    - extensions/pi-claude-marketplace/edge/args-schema.ts (focus on `parseCommandArgs` function signature and the `message` it passes to the onError callback -- does it include USAGE or just the reason?)
    - tests/edge/router.test.ts lines 70-86 (verify whether the existing router test pins the `\n\n` byte-shape or merely presence-checks)
    - extensions/pi-claude-marketplace/edge/router.ts (the router itself -- confirm it doesn't pre-compose the usage block before delegating to handlers)
    - extensions/pi-claude-marketplace/shared/notify.ts:95-97 (canonical notifyUsageError contract)
  </read_first>
  <action>
    Two pre-flight audits before editing the 6 handler files:

    1. Open `extensions/pi-claude-marketplace/edge/args-schema.ts` and locate `parseCommandArgs`. Determine what `message` the onError callback receives:
       (a) Just the parsing error reason (no USAGE concatenated): the migrations in Task 2 below pass `message` unchanged as arg 2 to `notifyUsageError` and add the closure-scope `USAGE` / `usage` literal as arg 3.
       (b) The error reason ALREADY concatenated with the USAGE block: the migrations must extract just the reason -- either by splitting on `\n` or by reworking parseCommandArgs's callback to pass only the reason. If case (b), update `args-schema.ts` to pass the reason without USAGE.
       Record the finding in the task SUMMARY for downstream tasks.

    2. Open `tests/edge/router.test.ts` lines 70-86. Identify whether the test asserts:
       (a) Presence-only: e.g., `assert.ok(notify.includes("Usage:"))` -- no byte-shape pin; LEAVE the test alone.
       (b) Wrong byte-shape: e.g., `assert.equal(notify, "...\nUsage: ...")` -- the test pins a SINGLE `\n` separator; this MUST be flipped to `\n\n` to match the new notifyUsageError contract.
       (c) Correct byte-shape already: e.g., `assert.equal(notify, "...\n\nUsage: ...")` -- no change needed.
       If case (b), update the assertions in `tests/edge/router.test.ts:70-86` to match `\n\n`. If case (a) or (c), no edit.

    3. Sweep adjacent edge tests for the same pattern: `tests/edge/handlers/**/*.test.ts` -- any handler test that captures a notify body for an argument-validation failure may pin the wrong byte-shape. Use the grep:
       ```
       grep -rn 'Usage:' tests/edge/ | head -30
       ```
       Inspect any `assert.equal` / `assert.deepEqual` that includes a string literal containing `\nUsage:` (single backslash-n). Flip to `\n\nUsage:` if found.

    Output this task's findings into the SUMMARY.md so Task 2 and Task 3 can rely on them. Do NOT yet modify any edge handler file -- that is Task 2 / Task 3.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # Confirm a single source of truth for what parseCommandArgs passes:
      grep -nE 'onError|callback|message' extensions/pi-claude-marketplace/edge/args-schema.ts | head -10
      # Identify any test that pins a single-\n shape:
      grep -rn '\\nUsage:' tests/edge/ 2>/dev/null | head -10
      # (a result here = a test that needs flipping to \\n\\nUsage:)
    </automated>
  </verify>
  <done>
    1. Task author has determined whether `parseCommandArgs`'s onError callback passes USAGE-concatenated message or reason-only message.
    2. Existing router test at `tests/edge/router.test.ts:70-86` reviewed; any wrong-shape pin has been flipped to the `\n\n` shape OR confirmed presence-only.
    3. Adjacent handler tests under `tests/edge/handlers/**/*.test.ts` swept for the same wrong-shape pattern.
    4. Findings recorded in this task's SUMMARY block for downstream tasks.
  </done>
</task>

<task type="auto">
  <name>Task 2: Migrate 7 plugin-handler callsites to notifyUsageError</name>
  <files>
    extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  </files>
  <read_first>
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts (lines 40, 57, 65 -- three callsites)
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts (lines 34, 44, 52, 86 -- four callsites)
    - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts (lines 36, 48, 61 -- three callsites)
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts (lines 37, 42, 48-50 -- three callsites, last spans three lines per RESEARCH.md Pitfall 4)
    - extensions/pi-claude-marketplace/shared/notify.ts:95-97 (notifyUsageError signature)
    - .planning/phases/14-drift-guard-test-alignment/14-RESEARCH.md Pitfall 4 (trailing-newline guidance)
    - Task 1 SUMMARY (the parseCommandArgs callback finding from Task 1 is NOT load-bearing for THIS task -- those are marketplace handlers; Task 2 handlers all use raw `parseArgs` not `parseCommandArgs`)
  </read_first>
  <action>
    Per D-14-02 (LOCKED) -- migrate the 13 plugin-edge-handler callsites enumerated in CONTEXT.md's CMC-34 closure list. For each callsite below, the migration is identical in shape: replace `notifyError(ctx, message)` (often with USAGE concatenated into `message`) with `notifyUsageError(ctx, reason, USAGE)`. Drop any `\n${USAGE}` concatenation from the `reason` argument -- `notifyUsageError` adds `\n\n` between args 2 and 3.

    Per-file changes:

    **list.ts** (3 callsites; current import: `import { notifyError } from "../../../shared/notify.ts"`):
    - Update import line to: `import { notifyUsageError } from "../../../shared/notify.ts";` (drop the unused notifyError if no remaining callsite uses it -- list.ts has none after this migration).
    - Line 40 (`parseArgs` failure): `notifyError(ctx, errorMessage(err));` → `notifyUsageError(ctx, errorMessage(err), USAGE);`
    - Line 57 (unknown long flag): `notifyError(ctx, USAGE);` → `notifyUsageError(ctx, `Unknown option: "${token}".`, USAGE);`
    - Line 65 (too-many-positionals): `notifyError(ctx, USAGE);` → `notifyUsageError(ctx, "Too many arguments.", USAGE);`
    - DROP the `errorMessage` import if it becomes unused (line 15) -- verify post-edit.

    **reinstall.ts** (4 callsites; same import migration; `errorMessage` still used at line 34 so KEEP it):
    - Line 34: `notifyError(ctx, `${errorMessage(err)}\n${USAGE}`);` → `notifyUsageError(ctx, errorMessage(err), USAGE);`
    - Line 44: `notifyError(ctx, `Unknown option: "${token}".\n${USAGE}`);` → `notifyUsageError(ctx, `Unknown option: "${token}".`, USAGE);`
    - Line 52: `notifyError(ctx, `Too many arguments.\n${USAGE}`);` → `notifyUsageError(ctx, "Too many arguments.", USAGE);`
    - Line 86 (parseTarget invalid ref): `notifyError(ctx, USAGE);` → `notifyUsageError(ctx, "Invalid plugin reference.", USAGE);`
    - Update import: `import { notifyUsageError } from "../../../shared/notify.ts";`

    **update.ts** (3 callsites; same import migration):
    - Line 36: `notifyError(ctx, errorMessage(err));` → `notifyUsageError(ctx, errorMessage(err), USAGE);`
    - Line 48 (too many positionals): `notifyError(ctx, USAGE);` → `notifyUsageError(ctx, "Too many arguments.", USAGE);`
    - Line 61 (split failed): `notifyError(ctx, USAGE);` → `notifyUsageError(ctx, "Invalid plugin reference.", USAGE);`
    - Update import: `import { notifyUsageError } from "../../../shared/notify.ts";`

    **bootstrap.ts** (3 callsites; SPECIAL CASE per RESEARCH.md Pitfall 4):
    - Line 37: `notifyError(ctx, `${errorMessage(err)}\n${USAGE}`);` → `notifyUsageError(ctx, errorMessage(err), USAGE);`
    - Line 42 (positional rejected): `notifyError(ctx, USAGE);` → `notifyUsageError(ctx, "bootstrap takes no arguments.", USAGE);`
    - Lines 48-50 (--scope rejected): currently `notifyError(ctx, `${USAGE}\n  bootstrap does not accept --scope; it always targets user scope.`);` -- the message string has `USAGE` BEFORE the reason. Migrate to `notifyUsageError(ctx, "bootstrap does not accept --scope; it always targets user scope.", USAGE);` (swap order: notifyUsageError emits message first, then USAGE; the indent-with-`  ` was Phase 12-pre stylistic -- Phase 14 reverts to message-then-USAGE shape per MSG-NC-2 / MSG-SR-7).
    - Update import: `import { notifyUsageError } from "../../../shared/notify.ts";`
    - VERIFY: after edits, no message string passed as arg 2 to `notifyUsageError` ends with `\n` (would create triple-newline). Grep for trailing newlines: `grep -n "\\\\n\"," extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` -- flag any hit for manual review.
    - LEAVE the `notifyError(ctx, errorMessage(err), err)` at line 62 (inside the bootstrap try/catch around `bootstrapClaudePlugin`) UNCHANGED -- that is NOT an argument-validation failure; that is the orchestrator error path, which correctly uses notifyError + cause-chain. CMC-34 scope is argument validation only.

    Test discoveries from Task 1 are merged here only if `parseCommandArgs` was involved (it's not -- plugin handlers use `parseArgs` not `parseCommandArgs`; marketplace handlers will).
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      for f in extensions/pi-claude-marketplace/edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts; do
        echo "=== $f ==="
        # Expect 0 hits for notifyError(ctx, USAGE) and 0 hits for the `\n${USAGE}` concatenation
        grep -nE 'notifyError\(ctx,\s*USAGE\)|notifyError\(ctx,\s*`[^`]*\\n\$\{USAGE\}' "$f" || echo "(no matches -- clean)"
        # Expect ≥1 hit for notifyUsageError(ctx, ...)
        grep -c 'notifyUsageError(' "$f"
      done
      # bootstrap.ts line 62 should STILL use notifyError (orchestrator error path, not arg validation)
      grep -nE 'notifyError\(ctx, errorMessage' extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
      # Full check:
      npm run typecheck 2>&1 | tail -5
      npm run lint 2>&1 | grep -iE 'plugin/(list|reinstall|update|bootstrap)\.ts' | head -10
    </automated>
  </verify>
  <done>
    1. `grep -c 'notifyError(ctx, USAGE)' extensions/pi-claude-marketplace/edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts` returns 0 for each file.
    2. `grep -c '\\n\${USAGE}' extensions/pi-claude-marketplace/edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts` returns 0 for each file.
    3. `grep -c 'notifyUsageError(' extensions/pi-claude-marketplace/edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts` returns ≥1 for each file (sum across 4 files = 13 callsites migrated).
    4. `bootstrap.ts:62` (orchestrator error path) still uses `notifyError(ctx, errorMessage(err), err)` -- UNCHANGED.
    5. No message string passed to notifyUsageError ends with a literal `\n` (Pitfall 4 mitigation).
    6. `npm run typecheck` is green.
  </done>
</task>

<task type="auto">
  <name>Task 3: Migrate 2 marketplace-handler callsites to notifyUsageError + run full check</name>
  <files>
    extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts,
    extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
  </files>
  <read_first>
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts (line 28 callsite + lines 22-30 surrounding parseCommandArgs invocation)
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts (line 37 callsite + lines 30-40 surrounding parseCommandArgs invocation; note `usage` closure variable from `usageFor(enable)` at line 28)
    - extensions/pi-claude-marketplace/edge/args-schema.ts (the `parseCommandArgs` definition + onError callback contract -- load-bearing finding from Task 1)
    - extensions/pi-claude-marketplace/shared/notify.ts:95-97 (notifyUsageError signature)
    - Task 1 SUMMARY (the parseCommandArgs callback contract finding)
  </read_first>
  <action>
    Migrate the 2 marketplace-handler callsites listed in CONTEXT.md. These are different from Task 2 because they pass the failure-reporting callback to `parseCommandArgs` -- the migration shape depends on Task 1's finding about what `message` parseCommandArgs hands to the callback.

    Per Task 1 finding (load-bearing):

    **Case A -- parseCommandArgs's onError callback passes reason-only message (no USAGE):**
    - `list.ts:28`: `(message) => { notifyError(ctx, message); }` → `(message) => { notifyUsageError(ctx, message, USAGE); }`
    - `autoupdate.ts:37`: `(message) => { notifyError(ctx, message); }` → `(message) => { notifyUsageError(ctx, message, usage); }` (note `usage` not `USAGE` -- closure variable from `usageFor(enable)`)
    - Update imports to add `notifyUsageError`; drop `notifyError` if no other call site in the same file uses it.

    **Case B -- parseCommandArgs's onError callback passes message-with-USAGE-concatenated:**
    - Either refactor `parseCommandArgs` to pass the reason and the usage block separately (changes args-schema.ts signature -- preferred for clean migration), OR strip the USAGE substring at each callsite before passing to notifyUsageError (technical-debt path; not recommended).
    - PREFERRED PATH (Case B with refactor): in args-schema.ts, change the onError callback signature from `(message: string) => void` to `(reason: string, usage: string) => void` -- pass the reason and the usage block separately. Update all parseCommandArgs callers (including the 2 marketplace handlers here, and possibly other call sites -- grep first to identify the full scope before refactoring).
    - If args-schema.ts has many call sites outside scope of this plan, document the finding and prefer the inline-strip path: at each callsite, accept the concatenated `message`, extract the reason via string manipulation, and pass `usage` separately. Less elegant but localized.

    After migration, the 2 marketplace-handler callsites produce the on-the-wire bytes `${reason}\n\n${usage}` (notifyUsageError contract) instead of today's `${message}` (with `\n` separator from internal parseCommandArgs concatenation).

    NOTE: do not modify any other code path in args-schema.ts beyond what is necessary for Case A vs Case B. If Case A, args-schema.ts is not touched.

    After all migrations, run `npm run check` as the wave-2 gate.
  </action>
  <verify>
    <automated>
      cd /home/acolomba/pi-claude-marketplace
      # Migration completeness:
      grep -c 'notifyUsageError(' extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
      # Expect: ≥1
      grep -c 'notifyUsageError(' extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
      # Expect: ≥1
      grep -c 'notifyError(' extensions/pi-claude-marketplace/edge/handlers/marketplace/{list,autoupdate}.ts
      # Expect: 0 in each (no remaining notifyError in these 2 files for argument validation)
      # Aggregate sanity across all 6 files in this plan:
      grep -c 'notifyUsageError(' extensions/pi-claude-marketplace/edge/handlers/plugin/{list,reinstall,update,bootstrap}.ts extensions/pi-claude-marketplace/edge/handlers/marketplace/{list,autoupdate}.ts | awk -F: '{s+=$2} END {print "total notifyUsageError callsites:", s}'
      # Expect: ≥13 (CMC-34 closure count from CONTEXT.md)
      # Wave-2 milestone gate:
      npm run check 2>&1 | tail -10
      # Expect: SUCCESS
    </automated>
  </verify>
  <done>
    1. `list.ts:28` and `autoupdate.ts:37` callsites route through `notifyUsageError` with the USAGE block passed as arg 3 (per the on-wire `\n\n` separator contract).
    2. If parseCommandArgs's onError callback contract required a refactor (Case B), that refactor has been applied and ALL parseCommandArgs callers in the project have been migrated consistently. If only the 2 marketplace files needed editing (Case A), args-schema.ts is unchanged.
    3. Aggregate `grep -c 'notifyUsageError('` across the 6 files in this plan returns ≥13.
    4. No file in scope still has a `notifyError(ctx, ...USAGE...)` argument-validation callsite.
    5. `npm run check` is GREEN -- wave 2 milestone gate satisfied (per D-14-03).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user CLI input → edge handlers | Untrusted argument tokens cross this boundary; notify wrappers render the rejected input back to the user -- the user-visible bytes change shape (single `\n` → `\n\n`) but the rendered TEXT is the same |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14-03 | Information | bootstrap.ts:48-50 --scope rejection (untrusted token may appear in user message) | accept | Today's behavior already echoes the rejected token; no new info exposure -- message shape changed (`message` then USAGE) but content unchanged. The rejected `--scope` argument string is not echoed in the new message form (the message is a fixed sentence; the token is only re-displayed in the synthesized message body when applicable -- bootstrap.ts line 48 currently has no token interpolation). |
| T-14-04 | Tampering | parseCommandArgs callback signature (Case B refactor only) | mitigate | If args-schema.ts is refactored, every call site must be updated atomically; missing call sites would produce a TypeScript compile error (NFR-7), which is the structural mitigation. `npm run typecheck` (Task 3 verify) catches partial refactors. |
</threat_model>

<verification>
- `npm run check` green at the Plan 02 commit.
- Each of the 6 files in scope has `≥1` `notifyUsageError(` invocation; each has `0` argument-validation `notifyError(ctx, USAGE)` or `notifyError(ctx, ...\${USAGE}...)` callsites.
- `bootstrap.ts:62` STILL uses `notifyError(ctx, errorMessage(err), err)` for the orchestrator error path -- that callsite is INTENTIONALLY unchanged (not an argument-validation failure).
- Any existing `tests/edge/router.test.ts` or `tests/edge/handlers/**/*.test.ts` byte-shape assertion has been audited (Task 1) and updated to match the new `\n\n` separator if needed.
- Wave 3's drift-guard rules MSG-NC-2 + MSG-SR-7 (Plan 05) WILL catch any reintroduction of `notifyError + USAGE` after this plan lands; this plan is the surface migration before that structural enforcement.
</verification>

<success_criteria>
1. CMC-34 audit BLOCKER closed: 13 callsites across 6 files migrated to `notifyUsageError`.
2. On-the-wire byte-shape for argument-validation failures is now `${message}\n\n${USAGE}` (per shared/notify.ts:95-97 contract) -- MSG-NC-2 satisfied surface-wide.
3. No regressions in Phase 12/13 byte-binding tests; `npm run check` green.
4. RESEARCH.md Pitfall 4 mitigated: no callsite passes a trailing-`\n` message to notifyUsageError.
</success_criteria>

<output>
Create `.planning/phases/14-drift-guard-test-alignment/14-02-SUMMARY.md` when done.
</output>

# Phase 7: Mode Refusals, Real-Pi Verification, and Docs - Pattern Map

**Mapped:** 2026-10-09
**Files classified:** 31 candidate paths, including conditional changes and three deletions
**Analogs found:** 29 / 31 (18 exact, 5 role matches, 6 partial matches)

## Scope and decisions

This map covers refusal/auth propagation, isolated real-Pi tests, the schema guide and executable snippets, and corpus closeout. Proposed filenames are planner choices. Conditional rows are not a requirement to edit those files.

CONTEXT.md D-14 resolves the corpus policy question. Preserve all 3,149 existing samples with their per-file multiplicity, severity, and argument count. Record each permitted refusal addition before amending the baseline. Require no missing samples and zero unexplained extras before retiring the scripts. Earlier policy-block statements in RESEARCH.md are superseded by its parent follow-up and D-14.

The parent successfully ran the current-install probe on Pi 0.87.1. That evidence does not prove the exact 0.86.1 floor, startup delivery, or persistence timing.

## File Classification

Paths below are repository-relative. Assignment letters point to concrete excerpts below. Documentation uses the nearest allowed role, with its purpose in parentheses.

| New/Modified File | Change | Role | Data Flow | Closest Analog | Match Quality | Assignment |
| --- | --- | --- | --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts` | modify | controller | request-response | `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` | exact | A |
| `tests/edge/handlers/plugin/browse.test.ts` | modify | test | request-response | `tests/edge/handlers/plugin/browse.test.ts` | exact | A |
| `tests/edge/register.test.ts` | modify | test | request-response | `tests/edge/json-capture.ts` | exact | A |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | modify | service | request-response | `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` | exact | B |
| `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` | modify | middleware | request-response | `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` | exact | B |
| `extensions/pi-claude-marketplace/shared/errors.ts` | modify | model | transform | `extensions/pi-claude-marketplace/shared/errors.ts` | exact | B |
| `tests/orchestrators/auth-host.test.ts` | modify | test | request-response | `tests/orchestrators/auth-host.test.ts` | exact | B |
| `tests/platform/git-auth-callbacks.test.ts` | modify | test | request-response | `tests/platform/git-auth-callbacks.test.ts` | exact | B |
| `tests/shared/errors.test.ts` | modify | test | transform | `tests/shared/errors.test.ts` | exact | B |
| `tests/integration/auth-e2e.test.ts` | modify | test | request-response | `tests/integration/auth-e2e.test.ts` | exact | B |
| `extensions/pi-claude-marketplace/shared/notification-grammar.ts` | conditional modify | utility | transform | `extensions/pi-claude-marketplace/shared/notification-grammar.ts` | exact | A |
| `tests/shared/notification-grammar.test.ts` | conditional modify | test | transform | `tests/architecture/wire-schema.test.ts` | role-match | A |
| `tests/e2e/pi-json-output.test.ts` | new, proposed | test | streaming | `tests/e2e/pi-runtime-smoke.test.ts` | role-match | C |
| `tests/e2e/_helpers.ts` | conditional modify | utility | request-response | `tests/e2e/_helpers.ts` | exact | C |
| `tests/pi-runtime.ts` | conditional modify | utility | file-I/O | `tests/pi-runtime.ts` | exact | C |
| `tests/pi-runtime.test.ts` | conditional modify | test | file-I/O | `tests/architecture/wire-schema.test.ts` | role-match | C |
| `tests/e2e/fixtures/startup-entries.ts` | new, proposed | utility | event-driven | None | none | C |
| `.github/workflows/ci.yml` | modify | config | batch | `.github/workflows/ci.yml` | exact | C |
| `package.json` | conditional modify | config | batch | `.github/workflows/ci.yml` | partial | C |
| `docs/json-output.md` | new | utility (documentation) | transform | `tests/architecture/wire-schema.test.ts` | partial | D |
| `tests/architecture/json-output-docs.test.ts` | new, proposed | test | transform | `tests/architecture/wire-schema.test.ts` | role-match | D |
| `README.md` | modify | utility (documentation) | transform | `README.md` | exact | D |
| `AGENTS.md` | modify | config (policy) | transform | `AGENTS.md` | exact | E |
| `.planning/BACKLOG.md` | modify | store (planning) | transform | `.planning/BACKLOG.md` | exact | E |
| `docs/output-catalog.md` | modify prose only | utility (documentation) | transform | `tests/architecture/catalog-uat/catalog-contract.test.ts` | partial | E |
| `.planning/phases/01-presentation-model/notify-corpus/baseline.jsonl` | append authorized samples | store | batch | `scripts/notify-corpus.mjs` | partial | E |
| `.planning/phases/01-presentation-model/notify-corpus/meta.json` | update after audited capture | config | batch | `scripts/notify-corpus.mjs` | partial | E |
| `.planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-ADDITIONS.md` | new, proposed | store (audit ledger) | batch | None | none | E |
| `scripts/notify-corpus.mjs` | delete last | utility | batch | `scripts/notify-corpus.mjs` | exact | E |
| `scripts/notify-corpus.hook.mjs` | delete last | utility | event-driven | `scripts/notify-corpus.mjs` | partial | E |
| `scripts/notify-corpus.negative.mjs` | delete last | test | batch | `scripts/notify-corpus.mjs` | role-match | E |

## Pattern Assignments

### A. Browse refusal and text rendering

**Primary analog:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:251-264`.

```typescript
export function notifyUsageError(
  ctx: NotificationContext,
  run: NotificationRun,
  message: UsageErrorMessage,
): void {
  emitPresentation(
    ctx,
    run,
    resolveRawSurface({
      kind: "usage-error",
      message: message.message,
      usage: message.usage,
    }),
  );
}
```

**Existing import:** `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts:24`.

```typescript
import { notify, notifyUsageError } from "../../../shared/notification-dispatch.ts";
```

Replace only the non-TUI list delegation at browse.ts:138-143. Keep preceding argument validation and the TUI branch. Use the actual mode in D-01's exact message. JSON/RPC include the existing `Usage: /claude:plugin browse`. Print contains only the error and remedy. Do not load marketplaces or invoke list after refusal.

**Text seam:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts:1139-1145`.

```typescript
export function formatRawSurface(surface: ResolvedRawSurface): NotifyArguments | undefined {
  switch (surface.kind) {
    case "usage-error":
      // SNM-13 / D-06: one blank line separates the message from the usage.
      return [`${surface.message}\n\n${surface.usage}`, RAW_SURFACE_SEVERITY[surface.kind]];
    case "usage-info":
      return [surface.usage, RAW_SURFACE_SEVERITY[surface.kind]];
```

An empty-usage branch is a candidate, not an existing pattern. If selected, change the grammar and its owner test together. Preserve every nonempty-usage byte and the required wire string field.

**Owner-test pattern:** `tests/edge/handlers/plugin/browse.test.ts:126-147` uses exact mocks, arrange/act/assert, and explicit `verify`. Its current fallback test at 149-165 is the replacement target:

```typescript
when(() => ctx.mode).thenReturn("json");
when(() => mockList("", ctx, run)).thenResolve(undefined);

const browseHandler = makeBrowseHandler(handlers);

// act
await browseHandler("", ctx, run);

// assert
verify(ctx);
verify(mockList);
```

Remove the list expectation and assert refusal plus zero list calls. Cover json/rpc/print, argument validation, and unchanged TUI behavior.

**Registration coverage:** `tests/edge/register.test.ts:1304-1312` already enumerates explicit and implicit browse:

```typescript
for (const mode of ["json", "rpc"]) {
  for (const { args, commandId } of [
    { args: "list --scope project", commandId: "plugin list" },
    { args: "ls --scope project", commandId: "plugin list" },
    { args: "browse", commandId: "plugin browse" },
    { args: "", commandId: "plugin browse" },
    { args: " \t ", commandId: "plugin browse" },
  ]) {
```

Retain list/ls cascade expectations. Browse cases become usage-error outcomes with the outer command identity and invocation ID. Use the JSON capture pattern in Shared Patterns.

### B. Lazy auth guard and typed propagation

**Primary analog:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:184-204`.

```typescript
const onAuthRequired: OnAuthRequiredFn = async (): Promise<AuthAttemptResult> => {
  // D-79-02: once-per-host memo short-circuits a repeated flow.
  const memoized = authMemo?.get(host);
  if (memoized !== undefined) {
    return memoized;
  }

  const result = await initiateDeviceFlow({
    provider,
    host,
    credentialOps,
    onDeviceCode: (prompt) => {
      notifyDeviceFlowPrompt(ctx, run, prompt);
    },
    ...(deviceFlowHttp !== undefined && { http: deviceFlowHttp }),
  });
  authMemo?.set(host, result);
  return result;
};

return { kind: "device-flow", credentialOps, host, onAuthRequired };
```

Place the live print-mode guard after memo reuse and before initiation. Construction of an auth bundle must remain usable in print. The guard must prevent both code requests and polling.

**Imports and tier boundary:** auth-host.ts:37-48 separates value imports and `import type`. Keep the shared refusal class in `shared/errors.ts`; do not add a platform Git value import to auth-host.

```typescript
import { findProviderForHost } from "../domain/auth-registry.ts";
import { initiateDeviceFlow } from "../domain/github-auth.ts";
import { NODE_CREDENTIAL_SPAWN, createCredentialOps } from "../platform/git-credential.ts";
import { notifyDeviceFlowPrompt } from "../shared/notification-dispatch.ts";

import type { DeviceFlowHttp } from "../domain/github-auth.ts";
import type { AuthAttemptResult, OnAuthRequiredFn } from "../platform/git-auth-callbacks.ts";
import type { CredentialOps } from "../platform/git-credential.ts";
import type { NotificationContext } from "../platform/pi-api.ts";
import type { NotificationRun } from "../shared/notification-run.ts";
import type { GitAuthBundle } from "./marketplace/shared.ts";
```

**Typed error analog:** `extensions/pi-claude-marketplace/shared/errors.ts:3-12`.

```typescript
/** Rejects a host mode before an operation starts or output is delivered. */
export class UnsupportedModeError extends Error {
  readonly mode: string;

  constructor(mode: string) {
    super(`Unsupported notification mode: ${mode}`);
    this.name = "UnsupportedModeError";
    this.mode = mode;
  }
}
```

Copy the named Error-subclass pattern, not its meaning. Print is a supported mode. A proposed `DeviceFlowUnavailableError` carries D-02's exact message: "Device-flow authentication is unavailable in print mode. Retry with --mode json or interactive Pi."

**Credential ordering:** `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:188-201`.

```typescript
const filled = await opts.credentialOps.fill(opts.host);
if (filled !== null) {
  return filled;
}

if (opts.kind === "stored-credential") {
  // GAUTH-04 / D-1-01: the helper is this host's only credential source.
  hookDebugLog(`onAuth: no stored credential for ${opts.host}`, "auth");
  return { cancel: true };
}

const result = await opts.onAuthRequired();
if (result.ok) {
  return result.cred;
}
```

The existing catch at 209-218 catches every error and ends with:

```typescript
hookDebugLog(`onAuth threw for ${opts.host}: ${errorMessage(err)}`, "auth");
return { cancel: true };
```

Add a narrow typed rethrow before this fallback. Preserve cancellation for unrelated failures and the HTTPS/bound-host check at 176-185. Test whether the real Git adapter preserves the refusal. An explicit result channel is a fallback only if that path fails.

**Test assignments:**

- `tests/shared/errors.test.ts:43-62`: copy the structured assertion of Error identity, name, and message for the new class.
- `tests/platform/git-auth-callbacks.test.ts:20-47`: copy stored-credential setup and exact fill/approve/reject call assertions. The throwing interactive callback proves credential hits never initiate auth.
- `tests/platform/git-auth-callbacks.test.ts:192-221`: retain generic-error cancellation and logging while adding the typed-error rejection case.
- `tests/orchestrators/auth-host.test.ts:1266-1295`: copy production bundle plus real callback composition, then assert stored credentials work in print. Add memo reuse and zero request/poll cases.
- `tests/integration/auth-e2e.test.ts:148-214`: reuse credential/device-flow fakes and real callbacks. Its existing "add path E2E" case directly calls `onAuth`; that alone does not establish a real Git-operation/cleanup path. Add the operation-boundary regression required by the research.

Concrete integration composition at auth-e2e.test.ts:173-186:

```typescript
const { notifyCalls, onDeviceCode } = makeNotifyCapture();

const onAuthRequired: OnAuthRequiredFn = () =>
  initiateDeviceFlow({ host: "github.com", credentialOps: credOps, onDeviceCode, http });

const { onAuth } = buildAuthCallbacks({
  credentialOps: credOps,
  host: "github.com",
  kind: "device-flow",
  onAuthRequired,
});

const result = await onAuth("https://github.com/some-repo.git");
```

For the new refusal case, compose the production host-auth callback instead of calling the domain initiation function directly. Assert typed identity or retained cause, final remedy, cleanup, and absence of credentials in output. Keep JSON/RPC/TUI device flow working.

### C. Isolated real-Pi execution

**Primary analog:** `tests/e2e/_helpers.ts:173-211` supplies subprocess setup and teardown. Copy the temporary-root and finally-cleanup shape:

```typescript
const root = await mkdtemp(path.join(tmpdir(), "pi-cm-runtime-smoke-"));
const home = path.join(root, "home");
const cwd = path.join(root, "project");
const agentDir = path.join(home, ".pi", "agent");
const sessionDir = path.join(agentDir, "sessions");
const extension = path.join(REPO_ROOT, "extensions", "pi-claude-marketplace", "index.ts");
```

```typescript
} finally {
  await rm(root, { recursive: true, force: true });
}
```

Do not copy its ambient environment spread, merged stdout/stderr, or help-only verdict. Do not use the upstream-clone fixture for an offline list test.

**Executable selection:** `tests/pi-runtime.ts:63-88` reads the installed manifest, validates version and `bin.pi`, and checks the resolved file. Its return seam:

```typescript
const cliPath = path.resolve(path.dirname(manifestPath), pi);
if (!existsSync(cliPath)) {
  throw new Error(`resolvePiRuntime: ${cliPath} does not exist. Run \`npm ci\`.`);
}

return { cliPath, version: raw.version };
```

Use an explicit separately provisioned 0.86.1 package root and assert its actual version. The resolver searches parent directories, so an absent fixture must not silently select the main install. Preserve the main dependency version and peer floor. If the resolver changes, update its existing owner test; otherwise leave both unchanged.

**Test imports:** `tests/e2e/pi-runtime-smoke.test.ts:1-4`.

```typescript
import assert from "node:assert/strict";
import { test } from "node:test";

import { runPiRuntimeSmoke } from "./_helpers.ts";
```

The new test runs the production extension with `-p --mode json --no-session --offline "/claude:plugin list"`, explicit extension loading, and closed stdin. Use a fresh home/project and an allowlisted child environment. Keep streams separate, set finite timeout/buffer limits, and reject spawn errors, signals, nonzero status, malformed JSON, missing outcomes, and invalid payloads.

Parse `entry_appended` events, select custom `claude-plugin` entries, and validate `entry.data`. The capture helper's `payload` property is an in-process test name, not the stdout field.

**Startup fixture:** `tests/e2e/fixtures/startup-entries.ts` is a proposed name with no exact tracked analog. Emit distinct markers in both startup hooks, then prove they exist in session memory while absent from the stream. Include a later streamed command as a positive control. RPC can use `get_entries`; keep its input open until protocol requests finish. Add a separate persistence-enabled slash-only case: `--no-session` cannot prove initial session-write timing.

**CI integration:** `.github/workflows/ci.yml:149-153`.

```yaml
      - name: Install dependencies
        run: npm ci --ignore-scripts

      - name: Run pinned e2e tests
        run: npm run test:e2e
```

Add explicit floor provisioning/selection to this existing job or a narrowly scoped companion step. Package-script changes are conditional. Do not add a new production dependency or downgrade the main Pi install. A separate fixture manifest/lock is an implementation option, not a discovered existing artifact.

### D. Schema guide and executable examples

**Primary analog:** `tests/architecture/wire-schema.test.ts:35-60` reads the committed artifact relative to `import.meta.url` and compares it to the source-generated document:

```typescript
const wireSchemaModuleUrl = new URL("../../scripts/wire-schema.mjs", import.meta.url).href;
const wireSchema = (await import(wireSchemaModuleUrl)) as unknown as WireSchemaModule;
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

async function committedSchemaText(): Promise<string> {
  return readFile(path.join(projectRoot, wireSchema.WIRE_SCHEMA_PATH), "utf8");
}

async function committedSchemaDocument(): Promise<WireSchemaDocument> {
  return JSON.parse(await committedSchemaText()) as WireSchemaDocument;
}
```

```typescript
function assertMatchesSource(committed: unknown, built: Record<string, unknown>): void {
  assert.deepStrictEqual(committed, JSON.parse(JSON.stringify(built)));
}
```

Use the existing schema as the field inventory for `docs/json-output.md`. The 19-kind list at wire-schema.test.ts:76-119 and required-field assertions at 134-155 provide coverage patterns. Do not create another schema or introduce runtime validation into production.

The guide begins with a runnable command and extraction result. Explain common envelope fields once, then every kind and nested field, requiredness, compatibility, severity, and reload semantics. Follow D-05 through D-12, including unknown additive kinds/closed-set members, startup retrieval, print silence, RPC rendering, slash-only persistence, and the bounded append-failure recovery.

For `tests/architecture/json-output-docs.test.ts`, read and execute the actual guide snippets. Do not duplicate jq filters inside tests. Cover empty input, non-command events, prompt/diagnostic-only input, successful empty inventories, warnings, errors, earlier success plus final failure, reload after partial success, and multiple invocation IDs. No outcome must produce exactly "No command outcome received". The example's warning/error exit policy is separate from Pi process status.

**README link analog:** `README.md:189`.

```markdown
Whether Pi applies a declared plugin's components depends on the entry's optional `enabled` key and on the install-time default the plugin author declares. For more information, see [Plugin enablement](docs/plugin-enablement.md).
```

Copy only the brief topic-link convention for JSON output. Do not add a README quick-start example.

### E. Corpus closeout and bounded policy corrections

**Primary analog:** `scripts/notify-corpus.mjs:387-407` captures the suite and compares multisets:

```javascript
const baseline = readCorpus(baselinePath);
const scratch = mkdtempSync(path.join(os.tmpdir(), "notify-corpus-check-"));

try {
  const capture = captureCorpus(path.join(scratch, "capture.jsonl"), suiteGlobs());
  const result = diffCorpus(baseline, capture);

  if (!reportDiff(result)) {
    process.stderr.write("Notify corpus check failed.\n");
    process.exitCode = 1;
    return;
  }

  const extra = result.extra.reduce((sum, entry) => sum + entry.count, 0);
```

The existing pass predicate at 286-292 is weaker than the phase gate:

```javascript
const { baseline, capture } = result.totals;
const shrunk = capture < baseline;
```

```javascript
return result.missing.length === 0 && !shrunk;
```

Require `missing.length === 0` and zero extras against the D-14 amended baseline, with passing captured tests. A successful process exit alone is insufficient.

The proposed `07-CORPUS-ADDITIONS.md` has no existing exact ledger analog. Record full normalized file/message/severity/argc tuples, multiplicity, contributing refusal tests, and before/after totals. Preserve the old multiset exactly. Amend baseline.jsonl only after the ledger accounts for every addition, then update meta.json from the audited capture. Do not use an unrestricted recapture to replace the baseline.

**Frozen-catalog control:** `tests/architecture/catalog-uat/catalog-contract.test.ts:21-22,266-277`.

```typescript
const EXPECTED_STATE_COUNT = 260;
const EXPECTED_UTF8_BYTES = 39_143;
```

```typescript
const catalog = await readFile(CATALOG_PATH, "utf8");
const examples = loadCatalogExamples(catalog);
assert.equal(examples.length, EXPECTED_STATE_COUNT);
assert.equal(
  examples.reduce((bytes, example) => bytes + Buffer.byteLength(example.expected, "utf8"), 0),
  EXPECTED_UTF8_BYTES,
);
```

Leave these locks and every catalog fence unchanged. Correct only the soft-dependency-marker ownership and device-flow rendering attribution. Research locates the related prose at output-catalog.md:69,628,643,3216 and 4076-4090; review each relevant statement without broad cleanup.

Update AGENTS.md's existing IL-2 output policy to PROJECT.md D8. Close the existing MRO-01 entry in BACKLOG.md:1064 onward and correct its claims about machine notify text and print stdout. No new output sink is authorized.

After the final audited comparison and catalog controls pass, delete all three corpus scripts together. Search all tracked files for remaining tool references outside `.planning/`, and remove only obsolete references. The bounded search found references in the scripts themselves; repeat the all-tracked-files audit during closeout. Retain historical planning evidence.

## Shared Patterns

### Machine validation and sink ownership

**Source:** `tests/edge/json-capture.ts:1-9,29-37`.
**Apply to:** registration, refusal, e2e stream, and guide-example tests.

```typescript
import assert from "node:assert/strict";

import { Compile } from "typebox/compile";

import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";

import type { NotificationUi } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
```

```typescript
appendEntry(customType: string, payload: unknown): void {
  entries.push({ customType, payload });
  try {
    assert.strictEqual(customType, "claude-plugin");
    assertJsonValue(payload);
    assert.ok(PAYLOAD_VALIDATOR.Check(JSON.parse(JSON.stringify(payload))));
  } catch (error: unknown) {
    failures.push(error);
    throw error;
  }
},
```

The helper's UI getter at 41-44 throws on machine UI access. Its `assertValid()` catches failures swallowed by outer error handling. Keep both properties in in-process tests; real e2e validates the actual emitted data.

### Error identity and cleanup

**Source:** `extensions/pi-claude-marketplace/shared/errors.ts:90-101`.
**Apply to:** auth propagation through operation failures.

```typescript
export class CleanupContextError extends Error {
  readonly primary: Error;
  readonly cleanupFailures: readonly CleanupFailure[];

  constructor(primary: Error, cleanupFailures: readonly CleanupFailure[]) {
    super(primary.message, { cause: primary });
    this.name = "CleanupContextError";
    this.primary = primary;
    this.cleanupFailures = Object.freeze(
      cleanupFailures.map((failure) => Object.freeze({ ...failure })),
    );
  }
}
```

Retain the primary error or its cause when cleanup adds context. Do not classify the refusal by matching its message. Preserve safe logging: never add raw URL userinfo or credentials to the error.

### Verification scope

Apply the local-verification skill. Run affected owner tests during implementation. The combined-tree GSD gate is `npm run check`; real-Pi e2e is separate and must include the exact floor. The corpus and catalog controls run before deletion, then the final combined-tree gate runs after deletion. This mapping performed no tests, installs, runtime launches, source edits, or commits.

## No Analog Found

| File | Role | Data Flow | Reason |
| --- | --- | --- | --- |
| `tests/e2e/fixtures/startup-entries.ts` (proposed) | utility | event-driven | No inspected tracked fixture proves both startup hooks, memory presence, and stream absence. Use RESEARCH.md's positive-control design. |
| `07-CORPUS-ADDITIONS.md` (proposed, phase directory) | store | batch | D-14 introduces an exact additions ledger. Copy the existing corpus tuple vocabulary, but define an explicit audit record. |

The docs test has a strong artifact-test analog, but no inspected test executes jq extracted from a guide. The floor target likewise has a resolver analog but no existing exact-floor provisioning fixture. Treat these as new mechanics within the mapped files.

## Metadata

**Search order:** phase context and research, then CodeGraph before source search. Two CodeGraph queries located auth callers, runtime helpers, errors, schema tests, and corpus owners. Targeted reads supplied missing sections.
**Search scope:** extensions/pi-claude-marketplace/{edge,orchestrators,platform,shared}, tests/{edge,orchestrators,platform,shared,integration,e2e,architecture}, scripts, docs, CI, and phase records.
**Candidate files classified:** 31.
**Analog paths in classification checked as git-tracked:** 21 unique paths, all present in `git ls-files -- <paths>`.
**Primary pattern families:** five. Supporting owner tests provide local assertions and imports; no runtime/install mirror is an assigned analog.
**Pattern extraction date:** 2026-10-09.
**Limit:** operation-boundary edits beyond the named owners remain conditional on the new propagation regression. Do not preemptively refactor Git or marketplace/plugin orchestrators.

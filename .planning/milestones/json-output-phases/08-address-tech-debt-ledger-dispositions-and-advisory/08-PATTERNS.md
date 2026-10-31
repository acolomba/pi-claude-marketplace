# Phase 8: Address tech debt: ledger dispositions and advisory - Pattern Map

**Mapped:** 2026-10-10
**Files analyzed:** 9 (2 tests, 1 lock, 5 planning records, WINDOWS.md via verbs)
**Analogs found:** 9 / 9 (all are self-analogs or in-file precedents; no production source changes)

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `tests/integration/skill-path-resolution.test.ts` | test (integration) | env-ordering / file-I/O | itself, lines 65-122 and 124-135 | exact (self) |
| `tests/integration/provenance-invisibility.test.ts` | test (integration) | file-I/O | `skill-path-resolution.test.ts` (twin resolver, lines 56-114) | exact (symmetry refactor) |
| `tests/platform/hermetic-environment.ts` | test helper | env swap | read-only reference, NOT modified | n/a |
| `package-lock.json` | config (lock) | transform (npm-generated) | `npm audit fix --package-lock-only` output | tool-generated |
| `.planning/BACKLOG.md` (WOUT-01, DEPADV-01) | planning record | append | `## WSTOR-01` (lines 3352-3370), `## WPIN-01` (3372+) | exact |
| `.planning/phases/07-*/deferred-items.md` | planning record | edit | its own DEP-07-03-01 entry, lines 3-11 | exact (self) |
| `.planning/phases/01-presentation-model/01-VALIDATION.md` | planning record | edit | line 124 checkbox | exact (self) |
| `.planning/phases/03-typed-raw-surfaces/03-VALIDATION.md` | planning record | edit | line 7 frontmatter | exact (self) |
| `.planning/WINDOWS.md` | generated ledger | CLI-mutated | `gsd-tools windows waive|fixed`; waived entries 59-87 | exact (never hand-edit) |

## Pattern Assignments

### `tests/integration/skill-path-resolution.test.ts`

Current resolver (lines 65-81, keep unchanged including `PI_SUBAGENTS_ROOT` override):
```typescript
function resolvePiSubagentsPackageRoot(): string | undefined {
  const override = process.env.PI_SUBAGENTS_ROOT;
  if (override) {
    return override;
  }
  try {
    const globalNodeModules = execFileSync("npm", ["root", "-g"], { encoding: "utf8", timeout: 5000 }).trim();
    return globalNodeModules ? path.join(globalNodeModules, "pi-subagents") : undefined;
  } catch {
    return undefined;
  }
}
```

Loader today (lines 92-98) calls the resolver itself:
```typescript
async function loadPiSubagentsSkillsModule(
  scratchRoot: string,
): Promise<PiSubagentsSkillsModule | undefined> {
  const packageRoot = resolvePiSubagentsPackageRoot();
  if (!packageRoot) {
    return undefined;
  }
```
Change: take `packageRoot: string | undefined` as first parameter, drop the inner call. Update the JSDoc above it (lines 83-91) accordingly; no "previously"/phase narration.

Faulty ordering in test body (lines 124-135):
```typescript
test("SC-2 / AGSK-06: ...", async (t) => {
  const originalOffline = process.env.PI_OFFLINE;
  const { root: tmpRoot } = await createHermeticEnvironment(t, "skillpath-sc2-");   // swaps HOME
  ...
  try {
    const skillsModule = await loadPiSubagentsSkillsModule(tmpRoot);  // npm root -g runs under fake HOME
    if (!skillsModule) {
      t.skip("pi-subagents resolver module not reachable in this environment");
      return;
    }
```
Target: `const packageRoot = resolvePiSubagentsPackageRoot();` as the FIRST statement of the test body (before `createHermeticEnvironment`), then `loadPiSubagentsSkillsModule(packageRoot, tmpRoot)`. Do not hoist to module scope (unit-testing skill: only stateless stubs at module scope). Keep the `t.skip` branch.

Why (helper, read-only, `tests/platform/hermetic-environment.ts` lines 44-46):
```typescript
await Promise.all([mkdir(agentDir, { recursive: true }), mkdir(cwd, { recursive: true })]);
process.env.HOME = home;
process.env.PI_CODING_AGENT_DIR = agentDir;
```

Verify: `PI_SUBAGENTS_ROOT` unset on this machine -> `# pass 1, # skipped 0`; `PI_SUBAGENTS_ROOT=/nonexistent` -> `# SKIP`, exit 0 (CI-equivalent).

### `tests/integration/provenance-invisibility.test.ts`

Same shape: resolver at lines 56-72 (unchanged), loader `loadPiSubagentsFrontmatterModule(scratchRoot)` at line 82 calls the resolver inside; test body lines 116-122:
```typescript
test("T-d8i-01: provenance stays invisible to pi-subagents' own frontmatter parser", async (t) => {
  const tmpRoot = await mkdtemp(path.join(tmpdir(), "provenance-invis-"));
  try {
    const fm = await loadPiSubagentsFrontmatterModule(tmpRoot);
    if (!fm) {
      t.skip("pi-subagents frontmatter parser not reachable in this environment");
```
Apply the identical refactor (resolve first, pass `packageRoot` into loader). This file never swaps HOME, so it is a symmetry change with no behavior change (RESEARCH Open Question 2). Keep the top-of-file TODO about CI install (deferred).

### `package-lock.json`

No analog to copy: run `npm audit fix --package-lock-only`. Expected diff: exactly the 3 lines (`version`, `resolved`, `integrity`) of `packages["node_modules/brace-expansion"]`, 5.0.9 -> 5.0.12. Nested `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion` stays 5.0.9 (shrinkwrap). `package.json` and `tests/e2e/pi-peer-floor/**` must be byte-identical. Commit alone (escalates hook to all direct-coverage pairs).

### `.planning/BACKLOG.md` (append WOUT-01, DEPADV-01)

Analog `## WSTOR-01` (lines 3352-3364):
```markdown
## WSTOR-01: the W1/W2/W3 storage assertions were never driven against a live engine

Carried from the workflows-replay close (WINDOWS #72; OPEN-QUESTIONS Q7).

<facts paragraph(s), wrapped ~80 cols, code paths in backticks>

**To settle it:** <concrete recipe>.
```
WOUT-01: "Carried from the json-output close (WINDOWS #84)." + measured facts from D-03 + settle recipe (Anthropic key in `tmp/pi-uat/agent`, one canary re-run).
DEPADV-01: "Carried from DEP-07-03-01 (phase 07 deferred-items)." + D-08 facts, three GHSA IDs, fix range `>=5.0.12`; **To settle it:** Pi >=1.0 devDependency bump. Do not add a "Closed ..." paragraph.

### `.planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md`

Edit DEP-07-03-01 (lines 3-11) in place: keep the bold-ID bullet shape, replace "General root dependency remediation remains open..." with the root fix (root lock now 5.0.12) and "Residual Pi-nested copy carried by BACKLOG.md DEPADV-01."

### VALIDATION records

- `03-VALIDATION.md` line 7: `nyquist_compliant: false` -> `true` (checklist lines 84-89 already all `[x]`).
- `01-VALIDATION.md` line 124: `- [x] \`nyquist_compliant: true\` set in frontmatter` -> `- [ ]`; frontmatter line 7 stays `false`.

### `.planning/WINDOWS.md` (verbs only)

```bash
node .claude/gsd-core/bin/gsd-tools.cjs windows waive <id> "[json-output] <reason>"
node .claude/gsd-core/bin/gsd-tools.cjs windows fixed <id>
node .claude/gsd-core/bin/gsd-tools.cjs windows status --raw
```
Pitfalls (RESEARCH): unquoted reason truncates to first word and cannot be re-waived; zsh treats `[json-output]` as a glob unless quoted; use a Node script passing each reason as one argv element (`execFileSync(node, [gsdTools, "windows", "waive", id, reason])`), skipping ids already non-open for retry safety. Precedent: waived entries 59-87 name a cause or carrier; fixed entries carry no reason. 85 and 89 -> `fixed` (89 only after the test commit); 32-34, 41-58, 84, 88 -> `waive` with D-01/D-03/D-05 texts.

## Shared Patterns

- **Env restoration:** any `process.env` mutation in tests restores through the test context (`createHermeticEnvironment(t, ...)` registers cleanup). The resolver call reads env only; no new mutation.
- **Comments:** no `Phase NN`/plan references, no replaced-shape narration (skills/typescript-comments).
- **Commits:** `SKIP=npm-check pre-commit run --files <paths>` then foreground `git commit`; order: test fix, lock alone, planning records, then ledger verbs.
- **Planning `.md` files:** not formatted by prettier/mdformat in `.planning/`.

## No Analog Found

None.

## Metadata

**Analog search scope:** `tests/integration/`, `tests/platform/`, `.planning/BACKLOG.md`, phase 01/03/07 records
**Files scanned:** 8
**Pattern extraction date:** 2026-10-10

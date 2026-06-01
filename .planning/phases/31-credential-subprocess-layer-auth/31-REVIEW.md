---
phase: 31-credential-subprocess-layer-auth
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - tests/architecture/no-shell-out.test.ts
  - extensions/pi-claude-marketplace/platform/git-credential.ts
  - tests/helpers/credential-mock.ts
  - tests/platform/git-credential.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - extensions/pi-claude-marketplace/platform/README.md
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 31: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 31 introduces the `CredentialOps` seam (`git-credential.ts`) for OS-keychain access via `git credential fill/approve/reject`, a mock helper for tests, and two architecture gates (no-shell-out and no-credential-leak). The implementation is structurally sound and the error-handling discipline for subprocess failures is correct. No blockers. Four warnings and four info items, centered on missing input validation in the wire-format builder, incomplete regex coverage in the AUTH-09 gate, a gap in the dynamic-import arm of the architecture gate, and documentation stale state.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `buildAttributeBlock` does not sanitize newlines in `host` or credential fields

**File:** `extensions/pi-claude-marketplace/platform/git-credential.ts:128-139`
**Issue:** `buildAttributeBlock` constructs the git-credential wire-format block by simple string concatenation of `host`, `cred.username`, and `cred.password`. The `git credential` wire format is newline-delimited; any of these values containing a `\n` injects extra attribute lines into the block. A host like `"github.com\nprotocol=ftp"` or a password like `"tok\nurl=evil.com"` silently corrupts the attribute set sent to the credential helper.

The practical attack surface for V1 is narrow (host comes from a stored marketplace URL whose hostname is validated upstream), but the validation assumption is not enforced at this layer. If Phase 32+ callers pass a hostname derived from a less-trusted source, or if any credential helper behavior changes the helper's attribute matching, the corrupted block could cause `approve` to store under a different key than `fill` reads from, or silently evict an unintended entry via `reject`.

**Fix:** Strip or reject values containing `\n`, `\r`, or `\0` before building the block:
```typescript
function sanitizeAttrValue(value: string, field: string): string {
  if (/[\r\n\0]/.test(value)) {
    throw new Error(
      `git-credential attribute '${field}' contains a control character`
    );
  }
  return value;
}

function buildAttributeBlock(host: string, cred?: GitCredentials): string {
  const lines = [
    `protocol=https`,
    `host=${sanitizeAttrValue(host, "host")}`,
  ];
  if (cred?.username !== undefined) {
    lines.push(`username=${sanitizeAttrValue(cred.username, "username")}`);
  }
  if (cred?.password !== undefined) {
    lines.push(`password=${sanitizeAttrValue(cred.password, "password")}`);
  }
  return lines.join("\n") + "\n\n";
}
```
The throw in `sanitizeAttrValue` propagates to `gitCredentialIO`, which is caught by each public function: `credentialFill` returns `null`, `credentialApprove`/`credentialReject` silently no-op. No change to the external behavior contract is required; the guard simply closes the injection vector.

---

### WR-02: `parseCredentialOutput` does not strip trailing `\r` from values

**File:** `extensions/pi-claude-marketplace/platform/git-credential.ts:148-162`
**Issue:** `parseCredentialOutput` splits on `\n` but does not strip `\r`. On Windows (or with a credential helper that emits CRLF), git credential fill output uses `\r\n` line endings. Splitting on `\n` leaves a trailing `\r` in every parsed value: `{ username: "user\r", password: "token\r" }`. The credential returned by `credentialFill` would have a corrupted password that silently fails isomorphic-git's HTTP auth header construction downstream.

Test 6 explicitly skips Windows (`if (process.platform === "win32") { return; }`), so this path is entirely untested. Even on macOS/Linux, some third-party credential helpers (e.g., cross-platform manager-core) may emit CRLF.

**Fix:**
```typescript
const value = line.slice(eq + 1).replace(/\r$/, "");
```
One-character change; no external behavior change on LF-only systems.

---

### WR-03: AUTH-09 `errorWithCred` regex does not cover string concatenation in Error messages

**File:** `tests/architecture/no-credential-leak.test.ts:88`
**Issue:** The regex that guards against credential-field interpolation in `Error` constructors only matches template-literal syntax (`${...}`):
```
/new\s+Error\s*\([^)]*\$\{[^}]*(password|access_token|cred\.[a-z]+)/i
```
It misses string concatenation:
```typescript
throw new Error("git credential failed: " + cred.password);  // NOT caught
throw new Error("exit " + code + " for " + password);        // NOT caught
```
Any developer authoring a new error path in `git-credential.ts` using `+` rather than a template literal bypasses the AUTH-09 gate entirely.

**Fix:** Extend the regex (or add a second pattern) to cover concatenation:
```typescript
// Catches both template literals and + concatenation
const errorWithCred =
  /new\s+Error\s*\((?:[^)]*\$\{[^}]*(password|access_token|cred\.[a-z]+)|[^)]*\+\s*(password|access_token|cred\.[a-z]+))/i;
```
Alternatively, split into two `assert.equal` checks -- one per syntax -- to keep each regex focused.

---

### WR-04: `FORBIDDEN_PATTERNS` in no-shell-out test does not detect dynamic `import()`

**File:** `tests/architecture/no-shell-out.test.ts:63-68`
**Issue:** The four patterns in `FORBIDDEN_PATTERNS` only match static `import ... from` declarations and `require()` calls. Dynamic `import()` expressions are not covered:
```typescript
const cp = await import("node:child_process");  // NOT caught
const cp = await import("child_process");        // NOT caught
```
A developer could bypass the D-21 + Phase 31 narrowing gate by using a dynamic import instead of a static one. The gate's stated purpose is to prevent any non-whitelisted file from importing `node:child_process`; the gap makes the guarantee incomplete.

**Fix:** Add two patterns:
```typescript
const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  /from\s+["']node:child_process["']/,
  /from\s+["']child_process["']/,
  /require\(\s*["']child_process["']\s*\)/,
  /require\(\s*["']node:child_process["']\s*\)/,
  // Dynamic imports:
  /import\s*\(\s*["']node:child_process["']\s*\)/,
  /import\s*\(\s*["']child_process["']\s*\)/,
];
```

---

## Info

### IN-01: Architecture gate does not assert the whitelisted file exists and actually uses `child_process`

**File:** `tests/architecture/no-shell-out.test.ts:99-103`
**Issue:** The "exactly one file" assertion validates only the in-memory `ALLOWED_CHILD_PROCESS_FILES` Set literal, not the filesystem. If `platform/git-credential.ts` is deleted:

- Test 1 (`no child_process imports outside the whitelist`) passes because `walkTsFiles` never yields the deleted file, so the `ALLOWED_CHILD_PROCESS_FILES.has(rel)` skip never fires and no offenders are found.
- Test 2 (`exactly one file`) passes because it checks the hardcoded Set, not the disk.
- The `no-credential-leak` test 2 also passes vacuously (it has an explicit `if (!exists) return` guard).

The gate therefore gives a false-green signal if the whitelisted file is accidentally removed or renamed.

**Fix:** Add a third assertion that reads `git-credential.ts` from disk and verifies it contains a `child_process` import:
```typescript
test("Phase 31 whitelist: platform/git-credential.ts exists and imports node:child_process", async () => {
  const abs = path.join(
    REPO_ROOT,
    "extensions/pi-claude-marketplace/platform/git-credential.ts",
  );
  const src = await readFile(abs, "utf8");
  assert.ok(
    /from\s+["']node:child_process["']/.test(src),
    "platform/git-credential.ts must import node:child_process (whitelist integrity check)",
  );
});
```

---

### IN-02: README.md checklist item for `pi-api.ts` is stale

**File:** `extensions/pi-claude-marketplace/platform/README.md:15`
**Issue:** The checklist entry reads `- [ ] pi-api.ts` (not done), but the file exists on disk and the prose on line 5 says "Phase 7 added `pi-api.ts`". The checkbox should be `[x]`.

**Fix:** Change line 15 from `- [ ]` to `- [x]`.

---

### IN-03: Test 8 comment overstates what it proves

**File:** `tests/platform/git-credential.test.ts:139-149`
**Issue:** The test comment claims to prove that "the seam never widens its contract to include `path`/`username`/etc. on a fill query." What it actually asserts is that the mock's call-log record for a `fill` call contains only `{ host }` -- which is the shape of `MockCredentialState.fillCalls`, a test fixture. It does not exercise the production `buildAttributeBlock` function at all; the wire format is an implementation detail invisible to the mock. The comment misleads a reader into thinking production behavior is covered.

**Fix:** Adjust the comment to accurately describe what is being tested:
```typescript
// Asserts that the CredentialOps.fill interface contract presents only `host`
// to callers -- the attribute block construction is an implementation detail
// of the production fill, not part of the seam. A separate integration or
// real-subprocess test (e.g., Test 7) would be needed to verify the
// production wire format excludes path=.
```

---

### IN-04: Mock `approve`/`reject` throw behavior is undocumented relative to the production contract

**File:** `tests/helpers/credential-mock.ts:36-39`
**Issue:** `approveThrows` and `rejectThrows` cause the mock to throw, but the production `credentialApprove` and `credentialReject` are guaranteed to never throw (they swallow all errors). Test 3 in `git-credential.test.ts` explicitly documents the `fillThrows` / production-null-return divergence for `fill`, but no equivalent note appears for `approve` and `reject`. Phase 32+ test authors who reach for `approveThrows` / `rejectThrows` to simulate subprocess failure will be testing a code path (try/catch around `approve`) that never fires against the real implementation.

**Fix:** Add a comment to the `approveThrows`/`rejectThrows` fields explaining the contract divergence:
```typescript
/**
 * Optional override hooks -- simulate subprocess errors for callers that wrap
 * approve/reject in try/catch.
 *
 * NOTE: the production credentialApprove/credentialReject NEVER throw; they
 * silently no-op on all subprocess errors (Pitfall 7 / Pattern 3). Use these
 * overrides only to test caller-side try/catch logic if it is explicitly
 * present; do NOT assume Phase 32+ callers need to guard against throws from
 * approve or reject.
 */
approveThrows?: Error;
rejectThrows?: Error;
```

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
spike: 012
idea: claude-workflows-bridge
name: canonical-path-mechanics
type: standard
validates: "Given the decision to write @quintinshaw's canonical paths for both scopes, when the project-key derivation is reimplemented and the staging/rename path is exercised, then confirm key parity across edge cases and establish where the staging tree must live for NFR-1 atomicity"
verdict: ✓ VALIDATED
related: ["010", "011"]
tags: [pi-extension, workflows, paths, nfr-1, nfr-10, prototype]
---

# Spike 025: canonical-path-mechanics

## What This Validates

Operator decision (2026-08-14): support workflows via
`@quintinshaw/pi-dynamic-workflows`, writing its **canonical** paths for both
scopes -- `~/.pi/workflows/saved/` for user, and
`~/.pi/workflows/projects/<key>/saved/` for project -- rather than the
deprecated `<cwd>/.pi/workflows/saved/` legacy read path (spike 023, Option 1).

That decision buys freedom from the deprecation bet and costs exactly one new
mechanism: we must derive `<key>` ourselves, byte-identically, because the
engine exposes no helper we can depend on. This spike de-risks that mechanism
before any bridge is planned, and settles where the staging tree must live.

## Research

`workflowProjectKey` (`src/workflow-paths.ts`) is a private implementation
detail with no public export contract:

```ts
export function workflowProjectKey(cwd: string): string {
  const projectPath = resolve(cwd);
  const slug = sanitizePathSegment(basename(projectPath) || "project");
  const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 12);
  return `${slug}-${hash}`;
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return sanitized || "project";
}
```

Two orderings in there are easy to get wrong when reimplementing: the
leading/trailing dash strip runs **before** the 48-char truncation (so
truncation can reintroduce a trailing dash), and `resolve()` runs before
`basename()` (so relative and non-normalized paths must normalize first).

## How to Run

```bash
npm install @quintinshaw/pi-dynamic-workflows@3.5.1
node keyparity.mjs   # our reimplementation vs their real workflowProjectKey
node exdev.mjs       # is a staging->target rename atomic across mounts?
```

`exdev.mjs` creates and removes a probe directory under `$HOME`.

## What to Expect

`keyparity.mjs` prints one line per case with `ok` / `MISMATCH` and a final
count. `exdev.mjs` prints the filesystem type of `tmpdir()` and `homedir()` and
whether a rename between them succeeds.

## Investigation Trail

1. **Transcribed the derivation and tested it against the real function**
   rather than eyeballing equivalence -- the house convention from spike 003
   (prototype against the real module, never a mock).
2. **Chose cases to attack the two order-dependent steps**, not just happy
   paths: a name that truncates into a trailing dash, a name that is entirely
   non-ASCII, `/` itself, a trailing slash, a relative path, and a
   non-normalized path containing `..`.
3. **Checked the normalization property explicitly** -- two spellings of one
   project must produce one key, or a bridge would write a second orphaned
   directory depending on how `cwd` was spelled.
4. **Tested the staging assumption.** Spike 024 assumed the agents-bridge
   pattern (stage under `<extensionRoot>`, rename into the target) would carry
   over. Under the canonical-path decision the target moved to `$HOME` while a
   project-scope `extensionRoot` stays at `<cwd>/.pi/`, so the same-filesystem
   guarantee no longer holds by construction.

## Results

**VERDICT: VALIDATED.** The key is reproducible exactly, and the staging
location constraint is now pinned by measurement rather than assumption.

### Key parity: 14 of 14, zero mismatches

| Input | Derived key |
| --- | --- |
| `/home/acolomba/some-project` | `some-project-e4c31526a114` |
| `/home/acolomba/UPPER-Case-Name` | `upper-case-name-68af6a471604` |
| `/home/acolomba/name with spaces & symbols!` | `name-with-spaces-symbols-0dd0a90eb124` |
| `/home/acolomba/проект` | `project-cd4339b8af82` |
| `/home/acolomba/日本語プロジェクト` | `project-3cc7d84ca611` |
| `/home/acolomba/---leading-and-trailing---` | `leading-and-trailing-adab370c9067` |
| `<47 a's>-b` | `aaaa…aaa--79e41bdb3cef` |
| `/` | `project-8a5edab28263` |
| `relative/path` | `path-c02fff3b6ab2` |
| `/home/acolomba/../acolomba/some-project` | `some-project-e4c31526a114` |

Two behaviors worth carrying into the implementation:

- **Any project whose directory name is entirely non-ASCII slugs to the literal
  `project`**, distinguished only by the hash. Correct, but it means the
  directory name is not a reliable human landmark for such projects.
- **Truncation can produce a doubled dash** (`…aaa--<hash>`), because the strip
  precedes the slice. A reimplementation that reorders those two steps passes
  every simple case and fails only on names longer than 48 characters ending in
  a dash -- exactly the kind of defect that ships.
- **Normalization holds**: `/home/acolomba/../acolomba/some-project` and
  `/home/acolomba/some-project` produce the same key.

### Staging must live adjacent to the target (NFR-1)

Measured on this machine:

```text
tmpdir  : /tmp            -> type=0x1021994  (tmpfs)
homedir : /home/acolomba  -> type=0x58465342 (xfs)

cross-mount rename: FAILED EXDEV -- cross-device link not permitted
```

`rename()` is atomic only within a filesystem. The agents bridge gets this for
free -- `<extensionRoot>/agents-staging/` and `<scopeRoot>/agents/` share a
`scopeRoot`, hence a filesystem. Under the canonical-path decision a
project-scope `extensionRoot` sits at `<cwd>/.pi/pi-claude-marketplace/` while
the target sits under `$HOME`, and a project checkout on a different mount from
`$HOME` is ordinary, not exotic.

**Consequence:** the workflows staging tree must live under `~/.pi/workflows/`
adjacent to its target, not under `<extensionRoot>`. The NFR-10 amendment
therefore has to admit a staging directory as well as the two saved
directories -- three paths, not two. This is a genuine departure from every
existing bridge, all of which stage inside `<extensionRoot>`.

### Resulting write set for the bridge

| Purpose | Path |
| --- | --- |
| user artifacts | `~/.pi/workflows/saved/<plugin>:<name>.json` |
| project artifacts | `~/.pi/workflows/projects/<key>/saved/<plugin>:<name>.json` |
| staging (both scopes) | a sibling under `~/.pi/workflows/` |

### Caveats

- Parity is pinned at 3.5.1. The derivation is a private detail, so the real
  build should carry `keyparity.mjs`'s cases as a test with **hard-coded
  expected keys**, which would fail loudly on an upstream change rather than
  silently agreeing with a new implementation.
- The EXDEV result proves cross-mount rename fails *in general*; it does not
  prove any particular user's `cwd` and `$HOME` differ. The staging rule is
  required because the same-FS guarantee is absent, not because it always
  fails.
- `statfsSync` type values are Linux-specific; the constraint itself is not.

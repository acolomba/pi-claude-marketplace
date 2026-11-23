# Phase 3: System Git Transport and Clone Shape - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-23
**Phase:** 03-system-git-transport-and-clone-shape
**Areas discussed:** Shallow clones against TAGS-01, Marketplace update model, `core.autocrlf`, Device Flow interim (asked); Old clones, GitHub base URL, State lock, Default branch, Timeout, Keep on failure, Symlinks, SHA pins, Name matchers (decided autonomously)

Smart discuss, autonomous mode. Upstream evidence was gathered first (`03-EVIDENCE.md`, Claude Code 2.1.330 binary grepped 2026-11-23, git 2.43.0 and isomorphic-git 1.44.10 experiments).

---

## Shallow clones against TAGS-01 (Q10)

| Option | Description | Selected |
|--------|-------------|----------|
| A: Claude Code | Shallow clone; `ls-remote --tags` of the marketplace remote at install and update; fetch the chosen commit into the tag copy; NFR-5 amendment, offline proof test inverted | ✓ |
| B: Tag fetch at add and after each re-clone (recommended) | `fetch --depth 1 origin '+refs/tags/*:refs/tags/*'`; TAGS-01 stays a local read; no NFR-5 amendment; a tag pushed after the last update is not seen | |
| C: Full marketplace clones | No tag problem; diverges from upstream's clone shape; full history on every re-clone | |

**User's choice:** A, upstream parity (D-SG-09), 2026-11-23. The recommendation (B) was declined.

---

## Marketplace update model (Q9)

| Option | Description | Selected |
|--------|-------------|----------|
| A: Claude Code (recommended) | `ls-remote` freshness check, re-clone into staging, swap through `.bak` with recovery of an interrupted swap; marketplaces and plugin mirrors | ✓ |
| B: Keep D-14 on system git | `fetch --force` with explicit refspecs, `remote set-head --auto`, forced checkout, stale-lock cleanup, in-place normalization of old clones | |

**User's choice:** A (D-SG-10, supersedes D-14's mechanism, keeps its user-visible contract), 2026-11-23.

---

## `core.autocrlf` (Q14 part)

| Option | Description | Selected |
|--------|-------------|----------|
| A: Claude Code | Leave the user's setting alone; hash versions of path-source plugins change on CRLF hosts | ✓ |
| B: Write `core.autocrlf=false` into every clone (recommended) | Bytes as committed, as `isomorphic-git` wrote them; stable hash versions; invisible divergence | |

**User's choice:** A, upstream parity (D-SG-12), 2026-11-23. The consequence on Windows hosts with `autocrlf=true` (a one-time new hash version, possible disagreement between machines) is accepted.

---

## Device Flow interim (Q2, until Phase 5)

| Option | Description | Selected |
|--------|-------------|----------|
| A: Interim retry after an auth failure (recommended if Q2 is open) | Device Flow, `git credential approve`, one retry; loopback `CONNECT` proxy in the harness; a credential store or a one-shot helper for the install scenario | ✓ |
| B: Answer Q2 now (remove Device Flow, parity) | Rewrite `device-flow.feature`; pulls Phase 5's blast radius into this phase | |
| C: Mark the Device Flow scenarios pending | Violates the green-gate and behavioral-test rules | |

**User's choice:** A (D-SG-14), 2026-11-23. Phase 5 still answers Q2.

---

## Decided autonomously

[auto] [Old clones] — Q: "What happens to a clone that isomorphic-git made before the upgrade (Q5 part)?" → Selected: "D-SG-11: re-clone on the next network operation (comes with D-SG-10); the `.git`-copy checkout drops `core.symlinks` and `core.ignorecase`; nothing at load" (reversible technical — decided autonomously: internal migration with no user-visible surface) — alternatives: normalize in place on the first system-git operation; do nothing (fails SG-MIG-01).
[auto] [GitHub base URL] — Q: "What becomes of `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (Q8)?" → Selected: "D-SG-16: keep it as `-c url.<base>/.insteadOf=https://github.com/` on every remote command" (reversible technical — decided autonomously: internal mechanism, GHB-02 kept by git's credential keying) — alternatives: an explicit wire URL on every command; retire it (costly, would need the maintainer).
[auto] [State lock] — Q: "Where does the state lock sit during a clone (Q13)?" → Selected: "Around the clone, as D-04 and GIT-03 say; async spawn required; a concurrent Pi can get `StateLockHeldError` up to the timeout" (reversible technical — decided autonomously: a clone outside the lock can follow) — alternatives: clone outside the lock then re-check; bounded lock retries.
[auto] [Default branch] — Q: "How is the default branch tracked (Q14 part)?" → Selected: "Not tracked: no `origin/HEAD` reads once re-clone lands; `followRemoteHEAD` not relied on" (reversible technical — decided autonomously: no user-visible surface) — alternative: `remote set-head origin --auto` in an in-place refresh.
[auto] [Timeout] — Q: "Which timeout bounds a git command (Q15)?" → Selected: "D-SG-13: `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` as upstream (finite above 0, cap 2147483647, default 120 000 ms) for every clone, fetch, and `ls-remote`, plugin clones included, one limit per command" (reversible technical — decided autonomously: a constant and one variable read) — alternative: also 600 s per command for explicit plugin installs, as upstream (evidence correction C1).
[auto] [Keep on failure] — Q: "How does `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` work (Q16 part)?" → Selected: "D-SG-15: as upstream (`1|true|yes|on`, only on `unreachable` with an existing `.claude-plugin/marketplace.json`; reported unchanged with a warning note)" (reversible technical — decided autonomously: one variable read and one outcome kind) — alternative: read it but report nothing.
[auto] [Symlinks] — Q: "Adopt upstream's symlink-free copy, and do NFR-10 checks use `realpath` (Q19)?" → Selected: "Keep in-place roots and today's checks (lstat refusal for writes, `realpath` for reads per D-PL2-17); add an escaping-symlink fixture; no NFR-10 change" (reversible technical — decided autonomously: no new stage) — alternative: upstream's symlink-free copy (deferred).
[auto] [SHA pins] — Q: "How does a pinned plugin reach its commit?" → Selected: "Upstream's ladder: SHA and `-`-ref refusal before git runs; shallow SHA fetch, `--unshallow [origin <ref>]` on any failure, checkout, `HEAD` equals the pin; the v0 'unadvertised object' line gets a fitting kind" (reversible technical — decided autonomously: command order, same result as upstream) — alternative: add `-c protocol.version=2` (licensed by nothing).
[auto] [Name matchers] — Q: "What replaces the isomorphic-git name matchers?" → Selected: "`instanceof GitCommandError` kinds per the evidence table (`commit-missing`, `local-ref-missing`, or `rev-parse --verify --quiet` with `allowExit: [1]`)" (reversible technical — decided autonomously: internal error narrowing).

## Claude's Discretion

- Credential-store Given or one-shot helper for the Device Flow install scenario; how the copy step drops the old keys and whether it drops `core.filemode`; the replacement read in `resolveFetchedRefOffline`; staging and `.bak` names; plugin submodule flags; the wave split.

## Deferred Ideas

- Symlink-free plugin copy: Phase 7 or later. Clone outside the lock: only on reported contention. Device Flow's fate: Phase 5. SSH probe and transport retry: Phase 4. Wording: Phase 6. `core.autocrlf=false` and a tag fetch at add: declined.

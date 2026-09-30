# Milestones

## any-git-host -- Any Git Host (Completed: 2026-09-30; merged to main 2026-09-30 via PR #221, not yet in an npm release)

**Phases completed:** 3 phases (1-3), 11 plans, 29 tasks

**Driver:** PR #153 (jstillwa) surfaced three real defects. They were reimplemented
here rather than merged. The PR's two Codex-layout fallbacks
(`.agents/plugins/marketplace.json`, `.codex-plugin/plugin.json`) were left out:
the project keeps parity with Claude Code marketplaces, and Claude Code 2.1.274
reads neither path. PR #153 stays open with a comment explaining what landed.

**Key accomplishments:**

- A private https source on any git host clones with the credential already in the user's git credential helper. No hostname was added to the provider registry: every host without Device Flow takes the stored-credential path, and `github.com` / `gitlab.com` keep their Device Flow unchanged.
- A credential goes only to the host it was looked up for. `onAuth` cancels on a host mismatch, and `platform/git.ts` follows redirects itself, dropping credential headers on any hop that changes scheme, host or port (`simple-get` compared hostnames only).
- A `url` source clones at the URL the user typed, with exactly one network attempt per operation. `.git` is appended only where Claude Code appends it, and the cache identity is unchanged, so no warm clone cold-misses.
- `marketplace add` recovers from its own leftover clone after a crash or state rebuild. A foreign or non-git tree still refuses as `{stale clone}`, an unreadable one as `{permission denied}` or `{unreadable}`, and an unremovable one fails with the leak reported and no state entry.
- The marketplace autoupdate cascade authenticates plugin updates instead of cloning authless on every host (D-3-04).

**Closeout:** verified close. 10/10 requirements; all three phases re-verified
`passed` against the final tree after post-verification review fixes made them
stale; `threats_open: 0` on every phase; audit `tech_debt` with no blockers. The
open code-review findings are carried by `BACKLOG.md` GHRED-01 (redirect and
auth-callback edges) and GHADD-01 (leftover-recognition cleanups). Phases 2 and 3
were not Nyquist-validated.

---

# Phase 4 (Agents): Dubious Choices Log

Phase log for the child session running Phase 4 of `component-features`, in the
shape of the root `.planning/DUBIOUS-CHOICES.md`. The parent merges these
entries into the root file. Severity and status follow the root file's rules.

## Entries

### P4-DC-01: Commit attribution names this child session

- **Phase / source:** Phase 4 child session, setup.
- **Severity:** Low. **Status:** open.
- **Choice:** Commit trailers use this session's own `Claude-Session` URL
  (`session_01EDUMG75mZrbnf4k1GJQjc9`), as the session's attribution notice
  says, not the parent's URL that `CHILD-SESSION-BRIEF.md` prints.
- **Alternatives:** Copy the brief's trailer exactly.
- **Why dubious:** The brief says "exactly"; the parent may grep for its own
  URL.

### P4-DC-02: Upstream probes read host token files

- **Phase / source:** upstream research subagent (discuss step).
- **Severity:** Medium (process/security). **Status:** open.
- **Choice:** The Claude Code 2.1.316 probes ran under `env -i` with a fresh
  HOME and config dir, but the binary reads the hard-coded
  `/home/claude/.claude/remote/.oauth_token` and `.session_ingress_token`
  regardless. All 52 captured requests went to the local stub; no auth
  header was saved; no credential files were written. Found after the last
  probe; no probe ran afterwards. The subagent also added
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` and `TMPDIR`, and edited only
  the probe's own `.claude.json` to reach the trust dialog.
- **Why dubious:** The compat-research skill requires full isolation; it was
  not achievable. Future probes should run where `/home/claude/.claude/remote`
  does not exist or is unreadable.

### P4-DC-03: Discuss decisions settled without the user

- **Phase / source:** Phase 4 smart discuss (`04-CONTEXT.md`, D-CF4-01..14).
- **Severity:** High for items 1-4, Medium for 5-7, Low for the rest.
  **Status:** open.
- **Items:**
  1. **D-CF4-04 (skill preload, XK-01):** the bridge inlines preloaded skill
     content into the agent's system prompt, because pi-subagents passes only
     a path. Upstream puts it in the child's first user message. A skill
     update now needs the agent re-staged (same install, so it happens), and
     the generated agent file grows by each preloaded skill.
  2. **D-CF4-05 (`async`):** every non-MCP bridged agent now emits
     `async: false` (foreground default, as upstream), changing behavior for
     users who relied on pi-subagents' async default; `background: true`
     emits `async: true`. MCP-granted agents are left alone for Phase 6.
  3. **D-CF4-14 (`advertise: true`):** bridged agents enter the parent system
     prompt, which changes every parent prompt with pi-subagents loaded and
     may break sibling phases' whole-prompt comparisons at merge.
  4. **D-CF4-09 (trust):** the untrusted-project refusal is kept as a Pi-gap
     divergence (upstream runs plugin agents untrusted); the alternative of
     writing project agents into user scope was rejected.
  5. **D-CF4-01 (nested):** dotfiles and case-insensitive `.md` now load, as
     upstream; flattening nested segments with `-` can collide with a flat
     name (first wins, warns).
  6. **D-CF4-07 (`--map-model`):** targets refreshed to the 5.x model IDs
     upstream's first-party table names (account-dependent upstream).
  7. **D-CF4-03:** the fallback description text changes to upstream's.
  8. **D-CF4-10:** AGT-04 may close on a recorded gap instead of a scenario.
  9. **D-CF4-08:** the stale ANAME-02 "cannot narrow" warning is left for
     Phase 6 / the parent instead of fixed here.
- **Upstream evidence:** `04-UPSTREAM-AGENTS.md`; pi-subagents facts in
  `04-PI-SUBAGENTS.md`.

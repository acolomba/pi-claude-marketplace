# Phase 1: Foundations & Toolchain - Context

**Gathered:** 2026-05-09 **Status:** Ready for planning

## Phase Boundary

Atomic IO primitives, symlink-safe path containment, stable ES-5 marker constants, output-channel discipline, ESM/Node 24 baseline, CI matrix, and the architectural skeleton (9-folder layout with import-direction enforcement) that every subsequent phase builds on.

This phase ends with `npm run check` green, the new layout's empty folders + READMEs in place, and `extensions/claude-marketplace/index.ts` taking over from the current stub `extensions/claude-marketplace.ts`.

## Implementation Decisions

### Toolchain & CI

- **D-01:** CI tests against **Node 24 only** (single-version matrix). Justification: Node 24 satisfies write-file-atomic@^8's 22.22.2 floor, supports native TS strip via `node --test`, and removes the matrix maintenance overhead. Earlier Node ranges are out of scope.
- **D-02:** **Drop tsx**; tests run as `node --test "tests/**/*.test.ts"` directly. The `--import tsx` invocation V1 used is no longer needed on Node 24.
- **D-03:** **Adopt `write-file-atomic@^8`** as a runtime dependency, used **only for JSON files** (state.json, mcp.json, agents-index.json). Hand-rolled tmp+rename remains for staging directories (Phase 3's bridges have a different problem shape).
- **D-04:** **Phase 1 fully rewires `package.json`**: update `pi.extensions` to `./extensions/claude-marketplace/index.ts` (the new directory entrypoint), update test globs to match the new layout, and bump `typebox` 1.1.34→1.1.38, `prettier` 3.6.2→3.8.3, `globals` 17.5.0→17.6.0. Phase 1 ends with `npm run check` actually green -- not merely "ready to be green later."
- **D-05:** **Pin `@mariozechner/pi-coding-agent` peer-dep floor** to a defensible version (research recommends `>=0.70.6` or `>=0.73.1` if Phase 7 confirms compatibility). Eliminates V1's `*` declaration. Final pinned version is set in Phase 7 after the e2e suite verifies the surface; Phase 1 chooses an interim floor that matches the Pi version development is happening against.

### Output Discipline

- **D-06:** **ESLint `no-restricted-syntax`** in `eslint.config.js` blocks `process.stdout.write`, `process.stderr.write`, `console.log`, `console.warn`, `console.error`, `console.info` calls in `extensions/claude-marketplace/`. Sanctioned exception: `eslint-disable-next-line` at the single `migrateLegacyMarketplaceRecords` callsite (per IL-3). Pure config -- no custom rule code.
- **D-07:** **`ctx.ui.notify` wrapper uses severity-named helpers**: `notifySuccess(ctx, msg)`, `notifyWarning(ctx, msg)`, `notifyError(ctx, msg, cause?)`. Severity is part of the function name (typo-proof at compile time). The error variant's optional `cause` argument feeds `Error.cause` per ES-4. Callers MUST go through these -- direct `ctx.ui.notify` is allowed in the wrapper file only.
- **D-08:** **Single `shared/markers.ts`** module exports the 5 ES-5 strings as named consts: `PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `RELOAD_HINT_PREFIX`, `MANUAL_RECOVERY_REQUIRED`, `ROLLBACK_PARTIAL`. Single import site for all downstream code.
- **D-09:** **MARKERS snapshot test parses PRD §6.12 at runtime** (reads `docs/prd/pi-claude-marketplace-prd.md`, extracts marker strings via a stable regex, asserts `markers.ts` exports match byte-for-byte). PRD is ground truth per ES-5; the test catches drift in either direction (PRD edit OR markers edit).

### Module Layout

- **D-10:** **9-folder split** under `extensions/claude-marketplace/`: `edge/`, `orchestrators/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`. Folders are direct children of the extension dir (no extra `src/` wrapper) -- matches V1's pattern. Architecture-research-recommended layout, adopted from day one because there is no V1 source on this branch to migrate.
- **D-11:** **Strict ESLint `import-x` boundary rules** (`no-restricted-paths`) enforce layering: `edge/` may import from `orchestrators/`, `presentation/`, `shared/`; `orchestrators/` from `bridges/`, `domain/`, `transaction/`, `shared/`; `bridges/` from `domain/`, `persistence/`, `shared/`; `domain/` and `shared/` MUST NOT import upward. Violations fail CI. The seam is the value of the rename -- without enforcement, the layout is just cosmetic.
- **D-12:** **Phase 1 scaffolds all 9 folders with placeholder READMEs**, each explaining the folder's purpose, allowed imports, and a planned-contents TODO list. Boundary rules wired up for all 9 even though most are empty. Subsequent phases just add files -- no scaffold work in any later phase.
- **D-13:** **Replace `extensions/claude-marketplace.ts` (current stub) with `extensions/claude-marketplace/index.ts`** (the new directory entrypoint). The stub's two registered tools (`claude_marketplace_list` + the slash command) get re-implemented inside the new layout in later phases; Phase 1's index.ts is a thin entrypoint that sets up the `pi.registerCommand`/`pi.registerTool` surface and delegates to `edge/` modules (which will be empty at end of Phase 1, populated by Phase 6).

### Path Safety (Symlink Handling)

- **D-14:** **Refuse all symlinks** -- `assertPathInside` uses `fs.lstat()` (not `stat()`) on every component; if any component is a symlink, throw `SymlinkRefusedError` (a subclass of `PathContainmentError`). Strictest defense against the Pitfall #2 attack surface (a malicious or careless plugin using a symlink to escape the scope root). PRD doesn't specify symlink behavior -- this is new contract beyond V1.
- **D-15:** **Check site is `assertPathInside` (single chokepoint)**. Every PS-1 callsite gets the new symlink check for free. One audit surface, one test surface. Contrast with per-bridge wrappers, which would erode (forgetting one call is a regression).
- **D-16:** **Walk every parent component** from the boundary down to the target. Catches the case where a parent dir is a symlink, not just the leaf. Per-component lstat cost is negligible compared to the IO already happening. Standard defense against symlink-via-parent attacks.
- **D-17:** **`SymlinkRefusedError extends PathContainmentError`** -- inherits PI-14 handling (NOT folded into "rollback partial" line; propagates loudly). Distinct `instanceof` check available when distinguishing matters. Error message includes the offending link path AND its resolved target.

### Git Library / Packaging

- **D-18:** **Adopt `isomorphic-git`** as a runtime dependency for all git operations (clone, fetch, pull, checkout, ref resolution). Drops the `git` CLI dependency entirely. ~2-3 MB to node_modules but eliminates command-injection surface, regex-on-stderr error parsing brittleness, and `git not found on PATH` failure mode. Sparse checkout (PRD §11 deferred) is also unsupported by isomorphic-git, so the trade-off is acceptable.
- **D-19:** **HTTP transport: `isomorphic-git/http/node`** -- the Node-specific adapter shipped with isomorphic-git. Wraps Node's `https` module. Zero extra deps, well-tested. (Custom fetch adapter only if Phase 7's telemetry hooks demand middleware.)
- **D-20:** **Wrapper at `platform/git.ts`** -- git is an external system surface, not application logic. Marketplace orchestrators (Phase 4) import from `platform/git` for clone/fetch/pull. Other layers do not import git directly.
- **D-21:** **MA-7 is removed from REQUIREMENTS.md** -- its failure mode (`'git' not found on PATH`) no longer exists with isomorphic-git. REQUIREMENTS.md gets a note marking MA-7 as "removed: superseded by isomorphic-git adoption (Phase 1 D-18)". A new Key Decision is added to PROJECT.md noting the supersession. This is a deliberate user-contract change, not a contract erosion.

### Claude's Discretion

The user said "You decide" on these, captured here so downstream agents know Claude has flexibility within the locked decision:

- **D-06** (ESLint `no-restricted-syntax` vs custom rule): Claude chose `no-restricted-syntax` -- simplest mechanism that gets the job done. Escalation to a custom rule is allowed only if the disable-comment pattern erodes (e.g., people copy-pasting it accidentally).
- **D-07** (notify wrapper shape): Claude chose severity-named helpers -- strongest typed surface that prevents severity-string typos.
- **D-09** (MARKERS snapshot source): Claude chose parse-PRD-at-runtime -- the PRD is the authoritative user contract per ES-5; if PRD changes, the test catches it.
- **D-16** (symlink check depth): Claude chose walk-every-parent -- catches parent-dir symlink escapes; per-component cost is negligible.
- **D-21** (MA-7 fate): Claude chose remove-from-REQUIREMENTS + Key Decision -- honest reflection of the new contract.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary spec

- `docs/prd/pi-claude-marketplace-prd.md` -- V1 PRD; authoritative spec for the successor
- `docs/prd/pi-claude-marketplace-prd.md` §6.10 (Path Safety & Containment) -- PS-1..5 govern D-14 through D-17
- `docs/prd/pi-claude-marketplace-prd.md` §6.11 (Atomic Staging) -- AS-1/4/5 in scope; AS-2/3/6/7 land in Phase 5
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 (Error Surfaces) -- ES-1..5 govern D-06 through D-09; §6.12 is the source of truth for the snapshot test
- `docs/prd/pi-claude-marketplace-prd.md` §6.13 (I18n & Logging) -- IL-1..5 govern output discipline
- `docs/prd/pi-claude-marketplace-prd.md` §10 (NFRs) -- NFR-1/4/6/9/10 land in Phase 1; NFR-7/12 in Phase 2; NFR-11 finalized in Phase 7
- `docs/prd/pi-claude-marketplace-prd.md` §5.1.1 MA-7 -- superseded by D-18/D-21; do NOT implement

### Project planning

- `.planning/PROJECT.md` -- Project context; Key Decisions table will gain the MA-7 supersession entry
- `.planning/REQUIREMENTS.md` -- All 200 v1 REQ-IDs; MA-7 to be marked "removed: superseded by D-18/D-21"
- `.planning/ROADMAP.md` -- Phase 1 goal, success criteria, dependencies
- `.planning/STATE.md` -- Current position, blockers, deferred items

### Research foundation

- `.planning/research/STACK.md` -- Stack recommendations including `write-file-atomic@^8`, `node:test`, `tsx` deprecation rationale
- `.planning/research/ARCHITECTURE.md` -- 9-folder layout rationale, import-direction enforcement, V1 carry-forward analysis
- `.planning/research/PITFALLS.md` -- Pitfall #2 (symlink bypass) is D-14's motivator; Pitfalls #1 (atomicity vs durability) and #15 (notify discipline) are D-03 and D-06's motivators
- `.planning/research/SUMMARY.md` -- Cross-research synthesis; recommends MARKERS.ts module (D-08) and Phase ledger primitive (Phase 2 scope, not Phase 1)

### Library docs (planner should pull current versions)

- `write-file-atomic` (npm) -- engines `^22.22.2 || ^24.15.0 || >=26.0.0` matters for D-03
- `isomorphic-git` (npm + isomorphic-git.org docs) -- clone/fetch/pull surface for D-18
- `eslint-plugin-import-x` `no-restricted-paths` rule docs -- D-11 enforcement mechanism
- `@mariozechner/pi-coding-agent` `dist/core/extensions/types.d.ts` -- D-05 floor pinning depends on this

## Existing Code Insights

### Reusable Assets

- **`extensions/claude-marketplace.ts` (current stub)** -- Two registered surfaces (`claude_marketplace_list` tool + `claude-marketplace:list` command), both returning "not implemented yet". Phase 1 deletes this file and replaces it with `extensions/claude-marketplace/index.ts` (a directory entrypoint). The stub's `pi.registerTool` / `pi.registerCommand` invocation pattern is a useful reference for the new entrypoint's shape.
- **V1 source on `features/initial`** at `extensions/claude-marketplace/{agent,commands,location,marketplace,mcp,plugin,presentation,resource,state,transaction}/` -- Reference for behavior and edge cases. Architecture-research already extracted the relevant patterns. Planner should `git show features/initial:extensions/claude-marketplace/<file>` only when implementing the same concern, not as wholesale model.

### Established Patterns

- **TypeScript strict + ESM** -- `package.json` declares `"type": "module"`, `tsconfig.json` is strict, ESLint flat config in `eslint.config.js`. New code follows. Phase 1 doesn't introduce new patterns here.
- **Pre-commit hook chain** -- `.pre-commit-config.yaml` runs unicode-dash normalization, smartquote fix, mdformat, markdownlint-cli2, etc. on every commit. New planning/source files MUST conform. Already excludes `.claude/` via the linter exclusion commit (`a938c30`); the `.planning/` directory is excluded from `check-added-large-files` (added in `2432324`).
- **`npm run check` pipeline** -- `npm run typecheck && npm run lint && npm run format:check && npm test`. After Phase 1's package.json rewire (D-04), all four MUST pass.

### Integration Points

- **`package.json` `pi.extensions`** -- Phase 1 rewires this to `./extensions/claude-marketplace/index.ts`. Pi loads the extension via this pointer at runtime.
- **`package.json` `test` script glob** -- Currently `tests/{agent,commands,helpers,location,marketplace,mcp,plugin,presentation,resource,state,transaction}/**/*.test.ts` (V1 paths). Phase 1 rewires to `tests/**/*.test.ts` (or equivalent for the new layout's test directory structure).
- **`eslint.config.js`** -- Phase 1 adds the `no-restricted-syntax` rules (D-06) and the `import-x/no-restricted-paths` boundary rules (D-11). Doesn't replace; extends.
- **`.gitignore`** -- Already configured. No Phase 1 additions expected.

## Specific Ideas

- **PRD-as-snapshot-fixture** (D-09) -- Worth lifting into a reusable test helper (`tests/helpers/prd-extract.ts`) so future phases can verify their own marker strings against the PRD without reimplementing the parse. Phase 1 establishes the helper; later phases reuse.
- **9-folder boundary tests** -- Consider a dedicated `tests/architecture/import-boundaries.test.ts` that asserts `eslint.config.js` actually emits the expected restrictions (i.e., the rules don't silently misconfigure). Defends D-11 from regression when ESLint plugin versions change.
- **Git fixture strategy** -- isomorphic-git tests typically use `memfs` for in-memory git repos. Phase 1 adopts this so git tests don't require disk IO (faster, hermetic). Reference: isomorphic-git's own test suite.

## Deferred Ideas

- **Custom ESLint rule** for output discipline (vs `no-restricted-syntax`) -- escalation path if D-06's disable-comment pattern erodes. Logged here for future audit.
- **Telemetry hooks** in the git wrapper (D-19) -- IL-5's "structured event channel" successor concern; D-19's choice of the standard adapter leaves room for swapping later.
- **isomorphic-git capability gaps** -- sparse checkout (PRD §11 deferred), shallow clones (defer until needed). Track here so Phase 4's marketplace orchestrator doesn't re-research.
- **Custom fetch adapter** (D-19 alternative) -- only if Phase 7 wants to inject auth headers, telemetry, or retry logic. Not Phase 1.
- **`min-release-age` and supply-chain hardening** -- 2026 npm ecosystem trend (per FEATURES research). Successor concern; not Phase 1.

______________________________________________________________________

*Phase: 1-Foundations & Toolchain* *Context gathered: 2026-05-09*

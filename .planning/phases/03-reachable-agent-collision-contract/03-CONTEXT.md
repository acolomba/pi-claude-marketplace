# Phase 3: Reachable Agent Collision Contract

Recorded 2026-09-14 from the active user decision and orchestrator scope.

## Decisions

- **D-01 — Preserve exact source identity.** User: “Match Claude: keep both agents and migrate owned names.” Agent names append the complete validated source name to `pi-claude-marketplace-<plugin>-`. For plugin `acme`, `reviewer` and `acme-reviewer` remain distinct. Skill and command naming stay governed by their existing rules.
- **D-02 — Migrate through existing lifecycle operations.** Update and reinstall reconcile old indexed generated filenames to the exact-source filenames. Preserve other owners and unrelated content at a newly claimed target. Preserve the existing distinctions between update recovery, reinstall rollback, and reinstall's explicit overwrite of previous plugin-owned targets.
- **D-03 — Keep the supported directory adapter.** Within and across its ordered directory inputs, the first discovered exact agent name wins and later exact duplicates warn. Keep deterministic per-directory traversal. Do not claim that Pi's directory ordering implements Claude's custom-file replacement behavior.
- **D-04 — Preserve quality and the completed repair.** Preserve 100% aggregate unit production coverage, complete assertions, current direct-pair requirements, this branch, and unrelated edits. Preserve 03-01-PLAN.md, 03-01-SUMMARY.md, and the validated nonempty tool mapping. No exclusions, reduced thresholds, test-only exports, or mechanical helper modules.
- **D-05 — One reachable collision policy.** Remove the unreachable converter collision assertion and its manufactured-array tests. Prove duplicate behavior through real discovery and staging; warnings name both full paths and identify the retained source. Reconcile AG-12, RN-1, RN-6, live comments, and test descriptions.

## Agent Discretion

- Add the narrow missing commit-target ownership check before any previous-file removal. Reuse existing filesystem and index facilities.
- Select complete warning wording and fixtures. Keep source names, winner/loser paths, and generated name explicit.
- Do not turn the update path into reinstall's backup transaction. Test each public operation's established failure and recovery result.

## Deferred Ideas

These are research alternatives outside the authorized collision change, not requirements omitted from it:

- Replace the directory adapter with Claude's ordered custom-file manifest model.
- Eagerly scan dormant installs for renaming outside update/reinstall.

## Existing Evidence

03-RESEARCH.md contains the Claude Code 2.1.270 probes. 03-01-SUMMARY.md records the restored aggregate baseline: 63,343/63,343 production lines, 1,851/1,851 functions, and 9,111/9,111 branches. Those historical counts describe that measured tree; final counts must be measured again after the changes.

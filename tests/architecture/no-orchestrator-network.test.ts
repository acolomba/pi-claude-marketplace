import test from "node:test";

import { assertNoForbiddenSurface } from "../helpers/source-scan.ts";

/**
 * NFR-5 / PI-2 / PL-3 / PRL-07 architectural surface guard.
 *
 * Forbidden surface:
 *   Every file named in the `FORBIDDEN_TARGETS` array below MUST NOT import
 *   `gitOps` / `platform/git` / `DEFAULT_GIT_OPS`, nor reference
 *   `refreshGitHubClone`. That array is the authoritative target list and
 *   every entry carries its own rationale beside it, so the set is NOT
 *   restated here -- a hand-maintained second copy of an annotated list only
 *   drifts out of step with it.
 *
 *   What the gate covers, in general terms: every module that must NAME no git
 *   surface of its own. That is a narrower claim than "performs no network
 *   operation", and the membership splits two ways. Most targets are
 *   network-free by contract -- the read surfaces (`list`, plugin `info`,
 *   marketplace `info`), the reconcile pending/planner/projection family,
 *   `reinstall` (cached manifests only), and one file OUTSIDE the orchestrator
 *   layer, the resolver, whose obligation is inherited from the two read
 *   surfaces it answers for. The other three are MUTATING verbs that do reach
 *   git -- `install.ts` and `fetch.ts` materialize a clone on a cache miss, and
 *   `enable-disable.ts` re-materializes through the install ledger -- and they
 *   qualify because they reach it ONLY through the `clone-cache.ts` seam, by
 *   entrypoint name. None of the three is read-only.
 *
 * Exempt files (do NOT add):
 *   - orchestrators/plugin/update.ts
 *     PUP-2 syncClone REQUIRES gitOps; the orchestrator legitimately imports
 *     `GitOps` via the `orchestrators/marketplace/shared.ts` re-export
 *     (Pattern S-9). Adding it here would break update.
 *   - orchestrators/plugin/uninstall.ts is implicitly clean (no git surface
 *     today) but is not gated here -- gating install + list covers the NFR-5
 *     orchestrator-tier obligation.
 *
 * Skip-path rationale:
 *   The test skips ENOENT targets
 *   with an informational marker so this gate can land before implementation.
 *   Once a target file exists, assertions fire.
 *
 * Why this test is NOT replaceable by a fallow boundary rule (measured):
 *   Planting `import { clone } from "platform/git.ts"` plus a `clone()` call
 *   in install.ts was observed leaving `npm run fallow` at exit 0, while this
 *   test failed. Three reasons, each independent:
 *     1. `orchestrators` -> `platform` is a LEGAL edge -- update.ts,
 *        clone-cache.ts and auth-host.ts all need it -- so an import rule at
 *        zone granularity cannot forbid it for three files only.
 *     2. Splitting a narrow `orchestrators-network-free` zone out was tried and
 *        produces 26 false violations, because the two halves legitimately
 *        import each other. Allowing them back lets `DEFAULT_GIT_OPS` reach
 *        install.ts through the `marketplace/shared.ts` re-export anyway, so
 *        the rule would enforce nothing.
 *     3. `platform/git.ts` and `platform/pi-api.ts` share a directory, and
 *        install.ts legitimately imports the latter. Fallow zones are
 *        directory-scoped, so they cannot separate the two.
 *   `boundaries.calls.forbidden` catches a CALL; this gate additionally
 *   catches an IMPORT and a bare `gitOps` field declaration, which is the
 *   surface NFR-5 actually cares about. Keep this test.
 *
 * stripComments rationale (mandatory):
 *   Source files include header docstrings that legally mention the forbidden
 *   symbols (e.g. "MUST NOT import platform/git"). Without `stripComments`,
 *   the assertion would fail on prose.
 */
const FORBIDDEN_TARGETS: ReadonlyArray<string> = [
  // NFR-5 (amended): install.ts carries ZERO git surface of its own. A
  // git-source (url / git-subdir / github) clone is delegated to the
  // clone-cache.ts sibling seam -- a gitOps consumer outside this gate's
  // candidate set, where the git surface legally lives -- which install
  // imports by entrypoint name (`materializePluginClone` / `resolvePluginPin`)
  // and never names `gitOps`. install reads the cached manifest with no
  // network sync of its own; the only network touch is the cache-miss clone
  // inside the seam.
  "extensions/pi-claude-marketplace/orchestrators/plugin/install.ts",
  // PL-3 + NFR-5: list is read-only against state + manifest; no network.
  "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
  // PRL-07: reinstall uses cached manifests only -- which is also why
  // refreshGitHubClone is one of the gated patterns.
  "extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts",
  // INFO-02 + NFR-5: info is a read-only seam over the local state + on-disk
  // marketplace manifests; no network.
  "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts",
  // INFO-01 + NFR-5: marketplace info is read-only against local state +
  // marketplace.json; no network.
  "extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts",
  // DIFF-01 SC #2: the reconcile pending/planner/projection
  // family is read-only and pure. pending.ts is the user-facing orchestrator;
  // plan.ts + notify.ts are belt-and-braces (plan.ts also has the stricter
  // reconcile-planner-purity gate -- this is cheap defensive cover).
  "extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts",
  "extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts",
  // ENBL-03: the enable/disable orchestrator re-materializes from cache
  // -- NO network.
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
  // FTCH-01: fetch reaches git ONLY through the clone-cache.ts seam (by
  // entrypoint name), install-style. It names zero gitOps surface, so it is
  // locked here permanently. It is NOT exempt: among the gated orchestrator
  // candidates, update.ts is the only file allowed the gitOps surface (seam
  // files such as clone-cache.ts sit outside this gate's candidate set).
  "extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts",
  // NFR-5 / OUT-05: the resolver now answers a question for `list` and `info`,
  // two surfaces that are network-free by contract, so the file that answers it
  // inherits their obligation. It carries no git surface today, which is exactly
  // why the gate is cheap here -- it is defense in depth, and it is the
  // STRUCTURAL half of the network-free guarantee. The behavioral half can only
  // show that no call happened on the paths a test exercises; it can never show
  // the surface is absent.
  "extensions/pi-claude-marketplace/domain/resolver.ts",
];

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
  { name: "DEFAULT_GIT_OPS reference", pattern: /\bDEFAULT_GIT_OPS\b/ },
  { name: "gitOps reference", pattern: /\bgitOps\b/ },
  { name: "refreshGitHubClone reference", pattern: /\brefreshGitHubClone\b/ },
];

test("NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface", async () => {
  // The read / stripComments / offender-accumulate mechanic lives in
  // tests/helpers/source-scan.ts so this gate and the COMPAT-01 no-expansion
  // gate share one implementation (D-98-09). The target list, the pattern list,
  // and this failure message stay owned here.
  await assertNoForbiddenSurface(
    FORBIDDEN_TARGETS,
    FORBIDDEN_PATTERNS,
    (offenders) =>
      `NFR-5 / PI-2 / PL-3 / PRL-07 violation: gitOps surface detected in network-free module(s):\n  ${offenders.join("\n  ")}\n  (every gated target is network-free by contract; among the gated orchestrator candidates, only update.ts is permitted to import gitOps via Pattern S-9.)`,
  );
});

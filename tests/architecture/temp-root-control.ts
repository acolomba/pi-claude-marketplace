/**
 * The shared temp-root offender mechanic for the file-scanning architecture
 * gates.
 *
 * D-07-01: a gate proves it fires by copying its REAL targets into a hermetic
 * `mkdtemp` root, mutating one copy, and running the real scan against that
 * injected root. Deriving the offender from the real file is the point -- a
 * hand-authored offender drifts away from the target it claims to represent,
 * and drift is how a gate goes quiet without anyone noticing.
 *
 * D-07-04: the same mechanic supplies both benign controls. An unmutated copy
 * proves the gate is not simply failing everything, and a copy carrying the
 * forbidden token inside a comment proves comment-stripping and pattern
 * precision.
 *
 * The mechanic lives in one module because `.fallowrc.json` sets
 * `duplicates.threshold: 3`: the `mkdtemp` / `mkdir -p` / `copyFile` /
 * mutate / `rm -rf` sequence written inline in three gates is a reportable
 * clone. The four functions are deliberately separate rather than one composite
 * because Fallow's `health.maxUnitSize: 60` and `maxCognitive: 15` apply to
 * `tests/**` while ESLint's cognitive rule does not, so a green `npm run lint`
 * is no evidence for anything here.
 *
 * Every write path is joined from the caller's `root`, which is always a
 * `mkdtemp` return value, and disposal removes that value and nothing composed
 * from it.
 *
 * This file registers no case of its own.
 */

import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { REPO_ROOT } from "./source-scan.ts";

/**
 * Run `body` against a fresh temporary root and remove that root afterwards.
 *
 * One root per case, never a module-level fixture shared across cases: two
 * cases sharing a root can only be run in one order, and the second inherits
 * whatever the first planted.
 */
export async function withTempRoot(
  prefix: string,
  body: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));

  try {
    await body(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

/**
 * Copy every repository-relative `targets` entry into `root`, creating each
 * entry's directory chain first.
 *
 * The copies are byte-identical to the real files, so a scan run against `root`
 * with nothing else planted is the benign control (D-07-04).
 */
export async function materializeTargets(
  root: string,
  targets: ReadonlyArray<string>,
): Promise<void> {
  for (const rel of targets) {
    const destination = path.join(root, rel);

    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(REPO_ROOT, rel), destination);
  }
}

/** Overwrite `target`'s copy under `root` with the real file plus `appended`. */
async function appendToCopy(root: string, target: string, appended: string): Promise<void> {
  const real = await readFile(path.join(REPO_ROOT, target), "utf8");

  await writeFile(path.join(root, target), `${real}\n${appended}\n`, "utf8");
}

/**
 * Plant a violation: `target`'s copy under `root` becomes the real file plus
 * `appended`, which is expected to be a line of real code the gate forbids.
 */
export async function plantOffender(root: string, target: string, appended: string): Promise<void> {
  await appendToCopy(root, target, appended);
}

/**
 * Plant a near-miss: `target`'s copy under `root` becomes the real file plus a
 * line COMMENT carrying `token`.
 *
 * A gate that fails here has stopped stripping comments, which would make it
 * fail on its own subjects' prose rather than on their code.
 */
export async function plantBenignNearMiss(
  root: string,
  target: string,
  token: string,
): Promise<void> {
  await appendToCopy(root, target, `// ${token}`);
}

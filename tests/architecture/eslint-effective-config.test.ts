/**
 * OBS-01 / IL-2 / IL-3: the console-exemption gate, read from the ESLint
 * configuration that actually applies.
 *
 * The obligation is closed: exactly three extension modules may write to the
 * console, and every other one may not. Only a full sweep can prove a closed set
 * is complete, so this gate resolves `no-console` for every `.ts` file under the
 * extension tree and compares the resulting exempt set against the registry.
 *
 * GGAT-03: the superseded form of this gate read `eslint.config.js` as text and
 * collected the `files` arrays that literally spelled the extension path. It was
 * measured green against a blanket `files: ["**\/*.ts"]` block turning
 * `no-console` off everywhere -- the block it needed to see was the one block its
 * own filter discarded. Resolving the configuration instead removes the class:
 * ESLint applies its cascade and reports the severity, whatever shape the block
 * that set it had.
 */

import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  assertSingleAppendedBlock,
  BLANKET_NO_CONSOLE_OFF,
  resolveEffectiveConfig,
  resolveEffectiveConfigs,
  RESTRICTED_PATHS_OFF,
  ruleSeverity,
  ZONE_SUBSTITUTION,
  type AppendedBlocks,
} from "./eslint-effective-config.ts";
import {
  EXTENSION_ROOT_REL,
  NO_CONSOLE_EXEMPT_TARGETS,
  ZONE_REPRESENTATIVE_TARGETS,
} from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

/** The rule whose resolved severity carries the whole obligation. */
const NO_CONSOLE = "no-console";

/*
 * ESLint reports severities as the exact integers 0 (`off`), 1 (`warn`), and 2
 * (`error`), already normalised from the string forms. Every comparison below is
 * a strict `===` against one of those integers and never a truthiness test: 0 is
 * falsy, so a truthiness test cannot tell a rule that is switched off from a
 * rule that is absent, and those are different failures.
 */

/**
 * One registered exempt module, probed on its own for the low side of the
 * boundary.
 *
 * The annotation is the membership check, in the idiom the registry itself uses:
 * naming a path the group does not carry stops compiling, so this second
 * reference cannot drift away from the set it points into.
 */
const EXEMPT_PROBE: (typeof NO_CONSOLE_EXEMPT_TARGETS)[number] =
  "extensions/pi-claude-marketplace/shared/debug-log.ts";

/**
 * A module in an exempt module's own directory that is not itself exempt -- the
 * high side of the same boundary, one step away.
 */
const NEIGHBOUR_OF_AN_EXEMPT_MODULE: (typeof ZONE_REPRESENTATIVE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/shared/path-safety.ts";

/** An ordinary extension module, far from every exemption. */
const ORDINARY_EXTENSION_MODULE: (typeof ZONE_REPRESENTATIVE_TARGETS)[number] =
  "extensions/pi-claude-marketplace/domain/manifest.ts";

/** How one `no-console` sweep of the extension tree came out. */
interface NoConsoleSweep {
  /** Repository-relative paths resolving to severity 0, sorted. */
  exempt: string[];
  /** Repository-relative paths resolving to severity 1, sorted. */
  warned: string[];
  /** Repository-relative paths the rule does not reach at all, sorted. */
  absent: string[];
  /** How many files the sweep actually opened. */
  visited: number;
}

/** Every repository-relative `.ts` file under the extension tree, sorted. */
async function extensionSourceFiles(): Promise<string[]> {
  const root = path.join(REPO_ROOT, EXTENSION_ROOT_REL);
  const entries = await readdir(root, { recursive: true, withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name)))
    .sort();
}

/** Resolve `no-console` for the whole extension tree with `appended` in play. */
async function sweepNoConsole(appended: AppendedBlocks): Promise<NoConsoleSweep> {
  const files = await extensionSourceFiles();
  const configs = await resolveEffectiveConfigs(files, appended);
  const sweep: NoConsoleSweep = { exempt: [], warned: [], absent: [], visited: files.length };

  for (const file of files) {
    const severity = ruleSeverity(configs.get(file) ?? null, NO_CONSOLE);
    if (severity === 0) {
      sweep.exempt.push(file);
    } else if (severity === 1) {
      sweep.warned.push(file);
    } else if (severity === null) {
      sweep.absent.push(file);
    }
  }

  return sweep;
}

/**
 * The closed-set obligation, as one assertion.
 *
 * Written as a function rather than inline so an offender resolution can be
 * driven through the very same assertion the benign case uses. A gate that
 * "would fail" against an offender is a claim; running the real assertion
 * against it is evidence.
 */
function assertExemptSetIsClosed(exempt: ReadonlyArray<string>): void {
  assert.deepStrictEqual(
    [...exempt],
    [...NO_CONSOLE_EXEMPT_TARGETS],
    `OBS-01 / IL-2: the set of extension modules resolving \`no-console\` to off no longer matches NO_CONSOLE_EXEMPT_TARGETS. Console output belongs behind shared/notification-dispatch.ts; the only sanctioned exceptions are the debug trace channel and the load-time legacy-migration warning.`,
  );
}

test(
  "OBS-01: exactly the registered extension modules resolve no-console to off",
  { timeout: 60_000 },
  async () => {
    // arrange
    const benignControl: AppendedBlocks = [];

    // act
    const sweep = await sweepNoConsole(benignControl);

    // assert
    assert.ok(
      sweep.visited > 0,
      `the extension-tree walk rooted at ${EXTENSION_ROOT_REL} opened no .ts file at all, so every clause below would pass over nothing`,
    );
    assertExemptSetIsClosed(sweep.exempt);
    assert.deepStrictEqual(
      sweep.warned,
      [],
      "these extension modules resolve `no-console` to warn, which neither forbids console output nor exempts the file -- the extension tree is meant to resolve to error or to off",
    );
    assert.deepStrictEqual(
      sweep.absent,
      [],
      "`no-console` does not reach these extension modules at all, so they are unguarded rather than exempt -- a file outside every block carrying the rule is the failure an off-versus-absent collapse would hide",
    );
  },
);

test("IL-3: a registered exempt module resolves no-console to off", async () => {
  // act
  const exemptModule = await resolveEffectiveConfig(EXEMPT_PROBE);

  // assert
  assert.strictEqual(ruleSeverity(exemptModule, NO_CONSOLE), 0);
});

test("IL-2: a module beside an exempt one resolves no-console to error", async () => {
  // act
  const neighbour = await resolveEffectiveConfig(NEIGHBOUR_OF_AN_EXEMPT_MODULE);

  // assert
  assert.strictEqual(ruleSeverity(neighbour, NO_CONSOLE), 2);
});

test("D-07-10: every offender appends exactly one block to the real configuration", () => {
  // act & assert
  assertSingleAppendedBlock("blanket no-console off", BLANKET_NO_CONSOLE_OFF);
  assertSingleAppendedBlock("restricted-paths off", RESTRICTED_PATHS_OFF);
  assertSingleAppendedBlock("zone substitution", ZONE_SUBSTITUTION);
});

test(
  "GGAT-03: a blanket block disabling no-console flips the resolved severity and fails the gate",
  { timeout: 60_000 },
  async () => {
    // arrange
    assertSingleAppendedBlock("blanket no-console off", BLANKET_NO_CONSOLE_OFF);

    // act
    const ordinaryModule = await resolveEffectiveConfig(
      ORDINARY_EXTENSION_MODULE,
      BLANKET_NO_CONSOLE_OFF,
    );
    const sweep = await sweepNoConsole(BLANKET_NO_CONSOLE_OFF);

    // assert
    assert.strictEqual(
      ruleSeverity(ordinaryModule, NO_CONSOLE),
      0,
      "the blanket block did not reach an ordinary extension module, so this offender proves nothing",
    );
    assert.throws(
      () => {
        assertExemptSetIsClosed(sweep.exempt);
      },
      assert.AssertionError,
      "the closed-set assertion survived a configuration that exempts every file in the repository -- which is the configuration the superseded source scrape read as healthy",
    );
  },
);

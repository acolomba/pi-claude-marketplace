/**
 * The unused-type-member gate's wiring gate.
 *
 * MEMBER-01 / MEMBER-02: the gate itself is proved by executable controls that
 * run the real analyzer. Three properties those controls depend on are invisible
 * from inside them, and each one fails silently rather than loudly:
 *
 *   - the live sensitivity control plants a key the real declaration must NOT
 *     already carry, and a plant that collides with a real member stops being a
 *     plant without any case going red;
 *   - a gate script no `package.json` entry reaches is unreachable to
 *     `fallow dead-code`, which is how a whole analyzer module can go unowned;
 *   - every capability the command-line help CLAIMS needs a control that
 *     discriminates it, and a claim whose control was renamed away is a promise
 *     nothing keeps.
 *
 * GGAT-01: the claim-to-control ledger below is the declared half. Each row's
 * claim must appear in the help text the gate prints, and each named control
 * marker must appear verbatim in the file that is supposed to carry it, so a
 * renamed case or a dropped claim fails here instead of quietly widening what
 * the gate is believed to prove.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  EDGE_DEPS_OWNER_TEST_REL,
  EDGE_DEPS_REL,
  PACKAGE_JSON_REL,
  TYPE_MEMBER_GATE_REL,
  TYPE_MEMBER_NEGATIVE_REL,
  UNUSED_TYPE_MEMBER_GATE_TARGETS,
} from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

/** The key the live sensitivity control plants, which no real member may spell. */
const PLANTED_KEY = "neverReadAnywhere";

/** The interface the live sensitivity control plants into. */
const PLANTED_OWNER = "EdgeDeps";

const MODEL_SUITE = "tests/scripts/check-unused-type-members.model.test.ts";
const OPERATIONS_SUITE = "tests/scripts/check-unused-type-members.operations.test.ts";
const CLI_SUITE = "tests/scripts/check-unused-type-members.test.ts";

/**
 * One capability the gate's help text claims, and the controls that discriminate
 * it. `claim` is matched against the printed help with runs of whitespace
 * folded; each control marker is matched verbatim against its own file -- a case
 * title for a suite, a source literal for the executable runner.
 */
interface ClaimControls {
  readonly claim: string;
  readonly controls: ReadonlyArray<{ readonly file: string; readonly marker: string }>;
}

const CLAIM_CONTROLS: readonly ClaimControls[] = [
  {
    claim: "property and optional-chain access",
    controls: [
      {
        file: CLI_SUITE,
        marker: "reports an unread optional member by its exact declaration identity",
      },
      { file: TYPE_MEMBER_NEGATIVE_REL, marker: "neverReadAnywhere?.length" },
    ],
  },
  {
    claim: "element access under a literal or finite literal-union key",
    controls: [
      {
        file: MODEL_SUITE,
        marker: "literal and finite-union element access read the exact members they can reach",
      },
    ],
  },
  {
    claim: "binding and assignment destructuring",
    controls: [
      {
        file: MODEL_SUITE,
        marker:
          "binding destructuring reads the source member through renames, defaults and nesting",
      },
      { file: MODEL_SUITE, marker: "assignment destructuring reads the source member" },
    ],
  },
  {
    claim: "compound and update expressions",
    controls: [
      {
        file: MODEL_SUITE,
        marker: "compound assignment and update expressions keep the read of the old value",
      },
    ],
  },
  {
    claim: "exact `in` presence tests",
    controls: [
      {
        file: MODEL_SUITE,
        marker: "an exact existence test is a presence observation, not a value read",
      },
    ],
  },
  {
    claim: "JSON serialization",
    controls: [
      {
        file: OPERATIONS_SUITE,
        marker:
          "a record serialized through an unknown-typed wrapper is observed at its own declaration",
      },
      {
        file: OPERATIONS_SUITE,
        marker: "a toJSON member means the declared members are not what is serialized",
      },
    ],
  },
  {
    claim: "object spread and rest",
    controls: [
      { file: OPERATIONS_SUITE, marker: "a spread reads the source's own values and stops there" },
      {
        file: OPERATIONS_SUITE,
        marker: "a rest binding copies every key the pattern did not name",
      },
    ],
  },
  {
    claim: "Object.assign",
    controls: [
      {
        file: OPERATIONS_SUITE,
        marker: "Object.assign reads its sources and not the target it writes into",
      },
    ],
  },
  {
    claim: "Object.values and Object.entries",
    controls: [
      {
        file: OPERATIONS_SUITE,
        marker: "Object.values and Object.entries read the values they enumerate",
      },
      { file: OPERATIONS_SUITE, marker: "Object.keys enumerates names and reads no value at all" },
    ],
  },
  {
    claim: "Node's deep comparisons",
    controls: [
      {
        file: OPERATIONS_SUITE,
        marker: "a deep comparison of a production result observes it as a test-only read",
      },
      {
        file: OPERATIONS_SUITE,
        marker: "a typed expected literal written in a test proves no production consumption",
      },
    ],
  },
  {
    claim: "Declarations, type-only references and key enumeration are not reads",
    controls: [
      { file: MODEL_SUITE, marker: "indexed-access types, keyof and type queries read nothing" },
      {
        file: MODEL_SUITE,
        marker: "an object initializer writes its destination and reads nothing of it",
      },
      { file: MODEL_SUITE, marker: "key enumeration alone observes no member" },
      { file: MODEL_SUITE, marker: "a same-spelling member on an unrelated type earns no witness" },
    ],
  },
];

async function readRepoFile(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), "utf8");
}

test("the planted key is absent from the real declaration it is planted into", async () => {
  // arrange
  const declared = await readRepoFile(EDGE_DEPS_REL);

  // act
  const carriesPlantedKey = declared.includes(PLANTED_KEY);

  // assert
  assert.deepStrictEqual(
    { declaresOwner: declared.includes(`interface ${PLANTED_OWNER} {`), carriesPlantedKey },
    { declaresOwner: true, carriesPlantedKey: false },
    `${EDGE_DEPS_REL} must declare ${PLANTED_OWNER} and must not already spell ${PLANTED_KEY}; a plant that collides with a real member proves nothing.`,
  );
});

test("the benign read's receiver type is available in the owner test it is appended to", async () => {
  // arrange
  const owner = await readRepoFile(EDGE_DEPS_OWNER_TEST_REL);

  // act
  const importsReceiver = owner.includes(`import type { ${PLANTED_OWNER} }`);

  // assert
  assert.strictEqual(
    importsReceiver,
    true,
    `${EDGE_DEPS_OWNER_TEST_REL} must import ${PLANTED_OWNER} as a type; the benign overlay appends a probe that takes it as a parameter.`,
  );
});

test("every gate script is reachable from a package.json script entry", async () => {
  // arrange
  const manifest = JSON.parse(await readRepoFile(PACKAGE_JSON_REL)) as {
    scripts: Readonly<Record<string, string>>;
  };
  const declared = Object.values(manifest.scripts).join("\n");
  const gateScripts = UNUSED_TYPE_MEMBER_GATE_TARGETS.filter((rel) => rel.endsWith(".mjs"));

  // act
  const unreachable: string[] = [];
  for (const rel of gateScripts) {
    if (!declared.includes(rel)) {
      unreachable.push(rel);
    }
  }

  // assert
  assert.deepStrictEqual(
    unreachable,
    [],
    "A gate script no package.json entry names is unreachable to fallow dead-code, so its whole module can go unowned without a finding.",
  );
});

test("every capability the gate claims has a discriminating control", async () => {
  // arrange
  const printed = spawnSync(
    process.execPath,
    [path.join(REPO_ROOT, TYPE_MEMBER_GATE_REL), "--help"],
    {
      encoding: "utf8",
    },
  );
  assert.strictEqual(printed.status, 0, `--help failed: ${printed.stderr}`);
  // The help text is hard-wrapped, so a claim of more than a few words spans a
  // line break in the printed form and in the source alike. Folding runs of
  // whitespace lets a row state the whole phrase it means.
  const claimed = printed.stdout.replace(/\s+/g, " ");
  const sources = new Map<string, string>();
  for (const rel of new Set(CLAIM_CONTROLS.flatMap((row) => row.controls.map((one) => one.file)))) {
    sources.set(rel, await readRepoFile(rel));
  }

  // act
  const broken: string[] = [];
  for (const row of CLAIM_CONTROLS) {
    if (!claimed.includes(row.claim)) {
      broken.push(`${TYPE_MEMBER_GATE_REL} no longer states the claim: ${row.claim}`);
    }

    for (const control of row.controls) {
      if (!(sources.get(control.file) ?? "").includes(control.marker)) {
        broken.push(`${control.file} no longer carries the control: ${control.marker}`);
      }
    }
  }

  // assert
  assert.deepStrictEqual(
    broken,
    [],
    "A stated capability whose control was renamed away is a promise nothing keeps.",
  );
});

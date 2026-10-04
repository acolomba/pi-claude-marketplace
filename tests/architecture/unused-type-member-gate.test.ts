/**
 * The unused-type-member gate's wiring gate.
 *
 * MEMBER-01 / MEMBER-02: the analyzer tests in `tests/scripts/` prove what the
 * gate reports. Two properties those tests cannot see fail silently rather than
 * loudly:
 *
 *   - a gate script no `package.json` entry reaches is unreachable to
 *     `fallow dead-code`, which is how a whole analyzer module can go unowned;
 *   - every capability the command-line help CLAIMS needs a test case that
 *     discriminates it, and a claim whose case was renamed away is a promise
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
  PACKAGE_JSON_REL,
  TYPE_MEMBER_EXCEPTIONS_REL,
  TYPE_MEMBER_GATE_REL,
  UNUSED_TYPE_MEMBER_GATE_TARGETS,
} from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

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
  {
    claim: "An entry that matches no reported finding refuses the run",
    controls: [
      { file: CLI_SUITE, marker: "a recorded decision that matches no finding refuses the run" },
      {
        file: CLI_SUITE,
        marker:
          "a recorded decision at drifted coordinates refuses rather than excusing what now sits there",
      },
      {
        file: CLI_SUITE,
        marker: "a recorded decision naming a different member at the right coordinates refuses",
      },
    ],
  },
  {
    claim: "An unsupported finding can never be excused",
    controls: [
      {
        file: CLI_SUITE,
        marker: "an unsupported finding can never be excused by a recorded decision",
      },
    ],
  },
  {
    claim:
      "the identity field admits no pattern character, so the list cannot be widened by one row",
    controls: [
      { file: CLI_SUITE, marker: "an identity carrying a pattern character is refused" },
      {
        file: CLI_SUITE,
        marker: "an unknown field is refused, so a count or a threshold cannot be recorded",
      },
      { file: CLI_SUITE, marker: "a mechanism too short to state what was measured is refused" },
      { file: CLI_SUITE, marker: "a member outside the recorded decisions still fails the gate" },
    ],
  },
];

async function readRepoFile(rel: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, rel), "utf8");
}

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

// ---------------------------------------------------------------------------
// Activation: the gate in the mandatory quality path.
//
// MEMBER-01 / MEMBER-02: a gate nothing invokes is a gate nobody runs, and a
// gate whose residual list can be widened quietly is worse than no gate at all
// -- it buys confidence it has not earned. The cases below read the real
// `package.json`, the CI workflow and the real decision list. `npm run check`
// runs the gate, and CI runs `npm run check` on every run.
// ---------------------------------------------------------------------------

const CI_WORKFLOW_REL = ".github/workflows/ci.yml";

const GATE_SCRIPT = "lint:type-members";

/** The fields one recorded decision may carry, and no others. */
const EXCEPTION_FIELDS = ["id", "owner", "key", "decision", "mechanism"];

interface RecordedDecision {
  readonly id: string;
  readonly owner: string;
  readonly key: string;
  readonly decision: string;
  readonly mechanism: string;
}

async function readRecordedDecisions(): Promise<readonly RecordedDecision[]> {
  const parsed = JSON.parse(await readRepoFile(TYPE_MEMBER_EXCEPTIONS_REL)) as {
    schemaVersion: number;
    exceptions: readonly RecordedDecision[];
  };
  assert.strictEqual(parsed.schemaVersion, 1);
  return parsed.exceptions;
}

test("the check chain runs the gate", async () => {
  // arrange
  const manifest = JSON.parse(await readRepoFile(PACKAGE_JSON_REL)) as {
    scripts: Readonly<Record<string, string>>;
  };

  // act
  const checkMembers = (manifest.scripts.check ?? "").split(" && ");
  const wiring = {
    gateInCheck: checkMembers.includes(`npm run ${GATE_SCRIPT}`),
    gate: manifest.scripts[GATE_SCRIPT],
  };

  // assert
  assert.deepStrictEqual(
    wiring,
    { gateInCheck: true, gate: `node ${TYPE_MEMBER_GATE_REL}` },
    "npm run check runs the gate, and the gate script must invoke the real executable rather than a stand-in.",
  );
});

test("continuous integration runs the check chain", async () => {
  // arrange
  const workflow = await readRepoFile(CI_WORKFLOW_REL);

  // act
  const lines = workflow.split("\n").map((line) => line.trim());
  const runsCheck = lines.includes("run: npm run check");

  // assert
  assert.strictEqual(
    runsCheck,
    true,
    `${CI_WORKFLOW_REL} must invoke npm run check, so every pull request runs the member gate.`,
  );
});

test("every recorded decision names one exact member and states a measured mechanism", async () => {
  // arrange
  const decisions = await readRecordedDecisions();
  const identity = /^[^\s:*?[\]{}]+:[1-9][0-9]*:[1-9][0-9]*$/;

  // act
  const broken: string[] = [];
  for (const decision of decisions) {
    const fields = Object.keys(decision).sort((left, right) => left.localeCompare(right));

    if (!identity.test(decision.id)) {
      broken.push(`${decision.id} is not one exact member coordinate`);
    }

    assert.deepStrictEqual(
      fields,
      [...EXCEPTION_FIELDS].sort((left, right) => left.localeCompare(right)),
      `${decision.id} carries fields ${fields.join(", ")}; a count, a threshold or a path pattern cannot be recorded here.`,
    );

    if (decision.mechanism.length < 120) {
      broken.push(`${decision.id} states no measured mechanism`);
    }

    if (decision.decision.trim() === "") {
      broken.push(`${decision.id} names no recorded decision`);
    }
  }

  // assert
  assert.deepStrictEqual(
    broken,
    [],
    "The per-row exception list is the only sanctioned residual form, and every row must state the member and the mechanism that was measured.",
  );
});

test("every recorded decision still points at a live declaration spelling its member", async () => {
  // arrange
  const decisions = await readRecordedDecisions();

  // act
  const detached: string[] = [];
  for (const decision of decisions) {
    const at = decision.id.lastIndexOf(":", decision.id.lastIndexOf(":") - 1);
    const relative = decision.id.slice(0, at);
    const line = Number(decision.id.slice(at + 1, decision.id.lastIndexOf(":")));
    const source = (await readRepoFile(relative)).split("\n")[line - 1];

    if (source?.includes(decision.key) !== true) {
      detached.push(`${decision.id} does not land on a line spelling ${decision.key}`);
    }
  }

  // assert
  assert.deepStrictEqual(
    detached,
    [],
    "A recorded decision whose coordinates drifted would excuse whatever now sits there; the gate refuses such an entry at run time, and this states the same requirement against the tree.",
  );
});

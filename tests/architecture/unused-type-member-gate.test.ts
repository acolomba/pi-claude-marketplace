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
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EDGE_DEPS_OWNER_TEST_REL,
  EDGE_DEPS_REL,
  PACKAGE_JSON_REL,
  TYPE_MEMBER_EXCEPTIONS_REL,
  TYPE_MEMBER_GATE_REL,
  TYPE_MEMBER_NEGATIVE_REL,
  UNUSED_TYPE_MEMBER_GATE_TARGETS,
} from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

import type { TestContext } from "node:test";

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

// ---------------------------------------------------------------------------
// Activation: the gate in the mandatory quality path.
//
// MEMBER-01 / MEMBER-02: a gate nothing invokes is a gate nobody runs, and a
// gate whose residual list can be widened quietly is worse than no gate at all
// -- it buys confidence it has not earned. The cases below read the real
// `package.json`, the real hook configuration and the real decision list, and
// the last one runs the real gate over the real tree with a new unread member
// planted into it.
// ---------------------------------------------------------------------------

const PRE_COMMIT_REL = ".pre-commit-config.yaml";
const CI_WORKFLOW_REL = ".github/workflows/ci.yml";

const GATE_SCRIPT = "lint:type-members";
const NEGATIVE_SCRIPT = "lint:type-members:negative";

const GATE_HOOK_ID = "npm-type-members";
const NEGATIVE_HOOK_ID = "npm-type-members-negative";

/** The fields one recorded decision may carry, and no others. */
const EXCEPTION_FIELDS = ["id", "owner", "key", "decision", "mechanism"];

/** The key planted into the real tree by the live activation control below. */
const CONTROL_KEY = "neverExcusedAnywhere";

interface PreCommitHook {
  readonly id: string;
  readonly entry: string;
  readonly passFilenames: string;
  readonly files: string;
}

interface RecordedDecision {
  readonly id: string;
  readonly owner: string;
  readonly key: string;
  readonly decision: string;
  readonly mechanism: string;
}

/**
 * The `repo: local` hooks, read out of the configuration text.
 *
 * The configuration is a flat list of fixed-shape blocks, so it is read here by
 * line rather than through a YAML library the project does not depend on. A
 * block that stops having this shape stops being found, and every case that
 * names it fails -- which is the reporting this gate wants.
 */
function readLocalHooks(configuration: string): Map<string, PreCommitHook> {
  const hooks = new Map<string, PreCommitHook>();
  let current: { id: string; fields: Map<string, string> } | undefined;

  const commit = (): void => {
    if (current !== undefined) {
      hooks.set(current.id, {
        id: current.id,
        entry: current.fields.get("entry") ?? "",
        passFilenames: current.fields.get("pass_filenames") ?? "",
        files: (current.fields.get("files") ?? "").replace(/^'(.*)'$/, "$1"),
      });
    }
  };

  for (const line of configuration.split("\n")) {
    const started = /^ {6}- id: (\S+)$/.exec(line);

    if (started !== null) {
      commit();
      current = { id: started[1] ?? "", fields: new Map() };
      continue;
    }

    const field = /^ {8}(\w+): (.+)$/.exec(line);

    if (field !== null && current !== undefined) {
      current.fields.set(field[1] ?? "", field[2] ?? "");
    }
  }

  commit();
  return hooks;
}

async function readHook(id: string): Promise<PreCommitHook> {
  const hook = readLocalHooks(await readRepoFile(PRE_COMMIT_REL)).get(id);

  if (hook === undefined) {
    throw new Error(`${PRE_COMMIT_REL} declares no local hook with id ${id}`);
  }

  return hook;
}

async function readRecordedDecisions(): Promise<readonly RecordedDecision[]> {
  const parsed = JSON.parse(await readRepoFile(TYPE_MEMBER_EXCEPTIONS_REL)) as {
    schemaVersion: number;
    exceptions: readonly RecordedDecision[];
  };
  assert.strictEqual(parsed.schemaVersion, 1);
  return parsed.exceptions;
}

test("the mandatory check chain runs the gate and its negative controls", async () => {
  // arrange
  const manifest = JSON.parse(await readRepoFile(PACKAGE_JSON_REL)) as {
    scripts: Readonly<Record<string, string>>;
  };
  const chain = manifest.scripts.check ?? "";

  // act
  const runs = [GATE_SCRIPT, NEGATIVE_SCRIPT].filter(
    (script) => !chain.split(" && ").includes(`npm run ${script}`),
  );

  // assert
  assert.deepStrictEqual(
    {
      missingFromChain: runs,
      gate: manifest.scripts[GATE_SCRIPT],
      negative: manifest.scripts[NEGATIVE_SCRIPT],
    },
    {
      missingFromChain: [],
      gate: `node ${TYPE_MEMBER_GATE_REL}`,
      negative: `node ${TYPE_MEMBER_NEGATIVE_REL}`,
    },
    "npm run check is the mandatory path, and both scripts must invoke the real executables rather than a stand-in.",
  );
});

test("continuous integration runs the same chain the local path runs", async () => {
  // arrange
  const workflow = await readRepoFile(CI_WORKFLOW_REL);

  // act
  const invokesCheck = workflow.includes("run: npm run check");

  // assert
  assert.strictEqual(
    invokesCheck,
    true,
    `${CI_WORKFLOW_REL} must invoke npm run check, so CI's member-gate invocation can never be weaker than the local one.`,
  );
});

test("both member hooks analyse the whole project rather than the changed files", async () => {
  // arrange
  const gate = await readHook(GATE_HOOK_ID);
  const negative = await readHook(NEGATIVE_HOOK_ID);

  // act & assert
  assert.deepStrictEqual(
    [
      { entry: gate.entry, passFilenames: gate.passFilenames },
      { entry: negative.entry, passFilenames: negative.passFilenames },
    ],
    [
      { entry: `npm run ${GATE_SCRIPT}`, passFilenames: "false" },
      { entry: `npm run ${NEGATIVE_SCRIPT}`, passFilenames: "false" },
    ],
    "A per-file invocation cannot see the removal of the sole reader of a member declared somewhere else, which is the change these hooks exist to catch.",
  );
});

test("the gate hook triggers on every input that can change what the gate reports", async () => {
  // arrange
  const trigger = new RegExp((await readHook(GATE_HOOK_ID)).files);
  const inputs = [
    // The reader removal this gate exists to catch, in a file that declares
    // nothing itself.
    "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts",
    // A test file: a member only tests read changes status when they change.
    "tests/edge/completions/data.test.ts",
    // The analyzer, its evidence record and its decision record.
    "scripts/check-unused-type-members.flow.mjs",
    "scripts/check-unused-type-members.contracts.json",
    "scripts/check-unused-type-members.exceptions.json",
    // The compiler input, the dependency set and the hook configuration itself.
    "tsconfig.json",
    "package.json",
    "package-lock.json",
    ".pre-commit-config.yaml",
  ];
  const nonInputs = ["README.md", "docs/unused-type-member-gate.md", ".github/workflows/ci.yml"];

  // act
  const missed = inputs.filter((one) => !trigger.test(one));
  const overreach = nonInputs.filter((one) => trigger.test(one));

  // assert
  assert.deepStrictEqual(
    { missed, overreach },
    { missed: [], overreach: [] },
    "An input the hook does not name is a change that reaches a commit without the gate ever running.",
  );
});

test("the negative hook triggers on the gate's own machinery and not on ordinary source", async () => {
  // arrange
  const trigger = new RegExp((await readHook(NEGATIVE_HOOK_ID)).files);
  const inputs = [
    "scripts/check-unused-type-members.negative.mjs",
    "scripts/check-unused-type-members.flow.mjs",
    "scripts/check-unused-type-members.exceptions.json",
    // The declaration the offender is planted into, and the test that reads it.
    EDGE_DEPS_REL,
    EDGE_DEPS_OWNER_TEST_REL,
    "tsconfig.json",
    "package-lock.json",
    ".pre-commit-config.yaml",
  ];
  // Deliberate, and stated so it cannot be widened by accident: these controls
  // measure whether the GATE can see an offender, and no ordinary edit under
  // extensions/ can change that answer. They still run in full on every
  // npm run check, local and CI alike.
  const outsideTheTrigger = [
    "extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts",
    "tests/edge/completions/data.test.ts",
  ];

  // act
  const missed = inputs.filter((one) => !trigger.test(one));
  const overreach = outsideTheTrigger.filter((one) => trigger.test(one));

  // assert
  assert.deepStrictEqual(
    { missed, overreach },
    { missed: [], overreach: [] },
    "Five whole-program analyses on every source commit is a cost this trigger is narrowed to avoid; narrowing it further, or widening it, is a decision and must be made here.",
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

/** A temporary directory that disappears whether the case passes or fails. */
async function scratchDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "member-gate-activation-"));

  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  return directory;
}

test("a new unread member outside the recorded decisions fails the real gate", async (t) => {
  // arrange: the recorded decisions leave this tree passing, so this case plants
  // ONE member that no decision names and requires the gate to fail on it alone.
  // It runs the real gate over the real repository through a compiler read
  // overlay, so nothing on disk is edited.
  const declared = await readRepoFile(EDGE_DEPS_REL);
  assert.strictEqual(
    declared.includes(CONTROL_KEY),
    false,
    `${EDGE_DEPS_REL} must not already spell ${CONTROL_KEY}; a plant that collides with a real member proves nothing.`,
  );

  const planted = `${declared}
export interface RecordedDecisionControl {
  readonly ${CONTROL_KEY}?: string;
}
`;
  const plantedLine = declared.split("\n").length + 2;
  const directory = await scratchDirectory(t);
  const overlayPath = path.join(directory, "overlay.json");
  await writeFile(overlayPath, JSON.stringify({ [EDGE_DEPS_REL]: planted }));

  // act
  const run = spawnSync(
    process.execPath,
    [
      path.join(REPO_ROOT, TYPE_MEMBER_GATE_REL),
      "--root",
      REPO_ROOT,
      "--json",
      "--overlay",
      overlayPath,
    ],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const report = JSON.parse(run.stdout) as {
    findings: readonly { id: string; owner: string; key: string }[];
    exceptions: readonly { id: string }[];
  };

  // assert
  assert.deepStrictEqual(
    {
      status: run.status,
      findings: report.findings.map((finding) => `${finding.id} ${finding.owner}.${finding.key}`),
      excused: report.exceptions.length,
    },
    {
      status: 1,
      findings: [`${EDGE_DEPS_REL}:${plantedLine}:3 RecordedDecisionControl.${CONTROL_KEY}`],
      excused: (await readRecordedDecisions()).length,
    },
    "The recorded decisions must excuse exactly the members they name and nothing else, or the list is a mute button rather than a record.",
  );
  assert.strictEqual(await readRepoFile(EDGE_DEPS_REL), declared);
});

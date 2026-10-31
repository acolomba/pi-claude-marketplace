import { readdirSync } from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";

/**
 * Fails when a cucumber step definition is unused, or when a step in any scenario is undefined or
 * ambiguous (DRV-04). A dry run over the cucumber API reports both through its message stream.
 * It also fails on a step definition whose text is a regular expression, on a file under features/ that breaks the cucumber skill's layout rules, and on a
 * feature file that breaks its Gherkin rules, read from the same run's Gherkin documents.
 *
 * It runs through the API rather than the CLI because the CLI's `--tags` is and-joined with the
 * profile's tag exclusion, so only the API can clear that exclusion: a step that only
 * an excluded row uses still counts as used, and every step of an excluded row must still match
 * exactly one definition (D-09). `check:static` runs it, so a commit fails within seconds (D-10).
 */

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const stepsRule = ".agents/skills/cucumber/rules/steps.md";
const featuresRule = ".agents/skills/cucumber/rules/features.md";
const layoutRule = ".agents/skills/cucumber/rules/layout.md";
const codeRoots = new Set(["step_definitions", "support", "lib"]);
const catchAllNames = new Set([
  "common",
  "shared",
  "utils",
  "helpers",
  "support",
  "misc",
  "hooks",
  "parameter-types",
]);
const sourceTags = new Set(["@url", "@github"]);
const localKinds = new Set(["dir", "file"]);

function createCollection() {
  return {
    definitions: [],
    pickleSteps: new Map(),
    testCases: [],
    stepLines: new Map(),
    documents: [],
    parseErrors: [],
    undefinedParameterTypes: [],
  };
}

function collectPickle(collection, pickle) {
  for (const step of pickle.steps) {
    collection.pickleSteps.set(step.id, {
      uri: pickle.uri,
      text: step.text,
      astNodeId: step.astNodeIds[0],
    });
  }
}

function gherkinSteps(children) {
  return children.flatMap((child) => {
    if (child.rule !== undefined) {
      return gherkinSteps(child.rule.children);
    }

    return (child.background ?? child.scenario)?.steps ?? [];
  });
}

function collectGherkinDocument(collection, document) {
  collection.documents.push(document);

  for (const step of gherkinSteps(document.feature?.children ?? [])) {
    collection.stepLines.set(step.id, step.location.line);
  }
}

const collectors = {
  stepDefinition: (collection, definition) => collection.definitions.push(definition),
  pickle: collectPickle,
  testCase: (collection, testCase) => collection.testCases.push(testCase),
  gherkinDocument: collectGherkinDocument,
  parseError: (collection, error) => collection.parseErrors.push(error),
  undefinedParameterType: (collection, parameterType) =>
    collection.undefinedParameterTypes.push(parameterType),
};

function collect(collection, envelope) {
  for (const [key, message] of Object.entries(envelope)) {
    if (Object.hasOwn(collectors, key)) {
      collectors[key](collection, message);
    }
  }
}

function discard() {
  return new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
}

async function dryRun() {
  const { runConfiguration } = await loadConfiguration({}, { cwd: projectRoot });
  runConfiguration.sources.tagExpression = "";
  runConfiguration.sources.order = "defined";
  runConfiguration.runtime.dryRun = true;
  runConfiguration.runtime.parallel = 0;

  const collection = createCollection();
  await runCucumber(
    runConfiguration,
    { cwd: projectRoot, stdout: discard(), stderr: discard() },
    (envelope) => collect(collection, envelope),
  );

  return collection;
}

function usedDefinitionIds(collection) {
  return new Set(
    collection.testCases.flatMap((testCase) =>
      testCase.testSteps.flatMap((testStep) => testStep.stepDefinitionIds ?? []),
    ),
  );
}

function definitionLabel(definition) {
  const { uri, location } = definition.sourceReference;

  return `${JSON.stringify(definition.pattern.source)} at ${uri}:${location?.line ?? 0}`;
}

function unusedFindings(collection) {
  const used = usedDefinitionIds(collection);

  return collection.definitions
    .filter((definition) => !used.has(definition.id))
    .map((definition) => ({
      path: definition.sourceReference.uri,
      line: definition.sourceReference.location?.line ?? 0,
      message: `unused step definition ${JSON.stringify(definition.pattern.source)} (${stepsRule})`,
    }));
}

// Reads the registered pattern, so it catches a regular expression whatever name the step
// function was called through, which the name-based lint selectors cannot.
function patternFindings(collection) {
  return collection.definitions
    .filter((definition) => definition.pattern.type !== "CUCUMBER_EXPRESSION")
    .map((definition) => ({
      path: definition.sourceReference.uri,
      line: definition.sourceReference.location?.line ?? 0,
      message: `step text is not a Cucumber expression: ${JSON.stringify(definition.pattern.source)} (${stepsRule})`,
    }));
}

function matchProblem(stepText, testStep, labels) {
  const ids = testStep.stepDefinitionIds;

  if (ids.length === 0) {
    return `undefined step ${stepText}`;
  }

  if (ids.length > 1) {
    return `ambiguous step ${stepText}, matched by ${ids.map((id) => labels.get(id)).join(" and ")}`;
  }

  return undefined;
}

function matchFindings(collection) {
  const labels = new Map(
    collection.definitions.map((definition) => [definition.id, definitionLabel(definition)]),
  );
  const findings = new Map();

  for (const testStep of collection.testCases.flatMap((testCase) => testCase.testSteps)) {
    const step = collection.pickleSteps.get(testStep.pickleStepId);

    if (step === undefined) {
      continue;
    }

    const problem = matchProblem(JSON.stringify(step.text), testStep, labels);

    if (problem === undefined) {
      continue;
    }

    const line = collection.stepLines.get(step.astNodeId) ?? 0;
    const message = `${problem} (${stepsRule})`;
    findings.set(`${step.uri}:${line}:${message}`, { path: step.uri, line, message });
  }

  return [...findings.values()];
}

function runFindings(collection) {
  const findings = [
    ...collection.parseErrors.map((error) => ({
      path: error.source.uri,
      line: error.source.location?.line ?? 0,
      message: `parse error: ${error.message}`,
    })),
    ...collection.undefinedParameterTypes.map((parameterType) => ({
      path: "features",
      line: 0,
      message: `undefined parameter type {${parameterType.name}} in "${parameterType.expression}"`,
    })),
  ];

  if (collection.testCases.length === 0) {
    findings.push({ path: "features", line: 0, message: "the dry run found no scenarios" });
  }

  if (collection.definitions.length === 0) {
    findings.push({ path: "features", line: 0, message: "the dry run found no step definitions" });
  }

  return findings;
}

function featureTree() {
  const root = path.join(projectRoot, "features");

  return readdirSync(root, { recursive: true, withFileTypes: true }).map((entry) => ({
    parts: path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep),
    directory: entry.isDirectory(),
  }));
}

function moduleName(name) {
  return name.replace(/(\.steps)?\.ts$/, "");
}

function isAllowedFile(parts) {
  const name = parts.at(-1);
  const depth = parts.length;

  if (parts.join("/") === "lib/pi-tui-pty.py") {
    return true;
  }

  if (parts[0] === "step_definitions") {
    return depth <= 3 && name.endsWith(".steps.ts");
  }

  if (codeRoots.has(parts[0])) {
    return depth <= 3 && name.endsWith(".ts") && !name.endsWith(".steps.ts");
  }

  return depth === 2 && name.endsWith(".feature");
}

function layoutFinding(parts, message) {
  return { path: ["features", ...parts].join("/"), line: 0, message: `${message} (${layoutRule})` };
}

function codeModuleFindings(entry, directories) {
  const name = entry.directory ? entry.parts.at(-1) : moduleName(entry.parts.at(-1));
  const findings = [];

  if (catchAllNames.has(name)) {
    findings.push(layoutFinding(entry.parts, `catch-all module name "${name}"`));
  }

  const sibling = [...entry.parts.slice(0, -1), name].join("/");

  if (!entry.directory && directories.has(sibling)) {
    findings.push(
      layoutFinding(entry.parts, `module beside its own directory features/${sibling}/`),
    );
  }

  return findings;
}

function entryFindings(entry, directories) {
  const findings = [];

  if (!entry.directory && !isAllowedFile(entry.parts)) {
    findings.push(
      layoutFinding(
        entry.parts,
        "unexpected file: features/ holds <function>/<capability>.feature files and step_definitions, support, and lib modules",
      ),
    );
  }

  if (codeRoots.has(entry.parts[0]) && entry.parts.length > 1) {
    findings.push(...codeModuleFindings(entry, directories));
  }

  return findings;
}

function layoutFindings() {
  const entries = featureTree();
  const directories = new Set(
    entries.filter((entry) => entry.directory).map((entry) => entry.parts.join("/")),
  );

  return entries.flatMap((entry) => entryFindings(entry, directories));
}

function gherkinFinding(uri, node, message) {
  return { path: uri, line: node.location.line, message: `${message} (${featuresRule})` };
}

function kebabCase(text) {
  return text.trim().toLowerCase().split(/\s+/).join("-");
}

function titleFindings(uri, feature) {
  const match = /^features\/([^/]+)\/([^/]+)\.feature$/.exec(uri);

  if (match === null || kebabCase(feature.name) === `${match[1]}-${match[2]}`) {
    return [];
  }

  return [
    {
      path: uri,
      line: feature.location.line,
      message: `feature title ${JSON.stringify(feature.name)} is not "<function> <capability>" of its file name (${layoutRule})`,
    },
  ];
}

function misplacedTagFindings(uri, node) {
  return node.tags.map((tag) =>
    gherkinFinding(uri, tag, `tag ${tag.name} is not on an Examples block`),
  );
}

function examplesTagFindings(uri, examples) {
  return examples.tags
    .filter((tag) => !sourceTags.has(tag.name))
    .map((tag) =>
      gherkinFinding(uri, tag, `tag ${tag.name} on an Examples block is not @url or @github`),
    );
}

// The rows of an Examples block with the cell of their `source kind` column, or undefined when
// the block has no such column.
function sourceKindRows(examples) {
  const column =
    examples.tableHeader?.cells.findIndex((cell) => cell.value === "source kind") ?? -1;

  if (column === -1) {
    return undefined;
  }

  return examples.tableBody.map((row) => ({ row, kind: row.cells[column]?.value }));
}

// A row whose source kind does not match its block's tag is dropped or run by mistake: an
// untagged block holds the local kinds, and a block tagged @url or @github holds that kind only.
function examplesKindFindings(uri, examples) {
  const tags = examples.tags.filter((tag) => sourceTags.has(tag.name)).map((tag) => tag.name);
  const rows = sourceKindRows(examples);

  if (rows === undefined) {
    return tags.length === 0
      ? []
      : [
          gherkinFinding(
            uri,
            examples,
            `an Examples block tagged ${tags.join(" ")} has no source kind column`,
          ),
        ];
  }

  const allowed = tags.length === 0 ? localKinds : new Set(tags.map((tag) => tag.slice(1)));
  const block =
    tags.length === 0 ? "an untagged Examples block" : `an Examples block tagged ${tags.join(" ")}`;

  return rows
    .filter(({ kind }) => !allowed.has(kind))
    .map(({ row, kind }) =>
      gherkinFinding(
        uri,
        row,
        `source kind ${JSON.stringify(kind)} in ${block}, which holds ${[...allowed].join(" and ")} only`,
      ),
    );
}

function stepWordingFindings(uri, step) {
  const findings = [];
  const keyword = step.keyword.trim();
  const unquoted = step.text.replaceAll(/"[^"]*"|'[^']*'/g, "");

  if (step.keywordType === "Conjunction" || step.keywordType === "Unknown") {
    findings.push(gherkinFinding(uri, step, `step keyword ${keyword}: use Given, When, or Then`));
  }

  if (/[A-Z]/.test(unquoted)) {
    findings.push(gherkinFinding(uri, step, "step text is not lower case outside quoted values"));
  }

  if (/\bshould\b/i.test(unquoted)) {
    findings.push(gherkinFinding(uri, step, "step text says should"));
  }

  return findings;
}

function stepOrderFindings(uri, steps) {
  const findings = [];
  let acted = false;

  for (const step of steps) {
    if (step.keywordType === "Context" && acted) {
      findings.push(gherkinFinding(uri, step, "a Given step follows a When or Then step"));
    }

    acted ||= step.keywordType === "Action" || step.keywordType === "Outcome";
  }

  return findings;
}

function backgroundFindings(uri, background) {
  const notGiven = background.steps.filter((step) => step.keywordType !== "Context");

  return [
    ...notGiven.map((step) =>
      gherkinFinding(uri, step, `a Background holds Given steps only, not ${step.keyword.trim()}`),
    ),
    ...background.steps.flatMap((step) => stepWordingFindings(uri, step)),
  ];
}

function scenarioTitleFindings(uri, scenario) {
  if (/^[A-Z]/.test(scenario.name)) {
    return [];
  }

  return [
    gherkinFinding(
      uri,
      scenario,
      `scenario title ${JSON.stringify(scenario.name)} does not start with an upper-case letter`,
    ),
  ];
}

function scenarioFindings(uri, scenario) {
  return [
    ...scenarioTitleFindings(uri, scenario),
    ...misplacedTagFindings(uri, scenario),
    ...scenario.examples.flatMap((examples) => examplesTagFindings(uri, examples)),
    ...scenario.examples.flatMap((examples) => examplesKindFindings(uri, examples)),
    ...scenario.steps.flatMap((step) => stepWordingFindings(uri, step)),
    ...stepOrderFindings(uri, scenario.steps),
  ];
}

function childFindings(uri, child) {
  if (child.rule !== undefined) {
    return [
      ...misplacedTagFindings(uri, child.rule),
      ...child.rule.children.flatMap((ruleChild) => childFindings(uri, ruleChild)),
    ];
  }

  if (child.background !== undefined) {
    return backgroundFindings(uri, child.background);
  }

  return scenarioFindings(uri, child.scenario);
}

function documentFindings(document) {
  const { uri, feature } = document;

  if (feature === undefined) {
    return [{ path: uri, line: 0, message: `the file holds no Feature (${featuresRule})` }];
  }

  const findings = [...titleFindings(uri, feature), ...misplacedTagFindings(uri, feature)];

  if (feature.description.trim() === "") {
    findings.push(gherkinFinding(uri, feature, "the feature has no description"));
  }

  return [...findings, ...feature.children.flatMap((child) => childFindings(uri, child))];
}

function byLocation(left, right) {
  return left.path.localeCompare(right.path) || left.line - right.line;
}

async function main() {
  const collection = await dryRun();
  const findings = [
    ...runFindings(collection),
    ...unusedFindings(collection),
    ...patternFindings(collection),
    ...matchFindings(collection),
    ...collection.documents.flatMap(documentFindings),
    ...layoutFindings(),
  ].sort(byLocation);

  if (findings.length === 0) {
    if (process.env.CI) {
      process.stdout.write(
        `Feature gate passed: ${collection.testCases.length} scenarios, ${collection.definitions.length} step definitions.\n`,
      );
    }

    return;
  }

  for (const finding of findings) {
    const where = finding.line === 0 ? finding.path : `${finding.path}:${finding.line}`;
    process.stderr.write(`${where}: ${finding.message}\n`);
  }

  process.stderr.write(`Feature gate failed with ${findings.length} finding(s).\n`);
  process.exitCode = 1;
}

// A support or step module that fails to load rejects here; Node prints its stack and exits 1.
await main();

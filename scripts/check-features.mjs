import path from "node:path";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { loadConfiguration, runCucumber } from "@cucumber/cucumber/api";

/**
 * Fails when a cucumber step definition is unused, or when a step in any scenario is undefined or
 * ambiguous (DRV-04). A dry run over the cucumber API reports both through its message stream.
 *
 * It runs through the API rather than the CLI because the CLI's `--tags` is and-joined with the
 * profile's `not @url and not @github`, so only the API can clear that exclusion: a step that only
 * an excluded row uses still counts as used, and every step of an excluded row must still match
 * exactly one definition (D-09). `check:static` runs it, so a commit fails within seconds (D-10).
 */

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const stepsRule = ".agents/skills/cucumber/rules/steps.md";

function createCollection() {
  return {
    definitions: [],
    pickleSteps: new Map(),
    testCases: [],
    stepLines: new Map(),
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

function byLocation(left, right) {
  return left.path.localeCompare(right.path) || left.line - right.line;
}

async function main() {
  const collection = await dryRun();
  const findings = [
    ...runFindings(collection),
    ...unusedFindings(collection),
    ...matchFindings(collection),
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
    process.stderr.write(`${finding.path}:${finding.line}: ${finding.message}\n`);
  }

  process.stderr.write(`Feature gate failed with ${findings.length} finding(s).\n`);
  process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

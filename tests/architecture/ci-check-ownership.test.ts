import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { readLocalHooks } from "./pre-commit-hooks.ts";

async function repositoryText(relativePath: string): Promise<string> {
  return readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

function jobText(workflow: string, name: string): string {
  const marker = `  ${name}:\n`;
  const start = workflow.indexOf(marker);
  assert.notStrictEqual(start, -1, `Missing CI job: ${name}`);
  const body = workflow.slice(start + marker.length);
  const nextJob = /^ {2}[a-z][\w-]*:/m.exec(body);
  return body.slice(0, nextJob?.index);
}

test("CI runs integration through the full check without a second integration job", async () => {
  // arrange
  const workflow = await repositoryText(".github/workflows/ci.yml");
  const manifest = JSON.parse(await repositoryText("package.json")) as {
    scripts: Record<string, string>;
  };

  // act
  const commands = manifest.scripts.check?.split(" && ") ?? [];

  // assert
  assert.match(jobText(workflow, "check"), /run: npm run check\n/);
  assert.deepStrictEqual(
    commands.filter((command) => command === "npm run test:integration"),
    ["npm run test:integration"],
  );
  assert.doesNotMatch(workflow, /run: npm run test:integration\b/);
  assert.match(jobText(workflow, "package"), /needs: \[check, e2e-tests, direct-coverage\]/);
  assert.match(jobText(workflow, "e2e-tests"), /run: npm run test:e2e\n/);
});

test("Sonar depends on a successful check and its accepted coverage artifact", async () => {
  // arrange
  const workflow = await repositoryText(".github/workflows/ci.yml");
  const check = jobText(workflow, "check");
  const sonar = jobText(workflow, "sonarcloud");

  // act
  const checkPosition = check.indexOf("run: npm run check\n");
  const uploadPosition = check.indexOf("uses: actions/upload-artifact@");

  // assert
  assert.ok(checkPosition >= 0 && uploadPosition > checkPosition);
  assert.match(
    check,
    /name: unit-coverage\n\s+path: coverage\/unit\.lcov\n\s+if-no-files-found: error/,
  );
  assert.doesNotMatch(check, /continue-on-error: true|if:.*always\(\)/);
  assert.match(sonar, /needs: \[check\]/);
  assert.match(sonar, /uses: \$\/\.github\/workflows\/sonarcloud\.yml/);
  assert.doesNotMatch(sonar, /always\(\)|continue-on-error: true/);
});

test("Sonar consumes only this run's unit report without rerunning tests", async () => {
  // arrange
  const workflow = await repositoryText(".github/workflows/sonarcloud.yml");

  // act
  const downloadPosition = workflow.indexOf("uses: actions/download-artifact@");
  const reportPosition = workflow.indexOf("run: test -s coverage/unit.lcov");
  const scanPosition = workflow.indexOf("uses: SonarSource/sonarqube-scan-action@");

  // assert
  assert.match(workflow, /^on:\n {2}workflow_call:/m);
  assert.doesNotMatch(workflow, /^ {2}(push|pull_request|workflow_dispatch|workflow_run):/m);
  assert.ok(
    downloadPosition >= 0 && reportPosition > downloadPosition && scanPosition > reportPosition,
  );
  assert.match(workflow, /name: unit-coverage\n\s+path: coverage\n/);
  assert.doesNotMatch(workflow, /^\s+(run-id|repository|github-token):/m);
  assert.doesNotMatch(workflow, /run: npm run (test|check)/);
  assert.doesNotMatch(workflow, /^concurrency:/m);
});

test("Sonar keeps tokens away from forks and Dependabot and skips release tags", async () => {
  // arrange
  const workflow = await repositoryText(".github/workflows/ci.yml");

  // act
  const sonar = jobText(workflow, "sonarcloud");

  // assert
  assert.match(sonar, /github\.ref_type != 'tag' && github\.actor != 'dependabot\[bot\]'/);
  assert.match(
    sonar,
    /github\.event_name != 'pull_request'\s+\|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
  assert.match(sonar, /SONAR_TOKEN: \$\{\{ secrets\.SONAR_TOKEN \}\}/);
  assert.doesNotMatch(sonar, /secrets: inherit/);
});

for (const { hook, script } of [
  { hook: "prettier", script: "format:check" },
  { hook: "npm-lint", script: "lint" },
  { hook: "npm-format-check", script: "format:check" },
  { hook: "npm-typecheck", script: "typecheck" },
  { hook: "npm-fallow", script: "fallow" },
  { hook: "workflow-install-scripts", script: "lint:workflows" },
  { hook: "npm-type-members", script: "lint:type-members" },
  { hook: "npm-type-members-negative", script: "lint:type-members:negative" },
]) {
  test(`CI delegates ${hook} to the full check and retains its local hook`, async () => {
    // arrange
    const lint = await repositoryText(".github/workflows/lint.yml");
    const configuration = await repositoryText(".pre-commit-config.yaml");
    const manifest = JSON.parse(await repositoryText("package.json")) as {
      scripts: Record<string, string>;
    };

    // act
    const skipped = /^\s+SKIP: (.+)$/m.exec(lint)?.[1]?.split(",") ?? [];
    const commands = manifest.scripts.check?.split(" && ") ?? [];

    // assert
    assert.ok(skipped.includes(hook));
    assert.ok(commands.includes(`npm run ${script}`));
    assert.ok(readLocalHooks(configuration).has(hook));
  });
}

test("CI skips only hooks with authoritative replacements and retains the audit", async () => {
  // arrange
  const lint = await repositoryText(".github/workflows/lint.yml");
  const workflow = await repositoryText(".github/workflows/ci.yml");

  // act
  const skipped = /^\s+SKIP: (.+)$/m.exec(lint)?.[1]?.split(",").sort() ?? [];

  // assert
  assert.deepStrictEqual(skipped, [
    "npm-coverage-direct",
    "npm-fallow",
    "npm-format-check",
    "npm-lint",
    "npm-type-members",
    "npm-type-members-negative",
    "npm-typecheck",
    "prettier",
    "workflow-install-scripts",
  ]);
  assert.match(jobText(lint, "fallow-audit"), /command: audit/);
  assert.match(
    jobText(workflow, "direct-coverage"),
    /if: github\.event_name == 'pull_request'[\s\S]*npm run test:coverage:direct \| tee/,
  );
  assert.match(
    jobText(workflow, "direct-coverage"),
    /if: github\.event_name != 'pull_request'\n\s+run: npm run test:coverage:direct:all/,
  );
});

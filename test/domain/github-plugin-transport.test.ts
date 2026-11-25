import assert from "node:assert/strict";
import { test } from "node:test";

import { planPluginClone } from "../../extensions/pi-claude-marketplace/domain/github-plugin-transport.ts";
import {
  DeviceFlowUnavailableError,
  GitCommandError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { PluginSshChecks } from "../../extensions/pi-claude-marketplace/domain/github-plugin-transport.ts";
import type {
  TransportAttempt,
  TransportPlan,
} from "../../extensions/pi-claude-marketplace/domain/github-transport.ts";
import type {
  GitBackedSource,
  GitHubSource,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";

type ProbeAnswer = Awaited<ReturnType<PluginSshChecks["probe"]>>;

const OWNER_REPO = {
  kind: "github",
  raw: "acme/ghp",
  owner: "acme",
  repo: "ghp",
} satisfies GitHubSource;

const SSH_ATTEMPT = {
  transport: "ssh",
  url: "git@github.com:acme/ghp.git",
} satisfies TransportAttempt;
const HTTPS_ATTEMPT = {
  transport: "https",
  url: "https://github.com/acme/ghp.git",
} satisfies TransportAttempt;

/** A plan without its `after`, which a deep comparison cannot hold. */
function orderOf(plan: TransportPlan): Omit<TransportPlan, "after"> {
  const { after: _after, ...order } = plan;
  return order;
}

// A bound on the attempts `attemptsAfter` walks, so a plan that never stops
// fails its case instead of hanging it.
const MAX_ATTEMPTS = 4;

/** Every attempt `plan` runs when each one fails with `failure`, in order. */
async function attemptsAfter(
  plan: TransportPlan,
  failure: unknown,
): Promise<readonly TransportAttempt[]> {
  const attempts = [plan.first];
  for (let failed = plan.first; attempts.length < MAX_ATTEMPTS;) {
    const next = await plan.after(failure, failed);
    if (next === undefined) {
      break;
    }

    attempts.push(next);
    failed = next;
  }

  return attempts;
}

interface CheckAnswers {
  readonly userOverride?: boolean;
  readonly urlRewritten?: boolean;
  readonly probe?: ProbeAnswer;
  readonly sshPresent?: boolean;
  readonly showsDirectGitHub?: boolean;
}

/**
 * Checks that answer `answers` and record each call in order. A check with no
 * answer fails its case when it is called.
 */
function checksAnswering(answers: CheckAnswers): {
  readonly checks: PluginSshChecks;
  readonly calls: string[];
} {
  const calls: string[] = [];
  function answered<T>(name: string, answer: T | undefined): Promise<T> {
    calls.push(name);
    return answer === undefined
      ? Promise.reject(new Error(`the ${name} check must not run`))
      : Promise.resolve(answer);
  }

  return {
    calls,
    checks: {
      userOverride: () => answered("userOverride", answers.userOverride),
      urlRewritten: (sshUrl) => answered(`urlRewritten ${sshUrl}`, answers.urlRewritten),
      probe: () => answered("probe", answers.probe),
      sshPresent: () => answered("sshPresent", answers.sshPresent),
      showsDirectGitHub: () => answered("showsDirectGitHub", answers.showsDirectGitHub),
    },
  };
}

const CLONE_FAILURE = new GitCommandError(
  { kind: "repository-not-found" },
  { operation: "clone --depth", exitCode: 128 },
);

test("D-SG-18: stays on ssh only, without the probe, when the user chose the ssh command", async () => {
  // arrange
  const { checks, calls } = checksAnswering({ userOverride: true });

  // act
  const plan = await planPluginClone({ source: OWNER_REPO, checks });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: SSH_ATTEMPT, note: "via-ssh" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [SSH_ATTEMPT]);
  assert.deepStrictEqual(calls, ["userOverride"]);
});

test("D-SG-18: stays on ssh only when the user's git config rewrites the ssh url", async () => {
  // arrange
  const { checks, calls } = checksAnswering({ userOverride: false, urlRewritten: true });

  // act
  const plan = await planPluginClone({ source: OWNER_REPO, checks });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: SSH_ATTEMPT, note: "via-ssh" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [SSH_ATTEMPT]);
  assert.deepStrictEqual(calls, ["userOverride", "urlRewritten git@github.com:acme/ghp.git"]);
});

for (const probe of ["configured", "unknown"] as const) {
  test(`D-SG-18, Pitfall 8: stays on ssh only when the probe answers ${probe}`, async () => {
    // arrange
    const { checks, calls } = checksAnswering({ userOverride: false, urlRewritten: false, probe });

    // act
    const plan = await planPluginClone({ source: OWNER_REPO, checks });

    // assert
    assert.deepStrictEqual(orderOf(plan), { first: SSH_ATTEMPT, note: "via-ssh" });
    assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [SSH_ATTEMPT]);
    assert.deepStrictEqual(calls, [
      "userOverride",
      "urlRewritten git@github.com:acme/ghp.git",
      "probe",
    ]);
  });
}

test("D-SG-18: goes https first and retries over ssh once when every check passes", async () => {
  // arrange
  const { checks } = checksAnswering({
    userOverride: false,
    urlRewritten: false,
    probe: "not-configured",
    sshPresent: true,
    showsDirectGitHub: true,
  });

  // act
  const plan = await planPluginClone({ source: OWNER_REPO, checks });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: HTTPS_ATTEMPT, note: "ssh-not-configured" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [HTTPS_ATTEMPT, SSH_ATTEMPT]);
});

test("D-SG-18: goes https first without ssh -G when no ssh can be found", async () => {
  // arrange
  const { checks, calls } = checksAnswering({
    userOverride: false,
    urlRewritten: false,
    probe: "not-configured",
    sshPresent: false,
  });

  // act
  const plan = await planPluginClone({ source: OWNER_REPO, checks });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: HTTPS_ATTEMPT, note: "ssh-not-configured" });
  assert.deepStrictEqual(calls, [
    "userOverride",
    "urlRewritten git@github.com:acme/ghp.git",
    "probe",
    "sshPresent",
  ]);
});

test("D-SG-18: stays on ssh only when ssh -G shows no direct hop to github.com", async () => {
  // arrange
  const { checks, calls } = checksAnswering({
    userOverride: false,
    urlRewritten: false,
    probe: "not-configured",
    sshPresent: true,
    showsDirectGitHub: false,
  });

  // act
  const plan = await planPluginClone({ source: OWNER_REPO, checks });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: SSH_ATTEMPT, note: "via-ssh" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [SSH_ATTEMPT]);
  assert.deepStrictEqual(calls, [
    "userOverride",
    "urlRewritten git@github.com:acme/ghp.git",
    "probe",
    "sshPresent",
    "showsDirectGitHub",
  ]);
});

for (const { label, failure } of [
  {
    label: "git is missing",
    failure: new GitCommandError(
      { kind: "git-missing", detail: "not-found" },
      { operation: "clone" },
    ),
  },
  {
    label: "the command was aborted",
    failure: new GitCommandError({ kind: "aborted" }, { operation: "clone" }),
  },
  { label: "print mode refused the sign-in", failure: new DeviceFlowUnavailableError() },
]) {
  test(`D-SG-18: gives no ssh retry when ${label}`, async () => {
    // arrange
    const { checks } = checksAnswering({
      userOverride: false,
      urlRewritten: false,
      probe: "not-configured",
      sshPresent: true,
      showsDirectGitHub: true,
    });

    // act
    const plan = await planPluginClone({ source: OWNER_REPO, checks });

    // assert
    assert.deepStrictEqual(await attemptsAfter(plan, failure), [HTTPS_ATTEMPT]);
  });
}

test("D-SG-18: stays on ssh only with no transport context", async () => {
  // act
  const plan = await planPluginClone({ source: OWNER_REPO });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: SSH_ATTEMPT, note: "via-ssh" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [SSH_ATTEMPT]);
});

for (const force of ["prefer-https", "base-override"] as const) {
  test(`D-SG-24, D-SG-21: clones once over https and runs no check when forced by ${force}`, async () => {
    // arrange
    const { checks, calls } = checksAnswering({});

    // act
    const plan = await planPluginClone({ source: OWNER_REPO, force, checks });

    // assert
    assert.deepStrictEqual(orderOf(plan), { first: HTTPS_ATTEMPT, note: "via-https" });
    assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [HTTPS_ATTEMPT]);
    assert.deepStrictEqual(calls, []);
  });
}

test("OQ-1: clones an https-spelled github source once as written and runs no check", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});
  const source: GitHubSource = { ...OWNER_REPO, raw: "https://github.com/acme/ghp" };

  // act
  const plan = await planPluginClone({ source, checks });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: HTTPS_ATTEMPT, note: "via-https" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [HTTPS_ATTEMPT]);
  assert.deepStrictEqual(calls, []);
});

for (const { url, first, note } of [
  {
    url: "git@github.com:acme/ghp.git",
    first: { transport: "ssh", url: "git@github.com:acme/ghp.git" },
    note: "via-ssh",
  },
  {
    url: "ssh://git@github.com/acme/ghp.git",
    first: { transport: "ssh", url: "ssh://git@github.com/acme/ghp.git" },
    note: "via-ssh",
  },
  {
    url: "https://github.com/acme/ghp.git",
    first: { transport: "https", url: "https://github.com/acme/ghp.git" },
    note: "via-https",
  },
] satisfies ReadonlyArray<{ url: string; first: TransportAttempt; note: string }>) {
  test(`OQ-1: clones the GitHub url source ${url} once as written, noted by its scheme`, async () => {
    // arrange
    const { checks, calls } = checksAnswering({});
    const source: GitBackedSource = { kind: "url", raw: url, url: url.replace(/\.git$/, "") };

    // act
    const plan = await planPluginClone({ source, force: "base-override", checks });

    // assert
    assert.deepStrictEqual(orderOf(plan), { first, note });
    assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [first]);
    assert.deepStrictEqual(calls, []);
  });
}

test("OQ-1: clones a non-GitHub url source once as written with no note", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});
  const source: GitBackedSource = {
    kind: "url",
    raw: "git@git.example.com:acme/ghp.git",
    url: "git@git.example.com:acme/ghp",
  };

  // act
  const plan = await planPluginClone({ source, checks });

  // assert
  assert.deepStrictEqual(orderOf(plan), {
    first: { transport: "ssh", url: "git@git.example.com:acme/ghp.git" },
  });
  assert.deepStrictEqual(calls, []);
});

test("D-SG-20: clones a git-subdir owner/repo shorthand once over ssh and runs no check", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "acme/mono",
    url: "acme/mono",
    path: "plugins/one",
  };

  // act
  const plan = await planPluginClone({ source, checks });

  // assert
  const ssh = { transport: "ssh", url: "git@github.com:acme/mono.git" } as const;
  assert.deepStrictEqual(orderOf(plan), { first: ssh, note: "via-ssh" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [ssh]);
  assert.deepStrictEqual(calls, []);
});

test("D-SG-20: clones a forced git-subdir owner/repo shorthand once over https", async () => {
  // arrange
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "acme/mono",
    url: "acme/mono",
    path: "plugins/one",
  };

  // act
  const plan = await planPluginClone({ source, force: "prefer-https" });

  // assert
  const https = { transport: "https", url: "https://github.com/acme/mono.git" } as const;
  assert.deepStrictEqual(orderOf(plan), { first: https, note: "via-https" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [https]);
});

test("D-SG-20: clones a git-subdir address once as written", async () => {
  // arrange
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "https://git.example.com/acme/mono.git",
    url: "https://git.example.com/acme/mono.git",
    path: "plugins/one",
  };

  // act
  const plan = await planPluginClone({ source });

  // assert
  assert.deepStrictEqual(orderOf(plan), {
    first: { transport: "https", url: "https://git.example.com/acme/mono.git" },
  });
});

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
  readonly showsDirectGitHubThroughGit?: boolean;
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
      showsDirectGitHubThroughGit: (sshUrl) =>
        answered(`showsDirectGitHubThroughGit ${sshUrl}`, answers.showsDirectGitHubThroughGit),
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
  {
    url: "http://github.com/acme/ghp.git",
    first: { transport: "https", url: "http://github.com/acme/ghp.git" },
    note: "via-http",
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

for (const { url, first } of [
  {
    url: "git@git.example.com:acme/ghp.git",
    first: { transport: "ssh", url: "git@git.example.com:acme/ghp.git" },
  },
  {
    url: "http://127.0.0.1:9/acme/ghp.git",
    first: { transport: "https", url: "http://127.0.0.1:9/acme/ghp.git" },
  },
  // A GitHub repository over a scheme that is neither https, http, nor ssh.
  {
    url: "git://github.com/acme/ghp.git",
    first: { transport: "https", url: "git://github.com/acme/ghp.git" },
  },
] satisfies ReadonlyArray<{ url: string; first: TransportAttempt }>) {
  test(`OQ-1, IN-A-02: clones the url source ${url} once as written with no note`, async () => {
    // arrange
    const { checks, calls } = checksAnswering({});
    const source: GitBackedSource = { kind: "url", raw: url, url: url.replace(/\.git$/, "") };

    // act
    const plan = await planPluginClone({ source, checks });

    // assert
    assert.deepStrictEqual(orderOf(plan), { first });
    assert.deepStrictEqual(calls, []);
  });
}

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

test("D-SG-20: clones a forced git-subdir owner/repo shorthand once over https and runs no check", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "acme/mono",
    url: "acme/mono",
    path: "plugins/one",
  };

  // act
  const plan = await planPluginClone({ source, force: "prefer-https", checks });

  // assert
  const https = { transport: "https", url: "https://github.com/acme/mono.git" } as const;
  assert.deepStrictEqual(orderOf(plan), { first: https, note: "via-https" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [https]);
  assert.deepStrictEqual(calls, []);
});

test("D-SG-20: clones a git-subdir address once as written and runs no check", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "https://git.example.com/acme/mono.git",
    url: "https://git.example.com/acme/mono.git",
    path: "plugins/one",
  };

  // act
  const plan = await planPluginClone({ source, checks });

  // assert
  assert.deepStrictEqual(orderOf(plan), {
    first: { transport: "https", url: "https://git.example.com/acme/mono.git" },
  });
  assert.deepStrictEqual(calls, []);
});

test("IN-A-02: clones an http GitHub git-subdir address once as written with the via-http note", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});
  const source: GitBackedSource = {
    kind: "git-subdir",
    raw: "http://github.com/acme/mono.git",
    url: "http://github.com/acme/mono.git",
    path: "plugins/one",
  };

  // act
  const plan = await planPluginClone({ source, checks });

  // assert
  const http = { transport: "https", url: "http://github.com/acme/mono.git" } as const;
  assert.deepStrictEqual(orderOf(plan), { first: http, note: "via-http" });
  assert.deepStrictEqual(await attemptsAfter(plan, CLONE_FAILURE), [http]);
  assert.deepStrictEqual(calls, []);
});

const PUBLICKEY_FAILURE = new GitCommandError(
  { kind: "ssh-auth", detail: "publickey" },
  { operation: "clone --depth", exitCode: 128 },
);

/** The answers of a Windows user whose ssh settings keep nothing on SSH. */
const WINDOWS_CHECKS_PASS = {
  userOverride: false,
  urlRewritten: false,
  showsDirectGitHubThroughGit: true,
} satisfies CheckAnswers;

const WINDOWS_CHECK_CALLS = [
  "userOverride",
  "urlRewritten git@github.com:acme/ghp.git",
  "showsDirectGitHubThroughGit git@github.com:acme/ghp.git",
];

test("SG-SSH-05: on Windows clones over ssh first and runs no check or probe before a failure", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});

  // act
  const plan = await planPluginClone({ source: OWNER_REPO, checks, platform: "win32" });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: SSH_ATTEMPT, note: "via-ssh" });
  assert.deepStrictEqual(calls, []);
});

for (const { label, failure } of [
  { label: "GitHub refused every key", failure: PUBLICKEY_FAILURE },
  {
    label: "the host key is not known",
    failure: new GitCommandError(
      { kind: "ssh-host-key-unknown" },
      { operation: "clone --depth", exitCode: 128 },
    ),
  },
  {
    label: "the host key changed",
    failure: new GitCommandError(
      { kind: "ssh-host-key-changed" },
      { operation: "clone --depth", exitCode: 128 },
    ),
  },
]) {
  test(`SG-SSH-05: on Windows gives https, then ssh, when ${label} and every Windows check passes`, async () => {
    // arrange
    const { checks, calls } = checksAnswering(WINDOWS_CHECKS_PASS);
    const plan = await planPluginClone({ source: OWNER_REPO, checks, platform: "win32" });

    // act
    const attempts = await attemptsAfter(plan, failure);

    // assert
    assert.deepStrictEqual(attempts, [SSH_ATTEMPT, HTTPS_ATTEMPT, SSH_ATTEMPT]);
    assert.deepStrictEqual(calls, WINDOWS_CHECK_CALLS);
  });
}

for (const { label, failure } of [
  {
    label: "a network failure",
    failure: new GitCommandError({ kind: "network" }, { operation: "clone --depth" }),
  },
  {
    label: "an ssh failure that names no key",
    failure: new GitCommandError(
      { kind: "ssh-auth", detail: "unconfirmed" },
      { operation: "clone --depth", exitCode: 128 },
    ),
  },
  { label: "an error that is not git's", failure: new Error("Permission denied (publickey).") },
]) {
  test(`SG-SSH-05: on Windows gives nothing after ${label} and runs no check`, async () => {
    // arrange
    const { checks, calls } = checksAnswering({});
    const plan = await planPluginClone({ source: OWNER_REPO, checks, platform: "win32" });

    // act
    const attempts = await attemptsAfter(plan, failure);

    // assert
    assert.deepStrictEqual(attempts, [SSH_ATTEMPT]);
    assert.deepStrictEqual(calls, []);
  });
}

test("SG-SSH-05: on Windows gives no ssh retry after an https attempt that git could not run", async () => {
  // arrange
  const { checks } = checksAnswering(WINDOWS_CHECKS_PASS);
  const plan = await planPluginClone({ source: OWNER_REPO, checks, platform: "win32" });
  const gitMissing = new GitCommandError(
    { kind: "git-missing", detail: "not-found" },
    { operation: "clone" },
  );

  // act
  const afterSsh = await plan.after(PUBLICKEY_FAILURE, SSH_ATTEMPT);
  const afterHttps = await plan.after(gitMissing, HTTPS_ATTEMPT);

  // assert
  assert.deepStrictEqual([afterSsh, afterHttps], [HTTPS_ATTEMPT, undefined]);
});

test("SG-SSH-05: on Windows keeps ssh after a key failure when -G through git shows no direct hop", async () => {
  // arrange
  const { checks, calls } = checksAnswering({
    ...WINDOWS_CHECKS_PASS,
    showsDirectGitHubThroughGit: false,
  });
  const plan = await planPluginClone({ source: OWNER_REPO, checks, platform: "win32" });

  // act
  const attempts = await attemptsAfter(plan, PUBLICKEY_FAILURE);

  // assert
  assert.deepStrictEqual(attempts, [SSH_ATTEMPT]);
  assert.deepStrictEqual(calls, WINDOWS_CHECK_CALLS);
});

for (const { label, answers, calls } of [
  {
    label:
      "the user chose the ssh command (GIT_SSH_COMMAND or GIT_SSH in any spelling, empty included, or core.sshCommand)",
    answers: { userOverride: true },
    calls: ["userOverride"],
  },
  {
    label: "the user's git config rewrites the ssh url",
    answers: { userOverride: false, urlRewritten: true },
    calls: ["userOverride", "urlRewritten git@github.com:acme/ghp.git"],
  },
  {
    label: "-G through git timed out or showed a proxy",
    answers: { ...WINDOWS_CHECKS_PASS, showsDirectGitHubThroughGit: false },
    calls: WINDOWS_CHECK_CALLS,
  },
] satisfies ReadonlyArray<{ label: string; answers: CheckAnswers; calls: readonly string[] }>) {
  test(`SG-SSH-05: on Windows gives nothing after a key failure when ${label}`, async () => {
    // arrange
    const { checks, calls: made } = checksAnswering(answers);
    const plan = await planPluginClone({ source: OWNER_REPO, checks, platform: "win32" });

    // act
    const next = await plan.after(PUBLICKEY_FAILURE, SSH_ATTEMPT);

    // assert
    assert.strictEqual(next, undefined);
    assert.deepStrictEqual(made, calls);
  });
}

test("SG-SSH-05, D-SG-24: on Windows clones once over https and runs no check when CLAUDE_CODE_PLUGIN_PREFER_HTTPS is set", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});

  // act
  const plan = await planPluginClone({
    source: OWNER_REPO,
    force: "prefer-https",
    checks,
    platform: "win32",
  });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: HTTPS_ATTEMPT, note: "via-https" });
  assert.deepStrictEqual(await attemptsAfter(plan, PUBLICKEY_FAILURE), [HTTPS_ATTEMPT]);
  assert.deepStrictEqual(calls, []);
});

test("SG-SSH-05, OQ-1: on Windows clones an ssh url source once as written and runs no check", async () => {
  // arrange
  const { checks, calls } = checksAnswering({});
  const source: GitBackedSource = {
    kind: "url",
    raw: "git@github.com:acme/ghp.git",
    url: "git@github.com:acme/ghp",
  };

  // act
  const plan = await planPluginClone({ source, checks, platform: "win32" });

  // assert
  assert.deepStrictEqual(orderOf(plan), { first: SSH_ATTEMPT, note: "via-ssh" });
  assert.deepStrictEqual(await attemptsAfter(plan, PUBLICKEY_FAILURE), [SSH_ATTEMPT]);
  assert.deepStrictEqual(calls, []);
});

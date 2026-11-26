import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  carriedClone,
  cloneNoteOf,
  cloneOverGitHubTransports,
  createGitHubCloneNotes,
  createPluginTransportContext,
  pluginCloneTransport,
  transportForce,
  withOwnCloneNotes,
} from "../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import { GitHubTransportsFailedError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { captureDebugLog } from "../platform/debug-log-capture.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";

import type {
  TransportAttempt,
  TransportPlan,
} from "../../extensions/pi-claude-marketplace/domain/github-transport.ts";
import type { GitBackedSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import type {
  PluginSshOps,
  PluginTransportContext,
} from "../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";

const SSH_ATTEMPT = {
  transport: "ssh",
  url: "git@github.com:acme/tools.git",
} satisfies TransportAttempt;
const HTTPS_ATTEMPT = {
  transport: "https",
  url: "https://github.com/acme/tools.git",
} satisfies TransportAttempt;

/** The `after` calls a plan was asked, each with the failure and the attempt that failed. */
type AfterCalls = Array<readonly [unknown, TransportAttempt]>;

/**
 * A plan whose `first` attempt has `other` behind it, or nothing when `other`
 * is undefined, and that records each `after` call in `calls`.
 */
function planOf(
  first: TransportAttempt,
  note: TransportPlan["note"],
  other?: TransportAttempt,
  calls: AfterCalls = [],
): TransportPlan {
  return {
    first,
    ...(note !== undefined && { note }),
    after: (failure, failed) => {
      calls.push([failure, failed]);
      return Promise.resolve(failed === first ? other : undefined);
    },
  };
}

const SSH_FIRST = planOf(SSH_ATTEMPT, "via-ssh");

describe("createGitHubCloneNotes", () => {
  test("D-SG-22: keeps the last note recorded for each subject", () => {
    // arrange
    const notes = createGitHubCloneNotes();

    // act
    notes.record("acme/tools", { note: "via-https", url: "https://github.com/acme/tools.git" });
    notes.record("acme/tools", { note: "via-ssh", url: "git@github.com:acme/tools.git" });
    notes.record("acme/other", { note: "via-https", url: "https://github.com/acme/other.git" });

    // assert
    assert.deepStrictEqual(
      [notes.noteFor("acme/tools"), notes.noteFor("acme/other"), notes.noteFor("acme/none")],
      [
        { note: "via-ssh", url: "git@github.com:acme/tools.git" },
        { note: "via-https", url: "https://github.com/acme/other.git" },
        undefined,
      ],
    );
  });
});

describe("transportForce", () => {
  for (const value of ["1", "true", "yes", "on", " ON "]) {
    test(`D-SG-24: forces https first for CLAUDE_CODE_PLUGIN_PREFER_HTTPS=${JSON.stringify(value)}, before the base override`, (t) => {
      // arrange
      setGitHubBaseUrl(t, "https://mirror.example/git");

      // act
      const force = transportForce({ CLAUDE_CODE_PLUGIN_PREFER_HTTPS: value });

      // assert
      assert.strictEqual(force, "prefer-https");
    });
  }

  test("D-SG-24: forces nothing for CLAUDE_CODE_PLUGIN_PREFER_HTTPS=0 with no base override", (t) => {
    // arrange
    setGitHubBaseUrl(t, undefined);

    // act
    const force = transportForce({ CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "0" });

    // assert
    assert.strictEqual(force, undefined);
  });

  test("D-SG-24: does not read CLAUDE_CODE_REMOTE", (t) => {
    // arrange
    setGitHubBaseUrl(t, undefined);

    // act
    const force = transportForce({ CLAUDE_CODE_REMOTE: "1" });

    // assert
    assert.strictEqual(force, undefined);
  });

  test("D-SG-21: forces https while the GitHub base override is set", (t) => {
    // arrange
    setGitHubBaseUrl(t, "https://mirror.example/git");

    // act
    const force = transportForce({});

    // assert
    assert.strictEqual(force, "base-override");
  });

  test("forces nothing while the GitHub base override is unset", (t) => {
    // arrange
    setGitHubBaseUrl(t, undefined);

    // act
    const force = transportForce({});

    // assert
    assert.strictEqual(force, undefined);
  });
});

describe("cloneOverGitHubTransports", () => {
  test("SG-SSH-02: records the plan's note under the subject, then runs the first attempt", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const notes = createGitHubCloneNotes();
    const attempts: TransportAttempt[] = [];

    // act
    const cloned = await cloneOverGitHubTransports({
      plan: SSH_FIRST,
      notes,
      subject: "acme/tools",
      surface: "marketplace",
      attempt: (attempt) => {
        attempts.push(attempt);
        return Promise.resolve(`cloned ${attempt.url}`);
      },
    });

    // assert
    assert.strictEqual(cloned, "cloned git@github.com:acme/tools.git");
    assert.deepStrictEqual(attempts, [{ transport: "ssh", url: "git@github.com:acme/tools.git" }]);
    assert.deepStrictEqual(notes.noteFor("acme/tools"), {
      note: "via-ssh",
      url: "git@github.com:acme/tools.git",
    });
    assert.deepStrictEqual(logged, ["[git] SSH configured for GitHub, using SSH for acme/tools"]);
  });

  test("SG-SSH-02: logs the https choice of a probe that found no configured ssh", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const notes = createGitHubCloneNotes();

    // act
    await cloneOverGitHubTransports({
      plan: planOf(HTTPS_ATTEMPT, "ssh-not-configured", SSH_ATTEMPT),
      notes,
      subject: "acme/tools",
      surface: "marketplace",
      attempt: () => Promise.resolve(),
    });

    // assert
    assert.deepStrictEqual(logged, [
      "[git] SSH not configured for GitHub, using HTTPS for acme/tools",
    ]);
  });

  test("D-SG-22: records a forced https note and logs no probe choice", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const notes = createGitHubCloneNotes();

    // act
    await cloneOverGitHubTransports({
      plan: planOf(HTTPS_ATTEMPT, "via-https"),
      notes,
      subject: "acme/tools",
      surface: "marketplace",
      attempt: () => Promise.resolve(),
    });

    // assert
    assert.deepStrictEqual(notes.noteFor("acme/tools"), {
      note: "via-https",
      url: "https://github.com/acme/tools.git",
    });
    assert.deepStrictEqual(logged, []);
  });

  test("T-04-06: records each url of the note with its userinfo redacted", async () => {
    // arrange
    const notes = createGitHubCloneNotes();
    const first = {
      transport: "https",
      url: "https://x-access-token:tok123secret@github.com/acme/tools.git",
    } satisfies TransportAttempt;
    const retry = {
      transport: "https",
      url: "https://alice:s3cret@github.com/acme/tools.git",
    } satisfies TransportAttempt;

    // act
    await cloneOverGitHubTransports({
      plan: planOf(first, "via-https", retry),
      notes,
      subject: "tools@acme",
      surface: "plugin",
      attempt: (attempt) =>
        attempt === first ? Promise.reject(new Error("refused")) : Promise.resolve(),
    });

    // assert
    assert.deepStrictEqual(notes.noteFor("tools@acme"), {
      note: "via-https",
      url: "https://***@github.com/acme/tools.git",
      retries: ["https://***@github.com/acme/tools.git"],
    });
  });

  test("records nothing for a plan without a note", async () => {
    // arrange
    const notes = createGitHubCloneNotes();

    // act
    await cloneOverGitHubTransports({
      plan: planOf({ transport: "ssh", url: "git@127.0.0.1:acme/tools.git" }, undefined),
      notes,
      subject: "git@127.0.0.1:acme/tools.git",
      surface: "marketplace",
      attempt: () => Promise.resolve(),
    });

    // assert
    assert.strictEqual(notes.noteFor("git@127.0.0.1:acme/tools.git"), undefined);
  });

  test("SG-SSH-02: lets a failure the plan gives no attempt after reach the caller unchanged, with the note kept", async () => {
    // arrange
    const notes = createGitHubCloneNotes();
    const failure = new Error("ssh clone failed");
    const calls: AfterCalls = [];

    // act & assert
    await assert.rejects(
      cloneOverGitHubTransports({
        plan: planOf(SSH_ATTEMPT, "via-ssh", undefined, calls),
        notes,
        subject: "acme/tools",
        surface: "marketplace",
        beforeRetry: () => Promise.reject(new Error("no retry runs")),
        attempt: () => Promise.reject(failure),
      }),
      (error: unknown) => {
        assert.strictEqual(error, failure);
        return true;
      },
    );
    assert.deepStrictEqual(calls, [[failure, SSH_ATTEMPT]]);
    assert.deepStrictEqual(notes.noteFor("acme/tools"), {
      note: "via-ssh",
      url: "git@github.com:acme/tools.git",
    });
  });

  test("SG-SSH-02: clears the failed attempt and clones over https after the ssh attempt fails", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const notes = createGitHubCloneNotes();
    const events: string[] = [];

    // act
    const cloned = await cloneOverGitHubTransports({
      plan: planOf(SSH_ATTEMPT, "via-ssh", HTTPS_ATTEMPT),
      notes,
      subject: "acme/tools",
      surface: "marketplace",
      beforeRetry: () => {
        events.push("before retry");
        return Promise.resolve();
      },
      attempt: (attempt) => {
        events.push(`${attempt.transport} ${attempt.url}`);
        return attempt.transport === "ssh"
          ? Promise.reject(new Error("Repository not found."))
          : Promise.resolve(`cloned ${attempt.url}`);
      },
    });

    // assert
    assert.strictEqual(cloned, "cloned https://github.com/acme/tools.git");
    assert.deepStrictEqual(events, [
      "ssh git@github.com:acme/tools.git",
      "before retry",
      "https https://github.com/acme/tools.git",
    ]);
    assert.deepStrictEqual(notes.noteFor("acme/tools"), {
      note: "via-ssh",
      url: "git@github.com:acme/tools.git",
      retries: ["https://github.com/acme/tools.git"],
    });
    assert.deepStrictEqual(logged, [
      "[git] SSH configured for GitHub, using SSH for acme/tools",
      "[git] SSH clone failed for marketplace acme/tools (Repository not found.), falling back to HTTPS",
    ]);
  });

  test("SG-SSH-02: retries a run with no beforeRetry", async () => {
    // arrange
    const notes = createGitHubCloneNotes();
    const attempts: TransportAttempt[] = [];

    // act
    await cloneOverGitHubTransports({
      plan: planOf(SSH_ATTEMPT, "via-ssh", HTTPS_ATTEMPT),
      notes,
      subject: "acme/tools",
      surface: "marketplace",
      attempt: (attempt) => {
        attempts.push(attempt);
        return attempts.length === 1 ? Promise.reject(new Error("failed")) : Promise.resolve();
      },
    });

    // assert
    assert.deepStrictEqual(attempts, [SSH_ATTEMPT, HTTPS_ATTEMPT]);
  });

  test("T-04-14: logs a failure's message with no credential and no absolute path", async (t) => {
    // arrange
    const logged = captureDebugLog(t);

    // act
    await cloneOverGitHubTransports({
      plan: planOf(SSH_ATTEMPT, undefined, HTTPS_ATTEMPT),
      notes: createGitHubCloneNotes(),
      subject: "acme/tools",
      surface: "marketplace",
      attempt: (attempt) =>
        attempt.transport === "ssh"
          ? Promise.reject(
              new Error(
                "clone of https://acme:s3cret@github.com/acme/tools.git into /home/acme/x failed",
              ),
            )
          : Promise.resolve(),
    });

    // assert
    assert.deepStrictEqual(logged, [
      "[git] SSH clone failed for marketplace acme/tools (clone of https://***@github.com/acme/tools.git into x failed), falling back to HTTPS",
    ]);
  });

  test("SG-SSH-02: clones over ssh after the https attempt fails", async () => {
    // arrange
    const notes = createGitHubCloneNotes();
    const attempts: TransportAttempt[] = [];

    // act
    const cloned = await cloneOverGitHubTransports({
      plan: planOf(HTTPS_ATTEMPT, "ssh-not-configured", SSH_ATTEMPT),
      notes,
      subject: "acme/tools",
      surface: "marketplace",
      attempt: (attempt) => {
        attempts.push(attempt);
        return attempt.transport === "https"
          ? Promise.reject(new Error("authentication required"))
          : Promise.resolve(`cloned ${attempt.url}`);
      },
    });

    // assert
    assert.strictEqual(cloned, "cloned git@github.com:acme/tools.git");
    assert.deepStrictEqual(attempts, [HTTPS_ATTEMPT, SSH_ATTEMPT]);
    assert.deepStrictEqual(notes.noteFor("acme/tools"), {
      note: "ssh-not-configured",
      url: "https://github.com/acme/tools.git",
      retries: ["git@github.com:acme/tools.git"],
    });
  });

  test("D-SG-22, OQ-8: throws one error that names both attempts when both fail with different messages", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const httpsFailure = new Error("authentication required");
    const sshFailure = new Error("Permission denied (publickey).");

    // act & assert
    await assert.rejects(
      cloneOverGitHubTransports({
        plan: planOf(HTTPS_ATTEMPT, undefined, SSH_ATTEMPT),
        notes: createGitHubCloneNotes(),
        subject: "acme/tools",
        surface: "marketplace",
        attempt: (attempt) =>
          Promise.reject(attempt.transport === "https" ? httpsFailure : sshFailure),
      }),
      (error: unknown) => {
        assert.ok(error instanceof GitHubTransportsFailedError);
        assert.strictEqual(error.surface, "marketplace");
        assert.deepStrictEqual(error.attempts, [
          { ...HTTPS_ATTEMPT, error: httpsFailure },
          { ...SSH_ATTEMPT, error: sshFailure },
        ]);
        assert.strictEqual(
          error.message,
          "Fetching the marketplace from GitHub failed on both attempts. HTTPS (https://github.com/acme/tools.git): authentication required\n\nSSH (git@github.com:acme/tools.git): Permission denied (publickey).",
        );
        return true;
      },
    );
    assert.deepStrictEqual(logged, [
      "[git] HTTPS clone failed for marketplace acme/tools (authentication required), falling back to SSH",
      "[git] SSH clone fallback also failed for marketplace acme/tools: Permission denied (publickey).",
    ]);
  });

  test("wqo: throws the second error unchanged when a marketplace clone fails over both with the same message", async () => {
    // arrange
    const sshFailure = new Error("network unreachable");
    const httpsFailure = new Error("network unreachable");

    // act & assert
    await assert.rejects(
      cloneOverGitHubTransports({
        plan: planOf(SSH_ATTEMPT, "via-ssh", HTTPS_ATTEMPT),
        notes: createGitHubCloneNotes(),
        subject: "acme/tools",
        surface: "marketplace",
        attempt: (attempt) =>
          Promise.reject(attempt.transport === "ssh" ? sshFailure : httpsFailure),
      }),
      (error: unknown) => {
        assert.strictEqual(error, httpsFailure);
        return true;
      },
    );
  });

  test("throws one error that names both attempts when a plugin clone fails over both with the same message", async () => {
    // arrange
    const failure = new Error("network unreachable");

    // act & assert
    await assert.rejects(
      cloneOverGitHubTransports({
        plan: planOf(HTTPS_ATTEMPT, undefined, SSH_ATTEMPT),
        notes: createGitHubCloneNotes(),
        subject: "tools@acme",
        surface: "plugin",
        attempt: () => Promise.reject(failure),
      }),
      (error: unknown) => {
        assert.ok(error instanceof GitHubTransportsFailedError);
        assert.strictEqual(error.surface, "plugin");
        return true;
      },
    );
  });

  test("D-SG-18, upstream zHi: gives a plugin clone that fails over both Claude Code's retry text", async () => {
    // act & assert
    await assert.rejects(
      cloneOverGitHubTransports({
        plan: planOf(HTTPS_ATTEMPT, "ssh-not-configured", SSH_ATTEMPT),
        notes: createGitHubCloneNotes(),
        subject: "ghp@gits",
        surface: "plugin",
        attempt: (attempt) =>
          Promise.reject(new Error(attempt.transport === "https" ? "https refused" : "ssh denied")),
      }),
      (error: unknown) => {
        assert.ok(error instanceof GitHubTransportsFailedError);
        assert.strictEqual(
          error.message,
          "https refused\nThe retry over SSH failed too: ssh denied\nCheck the repository and ref in the marketplace entry and that github.com can be reached. If the repository is private, add an SSH key to your GitHub account or set up a git credential helper for https://github.com. Then install again.",
        );
        return true;
      },
    );
  });

  test("SG-SSH-05: runs the third attempt the plan gives after the retry fails, with both retries noted", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const notes = createGitHubCloneNotes();
    const attempts: TransportAttempt[] = [];
    const plan: TransportPlan = {
      first: SSH_ATTEMPT,
      note: "via-ssh",
      after: (_failure, failed) =>
        Promise.resolve(failed.transport === "ssh" ? HTTPS_ATTEMPT : SSH_ATTEMPT),
    };

    // act
    const cloned = await cloneOverGitHubTransports({
      plan,
      notes,
      subject: "ghp@gits",
      surface: "plugin",
      attempt: (attempt) => {
        attempts.push(attempt);
        return attempts.length < 3
          ? Promise.reject(new Error(`${attempt.transport} refused`))
          : Promise.resolve(`cloned ${attempt.url}`);
      },
    });

    // assert
    assert.strictEqual(cloned, "cloned git@github.com:acme/tools.git");
    assert.deepStrictEqual(attempts, [SSH_ATTEMPT, HTTPS_ATTEMPT, SSH_ATTEMPT]);
    assert.deepStrictEqual(notes.noteFor("ghp@gits"), {
      note: "via-ssh",
      url: "git@github.com:acme/tools.git",
      retries: ["https://github.com/acme/tools.git", "git@github.com:acme/tools.git"],
    });
    assert.deepStrictEqual(logged, [
      "[git] SSH configured for GitHub, using SSH for ghp@gits",
      "[git] SSH clone failed for plugin ghp@gits (ssh refused), falling back to HTTPS",
      "[git] HTTPS clone failed for plugin ghp@gits (https refused), falling back to SSH",
    ]);
  });

  test("SG-SSH-05: stops after three attempts and names the last two when they all fail", async () => {
    // arrange
    const attempts: TransportAttempt[] = [];
    const failures = [new Error("ssh denied"), new Error("https refused"), new Error("ssh again")];
    const plan: TransportPlan = {
      first: SSH_ATTEMPT,
      after: (_failure, failed) =>
        Promise.resolve(failed.transport === "ssh" ? HTTPS_ATTEMPT : SSH_ATTEMPT),
    };

    // act & assert
    await assert.rejects(
      cloneOverGitHubTransports({
        plan,
        notes: createGitHubCloneNotes(),
        subject: "ghp@gits",
        surface: "plugin",
        attempt: (attempt) => {
          attempts.push(attempt);
          return Promise.reject(failures[attempts.length - 1] ?? new Error("a fourth attempt"));
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof GitHubTransportsFailedError);
        assert.deepStrictEqual(
          error.attempts.map((attempt) => [attempt.transport, attempt.error.message]),
          [
            ["https", "https refused"],
            ["ssh", "ssh again"],
          ],
        );
        return true;
      },
    );
    assert.deepStrictEqual(attempts, [SSH_ATTEMPT, HTTPS_ATTEMPT, SSH_ATTEMPT]);
  });

  test("D-SG-22: holds a rejection that is not an Error as an Error with its text", async () => {
    // act & assert
    await assert.rejects(
      cloneOverGitHubTransports({
        plan: planOf(HTTPS_ATTEMPT, undefined, SSH_ATTEMPT),
        notes: createGitHubCloneNotes(),
        subject: "acme/tools",
        surface: "marketplace",
        attempt: (attempt) =>
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the case pins a rejection that is not an Error
          Promise.reject(attempt.transport === "https" ? "refused" : new Error("denied")),
      }),
      (error: unknown) => {
        assert.ok(error instanceof GitHubTransportsFailedError);
        assert.deepStrictEqual(
          error.attempts.map((attempt) => [attempt.transport, attempt.error.message]),
          [
            ["https", "refused"],
            ["ssh", "denied"],
          ],
        );
        return true;
      },
    );
  });
});

/** A port that answers `answers` and records each call by its name. */
function countingPort(answers: {
  readonly userOverride?: boolean;
  readonly rewritten?: boolean;
  readonly probe?: Awaited<ReturnType<PluginSshOps["probe"]>>;
  readonly hop?: Awaited<ReturnType<PluginSshOps["showsDirectGitHub"]>>;
  readonly throughGit?: boolean;
}): { readonly ssh: PluginSshOps; readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    ssh: {
      showsDirectGitHub: () => {
        calls.push("showsDirectGitHub");
        return Promise.resolve(answers.hop ?? { kind: "ran", direct: true, exitCode: 0 });
      },
      probe: () => {
        calls.push("probe");
        return Promise.resolve(answers.probe ?? "not-configured");
      },
      userOverride: () => {
        calls.push("userOverride");
        return Promise.resolve(answers.userOverride ?? false);
      },
      urlRewritten: (sshUrl) => {
        calls.push(`urlRewritten ${sshUrl}`);
        return Promise.resolve({ rewritten: answers.rewritten ?? false, exitCode: 0 });
      },
      showsDirectGitHubThroughGit: (sshUrl) => {
        calls.push(`showsDirectGitHubThroughGit ${sshUrl}`);
        return Promise.resolve(answers.throughGit ?? true);
      },
    },
  };
}

describe("createPluginTransportContext", () => {
  test("D-SG-24: reads the force of the environment it is given", () => {
    // act
    const context = createPluginTransportContext({
      env: { CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "true" },
      ssh: countingPort({}).ssh,
    });

    // assert
    assert.strictEqual(context.force, "prefer-https");
  });

  test("D-SG-18: asks the port each check once for the whole context", async () => {
    // arrange
    const { ssh, calls } = countingPort({ probe: "unknown", userOverride: true });
    const context = createPluginTransportContext({ env: {}, ssh });

    // act
    const answers = [
      await context.checks.probe(),
      await context.checks.probe(),
      await context.checks.userOverride(),
      await context.checks.userOverride(),
    ];

    // assert
    assert.deepStrictEqual(answers, ["unknown", "unknown", true, true]);
    assert.deepStrictEqual(calls, ["probe", "userOverride"]);
  });

  test("D-SG-18: asks the port the rewrite check once per url and logs nothing for an unchanged url", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const { ssh, calls } = countingPort({ rewritten: false });
    const context = createPluginTransportContext({ env: {}, ssh });

    // act
    const answers = [
      await context.checks.urlRewritten("git@github.com:acme/one.git"),
      await context.checks.urlRewritten("git@github.com:acme/one.git"),
      await context.checks.urlRewritten("git@github.com:acme/two.git"),
    ];

    // assert
    assert.deepStrictEqual(answers, [false, false, false]);
    assert.deepStrictEqual(calls, [
      "urlRewritten git@github.com:acme/one.git",
      "urlRewritten git@github.com:acme/two.git",
    ]);
    assert.deepStrictEqual(logged, []);
  });

  test("D-SG-18: logs Claude Code's line with the exit code for a rewritten url", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const context = createPluginTransportContext({
      env: {},
      ssh: {
        ...countingPort({}).ssh,
        urlRewritten: () => Promise.resolve({ rewritten: true, exitCode: 128 }),
      },
    });

    // act
    const rewritten = await context.checks.urlRewritten("git@github.com:acme/one.git");

    // assert
    assert.strictEqual(rewritten, true);
    assert.deepStrictEqual(logged, [
      "[git] GitHub SSH URL is rewritten by git config, or git could not say (code=128): staying on SSH",
    ]);
  });

  test("D-SG-18: answers both ssh -G checks from one launch and logs nothing for a direct hop", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const { ssh, calls } = countingPort({ hop: { kind: "ran", direct: true, exitCode: 0 } });
    const context = createPluginTransportContext({ env: {}, ssh });

    // act
    const answers = [
      await context.checks.sshPresent(),
      await context.checks.showsDirectGitHub(),
      await context.checks.showsDirectGitHub(),
    ];

    // assert
    assert.deepStrictEqual(answers, [true, true, true]);
    assert.deepStrictEqual(calls, ["showsDirectGitHub"]);
    assert.deepStrictEqual(logged, []);
  });

  test("D-SG-18: reads a missing ssh as no ssh present", async () => {
    // arrange
    const context = createPluginTransportContext({
      env: {},
      ssh: countingPort({ hop: { kind: "missing" } }).ssh,
    });

    // act
    const present = await context.checks.sshPresent();

    // assert
    assert.strictEqual(present, false);
  });

  for (const { label, hop, line } of [
    {
      label: "a hop that is not direct",
      hop: { kind: "ran", direct: false, exitCode: 0 },
      line: "[git] ssh -G does not show git@github.com going straight to github.com (code=0): staying on SSH",
    },
    {
      label: "no ssh",
      hop: { kind: "missing" },
      line: "[git] ssh -G does not show git@github.com going straight to github.com (code=null): staying on SSH",
    },
  ] satisfies ReadonlyArray<{
    label: string;
    hop: Awaited<ReturnType<PluginSshOps["showsDirectGitHub"]>>;
    line: string;
  }>) {
    test(`D-SG-18: logs Claude Code's line once for ${label}`, async (t) => {
      // arrange
      const logged = captureDebugLog(t);
      const context = createPluginTransportContext({ env: {}, ssh: countingPort({ hop }).ssh });

      // act
      const answers = [
        await context.checks.showsDirectGitHub(),
        await context.checks.showsDirectGitHub(),
      ];

      // assert
      assert.deepStrictEqual(answers, [false, false]);
      assert.deepStrictEqual(logged, [line]);
    });
  }

  test("SG-SSH-05: takes this process's platform when it is given none", () => {
    // act
    const context = createPluginTransportContext({ env: {}, ssh: countingPort({}).ssh });

    // assert
    assert.strictEqual(context.platform, process.platform);
  });

  test("SG-SSH-05: keeps the platform it is given", () => {
    // act
    const context = createPluginTransportContext({
      env: {},
      ssh: countingPort({}).ssh,
      platform: "win32",
    });

    // assert
    assert.strictEqual(context.platform, "win32");
  });

  test("SG-SSH-05: asks the port the -G check through git once per url", async () => {
    // arrange
    const { ssh, calls } = countingPort({ throughGit: false });
    const context = createPluginTransportContext({ env: {}, ssh, platform: "win32" });

    // act
    const answers = [
      await context.checks.showsDirectGitHubThroughGit("git@github.com:acme/one.git"),
      await context.checks.showsDirectGitHubThroughGit("git@github.com:acme/one.git"),
      await context.checks.showsDirectGitHubThroughGit("git@github.com:acme/two.git"),
    ];

    // assert
    assert.deepStrictEqual(answers, [false, false, false]);
    assert.deepStrictEqual(calls, [
      "showsDirectGitHubThroughGit git@github.com:acme/one.git",
      "showsDirectGitHubThroughGit git@github.com:acme/two.git",
    ]);
  });

  test("D-SG-22: starts each context with notes of its own", () => {
    // arrange
    const port = countingPort({}).ssh;
    const first = createPluginTransportContext({ env: {}, ssh: port });
    const second = createPluginTransportContext({ env: {}, ssh: port });

    // act
    first.notes.record("ghp@gits", { note: "via-ssh", url: "git@github.com:acme/ghp.git" });

    // assert
    assert.strictEqual(second.notes.noteFor("ghp@gits"), undefined);
  });
});

describe("pluginCloneTransport", () => {
  const ghp = { kind: "github", raw: "acme/ghp", owner: "acme", repo: "ghp" } as const;

  test("D-SG-19: asks no check until its plan is made, then plans over the context's checks", async () => {
    // arrange
    const port = countingPort({});
    const context = createPluginTransportContext({ env: {}, ssh: port.ssh, platform: "linux" });

    // act
    const transport = pluginCloneTransport(context, ghp, "ghp@gits");
    const before = [...port.calls];
    const plan = await transport.plan();

    // assert
    assert.deepStrictEqual(
      { before, first: plan.first, note: plan.note, calls: port.calls },
      {
        before: [],
        first: { transport: "https", url: "https://github.com/acme/ghp.git" },
        note: "ssh-not-configured",
        calls: [
          "userOverride",
          "urlRewritten git@github.com:acme/ghp.git",
          "probe",
          "showsDirectGitHub",
        ],
      },
    );
  });

  test("D-SG-22: notes into the context's notes under its subject", () => {
    // arrange
    const context = createPluginTransportContext({ env: {}, ssh: countingPort({}).ssh });

    // act
    const transport = pluginCloneTransport(context, ghp, "ghp@gits");

    // assert
    assert.deepStrictEqual(
      { sharesNotes: transport.notes === context.notes, subject: transport.subject },
      { sharesNotes: true, subject: "ghp@gits" },
    );
  });

  test("D-SG-24: plans one HTTPS attempt with no check when the context's environment forces it", async () => {
    // arrange
    const port = countingPort({});
    const context = createPluginTransportContext({
      env: { CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "true" },
      ssh: port.ssh,
      platform: "linux",
    });

    // act
    const plan = await pluginCloneTransport(context, ghp, "ghp@gits").plan();

    // assert
    assert.deepStrictEqual(
      { first: plan.first, calls: port.calls },
      { first: { transport: "https", url: "https://github.com/acme/ghp.git" }, calls: [] },
    );
  });

  test("D-SG-20: plans a git-subdir shorthand over HTTPS when the context's environment forces it", async () => {
    // arrange
    const context = createPluginTransportContext({
      env: { CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "1" },
      ssh: countingPort({}).ssh,
      platform: "linux",
    });
    const source = {
      kind: "git-subdir",
      raw: "acme/mono",
      url: "acme/mono",
      path: "plugins/ghp",
    } satisfies GitBackedSource;

    // act
    const plan = await pluginCloneTransport(context, source, "ghp@gits").plan();

    // assert
    assert.deepStrictEqual(plan.first, {
      transport: "https",
      url: "https://github.com/acme/mono.git",
    });
  });

  for (const { kind, source, url } of [
    {
      kind: "url",
      source: {
        kind: "url",
        raw: "https://gitlab.example/acme/ghp.git",
        url: "https://gitlab.example/acme/ghp.git",
      },
      url: "https://gitlab.example/acme/ghp.git",
    },
    {
      kind: "git-subdir",
      source: {
        kind: "git-subdir",
        raw: "https://gitlab.example/acme/mono.git",
        url: "https://gitlab.example/acme/mono.git",
        path: "plugins/ghp",
      },
      url: "https://gitlab.example/acme/mono.git",
    },
  ] satisfies ReadonlyArray<{
    readonly kind: string;
    readonly source: GitBackedSource;
    readonly url: string;
  }>) {
    test(`GHB-04: plans a ${kind} clone outside GitHub without reading an invalid base`, async (t) => {
      // arrange
      setGitHubBaseUrl(t, "http://mirror.example");
      const port = countingPort({});
      const context = createPluginTransportContext({ env: {}, ssh: port.ssh, platform: "linux" });

      // act
      const plan = await pluginCloneTransport(context, source, "ghp@gits").plan();

      // assert
      assert.deepStrictEqual(
        { first: plan.first, note: plan.note, calls: port.calls },
        { first: { transport: "https", url }, note: undefined, calls: [] },
      );
    });
  }

  test("SG-SSH-05: plans SSH first on the context's Windows platform", async () => {
    // arrange
    const port = countingPort({});
    const context = createPluginTransportContext({ env: {}, ssh: port.ssh, platform: "win32" });

    // act
    const plan = await pluginCloneTransport(context, ghp, "ghp@gits").plan();

    // assert
    assert.deepStrictEqual(
      { first: plan.first, calls: port.calls },
      { first: { transport: "ssh", url: "git@github.com:acme/ghp.git" }, calls: [] },
    );
  });
});

describe("withOwnCloneNotes", () => {
  test("D-SG-22: keeps the notes recorded through the view apart and hands each to the context", () => {
    // arrange
    const context = createPluginTransportContext({ env: {}, ssh: countingPort({}).ssh });
    const own = { note: "via-https", url: "https://github.com/acme/ghp.git" } as const;
    const other = { note: "via-ssh", url: "git@github.com:acme/ghp.git" } as const;
    const view = withOwnCloneNotes(context);
    const otherView = withOwnCloneNotes(context);

    // act
    view.notes.record("ghp@gits", own);
    otherView.notes.record("tools@gits", other);

    // assert
    assert.deepStrictEqual(
      {
        viewGhp: view.notes.noteFor("ghp@gits"),
        viewTools: view.notes.noteFor("tools@gits"),
        contextGhp: context.notes.noteFor("ghp@gits"),
        contextTools: context.notes.noteFor("tools@gits"),
      },
      { viewGhp: own, viewTools: undefined, contextGhp: own, contextTools: other },
    );
  });

  test("D-SG-22, NFR-5: shares the context's checks and platform and reads its force only when asked", () => {
    // arrange
    const reads: string[] = [];
    const context = createPluginTransportContext({
      env: { CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "true" },
      ssh: countingPort({}).ssh,
      platform: "win32",
    });
    const counted: PluginTransportContext = {
      get force() {
        reads.push("force");
        return context.force;
      },
      platform: context.platform,
      checks: context.checks,
      notes: context.notes,
    };

    // act
    const view = withOwnCloneNotes(counted);
    const before = [...reads];
    const force = view.force;

    // assert
    assert.deepStrictEqual(
      {
        before,
        force,
        after: reads,
        platform: view.platform,
        sharesChecks: view.checks === context.checks,
      },
      {
        before: [],
        force: "prefer-https",
        after: ["force"],
        platform: "win32",
        sharesChecks: true,
      },
    );
  });
});

describe("carriedClone", () => {
  test("D-SG-22: carries the clone note of an outcome that has one", () => {
    // arrange
    const outcome = {
      status: "added",
      name: "official",
      clone: { note: "via-ssh", url: "git@github.com:acme/official.git" },
    } as const;

    // act
    const carried = carriedClone(outcome);

    // assert
    assert.deepStrictEqual(carried, {
      clone: { note: "via-ssh", url: "git@github.com:acme/official.git" },
    });
  });

  test("D-SG-22, NREG-01: carries nothing for an outcome that cloned nothing", () => {
    // arrange
    const outcome = {};

    // act
    const carried = carriedClone(outcome);

    // assert
    assert.deepStrictEqual(carried, {});
  });
});

describe("cloneNoteOf", () => {
  test("D-SG-22: gives the note the collector keeps for the subject", () => {
    // arrange
    const notes = createGitHubCloneNotes();
    notes.record("formatter@official", {
      note: "ssh-not-configured",
      url: "https://github.com/acme/formatter.git",
    });
    notes.record("linter@official", { note: "via-ssh", url: "git@github.com:acme/linter.git" });

    // act
    const noted = cloneNoteOf(notes, "formatter@official");

    // assert
    assert.deepStrictEqual(noted, {
      clone: { note: "ssh-not-configured", url: "https://github.com/acme/formatter.git" },
    });
  });

  test("D-SG-22, NREG-01: gives nothing for a subject that cloned nothing", () => {
    // arrange
    const notes = createGitHubCloneNotes();
    notes.record("linter@official", { note: "via-ssh", url: "git@github.com:acme/linter.git" });

    // act
    const noted = cloneNoteOf(notes, "formatter@official");

    // assert
    assert.deepStrictEqual(noted, {});
  });
});

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  cloneOverGitHubTransports,
  createGitHubCloneNotes,
  createPluginTransportContext,
  transportForce,
} from "../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import { GitHubTransportsFailedError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { captureDebugLog } from "../platform/debug-log-capture.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";

import type {
  TransportAttempt,
  TransportPlan,
} from "../../extensions/pi-claude-marketplace/domain/github-transport.ts";
import type { PluginSshOps } from "../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";

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
}): { readonly ssh: PluginSshOps; readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    ssh: {
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

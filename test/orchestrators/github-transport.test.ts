import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  cloneOverGitHubTransports,
  createGitHubCloneNotes,
  transportForce,
} from "../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import { captureDebugLog } from "../platform/debug-log-capture.ts";
import { setGitHubBaseUrl } from "../shared/github-base-url-environment.ts";

import type {
  TransportAttempt,
  TransportPlan,
} from "../../extensions/pi-claude-marketplace/domain/github-transport.ts";

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
});

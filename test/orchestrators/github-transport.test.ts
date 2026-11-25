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

const SSH_FIRST = {
  first: { transport: "ssh", url: "git@github.com:acme/tools.git" },
  note: "via-ssh",
} satisfies TransportPlan;

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
      plan: {
        first: { transport: "https", url: "https://github.com/acme/tools.git" },
        note: "ssh-not-configured",
      },
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
      plan: {
        first: { transport: "https", url: "https://github.com/acme/tools.git" },
        note: "via-https",
      },
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
      plan: { first: { transport: "ssh", url: "git@127.0.0.1:acme/tools.git" } },
      notes,
      subject: "git@127.0.0.1:acme/tools.git",
      surface: "marketplace",
      attempt: () => Promise.resolve(),
    });

    // assert
    assert.strictEqual(notes.noteFor("git@127.0.0.1:acme/tools.git"), undefined);
  });

  test("SG-SSH-02: lets a failure of the first attempt reach the caller unchanged, with the note kept", async () => {
    // arrange
    const notes = createGitHubCloneNotes();
    const failure = new Error("ssh clone failed");

    // act & assert
    await assert.rejects(
      cloneOverGitHubTransports({
        plan: SSH_FIRST,
        notes,
        subject: "acme/tools",
        surface: "marketplace",
        attempt: () => Promise.reject(failure),
      }),
      (error: unknown) => {
        assert.strictEqual(error, failure);
        return true;
      },
    );
    assert.deepStrictEqual(notes.noteFor("acme/tools"), {
      note: "via-ssh",
      url: "git@github.com:acme/tools.git",
    });
  });
});

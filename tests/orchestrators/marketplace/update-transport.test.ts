// tests/orchestrators/marketplace/update-transport.test.ts
//
// Transport-failure classification and auth-seam threading for marketplace
// update, complementing update.test.ts:
//   - D-76-08 / D-79-03: the 403 arm of the auth-challenge duck-type (401 is
//     covered in update.test.ts; 401/403 must classify identically), and an
//     HttpError with a non-auth status must NOT classify as a challenge.
//   - a NON-Error transport throw (a rejected string) must fall through the
//     challenge duck-type and still render the `(failed)` row.
//   - AUTH-02 / D-79-05: an injected deviceFlowHttp threads into the url and
//     github refresh paths without altering a public refresh.

import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  githubSource,
  parsePluginSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { updateMarketplace } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { makeMockDeviceFlowHttp } from "../../helpers/device-flow-mock.ts";
import { fixtureMarketplaceDir, makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}

async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-upd-transport-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-upd-transport-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true, maxRetries: 10 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 10 });
  }
}

/** Seed a url-source marketplace with a pre-populated valid clone dir. */
async function seedUrlMarketplace(opts: { cwd: string; name: string }): Promise<void> {
  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const cloneDir = await locations.sourceCloneDir(opts.name);
  await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [opts.name]: {
        name: opts.name,
        scope: "project",
        source: parsePluginSource(`https://gitlab.example.com/team/${opts.name}#main`),
        addedFromCwd: opts.cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: {},
      },
    },
  });
}

/** Seed a github-source marketplace with a pre-populated valid clone dir. */
async function seedGithubMarketplace(opts: { cwd: string; name: string }): Promise<void> {
  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const cloneDir = await locations.sourceCloneDir(opts.name);
  await cp(fixtureMarketplaceDir("valid-marketplace"), cloneDir, { recursive: true });
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      [opts.name]: {
        name: opts.name,
        scope: "project",
        source: githubSource("https://github.com/anthropics/claude-plugins-official#main"),
        addedFromCwd: opts.cwd,
        manifestPath: path.join(cloneDir, ".claude-plugin", "marketplace.json"),
        marketplaceRoot: cloneDir,
        plugins: {},
      },
    },
  });
}

test("D-76-08: a no-provider url refresh that 403s classifies {authentication required} with the no-provider cause line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedUrlMarketplace({ cwd, name: "urlmp-403" });
    const { ctx, pi, notifications } = makeCtx();
    const httpErr = Object.assign(new Error("HTTP 403 from fetch"), {
      code: "HttpError",
      data: { statusCode: 403 },
    });
    const { gitOps } = makeMockGitOps({ fetchThrows: httpErr });

    await updateMarketplace({ ctx, pi, name: "urlmp-403", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    // 403 classifies identically to 401: the closed-set token, never the
    // lying {network unreachable} default.
    assert.ok(
      first.message.includes("{authentication required}"),
      `expected the authentication-required child row, got: ${first.message}`,
    );
    assert.equal(first.message.includes("{network unreachable}"), false);
    assert.match(first.message, /cause:.*no auth provider is registered for gitlab\.example\.com/);
  });
});

test("D-76-08: a url refresh HttpError with a NON-auth status (500) is NOT an auth challenge -> {network unreachable}, no cause line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedUrlMarketplace({ cwd, name: "urlmp-500" });
    const { ctx, pi, notifications } = makeCtx();
    const httpErr = Object.assign(new Error("HTTP 500 from fetch"), {
      code: "HttpError",
      data: { statusCode: 500 },
    });
    const { gitOps } = makeMockGitOps({ fetchThrows: httpErr });

    await updateMarketplace({ ctx, pi, name: "urlmp-500", scope: "project", cwd, gitOps });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.equal(first.message.includes("{authentication required}"), false);
    assert.ok(
      first.message.includes("{network unreachable}"),
      `expected the network-unreachable fallback, got: ${first.message}`,
    );
    assert.equal(first.message.includes("no auth provider is registered"), false);
  });
});

test("a NON-Error transport throw on a url refresh falls through the challenge duck-type and renders (failed)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedUrlMarketplace({ cwd, name: "urlmp-string" });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps();
    // A rejected STRING (no Error prototype): the auth-challenge duck-type
    // must reject it up-front (instanceof Error gate) without crashing, and
    // the update must still fold to the `(failed)` row.
    const stringThrowingGitOps: GitOps = {
      ...gitOps,
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- the non-Error rejection IS the behavior under test.
      fetch: () => Promise.reject("transport exploded (string reject)"),
    };

    await updateMarketplace({
      ctx,
      pi,
      name: "urlmp-string",
      scope: "project",
      cwd,
      gitOps: stringThrowingGitOps,
    });

    assert.equal(notifications.length, 1);
    const first = notifications[0];
    assert.ok(first !== undefined);
    assert.equal(first.severity, "error");
    assert.match(first.message, /urlmp-string \[project\] \(failed\)/);
    assert.equal(first.message.includes("{authentication required}"), false);
    assert.equal(first.message.includes("no auth provider is registered"), false);
  });
});

test("AUTH-02 / D-79-05: an injected deviceFlowHttp threads through a public url refresh without altering the no-op outcome", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedUrlMarketplace({ cwd, name: "urlmp-df" });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000011" },
    });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { http: deviceFlowHttp, state: dfState } = makeMockDeviceFlowHttp();

    await updateMarketplace({
      ctx,
      pi,
      name: "urlmp-df",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
      deviceFlowHttp,
    });

    // gitlab.example.com has no registered provider: the refresh stays
    // authless and the Device Flow seam is never invoked -- passing the seam
    // must not change the public path.
    assert.equal(state.fetchCalls.length, 1);
    assert.equal(Object.hasOwn(state.fetchCalls[0] ?? {}, "auth"), false);
    assert.equal(dfState.requestCodeCalls.length, 0);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.message, "● urlmp-df [project] (skipped) {up-to-date}");
  });
});

test("AUTH-02 / D-79-05: an injected deviceFlowHttp threads through a github refresh; the auth bundle rides the fetch untriggered", async () => {
  await withHermeticHome(async ({ cwd }) => {
    await seedGithubMarketplace({ cwd, name: "official-df" });
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state } = makeMockGitOps({
      remoteRefs: { "refs/remotes/origin/main": "abcdef0000000000000000000000000000000012" },
    });
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { http: deviceFlowHttp, state: dfState } = makeMockDeviceFlowHttp();

    await updateMarketplace({
      ctx,
      pi,
      name: "official-df",
      scope: "project",
      cwd,
      gitOps,
      credentialOps,
      deviceFlowHttp,
    });

    // github.com HAS a registered provider: the fetch carries an auth bundle
    // keyed to github.com, but the mock never challenges so Device Flow does
    // not run (AUTH-02 silent-reuse contract holds trivially on 200s).
    assert.equal(state.fetchCalls.length, 1);
    assert.equal(state.fetchCalls[0]?.auth?.host, "github.com");
    assert.equal(dfState.requestCodeCalls.length, 0);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.message, "● official-df [project] (skipped) {up-to-date}");
  });
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { planMarketplaceClone } from "../../extensions/pi-claude-marketplace/domain/github-transport.ts";
import {
  DeviceFlowUnavailableError,
  GitCommandError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type {
  MarketplaceClonePlanInput,
  TransportAttempt,
  TransportPlan,
} from "../../extensions/pi-claude-marketplace/domain/github-transport.ts";
import type {
  GitHubSource,
  UrlSource,
} from "../../extensions/pi-claude-marketplace/domain/source.ts";

type ProbeAnswer = Awaited<ReturnType<MarketplaceClonePlanInput["probe"]>>;

const OWNER_REPO = {
  kind: "github",
  raw: "acme/tools",
  owner: "acme",
  repo: "tools",
} satisfies GitHubSource;

/** A plan without its `after`, which a deep comparison cannot hold. */
type PlanOrder = Omit<TransportPlan, "after">;

function orderOf(plan: TransportPlan): PlanOrder {
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

const SSH_ATTEMPT = {
  transport: "ssh",
  url: "git@github.com:acme/tools.git",
} satisfies TransportAttempt;
const HTTPS_ATTEMPT = {
  transport: "https",
  url: "https://github.com/acme/tools.git",
} satisfies TransportAttempt;

// A probe that records each call and gives `answer`.
function probeAnswering(answer: ProbeAnswer): {
  readonly probe: () => Promise<ProbeAnswer>;
  readonly calls: () => number;
} {
  let calls = 0;
  return {
    probe: () => {
      calls += 1;
      return Promise.resolve(answer);
    },
    calls: () => calls,
  };
}

test("SG-SSH-02: puts ssh first with the via-ssh note when the probe finds the user's ssh authenticated", async () => {
  // arrange
  const { probe, calls } = probeAnswering("configured");

  // act
  const plan = await planMarketplaceClone({ source: OWNER_REPO, probe });

  // assert
  assert.deepStrictEqual(orderOf(plan), {
    first: { transport: "ssh", url: "git@github.com:acme/tools.git" },
    note: "via-ssh",
  } satisfies PlanOrder);
  assert.strictEqual(calls(), 1);
});

for (const { raw, repo, url } of [
  { raw: "acme/tools#main", repo: "tools", url: "git@github.com:acme/tools.git" },
  { raw: "acme/tools.git", repo: "tools.git", url: "git@github.com:acme/tools.git" },
]) {
  test(`OQ-1: probes for the owner/repo spelling ${raw} and clones ${url} over ssh`, async () => {
    // arrange
    const source = { ...OWNER_REPO, raw, repo } satisfies GitHubSource;
    const { probe, calls } = probeAnswering("configured");

    // act
    const plan = await planMarketplaceClone({ source, probe });

    // assert
    assert.deepStrictEqual(plan.first, { transport: "ssh", url });
    assert.strictEqual(calls(), 1);
  });
}

for (const answer of ["not-configured", "unknown"] as const) {
  test(`SG-SSH-02: puts https first with the ssh-not-configured note when the probe answers ${answer}`, async () => {
    // arrange
    const { probe, calls } = probeAnswering(answer);

    // act
    const plan = await planMarketplaceClone({ source: OWNER_REPO, probe });

    // assert
    assert.deepStrictEqual(orderOf(plan), {
      first: { transport: "https", url: "https://github.com/acme/tools.git" },
      note: "ssh-not-configured",
    } satisfies PlanOrder);
    assert.strictEqual(calls(), 1);
  });
}

for (const force of ["prefer-https", "base-override"] as const) {
  test(`D-SG-24, D-SG-21: plans one https attempt with the via-https note and runs no probe when ${force} forces it`, async () => {
    // arrange
    const { probe, calls } = probeAnswering("configured");

    // act
    const plan = await planMarketplaceClone({ source: OWNER_REPO, force, probe });

    // assert
    assert.deepStrictEqual(orderOf(plan), {
      first: { transport: "https", url: "https://github.com/acme/tools.git" },
      note: "via-https",
    } satisfies PlanOrder);
    assert.strictEqual(calls(), 0);
  });
}

for (const raw of ["https://github.com/acme/tools", "http://github.com/acme/tools.git"]) {
  test(`OQ-1: clones the github URL source ${raw} over https with the via-https note and runs no probe`, async () => {
    // arrange
    const source = { ...OWNER_REPO, raw } satisfies GitHubSource;
    const { probe, calls } = probeAnswering("configured");

    // act
    const plan = await planMarketplaceClone({ source, probe });

    // assert
    assert.deepStrictEqual(orderOf(plan), {
      first: { transport: "https", url: "https://github.com/acme/tools.git" },
      note: "via-https",
    } satisfies PlanOrder);
    assert.strictEqual(calls(), 0);
  });
}

for (const { raw, url, transport } of [
  {
    raw: "https://gitlab.example.com/team/mp.git",
    url: "https://gitlab.example.com/team/mp.git",
    transport: "https",
  },
  { raw: "git@127.0.0.1:acme/tools.git", url: "git@127.0.0.1:acme/tools.git", transport: "ssh" },
  {
    raw: "ssh://git@127.0.0.1/acme/tools.git",
    url: "ssh://git@127.0.0.1/acme/tools.git",
    transport: "ssh",
  },
  {
    raw: "git+ssh://git@127.0.0.1/acme/tools.git",
    url: "git+ssh://git@127.0.0.1/acme/tools.git",
    transport: "ssh",
  },
] as const) {
  test(`clones the url source ${raw} once over ${transport} with no note and no probe`, async () => {
    // arrange
    const source = { kind: "url", raw, url: raw } satisfies UrlSource;
    const { probe, calls } = probeAnswering("configured");

    // act
    const plan = await planMarketplaceClone({ source, probe });

    // assert
    assert.deepStrictEqual(orderOf(plan), { first: { transport, url } } satisfies PlanOrder);
    assert.strictEqual(calls(), 0);
  });
}

test("D-SG-24: keeps a non-GitHub ssh url source as written when prefer-https forces GitHub clones", async () => {
  // arrange
  const source = {
    kind: "url",
    raw: "git@127.0.0.1:acme/tools.git",
    url: "git@127.0.0.1:acme/tools.git",
  } satisfies UrlSource;
  const { probe, calls } = probeAnswering("configured");

  // act
  const plan = await planMarketplaceClone({ source, force: "prefer-https", probe });

  // assert
  assert.deepStrictEqual(orderOf(plan), {
    first: { transport: "ssh", url: "git@127.0.0.1:acme/tools.git" },
  } satisfies PlanOrder);
  assert.strictEqual(calls(), 0);
});

for (const { answer, attempts } of [
  { answer: "configured", attempts: [SSH_ATTEMPT, HTTPS_ATTEMPT] },
  { answer: "not-configured", attempts: [HTTPS_ATTEMPT, SSH_ATTEMPT] },
] as const) {
  test(`SG-SSH-02: gives the other transport once after the first fails when the probe answers ${answer}`, async () => {
    // arrange
    const plan = await planMarketplaceClone({
      source: OWNER_REPO,
      probe: probeAnswering(answer).probe,
    });

    // act
    const tried = await attemptsAfter(plan, new Error("clone failed"));

    // assert
    assert.deepStrictEqual(tried, attempts);
  });
}

for (const failure of [
  new GitCommandError({ kind: "git-missing", detail: "not-found" }, { operation: "lookup" }),
  new GitCommandError({ kind: "aborted" }, { operation: "clone --depth" }),
]) {
  test(`SG-SSH-02: gives no other transport when git fails as ${failure.kind}`, async () => {
    // arrange
    const plan = await planMarketplaceClone({
      source: OWNER_REPO,
      probe: probeAnswering("configured").probe,
    });

    // act
    const tried = await attemptsAfter(plan, failure);

    // assert
    assert.deepStrictEqual(tried, [SSH_ATTEMPT]);
  });
}

test("MODE-04: gives no other transport after print mode refused the https attempt's sign-in", async () => {
  // arrange
  const plan = await planMarketplaceClone({
    source: OWNER_REPO,
    probe: probeAnswering("not-configured").probe,
  });

  // act
  const tried = await attemptsAfter(plan, new DeviceFlowUnavailableError());

  // assert
  assert.deepStrictEqual(tried, [HTTPS_ATTEMPT]);
});

test("SG-SSH-02: gives the ssh attempt after an https attempt that found no credential", async () => {
  // arrange
  const plan = await planMarketplaceClone({
    source: OWNER_REPO,
    probe: probeAnswering("not-configured").probe,
  });
  const failure = new GitCommandError(
    { kind: "https-auth", detail: "no-credential" },
    { operation: "clone --depth" },
  );

  // act
  const tried = await attemptsAfter(plan, failure);

  // assert
  assert.deepStrictEqual(tried, [HTTPS_ATTEMPT, SSH_ATTEMPT]);
});

for (const { name, source, force } of [
  { name: "a forced https plan", source: OWNER_REPO, force: "prefer-https" },
  {
    name: "a github URL plan",
    source: { ...OWNER_REPO, raw: "https://github.com/acme/tools" },
    force: undefined,
  },
  {
    name: "a url source plan",
    source: {
      kind: "url",
      raw: "git@127.0.0.1:acme/tools.git",
      url: "git@127.0.0.1:acme/tools.git",
    },
    force: undefined,
  },
] satisfies ReadonlyArray<{
  readonly name: string;
  readonly source: GitHubSource | UrlSource;
  readonly force: "prefer-https" | undefined;
}>) {
  test(`SG-SSH-02: gives no other attempt after the one attempt of ${name} fails`, async () => {
    // arrange
    const plan = await planMarketplaceClone({
      source,
      force,
      probe: probeAnswering("configured").probe,
    });

    // act
    const tried = await attemptsAfter(plan, new Error("clone failed"));

    // assert
    assert.deepStrictEqual(tried, [plan.first]);
  });
}

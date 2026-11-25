import assert from "node:assert/strict";
import { test } from "node:test";

import { planMarketplaceClone } from "../../extensions/pi-claude-marketplace/domain/github-transport.ts";

import type {
  MarketplaceClonePlanInput,
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
  assert.deepStrictEqual(plan, {
    first: { transport: "ssh", url: "git@github.com:acme/tools.git" },
    note: "via-ssh",
  } satisfies TransportPlan);
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
    assert.deepStrictEqual(plan, {
      first: { transport: "https", url: "https://github.com/acme/tools.git" },
      note: "ssh-not-configured",
    } satisfies TransportPlan);
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
    assert.deepStrictEqual(plan, {
      first: { transport: "https", url: "https://github.com/acme/tools.git" },
      note: "via-https",
    } satisfies TransportPlan);
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
    assert.deepStrictEqual(plan, {
      first: { transport: "https", url: "https://github.com/acme/tools.git" },
      note: "via-https",
    } satisfies TransportPlan);
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
    assert.deepStrictEqual(plan, { first: { transport, url } } satisfies TransportPlan);
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
  assert.deepStrictEqual(plan, {
    first: { transport: "ssh", url: "git@127.0.0.1:acme/tools.git" },
  } satisfies TransportPlan);
  assert.strictEqual(calls(), 0);
});

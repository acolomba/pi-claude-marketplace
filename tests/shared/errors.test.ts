import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AggregateResourcesDiscoverError,
  appendLeakToError,
  appendLeaks,
  assertNever,
  causeChainTrailer,
  composeErrorWithCauseChain,
  ConcurrentInstallError,
  ConcurrentUninstallError,
  CrossPluginConflictError,
  errorMessage,
  errorWithManualRecovery,
  findManualRecoveryError,
  InvalidMarketplaceManifestError,
  isErrnoException,
  ManualRecoveryError,
  manualRecoveryLeaks,
  MarketplaceDuplicateNameError,
  MarketplaceNotFoundError,
  MarketplaceUpdateError,
  PluginShapeError,
  PluginUpdatePhase3Error,
  StaleSourceCloneError,
  StateLockHeldError,
  UnsupportedSourceError,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type {
  Phase3Failure,
  PluginShapeErrorKind,
  PluginShapeErrorShape,
  ResourcesDiscoverFailure,
} from "../../extensions/pi-claude-marketplace/shared/errors.ts";

void ({
  phase: "skills",
  msg: "skills failed",
  cause: new Error("skills"),
} satisfies Phase3Failure);
void ({
  phase: "commands",
  msg: "commands failed",
  cause: new Error("commands"),
} satisfies Phase3Failure);
void ({
  phase: "agents",
  msg: "agents failed",
  cause: new Error("agents"),
} satisfies Phase3Failure);
void ({ phase: "hooks", msg: "hooks failed", cause: new Error("hooks") } satisfies Phase3Failure);
void ({ phase: "mcp", msg: "mcp failed", cause: new Error("mcp") } satisfies Phase3Failure);
// @ts-expect-error phase 3 failures use the closed bridge phase union
void ({ phase: "files", msg: "files failed", cause: new Error("files") } satisfies Phase3Failure);

void ({
  kind: "not-in-manifest",
  plugin: "acme",
  marketplace: "official",
} satisfies PluginShapeErrorShape);
void ({
  kind: "already-installed",
  plugin: "acme",
  marketplace: "official",
} satisfies PluginShapeErrorShape);
void ({
  kind: "not-installable",
  plugin: "acme",
  reasons: ["unsupported hooks"],
  partialable: true,
  unsupportedKinds: ["hooks"],
} satisfies PluginShapeErrorShape);
void ({
  kind: "no-longer-installable",
  plugin: "acme",
  reasons: ["unsupported source"],
  partialable: false,
} satisfies PluginShapeErrorShape);
// @ts-expect-error installability shapes require the partialable discriminator
void ({ kind: "not-installable", plugin: "acme", reasons: [] } satisfies PluginShapeErrorShape);

void ("not-in-manifest" satisfies PluginShapeErrorKind);
void ("already-installed" satisfies PluginShapeErrorKind);
void ("not-installable" satisfies PluginShapeErrorKind);
void ("no-longer-installable" satisfies PluginShapeErrorKind);
// @ts-expect-error plugin shape kinds are a closed union
void ("invalid-manifest" satisfies PluginShapeErrorKind);

void ({
  scope: "user",
  kind: "skills",
  path: "/scope/skills",
  cause: new Error("skills"),
} satisfies ResourcesDiscoverFailure);
void ({
  scope: "project",
  kind: "prompts",
  path: "/scope/prompts",
  cause: new Error("prompts"),
} satisfies ResourcesDiscoverFailure);
void ({
  scope: "user",
  // @ts-expect-error resource discovery failures use the closed resource-kind union
  kind: "agents",
  path: "/scope/agents",
  cause: null,
} satisfies ResourcesDiscoverFailure);

describe("errorMessage", () => {
  test("returns an Error message", () => {
    // arrange
    const error = new Error("boom");

    // act
    const message = errorMessage(error);

    // assert
    assert.strictEqual(message, "boom");
  });

  test("stringifies a non-Error value", () => {
    // arrange
    const thrownValue = 42;

    // act
    const message = errorMessage(thrownValue);

    // assert
    assert.strictEqual(message, "42");
  });
});

describe("isErrnoException", () => {
  test("accepts an Error with a string code", () => {
    // arrange
    const error = Object.assign(new Error("missing"), { code: "ENOENT" });

    // act
    const isErrno = isErrnoException(error);

    // assert
    assert.strictEqual(isErrno, true);
  });

  test("rejects a non-Error with a string code", () => {
    // arrange
    const thrownValue = { code: "ENOENT" };

    // act
    const isErrno = isErrnoException(thrownValue);

    // assert
    assert.strictEqual(isErrno, false);
  });

  test("rejects an Error without a code", () => {
    // arrange
    const error = new Error("opaque");

    // act
    const isErrno = isErrnoException(error);

    // assert
    assert.strictEqual(isErrno, false);
  });

  test("rejects an Error with a non-string code", () => {
    // arrange
    const error = Object.assign(new Error("numeric"), { code: 2 });

    // act
    const isErrno = isErrnoException(error);

    // assert
    assert.strictEqual(isErrno, false);
  });
});

describe("assertNever", () => {
  test("throws the complete unexpected-value error", () => {
    // arrange
    const unexpected = "future-arm" as never;

    // act & assert
    assert.throws(() => assertNever(unexpected), {
      name: "Error",
      message: "Unexpected value: future-arm",
    });
  });
});

describe("causeChainTrailer", () => {
  test("returns no trailer for an absent error", () => {
    // arrange
    const thrownValue = undefined;

    // act
    const trailer = causeChainTrailer(thrownValue);

    // assert
    assert.strictEqual(trailer, "");
  });

  test("renders one Error link exactly", () => {
    // arrange
    const error = new Error("outer");

    // act
    const trailer = causeChainTrailer(error);

    // assert
    assert.strictEqual(trailer, "cause: outer");
  });

  test("renders string and object links with their promised coercions", () => {
    // arrange
    const stringCause = new Error("outer", { cause: "inner" });
    const objectCause = new Error("outer", { cause: { detail: "inner" } });

    // act
    const trailers = [causeChainTrailer(stringCause), causeChainTrailer(objectCause)];

    // assert
    assert.deepStrictEqual(trailers, ["cause: outer -> inner", "cause: outer -> [object Object]"]);
  });

  test("renders exactly five links without a truncation marker", () => {
    // arrange
    const error = new Error("link-1", {
      cause: new Error("link-2", {
        cause: new Error("link-3", {
          cause: new Error("link-4", { cause: new Error("link-5") }),
        }),
      }),
    });

    // act
    const trailer = causeChainTrailer(error);

    // assert
    assert.strictEqual(trailer, "cause: link-1 -> link-2 -> link-3 -> link-4 -> link-5");
  });

  test("marks the fifth link when a sixth link remains", () => {
    // arrange
    const error = new Error("link-1", {
      cause: new Error("link-2", {
        cause: new Error("link-3", {
          cause: new Error("link-4", {
            cause: new Error("link-5", { cause: new Error("link-6") }),
          }),
        }),
      }),
    });

    // act
    const trailer = causeChainTrailer(error);

    // assert
    assert.strictEqual(
      trailer,
      "cause: link-1 -> link-2 -> link-3 -> link-4 -> link-5 (truncated)",
    );
  });

  test("stops at one link for a self-referencing cause", () => {
    // arrange
    const error = new Error("loop");
    error.cause = error;

    // act
    const trailer = causeChainTrailer(error);

    // assert
    assert.strictEqual(trailer, "cause: loop");
  });

  test("bounds a two-link cycle and marks the continuing chain", () => {
    // arrange
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    first.cause = second;

    // act
    const trailer = causeChainTrailer(first);

    // assert
    assert.strictEqual(trailer, "cause: first -> second -> first -> second -> first (truncated)");
  });
});

describe("composeErrorWithCauseChain", () => {
  test("returns only the normalized message when no trailer exists", () => {
    // arrange
    const thrownValue = null;

    // act
    const composed = composeErrorWithCauseChain(thrownValue);

    // assert
    assert.strictEqual(composed, "null");
  });

  test("separates the message and complete cause trailer with one blank line", () => {
    // arrange
    const error = new Error("outer", { cause: new Error("inner") });

    // act
    const composed = composeErrorWithCauseChain(error);

    // assert
    assert.strictEqual(composed, "outer\n\ncause: outer -> inner");
  });
});

describe("appendLeakToError", () => {
  test("returns the same Error when no leak exists", () => {
    // arrange
    const error = new Error("base");

    // act
    const appended = appendLeakToError(error, undefined);

    // assert
    assert.strictEqual(appended, error);
  });

  test("wraps an Error with the exact leak text and original cause", () => {
    // arrange
    const error = new Error("base");

    // act
    const appended = appendLeakToError(error, "tmp leaked");

    // assert
    assert.deepStrictEqual(
      { name: appended.name, message: appended.message, cause: appended.cause },
      { name: "Error", message: "base (additionally: tmp leaked)", cause: error },
    );
  });

  test("wraps a non-Error and appends the exact leak text", () => {
    // arrange
    const thrownValue = "base";

    // act
    const appended = appendLeakToError(thrownValue, "tmp leaked");

    // assert
    assert.strictEqual(appended.name, "Error");
    assert.strictEqual(appended.message, "base (additionally: tmp leaked)");
    assert.deepStrictEqual(appended.cause, new Error("base"));
  });
});

describe("appendLeaks", () => {
  test("returns the same Error for an empty leak collection", () => {
    // arrange
    const error = new Error("base");

    // act
    const appended = appendLeaks(error, []);

    // assert
    assert.strictEqual(appended, error);
  });

  test("normalizes a non-Error for an empty leak collection", () => {
    // arrange
    const thrownValue = "base";

    // act
    const appended = appendLeaks(thrownValue, []);

    // assert
    assert.deepStrictEqual(
      { name: appended.name, message: appended.message, cause: appended.cause },
      { name: "Error", message: "base", cause: undefined },
    );
  });

  test("chains defined leaks in caller order and ignores undefined entries", () => {
    // arrange
    const error = new Error("base");

    // act
    const appended = appendLeaks(error, ["first", undefined, "second"]);
    const intermediate = appended.cause as Error;

    // assert
    assert.deepStrictEqual(
      {
        message: appended.message,
        intermediateMessage: intermediate.message,
        original: intermediate.cause,
      },
      {
        message: "base (additionally: first) (additionally: second)",
        intermediateMessage: "base (additionally: first)",
        original: error,
      },
    );
  });
});

describe("StaleSourceCloneError", () => {
  test("exposes the complete stale-clone value with a marketplace", () => {
    // arrange
    const absPath = "/scope/sources/official";

    // act
    const error = new StaleSourceCloneError(absPath, "official");

    // assert
    assert.ok(error instanceof StaleSourceCloneError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        absPath: error.absPath,
        mpName: error.mpName,
        cause: error.cause,
      },
      {
        name: "StaleSourceCloneError",
        message: "stale source clone at /scope/sources/official",
        absPath: "/scope/sources/official",
        mpName: "official",
        cause: undefined,
      },
    );
  });

  test("keeps the marketplace property undefined when no name is supplied", () => {
    // arrange
    const absPath = "/scope/sources/pending";

    // act
    const error = new StaleSourceCloneError(absPath);

    // assert
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        absPath: error.absPath,
        mpName: error.mpName,
        hasMarketplaceProperty: Object.hasOwn(error, "mpName"),
      },
      {
        name: "StaleSourceCloneError",
        message: "stale source clone at /scope/sources/pending",
        absPath: "/scope/sources/pending",
        mpName: undefined,
        hasMarketplaceProperty: true,
      },
    );
  });
});

describe("MarketplaceDuplicateNameError", () => {
  test("exposes the complete duplicate-name value", () => {
    // arrange
    const marketplaceName = "official";

    // act
    const error = new MarketplaceDuplicateNameError(marketplaceName, "user");

    // assert
    assert.ok(error instanceof MarketplaceDuplicateNameError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        mpName: error.mpName,
        scope: error.scope,
        cause: error.cause,
      },
      {
        name: "MarketplaceDuplicateNameError",
        message: 'Marketplace "official" already exists in user scope.',
        mpName: "official",
        scope: "user",
        cause: undefined,
      },
    );
  });

  test("keeps the adjacent project scope distinct", () => {
    // arrange
    const marketplaceName = "official";

    // act
    const error = new MarketplaceDuplicateNameError(marketplaceName, "project");

    // assert
    assert.deepStrictEqual(
      { message: error.message, mpName: error.mpName, scope: error.scope },
      {
        message: 'Marketplace "official" already exists in project scope.',
        mpName: "official",
        scope: "project",
      },
    );
  });
});

describe("MarketplaceNotFoundError", () => {
  test("exposes the complete one-scope missing-marketplace value", () => {
    // arrange
    const scopes = ["project"] as const;

    // act
    const error = new MarketplaceNotFoundError("official", scopes);

    // assert
    assert.ok(error instanceof MarketplaceNotFoundError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        mpName: error.mpName,
        scopes: error.scopes,
        cause: error.cause,
      },
      {
        name: "MarketplaceNotFoundError",
        message: 'Marketplace "official" not found in project scope.',
        mpName: "official",
        scopes: ["project"],
        cause: undefined,
      },
    );
  });

  test("renders an empty scope collection as any scopes", () => {
    // arrange
    const scopes = [] as const;

    // act
    const error = new MarketplaceNotFoundError("official", scopes);

    // assert
    assert.deepStrictEqual(
      { message: error.message, scopes: error.scopes },
      { message: 'Marketplace "official" not found in any scopes.', scopes: [] },
    );
  });

  test("renders both scopes in caller order with the plural suffix", () => {
    // arrange
    const scopes = ["user", "project"] as const;

    // act
    const error = new MarketplaceNotFoundError("official", scopes);

    // assert
    assert.deepStrictEqual(
      { message: error.message, scopes: error.scopes },
      {
        message: 'Marketplace "official" not found in user, project scopes.',
        scopes: ["user", "project"],
      },
    );
  });
});

describe("MarketplaceUpdateError", () => {
  test("exposes the complete update failure with its cause and retry hint", () => {
    // arrange
    const cause = new Error("network");

    // act
    const error = new MarketplaceUpdateError("update failed", {
      cause,
      retryHint: "retry later",
    });

    // assert
    assert.ok(error instanceof MarketplaceUpdateError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        retryHint: error.retryHint,
        cause: error.cause,
      },
      {
        name: "MarketplaceUpdateError",
        message: "update failed",
        retryHint: "retry later",
        cause,
      },
    );
  });

  test("defaults to no retry hint and no cause", () => {
    // arrange
    const message = "update failed";

    // act
    const error = new MarketplaceUpdateError(message);

    // assert
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        retryHint: error.retryHint,
        cause: error.cause,
      },
      {
        name: "MarketplaceUpdateError",
        message: "update failed",
        retryHint: "",
        cause: undefined,
      },
    );
  });
});

describe("InvalidMarketplaceManifestError", () => {
  test("exposes the complete typed manifest failure", () => {
    // arrange
    const cause = new SyntaxError("bad json");

    // act
    const error = new InvalidMarketplaceManifestError("invalid manifest", { cause });

    // assert
    assert.ok(error instanceof InvalidMarketplaceManifestError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      { name: error.name, message: error.message, cause: error.cause },
      { name: "InvalidMarketplaceManifestError", message: "invalid manifest", cause },
    );
  });
});

describe("UnsupportedSourceError", () => {
  test("exposes the complete unsupported-source failure", () => {
    // arrange
    const message = "Unsupported marketplace source kind: npm";

    // act
    const error = new UnsupportedSourceError(message);

    // assert
    assert.ok(error instanceof UnsupportedSourceError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      { name: error.name, message: error.message, cause: error.cause },
      {
        name: "UnsupportedSourceError",
        message: "Unsupported marketplace source kind: npm",
        cause: undefined,
      },
    );
  });
});

describe("CrossPluginConflictError", () => {
  test("exposes every conflict in caller order", () => {
    // arrange
    const conflicts = [
      'skill "alpha" already owned by plugin "first"',
      'agent "beta" already owned by plugin "second"',
    ];

    // act
    const error = new CrossPluginConflictError(conflicts);

    // assert
    assert.ok(error instanceof CrossPluginConflictError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        conflicts: error.conflicts,
        cause: error.cause,
      },
      {
        name: "CrossPluginConflictError",
        message:
          'Cross-plugin name conflict:\n  - skill "alpha" already owned by plugin "first"\n  - agent "beta" already owned by plugin "second"',
        conflicts: [
          'skill "alpha" already owned by plugin "first"',
          'agent "beta" already owned by plugin "second"',
        ],
        cause: undefined,
      },
    );
    assert.strictEqual(error.conflicts, conflicts);
  });

  test("preserves an empty conflict collection exactly", () => {
    // arrange
    const conflicts: string[] = [];

    // act
    const error = new CrossPluginConflictError(conflicts);

    // assert
    assert.deepStrictEqual(
      { message: error.message, conflicts: error.conflicts },
      { message: "Cross-plugin name conflict:\n", conflicts: [] },
    );
    assert.strictEqual(error.conflicts, conflicts);
  });

  test("preserves repeated conflict text and first-seen order", () => {
    // arrange
    const conflicts = ["same conflict", "same conflict", "later conflict"];

    // act
    const error = new CrossPluginConflictError(conflicts);

    // assert
    assert.deepStrictEqual(
      { message: error.message, conflicts: error.conflicts },
      {
        message:
          "Cross-plugin name conflict:\n  - same conflict\n  - same conflict\n  - later conflict",
        conflicts: ["same conflict", "same conflict", "later conflict"],
      },
    );
  });
});

describe("ConcurrentInstallError", () => {
  test("exposes the complete concurrent-install failure", () => {
    // arrange
    const plugin = "acme";

    // act
    const error = new ConcurrentInstallError(plugin, "official");

    // assert
    assert.ok(error instanceof ConcurrentInstallError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        plugin: error.plugin,
        marketplace: error.marketplace,
        cause: error.cause,
      },
      {
        name: "ConcurrentInstallError",
        message: 'Plugin "acme" was installed concurrently in marketplace "official".',
        plugin: "acme",
        marketplace: "official",
        cause: undefined,
      },
    );
  });
});

describe("ConcurrentUninstallError", () => {
  test("exposes the complete concurrent-uninstall sentinel", () => {
    // arrange
    const plugin = "acme";

    // act
    const error = new ConcurrentUninstallError(plugin);

    // assert
    assert.ok(error instanceof ConcurrentUninstallError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        plugin: error.plugin,
        cause: error.cause,
      },
      {
        name: "ConcurrentUninstallError",
        message: 'Plugin "acme" already uninstalled.',
        plugin: "acme",
        cause: undefined,
      },
    );
  });
});

describe("StateLockHeldError", () => {
  test("exposes the complete state-lock failure and cause", () => {
    // arrange
    const cause = new Error("open failed");

    // act
    const error = new StateLockHeldError("project", "/scope/.state-lock", { cause });

    // assert
    assert.ok(error instanceof StateLockHeldError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        scope: error.scope,
        lockPath: error.lockPath,
        cause: error.cause,
      },
      {
        name: "StateLockHeldError",
        message:
          "Another pi-claude-marketplace operation is in progress for project scope (/scope/.state-lock). Retry after it completes.",
        scope: "project",
        lockPath: "/scope/.state-lock",
        cause,
      },
    );
  });
});

describe("PluginUpdatePhase3Error", () => {
  test("exposes the complete aggregate failure and cause", () => {
    // arrange
    const bridgeCause = new Error("skills failed");
    const outerCause = new Error("commit failed");
    const failures = [
      { phase: "skills", msg: "skills rollback failed", cause: bridgeCause },
    ] satisfies Phase3Failure[];

    // act
    const error = new PluginUpdatePhase3Error("phase 3 failed", failures, {
      cause: outerCause,
    });

    // assert
    assert.ok(error instanceof PluginUpdatePhase3Error);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        failures: error.failures,
        cause: error.cause,
      },
      {
        name: "PluginUpdatePhase3Error",
        message: "phase 3 failed",
        failures: [{ phase: "skills", msg: "skills rollback failed", cause: bridgeCause }],
        cause: outerCause,
      },
    );
    assert.strictEqual(error.failures, failures);
  });

  test("preserves an empty failure collection exactly", () => {
    // arrange
    const failures: Phase3Failure[] = [];

    // act
    const error = new PluginUpdatePhase3Error("phase 3 failed", failures);

    // assert
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        failures: error.failures,
        cause: error.cause,
      },
      {
        name: "PluginUpdatePhase3Error",
        message: "phase 3 failed",
        failures: [],
        cause: undefined,
      },
    );
    assert.strictEqual(error.failures, failures);
  });

  test("preserves every bridge phase and repeated failure text in caller order", () => {
    // arrange
    const repeatedCause = new Error("repeated");
    const failures = [
      { phase: "skills", msg: "same", cause: repeatedCause },
      { phase: "commands", msg: "same", cause: repeatedCause },
      { phase: "agents", msg: "agents", cause: new Error("agents") },
      { phase: "hooks", msg: "hooks", cause: new Error("hooks") },
      { phase: "mcp", msg: "mcp", cause: new Error("mcp") },
    ] satisfies Phase3Failure[];

    // act
    const error = new PluginUpdatePhase3Error("all bridges failed", failures);

    // assert
    assert.deepStrictEqual(error.failures, [
      { phase: "skills", msg: "same", cause: repeatedCause },
      { phase: "commands", msg: "same", cause: repeatedCause },
      { phase: "agents", msg: "agents", cause: failures[2]?.cause },
      { phase: "hooks", msg: "hooks", cause: failures[3]?.cause },
      { phase: "mcp", msg: "mcp", cause: failures[4]?.cause },
    ]);
    assert.strictEqual(error.failures, failures);
  });
});

describe("ManualRecoveryError", () => {
  test("exposes the complete manual-recovery value and cause", () => {
    // arrange
    const cause = new Error("replace failed");
    const leaks = ["agents: /scope/agent.md", "skills: /scope/skill"];

    // act
    const error = new ManualRecoveryError("staging failed", leaks, { cause });

    // assert
    assert.ok(error instanceof ManualRecoveryError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        leaks: error.leaks,
        cause: error.cause,
      },
      {
        name: "ManualRecoveryError",
        message: "staging failed",
        leaks: ["agents: /scope/agent.md", "skills: /scope/skill"],
        cause,
      },
    );
    assert.strictEqual(error.leaks, leaks);
  });

  test("preserves an empty leak collection exactly", () => {
    // arrange
    const leaks: string[] = [];

    // act
    const error = new ManualRecoveryError("recover", leaks);

    // assert
    assert.deepStrictEqual(
      { name: error.name, message: error.message, leaks: error.leaks, cause: error.cause },
      { name: "ManualRecoveryError", message: "recover", leaks: [], cause: undefined },
    );
    assert.strictEqual(error.leaks, leaks);
  });
});

describe("errorWithManualRecovery", () => {
  test("returns the same Error when no leaks exist", () => {
    // arrange
    const error = new Error("base");

    // act
    const wrapped = errorWithManualRecovery(error, []);

    // assert
    assert.strictEqual(wrapped, error);
  });

  test("normalizes a non-Error when no leaks exist", () => {
    // arrange
    const thrownValue = "base";

    // act
    const wrapped = errorWithManualRecovery(thrownValue, []);

    // assert
    assert.deepStrictEqual(
      { name: wrapped.name, message: wrapped.message, cause: wrapped.cause },
      { name: "Error", message: "base", cause: undefined },
    );
  });

  test("wraps a plain Error with the complete manual-recovery value", () => {
    // arrange
    const error = new Error("base");
    const leaks = ["agents: leaked"];

    // act
    const wrapped = errorWithManualRecovery(error, leaks);

    // assert
    assert.ok(wrapped instanceof ManualRecoveryError);
    assert.deepStrictEqual(
      {
        name: wrapped.name,
        message: wrapped.message,
        leaks: wrapped.leaks,
        cause: wrapped.cause,
      },
      {
        name: "ManualRecoveryError",
        message: "base",
        leaks: ["agents: leaked"],
        cause: error,
      },
    );
  });

  test("normalizes a non-Error before attaching leaks", () => {
    // arrange
    const thrownValue = 42;

    // act
    const wrapped = errorWithManualRecovery(thrownValue, ["agents: leaked"]);

    // assert
    assert.ok(wrapped instanceof ManualRecoveryError);
    assert.deepStrictEqual(
      {
        name: wrapped.name,
        message: wrapped.message,
        leaks: wrapped.leaks,
        causeName: (wrapped.cause as Error).name,
        causeMessage: (wrapped.cause as Error).message,
      },
      {
        name: "ManualRecoveryError",
        message: "42",
        leaks: ["agents: leaked"],
        causeName: "Error",
        causeMessage: "42",
      },
    );
  });

  test("merges a manual-recovery error with first-seen de-duplication", () => {
    // arrange
    const inner = new ManualRecoveryError("base", ["agents: old", "skills: shared"]);

    // act
    const wrapped = errorWithManualRecovery(inner, ["skills: shared", "mcp: new"]);

    // assert
    assert.ok(wrapped instanceof ManualRecoveryError);
    assert.deepStrictEqual(
      {
        name: wrapped.name,
        message: wrapped.message,
        leaks: wrapped.leaks,
        cause: wrapped.cause,
      },
      {
        name: "ManualRecoveryError",
        message: "base",
        leaks: ["agents: old", "skills: shared", "mcp: new"],
        cause: inner,
      },
    );
    assert.strictEqual(Object.isFrozen(wrapped.leaks), true);
  });

  test("freezes a defensive merged copy before caller arrays change", () => {
    // arrange
    const existingLeaks = ["agents: first", "skills: shared", "agents: first"];
    const addedLeaks = ["skills: shared", "mcp: last", "mcp: last"];
    const inner = new ManualRecoveryError("base", existingLeaks);

    // act
    const wrapped = errorWithManualRecovery(inner, addedLeaks);
    existingLeaks.push("hooks: late-existing");
    addedLeaks.push("hooks: late-added");

    // assert
    assert.ok(wrapped instanceof ManualRecoveryError);
    assert.deepStrictEqual(wrapped.leaks, ["agents: first", "skills: shared", "mcp: last"]);
    assert.strictEqual(Object.isFrozen(wrapped.leaks), true);
    assert.notStrictEqual(wrapped.leaks, existingLeaks);
    assert.notStrictEqual(wrapped.leaks, addedLeaks);
  });
});

describe("findManualRecoveryError", () => {
  test("returns the first manual-recovery error in a cause chain", () => {
    // arrange
    const manualRecovery = new ManualRecoveryError("recover", ["agents: leaked"]);
    const error = new Error("outer", { cause: manualRecovery });

    // act
    const found = findManualRecoveryError(error);

    // assert
    assert.strictEqual(found, manualRecovery);
  });

  test("returns undefined when the chain has no manual-recovery error", () => {
    // arrange
    const error = new Error("outer", { cause: new Error("inner") });

    // act
    const found = findManualRecoveryError(error);

    // assert
    assert.strictEqual(found, undefined);
  });

  test("finds a manual-recovery error at the exact fifth link", () => {
    // arrange
    const manualRecovery = new ManualRecoveryError("recover", ["agents: leaked"]);
    const error = new Error("link-1", {
      cause: new Error("link-2", {
        cause: new Error("link-3", { cause: new Error("link-4", { cause: manualRecovery }) }),
      }),
    });

    // act
    const found = findManualRecoveryError(error);

    // assert
    assert.strictEqual(found, manualRecovery);
  });

  test("does not inspect a manual-recovery error beyond the fifth link", () => {
    // arrange
    const manualRecovery = new ManualRecoveryError("recover", ["agents: leaked"]);
    const error = new Error("link-1", {
      cause: new Error("link-2", {
        cause: new Error("link-3", {
          cause: new Error("link-4", { cause: new Error("link-5", { cause: manualRecovery }) }),
        }),
      }),
    });

    // act
    const found = findManualRecoveryError(error);

    // assert
    assert.strictEqual(found, undefined);
  });

  test("terminates a self-referencing chain without a match", () => {
    // arrange
    const error = new Error("loop");
    error.cause = error;

    // act
    const found = findManualRecoveryError(error);

    // assert
    assert.strictEqual(found, undefined);
  });
});

describe("manualRecoveryLeaks", () => {
  test("returns the first non-empty manual-recovery payload", () => {
    // arrange
    const innerLeaks = ["agents: leaked"];
    const inner = new ManualRecoveryError("inner", innerLeaks);
    const outer = new ManualRecoveryError("outer", [], { cause: inner });

    // act
    const leaks = manualRecoveryLeaks(outer);

    // assert
    assert.strictEqual(leaks, innerLeaks);
    assert.deepStrictEqual(leaks, ["agents: leaked"]);
  });

  test("returns an empty collection when no payload exists", () => {
    // arrange
    const error = new Error("opaque");

    // act
    const leaks = manualRecoveryLeaks(error);

    // assert
    assert.deepStrictEqual(leaks, []);
  });

  test("returns a payload at the exact fifth link", () => {
    // arrange
    const expectedLeaks = ["agents: leaked"];
    const manualRecovery = new ManualRecoveryError("recover", expectedLeaks);
    const error = new Error("link-1", {
      cause: new Error("link-2", {
        cause: new Error("link-3", { cause: new Error("link-4", { cause: manualRecovery }) }),
      }),
    });

    // act
    const leaks = manualRecoveryLeaks(error);

    // assert
    assert.strictEqual(leaks, expectedLeaks);
    assert.deepStrictEqual(leaks, ["agents: leaked"]);
  });

  test("does not inspect a payload beyond the fifth link", () => {
    // arrange
    const manualRecovery = new ManualRecoveryError("recover", ["agents: leaked"]);
    const error = new Error("link-1", {
      cause: new Error("link-2", {
        cause: new Error("link-3", {
          cause: new Error("link-4", { cause: new Error("link-5", { cause: manualRecovery }) }),
        }),
      }),
    });

    // act
    const leaks = manualRecoveryLeaks(error);

    // assert
    assert.deepStrictEqual(leaks, []);
  });
});

describe("PluginShapeError", () => {
  test("exposes the complete not-in-manifest arm", () => {
    // arrange
    const shape = {
      kind: "not-in-manifest",
      plugin: "acme",
      marketplace: "official",
    } satisfies PluginShapeErrorShape;

    // act
    const error = new PluginShapeError(shape);

    // assert
    assert.ok(error instanceof PluginShapeError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        shape: error.shape,
        kind: error.kind,
        plugin: error.plugin,
        cause: error.cause,
      },
      {
        name: "PluginShapeError",
        message: 'Plugin "acme" not found in marketplace "official".',
        shape: { kind: "not-in-manifest", plugin: "acme", marketplace: "official" },
        kind: "not-in-manifest",
        plugin: "acme",
        cause: undefined,
      },
    );
    assert.strictEqual(error.shape, shape);
  });

  test("exposes the complete already-installed arm", () => {
    // arrange
    const shape = {
      kind: "already-installed",
      plugin: "acme",
      marketplace: "official",
    } satisfies PluginShapeErrorShape;
    const cause = new Error("state changed");

    // act
    const error = new PluginShapeError(shape, { cause });

    // assert
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        shape: error.shape,
        kind: error.kind,
        plugin: error.plugin,
        cause: error.cause,
      },
      {
        name: "PluginShapeError",
        message: 'Plugin "acme" is already installed in marketplace "official".',
        shape: { kind: "already-installed", plugin: "acme", marketplace: "official" },
        kind: "already-installed",
        plugin: "acme",
        cause,
      },
    );
  });

  test("exposes the complete not-installable arm", () => {
    // arrange
    const shape = {
      kind: "not-installable",
      plugin: "acme",
      reasons: ["contains hooks", "unsupported source"],
      partialable: true,
      unsupportedKinds: ["hooks"],
    } satisfies PluginShapeErrorShape;

    // act
    const error = new PluginShapeError(shape);

    // assert
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        shape: error.shape,
        kind: error.kind,
        plugin: error.plugin,
        cause: error.cause,
      },
      {
        name: "PluginShapeError",
        message: 'Plugin "acme" is not installable: contains hooks; unsupported source',
        shape: {
          kind: "not-installable",
          plugin: "acme",
          reasons: ["contains hooks", "unsupported source"],
          partialable: true,
          unsupportedKinds: ["hooks"],
        },
        kind: "not-installable",
        plugin: "acme",
        cause: undefined,
      },
    );
  });

  test("exposes the complete no-longer-installable arm", () => {
    // arrange
    const shape = {
      kind: "no-longer-installable",
      plugin: "acme",
      reasons: ["unsupported source"],
      partialable: false,
    } satisfies PluginShapeErrorShape;

    // act
    const error = new PluginShapeError(shape);

    // assert
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        shape: error.shape,
        kind: error.kind,
        plugin: error.plugin,
        cause: error.cause,
      },
      {
        name: "PluginShapeError",
        message: 'Plugin "acme" is no longer installable: unsupported source',
        shape: {
          kind: "no-longer-installable",
          plugin: "acme",
          reasons: ["unsupported source"],
          partialable: false,
        },
        kind: "no-longer-installable",
        plugin: "acme",
        cause: undefined,
      },
    );
  });

  test("preserves an empty reason collection in the exact install message", () => {
    // arrange
    const shape = {
      kind: "not-installable",
      plugin: "acme",
      reasons: [],
      partialable: false,
    } satisfies PluginShapeErrorShape;

    // act
    const error = new PluginShapeError(shape);

    // assert
    assert.deepStrictEqual(
      { message: error.message, shape: error.shape, kind: error.kind, plugin: error.plugin },
      {
        message: 'Plugin "acme" is not installable: ',
        shape: {
          kind: "not-installable",
          plugin: "acme",
          reasons: [],
          partialable: false,
        },
        kind: "not-installable",
        plugin: "acme",
      },
    );
  });

  test("preserves repeated reasons and first-seen order in the update message", () => {
    // arrange
    const shape = {
      kind: "no-longer-installable",
      plugin: "acme",
      reasons: ["same", "same", "later"],
      partialable: true,
      unsupportedKinds: [],
    } satisfies PluginShapeErrorShape;

    // act
    const error = new PluginShapeError(shape);

    // assert
    assert.deepStrictEqual(
      { message: error.message, shape: error.shape },
      {
        message: 'Plugin "acme" is no longer installable: same; same; later',
        shape: {
          kind: "no-longer-installable",
          plugin: "acme",
          reasons: ["same", "same", "later"],
          partialable: true,
          unsupportedKinds: [],
        },
      },
    );
  });

  test("rejects an unknown runtime discriminator through the public constructor", () => {
    // arrange
    const shape = { kind: "future", plugin: "acme" } as never;

    // act & assert
    assert.throws(() => new PluginShapeError(shape), {
      name: "Error",
      message: "Unexpected value: [object Object]",
    });
  });
});

describe("AggregateResourcesDiscoverError", () => {
  test("exposes the complete ordered failure set with the first cause", () => {
    // arrange
    const firstCause = new Error("skills denied");
    const failures = [
      { scope: "user", kind: "skills", path: "/user/skills", cause: firstCause },
      { scope: "project", kind: "prompts", path: "/project/prompts", cause: "missing" },
    ] satisfies ResourcesDiscoverFailure[];

    // act
    const error = new AggregateResourcesDiscoverError(failures);

    // assert
    assert.ok(error instanceof AggregateResourcesDiscoverError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        failures: error.failures,
        cause: error.cause,
      },
      {
        name: "AggregateResourcesDiscoverError",
        message:
          "Failed to discover Pi resources: user/skills at /user/skills: skills denied; project/prompts at /project/prompts: missing",
        failures: [
          { scope: "user", kind: "skills", path: "/user/skills", cause: firstCause },
          { scope: "project", kind: "prompts", path: "/project/prompts", cause: "missing" },
        ],
        cause: firstCause,
      },
    );
    assert.strictEqual(Object.isFrozen(error.failures), true);
    assert.notStrictEqual(error.failures, failures);
  });

  test("exposes an empty frozen failure collection exactly", () => {
    // arrange
    const failures: ResourcesDiscoverFailure[] = [];

    // act
    const error = new AggregateResourcesDiscoverError(failures);

    // assert
    assert.deepStrictEqual(
      {
        name: error.name,
        message: error.message,
        failures: error.failures,
        cause: error.cause,
      },
      {
        name: "AggregateResourcesDiscoverError",
        message: "Failed to discover Pi resources: ",
        failures: [],
        cause: undefined,
      },
    );
    assert.strictEqual(Object.isFrozen(error.failures), true);
    assert.notStrictEqual(error.failures, failures);
  });

  test("freezes a defensive copy while preserving all discriminator arms and duplicates", () => {
    // arrange
    const repeatedCause = new Error("same");
    const failures: ResourcesDiscoverFailure[] = [
      { scope: "user", kind: "skills", path: "/user/skills", cause: repeatedCause },
      { scope: "user", kind: "prompts", path: "/user/prompts", cause: repeatedCause },
      { scope: "project", kind: "skills", path: "/project/skills", cause: "later" },
      { scope: "project", kind: "prompts", path: "/project/prompts", cause: "later" },
    ];

    // act
    const error = new AggregateResourcesDiscoverError(failures);
    failures.push({ scope: "user", kind: "skills", path: "/late", cause: "late" });

    // assert
    assert.strictEqual(
      error.message,
      "Failed to discover Pi resources: user/skills at /user/skills: same; user/prompts at /user/prompts: same; project/skills at /project/skills: later; project/prompts at /project/prompts: later",
    );
    assert.deepStrictEqual(error.failures, [
      { scope: "user", kind: "skills", path: "/user/skills", cause: repeatedCause },
      { scope: "user", kind: "prompts", path: "/user/prompts", cause: repeatedCause },
      { scope: "project", kind: "skills", path: "/project/skills", cause: "later" },
      { scope: "project", kind: "prompts", path: "/project/prompts", cause: "later" },
    ]);
    assert.strictEqual(Object.isFrozen(error.failures), true);
    assert.notStrictEqual(error.failures, failures);
  });
});

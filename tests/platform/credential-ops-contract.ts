import assert from "node:assert/strict";
import { test } from "node:test";

import type { CredentialOps } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";

export type CredentialOpsFactory = () => CredentialOps | Promise<CredentialOps>;

export interface CredentialOpsContractCase {
  readonly name: string;
  readonly run: (createCredentialOps: CredentialOpsFactory) => Promise<void>;
}

export const CREDENTIAL_OPS_CASE_NAMES = [
  "returns null for a missing credential",
  "returns an approved credential",
  "approves without returning a value",
  "copies an approved credential before storing it",
  "returns a credential copy that cannot mutate stored state",
  "overwrites a credential for the same host",
  "keeps credentials for different hosts independent",
  "rejects the matching credential",
  "keeps a credential when rejection attributes do not match",
  "treats repeated rejection as an idempotent no-op",
  "rejects newline in fill host",
  "rejects newline in approve host",
  "rejects newline in approve username",
  "rejects newline in approve password",
  "rejects newline in reject host",
  "rejects newline in reject username",
  "rejects newline in reject password",
  "rejects carriage return in fill host",
  "rejects carriage return in approve host",
  "rejects carriage return in approve username",
  "rejects carriage return in approve password",
  "rejects carriage return in reject host",
  "rejects carriage return in reject username",
  "rejects carriage return in reject password",
  "rejects NUL in fill host",
  "rejects NUL in approve host",
  "rejects NUL in approve username",
  "rejects NUL in approve password",
  "rejects NUL in reject host",
  "rejects NUL in reject username",
  "rejects NUL in reject password",
] as const;

export const CREDENTIAL_OPS_INAPPLICABLE_CATEGORIES = {
  globalOrdering: "CredentialOps defines per-host state transitions, not cross-host ordering.",
  transportErrors: "Process exit, error, timeout, and cleanup are production-owner mechanics.",
} as const;

const credential = {
  username: "x-access-token",
  password: "token-1",
} satisfies GitCredentials;

function observeVoid(promise: Promise<void>): Promise<unknown> {
  return promise;
}

function validationCase({
  name,
  operation,
  host,
  invalidCredential,
  field,
}: {
  readonly name: (typeof CREDENTIAL_OPS_CASE_NAMES)[number];
  readonly operation: "fill" | "approve" | "reject";
  readonly host: string;
  readonly invalidCredential?: GitCredentials;
  readonly field: "host" | "username" | "password";
}): CredentialOpsContractCase {
  return {
    name,
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();

      // act
      const rejected =
        operation === "fill"
          ? credentialOps.fill(host)
          : credentialOps[operation](host, invalidCredential ?? credential);

      // assert
      await assert.rejects(rejected, {
        name: "Error",
        message: `git-credential attribute '${field}' contains a control character`,
      });
    },
  };
}

const behaviorCases: readonly CredentialOpsContractCase[] = [
  {
    name: "returns null for a missing credential",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();

      // act
      const missingCredential = await credentialOps.fill("missing.example");

      // assert
      assert.strictEqual(missingCredential, null);
    },
  },
  {
    name: "returns an approved credential",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();
      await credentialOps.approve("github.com", credential);

      // act
      const storedCredential = await credentialOps.fill("github.com");

      // assert
      assert.deepStrictEqual(storedCredential, credential);
    },
  },
  {
    name: "approves without returning a value",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();

      // act
      const approval = await observeVoid(credentialOps.approve("github.com", credential));

      // assert
      assert.strictEqual(approval, undefined);
    },
  },
  {
    name: "copies an approved credential before storing it",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();
      const approvedCredential = structuredClone(credential);
      await credentialOps.approve("github.com", approvedCredential);

      // act
      approvedCredential.password = "caller-mutated";
      const storedCredential = await credentialOps.fill("github.com");

      // assert
      assert.deepStrictEqual(storedCredential, credential);
    },
  },
  {
    name: "returns a credential copy that cannot mutate stored state",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();
      await credentialOps.approve("github.com", credential);
      const returnedCredential = await credentialOps.fill("github.com");
      if (returnedCredential === null) {
        assert.fail("approved credential was not available for the aliasing check");
      }

      // act
      returnedCredential.password = "caller-mutated";
      const storedCredential = await credentialOps.fill("github.com");

      // assert
      assert.deepStrictEqual(storedCredential, credential);
    },
  },
  {
    name: "overwrites a credential for the same host",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();
      await credentialOps.approve("github.com", credential);
      const replacement = { username: "replacement", password: "token-2" };
      await credentialOps.approve("github.com", replacement);

      // act
      const storedCredential = await credentialOps.fill("github.com");

      // assert
      assert.deepStrictEqual(storedCredential, replacement);
    },
  },
  {
    name: "keeps credentials for different hosts independent",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();
      const otherCredential = { username: "gitlab-user", password: "token-2" };
      await credentialOps.approve("github.com", credential);
      await credentialOps.approve("gitlab.com", otherCredential);

      // act
      const githubCredential = await credentialOps.fill("github.com");
      const gitlabCredential = await credentialOps.fill("gitlab.com");

      // assert
      assert.deepStrictEqual(githubCredential, credential);
      assert.deepStrictEqual(gitlabCredential, otherCredential);
    },
  },
  {
    name: "rejects the matching credential",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();
      await credentialOps.approve("github.com", credential);

      // act
      const rejection = await observeVoid(credentialOps.reject("github.com", credential));
      const storedCredential = await credentialOps.fill("github.com");

      // assert
      assert.strictEqual(rejection, undefined);
      assert.strictEqual(storedCredential, null);
    },
  },
  {
    name: "keeps a credential when rejection attributes do not match",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();
      await credentialOps.approve("github.com", credential);

      // act
      await credentialOps.reject("github.com", {
        username: "x-access-token",
        password: "different-token",
      });
      const storedCredential = await credentialOps.fill("github.com");

      // assert
      assert.deepStrictEqual(storedCredential, credential);
    },
  },
  {
    name: "treats repeated rejection as an idempotent no-op",
    run: async (createCredentialOps) => {
      // arrange
      const credentialOps = await createCredentialOps();
      await credentialOps.approve("github.com", credential);
      await credentialOps.reject("github.com", credential);

      // act
      const rejection = await observeVoid(credentialOps.reject("github.com", credential));
      const storedCredential = await credentialOps.fill("github.com");

      // assert
      assert.strictEqual(rejection, undefined);
      assert.strictEqual(storedCredential, null);
    },
  },
];

const validationCases = [
  ...[
    { character: "\n", label: "newline" },
    { character: "\r", label: "carriage return" },
    { character: "\0", label: "NUL" },
  ].flatMap(({ character, label }) => [
    validationCase({
      name: `rejects ${label} in fill host` as (typeof CREDENTIAL_OPS_CASE_NAMES)[number],
      operation: "fill",
      host: `github.com${character}x`,
      field: "host",
    }),
    validationCase({
      name: `rejects ${label} in approve host` as (typeof CREDENTIAL_OPS_CASE_NAMES)[number],
      operation: "approve",
      host: `github.com${character}x`,
      field: "host",
    }),
    validationCase({
      name: `rejects ${label} in approve username` as (typeof CREDENTIAL_OPS_CASE_NAMES)[number],
      operation: "approve",
      host: "github.com",
      invalidCredential: { username: `x${character}x`, password: "token-1" },
      field: "username",
    }),
    validationCase({
      name: `rejects ${label} in approve password` as (typeof CREDENTIAL_OPS_CASE_NAMES)[number],
      operation: "approve",
      host: "github.com",
      invalidCredential: { username: "x-access-token", password: `x${character}x` },
      field: "password",
    }),
    validationCase({
      name: `rejects ${label} in reject host` as (typeof CREDENTIAL_OPS_CASE_NAMES)[number],
      operation: "reject",
      host: `github.com${character}x`,
      field: "host",
    }),
    validationCase({
      name: `rejects ${label} in reject username` as (typeof CREDENTIAL_OPS_CASE_NAMES)[number],
      operation: "reject",
      host: "github.com",
      invalidCredential: { username: `x${character}x`, password: "token-1" },
      field: "username",
    }),
    validationCase({
      name: `rejects ${label} in reject password` as (typeof CREDENTIAL_OPS_CASE_NAMES)[number],
      operation: "reject",
      host: "github.com",
      invalidCredential: { username: "x-access-token", password: `x${character}x` },
      field: "password",
    }),
  ]),
] satisfies readonly CredentialOpsContractCase[];

export const credentialOpsContractCases = [
  ...behaviorCases,
  ...validationCases,
] satisfies readonly CredentialOpsContractCase[];

export function registerCredentialOpsContract(createCredentialOps: CredentialOpsFactory): void {
  for (const contractCase of credentialOpsContractCases) {
    test(contractCase.name, async () => {
      // arrange
      const runCase = contractCase.run;

      // act
      const completed = runCase(createCredentialOps);

      // assert
      await completed;
    });
  }
}

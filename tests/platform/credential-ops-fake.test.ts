import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { CredentialOps } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import {
  CREDENTIAL_OPS_CASE_NAMES,
  credentialOpsContractCases,
  registerCredentialOpsContract,
} from "./credential-ops-contract.ts";
import { createCredentialOpsFake } from "./credential-ops-fake.ts";

function createAliasingCredentialOpsFake(): CredentialOps {
  const credentialOps = createCredentialOpsFake({ boundary: "memory" }).credentialOps;
  const returnedCredentials = new Map<
    string,
    NonNullable<Awaited<ReturnType<CredentialOps["fill"]>>>
  >();

  return {
    async fill(host) {
      const returnedCredential = returnedCredentials.get(host);
      if (returnedCredential !== undefined) {
        return returnedCredential;
      }

      const credential = await credentialOps.fill(host);
      if (credential !== null) {
        returnedCredentials.set(host, credential);
      }
      return credential;
    },
    async approve(host, credential) {
      returnedCredentials.delete(host);
      await credentialOps.approve(host, credential);
    },
    async reject(host, credential) {
      returnedCredentials.delete(host);
      await credentialOps.reject(host, credential);
    },
  };
}

describe("createCredentialOpsFake", () => {
  registerCredentialOpsContract(
    () => createCredentialOpsFake({ boundary: "memory" }).credentialOps,
  );

  test("keeps the source-defined contract case order", () => {
    // arrange
    const expectedNames = [...CREDENTIAL_OPS_CASE_NAMES];

    // act
    const names = credentialOpsContractCases.map(({ name }) => name);

    // assert
    assert.deepStrictEqual(names, expectedNames);
  });

  test("requires the explicit memory boundary", () => {
    // act & assert
    assert.throws(() => Reflect.apply(createCredentialOpsFake, undefined, [{}]), {
      name: "Error",
      message: "createCredentialOpsFake requires the explicit memory boundary",
    });
  });

  test("detects only the mutable returned-credential alias defect", async () => {
    // arrange
    const expectedFailures = ["returns a credential copy that cannot mutate stored state"];
    const failures: string[] = [];

    // act
    for (const contractCase of credentialOpsContractCases) {
      try {
        await contractCase.run(createAliasingCredentialOpsFake);
      } catch (error) {
        if (!(error instanceof assert.AssertionError)) {
          throw error;
        }
        failures.push(contractCase.name);
      }
    }

    // assert
    assert.deepStrictEqual(failures, expectedFailures);
  });
});

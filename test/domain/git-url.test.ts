import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  gitUrlRefusal,
  isScpGitAddress,
} from "../../extensions/pi-claude-marketplace/domain/git-url.ts";

const SUPPORTED =
  "https, http, ssh (also written git+ssh or ssh+git), user@host:path, or a local file:// address with no host. git:// isn't supported because it isn't encrypted.";

describe("gitUrlRefusal", () => {
  for (const address of [
    "git@127.0.0.1:acme/tools.git",
    "git@127.0.0.1:acme/tools.git#main",
    "alice@gitlab.example:group/tools",
    "https://host.example/o/r.git",
    "http://host.example/o/r.git",
    "ssh://git@host.example:2222/o/r.git",
    "git+ssh://git@host.example/o/r.git",
    "ssh+git://git@host.example/o/r.git",
    "file:///srv/git/r.git",
  ]) {
    test(`accepts the git address ${address}`, () => {
      // arrange
      const expectedRefusal = undefined;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  test("refuses an scp address that holds ://", () => {
    // arrange
    const address = "git@host.example:o/r://x";

    // act
    const refusal = gitUrlRefusal(address);

    // assert
    assert.strictEqual(
      refusal,
      'Invalid git URL: an address written as user@host:path can\'t contain "://", because git then reads the text before "://" as a protocol name, as in https://. Remove the "://".',
    );
  });

  for (const address of ["git@host.example://x", "not a url", "-x@host.example:o/r"]) {
    test(`refuses ${address} as an address that is no URL`, () => {
      // arrange
      const expectedRefusal = `Invalid git URL: ${address} (it could not be read as a URL). Supported: ${SUPPORTED}`;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  for (const { address, protocol } of [
    { address: "git://host.example/o/r.git", protocol: "git:" },
    { address: "ftp://host.example/o/r.git", protocol: "ftp:" },
    { address: "ext::sh -c id", protocol: "ext:" },
  ]) {
    test(`refuses the protocol ${protocol} of ${address}`, () => {
      // arrange
      const expectedRefusal = `Invalid git URL protocol: ${protocol}. Supported: ${SUPPORTED}`;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  test("shows an address with credentials redacted when its protocol is refused", () => {
    // arrange
    const address = "git://user:secret@host.example/o/r.git";

    // act
    const refusal = gitUrlRefusal(address);

    // assert
    assert.strictEqual(
      refusal,
      `Invalid git URL: git://***@host.example/o/r.git. Supported: ${SUPPORTED}`,
    );
  });
});

describe("isScpGitAddress", () => {
  for (const { address, scp } of [
    { address: "git@127.0.0.1:acme/tools.git", scp: true },
    { address: "git@[::1]:acme/tools.git", scp: true },
    { address: "-oProxyCommand=x@host.example:o/r", scp: false },
    { address: "git@-host.example:o/r", scp: false },
    { address: "git@host.example://o/r", scp: false },
    { address: "host.example:o/r", scp: false },
    { address: "acme/tools", scp: false },
  ]) {
    test(`reads ${address} as ${scp ? "an scp address" : "no scp address"}`, () => {
      // arrange
      const expectedScp = scp;

      // act
      const isScp = isScpGitAddress(address);

      // assert
      assert.strictEqual(isScp, expectedScp);
    });
  }
});

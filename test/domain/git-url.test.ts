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

  for (const address of [
    "ssh://git@[::1]:22/o/r.git",
    "git@[::1]:o/r.git",
    "file:///srv/[x]",
    "http://host.example/o\\r.git",
    "https://host.example",
    "ssh://host.example/o/r.git",
  ]) {
    test(`accepts the address ${address}, whose brackets, backslash, or user git reads as written`, () => {
      // arrange
      const expectedRefusal = undefined;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  test("refuses a control character and shows it escaped", () => {
    // arrange
    const address = "https://host.example/o/r\n.git";

    // act
    const refusal = gitUrlRefusal(address);

    // assert
    assert.strictEqual(
      refusal,
      "Invalid git URL: https://host.example/o/r\\u000a.git \u2014 control characters are not allowed",
    );
  });

  test("refuses a delete character, which is a control character too", () => {
    // arrange
    const address = "git@host.example:o/r\u007f";

    // act
    const refusal = gitUrlRefusal(address);

    // assert
    assert.strictEqual(
      refusal,
      "Invalid git URL: git@host.example:o/r\\u007f \u2014 control characters are not allowed",
    );
  });

  test("refuses %00", () => {
    // arrange
    const address = "https://host.example/o%00/r.git";

    // act
    const refusal = gitUrlRefusal(address);

    // assert
    assert.strictEqual(
      refusal,
      'Invalid git URL: https://host.example/o%00/r.git \u2014 "%00" in a git address means different things to different versions of git, so it is not allowed. Remove it.',
    );
  });

  for (const address of [
    "https://host.example/o/[r].git",
    "git@host.example:o/%5Br%5D",
    "ssh://git@[zz]/o/r",
    "ssh://git@[1:2:3]/x",
    "file://[::1]/x",
    "./a@[b]",
    "  [x]/y",
  ]) {
    test(`refuses the square bracket of ${address}`, () => {
      // arrange
      const expectedRefusal = `Invalid git URL: ${address.replace("git@[", "***@[")} \u2014 git can read a square bracket (also written %5B or %5D) as marking a server name or where a local path starts, so it could connect to a different server or open a different folder than this address names. In a server address, brackets may only surround an IPv6 address, as in git@[2001:db8::1]:repo.git. Remove them, or rename the folder whose name has them.`;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  for (const address of [
    "https://evil.example\\@good.example/o/r.git",
    "http:\\\\host.example/o",
  ]) {
    test(`refuses the backslash in the authority of ${address}`, () => {
      // arrange
      const expectedRefusal = `Invalid git URL: ${address.replace("evil.example\\@", "***@")} \u2014 a backslash before the first "/" can make git connect to a different server than this address names. Remove it, or write it as %5C if it is part of a user name.`;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  for (const { address, shownAddress } of [
    {
      address: "ssh://git@host.example/o/r.git?x=1",
      shownAddress: "ssh://***@host.example/o/r.git?***",
    },
    {
      address: "ssh://git@host.example/o/r.git#dev",
      shownAddress: "ssh://***@host.example/o/r.git#***",
    },
    {
      address: "ssh://-oProxyCommand=x@host.example/o/r",
      shownAddress: "ssh://***@host.example/o/r",
    },
    { address: "git+ssh://git@-host.example/o/r", shownAddress: "git+ssh://***@-host.example/o/r" },
    { address: "ssh+git://host.example:/o/r", shownAddress: "ssh+git://host.example:/o/r" },
    { address: "ssh:host.example/o/r", shownAddress: "ssh:host.example/o/r" },
  ]) {
    test(`refuses the ssh URL ${address}`, () => {
      // arrange
      const expectedRefusal = `Invalid ssh git URL: the host must be a hostname or bracketed IPv6 literal (optionally :port), the user a plain name, and the URL may not carry ? or # (${shownAddress})`;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  for (const address of ["https:host.example/o/r.git", "file:/srv/r.git"]) {
    test(`refuses the scheme of ${address}, which no // follows`, () => {
      // arrange
      const expectedRefusal = `Invalid git URL: ${address} \u2014 a scheme URL must be spelled scheme://\u2026`;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  for (const address of [
    "file://host/share/r.git",
    "file:////host/share",
    "file:///%2F%2Fhost/share",
    "file:///\\\\host\\share",
    "file:///%zz",
  ]) {
    test(`refuses the file URL ${address}, which names a host or a network path`, () => {
      // arrange
      const expectedRefusal = `Refusing git URL ${address}: a file: URL must name a local path (no host, no network-shaped path).`;

      // act
      const refusal = gitUrlRefusal(address);

      // assert
      assert.strictEqual(refusal, expectedRefusal);
    });
  }

  test("explains a drive letter when it refuses a file URL that names one", () => {
    // arrange
    const address = "file://C:/repos/r.git";

    // act
    const refusal = gitUrlRefusal(address);

    // assert
    assert.strictEqual(
      refusal,
      "Refusing git URL file://C:/repos/r.git: a file: URL must name a local path (no host, no network-shaped path). A drive letter such as C: counts as a local path only on Windows.",
    );
  });

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

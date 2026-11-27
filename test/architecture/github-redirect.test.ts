/**
 * @fileoverview Pins the routing rule of the GitHub redirect: every https
 * request for github.com goes to the git host, loopback passes, and every
 * other host is refused, so no request of a routed scenario leaves the
 * machine (D-BG-01).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { routeRequest } from "../../features/lib/github-redirect/routing.ts";

import type { RedirectConfig } from "../../features/lib/github-redirect/routing.ts";

const config = { gitHost: "127.0.0.1:1111" } satisfies RedirectConfig;

test("routes a git request for github.com to the git host with its path kept", () => {
  // arrange
  const url = new URL("https://github.com/acme/tools.git/info/refs?service=git-upload-pack");

  // act
  const route = routeRequest(url, config);

  // assert
  assert.deepStrictEqual(route, {
    decision: "routed",
    target: "git host",
    url: "https://127.0.0.1:1111/acme/tools.git/info/refs?service=git-upload-pack",
  });
});

test("routes a request for a /login/ path of github.com to the git host like any other path", () => {
  // arrange
  const url = new URL("https://github.com/login/device/code");

  // act
  const route = routeRequest(url, config);

  // assert
  assert.deepStrictEqual(route, {
    decision: "routed",
    target: "git host",
    url: "https://127.0.0.1:1111/login/device/code",
  });
});

for (const { address } of [
  { address: "https://127.0.0.1:1111/acme/tools.git" },
  { address: "https://localhost:1111/acme/tools.git" },
  { address: "https://[::1]:1111/acme/tools.git" },
]) {
  test(`passes a request to the loopback address ${address}`, () => {
    // arrange
    const url = new URL(address);

    // act
    const route = routeRequest(url, config);

    // assert
    assert.deepStrictEqual(route, { decision: "passed" });
  });
}

for (const { address, host } of [
  { address: "https://api.github.com/repos/acme/tools", host: "api.github.com" },
  { address: "https://codeload.github.com/acme/tools/tar.gz/main", host: "codeload.github.com" },
  {
    address: "https://objects.githubusercontent.com/acme/tools",
    host: "objects.githubusercontent.com",
  },
  { address: "https://example.com/acme/tools.git", host: "example.com" },
  { address: "http://github.com/acme/tools.git", host: "github.com" },
]) {
  test(`refuses a request to ${address}`, () => {
    // arrange
    const url = new URL(address);

    // act
    const route = routeRequest(url, config);

    // assert
    assert.deepStrictEqual(route, { decision: "refused", host });
  });
}

test("refuses a request for github.com when the redirect has no config", () => {
  // arrange
  const url = new URL("https://github.com/acme/tools.git/info/refs?service=git-upload-pack");

  // act
  const route = routeRequest(url, undefined);

  // assert
  assert.deepStrictEqual(route, { decision: "refused", host: "github.com" });
});

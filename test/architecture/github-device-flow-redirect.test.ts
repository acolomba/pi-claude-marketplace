/**
 * @fileoverview Pins the routing rule of the GitHub redirect: github.com goes
 * to the loopback stand-ins, loopback passes, and every other host is refused,
 * so no request of a sign-in scenario leaves the machine (D-BG-01).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { routeRequest } from "../../features/lib/github-device-flow/routing.ts";

import type { RedirectConfig } from "../../features/lib/github-device-flow/routing.ts";

const config = { gitHost: "127.0.0.1:1111", signIn: "127.0.0.1:2222" } satisfies RedirectConfig;

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

for (const { path } of [{ path: "/login/device/code" }, { path: "/login/oauth/access_token" }]) {
  test(`routes https://github.com${path} to the sign-in stand-in`, () => {
    // arrange
    const url = new URL(`https://github.com${path}`);

    // act
    const route = routeRequest(url, config);

    // assert
    assert.deepStrictEqual(route, {
      decision: "routed",
      target: "sign-in",
      url: `https://127.0.0.1:2222${path}`,
    });
  });
}

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

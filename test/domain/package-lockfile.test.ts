import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeLockfile } from "../../extensions/pi-claude-marketplace/domain/package-lockfile.ts";

import type {
  LockfileCheck,
  LockfileInput,
} from "../../extensions/pi-claude-marketplace/domain/package-lockfile.ts";

type Fields = Record<string, unknown>;

const LINK = "https://registry.npmjs.org/pkd-dep/-/pkd-dep-1.0.0.tgz";
const INTEGRITY = "sha512-AAAA";
const DEP_KEY = "node_modules/pkd-dep";
const NPM_ENTRY = `its package-lock.json entry "${DEP_KEY}"`;
const BUN_ENTRY = 'its bun.lock entry "pkd-dep"';
const DEPENDENCIES = { dependencies: { "pkd-dep": "^1.0.0" } };

function manifest(fields: Fields = {}): Fields {
  return { name: "plugin", version: "1.0.0", ...DEPENDENCIES, ...fields };
}

function npmEntry(fields: Fields = {}): Fields {
  return { version: "1.0.0", resolved: LINK, integrity: INTEGRITY, ...fields };
}

interface NpmLockParts {
  readonly top?: Fields;
  readonly root?: Fields;
  readonly entries?: Fields;
}

function npmLockText({
  top = {},
  root = {},
  entries = { [DEP_KEY]: npmEntry() },
}: NpmLockParts = {}): string {
  return JSON.stringify({
    name: "plugin",
    version: "1.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: { "": { name: "plugin", version: "1.0.0", ...DEPENDENCIES, ...root }, ...entries },
    ...top,
  });
}

function npmInput(fields: Partial<LockfileInput> = {}): LockfileInput {
  return {
    manager: "npm",
    lockfileName: "package-lock.json",
    manifest: manifest(),
    lockfileText: npmLockText(),
    registryOrigin: undefined,
    ...fields,
  };
}

interface BunLockParts {
  readonly top?: Fields;
  readonly workspace?: Fields;
  readonly packages?: Fields;
}

function bunPackage(
  fields: { meta?: unknown; resolved?: unknown; integrity?: unknown } = {},
): unknown[] {
  return ["pkd-dep@1.0.0", fields.resolved ?? "", fields.meta ?? {}, fields.integrity ?? INTEGRITY];
}

function bunLockText({
  top = {},
  workspace = {},
  packages = { "pkd-dep": bunPackage() },
}: BunLockParts = {}): string {
  return JSON.stringify({
    lockfileVersion: 1,
    workspaces: { "": { name: "plugin", ...DEPENDENCIES, ...workspace } },
    packages,
    ...top,
  });
}

function bunInput(fields: Partial<LockfileInput> = {}): LockfileInput {
  return {
    manager: "bun",
    lockfileName: "bun.lock",
    manifest: manifest(),
    lockfileText: bunLockText(),
    registryOrigin: undefined,
    ...fields,
  };
}

function npmRewrite(dependencies: Fields, entries: Fields): LockfileCheck {
  const root = { name: "plugin-dependencies", version: "0.0.0", ...dependencies };
  return {
    sanitized: {
      packageCount: Object.keys(entries).length,
      packageJson: root,
      lockfileName: "package-lock.json",
      lockfile: {
        name: "plugin-dependencies",
        version: "0.0.0",
        lockfileVersion: 3,
        requires: true,
        packages: { "": root, ...entries },
      },
    },
  };
}

function bunRewrite(dependencies: Fields, packages: Fields): LockfileCheck {
  return {
    sanitized: {
      packageCount: Object.keys(packages).length,
      packageJson: { name: "plugin-dependencies", version: "0.0.0", ...dependencies },
      lockfileName: "bun.lock",
      lockfile: {
        lockfileVersion: 1,
        workspaces: { "": { name: "plugin-dependencies", ...dependencies } },
        packages,
      },
    },
  };
}

function withEntry(fields: Fields): LockfileInput {
  return npmInput({ lockfileText: npmLockText({ entries: { [DEP_KEY]: npmEntry(fields) } }) });
}

function withBunPackage(value: unknown): LockfileInput {
  return bunInput({ lockfileText: bunLockText({ packages: { "pkd-dep": value } }) });
}

function withLink(link: unknown, registryOrigin?: string): LockfileInput {
  return { ...withEntry({ resolved: link }), registryOrigin };
}

const REFUSALS: ReadonlyArray<{ situation: string; input: LockfileInput; refusal: string }> = [
  {
    situation: "an npm lockfile that is not JSON",
    input: npmInput({ lockfileText: "{" }),
    refusal: "its package-lock.json is not valid JSON",
  },
  {
    situation: "an npm lockfile that is a JSON array",
    input: npmInput({ lockfileText: "[]" }),
    refusal: "its package-lock.json is not a JSON object",
  },
  {
    situation: "an npm lockfile of version 1",
    input: npmInput({ lockfileText: npmLockText({ top: { lockfileVersion: 1 } }) }),
    refusal: "its package-lock.json is in an old format; regenerate it with npm 7 or later",
  },
  {
    situation: "a package.json with overrides",
    input: npmInput({ manifest: manifest({ overrides: { "pkd-dep": "1.0.0" } }) }),
    refusal: "its package.json sets overrides, which this install does not apply",
  },
  {
    situation: "an npm lockfile whose packages are a list",
    input: npmInput({ lockfileText: npmLockText({ top: { packages: [] } }) }),
    refusal: "its package-lock.json has no packages section with the plugin in it",
  },
  {
    situation: "an npm lockfile whose packages leave out the plugin",
    input: npmInput({
      lockfileText: npmLockText({ top: { packages: { [DEP_KEY]: npmEntry() } } }),
    }),
    refusal: "its package-lock.json has no packages section with the plugin in it",
  },
  {
    situation: "an npm lockfile root whose dependencies are a list",
    input: npmInput({ lockfileText: npmLockText({ root: { dependencies: ["pkd-dep"] } }) }),
    refusal: "its package-lock.json has an unreadable dependencies list",
  },
  {
    situation: "an npm lockfile root that lists a local folder",
    input: npmInput({
      manifest: manifest({ dependencies: { "pkd-dep": "file:../pkd-dep" } }),
      lockfileText: npmLockText({ root: { dependencies: { "pkd-dep": "file:../pkd-dep" } } }),
    }),
    refusal:
      "its package-lock.json has a dependency that is not a registry package and version range: pkd-dep",
  },
  {
    situation: "a package.json that lists a git repository",
    input: npmInput({ manifest: manifest({ dependencies: { "pkd-dep": "github:acme/pkd-dep" } }) }),
    refusal:
      "its package.json has a dependency that is not a registry package and version range: pkd-dep",
  },
  {
    situation: "a package.json and lockfile with different ranges",
    input: npmInput({ manifest: manifest({ dependencies: { "pkd-dep": "^2.0.0" } }) }),
    refusal: "its package.json and package-lock.json list different dependencies",
  },
  {
    situation: "an npm entry outside node_modules",
    input: npmInput({ lockfileText: npmLockText({ entries: { "lib/pkd-dep": npmEntry() } }) }),
    refusal: 'its package-lock.json entry "lib/pkd-dep" is not a package in node_modules',
  },
  {
    situation: "an npm entry that is text",
    input: npmInput({ lockfileText: npmLockText({ entries: { [DEP_KEY]: "1.0.0" } }) }),
    refusal: `${NPM_ENTRY} is not an object`,
  },
  {
    situation: "an npm entry that is a folder link",
    input: withEntry({ link: true }),
    refusal: `${NPM_ENTRY} is a folder link or a bundled copy`,
  },
  {
    situation: "an npm entry that is a bundled copy",
    input: withEntry({ inBundle: true }),
    refusal: `${NPM_ENTRY} is a folder link or a bundled copy`,
  },
  {
    situation: "an npm entry with a version range",
    input: withEntry({ version: "^1.0.0" }),
    refusal: `${NPM_ENTRY} has no exact version`,
  },
  {
    situation: "an npm entry with a path for a name",
    input: withEntry({ name: "../pkd-dep" }),
    refusal: `${NPM_ENTRY} has a name that is not an npm package name`,
  },
  {
    situation: "an npm entry whose download link is a number",
    input: withEntry({ resolved: 5 }),
    refusal: `${NPM_ENTRY} has a download link that is not text`,
  },
  {
    situation: "an npm entry with a download link and no integrity",
    input: withEntry({ integrity: undefined }),
    refusal: `${NPM_ENTRY} has no integrity hash for its download link`,
  },
  {
    situation: "an npm entry with a download link and an empty integrity",
    input: withEntry({ integrity: "" }),
    refusal: `${NPM_ENTRY} has no integrity hash for its download link`,
  },
  {
    situation: "an npm entry with no download link and an empty integrity",
    input: withEntry({ resolved: undefined, integrity: "" }),
    refusal: `${NPM_ENTRY} has an empty integrity hash`,
  },
  {
    situation: "an npm entry with an md5 integrity",
    input: withEntry({ integrity: "md5-AAAA" }),
    refusal: `${NPM_ENTRY} has an unreadable integrity hash`,
  },
  {
    situation: "an npm entry that depends on a git repository",
    input: withEntry({ dependencies: { inner: "git+https://example.com/inner.git" } }),
    refusal: `${NPM_ENTRY} has a dependency that is not a registry package and version range: inner`,
  },
  {
    situation: "an npm entry whose optionalDependencies are text",
    input: withEntry({ optionalDependencies: "inner" }),
    refusal: `${NPM_ENTRY} has an unreadable optionalDependencies list`,
  },
  {
    situation: "an npm entry whose os is text",
    input: withEntry({ os: "linux" }),
    refusal: `${NPM_ENTRY} has an unreadable os list`,
  },
  {
    situation: "an npm entry whose bin leaves the package",
    input: withEntry({ bin: "../cli.js" }),
    refusal: `${NPM_ENTRY} has a bin link that points outside its package or has an invalid command name`,
  },
  {
    situation: "an npm-shrinkwrap.json that is not JSON",
    input: npmInput({ lockfileName: "npm-shrinkwrap.json", lockfileText: "{" }),
    refusal: "its npm-shrinkwrap.json is not valid JSON",
  },
  {
    situation: "an npm-shrinkwrap.json entry that is a folder link",
    input: npmInput({
      lockfileName: "npm-shrinkwrap.json",
      lockfileText: npmLockText({ entries: { [DEP_KEY]: npmEntry({ link: true }) } }),
    }),
    refusal: `its npm-shrinkwrap.json entry "${DEP_KEY}" is a folder link or a bundled copy`,
  },
  {
    situation: "an npm entry key of 121 characters",
    input: npmInput({
      lockfileText: npmLockText({ entries: { [`lib/${"a".repeat(117)}`]: npmEntry() } }),
    }),
    refusal: `its package-lock.json entry "lib/${"a".repeat(116)}" is not a package in node_modules`,
  },
  {
    situation: "a bun.lock with a comment",
    input: bunInput({ lockfileText: '{ // the plugin\n "lockfileVersion": 1 }' }),
    refusal: "its bun.lock is not valid JSON",
  },
  {
    situation: "a bun.lock that is not JSON",
    input: bunInput({ lockfileText: "{" }),
    refusal: "its bun.lock is not valid JSON",
  },
  {
    situation: "a bun.lock that is a JSON array",
    input: bunInput({ lockfileText: "[]" }),
    refusal: "its bun.lock is not valid JSON",
  },
  {
    situation: "a bun.lock of version 3",
    input: bunInput({ lockfileText: bunLockText({ top: { lockfileVersion: 3 } }) }),
    refusal: "its bun.lock is in a format this extension does not read",
  },
  {
    situation: "a bun.lock with patchedDependencies",
    input: bunInput({ lockfileText: bunLockText({ top: { patchedDependencies: {} } }) }),
    refusal: "it patches its dependencies (patchedDependencies), which this install does not apply",
  },
  {
    situation: "a package.json with patchedDependencies beside a bun.lock",
    input: bunInput({ manifest: manifest({ patchedDependencies: {} }) }),
    refusal: "it patches its dependencies (patchedDependencies), which this install does not apply",
  },
  {
    situation: "a bun.lock with no workspaces",
    input: bunInput({ lockfileText: bunLockText({ top: { workspaces: undefined } }) }),
    refusal: "its bun.lock does not list the plugin as its only workspace",
  },
  {
    situation: "a bun.lock whose plugin workspace is a list",
    input: bunInput({ lockfileText: bunLockText({ top: { workspaces: { "": [] } } }) }),
    refusal: "its bun.lock does not list the plugin as its only workspace",
  },
  {
    situation: "a bun.lock with a second workspace",
    input: bunInput({
      lockfileText: bunLockText({ top: { workspaces: { "": {}, "packages/a": {} } } }),
    }),
    refusal: "its bun.lock does not list the plugin as its only workspace",
  },
  {
    situation: "a bun.lock whose packages are a list",
    input: bunInput({ lockfileText: bunLockText({ top: { packages: [] } }) }),
    refusal: "its bun.lock lists no packages",
  },
  {
    situation: "a bun.lock whose workspace lists other dependencies than package.json",
    input: bunInput({
      lockfileText: bunLockText({ workspace: { dependencies: { other: "1.0.0" } } }),
    }),
    refusal: "its package.json and bun.lock list different dependencies",
  },
  {
    situation: "a bun.lock workspace whose optionalPeers are text",
    input: bunInput({ lockfileText: bunLockText({ workspace: { optionalPeers: "pkd-peer" } }) }),
    refusal: "its bun.lock has an unreadable optionalPeers list",
  },
  {
    situation: "a bun.lock workspace with a path as an optional peer",
    input: bunInput({
      lockfileText: bunLockText({ workspace: { optionalPeers: ["../pkd-peer"] } }),
    }),
    refusal: "its bun.lock has an optional peer that is not a registry package: ../pkd-peer",
  },
  {
    situation: "a bun package path that leaves the folder",
    input: bunInput({ lockfileText: bunLockText({ packages: { "../evil": bunPackage() } }) }),
    refusal: 'its bun.lock entry "../evil" is not a package path',
  },
  {
    situation: "a bun package path that ends in a bare scope",
    input: bunInput({
      lockfileText: bunLockText({ packages: { "pkd-dep/@scope": bunPackage() } }),
    }),
    refusal: 'its bun.lock entry "pkd-dep/@scope" is not a package path',
  },
  {
    situation: "a bun package that is text",
    input: withBunPackage("pkd-dep@1.0.0"),
    refusal: `${BUN_ENTRY} is not a registry package`,
  },
  {
    situation: "a bun package of three fields",
    input: withBunPackage(["pkd-dep@1.0.0", "", {}]),
    refusal: `${BUN_ENTRY} is not a registry package`,
  },
  {
    situation: "a bun package whose name is a number",
    input: withBunPackage([5, "", {}, INTEGRITY]),
    refusal: `${BUN_ENTRY} is not a registry package at an exact version`,
  },
  {
    situation: "a bun package with no version",
    input: withBunPackage(["pkd-dep", "", {}, INTEGRITY]),
    refusal: `${BUN_ENTRY} is not a registry package at an exact version`,
  },
  {
    situation: "a bun package with a path for a name",
    input: withBunPackage(["../pkd-dep@1.0.0", "", {}, INTEGRITY]),
    refusal: `${BUN_ENTRY} is not a registry package at an exact version`,
  },
  {
    situation: "a bun package at a version range",
    input: withBunPackage(["pkd-dep@^1.0.0", "", {}, INTEGRITY]),
    refusal: `${BUN_ENTRY} is not a registry package at an exact version`,
  },
  {
    situation: "a bun package with a download link on GitHub",
    input: withBunPackage(bunPackage({ resolved: "https://github.com/acme/pkd-dep.tgz" })),
    refusal: `${BUN_ENTRY} has a download link that is on GitHub, GitLab, Bitbucket or SourceHut, where bun may fetch it as a git repository and run its setup script`,
  },
  {
    situation: "a bun package whose metadata is text",
    input: withBunPackage(bunPackage({ meta: "meta" })),
    refusal: `${BUN_ENTRY} has unreadable metadata`,
  },
  {
    situation: "a bun package whose cpu is a number",
    input: withBunPackage(bunPackage({ meta: { cpu: 5 } })),
    refusal: `${BUN_ENTRY} has an unreadable cpu list`,
  },
  {
    situation: "a bun package whose optionalPeers are text",
    input: withBunPackage(bunPackage({ meta: { optionalPeers: "pkd-peer" } })),
    refusal: `${BUN_ENTRY} has an unreadable optionalPeers list`,
  },
  {
    situation: "a bun package whose bin has a path for a command name",
    input: withBunPackage(bunPackage({ meta: { bin: { "a/b": "cli.js" } } })),
    refusal: `${BUN_ENTRY} has a bin link that points outside its package or has an invalid command name`,
  },
  {
    situation: "a bun package whose bin folder leaves the package",
    input: withBunPackage(bunPackage({ meta: { binDir: "../bin" } })),
    refusal: `${BUN_ENTRY} has a bin folder outside its package`,
  },
  {
    situation: "a bun package whose bin folder is a number",
    input: withBunPackage(bunPackage({ meta: { binDir: 5 } })),
    refusal: `${BUN_ENTRY} has a bin folder outside its package`,
  },
  {
    situation: "a bun package with no download link and an empty integrity",
    input: withBunPackage(bunPackage({ integrity: "" })),
    refusal: `${BUN_ENTRY} has an empty integrity hash`,
  },
  {
    situation: "a bun package with a download link and an empty integrity",
    input: withBunPackage(bunPackage({ resolved: LINK, integrity: "" })),
    refusal: `${BUN_ENTRY} has no integrity hash for its download link`,
  },
  {
    situation: "a bun package whose integrity is a number",
    input: withBunPackage(bunPackage({ integrity: 5 })),
    refusal: `${BUN_ENTRY} has an unreadable integrity hash`,
  },
];

for (const { situation, input, refusal } of REFUSALS) {
  test(`refuses ${situation}`, () => {
    // arrange
    const expectedCheck = { refusal };

    // act
    const check = sanitizeLockfile(input);

    // assert
    assert.deepStrictEqual(check, expectedCheck);
  });
}

for (const spec of ["1.0.0", "^1.2.0 || 2.x", "latest", "", "npm:@scope/pkd-dep@^1.0.0"]) {
  test(`accepts the registry spec "${spec}"`, () => {
    // arrange
    const dependencies = { dependencies: { "pkd-dep": spec } };
    const input = npmInput({
      manifest: manifest(dependencies),
      lockfileText: npmLockText({ root: dependencies }),
    });

    // act
    const check = sanitizeLockfile(input);

    // assert
    assert.deepStrictEqual(check, npmRewrite(dependencies, { [DEP_KEY]: npmEntry() }));
  });
}

for (const { spec, name } of [
  { spec: "file:../pkd-dep", name: "pkd-dep" },
  { spec: "git+https://example.com/pkd-dep.git", name: "pkd-dep" },
  { spec: "acme/pkd-dep", name: "pkd-dep" },
  { spec: "https://example.com/pkd-dep-1.0.0.tgz", name: "pkd-dep" },
  { spec: "x.tgz", name: "pkd-dep" },
  { spec: 5, name: "pkd-dep" },
  { spec: "1.0.0", name: "../pkd-dep" },
]) {
  test(`refuses the dependency ${name} at ${JSON.stringify(spec)}`, () => {
    // arrange
    const dependencies = { dependencies: { [name]: spec } };
    const input = npmInput({
      manifest: manifest(dependencies),
      lockfileText: npmLockText({ root: dependencies }),
    });

    // act
    const check = sanitizeLockfile(input);

    // assert
    assert.deepStrictEqual(check, {
      refusal: `its package-lock.json has a dependency that is not a registry package and version range: ${name}`,
    });
  });
}

for (const { situation, link, registryOrigin } of [
  { situation: "an https link", link: LINK, registryOrigin: undefined },
  {
    situation: "an http link on npm's registry",
    link: "http://127.0.0.1:4873/pkd-dep/-/pkd-dep-1.0.0.tgz",
    registryOrigin: "http://127.0.0.1:4873",
  },
  {
    situation: "a link to GitLab's package API",
    link: "https://gitlab.com/api/v4/projects/1/packages/npm/pkd-dep/-/pkd-dep-1.0.0.tgz",
    registryOrigin: undefined,
  },
]) {
  test(`accepts ${situation}`, () => {
    // arrange
    const input = withLink(link, registryOrigin);

    // act
    const check = sanitizeLockfile(input);

    // assert
    assert.deepStrictEqual(
      check,
      npmRewrite(DEPENDENCIES, { [DEP_KEY]: npmEntry({ resolved: link }) }),
    );
  });
}

const FORGE_REASON =
  "is on GitHub, GitLab, Bitbucket or SourceHut, where npm may fetch it as a git repository and run its setup script";
const HTTP_REASON =
  "is an unencrypted http link on a host other than your npm registry, so npm could send your saved registry token to it in the clear";
const CHARACTER_REASON = 'contains a "#", whitespace, a backslash or a control character';

for (const { situation, link, registryOrigin, reason } of [
  {
    situation: "an ftp link",
    link: "ftp://example.com/x.tgz",
    reason: "is not an http or https link",
  },
  {
    situation: "an unparsable link",
    link: "https://[bad/x.tgz",
    reason: "is not an http or https link",
  },
  {
    situation: "a link with a fragment",
    link: "https://example.com/x.tgz#a",
    reason: CHARACTER_REASON,
  },
  {
    situation: "a link with a DEL character",
    link: "https://example.com/x\u007f.tgz",
    reason: CHARACTER_REASON,
  },
  { situation: "a GitHub link", link: "https://github.com/acme/pkd-dep.tgz", reason: FORGE_REASON },
  {
    situation: "a www.www.github.com link",
    link: "https://www.www.github.com/a.tgz",
    reason: FORGE_REASON,
  },
  { situation: "a github.com. link", link: "https://github.com./a.tgz", reason: FORGE_REASON },
  {
    situation: "a GitLab project link",
    link: "https://gitlab.com/acme/pkd-dep/-/archive/x.tgz",
    reason: FORGE_REASON,
  },
  {
    situation: "a GitLab API link outside the package files",
    link: "https://gitlab.com/api/v4/projects/1.tgz",
    reason: FORGE_REASON,
  },
  {
    situation: "a link whose path starts with //",
    link: "https://example.com//x.tgz",
    reason: 'starts its path with "//"',
  },
  {
    situation: "an http link on another host than npm's registry",
    link: "http://127.0.0.1:9/x.tgz",
    registryOrigin: "http://127.0.0.1:4873",
    reason: HTTP_REASON,
  },
  {
    situation: "an http link when npm's registry is not http",
    link: "http://127.0.0.1:9/x.tgz",
    reason: HTTP_REASON,
  },
]) {
  test(`refuses ${situation}`, () => {
    // arrange
    const input = withLink(link, registryOrigin);

    // act
    const check = sanitizeLockfile(input);

    // assert
    assert.deepStrictEqual(check, { refusal: `${NPM_ENTRY} has a download link that ${reason}` });
  });
}

for (const bin of ["bin/cli.js", { pkd: "bin/cli.js" }]) {
  test(`accepts the bin ${JSON.stringify(bin)}`, () => {
    // arrange
    const input = withEntry({ bin });

    // act
    const check = sanitizeLockfile(input);

    // assert
    assert.deepStrictEqual(check, npmRewrite(DEPENDENCIES, { [DEP_KEY]: npmEntry({ bin }) }));
  });
}

for (const bin of [
  "",
  "/usr/bin/cli.js",
  "bin\\cli.js",
  "c:cli.js",
  "bin/../../cli.js",
  { "": "cli.js" },
  { ".": "cli.js" },
  { "..": "cli.js" },
  { "a/b": "cli.js" },
  { pkd: 5 },
  { pkd: "../cli.js" },
  5,
]) {
  test(`refuses the bin ${JSON.stringify(bin)}`, () => {
    // arrange
    const input = withEntry({ bin });

    // act
    const check = sanitizeLockfile(input);

    // assert
    assert.deepStrictEqual(check, {
      refusal: `${NPM_ENTRY} has a bin link that points outside its package or has an invalid command name`,
    });
  });
}

test("accepts an integrity of several hashes", () => {
  // arrange
  const integrity = "sha512-AAAA sha1-BBBB=";
  const input = withEntry({ integrity });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(check, npmRewrite(DEPENDENCIES, { [DEP_KEY]: npmEntry({ integrity }) }));
});

test("accepts a package nested in node_modules and counts every package", () => {
  // arrange
  const nested = "node_modules/pkd-dep/node_modules/@scope/inner";
  const input = npmInput({
    lockfileText: npmLockText({ entries: { [DEP_KEY]: npmEntry(), [nested]: npmEntry() } }),
  });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(
    check,
    npmRewrite(DEPENDENCIES, { [DEP_KEY]: npmEntry(), [nested]: npmEntry() }),
  );
});

test("compares the dependency lists whatever their order", () => {
  // arrange
  const input = npmInput({
    manifest: manifest({ dependencies: { "pkd-b": "1.0.0", "pkd-a": "1.0.0", "pkd-c": "1.0.0" } }),
    lockfileText: npmLockText({
      root: { dependencies: { "pkd-c": "1.0.0", "pkd-a": "1.0.0", "pkd-b": "1.0.0" } },
    }),
  });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(
    check,
    npmRewrite(
      { dependencies: { "pkd-c": "1.0.0", "pkd-a": "1.0.0", "pkd-b": "1.0.0" } },
      { [DEP_KEY]: npmEntry() },
    ),
  );
});

test("leaves out of dependencies the names package.json lists as optional", () => {
  // arrange
  const lists = {
    dependencies: { "pkd-dep": "^1.0.0" },
    optionalDependencies: { "pkd-opt": "^1.0.0" },
  };
  const input = npmInput({
    manifest: manifest({ ...lists, dependencies: { "pkd-dep": "^1.0.0", "pkd-opt": "^1.0.0" } }),
    lockfileText: npmLockText({ root: lists }),
  });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(check, npmRewrite(lists, { [DEP_KEY]: npmEntry() }));
});

test("accepts a package.json that lists only optional dependencies", () => {
  // arrange
  const lists = { optionalDependencies: { "pkd-opt": "^1.0.0" } };
  const input = npmInput({
    manifest: { name: "plugin", ...lists },
    lockfileText: JSON.stringify({ lockfileVersion: 3, packages: { "": lists } }),
  });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(check, npmRewrite(lists, {}));
});

test("keeps optional names in devDependencies for npm", () => {
  // arrange
  const input = npmInput({
    manifest: manifest({
      devDependencies: { "pkd-opt": "^1.0.0" },
      optionalDependencies: { "pkd-opt": "^1.0.0" },
    }),
    lockfileText: npmLockText({ root: { optionalDependencies: { "pkd-opt": "^1.0.0" } } }),
  });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(check, {
    refusal: "its package.json and package-lock.json list different dependencies",
  });
});

test("leaves out of dependencies and devDependencies the names package.json lists as optional for bun", () => {
  // arrange
  const lists = {
    dependencies: { "pkd-dep": "^1.0.0" },
    optionalDependencies: { "pkd-opt": "^1.0.0" },
  };
  const input = bunInput({
    manifest: manifest({
      ...lists,
      devDependencies: { "pkd-opt": "^1.0.0" },
    }),
    lockfileText: bunLockText({ workspace: { ...lists, devDependencies: {} } }),
  });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(
    check,
    bunRewrite({ ...lists, devDependencies: {} }, { "pkd-dep": bunPackage() }),
  );
});

test("rewrites an npm lockfile to the plugin-dependencies root and the fields that decide the install", () => {
  // arrange
  const input = npmInput({
    manifest: manifest({
      description: "kept out",
      peerDependencies: { "pkd-peer": "^1.0.0" },
      peerDependenciesMeta: {
        "pkd-peer": { optional: true, note: "dropped" },
        "Bad Name": { optional: true },
        "pkd-other": "text",
        "pkd-plain": {},
      },
    }),
    lockfileText: npmLockText({
      root: { license: "MIT", peerDependencies: { "pkd-peer": "^1.0.0" } },
      entries: {
        [DEP_KEY]: {
          license: "MIT",
          hasInstallScript: true,
          peerDependenciesMeta: { "pkd-peer": { optional: false } },
          bin: { pkd: "bin/cli.js" },
          libc: ["glibc"],
          cpu: ["x64"],
          os: ["linux"],
          peer: true,
          devOptional: true,
          optional: true,
          dev: false,
          engines: { node: ">=18" },
          peerDependencies: { "pkd-peer": "^1.0.0" },
          dependencies: { inner: "1.0.0" },
          integrity: INTEGRITY,
          resolved: LINK,
          name: "pkd-dep",
          version: "1.0.0",
        },
      },
    }),
  });
  const root = {
    name: "plugin-dependencies",
    version: "0.0.0",
    dependencies: { "pkd-dep": "^1.0.0" },
    peerDependencies: { "pkd-peer": "^1.0.0" },
    peerDependenciesMeta: { "pkd-peer": { optional: true }, "pkd-plain": { optional: false } },
  };
  const expectedCheck = {
    sanitized: {
      packageCount: 1,
      packageJson: root,
      lockfileName: "package-lock.json",
      lockfile: {
        name: "plugin-dependencies",
        version: "0.0.0",
        lockfileVersion: 3,
        requires: true,
        packages: {
          "": root,
          [DEP_KEY]: {
            version: "1.0.0",
            name: "pkd-dep",
            resolved: LINK,
            integrity: INTEGRITY,
            dependencies: { inner: "1.0.0" },
            peerDependencies: { "pkd-peer": "^1.0.0" },
            optional: true,
            devOptional: true,
            peer: true,
            os: ["linux"],
            cpu: ["x64"],
            libc: ["glibc"],
            bin: { pkd: "bin/cli.js" },
            peerDependenciesMeta: { "pkd-peer": { optional: false } },
          },
        },
      },
    },
  };

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.strictEqual(JSON.stringify(check), JSON.stringify(expectedCheck));
});

test("rewrites a bun.lock to the plugin-dependencies workspace and the fields that decide the install", () => {
  // arrange
  const input = bunInput({
    manifest: manifest({
      peerDependencies: { "pkd-peer": "^1.0.0" },
      peerDependenciesMeta: { "pkd-peer": { optional: true } },
    }),
    lockfileText: bunLockText({
      top: { configVersion: 1, trustedDependencies: ["pkd-dep"] },
      workspace: { peerDependencies: { "pkd-peer": "^1.0.0" }, optionalPeers: ["pkd-peer"] },
      packages: {
        "pkd-dep": [
          "pkd-dep@1.0.0",
          LINK,
          {
            extra: "dropped",
            binDir: "bin",
            bin: { pkd: "bin/cli.js" },
            optionalPeers: [],
            libc: ["glibc"],
            cpu: ["x64"],
            os: "linux",
            dependencies: { inner: "1.0.0" },
          },
          INTEGRITY,
        ],
        "@scope/inner": ["@scope/inner@2.0.0", "", {}, INTEGRITY],
        "pkd-dep/@scope/inner": ["@scope/inner@1.0.0", "", {}, INTEGRITY],
      },
    }),
  });
  const lists = {
    dependencies: { "pkd-dep": "^1.0.0" },
    peerDependencies: { "pkd-peer": "^1.0.0" },
  };
  const expectedCheck = {
    sanitized: {
      packageCount: 3,
      packageJson: {
        name: "plugin-dependencies",
        version: "0.0.0",
        ...lists,
        peerDependenciesMeta: { "pkd-peer": { optional: true } },
      },
      lockfileName: "bun.lock",
      lockfile: {
        lockfileVersion: 1,
        configVersion: 1,
        workspaces: { "": { name: "plugin-dependencies", ...lists, optionalPeers: ["pkd-peer"] } },
        packages: {
          "pkd-dep": [
            "pkd-dep@1.0.0",
            LINK,
            {
              dependencies: { inner: "1.0.0" },
              os: "linux",
              cpu: ["x64"],
              libc: ["glibc"],
              optionalPeers: [],
              bin: { pkd: "bin/cli.js" },
              binDir: "bin",
            },
            INTEGRITY,
          ],
          "@scope/inner": ["@scope/inner@2.0.0", "", {}, INTEGRITY],
          "pkd-dep/@scope/inner": ["@scope/inner@1.0.0", "", {}, INTEGRITY],
        },
      },
    },
  };

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.strictEqual(JSON.stringify(check), JSON.stringify(expectedCheck));
});

test("drops a bun configVersion that is not a number", () => {
  // arrange
  const input = bunInput({ lockfileText: bunLockText({ top: { configVersion: "1" } }) });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(check, bunRewrite(DEPENDENCIES, { "pkd-dep": bunPackage() }));
});

test("reads a bun.lock with trailing commas", () => {
  // arrange
  const input = bunInput({
    lockfileText: [
      "{",
      '  "lockfileVersion": 1,',
      '  "workspaces": { "": { "name": "plugin", "dependencies": { "pkd-dep": "^1.0.0", }, }, },',
      `  "packages": { "pkd-dep": ["pkd-dep@1.0.0", "", {}, "${INTEGRITY}",], },`,
      "}",
    ].join("\n"),
  });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(check, bunRewrite(DEPENDENCIES, { "pkd-dep": bunPackage() }));
});

test("counts no packages for a lockfile that lists only the plugin", () => {
  // arrange
  const input = npmInput({ lockfileText: npmLockText({ entries: {} }) });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(check, npmRewrite(DEPENDENCIES, {}));
});

test("writes an npm-shrinkwrap.json plugin's lockfile as package-lock.json", () => {
  // arrange
  const input = npmInput({ lockfileName: "npm-shrinkwrap.json" });

  // act
  const check = sanitizeLockfile(input);

  // assert
  assert.deepStrictEqual(check, npmRewrite(DEPENDENCIES, { [DEP_KEY]: npmEntry() }));
});

test("lets an error that is not about the lockfile propagate", () => {
  // arrange
  const failure = new TypeError("the manifest cannot be read");
  const unreadable = Object.defineProperty(manifest(), "overrides", {
    enumerable: true,
    get: () => {
      throw failure;
    },
  });

  // act & assert
  assert.throws(
    () => sanitizeLockfile(npmInput({ manifest: unreadable })),
    (error: unknown) => {
      assert.strictEqual(error, failure);
      return true;
    },
  );
});

const BOM = "\uFEFF";

for (const { lockfileName, input, expected } of [
  {
    lockfileName: "package-lock.json",
    input: (marks: string): LockfileInput => npmInput({ lockfileText: marks + npmLockText() }),
    expected: npmRewrite(DEPENDENCIES, { [DEP_KEY]: npmEntry() }),
  },
  {
    lockfileName: "npm-shrinkwrap.json",
    input: (marks: string): LockfileInput =>
      npmInput({ lockfileName: "npm-shrinkwrap.json", lockfileText: marks + npmLockText() }),
    expected: npmRewrite(DEPENDENCIES, { [DEP_KEY]: npmEntry() }),
  },
  {
    lockfileName: "bun.lock",
    input: (marks: string): LockfileInput => bunInput({ lockfileText: marks + bunLockText() }),
    expected: bunRewrite(DEPENDENCIES, { "pkd-dep": bunPackage() }),
  },
]) {
  test(`D-PL9-08: reads ${lockfileName} text that starts with one byte-order mark as Claude Code does`, () => {
    // act
    const check = sanitizeLockfile(input(BOM));

    // assert
    assert.deepStrictEqual(check, expected);
  });

  test(`D-PL9-08: refuses ${lockfileName} text that starts with two byte-order marks`, () => {
    // act
    const check = sanitizeLockfile(input(BOM + BOM));

    // assert
    assert.deepStrictEqual(check, { refusal: `its ${lockfileName} is not valid JSON` });
  });
}
